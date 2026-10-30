using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Helpers
{
    public static class BankLedgerHelper
    {
        public static bool IsBankAccountType(string? accountType)
        {
            if (string.IsNullOrWhiteSpace(accountType))
                return false;

            var normalized = accountType.Trim();
            return string.Equals(normalized, "Bank Account", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalized, "Bank", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalized, "बँक खाते", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalized, "बँक", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalized, "Current Account", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalized, "OD Account", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalized, "CC Account", StringComparison.OrdinalIgnoreCase);
        }

        public static bool IsCashLedger(Ledger? ledger)
        {
            if (ledger == null)
                return false;

            var accType = (ledger.AccountType ?? string.Empty).Trim();
            if (string.Equals(accType, "Cash", StringComparison.OrdinalIgnoreCase)
                || string.Equals(accType, "Cash In Hand", StringComparison.OrdinalIgnoreCase)
                || string.Equals(accType, "रोख खाते", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            var name = (ledger.LedgerName ?? string.Empty).Trim();
            var nameLower = name.ToLowerInvariant();

            bool hasBankWord = name.Contains("बँक")
                || nameLower.Contains("bank")
                || nameLower.Contains("dccb")
                || nameLower.Contains("od ")
                || nameLower.Contains("cc ");

            if (hasBankWord && !name.Contains("हातातील") && !name.Contains("हातावरील") && !nameLower.Contains("cash in hand"))
                return false;

            return name.Contains("हातातील रोख")
                || name.Contains("हातावरील रोख")
                || name.Contains("हाता. रोख")
                || name.Contains("रोख शिल्लक")
                || name == "रोख खाते"
                || nameLower == "cash"
                || nameLower.Contains("cash in hand")
                || nameLower.Contains("petty cash")
                || ((name.Contains("रोख") || nameLower.Contains("cash")) && !hasBankWord);
        }

        public static bool IsBankLedger(Ledger? ledger)
        {
            if (ledger == null || !ledger.IsActive)
                return false;

            if (IsCashLedger(ledger))
                return false;

            if (IsBankAccountType(ledger.AccountType))
                return true;

            var accType = (ledger.AccountType ?? string.Empty).Trim();
            bool isGenericType = string.IsNullOrEmpty(accType)
                || string.Equals(accType, "GL", StringComparison.OrdinalIgnoreCase)
                || string.Equals(accType, "Assets", StringComparison.OrdinalIgnoreCase)
                || string.Equals(accType, "Asset", StringComparison.OrdinalIgnoreCase)
                || string.Equals(accType, "Liabilities", StringComparison.OrdinalIgnoreCase);

            if (!isGenericType)
                return false;

            var groupName = $"{ledger.AccountGroup?.GroupName} {ledger.AccountGroup?.GroupNameEnglish}".Trim();
            var groupLower = groupName.ToLowerInvariant();
            var ledgerName = $"{ledger.LedgerName} {ledger.LedgerNameEnglish}".Trim();
            var ledgerLower = ledgerName.ToLowerInvariant();

            // Exclude non-bank operational groups (loans, deposits, investments, income, expenses, share capital)
            bool isNonBankGroup = groupName.Contains("कर्ज") || groupLower.Contains("loan")
                || groupName.Contains("गुंतवणूक") || groupLower.Contains("investment")
                || groupName.Contains("मुदत") || groupName.Contains("आवर्ती") || groupName.Contains("पिग्मी") || groupName.Contains("बचत ठेव")
                || groupLower.Contains("deposit")
                || groupName.Contains("व्याज") || groupLower.Contains("interest")
                || groupName.Contains("भांडवल") || groupLower.Contains("capital") || groupLower.Contains("share")
                || groupName.Contains("उत्पन्न") || groupLower.Contains("income")
                || groupName.Contains("खर्च") || groupLower.Contains("expense");

            if (isNonBankGroup)
                return false;

            bool groupHasBank = groupName.Contains("बँक") || groupLower.Contains("bank")
                || groupName.Contains("चालू खात") || groupLower.Contains("current account")
                || groupLower.Contains("overdraft") || groupLower.Contains("od/cc") || groupLower.Contains("dccb");
            bool groupHasCash = groupName.Contains("रोख") || groupLower.Contains("cash");

            if (groupHasBank && !groupHasCash)
                return true;

            if (groupHasBank && groupHasCash)
            {
                bool ledgerHasBank = ledgerName.Contains("बँक") || ledgerLower.Contains("bank")
                    || ledgerLower.Contains("dccb") || ledgerLower.Contains("sbi")
                    || ledgerLower.Contains("hdfc") || ledgerLower.Contains("icici")
                    || ledgerLower.Contains("axis") || ledgerLower.Contains("maharashtra")
                    || ledgerName.Contains("चालू") || ledgerLower.Contains("current")
                    || ledgerLower.Contains("od") || ledgerLower.Contains("cc");
                bool ledgerHasCash = ledgerName.Contains("रोख") || ledgerName.Contains("हात") || ledgerLower.Contains("cash");
                return ledgerHasBank && !ledgerHasCash;
            }

            return false;
        }

        public static bool IsBankPaymentMode(string? paymentMode)
        {
            if (string.IsNullOrWhiteSpace(paymentMode))
                return false;

            var normalized = paymentMode.Trim();
            return string.Equals(normalized, "Bank", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalized, "Bank Account", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalized, "BankTransfer", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalized, "Bank Transfer", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalized, "BANK_TRANSFER", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalized, "Cheque", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalized, "Online", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalized, "UPI", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalized, "NEFT", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalized, "RTGS", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalized, "IMPS", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalized, "DD", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalized, "Demand Draft", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalized, "DEMAND_DRAFT", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalized, "Card", StringComparison.OrdinalIgnoreCase);
        }

        public static async Task<(bool IsValid, int LedgerId, Ledger? Ledger, string? ErrorMessage)> ValidateBankLedgerAsync(
            AppDbContext context,
            int? bankLedgerId)
        {
            if (!bankLedgerId.HasValue || bankLedgerId.Value <= 0)
            {
                return (false, 0, null, "बँक / चेक / ऑनलाईन व्यवहारासाठी बँक जी.एल. खाते (Bank GL Account) निवडणे बंधनकारक आहे.");
            }

            var ledger = await context.Ledgers
                .Include(l => l.AccountGroup)
                .FirstOrDefaultAsync(l => l.LedgerID == bankLedgerId.Value);

            if (ledger == null)
            {
                return (false, 0, null, $"निवडलेले बँक जी.एल. खाते (ID: {bankLedgerId.Value}) सापडले नाही.");
            }

            if (!ledger.IsActive)
            {
                return (false, 0, ledger, $"निवडलेले बँक जी.एल. खाते '{ledger.LedgerName}' निष्क्रिय (Inactive) आहे.");
            }

            if (!IsBankLedger(ledger))
            {
                return (false, 0, ledger, $"निवडलेले खाते '{ledger.LedgerName}' हे वैध बँक जी.एल. खाते (Bank Account) नाही. कृपया लेजर मास्टरमधील बँक खाते निवडा.");
            }

            return (true, ledger.LedgerID, ledger, null);
        }
    }
}
