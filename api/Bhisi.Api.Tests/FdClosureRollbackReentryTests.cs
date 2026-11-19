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
    public class FdClosureRollbackReentryTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"FdClosureRollbackReentry_{Guid.NewGuid():N}")
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ClaimsPrincipal BuildAdminPrincipal(DateTime bizDate)
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
            return new ClaimsPrincipal(new ClaimsIdentity(claims, "TestJwt"));
        }

        private static void AttachAdmin(ControllerBase controller, DateTime bizDate)
        {
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = BuildAdminPrincipal(bizDate) }
            };
        }

        private static async Task SeedEnvironmentAsync(
            AppDbContext db,
            DateTime cbsBusinessDate,
            DateTime fdOpeningDate,
            DateTime fdMaturityDate,
            string initialFdStatus = "Active")
        {
            db.SansthaDetails.Add(new SansthaDetail
            {
                SansthaID = 1,
                SansthaName = "स्मार्ट पतसंस्था"
            });

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

            db.BranchDayEndStatuses.Add(new BranchDayEndStatus
            {
                BranchID = 1,
                BusinessDate = cbsBusinessDate.Date,
                IsDayClosed = false
            });

            db.AccountGroups.AddRange(
                new AccountGroup { GroupID = 1, GroupName = "भांडवल व देणी (Liabilities)", NatureOfGroup = "Liabilities", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "ठेवी (Deposits)", ParentGroupID = 1, NatureOfGroup = "Liabilities", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 3, GroupName = "इतर देणी व तरतुदी (Provisions)", ParentGroupID = 1, NatureOfGroup = "Liabilities", DisplayOrder = 2, IsActive = true },
                new AccountGroup { GroupID = 4, GroupName = "मालमत्ता व येणी (Assets)", NatureOfGroup = "Assets", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 5, GroupName = "रोख शिल्लक (Cash)", ParentGroupID = 4, NatureOfGroup = "Assets", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 6, GroupName = "खर्च (Expenses)", NatureOfGroup = "Expenses", DisplayOrder = 1, IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 12, GroupID = 2, LedgerCode = "12", LedgerName = "मुदत ठेव", AccountType = "Fixed Deposit", IsActive = true },
                new Ledger { LedgerID = 13, GroupID = 2, LedgerCode = "13", LedgerName = "बचत ठेव", AccountType = "Saving Deposit", IsActive = true },
                new Ledger { LedgerID = 23, GroupID = 3, LedgerCode = "23", LedgerName = "देणे मुदत ठेव व्याज", AccountType = "Payable", IsActive = true },
                new Ledger { LedgerID = 51, GroupID = 5, LedgerCode = "51", LedgerName = "हातातील रोख शिल्लक", AccountType = "Cash", IsActive = true },
                new Ledger { LedgerID = 132, GroupID = 6, LedgerCode = "132", LedgerName = "मुदत ठेव व्याज खर्च", AccountType = "Expenses", IsActive = true }
            );

            db.SavingInterestSettings.Add(new SavingInterestSetting
            {
                SettingID = 1,
                SchemeCode = "SB01",
                SchemeName = "साधारण बचत ठेव",
                InterestRate = 4m,
                MinimumBalance = 100m,
                EffectiveDate = new DateTime(2025, 4, 1),
                LedgerID = 13,
                SavingLiabilityLedgerID = 13
            });

            db.FdSchemes.Add(new FdScheme
            {
                FdSchemeID = 1,
                SchemeCode = "FD401",
                SchemeName = "नियमित मुदत ठेव",
                DurationMonths = 13,
                DurationType = "Months",
                SchemeDurationModel = "Fixed",
                InterestRate = 9m,
                SeniorCitizenInterestRate = 9.5m,
                InterestType = "Cumulative",
                InterestPostingMethod = "On Principal",
                PrematureInterestRate = 7m,
                FdLiabilityLedgerID = 12,
                InterestPayableLedgerID = 23,
                InterestExpenseLedgerID = 132,
                IsActive = true
            });

            db.Customers.Add(new Customer
            {
                CustomerID = 1,
                CIFNo = "CIF0004743",
                FirstName = "राजेश",
                LastName = "जाधव",
                BirthDate = new DateTime(1985, 5, 10),
                BranchID = 1,
                Status = "Active"
            });

            db.SavingAccountMasters.Add(new SavingAccountMaster
            {
                SavingAccountID = 500,
                BranchID = 1,
                CustomerID = 1,
                SavingSchemeID = 1,
                LedgerID = 13,
                AccountNo = "00110100004743",
                OpeningDate = new DateTime(2025, 4, 1),
                CurrentBalance = 248m,
                Status = "Active"
            });

            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 100,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = 1,
                FdSchemeID = 1,
                AccountNo = "001-401-0000100-1",
                ReceiptNo = "100",
                LegacyAccountNumber = "100",
                OpeningDate = fdOpeningDate,
                MaturityDate = fdMaturityDate,
                DurationType = "Days",
                DurationValue = (int)(fdMaturityDate.Date - fdOpeningDate.Date).TotalDays,
                DurationInDays = (int)(fdMaturityDate.Date - fdOpeningDate.Date).TotalDays,
                DepositAmount = 100000m,
                MaturityAmount = 109764m,
                InterestRate = 9m,
                Status = initialFdStatus
            });

            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task PrematureClose_DeleteRollback_RestoresActiveStatusByCbsBusinessDate_ClearsCompanionAccrual_AndAllowsReentry()
        {
            using var db = CreateContext();
            // CBS Business Date = 2026-04-10, Maturity = 2026-06-14 (65 days remaining on CBS date, even if server DateTime.Today is 2026-11-19)
            var cbsBizDate = new DateTime(2026, 4, 10);
            var fdOpening = new DateTime(2025, 5, 14);
            var fdMaturity = new DateTime(2026, 6, 14);
            await SeedEnvironmentAsync(db, cbsBizDate, fdOpening, fdMaturity, "Active");

            var controller = new FdAccountsController(db);
            AttachAdmin(controller, cbsBizDate);

            // 1. First Premature Close via Saving Transfer
            var req1 = new FdClosureRequest
            {
                ClosureDate = cbsBizDate,
                PaymentMode = "Transfer",
                SavingAccountID = 500,
                IsManualAmountOverride = true,
                CustomAccruedInterest = 7605m,
                CustomTotalPayout = 107605m,
                ManualOverrideReason = "लेगसी ताळमेळ व्याज दुरुस्ती"
            };

            var res1 = await controller.PrematureClose(100, cbsBizDate, req1);
            Assert.IsType<OkObjectResult>(res1);

            var fdAfterClose = await db.FdAccounts.FirstAsync(f => f.FdAccountID == 100);
            Assert.Equal("Closed", fdAfterClose.Status);

            var savAfterClose = await db.SavingAccountMasters.FirstAsync(s => s.SavingAccountID == 500);
            Assert.Equal(107853m, savAfterClose.CurrentBalance); // 248 + 1,00,000 + 7,605

            var closureVoucher = await db.Vouchers.FirstAsync(v => v.VoucherNo.Contains("FD-PRECLOSE"));

            // 2. Delete / Rollback the pending Premature Close voucher
            var rollbackService = new VoucherRollbackAndDeleteService(db);
            var delResult = await rollbackService.DeleteVoucherWithRollbackAsync(
                closureVoucher.VoucherID,
                new VoucherDeleteRequestContext
                {
                    UserId = 1,
                    Username = "ho_admin",
                    UserRole = "Admin",
                    UserBranchId = 1,
                    IsHeadOfficeAdmin = true,
                    Reason = "चुकीची रक्कम झाल्याने पुन्हा एन्ट्रीसाठी डिलीट केले",
                    ActionSource = "VOUCHER_HARD_DELETE"
                });

            Assert.True(delResult.Success, delResult.Message);

            // Verify FD restored to Active (using CBS BusinessDate 2026-04-10, NOT server DateTime.Today)
            var fdAfterRollback = await db.FdAccounts.FirstAsync(f => f.FdAccountID == 100);
            Assert.Equal("Active", fdAfterRollback.Status);

            // Verify Saving balance restored & companion closure Accrual FdTransaction cleaned up
            var savAfterRollback = await db.SavingAccountMasters.FirstAsync(s => s.SavingAccountID == 500);
            Assert.Equal(248m, savAfterRollback.CurrentBalance);
            Assert.Empty(await db.FdTransactions.Where(t => t.FdAccountID == 100).ToListAsync());

            // 3. Re-enter Premature Close on the exact same FD account -> Must succeed cleanly!
            var res2 = await controller.PrematureClose(100, cbsBizDate, req1);
            Assert.IsType<OkObjectResult>(res2);

            var fdAfterReentry = await db.FdAccounts.FirstAsync(f => f.FdAccountID == 100);
            Assert.Equal("Closed", fdAfterReentry.Status);

            var savAfterReentry = await db.SavingAccountMasters.FirstAsync(s => s.SavingAccountID == 500);
            Assert.Equal(107853m, savAfterReentry.CurrentBalance);
        }

        [Fact]
        public async Task PrematureClose_WhenLegacyStuckAsMatured_AllowsCloseBeforeMaturityDate_AndStillBlocksOnOrAfterMaturityDate()
        {
            using var db = CreateContext();
            var cbsBizDate = new DateTime(2026, 4, 10);
            await SeedEnvironmentAsync(db, cbsBizDate, new DateTime(2025, 5, 14), new DateTime(2026, 6, 14), "Matured");

            // Add a second FD that genuinely matured BEFORE the CBS business date (2026-04-05 <= 2026-04-10)
            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 101,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = 1,
                FdSchemeID = 1,
                AccountNo = "001-401-0000101-1",
                ReceiptNo = "101",
                OpeningDate = new DateTime(2025, 4, 5),
                MaturityDate = new DateTime(2026, 4, 5),
                DurationType = "Days",
                DurationValue = 365,
                DurationInDays = 365,
                DepositAmount = 50000m,
                MaturityAmount = 54500m,
                InterestRate = 9m,
                Status = "Matured"
            });
            await db.SaveChangesAsync();

            var controller = new FdAccountsController(db);
            AttachAdmin(controller, cbsBizDate);

            // 1. Stuck "Matured" FD whose MaturityDate (2026-06-14) > ClosureDate (2026-04-10) MUST succeed
            var okRes = await controller.PrematureClose(100, cbsBizDate, new FdClosureRequest
            {
                ClosureDate = cbsBizDate,
                PaymentMode = "Transfer",
                SavingAccountID = 500,
                IsManualAmountOverride = true,
                CustomAccruedInterest = 7605m,
                CustomTotalPayout = 107605m,
                ManualOverrideReason = "लेगसी ताळमेळ व्याज दुरुस्ती"
            });
            Assert.IsType<OkObjectResult>(okRes);

            // 2. Truly matured FD whose MaturityDate (2026-04-05) <= ClosureDate (2026-04-10) MUST still be blocked by date guard
            var badRes = await controller.PrematureClose(101, cbsBizDate, new FdClosureRequest
            {
                ClosureDate = cbsBizDate,
                PaymentMode = "Cash"
            });
            var badReq = Assert.IsType<BadRequestObjectResult>(badRes);
            Assert.Contains("मुदतपूर्ती बंद", badReq.Value?.ToString() ?? string.Empty);
        }

        [Fact]
        public async Task ReopenFdAccount_RestoresActiveStatus_UsingCbsBusinessDate_NotWallClockToday()
        {
            using var db = CreateContext();
            var cbsBizDate = new DateTime(2026, 4, 10);
            await SeedEnvironmentAsync(db, cbsBizDate, new DateTime(2025, 5, 14), new DateTime(2026, 6, 14), "Closed");

            var controller = new FdAccountsController(db);
            AttachAdmin(controller, cbsBizDate);

            var reopenRes = await controller.ReopenFdAccount(100, new FdReopenRequest { Reason = "Reopen test" });
            Assert.IsType<OkObjectResult>(reopenRes);

            var reopenedFd = await db.FdAccounts.FirstAsync(f => f.FdAccountID == 100);
            Assert.Equal("Active", reopenedFd.Status);
        }
    }
}
