using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Helpers
{
    /// <summary>
    /// Verified live (non-closure, non-orphaned) FD posted interest breakdown separated into
    /// Interest Payable Provision ("Accrual" -> POSTING_INTR) and Capitalized-to-Principal
    /// ("Interest_Capitalized" -> On Interest / FD Liability).
    /// </summary>
    public sealed class FdPostingBreakdown
    {
        public decimal VerifiedProvision { get; init; }
        public decimal VerifiedCapitalized { get; init; }
        public decimal BackedLegacyProvision { get; init; }
        public decimal EffectiveProvision => VerifiedProvision + BackedLegacyProvision;
        public decimal TotalPosted => VerifiedProvision + VerifiedCapitalized;
    }

    public sealed class FdInterestAllocationRequest
    {
        public decimal TargetInterest { get; init; }
        public decimal OverdueInterest { get; init; }
        public decimal VerifiedProvision { get; init; }
        public decimal VerifiedCapitalized { get; init; }
        public decimal LegacyAccruedInt { get; init; }
        public decimal MisPayoutSum { get; init; }
        public bool IsPremature { get; init; }
        public bool IsPeriodicPayout { get; init; }
        public bool IsManualAmountOverride { get; init; }
        public string? InterestDebitMode { get; init; }
        public decimal? PostedInterestDebitAmount { get; init; }
        public decimal? ExpenseInterestDebitAmount { get; init; }
        public decimal? ReversePostedInterestAmount { get; init; }
    }

    public sealed class FdInterestAllocationResult
    {
        public bool IsValid { get; init; } = true;
        public string? ErrorMessage { get; init; }
        public decimal ClearedCapitalizedInterest { get; init; }
        public decimal PostedInterestDebitAmount { get; init; }
        public decimal ExpenseInterestDebitAmount { get; init; }
        public decimal TotalExpenseInterest => ExpenseInterestDebitAmount + OverdueInterest;
        public decimal OverdueInterest { get; init; }
        public decimal UnpaidMisInterest { get; init; }
        public decimal ReversePostedInterestAmount { get; init; }
        public decimal AlreadyAccruedEffective { get; init; }
    }

    /// <summary>
    /// Unified CBS engine for resolving verified FD posted/capitalized interest,
    /// dual-head interest debit splits (POSTING_INTR vs NAFATOTA DEY VYAJ / Expense),
    /// and premature posted-interest reversals across Preview, Closure, and Renewal.
    /// </summary>
    public static class FdInterestSettlementHelper
    {
        private const decimal BalanceTolerance = 0.05m;

        public static bool IsClosureOrRenewalVoucherNo(string? voucherNo)
        {
            if (string.IsNullOrWhiteSpace(voucherNo)) return false;
            string v = voucherNo.Trim();
            return v.Contains("-FD-CLOSE-", StringComparison.OrdinalIgnoreCase) ||
                   v.Contains("-FD-PRECLOSE-", StringComparison.OrdinalIgnoreCase) ||
                   v.Contains("-FD-REN-", StringComparison.OrdinalIgnoreCase) ||
                   v.Contains("-FD-AUTOREN-", StringComparison.OrdinalIgnoreCase);
        }

        public static async Task<FdPostingBreakdown> ResolveVerifiedPostingBreakdownAsync(
            AppDbContext context,
            int fdAccountId,
            int? interestPayableLedgerId = null)
        {
            var singleList = new List<int> { fdAccountId };
            var map = await ResolveVerifiedPostingBreakdownMapAsync(
                context,
                singleList,
                explicitPayableLedgerFilterId: interestPayableLedgerId);
            return map.TryGetValue(fdAccountId, out var res) ? res : new FdPostingBreakdown();
        }

        public static async Task<Dictionary<int, FdPostingBreakdown>> ResolveVerifiedPostingBreakdownMapAsync(
            AppDbContext context,
            List<int> fdAccountIds,
            int? explicitPayableLedgerFilterId = null)
        {
            var result = new Dictionary<int, FdPostingBreakdown>();
            if (fdAccountIds == null || fdAccountIds.Count == 0) return result;

            var accruals = await context.FdInterestAccruals
                .AsNoTracking()
                .Where(a => fdAccountIds.Contains(a.FdAccountID) &&
                            a.IsPosted &&
                            a.VoucherID > 0)
                .Select(a => new { a.FdAccountID, a.VoucherID, a.PostingTarget, a.InterestAmount })
                .ToListAsync();

            var txs = await context.FdTransactions
                .AsNoTracking()
                .Where(t => fdAccountIds.Contains(t.FdAccountID) &&
                            (t.TransactionType == "Accrual" || t.TransactionType == "Interest_Capitalized"))
                .Select(t => new { t.FdAccountID, t.VoucherID, t.TransactionType, t.Amount })
                .ToListAsync();

            var allVoucherIds = accruals.Select(a => a.VoucherID)
                .Concat(txs.Where(t => t.VoucherID > 0).Select(t => t.VoucherID))
                .Distinct()
                .ToList();

            var liveVoucherIds = new HashSet<int>();
            var nonClosureVoucherIds = new HashSet<int>();
            if (allVoucherIds.Count > 0)
            {
                var liveVouchers = await context.Vouchers
                    .AsNoTracking()
                    .Where(v => allVoucherIds.Contains(v.VoucherID))
                    .Select(v => new { v.VoucherID, v.VoucherNo })
                    .ToListAsync();

                liveVoucherIds = liveVouchers.Select(v => v.VoucherID).ToHashSet();
                nonClosureVoucherIds = liveVouchers
                    .Where(v => !IsClosureOrRenewalVoucherNo(v.VoucherNo))
                    .Select(v => v.VoucherID)
                    .ToHashSet();
            }

            // 1. Provisioned Interest ("Accrual" / PostingTarget != "Principal")
            var provAccruals = accruals
                .Where(a => a.PostingTarget != "Principal" && liveVoucherIds.Contains(a.VoucherID))
                .ToList();
            var provAccrualSums = provAccruals
                .GroupBy(a => a.FdAccountID)
                .ToDictionary(g => g.Key, g => g.Sum(x => x.InterestAmount));
            var provAccrualVchIds = provAccruals.Select(a => a.VoucherID).ToHashSet();

            var payableCreditedVchIds = new HashSet<int>(provAccrualVchIds);
            if (nonClosureVoucherIds.Count > 0)
            {
                List<int> payableLedgerIds;
                if (explicitPayableLedgerFilterId.HasValue && explicitPayableLedgerFilterId.Value > 0)
                {
                    payableLedgerIds = new List<int> { explicitPayableLedgerFilterId.Value };
                }
                else if (explicitPayableLedgerFilterId.HasValue)
                {
                    // Single-account call where scheme has no payable ledger: accept non-closure accrual vouchers as before
                    payableLedgerIds = new List<int>();
                    foreach (var vid in nonClosureVoucherIds) payableCreditedVchIds.Add(vid);
                }
                else
                {
                    payableLedgerIds = await context.FdSchemes
                        .AsNoTracking()
                        .Where(s => s.InterestPayableLedgerID.HasValue && s.InterestPayableLedgerID.Value > 0)
                        .Select(s => s.InterestPayableLedgerID!.Value)
                        .Distinct()
                        .ToListAsync();
                }

                if (payableLedgerIds.Count > 0)
                {
                    var matchedVch = await context.VoucherDetails
                        .AsNoTracking()
                        .Where(d => nonClosureVoucherIds.Contains(d.VoucherID) &&
                                    d.DrCr == "Cr" &&
                                    payableLedgerIds.Contains(d.LedgerID))
                        .Select(d => d.VoucherID)
                        .Distinct()
                        .ToListAsync();
                    foreach (var vid in matchedVch) payableCreditedVchIds.Add(vid);
                }
            }

            var provTxSums = txs
                .Where(t => t.TransactionType == "Accrual" &&
                            t.VoucherID > 0 &&
                            nonClosureVoucherIds.Contains(t.VoucherID) &&
                            payableCreditedVchIds.Contains(t.VoucherID))
                .GroupBy(t => t.FdAccountID)
                .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

            // 2. Capitalized Interest ("Interest_Capitalized" / PostingTarget == "Principal" for On Interest)
            var capAccrualSums = accruals
                .Where(a => a.PostingTarget == "Principal" && liveVoucherIds.Contains(a.VoucherID))
                .GroupBy(a => a.FdAccountID)
                .ToDictionary(g => g.Key, g => g.Sum(x => x.InterestAmount));

            var capTxSums = txs
                .Where(t => t.TransactionType == "Interest_Capitalized" &&
                            (t.VoucherID == 0 || (liveVoucherIds.Contains(t.VoucherID) && nonClosureVoucherIds.Contains(t.VoucherID))))
                .GroupBy(t => t.FdAccountID)
                .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

            // 3. Backed Legacy Opening Provision:
            // LegacyAccruedInt for Active/Matured accounts is credited to CustomerOpeningBalances (InterestPayableLedgerID)
            // via SyncFdOpeningBalancesInternalAsync. Only surface it when that customer's OpeningBalance Cr genuinely backs it.
            var backedLegacyMap = new Dictionary<int, decimal>();
            var distinctInputIds = fdAccountIds.Distinct().ToList();
            var targetIdSet = distinctInputIds.ToHashSet();

            var targetLegacyAccounts = await context.FdAccounts
                .AsNoTracking()
                .Include(a => a.FdScheme)
                .Where(a => distinctInputIds.Contains(a.FdAccountID) &&
                            (a.Status == "Active" || a.Status == "Matured") &&
                            a.LegacyAccruedInt > 0m &&
                            a.FdScheme != null &&
                            a.FdScheme.InterestPayableLedgerID.HasValue &&
                            a.FdScheme.InterestPayableLedgerID.Value > 0)
                .Select(a => new
                {
                    a.FdAccountID,
                    a.CustomerID,
                    PayableLedgerId = a.FdScheme!.InterestPayableLedgerID!.Value,
                    a.LegacyAccruedInt
                })
                .ToListAsync();

            if (targetLegacyAccounts.Count > 0)
            {
                var targetCustIds = targetLegacyAccounts.Select(x => x.CustomerID).Distinct().ToList();
                var targetPayableLedgers = targetLegacyAccounts.Select(x => x.PayableLedgerId).Distinct().ToList();

                var custOpeningCredits = await context.CustomerOpeningBalances
                    .AsNoTracking()
                    .Where(c => targetCustIds.Contains(c.CustomerID) &&
                                targetPayableLedgers.Contains(c.LedgerID) &&
                                c.BalanceType == "Cr" &&
                                c.Amount > 0m)
                    .GroupBy(c => new { c.CustomerID, c.LedgerID })
                    .Select(g => new { g.Key.CustomerID, g.Key.LedgerID, TotalCr = g.Sum(x => x.Amount) })
                    .ToDictionaryAsync(k => (k.CustomerID, k.LedgerID), v => v.TotalCr);

                if (custOpeningCredits.Count > 0)
                {
                    var allCustLegacyAccounts = await context.FdAccounts
                        .AsNoTracking()
                        .Include(a => a.FdScheme)
                        .Where(a => targetCustIds.Contains(a.CustomerID) &&
                                    a.LegacyAccruedInt > 0m &&
                                    a.FdScheme != null &&
                                    a.FdScheme.InterestPayableLedgerID.HasValue &&
                                    targetPayableLedgers.Contains(a.FdScheme.InterestPayableLedgerID.Value))
                        .Select(a => new
                        {
                            a.FdAccountID,
                            a.CustomerID,
                            PayableLedgerId = a.FdScheme!.InterestPayableLedgerID!.Value,
                            a.LegacyAccruedInt,
                            a.Status,
                            a.OpeningDate
                        })
                        .ToListAsync();

                    // Subtract debits from already-closed legacy accounts when CustomerOpeningBalances has not been resynced since their closure
                    var closedLegacyIds = allCustLegacyAccounts
                        .Where(a => a.Status != "Active" && a.Status != "Matured")
                        .Select(a => a.FdAccountID)
                        .ToList();

                    var closedLegacyVchByCustLedger = new Dictionary<(int CustomerID, int LedgerID), decimal>();
                    if (closedLegacyIds.Count > 0)
                    {
                        var closedLegacyTxs = await context.FdTransactions
                            .AsNoTracking()
                            .Where(t => closedLegacyIds.Contains(t.FdAccountID) && t.VoucherID > 0)
                            .Select(t => new { t.FdAccountID, t.VoucherID })
                            .ToListAsync();

                        var closedVchIds = closedLegacyTxs.Select(x => x.VoucherID).Distinct().ToList();
                        if (closedVchIds.Count > 0)
                        {
                            var closedVoucherMeta = await context.Vouchers
                                .AsNoTracking()
                                .Where(v => closedVchIds.Contains(v.VoucherID))
                                .Select(v => new { v.VoucherID, v.VoucherNo })
                                .ToListAsync();

                            var closureVchIdSet = closedVoucherMeta
                                .Where(v => IsClosureOrRenewalVoucherNo(v.VoucherNo))
                                .Select(v => v.VoucherID)
                                .ToHashSet();

                            var closureVchIdsList = closureVchIdSet.ToList();
                            if (closureVchIdsList.Count > 0)
                            {
                                var closureDebits = await context.VoucherDetails
                                    .AsNoTracking()
                                    .Where(d => closureVchIdsList.Contains(d.VoucherID) &&
                                                d.DrCr == "Dr" &&
                                                d.CustomerID.HasValue &&
                                                targetCustIds.Contains(d.CustomerID.Value) &&
                                                targetPayableLedgers.Contains(d.LedgerID))
                                    .GroupBy(d => new { CustomerID = d.CustomerID!.Value, d.LedgerID })
                                    .Select(g => new { g.Key.CustomerID, g.Key.LedgerID, TotalDr = g.Sum(x => x.Amount) })
                                    .ToDictionaryAsync(k => (k.CustomerID, k.LedgerID), v => v.TotalDr);

                                closedLegacyVchByCustLedger = closureDebits;
                            }
                        }
                    }

                    var activeByCustLedger = allCustLegacyAccounts
                        .Where(a => a.Status == "Active" || a.Status == "Matured")
                        .GroupBy(a => (a.CustomerID, a.PayableLedgerId));

                    foreach (var grp in activeByCustLedger)
                    {
                        if (!custOpeningCredits.TryGetValue(grp.Key, out decimal custObCr) || custObCr <= 0m)
                            continue;

                        decimal activeLegacySum = grp.Sum(x => x.LegacyAccruedInt);
                        decimal priorClosedDr = closedLegacyVchByCustLedger.TryGetValue(grp.Key, out var drVal) ? drVal : 0m;
                        decimal remainingPool = (custObCr > activeLegacySum && priorClosedDr > 0m)
                            ? Math.Max(0m, custObCr - priorClosedDr)
                            : custObCr;

                        foreach (var accItem in grp.OrderBy(x => x.OpeningDate).ThenBy(x => x.FdAccountID))
                        {
                            if (remainingPool <= 0m) break;
                            decimal alloc = Math.Round(Math.Min(accItem.LegacyAccruedInt, remainingPool), 2, MidpointRounding.AwayFromZero);
                            remainingPool = Math.Max(0m, remainingPool - alloc);
                            if (targetIdSet.Contains(accItem.FdAccountID) && alloc > 0m)
                            {
                                backedLegacyMap[accItem.FdAccountID] = alloc;
                            }
                        }
                    }
                }
            }

            foreach (int id in distinctInputIds)
            {
                decimal provA = provAccrualSums.TryGetValue(id, out var pa) ? pa : 0m;
                decimal provT = provTxSums.TryGetValue(id, out var pt) ? pt : 0m;
                decimal finalProv = Math.Round(Math.Max(provA, provT), 2, MidpointRounding.AwayFromZero);

                decimal capA = capAccrualSums.TryGetValue(id, out var ca) ? ca : 0m;
                decimal capT = capTxSums.TryGetValue(id, out var ct) ? ct : 0m;
                decimal finalCap = Math.Round(Math.Max(capA, capT), 2, MidpointRounding.AwayFromZero);

                decimal backed = backedLegacyMap.TryGetValue(id, out var bl) ? bl : 0m;

                if (finalProv > 0m || finalCap > 0m || backed > 0m)
                {
                    result[id] = new FdPostingBreakdown
                    {
                        VerifiedProvision = finalProv,
                        VerifiedCapitalized = finalCap,
                        BackedLegacyProvision = backed
                    };
                }
            }

            return result;
        }

        public static FdInterestAllocationResult ResolveClosureInterestAllocation(FdInterestAllocationRequest req)
        {
            decimal safeTarget = Round2(Math.Max(0m, req.TargetInterest));
            decimal safeOverdue = Round2(Math.Max(0m, req.OverdueInterest));
            decimal cap = Round2(Math.Max(0m, req.VerifiedCapitalized));
            decimal rawProv = Round2(Math.Max(0m, Math.Max(req.VerifiedProvision, req.LegacyAccruedInt)));
            decimal misSum = Round2(Math.Max(0m, req.MisPayoutSum));
            string mode = (req.InterestDebitMode ?? "Expense").Trim();

            if ((req.PostedInterestDebitAmount.HasValue && req.PostedInterestDebitAmount.Value < 0m) ||
                (req.ExpenseInterestDebitAmount.HasValue && req.ExpenseInterestDebitAmount.Value < 0m) ||
                (req.ReversePostedInterestAmount.HasValue && req.ReversePostedInterestAmount.Value < 0m))
            {
                return new FdInterestAllocationResult
                {
                    IsValid = false,
                    ErrorMessage = "व्याज विभागणी किंवा रिव्हर्सल रक्कम शून्यापेक्षा कमी असू शकत नाही."
                };
            }

            // Periodic Monthly Interest (MIS) Scheme during Premature Close
            if (req.IsPremature && req.IsPeriodicPayout)
            {
                decimal alreadyAccruedMis = misSum + cap;
                decimal baseUnpaidMis = Math.Max(0m, safeTarget - alreadyAccruedMis);
                decimal baseMisClawback = alreadyAccruedMis > safeTarget
                    ? Round2(alreadyAccruedMis - safeTarget)
                    : 0m;

                decimal extraPostedDr = Round2(req.PostedInterestDebitAmount ?? 0m);
                decimal extraRevCr = Round2(req.ReversePostedInterestAmount ?? extraPostedDr);
                if (extraPostedDr > 0m && req.ReversePostedInterestAmount.HasValue &&
                    Math.Abs(extraRevCr - extraPostedDr) > BalanceTolerance)
                {
                    return new FdInterestAllocationResult
                    {
                        IsValid = false,
                        ErrorMessage = "मासिक व्याज (MIS) मुदतपूर्व बंद करताना अतिरिक्त POSTING_INTR नावे आणि रिव्हर्सल जमा रक्कम समान असणे आवश्यक आहे."
                    };
                }

                // If operator specified only ReversePostedInterestAmount without PostedInterestDebitAmount for extra GL reversal
                if (!req.PostedInterestDebitAmount.HasValue &&
                    req.ReversePostedInterestAmount.HasValue &&
                    req.ReversePostedInterestAmount.Value > baseMisClawback)
                {
                    extraPostedDr = Round2(req.ReversePostedInterestAmount.Value - baseMisClawback);
                    extraRevCr = extraPostedDr;
                }
                else if (extraPostedDr > 0m && !req.ReversePostedInterestAmount.HasValue)
                {
                    extraRevCr = extraPostedDr;
                }

                return new FdInterestAllocationResult
                {
                    IsValid = true,
                    ClearedCapitalizedInterest = cap,
                    PostedInterestDebitAmount = extraPostedDr,
                    ExpenseInterestDebitAmount = 0m,
                    OverdueInterest = 0m,
                    UnpaidMisInterest = req.ExpenseInterestDebitAmount.HasValue ? Round2(req.ExpenseInterestDebitAmount.Value) : baseUnpaidMis,
                    ReversePostedInterestAmount = Round2(baseMisClawback + extraRevCr),
                    AlreadyAccruedEffective = alreadyAccruedMis
                };
            }

            bool hasExplicitSplit =
                string.Equals(mode, "Split", StringComparison.OrdinalIgnoreCase) ||
                req.PostedInterestDebitAmount.HasValue ||
                req.ExpenseInterestDebitAmount.HasValue ||
                req.ReversePostedInterestAmount.HasValue;

            if (!hasExplicitSplit)
            {
                decimal verifiedProvOnly = Round2(Math.Max(0m, req.VerifiedProvision));
                decimal provBase = string.Equals(mode, "Provision", StringComparison.OrdinalIgnoreCase)
                    ? rawProv
                    : (string.Equals(mode, "Auto", StringComparison.OrdinalIgnoreCase) ? verifiedProvOnly : 0m);

                if (!req.IsPremature)
                {
                    decimal clearedCap = Math.Min(safeTarget, cap);
                    decimal rem = Math.Max(0m, safeTarget - clearedCap);
                    decimal postedDr = provBase > 0m ? Math.Min(rem, provBase) : 0m;
                    decimal expenseDr = Round2(Math.Max(0m, rem - postedDr));

                    return new FdInterestAllocationResult
                    {
                        IsValid = true,
                        ClearedCapitalizedInterest = clearedCap,
                        PostedInterestDebitAmount = postedDr,
                        ExpenseInterestDebitAmount = expenseDr,
                        OverdueInterest = safeOverdue,
                        ReversePostedInterestAmount = 0m,
                        AlreadyAccruedEffective = postedDr + clearedCap
                    };
                }
                else
                {
                    // Premature Close in non-explicit mode:
                    // Always clear full capitalized liability so Deposit GL reaches zero.
                    // In Provision (Verified + Legacy fallback) or Auto (Verified GL only), clear full posted provision
                    // and reverse any excess over safeTarget even when IsManualAmountOverride == true.
                    decimal postedDr = provBase;
                    decimal alreadyEffective = Round2(postedDr + cap);
                    decimal expenseDr = Round2(Math.Max(0m, safeTarget - alreadyEffective));
                    decimal revCr = Round2(Math.Max(0m, alreadyEffective - safeTarget));

                    return new FdInterestAllocationResult
                    {
                        IsValid = true,
                        ClearedCapitalizedInterest = cap,
                        PostedInterestDebitAmount = postedDr,
                        ExpenseInterestDebitAmount = expenseDr,
                        OverdueInterest = 0m,
                        ReversePostedInterestAmount = revCr,
                        AlreadyAccruedEffective = alreadyEffective
                    };
                }
            }

            // Explicit Split / Dual-Head / Manual Reversal Allocation
            if (!req.IsPremature)
            {
                decimal clearedCap = Math.Min(safeTarget, cap);
                decimal rem = Round2(Math.Max(0m, safeTarget - clearedCap));
                decimal postedDr;
                decimal expenseDr;

                if (req.PostedInterestDebitAmount.HasValue && req.ExpenseInterestDebitAmount.HasValue)
                {
                    postedDr = Round2(req.PostedInterestDebitAmount.Value);
                    expenseDr = Round2(req.ExpenseInterestDebitAmount.Value);
                    if (Math.Abs((postedDr + expenseDr) - rem) > BalanceTolerance)
                    {
                        return new FdInterestAllocationResult
                        {
                            IsValid = false,
                            ErrorMessage = $"POSTING_INTR नावे (₹{postedDr:N2}) आणि नफा-तोटा/खर्च व्याज नावे (₹{expenseDr:N2}) यांची बेरीज देय व्याजाशी (₹{rem:N2}) जुळत नाही."
                        };
                    }
                    // Snap sub-5-paise rounding residual onto expenseDr so Dr == Cr strictly holds
                    expenseDr = Round2(Math.Max(0m, rem - postedDr));
                }
                else if (req.PostedInterestDebitAmount.HasValue)
                {
                    postedDr = Round2(req.PostedInterestDebitAmount.Value);
                    if (postedDr - rem > BalanceTolerance)
                    {
                        return new FdInterestAllocationResult
                        {
                            IsValid = false,
                            ErrorMessage = $"POSTING_INTR नावे रक्कम (₹{postedDr:N2}) ही उर्वरित देय व्याजापेक्षा (₹{rem:N2}) जास्त असू शकत नाही."
                        };
                    }
                    postedDr = Math.Min(rem, postedDr);
                    expenseDr = Round2(Math.Max(0m, rem - postedDr));
                }
                else if (req.ExpenseInterestDebitAmount.HasValue)
                {
                    expenseDr = Round2(req.ExpenseInterestDebitAmount.Value);
                    if (expenseDr - rem > BalanceTolerance)
                    {
                        return new FdInterestAllocationResult
                        {
                            IsValid = false,
                            ErrorMessage = $"नफा-तोटा/खर्च व्याज नावे रक्कम (₹{expenseDr:N2}) ही उर्वरित देय व्याजापेक्षा (₹{rem:N2}) जास्त असू शकत नाही."
                        };
                    }
                    expenseDr = Math.Min(rem, expenseDr);
                    postedDr = Round2(Math.Max(0m, rem - expenseDr));
                }
                else
                {
                    // "Split" with nulls: smart default using verified provision
                    postedDr = Math.Min(rem, rawProv);
                    expenseDr = Round2(Math.Max(0m, rem - postedDr));
                }

                return new FdInterestAllocationResult
                {
                    IsValid = true,
                    ClearedCapitalizedInterest = clearedCap,
                    PostedInterestDebitAmount = postedDr,
                    ExpenseInterestDebitAmount = expenseDr,
                    OverdueInterest = safeOverdue,
                    ReversePostedInterestAmount = 0m,
                    AlreadyAccruedEffective = Round2(clearedCap + postedDr)
                };
            }
            else
            {
                // Premature Close with Explicit Split / Reversal
                decimal clearedCap = cap;
                bool hasPosted = req.PostedInterestDebitAmount.HasValue;
                bool hasExpense = req.ExpenseInterestDebitAmount.HasValue;
                bool hasRev = req.ReversePostedInterestAmount.HasValue;

                decimal postedDr;
                decimal expenseDr;
                decimal revCr;

                if (hasPosted)
                {
                    postedDr = Round2(req.PostedInterestDebitAmount!.Value);
                    decimal targetPlusRev = safeTarget + Round2(req.ReversePostedInterestAmount ?? 0m);
                    expenseDr = hasExpense
                        ? Round2(req.ExpenseInterestDebitAmount!.Value)
                        : Round2(Math.Max(0m, targetPlusRev - clearedCap - postedDr));

                    decimal totalDebits = Round2(clearedCap + postedDr + expenseDr);
                    if (totalDebits + BalanceTolerance < safeTarget)
                    {
                        return new FdInterestAllocationResult
                        {
                            IsValid = false,
                            ErrorMessage = $"नावे केलेले एकूण व्याज (₹{totalDebits:N2}) हे देय मुदतपूर्व व्याजापेक्षा (₹{safeTarget:N2}) कमी आहे. कृपया POSTING_INTR किंवा नफा-तोटा खर्च रक्कम तपासा."
                        };
                    }

                    revCr = Round2(Math.Max(0m, totalDebits - safeTarget));
                    if (hasRev && Math.Abs(revCr - Round2(req.ReversePostedInterestAmount!.Value)) > BalanceTolerance)
                    {
                        return new FdInterestAllocationResult
                        {
                            IsValid = false,
                            ErrorMessage = $"पोस्टिंग व्याज रिव्हर्सल रक्कम (₹{req.ReversePostedInterestAmount.Value:N2}) आणि नावे व्याजातील तफावत (₹{revCr:N2}) जुळत नाही."
                        };
                    }
                    // Snap minor penny tolerance onto expenseDr when revCr is explicitly asserted
                    if (hasRev)
                    {
                        revCr = Round2(req.ReversePostedInterestAmount!.Value);
                        if (!hasExpense)
                        {
                            expenseDr = Round2(Math.Max(0m, safeTarget + revCr - clearedCap - postedDr));
                        }
                    }
                }
                else if (hasRev)
                {
                    revCr = Round2(req.ReversePostedInterestAmount!.Value);
                    expenseDr = hasExpense
                        ? Round2(req.ExpenseInterestDebitAmount!.Value)
                        : Round2(Math.Max(0m, safeTarget - clearedCap));
                    decimal neededTotalDr = Round2(safeTarget + revCr);
                    decimal candidatePosted = Round2(neededTotalDr - clearedCap - expenseDr);
                    if (candidatePosted < -BalanceTolerance)
                    {
                        // Excess capitalized or expense covers part of reversal; reduce expense first if expense was auto-derived
                        if (!hasExpense)
                        {
                            expenseDr = Round2(Math.Max(0m, neededTotalDr - clearedCap));
                            candidatePosted = Round2(Math.Max(0m, neededTotalDr - clearedCap - expenseDr));
                        }
                        else
                        {
                            return new FdInterestAllocationResult
                            {
                                IsValid = false,
                                ErrorMessage = $"रिव्हर्सल रक्कम (₹{revCr:N2}) आणि नफा-तोटा खर्च (₹{expenseDr:N2}) देय व्याजाशी संतुलित होत नाही."
                            };
                        }
                    }
                    postedDr = Math.Max(0m, candidatePosted);
                    revCr = Round2(Math.Max(0m, (clearedCap + postedDr + expenseDr) - safeTarget));
                }
                else if (hasExpense)
                {
                    expenseDr = Round2(req.ExpenseInterestDebitAmount!.Value);
                    postedDr = Round2(Math.Max(0m, Math.Max(rawProv, safeTarget - clearedCap - expenseDr)));
                    revCr = Round2(Math.Max(0m, (clearedCap + postedDr + expenseDr) - safeTarget));
                }
                else
                {
                    // Explicit "Split" mode without custom numeric overrides: default to rawProv split & auto reversal
                    postedDr = rawProv;
                    expenseDr = Round2(Math.Max(0m, safeTarget - clearedCap - postedDr));
                    revCr = Round2(Math.Max(0m, (clearedCap + postedDr) - safeTarget));
                }

                return new FdInterestAllocationResult
                {
                    IsValid = true,
                    ClearedCapitalizedInterest = clearedCap,
                    PostedInterestDebitAmount = postedDr,
                    ExpenseInterestDebitAmount = expenseDr,
                    OverdueInterest = 0m,
                    ReversePostedInterestAmount = revCr,
                    AlreadyAccruedEffective = Round2(clearedCap + postedDr)
                };
            }
        }

        /// <summary>
        /// Appends Dr POSTING_INTR / Payable, Dr Expense / NAFATOTA DEY VYAJ, and Cr Reversal entries
        /// uniformly across Single-Branch, Loan Set-Off, IBT Home Voucher, and Renewal vouchers.
        /// </summary>
        public static void AppendInterestAllocationVoucherDetails(
            AppDbContext context,
            int voucherId,
            int customerId,
            int? memberId,
            FdInterestAllocationResult allocation,
            Ledger? postedInterestLedger,
            Ledger? expenseInterestLedger,
            Ledger? reversalCreditLedger)
        {
            if (allocation.PostedInterestDebitAmount > 0m && postedInterestLedger != null)
            {
                context.VoucherDetails.Add(new VoucherDetail
                {
                    VoucherID = voucherId,
                    LedgerID = postedInterestLedger.LedgerID,
                    DrCr = "Dr",
                    Amount = allocation.PostedInterestDebitAmount,
                    CustomerID = customerId,
                    MemberID = memberId
                });
            }

            if (allocation.TotalExpenseInterest > 0m && expenseInterestLedger != null)
            {
                context.VoucherDetails.Add(new VoucherDetail
                {
                    VoucherID = voucherId,
                    LedgerID = expenseInterestLedger.LedgerID,
                    DrCr = "Dr",
                    Amount = allocation.TotalExpenseInterest,
                    CustomerID = customerId,
                    MemberID = memberId
                });
            }

            if (allocation.ReversePostedInterestAmount > 0m && reversalCreditLedger != null)
            {
                context.VoucherDetails.Add(new VoucherDetail
                {
                    VoucherID = voucherId,
                    LedgerID = reversalCreditLedger.LedgerID,
                    DrCr = "Cr",
                    Amount = allocation.ReversePostedInterestAmount,
                    CustomerID = customerId,
                    MemberID = memberId
                });
            }
        }

        private static decimal Round2(decimal value) =>
            Math.Round(value, 2, MidpointRounding.AwayFromZero);
    }
}
