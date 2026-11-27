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
using Microsoft.Extensions.Caching.Memory;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class BalanceSheetAndFdCapitalizationTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"BsFdCapTests_{Guid.NewGuid():N}")
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

        private static async Task SeedFdAndBalanceSheetEnvironmentAsync(AppDbContext db, DateTime bizDate)
        {
            db.SansthaDetails.Add(new SansthaDetail
            {
                SansthaID = 1,
                SansthaName = "स्मार्ट पतसंस्था",
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
                YearCode = "2025-2026",
                StartDate = new DateTime(2025, 4, 1),
                EndDate = new DateTime(2026, 3, 31),
                IsActive = true,
                IsClosed = false
            });

            db.BranchDayEndStatuses.Add(new BranchDayEndStatus
            {
                BranchID = 1,
                BusinessDate = bizDate.Date,
                IsDayClosed = false
            });

            // Account Groups: Umbrella Root Groups + Child Section Groups
            db.AccountGroups.AddRange(
                new AccountGroup { GroupID = 1, GroupName = "भांडवल व देणी (Liabilities)", NatureOfGroup = "Liabilities", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "ठेवी (Deposits)", ParentGroupID = 1, NatureOfGroup = "Liabilities", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 3, GroupName = "इतर देणी व तरतुदी (Provisions)", ParentGroupID = 1, NatureOfGroup = "Liabilities", DisplayOrder = 2, IsActive = true },
                new AccountGroup { GroupID = 4, GroupName = "मालमत्ता व येणी (Assets)", NatureOfGroup = "Assets", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 5, GroupName = "रोख शिल्लक (Cash)", ParentGroupID = 4, NatureOfGroup = "Assets", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 6, GroupName = "खर्च (Expenses)", NatureOfGroup = "Expenses", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 7, GroupName = "उत्पन्न (Income)", NatureOfGroup = "Income", DisplayOrder = 1, IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 12, GroupID = 2, LedgerCode = "12", LedgerName = "मुदत ठेव", AccountType = "Fixed Deposit", IsActive = true },
                new Ledger { LedgerID = 23, GroupID = 3, LedgerCode = "23", LedgerName = "देणे मुदत ठेव व्याज (Provision)", AccountType = "Payable", IsActive = true },
                new Ledger { LedgerID = 51, GroupID = 5, LedgerCode = "51", LedgerName = "हातातील रोख शिल्लक", AccountType = "Cash", IsActive = true },
                new Ledger { LedgerID = 132, GroupID = 6, LedgerCode = "132", LedgerName = "मुदत ठेव व्याज खर्च", AccountType = "Expenses", IsActive = true },
                new Ledger { LedgerID = 201, GroupID = 7, LedgerCode = "201", LedgerName = "कर्ज व्याज उत्पन्न", AccountType = "Income", IsActive = true }
            );

            // Balanced Opening Balance: ₹1,00,000 FD Liability (Cr) vs ₹1,00,000 Cash (Dr)
            db.BranchLedgerOpeningBalances.AddRange(
                new BranchLedgerOpeningBalance { BranchID = 1, FinancialYearID = 1, LedgerID = 12, OpeningBalance = 100000m, OpeningBalanceType = "Cr" },
                new BranchLedgerOpeningBalance { BranchID = 1, FinancialYearID = 1, LedgerID = 51, OpeningBalance = 100000m, OpeningBalanceType = "Dr" }
            );

            db.FdSchemes.Add(new FdScheme
            {
                FdSchemeID = 1,
                SchemeCode = "FD401",
                SchemeName = "दामदुप्पट चक्रवाढ ठेव",
                DurationMonths = 12,
                DurationType = "Months",
                SchemeDurationModel = "Fixed",
                InterestRate = 10m,
                SeniorCitizenInterestRate = 10.5m,
                InterestType = "Cumulative",
                InterestPostingMethod = "On Interest",
                InterestCompoundingFrequency = "Quarterly",
                PrematureInterestRate = 8m,
                FdLiabilityLedgerID = 12,
                InterestPayableLedgerID = 23,
                InterestExpenseLedgerID = 132,
                IsActive = true
            });

            db.Customers.Add(new Customer
            {
                CustomerID = 1,
                CIFNo = "CIF000101",
                FirstName = "सुरेश",
                LastName = "पाटील",
                BirthDate = new DateTime(1985, 1, 1),
                BranchID = 1
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
                OpeningDate = new DateTime(2025, 4, 1),
                MaturityDate = new DateTime(2026, 3, 31),
                DurationType = "Months",
                DurationValue = 12,
                DurationInDays = 365,
                DepositAmount = 100000m,
                MaturityAmount = 110000m,
                InterestRate = 10m,
                Status = "Active"
            });

            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task FdInterest_PostToPrincipal_ReflectsUnderDepositLiability_NotProvision_AndClearsCleanlyOnMaturity()
        {
            await using var db = CreateContext();
            var postDate = new DateTime(2025, 9, 30);
            var maturityDate = new DateTime(2026, 3, 31);
            await SeedFdAndBalanceSheetEnvironmentAsync(db, maturityDate);

            var fdController = new FdAccountsController(db);
            AttachAdmin(fdController, postDate);

            // 1. Post ₹4,000 FD Interest with PostingTarget = "Principal" (मुद्दलात व्याज जमा -> ठेवी)
            var postRes = await fdController.PostSelectedInterest(new FdInterestPostRequestDto
            {
                BranchID = 1,
                AccrualDate = postDate,
                CalculationMethod = "OnInterest",
                PostingTarget = "Principal",
                SelectedItems = new List<FdInterestPostItemDto>
                {
                    new FdInterestPostItemDto { FdAccountID = 100, CalculatedInterest = 4000m, ElapsedDays = 183 }
                }
            });
            var okPost = Assert.IsType<OkObjectResult>(postRes);
            var postJson = JsonDocument.Parse(JsonSerializer.Serialize(okPost.Value)).RootElement;
            string capVoucherNo = postJson.GetProperty("VoucherNo").GetString()!;

            // Approve voucher so it reflects in Balance Sheet
            var capVoucher = await db.Vouchers.FirstAsync(v => v.VoucherNo == capVoucherNo);
            capVoucher.Status = "Approved";
            await db.SaveChangesAsync();

            // 2. Verify Balance Sheet: Deposits (Ledger 12) = ₹1,04,000 AND Provision (Ledger 23) = ₹0!
            var reportsController = new ReportsController(db, new MemoryCache(new MemoryCacheOptions()));
            AttachAdmin(reportsController, postDate);

            var bsMid = (await reportsController.GetBalanceSheet(new DateTime(2025, 4, 1), postDate, branchId: 1)).Value!;
            Assert.True(bsMid.IsTallied);

            var depositGroup = bsMid.Liabilities.FirstOrDefault(g => g.Id == 2);
            var provisionGroup = bsMid.Liabilities.FirstOrDefault(g => g.Id == 3);
            Assert.NotNull(depositGroup);
            Assert.Equal(104000m, depositGroup!.Amount); // Principal 1,00,000 + Capitalized Interest 4,000
            Assert.Null(provisionGroup); // Provision group has ₹0 balance — NOT shown under Provisions!

            // 3. MaturedClose at 31/03/2026 (Total payout ₹1,10,000 = ₹1,00,000 + ₹10,000)
            AttachAdmin(fdController, maturityDate);
            var closeRes = await fdController.MaturedClose(100, new FdClosureRequest
            {
                ClosureDate = maturityDate,
                PaymentMode = "Cash"
            });
            Assert.IsType<OkObjectResult>(closeRes);

            // Approve closure voucher and verify Ledger 12 (FD Liability) & Ledger 23 (Provision) are BOTH EXACTLY ₹0!
            var closeVoucher = await db.Vouchers.Include(v => v.VoucherDetails)
                .FirstAsync(v => v.VoucherNo == "JV-FD-CLOSE-001-401-0000100-1");
            closeVoucher.Status = "Approved";
            await db.SaveChangesAsync();

            // Verify closure voucher debited ₹1,04,000 from FD Liability (12), ₹0 from Provision (23), and ₹6,000 from Expense (132)
            Assert.Equal(104000m, closeVoucher.VoucherDetails!.Where(d => d.LedgerID == 12 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(0m, closeVoucher.VoucherDetails!.Where(d => d.LedgerID == 23 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(6000m, closeVoucher.VoucherDetails!.Where(d => d.LedgerID == 132 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(110000m, closeVoucher.VoucherDetails!.Where(d => d.LedgerID == 51 && d.DrCr == "Cr").Sum(d => d.Amount));

            var bsFinal = (await reportsController.GetBalanceSheet(new DateTime(2025, 4, 1), maturityDate, branchId: 1)).Value!;
            Assert.True(bsFinal.IsTallied);
            Assert.Equal(0m, bsFinal.Liabilities.FirstOrDefault(g => g.Id == 2)?.Amount ?? 0m);
            Assert.Equal(0m, bsFinal.Liabilities.FirstOrDefault(g => g.Id == 3)?.Amount ?? 0m);
        }

        [Fact]
        public async Task FdInterest_ProvisionOnly_ReflectsUnderProvision_NotDepositLiability_AndReversesOnRollback()
        {
            await using var db = CreateContext();
            var postDate = new DateTime(2025, 9, 30);
            await SeedFdAndBalanceSheetEnvironmentAsync(db, postDate);

            var fdController = new FdAccountsController(db);
            AttachAdmin(fdController, postDate);

            // 1. Post ₹3,500 FD Interest with PostingTarget = "Provision" (केवळ तरतूद -> देणे व्याज)
            var postRes = await fdController.PostSelectedInterest(new FdInterestPostRequestDto
            {
                BranchID = 1,
                AccrualDate = postDate,
                CalculationMethod = "OnPrincipal",
                PostingTarget = "Provision",
                SelectedItems = new List<FdInterestPostItemDto>
                {
                    new FdInterestPostItemDto { FdAccountID = 100, CalculatedInterest = 3500m, ElapsedDays = 183 }
                }
            });
            var okPost = Assert.IsType<OkObjectResult>(postRes);
            var postJson = JsonDocument.Parse(JsonSerializer.Serialize(okPost.Value)).RootElement;
            string provVoucherNo = postJson.GetProperty("VoucherNo").GetString()!;

            var provVoucher = await db.Vouchers.FirstAsync(v => v.VoucherNo == provVoucherNo);
            provVoucher.Status = "Approved";
            await db.SaveChangesAsync();

            // 2. Verify Balance Sheet: Deposits (Ledger 12) stays ₹1,00,000, Provision (Ledger 23) shows ₹3,500!
            var reportsController = new ReportsController(db, new MemoryCache(new MemoryCacheOptions()));
            AttachAdmin(reportsController, postDate);

            var bs = (await reportsController.GetBalanceSheet(new DateTime(2025, 4, 1), postDate, branchId: 1)).Value!;
            Assert.True(bs.IsTallied);
            Assert.Equal(100000m, bs.Liabilities.First(g => g.Id == 2).Amount);
            Assert.Equal(3500m, bs.Liabilities.First(g => g.Id == 3).Amount);

            // 3. Unpass & Rollback voucher — verify FdInterestAccruals & FdTransactions reverse cleanly
            provVoucher.Status = "Pending";
            await db.SaveChangesAsync();

            var rollbackService = new VoucherRollbackAndDeleteService(db);
            var postingController = new VoucherPostingController(db, rollbackService);
            AttachAdmin(postingController, postDate);

            var rejectRes = await postingController.RejectVoucher(provVoucher.VoucherID, new VoucherPostingController.VoucherRejectDto
            {
                Reason = "Test rollback"
            });
            Assert.IsType<OkObjectResult>(rejectRes);
            Assert.False(await db.FdInterestAccruals.AnyAsync());
            Assert.False(await db.FdTransactions.AnyAsync(t => t.TransactionType == "Accrual" || t.TransactionType == "Interest_Capitalized"));
        }

        [Fact]
        public async Task BalanceSheet_IncludesDirectRootGroupLedgers_AndReportsPendingVouchers()
        {
            await using var db = CreateContext();
            var asOfDate = new DateTime(2025, 10, 15);
            await SeedFdAndBalanceSheetEnvironmentAsync(db, asOfDate);

            // Add a direct ledger mapped straight under the Umbrella Root Group (GroupID = 1, not a child subgroup)
            db.Ledgers.Add(new Ledger
            {
                LedgerID = 99,
                GroupID = 1,
                LedgerCode = "99",
                LedgerName = "थेट रूट देयता खाते",
                AccountType = "Liability",
                IsActive = true
            });
            db.BranchLedgerOpeningBalances.AddRange(
                new BranchLedgerOpeningBalance { BranchID = 1, FinancialYearID = 1, LedgerID = 99, OpeningBalance = 25000m, OpeningBalanceType = "Cr" },
                new BranchLedgerOpeningBalance { BranchID = 1, FinancialYearID = 1, LedgerID = 51, OpeningBalance = 25000m, OpeningBalanceType = "Dr" }
            );

            // Add 1 Pending voucher to test PendingVouchersCount reporting
            db.Vouchers.Add(new Voucher
            {
                BranchID = 1,
                VoucherNo = "JV-PENDING-001",
                VoucherDate = asOfDate,
                VoucherType = "Journal",
                TotalAmount = 7500m,
                Status = "Pending",
                CreatedBy = 1,
                CreatedOn = DateTime.Now
            });
            await db.SaveChangesAsync();

            var reportsController = new ReportsController(db, new MemoryCache(new MemoryCacheOptions()));
            AttachAdmin(reportsController, asOfDate);

            var bs = (await reportsController.GetBalanceSheet(new DateTime(2025, 4, 1), asOfDate, branchId: 1)).Value!;

            // Direct root ledger ₹25,000 MUST NOT be dropped, so TotalLiabilities == TotalAssets == ₹1,25,000 and IsTallied == true
            Assert.Equal(125000m, bs.TotalLiabilities);
            Assert.Equal(125000m, bs.TotalAssets);
            Assert.True(bs.IsTallied);
            Assert.True(bs.IsPreviousYearTallied);
            Assert.Equal(1, bs.PendingVouchersCount);
            Assert.Equal(7500m, bs.PendingVouchersAmount);
        }

        [Fact]
        public async Task LegacyFdOpeningBalance_OnPrincipalVsOnInterest_SplitsBetweenProvisionAndDepositLiability_AndClearsToZeroOnClosure()
        {
            await using var db = CreateContext();
            var fyStart = new DateTime(2026, 4, 1);
            var maturityDate = new DateTime(2026, 4, 30);

            db.SansthaDetails.Add(new SansthaDetail { SansthaID = 1, SansthaName = "स्मार्ट पतसंस्था" });
            db.Branches.Add(new Branch { BranchID = 1, BranchCode = "HO", BranchName = "मुख्य शाखा", DefaultCashLedgerID = 51, IsActive = true });
            db.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "2026-2027",
                StartDate = fyStart,
                EndDate = new DateTime(2027, 3, 31),
                IsActive = true,
                IsClosed = false
            });
            db.BranchDayEndStatuses.AddRange(
                new BranchDayEndStatus { BranchID = 1, BusinessDate = fyStart, IsDayClosed = false },
                new BranchDayEndStatus { BranchID = 1, BusinessDate = maturityDate, IsDayClosed = false }
            );

            db.AccountGroups.AddRange(
                new AccountGroup { GroupID = 1, GroupName = "भांडवल व देणी", NatureOfGroup = "Liabilities", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "ठेवी", ParentGroupID = 1, NatureOfGroup = "Liabilities", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 3, GroupName = "देणे व्याज व तरतुदी", ParentGroupID = 1, NatureOfGroup = "Liabilities", DisplayOrder = 2, IsActive = true },
                new AccountGroup { GroupID = 4, GroupName = "मालमत्ता व येणी", NatureOfGroup = "Assets", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 5, GroupName = "रोख शिल्लक", ParentGroupID = 4, NatureOfGroup = "Assets", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 6, GroupName = "खर्च", NatureOfGroup = "Expenses", DisplayOrder = 1, IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 12, GroupID = 2, LedgerCode = "12", LedgerName = "मुदत ठेव", AccountType = "Fixed Deposit", IsActive = true },
                new Ledger { LedgerID = 23, GroupID = 3, LedgerCode = "23", LedgerName = "देणे मुदत ठेव व्याज तरतूद", AccountType = "Payable", IsActive = true },
                new Ledger { LedgerID = 51, GroupID = 5, LedgerCode = "51", LedgerName = "हातातील रोख शिल्लक", AccountType = "Cash", IsActive = true },
                new Ledger { LedgerID = 132, GroupID = 6, LedgerCode = "132", LedgerName = "मुदत ठेव व्याज खर्च", AccountType = "Expenses", IsActive = true },
                new Ledger { LedgerID = 412, GroupID = 4, LedgerCode = "412", LedgerName = "आरंभिक शिल्लक स्थलांतर", AccountType = "Migration", IsActive = true }
            );

            // Contra Cash Opening Balance = ₹2,16,000 Dr to match 2 legacy FDs (1,08,000 + 1,08,000 = 2,16,000 Cr)
            db.BranchLedgerOpeningBalances.Add(new BranchLedgerOpeningBalance
            {
                BranchID = 1,
                FinancialYearID = 1,
                LedgerID = 51,
                OpeningBalance = 216000m,
                OpeningBalanceType = "Dr"
            });

            db.FdSchemes.AddRange(
                new FdScheme
                {
                    FdSchemeID = 1,
                    SchemeCode = "FD101",
                    SchemeName = "साधी मुदत ठेव (On Principal)",
                    DurationMonths = 13,
                    DurationType = "Months",
                    SchemeDurationModel = "Fixed",
                    InterestRate = 9m,
                    SeniorCitizenInterestRate = 9.5m,
                    InterestType = "Simple",
                    InterestPostingMethod = "On Principal",
                    InterestCompoundingFrequency = "N/A",
                    PrematureInterestRate = 7m,
                    FdLiabilityLedgerID = 12,
                    InterestPayableLedgerID = 23,
                    InterestExpenseLedgerID = 132,
                    IsActive = true
                },
                new FdScheme
                {
                    FdSchemeID = 2,
                    SchemeCode = "FD102",
                    SchemeName = "चक्रवाढ मुदत ठेव (On Interest)",
                    DurationMonths = 13,
                    DurationType = "Months",
                    SchemeDurationModel = "Fixed",
                    InterestRate = 9m,
                    SeniorCitizenInterestRate = 9.5m,
                    InterestType = "Cumulative",
                    InterestPostingMethod = "On Interest",
                    InterestCompoundingFrequency = "Quarterly",
                    PrematureInterestRate = 7m,
                    FdLiabilityLedgerID = 12,
                    InterestPayableLedgerID = 23,
                    InterestExpenseLedgerID = 132,
                    IsActive = true
                }
            );

            db.Customers.AddRange(
                new Customer { CustomerID = 11, BranchID = 1, CIFNo = "CIF000011", FirstName = "अशोक", LastName = "जाधव", BirthDate = new DateTime(1985, 1, 1) },
                new Customer { CustomerID = 12, BranchID = 1, CIFNo = "CIF000012", FirstName = "विजय", LastName = "शिंदे", BirthDate = new DateTime(1985, 1, 1) }
            );
            await db.SaveChangesAsync();

            var fdCtrl = new FdAccountsController(db);
            AttachAdmin(fdCtrl, fyStart);

            // Migrate FD 1 under "On Principal" (Deposit ₹1,00,000 + LegacyAccruedInt ₹8,000)
            var mig1 = await fdCtrl.MigrateFdAccount(new FdAccount
            {
                BranchID = 1,
                CustomerID = 11,
                FdSchemeID = 1,
                LegacyAccountNumber = "501",
                OpeningDate = new DateTime(2025, 3, 30),
                MaturityDate = maturityDate,
                DurationType = "Months",
                DurationValue = 13,
                DurationInDays = 396,
                DepositAmount = 100000m,
                MaturityAmount = 108800m,
                InterestRate = 9m,
                LegacyAccruedInt = 8000m,
                LastInterestPostingDate = new DateTime(2026, 3, 31),
                IsLegacyAccount = true,
                Status = "Active"
            });
            var ok1 = Assert.IsType<OkObjectResult>(mig1.Result);
            var fd1 = Assert.IsType<FdAccount>(ok1.Value);

            // Migrate FD 2 under "On Interest" (Deposit ₹1,00,000 + LegacyAccruedInt ₹8,000)
            var mig2 = await fdCtrl.MigrateFdAccount(new FdAccount
            {
                BranchID = 1,
                CustomerID = 12,
                FdSchemeID = 2,
                LegacyAccountNumber = "502",
                OpeningDate = new DateTime(2025, 3, 30),
                MaturityDate = maturityDate,
                DurationType = "Months",
                DurationValue = 13,
                DurationInDays = 396,
                DepositAmount = 100000m,
                MaturityAmount = 108800m,
                InterestRate = 9m,
                LegacyAccruedInt = 8000m,
                LastInterestPostingDate = new DateTime(2026, 3, 31),
                IsLegacyAccount = true,
                Status = "Active"
            });
            var ok2 = Assert.IsType<OkObjectResult>(mig2.Result);
            var fd2 = Assert.IsType<FdAccount>(ok2.Value);

            // Verify Balance Sheet on 01/04/2026:
            // Deposits (Group 2, Ledger 12) = ₹1,00,000 (FD1) + ₹1,08,000 (FD2 Principal + Capitalized Int) = ₹2,08,000!
            // Provision (Group 3, Ledger 23) = ₹8,000 (FD1 On Principal ONLY!)
            var reportsCtrl = new ReportsController(db, new MemoryCache(new MemoryCacheOptions()));
            AttachAdmin(reportsCtrl, fyStart);

            var bsOpen = (await reportsCtrl.GetBalanceSheet(fyStart, fyStart, branchId: 1)).Value!;
            Assert.True(bsOpen.IsTallied);
            Assert.Equal(208000m, bsOpen.Liabilities.First(g => g.Id == 2).Amount);
            Assert.Equal(8000m, bsOpen.Liabilities.First(g => g.Id == 3).Amount);

            // MaturedClose BOTH FDs on 30/04/2026 (Payout ₹1,08,800 each):
            // FD1 (On Principal) clears ₹8,000 from Provision (InterestDebitMode = "Provision") + ₹800 Expense;
            // FD2 (On Interest) clears ₹1,08,000 from Deposit Liability + ₹0 from Provision + ₹800 Expense even with InterestDebitMode = "Provision"!
            AttachAdmin(fdCtrl, maturityDate);
            Assert.IsType<OkObjectResult>(await fdCtrl.MaturedClose(fd1.FdAccountID, new FdClosureRequest { ClosureDate = maturityDate, PaymentMode = "Cash", InterestDebitMode = "Provision" }));
            Assert.IsType<OkObjectResult>(await fdCtrl.MaturedClose(fd2.FdAccountID, new FdClosureRequest { ClosureDate = maturityDate, PaymentMode = "Cash", InterestDebitMode = "Provision" }));

            var closeVouchers = await db.Vouchers.Include(v => v.VoucherDetails)
                .Where(v => v.VoucherNo.StartsWith("JV-FD-CLOSE-"))
                .ToListAsync();
            Assert.Equal(2, closeVouchers.Count);
            foreach (var cv in closeVouchers) cv.Status = "Approved";
            await db.SaveChangesAsync();

            var cv1 = closeVouchers.Single(v => v.VoucherNo == $"JV-FD-CLOSE-{fd1.AccountNo}");
            Assert.Equal(100000m, cv1.VoucherDetails!.Where(d => d.LedgerID == 12 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(8000m, cv1.VoucherDetails!.Where(d => d.LedgerID == 23 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(800m, cv1.VoucherDetails!.Where(d => d.LedgerID == 132 && d.DrCr == "Dr").Sum(d => d.Amount));

            var cv2 = closeVouchers.Single(v => v.VoucherNo == $"JV-FD-CLOSE-{fd2.AccountNo}");
            Assert.Equal(108000m, cv2.VoucherDetails!.Where(d => d.LedgerID == 12 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(0m, cv2.VoucherDetails!.Where(d => d.LedgerID == 23 && d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(800m, cv2.VoucherDetails!.Where(d => d.LedgerID == 132 && d.DrCr == "Dr").Sum(d => d.Amount));

            // Verify Balance Sheet after closing BOTH FDs: BOTH Deposit Liability (12) AND Provision (23) are ₹0.00!
            AttachAdmin(reportsCtrl, maturityDate);
            var bsClosed = (await reportsCtrl.GetBalanceSheet(fyStart, maturityDate, branchId: 1)).Value!;
            Assert.True(bsClosed.IsTallied);
            Assert.Equal(0m, bsClosed.Liabilities.FirstOrDefault(g => g.Id == 2)?.Amount ?? 0m);
            Assert.Equal(0m, bsClosed.Liabilities.FirstOrDefault(g => g.Id == 3)?.Amount ?? 0m);
        }

        [Fact]
        public async Task PutFdScheme_TogglingPostingMethod_AutomaticallyReSyncsBalanceSheet_AndBlocksAfterClosure()
        {
            await using var db = CreateContext();
            var fyStart = new DateTime(2026, 4, 1);
            var maturityDate = new DateTime(2026, 4, 30);

            db.SansthaDetails.Add(new SansthaDetail { SansthaID = 1, SansthaName = "स्मार्ट पतसंस्था" });
            db.Branches.Add(new Branch { BranchID = 1, BranchCode = "HO", BranchName = "मुख्य शाखा", DefaultCashLedgerID = 51, IsActive = true });
            db.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "2026-2027",
                StartDate = fyStart,
                EndDate = new DateTime(2027, 3, 31),
                IsActive = true,
                IsClosed = false
            });
            db.BranchDayEndStatuses.AddRange(
                new BranchDayEndStatus { BranchID = 1, BusinessDate = fyStart, IsDayClosed = false },
                new BranchDayEndStatus { BranchID = 1, BusinessDate = maturityDate, IsDayClosed = false }
            );

            db.AccountGroups.AddRange(
                new AccountGroup { GroupID = 1, GroupName = "भांडवल व देणी", NatureOfGroup = "Liabilities", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "ठेवी", ParentGroupID = 1, NatureOfGroup = "Liabilities", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 3, GroupName = "देणे व्याज व तरतुदी", ParentGroupID = 1, NatureOfGroup = "Liabilities", DisplayOrder = 2, IsActive = true },
                new AccountGroup { GroupID = 4, GroupName = "मालमत्ता व येणी", NatureOfGroup = "Assets", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 5, GroupName = "रोख शिल्लक", ParentGroupID = 4, NatureOfGroup = "Assets", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 6, GroupName = "खर्च", NatureOfGroup = "Expenses", DisplayOrder = 1, IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 12, GroupID = 2, LedgerCode = "12", LedgerName = "मुदत ठेव", AccountType = "Fixed Deposit", IsActive = true },
                new Ledger { LedgerID = 23, GroupID = 3, LedgerCode = "23", LedgerName = "देणे मुदत ठेव व्याज तरतूद", AccountType = "Payable", IsActive = true },
                new Ledger { LedgerID = 51, GroupID = 5, LedgerCode = "51", LedgerName = "हातातील रोख शिल्लक", AccountType = "Cash", IsActive = true },
                new Ledger { LedgerID = 132, GroupID = 6, LedgerCode = "132", LedgerName = "मुदत ठेव व्याज खर्च", AccountType = "Expenses", IsActive = true },
                new Ledger { LedgerID = 412, GroupID = 4, LedgerCode = "412", LedgerName = "आरंभिक शिल्लक स्थलांतर", AccountType = "Migration", IsActive = true }
            );

            db.BranchLedgerOpeningBalances.Add(new BranchLedgerOpeningBalance
            {
                BranchID = 1,
                FinancialYearID = 1,
                LedgerID = 51,
                OpeningBalance = 109000m,
                OpeningBalanceType = "Dr"
            });

            var scheme = new FdScheme
            {
                FdSchemeID = 1,
                SchemeCode = "FD201",
                SchemeName = "विशेष मुदत ठेव योजना",
                DurationMonths = 13,
                DurationType = "Months",
                SchemeDurationModel = "Fixed",
                InterestRate = 9m,
                SeniorCitizenInterestRate = 9.5m,
                InterestType = "Simple",
                InterestPostingMethod = "On Principal",
                InterestCompoundingFrequency = "N/A",
                MinimumAmount = 1000m,
                MaximumAmount = 1000000m,
                PrematureInterestRate = 7m,
                FdLiabilityLedgerID = 12,
                InterestPayableLedgerID = 23,
                InterestExpenseLedgerID = 132,
                IsActive = true
            };
            db.FdSchemes.Add(scheme);
            db.Customers.Add(new Customer { CustomerID = 21, BranchID = 1, CIFNo = "CIF000021", FirstName = "संदीप", LastName = "देशमुख", BirthDate = new DateTime(1986, 6, 1) });
            await db.SaveChangesAsync();

            var fdCtrl = new FdAccountsController(db);
            AttachAdmin(fdCtrl, fyStart);

            // 1. Enter Legacy FD while scheme is "On Principal"
            var migRes = await fdCtrl.MigrateFdAccount(new FdAccount
            {
                BranchID = 1,
                CustomerID = 21,
                FdSchemeID = 1,
                LegacyAccountNumber = "701",
                OpeningDate = new DateTime(2025, 3, 30),
                MaturityDate = maturityDate,
                DurationType = "Months",
                DurationValue = 13,
                DurationInDays = 396,
                DepositAmount = 100000m,
                MaturityAmount = 109500m,
                InterestRate = 9m,
                LegacyAccruedInt = 9000m,
                LastInterestPostingDate = new DateTime(2026, 3, 31),
                IsLegacyAccount = true,
                Status = "Active"
            });
            var migratedFd = Assert.IsType<FdAccount>(Assert.IsType<OkObjectResult>(migRes.Result).Value);

            var reportsCtrl = new ReportsController(db, new MemoryCache(new MemoryCacheOptions()));
            AttachAdmin(reportsCtrl, fyStart);

            var bsInitial = (await reportsCtrl.GetBalanceSheet(fyStart, fyStart, branchId: 1)).Value!;
            Assert.True(bsInitial.IsTallied);
            Assert.Equal(100000m, bsInitial.Liabilities.First(g => g.Id == 2).Amount);
            Assert.Equal(9000m, bsInitial.Liabilities.First(g => g.Id == 3).Amount);

            // 2. Change Scheme Posting Method from "On Principal" -> "On Interest" via PutFdScheme
            var schemeCtrl = new FdSchemesController(db);
            AttachAdmin(schemeCtrl, fyStart);

            var updatedSchemePayload = new FdScheme
            {
                FdSchemeID = 1,
                SchemeCode = "FD201",
                SchemeName = "विशेष मुदत ठेव योजना",
                DurationMonths = 13,
                DurationType = "Months",
                SchemeDurationModel = "Fixed",
                InterestRate = 9m,
                SeniorCitizenInterestRate = 9.5m,
                InterestType = "Cumulative",
                InterestPostingMethod = "On Interest",
                InterestCompoundingFrequency = "Quarterly",
                MinimumAmount = 1000m,
                MaximumAmount = 1000000m,
                PrematureInterestRate = 7m,
                FdLiabilityLedgerID = 12,
                InterestPayableLedgerID = 23,
                InterestExpenseLedgerID = 132,
                IsActive = true
            };
            Assert.IsType<NoContentResult>(await schemeCtrl.PutFdScheme(1, updatedSchemePayload));

            // Balance Sheet MUST immediately reflect ₹1,09,000 under Deposits (Group 2) and ₹0 under Provision (Group 3)!
            var bsAfterOnInterest = (await reportsCtrl.GetBalanceSheet(fyStart, fyStart, branchId: 1)).Value!;
            Assert.True(bsAfterOnInterest.IsTallied);
            Assert.Equal(109000m, bsAfterOnInterest.Liabilities.First(g => g.Id == 2).Amount);
            Assert.Null(bsAfterOnInterest.Liabilities.FirstOrDefault(g => g.Id == 3));

            // 3. Toggle back "On Interest" -> "On Principal" via PutFdScheme
            updatedSchemePayload.InterestType = "Simple";
            updatedSchemePayload.InterestPostingMethod = "On Principal";
            Assert.IsType<NoContentResult>(await schemeCtrl.PutFdScheme(1, updatedSchemePayload));

            var bsBackToPrincipal = (await reportsCtrl.GetBalanceSheet(fyStart, fyStart, branchId: 1)).Value!;
            Assert.True(bsBackToPrincipal.IsTallied);
            Assert.Equal(100000m, bsBackToPrincipal.Liabilities.First(g => g.Id == 2).Amount);
            Assert.Equal(9000m, bsBackToPrincipal.Liabilities.First(g => g.Id == 3).Amount);

            // 4. Close the FD, then try changing PostingMethod -> Safety Guard MUST block with BadRequest!
            AttachAdmin(fdCtrl, maturityDate);
            Assert.IsType<OkObjectResult>(await fdCtrl.MaturedClose(migratedFd.FdAccountID, new FdClosureRequest { ClosureDate = maturityDate, PaymentMode = "Cash" }));

            updatedSchemePayload.InterestPostingMethod = "On Interest";
            Assert.IsType<BadRequestObjectResult>(await schemeCtrl.PutFdScheme(1, updatedSchemePayload));
        }
    }
}
