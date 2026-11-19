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
    public class AuthorizedShareCapitalBalanceSheetTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"AuthCapTests_{Guid.NewGuid():N}")
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ClaimsPrincipal BuildAdminPrincipal()
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, "1"),
                new Claim(ClaimTypes.Name, "ho_admin"),
                new Claim(ClaimTypes.Role, "Admin"),
                new Claim("BranchID", "1"),
                new Claim("IsHeadOffice", "true")
            };
            return new ClaimsPrincipal(new ClaimsIdentity(claims, "TestJwt"));
        }

        private static void AttachAdmin(ControllerBase controller)
        {
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = BuildAdminPrincipal() }
            };
        }

        private static async Task SeedBasicBalanceSheetAsync(AppDbContext db)
        {
            db.SansthaDetails.Add(new SansthaDetail
            {
                SansthaID = 1,
                SansthaName = "श्री गुरुदेव पगारदार नोकरांची सहकारी पतसंस्था मर्यादीत",
                RegistrationDate = new DateTime(1965, 10, 1)
            });

            db.Branches.Add(new Branch
            {
                BranchID = 1,
                BranchCode = "HO",
                BranchName = "मुख्य शाखा",
                IsActive = true
            });

            db.FinancialYears.AddRange(
                new FinancialYear
                {
                    FinancialYearID = 1,
                    YearCode = "2024-2025",
                    StartDate = new DateTime(2024, 4, 1),
                    EndDate = new DateTime(2025, 3, 31),
                    IsActive = false,
                    IsClosed = true
                },
                new FinancialYear
                {
                    FinancialYearID = 2,
                    YearCode = "2025-2026",
                    StartDate = new DateTime(2025, 4, 1),
                    EndDate = new DateTime(2026, 3, 31),
                    IsActive = true,
                    IsClosed = false
                }
            );

            db.AccountGroups.AddRange(
                new AccountGroup { GroupID = 1, GroupName = "वसुल भाग भांडवल", NatureOfGroup = "Liabilities", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "रोख शिल्लक", NatureOfGroup = "Assets", DisplayOrder = 1, IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 1, GroupID = 1, LedgerCode = "1", LedgerName = "सभासद भाग", AccountType = "Share Capital", OpeningBalance = 1000000m, OpeningBalanceType = "Cr", IsActive = true },
                new Ledger { LedgerID = 51, GroupID = 2, LedgerCode = "51", LedgerName = "हातातील रोख शिल्लक", AccountType = "Cash", OpeningBalance = 1000000m, OpeningBalanceType = "Dr", IsActive = true }
            );

            db.BranchLedgerOpeningBalances.AddRange(
                new BranchLedgerOpeningBalance { BranchID = 1, FinancialYearID = 2, LedgerID = 1, OpeningBalance = 1000000m, OpeningBalanceType = "Cr" },
                new BranchLedgerOpeningBalance { BranchID = 1, FinancialYearID = 2, LedgerID = 51, OpeningBalance = 1000000m, OpeningBalanceType = "Dr" }
            );

            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task BalanceSheet_ReturnsAuthorizedCapitalMemo_WithoutAffectingTotalsOrTally()
        {
            await using var db = CreateContext();
            await SeedBasicBalanceSheetAsync(db);

            var sansthaController = new SansthaDetailsController(db);
            AttachAdmin(sansthaController);

            var addRes = await sansthaController.AddAuthorizedCapitalHistory(new SansthaDetailsController.AuthorizedCapitalRevisionRequest
            {
                EffectiveDate = new DateTime(2024, 4, 1),
                AuthorizedCapitalAmount = 5000000m,
                ShareFaceValue = 100m,
                ResolutionNo = "AGM-2024/01",
                Remarks = "उपविधी मंजूर अधिकृत भागभांडवल"
            });
            Assert.IsType<OkObjectResult>(addRes);

            var reportsController = new ReportsController(db, new MemoryCache(new MemoryCacheOptions()));
            AttachAdmin(reportsController);

            var bsResult = await reportsController.GetBalanceSheet(
                fromDate: new DateTime(2025, 4, 1),
                toDate: new DateTime(2026, 3, 31),
                branchId: null);

            var bs = bsResult.Value;
            Assert.NotNull(bs);
            Assert.NotNull(bs!.AuthorizedCapital);
            Assert.Equal(5000000m, bs.AuthorizedCapital!.CurrentYearAmount);
            Assert.Equal(5000000m, bs.AuthorizedCapital.PreviousYearAmount);
            Assert.Equal(50000, bs.AuthorizedCapital.CurrentYearShareCount);
            Assert.Equal(100m, bs.AuthorizedCapital.ShareFaceValue);

            // Critical Core Banking Accounting Invariant:
            // ₹50,00,000 Authorised Share Capital MUST NOT inflate TotalLiabilities or break Tally!
            Assert.Equal(1000000m, bs.TotalLiabilities);
            Assert.Equal(1000000m, bs.TotalAssets);
            Assert.Equal(0m, bs.Difference);
            Assert.True(bs.IsTallied);
        }

        [Fact]
        public async Task BalanceSheet_ResolvesPreviousAndCurrentYearAuthorizedCapital_AcrossAmendmentDate()
        {
            await using var db = CreateContext();
            await SeedBasicBalanceSheetAsync(db);

            var sansthaController = new SansthaDetailsController(db);
            AttachAdmin(sansthaController);

            // FY 2024-25 ceiling: ₹50,00,000
            Assert.IsType<OkObjectResult>(await sansthaController.AddAuthorizedCapitalHistory(
                new SansthaDetailsController.AuthorizedCapitalRevisionRequest
                {
                    EffectiveDate = new DateTime(2024, 4, 1),
                    AuthorizedCapitalAmount = 5000000m,
                    ShareFaceValue = 100m,
                    ResolutionNo = "AGM-2024/01"
                }));

            // Mid FY 2025-26 bye-law amendment on 01/10/2025: increased to ₹1,00,00,000
            Assert.IsType<OkObjectResult>(await sansthaController.AddAuthorizedCapitalHistory(
                new SansthaDetailsController.AuthorizedCapitalRevisionRequest
                {
                    EffectiveDate = new DateTime(2025, 10, 1),
                    AuthorizedCapitalAmount = 10000000m,
                    ShareFaceValue = 100m,
                    ResolutionNo = "AGM-2025/09",
                    RegistrarApprovalNo = "DDR/SAN/2025/112"
                }));

            var reportsController = new ReportsController(db, new MemoryCache(new MemoryCacheOptions()));
            AttachAdmin(reportsController);

            var bsResult = await reportsController.GetBalanceSheet(
                fromDate: new DateTime(2025, 4, 1),
                toDate: new DateTime(2026, 3, 31),
                branchId: null);

            var bs = bsResult.Value!;
            Assert.NotNull(bs.AuthorizedCapital);
            Assert.Equal(5000000m, bs.AuthorizedCapital!.PreviousYearAmount);
            Assert.Equal(10000000m, bs.AuthorizedCapital.CurrentYearAmount);
            Assert.Equal(50000, bs.AuthorizedCapital.PreviousYearShareCount);
            Assert.Equal(100000, bs.AuthorizedCapital.CurrentYearShareCount);
            Assert.Equal("AGM-2025/09", bs.AuthorizedCapital.CurrentResolutionNo);
            Assert.True(bs.IsTallied);
        }

        [Fact]
        public async Task AuthorizedCapitalHistory_BlocksDecreaseBelowPaidUp_AndSyncsOnEditDelete()
        {
            await using var db = CreateContext();
            await SeedBasicBalanceSheetAsync(db);

            // Seed ₹30,00,000 actual active Paid-Up Share Capital
            db.ShareAccounts.Add(new ShareAccount
            {
                ShareAccountId = 1,
                MemberId = 1,
                CustomerID = 1,
                AccountNo = "001-101-0000001-1",
                TotalShareCount = 30000,
                TotalShareAmount = 3000000m,
                Status = "Active"
            });
            await db.SaveChangesAsync();

            var sansthaController = new SansthaDetailsController(db);
            AttachAdmin(sansthaController);

            // 1. Attempting to set Authorized Capital (₹25,00,000) BELOW Paid-Up (₹30,00,000) MUST BE BLOCKED
            var blockedDecrease = await sansthaController.AddAuthorizedCapitalHistory(
                new SansthaDetailsController.AuthorizedCapitalRevisionRequest
                {
                    EffectiveDate = new DateTime(2025, 4, 1),
                    AuthorizedCapitalAmount = 2500000m,
                    ShareFaceValue = 100m
                });
            Assert.IsType<BadRequestObjectResult>(blockedDecrease);

            // 2. Setting ₹50,00,000 succeeds and syncs SansthaDetail
            var add1 = Assert.IsType<OkObjectResult>(await sansthaController.AddAuthorizedCapitalHistory(
                new SansthaDetailsController.AuthorizedCapitalRevisionRequest
                {
                    EffectiveDate = new DateTime(2024, 4, 1),
                    AuthorizedCapitalAmount = 5000000m,
                    ShareFaceValue = 100m
                }));
            var h1 = Assert.IsType<SansthaAuthorizedCapitalHistory>(add1.Value);

            // 3. Valid increase to ₹80,00,000, then valid decrease to ₹40,00,000 (>= ₹30,00,000 Paid-Up)
            var add2 = Assert.IsType<OkObjectResult>(await sansthaController.AddAuthorizedCapitalHistory(
                new SansthaDetailsController.AuthorizedCapitalRevisionRequest
                {
                    EffectiveDate = new DateTime(2025, 10, 1),
                    AuthorizedCapitalAmount = 8000000m,
                    ShareFaceValue = 100m
                }));
            var h2 = Assert.IsType<SansthaAuthorizedCapitalHistory>(add2.Value);
            Assert.Equal(8000000m, (await db.SansthaDetails.FirstAsync()).AuthorizedShareCapital);

            var updateOk = Assert.IsType<OkObjectResult>(await sansthaController.UpdateAuthorizedCapitalHistory(
                h2.HistoryID,
                new SansthaDetailsController.AuthorizedCapitalRevisionRequest
                {
                    EffectiveDate = new DateTime(2025, 10, 1),
                    AuthorizedCapitalAmount = 4000000m,
                    ShareFaceValue = 100m,
                    ResolutionNo = "AGM-REV-2025"
                }));
            Assert.Equal(4000000m, (await db.SansthaDetails.FirstAsync()).AuthorizedShareCapital);

            // 4. Deleting the latest revision (h2) MUST resync SansthaDetail back to h1 (₹50,00,000)
            var deleteOk = Assert.IsType<OkObjectResult>(await sansthaController.DeleteAuthorizedCapitalHistory(h2.HistoryID));
            var syncedSanstha = await db.SansthaDetails.FirstAsync();
            Assert.Equal(5000000m, syncedSanstha.AuthorizedShareCapital);
            Assert.Equal(50000, syncedSanstha.AuthorizedShareCount);
            Assert.True(h1.HistoryID > 0);
            Assert.NotNull(deleteOk.Value);
        }
    }
}
