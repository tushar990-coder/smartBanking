using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Helpers
{
    public static class BankLedgerHelper
    {
        public static bool IsBankPaymentMode(string? paymentMode)
        {
            if (string.IsNullOrWhiteSpace(paymentMode)) return false;
            var mode = paymentMode.Trim();
            return mode.Equals("Bank", StringComparison.OrdinalIgnoreCase) ||
                   mode.Equals("Bank Account", StringComparison.OrdinalIgnoreCase) ||
                   mode.Equals("BankTransfer", StringComparison.OrdinalIgnoreCase) ||
                   mode.Equals("BANK_TRANSFER", StringComparison.OrdinalIgnoreCase) ||
                   mode.Equals("Cheque", StringComparison.OrdinalIgnoreCase) ||
                   mode.Equals("Online", StringComparison.OrdinalIgnoreCase) ||
                   mode.Equals("UPI", StringComparison.OrdinalIgnoreCase) ||
                   mode.Equals("NEFT", StringComparison.OrdinalIgnoreCase) ||
                   mode.Equals("RTGS", StringComparison.OrdinalIgnoreCase);
        }

        public static bool IsBankAccountType(string? accountType)
        {
            if (string.IsNullOrWhiteSpace(accountType)) return false;
            var t = accountType.Trim();
            return t.Equals("Bank Account", StringComparison.OrdinalIgnoreCase) ||
                   t.Equals("Bank", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Validates that a valid, active Bank Account GL Ledger was selected when PaymentMode is a Bank mode.
        /// Never silently falls back to Cash!
        /// </summary>
        public static async Task<(bool IsValid, int LedgerId, string? ErrorMessage, Ledger? Ledger)> ValidateBankLedgerAsync(
            AppDbContext context,
            int? bankLedgerId)
        {
            if (!bankLedgerId.HasValue || bankLedgerId.Value <= 0)
            {
                return (false, 0, "बँक व्यवहारासाठी बँक जी.एल. खाते (Bank GL Account) निवडणे बंधनकारक आहे.", null);
            }

            var ledger = await context.Ledgers
                .AsNoTracking()
                .FirstOrDefaultAsync(l => l.LedgerID == bankLedgerId.Value);

            if (ledger == null)
            {
                return (false, 0, $"निवडलेले बँक जी.एल. खाते (खाते क्र. {bankLedgerId.Value}) प्रणालीत आढळले नाही.", null);
            }

            if (!ledger.IsActive)
            {
                return (false, 0, $"निवडलेले बँक जी.एल. खाते ({ledger.LedgerID} - {ledger.LedgerName}) निष्क्रिय (Inactive) आहे.", null);
            }

            if (!IsBankAccountType(ledger.AccountType))
            {
                return (false, 0, $"निवडलेले खाते ({ledger.LedgerID} - {ledger.LedgerName}) 'Bank Account' प्रकारचे नाही. कृपया खाते माहितीमध्ये (Ledger Master) खाते प्रकार = Bank Account निवडा.", null);
            }

            return (true, ledger.LedgerID, null, ledger);
        }
    }
}

