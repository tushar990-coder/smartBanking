using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Services
{
    public class NpaEngineService
    {
        private readonly AppDbContext _context;

        public NpaEngineService(AppDbContext context)
        {
            _context = context;
        }

        public static string GetFinancialYearStatic(DateTime date)
        {
            int year = date.Year;
            if (date.Month >= 4)
            {
                return $"{year}-{((year + 1) % 100):D2}";
            }
            return $"{(year - 1)}-{(year % 100):D2}";
        }

        public static string NormalizeCategory(string? rawCategory)
        {
            return (rawCategory ?? "Standard").Trim() switch
            {
                "SubStandard" or "Sub-Standard" => "Sub-Standard",
                "Doubtful1" or "Doubtful-1" => "Doubtful-1",
                "Doubtful2" or "Doubtful-2" => "Doubtful-2",
                "Doubtful3" or "Doubtful-3" => "Doubtful-3",
                "Loss" => "Loss",
                _ => "Standard"
            };
        }

        /// <summary>
        /// Single canonical slab table per Financial Year (Maharashtra Co-op Commissioner Circular &amp; RBI IRAC Norms).
        /// </summary>
        public static List<NpaProvisionSlab> BuildDefaultSlabsForFy(string fy)
        {
            var slabs = new List<NpaProvisionSlab>();

            if (fy == "2024-25")
            {
                slabs.AddRange(new[]
                {
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Standard", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 0, OverdueOrOutOfOrderMonthsTo = 6, NpaMonthsFrom = 0, NpaMonthsTo = 0, MinProvisionPercent = 0.25m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Sub-Standard", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 6, OverdueOrOutOfOrderMonthsTo = 18, NpaMonthsFrom = 0, NpaMonthsTo = 12, MinProvisionPercent = 5.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-1", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 18, OverdueOrOutOfOrderMonthsTo = 42, NpaMonthsFrom = 12, NpaMonthsTo = 36, MinProvisionPercent = 15.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-1", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 18, OverdueOrOutOfOrderMonthsTo = 42, NpaMonthsFrom = 12, NpaMonthsTo = 36, MinProvisionPercent = 60.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-2", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 42, OverdueOrOutOfOrderMonthsTo = 54, NpaMonthsFrom = 36, NpaMonthsTo = 48, MinProvisionPercent = 20.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-2", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 42, OverdueOrOutOfOrderMonthsTo = 54, NpaMonthsFrom = 36, NpaMonthsTo = 48, MinProvisionPercent = 70.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-3", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 54, OverdueOrOutOfOrderMonthsTo = 999, NpaMonthsFrom = 48, NpaMonthsTo = 999, MinProvisionPercent = 25.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-3", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 54, OverdueOrOutOfOrderMonthsTo = 999, NpaMonthsFrom = 48, NpaMonthsTo = 999, MinProvisionPercent = 80.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Loss", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 0, OverdueOrOutOfOrderMonthsTo = 999, NpaMonthsFrom = 0, NpaMonthsTo = 999, MinProvisionPercent = 100.00m }
                });
            }
            else if (fy == "2025-26")
            {
                slabs.AddRange(new[]
                {
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Standard", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 0, OverdueOrOutOfOrderMonthsTo = 6, NpaMonthsFrom = 0, NpaMonthsTo = 0, MinProvisionPercent = 0.25m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Sub-Standard", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 6, OverdueOrOutOfOrderMonthsTo = 18, NpaMonthsFrom = 0, NpaMonthsTo = 12, MinProvisionPercent = 6.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-1", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 18, OverdueOrOutOfOrderMonthsTo = 42, NpaMonthsFrom = 12, NpaMonthsTo = 36, MinProvisionPercent = 20.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-1", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 18, OverdueOrOutOfOrderMonthsTo = 42, NpaMonthsFrom = 12, NpaMonthsTo = 36, MinProvisionPercent = 70.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-2", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 42, OverdueOrOutOfOrderMonthsTo = 54, NpaMonthsFrom = 36, NpaMonthsTo = 48, MinProvisionPercent = 25.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-2", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 42, OverdueOrOutOfOrderMonthsTo = 54, NpaMonthsFrom = 36, NpaMonthsTo = 48, MinProvisionPercent = 80.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-3", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 54, OverdueOrOutOfOrderMonthsTo = 999, NpaMonthsFrom = 48, NpaMonthsTo = 999, MinProvisionPercent = 30.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-3", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 54, OverdueOrOutOfOrderMonthsTo = 999, NpaMonthsFrom = 48, NpaMonthsTo = 999, MinProvisionPercent = 90.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Loss", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 0, OverdueOrOutOfOrderMonthsTo = 999, NpaMonthsFrom = 0, NpaMonthsTo = 999, MinProvisionPercent = 100.00m }
                });
            }
            else if (fy == "2026-27")
            {
                slabs.AddRange(new[]
                {
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Standard", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 0, OverdueOrOutOfOrderMonthsTo = 6, NpaMonthsFrom = 0, NpaMonthsTo = 0, MinProvisionPercent = 0.25m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Sub-Standard", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 6, OverdueOrOutOfOrderMonthsTo = 18, NpaMonthsFrom = 0, NpaMonthsTo = 12, MinProvisionPercent = 8.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-1", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 18, OverdueOrOutOfOrderMonthsTo = 42, NpaMonthsFrom = 12, NpaMonthsTo = 36, MinProvisionPercent = 25.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-1", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 18, OverdueOrOutOfOrderMonthsTo = 42, NpaMonthsFrom = 12, NpaMonthsTo = 36, MinProvisionPercent = 80.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-2", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 42, OverdueOrOutOfOrderMonthsTo = 54, NpaMonthsFrom = 36, NpaMonthsTo = 48, MinProvisionPercent = 30.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-2", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 42, OverdueOrOutOfOrderMonthsTo = 54, NpaMonthsFrom = 36, NpaMonthsTo = 48, MinProvisionPercent = 90.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-3", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 54, OverdueOrOutOfOrderMonthsTo = 999, NpaMonthsFrom = 48, NpaMonthsTo = 999, MinProvisionPercent = 40.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-3", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 54, OverdueOrOutOfOrderMonthsTo = 999, NpaMonthsFrom = 48, NpaMonthsTo = 999, MinProvisionPercent = 100.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Loss", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 0, OverdueOrOutOfOrderMonthsTo = 999, NpaMonthsFrom = 0, NpaMonthsTo = 999, MinProvisionPercent = 100.00m }
                });
            }
            else
            {
                slabs.AddRange(new[]
                {
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Standard", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 0, OverdueOrOutOfOrderMonthsTo = 6, NpaMonthsFrom = 0, NpaMonthsTo = 0, MinProvisionPercent = 0.25m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Sub-Standard", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 6, OverdueOrOutOfOrderMonthsTo = 18, NpaMonthsFrom = 0, NpaMonthsTo = 12, MinProvisionPercent = 10.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-1", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 18, OverdueOrOutOfOrderMonthsTo = 42, NpaMonthsFrom = 12, NpaMonthsTo = 36, MinProvisionPercent = 30.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-1", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 18, OverdueOrOutOfOrderMonthsTo = 42, NpaMonthsFrom = 12, NpaMonthsTo = 36, MinProvisionPercent = 100.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-2", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 42, OverdueOrOutOfOrderMonthsTo = 54, NpaMonthsFrom = 36, NpaMonthsTo = 48, MinProvisionPercent = 40.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-2", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 42, OverdueOrOutOfOrderMonthsTo = 54, NpaMonthsFrom = 36, NpaMonthsTo = 48, MinProvisionPercent = 100.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-3", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 54, OverdueOrOutOfOrderMonthsTo = 999, NpaMonthsFrom = 48, NpaMonthsTo = 999, MinProvisionPercent = 50.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-3", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 54, OverdueOrOutOfOrderMonthsTo = 999, NpaMonthsFrom = 48, NpaMonthsTo = 999, MinProvisionPercent = 100.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Loss", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 0, OverdueOrOutOfOrderMonthsTo = 999, NpaMonthsFrom = 0, NpaMonthsTo = 999, MinProvisionPercent = 100.00m }
                });
            }

            return slabs;
        }

        public static (decimal Principal, decimal ReceivableInterest, decimal OverdueInterest) ReconstructLoanBalancesAsOfDate(
            LoanAccount loan,
            DateTime asOfDate,
            IReadOnlyList<LoanCollection>? postCollections,
            IReadOnlyList<LoanDisbursement>? postDisbursements)
        {
            decimal postPrinPaid = postCollections?.Sum(c => c.PrincipalCollected) ?? 0m;
            decimal postRecIntPaid = postCollections?.Sum(c => c.ReceivableInterestCollected + c.InterestWaived) ?? 0m;
            decimal postPenPaid = postCollections?.Sum(c => (c.BookedPenaltySettled ?? c.PenaltyInterestCollected) + c.PenaltyWaived) ?? 0m;
            decimal postDisb = postDisbursements?.Sum(d => d.DisbursementAmount) ?? 0m;

            decimal histPrincipal = Math.Max(0m, loan.PrincipalBalance + postPrinPaid - postDisb);
            decimal histInterest = Math.Max(0m, loan.InterestBalance + postRecIntPaid);
            decimal histOverdueInt = Math.Max(0m, loan.OverdueInterestBalance + postPenPaid);

            return (histPrincipal, histInterest, histOverdueInt);
        }

        public static (decimal SecuredPercent, decimal UnsecuredPercent) ResolveSlabPercentages(
            string category,
            IReadOnlyList<NpaProvisionSlab> slabs)
        {
            if (category == "Standard")
            {
                var slab = slabs.FirstOrDefault(s => s.Category == "Standard");
                decimal pct = slab?.MinProvisionPercent ?? 0.25m;
                return (pct, pct);
            }
            if (category == "Sub-Standard")
            {
                var slabSec = slabs.FirstOrDefault(s => s.Category == "Sub-Standard" && s.SecurityType == "Secured")
                              ?? slabs.FirstOrDefault(s => s.Category == "Sub-Standard" && s.SecurityType == "Both")
                              ?? slabs.FirstOrDefault(s => s.Category == "Sub-Standard");
                var slabUnsec = slabs.FirstOrDefault(s => s.Category == "Sub-Standard" && s.SecurityType == "Unsecured")
                                ?? slabs.FirstOrDefault(s => s.Category == "Sub-Standard" && s.SecurityType == "Both")
                                ?? slabSec;
                return (slabSec?.MinProvisionPercent ?? 5.0m, slabUnsec?.MinProvisionPercent ?? 5.0m);
            }
            if (category == "Loss")
            {
                var slab = slabs.FirstOrDefault(s => s.Category == "Loss");
                decimal pct = slab?.MinProvisionPercent ?? 100.0m;
                return (pct, pct);
            }

            // Doubtful-1 / Doubtful-2 / Doubtful-3
            var dSec = slabs.FirstOrDefault(s => s.Category == category && s.SecurityType == "Secured")
                       ?? slabs.FirstOrDefault(s => s.Category == category && s.SecurityType == "Both");
            var dUnsec = slabs.FirstOrDefault(s => s.Category == category && s.SecurityType == "Unsecured")
                         ?? slabs.FirstOrDefault(s => s.Category == category && s.SecurityType == "Both");

            return (dSec?.MinProvisionPercent ?? 0m, dUnsec?.MinProvisionPercent ?? 0m);
        }

        public async Task<NpaClassificationRun> RunClassificationAsync(DateTime asOfDate, string triggeredBy)
        {
            DateTime targetDate = asOfDate.Date;

            using var dbTransaction = _context.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory"
                ? null
                : await _context.Database.BeginTransactionAsync();
            try
            {
                // 1. Determine Financial Year
                string fy = GetFinancialYearStatic(targetDate);

                // 2. Fetch Config & Slabs
                var config = await _context.NpaConfigs.FirstOrDefaultAsync(c => c.FinancialYear == fy);
                if (config == null)
                {
                    config = new NpaConfig { FinancialYear = fy, ConcessionPeriodDays = 180 };
                    _context.NpaConfigs.Add(config);
                    await _context.SaveChangesAsync();
                }

                int concessionDays = config.ConcessionPeriodDays > 0 ? config.ConcessionPeriodDays : 180;

                var slabs = await _context.NpaProvisionSlabs.Where(s => s.FinancialYear == fy).ToListAsync();
                if (!slabs.Any())
                {
                    await SeedSlabsForFyAsync(fy);
                    slabs = await _context.NpaProvisionSlabs.Where(s => s.FinancialYear == fy).ToListAsync();
                }

                // 3. Create Classification Run Record
                var run = new NpaClassificationRun
                {
                    RunDate = DateTime.Now,
                    TriggeredBy = triggeredBy,
                    Status = "Running",
                    Remarks = $"NPA Classification run as of {targetDate:dd-MM-yyyy}"
                };
                _context.NpaClassificationRuns.Add(run);
                await _context.SaveChangesAsync();

                // 4. Fetch all candidate loans opened/disbursed on or before targetDate
                var allCandidateLoans = await _context.LoanAccounts
                    .Include(l => l.LoanRate)
                    .Include(l => l.Customer)
                    .Include(l => l.Member)
                    .Where(l => (l.LoanDisbursementDate ?? l.OpeningDate).Date <= targetDate &&
                                (l.Status == "Active" || l.Status == "Closed"))
                    .ToListAsync();

                var candidateIds = allCandidateLoans.Select(l => l.LoanAccountID).ToHashSet();

                // Preload all collections & disbursements (up to AND after targetDate for point-in-time reconstruction)
                var allCollections = await _context.LoanCollections
                    .AsNoTracking()
                    .Where(c => candidateIds.Contains(c.LoanAccountID))
                    .ToListAsync();

                var allDisbursements = await _context.LoanDisbursements
                    .AsNoTracking()
                    .Where(d => candidateIds.Contains(d.LoanAccountID))
                    .ToListAsync();

                var collectionsByLoan = allCollections
                    .GroupBy(c => c.LoanAccountID)
                    .ToDictionary(g => g.Key, g => g.ToList());

                var disbursementsByLoan = allDisbursements
                    .GroupBy(d => d.LoanAccountID)
                    .ToDictionary(g => g.Key, g => g.ToList());

                // Reconstruct historical balances as of targetDate & filter loans actually open on targetDate
                var reconstructedBalances = new Dictionary<int, (decimal Principal, decimal ReceivableInterest, decimal OverdueInterest)>();
                var activeLoans = new List<LoanAccount>();

                foreach (var loan in allCandidateLoans)
                {
                    var loanCols = collectionsByLoan.TryGetValue(loan.LoanAccountID, out var cList) ? cList : new List<LoanCollection>();
                    var loanDisbs = disbursementsByLoan.TryGetValue(loan.LoanAccountID, out var dList) ? dList : new List<LoanDisbursement>();

                    var postCols = loanCols.Where(c => c.CollectionDate.Date > targetDate).ToList();
                    var postDisbs = loanDisbs.Where(d => d.DisbursementDate.Date > targetDate).ToList();

                    if (loan.Status == "Closed" && postCols.Count == 0)
                    {
                        continue; // Already closed on or before targetDate
                    }

                    var bal = ReconstructLoanBalancesAsOfDate(loan, targetDate, postCols, postDisbs);
                    if (loan.Status == "Closed" && (bal.Principal + bal.ReceivableInterest + bal.OverdueInterest) <= 0m)
                    {
                        continue;
                    }

                    reconstructedBalances[loan.LoanAccountID] = bal;
                    activeLoans.Add(loan);
                }

                var activeLoanIds = activeLoans.Select(l => l.LoanAccountID).ToHashSet();

                var schedulesByLoan = (await _context.LoanInstallmentSchedules
                    .AsNoTracking()
                    .Where(s => activeLoanIds.Contains(s.LoanAccountID))
                    .OrderBy(s => s.InstallmentNo)
                    .ToListAsync())
                    .GroupBy(s => s.LoanAccountID)
                    .ToDictionary(g => g.Key, g => g.ToList());

                var linkedAccounts = await _context.BorrowerLinkedAccounts.AsNoTracking().ToListAsync();

                var complianceLogsByLoan = (await _context.CollateralComplianceLogs
                    .AsNoTracking()
                    .Where(c => activeLoanIds.Contains(c.LoanAccountID) && c.ValuationDate.Date <= targetDate)
                    .OrderByDescending(c => c.ValuationDate)
                    .ToListAsync())
                    .GroupBy(c => c.LoanAccountID)
                    .ToDictionary(g => g.Key, g => g.ToList());

                var depositCollateralsByLoan = (await _context.LoanDepositCollaterals
                    .AsNoTracking()
                    .Where(c => c.LoanAccountID.HasValue &&
                                activeLoanIds.Contains(c.LoanAccountID.Value) &&
                                c.LienStatus != "Released")
                    .ToListAsync())
                    .GroupBy(c => c.LoanAccountID!.Value)
                    .ToDictionary(g => g.Key, g => g.ToList());

                var goldDetailsByLoan = (await _context.GoldLoanDetails
                    .AsNoTracking()
                    .Where(g => g.LoanAccountID.HasValue && activeLoanIds.Contains(g.LoanAccountID.Value))
                    .ToListAsync())
                    .GroupBy(g => g.LoanAccountID!.Value)
                    .ToDictionary(g => g.Key, g => g.ToList());

                // Preload existing statuses on targetDate and prior manual/OB statuses (eliminating N+1 queries)
                var allExistingStatuses = await _context.LoanAccountNpaStatuses
                    .Where(s => activeLoanIds.Contains(s.LoanAccountID))
                    .ToListAsync();

                var existingForDateMap = allExistingStatuses
                    .Where(s => s.AsOfDate.Date == targetDate)
                    .GroupBy(s => s.LoanAccountID)
                    .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.LoanAccountNpaStatusID).First());

                var priorManualOrObMap = allExistingStatuses
                    .Where(s => !s.IsAutoClassified && s.AsOfDate.Date <= targetDate)
                    .GroupBy(s => s.LoanAccountID)
                    .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.AsOfDate).ThenByDescending(x => x.LoanAccountNpaStatusID).First());

                var latestPriorStatusMap = allExistingStatuses
                    .Where(s => s.AsOfDate.Date <= targetDate)
                    .GroupBy(s => s.LoanAccountID)
                    .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.AsOfDate).ThenByDescending(x => x.LoanAccountNpaStatusID).First());

                // Ensure contra ledgers exist for statutory reporting (without posting unapproved HQ-JV vouchers)
                await GetOrCreateLedgerAsync("थकीत व्याज येणे खाते", "इतर येणे", "Assets", true);
                await GetOrCreateLedgerAsync("थकीत व्याज तरतूद खाते", "इतर देणे", "Liabilities", true);
                await GetOrCreateLedgerAsync("थकीत वसुली खर्च येणे खाते", "इतर येणे", "Assets", true);
                await GetOrCreateLedgerAsync("थकीत वसुली खर्च तरतूद खाते", "इतर देणे", "Liabilities", true);

                // Clean up any stale status rows on targetDate for loans no longer open on targetDate
                var staleRowsForDate = await _context.LoanAccountNpaStatuses
                    .Where(s => s.AsOfDate.Date == targetDate && !activeLoanIds.Contains(s.LoanAccountID))
                    .ToListAsync();
                if (staleRowsForDate.Any())
                {
                    _context.LoanAccountNpaStatuses.RemoveRange(staleRowsForDate);
                }

                // 5. Step 1: Calculate Individual Statuses
                var individualStatuses = new Dictionary<int, (string Category, DateTime? OverdueDate, DateTime? OutOfOrderDate, decimal CompliantCollateral, string SecurityType)>();

                foreach (var loan in activeLoans)
                {
                    var bal = reconstructedBalances[loan.LoanAccountID];
                    decimal totalOutstanding = bal.Principal + bal.ReceivableInterest + bal.OverdueInterest;

                    var loanComplianceLogs = complianceLogsByLoan.TryGetValue(loan.LoanAccountID, out var logs) ? logs : new List<CollateralComplianceLog>();
                    var loanDepCols = depositCollateralsByLoan.TryGetValue(loan.LoanAccountID, out var dCols) ? dCols : new List<LoanDepositCollateral>();
                    var loanGoldRows = goldDetailsByLoan.TryGetValue(loan.LoanAccountID, out var gRows) ? gRows : new List<GoldLoanDetail>();

                    decimal compliantCollateralValue = ResolveEffectiveCollateralValue(
                        loan, targetDate, loanComplianceLogs, loanDepCols, loanGoldRows, out string calculatedSecurityType);

                    if (totalOutstanding <= 0m)
                    {
                        individualStatuses[loan.LoanAccountID] = ("Standard", null, null, compliantCollateralValue, calculatedSecurityType);
                        continue;
                    }

                    bool isCcOd = loan.LoanRate?.IsCcOrOd ?? false;
                    var loanSchedules = schedulesByLoan.TryGetValue(loan.LoanAccountID, out var schList) ? schList : new List<LoanInstallmentSchedule>();
                    var loanColsUpToDate = collectionsByLoan.TryGetValue(loan.LoanAccountID, out var colAll)
                        ? colAll.Where(c => c.CollectionDate.Date <= targetDate).ToList()
                        : new List<LoanCollection>();
                    var loanDisbsUpToDate = disbursementsByLoan.TryGetValue(loan.LoanAccountID, out var disbAll)
                        ? disbAll.Where(d => d.DisbursementDate.Date <= targetDate).ToList()
                        : new List<LoanDisbursement>();
                    bool hasPostDateActivity = collectionsByLoan.TryGetValue(loan.LoanAccountID, out var colCheck) && colCheck.Any(c => c.CollectionDate.Date > targetDate);

                    priorManualOrObMap.TryGetValue(loan.LoanAccountID, out var priorManualStatus);

                    DateTime? overdueDate = null;
                    DateTime? outOfOrderDate = null;
                    string category = "Standard";

                    if (isCcOd)
                    {
                        decimal sanctionedLimit = loan.SanctionedAmount;
                        outOfOrderDate = GetOutOfOrderDateForCcOd(
                            loan, targetDate, sanctionedLimit, bal, loanColsUpToDate, loanDisbsUpToDate);
                        if (outOfOrderDate.HasValue)
                        {
                            int elapsedDays = Math.Max(0, (targetDate - outOfOrderDate.Value.Date).Days);
                            category = DetermineCategoryByDays(elapsedDays, slabs, concessionDays);
                        }
                    }
                    else
                    {
                        overdueDate = GetOverdueDateForTermLoan(
                            loan, targetDate, bal, loanSchedules, loanColsUpToDate, hasPostDateActivity, priorManualStatus, concessionDays);
                        if (overdueDate.HasValue)
                        {
                            int elapsedDays = Math.Max(0, (targetDate - overdueDate.Value.Date).Days);
                            category = DetermineCategoryByDays(elapsedDays, slabs, concessionDays);
                        }
                    }

                    // Exemptions check (FD, Gold, LIC, NSC, KVP etc. remain Standard if fully covered & margin maintained)
                    bool isExemptAsset = IsExemptSecurityType(loan.LoanRate?.SecurityType ?? "") ||
                                         IsExemptSecurityType(loan.LoanRate?.CollateralCategory ?? "");

                    if (isExemptAsset)
                    {
                        var latestLog = loanComplianceLogs.FirstOrDefault();
                        bool marginBreachedForMoreThan12Months = latestLog != null &&
                                                                 !latestLog.IsMarginMaintained &&
                                                                 (targetDate - latestLog.ValuationDate.Date).TotalDays > 365;

                        bool exemptBreached = compliantCollateralValue <= 0m ||
                                              totalOutstanding > compliantCollateralValue ||
                                              marginBreachedForMoreThan12Months;

                        if (!exemptBreached && category != "Loss")
                        {
                            category = "Standard";
                        }
                    }

                    // Preserve Auditor-certified Loss Asset
                    if (priorManualStatus != null &&
                        priorManualStatus.Category == "Loss" &&
                        !(priorManualStatus.AuditorRemarks ?? "").StartsWith("Initial Opening Balance", StringComparison.OrdinalIgnoreCase))
                    {
                        category = "Loss";
                    }
                    else if (priorManualStatus != null && priorManualStatus.Category == "Loss")
                    {
                        category = "Loss";
                    }

                    individualStatuses[loan.LoanAccountID] = (category, overdueDate, outOfOrderDate, compliantCollateralValue, calculatedSecurityType);
                }

                // 6. Step 2: Group Downgrade Rule (Single-Borrower-Multiple-Loans)
                var finalStatuses = new Dictionary<int, (string Category, DateTime? OverdueDate, DateTime? OutOfOrderDate, decimal CompliantCollateral, string SecurityType)>();

                string GetBorrowerKey(LoanAccount l)
                {
                    if (l.CustomerID.HasValue && l.CustomerID.Value > 0) return $"C_{l.CustomerID.Value}";
                    if (l.Member?.CustomerID > 0) return $"C_{l.Member.CustomerID}";
                    if (l.MemberID.HasValue && l.MemberID.Value > 0) return $"M_{l.MemberID.Value}";
                    return $"L_{l.LoanAccountID}";
                }

                var memberCustMap = activeLoans
                    .Where(l => l.MemberID.HasValue && l.Member != null && l.Member.CustomerID.HasValue && l.Member.CustomerID.Value > 0)
                    .GroupBy(l => l.MemberID!.Value)
                    .ToDictionary(g => g.Key, g => g.First().Member!.CustomerID!.Value);

                var borrowerToGroup = new Dictionary<string, HashSet<string>>();
                foreach (var loan in activeLoans)
                {
                    string bKey = GetBorrowerKey(loan);
                    if (!borrowerToGroup.ContainsKey(bKey))
                        borrowerToGroup[bKey] = new HashSet<string> { bKey };

                    if (loan.MemberID.HasValue && loan.CustomerID.HasValue)
                    {
                        string mKey = $"M_{loan.MemberID.Value}";
                        string cKey = $"C_{loan.CustomerID.Value}";
                        if (!borrowerToGroup.ContainsKey(mKey)) borrowerToGroup[mKey] = new HashSet<string> { mKey };
                        if (!borrowerToGroup.ContainsKey(cKey)) borrowerToGroup[cKey] = new HashSet<string> { cKey };
                        var mergedMC = new HashSet<string>(borrowerToGroup[mKey].Concat(borrowerToGroup[cKey]));
                        foreach (var k in mergedMC) borrowerToGroup[k] = mergedMC;
                    }
                }

                foreach (var link in linkedAccounts)
                {
                    string parent = memberCustMap.TryGetValue(link.ParentMemberID, out int pcId) ? $"C_{pcId}" : $"M_{link.ParentMemberID}";
                    string linked = memberCustMap.TryGetValue(link.LinkedMemberID, out int lcId) ? $"C_{lcId}" : $"M_{link.LinkedMemberID}";

                    if (!borrowerToGroup.ContainsKey(parent)) borrowerToGroup[parent] = new HashSet<string> { parent };
                    if (!borrowerToGroup.ContainsKey(linked)) borrowerToGroup[linked] = new HashSet<string> { linked };

                    var merged = new HashSet<string>(borrowerToGroup[parent].Concat(borrowerToGroup[linked]));
                    foreach (var bKey in merged)
                    {
                        borrowerToGroup[bKey] = merged;
                    }
                }

                var loanGroups = new List<List<LoanAccount>>();
                var processedLoans = new HashSet<int>();

                foreach (var loan in activeLoans)
                {
                    if (processedLoans.Contains(loan.LoanAccountID)) continue;

                    string bKey = GetBorrowerKey(loan);
                    var groupKeys = borrowerToGroup.ContainsKey(bKey) ? borrowerToGroup[bKey] : new HashSet<string> { bKey };
                    var loanGroup = activeLoans
                        .Where(l => groupKeys.Contains(GetBorrowerKey(l)) || (l.MemberID.HasValue && groupKeys.Contains($"M_{l.MemberID.Value}")))
                        .ToList();

                    loanGroups.Add(loanGroup);
                    foreach (var gl in loanGroup)
                    {
                        processedLoans.Add(gl.LoanAccountID);
                    }
                }

                foreach (var group in loanGroups)
                {
                    string worstCategory = "Standard";
                    foreach (var loan in group)
                    {
                        var indCat = individualStatuses[loan.LoanAccountID].Category;
                        worstCategory = GetWorstCategory(worstCategory, indCat);
                    }

                    foreach (var loan in group)
                    {
                        var ind = individualStatuses[loan.LoanAccountID];
                        finalStatuses[loan.LoanAccountID] = (worstCategory, ind.OverdueDate, ind.OutOfOrderDate, ind.CompliantCollateral, ind.SecurityType);
                    }
                }

                // Preload OverdueInterestLedgers net balances for idempotent sub-ledger tracking (without rogue HQ-JV vouchers)
                var oirRowsByLoan = (await _context.OverdueInterestLedgers
                    .Where(o => activeLoanIds.Contains(o.LoanAccountID) && o.TransactionDate.Date <= targetDate)
                    .ToListAsync())
                    .GroupBy(o => o.LoanAccountID)
                    .ToDictionary(g => g.Key, g => g.Sum(x => x.DebitAmount - x.CreditAmount));

                // 7. Step 3: Compute Principal-Based BDDR Provisions (100% OIR held separately on Receivable Interest) & Save Statuses
                int recordsProcessed = 0;
                foreach (var loan in activeLoans)
                {
                    var status = finalStatuses[loan.LoanAccountID];
                    var bal = reconstructedBalances[loan.LoanAccountID];
                    decimal principalBalance = bal.Principal;
                    decimal unrealizedInterest = bal.ReceivableInterest + bal.OverdueInterest;
                    decimal totalOutstanding = principalBalance + unrealizedInterest;

                    // Statutory Rule: 100% of unrealized interest on NPA accounts is covered by Overdue Interest Reserve (OIR).
                    // BDDR / Loan Loss Provision is calculated strictly on PrincipalBalance!
                    decimal securedPrincipal = Math.Min(principalBalance, status.CompliantCollateral);
                    decimal unsecuredPrincipal = Math.Max(0m, principalBalance - securedPrincipal);

                    var (securedPercent, unsecuredPercent) = ResolveSlabPercentages(status.Category, slabs);

                    decimal provisionRequired = Math.Round(
                        (securedPrincipal * securedPercent / 100m) + (unsecuredPrincipal * unsecuredPercent / 100m),
                        2);

                    string finalSecurityType = "Unsecured";
                    if (principalBalance > 0m)
                    {
                        if (securedPrincipal > 0m && unsecuredPrincipal > 0m) finalSecurityType = "Mixed";
                        else if (securedPrincipal > 0m) finalSecurityType = "Secured";
                    }
                    else if (status.CompliantCollateral > 0m)
                    {
                        finalSecurityType = "Secured";
                    }

                    existingForDateMap.TryGetValue(loan.LoanAccountID, out var existingStatus);
                    latestPriorStatusMap.TryGetValue(loan.LoanAccountID, out var latestPriorStatus);

                    bool isAutoClassified = true;
                    string finalCategory = status.Category;
                    string? auditorRemarks = existingStatus?.AuditorRemarks;

                    if (existingStatus != null && !existingStatus.IsAutoClassified && existingStatus.Category == "Loss")
                    {
                        isAutoClassified = false;
                        finalCategory = "Loss";
                        auditorRemarks = existingStatus.AuditorRemarks;
                        provisionRequired = principalBalance; // 100% of Principal (100% of Interest is in OIR)
                    }

                    decimal preservedProvisionHeld = existingStatus?.ProvisionHeld > 0m
                        ? existingStatus.ProvisionHeld
                        : (latestPriorStatus?.ProvisionHeld > 0m ? latestPriorStatus.ProvisionHeld : loan.InterestProvisionBalance);

                    if (existingStatus != null)
                    {
                        existingStatus.Category = finalCategory;
                        existingStatus.OverdueDate = status.OverdueDate;
                        existingStatus.OutOfOrderDate = status.OutOfOrderDate;
                        existingStatus.SecurityType = finalSecurityType;
                        existingStatus.OutstandingBalance = totalOutstanding;
                        existingStatus.CompliantCollateralValue = status.CompliantCollateral;
                        existingStatus.ProvisionRequired = provisionRequired;
                        existingStatus.ProvisionHeld = preservedProvisionHeld;
                        existingStatus.IsAutoClassified = isAutoClassified;
                        existingStatus.LastClassificationRunId = run.NpaClassificationRunID;
                        existingStatus.AuditorRemarks = auditorRemarks;
                        _context.Entry(existingStatus).State = EntityState.Modified;
                    }
                    else
                    {
                        var newStatus = new LoanAccountNpaStatus
                        {
                            LoanAccountID = loan.LoanAccountID,
                            AsOfDate = targetDate,
                            OverdueDate = status.OverdueDate,
                            OutOfOrderDate = status.OutOfOrderDate,
                            Category = finalCategory,
                            SecurityType = finalSecurityType,
                            OutstandingBalance = totalOutstanding,
                            CompliantCollateralValue = status.CompliantCollateral,
                            ProvisionRequired = provisionRequired,
                            ProvisionHeld = preservedProvisionHeld,
                            IsAutoClassified = isAutoClassified,
                            LastClassificationRunId = run.NpaClassificationRunID,
                            AuditorRemarks = auditorRemarks
                        };
                        _context.LoanAccountNpaStatuses.Add(newStatus);
                    }

                    // Idempotent sub-ledger OIR tracking (only records net positive delta, NEVER creates unapproved HQ-JV vouchers)
                    if (finalCategory != "Standard" && unrealizedInterest > 0m)
                    {
                        decimal currentNetOir = oirRowsByLoan.TryGetValue(loan.LoanAccountID, out var netVal) ? netVal : 0m;
                        decimal deltaOir = Math.Round(unrealizedInterest - Math.Max(0m, currentNetOir), 2);
                        if (deltaOir > 0.01m)
                        {
                            _context.OverdueInterestLedgers.Add(new OverdueInterestLedger
                            {
                                LoanAccountID = loan.LoanAccountID,
                                TransactionDate = targetDate,
                                DebitAmount = deltaOir,
                                CreditAmount = 0m,
                                Particulars = $"100% OIR sub-ledger sync on NPA classification (A/C: {loan.LoanAccountNo})"
                            });
                            oirRowsByLoan[loan.LoanAccountID] = Math.Max(0m, currentNetOir) + deltaOir;
                        }
                    }

                    recordsProcessed++;
                }

                // 8. Update Classification Run log
                run.Status = "Success";
                run.RecordsProcessed = recordsProcessed;
                _context.Entry(run).State = EntityState.Modified;

                await _context.SaveChangesAsync();
                if (dbTransaction != null)
                {
                    await dbTransaction.CommitAsync();
                }

                return run;
            }
            catch
            {
                if (dbTransaction != null)
                {
                    await dbTransaction.RollbackAsync();
                }
                throw;
            }
        }

        private string GetWorstCategory(string cat1, string cat2)
        {
            var rank = new List<string> { "Standard", "Sub-Standard", "Doubtful-1", "Doubtful-2", "Doubtful-3", "Loss" };
            int r1 = Math.Max(0, rank.IndexOf(cat1));
            int r2 = Math.Max(0, rank.IndexOf(cat2));
            return rank[Math.Max(r1, r2)];
        }

        /// <summary>
        /// Slab-aware IRAC category determination supporting both 90-day RBI and 180-day Co-op concession periods.
        /// Measures post-NPA duration (overdueDays - concessionDays) against slab NpaMonthsTo boundaries.
        /// </summary>
        public static string DetermineCategoryByDays(int overdueDays, List<NpaProvisionSlab> slabs, int concessionDays)
        {
            if (overdueDays < concessionDays) return "Standard";

            double npaDays = overdueDays - concessionDays;
            double npaMonths = npaDays / 30.0;

            decimal subStdMaxNpaMonths = slabs.FirstOrDefault(s => s.Category == "Sub-Standard")?.NpaMonthsTo ?? 12m;
            decimal d1MaxNpaMonths = slabs.FirstOrDefault(s => s.Category == "Doubtful-1")?.NpaMonthsTo ?? 36m;
            decimal d2MaxNpaMonths = slabs.FirstOrDefault(s => s.Category == "Doubtful-2")?.NpaMonthsTo ?? 48m;

            if (subStdMaxNpaMonths <= 0) subStdMaxNpaMonths = 12m;
            if (d1MaxNpaMonths <= subStdMaxNpaMonths) d1MaxNpaMonths = 36m;
            if (d2MaxNpaMonths <= d1MaxNpaMonths) d2MaxNpaMonths = 48m;

            if (npaMonths <= (double)subStdMaxNpaMonths) return "Sub-Standard";
            if (npaMonths <= (double)d1MaxNpaMonths) return "Doubtful-1";
            if (npaMonths <= (double)d2MaxNpaMonths) return "Doubtful-2";
            return "Doubtful-3";
        }

        private bool IsExemptSecurityType(string securityType)
        {
            if (string.IsNullOrWhiteSpace(securityType)) return false;
            var t = securityType.Trim().ToLowerInvariant();
            return t.Contains("सोने") ||
                   t.Contains("ठेव") ||
                   t.Contains("fd") ||
                   t.Contains("fixeddeposit") ||
                   t.Contains("recurringdeposit") ||
                   t.Contains("pigmydeposit") ||
                   t.Contains("savingdeposit") ||
                   t.Contains("gold") ||
                   t.Contains("lic") ||
                   t.Contains("nsc") ||
                   t.Contains("kvp") ||
                   t.Contains("ivp");
        }

        private static int ResolveInstallmentPeriodMonths(string? frequency)
        {
            if (string.IsNullOrWhiteSpace(frequency)) return 1;
            var f = frequency.ToLowerInvariant();
            if (f.Contains("वार्षिक") || f.Contains("year") || f.Contains("annual") || f.Contains("एकत्र") || f.Contains("bullet"))
                return 12;
            if (f.Contains("सहामाही") || f.Contains("half"))
                return 6;
            if (f.Contains("त्रैमासिक") || f.Contains("quarter"))
                return 3;
            return 1;
        }

        private DateTime? GetOverdueDateForTermLoan(
            LoanAccount loan,
            DateTime asOfDate,
            (decimal Principal, decimal ReceivableInterest, decimal OverdueInterest) bal,
            List<LoanInstallmentSchedule> loanSchedules,
            List<LoanCollection> colsUpToDate,
            bool hasPostDateActivity,
            LoanAccountNpaStatus? priorManualStatus,
            int concessionDays)
        {
            // 1. Schedule-first evaluation (accurate for BOTH Reducing EMI and Flat loans!)
            if (loanSchedules.Count > 0)
            {
                if (!hasPostDateActivity)
                {
                    var unpaidDue = loanSchedules
                        .Where(s => s.DueDate.Date <= asOfDate.Date && s.Status != "Paid")
                        .ToList();
                    if (unpaidDue.Count > 0)
                    {
                        return unpaidDue.Min(s => s.DueDate.Date);
                    }
                }
                else
                {
                    // Point-in-time schedule satisfaction using cumulative collections up to asOfDate
                    decimal cumPaidUpToDate = colsUpToDate.Sum(c =>
                        c.PrincipalCollected + c.InterestCollected + c.ReceivableInterestCollected + c.InterestWaived);

                    foreach (var sch in loanSchedules.Where(s => s.DueDate.Date <= asOfDate.Date).OrderBy(s => s.InstallmentNo))
                    {
                        decimal instAmt = sch.TotalAmount > 0m ? sch.TotalAmount : (sch.PrincipalAmount + sch.InterestAmount);
                        if (cumPaidUpToDate + 0.50m < instAmt)
                        {
                            return sch.DueDate.Date;
                        }
                        cumPaidUpToDate -= instAmt;
                    }
                }

                if (loan.MaturityDate.HasValue && loan.MaturityDate.Value.Date <= asOfDate.Date && bal.Principal > 0m)
                {
                    return loan.MaturityDate.Value.Date;
                }

                return null;
            }

            // 2. Preserve baseline OverdueDate for Migrated / Opening Balance NPA loans without installment schedule rows
            if (priorManualStatus?.OverdueDate != null && priorManualStatus.OverdueDate.Value.Date <= asOfDate.Date && bal.Principal > 0m)
            {
                return priorManualStatus.OverdueDate.Value.Date;
            }

            string initCat = NormalizeCategory(loan.InitialNpaClassification);
            if (loan.IsOpeningBalance && initCat != "Standard" && bal.Principal > 0m)
            {
                DateTime baseDate = loan.OpeningDate.Date <= asOfDate.Date ? loan.OpeningDate.Date : asOfDate.Date;
                return DeriveStatutoryOverdueDate(baseDate, initCat, concessionDays);
            }

            // 3. Past Maturity Date check
            if (loan.MaturityDate.HasValue && loan.MaturityDate.Value.Date <= asOfDate.Date && bal.Principal > 0m)
            {
                return loan.MaturityDate.Value.Date;
            }

            // 4. Fallback amortization check ONLY when no schedule rows exist
            DateTime startDate = (loan.LoanDisbursementDate ?? loan.OpeningDate).Date;
            if (asOfDate.Date <= startDate) return null;

            int periodMonths = ResolveInstallmentPeriodMonths(loan.InstallmentFrequency);
            int totalDurationMonths = loan.DurationMonths > 0 ? loan.DurationMonths : 12;

            int elapsedMonths = ((asOfDate.Year - startDate.Year) * 12) + asOfDate.Month - startDate.Month;
            if (asOfDate.Day < startDate.Day) elapsedMonths--;
            if (elapsedMonths < periodMonths) return null;
            if (elapsedMonths > totalDurationMonths) elapsedMonths = totalDurationMonths;

            bool isReducing = loan.LoanRate != null &&
                              ((loan.LoanRate.InterestCalculationMethod ?? "").Contains("Reducing", StringComparison.OrdinalIgnoreCase) ||
                               (loan.LoanRate.InterestCalculationMethod ?? "").Contains("घटती", StringComparison.OrdinalIgnoreCase));

            int totalPeriods = Math.Max(1, totalDurationMonths / periodMonths);
            int elapsedPeriods = Math.Min(totalPeriods, elapsedMonths / periodMonths);

            if (elapsedPeriods > 0 && loan.SanctionedAmount > 0m)
            {
                decimal expectedBalance;
                double periodicRate = (double)(loan.InterestRate / 100m) * (periodMonths / 12.0);

                if (isReducing && periodicRate > 0.0001)
                {
                    // True reducing-balance amortization curve: B_k = P * ((1+r)^N - (1+r)^k) / ((1+r)^N - 1)
                    double powN = Math.Pow(1.0 + periodicRate, totalPeriods);
                    double powK = Math.Pow(1.0 + periodicRate, elapsedPeriods);
                    double factor = (powN - powK) / (powN - 1.0);
                    expectedBalance = Math.Round(loan.SanctionedAmount * (decimal)Math.Max(0.0, factor), 2);
                }
                else
                {
                    decimal expectedPrincipalPaid = (loan.SanctionedAmount / totalPeriods) * elapsedPeriods;
                    expectedBalance = Math.Max(0m, loan.SanctionedAmount - expectedPrincipalPaid);
                }

                if (bal.Principal > expectedBalance + 1m)
                {
                    decimal shortfall = bal.Principal - expectedBalance;
                    decimal avgPeriodPrincipal = loan.SanctionedAmount / totalPeriods;
                    if (avgPeriodPrincipal > 0m)
                    {
                        int periodsOverdue = Math.Max(1, (int)Math.Ceiling(shortfall / avgPeriodPrincipal));
                        return asOfDate.Date.AddMonths(-(periodsOverdue * periodMonths));
                    }
                }
            }

            if ((bal.ReceivableInterest + bal.OverdueInterest) > 0m)
            {
                DateTime? lastPaid = colsUpToDate.Count > 0
                    ? colsUpToDate.Max(c => (DateTime?)c.CollectionDate.Date)
                    : loan.LastInstallmentPaidDate?.Date;
                DateTime refDate = lastPaid ?? startDate;
                if ((asOfDate.Date - refDate).TotalDays > (periodMonths * 30))
                {
                    return refDate.AddMonths(periodMonths);
                }
            }

            return null;
        }

        public static DateTime DeriveStatutoryOverdueDate(DateTime referenceDate, string category, int concessionDays = 180)
        {
            int cDays = concessionDays > 0 ? concessionDays : 180;
            return category switch
            {
                "Sub-Standard" => referenceDate.Date.AddDays(-(cDays + 15)),     // ~0.5 months into Sub-Standard
                "Doubtful-1"   => referenceDate.Date.AddDays(-(cDays + 380)),    // >12 months in NPA
                "Doubtful-2"   => referenceDate.Date.AddDays(-(cDays + 1110)),   // >36 months in NPA
                "Doubtful-3"   => referenceDate.Date.AddDays(-(cDays + 1480)),   // >48 months in NPA
                "Loss"         => referenceDate.Date.AddDays(-(cDays + 1480)),
                _              => referenceDate.Date
            };
        }

        private DateTime? GetOutOfOrderDateForCcOd(
            LoanAccount loan,
            DateTime asOfDate,
            decimal limit,
            (decimal Principal, decimal ReceivableInterest, decimal OverdueInterest) bal,
            List<LoanCollection> colsUpToDate,
            List<LoanDisbursement> disbsUpToDate)
        {
            DateTime? latestColDate = colsUpToDate.Count > 0
                ? colsUpToDate.Max(c => (DateTime?)c.CollectionDate.Date)
                : loan.LastInstallmentPaidDate?.Date;

            DateTime interestOverdueSince = (latestColDate ?? loan.LoanDisbursementDate?.Date ?? loan.OpeningDate.Date).AddMonths(1);
            bool isInterestOverdue = (bal.ReceivableInterest + bal.OverdueInterest) > 0m && interestOverdueSince <= asOfDate.Date;

            bool isExpired = loan.MaturityDate.HasValue && loan.MaturityDate.Value.Date <= asOfDate.Date;

            decimal outstanding = bal.Principal + bal.ReceivableInterest + bal.OverdueInterest;
            bool isExceeded = limit > 0m && outstanding > limit;

            bool isCreditSummationInsufficient = false;
            DateTime fyStart = GetFinancialYearStartDate(asOfDate);
            decimal collectionsInFy = colsUpToDate
                .Where(c => c.CollectionDate.Date >= fyStart && c.CollectionDate.Date <= asOfDate.Date)
                .Sum(c => c.TotalAmountReceived);

            decimal requiredCredit = 4m * limit;
            if (limit > 0m && (asOfDate.Date >= fyStart.AddMonths(12).AddDays(-1) || isExpired))
            {
                isCreditSummationInsufficient = collectionsInFy < requiredCredit;
            }

            var irregularityDates = new List<DateTime>();
            if (isInterestOverdue) irregularityDates.Add(interestOverdueSince);
            if (isExpired && loan.MaturityDate.HasValue) irregularityDates.Add(loan.MaturityDate.Value.Date);
            if (isExceeded)
            {
                irregularityDates.Add(GetContinuousExceedStartDate(loan, asOfDate, limit, outstanding, colsUpToDate, disbsUpToDate));
            }
            if (isCreditSummationInsufficient) irregularityDates.Add(fyStart);

            return irregularityDates.Count > 0 ? irregularityDates.Min() : null;
        }

        private DateTime GetFinancialYearStartDate(DateTime date)
        {
            int year = date.Year;
            return date.Month >= 4 ? new DateTime(year, 4, 1) : new DateTime(year - 1, 4, 1);
        }

        private DateTime GetContinuousExceedStartDate(
            LoanAccount loan,
            DateTime asOfDate,
            decimal limit,
            decimal currentOutstandingAsOfDate,
            List<LoanCollection> accountCollections,
            List<LoanDisbursement> accountDisbursements)
        {
            decimal runningBalance = currentOutstandingAsOfDate;
            if (runningBalance <= limit) return asOfDate.Date;

            var txns = new List<(DateTime Date, decimal Amount, string Type)>();
            foreach (var c in accountCollections)
            {
                txns.Add((c.CollectionDate.Date, c.PrincipalCollected + c.InterestCollected + c.ReceivableInterestCollected + c.PenaltyInterestCollected, "Credit"));
            }
            foreach (var d in accountDisbursements)
            {
                txns.Add((d.DisbursementDate.Date, d.DisbursementAmount, "Debit"));
            }

            var sortedTxns = txns.OrderByDescending(t => t.Date).ToList();
            DateTime lastExceedDate = asOfDate.Date;

            foreach (var t in sortedTxns)
            {
                runningBalance = t.Type == "Credit" ? runningBalance + t.Amount : runningBalance - t.Amount;
                if (runningBalance <= limit)
                {
                    return lastExceedDate;
                }
                lastExceedDate = t.Date;
            }

            return (loan.LoanDisbursementDate ?? loan.OpeningDate).Date;
        }

        private decimal ResolveEffectiveCollateralValue(
            LoanAccount loan,
            DateTime asOfDate,
            List<CollateralComplianceLog> logs,
            List<LoanDepositCollateral> depositCollaterals,
            List<GoldLoanDetail> goldDetails,
            out string securityType)
        {
            // 1. If explicit Collateral Compliance Audit Logs exist for this loan, enforce statutory audit rules strictly
            if (logs.Count > 0)
            {
                return EvaluateComplianceLogValue(loan, asOfDate, logs[0], out securityType);
            }

            // 2. Otherwise resolve from live CBS collateral records (Deposit Liens + Gold Ornaments + LoanAccount.SecurityValue)
            decimal depositValue = depositCollaterals.Sum(c =>
                c.CurrentDepositBalance > 0m
                    ? c.CurrentDepositBalance
                    : (c.DepositAmount > 0m ? c.DepositAmount : c.LienAmount));

            decimal goldValue = goldDetails.Sum(g =>
                g.ValuerValuation > 0m ? g.ValuerValuation : g.EstimatedValue);

            decimal operationalCollateral = Math.Max(depositValue + goldValue, loan.SecurityValue);
            if (operationalCollateral > 0m)
            {
                securityType = "Secured";
                return Math.Round(operationalCollateral, 2);
            }

            securityType = "Unsecured";
            return 0m;
        }

        private decimal EvaluateComplianceLogValue(
            LoanAccount loan,
            DateTime asOfDate,
            CollateralComplianceLog log,
            out string securityType)
        {
            securityType = "Unsecured";

            if ((asOfDate.Date - log.ValuationDate.Date).TotalDays > (365 * 3))
                return 0m;

            if (log.InsuranceExpiryDate.Date < asOfDate.Date)
                return 0m;

            if ((asOfDate.Date - log.LastInspectionDate.Date).TotalDays > 365)
                return 0m;

            decimal rawValue = log.ValuationValue;

            if (log.CollateralType == "Immovable Property")
            {
                if (rawValue >= 10000000m && log.ValuersCount < 2) return 0m;
                securityType = "Secured";
                return rawValue;
            }
            if (log.CollateralType == "Plant & Machinery" || log.CollateralType == "Furniture & Fixtures")
            {
                if (rawValue >= 5000000m && log.ValuersCount < 2) return 0m;

                double yearsElapsed = Math.Max(0.0, (asOfDate.Date - log.ValuationDate.Date).TotalDays / 365.25);
                decimal deprFactor = 1.0m - (decimal)Math.Min(1.0, yearsElapsed * 0.10);
                securityType = "Secured";
                return Math.Round(rawValue * deprFactor, 2);
            }
            if (log.CollateralType == "Pledged Stock")
            {
                if (!log.LastStockStatementDate.HasValue || (asOfDate.Date - log.LastStockStatementDate.Value.Date).TotalDays > 30)
                    return 0m;
                if (loan.SanctionedAmount > 1000000m && (asOfDate.Date - log.LastInspectionDate.Date).TotalDays > 180)
                    return 0m;
                if (loan.SanctionedAmount >= 2500000m && !log.IsAuditorVerified)
                    return 0m;

                securityType = "Secured";
                return rawValue;
            }
            if (log.CollateralType == "Other Exempt")
            {
                if (!log.IsMarginMaintained) return 0m;
                securityType = "Secured";
                return rawValue;
            }

            if (rawValue > 0m)
            {
                securityType = "Secured";
                return rawValue;
            }

            return 0m;
        }

        private async Task<Ledger> GetOrCreateLedgerAsync(string name, string groupName, string nature, bool excludeRule35)
        {
            var ledger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName == name);
            if (ledger == null)
            {
                var group = await _context.AccountGroups.FirstOrDefaultAsync(g => g.GroupName == groupName);
                if (group == null)
                {
                    group = new AccountGroup { GroupName = groupName, NatureOfGroup = nature, IsActive = true };
                    _context.AccountGroups.Add(group);
                    await _context.SaveChangesAsync();
                }

                ledger = new Ledger
                {
                    LedgerName = name,
                    GroupID = group.GroupID,
                    OpeningBalance = 0,
                    OpeningBalanceType = nature == "Assets" ? "Dr" : "Cr",
                    ExcludeFromRule35Swanidhi = excludeRule35,
                    IsActive = true
                };
                _context.Ledgers.Add(ledger);
                await _context.SaveChangesAsync();
            }
            return ledger;
        }

        private async Task SeedSlabsForFyAsync(string fy)
        {
            var slabs = BuildDefaultSlabsForFy(fy);
            _context.NpaProvisionSlabs.AddRange(slabs);
            await _context.SaveChangesAsync();
        }
    }
}
