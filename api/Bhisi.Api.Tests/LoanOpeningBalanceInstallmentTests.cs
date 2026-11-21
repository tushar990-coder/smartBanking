using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Bhisi.Api.Controllers;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class LoanOpeningBalanceInstallmentTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"LoanObInstTests_{Guid.NewGuid():N}")
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static void AttachAdmin(ControllerBase controller, DateTime bizDate)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, "1"),
                new Claim(ClaimTypes.Name, "ho_admin"),
                new Claim(ClaimTypes.Role, "Admin"),
                new Claim("BranchID", "1"),
                new Claim("IsHeadOffice", "true"),
                new Claim("BusinessDate", bizDate.ToString("yyyy-MM-dd"))
            };
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestJwt")) }
            };
        }

        private static async Task<LoanRate> SeedLoanEnvironmentAsync(AppDbContext db)
        {
            db.Branches.Add(new Branch
            {
                BranchID = 1,
                BranchCode = "HO",
                BranchName = "मुख्य शाखा",
                IsActive = true
            });

            db.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "2026-2027",
                StartDate = new DateTime(2026, 4, 1),
                EndDate = new DateTime(2027, 3, 31),
                IsActive = true,
                IsClosed = false
            });

            db.AccountGroups.AddRange(
                new AccountGroup { GroupID = 1, GroupName = "कर्जे (Loans)", NatureOfGroup = "Assets", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "येणे व्याज", NatureOfGroup = "Assets", DisplayOrder = 2, IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 101, GroupID = 1, LedgerCode = "101", LedgerName = "सभासद पगार तारण कर्ज", AccountType = "Loan", IsActive = true },
                new Ledger { LedgerID = 102, GroupID = 2, LedgerCode = "102", LedgerName = "येणे कर्ज व्याज", AccountType = "Receivable", IsActive = true }
            );

            var rate = new LoanRate
            {
                LoanRateID = 1,
                LoanCode = "LN01",
                LoanType = "सभासद पगार तारण",
                ShortName = "सभासद पगार तारण",
                InterestRate = 10m,
                DurationMonths = 60,
                InstallmentCount = 60,
                InstallmentType = "मासिक",
                InterestCalculationMethod = "Reducing (घटती शिल्लक)",
                LoanInstallmentType = "समान मुद्दल",
                LoanLedgerID = 101,
                ReceivableInterestLedgerID = 102,
                IsActive = true
            };
            db.LoanRates.Add(rate);

            db.Customers.Add(new Customer
            {
                CustomerID = 207,
                CIFNo = "CIF000207",
                FirstName = "प्रशांत",
                MiddleName = "संपतराव",
                LastName = "जाधव",
                BranchID = 1
            });

            await db.SaveChangesAsync();
            return rate;
        }

        [Fact]
        public async Task PreviewSchedule_ReducingEqualPrincipal_RespectsRoundedUpCustomInstallment8400()
        {
            await using var db = CreateContext();
            var rate = await SeedLoanEnvironmentAsync(db);

            // Auto principal installment = 5,00,000 / 60 = 8,333; operator rounds up to 8,400
            var schedule = LoanScheduleGenerator.GeneratePreviewSchedule(new LoanSchedulePreviewRequest
            {
                LoanRateID = rate.LoanRateID,
                LoanAmount = 500000m,
                InterestRate = 10m,
                NoOfInstallments = 60,
                DurationMonths = 60,
                InstallmentFrequency = "मासिक",
                LoanDisbursementDate = new DateTime(2022, 9, 12),
                FirstInstallmentDate = new DateTime(2022, 10, 12),
                CustomInstallmentAmount = 8400m
            }, rate);

            Assert.Equal(60, schedule.Count);
            // Installments 1..59 must each carry exact ₹8,400 principal (59 * 8,400 = 4,95,600)
            for (int i = 0; i < 59; i++)
            {
                Assert.Equal(8400m, schedule[i].Principal);
            }
            // Final 60th installment carries remaining ₹4,400 principal and closes balance to ₹0
            Assert.Equal(4400m, schedule[59].Principal);
            Assert.Equal(0m, schedule[59].Balance);
            Assert.Equal(500000m, schedule.Sum(r => r.Principal));
        }

        [Fact]
        public async Task PreviewSchedule_HigherRoundedInstallment9000_StopsWhenBalanceZero_NoPhantomZeroRows()
        {
            await using var db = CreateContext();
            var rate = await SeedLoanEnvironmentAsync(db);

            // 5,00,000 / 9,000 = 55 installments of 9,000 (4,95,000) + 56th installment of 5,000 -> stops at 56 rows (no ₹0 rows!)
            var schedule = LoanScheduleGenerator.GeneratePreviewSchedule(new LoanSchedulePreviewRequest
            {
                LoanRateID = rate.LoanRateID,
                LoanAmount = 500000m,
                InterestRate = 10m,
                NoOfInstallments = 60,
                DurationMonths = 60,
                InstallmentFrequency = "मासिक",
                LoanDisbursementDate = new DateTime(2022, 9, 12),
                FirstInstallmentDate = new DateTime(2022, 10, 12),
                CustomInstallmentAmount = 9000m
            }, rate);

            Assert.Equal(56, schedule.Count);
            Assert.All(schedule, row => Assert.True(row.Principal > 0m));
            Assert.Equal(9000m, schedule[0].Principal);
            Assert.Equal(5000m, schedule[55].Principal);
            Assert.Equal(0m, schedule[55].Balance);
            Assert.Equal(500000m, schedule.Sum(r => r.Principal));
        }

        [Fact]
        public async Task PostAndPutOpeningBalance_PreservesManualInstallment8400_AndPersistsSyncedSchedule()
        {
            await using var db = CreateContext();
            var rate = await SeedLoanEnvironmentAsync(db);

            var controller = new LoanAccountsController(db);
            AttachAdmin(controller, new DateTime(2026, 4, 1));

            // 1. Create Loan Opening Balance initially with auto installment ₹8,333
            var postDto = new LoanOpeningBalanceDto
            {
                BranchID = 1,
                CustomerID = 207,
                LoanRateID = rate.LoanRateID,
                LoanAccountNo = "00120100000716",
                LegacyAccountNumber = "209",
                SanctionedAmount = 500000m,
                DisbursedAmount = 500000m,
                PurePrincipalBalance = 147200m,
                PrincipalBalance = 147200m,
                InterestRate = 10m,
                DurationMonths = 60,
                NoOfInstallments = 60,
                InstallmentFrequency = "मासिक",
                InstallmentAmount = 8333m,
                OpeningDate = new DateTime(2026, 3, 31),
                LoanDisbursementDate = new DateTime(2022, 9, 12),
                FirstInstallmentDate = new DateTime(2022, 10, 12),
                MaturityDate = new DateTime(2027, 9, 12),
                LastInstallmentPaidDate = new DateTime(2026, 3, 5)
            };

            var postRes = await controller.PostOpeningBalance(postDto);
            Assert.IsType<OkObjectResult>(postRes.Result);

            var created = await db.LoanAccounts.FirstAsync(a => a.LegacyAccountNumber == "209");
            Assert.Equal(8333m, created.InstallmentAmount);

            // 2. Edit & round up InstallmentAmount to ₹8,400 (even without client-sent Schedule -> backend generates synced 8,400 schedule)
            var putDto = new LoanOpeningBalanceDto
            {
                LoanOpeningBalanceID = created.LoanAccountID,
                BranchID = 1,
                CustomerID = 207,
                LoanRateID = rate.LoanRateID,
                LoanAccountNo = created.LoanAccountNo ?? "00120100000716",
                LegacyAccountNumber = "209",
                SanctionedAmount = 500000m,
                DisbursedAmount = 500000m,
                PurePrincipalBalance = 147200m,
                PrincipalBalance = 147200m,
                InterestRate = 10m,
                DurationMonths = 60,
                NoOfInstallments = 60,
                InstallmentFrequency = "मासिक",
                InstallmentAmount = 8400m,
                OpeningDate = new DateTime(2026, 3, 31),
                LoanDisbursementDate = new DateTime(2022, 9, 12),
                FirstInstallmentDate = new DateTime(2022, 10, 12),
                MaturityDate = new DateTime(2027, 9, 12),
                LastInstallmentPaidDate = new DateTime(2026, 3, 5),
                Schedule = new List<OpeningBalanceScheduleDto>()
            };

            var putRes = await controller.PutOpeningBalance(created.LoanAccountID, putDto);
            Assert.IsType<NoContentResult>(putRes);

            var updated = await db.LoanAccounts.AsNoTracking().FirstAsync(a => a.LoanAccountID == created.LoanAccountID);
            Assert.Equal(8400m, updated.InstallmentAmount);

            var savedSchedule = await db.LoanInstallmentSchedules
                .AsNoTracking()
                .Where(s => s.LoanAccountID == created.LoanAccountID)
                .OrderBy(s => s.InstallmentNo)
                .ToListAsync();

            Assert.Equal(60, savedSchedule.Count);
            Assert.Equal(8400m, savedSchedule[0].PrincipalAmount);
            Assert.Equal(8400m, savedSchedule[58].PrincipalAmount);
            Assert.Equal(4400m, savedSchedule[59].PrincipalAmount);
            Assert.Equal(500000m, savedSchedule.Sum(s => s.PrincipalAmount));
        }
    }
}
