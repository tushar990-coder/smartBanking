using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bhisi.Api.Helpers
{
    /// <summary>
    /// Single Source of Truth helper for branch-level ledger opening balances and as-of balances.
    /// Strictly reads and writes <see cref="BranchLedgerOpeningBalance"/> records without falling back to
    /// or mutating legacy global <c>Ledgers.OpeningBalance</c>.
    /// </summary>
    public static class BranchLedgerBalanceHelper
    {
        public static string ResolveGroupRootNature(int groupId, IReadOnlyList<AccountGroup> allGroups)
        {
            var groupMap = allGroups.ToDictionary(g => g.GroupID, g => g);
            if (!groupMap.TryGetValue(groupId, out var current))
            {
                return "Assets";
            }

            var visited = new HashSet<int>();
            while (current.ParentGroupID.HasValue &&
                   current.ParentGroupID.Value > 0 &&
                   visited.Add(current.GroupID) &&
                   groupMap.TryGetValue(current.ParentGroupID.Value, out var parent))
            {
                current = parent;
            }

            string nat = (current.NatureOfGroup ?? string.Empty).Trim();
            if (nat.Equals("Asset", StringComparison.OrdinalIgnoreCase) || nat.Equals("Assets", StringComparison.OrdinalIgnoreCase))
                return "Assets";
            if (nat.Equals("Liability", StringComparison.OrdinalIgnoreCase) || nat.Equals("Liabilities", StringComparison.OrdinalIgnoreCase))
                return "Liabilities";
            if (nat.Equals("Income", StringComparison.OrdinalIgnoreCase))
                return "Income";
            if (nat.Equals("Expense", StringComparison.OrdinalIgnoreCase) || nat.Equals("Expenses", StringComparison.OrdinalIgnoreCase))
                return "Expenses";

            return string.IsNullOrEmpty(nat) ? "Assets" : nat;
        }

        public static async Task<int> GetInitialFinancialYearIdAsync(AppDbContext context)
        {
            return await context.FinancialYears
                .AsNoTracking()
                .OrderBy(fy => fy.StartDate)
                .ThenBy(fy => fy.FinancialYearID)
                .Select(fy => fy.FinancialYearID)
                .FirstOrDefaultAsync();
        }

        public static async Task<int> GetHeadOfficeBranchIdAsync(AppDbContext context)
        {
            var ho = await context.Branches
                .AsNoTracking()
                .OrderBy(b => b.BranchID)
                .FirstOrDefaultAsync(b => b.BranchType == "HeadOffice");
            if (ho != null) return ho.BranchID;

            var first = await context.Branches
                .AsNoTracking()
                .OrderBy(b => b.BranchID)
                .Select(b => b.BranchID)
                .FirstOrDefaultAsync();
            return first > 0 ? first : 1;
        }

        public static async Task<Dictionary<int, (decimal Dr, decimal Cr)>> GetOpeningBalanceMapAsync(
            AppDbContext context,
            int? branchId,
            int? financialYearId = null,
            DateTime? referenceDate = null,
            FinancialYearBaselineResult? preResolvedBaseline = null)
        {
            bool isSpecificBranch = branchId.HasValue && branchId.Value > 0;
            var baseline = preResolvedBaseline
                ?? await FinancialYearBaselineHelper.ResolveBaselineAsync(
                    context,
                    referenceDate,
                    financialYearId,
                    isSpecificBranch ? branchId : null);

            int activeFyId = baseline.BaselineFinancialYearId;

            var query = context.BranchLedgerOpeningBalances
                .AsNoTracking()
                .Where(b => activeFyId == 0 || b.FinancialYearID == activeFyId);

            if (isSpecificBranch)
            {
                int bId = branchId!.Value;
                query = query.Where(b => b.BranchID == bId);
            }

            var branchBals = await query.ToListAsync();
            var map = branchBals
                .GroupBy(b => b.LedgerID)
                .ToDictionary(
                    g => g.Key,
                    g => (
                        Dr: g.Where(x => x.OpeningBalanceType == "Dr").Sum(x => x.OpeningBalance),
                        Cr: g.Where(x => x.OpeningBalanceType == "Cr").Sum(x => x.OpeningBalance)
                    )
                );

            // Case A Support: When a new Financial Year is active before CarryForwardYearEnd has been run,
            // dynamically roll prior-year Income/Expense net P&L ([BaselineStartDate .. TargetFyStartDate))
            // into the P&L Appropriation Ledger so Income/Expense start cleanly at 0 while TB/BS stay balanced.
            if (baseline.BaselineStartDate.HasValue &&
                baseline.TargetFyStartDate.HasValue &&
                baseline.BaselineStartDate.Value < baseline.TargetFyStartDate.Value)
            {
                var allGroupsForPnl = await context.AccountGroups.AsNoTracking().ToListAsync();
                var allLedgersForPnl = await context.Ledgers.AsNoTracking().ToListAsync();

                var plLedger = allLedgersForPnl.FirstOrDefault(l =>
                    l.LedgerCode == "PL-RESERVE" ||
                    l.LedgerName.Contains("संचित नफा") ||
                    l.LedgerName.Contains("चालू नफा") ||
                    l.LedgerName.Contains("नफा-तोटा") ||
                    l.LedgerName.Contains("नफा तोटा") ||
                    l.LedgerName.Contains("Profit & Loss", StringComparison.OrdinalIgnoreCase) ||
                    l.LedgerName.Contains("Profit and Loss", StringComparison.OrdinalIgnoreCase));

                if (plLedger != null)
                {
                    var incomeExpenseLedgerIds = allLedgersForPnl
                        .Where(l =>
                        {
                            string nat = ResolveGroupRootNature(l.GroupID, allGroupsForPnl);
                            return nat == "Income" || nat == "Expenses";
                        })
                        .Select(l => l.LedgerID)
                        .ToHashSet();

                    if (incomeExpenseLedgerIds.Count > 0)
                    {
                        var priorPnlQuery = context.VoucherDetails
                            .AsNoTracking()
                            .Where(vd => incomeExpenseLedgerIds.Contains(vd.LedgerID) &&
                                         vd.Voucher != null &&
                                         (vd.Voucher.Status == "Approved" || string.IsNullOrEmpty(vd.Voucher.Status) || vd.Voucher.Status == "Posted") &&
                                         vd.Voucher.Status != "Rejected" &&
                                         vd.Voucher.Status != "Cancelled" &&
                                         vd.Voucher.VoucherDate >= baseline.BaselineStartDate.Value &&
                                         vd.Voucher.VoucherDate < baseline.TargetFyStartDate.Value);

                        if (isSpecificBranch)
                        {
                            int bId = branchId!.Value;
                            priorPnlQuery = priorPnlQuery.Where(vd => vd.Voucher != null && vd.Voucher.BranchID == bId);
                        }

                        decimal priorPnlDr = await priorPnlQuery.Where(vd => vd.DrCr == "Dr").SumAsync(vd => (decimal?)vd.Amount) ?? 0m;
                        decimal priorPnlCr = await priorPnlQuery.Where(vd => vd.DrCr == "Cr").SumAsync(vd => (decimal?)vd.Amount) ?? 0m;

                        if (Math.Abs(priorPnlDr - priorPnlCr) >= 0.01m)
                        {
                            var existingPl = map.TryGetValue(plLedger.LedgerID, out var curPl) ? curPl : (Dr: 0m, Cr: 0m);
                            map[plLedger.LedgerID] = (Dr: existingPl.Dr + priorPnlDr, Cr: existingPl.Cr + priorPnlCr);
                        }
                    }
                }
            }

            return map;
        }

        /// <summary>
        /// Computes signed net balances (Dr positive, Cr negative) as of <paramref name="asOfDate"/>
        /// for the specified <paramref name="ledgerIds"/> and optional <paramref name="branchId"/>.
        /// Uses <see cref="BranchLedgerOpeningBalance"/> + FY Baseline + VoucherDetails.
        /// </summary>
        public static async Task<Dictionary<int, decimal>> GetAsOfLedgerBalancesAsync(
            AppDbContext context,
            IEnumerable<int> ledgerIds,
            DateTime asOfDate,
            int? branchId = null,
            int? financialYearId = null,
            bool approvedOnly = true)
        {
            var distinctIds = ledgerIds?.Where(id => id > 0).Distinct().ToList() ?? new List<int>();
            if (distinctIds.Count == 0)
            {
                return new Dictionary<int, decimal>();
            }

            bool isSpecificBranch = branchId.HasValue && branchId.Value > 0;
            var baseline = await FinancialYearBaselineHelper.ResolveBaselineAsync(
                context,
                asOfDate,
                financialYearId,
                isSpecificBranch ? branchId : null);

            var obMap = await GetOpeningBalanceMapAsync(context, branchId, financialYearId, asOfDate, baseline);

            var allGroups = await context.AccountGroups.AsNoTracking().ToListAsync();
            var ledgerGroups = await context.Ledgers
                .AsNoTracking()
                .Where(l => distinctIds.Contains(l.LedgerID))
                .Select(l => new { l.LedgerID, l.GroupID })
                .ToListAsync();

            var incomeExpenseIds = ledgerGroups
                .Where(l =>
                {
                    string nat = ResolveGroupRootNature(l.GroupID, allGroups);
                    return nat == "Income" || nat == "Expenses";
                })
                .Select(l => l.LedgerID)
                .ToHashSet();

            DateTime endExclusive = asOfDate.Date.AddDays(1);
            var vdQuery = context.VoucherDetails
                .AsNoTracking()
                .Where(vd => distinctIds.Contains(vd.LedgerID) &&
                             vd.Voucher != null &&
                             vd.Voucher.VoucherDate < endExclusive);

            if (approvedOnly)
            {
                vdQuery = vdQuery.Where(vd => vd.Voucher!.Status == "Approved");
            }
            else
            {
                vdQuery = vdQuery.Where(vd =>
                    (vd.Voucher!.Status == "Approved" || string.IsNullOrEmpty(vd.Voucher.Status) || vd.Voucher.Status == "Posted") &&
                    vd.Voucher.Status != "Rejected" &&
                    vd.Voucher.Status != "Cancelled");
            }

            if (isSpecificBranch)
            {
                int bId = branchId!.Value;
                vdQuery = vdQuery.Where(vd => vd.Voucher!.BranchID == bId);
            }

            if (baseline.BaselineStartDate.HasValue)
            {
                DateTime bStart = baseline.BaselineStartDate.Value.Date;
                vdQuery = vdQuery.Where(vd => vd.Voucher!.VoucherDate >= bStart);
            }

            var rawLines = await vdQuery
                .Select(vd => new
                {
                    vd.LedgerID,
                    vd.DrCr,
                    vd.Amount,
                    vd.Voucher!.VoucherDate
                })
                .ToListAsync();

            DateTime? targetFyStart = baseline.TargetFyStartDate?.Date;
            var txByLedger = new Dictionary<int, (decimal Dr, decimal Cr)>();
            foreach (var line in rawLines)
            {
                if (targetFyStart.HasValue &&
                    incomeExpenseIds.Contains(line.LedgerID) &&
                    line.VoucherDate.Date < targetFyStart.Value)
                {
                    continue;
                }

                txByLedger.TryGetValue(line.LedgerID, out var cur);
                if (string.Equals(line.DrCr, "Dr", StringComparison.OrdinalIgnoreCase))
                    cur.Dr += line.Amount;
                else if (string.Equals(line.DrCr, "Cr", StringComparison.OrdinalIgnoreCase))
                    cur.Cr += line.Amount;
                txByLedger[line.LedgerID] = cur;
            }

            var result = new Dictionary<int, decimal>(distinctIds.Count);
            foreach (int lId in distinctIds)
            {
                decimal opNetDr = 0m;
                if (!incomeExpenseIds.Contains(lId) && obMap.TryGetValue(lId, out var ob))
                {
                    opNetDr = ob.Dr - ob.Cr;
                }
                else if (incomeExpenseIds.Contains(lId) &&
                         (!targetFyStart.HasValue || !baseline.BaselineStartDate.HasValue || baseline.BaselineStartDate.Value >= targetFyStart.Value) &&
                         obMap.TryGetValue(lId, out var ieOb))
                {
                    opNetDr = ieOb.Dr - ieOb.Cr;
                }

                txByLedger.TryGetValue(lId, out var tx);
                result[lId] = Math.Round(opNetDr + tx.Dr - tx.Cr, 2);
            }

            return result;
        }

        public static async Task SetBranchLedgerOpeningBalanceAsync(
            AppDbContext context,
            int branchId,
            int ledgerId,
            decimal amount,
            string balanceType,
            string? remarks = null,
            int? financialYearId = null,
            int createdBy = 1)
        {
            if (branchId <= 0 || ledgerId <= 0) return;

            int fyId = financialYearId.HasValue && financialYearId.Value > 0
                ? financialYearId.Value
                : await GetInitialFinancialYearIdAsync(context);

            if (fyId <= 0) return;

            decimal safeAmt = Math.Round(Math.Abs(amount), 2);
            string safeType = string.Equals(balanceType, "Cr", StringComparison.OrdinalIgnoreCase) ? "Cr" : "Dr";

            var existing = await context.BranchLedgerOpeningBalances
                .FirstOrDefaultAsync(b => b.BranchID == branchId && b.LedgerID == ledgerId && b.FinancialYearID == fyId);

            if (existing != null)
            {
                existing.OpeningBalance = safeAmt;
                existing.OpeningBalanceType = safeType;
                if (!string.IsNullOrWhiteSpace(remarks))
                {
                    existing.Remarks = remarks;
                }
                existing.UpdatedOn = DateTime.UtcNow;
                existing.UpdatedBy = createdBy;
            }
            else if (safeAmt > 0)
            {
                context.BranchLedgerOpeningBalances.Add(new BranchLedgerOpeningBalance
                {
                    BranchID = branchId,
                    LedgerID = ledgerId,
                    FinancialYearID = fyId,
                    OpeningBalance = safeAmt,
                    OpeningBalanceType = safeType,
                    Remarks = remarks,
                    CreatedOn = DateTime.UtcNow,
                    CreatedBy = createdBy
                });
            }
        }

        public static async Task AdjustBranchLedgerOpeningDeltaAsync(
            AppDbContext context,
            int branchId,
            int ledgerId,
            decimal signedDeltaAmount,
            string deltaSide,
            string? remarks = null,
            int? financialYearId = null,
            int createdBy = 1)
        {
            if (branchId <= 0 || ledgerId <= 0 || signedDeltaAmount == 0m) return;

            int fyId = financialYearId.HasValue && financialYearId.Value > 0
                ? financialYearId.Value
                : await GetInitialFinancialYearIdAsync(context);

            if (fyId <= 0) return;

            var existing = await context.BranchLedgerOpeningBalances
                .FirstOrDefaultAsync(b => b.BranchID == branchId && b.LedgerID == ledgerId && b.FinancialYearID == fyId);

            // Track signed net balance where Cr is positive and Dr is negative if deltaSide == "Cr",
            // or normalize to signed Dr (Dr positive, Cr negative).
            decimal curNetDr = 0m;
            if (existing != null)
            {
                curNetDr = string.Equals(existing.OpeningBalanceType, "Cr", StringComparison.OrdinalIgnoreCase)
                    ? -existing.OpeningBalance
                    : existing.OpeningBalance;
            }

            decimal deltaDr = string.Equals(deltaSide, "Cr", StringComparison.OrdinalIgnoreCase)
                ? -signedDeltaAmount
                : signedDeltaAmount;

            decimal newNetDr = Math.Round(curNetDr + deltaDr, 2);
            decimal absBal = Math.Abs(newNetDr);
            string newType = newNetDr < 0m
                ? "Cr"
                : (newNetDr > 0m ? "Dr" : (string.Equals(deltaSide, "Cr", StringComparison.OrdinalIgnoreCase) ? "Cr" : "Dr"));

            if (existing != null)
            {
                existing.OpeningBalance = absBal;
                existing.OpeningBalanceType = newType;
                if (!string.IsNullOrWhiteSpace(remarks))
                {
                    existing.Remarks = remarks;
                }
                existing.UpdatedOn = DateTime.UtcNow;
                existing.UpdatedBy = createdBy;
            }
            else if (absBal > 0m)
            {
                context.BranchLedgerOpeningBalances.Add(new BranchLedgerOpeningBalance
                {
                    BranchID = branchId,
                    LedgerID = ledgerId,
                    FinancialYearID = fyId,
                    OpeningBalance = absBal,
                    OpeningBalanceType = newType,
                    Remarks = remarks,
                    CreatedOn = DateTime.UtcNow,
                    CreatedBy = createdBy
                });
            }
        }

        public static async Task<(decimal TotalDr, decimal TotalCr, decimal Difference, bool IsBalanced)> GetBranchOpeningTallySummaryAsync(
            AppDbContext context,
            int branchId,
            int financialYearId)
        {
            var rows = await context.BranchLedgerOpeningBalances
                .AsNoTracking()
                .Where(b => b.BranchID == branchId && b.FinancialYearID == financialYearId)
                .ToListAsync();

            decimal totalDr = rows.Where(r => string.Equals(r.OpeningBalanceType, "Dr", StringComparison.OrdinalIgnoreCase)).Sum(r => r.OpeningBalance);
            decimal totalCr = rows.Where(r => string.Equals(r.OpeningBalanceType, "Cr", StringComparison.OrdinalIgnoreCase)).Sum(r => r.OpeningBalance);
            decimal diff = Math.Round(Math.Abs(totalDr - totalCr), 2);

            return (Math.Round(totalDr, 2), Math.Round(totalCr, 2), diff, diff < 0.01m);
        }

        public static async Task SyncCustomerOpeningBalancesToBranchAsync(
            AppDbContext context,
            IEnumerable<int> ledgerIds,
            string? remarks = null,
            int createdBy = 1)
        {
            var distinctLedgers = ledgerIds?.Where(id => id > 0).Distinct().ToList() ?? new List<int>();
            if (distinctLedgers.Count == 0) return;

            int fyId = await GetInitialFinancialYearIdAsync(context);
            if (fyId <= 0) return;

            var rows = await context.CustomerOpeningBalances
                .AsNoTracking()
                .Include(c => c.Customer)
                .Where(c => distinctLedgers.Contains(c.LedgerID))
                .Select(c => new
                {
                    BranchID = c.Customer != null && c.Customer.BranchID > 0 ? c.Customer.BranchID : 1,
                    c.LedgerID,
                    c.BalanceType,
                    c.Amount
                })
                .ToListAsync();

            var branchIds = await context.Branches.AsNoTracking().Select(b => b.BranchID).ToListAsync();
            if (branchIds.Count == 0) branchIds.Add(1);

            foreach (int lId in distinctLedgers)
            {
                foreach (int bId in branchIds)
                {
                    var subset = rows.Where(r => r.LedgerID == lId && r.BranchID == bId).ToList();
                    decimal dr = subset.Where(r => string.Equals(r.BalanceType, "Dr", StringComparison.OrdinalIgnoreCase)).Sum(r => r.Amount);
                    decimal cr = subset.Where(r => string.Equals(r.BalanceType, "Cr", StringComparison.OrdinalIgnoreCase)).Sum(r => r.Amount);
                    decimal net = cr - dr;
                    await SetBranchLedgerOpeningBalanceAsync(
                        context,
                        bId,
                        lId,
                        Math.Abs(net),
                        net >= 0m ? "Cr" : "Dr",
                        remarks,
                        fyId,
                        createdBy);
                }
            }
        }

        public static async Task SyncMemberOpeningBalancesToBranchAsync(
            AppDbContext context,
            IEnumerable<int> ledgerIds,
            string? remarks = null,
            int createdBy = 1)
        {
            var distinctLedgers = ledgerIds?.Where(id => id > 0).Distinct().ToList() ?? new List<int>();
            if (distinctLedgers.Count == 0) return;

            int fyId = await GetInitialFinancialYearIdAsync(context);
            if (fyId <= 0) return;

            var rows = await context.MemberOpeningBalances
                .AsNoTracking()
                .Include(m => m.Member)
                .Include(m => m.Customer)
                .Where(m => distinctLedgers.Contains(m.LedgerID))
                .Select(m => new
                {
                    BranchID = (m.Member != null && m.Member.BranchID > 0)
                        ? m.Member.BranchID
                        : (m.Customer != null && m.Customer.BranchID > 0 ? m.Customer.BranchID : 1),
                    m.LedgerID,
                    m.BalanceType,
                    m.Amount
                })
                .ToListAsync();

            var branchIds = await context.Branches.AsNoTracking().Select(b => b.BranchID).ToListAsync();
            if (branchIds.Count == 0) branchIds.Add(1);

            foreach (int lId in distinctLedgers)
            {
                foreach (int bId in branchIds)
                {
                    var subset = rows.Where(r => r.LedgerID == lId && r.BranchID == bId).ToList();
                    decimal dr = subset.Where(r => string.Equals(r.BalanceType, "Dr", StringComparison.OrdinalIgnoreCase)).Sum(r => r.Amount);
                    decimal cr = subset.Where(r => string.Equals(r.BalanceType, "Cr", StringComparison.OrdinalIgnoreCase)).Sum(r => r.Amount);
                    decimal net = cr - dr;
                    await SetBranchLedgerOpeningBalanceAsync(
                        context,
                        bId,
                        lId,
                        Math.Abs(net),
                        net >= 0m ? "Cr" : "Dr",
                        remarks,
                        fyId,
                        createdBy);
                }
            }
        }
    }
}
