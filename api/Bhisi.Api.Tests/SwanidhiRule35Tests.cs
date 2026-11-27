using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Bhisi.Api.Controllers;
using Bhisi.Api.Data;
using Bhisi.Api.Helpers;
using Bhisi.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class SwanidhiRule35Tests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase($"BhisiSwanidhiRule35_{Guid.NewGuid()}")
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ClaimsPrincipal BuildPrincipal(int userId, string username, string role, int branchId)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Name, username),
                new Claim(ClaimTypes.Role, role),
                new Claim("BranchID", branchId.ToString()),
                new Claim("DefaultBranchID", branchId.ToString())
            };
            return new ClaimsPrincipal(new ClaimsIdentity(claims, "TestJwt"));
        }

        private static SwanidhiController CreateSwanidhiController(AppDbContext db, string role = "SuperAdmin", int branchId = 1)
        {
            var controller = new SwanidhiController(db);
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = BuildPrincipal(1, "auditor", role, branchId) }
            };
            return controller;
        }

        private static AuditComplianceController CreateAuditController(AppDbContext db, string role = "SuperAdmin", int branchId = 1)
        {
            var controller = new AuditComplianceController(db);
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = BuildPrincipal(1, "auditor", role, branchId) }
            };
            return controller;
        }

        private static JsonElement ParseOkJson(IActionResult actionResult)
        {
            var ok = Assert.IsType<OkObjectResult>(actionResult);
            var json = JsonSerializer.Serialize(ok.Value);
            return JsonDocument.Parse(json).RootElement;
        }

        private static async Task SeedBaseStructureAsync(AppDbContext db)
        {
            db.Branches.AddRange(
                new Branch { BranchID = 1, BranchCode = "HO", BranchName = "मुख्य शाखा", BranchType = "HeadOffice", IsActive = true },
                new Branch { BranchID = 2, BranchCode = "BR2", BranchName = "इस्लामपूर शाखा", BranchType = "Branch", IsActive = true }
            );

            db.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "2025-26",
                StartDate = new DateTime(2025, 4, 1),
                EndDate = new DateTime(2026, 3, 31),
                IsActive = true
            });

            db.AccountGroups.AddRange(
                new AccountGroup { GroupID = 1, GroupName = "मालमत्ता (Assets)", NatureOfGroup = "Assets", IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "दायित्वे (Liabilities)", NatureOfGroup = "Liabilities", IsActive = true },
                new AccountGroup { GroupID = 3, GroupName = "उत्पन्न (Income)", NatureOfGroup = "Income", IsActive = true },
                new AccountGroup { GroupID = 4, GroupName = "खर्च (Expenses)", NatureOfGroup = "Expenses", IsActive = true },
                new AccountGroup { GroupID = 5, GroupName = "राखीव व निधी (Sub-Liability)", NatureOfGroup = "", ParentGroupID = 2, IsActive = true },
                new AccountGroup { GroupID = 6, GroupName = "व्याज उत्पन्न (Sub-Income)", NatureOfGroup = "", ParentGroupID = 3, IsActive = true },
                new AccountGroup { GroupID = 7, GroupName = "प्रशासकीय खर्च (Sub-Expense)", NatureOfGroup = "", ParentGroupID = 4, IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 10, GroupID = 1, LedgerName = "रोख शिल्लक", AccountType = "Cash", IsActive = true },
                new Ledger { LedgerID = 20, GroupID = 2, LedgerName = "सभासद भाग भांडवल", AccountType = "Share Capital", IsActive = true },
                new Ledger { LedgerID = 21, GroupID = 5, LedgerName = "वैधानिक राखीव निधी", AccountType = "GL", IsActive = true },
                new Ledger { LedgerID = 22, GroupID = 5, LedgerName = "इमारत निधी", AccountType = "GL", IsActive = true },
                new Ledger { LedgerID = 23, GroupID = 5, LedgerName = "तंत्रज्ञान विकास निधी", AccountType = "GL", IsActive = true },
                new Ledger { LedgerID = 24, GroupID = 5, LedgerName = "उत्तम जिंदगी तरतूद", AccountType = "GL", IsActive = true },
                new Ledger { LedgerID = 25, GroupID = 1, LedgerName = "संचित तोटा", AccountType = "GL", IsActive = true },
                new Ledger { LedgerID = 26, GroupID = 5, LedgerName = "सेवक कल्याण राखीव निधी", AccountType = "GL", ExcludeFromRule35Swanidhi = true, IsActive = true },
                new Ledger { LedgerID = 27, GroupID = 5, LedgerName = "संशयित बुडीत कर्ज निधी (BDDR)", AccountType = "GL", ExcludeFromRule35Swanidhi = true, IsActive = true },
                new Ledger { LedgerID = 28, GroupID = 1, LedgerName = "इतर संस्था शेअर्स गुंतवणूक", AccountType = "Investment", IsActive = true },
                new Ledger { LedgerID = 29, GroupID = 3, LedgerName = "शेअर्स प्रवेश फी", AccountType = "Income", IsActive = true },
                new Ledger { LedgerID = 30, GroupID = 2, LedgerName = "KDCC Gold Repledge Overdraft", AccountType = "GL", IsActive = true },
                new Ledger { LedgerID = 40, GroupID = 6, LedgerName = "कर्ज व्याज उत्पन्न", AccountType = "Income", IsActive = true },
                new Ledger { LedgerID = 41, GroupID = 7, LedgerName = "नोकर पगार खर्च", AccountType = "Expense", IsActive = true },
                new Ledger { LedgerID = 50, GroupID = 2, LedgerName = "बचत ठेव कंट्रोल", AccountType = "Saving Deposit", IsActive = true }
            );

            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task AutoMap_PrioritizesExcludeFromRule35Swanidhi_AndRespectsRootNature()
        {
            using var db = CreateContext();
            await SeedBaseStructureAsync(db);

            db.SansthaBorrowings.Add(new SansthaBorrowing
            {
                BorrowingID = 1,
                BranchID = 1,
                FinancialYearID = 1,
                BorrowingNo = "BRW-001",
                LenderName = "KDCC Bank",
                BorrowingType = "GOLD_REPLEDGE",
                BorrowingLiabilityLedgerID = 30,
                InterestExpenseLedgerID = 41,
                SanctionedAmount = 500000m,
                DisbursedAmount = 500000m,
                OutstandingPrincipal = 500000m,
                Status = "Active"
            });
            await db.SaveChangesAsync();

            var suggested = await SwanidhiCalculationHelper.BuildSuggestedMappingsAsync(db);
            var mapByLedger = suggested.ToDictionary(m => m.LedgerID, m => m.CategoryCode);

            // ExcludeFromRule35Swanidhi & non-free keywords MUST win over "राखीव निधी"
            Assert.Equal("EXCLUDED_RESERVES", mapByLedger[26]);
            Assert.Equal("EXCLUDED_RESERVES", mapByLedger[27]);

            // Investment Shares (Asset) and Entrance Fee (Income) MUST NOT map to PAID_UP_CAPITAL
            Assert.False(mapByLedger.ContainsKey(28));
            Assert.False(mapByLedger.ContainsKey(29));

            // Proper categories
            Assert.Equal("PAID_UP_CAPITAL", mapByLedger[20]);
            Assert.Equal("STATUTORY_RESERVE", mapByLedger[21]);
            Assert.Equal("BUILDING_FUND", mapByLedger[22]);
            Assert.Equal("FREE_AND_DEVELOPMENT_RESERVE", mapByLedger[23]);
            Assert.Equal("STANDARD_ASSET_PROVISION", mapByLedger[24]);
            Assert.Equal("ACCUMULATED_LOSS", mapByLedger[25]);

            // SansthaBorrowings liability ledger MUST auto-map to OUTSIDE_BORROWINGS
            Assert.Equal("OUTSIDE_BORROWINGS", mapByLedger[30]);
        }

        [Fact]
        public async Task AverageDividendRate_CalculatesExactThreeYearAverage_IncludingZeroYears()
        {
            var setting = new SwanidhiSetting
            {
                Year1DividendRate = 10.0m,
                Year2DividendRate = 0.0m,
                Year3DividendRate = 0.0m
            };

            Assert.Equal(3.33m, setting.AverageDividendRate);
        }

        [Fact]
        public async Task StandardAssetProvision_DoesNotAutoInflateWithFake040_AndIncludesSansthaBorrowings()
        {
            using var db = CreateContext();
            await SeedBaseStructureAsync(db);

            // Share capital ₹1,00,000; Standard Asset Provision ledger = ₹0 (no booked provision)
            db.BranchLedgerOpeningBalances.AddRange(
                new BranchLedgerOpeningBalance { BranchID = 1, FinancialYearID = 1, LedgerID = 20, OpeningBalance = 100000m, OpeningBalanceType = "Cr" },
                new BranchLedgerOpeningBalance { BranchID = 1, FinancialYearID = 1, LedgerID = 30, OpeningBalance = 250000m, OpeningBalanceType = "Cr" }
            );

            // Active Standard Loan ₹10,00,000 (0.40% reference = ₹4,000) + NPA Loan ₹5,00,000 (excluded from ref)
            db.LoanAccounts.AddRange(
                new LoanAccount { LoanAccountID = 1, BranchID = 1, LoanAccountNo = "LN-1", PrincipalBalance = 1000000m, Status = "Active", InitialNpaClassification = "Standard", OpeningDate = new DateTime(2025, 5, 1) },
                new LoanAccount { LoanAccountID = 2, BranchID = 1, LoanAccountNo = "LN-2", PrincipalBalance = 500000m, Status = "Active", InitialNpaClassification = "SubStandard", OpeningDate = new DateTime(2025, 5, 1) }
            );

            db.SansthaBorrowings.Add(new SansthaBorrowing
            {
                BorrowingID = 1,
                BranchID = 1,
                FinancialYearID = 1,
                BorrowingNo = "BRW-101",
                LenderName = "KDCC Bank",
                BorrowingType = "GOLD_REPLEDGE",
                BorrowingLiabilityLedgerID = 30,
                InterestExpenseLedgerID = 41,
                DisbursementDate = new DateTime(2025, 6, 1),
                OutstandingPrincipal = 250000m,
                Status = "Active"
            });

            await db.SaveChangesAsync();

            var result = await SwanidhiCalculationHelper.CalculateAsync(db, new DateTime(2026, 3, 31), scopedBranch: null);

            // Booked provision is ₹0 — MUST NOT inflate GrossOwnedFunds with fake ₹4,000!
            Assert.Equal(0m, result.StandardAssetProvision);
            Assert.Equal(100000m, result.GrossOwnedFunds);
            Assert.Equal(100000m, result.NetOwnedFunds);

            // Reference info tracks ONLY Standard active loans (₹10,00,000 * 0.40% = ₹4,000)
            Assert.Equal(1000000m, result.StandardLoansReferenceBase);
            Assert.Equal(4000m, result.EstimatedStandardAssetProvisionRef);

            // Outside borrowings picked up from SansthaBorrowings GL ledger (₹2,50,000)
            Assert.Equal(250000m, result.OutsideBankLoans);
            Assert.Equal(250000m, result.ActualOutsideLiabilities);
            Assert.Equal(1000000m, result.MaxBorrowingLimit);
            Assert.True(result.IsComplied);
        }

        [Fact]
        public async Task HistoricalAsOnDate_ReversesPostDateSavingAndPigmyTransactions()
        {
            using var db = CreateContext();
            await SeedBaseStructureAsync(db);

            db.Customers.Add(new Customer { CustomerID = 1, BranchID = 1, CIFNo = "CIF1", FirstName = "अजय", LastName = "कुलकर्णी" });

            // Saving Account: ₹10,000 on 31/03/2026; then +₹5,000 Deposit on 10/04/2026 and -₹2,000 Withdrawal on 15/04/2026 => Current = ₹13,000
            db.SavingAccountMasters.Add(new SavingAccountMaster
            {
                SavingAccountID = 1,
                BranchID = 1,
                CustomerID = 1,
                LedgerID = 50,
                AccountNo = "SB-001",
                OpeningDate = new DateTime(2025, 4, 10),
                OpeningBalance = 10000m,
                CurrentBalance = 13000m,
                Status = "Active"
            });

            db.SavingTransactions.AddRange(
                new SavingTransaction { TransactionID = 1, SavingAccountID = 1, CustomerID = 1, BranchID = 1, TransactionDate = new DateTime(2026, 4, 10), TransactionType = "Deposit", PaymentMode = "Cash", Amount = 5000m, BalanceAfterTxn = 15000m },
                new SavingTransaction { TransactionID = 2, SavingAccountID = 1, CustomerID = 1, BranchID = 1, TransactionDate = new DateTime(2026, 4, 15), TransactionType = "Withdrawal", PaymentMode = "Cash", Amount = 2000m, BalanceAfterTxn = 13000m }
            );

            // Pigmy Account: ₹6,000 on 31/03/2026; then +₹4,000 Deposit on 05/04/2026 => Net Live = ₹10,000
            db.PigmyAccounts.Add(new PigmyAccount
            {
                PigmyAccountID = 1,
                BranchID = 1,
                CustomerID = 1,
                PigmySchemeID = 1,
                PigmyAgentID = 1,
                AccountNo = "PG-001",
                OpeningDate = new DateTime(2025, 6, 1),
                InterestRate = 5m,
                MaturityDate = new DateTime(2026, 6, 1),
                TotalDepositedAmount = 10000m,
                TotalWithdrawnAmount = 0m,
                Status = "Active"
            });

            db.PigmyTransactions.Add(new PigmyTransaction
            {
                PigmyTransactionID = 1,
                PigmyAccountID = 1,
                TransactionDate = new DateTime(2026, 4, 5),
                ValueDate = new DateTime(2026, 4, 5),
                TransactionType = "DEPOSIT",
                CrAmount = 4000m,
                DrAmount = 0m,
                BalanceAmount = 10000m,
                Narration = "April collection"
            });

            await db.SaveChangesAsync();

            decimal savingAsOfMar31 = await SwanidhiCalculationHelper.GetSavingTotalAsOfAsync(db, new DateTime(2026, 3, 31), 1);
            decimal pigmyAsOfMar31 = await SwanidhiCalculationHelper.GetPigmyTotalAsOfAsync(db, new DateTime(2026, 3, 31), 1);

            Assert.Equal(10000m, savingAsOfMar31);
            Assert.Equal(6000m, pigmyAsOfMar31);
        }

        [Fact]
        public async Task CurrentYearNetLoss_IsDeducted_AndNegativeSwanidhiYieldsZeroMaxBorrowingLimit()
        {
            using var db = CreateContext();
            await SeedBaseStructureAsync(db);

            // Capital = ₹50,000; Income = ₹10,000; Expense = ₹80,000 => Net Loss = ₹70,000 => NetOwnedFunds = -₹20,000 => MaxLimit = ₹0
            db.BranchLedgerOpeningBalances.Add(new BranchLedgerOpeningBalance
            {
                BranchID = 1,
                FinancialYearID = 1,
                LedgerID = 20,
                OpeningBalance = 50000m,
                OpeningBalanceType = "Cr"
            });

            db.Vouchers.AddRange(
                new Voucher
                {
                    VoucherID = 1,
                    BranchID = 1,
                    VoucherNo = "REC-1",
                    VoucherDate = new DateTime(2025, 10, 1),
                    VoucherType = "Receipt",
                    Status = "Approved",
                    TotalAmount = 10000m,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        new VoucherDetail { LedgerID = 10, DrCr = "Dr", Amount = 10000m },
                        new VoucherDetail { LedgerID = 40, DrCr = "Cr", Amount = 10000m }
                    }
                },
                new Voucher
                {
                    VoucherID = 2,
                    BranchID = 1,
                    VoucherNo = "PAY-1",
                    VoucherDate = new DateTime(2025, 11, 1),
                    VoucherType = "Payment",
                    Status = "Approved",
                    TotalAmount = 80000m,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        new VoucherDetail { LedgerID = 41, DrCr = "Dr", Amount = 80000m },
                        new VoucherDetail { LedgerID = 10, DrCr = "Cr", Amount = 80000m }
                    }
                }
            );

            await db.SaveChangesAsync();

            var result = await SwanidhiCalculationHelper.CalculateAsync(db, new DateTime(2026, 3, 31), 1);

            Assert.Equal(0m, result.CertifiedNetProfit);
            Assert.Equal(70000m, result.CurrentYearNetLoss);
            Assert.Equal(70000m, result.TotalDeductions);
            Assert.Equal(-20000m, result.NetOwnedFunds);
            Assert.Equal(0m, result.MaxBorrowingLimit);
            Assert.False(result.IsComplied);
        }

        [Fact]
        public async Task ManualCertifiedNetProfit_HonorsZeroValue_InsteadOfAutoPnl()
        {
            using var db = CreateContext();
            await SeedBaseStructureAsync(db);

            db.BranchLedgerOpeningBalances.Add(new BranchLedgerOpeningBalance
            {
                BranchID = 1,
                FinancialYearID = 1,
                LedgerID = 20,
                OpeningBalance = 100000m,
                OpeningBalanceType = "Cr"
            });

            // P&L has ₹50,000 profit, but auditor explicitly certified ₹0
            db.Vouchers.Add(new Voucher
            {
                VoucherID = 1,
                BranchID = 1,
                VoucherNo = "REC-10",
                VoucherDate = new DateTime(2025, 12, 1),
                VoucherType = "Receipt",
                Status = "Approved",
                TotalAmount = 50000m,
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { LedgerID = 10, DrCr = "Dr", Amount = 50000m },
                    new VoucherDetail { LedgerID = 40, DrCr = "Cr", Amount = 50000m }
                }
            });

            db.SwanidhiSettings.Add(new SwanidhiSetting
            {
                BranchID = 1,
                BorrowingLimitMultiplier = 10m,
                Year1DividendRate = 0m,
                Year2DividendRate = 0m,
                Year3DividendRate = 0m,
                ManualCertifiedNetProfit = 0m
            });

            await db.SaveChangesAsync();

            var result = await SwanidhiCalculationHelper.CalculateAsync(db, new DateTime(2026, 3, 31), 1);

            Assert.True(result.UsedManualCertifiedNetProfit);
            Assert.Equal(0m, result.CertifiedNetProfit);
            Assert.Equal(0m, result.UndistributedNetProfit);
            Assert.Equal(100000m, result.NetOwnedFunds);
        }

        [Fact]
        public async Task ConsolidatedHoReport_AggregatesAllBranches_AndMatchesAuditCompliance()
        {
            using var db = CreateContext();
            await SeedBaseStructureAsync(db);

            // Branch 1: Share Capital ₹1,00,000 + Reserve ₹25,000 + Excluded BDDR ₹40,000
            // Branch 2: Share Capital ₹60,000 + Building Fund ₹15,000
            db.BranchLedgerOpeningBalances.AddRange(
                new BranchLedgerOpeningBalance { BranchID = 1, FinancialYearID = 1, LedgerID = 20, OpeningBalance = 100000m, OpeningBalanceType = "Cr" },
                new BranchLedgerOpeningBalance { BranchID = 1, FinancialYearID = 1, LedgerID = 21, OpeningBalance = 25000m, OpeningBalanceType = "Cr" },
                new BranchLedgerOpeningBalance { BranchID = 1, FinancialYearID = 1, LedgerID = 27, OpeningBalance = 40000m, OpeningBalanceType = "Cr" },
                new BranchLedgerOpeningBalance { BranchID = 2, FinancialYearID = 1, LedgerID = 20, OpeningBalance = 60000m, OpeningBalanceType = "Cr" },
                new BranchLedgerOpeningBalance { BranchID = 2, FinancialYearID = 1, LedgerID = 22, OpeningBalance = 15000m, OpeningBalanceType = "Cr" }
            );
            await db.SaveChangesAsync();

            var swanidhiCtrl = CreateSwanidhiController(db, "SuperAdmin", 1);
            var auditCtrl = CreateAuditController(db, "SuperAdmin", 1);

            var swJson = ParseOkJson(await swanidhiCtrl.GetReport(new DateTime(2026, 3, 31), branchId: null, customMultiplier: null));
            var auJson = ParseOkJson(await auditCtrl.GetOwnedFunds(branchId: null, asOnDate: new DateTime(2026, 3, 31)));

            // Expected Consolidated Owned Funds = (100k + 60k) + 25k + 15k = 200,000 (BDDR 40k MUST be excluded!)
            Assert.Equal(200000m, swJson.GetProperty("NetSwanidhi").GetProperty("AmountInRupees").GetDecimal());
            Assert.Equal(200000m, auJson.GetProperty("NetOwnedFunds").GetDecimal());
            Assert.True(swJson.GetProperty("IsConsolidated").GetBoolean());

            // Verify GET endpoints did NOT mutate SwanidhiLedgerMappings or SwanidhiSettings tables (Strictly Read-Only!)
            Assert.Empty(db.SwanidhiLedgerMappings.ToList());
            Assert.Empty(db.SwanidhiSettings.ToList());
        }

        [Fact]
        public async Task SaveConfig_DeduplicatesLedgerIds_WritesAuditLog_AndValidatesMultiplier()
        {
            using var db = CreateContext();
            await SeedBaseStructureAsync(db);

            var controller = CreateSwanidhiController(db, "SuperAdmin", 1);

            // Invalid multiplier (> 25) => BadRequest
            var badRes = await controller.SaveConfig(new SaveSwanidhiConfigDto
            {
                BranchID = 1,
                BorrowingLimitMultiplier = 99m
            });
            Assert.IsType<BadRequestObjectResult>(badRes);

            // Valid save with duplicate LedgerID=20 => must deduplicate to 1 row and write AuditLog
            var okRes = await controller.SaveConfig(new SaveSwanidhiConfigDto
            {
                BranchID = 1,
                BorrowingLimitMultiplier = 12m,
                Year1DividendRate = 10m,
                Year2DividendRate = 11m,
                Year3DividendRate = 12m,
                ManualCertifiedNetProfit = 0m,
                Mappings = new List<SaveSwanidhiMappingItemDto>
                {
                    new() { CategoryCode = "PAID_UP_CAPITAL", LedgerID = 20 },
                    new() { CategoryCode = "PAID_UP_CAPITAL", LedgerID = 20 }, // duplicate
                    new() { CategoryCode = "STATUTORY_RESERVE", LedgerID = 21 }
                }
            });

            Assert.IsType<OkObjectResult>(okRes);
            Assert.Equal(2, await db.SwanidhiLedgerMappings.CountAsync());
            Assert.Contains(db.AuditLogs, a => a.Action == "SWANIDHI_CONFIG_UPDATE");
        }
    }
}
