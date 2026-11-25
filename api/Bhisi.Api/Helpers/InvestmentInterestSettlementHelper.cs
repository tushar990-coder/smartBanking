using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bhisi.Api.Helpers
{
    public static class InvestmentReversalModes
    {
        public const string Auto = "Auto";
        public const string ReceivableReversal = "ReceivableReversal";
        public const string PayoutDeduction = "PayoutDeduction";
    }

    public sealed class InvestmentVerifiedInterestSummary
    {
        public int InvestmentAccountID { get; init; }
        public decimal TillMigrationAccrued { get; init; }
        public decimal SystemPostedAccrued { get; init; }
        public decimal TotalAccrued { get; init; }
        public decimal TotalReceivedGross { get; init; }
        public decimal OutstandingReceivable { get; init; }
        public DateTime? LastAccrualDate { get; init; }
        public decimal PendingAccruedInterest { get; init; }
        public int PendingAccrualCount { get; init; }
        public decimal PrematureAccruedInterestReversed { get; init; }
        public decimal PrematureClawbackAmount { get; init; }
        public string? PrematureReversalMode { get; init; }
    }

    public sealed class InvestmentPrematureAllocationRequest
    {
        public decimal OriginalPrincipal { get; init; }
        public decimal PrincipalPaid { get; init; }
        public decimal InterestPaid { get; init; }
        public decimal PenaltyAmount { get; init; }
        public decimal TdsAmount { get; init; }
        public decimal StandingReceivable { get; init; }
        public bool EnablePostingInterestReversal { get; init; }
        public string? ReversalMode { get; init; }
        public decimal? ReversePostingInterestAmount { get; init; }
        public int? ReversalDebitLedgerID { get; init; }
        public int? PostingCreditLedgerID { get; init; }
        public int SchemeInterestIncomeLedgerID { get; init; }
        public int SchemeInterestReceivableLedgerID { get; init; }
    }

    public sealed class InvestmentPrematureAllocationResult
    {
        public bool IsValid { get; init; } = true;
        public string? ErrorMessage { get; init; }
        public string NormalizedReversalMode { get; init; } = InvestmentReversalModes.Auto;
        public decimal OriginalPrincipal { get; init; }
        public decimal PrincipalPaid { get; init; }
        public decimal InterestPaid { get; init; }
        public decimal PenaltyAmount { get; init; }
        public decimal TdsAmount { get; init; }
        public decimal StandingReceivable { get; init; }
        public decimal NetPayout { get; init; }

        public decimal ReceivableCleared { get; init; }
        public decimal FreshInterestIncome { get; init; }
        public decimal PrincipalClawback { get; init; }
        public decimal PayoutDeductionAmount { get; init; }
        public decimal ManualPostingReversalAmount { get; init; }
        public decimal SystemReceivableExtraReversalAmount { get; init; }

        public decimal AccruedInterestReversed { get; init; }
        public decimal InterestClawbackAmount { get; init; }
        public decimal TotalReversalDebitAmount { get; init; }
        public decimal SchemeReceivableCreditAmount { get; init; }
        public decimal PostingCreditLedgerAmount { get; init; }
        public int EffectiveReversalDebitLedgerID { get; init; }
        public int EffectivePostingCreditLedgerID { get; init; }
        public decimal TotalVoucherAmount { get; init; }
    }

    /// <summary>
    /// Shared CBS settlement & verification helper for Investments:
    /// computes verified (non-cancelled, non-rejected, non-orphaned) accrual/receipt totals
    /// and resolves double-entry allocations for Premature Withdrawals across Auto,
    /// ReceivableReversal, and PayoutDeduction modes.
    /// </summary>
    public static class InvestmentInterestSettlementHelper
    {
        public static bool IsVoidVoucherStatus(string? status)
        {
            if (string.IsNullOrWhiteSpace(status)) return false;
            return string.Equals(status.Trim(), "Cancelled", StringComparison.OrdinalIgnoreCase)
                || string.Equals(status.Trim(), "Rejected", StringComparison.OrdinalIgnoreCase);
        }

        public static bool IsPendingVoucherStatus(string? status) =>
            !string.IsNullOrWhiteSpace(status)
            && string.Equals(status.Trim(), "Pending", StringComparison.OrdinalIgnoreCase);

        public static async Task<InvestmentVerifiedInterestSummary> ResolveVerifiedInterestSummaryAsync(
            AppDbContext context,
            int accountId,
            InvestmentAccount? account = null)
        {
            account ??= await context.InvestmentAccounts
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.InvestmentAccountID == accountId);

            if (account == null)
            {
                return new InvestmentVerifiedInterestSummary { InvestmentAccountID = accountId };
            }

            var map = await GetVerifiedInterestSummaryMapAsync(context, new[] { account });
            return map.TryGetValue(accountId, out var summary)
                ? summary
                : new InvestmentVerifiedInterestSummary { InvestmentAccountID = accountId };
        }

        public static async Task<Dictionary<int, InvestmentVerifiedInterestSummary>> GetVerifiedInterestSummaryMapAsync(
            AppDbContext context,
            IEnumerable<InvestmentAccount> accounts)
        {
            var accountList = accounts?.Where(a => a != null).ToList() ?? new List<InvestmentAccount>();
            var result = new Dictionary<int, InvestmentVerifiedInterestSummary>();
            if (accountList.Count == 0) return result;

            var accountIds = accountList.Select(a => a.InvestmentAccountID).Distinct().ToList();

            var rawAccruals = await context.InvestmentInterestAccruals
                .AsNoTracking()
                .Where(a => accountIds.Contains(a.InvestmentAccountID))
                .Select(a => new
                {
                    a.InvestmentAccountID,
                    a.InterestAmount,
                    a.AccrualDate,
                    a.IsPosted,
                    a.VoucherID,
                    HasVoucher = a.Voucher != null,
                    VoucherStatus = a.Voucher != null ? a.Voucher.Status : null
                })
                .ToListAsync();

            var liveAccrualsByAccount = rawAccruals
                .Where(a => a.IsPosted && (!a.VoucherID.HasValue || (a.HasVoucher && !IsVoidVoucherStatus(a.VoucherStatus))))
                .GroupBy(a => a.InvestmentAccountID)
                .ToDictionary(g => g.Key, g => g.ToList());

            var rawReceipts = await context.InvestmentInterestReceipts
                .AsNoTracking()
                .Where(r => accountIds.Contains(r.InvestmentAccountID))
                .Select(r => new
                {
                    r.InvestmentAccountID,
                    Gross = r.GrossAmount > 0m ? r.GrossAmount : r.ReceivedAmount,
                    r.VoucherID,
                    HasVoucher = r.Voucher != null,
                    VoucherStatus = r.Voucher != null ? r.Voucher.Status : null
                })
                .ToListAsync();

            var liveReceiptsByAccount = rawReceipts
                .Where(r => !r.VoucherID.HasValue || (r.HasVoucher && !IsVoidVoucherStatus(r.VoucherStatus)))
                .GroupBy(r => r.InvestmentAccountID)
                .ToDictionary(g => g.Key, g => Round2(g.Sum(x => x.Gross)));

            var rawPrematures = await context.InvestmentPrematureWithdrawals
                .AsNoTracking()
                .Where(p => accountIds.Contains(p.InvestmentAccountID))
                .Select(p => new
                {
                    p.WithdrawalID,
                    p.InvestmentAccountID,
                    p.AccruedInterestReversed,
                    p.InterestClawbackAmount,
                    p.ReversalMode,
                    p.VoucherID,
                    HasVoucher = p.Voucher != null,
                    VoucherStatus = p.Voucher != null ? p.Voucher.Status : null
                })
                .ToListAsync();

            var livePrematuresByAccount = rawPrematures
                .Where(p => !p.VoucherID.HasValue || (p.HasVoucher && !IsVoidVoucherStatus(p.VoucherStatus)))
                .GroupBy(p => p.InvestmentAccountID)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.WithdrawalID).ToList());

            foreach (var acc in accountList)
            {
                decimal tillMigration = Round2(Math.Max(0m, acc.AccruedInterestTillMigration));

                decimal dbAccrued = 0m;
                DateTime? lastAccrualDate = null;
                decimal pendingAccrued = 0m;
                int pendingCount = 0;

                if (liveAccrualsByAccount.TryGetValue(acc.InvestmentAccountID, out var accRows) && accRows.Count > 0)
                {
                    dbAccrued = Round2(accRows.Sum(x => x.InterestAmount));
                    lastAccrualDate = accRows.Max(x => x.AccrualDate);
                    var pendingRows = accRows.Where(x => IsPendingVoucherStatus(x.VoucherStatus)).ToList();
                    pendingCount = pendingRows.Count;
                    pendingAccrued = Round2(pendingRows.Sum(x => x.InterestAmount));
                }

                decimal totalAccrued = Round2(tillMigration + dbAccrued);
                decimal receivedGross = liveReceiptsByAccount.TryGetValue(acc.InvestmentAccountID, out var recSum) ? recSum : 0m;
                bool isActive = string.Equals(acc.Status, "Active", StringComparison.OrdinalIgnoreCase);

                // Closed / Matured / Renewed investments must never report stale outstanding receivable.
                decimal outstanding = isActive
                    ? Math.Max(0m, Round2(totalAccrued - receivedGross))
                    : 0m;

                decimal preReversed = 0m;
                decimal preClawback = 0m;
                string? preMode = null;
                if (livePrematuresByAccount.TryGetValue(acc.InvestmentAccountID, out var preRows) && preRows.Count > 0)
                {
                    preReversed = Round2(preRows.Sum(x => x.AccruedInterestReversed));
                    preClawback = Round2(preRows.Sum(x => x.InterestClawbackAmount));
                    preMode = preRows.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x.ReversalMode))?.ReversalMode;
                }

                result[acc.InvestmentAccountID] = new InvestmentVerifiedInterestSummary
                {
                    InvestmentAccountID = acc.InvestmentAccountID,
                    TillMigrationAccrued = tillMigration,
                    SystemPostedAccrued = dbAccrued,
                    TotalAccrued = totalAccrued,
                    TotalReceivedGross = receivedGross,
                    OutstandingReceivable = outstanding,
                    LastAccrualDate = lastAccrualDate,
                    PendingAccruedInterest = pendingAccrued,
                    PendingAccrualCount = pendingCount,
                    PrematureAccruedInterestReversed = preReversed,
                    PrematureClawbackAmount = preClawback,
                    PrematureReversalMode = preMode
                };
            }

            return result;
        }

        public static InvestmentPrematureAllocationResult ResolvePrematureSettlementAllocation(
            InvestmentPrematureAllocationRequest req)
        {
            decimal origP = Round2(Math.Max(0m, req.OriginalPrincipal));
            decimal paidP = Round2(req.PrincipalPaid);
            decimal grossInt = Round2(req.InterestPaid);
            decimal penalty = Round2(req.PenaltyAmount);
            decimal tds = Round2(req.TdsAmount);
            decimal standingRecv = Round2(Math.Max(0m, req.StandingReceivable));

            if (paidP < 0m)
            {
                return Invalid("परत मिळालेले मुद्दल ₹0 पेक्षा कमी असू शकत नाही.");
            }
            if (paidP > origP)
            {
                return Invalid("परत मिळालेले मुद्दल हे मूळ गुंतवलेल्या मुद्दलापेक्षा जास्त असू शकत नाही; अतिरिक्त रक्कम व्याजात नोंदवा.");
            }
            if (grossInt < 0m)
            {
                return Invalid("मिळालेले व्याज ₹0 पेक्षा कमी असू शकत नाही.");
            }
            if (penalty < 0m || tds < 0m)
            {
                return Invalid("दंड किंवा TDS रक्कम ₹0 पेक्षा कमी असू शकत नाही.");
            }
            if (req.ReversePostingInterestAmount.HasValue && req.ReversePostingInterestAmount.Value < 0m)
            {
                return Invalid("रिव्हर्स पोस्टिंग व्याज रक्कम ₹0 पेक्षा कमी असू शकत नाही.");
            }

            string rawMode = (req.ReversalMode ?? string.Empty).Trim();
            string mode;
            if (string.IsNullOrEmpty(rawMode))
            {
                mode = req.EnablePostingInterestReversal ? InvestmentReversalModes.ReceivableReversal : InvestmentReversalModes.Auto;
            }
            else if (string.Equals(rawMode, InvestmentReversalModes.Auto, StringComparison.OrdinalIgnoreCase))
            {
                mode = req.EnablePostingInterestReversal ? InvestmentReversalModes.ReceivableReversal : InvestmentReversalModes.Auto;
            }
            else if (string.Equals(rawMode, InvestmentReversalModes.ReceivableReversal, StringComparison.OrdinalIgnoreCase))
            {
                mode = InvestmentReversalModes.ReceivableReversal;
            }
            else if (string.Equals(rawMode, InvestmentReversalModes.PayoutDeduction, StringComparison.OrdinalIgnoreCase))
            {
                mode = InvestmentReversalModes.PayoutDeduction;
            }
            else
            {
                return Invalid($"अवैध पोस्टिंग व्याज रिव्हर्सल मोड: {rawMode}");
            }

            decimal principalClawback = Math.Max(0m, Round2(origP - paidP));
            int effDebitLedgerId = (req.ReversalDebitLedgerID.HasValue && req.ReversalDebitLedgerID.Value > 0)
                ? req.ReversalDebitLedgerID.Value
                : req.SchemeInterestIncomeLedgerID;
            int effCreditLedgerId = (req.PostingCreditLedgerID.HasValue && req.PostingCreditLedgerID.Value > 0)
                ? req.PostingCreditLedgerID.Value
                : req.SchemeInterestReceivableLedgerID;

            if (mode == InvestmentReversalModes.Auto)
            {
                decimal netPayout = Round2(paidP + grossInt - penalty - tds);
                if (netPayout < 0m)
                {
                    return Invalid("मुदतपूर्व दंड व TDS कपात रक्कम ही एकूण मुद्दल व व्याजापेक्षा जास्त असू शकत नाही.");
                }

                decimal receivableCleared = Math.Min(grossInt, standingRecv);
                decimal accruedReversed = Math.Max(0m, Round2(standingRecv - receivableCleared));
                decimal schemeRecvCr = Round2(receivableCleared + accruedReversed);
                decimal freshIncome = Math.Max(0m, Round2(grossInt - receivableCleared));
                decimal totalReversalDr = Round2(accruedReversed + principalClawback);
                decimal totalVoucherAmt = Round2(netPayout + tds + penalty + totalReversalDr);

                return new InvestmentPrematureAllocationResult
                {
                    IsValid = true,
                    NormalizedReversalMode = InvestmentReversalModes.Auto,
                    OriginalPrincipal = origP,
                    PrincipalPaid = paidP,
                    InterestPaid = grossInt,
                    PenaltyAmount = penalty,
                    TdsAmount = tds,
                    StandingReceivable = standingRecv,
                    NetPayout = netPayout,
                    ReceivableCleared = receivableCleared,
                    FreshInterestIncome = freshIncome,
                    PrincipalClawback = principalClawback,
                    PayoutDeductionAmount = 0m,
                    ManualPostingReversalAmount = 0m,
                    SystemReceivableExtraReversalAmount = 0m,
                    AccruedInterestReversed = accruedReversed,
                    InterestClawbackAmount = principalClawback,
                    TotalReversalDebitAmount = totalReversalDr,
                    SchemeReceivableCreditAmount = schemeRecvCr,
                    PostingCreditLedgerAmount = 0m,
                    EffectiveReversalDebitLedgerID = effDebitLedgerId,
                    EffectivePostingCreditLedgerID = effCreditLedgerId,
                    TotalVoucherAmount = totalVoucherAmt
                };
            }

            if (mode == InvestmentReversalModes.ReceivableReversal)
            {
                decimal autoDefaultRev = Math.Max(0m, Round2(standingRecv - Math.Min(grossInt, standingRecv)));
                decimal manualRev = req.ReversePostingInterestAmount.HasValue
                    ? Round2(req.ReversePostingInterestAmount.Value)
                    : autoDefaultRev;

                if (manualRev <= 0m)
                {
                    return Invalid("बुक्स / पोस्टिंग व्याज रिव्हर्सलसाठी कृपया ₹0 पेक्षा जास्त रक्कम प्रविष्ट करा.");
                }

                decimal netPayout = Round2(paidP + grossInt - penalty - tds);
                if (netPayout < 0m)
                {
                    return Invalid("मुदतपूर्व दंड व TDS कपात रक्कम ही एकूण मुद्दल व व्याजापेक्षा जास्त असू शकत नाही.");
                }

                if (effDebitLedgerId > 0 && effCreditLedgerId > 0 && effDebitLedgerId == effCreditLedgerId)
                {
                    return Invalid("रिव्हर्सल नावे (Dr) आणि पोस्टिंग व्याज जमा (Cr) लेजर एकच असू शकत नाही; कृपया वेगवेगळी लेजर्स निवडा.");
                }

                bool targetsCustomPostingLedger =
                    (req.PostingCreditLedgerID.HasValue && req.PostingCreditLedgerID.Value > 0 &&
                     req.PostingCreditLedgerID.Value != req.SchemeInterestReceivableLedgerID)
                    || req.SchemeInterestReceivableLedgerID <= 0;

                decimal receivableCleared;
                decimal sysExtraRev;
                decimal freshIncome;
                decimal schemeRecvCr;
                decimal postingCrAmt;

                if (targetsCustomPostingLedger)
                {
                    // System Interest Receivable (if any) clears separately so account closes cleanly,
                    // while manual posting reversal credits the chosen PostingCreditLedgerID (e.g. POSTING_INTR).
                    receivableCleared = Math.Min(grossInt, standingRecv);
                    sysExtraRev = Math.Max(0m, Round2(standingRecv - receivableCleared));
                    schemeRecvCr = Round2(receivableCleared + sysExtraRev);
                    freshIncome = Math.Max(0m, Round2(grossInt - receivableCleared));
                    postingCrAmt = manualRev;
                }
                else
                {
                    // Same ledger as scheme's InterestReceivableLedgerID: reduce receivable pool available
                    // for grossInterest first so user's reversal amount converts the remaining InterestPaid into FreshIncome.
                    decimal remainingRecvForInterest = Math.Max(0m, Round2(standingRecv - manualRev));
                    receivableCleared = Math.Min(grossInt, remainingRecvForInterest);
                    sysExtraRev = Math.Max(0m, Round2(standingRecv - manualRev - receivableCleared));
                    freshIncome = Math.Max(0m, Round2(grossInt - receivableCleared));
                    schemeRecvCr = Round2(manualRev + receivableCleared + sysExtraRev);
                    postingCrAmt = 0m;
                }

                decimal totalAccruedReversed = Round2(manualRev + sysExtraRev);
                decimal totalReversalDr = Round2(totalAccruedReversed + principalClawback);
                decimal totalVoucherAmt = Round2(netPayout + tds + penalty + totalReversalDr);

                return new InvestmentPrematureAllocationResult
                {
                    IsValid = true,
                    NormalizedReversalMode = InvestmentReversalModes.ReceivableReversal,
                    OriginalPrincipal = origP,
                    PrincipalPaid = paidP,
                    InterestPaid = grossInt,
                    PenaltyAmount = penalty,
                    TdsAmount = tds,
                    StandingReceivable = standingRecv,
                    NetPayout = netPayout,
                    ReceivableCleared = receivableCleared,
                    FreshInterestIncome = freshIncome,
                    PrincipalClawback = principalClawback,
                    PayoutDeductionAmount = 0m,
                    ManualPostingReversalAmount = manualRev,
                    SystemReceivableExtraReversalAmount = sysExtraRev,
                    AccruedInterestReversed = totalAccruedReversed,
                    InterestClawbackAmount = principalClawback,
                    TotalReversalDebitAmount = totalReversalDr,
                    SchemeReceivableCreditAmount = schemeRecvCr,
                    PostingCreditLedgerAmount = postingCrAmt,
                    EffectiveReversalDebitLedgerID = effDebitLedgerId,
                    EffectivePostingCreditLedgerID = effCreditLedgerId,
                    TotalVoucherAmount = totalVoucherAmt
                };
            }

            // Mode 3: PayoutDeduction (bank deducts previously credited/posted interest from net payout)
            decimal payoutDed = Round2(req.ReversePostingInterestAmount ?? 0m);
            if (payoutDed <= 0m)
            {
                return Invalid("बँक परताव्यातून पोस्टिंग व्याज वजा करण्यासाठी कृपया ₹0 पेक्षा जास्त रक्कम प्रविष्ट करा.");
            }

            decimal payoutNet = Round2(paidP + grossInt - payoutDed - penalty - tds);
            if (payoutNet < 0m)
            {
                return Invalid("बँक परताव्यातून पोस्टिंग व्याज वजा, दंड व TDS रक्कम ही एकूण मुद्दल व व्याजापेक्षा जास्त असू शकत नाही.");
            }

            decimal pdRecvCleared = Math.Min(grossInt, standingRecv);
            decimal pdSysRev = Math.Max(0m, Round2(standingRecv - pdRecvCleared));
            decimal pdSchemeRecvCr = Round2(pdRecvCleared + pdSysRev);
            decimal pdFreshIncome = Math.Max(0m, Round2(grossInt - pdRecvCleared));
            decimal pdTotalClawback = Round2(payoutDed + principalClawback);
            decimal pdTotalReversalDr = Round2(pdSysRev + pdTotalClawback);
            decimal pdVoucherAmt = Round2(payoutNet + tds + penalty + pdTotalReversalDr);

            return new InvestmentPrematureAllocationResult
            {
                IsValid = true,
                NormalizedReversalMode = InvestmentReversalModes.PayoutDeduction,
                OriginalPrincipal = origP,
                PrincipalPaid = paidP,
                InterestPaid = grossInt,
                PenaltyAmount = penalty,
                TdsAmount = tds,
                StandingReceivable = standingRecv,
                NetPayout = payoutNet,
                ReceivableCleared = pdRecvCleared,
                FreshInterestIncome = pdFreshIncome,
                PrincipalClawback = principalClawback,
                PayoutDeductionAmount = payoutDed,
                ManualPostingReversalAmount = payoutDed,
                SystemReceivableExtraReversalAmount = pdSysRev,
                AccruedInterestReversed = pdSysRev,
                InterestClawbackAmount = pdTotalClawback,
                TotalReversalDebitAmount = pdTotalReversalDr,
                SchemeReceivableCreditAmount = pdSchemeRecvCr,
                PostingCreditLedgerAmount = 0m,
                EffectiveReversalDebitLedgerID = effDebitLedgerId,
                EffectivePostingCreditLedgerID = 0,
                TotalVoucherAmount = pdVoucherAmt
            };
        }

        private static InvestmentPrematureAllocationResult Invalid(string message) =>
            new InvestmentPrematureAllocationResult { IsValid = false, ErrorMessage = message };

        private static decimal Round2(decimal value) =>
            Math.Round(value, 2, MidpointRounding.AwayFromZero);
    }
}
