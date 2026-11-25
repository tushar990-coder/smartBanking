using System;
using System.Collections.Generic;
using System.Linq;
using Bhisi.Api.Models;

namespace Bhisi.Api.Helpers
{
    /// <summary>
    /// Shared helpers for FD Khatavani (MemberLedger) chronological ordering,
    /// legacy opening cutover date resolution, and principal/interest opening split.
    /// </summary>
    public static class FdLedgerHelper
    {
        public static bool IsInterestTransaction(string? transactionType, string? voucherNo)
        {
            string tt = (transactionType ?? string.Empty).Trim().ToLowerInvariant();
            string vn = (voucherNo ?? string.Empty).Trim().ToUpperInvariant();

            return tt == "accrual"
                || tt == "closure_interest"
                || tt == "interest_capitalized"
                || vn == "LEG-INT-MIG";
        }

        public static bool IsClosureInterestTransaction(string? transactionType)
        {
            string tt = (transactionType ?? string.Empty).Trim().ToLowerInvariant();
            return tt == "closure_interest";
        }

        /// <summary>
        /// Deterministic same-date ordering for FD Khatavani:
        /// 0 = Opening / Deposit principal Cr
        /// 1 = Accrued / Posted / Legacy Opening interest Cr (before closure)
        /// 2 = Closure / Overdue maturity interest Cr
        /// 3 = Any other Cr
        /// 4 = Payout / Closure / Renewal Dr
        /// </summary>
        public static int ResolveTransactionSortRank(string? transactionType, string? debitCredit, string? voucherNo)
        {
            string drcr = (debitCredit ?? string.Empty).Trim();
            if (string.Equals(drcr, "Dr", StringComparison.OrdinalIgnoreCase))
            {
                return 4;
            }

            string tt = (transactionType ?? string.Empty).Trim().ToLowerInvariant();
            string vn = (voucherNo ?? string.Empty).Trim().ToUpperInvariant();

            if (tt == "closure_interest")
            {
                return 2;
            }

            if (IsInterestTransaction(transactionType, voucherNo))
            {
                return 1;
            }

            if (tt == "opening"
                || tt == "deposit"
                || vn.StartsWith("JV-FD-OP-", StringComparison.Ordinal)
                || vn.StartsWith("REC-FD-", StringComparison.Ordinal))
            {
                return 0;
            }

            return 3;
        }

        /// <summary>
        /// Resolves the display date for legacy accumulated interest:
        /// prefers operator-entered LastInterestPostingDate ("शेवटची तारीख") from migration/opening
        /// whenever it is not merely overwritten by a subsequent software accrual/MIS posting;
        /// otherwise falls back to the FD OpeningDate.
        /// </summary>
        public static DateTime ResolveLegacyOpeningInterestDate(
            FdAccount acc,
            IEnumerable<FdTransaction> rawTransactions,
            IEnumerable<DateTime> accrualDates,
            IEnumerable<DateTime> misDates)
        {
            DateTime openingDate = acc.OpeningDate.Date;

            var postMigrationDates = new SortedSet<DateTime>();
            foreach (var dt in accrualDates)
            {
                postMigrationDates.Add(dt.Date);
            }
            foreach (var dt in misDates)
            {
                postMigrationDates.Add(dt.Date);
            }

            string openingVoucherNo = $"JV-FD-OP-{acc.AccountNo}";
            foreach (var tx in rawTransactions)
            {
                if (string.Equals(tx.TransactionType, "Accrual", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(tx.TransactionType, "Interest_Capitalized", StringComparison.OrdinalIgnoreCase))
                {
                    string vNo = tx.Voucher?.VoucherNo ?? string.Empty;
                    if (!string.Equals(vNo, openingVoucherNo, StringComparison.OrdinalIgnoreCase))
                    {
                        postMigrationDates.Add(tx.TransactionDate.Date);
                    }
                }
            }

            if (acc.LastInterestPostingDate.HasValue && acc.LastInterestPostingDate.Value.Date >= openingDate)
            {
                DateTime candidate = acc.LastInterestPostingDate.Value.Date;
                if (postMigrationDates.Count == 0
                    || candidate < postMigrationDates.Min
                    || !postMigrationDates.Contains(candidate))
                {
                    return candidate;
                }
            }

            var existingOpeningAccrual = rawTransactions.FirstOrDefault(t =>
                string.Equals(t.TransactionType, "Accrual", StringComparison.OrdinalIgnoreCase)
                && string.Equals(t.Voucher?.VoucherNo, openingVoucherNo, StringComparison.OrdinalIgnoreCase)
                && t.TransactionDate.Date > openingDate);

            if (existingOpeningAccrual != null
                && (postMigrationDates.Count == 0 || existingOpeningAccrual.TransactionDate.Date <= postMigrationDates.Min))
            {
                return existingOpeningAccrual.TransactionDate.Date;
            }

            return openingDate;
        }

        public static string BuildOpeningDepositNarration(FdAccount acc)
        {
            string legPart = !string.IsNullOrWhiteSpace(acc.LegacyAccountNumber)
                ? $" (जुनी पावती: {acc.LegacyAccountNumber.Trim()})"
                : string.Empty;
            return acc.IsLegacyAccount || !string.IsNullOrWhiteSpace(acc.LegacyAccountNumber)
                ? $"आरंभिक मुदत ठेव जमा{legPart}"
                : "नवीन मुदत ठेव जमा";
        }

        public static (decimal OpeningBalance, decimal OpeningPrincipalBalance, decimal OpeningInterestBalance) SplitOpeningBalances(
            IEnumerable<(string? TransactionType, string DebitCredit, decimal Amount, string? VoucherNo)> prePeriodTxs)
        {
            decimal prePrincipalCr = 0m;
            decimal preInterestCr = 0m;
            decimal preDr = 0m;

            foreach (var p in prePeriodTxs)
            {
                if (string.Equals(p.DebitCredit, "Cr", StringComparison.OrdinalIgnoreCase))
                {
                    if (IsInterestTransaction(p.TransactionType, p.VoucherNo))
                    {
                        preInterestCr += p.Amount;
                    }
                    else
                    {
                        prePrincipalCr += p.Amount;
                    }
                }
                else if (string.Equals(p.DebitCredit, "Dr", StringComparison.OrdinalIgnoreCase))
                {
                    preDr += p.Amount;
                }
            }

            decimal openingBal = Math.Round(prePrincipalCr + preInterestCr - preDr, 2);
            if (Math.Abs(openingBal) < 0.01m)
            {
                openingBal = 0m;
            }

            if (openingBal <= 0m)
            {
                return (openingBal, 0m, 0m);
            }

            decimal remInterest = Math.Max(0m, preInterestCr - preDr);
            decimal unusedDr = Math.Max(0m, preDr - preInterestCr);
            decimal remPrincipal = Math.Max(0m, prePrincipalCr - unusedDr);

            remInterest = Math.Round(remInterest, 2);
            remPrincipal = Math.Round(openingBal - remInterest, 2);
            if (remPrincipal < 0m)
            {
                remPrincipal = 0m;
                remInterest = openingBal;
            }

            return (openingBal, remPrincipal, remInterest);
        }
    }
}
