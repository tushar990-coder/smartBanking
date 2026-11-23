using System;
using System.Linq;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bhisi.Api.Helpers
{
    public static class PigmySettlementHelper
    {
        public static bool IsSavingTransferMode(string? mode)
        {
            if (string.IsNullOrWhiteSpace(mode)) return false;
            string m = mode.Trim();
            return m.Equals("Saving Transfer", StringComparison.OrdinalIgnoreCase)
                || m.Equals("Saving", StringComparison.OrdinalIgnoreCase)
                || m.Equals("SavingTransfer", StringComparison.OrdinalIgnoreCase)
                || m.Equals("Transfer", StringComparison.OrdinalIgnoreCase);
        }

        public static bool IsLoanAdjustmentMode(string? mode)
        {
            if (string.IsNullOrWhiteSpace(mode)) return false;
            string m = mode.Trim();
            return m.Equals("Adjust in Loan", StringComparison.OrdinalIgnoreCase)
                || m.Equals("AdjustInLoan", StringComparison.OrdinalIgnoreCase)
                || m.Equals("Loan Adjustment", StringComparison.OrdinalIgnoreCase)
                || m.Equals("LoanAdjustment", StringComparison.OrdinalIgnoreCase);
        }

        public static bool IsCashOrBankLedger(Ledger ledger)
        {
            string accType = (ledger.AccountType ?? string.Empty).Trim();
            if (accType.Equals("Cash", StringComparison.OrdinalIgnoreCase) ||
                accType.Equals("Cash In Hand", StringComparison.OrdinalIgnoreCase) ||
                accType.Equals("Bank", StringComparison.OrdinalIgnoreCase) ||
                accType.Equals("Bank Account", StringComparison.OrdinalIgnoreCase) ||
                accType.Equals("Bank Accounts", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            string gName = (ledger.AccountGroup?.GroupName ?? string.Empty).Trim();
            if (gName.Contains("रोकड", StringComparison.OrdinalIgnoreCase) ||
                gName.Contains("बँकेतील शिल्लक", StringComparison.OrdinalIgnoreCase) ||
                gName.Contains("Cash", StringComparison.OrdinalIgnoreCase) ||
                gName.Contains("Bank", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            return false;
        }

        /// <summary>
        /// Validates that a dynamically selected Premature Commission Deduction / Penalty Ledger
        /// belongs strictly to Income or Expenses (e.g., Commission Recovery / Penalty Income / Commission Expense credit)
        /// and is NEVER a Cash, Bank, Loan Asset, or Deposit Liability ledger.
        /// </summary>
        public static async Task<(bool IsValid, string? ErrorMessage, Ledger? Ledger)> ValidateDynamicDeductionLedgerAsync(
            AppDbContext context,
            int? requestedLedgerId,
            int? schemeDeductionLedgerId)
        {
            int effectiveId = (requestedLedgerId.HasValue && requestedLedgerId.Value > 0)
                ? requestedLedgerId.Value
                : (schemeDeductionLedgerId ?? 0);

            if (effectiveId <= 0)
            {
                return (false,
                    "या पिग्मी योजनेसाठी 'पिग्मी कमिशन कपात / मुदतपूर्व दंड जमा जी.एल. लेजर' मॅप केलेले नाही. कृपया प्रथम 'पिग्मी योजना मास्टर' (Pigmy Scheme Settings) मध्ये कमिशन/दंड कपात लेजर मॅपिंग पूर्ण करा.",
                    null);
            }

            var ledger = await context.Ledgers
                .Include(l => l.AccountGroup)
                .FirstOrDefaultAsync(l => l.LedgerID == effectiveId);

            if (ledger == null || !ledger.IsActive)
            {
                return (false, "निवडलेले कमिशन कपात / दंड जी.एल. लेजर सापडले नाही किंवा निष्क्रिय आहे.", null);
            }

            if (IsCashOrBankLedger(ledger))
            {
                return (false,
                    $"कमिशन कपात / दंड लेजर म्हणून रोख किंवा बँक लेजर ('{ledger.LedgerName}') वापरता येत नाही. कृपया उत्पन्न (Income) किंवा कमिशन खर्च (Expenses) गटातील लेजर निवडा.",
                    null);
            }

            string nature = (ledger.AccountGroup?.NatureOfGroup ?? string.Empty).Trim();
            string accType = (ledger.AccountType ?? string.Empty).Trim();

            bool isLoanOrDeposit =
                accType.Equals("Loan", StringComparison.OrdinalIgnoreCase) ||
                accType.Equals("Deposits", StringComparison.OrdinalIgnoreCase) ||
                accType.Equals("Savings", StringComparison.OrdinalIgnoreCase) ||
                nature.Equals("Assets", StringComparison.OrdinalIgnoreCase) ||
                nature.Equals("Liabilities", StringComparison.OrdinalIgnoreCase);

            bool isIncomeOrExpense =
                nature.Equals("Income", StringComparison.OrdinalIgnoreCase) ||
                nature.Equals("Expenses", StringComparison.OrdinalIgnoreCase) ||
                accType.Equals("Income", StringComparison.OrdinalIgnoreCase) ||
                accType.Equals("Expenses", StringComparison.OrdinalIgnoreCase) ||
                accType.Equals("Expense", StringComparison.OrdinalIgnoreCase);

            if (!isIncomeOrExpense && isLoanOrDeposit)
            {
                return (false,
                    $"कमिशन कपात / दंड लेजर म्हणून मालमत्ता किंवा ठेव देयता लेजर ('{ledger.LedgerName}') निवडता येत नाही. कृपया उत्पन्न (Income) किंवा खर्च वसुली (Expenses) लेजर निवडा.",
                    null);
            }

            return (true, null, ledger);
        }

        public static async Task<(bool IsValid, string? ErrorMessage, Ledger? Ledger)> ValidateDynamicInterestDebitLedgerAsync(
            AppDbContext context,
            int? requestedLedgerId,
            string? interestDebitMode,
            PigmyScheme? scheme)
        {
            string mode = (interestDebitMode ?? "Expense").Trim();
            int effectiveId = requestedLedgerId.HasValue && requestedLedgerId.Value > 0
                ? requestedLedgerId.Value
                : (mode.Equals("Provision", StringComparison.OrdinalIgnoreCase)
                    ? (scheme?.InterestPayableLedgerID ?? 0)
                    : (scheme?.InterestExpenseLedgerID ?? 0));

            if (effectiveId <= 0)
            {
                string targetLabel = mode.Equals("Provision", StringComparison.OrdinalIgnoreCase)
                    ? "पिग्मी देणे व्याज तरतूद (Interest Payable)"
                    : "पिग्मी व्याज खर्च (Interest Expense)";
                return (false,
                    $"या पिग्मी योजनेसाठी '{targetLabel}' जी.एल. लेजर मॅप केलेले नाही. कृपया प्रथम 'पिग्मी योजना मास्टर' मध्ये व्याज लेजर मॅपिंग पूर्ण करा.",
                    null);
            }

            var ledger = await context.Ledgers
                .Include(l => l.AccountGroup)
                .FirstOrDefaultAsync(l => l.LedgerID == effectiveId);

            if (ledger == null || !ledger.IsActive)
            {
                return (false, "निवडलेले व्याज नावे (Dr) जी.एल. लेजर सापडले नाही किंवा निष्क्रिय आहे.", null);
            }

            if (IsCashOrBankLedger(ledger))
            {
                return (false, $"व्याज नावे लेजर म्हणून रोख किंवा बँक लेजर ('{ledger.LedgerName}') निवडता येत नाही.", null);
            }

            return (true, null, ledger);
        }

        public static async Task<(bool IsValid, string? ErrorMessage)> ValidatePigmySchemeMappingsAsync(
            AppDbContext context,
            PigmyScheme scheme)
        {
            async Task<string?> CheckNotCashBankAsync(int? ledgerId, string fieldLabel)
            {
                if (!ledgerId.HasValue || ledgerId.Value <= 0) return null;
                var l = await context.Ledgers.Include(x => x.AccountGroup).FirstOrDefaultAsync(x => x.LedgerID == ledgerId.Value);
                if (l == null || !l.IsActive)
                    return $"{fieldLabel} साठी निवडलेले लेजर सापडले नाही किंवा निष्क्रिय आहे.";
                if (IsCashOrBankLedger(l))
                    return $"{fieldLabel} म्हणून रोख किंवा बँक लेजर ('{l.LedgerName}') मॅप करता येत नाही.";
                return null;
            }

            var err1 = await CheckNotCashBankAsync(scheme.PigmyLiabilityLedgerID, "पिग्मी ठेव देयता खाते");
            if (err1 != null) return (false, err1);

            var err2 = await CheckNotCashBankAsync(scheme.InterestExpenseLedgerID, "पिग्मी व्याज खर्च खाते");
            if (err2 != null) return (false, err2);

            var err3 = await CheckNotCashBankAsync(scheme.InterestPayableLedgerID, "पिग्मी देणे व्याज खाते");
            if (err3 != null) return (false, err3);

            var err4 = await CheckNotCashBankAsync(scheme.CommissionExpenseLedgerID, "पिग्मी एजंट कमिशन खर्च खाते");
            if (err4 != null) return (false, err4);

            bool hasAnyPenaltyRule =
                (scheme.PenaltyInterestRate ?? 0m) > 0m ||
                (scheme.Slabs != null && scheme.Slabs.Any(s => s.IsActive && s.PenaltyRate > 0m));

            if (hasAnyPenaltyRule && (!scheme.PrematureDeductionLedgerID.HasValue || scheme.PrematureDeductionLedgerID.Value <= 0))
            {
                return (false,
                    "या पिग्मी योजनेत मुदतपूर्व कमिशन / दंड कपात दर (> ०%) लागू आहे; कृपया '५. मुदतपूर्व पिग्मी कमिशन कपात / दंड वसुली खाते' मॅप करा.");
            }

            if (scheme.PrematureDeductionLedgerID.HasValue && scheme.PrematureDeductionLedgerID.Value > 0)
            {
                var dedCheck = await ValidateDynamicDeductionLedgerAsync(context, scheme.PrematureDeductionLedgerID, null);
                if (!dedCheck.IsValid) return (false, dedCheck.ErrorMessage);
            }

            return (true, null);
        }

        /// <summary>
        /// Credits the target Saving Account ONLY when the Pigmy Withdrawal or Closure Voucher is Approved by Checker.
        /// Idempotent by VoucherNo.
        /// </summary>
        public static async Task ApplyApprovedPigmySavingTransferAsync(
            AppDbContext context,
            Voucher voucher,
            int approverId)
        {
            if (!string.Equals(voucher.Status, "Approved", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            if (!string.IsNullOrWhiteSpace(voucher.VoucherNo))
            {
                bool alreadyPosted = await context.SavingTransactions
                    .AnyAsync(st => st.VoucherNo == voucher.VoucherNo);
                if (alreadyPosted)
                {
                    return;
                }
            }

            // 1. Check linked PigmyWithdrawal
            var withdrawal = await context.PigmyWithdrawals
                .Include(w => w.PigmyAccount)
                .FirstOrDefaultAsync(w =>
                    (w.VoucherID.HasValue && w.VoucherID.Value == voucher.VoucherID) ||
                    (!string.IsNullOrWhiteSpace(voucher.VoucherNo) && w.VoucherNo == voucher.VoucherNo));

            if (withdrawal != null)
            {
                int? targetSbId = null;
                decimal creditAmount = 0m;
                string narrationLabel = $"पिग्मी अंशतः विड्रॉल जमा - पिग्मी खाते {withdrawal.PigmyAccount?.AccountNo}";

                if (withdrawal.AdjustInLoan && IsSavingTransferMode(withdrawal.SurplusPaymentMode) && withdrawal.SurplusPayoutAmount > 0m)
                {
                    targetSbId = withdrawal.SurplusSavingAccountID;
                    creditAmount = withdrawal.SurplusPayoutAmount;
                    narrationLabel = $"पिग्मी विड्रॉल कर्ज समायोजनानंतर शिल्लक जमा - खाते {withdrawal.PigmyAccount?.AccountNo}";
                }
                else if (IsSavingTransferMode(withdrawal.PaymentMode) && withdrawal.NetPaidAmount > 0m)
                {
                    targetSbId = withdrawal.SavingAccountID;
                    creditAmount = withdrawal.NetPaidAmount;
                }

                if (targetSbId.HasValue && targetSbId.Value > 0 && creditAmount > 0m)
                {
                    await CreditSavingAccountOnApprovalAsync(
                        context,
                        targetSbId.Value,
                        creditAmount,
                        withdrawal.WithdrawalDate,
                        voucher,
                        narrationLabel,
                        approverId);
                }
                return;
            }

            // 2. Check linked PigmyAccountClosure
            var closure = await context.PigmyAccountClosures
                .Include(c => c.PigmyAccount)
                .FirstOrDefaultAsync(c =>
                    (c.VoucherID.HasValue && c.VoucherID.Value == voucher.VoucherID) ||
                    (!string.IsNullOrWhiteSpace(voucher.VoucherNo) && c.VoucherNo == voucher.VoucherNo));

            if (closure != null)
            {
                int? targetSbId = null;
                decimal creditAmount = 0m;
                string narrationLabel = $"पिग्मी खाते बंद अंतिम परतावा जमा - पिग्मी खाते {closure.PigmyAccount?.AccountNo}";

                if (closure.AdjustInLoan && IsSavingTransferMode(closure.SurplusPaymentMode) && closure.SurplusPayoutAmount > 0m)
                {
                    targetSbId = closure.SurplusSavingAccountID;
                    creditAmount = closure.SurplusPayoutAmount;
                    narrationLabel = $"पिग्मी क्लोजर कर्ज समायोजनानंतर शिल्लक परतावा जमा - खाते {closure.PigmyAccount?.AccountNo}";
                }
                else if (IsSavingTransferMode(closure.PaymentMode) && closure.NetPayableAmount > 0m)
                {
                    targetSbId = closure.SavingAccountID;
                    creditAmount = closure.NetPayableAmount;
                }

                if (targetSbId.HasValue && targetSbId.Value > 0 && creditAmount > 0m)
                {
                    await CreditSavingAccountOnApprovalAsync(
                        context,
                        targetSbId.Value,
                        creditAmount,
                        closure.ClosureDate,
                        voucher,
                        narrationLabel,
                        approverId);
                }
            }
        }

        private static async Task CreditSavingAccountOnApprovalAsync(
            AppDbContext context,
            int savingAccountId,
            decimal creditAmount,
            DateTime txnDate,
            Voucher voucher,
            string narration,
            int approverId)
        {
            var sbAcc = await context.SavingAccountMasters.FirstOrDefaultAsync(s => s.SavingAccountID == savingAccountId);
            if (sbAcc == null)
            {
                throw new InvalidOperationException($"बचत खाते (ID: #{savingAccountId}) सापडले नाही.");
            }
            if (string.Equals(sbAcc.Status, "Closed", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(sbAcc.Status, "Frozen", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException($"बचत खाते (#{sbAcc.AccountNo}) सध्या '{sbAcc.Status}' स्थितीत असल्यामुळे व्हाउचर पास करता येणार नाही.");
            }

            sbAcc.CurrentBalance = Math.Round(sbAcc.CurrentBalance + creditAmount, 2, MidpointRounding.AwayFromZero);
            context.Entry(sbAcc).State = EntityState.Modified;

            context.SavingTransactions.Add(new SavingTransaction
            {
                SavingAccountID = sbAcc.SavingAccountID,
                CustomerID = sbAcc.CustomerID,
                BranchID = sbAcc.BranchID > 0 ? sbAcc.BranchID : voucher.BranchID,
                TransactionDate = txnDate,
                TransactionType = "Deposit",
                PaymentMode = "Transfer",
                Amount = creditAmount,
                BalanceAfterTxn = sbAcc.CurrentBalance,
                Narration = narration,
                VoucherNo = voucher.VoucherNo,
                VoucherID = voucher.VoucherID,
                CreatedBy = approverId > 0 ? approverId : 1,
                CreatedOn = DateTime.Now
            });

            await context.SaveChangesAsync();
        }
    }
}
