using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Controllers;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Services;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class NpaEngineTests
    {
        private AppDbContext GetInMemoryDbContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            return new AppDbContext(options);
        }

        private async Task SeedBaseDataAsync(AppDbContext context)
        {
            context.Branches.Add(new Branch { BranchID = 1, BranchName = "HQ", BranchCode = "HQ" });

            context.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "2024-25",
                IsActive = true,
                StartDate = new DateTime(2024, 4, 1),
                EndDate = new DateTime(2025, 3, 31)
            });

            context.AccountGroups.AddRange(new[]
            {
                new AccountGroup { GroupID = 1, GroupName = "कर्जे", NatureOfGroup = "Assets", IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "मिळालेले व्याज", NatureOfGroup = "Income", IsActive = true },
                new AccountGroup { GroupID = 3, GroupName = "इतर येणे", NatureOfGroup = "Assets", IsActive = true },
                new AccountGroup { GroupID = 4, GroupName = "इतर देणे", NatureOfGroup = "Liabilities", IsActive = true }
            });

            context.Ledgers.AddRange(new[]
            {
                new Ledger { LedgerID = 71, LedgerName = "१ मेंबर कर्ज", GroupID = 1, IsActive = true },
                new Ledger { LedgerID = 196, LedgerName = "में व्याज मेंबर कर्जे", GroupID = 2, IsActive = true },
                new Ledger { LedgerID = 20, LedgerName = "थकीत व्याज येणे खाते", GroupID = 3, IsActive = true, ExcludeFromRule35Swanidhi = true },
                new Ledger { LedgerID = 21, LedgerName = "थकीत व्याज तरतूद खाते", GroupID = 4, IsActive = true, ExcludeFromRule35Swanidhi = true },
                new Ledger { LedgerID = 30, LedgerName = "थकीत वसुली खर्च येणे खाते", GroupID = 3, IsActive = true, ExcludeFromRule35Swanidhi = true },
                new Ledger { LedgerID = 31, LedgerName = "थकीत वसुली खर्च तरतूद खाते", GroupID = 4, IsActive = true, ExcludeFromRule35Swanidhi = true }
            });

            context.LoanRates.AddRange(new[]
            {
                new LoanRate { LoanRateID = 1, LoanType = "मेंबर कर्ज (Term)", LoanLedgerID = 71, InterestLedgerID = 196, OverdueInterestLedgerID = 196, InterestRate = 12m, IsCcOrOd = false, SecurityType = "स्थावर तारण" },
                new LoanRate { LoanRateID = 2, LoanType = "सोने तारण कर्ज", LoanLedgerID = 71, InterestLedgerID = 196, OverdueInterestLedgerID = 196, InterestRate = 10m, IsCcOrOd = false, SecurityType = "सोने तारण" }
            });

            var cust1 = new Customer { CustomerID = 1, FirstName = "Amit", LastName = "Patil", AadhaarNo = "111122223333", MobileNo = "9999999999" };
            var cust2 = new Customer { CustomerID = 2, FirstName = "Rahul", LastName = "Joshi", AadhaarNo = "444455556666", MobileNo = "8888888888" };
            context.Customers.AddRange(cust1, cust2);

            context.Members.AddRange(new[]
            {
                new Member { MemberID = 1, MemberCode = "M001", BranchID = 1, CustomerID = 1 },
                new Member { MemberID = 2, MemberCode = "M002", BranchID = 1, CustomerID = 2 }
            });

            await context.SaveChangesAsync();
        }

        [Fact]
        public async Task Test_Standard_180Day_ConcessionBoundary_And_NoRogueVouchers()
        {
            using var context = GetInMemoryDbContext();
            await SeedBaseDataAsync(context);

            var service = new NpaEngineService(context);
            var asOfDate = new DateTime(2025, 3, 31);

            var loan1 = new LoanAccount
            {
                LoanAccountID = 1,
                BranchID = 1,
                MemberID = 1,
                LoanRateID = 1,
                LoanAccountNo = "L-179",
                SanctionedAmount = 100000m,
                PrincipalBalance = 80000m,
                InterestBalance = 2000m,
                OpeningDate = new DateTime(2024, 4, 1),
                Status = "Active"
            };
            context.LoanAccounts.Add(loan1);

            context.LoanInstallmentSchedules.Add(new LoanInstallmentSchedule
            {
                ScheduleID = 1,
                LoanAccountID = 1,
                InstallmentNo = 1,
                DueDate = asOfDate.AddDays(-179),
                PrincipalAmount = 5000m,
                InterestAmount = 500m,
                TotalAmount = 5500m,
                BalanceAmount = 5500m,
                Status = "Pending"
            });

            var loan2 = new LoanAccount
            {
                LoanAccountID = 2,
                BranchID = 1,
                MemberID = 2,
                LoanRateID = 1,
                LoanAccountNo = "L-180",
                SanctionedAmount = 100000m,
                PrincipalBalance = 80000m,
                InterestBalance = 2000m,
                OpeningDate = new DateTime(2024, 4, 1),
                Status = "Active"
            };
            context.LoanAccounts.Add(loan2);

            context.LoanInstallmentSchedules.Add(new LoanInstallmentSchedule
            {
                ScheduleID = 2,
                LoanAccountID = 2,
                InstallmentNo = 1,
                DueDate = asOfDate.AddDays(-180),
                PrincipalAmount = 5000m,
                InterestAmount = 500m,
                TotalAmount = 5500m,
                BalanceAmount = 5500m,
                Status = "Pending"
            });

            await context.SaveChangesAsync();

            await service.RunClassificationAsync(asOfDate, "TestRunner");

            var status1 = await context.LoanAccountNpaStatuses.FirstOrDefaultAsync(s => s.LoanAccountID == 1);
            var status2 = await context.LoanAccountNpaStatuses.FirstOrDefaultAsync(s => s.LoanAccountID == 2);

            Assert.NotNull(status1);
            Assert.Equal("Standard", status1.Category);
            // Standard 0.25% strictly on Principal 80000 = 200
            Assert.Equal(200m, status1.ProvisionRequired);

            Assert.NotNull(status2);
            Assert.Equal("Sub-Standard", status2.Category);
            // FY 24-25 Sub-Standard 5% strictly on Principal 80000 = 4000 (Interest 2000 covered by 100% OIR)
            Assert.Equal(4000m, status2.ProvisionRequired);

            // Running NPA classification must NOT silently create unapproved HQ-JV vouchers
            Assert.Equal(0, await context.Vouchers.CountAsync());
        }

        [Fact]
        public async Task Test_Slab_Provisioning_PrincipalOnly_With_100Percent_OIR_ReconcilesRegisterAndStatement()
        {
            using var context = GetInMemoryDbContext();
            await SeedBaseDataAsync(context);

            var service = new NpaEngineService(context);
            var asOfDate = new DateTime(2025, 3, 31);

            var loan = new LoanAccount
            {
                LoanAccountID = 3,
                BranchID = 1,
                MemberID = 1,
                LoanRateID = 1,
                LoanAccountNo = "L-DOUBTFUL",
                SanctionedAmount = 100000m,
                PrincipalBalance = 80000m,
                InterestBalance = 20000m,
                OpeningDate = new DateTime(2023, 4, 1),
                Status = "Active"
            };
            context.LoanAccounts.Add(loan);

            context.LoanInstallmentSchedules.Add(new LoanInstallmentSchedule
            {
                ScheduleID = 3,
                LoanAccountID = 3,
                InstallmentNo = 1,
                DueDate = asOfDate.AddMonths(-20),
                PrincipalAmount = 80000m,
                InterestAmount = 20000m,
                TotalAmount = 100000m,
                BalanceAmount = 100000m,
                Status = "Pending"
            });

            context.CollateralComplianceLogs.Add(new CollateralComplianceLog
            {
                CollateralComplianceLogID = 1,
                LoanAccountID = 3,
                CollateralType = "Immovable Property",
                ValuationDate = asOfDate.AddMonths(-2),
                ValuationValue = 60000m,
                ValuersCount = 1,
                LastInspectionDate = asOfDate.AddMonths(-2),
                InsuranceExpiryDate = asOfDate.AddMonths(6)
            });

            await context.SaveChangesAsync();

            await service.RunClassificationAsync(asOfDate, "TestRunner");

            var status = await context.LoanAccountNpaStatuses.FirstOrDefaultAsync(s => s.LoanAccountID == 3);
            Assert.NotNull(status);
            Assert.Equal("Doubtful-1", status.Category);
            Assert.Equal(100000m, status.OutstandingBalance);
            Assert.Equal(60000m, status.CompliantCollateralValue);

            // FY 24-25 Doubtful-1 slabs: Secured 15% / Unsecured 60% strictly on PrincipalBalance (80,000):
            // Secured Principal = Math.Min(80000, 60000) = 60000 * 15% = 9000
            // Unsecured Principal = 80000 - 60000 = 20000 * 60% = 12000
            // Total BDDR ProvisionRequired = 21,000 (while 20,000 Interest is 100% OIR!)
            Assert.Equal(21000m, status.ProvisionRequired);

            var controller = new NpaController(context);
            var regAction = await controller.GetNpaRegister(asOfDate, 1) as OkObjectResult;
            Assert.NotNull(regAction);
            var regList = Assert.IsAssignableFrom<IEnumerable<NpaRegisterDto>>(regAction.Value).ToList();
            Assert.Single(regList);
            Assert.Equal(80000m, regList[0].PrincipalBalance);
            Assert.Equal(20000m, regList[0].ReceivableInterest);
            Assert.Equal(20000m, regList[0].OirAmount);
            Assert.Equal(21000m, regList[0].ProvisionAmount);
            Assert.Equal(41000m, regList[0].TotalProvisionWithOir);

            var stmtAction = await controller.GetNpaStatement(asOfDate, 1) as OkObjectResult;
            Assert.NotNull(stmtAction);
            var stmt = Assert.IsType<NpaStatementDto>(stmtAction.Value);
            Assert.Equal(1.00m, stmt.GrossNpa);               // 1,00,000 -> 1.00 Lakh
            Assert.Equal(0.20m, stmt.OverdueInterestReserve); // 20,000 -> 0.20 Lakh (100% OIR)
            Assert.Equal(0.21m, stmt.TotalProvision);         // 21,000 -> 0.21 Lakh (BDDR)
            Assert.Equal(0.59m, stmt.NetNpa);                 // (1,00,000 - 20,000 - 21,000) = 59,000 -> 0.59 Lakh
        }

        [Fact]
        public async Task Test_SingleBorrower_MultipleLoans_DowngradeRule()
        {
            using var context = GetInMemoryDbContext();
            await SeedBaseDataAsync(context);

            var service = new NpaEngineService(context);
            var asOfDate = new DateTime(2025, 3, 31);

            var loanStandard = new LoanAccount
            {
                LoanAccountID = 4,
                BranchID = 1,
                MemberID = 1,
                LoanRateID = 1,
                LoanAccountNo = "L-PERF",
                SanctionedAmount = 50000m,
                PrincipalBalance = 40000m,
                InterestBalance = 1000m,
                OpeningDate = new DateTime(2024, 10, 1),
                Status = "Active"
            };

            var loanNpa = new LoanAccount
            {
                LoanAccountID = 5,
                BranchID = 1,
                MemberID = 1,
                LoanRateID = 1,
                LoanAccountNo = "L-NPA",
                SanctionedAmount = 50000m,
                PrincipalBalance = 40000m,
                InterestBalance = 1000m,
                OpeningDate = new DateTime(2024, 4, 1),
                Status = "Active"
            };

            context.LoanAccounts.AddRange(loanStandard, loanNpa);

            context.LoanInstallmentSchedules.Add(new LoanInstallmentSchedule
            {
                ScheduleID = 4,
                LoanAccountID = 4,
                InstallmentNo = 1,
                DueDate = asOfDate.AddDays(-10),
                PrincipalAmount = 5000m,
                InterestAmount = 500m,
                TotalAmount = 5500m,
                BalanceAmount = 5500m,
                Status = "Pending"
            });

            context.LoanInstallmentSchedules.Add(new LoanInstallmentSchedule
            {
                ScheduleID = 5,
                LoanAccountID = 5,
                InstallmentNo = 1,
                DueDate = asOfDate.AddDays(-185),
                PrincipalAmount = 5000m,
                InterestAmount = 500m,
                TotalAmount = 5500m,
                BalanceAmount = 5500m,
                Status = "Pending"
            });

            await context.SaveChangesAsync();

            await service.RunClassificationAsync(asOfDate, "TestRunner");

            var statusStandard = await context.LoanAccountNpaStatuses.FirstOrDefaultAsync(s => s.LoanAccountID == 4);
            var statusNpa = await context.LoanAccountNpaStatuses.FirstOrDefaultAsync(s => s.LoanAccountID == 5);

            Assert.NotNull(statusStandard);
            Assert.Equal("Sub-Standard", statusStandard.Category);

            Assert.NotNull(statusNpa);
            Assert.Equal("Sub-Standard", statusNpa.Category);
        }

        [Fact]
        public async Task Test_GoldLoan_Exemption_ViaGoldDetails_And_OtherLoanNpaBreach()
        {
            using var context = GetInMemoryDbContext();
            await SeedBaseDataAsync(context);

            var service = new NpaEngineService(context);
            var asOfDate = new DateTime(2025, 3, 31);

            var goldLoan = new LoanAccount
            {
                LoanAccountID = 6,
                BranchID = 1,
                MemberID = 1,
                LoanRateID = 2,
                LoanAccountNo = "L-GOLD",
                SanctionedAmount = 50000m,
                PrincipalBalance = 40000m,
                InterestBalance = 2000m,
                OpeningDate = new DateTime(2024, 4, 1),
                Status = "Active"
            };
            context.LoanAccounts.Add(goldLoan);

            context.LoanInstallmentSchedules.Add(new LoanInstallmentSchedule
            {
                ScheduleID = 6,
                LoanAccountID = 6,
                InstallmentNo = 1,
                DueDate = asOfDate.AddDays(-200),
                PrincipalAmount = 40000m,
                InterestAmount = 2000m,
                TotalAmount = 42000m,
                BalanceAmount = 42000m,
                Status = "Pending"
            });

            // Operational GoldLoanDetail (even without CollateralComplianceLog!) keeps Gold Loan exempt
            context.GoldLoanDetails.Add(new GoldLoanDetail
            {
                GoldLoanDetailID = 1,
                LoanAccountID = 6,
                OrnamentName = "गोल्ड चेन",
                GrossWeight = 10m,
                NetWeight = 9.5m,
                GoldRatePerGram = 6500m,
                EstimatedValue = 60000m
            });

            await context.SaveChangesAsync();

            await service.RunClassificationAsync(asOfDate, "TestRunner");

            var goldStatus = await context.LoanAccountNpaStatuses.FirstOrDefaultAsync(s => s.LoanAccountID == 6);
            Assert.NotNull(goldStatus);
            Assert.Equal("Standard", goldStatus.Category);
            Assert.Equal(60000m, goldStatus.CompliantCollateralValue);

            var secondLoan = new LoanAccount
            {
                LoanAccountID = 7,
                BranchID = 1,
                MemberID = 1,
                LoanRateID = 1,
                LoanAccountNo = "L-TERM-NPA",
                SanctionedAmount = 30000m,
                PrincipalBalance = 25000m,
                InterestBalance = 1000m,
                OpeningDate = new DateTime(2024, 4, 1),
                Status = "Active"
            };
            context.LoanAccounts.Add(secondLoan);

            context.LoanInstallmentSchedules.Add(new LoanInstallmentSchedule
            {
                ScheduleID = 7,
                LoanAccountID = 7,
                InstallmentNo = 1,
                DueDate = asOfDate.AddDays(-190),
                PrincipalAmount = 25000m,
                InterestAmount = 1000m,
                TotalAmount = 26000m,
                BalanceAmount = 26000m,
                Status = "Pending"
            });

            await context.SaveChangesAsync();

            await service.RunClassificationAsync(asOfDate, "TestRunner");

            goldStatus = await context.LoanAccountNpaStatuses.FirstOrDefaultAsync(s => s.LoanAccountID == 6);
            var termStatus = await context.LoanAccountNpaStatuses.FirstOrDefaultAsync(s => s.LoanAccountID == 7);

            Assert.NotNull(goldStatus);
            Assert.Equal("Sub-Standard", goldStatus.Category);

            Assert.NotNull(termStatus);
            Assert.Equal("Sub-Standard", termStatus.Category);
        }

        [Fact]
        public async Task Test_OpeningBalanceNpaPreservation_And_CompliancePostEndpoint()
        {
            using var context = GetInMemoryDbContext();
            await SeedBaseDataAsync(context);

            var obLoan = new LoanAccount
            {
                LoanAccountID = 10,
                BranchID = 1,
                MemberID = 2,
                LoanRateID = 1,
                LoanAccountNo = "L-OB-SUB",
                SanctionedAmount = 100000m,
                PrincipalBalance = 50000m,
                InterestBalance = 8000m,
                InterestProvisionBalance = 2500m,
                InitialNpaClassification = "Sub-Standard",
                IsOpeningBalance = true,
                OpeningDate = new DateTime(2024, 4, 1),
                Status = "Active"
            };
            context.LoanAccounts.Add(obLoan);
            await context.SaveChangesAsync();

            var controller = new NpaController(context);
            var saveLogRes = await controller.SaveCollateralComplianceLog(new CollateralComplianceLogRequest
            {
                LoanAccountID = 10,
                CollateralType = "Immovable Property",
                ValuationDate = new DateTime(2025, 1, 10),
                ValuationValue = 75000m,
                ValuersCount = 1,
                LastInspectionDate = new DateTime(2025, 1, 10),
                InsuranceExpiryDate = new DateTime(2026, 1, 10)
            });
            Assert.IsType<OkObjectResult>(saveLogRes);

            var service = new NpaEngineService(context);
            await service.RunClassificationAsync(new DateTime(2025, 3, 31), "TestRunner");

            var obStatus = await context.LoanAccountNpaStatuses.FirstOrDefaultAsync(s => s.LoanAccountID == 10);
            Assert.NotNull(obStatus);
            // Opening date 01-04-2024 had Sub-Standard (overdue >= 180d); 12 months later on 31-03-2025 it ages into Doubtful-1 (never wiped to Standard!)
            Assert.NotEqual("Standard", obStatus.Category);
            Assert.Equal(2500m, obStatus.ProvisionHeld);
            Assert.Equal(75000m, obStatus.CompliantCollateralValue);
        }
    }
}
