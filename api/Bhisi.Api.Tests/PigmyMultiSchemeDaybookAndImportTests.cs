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
using Xunit;

namespace Bhisi.Api.Tests
{
    public class PigmyMultiSchemeDaybookAndImportTests
    {
        private static AppDbContext GetInMemoryDbContext(string dbName)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: dbName)
                .ConfigureWarnings(x => x.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ControllerContext BuildStaffContext(string role = "Cashier", int branchId = 1)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, "TestStaff"),
                new Claim(ClaimTypes.Role, role),
                new Claim(ClaimTypes.NameIdentifier, "1"),
                new Claim("BranchID", branchId.ToString()),
                new Claim("DefaultBranchID", branchId.ToString())
            };
            return new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"))
                }
            };
        }

        private static async Task SeedMultiSchemeBaselineAsync(AppDbContext context, bool scheme2HasLedger = true)
        {
            context.Branches.Add(new Branch { BranchID = 1, BranchCode = "001", BranchName = "Main Branch" });
            context.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "2026-2027",
                IsActive = true,
                StartDate = new DateTime(2026, 4, 1),
                EndDate = new DateTime(2027, 3, 31)
            });

            context.AccountGroups.Add(new AccountGroup { GroupID = 1, GroupName = "ठेवी / रोख", NatureOfGroup = "Liabilities" });
            context.Ledgers.AddRange(
                new Ledger { LedgerID = 1, GroupID = 1, LedgerCode = "CSH-1", LedgerName = "रोख शिल्लक", AccountType = "Cash In Hand", IsActive = true },
                new Ledger { LedgerID = 47, GroupID = 1, LedgerCode = "PGM-1", LedgerName = "पिग्मी ठेव 1", AccountType = "Liabilities", IsActive = true },
                new Ledger { LedgerID = 52, GroupID = 1, LedgerCode = "PGM-2", LedgerName = "पिग्मी ठेव 2", AccountType = "Liabilities", IsActive = true }
            );

            // Stale branch-wide mapping pointing to Ledger 47 must NEVER override PigmyScheme.PigmyLiabilityLedgerID
            context.PigmyVoucherMappings.Add(new PigmyVoucherMapping
            {
                MappingId = 1,
                BranchId = 1,
                CollectionSource = "IMPORT",
                DebitLedgerId = 1,
                CreditLedgerId = 47,
                IsActive = true
            });

            context.PigmySchemes.AddRange(
                new PigmyScheme
                {
                    PigmySchemeID = 1,
                    SchemeCode = "301",
                    SchemeName = "पिग्मी ठेव 1",
                    DurationMonths = 12,
                    TenureDays = 365,
                    InterestRate = 6.0m,
                    PigmyLiabilityLedgerID = 47,
                    Status = "Active"
                },
                new PigmyScheme
                {
                    PigmySchemeID = 2,
                    SchemeCode = "302",
                    SchemeName = "पिग्मी ठेव 2",
                    DurationMonths = 24,
                    TenureDays = 730,
                    InterestRate = 7.0m,
                    PigmyLiabilityLedgerID = scheme2HasLedger ? 52 : (int?)null,
                    Status = "Active"
                }
            );

            context.PigmyAgents.Add(new PigmyAgent
            {
                PigmyAgentID = 4,
                AgentName = "कु. गौरी राजू जाधव",
                BranchID = 1,
                MaxCashLimit = 200000m,
                Status = "Active"
            });

            context.Customers.AddRange(
                new Customer { CustomerID = 1, BranchID = 1, CIFNo = "CIF000001", FirstName = "राम", LastName = "पाटील" },
                new Customer { CustomerID = 2, BranchID = 1, CIFNo = "CIF000002", FirstName = "सीता", LastName = "जाधव" },
                new Customer { CustomerID = 3, BranchID = 1, CIFNo = "CIF000003", FirstName = "हरी", LastName = "कदम" }
            );

            context.PigmyAccounts.AddRange(
                new PigmyAccount
                {
                    PigmyAccountID = 101,
                    AccountNo = "00130100000011",
                    LegacyAccountNumber = "101",
                    OldAccountNo = "101",
                    CustomerID = 1,
                    BranchID = 1,
                    PigmySchemeID = 1,
                    PigmyAgentID = 4,
                    OpeningDate = new DateTime(2026, 3, 1),
                    MaturityDate = new DateTime(2027, 3, 1),
                    InterestRate = 6.0m,
                    Status = "Active"
                },
                new PigmyAccount
                {
                    PigmyAccountID = 102,
                    AccountNo = "00130200000029",
                    LegacyAccountNumber = "101", // Intentionally same legacy number under Scheme 2
                    OldAccountNo = "101",
                    CustomerID = 2,
                    BranchID = 1,
                    PigmySchemeID = 2,
                    PigmyAgentID = 4,
                    OpeningDate = new DateTime(2026, 3, 1),
                    MaturityDate = new DateTime(2028, 3, 1),
                    InterestRate = 7.0m,
                    Status = "Active"
                }
            );

            await context.SaveChangesAsync();
        }

        [Fact]
        public async Task DepositCash_SplitsCreditsAcrossMultiplePigmySchemes_ByLiabilityLedger()
        {
            using var context = GetInMemoryDbContext(nameof(DepositCash_SplitsCreditsAcrossMultiplePigmySchemes_ByLiabilityLedger));
            await SeedMultiSchemeBaselineAsync(context);

            var colDate1 = new DateTime(2026, 4, 1);
            var colDate2 = new DateTime(2026, 4, 3);
            var depDate = new DateTime(2026, 4, 4);

            context.PigmyCollections.AddRange(
                new PigmyCollection
                {
                    PigmyAccountId = 101, // Scheme 1 -> Ledger 47
                    AgentId = 4,
                    CollectionDate = colDate1,
                    CollectionAmount = 10000m,
                    PaymentMode = "CASH",
                    CollectionSource = "IMPORT",
                    ReceiptNo = "IMP-4-1"
                },
                new PigmyCollection
                {
                    PigmyAccountId = 102, // Scheme 2 -> Ledger 52
                    AgentId = 4,
                    CollectionDate = colDate2,
                    CollectionAmount = 6000m,
                    PaymentMode = "CASH",
                    CollectionSource = "IMPORT",
                    ReceiptNo = "IMP-4-2"
                }
            );
            await context.SaveChangesAsync();

            var ctrl = new AgentDayBookController(context) { ControllerContext = BuildStaffContext() };

            // Summary must report per-scheme GL breakup prior to deposit
            var sumRes = await ctrl.GetSummary(4, null, colDate1, colDate2, depDate);
            var sumOk = Assert.IsType<OkObjectResult>(sumRes.Result);
            var summary = Assert.IsType<AgentDayBookController.DayBookSummary>(sumOk.Value);
            Assert.Equal(2, summary.SchemeBreakup.Count);
            Assert.Equal(10000m, summary.SchemeBreakup.Single(s => s.PigmySchemeID == 1).PendingAmount);
            Assert.Equal(47, summary.SchemeBreakup.Single(s => s.PigmySchemeID == 1).LiabilityLedgerID);
            Assert.Equal(6000m, summary.SchemeBreakup.Single(s => s.PigmySchemeID == 2).PendingAmount);
            Assert.Equal(52, summary.SchemeBreakup.Single(s => s.PigmySchemeID == 2).LiabilityLedgerID);

            var depRes = await ctrl.DepositCash(new AgentDayBookController.CashDepositDto
            {
                AgentId = 4,
                BranchId = 1,
                CollectionDateFrom = colDate1,
                CollectionDateTo = colDate2,
                DepositDate = depDate,
                Amount = 16000m,
                PaymentMode = "CASH"
            });
            Assert.IsType<OkObjectResult>(depRes);

            var deposit = await context.PigmyAgentCashDeposits.FirstAsync();
            var details = await context.VoucherDetails.Where(d => d.VoucherID == deposit.VoucherId).ToListAsync();

            Assert.Equal(16000m, details.Where(d => d.DrCr == "Dr" && d.LedgerID == 1).Sum(d => d.Amount));
            Assert.Equal(10000m, details.Where(d => d.DrCr == "Cr" && d.LedgerID == 47).Sum(d => d.Amount));
            Assert.Equal(6000m, details.Where(d => d.DrCr == "Cr" && d.LedgerID == 52).Sum(d => d.Amount));

            var cols = await context.PigmyCollections.ToListAsync();
            Assert.All(cols, c =>
            {
                Assert.Equal(deposit.DepositId, c.RemittanceDepositId);
                Assert.Equal(deposit.VoucherId, c.VoucherId);
                Assert.True(c.IsVoucherGenerated);
            });
        }

        [Fact]
        public async Task DepositCash_Scheme2OnlyAgent_CreditsScheme2Ledger_NeverDefaultsToLedger47()
        {
            using var context = GetInMemoryDbContext(nameof(DepositCash_Scheme2OnlyAgent_CreditsScheme2Ledger_NeverDefaultsToLedger47));
            await SeedMultiSchemeBaselineAsync(context);

            var colDate = new DateTime(2026, 4, 2);
            var depDate = new DateTime(2026, 4, 4);

            context.PigmyCollections.Add(new PigmyCollection
            {
                PigmyAccountId = 102, // Scheme 2 -> Ledger 52 ONLY
                AgentId = 4,
                CollectionDate = colDate,
                CollectionAmount = 16000m,
                PaymentMode = "CASH",
                CollectionSource = "IMPORT",
                ReceiptNo = "IMP-4-S2"
            });
            await context.SaveChangesAsync();

            var ctrl = new AgentDayBookController(context) { ControllerContext = BuildStaffContext() };
            var depRes = await ctrl.DepositCash(new AgentDayBookController.CashDepositDto
            {
                AgentId = 4,
                BranchId = 1,
                CollectionDateFrom = new DateTime(2026, 4, 1),
                CollectionDateTo = new DateTime(2026, 4, 3),
                DepositDate = depDate,
                Amount = 16000m,
                PaymentMode = "CASH"
            });
            Assert.IsType<OkObjectResult>(depRes);

            var deposit = await context.PigmyAgentCashDeposits.FirstAsync();
            var details = await context.VoucherDetails.Where(d => d.VoucherID == deposit.VoucherId).ToListAsync();

            Assert.Equal(0m, details.Where(d => d.DrCr == "Cr" && d.LedgerID == 47).Sum(d => d.Amount));
            Assert.Equal(16000m, details.Where(d => d.DrCr == "Cr" && d.LedgerID == 52).Sum(d => d.Amount));
        }

        [Fact]
        public async Task DepositCash_PartialAndDeleteRollback_PreservesProRataSchemeSplitAndUnlinksCleanly()
        {
            using var context = GetInMemoryDbContext(nameof(DepositCash_PartialAndDeleteRollback_PreservesProRataSchemeSplitAndUnlinksCleanly));
            await SeedMultiSchemeBaselineAsync(context);

            var colDate = new DateTime(2026, 4, 1);
            var depDate = new DateTime(2026, 4, 4);

            context.PigmyCollections.AddRange(
                new PigmyCollection
                {
                    PigmyAccountId = 101,
                    AgentId = 4,
                    CollectionDate = colDate,
                    CollectionAmount = 10000m,
                    PaymentMode = "CASH",
                    CollectionSource = "IMPORT",
                    ReceiptNo = "IMP-P1"
                },
                new PigmyCollection
                {
                    PigmyAccountId = 102,
                    AgentId = 4,
                    CollectionDate = colDate,
                    CollectionAmount = 6000m,
                    PaymentMode = "CASH",
                    CollectionSource = "IMPORT",
                    ReceiptNo = "IMP-P2"
                }
            );
            await context.SaveChangesAsync();

            var ctrl = new AgentDayBookController(context) { ControllerContext = BuildStaffContext() };

            // Partial remittance #1: ₹8,000 (50% of day total ₹16,000 => ₹5,000 to #47 and ₹3,000 to #52)
            var res1 = await ctrl.DepositCash(new AgentDayBookController.CashDepositDto
            {
                AgentId = 4,
                BranchId = 1,
                CollectionDateFrom = colDate,
                CollectionDateTo = colDate,
                DepositDate = depDate,
                Amount = 8000m,
                PaymentMode = "CASH"
            });
            Assert.IsType<OkObjectResult>(res1);

            var dep1 = await context.PigmyAgentCashDeposits.OrderBy(d => d.DepositId).FirstAsync();
            var vd1 = await context.VoucherDetails.Where(v => v.VoucherID == dep1.VoucherId).ToListAsync();
            Assert.Equal(5000m, vd1.Where(v => v.DrCr == "Cr" && v.LedgerID == 47).Sum(v => v.Amount));
            Assert.Equal(3000m, vd1.Where(v => v.DrCr == "Cr" && v.LedgerID == 52).Sum(v => v.Amount));
            Assert.All(await context.PigmyCollections.ToListAsync(), c => Assert.Null(c.RemittanceDepositId));

            // Remittance #2 completes the remaining ₹8,000 => ₹5,000 to #47 and ₹3,000 to #52 + links RemittanceDepositId
            var res2 = await ctrl.DepositCash(new AgentDayBookController.CashDepositDto
            {
                AgentId = 4,
                BranchId = 1,
                CollectionDateFrom = colDate,
                CollectionDateTo = colDate,
                DepositDate = depDate,
                Amount = 8000m,
                PaymentMode = "CASH"
            });
            Assert.IsType<OkObjectResult>(res2);

            var dep2 = await context.PigmyAgentCashDeposits.OrderByDescending(d => d.DepositId).FirstAsync();
            var vd2 = await context.VoucherDetails.Where(v => v.VoucherID == dep2.VoucherId).ToListAsync();
            Assert.Equal(5000m, vd2.Where(v => v.DrCr == "Cr" && v.LedgerID == 47).Sum(v => v.Amount));
            Assert.Equal(3000m, vd2.Where(v => v.DrCr == "Cr" && v.LedgerID == 52).Sum(v => v.Amount));
            Assert.All(await context.PigmyCollections.ToListAsync(), c => Assert.Equal(dep2.DepositId, c.RemittanceDepositId));

            // Delete deposit #2 -> must reset RemittanceDepositId, VoucherId, IsVoucherGenerated without removing collections
            var delRes = await ctrl.DeleteDeposit(dep2.DepositId);
            Assert.IsType<OkObjectResult>(delRes);

            var colsAfterDelete = await context.PigmyCollections.ToListAsync();
            Assert.Equal(2, colsAfterDelete.Count);
            Assert.All(colsAfterDelete, c =>
            {
                Assert.Null(c.RemittanceDepositId);
                Assert.Null(c.VoucherId);
                Assert.False(c.IsVoucherGenerated);
            });
        }

        [Fact]
        public async Task DepositCash_FailsLoudly_WhenPigmySchemeMissingLiabilityLedger()
        {
            using var context = GetInMemoryDbContext(nameof(DepositCash_FailsLoudly_WhenPigmySchemeMissingLiabilityLedger));
            await SeedMultiSchemeBaselineAsync(context, scheme2HasLedger: false);

            var colDate = new DateTime(2026, 4, 2);
            context.PigmyCollections.Add(new PigmyCollection
            {
                PigmyAccountId = 102,
                AgentId = 4,
                CollectionDate = colDate,
                CollectionAmount = 5000m,
                PaymentMode = "CASH",
                CollectionSource = "IMPORT",
                ReceiptNo = "IMP-NOL"
            });
            await context.SaveChangesAsync();

            var ctrl = new AgentDayBookController(context) { ControllerContext = BuildStaffContext() };
            var res = await ctrl.DepositCash(new AgentDayBookController.CashDepositDto
            {
                AgentId = 4,
                BranchId = 1,
                CollectionDateFrom = colDate,
                CollectionDateTo = colDate,
                DepositDate = new DateTime(2026, 4, 4),
                Amount = 5000m,
                PaymentMode = "CASH"
            });

            Assert.IsType<BadRequestObjectResult>(res);
            Assert.Equal(0, await context.Vouchers.CountAsync());
        }

        [Fact]
        public async Task BulkMonthlyChart_AllowsSeparateSchemeImportsForSameAgentMonth_AndSplitsOpeningVoucherCrLedgers()
        {
            using var context = GetInMemoryDbContext(nameof(BulkMonthlyChart_AllowsSeparateSchemeImportsForSameAgentMonth_AndSplitsOpeningVoucherCrLedgers));
            await SeedMultiSchemeBaselineAsync(context);

            var ctrl = new PigmyCollectionsController(context) { ControllerContext = BuildStaffContext() };

            // 1. Import Scheme 1 sheet for April 2026
            var resS1 = await ctrl.ProcessBulkMonthlyChart(new PigmyCollectionsController.BulkMonthlyChartRequestDto
            {
                AgentId = 4,
                PigmySchemeId = 1,
                MonthYear = "2026-04",
                ActiveBusinessDate = new DateTime(2026, 4, 15),
                PaymentMode = "Cash",
                Entries = new List<PigmyCollectionsController.BulkMonthlyChartEntryDto>
                {
                    new PigmyCollectionsController.BulkMonthlyChartEntryDto { PigmyAccountId = 101, CollectionDate = new DateTime(2026, 4, 1), CollectionAmount = 500m }
                }
            });
            Assert.IsType<OkObjectResult>(resS1);

            // 2. CheckMonthlyExists must report false for Scheme 2 and true for Scheme 1
            var checkS2 = Assert.IsType<OkObjectResult>(await ctrl.CheckMonthlyExists(4, "2026-04", schemeId: 2));
            bool? hasExistingS2 = (bool?)checkS2.Value?.GetType().GetProperty("hasExisting")?.GetValue(checkS2.Value);
            Assert.False(hasExistingS2);

            var checkS1 = Assert.IsType<OkObjectResult>(await ctrl.CheckMonthlyExists(4, "2026-04", schemeId: 1));
            bool? hasExistingS1 = (bool?)checkS1.Value?.GetType().GetProperty("hasExisting")?.GetValue(checkS1.Value);
            Assert.True(hasExistingS1);

            // 3. Import Scheme 2 sheet for the SAME Agent & SAME Month must SUCCEED
            var resS2 = await ctrl.ProcessBulkMonthlyChart(new PigmyCollectionsController.BulkMonthlyChartRequestDto
            {
                AgentId = 4,
                PigmySchemeId = 2,
                MonthYear = "2026-04",
                ActiveBusinessDate = new DateTime(2026, 4, 15),
                PaymentMode = "Cash",
                Entries = new List<PigmyCollectionsController.BulkMonthlyChartEntryDto>
                {
                    new PigmyCollectionsController.BulkMonthlyChartEntryDto { PigmyAccountId = 102, CollectionDate = new DateTime(2026, 4, 1), CollectionAmount = 700m }
                }
            });
            Assert.IsType<OkObjectResult>(resS2);

            // 4. Duplicate Scheme 2 import in the same month must STILL be blocked
            var dupResS2 = await ctrl.ProcessBulkMonthlyChart(new PigmyCollectionsController.BulkMonthlyChartRequestDto
            {
                AgentId = 4,
                PigmySchemeId = 2,
                MonthYear = "2026-04",
                ActiveBusinessDate = new DateTime(2026, 4, 15),
                PaymentMode = "Cash",
                Entries = new List<PigmyCollectionsController.BulkMonthlyChartEntryDto>
                {
                    new PigmyCollectionsController.BulkMonthlyChartEntryDto { PigmyAccountId = 102, CollectionDate = new DateTime(2026, 4, 2), CollectionAmount = 700m }
                }
            });
            Assert.IsType<BadRequestObjectResult>(dupResS2);

            // 5. Historical Opening Import (<= 2026-03-31) with BOTH schemes must split Opening Voucher Cr across #47 and #52
            var resOp = await ctrl.ProcessBulkMonthlyChart(new PigmyCollectionsController.BulkMonthlyChartRequestDto
            {
                AgentId = 4,
                MonthYear = "2026-03",
                ActiveBusinessDate = new DateTime(2026, 4, 15),
                PaymentMode = "Cash",
                Entries = new List<PigmyCollectionsController.BulkMonthlyChartEntryDto>
                {
                    new PigmyCollectionsController.BulkMonthlyChartEntryDto { PigmyAccountId = 101, CollectionDate = new DateTime(2026, 3, 25), CollectionAmount = 1200m },
                    new PigmyCollectionsController.BulkMonthlyChartEntryDto { PigmyAccountId = 102, CollectionDate = new DateTime(2026, 3, 25), CollectionAmount = 1800m }
                }
            });
            Assert.IsType<OkObjectResult>(resOp);

            var opVoucher = await context.Vouchers.Include(v => v.VoucherDetails).FirstAsync(v => v.VoucherType == "Opening");
            Assert.Equal(3000m, opVoucher.TotalAmount);
            Assert.Equal(1200m, opVoucher.VoucherDetails.Where(d => d.DrCr == "Cr" && d.LedgerID == 47).Sum(d => d.Amount));
            Assert.Equal(1800m, opVoucher.VoucherDetails.Where(d => d.DrCr == "Cr" && d.LedgerID == 52).Sum(d => d.Amount));
        }

        [Fact]
        public async Task PigmyAccounts_Import_MultiSchemeExcel_SavesEachAccountToExactSchemeAndRejectsMissingScheme()
        {
            using var context = GetInMemoryDbContext(nameof(PigmyAccounts_Import_MultiSchemeExcel_SavesEachAccountToExactSchemeAndRejectsMissingScheme));
            await SeedMultiSchemeBaselineAsync(context);

            var ctrl = new PigmyAccountsController(context) { ControllerContext = BuildStaffContext("Admin") };

            // Missing scheme must fail loudly and NEVER default to Scheme #1
            var badRes = await ctrl.ImportPigmyOpeningBalances(new PigmyOpeningImportRequestDto
            {
                BranchID = 1,
                FinancialYear = "2025-2026",
                AsOfDate = new DateTime(2026, 3, 31),
                Rows = new List<PigmyOpeningImportRowDto>
                {
                    new PigmyOpeningImportRowDto
                    {
                        RowNumber = 2,
                        CustomerCif = "CIF000003",
                        SchemeCodeOrName = "", // Empty scheme -> must reject!
                        AgentCodeOrName = "4",
                        LegacyAccountNumber = "205",
                        OpeningBalance = 4000m
                    }
                }
            });
            Assert.IsType<BadRequestObjectResult>(badRes);

            // Valid multi-scheme import (same legacy #205 allowed across Scheme 1 and Scheme 2!)
            var okRes = await ctrl.ImportPigmyOpeningBalances(new PigmyOpeningImportRequestDto
            {
                BranchID = 1,
                FinancialYear = "2025-2026",
                AsOfDate = new DateTime(2026, 3, 31),
                Rows = new List<PigmyOpeningImportRowDto>
                {
                    new PigmyOpeningImportRowDto
                    {
                        RowNumber = 2,
                        CustomerCif = "CIF000001",
                        SchemeCodeOrName = "301 - पिग्मी ठेव 1",
                        AgentCodeOrName = "कु. गौरी राजू जाधव",
                        LegacyAccountNumber = "205",
                        OpeningBalance = 5000m
                    },
                    new PigmyOpeningImportRowDto
                    {
                        RowNumber = 3,
                        CustomerCif = "CIF000002",
                        SchemeCodeOrName = "302 - पिग्मी ठेव 2",
                        AgentCodeOrName = "कु. गौरी राजू जाधव",
                        LegacyAccountNumber = "205",
                        OpeningBalance = 7500m
                    },
                    new PigmyOpeningImportRowDto
                    {
                        RowNumber = 4,
                        CustomerCif = "CIF000003",
                        SchemeCodeOrName = "302",
                        AgentCodeOrName = "4",
                        LegacyAccountNumber = "206",
                        OpeningBalance = 2500m
                    }
                }
            });
            Assert.IsType<OkObjectResult>(okRes);

            var acc205S1 = await context.PigmyAccounts.FirstOrDefaultAsync(a => a.LegacyAccountNumber == "205" && a.PigmySchemeID == 1);
            var acc205S2 = await context.PigmyAccounts.FirstOrDefaultAsync(a => a.LegacyAccountNumber == "205" && a.PigmySchemeID == 2);
            var acc206S2 = await context.PigmyAccounts.FirstOrDefaultAsync(a => a.LegacyAccountNumber == "206" && a.PigmySchemeID == 2);

            Assert.NotNull(acc205S1);
            Assert.NotNull(acc205S2);
            Assert.NotNull(acc206S2);
            Assert.Equal(5000m, acc205S1!.TotalDepositedAmount);
            Assert.Equal(7500m, acc205S2!.TotalDepositedAmount);
            Assert.Equal(2500m, acc206S2!.TotalDepositedAmount);
            Assert.NotEqual(acc205S1.AccountNo, acc205S2.AccountNo);
            Assert.StartsWith("001301", acc205S1.AccountNo);
            Assert.StartsWith("001302", acc205S2.AccountNo);
        }
    }
}
