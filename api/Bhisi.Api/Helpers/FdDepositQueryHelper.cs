using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bhisi.Api.Helpers
{
    public sealed record FdSnapshotItem(
        int FdAccountID,
        int BranchID,
        int CustomerID,
        decimal DepositAmount,
        string Status);

    /// <summary>
    /// Shared EF-translatable predicates and historical as-of-date snapshot helpers
    /// for live deposit liabilities (Active and unclosed Matured accounts, excluding
    /// Closed and Renewed cycles so multi-cycle renewals are never double-counted).
    /// </summary>
    public static class FdDepositQueryHelper
    {
        private static readonly string[] ClosureOrRenewalTxTypes =
        {
            "Close",
            "Matured_Close",
            "Premature_Close",
            "PrematureClose",
            "Maturity",
            "Closure",
            "Payout",
            "Renewal"
        };

        public static readonly Expression<Func<FdAccount, bool>> LiveFdPredicate =
            f => f.Status == "Active" || f.Status == "Matured" || string.IsNullOrEmpty(f.Status);

        public static readonly Expression<Func<RdAccount, bool>> LiveRdPredicate =
            r => r.Status == "Active" || r.Status == "Matured" || string.IsNullOrEmpty(r.Status);

        public static readonly Expression<Func<PigmyAccount, bool>> LivePigmyPredicate =
            p => p.Status == "Active" || p.Status == "Matured" || string.IsNullOrEmpty(p.Status);

        public static bool IsLiveDepositStatus(string? status)
        {
            return string.IsNullOrEmpty(status) || status == "Active" || status == "Matured";
        }

        public static async Task<decimal> GetLiveFdTotalAsOfAsync(
            AppDbContext context,
            DateTime asOnDate,
            int? branchId = null)
        {
            DateTime targetDate = asOnDate.Date;

            if (targetDate >= DateTime.Today)
            {
                var query = context.FdAccounts.AsNoTracking().Where(LiveFdPredicate);
                if (branchId.HasValue && branchId.Value > 0)
                {
                    int bId = branchId.Value;
                    query = query.Where(f => f.BranchID == bId);
                }
                return await query.SumAsync(f => (decimal?)f.DepositAmount) ?? 0m;
            }

            var snapshots = await GetLiveFdSnapshotsAsOfAsync(context, targetDate, branchId);
            return snapshots.Sum(s => s.DepositAmount);
        }

        public static async Task<List<FdSnapshotItem>> GetLiveFdSnapshotsAsOfAsync(
            AppDbContext context,
            DateTime asOnDate,
            int? branchId = null)
        {
            DateTime targetDate = asOnDate.Date;

            if (targetDate >= DateTime.Today)
            {
                var liveQuery = context.FdAccounts.AsNoTracking().Where(LiveFdPredicate);
                if (branchId.HasValue && branchId.Value > 0)
                {
                    int bId = branchId.Value;
                    liveQuery = liveQuery.Where(f => f.BranchID == bId);
                }

                return await liveQuery
                    .Select(f => new FdSnapshotItem(
                        f.FdAccountID,
                        f.BranchID,
                        f.CustomerID,
                        f.DepositAmount,
                        f.Status))
                    .ToListAsync();
            }

            var accQuery = context.FdAccounts.AsNoTracking()
                .Where(f => f.OpeningDate.Date <= targetDate);

            if (branchId.HasValue && branchId.Value > 0)
            {
                int bId = branchId.Value;
                accQuery = accQuery.Where(f => f.BranchID == bId);
            }

            var candidateAccounts = await accQuery
                .OrderBy(f => f.FdAccountID)
                .Select(f => new
                {
                    f.FdAccountID,
                    f.BranchID,
                    f.CustomerID,
                    f.DepositAmount,
                    f.Status,
                    f.ModifiedDate,
                    f.ParentFdAccountID,
                    OpeningDate = f.OpeningDate.Date
                })
                .ToListAsync();

            if (candidateAccounts.Count == 0)
                return new List<FdSnapshotItem>();

            // Map Opening transaction dates for renewal child accounts so retroactive renewals
            // (where Child.OpeningDate = Old.MaturityDate < VoucherDate) are not counted on targetDate
            // while their Parent cycle is still live on targetDate.
            var childCandidateIds = candidateAccounts
                .Where(a => a.ParentFdAccountID.HasValue && a.ParentFdAccountID.Value > 0)
                .Select(a => a.FdAccountID)
                .ToList();

            var childOpeningTxDateMap = new Dictionary<int, DateTime>();
            if (childCandidateIds.Count > 0)
            {
                var openingTxs = await context.FdTransactions.AsNoTracking()
                    .Where(t => childCandidateIds.Contains(t.FdAccountID) && t.TransactionType == "Opening")
                    .Select(t => new { t.FdAccountID, TxDate = t.TransactionDate.Date })
                    .ToListAsync();

                foreach (var grp in openingTxs.GroupBy(t => t.FdAccountID))
                {
                    childOpeningTxDateMap[grp.Key] = grp.Min(x => x.TxDate);
                }
            }

            var nonLiveIds = candidateAccounts
                .Where(a => !IsLiveDepositStatus(a.Status))
                .Select(a => a.FdAccountID)
                .ToList();

            var exitDateMap = new Dictionary<int, DateTime>();
            var revertedAutoRenewalIds = new HashSet<int>();

            if (nonLiveIds.Count > 0)
            {
                var revertedIds = await context.FdAutoRenewalLogs.AsNoTracking()
                    .Where(l => l.IsReverted && l.NewFdAccountID.HasValue && nonLiveIds.Contains(l.NewFdAccountID.Value))
                    .Select(l => l.NewFdAccountID!.Value)
                    .Distinct()
                    .ToListAsync();

                revertedAutoRenewalIds = new HashSet<int>(revertedIds);

                var remainingNonLiveIds = nonLiveIds
                    .Where(id => !revertedAutoRenewalIds.Contains(id))
                    .ToList();

                if (remainingNonLiveIds.Count > 0)
                {
                    var closeTxs = await context.FdTransactions.AsNoTracking()
                        .Where(t => remainingNonLiveIds.Contains(t.FdAccountID) &&
                                    t.TransactionType != null &&
                                    ClosureOrRenewalTxTypes.Contains(t.TransactionType))
                        .Select(t => new { t.FdAccountID, TxDate = t.TransactionDate.Date })
                        .ToListAsync();

                    foreach (var grp in closeTxs.GroupBy(t => t.FdAccountID))
                    {
                        exitDateMap[grp.Key] = grp.Max(x => x.TxDate);
                    }
                }
            }

            var results = new List<FdSnapshotItem>(candidateAccounts.Count);
            var includedAccountIds = new HashSet<int>();
            foreach (var acc in candidateAccounts)
            {
                if (revertedAutoRenewalIds.Contains(acc.FdAccountID))
                    continue;

                if (acc.ParentFdAccountID.HasValue && acc.ParentFdAccountID.Value > 0)
                {
                    // Prevent double-counting Parent + Child in retroactive renewals where
                    // OpeningDate = Old.MaturityDate <= targetDate < Child Opening Tx Date
                    if (includedAccountIds.Contains(acc.ParentFdAccountID.Value))
                        continue;

                    if (childOpeningTxDateMap.TryGetValue(acc.FdAccountID, out var childTxDate) && childTxDate > targetDate)
                        continue;
                }

                if (IsLiveDepositStatus(acc.Status))
                {
                    results.Add(new FdSnapshotItem(
                        acc.FdAccountID,
                        acc.BranchID,
                        acc.CustomerID,
                        acc.DepositAmount,
                        acc.Status));
                    includedAccountIds.Add(acc.FdAccountID);
                    continue;
                }

                DateTime? exitDate = exitDateMap.TryGetValue(acc.FdAccountID, out var txDate)
                    ? txDate
                    : acc.ModifiedDate?.Date;

                if (exitDate.HasValue && exitDate.Value > targetDate)
                {
                    results.Add(new FdSnapshotItem(
                        acc.FdAccountID,
                        acc.BranchID,
                        acc.CustomerID,
                        acc.DepositAmount,
                        acc.Status));
                    includedAccountIds.Add(acc.FdAccountID);
                }
            }

            return results;
        }
    }
}
