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
    /// Centralized, 100% dynamic resolver for Customer Saving Deposit Liability GL Ledgers.
    /// Strictly uses Foreign Keys (SavingAccountMaster.LedgerID, SavingInterestSetting.SavingLiabilityLedgerID,
    /// SavingVoucherMappings) and structural Chart-of-Accounts metadata (NatureOfGroup == Liabilities).
    /// Zero hardcoded ledger names and zero magic LedgerID fallbacks.
    /// </summary>
    public static class SavingLedgerHelper
    {
        private static readonly HashSet<string> DisallowedAccountTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "Cash",
            "Cash In Hand",
            "Bank",
            "Bank Account",
            "Bank OD",
            "Bank OCC",
            "IBT",
            "Asset",
            "Assets",
            "Income",
            "Revenue",
            "Expense",
            "Expenses"
        };

        private static readonly HashSet<string> AllowedLiabilityNatures = new(StringComparer.OrdinalIgnoreCase)
        {
            "Liabilities",
            "Liability"
        };

        private static readonly HashSet<string> DisallowedNatures = new(StringComparer.OrdinalIgnoreCase)
        {
            "Assets",
            "Asset",
            "Income",
            "Revenue",
            "Expenses",
            "Expense"
        };

        public static string GetMissingMappingErrorMessage(string? accountNo = null)
        {
            if (!string.IsNullOrWhiteSpace(accountNo))
            {
                return $"निवडलेल्या बचत खात्यास (#{accountNo}) किंवा बचत ठेव योजनेला वैध 'बचत ठेव देयता लेजर' (Saving Liability Ledger) जोडलेले नाही. कृपया 'बचत ठेव योजना व व्याजदर सेटिंग' मध्ये लेजर मॅपिंग पूर्ण करा.";
            }

            return "बचत खात्यास किंवा बचत ठेव योजनेला वैध 'बचत ठेव देयता लेजर' (Saving Liability Ledger) जोडलेले नाही. कृपया 'बचत ठेव योजना व व्याजदर सेटिंग' मध्ये लेजर मॅपिंग पूर्ण करा.";
        }

        /// <summary>
        /// Structurally validates that a Ledger is a genuine Liability ledger and NOT a Cash, Bank, IBT, Asset, Income, or Expense ledger.
        /// Never inspects hardcoded Marathi/English ledger names.
        /// </summary>
        public static bool IsValidSavingLiabilityLedger(Ledger? ledger, HashSet<int>? branchCashOrIbtLedgerIds = null)
        {
            if (ledger == null || ledger.LedgerID <= 0)
            {
                return false;
            }

            if (branchCashOrIbtLedgerIds != null && branchCashOrIbtLedgerIds.Contains(ledger.LedgerID))
            {
                return false;
            }

            string accountType = (ledger.AccountType ?? string.Empty).Trim();
            if (!string.IsNullOrEmpty(accountType) && DisallowedAccountTypes.Contains(accountType))
            {
                return false;
            }

            string nature = (ledger.AccountGroup?.NatureOfGroup ?? string.Empty).Trim();
            if (!string.IsNullOrEmpty(nature))
            {
                if (DisallowedNatures.Contains(nature))
                {
                    return false;
                }

                return AllowedLiabilityNatures.Contains(nature);
            }

            // Fallback structural check only when AccountGroup navigation has blank NatureOfGroup
            return string.Equals((ledger.OpeningBalanceType ?? string.Empty).Trim(), "Cr", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Attempts to resolve a valid Saving Deposit Liability Ledger ID dynamically via Foreign Keys.
        /// Returns 0 if no valid Liability Ledger is configured.
        /// </summary>
        public static async Task<int> TryResolveSavingLiabilityLedgerIdAsync(
            AppDbContext context,
            SavingAccountMaster? savingAccount = null,
            int? explicitLedgerId = null,
            int? explicitSchemeId = null,
            Dictionary<int, Ledger>? preloadedLedgers = null)
        {
            var branchProtectedIds = await GetBranchCashAndIbtLedgerIdsAsync(context);
            var localCache = new Dictionary<int, Ledger?>();

            async Task<bool> IsCandidateValidAsync(int? candidateId)
            {
                if (!candidateId.HasValue || candidateId.Value <= 0)
                {
                    return false;
                }

                int id = candidateId.Value;
                if (branchProtectedIds.Contains(id))
                {
                    return false;
                }

                if (!localCache.TryGetValue(id, out var ledger))
                {
                    if (preloadedLedgers != null &&
                        preloadedLedgers.TryGetValue(id, out var preloaded) &&
                        preloaded.AccountGroup != null)
                    {
                        ledger = preloaded;
                    }
                    else
                    {
                        ledger = await context.Ledgers
                            .AsNoTracking()
                            .Include(l => l.AccountGroup)
                            .FirstOrDefaultAsync(l => l.LedgerID == id);
                    }

                    localCache[id] = ledger;
                }

                return IsValidSavingLiabilityLedger(ledger, branchProtectedIds);
            }

            int resolvedId = 0;

            // 1. Explicit LedgerID argument (e.g. chosen in Account Creation / Import UI)
            if (explicitLedgerId.HasValue && explicitLedgerId.Value > 0 && await IsCandidateValidAsync(explicitLedgerId))
            {
                resolvedId = explicitLedgerId.Value;
            }

            // 2. Saving Account's own mapped LedgerID FK
            if (resolvedId == 0 && savingAccount != null && savingAccount.LedgerID > 0 && await IsCandidateValidAsync(savingAccount.LedgerID))
            {
                resolvedId = savingAccount.LedgerID;
            }

            // 3. Explicit Scheme FK or Saving Account's Linked SavingScheme FK
            if (resolvedId == 0)
            {
                SavingInterestSetting? linkedScheme = null;

                if (explicitSchemeId.HasValue && explicitSchemeId.Value > 0)
                {
                    linkedScheme = await context.SavingInterestSettings
                        .AsNoTracking()
                        .FirstOrDefaultAsync(s => s.SettingID == explicitSchemeId.Value);
                }
                else if (savingAccount != null)
                {
                    if (savingAccount.SavingScheme != null)
                    {
                        linkedScheme = savingAccount.SavingScheme;
                    }
                    else if (savingAccount.SavingSchemeID.HasValue && savingAccount.SavingSchemeID.Value > 0)
                    {
                        linkedScheme = await context.SavingInterestSettings
                            .AsNoTracking()
                            .FirstOrDefaultAsync(s => s.SettingID == savingAccount.SavingSchemeID.Value);
                    }
                }

                if (linkedScheme != null)
                {
                    if (await IsCandidateValidAsync(linkedScheme.SavingLiabilityLedgerID))
                    {
                        resolvedId = linkedScheme.SavingLiabilityLedgerID!.Value;
                    }
                    else if (await IsCandidateValidAsync(linkedScheme.LedgerID))
                    {
                        resolvedId = linkedScheme.LedgerID!.Value;
                    }
                }
            }

            // 4. Active / Latest Saving Scheme Master (SavingInterestSettings)
            if (resolvedId == 0)
            {
                var today = DateTime.Today;
                var allSchemes = await context.SavingInterestSettings
                    .AsNoTracking()
                    .OrderByDescending(s => s.EffectiveDate <= today)
                    .ThenByDescending(s => s.EffectiveDate)
                    .ThenByDescending(s => s.SettingID)
                    .ToListAsync();

                foreach (var scheme in allSchemes)
                {
                    if (await IsCandidateValidAsync(scheme.SavingLiabilityLedgerID))
                    {
                        resolvedId = scheme.SavingLiabilityLedgerID!.Value;
                        break;
                    }

                    if (await IsCandidateValidAsync(scheme.LedgerID))
                    {
                        resolvedId = scheme.LedgerID!.Value;
                        break;
                    }
                }
            }

            // 5. Dynamic Voucher Mapping Tables (SavingVoucherMappings / VoucherMappings)
            if (resolvedId == 0)
            {
                var savingMappings = await context.SavingVoucherMappings
                    .AsNoTracking()
                    .Where(m => m.OperationType == "SavingControl" ||
                                m.OperationType == "SavingLiability" ||
                                m.OperationType == "Deposit")
                    .OrderBy(m => m.MappingID)
                    .ToListAsync();

                foreach (var mapping in savingMappings)
                {
                    if (await IsCandidateValidAsync(mapping.LedgerID))
                    {
                        resolvedId = mapping.LedgerID;
                        break;
                    }
                }
            }

            if (resolvedId == 0)
            {
                var generalMappings = await context.VoucherMappings
                    .AsNoTracking()
                    .Where(m => m.TransactionType == "Saving Deposit" ||
                                m.TransactionType == "SavingControl")
                    .OrderBy(m => m.MappingID)
                    .ToListAsync();

                foreach (var mapping in generalMappings)
                {
                    if (await IsCandidateValidAsync(mapping.CreditLedgerID))
                    {
                        resolvedId = mapping.CreditLedgerID!.Value;
                        break;
                    }

                    if (await IsCandidateValidAsync(mapping.DebitLedgerID))
                    {
                        resolvedId = mapping.DebitLedgerID!.Value;
                        break;
                    }
                }
            }

            // Self-heal invalid or uninitialized LedgerID on the SavingAccountMaster instance in memory
            if (resolvedId > 0 && savingAccount != null && savingAccount.LedgerID != resolvedId)
            {
                if (savingAccount.LedgerID <= 0 || !await IsCandidateValidAsync(savingAccount.LedgerID))
                {
                    savingAccount.LedgerID = resolvedId;
                }
            }

            return resolvedId;
        }

        /// <summary>
        /// Resolves the Saving Deposit Liability Ledger ID dynamically or throws an actionable Marathi InvalidOperationException.
        /// </summary>
        public static async Task<int> ResolveSavingLiabilityLedgerIdAsync(
            AppDbContext context,
            SavingAccountMaster? savingAccount = null,
            int? explicitLedgerId = null,
            int? explicitSchemeId = null,
            Dictionary<int, Ledger>? preloadedLedgers = null)
        {
            int resolvedId = await TryResolveSavingLiabilityLedgerIdAsync(
                context,
                savingAccount,
                explicitLedgerId,
                explicitSchemeId,
                preloadedLedgers);

            if (resolvedId <= 0)
            {
                throw new InvalidOperationException(GetMissingMappingErrorMessage(savingAccount?.AccountNo));
            }

            return resolvedId;
        }

        /// <summary>
        /// Checks whether a given LedgerID is a configured Saving Deposit Liability Ledger without using hardcoded ledger names.
        /// </summary>
        public static async Task<bool> IsConfiguredSavingLiabilityLedgerAsync(AppDbContext context, int ledgerId)
        {
            if (ledgerId <= 0)
            {
                return false;
            }

            var branchProtectedIds = await GetBranchCashAndIbtLedgerIdsAsync(context);
            var ledger = await context.Ledgers
                .AsNoTracking()
                .Include(l => l.AccountGroup)
                .FirstOrDefaultAsync(l => l.LedgerID == ledgerId);

            if (!IsValidSavingLiabilityLedger(ledger, branchProtectedIds))
            {
                return false;
            }

            if (string.Equals((ledger!.AccountType ?? string.Empty).Trim(), "Savings", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            bool mappedInScheme = await context.SavingInterestSettings
                .AsNoTracking()
                .AnyAsync(s => s.SavingLiabilityLedgerID == ledgerId || s.LedgerID == ledgerId);
            if (mappedInScheme)
            {
                return true;
            }

            bool mappedInVoucherMappings = await context.SavingVoucherMappings
                .AsNoTracking()
                .AnyAsync(m => (m.OperationType == "SavingControl" || m.OperationType == "SavingLiability" || m.OperationType == "Deposit") &&
                               m.LedgerID == ledgerId);
            if (mappedInVoucherMappings)
            {
                return true;
            }

            return await context.SavingAccountMasters
                .AsNoTracking()
                .AnyAsync(s => s.LedgerID == ledgerId);
        }

        /// <summary>
        /// Dynamically resolves the SavingInterestSetting (बचत व्याजदर योजना) linked to a SavingAccountMaster
        /// or explicit SchemeID / LedgerID.
        /// </summary>
        public static async Task<SavingInterestSetting?> ResolveSavingSchemeAsync(
            AppDbContext context,
            SavingAccountMaster? savingAccount = null,
            int? explicitSchemeId = null,
            int? explicitLedgerId = null,
            List<SavingInterestSetting>? preloadedSchemes = null)
        {
            var today = DateTime.Today;
            var schemes = preloadedSchemes ?? await context.SavingInterestSettings
                .AsNoTracking()
                .OrderByDescending(s => s.EffectiveDate <= today)
                .ThenByDescending(s => s.EffectiveDate)
                .ThenByDescending(s => s.SettingID)
                .ToListAsync();

            if (schemes.Count == 0)
            {
                return null;
            }

            if (explicitSchemeId.HasValue && explicitSchemeId.Value > 0)
            {
                var byExplicitId = schemes.FirstOrDefault(s => s.SettingID == explicitSchemeId.Value);
                if (byExplicitId != null) return byExplicitId;
            }

            if (savingAccount != null)
            {
                if (savingAccount.SavingScheme != null)
                {
                    return savingAccount.SavingScheme;
                }

                if (savingAccount.SavingSchemeID.HasValue && savingAccount.SavingSchemeID.Value > 0)
                {
                    var byAccSchemeId = schemes.FirstOrDefault(s => s.SettingID == savingAccount.SavingSchemeID.Value);
                    if (byAccSchemeId != null) return byAccSchemeId;
                }
            }

            int targetLedgerId = explicitLedgerId.HasValue && explicitLedgerId.Value > 0
                ? explicitLedgerId.Value
                : (savingAccount?.LedgerID ?? 0);

            if (targetLedgerId > 0)
            {
                var byLiabilityLedger = schemes.FirstOrDefault(s => s.SavingLiabilityLedgerID == targetLedgerId);
                if (byLiabilityLedger != null) return byLiabilityLedger;

                var byPrimaryLedger = schemes.FirstOrDefault(s => s.LedgerID == targetLedgerId);
                if (byPrimaryLedger != null) return byPrimaryLedger;
            }

            if (savingAccount != null)
            {
                var byInterestRate = schemes.FirstOrDefault(s => s.InterestRate == savingAccount.InterestRate);
                if (byInterestRate != null) return byInterestRate;
            }

            // If only a single saving scheme exists in the institution, fall back to it
            if (schemes.Count == 1)
            {
                return schemes[0];
            }

            return null;
        }

        /// <summary>
        /// Resolves the effective Minimum Balance (किमान शिल्लक मर्यादा) for a Saving Account.
        /// Supports ₹0 (Zero-Balance accounts) as well as any positive configured amount.
        /// Always prioritizes the linked Saving Scheme's live MinimumBalance policy when resolved.
        /// </summary>
        public static decimal ResolveEffectiveMinimumBalance(
            SavingAccountMaster? savingAccount,
            SavingInterestSetting? resolvedScheme)
        {
            if (resolvedScheme != null)
            {
                return Math.Max(0m, resolvedScheme.MinimumBalance);
            }

            if (savingAccount == null)
            {
                return 0m;
            }

            return Math.Max(0m, savingAccount.MinimumBalance);
        }

        /// <summary>
        /// Async convenience overload to resolve the effective Minimum Balance for a Saving Account from DB.
        /// </summary>
        public static async Task<decimal> ResolveEffectiveMinimumBalanceAsync(
            AppDbContext context,
            SavingAccountMaster? savingAccount,
            List<SavingInterestSetting>? preloadedSchemes = null)
        {
            if (savingAccount == null)
            {
                return 0m;
            }

            var scheme = await ResolveSavingSchemeAsync(
                context,
                savingAccount: savingAccount,
                preloadedSchemes: preloadedSchemes);

            return ResolveEffectiveMinimumBalance(savingAccount, scheme);
        }

        /// <summary>
        /// Calculates the net withdrawable / transferable balance of a Saving Account after deducting LienAmount and effective MinimumBalance.
        /// </summary>
        public static async Task<(decimal AvailableBalance, decimal EffectiveMinimumBalance)> ResolveAvailableBalanceAsync(
            AppDbContext context,
            SavingAccountMaster savingAccount,
            List<SavingInterestSetting>? preloadedSchemes = null)
        {
            decimal effectiveMin = await ResolveEffectiveMinimumBalanceAsync(context, savingAccount, preloadedSchemes);
            decimal available = Math.Max(0m, savingAccount.CurrentBalance - savingAccount.LienAmount - effectiveMin);
            return (available, effectiveMin);
        }

        private static async Task<HashSet<int>> GetBranchCashAndIbtLedgerIdsAsync(AppDbContext context)
        {
            var protectedIds = new HashSet<int>();
            var branchLedgers = await context.Branches
                .AsNoTracking()
                .Select(b => new { b.DefaultCashLedgerID, b.DefaultIbtLedgerID })
                .ToListAsync();

            foreach (var b in branchLedgers)
            {
                if (b.DefaultCashLedgerID.HasValue && b.DefaultCashLedgerID.Value > 0)
                {
                    protectedIds.Add(b.DefaultCashLedgerID.Value);
                }

                if (b.DefaultIbtLedgerID.HasValue && b.DefaultIbtLedgerID.Value > 0)
                {
                    protectedIds.Add(b.DefaultIbtLedgerID.Value);
                }
            }

            return protectedIds;
        }
    }
}

