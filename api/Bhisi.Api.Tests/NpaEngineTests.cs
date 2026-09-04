using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
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
            // Seed Branch
            context.Branches.Add(new Branch { BranchID = 1, BranchName = "HQ", BranchCode = "HQ" });
            
            // Seed Financial Year
            context.FinancialYears.Add(new FinancialYear { FinancialYearID = 1, YearCode = "2024-25", IsActive = true, StartDate = new DateTime(2024, 4, 1), EndDate = new DateTime(2025, 3, 31) });

            // Seed Account Groups
            context.AccountGroups.AddRange(new[]
            {
                new AccountGroup { GroupID = 1, GroupName = "कर्जे", NatureOfGroup = "Assets", IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "मिळालेले व्याज", NatureOfGroup = "Income", IsActive = true },
                new AccountGroup { GroupID = 3, GroupName = "इतर येणे", NatureOfGroup = "Assets", IsActive = true },
                new AccountGroup { GroupID = 4, GroupName = "इतर देणे", NatureOfGroup = "Liabilities", IsActive = true }
            });

            // Seed Ledgers
            context.Ledgers.AddRange(new[]
            {
                new Ledger { LedgerID = 71, LedgerName = "१ मेंबर कर्ज", GroupID = 1, IsActive = true },
                new Ledger { LedgerID = 196, LedgerName = "में व्याज मेंबर कर्जे", GroupID = 2, IsActive = true },
                new Ledger { LedgerID = 20, LedgerName = "थकीत व्याज येणे खाते", GroupID = 3, IsActive = true, ExcludeFromRule35Swanidhi = true },
                new Ledger { LedgerID = 21, LedgerName = "थकीत व्याज तरतूद खाते", GroupID = 4, IsActive = true, ExcludeFromRule35Swanidhi = true },
                new Ledger { LedgerID = 30, LedgerName = "थकीत वसुली खर्च येणे खाते", GroupID = 3, IsActive = true, ExcludeFromRule35Swanidhi = true },
                new Ledger { LedgerID = 31, LedgerName = "थकीत वसुली खर्च तरतूद खाते", GroupID = 4, IsActive = true, ExcludeFromRule35Swanidhi = true }
            });

            // Seed Loan Rates
            context.LoanRates.AddRange(new[]
            {
                new LoanRate { LoanRateID = 1, LoanType = "मेंबर कर्ज (Term)", LoanLedgerID = 71, InterestLedgerID = 196, OverdueInterestLedgerID = 196, InterestRate = 12m, IsCcOrOd = false, SecurityType = "स्थावर तारण" },
                new LoanRate { LoanRateID = 2, LoanType = "सोने तारण कर्ज", LoanLedgerID = 71, InterestLedgerID = 196, OverdueInterestLedgerID = 196, InterestRate = 10m, IsCcOrOd = false, SecurityType = "सोने तारण" }
            });

            // Seed Members
            context.Members.AddRange(new[]
            {
                new Member { MemberID = 1, MemberCode = "M001", FirstName = "Amit", LastName = "Patil", BranchID = 1, AadhaarNo = "111122223333", Village = "Pune", MobileNo = "9999999999" },
                new Member { MemberID = 2, MemberCode = "M002", FirstName = "Rahul", LastName = "Joshi", BranchID = 1, AadhaarNo = "444455556666", Village = "Pune", MobileNo = "8888888888" }
            });

            await context.SaveChangesAsync();
        }

        [Fact]
        public async Task Test_Standard_180Day_ConcessionBoundary()
        {
            using var context = GetInMemoryDbContext();
            await SeedBaseDataAsync(context);

            var service = new NpaEngineService(context);
            var asOfDate = new DateTime(2025, 3, 31);

            // Loan 1: Overdue by 179 days (Standard)
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

            // 179 days overdue schedule
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

            // Loan 2: Overdue by 180 days (Sub-Standard)
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

            // 180 days overdue schedule
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

            // Run batch engine
            await service.RunClassificationAsync(asOfDate, "TestRunner");

            var status1 = await context.LoanAccountNpaStatuses.FirstOrDefaultAsync(s => s.LoanAccountID == 1);
            var status2 = await context.LoanAccountNpaStatuses.FirstOrDefaultAsync(s => s.LoanAccountID == 2);

            Assert.NotNull(status1);
            Assert.Equal("Standard", status1.Category);

            Assert.NotNull(status2);
            Assert.Equal("Sub-Standard", status2.Category);
        }

        [Fact]
        public async Task Test_Slab_Provisioning_SecuredUnsecuredSplit()
        {
            using var context = GetInMemoryDbContext();
            await SeedBaseDataAsync(context);

            var service = new NpaEngineService(context);
            var asOfDate = new DateTime(2025, 3, 31);

            // Doubtful-1 Loan: Overdue by 20 months (600 days)
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

            // 20 months overdue schedule
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

            // Collateral Compliance Log: Value 60000 (compliant)
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

            // Run batch
            await service.RunClassificationAsync(asOfDate, "TestRunner");

            var status = await context.LoanAccountNpaStatuses.FirstOrDefaultAsync(s => s.LoanAccountID == 3);

            Assert.NotNull(status);
            Assert.Equal("Doubtful-1", status.Category);
            Assert.Equal(60000m, status.CompliantCollateralValue);

            // FY 24-25 Doubtful-1 slabs: Secured 15% / Unsecured 60%
            // Secured Portion = Math.Min(100000, 60000) = 60000. Provision = 60000 * 0.15 = 9000
            // Unsecured Portion = 100000 - 60000 = 40000. Provision = 40000 * 0.60 = 24000
            // Total Provision Required = 33000
            Assert.Equal(33000m, status.ProvisionRequired);
        }

        [Fact]
        public async Task Test_SingleBorrower_MultipleLoans_DowngradeRule()
        {
            using var context = GetInMemoryDbContext();
            await SeedBaseDataAsync(context);

            var service = new NpaEngineService(context);
            var asOfDate = new DateTime(2025, 3, 31);

            // Member 1 has two loans: L1 (Performing/Standard) and L2 (NPA/Sub-Standard)
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

            // Add 10-day overdue schedule for L1
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

            // Add 185-day overdue schedule for L2
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

            // Run batch
            await service.RunClassificationAsync(asOfDate, "TestRunner");

            var statusStandard = await context.LoanAccountNpaStatuses.FirstOrDefaultAsync(s => s.LoanAccountID == 4);
            var statusNpa = await context.LoanAccountNpaStatuses.FirstOrDefaultAsync(s => s.LoanAccountID == 5);

            // Individually L1 is Standard, but because L2 is Sub-Standard and they belong to the same Member, L1 gets downgraded to Sub-Standard!
            Assert.NotNull(statusStandard);
            Assert.Equal("Sub-Standard", statusStandard.Category);

            Assert.NotNull(statusNpa);
            Assert.Equal("Sub-Standard", statusNpa.Category);
        }

        [Fact]
        public async Task Test_GoldLoan_Exemption_And_OtherLoanNpaBreach()
        {
            using var context = GetInMemoryDbContext();
            await SeedBaseDataAsync(context);

            var service = new NpaEngineService(context);
            var asOfDate = new DateTime(2025, 3, 31);

            // Member 1 has: L-GOLD (Gold loan, overdue by 200 days - normally exempt)
            var goldLoan = new LoanAccount
            {
                LoanAccountID = 6,
                BranchID = 1,
                MemberID = 1,
                LoanRateID = 2, // Gold Loan
                LoanAccountNo = "L-GOLD",
                SanctionedAmount = 50000m,
                PrincipalBalance = 40000m,
                InterestBalance = 2000m,
                OpeningDate = new DateTime(2024, 4, 1),
                Status = "Active"
            };
            context.LoanAccounts.Add(goldLoan);

            // Overdue by 200 days
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

            // Collateral compliance log confirming gold collateral worth 60000 (adequate margin)
            context.CollateralComplianceLogs.Add(new CollateralComplianceLog
            {
                CollateralComplianceLogID = 6,
                LoanAccountID = 6,
                CollateralType = "Other Exempt",
                ValuationDate = asOfDate.AddMonths(-1),
                ValuationValue = 60000m,
                ValuersCount = 1,
                LastInspectionDate = asOfDate.AddMonths(-1),
                InsuranceExpiryDate = asOfDate.AddMonths(12),
                IsMarginMaintained = true
            });

            await context.SaveChangesAsync();

            // Run batch
            await service.RunClassificationAsync(asOfDate, "TestRunner");

            var goldStatus = await context.LoanAccountNpaStatuses.FirstOrDefaultAsync(s => s.LoanAccountID == 6);

            // Assert that gold loan remains Standard despite being 200 days overdue due to exempt status and valid collateral
            Assert.NotNull(goldStatus);
            Assert.Equal("Standard", goldStatus.Category);

            // Now, introduce another loan for Member 1 which is not exempt and is overdue by 190 days
            var secondLoan = new LoanAccount
            {
                LoanAccountID = 7,
                BranchID = 1,
                MemberID = 1,
                LoanRateID = 1, // Standard Term Loan
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

            // Run classification run again
            await service.RunClassificationAsync(asOfDate, "TestRunner");

            goldStatus = await context.LoanAccountNpaStatuses.FirstOrDefaultAsync(s => s.LoanAccountID == 6);
            var termStatus = await context.LoanAccountNpaStatuses.FirstOrDefaultAsync(s => s.LoanAccountID == 7);

            // Since Term Loan became Sub-Standard (NPA), the gold loan is downgraded to Sub-Standard as well!
            Assert.NotNull(goldStatus);
            Assert.Equal("Sub-Standard", goldStatus.Category);

            Assert.NotNull(termStatus);
            Assert.Equal("Sub-Standard", termStatus.Category);
        }
    }
}
