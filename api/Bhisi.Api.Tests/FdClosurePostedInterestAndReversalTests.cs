using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
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
    public class FdClosurePostedInterestAndReversalTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"FdPostedRevTests_{Guid.NewGuid():N}")
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
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestJwt"))
                }
            };
        }

        private static async Task SeedEnvironmentAsync(
            AppDbContext db,
            DateTime bizDate,
            DateTime openingDate,
            DateTime maturityDate,
            string postingMethod = "On Principal",
            decimal depositAmount = 61252m,
            decimal maturityAmount = 65904m)
        {
            db.SansthaDetails.Add(new SansthaDetail
            {
                SansthaID = 1,
                SansthaName = "रयत पतसंस्था",
                FdRenewalReceiptPolicy = "NEW_RECEIPT"
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
                StartDate = new DateTime(2025, 4, 1),
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
                new AccountGroup { GroupID = 4, GroupName = "खर्च", NatureOfGroup = "Expenses", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 5, GroupName = "उत्पन्न", NatureOfGroup = "Income", DisplayOrder = 1, IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 12, GroupID = 1, LedgerCode = "12", LedgerName = "मुदतबंद ठेव", AccountType = "Fixed Deposit", IsActive = true },
                new Ledger { LedgerID = 114, GroupID = 2, LedgerCode = "114", LedgerName = "देणे मुदत ठेव व्याज", AccountType = "Payable", IsActive = true },
                new Ledger { LedgerID = 333, GroupID = 4, LedgerCode = "333", LedgerName = "मुदतठेवीवरील व्याज", AccountType = "Expenses", IsActive = true },
                new Ledger { LedgerID = 51, GroupID = 3, LedgerCode = "51", LedgerName = "हातातील रोख शिल्लक", AccountType = "Cash", IsActive = true },
                new Ledger { LedgerID = 501, GroupID = 2, LedgerCode = "501", LedgerName = "POSTING_INTR", AccountType = "Payable", IsActive = true },
                new Ledger { LedgerID = 502, GroupID = 4, LedgerCode = "502", LedgerName = "NAFATOTA DEY VYAJ", AccountType = "Expenses", IsActive = true },
                new Ledger { LedgerID = 503, GroupID = 5, LedgerCode = "503", LedgerName = "व्याज रिव्हर्सल / दंड खाते", AccountType = "Income", IsActive = true }
            );

            db.FdSchemes.Add(new FdScheme
            {
                FdSchemeID = 1,
                SchemeCode = "FD401",
                SchemeName = "मुदतबंद ठेव",
                DurationMonths = 13,
                DurationType = "Months",
                SchemeDurationModel = "Fixed",
                InterestRate = 7m,
                SeniorCitizenInterestRate = 7.5m,
                InterestType = "Compound",
                InterestPostingMethod = postingMethod,
                InterestCompoundingFrequency = "Yearly",
                PrematureInterestRate = 6m,
                FdLiabilityLedgerID = 12,
                InterestPayableLedgerID = 114,
                InterestExpenseLedgerID = 333,
                IsActive = true
            });

            db.Customers.Add(new Customer
            {
                CustomerID = 70,
                CIFNo = "CIF000070",
                FirstName = "प्रकाश",
                LastName = "शिंदे",
                BirthDate = new DateTime(1985, 1, 1),
                BranchID = 1
            });

            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 11,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = 70,
                FdSchemeID = 1,
                AccountNo = "0014010000011",
                ReceiptNo = "111",
                OpeningDate = openingDate,
                MaturityDate = maturityDate,
                DurationType = "Months",
                DurationValue = 13,
                DurationInDays = 396,
                DepositAmount = depositAmount,
                MaturityAmount = maturityAmount,
                InterestRate = 7m,
                Status = maturityDate.Date <= bizDate.Date ? "Matured" : "Active"
            });

            await db.SaveChangesAsync();
        }

        private static async Task SeedCapitalizedPostingAsync(AppDbContext db, int fdAccountId, DateTime postDate, decimal amount)
        {
            var v = new Voucher
            {
                BranchID = 1,
                VoucherNo = $"JV-FD-CAP-{fdAccountId}-{postDate:yyyyMMdd}",
                VoucherDate = postDate,
                VoucherType = "Journal",
                TotalAmount = amount,
                Status = "Approved",
                Narration = "On Interest Capitalization"
            };
            db.Vouchers.Add(v);
            await db.SaveChangesAsync();

            db.VoucherDetails.AddRange(
                new VoucherDetail { VoucherID = v.VoucherID, LedgerID = 333, DrCr = "Dr", Amount = amount, CustomerID = 70 },
                new VoucherDetail { VoucherID = v.VoucherID, LedgerID = 12, DrCr = "Cr", Amount = amount, CustomerID = 70 }
            );
            db.FdInterestAccruals.Add(new FdInterestAccrual
            {
                FdAccountID = fdAccountId,
                AccrualDate = postDate,
                InterestAmount = amount,
                IsPosted = true,
                PostingTarget = "Principal",
                VoucherID = v.VoucherID
            });
            db.FdTransactions.Add(new FdTransaction
            {
                BranchID = 1,
                FdAccountID = fdAccountId,
                VoucherID = v.VoucherID,
                TransactionDate = postDate,
                TransactionType = "Interest_Capitalized",
                DebitCredit = "Cr",
                Amount = amount
            });
            await db.SaveChangesAsync();
        }

        private static async Task SeedProvisionPostingAsync(AppDbContext db, int fdAccountId, DateTime postDate, decimal amount)
        {
            var v = new Voucher
            {
                BranchID = 1,
                VoucherNo = $"JV-FD-PROV-{fdAccountId}-{postDate:yyyyMMdd}",
                VoucherDate = postDate,
                VoucherType = "Journal",
                TotalAmount = amount,
                Status = "Approved",
                Narration = "FD Provision Posting"
            };
            db.Vouchers.Add(v);
            await db.SaveChangesAsync();

            db.VoucherDetails.AddRange(
                new VoucherDetail { VoucherID = v.VoucherID, LedgerID = 333, DrCr = "Dr", Amount = amount, CustomerID = 70 },
                new VoucherDetail { VoucherID = v.VoucherID, LedgerID = 114, DrCr = "Cr", Amount = amount, CustomerID = 70 }
            );
            db.FdInterestAccruals.Add(new FdInterestAccrual
            {
                FdAccountID = fdAccountId,
                AccrualDate = postDate,
                InterestAmount = amount,
                IsPosted = true,
                PostingTarget = "Provision",
                VoucherID = v.VoucherID
            });
            db.FdTransactions.Add(new FdTransaction
            {
                BranchID = 1,
                FdAccountID = fdAccountId,
                VoucherID = v.VoucherID,
                TransactionDate = postDate,
                TransactionType = "Accrual",
                DebitCredit = "Cr",
                Amount = amount
            });
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task GetFdAccount_And_PrematurePreview_Surface_OnInterest_CapitalizedInterest()
        {
            await using var db = CreateContext();
            var closureDate = new DateTime(2026, 4, 1);
            await SeedEnvironmentAsync(
                db,
                closureDate,
                new DateTime(2025, 3, 20),
                new DateTime(2026, 4, 20),
                postingMethod: "On Interest");
            await SeedCapitalizedPostingAsync(db, 11, new DateTime(2026, 3, 31), 4000m);

            var controller = new FdAccountsController(db);
            AttachAdmin(controller, closureDate);

            // 1. GetFdAccounts (List API — PascalCase anonymous type properties)
            var listRes = await controller.GetFdAccounts(1);
            var listOk = Assert.IsType<OkObjectResult>(listRes.Result);
            var listJson = JsonDocument.Parse(JsonSerializer.Serialize(listOk.Value)).RootElement;
            var accElem = listJson.EnumerateArray().First(x => x.GetProperty("FdAccountID").GetInt32() == 11);
            Assert.Equal(4000m, accElem.GetProperty("AlreadyCapitalizedInterest").GetDecimal());
            Assert.Equal(0m, accElem.GetProperty("AlreadyPostedInterest").GetDecimal());
            Assert.Equal(4000m, accElem.GetProperty("TotalPostedInterest").GetDecimal());
            Assert.Equal("On Interest", accElem.GetProperty("InterestPostingMethod").GetString());

            // 2. GetFdAccount (Single API — PascalCase anonymous type properties)
            var singleRes = await controller.GetFdAccount(11);
            var singleOk = Assert.IsType<OkObjectResult>(singleRes.Result);
            var singleJson = JsonDocument.Parse(JsonSerializer.Serialize(singleOk.Value)).RootElement;
            Assert.Equal(4000m, singleJson.GetProperty("AlreadyCapitalizedInterest").GetDecimal());
            Assert.Equal(4000m, singleJson.GetProperty("TotalPostedInterest").GetDecimal());
            Assert.Equal("On Interest", singleJson.GetProperty("InterestPostingMethod").GetString());

            // 3. GetPrematurePreview
            var prevRes = await controller.GetPrematurePreview(11, closureDate);
            var prevOk = Assert.IsType<OkObjectResult>(prevRes);
            var prevJson = JsonDocument.Parse(JsonSerializer.Serialize(prevOk.Value)).RootElement;
            Assert.Equal(4000m, prevJson.GetProperty("alreadyCapitalizedInterest").GetDecimal());
            Assert.Equal(4000m, prevJson.GetProperty("alreadyAccruedInterest").GetDecimal());
            Assert.Equal(4000m, prevJson.GetProperty("totalPostedInterest").GetDecimal());
            decimal recalc = prevJson.GetProperty("recalculatedInterest").GetDecimal();
            decimal expectedClawback = Math.Max(0m, 4000m - recalc);
            Assert.Equal(expectedClawback, prevJson.GetProperty("penaltyClawback").GetDecimal());
        }

        [Fact]
        public async Task MaturedClose_DualHeadSplit_POSTING_INTR_And_NAFATOTA_CustomLedgers_Balanced()
        {
            await using var db = CreateContext();
            var closureDate = new DateTime(2026, 4, 25);
            await SeedEnvironmentAsync(
                db,
                closureDate,
                new DateTime(2025, 3, 20),
                new DateTime(2026, 4, 20),
                postingMethod: "On Principal",
                depositAmount: 61252m,
                maturityAmount: 64415.29m);

            var controller = new FdAccountsController(db);
            AttachAdmin(controller, closureDate);

            var res = await controller.MaturedClose(11, new FdClosureRequest
            {
                ClosureDate = closureDate,
                PaymentMode = "Cash",
                InterestDebitMode = "Split",
                PostedInterestDebitAmount = 2000m,
                PostedInterestDebitLedgerID = 501,   // POSTING_INTR
                ExpenseInterestDebitAmount = 1163.29m,
                ExpenseInterestDebitLedgerID = 502   // NAFATOTA DEY VYAJ
            });
            Assert.IsType<OkObjectResult>(res);

            var voucher = await db.Vouchers.Include(v => v.VoucherDetails)
                .FirstAsync(v => v.VoucherNo == "JV-FD-CLOSE-0014010000011");

            decimal sumDr = voucher.VoucherDetails!.Where(d => d.DrCr == "Dr").Sum(d => d.Amount);
            decimal sumCr = voucher.VoucherDetails!.Where(d => d.DrCr == "Cr").Sum(d => d.Amount);
            Assert.Equal(sumDr, sumCr);

            Assert.Equal(61252m, voucher.VoucherDetails!.Where(d => d.LedgerID == 12 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(2000m, voucher.VoucherDetails!.Where(d => d.LedgerID == 501 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(1163.29m, voucher.VoucherDetails!.Where(d => d.LedgerID == 502 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(64415.29m, voucher.VoucherDetails!.Where(d => d.LedgerID == 51 && d.DrCr == "Cr").Sum(d => d.Amount));
        }

        [Fact]
        public async Task RenewAccount_DualHeadSplit_Uses_POSTING_INTR_And_NAFATOTA_CustomLedgers()
        {
            await using var db = CreateContext();
            var renewalDate = new DateTime(2026, 4, 25);
            await SeedEnvironmentAsync(
                db,
                renewalDate,
                new DateTime(2025, 3, 20),
                new DateTime(2026, 4, 20),
                postingMethod: "On Principal",
                depositAmount: 61252m,
                maturityAmount: 64415.29m);

            var controller = new FdAccountsController(db);
            AttachAdmin(controller, renewalDate);

            var res = await controller.Renew(11, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = renewalDate,
                DurationType = "Months",
                DurationValue = 13,
                InterestDebitMode = "Split",
                PostedInterestDebitAmount = 2000m,
                PostedInterestDebitLedgerID = 501,
                ExpenseInterestDebitAmount = 1163.29m,
                ExpenseInterestDebitLedgerID = 502
            });
            Assert.IsType<OkObjectResult>(res);

            var renVoucher = await db.Vouchers.Include(v => v.VoucherDetails)
                .FirstAsync(v => v.VoucherNo.StartsWith("JV-FD-REN-"));

            Assert.Equal(61252m, renVoucher.VoucherDetails!.Where(d => d.LedgerID == 12 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(2000m, renVoucher.VoucherDetails!.Where(d => d.LedgerID == 501 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(1163.29m, renVoucher.VoucherDetails!.Where(d => d.LedgerID == 502 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(64415.29m, renVoucher.VoucherDetails!.Where(d => d.LedgerID == 12 && d.DrCr == "Cr").Sum(d => d.Amount));
        }

        [Fact]
        public async Task PrematureClose_OnInterest_Capitalized4000_ReversesExcess_ToCustomReversalCreditLedger()
        {
            await using var db = CreateContext();
            var closureDate = new DateTime(2026, 4, 1);
            await SeedEnvironmentAsync(
                db,
                closureDate,
                new DateTime(2025, 3, 20),
                new DateTime(2026, 4, 20),
                postingMethod: "On Interest");
            await SeedCapitalizedPostingAsync(db, 11, new DateTime(2026, 3, 31), 4000m);

            var controller = new FdAccountsController(db);
            AttachAdmin(controller, closureDate);

            var res = await controller.PrematureClose(11, closureDate, new FdClosureRequest
            {
                ClosureDate = closureDate,
                PaymentMode = "Cash",
                IsManualAmountOverride = true,
                CustomAccruedInterest = 3163.29m,
                InterestDebitMode = "Auto",
                ReversalCreditLedgerID = 503
            });
            Assert.IsType<OkObjectResult>(res);

            var voucher = await db.Vouchers.Include(v => v.VoucherDetails)
                .FirstAsync(v => v.VoucherNo == "JV-FD-PRECLOSE-0014010000011");

            // Dr FD Liability = 61,252 + 4,000 = 65,252
            Assert.Equal(65252m, voucher.VoucherDetails!.Where(d => d.LedgerID == 12 && d.DrCr == "Dr").Sum(d => d.Amount));
            // Cr Cash = 61,252 + 3,163.29 = 64,415.29
            Assert.Equal(64415.29m, voucher.VoucherDetails!.Where(d => d.LedgerID == 51 && d.DrCr == "Cr").Sum(d => d.Amount));
            // Cr Reversal = 4,000 - 3,163.29 = 836.71
            Assert.Equal(836.71m, voucher.VoucherDetails!.Where(d => d.LedgerID == 503 && d.DrCr == "Cr").Sum(d => d.Amount));
        }

        [Fact]
        public async Task PrematureClose_WithProvision4000_AndManualOverride_StillReversesExcessAndZeroEdit()
        {
            await using var db = CreateContext();
            var closureDate = new DateTime(2026, 4, 1);
            await SeedEnvironmentAsync(
                db,
                closureDate,
                new DateTime(2025, 3, 20),
                new DateTime(2026, 4, 20),
                postingMethod: "On Principal");
            await SeedProvisionPostingAsync(db, 11, new DateTime(2026, 3, 31), 4000m);

            var controller = new FdAccountsController(db);
            AttachAdmin(controller, closureDate);

            // Case A: Manual edit to 3163.29 (< 4000) in Auto mode MUST reverse 836.71
            var resA = await controller.PrematureClose(11, closureDate, new FdClosureRequest
            {
                ClosureDate = closureDate,
                PaymentMode = "Cash",
                IsManualAmountOverride = true,
                CustomAccruedInterest = 3163.29m,
                InterestDebitMode = "Auto",
                ReversalCreditLedgerID = 503
            });
            Assert.IsType<OkObjectResult>(resA);

            var vA = await db.Vouchers.Include(v => v.VoucherDetails)
                .FirstAsync(v => v.VoucherNo == "JV-FD-PRECLOSE-0014010000011");
            Assert.Equal(4000m, vA.VoucherDetails!.Where(d => d.LedgerID == 114 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(64415.29m, vA.VoucherDetails!.Where(d => d.LedgerID == 51 && d.DrCr == "Cr").Sum(d => d.Amount));
            Assert.Equal(836.71m, vA.VoucherDetails!.Where(d => d.LedgerID == 503 && d.DrCr == "Cr").Sum(d => d.Amount));

            // Roll back voucher A
            var rollbackService = new VoucherRollbackAndDeleteService(db);
            var postingController = new VoucherPostingController(db, rollbackService);
            AttachAdmin(postingController, closureDate);
            Assert.IsType<OkObjectResult>(await postingController.RejectVoucher(
                vA.VoucherID,
                new VoucherPostingController.VoucherRejectDto { Reason = "Switch to 0 interest break" }));

            // Case B: Break at ₹0 interest in Provision mode MUST reverse FULL 4,000
            var resB = await controller.PrematureClose(11, closureDate, new FdClosureRequest
            {
                ClosureDate = closureDate,
                PaymentMode = "Cash",
                IsManualAmountOverride = true,
                CustomAccruedInterest = 0m,
                InterestDebitMode = "Provision",
                ReversalCreditLedgerID = 503
            });
            Assert.IsType<OkObjectResult>(resB);

            var vB = await db.Vouchers.Include(v => v.VoucherDetails)
                .FirstAsync(v => v.VoucherNo == "JV-FD-PRECLOSE-0014010000011");
            Assert.Equal(61252m, vB.VoucherDetails!.Where(d => d.LedgerID == 12 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(4000m, vB.VoucherDetails!.Where(d => d.LedgerID == 114 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(61252m, vB.VoucherDetails!.Where(d => d.LedgerID == 51 && d.DrCr == "Cr").Sum(d => d.Amount));
            Assert.Equal(4000m, vB.VoucherDetails!.Where(d => d.LedgerID == 503 && d.DrCr == "Cr").Sum(d => d.Amount));
        }

        [Fact]
        public async Task PrematureClose_ExplicitManualSplitAndReversal_WithCustomLedgers_AndRollbackRestoresCleanly()
        {
            await using var db = CreateContext();
            var closureDate = new DateTime(2026, 4, 1);
            await SeedEnvironmentAsync(
                db,
                closureDate,
                new DateTime(2025, 3, 20),
                new DateTime(2026, 4, 20),
                postingMethod: "On Principal");

            var controller = new FdAccountsController(db);
            AttachAdmin(controller, closureDate);

            // Pay ₹3,163.29 from NAFATOTA DEY VYAJ (502) while reversing ₹4,000 manual GL POSTING_INTR (501) -> Cr (503)
            var res = await controller.PrematureClose(11, closureDate, new FdClosureRequest
            {
                ClosureDate = closureDate,
                PaymentMode = "Cash",
                IsManualAmountOverride = true,
                CustomAccruedInterest = 3163.29m,
                InterestDebitMode = "Split",
                PostedInterestDebitAmount = 4000m,
                PostedInterestDebitLedgerID = 501,
                ExpenseInterestDebitAmount = 3163.29m,
                ExpenseInterestDebitLedgerID = 502,
                ReversePostedInterestAmount = 4000m,
                ReversalCreditLedgerID = 503
            });
            Assert.IsType<OkObjectResult>(res);

            var voucher = await db.Vouchers.Include(v => v.VoucherDetails)
                .FirstAsync(v => v.VoucherNo == "JV-FD-PRECLOSE-0014010000011");

            Assert.Equal(61252m, voucher.VoucherDetails!.Where(d => d.LedgerID == 12 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(4000m, voucher.VoucherDetails!.Where(d => d.LedgerID == 501 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(3163.29m, voucher.VoucherDetails!.Where(d => d.LedgerID == 502 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(64415.29m, voucher.VoucherDetails!.Where(d => d.LedgerID == 51 && d.DrCr == "Cr").Sum(d => d.Amount));
            Assert.Equal(4000m, voucher.VoucherDetails!.Where(d => d.LedgerID == 503 && d.DrCr == "Cr").Sum(d => d.Amount));

            // Rollback cleanly removes voucher details and restores Active status
            var rollbackService = new VoucherRollbackAndDeleteService(db);
            var postingController = new VoucherPostingController(db, rollbackService);
            AttachAdmin(postingController, closureDate);
            Assert.IsType<OkObjectResult>(await postingController.RejectVoucher(
                voucher.VoucherID,
                new VoucherPostingController.VoucherRejectDto { Reason = "Rollback test" }));

            Assert.Null(await db.Vouchers.FindAsync(voucher.VoucherID));
            var fdAfter = await db.FdAccounts.FindAsync(11);
            Assert.Equal("Active", fdAfter!.Status);
        }

        [Fact]
        public async Task BackedLegacyProvision_ReturnsOpeningBalanceProvision_AndDeductsClosedLegacyDebitsWithoutDoubleCounting()
        {
            await using var db = CreateContext();
            var bizDate = new DateTime(2026, 6, 30);
            await SeedEnvironmentAsync(
                db,
                bizDate,
                new DateTime(2023, 1, 16),
                new DateTime(2024, 2, 16),
                postingMethod: "On Interest",
                depositAmount: 54870m,
                maturityAmount: 60228m);

            // Ensure CustomerID and Scheme match seeded FD (ID 11 has LegacyAccruedInt = 0 right now)
            var fd1 = await db.FdAccounts.FindAsync(11);
            fd1!.IsLegacyAccount = true;
            fd1.LegacyAccruedInt = 5000m;

            // Add a second legacy FD under the SAME customer & payable ledger (114)
            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 12,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = fd1.CustomerID,
                FdSchemeID = fd1.FdSchemeID,
                AccountNo = "0014010000012",
                ReceiptNo = "882",
                OpeningDate = new DateTime(2023, 2, 1),
                DepositAmount = 50000m,
                InterestRate = 7m,
                MaturityDate = new DateTime(2024, 3, 1),
                MaturityAmount = 55500m,
                IsLegacyAccount = true,
                LegacyAccruedInt = 5000m,
                Status = "Matured"
            });

            // CustomerOpeningBalances backs both ₹5,000 provisions on Ledger 114 (POSTING_INTR)
            db.CustomerOpeningBalances.Add(new CustomerOpeningBalance
            {
                CustomerID = fd1.CustomerID,
                LedgerID = 114,
                Amount = 10000m,
                BalanceType = "Cr",
                SourceModule = "FD"
            });
            await db.SaveChangesAsync();

            var controller = new FdAccountsController(db);
            AttachAdmin(controller, bizDate);

            // 1. Both FDs should surface BackedLegacyProvision = 5000 without polluting AlreadyPostedInterest (VerifiedProvision = 0)
            var singleRes = await controller.GetFdAccount(11);
            var singleOk = Assert.IsType<OkObjectResult>(singleRes.Result);
            var singleJson = JsonDocument.Parse(JsonSerializer.Serialize(singleOk.Value)).RootElement;
            Assert.Equal(0m, singleJson.GetProperty("AlreadyPostedInterest").GetDecimal());
            Assert.Equal(5000m, singleJson.GetProperty("BackedLegacyProvision").GetDecimal());
            Assert.Equal(5000m, singleJson.GetProperty("EffectiveProvisionInterest").GetDecimal());

            var listRes = await controller.GetFdAccounts(1);
            var listOk = Assert.IsType<OkObjectResult>(listRes.Result);
            var listArr = JsonDocument.Parse(JsonSerializer.Serialize(listOk.Value)).RootElement.EnumerateArray().ToList();
            Assert.Equal(5000m, listArr.First(x => x.GetProperty("FdAccountID").GetInt32() == 11).GetProperty("BackedLegacyProvision").GetDecimal());
            Assert.Equal(5000m, listArr.First(x => x.GetProperty("FdAccountID").GetInt32() == 12).GetProperty("BackedLegacyProvision").GetDecimal());

            // 2. Close FD #11 consuming ₹5,000 from Ledger 114 and ₹358 from Expense (333)
            var closeRes = await controller.MaturedClose(11, new FdClosureRequest
            {
                ClosureDate = bizDate,
                PaymentMode = "Cash",
                InterestDebitMode = "Split",
                PostedInterestDebitAmount = 5000m,
                ExpenseInterestDebitAmount = 358m
            });
            Assert.IsType<OkObjectResult>(closeRes);

            // 3. FD #12 must still surface its own remaining ₹5,000 BackedLegacyProvision (10,000 Opening Cr - 5,000 consumed by FD #11)
            var prevRes = await controller.GetPrematurePreview(12, bizDate);
            var prevOk = Assert.IsType<OkObjectResult>(prevRes);
            var prevJson = JsonDocument.Parse(JsonSerializer.Serialize(prevOk.Value)).RootElement;
            Assert.Equal(5000m, prevJson.GetProperty("backedLegacyProvision").GetDecimal());
            Assert.Equal(5000m, prevJson.GetProperty("effectiveProvisionInterest").GetDecimal());
        }
    }
}
