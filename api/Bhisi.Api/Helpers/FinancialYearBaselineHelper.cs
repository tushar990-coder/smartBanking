using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bhisi.Api.Helpers
{
    public class FinancialYearBaselineResult
    {
        public int TargetFinancialYearId { get; set; }
        public string TargetYearCode { get; set; } = string.Empty;
        public DateTime? TargetFyStartDate { get; set; }
        public DateTime? TargetFyEndDate { get; set; }
        public int BaselineFinancialYearId { get; set; }
        public DateTime? BaselineStartDate { get; set; }
        public bool IsCarriedForwardYear { get; set; }
    }

    public static class FinancialYearBaselineHelper
    {
        /// <summary>
        /// Resolves the Financial Year for the given referenceDate (or explicitFinancialYearId) and determines:
        /// 1. Which FinancialYearID in BranchLedgerOpeningBalances holds the baseline opening balances.
        /// 2. The exact cutoff BaselineStartDate from which VoucherDetails should be accumulated so prior-year
        ///    vouchers are NEVER double-counted after Year-End Carry Forward ("शिल्लक पुढे ओढा").
        /// 3. TargetFyStartDate for resetting Income/Expense (P&amp;L) calculations at the start of the target FY.
        /// </summary>
        public static async Task<FinancialYearBaselineResult> ResolveBaselineAsync(
            AppDbContext context,
            DateTime? referenceDate = null,
            int? explicitFinancialYearId = null)
        {
            var allYears = await context.FinancialYears
                .AsNoTracking()
                .OrderBy(f => f.StartDate)
                .ThenBy(f => f.FinancialYearID)
                .ToListAsync();

            if (allYears.Count == 0)
            {
                return new FinancialYearBaselineResult();
            }

            FinancialYear? targetFy = null;

            if (explicitFinancialYearId.HasValue && explicitFinancialYearId.Value > 0)
            {
                targetFy = allYears.FirstOrDefault(f => f.FinancialYearID == explicitFinancialYearId.Value);
            }

            if (targetFy == null && referenceDate.HasValue)
            {
                DateTime refDay = referenceDate.Value.Date;
                targetFy = allYears.FirstOrDefault(f => refDay >= f.StartDate.Date && refDay <= f.EndDate.Date);
            }

            if (targetFy == null)
            {
                targetFy = allYears.FirstOrDefault(f => f.IsActive) ?? allYears.Last();
            }

            var earliestFy = allYears.First();
            bool hasPriorYears = allYears.Any(f =>
                f.StartDate.Date < targetFy.StartDate.Date &&
                f.FinancialYearID != targetFy.FinancialYearID);

            bool hasTargetFyOb = !hasPriorYears
                ? await context.BranchLedgerOpeningBalances
                    .AsNoTracking()
                    .AnyAsync(b => b.FinancialYearID == targetFy.FinancialYearID)
                : await context.BranchLedgerOpeningBalances
                    .AsNoTracking()
                    .AnyAsync(b => b.FinancialYearID == targetFy.FinancialYearID &&
                                   (b.Remarks == null ||
                                    (!b.Remarks.Contains("डेडस्टॉक सुरुवातीची शिल्लक") &&
                                     !b.Remarks.Contains("गुंतवणूक सुरुवातीची शिल्लक"))));

            if (hasTargetFyOb)
            {
                bool hasCarriedForwardRemarks = !hasPriorYears && await context.BranchLedgerOpeningBalances
                    .AsNoTracking()
                    .AnyAsync(b => b.FinancialYearID == targetFy.FinancialYearID &&
                                   b.Remarks != null &&
                                   (b.Remarks.Contains("Carried forward") ||
                                    b.Remarks.Contains("Includes Net P&L") ||
                                    b.Remarks.Contains("Income/Expense Reset")));

                return new FinancialYearBaselineResult
                {
                    TargetFinancialYearId = targetFy.FinancialYearID,
                    TargetYearCode = targetFy.YearCode,
                    TargetFyStartDate = DateTime.SpecifyKind(targetFy.StartDate.Date, DateTimeKind.Unspecified),
                    TargetFyEndDate = DateTime.SpecifyKind(targetFy.EndDate.Date, DateTimeKind.Unspecified),
                    BaselineFinancialYearId = targetFy.FinancialYearID,
                    BaselineStartDate = DateTime.SpecifyKind(targetFy.StartDate.Date, DateTimeKind.Unspecified),
                    IsCarriedForwardYear = hasPriorYears || hasCarriedForwardRemarks
                };
            }

            // Target FY does not have carried-forward BranchLedgerOpeningBalances yet (Case A: new FY opened on 1 April before running Carry Forward)
            var fyIdsWithValidOb = (await context.BranchLedgerOpeningBalances
                .AsNoTracking()
                .Where(b => b.Remarks == null ||
                            (!b.Remarks.Contains("डेडस्टॉक सुरुवातीची शिल्लक") &&
                             !b.Remarks.Contains("गुंतवणूक सुरुवातीची शिल्लक")))
                .Select(b => b.FinancialYearID)
                .Distinct()
                .ToListAsync())
                .ToHashSet();

            var fallbackFy = allYears
                .Where(f => f.StartDate.Date <= targetFy.StartDate.Date && fyIdsWithValidOb.Contains(f.FinancialYearID))
                .OrderByDescending(f => f.StartDate)
                .ThenByDescending(f => f.FinancialYearID)
                .FirstOrDefault();

            if (fallbackFy != null)
            {
                bool fallbackHasPriorYears = allYears.Any(f =>
                    f.StartDate.Date < fallbackFy.StartDate.Date &&
                    f.FinancialYearID != fallbackFy.FinancialYearID);

                return new FinancialYearBaselineResult
                {
                    TargetFinancialYearId = targetFy.FinancialYearID,
                    TargetYearCode = targetFy.YearCode,
                    TargetFyStartDate = DateTime.SpecifyKind(targetFy.StartDate.Date, DateTimeKind.Unspecified),
                    TargetFyEndDate = DateTime.SpecifyKind(targetFy.EndDate.Date, DateTimeKind.Unspecified),
                    BaselineFinancialYearId = fallbackFy.FinancialYearID,
                    BaselineStartDate = DateTime.SpecifyKind(fallbackFy.StartDate.Date, DateTimeKind.Unspecified),
                    IsCarriedForwardYear = fallbackHasPriorYears
                };
            }

            return new FinancialYearBaselineResult
            {
                TargetFinancialYearId = targetFy.FinancialYearID,
                TargetYearCode = targetFy.YearCode,
                TargetFyStartDate = DateTime.SpecifyKind(targetFy.StartDate.Date, DateTimeKind.Unspecified),
                TargetFyEndDate = DateTime.SpecifyKind(targetFy.EndDate.Date, DateTimeKind.Unspecified),
                BaselineFinancialYearId = targetFy.FinancialYearID,
                BaselineStartDate = DateTime.SpecifyKind(earliestFy.StartDate.Date, DateTimeKind.Unspecified),
                IsCarriedForwardYear = false
            };
        }
    }
}

