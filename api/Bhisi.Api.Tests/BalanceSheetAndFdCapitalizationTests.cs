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
    }
}
