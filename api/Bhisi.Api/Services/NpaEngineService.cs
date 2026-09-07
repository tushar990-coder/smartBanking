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

        public async Task<NpaClassificationRun> RunClassificationAsync(DateTime asOfDate, string triggeredBy)
        {
            using var dbTransaction = _context.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory"
                ? null
                : await _context.Database.BeginTransactionAsync();
            try
            {
                // 1. Determine Financial Year
                string fy = GetFinancialYear(asOfDate);

                // 2. Fetch Config & Slabs
                var config = await _context.NpaConfigs.FirstOrDefaultAsync(c => c.FinancialYear == fy);
                if (config == null)
                {
                    config = new NpaConfig { FinancialYear = fy, ConcessionPeriodDays = 180 };
                    _context.NpaConfigs.Add(config);
                    await _context.SaveChangesAsync();
                }

                int concessionDays = config.ConcessionPeriodDays;

                // Ensure slabs exist (if not seeded, we will throw or default)
                var slabs = await _context.NpaProvisionSlabs.Where(s => s.FinancialYear == fy).ToListAsync();
                if (!slabs.Any())
                {
                    // Fallback seed slabs if empty
                    await SeedSlabsForFyAsync(fy);
                    slabs = await _context.NpaProvisionSlabs.Where(s => s.FinancialYear == fy).ToListAsync();
                }

                // 3. Create Classification Run Record
                var run = new NpaClassificationRun
                {
                    RunDate = DateTime.Now,
                    TriggeredBy = triggeredBy,
                    Status = "Running",
                    Remarks = $"NPA Classification run as of {asOfDate:dd-MM-yyyy}"
                };
                _context.NpaClassificationRuns.Add(run);
                await _context.SaveChangesAsync();

                // 4. Fetch all data
                var activeLoans = await _context.LoanAccounts
                    .Include(l => l.LoanRate)
                    .Include(l => l.Customer)
                    .Include(l => l.Member)
                    .Where(l => l.Status == "Active")
                    .ToListAsync();


                var schedules = await _context.LoanInstallmentSchedules
                    .Where(s => s.DueDate <= asOfDate)
                    .ToListAsync();

                var collections = await _context.LoanCollections
                    .Where(c => c.CollectionDate <= asOfDate)
                    .ToListAsync();

                var disbursements = await _context.LoanDisbursements
                    .Where(d => d.DisbursementDate <= asOfDate)
                    .ToListAsync();

                var linkedAccounts = await _context.BorrowerLinkedAccounts.ToListAsync();

                var complianceLogs = await _context.CollateralComplianceLogs
                    .Where(c => c.ValuationDate <= asOfDate)
                    .OrderByDescending(c => c.ValuationDate)
                    .ToListAsync();

                // 5. Check/Seed Contra Ledgers
                var ledgerOverdueIntRec = await GetOrCreateLedgerAsync("थकीत व्याज येणे खाते", "इतर येणे", "Assets", true);
                var ledgerOverdueIntProv = await GetOrCreateLedgerAsync("थकीत व्याज तरतूद खाते", "इतर देणे", "Liabilities", true);
                var ledgerOverdueRecRec = await GetOrCreateLedgerAsync("थकीत वसुली खर्च येणे खाते", "इतर येणे", "Assets", true);
                var ledgerOverdueRecProv = await GetOrCreateLedgerAsync("थकीत वसुली खर्च तरतूद खाते", "इतर देणे", "Liabilities", true);

                // 6. Step 1: Calculate Individual Statuses
                var individualStatuses = new Dictionary<int, (string Category, DateTime? OverdueDate, DateTime? OutOfOrderDate, decimal CompliantCollateral, string SecurityType)>();

                foreach (var loan in activeLoans)
                {
                    bool isCcOd = loan.LoanRate?.IsCcOrOd ?? false;
                    decimal totalOutstanding = loan.PrincipalBalance + loan.InterestBalance + loan.OverdueInterestBalance;

                    if (totalOutstanding <= 0)
                    {
                        individualStatuses[loan.LoanAccountID] = ("Standard", null, null, 0, "Unsecured");
                        continue;
                    }

                    DateTime? overdueDate = null;
                    DateTime? outOfOrderDate = null;
                    string category = "Standard";

                    // A. Calculate Overdue/OutOfOrder Date
                    if (isCcOd)
                    {
                        decimal sanctionedLimit = loan.SanctionedAmount;
                        // CC/OD limits drawing power fallback
                        // Reconstruct continuous excess date if exceeds
                        outOfOrderDate = GetOutOfOrderDateForCcOd(loan, asOfDate, sanctionedLimit, schedules, collections, disbursements, concessionDays);
                        if (outOfOrderDate.HasValue)
                        {
                            int elapsedDays = (asOfDate - outOfOrderDate.Value).Days;
                            category = DetermineCategoryByDays(elapsedDays, slabs, concessionDays);
                        }
                    }
                    else
                    {
                        overdueDate = GetOverdueDateForTermLoan(loan, asOfDate, schedules);
                        if (overdueDate.HasValue)
                        {
                            int elapsedDays = (asOfDate - overdueDate.Value).Days;
                            category = DetermineCategoryByDays(elapsedDays, slabs, concessionDays);
                        }
                    }

                    // B. Exemptions check (FD, Gold, LIC etc. are exempt unless collateral falls below or margin breached)
                    bool isExemptAsset = IsExemptSecurityType(loan.LoanRate?.SecurityType ?? "");
                    decimal compliantCollateralValue = 0;
                    string calculatedSecurityType = "Unsecured";

                    // Retrieve compliance logs for the account
                    var latestLogs = complianceLogs.Where(c => c.LoanAccountID == loan.LoanAccountID).ToList();
                    compliantCollateralValue = CalculateCompliantCollateralValue(loan, asOfDate, latestLogs, out calculatedSecurityType);

                    if (isExemptAsset)
                    {
                        var latestLog = latestLogs.FirstOrDefault();
                        bool marginBreachedForMoreThan12Months = false;
                        if (latestLog != null)
                        {
                            // Check if margin is breached and log is older than 12 months with breach
                            if (!latestLog.IsMarginMaintained && (asOfDate - latestLog.ValuationDate).TotalDays > 365)
                            {
                                marginBreachedForMoreThan12Months = true;
                            }
                        }

                        bool exemptBreached = totalOutstanding > compliantCollateralValue || marginBreachedForMoreThan12Months;

                        if (!exemptBreached && category != "Loss")
                        {
                            category = "Standard"; // Keep standard by default if exempt and no breach
                        }
                    }

                    // If Auditor certified Loss Asset manually, keep Loss Asset status
                    var existingManualLossStatus = await _context.LoanAccountNpaStatuses
                        .Where(s => s.LoanAccountID == loan.LoanAccountID && !s.IsAutoClassified && s.Category == "Loss")
                        .FirstOrDefaultAsync();

                    if (existingManualLossStatus != null)
                    {
                        category = "Loss";
                    }

                    individualStatuses[loan.LoanAccountID] = (category, overdueDate, outOfOrderDate, compliantCollateralValue, calculatedSecurityType);
                }

                // 7. Step 2: Group Downgrade Rule (Single-Borrower-Multiple-Loans)
                var finalStatuses = new Dictionary<int, (string Category, DateTime? OverdueDate, DateTime? OutOfOrderDate, decimal CompliantCollateral, string SecurityType)>();
                
                // Helper function to derive canonical borrower key
                string GetBorrowerKey(LoanAccount l)
                {
                    if (l.CustomerID.HasValue && l.CustomerID.Value > 0) return $"C_{l.CustomerID.Value}";
                    if (l.Member?.CustomerID > 0) return $"C_{l.Member.CustomerID}";
                    if (l.MemberID.HasValue && l.MemberID.Value > 0) return $"M_{l.MemberID.Value}";
                    return $"L_{l.LoanAccountID}";
                }

                // Helper map of MemberID to CustomerID
                var memberCustMap = activeLoans
                    .Where(l => l.MemberID.HasValue && l.Member != null && l.Member.CustomerID.HasValue && l.Member.CustomerID.Value > 0)
                    .GroupBy(l => l.MemberID!.Value)
                    .ToDictionary(g => g.Key, g => g.First().Member!.CustomerID!.Value);

                // Build adjacency list for borrower grouping using string keys
                var borrowerToGroup = new Dictionary<string, HashSet<string>>();
                foreach (var loan in activeLoans)
                {
                    string bKey = GetBorrowerKey(loan);
                    if (!borrowerToGroup.ContainsKey(bKey))
                        borrowerToGroup[bKey] = new HashSet<string> { bKey };

                    // Also link member key to customer key if both present
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

                    // Merge groups
                    var merged = new HashSet<string>(borrowerToGroup[parent].Concat(borrowerToGroup[linked]));
                    foreach (var bKey in merged)
                    {
                        borrowerToGroup[bKey] = merged;
                    }
                }

                // Map loan accounts to their borrower groups
                var loanGroups = new List<List<LoanAccount>>();
                var processedLoans = new HashSet<int>();

                foreach (var loan in activeLoans)
                {
                    if (processedLoans.Contains(loan.LoanAccountID)) continue;

                    string bKey = GetBorrowerKey(loan);
                    var groupKeys = borrowerToGroup.ContainsKey(bKey) ? borrowerToGroup[bKey] : new HashSet<string> { bKey };
                    var loanGroup = activeLoans.Where(l => groupKeys.Contains(GetBorrowerKey(l)) || (l.MemberID.HasValue && groupKeys.Contains($"M_{l.MemberID.Value}"))).ToList();
                    
                    loanGroups.Add(loanGroup);
                    foreach (var gl in loanGroup)
                    {
                        processedLoans.Add(gl.LoanAccountID);
                    }
                }

                // Apply downgrades within each borrower group
                foreach (var group in loanGroups)
                {
                    // Find worst category in group
                    string worstCategory = "Standard";
                    foreach (var loan in group)
                    {
                        var indCat = individualStatuses[loan.LoanAccountID].Category;
                        worstCategory = GetWorstCategory(worstCategory, indCat);
                    }

                    // Downgrade all loans in the group to the worst category
                    foreach (var loan in group)
                    {
                        var ind = individualStatuses[loan.LoanAccountID];
                        finalStatuses[loan.LoanAccountID] = (worstCategory, ind.OverdueDate, ind.OutOfOrderDate, ind.CompliantCollateral, ind.SecurityType);
                    }
                }

                // 8. Step 3: Compute Provisions and Save Statuses
                int recordsProcessed = 0;
                foreach (var loan in activeLoans)
                {
                    var status = finalStatuses[loan.LoanAccountID];
                    decimal totalOutstanding = loan.PrincipalBalance + loan.InterestBalance + loan.OverdueInterestBalance;

                    decimal provisionRequired = 0;
                    decimal securedAmount = Math.Min(totalOutstanding, status.CompliantCollateral);
                    decimal unsecuredAmount = Math.Max(0, totalOutstanding - securedAmount);

                    // Look up slab percent
                    decimal securedPercent = 0;
                    decimal unsecuredPercent = 0;

                    if (status.Category == "Standard")
                    {
                        var slab = slabs.FirstOrDefault(s => s.Category == "Standard");
                        securedPercent = slab?.MinProvisionPercent ?? 0.25m;
                        unsecuredPercent = slab?.MinProvisionPercent ?? 0.25m;
                    }
                    else if (status.Category == "Sub-Standard")
                    {
                        var slab = slabs.FirstOrDefault(s => s.Category == "Sub-Standard");
                        securedPercent = slab?.MinProvisionPercent ?? 5.0m;
                        unsecuredPercent = slab?.MinProvisionPercent ?? 5.0m;
                    }
                    else if (status.Category == "Loss")
                    {
                        var slab = slabs.FirstOrDefault(s => s.Category == "Loss");
                        securedPercent = slab?.MinProvisionPercent ?? 100.0m;
                        unsecuredPercent = slab?.MinProvisionPercent ?? 100.0m;
                    }
                    else // Doubtful-1/2/3
                    {
                        var slabSecured = slabs.FirstOrDefault(s => s.Category == status.Category && s.SecurityType == "Secured");
                        var slabUnsecured = slabs.FirstOrDefault(s => s.Category == status.Category && s.SecurityType == "Unsecured");

                        // If not found separately, fallback to "Both"
                        if (slabSecured == null) slabSecured = slabs.FirstOrDefault(s => s.Category == status.Category && s.SecurityType == "Both");
                        if (slabUnsecured == null) slabUnsecured = slabs.FirstOrDefault(s => s.Category == status.Category && s.SecurityType == "Both");

                        securedPercent = slabSecured?.MinProvisionPercent ?? 0;
                        unsecuredPercent = slabUnsecured?.MinProvisionPercent ?? 0;
                    }

                    provisionRequired = Math.Round((securedAmount * securedPercent / 100m) + (unsecuredAmount * unsecuredPercent / 100m), 2);

                    // Reconstruct mix security type
                    string finalSecurityType = "Unsecured";
                    if (securedAmount > 0 && unsecuredAmount > 0) finalSecurityType = "Mixed";
                    else if (securedAmount > 0) finalSecurityType = "Secured";

                    // Handle Manual vs Auto classification run override
                    var existingStatus = await _context.LoanAccountNpaStatuses
                        .FirstOrDefaultAsync(s => s.LoanAccountID == loan.LoanAccountID && s.AsOfDate.Date == asOfDate.Date);

                    bool isAutoClassified = true;
                    string finalCategory = status.Category;
                    string? auditorRemarks = null;

                    if (existingStatus != null && !existingStatus.IsAutoClassified && existingStatus.Category == "Loss")
                    {
                        isAutoClassified = false;
                        finalCategory = "Loss";
                        auditorRemarks = existingStatus.AuditorRemarks;
                        provisionRequired = totalOutstanding; // 100% for Loss Asset
                    }

                    if (existingStatus != null)
                    {
                        existingStatus.Category = finalCategory;
                        existingStatus.OverdueDate = status.OverdueDate;
                        existingStatus.OutOfOrderDate = status.OutOfOrderDate;
                        existingStatus.SecurityType = finalSecurityType;
                        existingStatus.OutstandingBalance = totalOutstanding;
                        existingStatus.CompliantCollateralValue = status.CompliantCollateral;
                        existingStatus.ProvisionRequired = provisionRequired;
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
                            AsOfDate = asOfDate.Date,
                            OverdueDate = status.OverdueDate,
                            OutOfOrderDate = status.OutOfOrderDate,
                            Category = finalCategory,
                            SecurityType = finalSecurityType,
                            OutstandingBalance = totalOutstanding,
                            CompliantCollateralValue = status.CompliantCollateral,
                            ProvisionRequired = provisionRequired,
                            ProvisionHeld = 0, // Filled up from provisioning ledgers / allocations
                            IsAutoClassified = isAutoClassified,
                            LastClassificationRunId = run.NpaClassificationRunID,
                            AuditorRemarks = auditorRemarks
                        };
                        _context.LoanAccountNpaStatuses.Add(newStatus);
                    }

                    // 9. Transitions - Income Recognition / Reversals
                    // If account transitioned to NPA (Sub-Standard, Doubtful, Loss)
                    if (finalCategory != "Standard")
                    {
                        await HandleNpaTransitionAccountingAsync(loan, asOfDate, ledgerOverdueIntRec, ledgerOverdueIntProv);
                    }

                    recordsProcessed++;
                }

                // 10. Update Classification Run log
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
            catch (Exception ex)
            {
                if (dbTransaction != null)
                {
                    await dbTransaction.RollbackAsync();
                }
                throw;
            }
        }

        private string GetFinancialYear(DateTime date)
        {
            int year = date.Year;
            if (date.Month >= 4)
            {
                return $"{year}-{((year + 1) % 100):D2}";
            }
            else
            {
                return $"{(year - 1)}-{(year % 100):D2}";
            }
        }

        private string GetWorstCategory(string cat1, string cat2)
        {
            var rank = new List<string> { "Standard", "Sub-Standard", "Doubtful-1", "Doubtful-2", "Doubtful-3", "Loss" };
            int r1 = rank.IndexOf(cat1);
            int r2 = rank.IndexOf(cat2);
            return rank[Math.Max(r1, r2)];
        }

        private string DetermineCategoryByDays(int overdueDays, List<NpaProvisionSlab> slabs, int concessionDays)
        {
            // If overdue days is strictly less than concession days, Standard.
            if (overdueDays < concessionDays) return "Standard";

            double overdueMonths = overdueDays / 30.0;
            double concessionMonths = concessionDays / 30.0;

            if (overdueMonths < concessionMonths) return "Standard";
            if (overdueMonths <= 18.0) return "Sub-Standard";
            if (overdueMonths <= 42.0) return "Doubtful-1";
            if (overdueMonths <= 54.0) return "Doubtful-2";
            return "Doubtful-3";
        }

        private bool IsExemptSecurityType(string securityType)
        {
            if (string.IsNullOrEmpty(securityType)) return false;
            var t = securityType.ToLower();
            return t.Contains("सोने") || t.Contains("ठेव") || t.Contains("fd") || t.Contains("gold") || t.Contains("lic") || t.Contains("nsc") || t.Contains("kvp") || t.Contains("ivp");
        }

        private DateTime? GetOverdueDateForTermLoan(LoanAccount loan, DateTime asOfDate, List<LoanInstallmentSchedule> schedules)
        {
            if (loan.LoanRate != null && (loan.LoanRate.InterestCalculationMethod.Contains("Reducing") || loan.LoanRate.InterestCalculationMethod.Contains("घटती")))
            {
                DateTime startDate = loan.LoanDisbursementDate ?? loan.OpeningDate;
                if (asOfDate <= startDate) return null;

                int totalDurationMonths = loan.DurationMonths;
                if (totalDurationMonths <= 0) totalDurationMonths = 12; // Fallback

                // Calculate elapsed months safely
                int elapsedMonths = ((asOfDate.Year - startDate.Year) * 12) + asOfDate.Month - startDate.Month;
                if (asOfDate.Day < startDate.Day) elapsedMonths--;
                if (elapsedMonths < 0) elapsedMonths = 0;
                if (elapsedMonths > totalDurationMonths) elapsedMonths = totalDurationMonths;

                // Expected Principal
                decimal expectedPrincipal = 0;
                if (totalDurationMonths > 0)
                {
                    expectedPrincipal = (loan.SanctionedAmount / totalDurationMonths) * elapsedMonths;
                }

                decimal expectedBalance = loan.SanctionedAmount - expectedPrincipal;
                
                // If actual balance > expected balance, there is a principal shortfall
                if (loan.PrincipalBalance > expectedBalance)
                {
                    decimal shortfall = loan.PrincipalBalance - expectedBalance;
                    decimal monthlyPrincipal = loan.SanctionedAmount / totalDurationMonths;

                    if (monthlyPrincipal > 0)
                    {
                        int monthsOverdue = (int)Math.Ceiling(shortfall / monthlyPrincipal);
                        if (monthsOverdue > 0)
                        {
                            return asOfDate.AddMonths(-monthsOverdue);
                        }
                    }
                }

                // Check Interest Overdue
                if (loan.OverdueInterestBalance > 0 || loan.InterestBalance > 0)
                {
                    DateTime lastPaid = loan.LastInstallmentPaidDate ?? startDate;
                    if ((asOfDate - lastPaid).TotalDays > 30)
                    {
                        return lastPaid.AddMonths(1);
                    }
                }

                if (loan.MaturityDate.HasValue && loan.MaturityDate.Value <= asOfDate && loan.PrincipalBalance > 0)
                {
                    return loan.MaturityDate.Value;
                }

                return null;
            }

            // FLAT LOGIC
            var unpaidSchedules = schedules
                .Where(s => s.LoanAccountID == loan.LoanAccountID && s.DueDate <= asOfDate && s.Status != "Paid")
                .ToList();

            if (unpaidSchedules.Any())
            {
                return unpaidSchedules.Min(s => s.DueDate);
            }

            if (loan.MaturityDate.HasValue && loan.MaturityDate.Value <= asOfDate && loan.PrincipalBalance > 0)
            {
                return loan.MaturityDate.Value;
            }

            return null;
        }

        private DateTime? GetOutOfOrderDateForCcOd(LoanAccount loan, DateTime asOfDate, decimal limit,
            List<LoanInstallmentSchedule> schedules, List<LoanCollection> collections, List<LoanDisbursement> disbursements, int concessionDays)
        {
            // A CC/OD is irregular if:
            // 1. Overdue interest unpaid for > concessionDays
            // We can estimate the date interest became overdue by LastInstallmentPaidDate or OpeningDate + 1 month
            DateTime interestOverdueSince = (loan.LastInstallmentPaidDate ?? loan.LoanDisbursementDate ?? loan.OpeningDate).AddMonths(1);
            bool isInterestOverdue = (loan.InterestBalance + loan.OverdueInterestBalance) > 0 && interestOverdueSince <= asOfDate;

            // 2. Limit has expired and not renewed
            bool isExpired = loan.MaturityDate.HasValue && loan.MaturityDate.Value <= asOfDate;

            // 3. Outstanding balance continuously exceeds sanctioned/drawing power limit
            decimal outstanding = loan.PrincipalBalance + loan.InterestBalance + loan.OverdueInterestBalance;
            bool isExceeded = outstanding > limit;

            // 4. Credit summations in FY are less than 4x minimum of sanctioned limit or drawing power
            bool isCreditSummationInsufficient = false;
            DateTime fyStart = GetFinancialYearStartDate(asOfDate);
            decimal collectionsInFy = collections
                .Where(c => c.LoanAccountID == loan.LoanAccountID && c.CollectionDate >= fyStart && c.CollectionDate <= asOfDate)
                .Sum(c => c.TotalAmountReceived);

            decimal requiredCredit = 4 * limit;
            // Evaluated at end of FY or if expired
            if (asOfDate >= fyStart.AddMonths(12).AddDays(-1) || isExpired)
            {
                isCreditSummationInsufficient = collectionsInFy < requiredCredit;
            }

            // Find the earliest irregularity date
            var irregularityDates = new List<DateTime>();

            if (isInterestOverdue)
            {
                irregularityDates.Add(interestOverdueSince);
            }
            if (isExpired && loan.MaturityDate.HasValue)
            {
                irregularityDates.Add(loan.MaturityDate.Value);
            }
            if (isExceeded)
            {
                DateTime exceedStartDate = GetContinuousExceedStartDate(loan, asOfDate, limit, collections, disbursements);
                irregularityDates.Add(exceedStartDate);
            }
            if (isCreditSummationInsufficient)
            {
                irregularityDates.Add(fyStart);
            }

            if (irregularityDates.Any())
            {
                return irregularityDates.Min();
            }

            return null;
        }

        private DateTime GetFinancialYearStartDate(DateTime date)
        {
            int year = date.Year;
            if (date.Month >= 4) return new DateTime(year, 4, 1);
            return new DateTime(year - 1, 4, 1);
        }

        private DateTime GetContinuousExceedStartDate(LoanAccount loan, DateTime asOfDate, decimal limit,
            List<LoanCollection> collections, List<LoanDisbursement> disbursements)
        {
            // Reconstruct running balance backwards from asOfDate
            decimal runningBalance = loan.PrincipalBalance + loan.InterestBalance + loan.OverdueInterestBalance;
            if (runningBalance <= limit) return asOfDate;

            // Combine transactions before asOfDate
            var txns = new List<(DateTime Date, decimal Amount, string Type)>();
            
            var accountCollections = collections.Where(c => c.LoanAccountID == loan.LoanAccountID && c.CollectionDate <= asOfDate).ToList();
            var accountDisbursements = disbursements.Where(d => d.LoanAccountID == loan.LoanAccountID && d.DisbursementDate <= asOfDate).ToList();

            foreach (var c in accountCollections)
            {
                // Collection is a credit (reduced balance). Working backward, we add it back.
                txns.Add((c.CollectionDate, c.PrincipalCollected + c.InterestCollected + c.PenaltyInterestCollected, "Credit"));
            }
            foreach (var d in accountDisbursements)
            {
                // Disbursement is a debit (increased balance). Working backward, we subtract it.
                txns.Add((d.DisbursementDate, d.DisbursementAmount, "Debit"));
            }

            // Sort descending by date
            var sortedTxns = txns.OrderByDescending(t => t.Date).ToList();
            DateTime lastExceedDate = asOfDate;

            foreach (var t in sortedTxns)
            {
                if (t.Type == "Credit")
                {
                    runningBalance += t.Amount;
                }
                else
                {
                    runningBalance -= t.Amount;
                }

                if (runningBalance <= limit)
                {
                    return lastExceedDate;
                }
                lastExceedDate = t.Date;
            }

            return loan.LoanDisbursementDate ?? loan.OpeningDate;
        }

        private decimal CalculateCompliantCollateralValue(LoanAccount loan, DateTime asOfDate, List<CollateralComplianceLog> logs, out string securityType)
        {
            securityType = "Unsecured";
            var log = logs.FirstOrDefault();
            if (log == null)
            {
                return 0; // NIL if no logs exist
            }

            // Check generic validation period of 3 years
            if ((asOfDate - log.ValuationDate).TotalDays > (365 * 3))
            {
                return 0; // NIL if valuation older than 3 years
            }

            // Check insurance expiry
            if (log.InsuranceExpiryDate < asOfDate)
            {
                return 0; // NIL if insurance has expired
            }

            // Check annual physical inspection
            if ((asOfDate - log.LastInspectionDate).TotalDays > 365)
            {
                return 0; // NIL if inspection older than 1 year
            }

            decimal rawValue = log.ValuationValue;

            if (log.CollateralType == "Immovable Property")
            {
                // If valued >= 100 Lakh, requires 2 valuers
                if (rawValue >= 10000000 && log.ValuersCount < 2)
                {
                    return 0;
                }
                securityType = "Secured";
                return rawValue;
            }
            else if (log.CollateralType == "Plant & Machinery" || log.CollateralType == "Furniture & Fixtures")
            {
                // If valued >= 50 Lakh, requires 2 valuers
                if (rawValue >= 5000000 && log.ValuersCount < 2)
                {
                    return 0;
                }

                // Apply 10% p.a. straight-line depreciation from valuation date
                double yearsElapsed = (asOfDate - log.ValuationDate).TotalDays / 365.25;
                decimal deprRate = 0.10m;
                decimal deprFactor = 1.0m - (decimal)Math.Min(1.0, yearsElapsed * (double)deprRate);
                
                securityType = "Secured";
                return Math.Round(rawValue * deprFactor, 2);
            }
            else if (log.CollateralType == "Pledged Stock")
            {
                // Monthly stock statement not older than 1 month
                if (!log.LastStockStatementDate.HasValue || (asOfDate - log.LastStockStatementDate.Value).TotalDays > 30)
                {
                    return 0;
                }

                decimal limit = loan.SanctionedAmount;
                // If limits > 10 Lakh, requires 6-monthly inspection (already covered since inspection checked < 1 year, but here we require < 180 days for stock)
                if (limit > 1000000 && (asOfDate - log.LastInspectionDate).TotalDays > 180)
                {
                    return 0;
                }

                // If limits >= 25 Lakh, requires annual auditor verification
                if (limit >= 2500000 && !log.IsAuditorVerified)
                {
                    return 0;
                }

                securityType = "Secured";
                return rawValue;
            }
            else if (log.CollateralType == "Other Exempt")
            {
                // Exemption check like Gold/FD/NSC
                if (!log.IsMarginMaintained)
                {
                    return 0;
                }
                securityType = "Secured";
                return rawValue;
            }

            return 0;
        }

        private async Task HandleNpaTransitionAccountingAsync(LoanAccount loan, DateTime asOfDate,
            Ledger overdueIntRec, Ledger overdueIntProv)
        {
            decimal unrealizedInterest = loan.InterestBalance + loan.OverdueInterestBalance;
            if (unrealizedInterest <= 0) return;

            // Check if we have already posted a contra entry for this transition
            bool alreadyPosted = await _context.OverdueInterestLedgers
                .AnyAsync(l => l.LoanAccountID == loan.LoanAccountID && l.DebitAmount > 0 && l.TransactionDate.Date == asOfDate.Date);

            if (alreadyPosted) return;

            // Log in Contra tracking ledgers
            var overdueTx = new OverdueInterestLedger
                {
                    LoanAccountID = loan.LoanAccountID,
                    TransactionDate = asOfDate,
                    DebitAmount = unrealizedInterest,
                    CreditAmount = 0,
                    Particulars = $"Unrealized interest moved to contra on NPA classification (A/C: {loan.LoanAccountNo})"
                };
            _context.OverdueInterestLedgers.Add(overdueTx);

            // Fetch interest income ledger from LoanRate
            int interestIncomeLedgerId = loan.LoanRate?.InterestLedgerID ?? 0;
            if (interestIncomeLedgerId == 0)
            {
                interestIncomeLedgerId = (await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("व्याज")))?.LedgerID ?? 0;
            }

            if (interestIncomeLedgerId > 0)
            {
                // Post Journal Voucher to reverse interest income
                var activeYear = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
                string fyCode = activeYear?.YearCode ?? "26-27";
                int count = await _context.Vouchers.CountAsync(v => v.VoucherType == "Journal") + 1;
                string voucherNo = $"HQ-JV-{fyCode}-{count:D5}";

                var jv = new Voucher
                {
                    BranchID = loan.BranchID,
                    VoucherNo = voucherNo,
                    VoucherDate = asOfDate,
                    VoucherType = "Journal",
                    Narration = $"Accrued Interest Reversal on NPA classification for Account {loan.LoanAccountNo}",
                    TotalAmount = unrealizedInterest
                };
                _context.Vouchers.Add(jv);
                await _context.SaveChangesAsync();

                // Debit Interest Income (reversing income)
                _context.VoucherDetails.Add(new VoucherDetail
                {
                    VoucherID = jv.VoucherID,
                    LedgerID = interestIncomeLedgerId,
                    DrCr = "Dr",
                    Amount = unrealizedInterest,
                    MemberID = loan.MemberID
                });

                // Credit Overdue Interest Provision (Contra-Liability)
                _context.VoucherDetails.Add(new VoucherDetail
                {
                    VoucherID = jv.VoucherID,
                    LedgerID = overdueIntProv.LedgerID,
                    DrCr = "Cr",
                    Amount = unrealizedInterest,
                    MemberID = loan.MemberID
                });

                // Also record the asset side in Ledger entries: Debit Overdue Interest Receivable, Credit general Interest Receivable (if applicable)
                // Here we debit the Overdue Interest Receivable and credit the contra to match the ledger balances
                _context.VoucherDetails.Add(new VoucherDetail
                {
                    VoucherID = jv.VoucherID,
                    LedgerID = overdueIntRec.LedgerID,
                    DrCr = "Dr",
                    Amount = unrealizedInterest,
                    MemberID = loan.MemberID
                });

                _context.VoucherDetails.Add(new VoucherDetail
                {
                    VoucherID = jv.VoucherID,
                    LedgerID = loan.LoanRate?.OverdueInterestLedgerID ?? interestIncomeLedgerId, // Credit the standard receivable ledger
                    DrCr = "Cr",
                    Amount = unrealizedInterest,
                    MemberID = loan.MemberID
                });

                overdueTx.VoucherID = jv.VoucherID;
            }
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
            var slabs = new List<NpaProvisionSlab>();

            if (fy == "2024-25")
            {
                slabs.AddRange(new[]
                {
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Standard", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 0, OverdueOrOutOfOrderMonthsTo = 6, MinProvisionPercent = 0.25m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Sub-Standard", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 6, OverdueOrOutOfOrderMonthsTo = 18, NpaMonthsFrom = 0, NpaMonthsTo = 12, MinProvisionPercent = 5.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-1", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 18, OverdueOrOutOfOrderMonthsTo = 42, NpaMonthsFrom = 12, NpaMonthsTo = 36, MinProvisionPercent = 15.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-1", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 18, OverdueOrOutOfOrderMonthsTo = 42, NpaMonthsFrom = 12, NpaMonthsTo = 36, MinProvisionPercent = 60.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-2", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 42, OverdueOrOutOfOrderMonthsTo = 54, NpaMonthsFrom = 36, NpaMonthsTo = 48, MinProvisionPercent = 20.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-2", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 42, OverdueOrOutOfOrderMonthsTo = 54, NpaMonthsFrom = 36, NpaMonthsTo = 48, MinProvisionPercent = 70.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-3", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 54, OverdueOrOutOfOrderMonthsTo = 999, NpaMonthsFrom = 48, NpaMonthsTo = 999, MinProvisionPercent = 25.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-3", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 54, OverdueOrOutOfOrderMonthsTo = 999, NpaMonthsFrom = 48, NpaMonthsTo = 999, MinProvisionPercent = 80.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Loss", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 0, OverdueOrOutOfOrderMonthsTo = 999, MinProvisionPercent = 100.00m }
                });
            }
            else if (fy == "2025-26")
            {
                slabs.AddRange(new[]
                {
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Standard", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 0, OverdueOrOutOfOrderMonthsTo = 6, MinProvisionPercent = 0.25m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Sub-Standard", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 6, OverdueOrOutOfOrderMonthsTo = 18, NpaMonthsFrom = 0, NpaMonthsTo = 12, MinProvisionPercent = 6.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-1", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 18, OverdueOrOutOfOrderMonthsTo = 42, NpaMonthsFrom = 12, NpaMonthsTo = 36, MinProvisionPercent = 20.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-1", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 18, OverdueOrOutOfOrderMonthsTo = 42, NpaMonthsFrom = 12, NpaMonthsTo = 36, MinProvisionPercent = 70.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-2", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 42, OverdueOrOutOfOrderMonthsTo = 54, NpaMonthsFrom = 36, NpaMonthsTo = 48, MinProvisionPercent = 25.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-2", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 42, OverdueOrOutOfOrderMonthsTo = 54, NpaMonthsFrom = 36, NpaMonthsTo = 48, MinProvisionPercent = 80.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-3", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 54, OverdueOrOutOfOrderMonthsTo = 999, NpaMonthsFrom = 48, NpaMonthsTo = 999, MinProvisionPercent = 30.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-3", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 54, OverdueOrOutOfOrderMonthsTo = 999, NpaMonthsFrom = 48, NpaMonthsTo = 999, MinProvisionPercent = 90.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Loss", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 0, OverdueOrOutOfOrderMonthsTo = 999, MinProvisionPercent = 100.00m }
                });
            }
            else if (fy == "2026-27")
            {
                slabs.AddRange(new[]
                {
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Standard", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 0, OverdueOrOutOfOrderMonthsTo = 6, MinProvisionPercent = 0.25m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Sub-Standard", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 6, OverdueOrOutOfOrderMonthsTo = 18, NpaMonthsFrom = 0, NpaMonthsTo = 12, MinProvisionPercent = 8.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-1", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 18, OverdueOrOutOfOrderMonthsTo = 42, NpaMonthsFrom = 12, NpaMonthsTo = 36, MinProvisionPercent = 25.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-1", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 18, OverdueOrOutOfOrderMonthsTo = 42, NpaMonthsFrom = 12, NpaMonthsTo = 36, MinProvisionPercent = 80.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-2", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 42, OverdueOrOutOfOrderMonthsTo = 54, NpaMonthsFrom = 36, NpaMonthsTo = 48, MinProvisionPercent = 30.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-2", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 42, OverdueOrOutOfOrderMonthsTo = 54, NpaMonthsFrom = 36, NpaMonthsTo = 48, MinProvisionPercent = 90.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-3", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 54, OverdueOrOutOfOrderMonthsTo = 999, NpaMonthsFrom = 48, NpaMonthsTo = 999, MinProvisionPercent = 40.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-3", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 54, OverdueOrOutOfOrderMonthsTo = 999, NpaMonthsFrom = 48, NpaMonthsTo = 999, MinProvisionPercent = 100.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Loss", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 0, OverdueOrOutOfOrderMonthsTo = 999, MinProvisionPercent = 100.00m }
                });
            }
            else // 2027-28 and onwards default to highest slabs
            {
                slabs.AddRange(new[]
                {
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Standard", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 0, OverdueOrOutOfOrderMonthsTo = 6, MinProvisionPercent = 0.25m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Sub-Standard", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 6, OverdueOrOutOfOrderMonthsTo = 18, NpaMonthsFrom = 0, NpaMonthsTo = 12, MinProvisionPercent = 10.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-1", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 18, OverdueOrOutOfOrderMonthsTo = 42, NpaMonthsFrom = 12, NpaMonthsTo = 36, MinProvisionPercent = 30.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-1", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 18, OverdueOrOutOfOrderMonthsTo = 42, NpaMonthsFrom = 12, NpaMonthsTo = 36, MinProvisionPercent = 100.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-2", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 42, OverdueOrOutOfOrderMonthsTo = 54, NpaMonthsFrom = 36, NpaMonthsTo = 48, MinProvisionPercent = 40.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-2", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 42, OverdueOrOutOfOrderMonthsTo = 54, NpaMonthsFrom = 36, NpaMonthsTo = 48, MinProvisionPercent = 100.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-3", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 54, OverdueOrOutOfOrderMonthsTo = 999, NpaMonthsFrom = 48, NpaMonthsTo = 999, MinProvisionPercent = 50.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-3", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 54, OverdueOrOutOfOrderMonthsTo = 999, NpaMonthsFrom = 48, NpaMonthsTo = 999, MinProvisionPercent = 100.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Loss", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 0, OverdueOrOutOfOrderMonthsTo = 999, MinProvisionPercent = 100.00m }
                });
            }

            _context.NpaProvisionSlabs.AddRange(slabs);
            await _context.SaveChangesAsync();
        }
    }
}
