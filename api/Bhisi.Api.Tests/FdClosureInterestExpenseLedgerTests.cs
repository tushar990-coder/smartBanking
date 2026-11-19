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
    public class FdClosureInterestExpenseLedgerTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"FdIntExpTests_{Guid.NewGuid():N}")
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
            DateTime bizDate,
            decimal legacyAccruedInt = 0m)
        {
            db.SansthaDetails.Add(new SansthaDetail
            {
                SansthaID = 1,
                SansthaName = "पडवळवाडी पतसंस्था",
                FdRenewalReceiptPolicy = "RETAIN_ORIGINAL"
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
                BusinessDate = bizDate.Date,
                IsDayClosed = false
            });

            db.AccountGroups.AddRange(
                new AccountGroup { GroupID = 1, GroupName = "ठेवी", NatureOfGroup = "Liabilities", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "देणी", NatureOfGroup = "Liabilities", DisplayOrder = 2, IsActive = true },
                new AccountGroup { GroupID = 3, GroupName = "रोख", NatureOfGroup = "Assets", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 4, GroupName = "खर्च", NatureOfGroup = "Expenses", DisplayOrder = 1, IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 12, GroupID = 1, LedgerCode = "12", LedgerName = "मुदत ठेव", AccountType = "Fixed Deposit", IsActive = true },
                new Ledger { LedgerID = 114, GroupID = 2, LedgerCode = "114", LedgerName = "देणे मुदत बंद ठेव व्याज", AccountType = "Payable", IsActive = true },
                new Ledger { LedgerID = 333, GroupID = 4, LedgerCode = "333", LedgerName = "मुदतठेवीवरील व्याज", AccountType = "Expenses", IsActive = true },
                new Ledger { LedgerID = 51, GroupID = 3, LedgerCode = "51", LedgerName = "हातातील रोख शिल्लक", AccountType = "Cash", IsActive = true },
                new Ledger { LedgerID = 40, GroupID = 1, LedgerCode = "40", LedgerName = "बचत ठेव", AccountType = "Saving", IsActive = true }
            );

            db.FdSchemes.Add(new FdScheme
            {
                FdSchemeID = 1,
                SchemeCode = "FD401",
                SchemeName = "नियमित मुदत ठेव",
                DurationMonths = 12,
                DurationType = "Months",
                SchemeDurationModel = "Fixed",
                InterestRate = 9m,
                SeniorCitizenInterestRate = 9.5m,
                InterestType = "Simple",
                PrematureInterestRate = 7m,
                FdLiabilityLedgerID = 12,
                InterestPayableLedgerID = 114,
                InterestExpenseLedgerID = 333,
                IsActive = true
            });

            db.Customers.Add(new Customer
            {
                CustomerID = 1503,
                CIFNo = "CIF001503",
                FirstName = "श्रेयशा",
                MiddleName = "दिलीप",
                LastName = "पाटील",
                BirthDate = new DateTime(1990, 5, 1),
                BranchID = 1
            });

            db.SavingAccountMasters.Add(new SavingAccountMaster
            {
                SavingAccountID = 500,
                BranchID = 1,
                CustomerID = 1503,
                LedgerID = 40,
                AccountNo = "00110100004743",
                OpeningDate = new DateTime(2025, 1, 1),
                CurrentBalance = 248m,
                Status = "Active"
            });

            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 333,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = 1503,
                FdSchemeID = 1,
                AccountNo = "001-401-0000333-8",
                ReceiptNo = "333",
                OpeningDate = new DateTime(2025, 5, 30),
                MaturityDate = new DateTime(2026, 6, 30),
                DurationType = "Months",
                DurationValue = 13,
                DurationInDays = 396,
                DepositAmount = 100000m,
                MaturityAmount = 109764m,
                InterestRate = 9m,
                LegacyAccruedInt = legacyAccruedInt,
                Status = "Active"
            });

            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task PrematureClose_WithOrphanedAccrualAndLegacyAccruedInt_DebitsExactInterestExpenseLedger_ZeroPayable_ZeroClawback()
        {
            await using var db = CreateContext();
            var closureDate = new DateTime(2026, 4, 27);
            await SeedEnvironmentAsync(db, closureDate, legacyAccruedInt: 70605m);

            // Simulate orphaned pre-v2.6.33 Accrual row left behind when an earlier closure voucher (9999) was deleted
            db.FdTransactions.Add(new FdTransaction
            {
                BranchID = 1,
                FdAccountID = 333,
                VoucherID = 9999, // Does NOT exist in Vouchers table
                TransactionDate = new DateTime(2026, 4, 10),
                TransactionType = "Accrual",
                DebitCredit = "Cr",
                Amount = 7605m
            });
            await db.SaveChangesAsync();

            var controller = new FdAccountsController(db);
            AttachAdmin(controller, closureDate);

            // Preview must report verified provision = 0 (NOT 7,605 and NOT 70,605)
            var previewRes = await controller.GetPrematurePreview(333, closureDate);
            var previewOk = Assert.IsType<OkObjectResult>(previewRes);
            var previewJson = System.Text.Json.JsonDocument.Parse(System.Text.Json.JsonSerializer.Serialize(previewOk.Value)).RootElement;
            Assert.Equal(0m, previewJson.GetProperty("alreadyAccruedInterest").GetDecimal());

            // Execute PrematureClose with exact manual interest = ₹7,605
            var closeRes = await controller.PrematureClose(333, closureDate, new FdClosureRequest
            {
                ClosureDate = closureDate,
                PaymentMode = "Transfer",
                SavingAccountID = 500,
                IsManualAmountOverride = true,
                CustomAccruedInterest = 7605m,
                ManualOverrideReason = "थेट सेटलमेंट संपादन",
                InterestDebitMode = "Auto"
            });
            Assert.IsType<OkObjectResult>(closeRes);

            var voucher = await db.Vouchers.Include(v => v.VoucherDetails)
                .FirstAsync(v => v.VoucherNo.Contains("FD-PRECLOSE-001-401-0000333-8"));

            // Exact accounting assertions matching Padvalwadi Daybook fix:
            // Dr 12 (FD Liability) = ₹1,00,000
            Assert.Equal(100000m, voucher.VoucherDetails!.Where(d => d.LedgerID == 12 && d.DrCr == "Dr").Sum(d => d.Amount));
            // Dr 333 (मुदतठेवीवरील व्याज - Interest Expense) = EXACTLY ₹7,605
            Assert.Equal(7605m, voucher.VoucherDetails!.Where(d => d.LedgerID == 333 && d.DrCr == "Dr").Sum(d => d.Amount));
            // Cr 333 (fake clawback) = ₹0
            Assert.Equal(0m, voucher.VoucherDetails!.Where(d => d.LedgerID == 333 && d.DrCr == "Cr").Sum(d => d.Amount));
            // Dr 114 (देणे मुदत बंद ठेव व्याज - Interest Payable) = ₹0
            Assert.Equal(0m, voucher.VoucherDetails!.Where(d => d.LedgerID == 114 && d.DrCr == "Dr").Sum(d => d.Amount));
            // Cr 40 (Saving Transfer) = ₹1,07,605
            Assert.Equal(107605m, voucher.VoucherDetails!.Where(d => d.LedgerID == 40 && d.DrCr == "Cr").Sum(d => d.Amount));

            // Closure-time interest transaction must be tagged as "Closure_Interest" (NOT "Accrual")
            var closureIntTx = await db.FdTransactions
                .FirstOrDefaultAsync(t => t.FdAccountID == 333 && t.VoucherID == voucher.VoucherID && t.DebitCredit == "Cr");
            Assert.NotNull(closureIntTx);
            Assert.Equal("Closure_Interest", closureIntTx!.TransactionType);
            Assert.Equal(7605m, closureIntTx.Amount);
        }

        [Fact]
        public async Task PrematureClose_WithGenuineProvision_AutoClearsProvision_WhileExpenseModeForcesFullInterestExpense()
        {
            await using var db = CreateContext();
            var accrualDate = new DateTime(2026, 3, 31);
            var closureDate = new DateTime(2026, 4, 27);
            await SeedEnvironmentAsync(db, closureDate, legacyAccruedInt: 0m);

            // Seed a GENUINE FY-end Provision (Voucher crediting Ledger 114 + FdInterestAccruals PostingTarget="Provision")
            var provVoucher = new Voucher
            {
                BranchID = 1,
                VoucherNo = "JV-FD-INT-20260331",
                VoucherDate = accrualDate,
                VoucherType = "Journal",
                TotalAmount = 5000m,
                Status = "Approved",
                Narration = "FD Interest Provision"
            };
            db.Vouchers.Add(provVoucher);
            await db.SaveChangesAsync();

            db.VoucherDetails.AddRange(
                new VoucherDetail { VoucherID = provVoucher.VoucherID, LedgerID = 333, DrCr = "Dr", Amount = 5000m, CustomerID = 1503 },
                new VoucherDetail { VoucherID = provVoucher.VoucherID, LedgerID = 114, DrCr = "Cr", Amount = 5000m, CustomerID = 1503 }
            );
            db.FdInterestAccruals.Add(new FdInterestAccrual
            {
                FdAccountID = 333,
                AccrualDate = accrualDate,
                InterestAmount = 5000m,
                IsPosted = true,
                PostingTarget = "Provision",
                VoucherID = provVoucher.VoucherID
            });
            await db.SaveChangesAsync();

            var controller = new FdAccountsController(db);
            AttachAdmin(controller, closureDate);

            // 1. With InterestDebitMode = "Auto": Debits ₹5,000 from 114 (Payable) + ₹2,605 from 333 (Expense)
            var autoCloseRes = await controller.PrematureClose(333, closureDate, new FdClosureRequest
            {
                ClosureDate = closureDate,
                PaymentMode = "Cash",
                IsManualAmountOverride = true,
                CustomAccruedInterest = 7605m,
                ManualOverrideReason = "थेट सेटलमेंट संपादन",
                InterestDebitMode = "Auto"
            });
            Assert.IsType<OkObjectResult>(autoCloseRes);

            var autoVoucher = await db.Vouchers.Include(v => v.VoucherDetails)
                .FirstAsync(v => v.VoucherNo.Contains("FD-PRECLOSE-001-401-0000333-8"));
            Assert.Equal(5000m, autoVoucher.VoucherDetails!.Where(d => d.LedgerID == 114 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(2605m, autoVoucher.VoucherDetails!.Where(d => d.LedgerID == 333 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(107605m, autoVoucher.VoucherDetails!.Where(d => d.LedgerID == 51 && d.DrCr == "Cr").Sum(d => d.Amount));

            // 2. Roll back and re-close with InterestDebitMode = "Expense": Debits FULL ₹7,605 to 333 (Expense), ₹0 to 114
            var rollbackService = new VoucherRollbackAndDeleteService(db);
            var postingController = new VoucherPostingController(db, rollbackService);
            AttachAdmin(postingController, closureDate);
            var rejectRes = await postingController.RejectVoucher(autoVoucher.VoucherID, new VoucherPostingController.VoucherRejectDto { Reason = "Test switch to Expense mode" });
            Assert.IsType<OkObjectResult>(rejectRes);

            var expCloseRes = await controller.PrematureClose(333, closureDate, new FdClosureRequest
            {
                ClosureDate = closureDate,
                PaymentMode = "Cash",
                IsManualAmountOverride = true,
                CustomAccruedInterest = 7605m,
                ManualOverrideReason = "थेट सेटलमेंट संपादन",
                InterestDebitMode = "Expense"
            });
            Assert.IsType<OkObjectResult>(expCloseRes);

            var expVoucher = await db.Vouchers.Include(v => v.VoucherDetails)
                .FirstAsync(v => v.VoucherNo.Contains("FD-PRECLOSE-001-401-0000333-8"));
            Assert.Equal(0m, expVoucher.VoucherDetails!.Where(d => d.LedgerID == 114 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(7605m, expVoucher.VoucherDetails!.Where(d => d.LedgerID == 333 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(107605m, expVoucher.VoucherDetails!.Where(d => d.LedgerID == 51 && d.DrCr == "Cr").Sum(d => d.Amount));
        }

        [Fact]
        public async Task PrematureClose_DeleteRollbackAndReentry_RemovesClosureInterest_AndReentryDebitsExactInterestExpense()
        {
            await using var db = CreateContext();
            var closureDate = new DateTime(2026, 4, 27);
            await SeedEnvironmentAsync(db, closureDate, legacyAccruedInt: 0m);

            var controller = new FdAccountsController(db);
            AttachAdmin(controller, closureDate);

            // First premature close
            var firstRes = await controller.PrematureClose(333, closureDate, new FdClosureRequest
            {
                ClosureDate = closureDate,
                PaymentMode = "Transfer",
                SavingAccountID = 500,
                IsManualAmountOverride = true,
                CustomAccruedInterest = 7605m,
                ManualOverrideReason = "थेट सेटलमेंट संपादन",
                InterestDebitMode = "Auto"
            });
            Assert.IsType<OkObjectResult>(firstRes);

            var firstVoucher = await db.Vouchers.FirstAsync(v => v.VoucherNo.Contains("FD-PRECLOSE-001-401-0000333-8"));
            Assert.Equal(1, await db.FdTransactions.CountAsync(t => t.FdAccountID == 333 && t.TransactionType == "Closure_Interest"));

            // Delete voucher via VoucherPostingController -> VoucherRollbackAndDeleteService
            var rollbackService = new VoucherRollbackAndDeleteService(db);
            var postingController = new VoucherPostingController(db, rollbackService);
            AttachAdmin(postingController, closureDate);
            var rejectRes = await postingController.RejectVoucher(firstVoucher.VoucherID, new VoucherPostingController.VoucherRejectDto { Reason = "Wrong entry deleted" });
            Assert.IsType<OkObjectResult>(rejectRes);

            // Must leave ZERO Closure_Interest or Accrual orphans and reopen FD as Active
            Assert.Equal(0, await db.FdTransactions.CountAsync(t => t.FdAccountID == 333 && (t.TransactionType == "Closure_Interest" || t.TransactionType == "Accrual")));
            var reopenedFd = await db.FdAccounts.FindAsync(333);
            Assert.Equal("Active", reopenedFd!.Status);

            // Re-enter PrematureClose -> must STILL debit exact ₹7,605 to 333 (Interest Expense) and ₹0 to 114
            var secondRes = await controller.PrematureClose(333, closureDate, new FdClosureRequest
            {
                ClosureDate = closureDate,
                PaymentMode = "Transfer",
                SavingAccountID = 500,
                IsManualAmountOverride = true,
                CustomAccruedInterest = 7605m,
                ManualOverrideReason = "थेट सेटलमेंट संपादन",
                InterestDebitMode = "Auto"
            });
            Assert.IsType<OkObjectResult>(secondRes);

            var secondVoucher = await db.Vouchers.Include(v => v.VoucherDetails)
                .FirstAsync(v => v.VoucherNo.Contains("FD-PRECLOSE-001-401-0000333-8"));
            Assert.Equal(7605m, secondVoucher.VoucherDetails!.Where(d => d.LedgerID == 333 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(0m, secondVoucher.VoucherDetails!.Where(d => d.LedgerID == 114 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(107605m, secondVoucher.VoucherDetails!.Where(d => d.LedgerID == 40 && d.DrCr == "Cr").Sum(d => d.Amount));
        }
    }
}
