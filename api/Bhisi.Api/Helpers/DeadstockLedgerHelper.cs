using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Helpers
{
    public static class DeadstockLedgerHelper
    {
        public static async Task<int> ResolveLedgerIdForCategoryAsync(AppDbContext context, AssetCategory? category)
        {
            // Candidate groups (Fixed Assets: 48, 49, 50, 51 or NatureOfGroup == "Assets")
            var candidateLedgers = await context.Ledgers
                .AsNoTracking()
                .Where(l => l.GroupID == 48 || l.GroupID == 49 || l.GroupID == 50 || l.GroupID == 51 ||
                            l.LedgerName.Contains("डेडस्टॉक") || 
                            l.LedgerName.Contains("संगणक") || 
                            l.LedgerName.Contains("फर्निचर") ||
                            (l.LedgerNameEnglish != null && (l.LedgerNameEnglish.Contains("Deadstock") || l.LedgerNameEnglish.Contains("Asset"))))
                .ToListAsync();

            if (category != null)
            {
                if (category.AssetLedgerID.HasValue && category.AssetLedgerID.Value > 0)
                {
                    return category.AssetLedgerID.Value;
                }

                string catName = (category.CategoryName ?? "").ToLower().Trim();

                if (catName.Contains("संगणक") || catName.Contains("computer") || catName.Contains("प्रिंटर"))
                {
                    var match = candidateLedgers.FirstOrDefault(l => l.LedgerID == 240)
                             ?? candidateLedgers.FirstOrDefault(l => l.LedgerName.Contains("संगणक"));
                    if (match != null) return match.LedgerID;
                }
                else if (catName.Contains("जागा") || catName.Contains("इमारत") || catName.Contains("building"))
                {
                    var match = candidateLedgers.FirstOrDefault(l => l.LedgerID == 237)
                             ?? candidateLedgers.FirstOrDefault(l => l.LedgerName.Contains("जागा") || l.LedgerName.Contains("इमारत"));
                    if (match != null) return match.LedgerID;
                }
                else if (catName.Contains("फर्निचर") || catName.Contains("furniture"))
                {
                    var match = candidateLedgers.FirstOrDefault(l => l.LedgerID == 238)
                             ?? candidateLedgers.FirstOrDefault(l => l.LedgerName.Contains("फर्निचर"));
                    if (match != null) return match.LedgerID;
                }
                else if (catName.Contains("वाहन") || catName.Contains("मोटर") || catName.Contains("vehicle"))
                {
                    var match = candidateLedgers.FirstOrDefault(l => l.LedgerID == 242)
                             ?? candidateLedgers.FirstOrDefault(l => l.LedgerName.Contains("मोटर") || l.LedgerName.Contains("वाहन"));
                    if (match != null) return match.LedgerID;
                }
            }

            // Default Deadstock ledger (Ledger 239 - 'डेडस्टॉक' or any ledger matching 'डेडस्टॉक')
            var defDeadstock = candidateLedgers.FirstOrDefault(l => l.LedgerID == 239)
                            ?? candidateLedgers.FirstOrDefault(l => l.LedgerName.Contains("डेडस्टॉक"))
                            ?? await context.Ledgers.FirstOrDefaultAsync(l => l.LedgerID == 239)
                            ?? await context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("डेडस्टॉक"))
                            ?? candidateLedgers.FirstOrDefault();

            return defDeadstock?.LedgerID ?? 239;
        }

        public static async Task SyncDeadstockOpeningBalancesAsync(AppDbContext context, int? targetBranchId = null)
        {
            // 1. Identify active financial year
            int activeFyId = await context.FinancialYears
                .Where(fy => fy.IsActive)
                .Select(fy => fy.FinancialYearID)
                .FirstOrDefaultAsync();

            if (activeFyId == 0)
            {
                activeFyId = await context.FinancialYears
                    .OrderByDescending(fy => fy.FinancialYearID)
                    .Select(fy => fy.FinancialYearID)
                    .FirstOrDefaultAsync();
            }

            if (activeFyId == 0) return;

            // 2. Resolve default Deadstock ledger
            int defaultDeadstockLedgerId = await ResolveLedgerIdForCategoryAsync(context, null);

            // 3. Query all active opening balance assets
            var assetQuery = context.Assets
                .AsNoTracking()
                .Include(a => a.Category)
                .Where(a => a.Status == "Active" && a.IsOpeningBalance);

            if (targetBranchId.HasValue && targetBranchId.Value > 0)
            {
                assetQuery = assetQuery.Where(a => a.BranchID == targetBranchId.Value);
            }

            var openingAssets = await assetQuery.ToListAsync();

            // 4. Determine branches to sync
            List<int> branchIdsToSync;
            if (targetBranchId.HasValue && targetBranchId.Value > 0)
            {
                branchIdsToSync = new List<int> { targetBranchId.Value };
            }
            else
            {
                branchIdsToSync = await context.Branches.Select(b => b.BranchID).Distinct().ToListAsync();
                if (!branchIdsToSync.Any()) branchIdsToSync = new List<int> { 1 };
            }

            // 5. Aggregate balances per (BranchID, LedgerID)
            var targetBalances = new Dictionary<(int BranchId, int LedgerId), decimal>();
            var touchedLedgerIds = new HashSet<int> { defaultDeadstockLedgerId };

            foreach (var bId in branchIdsToSync)
            {
                targetBalances[(bId, defaultDeadstockLedgerId)] = 0m;
            }

            foreach (var asset in openingAssets)
            {
                int bId = asset.BranchID;
                if (!branchIdsToSync.Contains(bId)) continue;

                int resolvedLedgerId = defaultDeadstockLedgerId;
                if (asset.Category != null)
                {
                    resolvedLedgerId = await ResolveLedgerIdForCategoryAsync(context, asset.Category);
                }

                touchedLedgerIds.Add(resolvedLedgerId);
                var key = (bId, resolvedLedgerId);
                decimal bookVal = asset.CurrentBookValue > 0 
                    ? asset.CurrentBookValue 
                    : (asset.OriginalCost - asset.AccumulatedDepreciation);

                targetBalances[key] = targetBalances.GetValueOrDefault(key, 0m) + bookVal;
            }

            // 6. Fetch existing BranchLedgerOpeningBalances for these branches & ledgers in active FY
            var existingRows = await context.BranchLedgerOpeningBalances
                .Where(b => b.FinancialYearID == activeFyId &&
                            branchIdsToSync.Contains(b.BranchID) &&
                            touchedLedgerIds.Contains(b.LedgerID))
                .ToListAsync();

            var existingMap = existingRows.ToDictionary(r => (r.BranchID, r.LedgerID), r => r);

            // 7. Upsert BranchLedgerOpeningBalances
            foreach (var kvp in targetBalances)
            {
                int bId = kvp.Key.BranchId;
                int lId = kvp.Key.LedgerId;
                decimal neededBalance = kvp.Value;

                if (existingMap.TryGetValue((bId, lId), out var existing))
                {
                    if (neededBalance > 0 || (existing.Remarks != null && existing.Remarks.Contains("डेडस्टॉक सुरुवातीची शिल्लक")))
                    {
                        existing.OpeningBalance = neededBalance;
                        existing.OpeningBalanceType = "Dr";
                        existing.Remarks = "डेडस्टॉक सुरुवातीची शिल्लक सिंक (Dynamic CBS Engine)";
                        existing.UpdatedOn = DateTime.UtcNow;
                    }
                }
                else if (neededBalance > 0)
                {
                    var newRecord = new BranchLedgerOpeningBalance
                    {
                        BranchID = bId,
                        LedgerID = lId,
                        FinancialYearID = activeFyId,
                        OpeningBalance = neededBalance,
                        OpeningBalanceType = "Dr",
                        Remarks = "डेडस्टॉक सुरुवातीची शिल्लक सिंक (Dynamic CBS Engine)",
                        CreatedOn = DateTime.UtcNow,
                        CreatedBy = 1
                    };
                    context.BranchLedgerOpeningBalances.Add(newRecord);
                }
            }

            await context.SaveChangesAsync();

            // 8. Synchronize consolidated OpeningBalance on Ledgers table
            foreach (var ledgerId in touchedLedgerIds)
            {
                var ledger = await context.Ledgers.FindAsync(ledgerId);
                if (ledger != null)
                {
                    decimal totalDr = await context.BranchLedgerOpeningBalances
                        .Where(b => b.LedgerID == ledgerId && b.FinancialYearID == activeFyId && b.OpeningBalanceType == "Dr")
                        .SumAsync(b => b.OpeningBalance);

                    if (totalDr >= 0)
                    {
                        ledger.OpeningBalance = totalDr;
                        ledger.OpeningBalanceType = "Dr";
                    }
                }
            }

            await context.SaveChangesAsync();
        }
    }
}
