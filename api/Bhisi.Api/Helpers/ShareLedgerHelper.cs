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
    /// Core Banking Central Helper for Share Capital & Customer Scheme Ledgers.
    /// Acts as Single Source of Truth ensuring ShareSchemeMaster ledgers
    /// drive all transactions across Share Allotment, Withdrawal, Transfer,
    /// Opening Balance, Member Closure, and Loan Disbursement deductions.
    /// </summary>
    public static class ShareLedgerHelper
    {
        /// <summary>
        /// Resolves the Share Capital (Credit/Liability) Ledger.
        /// Priority:
        /// 1. Specified or Active ShareScheme.ShareCapitalLedgerID (Primary SSOT)
        /// 2. VoucherMappings ("Share Capital" Credit Ledger)
        /// 3. Existing Ledgers by AccountType ("Share Capital" / "वसुल भाग भांडवल")
        /// 4. Smart Devanagari & English Name Search ("सभासद भाग", "भाग भांडवल", "वसुल भाग", "Share Capital")
        /// 5. Self-Healing Auto-Creation if database is empty
        /// </summary>
        public static async Task<Ledger> GetShareCapitalLedgerAsync(AppDbContext context, int? schemeId = null)
        {
            // 1. Specified ShareScheme or Active ShareScheme
            ShareScheme? activeScheme = null;
            if (schemeId.HasValue && schemeId.Value > 0)
            {
                activeScheme = await context.ShareSchemes.FindAsync(schemeId.Value);
            }
            if (activeScheme == null)
            {
                activeScheme = await context.ShareSchemes
                    .OrderByDescending(s => s.IsActive)
                    .ThenByDescending(s => s.EffectiveDate)
                    .ThenBy(s => s.ShareSchemeId)
                    .FirstOrDefaultAsync();
            }

            if (activeScheme != null && activeScheme.ShareCapitalLedgerID.HasValue && activeScheme.ShareCapitalLedgerID.Value > 0)
            {
                var ledger = await context.Ledgers.FindAsync(activeScheme.ShareCapitalLedgerID.Value);
                if (ledger != null)
                {
                    // Ensure VoucherMapping stays in sync with Active Scheme
                    await EnsureVoucherMappingAsync(context, "Share Capital", ledger.LedgerID);
                    return ledger;
                }
            }

            // 2. Check VoucherMappings for "Share Capital"
            var mapping = await context.VoucherMappings.FirstOrDefaultAsync(m => m.TransactionType == "Share Capital");
            if (mapping != null && mapping.CreditLedgerID.HasValue && mapping.CreditLedgerID.Value > 0)
            {
                var ledger = await context.Ledgers.FindAsync(mapping.CreditLedgerID.Value);
                if (ledger != null)
                {
                    // Auto-sync back to active scheme if scheme has missing ledger
                    if (activeScheme != null && (!activeScheme.ShareCapitalLedgerID.HasValue || activeScheme.ShareCapitalLedgerID.Value == 0))
                    {
                        activeScheme.ShareCapitalLedgerID = ledger.LedgerID;
                        try { await context.SaveChangesAsync(); } catch { }
                    }
                    return ledger;
                }
            }

            // 3. Search Ledgers by AccountType
            var typeLedger = await context.Ledgers
                .FirstOrDefaultAsync(l => l.AccountType == "Share Capital" || 
                                          l.AccountType == "वसुल भाग भांडवल" || 
                                          l.AccountType == "भाग भांडवल");
            if (typeLedger != null)
            {
                await SyncToSchemeAndMappingAsync(context, activeScheme, "Share Capital", typeLedger.LedgerID);
                return typeLedger;
            }

            // 4. Smart Devanagari & English Name Search in Active Ledgers
            var allLedgers = await context.Ledgers
                .Include(l => l.AccountGroup)
                .Where(l => l.IsActive)
                .ToListAsync();

            var matched = allLedgers.FirstOrDefault(l =>
                l.LedgerName.Contains("सभासद भाग") ||
                l.LedgerName.Contains("भाग भांडवल") ||
                l.LedgerName.Contains("वसुल भाग") ||
                l.LedgerName.Contains("वसूल भाग") ||
                l.LedgerName.ToLower().Contains("share capital") ||
                (l.AccountGroup != null && (
                    l.AccountGroup.GroupName.Contains("भाग भांडवल") ||
                    l.AccountGroup.GroupName.Contains("वसुल भाग") ||
                    l.AccountGroup.GroupName.ToLower().Contains("share capital")
                ))
            );

            if (matched != null)
            {
                await SyncToSchemeAndMappingAsync(context, activeScheme, "Share Capital", matched.LedgerID);
                return matched;
            }

            // 5. Self-Healing Auto-Creation if no ledger exists at all
            var group = await context.AccountGroups.FirstOrDefaultAsync(g => 
                g.GroupName.Contains("भाग भांडवल") || 
                g.GroupName.Contains("वसुल भाग") || 
                g.NatureOfGroup == "Liability" || 
                g.NatureOfGroup == "Liabilities");

            if (group == null)
            {
                group = new AccountGroup
                {
                    GroupName = "भाग भांडवल (Share Capital)",
                    NatureOfGroup = "Liability",
                    IsActive = true
                };
                context.AccountGroups.Add(group);
                await context.SaveChangesAsync();
            }

            var newLedger = new Ledger
            {
                LedgerName = "१ सभासद भाग भांडवल (Member Share Capital)",
                GroupID = group.GroupID,
                AccountType = "Share Capital",
                OpeningBalance = 0,
                OpeningBalanceType = "Cr",
                IsActive = true
            };
            context.Ledgers.Add(newLedger);
            await context.SaveChangesAsync();

            await SyncToSchemeAndMappingAsync(context, activeScheme, "Share Capital", newLedger.LedgerID);
            return newLedger;
        }

        /// <summary>
        /// Resolves the Dividend Payable (Liability) Ledger.
        /// </summary>
        public static async Task<Ledger> GetDividendPayableLedgerAsync(AppDbContext context, int? schemeId = null)
        {
            // 1. Check Active Scheme
            ShareScheme? activeScheme = null;
            if (schemeId.HasValue && schemeId.Value > 0)
            {
                activeScheme = await context.ShareSchemes.FindAsync(schemeId.Value);
            }
            if (activeScheme == null)
            {
                activeScheme = await context.ShareSchemes
                    .OrderByDescending(s => s.IsActive)
                    .ThenByDescending(s => s.EffectiveDate)
                    .FirstOrDefaultAsync();
            }

            if (activeScheme != null && activeScheme.DividendPayableLedgerID.HasValue && activeScheme.DividendPayableLedgerID.Value > 0)
            {
                var ledger = await context.Ledgers.FindAsync(activeScheme.DividendPayableLedgerID.Value);
                if (ledger != null)
                {
                    await EnsureVoucherMappingAsync(context, "Dividend Payable", ledger.LedgerID);
                    return ledger;
                }
            }

            // 2. Check VoucherMappings
            var mapping = await context.VoucherMappings.FirstOrDefaultAsync(m => m.TransactionType == "Dividend Payable");
            if (mapping != null && mapping.CreditLedgerID.HasValue && mapping.CreditLedgerID.Value > 0)
            {
                var ledger = await context.Ledgers.FindAsync(mapping.CreditLedgerID.Value);
                if (ledger != null) return ledger;
            }

            // 3. Search by Name / AccountType
            var divLedger = await context.Ledgers.FirstOrDefaultAsync(l => 
                l.AccountType == "Dividend Payable" || 
                l.LedgerName.Contains("देणे लाभांश") || 
                l.LedgerName.Contains("Dividend Payable") ||
                l.LedgerName.Contains("लाभांश देणे"));

            if (divLedger != null)
            {
                await EnsureVoucherMappingAsync(context, "Dividend Payable", divLedger.LedgerID);
                return divLedger;
            }

            // 4. Create default Dividend Payable Ledger
            var group = await context.AccountGroups.FirstOrDefaultAsync(g => 
                g.GroupName.Contains("इतर देणे") || 
                g.GroupName.Contains("देयता") || 
                g.NatureOfGroup == "Liability");

            int groupId = group?.GroupID ?? 1;

            var newDivLedger = new Ledger
            {
                LedgerName = "देणे लाभांश खाते (Dividend Payable)",
                GroupID = groupId,
                AccountType = "Dividend Payable",
                OpeningBalance = 0,
                OpeningBalanceType = "Cr",
                IsActive = true
            };
            context.Ledgers.Add(newDivLedger);
            await context.SaveChangesAsync();

            await EnsureVoucherMappingAsync(context, "Dividend Payable", newDivLedger.LedgerID);
            return newDivLedger;
        }

        /// <summary>
        /// Resolves the Share Transfer Fee (Income) Ledger.
        /// </summary>
        public static async Task<Ledger> GetShareTransferFeeLedgerAsync(AppDbContext context, int? schemeId = null)
        {
            // 1. Check Active Scheme
            var activeScheme = schemeId.HasValue && schemeId.Value > 0
                ? await context.ShareSchemes.FindAsync(schemeId.Value)
                : await context.ShareSchemes.OrderByDescending(s => s.IsActive).FirstOrDefaultAsync();

            if (activeScheme != null && activeScheme.ShareTransferFeeLedgerID.HasValue && activeScheme.ShareTransferFeeLedgerID.Value > 0)
            {
                var ledger = await context.Ledgers.FindAsync(activeScheme.ShareTransferFeeLedgerID.Value);
                if (ledger != null)
                {
                    await EnsureVoucherMappingAsync(context, "Share Transfer Fee", ledger.LedgerID);
                    return ledger;
                }
            }

            // 2. Check VoucherMappings
            var mapping = await context.VoucherMappings.FirstOrDefaultAsync(m => m.TransactionType == "Share Transfer Fee");
            if (mapping != null && mapping.CreditLedgerID.HasValue && mapping.CreditLedgerID.Value > 0)
            {
                var ledger = await context.Ledgers.FindAsync(mapping.CreditLedgerID.Value);
                if (ledger != null) return ledger;
            }

            // 3. Search by Name
            var feeLedger = await context.Ledgers.FirstOrDefaultAsync(l => 
                l.LedgerName.Contains("हस्तांतरण फी") || 
                l.LedgerName.Contains("Transfer Fee") || 
                l.LedgerName.Contains("Share Fee"));

            if (feeLedger != null)
            {
                await EnsureVoucherMappingAsync(context, "Share Transfer Fee", feeLedger.LedgerID);
                return feeLedger;
            }

            // 4. Fallback to Income Ledger
            var incomeLedger = await context.Ledgers.FirstOrDefaultAsync(l => 
                l.AccountType == "Income" || 
                l.AccountType == "Indirect Incomes" ||
                (l.AccountGroup != null && l.AccountGroup.NatureOfGroup == "Income"));

            if (incomeLedger != null) return incomeLedger;

            return await GetShareCapitalLedgerAsync(context, schemeId);
        }

        /// <summary>
        /// Resolves the Share Entrance Fee (Income) Ledger.
        /// </summary>
        public static async Task<Ledger> GetEntranceFeeLedgerAsync(AppDbContext context, int? schemeId = null)
        {
            var activeScheme = schemeId.HasValue && schemeId.Value > 0
                ? await context.ShareSchemes.FindAsync(schemeId.Value)
                : await context.ShareSchemes.OrderByDescending(s => s.IsActive).FirstOrDefaultAsync();

            if (activeScheme != null && activeScheme.EntranceFeeLedgerID.HasValue && activeScheme.EntranceFeeLedgerID.Value > 0)
            {
                var ledger = await context.Ledgers.FindAsync(activeScheme.EntranceFeeLedgerID.Value);
                if (ledger != null)
                {
                    await EnsureVoucherMappingAsync(context, "Share Entrance Fee", ledger.LedgerID);
                    return ledger;
                }
            }

            var mapping = await context.VoucherMappings.FirstOrDefaultAsync(m => m.TransactionType == "Share Entrance Fee");
            if (mapping != null && mapping.CreditLedgerID.HasValue && mapping.CreditLedgerID.Value > 0)
            {
                var ledger = await context.Ledgers.FindAsync(mapping.CreditLedgerID.Value);
                if (ledger != null) return ledger;
            }

            var feeLedger = await context.Ledgers.FirstOrDefaultAsync(l => 
                l.LedgerName.Contains("प्रवेश फी") || 
                l.LedgerName.Contains("Entrance Fee") || 
                l.LedgerName.Contains("प्रवेश शुल्क"));

            if (feeLedger != null)
            {
                await EnsureVoucherMappingAsync(context, "Share Entrance Fee", feeLedger.LedgerID);
                return feeLedger;
            }

            return await GetShareCapitalLedgerAsync(context, schemeId);
        }

        /// <summary>
        /// Resolves the Building Fund / Welfare Fund (Liability/Reserve) Ledger dynamically.
        /// </summary>
        public static async Task<Ledger> GetBuildingFundLedgerAsync(AppDbContext context, int? schemeId = null)
        {
            var mapping = await context.VoucherMappings.FirstOrDefaultAsync(m => m.TransactionType == "Building Fund" || m.TransactionType == "इमारत निधी");
            if (mapping != null && mapping.CreditLedgerID.HasValue && mapping.CreditLedgerID.Value > 0)
            {
                var ledger = await context.Ledgers.FindAsync(mapping.CreditLedgerID.Value);
                if (ledger != null) return ledger;
            }

            var fundLedger = await context.Ledgers.FirstOrDefaultAsync(l => 
                l.LedgerName.Contains("इमारत निधी") || 
                l.LedgerName.Contains("Building Fund") || 
                l.LedgerName.Contains("कल्याण निधी") ||
                l.LedgerName.Contains("Welfare Fund") ||
                l.AccountType == "Building Fund" ||
                l.AccountType == "इमारत निधी");

            if (fundLedger != null)
            {
                await EnsureVoucherMappingAsync(context, "Building Fund", fundLedger.LedgerID);
                return fundLedger;
            }

            return await GetShareCapitalLedgerAsync(context, schemeId);
        }

        /// <summary>
        /// Synchronizes the selected Ledgers from a ShareScheme directly to the VoucherMappings table.
        /// Keeps the scheme master in 100% real-time sync with Voucher Mapping Master.
        /// </summary>
        public static async Task SyncSchemeToVoucherMappingsAsync(AppDbContext context, ShareScheme scheme)
        {
            if (scheme == null) return;

            if (scheme.ShareCapitalLedgerID.HasValue && scheme.ShareCapitalLedgerID.Value > 0)
            {
                await EnsureVoucherMappingAsync(context, "Share Capital", scheme.ShareCapitalLedgerID.Value);
            }

            if (scheme.DividendPayableLedgerID.HasValue && scheme.DividendPayableLedgerID.Value > 0)
            {
                await EnsureVoucherMappingAsync(context, "Dividend Payable", scheme.DividendPayableLedgerID.Value);
            }

            if (scheme.EntranceFeeLedgerID.HasValue && scheme.EntranceFeeLedgerID.Value > 0)
            {
                await EnsureVoucherMappingAsync(context, "Share Entrance Fee", scheme.EntranceFeeLedgerID.Value);
            }

            if (scheme.ShareTransferFeeLedgerID.HasValue && scheme.ShareTransferFeeLedgerID.Value > 0)
            {
                await EnsureVoucherMappingAsync(context, "Share Transfer Fee", scheme.ShareTransferFeeLedgerID.Value);
            }

            await context.SaveChangesAsync();
        }

        private static async Task EnsureVoucherMappingAsync(AppDbContext context, string transactionType, int creditLedgerId)
        {
            var mapping = await context.VoucherMappings.FirstOrDefaultAsync(m => m.TransactionType == transactionType);
            if (mapping == null)
            {
                context.VoucherMappings.Add(new VoucherMapping
                {
                    TransactionType = transactionType,
                    CreditLedgerID = creditLedgerId
                });
            }
            else
            {
                mapping.CreditLedgerID = creditLedgerId;
                context.Entry(mapping).State = EntityState.Modified;
            }
            try { await context.SaveChangesAsync(); } catch { }
        }

        private static async Task SyncToSchemeAndMappingAsync(AppDbContext context, ShareScheme? activeScheme, string transactionType, int creditLedgerId)
        {
            if (activeScheme != null && (!activeScheme.ShareCapitalLedgerID.HasValue || activeScheme.ShareCapitalLedgerID.Value == 0))
            {
                activeScheme.ShareCapitalLedgerID = creditLedgerId;
                context.Entry(activeScheme).State = EntityState.Modified;
            }
            await EnsureVoucherMappingAsync(context, transactionType, creditLedgerId);
        }
    }
}
