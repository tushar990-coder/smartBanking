using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Bhisi.Api.Controllers;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Caching.Memory;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class FdDepositStatusAndAsOfSnapshotTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"BhisiFdStatusAsOf_{Guid.NewGuid()}")
                .ConfigureWarnings(x => x.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ClaimsPrincipal BuildPrincipal(int userId, string username, string role, int branchId)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Name, username),
                new Claim(ClaimTypes.Role, role),
                new Claim("BranchID", branchId.ToString()),
                new Claim("DefaultBranchID", branchId.ToString())
            };
            return new ClaimsPrincipal(new ClaimsIdentity(claims, "TestJwt"));
        }

        private static void AttachUser(ControllerBase controller, ClaimsPrincipal principal)
        {
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = principal }
            };
        }

        private static JsonElement ParseOkJson(IActionResult actionResult)
        {
            var ok = Assert.IsType<OkObjectResult>(actionResult);
            var json = JsonSerializer.Serialize(ok.Value);
            return JsonDocument.Parse(json).RootElement;
        }

        private static async Task SeedBaseDataAsync(AppDbContext db)
        {
            db.Branches.AddRange(
                new Branch { BranchID = 1, BranchCode = "BR01", BranchName = "मुख्य शाखा (HO)", BranchType = "HeadOffice", IsActive = true },
                new Branch { BranchID = 2, BranchCode = "BR02", BranchName = "शाखा २", BranchType = "Branch", IsActive = true }
            );

            db.SansthaDetails.Add(new SansthaDetail
            {
                SansthaID = 1,
                SansthaName = "टेस्ट नागरी पतसंस्था",
                RegistrationNo = "REG-001",
                ContactNo = "9999999999"
            });

            db.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "2025-2026",
                StartDate = DateTime.Today.AddYears(-1),
                EndDate = DateTime.Today.AddYears(1),
                IsActive = true
            });

            db.AccountGroups.AddRange(
                new AccountGroup { GroupID = 1, GroupName = "रोख व बँक (Cash & Bank)", NatureOfGroup = "Assets", IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "भागभांडवल (Capital)", NatureOfGroup = "Liabilities", IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 1, GroupID = 1, LedgerCode = "CASH", LedgerName = "रोख शिल्लक", AccountType = "Cash", IsActive = true },
                new Ledger { LedgerID = 2, GroupID = 2, LedgerCode = "SHARE", LedgerName = "भाग भांडवल", AccountType = "Liability", IsActive = true }
            );

            db.SwanidhiLedgerMappings.Add(new SwanidhiLedgerMapping
            {
                MappingID = 1,
                CategoryCode = "PAID_UP_CAPITAL",
                CategoryName = "भाग भांडवल",
                LedgerID = 2
            });

            db.SwanidhiSettings.Add(new SwanidhiSetting
            {
                SettingID = 1,
                BranchID = 1,
                BorrowingLimitMultiplier = 10m
            });

            db.Customers.AddRange(
                new Customer { CustomerID = 1, BranchID = 1, FirstName = "राम", LastName = "पाटील", CIFNo = "CIF001" },
                new Customer { CustomerID = 2, BranchID = 2, FirstName = "श्याम", LastName = "देशमुख", CIFNo = "CIF002" }
            );

            db.Members.AddRange(
                new Member { MemberID = 1, BranchID = 1, CustomerID = 1, MemberCode = "M001", Status = "Active", MembershipType = "Regular" },
                new Member { MemberID = 2, BranchID = 2, CustomerID = 2, MemberCode = "M002", Status = "Active", MembershipType = "Regular" }
            );

            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task MultiCycleRenewal_NoDoubleCounting_AcrossStatutoryReportsAndDashboard()
        {
            await using var db = CreateContext();
            await SeedBaseDataAsync(db);

            // 3-cycle renewal chain: Cycle 0 (Renewed 1,00,000) -> Cycle 1 (Renewed 1,07,000) -> Cycle 2 (Active 1,15,000)
            db.FdAccounts.AddRange(
                new FdAccount
                {
                    FdAccountID = 10,
                    BranchID = 1,
                    CustomerID = 1,
                    AccountNo = "FD-C0",
                    OpeningDate = DateTime.Today.AddDays(-400),
                    MaturityDate = DateTime.Today.AddDays(-200),
                    DepositAmount = 100000m,
                    InterestRate = 7.0m,
                    Status = "Renewed",
                    RenewalCycleNo = 0,
                    ModifiedDate = DateTime.Today.AddDays(-200)
                },
                new FdAccount
                {
                    FdAccountID = 11,
                    BranchID = 1,
                    CustomerID = 1,
                    AccountNo = "FD-C1",
                    OpeningDate = DateTime.Today.AddDays(-200),
                    MaturityDate = DateTime.Today.AddDays(-10),
                    DepositAmount = 107000m,
                    InterestRate = 7.5m,
                    Status = "Renewed",
                    ParentFdAccountID = 10,
                    RootFdAccountID = 10,
                    RenewalCycleNo = 1,
                    ModifiedDate = DateTime.Today.AddDays(-10)
                },
                new FdAccount
                {
                    FdAccountID = 12,
                    BranchID = 1,
                    CustomerID = 1,
                    AccountNo = "FD-C2",
                    OpeningDate = DateTime.Today.AddDays(-10),
                    MaturityDate = DateTime.Today.AddDays(355),
                    DepositAmount = 115000m,
                    InterestRate = 8.0m,
                    Status = "Active",
                    ParentFdAccountID = 11,
                    RootFdAccountID = 10,
                    RenewalCycleNo = 2
                }
            );

            db.FdTransactions.AddRange(
                new FdTransaction { FdTransactionID = 1, BranchID = 1, FdAccountID = 10, VoucherID = 1, TransactionDate = DateTime.Today.AddDays(-200), TransactionType = "Renewal", DebitCredit = "Dr", Amount = 107000m },
                new FdTransaction { FdTransactionID = 2, BranchID = 1, FdAccountID = 11, VoucherID = 2, TransactionDate = DateTime.Today.AddDays(-10), TransactionType = "Renewal", DebitCredit = "Dr", Amount = 115000m }
            );
            await db.SaveChangesAsync();

            var hoUser = BuildPrincipal(1, "admin", "SuperAdmin", 1);

            var crrCtrl = new CrrReportController(db);
            AttachUser(crrCtrl, hoUser);
            var crrSummary = ParseOkJson(await crrCtrl.GetSummary(DateTime.Today.ToString("yyyy-MM-dd"), branchId: 0));
            Assert.Equal(115000m, crrSummary.GetProperty("depositBreakup").GetProperty("fixedDeposits").GetDecimal());
            Assert.Equal(115000m, crrSummary.GetProperty("totalDeposits").GetDecimal());

            var crrDaily = ParseOkJson(await crrCtrl.GetDailyStatement(DateTime.Today.AddDays(-1).ToString("yyyy-MM-dd"), DateTime.Today.ToString("yyyy-MM-dd"), branchId: 0));
            Assert.Equal(115000m, crrDaily.GetProperty("rows")[0].GetProperty("totalDeposits").GetDecimal());

            var auditCtrl = new AuditComplianceController(db);
            AttachUser(auditCtrl, hoUser);
            var cdRatio = ParseOkJson(await auditCtrl.GetCdRatio(branchId: 0));
            Assert.Equal(115000m, cdRatio.GetProperty("FdDeposits").GetDecimal());

            var crrSlr = ParseOkJson(await auditCtrl.GetCrrSlr(branchId: 0, asOnDate: DateTime.Today));
            Assert.Equal(115000m, crrSlr.GetProperty("TotalDeposits").GetDecimal());

            var swanidhiCtrl = new SwanidhiController(db);
            AttachUser(swanidhiCtrl, hoUser);
            var swanidhi = ParseOkJson(await swanidhiCtrl.GetReport(asOnDate: DateTime.Today, branchId: 0, customMultiplier: null));
            Assert.Equal(115000m, swanidhi.GetProperty("BorrowingCapacity").GetProperty("FdBalance").GetDecimal());

            var misCtrl = new RegulatoryMisController(db);
            AttachUser(misCtrl, hoUser);
            var mis = ParseOkJson(await misCtrl.AutoCompute(DateTime.Today.ToString("yyyy-MM-dd"), branchId: 0));
            Assert.Equal(115000m, mis.GetProperty("capitalDeposits").GetProperty("depositTypes").GetProperty("fixedDeposits").GetDecimal());

            using var cache = new MemoryCache(new MemoryCacheOptions());
            var dashCtrl = new DashboardController(db, cache);
            AttachUser(dashCtrl, hoUser);
            var dash = ParseOkJson(await dashCtrl.GetDashboard(branchId: null, refresh: true));
            var fdNode = dash.GetProperty("fixedDeposit");
            Assert.Equal(3, fdNode.GetProperty("totalAccounts").GetInt32());
            Assert.Equal(1, fdNode.GetProperty("activeAccounts").GetInt32());
            Assert.Equal(115000m, fdNode.GetProperty("totalBalance").GetDecimal());
            Assert.Equal(0, fdNode.GetProperty("maturedUnclosedAccounts").GetInt32());
        }

        [Fact]
        public async Task UnclosedMaturedDeposits_AreIncludedEverywhere_WhileClosedAndRenewedExcluded()
        {
            await using var db = CreateContext();
            await SeedBaseDataAsync(db);

            db.FdAccounts.AddRange(
                new FdAccount { FdAccountID = 20, BranchID = 1, CustomerID = 1, AccountNo = "FD-ACT", OpeningDate = DateTime.Today.AddDays(-90), MaturityDate = DateTime.Today.AddDays(90), DepositAmount = 100000m, InterestRate = 7m, Status = "Active" },
                new FdAccount { FdAccountID = 21, BranchID = 1, CustomerID = 1, AccountNo = "FD-MAT", OpeningDate = DateTime.Today.AddDays(-400), MaturityDate = DateTime.Today.AddDays(-5), DepositAmount = 50000m, InterestRate = 7m, Status = "Matured" },
                new FdAccount { FdAccountID = 22, BranchID = 1, CustomerID = 1, AccountNo = "FD-REN", OpeningDate = DateTime.Today.AddDays(-500), MaturityDate = DateTime.Today.AddDays(-100), DepositAmount = 80000m, InterestRate = 7m, Status = "Renewed" },
                new FdAccount { FdAccountID = 23, BranchID = 1, CustomerID = 1, AccountNo = "FD-CLS", OpeningDate = DateTime.Today.AddDays(-500), MaturityDate = DateTime.Today.AddDays(-100), DepositAmount = 30000m, InterestRate = 7m, Status = "Closed" }
            );

            db.RdAccounts.AddRange(
                new RdAccount { RdAccountID = 30, BranchID = 1, CustomerID = 1, AccountNo = "RD-ACT", OpeningDate = DateTime.Today.AddDays(-60), MaturityDate = DateTime.Today.AddDays(300), InstallmentAmount = 1000m, DurationMonths = 12, InterestRate = 7m, TotalDepositedAmount = 10000m, Status = "Active" },
                new RdAccount { RdAccountID = 31, BranchID = 1, CustomerID = 1, AccountNo = "RD-MAT", OpeningDate = DateTime.Today.AddDays(-400), MaturityDate = DateTime.Today.AddDays(-10), InstallmentAmount = 2000m, DurationMonths = 12, InterestRate = 7m, TotalDepositedAmount = 25000m, Status = "Matured" },
                new RdAccount { RdAccountID = 32, BranchID = 1, CustomerID = 1, AccountNo = "RD-CLS", OpeningDate = DateTime.Today.AddDays(-500), MaturityDate = DateTime.Today.AddDays(-50), InstallmentAmount = 1000m, DurationMonths = 12, InterestRate = 7m, TotalDepositedAmount = 12000m, Status = "Closed" }
            );

            db.PigmyAccounts.AddRange(
                new PigmyAccount { PigmyAccountID = 40, BranchID = 1, CustomerID = 1, AccountNo = "PG-MAT", OpeningDate = DateTime.Today.AddDays(-400), MaturityDate = DateTime.Today.AddDays(-5), InterestRate = 5m, TotalDepositedAmount = 15000m, Status = "Matured" },
                new PigmyAccount { PigmyAccountID = 41, BranchID = 1, CustomerID = 1, AccountNo = "PG-CLS", OpeningDate = DateTime.Today.AddDays(-500), MaturityDate = DateTime.Today.AddDays(-50), InterestRate = 5m, TotalDepositedAmount = 9000m, Status = "Closed" }
            );

            await db.SaveChangesAsync();

            var hoUser = BuildPrincipal(1, "admin", "SuperAdmin", 1);

            var crrCtrl = new CrrReportController(db);
            AttachUser(crrCtrl, hoUser);
            var crr = ParseOkJson(await crrCtrl.GetSummary(DateTime.Today.ToString("yyyy-MM-dd"), branchId: 0));
            Assert.Equal(150000m, crr.GetProperty("depositBreakup").GetProperty("fixedDeposits").GetDecimal());
            Assert.Equal(35000m, crr.GetProperty("depositBreakup").GetProperty("recurringDeposits").GetDecimal());
            Assert.Equal(15000m, crr.GetProperty("depositBreakup").GetProperty("pigmyDeposits").GetDecimal());
            Assert.Equal(200000m, crr.GetProperty("totalDeposits").GetDecimal());

            var auditCtrl = new AuditComplianceController(db);
            AttachUser(auditCtrl, hoUser);
            var cdRatio = ParseOkJson(await auditCtrl.GetCdRatio(branchId: 0));
            Assert.Equal(150000m, cdRatio.GetProperty("FdDeposits").GetDecimal());
            Assert.Equal(35000m, cdRatio.GetProperty("RdDeposits").GetDecimal());
            Assert.Equal(15000m, cdRatio.GetProperty("PigmyDeposits").GetDecimal());
            Assert.Equal(200000m, cdRatio.GetProperty("TotalDeposits").GetDecimal());

            var crrSlr = ParseOkJson(await auditCtrl.GetCrrSlr(branchId: 0, asOnDate: DateTime.Today));
            Assert.Equal(200000m, crrSlr.GetProperty("TotalDeposits").GetDecimal());

            var swanidhiCtrl = new SwanidhiController(db);
            AttachUser(swanidhiCtrl, hoUser);
            var swanidhi = ParseOkJson(await swanidhiCtrl.GetReport(asOnDate: DateTime.Today, branchId: 0, customMultiplier: null));
            Assert.Equal(150000m, swanidhi.GetProperty("BorrowingCapacity").GetProperty("FdBalance").GetDecimal());
            Assert.Equal(35000m, swanidhi.GetProperty("BorrowingCapacity").GetProperty("RdBalance").GetDecimal());
            Assert.Equal(15000m, swanidhi.GetProperty("BorrowingCapacity").GetProperty("PigmyBalance").GetDecimal());

            var misCtrl = new RegulatoryMisController(db);
            AttachUser(misCtrl, hoUser);
            var mis = ParseOkJson(await misCtrl.AutoCompute(DateTime.Today.ToString("yyyy-MM-dd"), branchId: 0));
            Assert.Equal(185000m, mis.GetProperty("capitalDeposits").GetProperty("depositTypes").GetProperty("fixedDeposits").GetDecimal()); // FD + RD
            Assert.Equal(200000m, mis.GetProperty("capitalDeposits").GetProperty("depositTypes").GetProperty("totalDeposits").GetDecimal());

            using var cache = new MemoryCache(new MemoryCacheOptions());
            var dashCtrl = new DashboardController(db, cache);
            AttachUser(dashCtrl, hoUser);
            var dash = ParseOkJson(await dashCtrl.GetDashboard(branchId: null, refresh: true));
            var fdNode = dash.GetProperty("fixedDeposit");
            Assert.Equal(4, fdNode.GetProperty("totalAccounts").GetInt32());
            Assert.Equal(2, fdNode.GetProperty("activeAccounts").GetInt32());
            Assert.Equal(150000m, fdNode.GetProperty("totalBalance").GetDecimal());
            Assert.Equal(1, fdNode.GetProperty("maturedUnclosedAccounts").GetInt32());
            Assert.Equal(50000m, fdNode.GetProperty("maturedUnclosedBalance").GetDecimal());

            var rdNode = dash.GetProperty("recurringDeposit");
            Assert.Equal(2, rdNode.GetProperty("activeAccounts").GetInt32());
            Assert.Equal(35000m, rdNode.GetProperty("totalBalance").GetDecimal());

            var pigmyNode = dash.GetProperty("pigmy");
            Assert.Equal(1, pigmyNode.GetProperty("activeAccounts").GetInt32());
            Assert.Equal(15000m, pigmyNode.GetProperty("totalBalance").GetDecimal());
        }

        [Fact]
        public async Task HistoricalAsOnDate_ReconstructsPreRenewalBalance_AndExcludesRevertedAutoRenewal()
        {
            await using var db = CreateContext();
            await SeedBaseDataAsync(db);

            var dayMinus10 = DateTime.Today.AddDays(-10);
            var dayMinus3 = DateTime.Today.AddDays(-3);
            var dayMinus2 = DateTime.Today.AddDays(-2);
            var dayMinus1 = DateTime.Today.AddDays(-1);

            // 1. FD renewed 2 days ago: before renewal (-10) = 1,00,000; from -2 onwards = 1,08,000
            db.FdAccounts.AddRange(
                new FdAccount
                {
                    FdAccountID = 50,
                    BranchID = 1,
                    CustomerID = 1,
                    AccountNo = "FD-OLD",
                    OpeningDate = DateTime.Today.AddDays(-365),
                    MaturityDate = dayMinus2,
                    DepositAmount = 100000m,
                    InterestRate = 8m,
                    Status = "Renewed"
                },
                new FdAccount
                {
                    FdAccountID = 51,
                    BranchID = 1,
                    CustomerID = 1,
                    AccountNo = "FD-NEW",
                    OpeningDate = dayMinus2,
                    MaturityDate = DateTime.Today.AddDays(363),
                    DepositAmount = 108000m,
                    InterestRate = 8m,
                    Status = "Active",
                    ParentFdAccountID = 50,
                    RootFdAccountID = 50,
                    RenewalCycleNo = 1
                },
                // 2. Unclosed Matured FD opened long ago
                new FdAccount
                {
                    FdAccountID = 52,
                    BranchID = 1,
                    CustomerID = 1,
                    AccountNo = "FD-MAT-OLD",
                    OpeningDate = DateTime.Today.AddDays(-400),
                    MaturityDate = DateTime.Today.AddDays(-30),
                    DepositAmount = 40000m,
                    InterestRate = 7m,
                    Status = "Matured"
                },
                // 3. Reverted auto-renewal pair: old restored to Matured (20,000), annulled new Closed (21,500)
                new FdAccount
                {
                    FdAccountID = 53,
                    BranchID = 1,
                    CustomerID = 1,
                    AccountNo = "FD-REV-OLD",
                    OpeningDate = DateTime.Today.AddDays(-300),
                    MaturityDate = dayMinus3,
                    DepositAmount = 20000m,
                    InterestRate = 7m,
                    Status = "Matured"
                },
                new FdAccount
                {
                    FdAccountID = 54,
                    BranchID = 1,
                    CustomerID = 1,
                    AccountNo = "FD-REV-NEW",
                    OpeningDate = dayMinus3,
                    MaturityDate = DateTime.Today.AddDays(362),
                    DepositAmount = 21500m,
                    InterestRate = 7m,
                    Status = "Closed",
                    ParentFdAccountID = 53
                }
            );

            db.FdTransactions.AddRange(
                new FdTransaction { FdTransactionID = 10, BranchID = 1, FdAccountID = 50, VoucherID = 10, TransactionDate = dayMinus2, TransactionType = "Renewal", DebitCredit = "Dr", Amount = 108000m },
                // Even if an orphaned Renewal tx stayed on reverted old account 53, current Status="Matured" keeps it live
                new FdTransaction { FdTransactionID = 11, BranchID = 1, FdAccountID = 53, VoucherID = 11, TransactionDate = dayMinus3, TransactionType = "Renewal", DebitCredit = "Dr", Amount = 21500m }
            );

            db.FdAutoRenewalLogs.Add(new FdAutoRenewalLog
            {
                LogID = 1,
                BranchID = 1,
                BatchDate = dayMinus3,
                OldFdAccountID = 53,
                NewFdAccountID = 54,
                OldAccountNo = "FD-REV-OLD",
                NewAccountNo = "FD-REV-NEW",
                CustomerID = 1,
                CustomerName = "राम पाटील",
                RenewedAmount = 21500m,
                AppliedRate = 7m,
                IsReverted = true,
                RevertedDate = dayMinus1,
                Status = "Reverted"
            });

            await db.SaveChangesAsync();

            var hoUser = BuildPrincipal(1, "admin", "SuperAdmin", 1);
            var crrCtrl = new CrrReportController(db);
            AttachUser(crrCtrl, hoUser);
            var auditCtrl = new AuditComplianceController(db);
            AttachUser(auditCtrl, hoUser);
            var swanidhiCtrl = new SwanidhiController(db);
            AttachUser(swanidhiCtrl, hoUser);
            var misCtrl = new RegulatoryMisController(db);
            AttachUser(misCtrl, hoUser);

            // As of -10 (before renewal): 1,00,000 + 40,000 + 20,000 = 1,60,000
            var crrBefore = ParseOkJson(await crrCtrl.GetSummary(dayMinus10.ToString("yyyy-MM-dd"), branchId: 0));
            Assert.Equal(160000m, crrBefore.GetProperty("totalDeposits").GetDecimal());

            var slrBefore = ParseOkJson(await auditCtrl.GetCrrSlr(branchId: 0, asOnDate: dayMinus10));
            Assert.Equal(160000m, slrBefore.GetProperty("TotalDeposits").GetDecimal());

            var swaBefore = ParseOkJson(await swanidhiCtrl.GetReport(asOnDate: dayMinus10, branchId: 0, customMultiplier: null));
            Assert.Equal(160000m, swaBefore.GetProperty("BorrowingCapacity").GetProperty("FdBalance").GetDecimal());

            var misBefore = ParseOkJson(await misCtrl.AutoCompute(dayMinus10.ToString("yyyy-MM-dd"), branchId: 0));
            Assert.Equal(160000m, misBefore.GetProperty("capitalDeposits").GetProperty("depositTypes").GetProperty("fixedDeposits").GetDecimal());

            // As of -2 (renewal completed, reverted new FD still excluded so no overlap): 1,08,000 + 40,000 + 20,000 = 1,68,000
            var crrOnRenewal = ParseOkJson(await crrCtrl.GetSummary(dayMinus2.ToString("yyyy-MM-dd"), branchId: 0));
            Assert.Equal(168000m, crrOnRenewal.GetProperty("totalDeposits").GetDecimal());

            // As of Today: 1,68,000
            var crrToday = ParseOkJson(await crrCtrl.GetSummary(DateTime.Today.ToString("yyyy-MM-dd"), branchId: 0));
            Assert.Equal(168000m, crrToday.GetProperty("totalDeposits").GetDecimal());
        }

        [Fact]
        public async Task MembersController_DeleteMember_BlocksUnclosedMaturedDeposits_AllowsRenewedAndClosed()
        {
            await using var db = CreateContext();
            await SeedBaseDataAsync(db);

            db.Customers.AddRange(
                new Customer { CustomerID = 101, BranchID = 1, FirstName = "M1", LastName = "Clean", CIFNo = "C101" },
                new Customer { CustomerID = 102, BranchID = 1, FirstName = "M2", LastName = "MatFd", CIFNo = "C102" },
                new Customer { CustomerID = 103, BranchID = 1, FirstName = "M3", LastName = "MatRd", CIFNo = "C103" },
                new Customer { CustomerID = 104, BranchID = 1, FirstName = "M4", LastName = "MatPg", CIFNo = "C104" }
            );

            db.Members.AddRange(
                new Member { MemberID = 101, BranchID = 1, CustomerID = 101, MemberCode = "M101", Status = "Active" },
                new Member { MemberID = 102, BranchID = 1, CustomerID = 102, MemberCode = "M102", Status = "Active" },
                new Member { MemberID = 103, BranchID = 1, CustomerID = 103, MemberCode = "M103", Status = "Active" },
                new Member { MemberID = 104, BranchID = 1, CustomerID = 104, MemberCode = "M104", Status = "Active" }
            );

            // Member 101 has only Renewed & Closed FDs -> safe to delete
            db.FdAccounts.AddRange(
                new FdAccount { FdAccountID = 201, BranchID = 1, CustomerID = 101, AccountNo = "FD-101R", OpeningDate = DateTime.Today.AddDays(-400), MaturityDate = DateTime.Today.AddDays(-100), DepositAmount = 10000m, InterestRate = 7m, Status = "Renewed" },
                new FdAccount { FdAccountID = 202, BranchID = 1, CustomerID = 101, AccountNo = "FD-101C", OpeningDate = DateTime.Today.AddDays(-100), MaturityDate = DateTime.Today.AddDays(-10), DepositAmount = 10700m, InterestRate = 7m, Status = "Closed" },
                // Member 102 has an unclosed Matured FD -> must be blocked
                new FdAccount { FdAccountID = 203, BranchID = 1, CustomerID = 102, AccountNo = "FD-102M", OpeningDate = DateTime.Today.AddDays(-400), MaturityDate = DateTime.Today.AddDays(-10), DepositAmount = 25000m, InterestRate = 7m, Status = "Matured" }
            );

            db.RdAccounts.Add(new RdAccount
            {
                RdAccountID = 204,
                BranchID = 1,
                CustomerID = 103,
                AccountNo = "RD-103M",
                OpeningDate = DateTime.Today.AddDays(-400),
                MaturityDate = DateTime.Today.AddDays(-10),
                InstallmentAmount = 1000m,
                DurationMonths = 12,
                InterestRate = 7m,
                TotalDepositedAmount = 12000m,
                Status = "Matured"
            });

            db.PigmyAccounts.Add(new PigmyAccount
            {
                PigmyAccountID = 205,
                BranchID = 1,
                CustomerID = 104,
                AccountNo = "PG-104M",
                OpeningDate = DateTime.Today.AddDays(-400),
                MaturityDate = DateTime.Today.AddDays(-10),
                InterestRate = 5m,
                TotalDepositedAmount = 8000m,
                Status = "Matured"
            });

            await db.SaveChangesAsync();

            var hoUser = BuildPrincipal(1, "admin", "SuperAdmin", 1);
            var membersCtrl = new MembersController(db);
            AttachUser(membersCtrl, hoUser);

            Assert.IsType<OkObjectResult>(await membersCtrl.DeleteMember(101));
            Assert.IsType<BadRequestObjectResult>(await membersCtrl.DeleteMember(102));
            Assert.IsType<BadRequestObjectResult>(await membersCtrl.DeleteMember(103));
            Assert.IsType<BadRequestObjectResult>(await membersCtrl.DeleteMember(104));
        }

        [Fact]
        public async Task BranchScopedQuery_IsolatesBranchLiveAndMaturedDeposits()
        {
            await using var db = CreateContext();
            await SeedBaseDataAsync(db);

            db.FdAccounts.AddRange(
                new FdAccount { FdAccountID = 301, BranchID = 1, CustomerID = 1, AccountNo = "FD-B1-A", OpeningDate = DateTime.Today.AddDays(-30), MaturityDate = DateTime.Today.AddDays(300), DepositAmount = 100000m, InterestRate = 7m, Status = "Active" },
                new FdAccount { FdAccountID = 302, BranchID = 1, CustomerID = 1, AccountNo = "FD-B1-M", OpeningDate = DateTime.Today.AddDays(-400), MaturityDate = DateTime.Today.AddDays(-5), DepositAmount = 25000m, InterestRate = 7m, Status = "Matured" },
                new FdAccount { FdAccountID = 303, BranchID = 2, CustomerID = 2, AccountNo = "FD-B2-A", OpeningDate = DateTime.Today.AddDays(-30), MaturityDate = DateTime.Today.AddDays(300), DepositAmount = 75000m, InterestRate = 7m, Status = "Active" },
                new FdAccount { FdAccountID = 304, BranchID = 2, CustomerID = 2, AccountNo = "FD-B2-M", OpeningDate = DateTime.Today.AddDays(-400), MaturityDate = DateTime.Today.AddDays(-5), DepositAmount = 15000m, InterestRate = 7m, Status = "Matured" }
            );
            await db.SaveChangesAsync();

            var hoUser = BuildPrincipal(1, "admin", "SuperAdmin", 1);
            var branch2User = BuildPrincipal(2, "mgr2", "BranchManager", 2);

            var crrHo = new CrrReportController(db);
            AttachUser(crrHo, hoUser);
            Assert.Equal(125000m, ParseOkJson(await crrHo.GetSummary(DateTime.Today.ToString("yyyy-MM-dd"), branchId: 1)).GetProperty("totalDeposits").GetDecimal());
            Assert.Equal(215000m, ParseOkJson(await crrHo.GetSummary(DateTime.Today.ToString("yyyy-MM-dd"), branchId: 0)).GetProperty("totalDeposits").GetDecimal());

            var crrB2 = new CrrReportController(db);
            AttachUser(crrB2, branch2User);
            Assert.Equal(90000m, ParseOkJson(await crrB2.GetSummary(DateTime.Today.ToString("yyyy-MM-dd"), branchId: 1)).GetProperty("totalDeposits").GetDecimal());
        }
    }
}
