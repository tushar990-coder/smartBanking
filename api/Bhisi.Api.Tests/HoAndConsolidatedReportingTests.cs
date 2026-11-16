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
using Microsoft.Extensions.Caching.Memory;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class HoAndConsolidatedReportingTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"BhisiHoConsolidatedQa_{Guid.NewGuid()}")
                .ConfigureWarnings(x => x.Ignore(InMemoryEventId.TransactionIgnoredWarning))
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

        private static void AttachUser(ControllerBase controller, ClaimsPrincipal principal)
        {
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = principal }
            };
        }

        private static JsonElement ParseOkJson(IActionResult actionResult)
        {
            var ok = Assert.IsType<OkObjectResult>(actionResult);
            var json = JsonSerializer.Serialize(ok.Value);
            return JsonDocument.Parse(json).RootElement;
        }

        private static ReportNodeDto? FindLedgerNode(IEnumerable<ReportNodeDto> nodes, int ledgerId)
        {
            foreach (var node in nodes)
            {
                if (!node.IsGroup && node.Id == ledgerId) return node;
                var childHit = FindLedgerNode(node.Children, ledgerId);
                if (childHit != null) return childHit;
            }
            return null;
        }

        private static async Task SeedMultiBranchSocietyAsync(AppDbContext db, decimal staleGlobalCashOb = 0m, decimal staleGlobalShareOb = 0m)
        {
            db.AccountGroups.AddRange(
                new AccountGroup { GroupID = 1, GroupName = "रोख व बँक शिल्लक (Cash & Bank)", NatureOfGroup = "Assets", IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "भागभांडवल व निधी (Capital & Reserves)", NatureOfGroup = "Liabilities", IsActive = true },
                new AccountGroup { GroupID = 3, GroupName = "ठेवी (Deposits)", NatureOfGroup = "Liabilities", IsActive = true }
            );

            // Stale Ledgers.OpeningBalance simulates uncleaned global master values that MUST NEVER bleed into reports
            db.Ledgers.AddRange(
                new Ledger
                {
                    LedgerID = 10,
                    GroupID = 1,
                    LedgerCode = "CASH",
                    LedgerName = "रोख शिल्लक (Cash in Hand)",
                    AccountType = "Cash",
                    OpeningBalance = staleGlobalCashOb,
                    OpeningBalanceType = "Dr",
                    IsActive = true
                },
                new Ledger
                {
                    LedgerID = 20,
                    GroupID = 2,
                    LedgerCode = "SHCAP",
                    LedgerName = "भागभांडवल (Share Capital)",
                    AccountType = "Share Capital",
                    OpeningBalance = staleGlobalShareOb,
                    OpeningBalanceType = "Cr",
                    IsActive = true
                },
                new Ledger
                {
                    LedgerID = 30,
                    GroupID = 3,
                    LedgerCode = "SBCTRL",
                    LedgerName = "बचत ठेव (Saving Deposits)",
                    AccountType = "Saving Deposit",
                    OpeningBalance = 0m,
                    OpeningBalanceType = "Cr",
                    IsActive = true
                },
                new Ledger
                {
                    LedgerID = 40,
                    GroupID = 2,
                    LedgerCode = "RESFUND",
                    LedgerName = "राखीव निधी (Statutory Reserve Fund)",
                    AccountType = "GL",
                    OpeningBalance = 0m,
                    OpeningBalanceType = "Cr",
                    IsActive = true
                }
            );

            db.Branches.AddRange(
                new Branch
                {
                    BranchID = 1,
                    BranchCode = "HO",
                    BranchName = "मुख्य कार्यालय पुणे",
                    BranchType = "HeadOffice",
                    DefaultCashLedgerID = 10,
                    IsActive = true
                },
                new Branch
                {
                    BranchID = 2,
                    BranchCode = "SSW",
                    BranchName = "सासवड शाखा",
                    BranchType = "Branch",
                    DefaultCashLedgerID = 10,
                    IsActive = true
                }
            );

            db.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "2025-2026",
                StartDate = new DateTime(2025, 4, 1),
                EndDate = new DateTime(2026, 3, 31),
                IsActive = true,
                IsClosed = false
            });

            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task TrialBalance_HO_Plus_Branch2_Equals_Consolidated_WithZeroStaleGlobalFallback()
        {
            await using var db = CreateContext();
            await SeedMultiBranchSocietyAsync(db, staleGlobalCashOb: 999999m, staleGlobalShareOb: 999999m);

            // HO Opening Balance: Cash Dr 100,000 | Share Capital Cr 100,000
            // Branch 2 Opening Balance: Cash Dr 50,000 | Saving Deposits Cr 50,000
            db.BranchLedgerOpeningBalances.AddRange(
                new BranchLedgerOpeningBalance { BranchID = 1, LedgerID = 10, FinancialYearID = 1, OpeningBalance = 100000m, OpeningBalanceType = "Dr", CreatedBy = 1, CreatedOn = DateTime.UtcNow },
                new BranchLedgerOpeningBalance { BranchID = 1, LedgerID = 20, FinancialYearID = 1, OpeningBalance = 100000m, OpeningBalanceType = "Cr", CreatedBy = 1, CreatedOn = DateTime.UtcNow },
                new BranchLedgerOpeningBalance { BranchID = 2, LedgerID = 10, FinancialYearID = 1, OpeningBalance = 50000m, OpeningBalanceType = "Dr", CreatedBy = 1, CreatedOn = DateTime.UtcNow },
                new BranchLedgerOpeningBalance { BranchID = 2, LedgerID = 30, FinancialYearID = 1, OpeningBalance = 50000m, OpeningBalanceType = "Cr", CreatedBy = 1, CreatedOn = DateTime.UtcNow }
            );

            // Approved Vouchers: Branch 1 (+10,000 Cash / Reserves), Branch 2 (+5,000 Cash / Saving)
            var txDate = new DateTime(2025, 6, 15);
            db.Vouchers.AddRange(
                new Voucher
                {
                    VoucherID = 1,
                    BranchID = 1,
                    VoucherNo = "HO-REC-001",
                    VoucherType = "Receipt",
                    VoucherDate = txDate,
                    TotalAmount = 10000m,
                    Status = "Approved",
                    CreatedBy = 1,
                    CreatedOn = txDate,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        new VoucherDetail { VoucherID = 1, LedgerID = 10, DrCr = "Dr", Amount = 10000m },
                        new VoucherDetail { VoucherID = 1, LedgerID = 40, DrCr = "Cr", Amount = 10000m }
                    }
                },
                new Voucher
                {
                    VoucherID = 2,
                    BranchID = 2,
                    VoucherNo = "SSW-REC-001",
                    VoucherType = "Receipt",
                    VoucherDate = txDate,
                    TotalAmount = 5000m,
                    Status = "Approved",
                    CreatedBy = 2,
                    CreatedOn = txDate,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        new VoucherDetail { VoucherID = 2, LedgerID = 10, DrCr = "Dr", Amount = 5000m },
                        new VoucherDetail { VoucherID = 2, LedgerID = 30, DrCr = "Cr", Amount = 5000m }
                    }
                }
            );
            await db.SaveChangesAsync();

            using var cache = new MemoryCache(new MemoryCacheOptions());
            var reports = new ReportsController(db, cache);
            AttachUser(reports, BuildPrincipal(1, "ho_admin", "Admin", branchId: 1));

            var from = new DateTime(2025, 4, 1);
            var to = new DateTime(2026, 3, 31);

            var hoNodes = (await reports.GetTrialBalance(from, to, 1)).Value!.ToList();
            var b2Nodes = (await reports.GetTrialBalance(from, to, 2)).Value!.ToList();
            var allNodes = (await reports.GetTrialBalance(from, to, 0)).Value!.ToList();

            var hoCash = FindLedgerNode(hoNodes, 10)!;
            var b2Cash = FindLedgerNode(b2Nodes, 10)!;
            var allCash = FindLedgerNode(allNodes, 10)!;
            var allShare = FindLedgerNode(allNodes, 20)!;
            var allSaving = FindLedgerNode(allNodes, 30)!;
            var allReserves = FindLedgerNode(allNodes, 40)!;

            // Zero fallback from 999999 stale Ledgers.OpeningBalance
            Assert.Equal(100000m, hoCash.OpeningBalance);
            Assert.Equal(110000m, hoCash.ClosingBalance);

            Assert.Equal(50000m, b2Cash.OpeningBalance);
            Assert.Equal(55000m, b2Cash.ClosingBalance);

            // HO + Branch 2 == Consolidated
            Assert.Equal(hoCash.OpeningBalance + b2Cash.OpeningBalance, allCash.OpeningBalance);
            Assert.Equal(hoCash.ClosingBalance + b2Cash.ClosingBalance, allCash.ClosingBalance);
            Assert.Equal(165000m, allCash.ClosingBalance);
            Assert.Equal("Dr", allCash.ClosingType);

            Assert.Equal(100000m, allShare.ClosingBalance);
            Assert.Equal(55000m, allSaving.ClosingBalance);
            Assert.Equal(10000m, allReserves.ClosingBalance);
            Assert.Equal(allCash.ClosingBalance, allShare.ClosingBalance + allSaving.ClosingBalance + allReserves.ClosingBalance);
        }

        [Fact]
        public async Task MigrateHoLegacy_MovesLegacyBalancesToHo_AndClearsMaster_AndBulkSaveEnforcesBranchAndBalance()
        {
            await using var db = CreateContext();
            await SeedMultiBranchSocietyAsync(db, staleGlobalCashOb: 50000m, staleGlobalShareOb: 50000m);

            var controller = new BranchLedgerOpeningBalancesController(db);

            // 1. Non-HO BranchManager cannot migrate HO legacy OB or save to Branch 1 (HO)
            AttachUser(controller, BuildPrincipal(22, "ssw_mgr", "BranchManager", branchId: 2));
            Assert.IsType<ForbidResult>(await controller.MigrateHoLegacyOpeningBalances(null));

            var crossBranchSave = await controller.BulkSaveOpeningBalances(new BranchLedgerOpeningBalancesController.BulkSaveOpeningBalanceRequest
            {
                BranchID = 1,
                FinancialYearID = 1,
                Items = new List<BranchLedgerOpeningBalancesController.BranchLedgerOpeningDto>
                {
                    new BranchLedgerOpeningBalancesController.BranchLedgerOpeningDto { LedgerID = 10, OpeningBalance = 1000m, OpeningBalanceType = "Dr" }
                }
            });
            Assert.IsType<ForbidResult>(crossBranchSave);

            // 2. Non-HO BranchManager saving unbalanced entries with RequireBalanced = true gets 400 BadRequest
            var unbalancedStrict = await controller.BulkSaveOpeningBalances(new BranchLedgerOpeningBalancesController.BulkSaveOpeningBalanceRequest
            {
                BranchID = 2,
                FinancialYearID = 1,
                RequireBalanced = true,
                Items = new List<BranchLedgerOpeningBalancesController.BranchLedgerOpeningDto>
                {
                    new BranchLedgerOpeningBalancesController.BranchLedgerOpeningDto { LedgerID = 10, OpeningBalance = 20000m, OpeningBalanceType = "Dr" }
                }
            });
            Assert.IsType<BadRequestObjectResult>(unbalancedStrict);

            // 3. Balanced save for own Branch 2 with RequireBalanced = true succeeds
            var balancedSave = await controller.BulkSaveOpeningBalances(new BranchLedgerOpeningBalancesController.BulkSaveOpeningBalanceRequest
            {
                BranchID = 2,
                FinancialYearID = 1,
                RequireBalanced = true,
                Items = new List<BranchLedgerOpeningBalancesController.BranchLedgerOpeningDto>
                {
                    new BranchLedgerOpeningBalancesController.BranchLedgerOpeningDto { LedgerID = 10, OpeningBalance = 20000m, OpeningBalanceType = "Dr" },
                    new BranchLedgerOpeningBalancesController.BranchLedgerOpeningDto { LedgerID = 30, OpeningBalance = 20000m, OpeningBalanceType = "Cr" }
                }
            });
            var saveJson = ParseOkJson(balancedSave);
            Assert.True(saveJson.GetProperty("isBalanced").GetBoolean());
            Assert.Equal(20000m, saveJson.GetProperty("totalDr").GetDecimal());
            Assert.Equal(20000m, saveJson.GetProperty("totalCr").GetDecimal());

            // 4. HO Admin inspects migration status and runs audited HO legacy migration
            AttachUser(controller, BuildPrincipal(1, "ho_admin", "Admin", branchId: 1));
            var statusJson = ParseOkJson(await controller.GetLegacyMigrationStatus(1));
            Assert.Equal(2, statusJson.GetProperty("pendingMigrationCount").GetInt32());
            Assert.Equal(50000m, statusJson.GetProperty("legacyTotalDr").GetDecimal());
            Assert.Equal(50000m, statusJson.GetProperty("legacyTotalCr").GetDecimal());

            var migJson = ParseOkJson(await controller.MigrateHoLegacyOpeningBalances(new BranchLedgerOpeningBalancesController.MigrateHoLegacyRequest
            {
                FinancialYearID = 1,
                OverwriteExisting = false,
                ClearLegacyMasterBalances = true,
                AllowUnbalancedClear = false
            }));

            Assert.Equal(2, migJson.GetProperty("migratedCount").GetInt32());
            Assert.True(migJson.GetProperty("clearedLegacyMasterBalances").GetBoolean());
            Assert.True(migJson.GetProperty("isBalanced").GetBoolean());

            // Verify Ledgers.OpeningBalance reset to 0 and BranchLedgerOpeningBalances created for HO
            Assert.Equal(0m, (await db.Ledgers.FindAsync(10))!.OpeningBalance);
            Assert.Equal(0m, (await db.Ledgers.FindAsync(20))!.OpeningBalance);

            var hoCashOb = await db.BranchLedgerOpeningBalances.FirstAsync(b => b.BranchID == 1 && b.FinancialYearID == 1 && b.LedgerID == 10);
            Assert.Equal(50000m, hoCashOb.OpeningBalance);
            Assert.Equal("Dr", hoCashOb.OpeningBalanceType);

            Assert.True(await db.AuditLogs.AnyAsync(a => a.Action == "MIGRATE_HO_LEGACY_OB"));
        }

        [Fact]
        public async Task FinancialYearBaselineHelper_IsolatesPerBranchNextFyOpeningBalances()
        {
            await using var db = CreateContext();
            await SeedMultiBranchSocietyAsync(db);

            db.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 2,
                YearCode = "2026-2027",
                StartDate = new DateTime(2026, 4, 1),
                EndDate = new DateTime(2027, 3, 31),
                IsActive = false,
                IsClosed = false
            });

            // Both Branch 1 and Branch 2 have OB in FY 1
            // Only Branch 1 has rolled over OB into FY 2
            db.BranchLedgerOpeningBalances.AddRange(
                new BranchLedgerOpeningBalance { BranchID = 1, LedgerID = 10, FinancialYearID = 1, OpeningBalance = 10000m, OpeningBalanceType = "Dr", CreatedBy = 1, CreatedOn = DateTime.UtcNow },
                new BranchLedgerOpeningBalance { BranchID = 2, LedgerID = 10, FinancialYearID = 1, OpeningBalance = 20000m, OpeningBalanceType = "Dr", CreatedBy = 1, CreatedOn = DateTime.UtcNow },
                new BranchLedgerOpeningBalance { BranchID = 1, LedgerID = 10, FinancialYearID = 2, OpeningBalance = 15000m, OpeningBalanceType = "Dr", CreatedBy = 1, CreatedOn = DateTime.UtcNow }
            );
            await db.SaveChangesAsync();

            var fy2QueryDate = new DateTime(2026, 6, 1);

            var hoBaseline = await FinancialYearBaselineHelper.ResolveBaselineAsync(db, fy2QueryDate, branchId: 1);
            var branch2Baseline = await FinancialYearBaselineHelper.ResolveBaselineAsync(db, fy2QueryDate, branchId: 2);

            Assert.Equal(2, hoBaseline.TargetFinancialYearId);
            Assert.Equal(2, hoBaseline.BaselineFinancialYearId);
            Assert.Equal(new DateTime(2026, 4, 1), hoBaseline.BaselineStartDate);

            // Branch 2 has not yet rolled into FY 2, so it MUST fall back to FY 1 (not leak Branch 1's rollover!)
            Assert.Equal(2, branch2Baseline.TargetFinancialYearId);
            Assert.Equal(1, branch2Baseline.BaselineFinancialYearId);
            Assert.Equal(new DateTime(2025, 4, 1), branch2Baseline.BaselineStartDate);
        }

        [Fact]
        public async Task StatutoryControllers_Crr_AuditCompliance_RegulatoryMis_Swanidhi_UseBranchSingleSourceAndScope()
        {
            await using var db = CreateContext();
            // Seed huge stale legacy balance to catch any remaining fallback immediately
            await SeedMultiBranchSocietyAsync(db, staleGlobalCashOb: 888888m, staleGlobalShareOb: 888888m);

            db.BranchLedgerOpeningBalances.AddRange(
                // Branch 1 (HO): Cash 40,000 Dr, Share Capital 30,000 Cr, Statutory Reserve 10,000 Cr
                new BranchLedgerOpeningBalance { BranchID = 1, LedgerID = 10, FinancialYearID = 1, OpeningBalance = 40000m, OpeningBalanceType = "Dr", CreatedBy = 1, CreatedOn = DateTime.UtcNow },
                new BranchLedgerOpeningBalance { BranchID = 1, LedgerID = 20, FinancialYearID = 1, OpeningBalance = 30000m, OpeningBalanceType = "Cr", CreatedBy = 1, CreatedOn = DateTime.UtcNow },
                new BranchLedgerOpeningBalance { BranchID = 1, LedgerID = 40, FinancialYearID = 1, OpeningBalance = 10000m, OpeningBalanceType = "Cr", CreatedBy = 1, CreatedOn = DateTime.UtcNow },
                // Branch 2 (SSW): Cash 20,000 Dr, Share Capital 20,000 Cr
                new BranchLedgerOpeningBalance { BranchID = 2, LedgerID = 10, FinancialYearID = 1, OpeningBalance = 20000m, OpeningBalanceType = "Dr", CreatedBy = 1, CreatedOn = DateTime.UtcNow },
                new BranchLedgerOpeningBalance { BranchID = 2, LedgerID = 20, FinancialYearID = 1, OpeningBalance = 20000m, OpeningBalanceType = "Cr", CreatedBy = 1, CreatedOn = DateTime.UtcNow }
            );

            db.AuditLedgerMappings.AddRange(
                new AuditLedgerMapping { CategoryCode = "SHARE_CAPITAL", CategoryName = "Share Capital", LedgerID = 20 },
                new AuditLedgerMapping { CategoryCode = "STATUTORY_RESERVE", CategoryName = "Statutory Reserve", LedgerID = 40 },
                new AuditLedgerMapping { CategoryCode = "CASH_IN_HAND", CategoryName = "Cash in Hand", LedgerID = 10 }
            );

            db.SwanidhiLedgerMappings.AddRange(
                new SwanidhiLedgerMapping { CategoryCode = "PAID_UP_CAPITAL", CategoryName = "Paid-up Capital", LedgerID = 20 },
                new SwanidhiLedgerMapping { CategoryCode = "STATUTORY_RESERVE", CategoryName = "Reserve Fund", LedgerID = 40 }
            );
            await db.SaveChangesAsync();

            var hoUser = BuildPrincipal(1, "ho_admin", "Admin", branchId: 1);
            var branch2User = BuildPrincipal(22, "ssw_mgr", "BranchManager", branchId: 2);
            string asOn = "2025-12-31";
            var asOnDate = new DateTime(2025, 12, 31);

            // 1. CRR Summary
            var crr = new CrrReportController(db);
            AttachUser(crr, hoUser);
            var crrB1 = ParseOkJson(await crr.GetSummary(asOn, branchId: 1));
            var crrB2 = ParseOkJson(await crr.GetSummary(asOn, branchId: 2));
            var crrAll = ParseOkJson(await crr.GetSummary(asOn, branchId: 0));
            Assert.Equal(40000m, crrB1.GetProperty("cashInHand").GetDecimal());
            Assert.Equal(20000m, crrB2.GetProperty("cashInHand").GetDecimal());
            Assert.Equal(60000m, crrAll.GetProperty("cashInHand").GetDecimal());

            // 2. Audit Compliance OwnedFunds (HO + Consolidated + Non-HO Lock)
            var audit = new AuditComplianceController(db);
            AttachUser(audit, hoUser);
            var ownedB1 = ParseOkJson(await audit.GetOwnedFunds(branchId: 1, asOnDate: asOnDate));
            var ownedB2 = ParseOkJson(await audit.GetOwnedFunds(branchId: 2, asOnDate: asOnDate));
            var ownedAll = ParseOkJson(await audit.GetOwnedFunds(branchId: null, asOnDate: asOnDate));
            Assert.Equal(30000m, ownedB1.GetProperty("PaidUpCapital").GetDecimal());
            Assert.Equal(20000m, ownedB2.GetProperty("PaidUpCapital").GetDecimal());
            Assert.Equal(50000m, ownedAll.GetProperty("PaidUpCapital").GetDecimal());

            AttachUser(audit, branch2User);
            var ownedB2Locked = ParseOkJson(await audit.GetOwnedFunds(branchId: 1, asOnDate: asOnDate));
            Assert.Equal(2, ownedB2Locked.GetProperty("BranchID").GetInt32());
            Assert.Equal(20000m, ownedB2Locked.GetProperty("PaidUpCapital").GetDecimal());

            // 3. Regulatory MIS AutoCompute
            var mis = new RegulatoryMisController(db);
            AttachUser(mis, hoUser);
            var misB1 = ParseOkJson(await mis.AutoCompute(asOn, branchId: 1));
            var misB2 = ParseOkJson(await mis.AutoCompute(asOn, branchId: 2));
            var misAll = ParseOkJson(await mis.AutoCompute(asOn, branchId: 0));
            Assert.Equal(30000m, misB1.GetProperty("capitalDeposits").GetProperty("paidUpCapital").GetDecimal());
            Assert.Equal(20000m, misB2.GetProperty("capitalDeposits").GetProperty("paidUpCapital").GetDecimal());
            Assert.Equal(50000m, misAll.GetProperty("capitalDeposits").GetProperty("paidUpCapital").GetDecimal());

            // 4. Swanidhi GetReport
            var swanidhi = new SwanidhiController(db);
            AttachUser(swanidhi, hoUser);
            var swB1 = ParseOkJson(await swanidhi.GetReport(asOnDate, branchId: 1, customMultiplier: null));
            var swB2 = ParseOkJson(await swanidhi.GetReport(asOnDate, branchId: 2, customMultiplier: null));
            var swAll = ParseOkJson(await swanidhi.GetReport(asOnDate, branchId: 0, customMultiplier: null));
            decimal swOwnedB1 = swB1.GetProperty("NetSwanidhi").GetProperty("AmountInRupees").GetDecimal();
            decimal swOwnedB2 = swB2.GetProperty("NetSwanidhi").GetProperty("AmountInRupees").GetDecimal();
            decimal swOwnedAll = swAll.GetProperty("NetSwanidhi").GetProperty("AmountInRupees").GetDecimal();
            Assert.Equal(40000m, swOwnedB1); // 30,000 Share + 10,000 Reserve
            Assert.Equal(20000m, swOwnedB2); // 20,000 Share
            Assert.Equal(60000m, swOwnedAll);
        }
    }
}
