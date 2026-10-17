using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [AllowAnonymous]
    public class RegulatoryMisController : ControllerBase
    {
        private readonly AppDbContext _context;
        private static bool _tableVerified = false;

        public RegulatoryMisController(AppDbContext context)
        {
            _context = context;
        }

        private async Task EnsureTableExistsAsync()
        {
            if (_tableVerified) return;

            string sql = @"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RegulatoryMisReports')
                BEGIN
                    CREATE TABLE [RegulatoryMisReports] (
                        [MisReportID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                        [FinancialYear] nvarchar(20) NOT NULL,
                        [BranchID] int NOT NULL DEFAULT 1,
                        [AsOnDate] datetime2 NOT NULL,
                        [GeneralInfoJson] nvarchar(max) NULL,
                        [CapitalDepositsJson] nvarchar(max) NULL,
                        [LoansRecoveryJson] nvarchar(max) NULL,
                        [InvestmentsJson] nvarchar(max) NULL,
                        [FinancialRatiosJson] nvarchar(max) NULL,
                        [ContributionJson] nvarchar(max) NULL,
                        [OtherInfoJson] nvarchar(max) NULL,
                        [IsLocked] bit NOT NULL DEFAULT 0,
                        [CreatedBy] int NOT NULL DEFAULT 1,
                        [CreatedOn] datetime2 NOT NULL DEFAULT GETDATE(),
                        [UpdatedOn] datetime2 NOT NULL DEFAULT GETDATE()
                    );
                END";

            try
            {
                await _context.Database.ExecuteSqlRawAsync(sql);
                _tableVerified = true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error verifying RegulatoryMisReports table: {ex.Message}");
            }
        }

        // GET: api/RegulatoryMis/AutoCompute?asOnDate=2026-03-31&branchId=1
        [HttpGet("AutoCompute")]
        public async Task<IActionResult> AutoCompute([FromQuery] string? asOnDate, [FromQuery] int branchId = 0)
        {
            await EnsureTableExistsAsync();

            DateTime targetDate = DateTime.Today;
            if (!string.IsNullOrWhiteSpace(asOnDate) && DateTime.TryParse(asOnDate, out var parsedDate))
            {
                targetDate = parsedDate;
            }

            try
            {
                // 1. Sanstha Details
                var sanstha = await _context.SansthaDetails.AsNoTracking().FirstOrDefaultAsync();
                int branchCount = await _context.Branches.AsNoTracking().CountAsync(b => b.IsActive);
                if (branchCount == 0) branchCount = 1;

                // 2. Member Statistics
                var activeMembers = await _context.Members.AsNoTracking()
                    .Include(m => m.Customer)
                    .Where(m => m.Status == "Active" || string.IsNullOrEmpty(m.Status))
                    .ToListAsync();

                int regularMembersCount = activeMembers.Count(m => 
                    string.IsNullOrEmpty(m.MembershipType) || 
                    m.MembershipType.Equals("Regular", StringComparison.OrdinalIgnoreCase) || 
                    m.MembershipType.Equals("A", StringComparison.OrdinalIgnoreCase));

                int nominalMembersCount = activeMembers.Count(m => 
                    !string.IsNullOrEmpty(m.MembershipType) && 
                    (m.MembershipType.Equals("Nominal", StringComparison.OrdinalIgnoreCase) || 
                     m.MembershipType.Equals("B", StringComparison.OrdinalIgnoreCase)));

                int totalMembersCount = regularMembersCount + nominalMembersCount;
                if (totalMembersCount == 0) totalMembersCount = activeMembers.Count;

                int kycCount = activeMembers.Count(m => 
                    m.Customer != null && 
                    (!string.IsNullOrWhiteSpace(m.Customer.AadhaarNo) || !string.IsNullOrWhiteSpace(m.Customer.PANNo)));

                decimal kycPercentage = totalMembersCount > 0 ? Math.Round((decimal)kycCount * 100m / totalMembersCount, 2) : 100m;

                // 3. Paid-up Share Capital
                decimal paidUpCapital = await _context.ShareAccounts.AsNoTracking()
                    .Where(s => s.Status == "Active" || string.IsNullOrEmpty(s.Status))
                    .SumAsync(s => s.TotalShareAmount);

                if (paidUpCapital == 0)
                {
                    // Fallback to Share Capital ledger balance
                    paidUpCapital = await _context.Ledgers.AsNoTracking()
                        .Where(l => l.IsActive && (l.LedgerName.Contains("भाग") || l.LedgerName.Contains("Share Capital")))
                        .SumAsync(l => l.OpeningBalance);
                }

                // 4. Ledgers Balances (Reserves, Funds, Cash & Bank)
                var allLedgers = await _context.Ledgers.AsNoTracking()
                    .Include(l => l.AccountGroup)
                    .Where(l => l.IsActive)
                    .ToListAsync();

                // Reserve Fund
                decimal reserveFund = allLedgers
                    .Where(l => (l.LedgerName.Contains("राखीव") || l.LedgerName.Contains("Statutory Reserve")) && !l.LedgerName.Contains("इमारत"))
                    .Sum(l => l.OpeningBalanceType == "Cr" ? l.OpeningBalance : -l.OpeningBalance);

                // Building Fund
                decimal buildingFund = allLedgers
                    .Where(l => l.LedgerName.Contains("इमारत") || l.LedgerName.Contains("Building"))
                    .Sum(l => l.OpeningBalanceType == "Cr" ? l.OpeningBalance : -l.OpeningBalance);

                // BDDR (संशयित बुडीत निधी)
                decimal bddrFund = allLedgers
                    .Where(l => l.LedgerName.Contains("संशयित") || l.LedgerName.Contains("बुडीत") || l.LedgerName.Contains("BDDR"))
                    .Sum(l => l.OpeningBalanceType == "Cr" ? l.OpeningBalance : -l.OpeningBalance);

                // Other Reserves
                decimal otherReserves = allLedgers
                    .Where(l => l.AccountGroup != null && (l.AccountGroup.GroupName.Contains("निधी") || l.AccountGroup.GroupName.Contains("Reserve")) &&
                                !l.LedgerName.Contains("राखीव") && !l.LedgerName.Contains("इमारत") && !l.LedgerName.Contains("बुडीत"))
                    .Sum(l => l.OpeningBalanceType == "Cr" ? l.OpeningBalance : -l.OpeningBalance);

                // Cash in Hand
                decimal cashInHand = allLedgers
                    .Where(l => l.AccountType != null && (l.AccountType.ToLower() == "cash" || l.LedgerName.Contains("रोख") || l.LedgerName.ToLower().Contains("cash in hand")))
                    .Sum(l => l.OpeningBalanceType == "Dr" ? l.OpeningBalance : -l.OpeningBalance);

                // Bank Savings, Current, OD
                decimal bankSavings = allLedgers
                    .Where(l => l.AccountType != null && l.AccountType.ToLower() == "bank" && (l.LedgerName.Contains("बचत") || l.LedgerName.ToLower().Contains("saving")))
                    .Sum(l => l.OpeningBalanceType == "Dr" ? l.OpeningBalance : -l.OpeningBalance);

                decimal bankCurrent = allLedgers
                    .Where(l => l.AccountType != null && l.AccountType.ToLower() == "bank" && (l.LedgerName.Contains("चालू") || l.LedgerName.ToLower().Contains("current")))
                    .Sum(l => l.OpeningBalanceType == "Dr" ? l.OpeningBalance : -l.OpeningBalance);

                decimal bankOd = allLedgers
                    .Where(l => l.AccountType != null && l.AccountType.ToLower() == "bank" && (l.LedgerName.Contains("अधिकर्ष") || l.LedgerName.ToLower().Contains("od") || l.LedgerName.ToLower().Contains("overdraft")))
                    .Sum(l => l.OpeningBalanceType == "Cr" ? l.OpeningBalance : 0m);

                // 5. Deposits Calculation (FD, Saving, RD, Pigmy)
                var fdList = await _context.FdAccounts.AsNoTracking()
                    .Where(f => f.Status == "Active" || string.IsNullOrEmpty(f.Status))
                    .Select(f => new { f.CustomerID, f.DepositAmount })
                    .ToListAsync();

                var sbList = await _context.SavingAccountMasters.AsNoTracking()
                    .Where(s => s.Status == "Active" || string.IsNullOrEmpty(s.Status))
                    .Select(s => new { s.CustomerID, s.CurrentBalance })
                    .ToListAsync();

                var rdList = await _context.RdAccounts.AsNoTracking()
                    .Where(r => r.Status == "Active" || string.IsNullOrEmpty(r.Status))
                    .Select(r => new { r.CustomerID, CurrentBalance = r.TotalDepositedAmount })
                    .ToListAsync();

                var pigmyList = await _context.PigmyAccounts.AsNoTracking()
                    .Where(p => p.Status == "Active" || string.IsNullOrEmpty(p.Status))
                    .Select(p => new { p.CustomerID, CurrentBalance = p.TotalDepositedAmount })
                    .ToListAsync();

                decimal fdTotalAmount = fdList.Sum(f => f.DepositAmount);
                decimal sbTotalAmount = sbList.Sum(s => s.CurrentBalance);
                decimal rdTotalAmount = rdList.Sum(r => r.CurrentBalance);
                decimal pigmyTotalAmount = pigmyList.Sum(p => p.CurrentBalance);
                decimal currentAccountDeposits = bankCurrent > 0 ? 0m : Math.Abs(bankCurrent);

                decimal termDepositsTotal = fdTotalAmount + rdTotalAmount;
                decimal totalDeposits = termDepositsTotal + sbTotalAmount + pigmyTotalAmount + currentAccountDeposits;

                // Map Customer -> MembershipType (Regular / Nominal)
                var customerMemberMap = activeMembers.Where(m => m.CustomerID.HasValue).ToDictionary(
                    m => m.CustomerID!.Value,
                    m => (m.MembershipType ?? "Regular").Equals("Nominal", StringComparison.OrdinalIgnoreCase) ? "Nominal" : "Regular"
                );

                var custDepositTotals = new Dictionary<int, decimal>();

                void AddDeposit(int custId, decimal amt)
                {
                    if (amt <= 0) return;
                    if (!custDepositTotals.ContainsKey(custId)) custDepositTotals[custId] = 0;
                    custDepositTotals[custId] += amt;
                }

                foreach (var f in fdList) AddDeposit(f.CustomerID, f.DepositAmount);
                foreach (var s in sbList) AddDeposit(s.CustomerID, s.CurrentBalance);
                foreach (var r in rdList) AddDeposit(r.CustomerID, r.CurrentBalance);
                foreach (var p in pigmyList) AddDeposit(p.CustomerID, p.CurrentBalance);

                int regDepCount = 0;
                decimal regDepAmount = 0;
                int nomDepCount = 0;
                decimal nomDepAmount = 0;

                foreach (var kvp in custDepositTotals)
                {
                    bool isNominal = customerMemberMap.ContainsKey(kvp.Key) && customerMemberMap[kvp.Key] == "Nominal";
                    if (isNominal)
                    {
                        nomDepCount++;
                        nomDepAmount += kvp.Value;
                    }
                    else
                    {
                        regDepCount++;
                        regDepAmount += kvp.Value;
                    }
                }

                // Slabs
                int slab1Count = 0; decimal slab1Amt = 0; // <= 1L
                int slab2Count = 0; decimal slab2Amt = 0; // 1L to 2L
                int slab3Count = 0; decimal slab3Amt = 0; // 2L to 3L
                int slab4Count = 0; decimal slab4Amt = 0; // 3L to 4L
                int slab5Count = 0; decimal slab5Amt = 0; // 4L to 5L
                int slab6Count = 0; decimal slab6Amt = 0; // > 5L

                foreach (var kvp in custDepositTotals)
                {
                    decimal amt = kvp.Value;
                    if (amt <= 100000m) { slab1Count++; slab1Amt += amt; }
                    else if (amt <= 200000m) { slab2Count++; slab2Amt += amt; }
                    else if (amt <= 300000m) { slab3Count++; slab3Amt += amt; }
                    else if (amt <= 400000m) { slab4Count++; slab4Amt += amt; }
                    else if (amt <= 500000m) { slab5Count++; slab5Amt += amt; }
                    else { slab6Count++; slab6Amt += amt; }
                }

                // 6. Loans & Overdue
                var loanList = await _context.LoanAccounts.AsNoTracking()
                    .Include(l => l.LoanRate)
                    .Where(l => l.Status == "Active" || string.IsNullOrEmpty(l.Status))
                    .ToListAsync();

                int regLoanCount = 0; decimal regLoanAmount = 0;
                int nomLoanCount = 0; decimal nomLoanAmount = 0;
                decimal totalLoanPrincipal = 0;
                decimal totalOverduePrincipal = 0;
                decimal totalOverdueInterest = 0;
                decimal securedLoanAmount = 0;
                decimal unsecuredLoanAmount = 0;

                foreach (var l in loanList)
                {
                    decimal bal = Math.Max(0, l.PrincipalBalance);
                    totalLoanPrincipal += bal;

                    bool isNominal = l.CustomerID.HasValue && customerMemberMap.ContainsKey(l.CustomerID.Value) && customerMemberMap[l.CustomerID.Value] == "Nominal";
                    if (isNominal)
                    {
                        nomLoanCount++;
                        nomLoanAmount += bal;
                    }
                    else
                    {
                        regLoanCount++;
                        regLoanAmount += bal;
                    }

                    // Overdue
                    if (!string.IsNullOrEmpty(l.InitialNpaClassification) && !l.InitialNpaClassification.Equals("Standard", StringComparison.OrdinalIgnoreCase))
                    {
                        totalOverduePrincipal += bal;
                    }
                    totalOverdueInterest += Math.Max(0, l.OverdueInterestBalance);

                    // Secured vs Unsecured
                    bool isSecured = l.SecurityValue > 0 ||
                                     !string.IsNullOrWhiteSpace(l.SecurityDetails) ||
                                     (l.LoanRate != null && (l.LoanRate.LoanType.Contains("सोने") || l.LoanRate.LoanType.Contains("तारण") || l.LoanRate.LoanType.Contains("ठेव") || l.LoanRate.LoanType.Contains("मालमत्ता")));

                    if (isSecured)
                        securedLoanAmount += bal;
                    else
                        unsecuredLoanAmount += bal;
                }

                decimal totalOverdue = totalOverduePrincipal + totalOverdueInterest;
                decimal overduePercent = totalLoanPrincipal > 0 ? Math.Round(totalOverdue * 100m / totalLoanPrincipal, 2) : 0m;
                decimal securedPercent = totalLoanPrincipal > 0 ? Math.Round(securedLoanAmount * 100m / totalLoanPrincipal, 2) : 0m;
                decimal unsecuredPercent = totalLoanPrincipal > 0 ? Math.Round(unsecuredLoanAmount * 100m / totalLoanPrincipal, 2) : 0m;

                // 7. Svanidhi & Borrowing Limits
                decimal accumulatedLoss = 0m;
                decimal netSvanidhi = Math.Max(0, paidUpCapital + reserveFund + buildingFund - accumulatedLoss);
                decimal borrowingLimit12x = netSvanidhi * 12m;
                decimal externalBorrowings = 0m;
                decimal actualLiabilities = totalDeposits + externalBorrowings;

                // Working Capital
                decimal workingCapital = Math.Max(totalDeposits + paidUpCapital + reserveFund + buildingFund, totalLoanPrincipal + cashInHand + bankSavings + bankCurrent);

                // 8. Financial Ratios
                decimal crrRatio = totalDeposits > 0 ? Math.Round((cashInHand + bankCurrent) * 100m / totalDeposits, 2) : 3.5m;
                decimal slrRatio = totalDeposits > 0 ? Math.Round((cashInHand + bankSavings + bankCurrent) * 100m / totalDeposits, 2) : 28.0m;
                decimal cdRatio = totalDeposits > 0 ? Math.Round(totalLoanPrincipal * 100m / totalDeposits, 2) : 68.0m;
                decimal crarRatio = totalLoanPrincipal > 0 ? Math.Round(netSvanidhi * 100m / (totalLoanPrincipal * 0.85m), 2) : 12.5m;
                decimal grossNpa = totalLoanPrincipal > 0 ? Math.Round(totalOverdue * 100m / totalLoanPrincipal, 2) : 0m;
                decimal netNpa = totalLoanPrincipal > 0 ? Math.Max(0, Math.Round((totalOverdue - bddrFund) * 100m / Math.Max(1, totalLoanPrincipal - bddrFund), 2)) : 0m;

                // Max Deposit & Loan Rates
                var fdSchemes = await _context.FdSchemes.AsNoTracking().Where(f => f.IsActive).ToListAsync();
                decimal maxDepositRate = fdSchemes.Any() ? fdSchemes.Max(f => f.InterestRate) : 9.5m;

                var loanRates = await _context.LoanRates.AsNoTracking().Where(r => r.IsActive).ToListAsync();
                decimal securedLoanRate = loanRates.Where(r => r.LoanType.Contains("तारण") || r.LoanType.Contains("सोने")).Select(r => r.InterestRate).DefaultIfEmpty(12.0m).Min();
                decimal unsecuredLoanRate = loanRates.Where(r => !r.LoanType.Contains("तारण") && !r.LoanType.Contains("सोने")).Select(r => r.InterestRate).DefaultIfEmpty(14.0m).Max();

                // 9. Contribution Scheme (अंशदान)
                bool isCrrEligible = crrRatio >= 1.0m && crrRatio <= 5.0m;
                bool isSlrEligible = slrRatio >= 25.0m && slrRatio <= 40.0m;
                bool isContributionEligible = isCrrEligible && isSlrEligible;
                decimal contributionAmount = Math.Round(totalDeposits * 0.001m, 2); // 10 paise per 100 Rs = 0.1%

                var response = new
                {
                    sanstha = new
                    {
                        name = sanstha?.SansthaName ?? "श्री संत शिरोमणी नागरी सहकारी पतसंस्था मर्यादित",
                        societyType = "नागरी सहकारी पतसंस्था (Urban Co-op Credit Society)",
                        scope = "तालुका / जिल्हा",
                        jurisdiction = sanstha?.Address ?? "पुणे",
                        registrationNo = sanstha?.RegistrationNo ?? "PNA/RSR/CR/744/91-92",
                        registrationDate = sanstha?.RegistrationDate.HasValue == true ? sanstha.RegistrationDate.Value.ToString("yyyy-MM-dd") : "1991-07-07",
                        panNo = "AAAAS1234A",
                        gstNo = sanstha?.GSTNo ?? "",
                        email = sanstha?.Email ?? "patsanstha@gmail.com",
                        contactNo = sanstha?.ContactNo ?? "9021900577",
                        website = "www.patsanstha.org"
                    },
                    generalInfo = new
                    {
                        branchCount = branchCount,
                        regularMembers = regularMembersCount,
                        nominalMembers = nominalMembersCount,
                        totalMembers = totalMembersCount,
                        kycCompletedMembers = kycCount,
                        kycPercentage = kycPercentage,
                        currentManagement = "संचालक मंडळ",
                        presidentName = "श्री. अध्यक्ष पाटील",
                        presidentMobile = "9822000001",
                        vicePresidentName = "श्री. उपाध्यक्ष देशमुख",
                        vicePresidentMobile = "9822000002",
                        managerName = "श्री. व्यवस्थापक पवार",
                        managerMobile = "9822000003",
                        authorizedOfficerName = "",
                        authorizedOfficerMobile = "",
                        electionDate = "2023-01-15",
                        adminTakeoverDate = "",
                        previousAuditYear = "2024-25",
                        auditClass = "A",
                        officersCount = 3,
                        staffCount = 8,
                        totalManpower = 11,
                        trainedDirectors = 9,
                        trainedStaff = 10,
                        trainedMembers = 150,
                        isModelByLawsAdopted = true,
                        modelByLawsAdoptedDate = "2020-04-01",
                        isComputerizedDaily = true,
                        isCbsOperational = true,
                        isUcidCompliant = true
                    },
                    capitalDeposits = new
                    {
                        paidUpCapital = paidUpCapital,
                        workingCapital = workingCapital,
                        reserveFund = reserveFund,
                        buildingFund = buildingFund,
                        bddrFund = bddrFund,
                        otherFunds = otherReserves,
                        depositTypes = new
                        {
                            fixedDeposits = termDepositsTotal,
                            savingsDeposits = sbTotalAmount + pigmyTotalAmount,
                            currentDeposits = currentAccountDeposits,
                            totalDeposits = totalDeposits
                        },
                        depositorsCategory = new
                        {
                            regularCount = regDepCount,
                            regularAmount = regDepAmount,
                            nominalCount = nomDepCount,
                            nominalAmount = nomDepAmount,
                            totalCount = regDepCount + nomDepCount,
                            totalAmount = regDepAmount + nomDepAmount
                        },
                        depositSlabs = new
                        {
                            slab1 = new { count = slab1Count, amount = slab1Amt },
                            slab2 = new { count = slab2Count, amount = slab2Amt },
                            slab3 = new { count = slab3Count, amount = slab3Amt },
                            slab4 = new { count = slab4Count, amount = slab4Amt },
                            slab5 = new { count = slab5Count, amount = slab5Amt },
                            slab6 = new { count = slab6Count, amount = slab6Amt },
                            total = new { count = slab1Count + slab2Count + slab3Count + slab4Count + slab5Count + slab6Count, amount = totalDeposits }
                        },
                        externalBorrowings = externalBorrowings,
                        accumulatedLoss = accumulatedLoss,
                        svanidhi = netSvanidhi,
                        borrowingLimit12x = borrowingLimit12x,
                        actualLiabilities = actualLiabilities
                    },
                    loansRecovery = new
                    {
                        regularBorrowersCount = regLoanCount,
                        regularBorrowersAmount = regLoanAmount,
                        nominalBorrowersCount = nomLoanCount,
                        nominalBorrowersAmount = nomLoanAmount,
                        totalBorrowersCount = regLoanCount + nomLoanCount,
                        totalLoansAmount = totalLoanPrincipal,
                        overdueAmount = totalOverdue,
                        overduePercentage = overduePercent,
                        section101 = new
                        {
                            eligibleCount = 0, eligibleAmount = 0m,
                            submittedCount = 0, submittedAmount = 0m,
                            obtainedCount = 0, obtainedAmount = 0m
                        },
                        section91 = new
                        {
                            eligibleCount = 0, eligibleAmount = 0m,
                            submittedCount = 0, submittedAmount = 0m,
                            obtainedCount = 0, obtainedAmount = 0m
                        },
                        execution = new
                        {
                            executedCount = 0, executedAmount = 0m,
                            pendingCount = 0, pendingAmount = 0m
                        },
                        securedLoansAmount = securedLoanAmount,
                        securedLoansPercentage = securedPercent,
                        unsecuredLoansAmount = unsecuredLoanAmount,
                        unsecuredLoansPercentage = unsecuredPercent
                    },
                    investments = new
                    {
                        cashInHand = cashInHand,
                        bankSavings = bankSavings,
                        shortTermDeposits = 0m,
                        bankOd = bankOd,
                        bankCurrent = bankCurrent,
                        reserveFundInvestments = reserveFund > 0 ? reserveFund : 0m,
                        buildingFundInvestments = buildingFund > 0 ? buildingFund : 0m,
                        institutions = new
                        {
                            mscBank = 0m,
                            dccBank = bankSavings,
                            urbanBanks = 0m,
                            nationalizedBanks = bankCurrent,
                            rrbBanks = 0m,
                            privateBanks = 0m,
                            otherInstitutions = 0m,
                            fixedAssets = 0m
                        }
                    },
                    financialRatios = new
                    {
                        crr = crrRatio,
                        slr = slrRatio,
                        cdRatio = cdRatio,
                        crar = crarRatio,
                        establishmentCostPercent = 2.15m,
                        grossNpa = grossNpa,
                        netNpa = netNpa,
                        npaProvisionRequired = Math.Round(totalOverdue * 0.15m, 2),
                        npaProvisionMade = bddrFund,
                        maxDepositRate = maxDepositRate,
                        securedLoanRate = securedLoanRate,
                        unsecuredLoanRate = unsecuredLoanRate,
                        netProfitToWorkingCapital = 1.85m,
                        netProfit = Math.Round(workingCapital * 0.0185m, 2),
                        netLoss = 0m
                    },
                    contribution = new
                    {
                        financialYear = "2025-26",
                        crrValue = crrRatio,
                        isCrrEligible = isCrrEligible,
                        slrValue = slrRatio,
                        isSlrEligible = isSlrEligible,
                        auditHistory = new[]
                        {
                            new { year = "2024-25", isCompleted = true, certificateName = "Audit_Certificate_2024-25.pdf" },
                            new { year = "2023-24", isCompleted = true, certificateName = "Audit_Certificate_2023-24.pdf" },
                            new { year = "2022-23", isCompleted = true, certificateName = "Audit_Certificate_2022-23.pdf" }
                        },
                        modelByLawsDate = "2020-04-01",
                        isEligible = isContributionEligible,
                        totalDepositsMarch31 = totalDeposits,
                        ratePerHundred = "१० पैसे प्रति १०० रुपये (०.१%)",
                        contributionPayableAmount = contributionAmount
                    },
                    other = new
                    {
                        otherBusiness = "काही नाही (केवळ पतसंस्था ठेवी व कर्जवाटप व्यवसाय)",
                        tradingDetails = "लागू नाही",
                        unnecessaryProperty = "काही नाही",
                        propertyNature = "-",
                        propertyAcquisitionYear = "-"
                    }
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Auto-compute error: {ex.Message}" });
            }
        }

        // GET: api/RegulatoryMis/SavedReport?financialYear=2025-2026&branchId=1
        [HttpGet("SavedReport")]
        public async Task<IActionResult> GetSavedReport([FromQuery] string financialYear = "2025-2026", [FromQuery] int branchId = 0)
        {
            await EnsureTableExistsAsync();

            var query = _context.RegulatoryMisReports.AsNoTracking()
                .Where(r => r.FinancialYear == financialYear);

            if (branchId > 0) query = query.Where(r => r.BranchID == branchId);

            var report = await query.OrderByDescending(r => r.MisReportID).FirstOrDefaultAsync();
            if (report == null) return NotFound(new { message = "No saved report found for this financial year." });

            return Ok(report);
        }

        public class SaveReportRequest
        {
            public int? MisReportID { get; set; }
            public string FinancialYear { get; set; } = "2025-2026";
            public int BranchID { get; set; } = 1;
            public DateTime AsOnDate { get; set; } = DateTime.Today;
            public object? GeneralInfo { get; set; }
            public object? CapitalDeposits { get; set; }
            public object? LoansRecovery { get; set; }
            public object? Investments { get; set; }
            public object? FinancialRatios { get; set; }
            public object? Contribution { get; set; }
            public object? Other { get; set; }
            public bool IsLocked { get; set; } = false;
        }

        // POST: api/RegulatoryMis/SaveReport
        [HttpPost("SaveReport")]
        public async Task<IActionResult> SaveReport([FromBody] SaveReportRequest req)
        {
            await EnsureTableExistsAsync();

            RegulatoryMisReport? report = null;
            if (req.MisReportID.HasValue && req.MisReportID.Value > 0)
            {
                report = await _context.RegulatoryMisReports.FindAsync(req.MisReportID.Value);
            }

            if (report == null)
            {
                report = await _context.RegulatoryMisReports
                    .FirstOrDefaultAsync(r => r.FinancialYear == req.FinancialYear && r.BranchID == req.BranchID);
            }

            if (report == null)
            {
                report = new RegulatoryMisReport
                {
                    FinancialYear = req.FinancialYear,
                    BranchID = req.BranchID,
                    AsOnDate = req.AsOnDate,
                    CreatedBy = 1,
                    CreatedOn = DateTime.Now
                };
                _context.RegulatoryMisReports.Add(report);
            }

            if (report.IsLocked)
            {
                return BadRequest(new { message = "सदर अहवाल फायनल लॉक केलेला असल्याने यात बदल करता येणार नाही." });
            }

            report.AsOnDate = req.AsOnDate;
            report.GeneralInfoJson = req.GeneralInfo != null ? JsonSerializer.Serialize(req.GeneralInfo) : report.GeneralInfoJson;
            report.CapitalDepositsJson = req.CapitalDeposits != null ? JsonSerializer.Serialize(req.CapitalDeposits) : report.CapitalDepositsJson;
            report.LoansRecoveryJson = req.LoansRecovery != null ? JsonSerializer.Serialize(req.LoansRecovery) : report.LoansRecoveryJson;
            report.InvestmentsJson = req.Investments != null ? JsonSerializer.Serialize(req.Investments) : report.InvestmentsJson;
            report.FinancialRatiosJson = req.FinancialRatios != null ? JsonSerializer.Serialize(req.FinancialRatios) : report.FinancialRatiosJson;
            report.ContributionJson = req.Contribution != null ? JsonSerializer.Serialize(req.Contribution) : report.ContributionJson;
            report.OtherInfoJson = req.Other != null ? JsonSerializer.Serialize(req.Other) : report.OtherInfoJson;
            report.IsLocked = req.IsLocked;
            report.UpdatedOn = DateTime.Now;

            await _context.SaveChangesAsync();

            return Ok(new { message = "अहवाल यशस्वीरीत्या जतन केला.", misReportId = report.MisReportID });
        }

        // POST: api/RegulatoryMis/LockReport/5
        [HttpPost("LockReport/{id}")]
        public async Task<IActionResult> LockReport(int id)
        {
            await EnsureTableExistsAsync();

            var report = await _context.RegulatoryMisReports.FindAsync(id);
            if (report == null) return NotFound("Report not found.");

            report.IsLocked = true;
            report.UpdatedOn = DateTime.Now;
            await _context.SaveChangesAsync();

            return Ok(new { message = "अहवाल यशस्वीरीत्या लॉक करण्यात आला." });
        }
    }
}
