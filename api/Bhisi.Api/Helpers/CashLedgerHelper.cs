using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Helpers
{
    public static class CashLedgerHelper
    {
        private static bool IsStrictlyNotBankLedger(Ledger l)
        {
            if (l == null)
                return false;

            if (BankLedgerHelper.IsBankAccountType(l.AccountType) || BankLedgerHelper.IsBankLedger(l))
                return false;

            var name = l.LedgerName ?? string.Empty;
            var nameLower = name.ToLowerInvariant();
            bool hasBankWord = name.Contains("बँक") || nameLower.Contains("bank") || nameLower.Contains("dccb");
            if (hasBankWord && !name.Contains("हातातील") && !name.Contains("हातावरील") && !nameLower.Contains("cash in hand"))
                return false;

            return true;
        }

        private static bool IsCashCandidate(Ledger l)
        {
            if (!IsStrictlyNotBankLedger(l))
                return false;

            var name = l.LedgerName ?? string.Empty;
            var nameLower = name.ToLowerInvariant();
            var accType = (l.AccountType ?? string.Empty).Trim();

            if (string.Equals(accType, "Cash", StringComparison.OrdinalIgnoreCase)
                || string.Equals(accType, "Cash In Hand", StringComparison.OrdinalIgnoreCase)
                || (accType.Contains("Cash", StringComparison.OrdinalIgnoreCase) && !accType.Contains("Bank", StringComparison.OrdinalIgnoreCase)))
            {
                return true;
            }

            if (name.Contains("हातातील रोख शिल्लक")
                || name.Contains("हातावरील रोख शिल्लक")
                || name.Contains("हाता. रोख")
                || name.Contains("रोख शिल्लक")
                || name.Contains("हातातील")
                || name.Contains("हातावरील")
                || name.Contains("रोख")
                || nameLower.Contains("cash"))
            {
                return true;
            }

            // Only match pure Cash AccountGroup (NEVER match combined "रोख व बँक शिल्लक" / "Cash & Bank" unless ledger name/type itself is Cash!)
            if (l.AccountGroup != null)
            {
                var gName = $"{l.AccountGroup.GroupName} {l.AccountGroup.GroupNameEnglish}";
                var gLower = gName.ToLowerInvariant();
                bool groupHasCash = gName.Contains("रोख") || gName.Contains("हातातील") || gName.Contains("हातावरील") || gLower.Contains("cash");
                bool groupHasBank = gName.Contains("बँक") || gLower.Contains("bank");
                if (groupHasCash && !groupHasBank)
                {
                    return true;
                }
            }

            return false;
        }

        private static bool IsMainOrHeadOfficeCashName(Ledger l)
        {
            var name = l.LedgerName ?? string.Empty;
            var nameLower = name.ToLowerInvariant();
            return name.Contains("मेन")
                || name.Contains("मुख्य")
                || nameLower.Contains("main")
                || nameLower.Contains("head office")
                || nameLower.Contains("h.o");
        }

        /// <summary>
        /// Resolves the specific cash ledger ID for a given branch and module without calling SaveChangesAsync mid-transaction.
        /// Priority:
        /// 1. Branch.DefaultCashLedgerID (Configured directly on Branch Master, verified not to be a Bank ledger)
        /// 2. If Head Office / मुख्य शाखा, Main Head Office Cash Ledger
        /// 3. Branch Name / Code matching Cash Ledger (e.g., "हातावरील रोख शिल्लक (ढंबावडे शाखा)")
        /// 4. Shared General Cash Ledger (only if no other sub-branch cash ledgers exist; otherwise throws clear Marathi error)
        /// </summary>
        public static async Task<int> GetCashLedgerIdAsync(AppDbContext context, int? branchId, string module = "GENERAL")
        {
            var ledgers = await context.Ledgers
                .AsNoTracking()
                .Include(l => l.AccountGroup)
                .OrderBy(l => l.LedgerID)
                .ToListAsync();

            var cashLedgers = ledgers.Where(IsCashCandidate).ToList();

            if (branchId.HasValue && branchId.Value > 0)
            {
                var branch = await context.Branches
                    .AsNoTracking()
                    .FirstOrDefaultAsync(b => b.BranchID == branchId.Value);

                if (branch != null)
                {
                    // 1. Explicitly mapped DefaultCashLedgerID on the branch (Highest Priority, verified not a Bank ledger)
                    if (branch.DefaultCashLedgerID.HasValue && branch.DefaultCashLedgerID.Value > 0)
                    {
                        var mapped = ledgers.FirstOrDefault(l => l.LedgerID == branch.DefaultCashLedgerID.Value);
                        if (mapped != null && IsStrictlyNotBankLedger(mapped))
                        {
                            return mapped.LedgerID;
                        }
                    }

                    bool isHeadOffice = string.Equals(branch.BranchType, "HeadOffice", StringComparison.OrdinalIgnoreCase)
                        || branch.BranchID == 1
                        || (!string.IsNullOrEmpty(branch.BranchName) && (branch.BranchName.Contains("मुख्य") || branch.BranchName.Contains("Main", StringComparison.OrdinalIgnoreCase)));

                    // 2. If branch is Head Office / मुख्य शाखा, find head office main cash ledger
                    if (isHeadOffice)
                    {
                        var mainNamedCash = cashLedgers.FirstOrDefault(IsMainOrHeadOfficeCashName);
                        if (mainNamedCash != null)
                        {
                            return mainNamedCash.LedgerID;
                        }

                        var mainCash = cashLedgers.FirstOrDefault(l =>
                            !l.LedgerName.Contains("शाखा") &&
                            !l.LedgerName.Contains("ब्रांच"));
                        if (mainCash != null)
                        {
                            return mainCash.LedgerID;
                        }
                    }
                    else
                    {
                        // 3. For sub-branches, find exact branch-specific cash ledger
                        if (!string.IsNullOrWhiteSpace(branch.BranchName))
                        {
                            var cleanBranchName = branch.BranchName
                                .Replace("शाखा", "")
                                .Replace("ब्रांच", "")
                                .Replace("कार्यालय", "")
                                .Trim();

                            if (!string.IsNullOrEmpty(cleanBranchName) || !string.IsNullOrEmpty(branch.BranchCode))
                            {
                                var branchCashLedger = cashLedgers.FirstOrDefault(l =>
                                    (!string.IsNullOrEmpty(cleanBranchName) && l.LedgerName.Contains(cleanBranchName))
                                    || (!string.IsNullOrEmpty(branch.BranchCode) && l.LedgerName.Contains(branch.BranchCode)));

                                if (branchCashLedger != null)
                                {
                                    return branchCashLedger.LedgerID;
                                }
                            }
                        }

                        // Check if this institution uses a single shared Cash In Hand ledger (no sub-branch-named cash ledgers exist)
                        bool hasAnySubBranchCashLedgers = cashLedgers.Any(l =>
                            (l.LedgerName.Contains("शाखा") || l.LedgerName.Contains("ब्रांच")) && !IsMainOrHeadOfficeCashName(l));

                        if (!hasAnySubBranchCashLedgers)
                        {
                            var sharedCash = cashLedgers.FirstOrDefault(l => l.IsActive) ?? cashLedgers.FirstOrDefault();
                            if (sharedCash != null)
                            {
                                return sharedCash.LedgerID;
                            }
                        }

                        throw new InvalidOperationException(
                            $"शाखा '{branch.BranchName}' (ID: {branch.BranchID}) साठी अधिकृत रोख खाते (Default Cash Ledger) निश्चित केलेले नाही. कृपया शाखा मास्टरमध्ये जाऊन रोख खाते सेट करा.");
                    }
                }
            }

            // 4. Default fallback for General Head Office operations
            var defaultCashLedger = cashLedgers.FirstOrDefault(l =>
                !l.LedgerName.Contains("शाखा") &&
                !l.LedgerName.Contains("ब्रांच"));

            if (defaultCashLedger != null)
            {
                return defaultCashLedger.LedgerID;
            }

            var anyCash = cashLedgers.FirstOrDefault();
            if (anyCash != null)
            {
                return anyCash.LedgerID;
            }

            throw new InvalidOperationException("संस्थेच्या लेजर मास्टरमध्ये कोणतेही रोख खाते (Cash In Hand Ledger) सापडले नाही. कृपया प्रथम लेजर मास्टरमध्ये रोख खाते तयार करा.");
        }

        /// <summary>
        /// Returns all relevant Cash Ledger IDs (strictly excluding Bank ledgers even when grouped under 'रोख व बँक शिल्लक').
        /// </summary>
        public static async Task<HashSet<int>> GetCashLedgerIdsForBranchAsync(AppDbContext context, int? branchId)
        {
            var ledgers = await context.Ledgers
                .AsNoTracking()
                .Include(l => l.AccountGroup)
                .ToListAsync();

            var cashLedgers = ledgers.Where(IsCashCandidate).ToList();

            if (branchId.HasValue && branchId.Value > 0)
            {
                var branch = await context.Branches
                    .AsNoTracking()
                    .FirstOrDefaultAsync(b => b.BranchID == branchId.Value);

                if (branch?.DefaultCashLedgerID.HasValue == true && branch.DefaultCashLedgerID.Value > 0)
                {
                    var mapped = ledgers.FirstOrDefault(l => l.LedgerID == branch.DefaultCashLedgerID.Value);
                    if (mapped != null && IsStrictlyNotBankLedger(mapped))
                    {
                        return new HashSet<int> { mapped.LedgerID };
                    }
                }

                bool isHeadOffice = branch != null && (
                    string.Equals(branch.BranchType, "HeadOffice", StringComparison.OrdinalIgnoreCase)
                    || branch.BranchID == 1
                    || (!string.IsNullOrEmpty(branch.BranchName) && (branch.BranchName.Contains("मुख्य") || branch.BranchName.Contains("Main", StringComparison.OrdinalIgnoreCase))));

                if (isHeadOffice)
                {
                    var hoNamedCashIds = cashLedgers
                        .Where(IsMainOrHeadOfficeCashName)
                        .Select(l => l.LedgerID)
                        .ToHashSet();

                    if (hoNamedCashIds.Any())
                    {
                        return hoNamedCashIds;
                    }

                    var hoCashIds = cashLedgers
                        .Where(l => !l.LedgerName.Contains("शाखा") && !l.LedgerName.Contains("ब्रांच"))
                        .Select(l => l.LedgerID)
                        .ToHashSet();

                    if (hoCashIds.Any())
                    {
                        return hoCashIds;
                    }
                }

                if (branch != null && !string.IsNullOrWhiteSpace(branch.BranchName))
                {
                    var cleanName = branch.BranchName
                        .Replace("शाखा", "")
                        .Replace("ब्रांच", "")
                        .Replace("कार्यालय", "")
                        .Trim();

                    var branchSpecificIds = cashLedgers
                        .Where(l =>
                            (!string.IsNullOrEmpty(cleanName) && l.LedgerName.Contains(cleanName))
                            || (!string.IsNullOrEmpty(branch.BranchCode) && l.LedgerName.Contains(branch.BranchCode)))
                        .Select(l => l.LedgerID)
                        .ToHashSet();

                    if (branchSpecificIds.Any())
                    {
                        return branchSpecificIds;
                    }
                }
            }

            return cashLedgers
                .Select(l => l.LedgerID)
                .ToHashSet();
        }
    }
}
