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
        /// <summary>
        /// Resolves the specific cash ledger ID for a given branch and module.
        /// Priority:
        /// 1. Branch.DefaultCashLedgerID (Configured directly on Branch Master)
        /// 2. If Head Office / मुख्य शाखा, Main Head Office Cash Ledger (हातातील रोख शिल्लक without other branch names)
        /// 3. Branch Name matching Cash Ledger (e.g., "Cash Pune" / "हातावरील रोख शिल्लक (ढंबावडे शाखा)")
        /// 4. General Cash Ledger (AccountGroup Cash / "हातातील रोख शिल्लक")
        /// </summary>
        public static async Task<int> GetCashLedgerIdAsync(AppDbContext context, int? branchId, string module = "GENERAL")
        {
            if (branchId.HasValue && branchId.Value > 0)
            {
                var branch = await context.Branches
                    .FirstOrDefaultAsync(b => b.BranchID == branchId.Value);

                if (branch != null)
                {
                    // 1. Explicitly mapped DefaultCashLedgerID on the branch (Highest Priority)
                    if (branch.DefaultCashLedgerID.HasValue && branch.DefaultCashLedgerID.Value > 0)
                    {
                        return branch.DefaultCashLedgerID.Value;
                    }

                    bool isHeadOffice = string.Equals(branch.BranchType, "HeadOffice", StringComparison.OrdinalIgnoreCase) ||
                                       branch.BranchID == 1 ||
                                       (!string.IsNullOrEmpty(branch.BranchName) && branch.BranchName.Contains("मुख्य"));

                    // 2. If branch is Head Office / मुख्य शाखा, find head office main cash ledger
                    if (isHeadOffice)
                    {
                        var mainNamedCash = await context.Ledgers
                            .Where(l => 
                                (l.LedgerName.Contains("मेन") || 
                                 l.LedgerName.Contains("मुख्य") || 
                                 l.LedgerName.ToLower().Contains("main") || 
                                 l.LedgerName.ToLower().Contains("head office") || 
                                 l.LedgerName.ToLower().Contains("h.o")) &&
                                (l.LedgerName.Contains("रोख") || 
                                 l.LedgerName.Contains("हात") || 
                                 l.LedgerName.ToLower().Contains("cash") || 
                                 l.AccountType == "Cash In Hand" ||
                                 l.AccountType == "Cash"))
                            .OrderBy(l => l.LedgerID)
                            .FirstOrDefaultAsync();

                        if (mainNamedCash != null)
                        {
                            branch.DefaultCashLedgerID = mainNamedCash.LedgerID;
                            try { await context.SaveChangesAsync(); } catch { }
                            return mainNamedCash.LedgerID;
                        }

                        var mainCash = await context.Ledgers
                            .Where(l => 
                                (l.LedgerName.Contains("हातातील रोख शिल्लक") || 
                                 l.LedgerName.Contains("हातावरील रोख शिल्लक") || 
                                 l.LedgerName == "रोख खाते" || 
                                 l.LedgerName.ToLower() == "cash in hand") &&
                                !l.LedgerName.Contains("शाखा") &&
                                !l.LedgerName.Contains("ब्रांच"))
                            .OrderBy(l => l.LedgerID)
                            .FirstOrDefaultAsync();

                        if (mainCash != null)
                        {
                            branch.DefaultCashLedgerID = mainCash.LedgerID;
                            try { await context.SaveChangesAsync(); } catch { }
                            return mainCash.LedgerID;
                        }
                    }
                    else
                    {
                        // 3. For sub-branches, find exact branch-specific cash ledger
                        if (!string.IsNullOrWhiteSpace(branch.BranchName))
                        {
                            var cleanBranchName = branch.BranchName.Replace("शाखा", "").Replace("ब्रांच", "").Replace("कार्यालय", "").Trim();
                            if (!string.IsNullOrEmpty(cleanBranchName))
                            {
                                var branchCashLedger = await context.Ledgers
                                    .FirstOrDefaultAsync(l => 
                                        (l.LedgerName.Contains(cleanBranchName) || (!string.IsNullOrEmpty(branch.BranchCode) && l.LedgerName.Contains(branch.BranchCode))) &&
                                        (l.LedgerName.Contains("रोख") || l.LedgerName.Contains("हात") || l.LedgerName.ToLower().Contains("cash") || l.AccountType == "Cash In Hand" || l.AccountType == "Cash"));

                                if (branchCashLedger != null)
                                {
                                    branch.DefaultCashLedgerID = branchCashLedger.LedgerID;
                                    try { await context.SaveChangesAsync(); } catch { }
                                    return branchCashLedger.LedgerID;
                                }
                            }
                        }

                        // Strict Core Banking Rule: Do not silently post sub-branch money into Head Office cash!
                        // If no dedicated cash ledger exists, throw a clear business exception
                        throw new InvalidOperationException($"शाखा '{branch.BranchName}' (ID: {branch.BranchID}) साठी अधिकृत रोख खाते (Default Cash Ledger) निश्चित केलेले नाही. कृपया शाखा मास्टरमध्ये जाऊन रोख खाते सेट करा.");
                    }
                }
            }

            // 4. Default fallback for General Head Office operations
            var defaultCashLedger = await context.Ledgers
                .Where(l => 
                    (l.LedgerName.Contains("हातातील रोख शिल्लक") ||
                    l.LedgerName.Contains("हातावरील रोख शिल्लक") ||
                    l.LedgerName.Contains("रोख शिल्लक") ||
                    l.LedgerName.Contains("५१ हातातील") ||
                    l.AccountType == "Cash In Hand" ||
                    l.AccountType == "Cash") &&
                    !l.LedgerName.Contains("शाखा") &&
                    !l.LedgerName.Contains("ब्रांच"))
                .OrderBy(l => l.LedgerID)
                .FirstOrDefaultAsync();

            if (defaultCashLedger != null)
            {
                return defaultCashLedger.LedgerID;
            }

            var anyCash = await context.Ledgers
                .Where(l => l.AccountType == "Cash In Hand" || l.AccountType == "Cash" || l.LedgerName.Contains("रोख") || l.LedgerName.Contains("हात"))
                .OrderBy(l => l.LedgerID)
                .FirstOrDefaultAsync();

            return anyCash?.LedgerID ?? 1;
        }

        /// <summary>
        /// Returns all relevant Cash Ledger IDs. If branchId is provided, returns the branch's cash ledger(s).
        /// </summary>
        public static async Task<HashSet<int>> GetCashLedgerIdsForBranchAsync(AppDbContext context, int? branchId)
        {
            var ledgers = await context.Ledgers.AsNoTracking().Include(l => l.AccountGroup).ToListAsync();

            if (branchId.HasValue && branchId.Value > 0)
            {
                var branch = await context.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.BranchID == branchId.Value);
                if (branch?.DefaultCashLedgerID.HasValue == true && branch.DefaultCashLedgerID.Value > 0)
                {
                    return new HashSet<int> { branch.DefaultCashLedgerID.Value };
                }

                // If branch is Head Office, filter out other branch cash ledgers
                bool isHeadOffice = branch != null && (string.Equals(branch.BranchType, "HeadOffice", StringComparison.OrdinalIgnoreCase) || branch.BranchID == 1 || (!string.IsNullOrEmpty(branch.BranchName) && (branch.BranchName.Contains("मुख्य") || branch.BranchName.Contains("Main"))));
                if (isHeadOffice)
                {
                    // 1. Explicitly named Main / Head Office cash ledger (e.g., "हाता. रोख शिल्लक मेन शाखा", "मुख्य")
                    var hoNamedCashIds = ledgers
                        .Where(l => 
                            (l.LedgerName.Contains("मेन") || 
                             l.LedgerName.Contains("मुख्य") || 
                             l.LedgerName.ToLower().Contains("main") || 
                             l.LedgerName.ToLower().Contains("head office") || 
                             l.LedgerName.ToLower().Contains("h.o")) &&
                            (l.LedgerName.Contains("रोख") || 
                             l.LedgerName.Contains("हात") || 
                             l.LedgerName.ToLower().Contains("cash") || 
                             l.AccountType == "Cash" || 
                             l.AccountType == "Cash In Hand" || 
                             (l.AccountType != null && l.AccountType.Contains("Cash"))))
                        .Select(l => l.LedgerID)
                        .ToHashSet();

                    if (hoNamedCashIds.Any())
                    {
                        return hoNamedCashIds;
                    }

                    // 2. Non-branch specific cash ledgers
                    var hoCashIds = ledgers
                        .Where(l => 
                            (l.LedgerName.Contains("हातातील रोख शिल्लक") || 
                             l.LedgerName.Contains("हातावरील रोख शिल्लक") || 
                             l.LedgerName == "रोख खाते" || 
                             l.LedgerName.ToLower() == "cash" ||
                             l.LedgerName.ToLower() == "cash in hand" ||
                             l.AccountType == "Cash") &&
                            !l.LedgerName.Contains("शाखा") &&
                            !l.LedgerName.Contains("ब्रांच"))
                        .Select(l => l.LedgerID)
                        .ToHashSet();

                    if (hoCashIds.Any())
                    {
                        return hoCashIds;
                    }
                }

                // If branch has a specific name, find matching cash ledgers
                if (branch != null && !string.IsNullOrWhiteSpace(branch.BranchName))
                {
                    var cleanName = branch.BranchName.Replace("शाखा", "").Replace("ब्रांच", "").Replace("कार्यालय", "").Trim();
                    var branchSpecificIds = ledgers
                        .Where(l => 
                            (!string.IsNullOrEmpty(cleanName) && l.LedgerName.Contains(cleanName) || (!string.IsNullOrEmpty(branch.BranchCode) && l.LedgerName.Contains(branch.BranchCode))) &&
                            (l.LedgerName.Contains("रोख") || l.LedgerName.Contains("हात") || l.LedgerName.ToLower().Contains("cash") || l.AccountType == "Cash" || l.AccountType == "Cash In Hand" || (l.AccountType != null && l.AccountType.Contains("Cash"))))
                        .Select(l => l.LedgerID)
                        .ToHashSet();

                    if (branchSpecificIds.Any())
                    {
                        return branchSpecificIds;
                    }
                }
            }

            // Return all cash ledgers
            return ledgers
                .Where(l => 
                    l.LedgerName.Contains("हातातील रोख शिल्लक") || 
                    l.LedgerName.Contains("हातावरील रोख शिल्लक") || 
                    l.LedgerName.Contains("रोख शिल्लक") || 
                    l.LedgerName.Contains("हातातील") || 
                    l.LedgerName.Contains("हातावरील") || 
                    l.LedgerName.Contains("रोख") || 
                    l.LedgerName.ToLower().Contains("cash") ||
                    l.AccountType == "Cash" ||
                    l.AccountType == "Cash In Hand" ||
                    (l.AccountType != null && l.AccountType.Contains("Cash")) ||
                    (l.AccountGroup != null && (
                        l.AccountGroup.GroupName.Contains("Cash") || 
                        l.AccountGroup.GroupName.Contains("रोख") ||
                        l.AccountGroup.GroupName.Contains("हातातील") ||
                        l.AccountGroup.GroupName.Contains("हातावरील")
                    ))
                )
                .Select(l => l.LedgerID)
                .ToHashSet();
        }
    }
}
