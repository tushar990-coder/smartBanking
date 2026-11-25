using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Bhisi.Api.Helpers
{
    public sealed record RdSnapshotItem(
        int RdAccountID,
        int BranchID,
        int CustomerID,
        int RdSchemeID,
        string AccountNo,
        string? LegacyAccountNumber,
        DateTime OpeningDate,
        DateTime MaturityDate,
        decimal InstallmentAmount,
        int DurationMonths,
        decimal InterestRate,
        decimal MaturityAmount,
        decimal DepositedAmountAsOf,
        int PaidInstallmentsAsOf,
        decimal LegacyAccruedInt,
        string StatusAsOf,
        bool IsLegacyAccount,
        bool IsClosedLater,
        DateTime? ClosureDate,
        decimal PostCutoffInstallmentsAmount
    );

    /// <summary>
    /// Shared historical as-of-date snapshot helper for Recurring Deposit (RD) liabilities.
    /// Ensures point-in-time RD reports (e.g. as of 31-03-2026) and baseline FY opening syncs
    /// exclude installments deposited after the target cutoff date and retain accounts that were
    /// still open on the target date even if closed later.
    /// </summary>
    public static class RdDepositQueryHelper
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

        private static readonly string[] InstallmentCreditTxTypes =
        {
            "Installment",
            "Opening",
            "Deposit"
        };

        public static async Task<decimal> GetLiveRdTotalAsOfAsync(
            AppDbContext context,
            DateTime asOnDate,
            int? branchId = null,
            int? schemeId = null)
        {
            var snapshots = await GetLiveRdSnapshotsAsOfAsync(context, asOnDate, branchId, schemeId);
            return snapshots.Sum(s => s.DepositedAmountAsOf);
        }

        public static async Task<List<RdSnapshotItem>> GetLiveRdSnapshotsAsOfAsync(
            AppDbContext context,
            DateTime asOnDate,
            int? branchId = null,
            int? schemeId = null)
        {
            DateTime targetDate = asOnDate.Date;

            var accQuery = context.RdAccounts
                .AsNoTracking()
                .Where(r => r.OpeningDate.Date <= targetDate);

            if (branchId.HasValue && branchId.Value > 0)
            {
                int bId = branchId.Value;
                accQuery = accQuery.Where(r => r.BranchID == bId);
            }

            if (schemeId.HasValue && schemeId.Value > 0)
            {
                int sId = schemeId.Value;
                accQuery = accQuery.Where(r => r.RdSchemeID == sId);
            }

            var candidates = await accQuery
                .OrderBy(r => r.RdAccountID)
                .Select(r => new
                {
                    r.RdAccountID,
                    r.BranchID,
                    r.CustomerID,
                    r.RdSchemeID,
                    r.AccountNo,
                    r.LegacyAccountNumber,
                    OpeningDate = r.OpeningDate.Date,
                    MaturityDate = r.MaturityDate.Date,
                    r.InstallmentAmount,
                    r.DurationMonths,
                    r.InterestRate,
                    r.MaturityAmount,
                    r.TotalPaidInstallments,
                    r.TotalDepositedAmount,
                    r.IsLegacyAccount,
                    r.LegacyAccruedInt,
                    r.Status,
                    ClosureDate = r.ClosureDate.HasValue ? (DateTime?)r.ClosureDate.Value.Date : null,
                    ModifiedDate = r.ModifiedDate.HasValue ? (DateTime?)r.ModifiedDate.Value.Date : null
                })
                .ToListAsync();

            if (candidates.Count == 0)
            {
                return new List<RdSnapshotItem>();
            }

            // 1. Resolve exit dates for non-live accounts (Closed / Renewed)
            var nonLiveIds = candidates
                .Where(c => !FdDepositQueryHelper.IsLiveDepositStatus(c.Status))
                .Select(c => c.RdAccountID)
                .ToList();

            var exitDateMap = new Dictionary<int, DateTime>();
            if (nonLiveIds.Count > 0)
            {
                var closeTxs = await context.RdTransactions
                    .AsNoTracking()
                    .Where(t => nonLiveIds.Contains(t.RdAccountID) &&
                                t.TransactionType != null &&
                                ClosureOrRenewalTxTypes.Contains(t.TransactionType) &&
                                (t.Voucher == null || (t.Voucher.Status != "Rejected" && t.Voucher.Status != "Cancelled")))
                    .Select(t => new { t.RdAccountID, TxDate = t.TransactionDate.Date })
                    .ToListAsync();

                foreach (var grp in closeTxs.GroupBy(x => x.RdAccountID))
                {
                    exitDateMap[grp.Key] = grp.Max(x => x.TxDate);
                }
            }

            var liveCandidateIds = new List<int>();
            var isClosedLaterMap = new Dictionary<int, (bool IsClosedLater, DateTime? ExitDate)>();

            foreach (var c in candidates)
            {
                if (FdDepositQueryHelper.IsLiveDepositStatus(c.Status))
                {
                    liveCandidateIds.Add(c.RdAccountID);
                    isClosedLaterMap[c.RdAccountID] = (false, null);
                    continue;
                }

                DateTime? exitDate = c.ClosureDate
                    ?? (exitDateMap.TryGetValue(c.RdAccountID, out var txExitDt) ? txExitDt : c.ModifiedDate);

                if (exitDate.HasValue && exitDate.Value > targetDate)
                {
                    liveCandidateIds.Add(c.RdAccountID);
                    isClosedLaterMap[c.RdAccountID] = (true, exitDate.Value);
                }
            }

            if (liveCandidateIds.Count == 0)
            {
                return new List<RdSnapshotItem>();
            }

            // 2. Aggregate post-cutoff installment credits & all recorded credits in chunks to stay SQL-parameter safe
            var txAfterMap = new Dictionary<int, decimal>();
            var txUpToMap = new Dictionary<int, decimal>();
            var txAllMap = new Dictionary<int, decimal>();

            const int chunkSize = 1000;
            for (int i = 0; i < liveCandidateIds.Count; i += chunkSize)
            {
                var chunk = liveCandidateIds.Skip(i).Take(chunkSize).ToList();
                var txRows = await context.RdTransactions
                    .AsNoTracking()
                    .Where(t => chunk.Contains(t.RdAccountID) &&
                                t.DebitCredit == "Cr" &&
                                t.TransactionType != null &&
                                InstallmentCreditTxTypes.Contains(t.TransactionType) &&
                                (t.Voucher == null || (t.Voucher.Status != "Rejected" && t.Voucher.Status != "Cancelled")))
                    .Select(t => new
                    {
                        t.RdAccountID,
                        TxDate = t.TransactionDate.Date,
                        t.PrincipalAmount
                    })
                    .ToListAsync();

                foreach (var tx in txRows)
                {
                    txAllMap[tx.RdAccountID] = txAllMap.GetValueOrDefault(tx.RdAccountID) + tx.PrincipalAmount;
                    if (tx.TxDate > targetDate)
                    {
                        txAfterMap[tx.RdAccountID] = txAfterMap.GetValueOrDefault(tx.RdAccountID) + tx.PrincipalAmount;
                    }
                    else
                    {
                        txUpToMap[tx.RdAccountID] = txUpToMap.GetValueOrDefault(tx.RdAccountID) + tx.PrincipalAmount;
                    }
                }
            }

            var results = new List<RdSnapshotItem>(liveCandidateIds.Count);
            foreach (var c in candidates)
            {
                if (!isClosedLaterMap.TryGetValue(c.RdAccountID, out var closureMeta))
                {
                    continue;
                }

                decimal txAfter = Math.Round(txAfterMap.GetValueOrDefault(c.RdAccountID), 2, MidpointRounding.AwayFromZero);
                decimal txUpTo = Math.Round(txUpToMap.GetValueOrDefault(c.RdAccountID), 2, MidpointRounding.AwayFromZero);
                decimal txAll = Math.Round(txAllMap.GetValueOrDefault(c.RdAccountID), 2, MidpointRounding.AwayFromZero);

                // Safe Backward Reconstruction:
                // - Standard accounts: use forward txUpTo when tx history exists, else live minus txAfter.
                // - Legacy accounts: subtract post-cutoff deposits from live TotalDepositedAmount rather than
                //   using Math.Max(Live, txAll) so inflated/corrupted legacy migration transactions never overstate balances.
                decimal depositedAsOf = !c.IsLegacyAccount && txAll > 0m
                    ? Math.Max(0m, txUpTo)
                    : Math.Max(0m, Math.Round(c.TotalDepositedAmount - txAfter, 2, MidpointRounding.AwayFromZero));

                int paidInstAsOf;
                if (txAfter <= 0m)
                {
                    paidInstAsOf = c.TotalPaidInstallments;
                }
                else if (c.InstallmentAmount > 0m)
                {
                    paidInstAsOf = Math.Max(0, (int)Math.Floor((double)(depositedAsOf / c.InstallmentAmount) + 1e-6));
                }
                else
                {
                    paidInstAsOf = 0;
                }

                string statusAsOf;
                if (c.DurationMonths > 0 && paidInstAsOf >= c.DurationMonths && !c.IsLegacyAccount)
                {
                    statusAsOf = "Matured";
                }
                else if (FdDepositQueryHelper.IsLiveDepositStatus(c.Status) && txAfter <= 0m)
                {
                    statusAsOf = string.IsNullOrWhiteSpace(c.Status) ? "Active" : c.Status;
                }
                else if (c.MaturityDate <= targetDate || (c.DurationMonths > 0 && paidInstAsOf >= c.DurationMonths))
                {
                    statusAsOf = "Matured";
                }
                else
                {
                    statusAsOf = "Active";
                }

                results.Add(new RdSnapshotItem(
                    RdAccountID: c.RdAccountID,
                    BranchID: c.BranchID,
                    CustomerID: c.CustomerID,
                    RdSchemeID: c.RdSchemeID,
                    AccountNo: c.AccountNo,
                    LegacyAccountNumber: c.LegacyAccountNumber,
                    OpeningDate: c.OpeningDate,
                    MaturityDate: c.MaturityDate,
                    InstallmentAmount: c.InstallmentAmount,
                    DurationMonths: c.DurationMonths,
                    InterestRate: c.InterestRate,
                    MaturityAmount: c.MaturityAmount,
                    DepositedAmountAsOf: depositedAsOf,
                    PaidInstallmentsAsOf: paidInstAsOf,
                    LegacyAccruedInt: c.LegacyAccruedInt,
                    StatusAsOf: statusAsOf,
                    IsLegacyAccount: c.IsLegacyAccount,
                    IsClosedLater: closureMeta.IsClosedLater,
                    ClosureDate: closureMeta.ExitDate,
                    PostCutoffInstallmentsAmount: txAfter
                ));
            }

            return results;
        }
    }
}
