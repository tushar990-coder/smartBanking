using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Bhisi.Api.Controllers;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class DemandSettingsControllerTests
    {
        private static readonly JsonSerializerOptions CamelOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

        private static AppDbContext GetInMemoryDbContext(string dbName)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: dbName)
                .ConfigureWarnings(x => x.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ControllerContext BuildRoleContext(string role, int userId = 99)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, $"Test_{role}"),
                new Claim(ClaimTypes.Role, role),
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim("BranchID", "1"),
                new Claim("DefaultBranchID", "1")
            };

            return new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"))
                }
            };
        }

        private static JsonDocument ParseResultJson(ActionResult<object> actionResult)
        {
            var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
            string json = JsonSerializer.Serialize(okResult.Value, CamelOpts);
            return JsonDocument.Parse(json);
        }

        private static void SeedSettingsMasters(AppDbContext db)
        {
            var liabilityGroup = new AccountGroup { GroupID = 10, GroupName = "ठेवी व भांडवल", NatureOfGroup = "Liabilities" };
            var incomeGroup = new AccountGroup { GroupID = 20, GroupName = "उत्पन्न", NatureOfGroup = "Income" };
            var assetGroup = new AccountGroup { GroupID = 30, GroupName = "मालमत्ता व येणे", NatureOfGroup = "Assets" };
            var expenseGroup = new AccountGroup { GroupID = 40, GroupName = "खर्च", NatureOfGroup = "Expenses" };
            db.AccountGroups.AddRange(liabilityGroup, incomeGroup, assetGroup, expenseGroup);

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 101, GroupID = 30, LedgerCode = "BNK-01", LedgerName = "DCCB Bank", AccountType = "Bank Account", IsActive = true },
                new Ledger { LedgerID = 102, GroupID = 30, LedgerCode = "CSH-01", LedgerName = "Cash Counter", AccountType = "Cash", IsActive = true },
                new Ledger { LedgerID = 201, GroupID = 30, LedgerCode = "LN-01", LedgerName = "मोठे कर्ज मुद्दल", AccountType = "Loan", IsActive = true },
                new Ledger { LedgerID = 301, GroupID = 20, LedgerCode = "INT-01", LedgerName = "कर्ज व्याज उत्पन्न", AccountType = "Income", IsActive = true },
                new Ledger { LedgerID = 302, GroupID = 30, LedgerCode = "REC-INT-01", LedgerName = "येणे कर्ज व्याज", AccountType = "Assets", IsActive = true },
                new Ledger { LedgerID = 303, GroupID = 20, LedgerCode = "PEN-INT-01", LedgerName = "दंडव्याज उत्पन्न", AccountType = "Income", IsActive = true },
                new Ledger { LedgerID = 401, GroupID = 10, LedgerCode = "SNJ-01", LedgerName = "संजीवनी ठेव", AccountType = "Savings", OpeningBalanceType = "Cr", IsActive = true },
                new Ledger { LedgerID = 501, GroupID = 10, LedgerCode = "RD-01", LedgerName = "नियमित RD देयता", AccountType = "Deposits", OpeningBalanceType = "Cr", IsActive = true },
                new Ledger { LedgerID = 502, GroupID = 10, LedgerCode = "SHR-01", LedgerName = "भाग भांडवल", AccountType = "Share Capital", OpeningBalanceType = "Cr", IsActive = true },
                new Ledger { LedgerID = 601, GroupID = 40, LedgerCode = "EXP-01", LedgerName = "ठेव व्याज खर्च", AccountType = "Expenses", IsActive = true }
            );

            db.LoanRates.Add(new LoanRate
            {
                LoanRateID = 1,
                LoanCode = "LN-BIG",
                LoanType = "में. मोठे कर्ज",
                ShortName = "मोठे कर्ज",
                InterestRate = 12m,
                LoanLedgerID = 201,
                InterestLedgerID = 301,
                ReceivableInterestLedgerID = 302,
                OverdueInterestLedgerID = 303,
                IsActive = true
            });

            db.SavingInterestSettings.Add(new SavingInterestSetting
            {
                SettingID = 2,
                SchemeCode = "102",
                SchemeName = "संजीवनी ठेव",
                InterestRate = 7m,
                PostingFrequency = "Yearly",
                SavingLiabilityLedgerID = 401,
                LedgerID = 401,
                InterestExpenseLedgerID = 601,
                EffectiveDate = new DateTime(2026, 4, 1)
            });

            db.RdSchemes.Add(new RdScheme
            {
                RdSchemeID = 1,
                SchemeCode = "RD01",
                SchemeName = "नियमित RD",
                DurationMonths = 12,
                MinimumInstallment = 1000m,
                MaximumInstallment = 50000m,
                InterestRate = 8m,
                RdLiabilityLedgerID = 501,
                IsActive = true
            });

            db.ShareSchemes.Add(new ShareScheme
            {
                ShareSchemeId = 1,
                SchemeCode = "SHR1",
                SchemeName = "सभासद शेअर्स",
                ShareFaceValue = 100m,
                ShareCapitalLedgerID = 502,
                IsActive = true
            });
        }

        [Fact]
        public async Task GetDemandSettings_ReturnsActiveAndInactiveSettings_AndAuthorizeAttributeMatchesHoAndAuditor()
        {
            var getAttr = typeof(DemandSettingsController)
                .GetMethod(nameof(DemandSettingsController.GetDemandSettings))!
                .GetCustomAttribute<AuthorizeAttribute>();
            Assert.NotNull(getAttr);
            var allowedGetRoles = getAttr!.Roles!.Split(',').Select(r => r.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);
            Assert.Contains("Admin", allowedGetRoles);
            Assert.Contains("HO_Manager", allowedGetRoles);
            Assert.Contains("Auditor", allowedGetRoles);
            Assert.DoesNotContain("BranchManager", allowedGetRoles);
            Assert.DoesNotContain("Cashier", allowedGetRoles);
            Assert.DoesNotContain("Operator", allowedGetRoles);
            Assert.DoesNotContain("CUSTOMER", allowedGetRoles);

            using var db = GetInMemoryDbContext(nameof(GetDemandSettings_ReturnsActiveAndInactiveSettings_AndAuthorizeAttributeMatchesHoAndAuditor));
            SeedSettingsMasters(db);

            db.DemandColumnSettings.AddRange(
                new DemandColumnSetting
                {
                    DemandColumnSettingId = 1,
                    SequenceOrder = 1,
                    ColumnHeaderMr = "मोठे कर्ज",
                    ItemType = "LOAN",
                    LoanRateID = 1,
                    PrincipalOrDepositLedgerID = 201,
                    InterestLedgerID = 301,
                    IsActive = true
                },
                new DemandColumnSetting
                {
                    DemandColumnSettingId = 2,
                    SequenceOrder = 9999,
                    ColumnHeaderMr = "जुनी RD",
                    ItemType = "RD",
                    RdSchemeID = 1,
                    PrincipalOrDepositLedgerID = 501,
                    IsActive = false
                }
            );
            await db.SaveChangesAsync();

            var ctrl = new DemandSettingsController(db) { ControllerContext = BuildRoleContext("Auditor") };
            using var doc = ParseResultJson(await ctrl.GetDemandSettings());

            Assert.True(doc.RootElement.GetProperty("isConfigured").GetBoolean());
            Assert.Equal(1, doc.RootElement.GetProperty("settings").GetArrayLength());
            Assert.Equal(1, doc.RootElement.GetProperty("inactiveSettings").GetArrayLength());
            Assert.Equal(2, doc.RootElement.GetProperty("inactiveSettings")[0].GetProperty("demandColumnSettingId").GetInt32());
        }

        [Fact]
        public void SaveDemandSettings_AuthorizeAttribute_RestrictsMutationToHeadOfficeRoles()
        {
            var putAttr = typeof(DemandSettingsController)
                .GetMethod(nameof(DemandSettingsController.SaveDemandSettings))!
                .GetCustomAttribute<AuthorizeAttribute>();
            Assert.NotNull(putAttr);
            var putRoles = putAttr!.Roles!.Split(',').Select(r => r.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);

            Assert.Contains("Admin", putRoles);
            Assert.Contains("SuperAdmin", putRoles);
            Assert.Contains("HeadOffice", putRoles);
            Assert.Contains("HO_Manager", putRoles);
            Assert.DoesNotContain("BranchManager", putRoles);
            Assert.DoesNotContain("Branch_Manager", putRoles);
            Assert.DoesNotContain("Manager", putRoles);
            Assert.DoesNotContain("Auditor", putRoles);
            Assert.DoesNotContain("Cashier", putRoles);

            var saveGridAttr = typeof(DemandNoticesController)
                .GetMethod(nameof(DemandNoticesController.SaveDemandGrid))!
                .GetCustomAttribute<AuthorizeAttribute>();
            var noticeRoles = saveGridAttr!.Roles!.Split(',').Select(r => r.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);
            Assert.Contains("Branch_Manager", noticeRoles);
            Assert.Contains("BranchManager", noticeRoles);
        }

        [Theory]
        [InlineData("THRIFT_SAVING", 101, null)] // Bank Account blocked
        [InlineData("THRIFT_SAVING", 102, null)] // Cash blocked
        [InlineData("THRIFT_SAVING", 601, null)] // Expenses Nature blocked
        [InlineData("LOAN", 401, 301)]           // Loan Principal cannot be Liabilities
        [InlineData("LOAN", 201, 201)]           // Loan Interest cannot be Assets
        [InlineData("LEDGER_OTHER", 601, null)]  // Direct Ledger cannot credit Expenses
        public async Task SaveDemandSettings_RejectsWrongLedgerNature_AndCashOrBankLedgers(
            string itemType,
            int prinLedgerId,
            int? intLedgerId)
        {
            using var db = GetInMemoryDbContext($"{nameof(SaveDemandSettings_RejectsWrongLedgerNature_AndCashOrBankLedgers)}_{itemType}_{prinLedgerId}_{intLedgerId}");
            SeedSettingsMasters(db);
            await db.SaveChangesAsync();

            var ctrl = new DemandSettingsController(db) { ControllerContext = BuildRoleContext("Admin") };
            var dto = new DemandColumnSettingDto
            {
                SequenceOrder = 1,
                ColumnHeaderMr = "Test Col",
                ItemType = itemType,
                LoanRateID = itemType == "LOAN" ? 1 : null,
                SavingSchemeID = itemType == "THRIFT_SAVING" ? 2 : null,
                PrincipalOrDepositLedgerID = prinLedgerId,
                InterestLedgerID = intLedgerId,
                IsActive = true
            };

            var res = await ctrl.SaveDemandSettings(new SaveDemandSettingsDto { Items = new List<DemandColumnSettingDto> { dto } });
            Assert.IsType<BadRequestObjectResult>(res.Result);
        }

        [Fact]
        public async Task SaveDemandSettings_RejectsDuplicateSavingAndShareSchemes_AndInvalidContributionTargets()
        {
            using var db = GetInMemoryDbContext(nameof(SaveDemandSettings_RejectsDuplicateSavingAndShareSchemes_AndInvalidContributionTargets));
            SeedSettingsMasters(db);
            await db.SaveChangesAsync();

            var ctrl = new DemandSettingsController(db) { ControllerContext = BuildRoleContext("Admin") };

            // Duplicate THRIFT_SAVING scheme
            var dupSaving = await ctrl.SaveDemandSettings(new SaveDemandSettingsDto
            {
                Items = new List<DemandColumnSettingDto>
                {
                    new DemandColumnSettingDto { SequenceOrder = 1, ItemType = "THRIFT_SAVING", ColumnHeaderMr = "संजीवनी १", SavingSchemeID = 2, PrincipalOrDepositLedgerID = 401, IsContributionTarget = true },
                    new DemandColumnSettingDto { SequenceOrder = 2, ItemType = "THRIFT_SAVING", ColumnHeaderMr = "संजीवनी २", SavingSchemeID = 2, PrincipalOrDepositLedgerID = 401 }
                }
            });
            Assert.IsType<BadRequestObjectResult>(dupSaving.Result);

            // Duplicate SHARE scheme
            var dupShare = await ctrl.SaveDemandSettings(new SaveDemandSettingsDto
            {
                Items = new List<DemandColumnSettingDto>
                {
                    new DemandColumnSettingDto { SequenceOrder = 1, ItemType = "SHARE", ColumnHeaderMr = "शेअर्स १", ShareSchemeId = 1, PrincipalOrDepositLedgerID = 502 },
                    new DemandColumnSettingDto { SequenceOrder = 2, ItemType = "SHARE", ColumnHeaderMr = "शेअर्स २", ShareSchemeId = 1, PrincipalOrDepositLedgerID = 502 }
                }
            });
            Assert.IsType<BadRequestObjectResult>(dupShare.Result);

            // Invalid ContributionTarget on LOAN
            var invalidContrib = await ctrl.SaveDemandSettings(new SaveDemandSettingsDto
            {
                Items = new List<DemandColumnSettingDto>
                {
                    new DemandColumnSettingDto { SequenceOrder = 1, ItemType = "LOAN", ColumnHeaderMr = "कर्ज", LoanRateID = 1, PrincipalOrDepositLedgerID = 201, InterestLedgerID = 301, IsContributionTarget = true }
                }
            });
            Assert.IsType<BadRequestObjectResult>(invalidContrib.Result);
        }

        [Fact]
        public async Task SaveDemandSettings_RequiresExplicitLedgers_WithoutSilentFallback_AndValidatesOverdueLedger()
        {
            using var db = GetInMemoryDbContext(nameof(SaveDemandSettings_RequiresExplicitLedgers_WithoutSilentFallback_AndValidatesOverdueLedger));
            SeedSettingsMasters(db);
            await db.SaveChangesAsync();

            var ctrl = new DemandSettingsController(db) { ControllerContext = BuildRoleContext("Admin") };

            // Blank PrincipalOrDepositLedgerID must NOT silently fall back to lr.LoanLedgerID
            var missingPrinRes = await ctrl.SaveDemandSettings(new SaveDemandSettingsDto
            {
                Items = new List<DemandColumnSettingDto>
                {
                    new DemandColumnSettingDto
                    {
                        SequenceOrder = 1,
                        ItemType = "LOAN",
                        ColumnHeaderMr = "मोठे कर्ज",
                        LoanRateID = 1,
                        PrincipalOrDepositLedgerID = null,
                        InterestLedgerID = 301
                    }
                }
            });
            Assert.IsType<BadRequestObjectResult>(missingPrinRes.Result);

            // Invalid OverdueInterestLedgerID (Assets ledger 201 instead of Income)
            var badOverdueRes = await ctrl.SaveDemandSettings(new SaveDemandSettingsDto
            {
                Items = new List<DemandColumnSettingDto>
                {
                    new DemandColumnSettingDto
                    {
                        SequenceOrder = 1,
                        ItemType = "LOAN",
                        ColumnHeaderMr = "मोठे कर्ज",
                        LoanRateID = 1,
                        PrincipalOrDepositLedgerID = 201,
                        InterestLedgerID = 301,
                        OverdueInterestLedgerID = 201,
                        IncludeOverduePenalInterest = true
                    }
                }
            });
            Assert.IsType<BadRequestObjectResult>(badOverdueRes.Result);

            // Valid OverdueInterestLedgerID = 303 (Income) saves cleanly
            var okRes = await ctrl.SaveDemandSettings(new SaveDemandSettingsDto
            {
                Items = new List<DemandColumnSettingDto>
                {
                    new DemandColumnSettingDto
                    {
                        SequenceOrder = 1,
                        ItemType = "LOAN",
                        ColumnHeaderMr = "मोठे कर्ज",
                        LoanRateID = 1,
                        PrincipalOrDepositLedgerID = 201,
                        InterestLedgerID = 301,
                        ReceivableInterestLedgerID = 302,
                        OverdueInterestLedgerID = 303,
                        IncludeOverduePenalInterest = true
                    }
                }
            });
            using var doc = ParseResultJson(okRes);
            Assert.Equal(303, doc.RootElement.GetProperty("settings")[0].GetProperty("overdueInterestLedgerID").GetInt32());
        }

        [Fact]
        public async Task SaveDemandSettings_SoftDeactivatesReferencedRow_AndReactivatesSameIdOnRestore()
        {
            using var db = GetInMemoryDbContext(nameof(SaveDemandSettings_SoftDeactivatesReferencedRow_AndReactivatesSameIdOnRestore));
            SeedSettingsMasters(db);

            db.DemandColumnSettings.Add(new DemandColumnSetting
            {
                DemandColumnSettingId = 10,
                SequenceOrder = 1,
                ColumnHeaderMr = "नियमित RD",
                ItemType = "RD",
                RdSchemeID = 1,
                PrincipalOrDepositLedgerID = 501,
                DefaultAmount = 1000m,
                IsActive = true
            });
            db.DemandMemberColumnItems.Add(new DemandMemberColumnItem
            {
                DemandMemberColumnItemId = 1,
                DemandMemberDetailId = 1,
                DemandColumnSettingId = 10,
                SequenceOrder = 1,
                ItemType = "RD",
                ColumnHeaderMr = "नियमित RD",
                SchemeId = 1,
                DemandPrincipalOrDeposit = 1000m
            });
            await db.SaveChangesAsync();

            var ctrl = new DemandSettingsController(db) { ControllerContext = BuildRoleContext("HO_Manager") };

            // Remove referenced RD ID 10 and save THRIFT_SAVING only -> ID 10 becomes IsActive=false, Seq=9999
            using var removeDoc = ParseResultJson(await ctrl.SaveDemandSettings(new SaveDemandSettingsDto
            {
                Items = new List<DemandColumnSettingDto>
                {
                    new DemandColumnSettingDto
                    {
                        SequenceOrder = 1,
                        ItemType = "THRIFT_SAVING",
                        ColumnHeaderMr = "संजीवनी ठेव",
                        SavingSchemeID = 2,
                        PrincipalOrDepositLedgerID = 401,
                        IsContributionTarget = true
                    }
                }
            }));

            var archivedRd = await db.DemandColumnSettings.FindAsync(10);
            Assert.NotNull(archivedRd);
            Assert.False(archivedRd!.IsActive);
            Assert.Equal(9999, archivedRd.SequenceOrder);
            Assert.Equal(1, removeDoc.RootElement.GetProperty("inactiveSettings").GetArrayLength());

            // Now re-add RD Scheme 1 with DemandColumnSettingId = 0 -> reactivates existing ID 10 cleanly
            using var restoreDoc = ParseResultJson(await ctrl.SaveDemandSettings(new SaveDemandSettingsDto
            {
                Items = new List<DemandColumnSettingDto>
                {
                    new DemandColumnSettingDto
                    {
                        SequenceOrder = 1,
                        ItemType = "RD",
                        ColumnHeaderMr = "नियमित RD",
                        RdSchemeID = 1,
                        PrincipalOrDepositLedgerID = 501,
                        DefaultAmount = 1200m
                    },
                    new DemandColumnSettingDto
                    {
                        SequenceOrder = 2,
                        ItemType = "THRIFT_SAVING",
                        ColumnHeaderMr = "संजीवनी ठेव",
                        SavingSchemeID = 2,
                        PrincipalOrDepositLedgerID = 401,
                        IsContributionTarget = true
                    }
                }
            }));

            Assert.Equal(2, await db.DemandColumnSettings.CountAsync()); // zero duplicate RD rows created
            Assert.Equal(0, restoreDoc.RootElement.GetProperty("inactiveSettings").GetArrayLength());
            var reactivatedRd = await db.DemandColumnSettings.FindAsync(10);
            Assert.True(reactivatedRd!.IsActive);
            Assert.Equal(1, reactivatedRd.SequenceOrder);
            Assert.Equal(1200m, reactivatedRd.DefaultAmount);
        }

        [Fact]
        public async Task GetDemandSettings_ReturnsDepositLedgersPigmySchemes_AndOmitsNonIncomeOverdueLedgerInSuggestedDefaults()
        {
            using var db = GetInMemoryDbContext(nameof(GetDemandSettings_ReturnsDepositLedgersPigmySchemes_AndOmitsNonIncomeOverdueLedgerInSuggestedDefaults));
            SeedSettingsMasters(db);

            // Simulate RITemployee scenario: LoanRate points OverdueInterestLedgerID to an Assets ledger (247)
            db.Ledgers.AddRange(
                new Ledger { LedgerID = 247, GroupID = 30, LedgerCode = "247", LedgerName = "थकीत व्याजयेणे", AccountType = "Assets", IsActive = true },
                new Ledger { LedgerID = 470, GroupID = 10, LedgerCode = "70", LedgerName = "मेंबर ठेव", AccountType = "Deposits", OpeningBalanceType = "Cr", IsActive = true },
                new Ledger { LedgerID = 471, GroupID = 10, LedgerCode = "68", LedgerName = "ब वर्ग ठेव", AccountType = "Deposits", OpeningBalanceType = "Cr", IsActive = true },
                new Ledger { LedgerID = 472, GroupID = 10, LedgerCode = "PG-L1", LedgerName = "पिग्मी ठेव देयता", AccountType = "Deposits", OpeningBalanceType = "Cr", IsActive = true }
            );
            var lr = await db.LoanRates.FindAsync(1);
            lr!.OverdueInterestLedgerID = 247;

            db.Customers.Add(new Customer { CustomerID = 1, BranchID = 1, CIFNo = "CIF1", FirstName = "Test", LastName = "Cust", Status = "Active" });
            db.CustomerOpeningBalances.AddRange(
                new CustomerOpeningBalance { CustomerOpeningBalanceID = 1, CustomerID = 1, LedgerID = 470, BalanceType = "Cr", Amount = 5000m, SourceModule = "CustomerOpeningBalance" },
                new CustomerOpeningBalance { CustomerOpeningBalanceID = 2, CustomerID = 1, LedgerID = 471, BalanceType = "Cr", Amount = 2000m, SourceModule = "CustomerOpeningBalance" }
            );
            db.PigmySchemes.Add(new PigmyScheme
            {
                PigmySchemeID = 1,
                SchemeCode = "PG01",
                SchemeName = "दैनिक पिग्मी ठेव",
                InterestRate = 6m,
                DurationMonths = 12,
                PigmyLiabilityLedgerID = 472,
                Status = "Active"
            });
            await db.SaveChangesAsync();

            var ctrl = new DemandSettingsController(db) { ControllerContext = BuildRoleContext("Admin") };
            using var doc = ParseResultJson(await ctrl.GetDemandSettings());

            Assert.False(doc.RootElement.GetProperty("isConfigured").GetBoolean());
            var pigmySchemes = doc.RootElement.GetProperty("pigmySchemes");
            Assert.Equal(1, pigmySchemes.GetArrayLength());
            Assert.Equal(1, pigmySchemes[0].GetProperty("pigmySchemeID").GetInt32());

            var depositLedgers = doc.RootElement.GetProperty("depositLedgers").EnumerateArray().ToList();
            Assert.Contains(depositLedgers, l => l.GetProperty("ledgerID").GetInt32() == 470 && l.GetProperty("isDepositLedger").GetBoolean());
            Assert.Contains(depositLedgers, l => l.GetProperty("ledgerID").GetInt32() == 471 && !string.IsNullOrEmpty(l.GetProperty("linkedSchemeSource").GetString()));
            Assert.Contains(depositLedgers, l => l.GetProperty("ledgerID").GetInt32() == 472);

            var suggested = doc.RootElement.GetProperty("suggestedDefaults").EnumerateArray().ToList();
            var loanSuggestion = Assert.Single(suggested, s => s.GetProperty("itemType").GetString() == "LOAN");
            Assert.Equal(JsonValueKind.Null, loanSuggestion.GetProperty("overdueInterestLedgerID").ValueKind);

            var depSuggestions = suggested.Where(s => s.GetProperty("itemType").GetString() == "DEPOSIT_LEDGER").ToList();
            Assert.Contains(depSuggestions, s => s.GetProperty("principalOrDepositLedgerID").GetInt32() == 470);
            Assert.Contains(depSuggestions, s => s.GetProperty("principalOrDepositLedgerID").GetInt32() == 471);
        }

        [Fact]
        public async Task SaveDemandSettings_SupportsDepositLedgerAndPigmy_EnforcesUniqueness_AndReactivatesArchived()
        {
            using var db = GetInMemoryDbContext(nameof(SaveDemandSettings_SupportsDepositLedgerAndPigmy_EnforcesUniqueness_AndReactivatesArchived));
            SeedSettingsMasters(db);
            db.Ledgers.AddRange(
                new Ledger { LedgerID = 470, GroupID = 10, LedgerCode = "70", LedgerName = "मेंबर ठेव", AccountType = "Deposits", OpeningBalanceType = "Cr", IsActive = true },
                new Ledger { LedgerID = 472, GroupID = 10, LedgerCode = "PG-L1", LedgerName = "पिग्मी ठेव देयता", AccountType = "Deposits", OpeningBalanceType = "Cr", IsActive = true }
            );
            db.PigmySchemes.Add(new PigmyScheme
            {
                PigmySchemeID = 1,
                SchemeCode = "PG01",
                SchemeName = "दैनिक पिग्मी",
                InterestRate = 6m,
                DurationMonths = 12,
                PigmyLiabilityLedgerID = 472,
                Status = "Active"
            });
            await db.SaveChangesAsync();

            var ctrl = new DemandSettingsController(db) { ControllerContext = BuildRoleContext("Admin") };

            // 1. Valid save with DEPOSIT_LEDGER + PIGMY
            using var saveDoc = ParseResultJson(await ctrl.SaveDemandSettings(new SaveDemandSettingsDto
            {
                Items = new List<DemandColumnSettingDto>
                {
                    new DemandColumnSettingDto
                    {
                        SequenceOrder = 1,
                        ItemType = "DEPOSIT_LEDGER",
                        ColumnHeaderMr = "मेंबर ठेव",
                        PrincipalOrDepositLedgerID = 470,
                        IsContributionTarget = true,
                        DefaultAmount = 500m
                    },
                    new DemandColumnSettingDto
                    {
                        SequenceOrder = 2,
                        ItemType = "PIGMY",
                        ColumnHeaderMr = "दैनिक पिग्मी",
                        PigmySchemeID = 1,
                        PrincipalOrDepositLedgerID = 472,
                        DefaultAmount = 200m
                    }
                }
            }));

            var savedSettings = saveDoc.RootElement.GetProperty("settings");
            Assert.Equal(2, savedSettings.GetArrayLength());
            Assert.Equal("DEPOSIT_LEDGER", savedSettings[0].GetProperty("itemType").GetString());
            Assert.Equal("PIGMY", savedSettings[1].GetProperty("itemType").GetString());
            Assert.Equal(1, savedSettings[1].GetProperty("pigmySchemeID").GetInt32());

            int pigmySettingId = savedSettings[1].GetProperty("demandColumnSettingId").GetInt32();

            // 2. Reject duplicate DEPOSIT_LEDGER
            var dupDep = await ctrl.SaveDemandSettings(new SaveDemandSettingsDto
            {
                Items = new List<DemandColumnSettingDto>
                {
                    new DemandColumnSettingDto { SequenceOrder = 1, ItemType = "DEPOSIT_LEDGER", ColumnHeaderMr = "मेंबर ठेव 1", PrincipalOrDepositLedgerID = 470 },
                    new DemandColumnSettingDto { SequenceOrder = 2, ItemType = "DEPOSIT_LEDGER", ColumnHeaderMr = "मेंबर ठेव 2", PrincipalOrDepositLedgerID = 470 }
                }
            });
            Assert.IsType<BadRequestObjectResult>(dupDep.Result);

            // 3. Reject duplicate PIGMY scheme
            var dupPigmy = await ctrl.SaveDemandSettings(new SaveDemandSettingsDto
            {
                Items = new List<DemandColumnSettingDto>
                {
                    new DemandColumnSettingDto { SequenceOrder = 1, ItemType = "PIGMY", ColumnHeaderMr = "पिग्मी 1", PigmySchemeID = 1, PrincipalOrDepositLedgerID = 472 },
                    new DemandColumnSettingDto { SequenceOrder = 2, ItemType = "PIGMY", ColumnHeaderMr = "पिग्मी 2", PigmySchemeID = 1, PrincipalOrDepositLedgerID = 472 }
                }
            });
            Assert.IsType<BadRequestObjectResult>(dupPigmy.Result);

            // 4. Archive referenced PIGMY row, then restore cleanly without duplicate row
            db.DemandMemberColumnItems.Add(new DemandMemberColumnItem
            {
                DemandMemberDetailId = 1,
                DemandColumnSettingId = pigmySettingId,
                SequenceOrder = 2,
                ItemType = "PIGMY",
                ColumnHeaderMr = "दैनिक पिग्मी",
                SchemeId = 1,
                DemandPrincipalOrDeposit = 200m
            });
            await db.SaveChangesAsync();

            ParseResultJson(await ctrl.SaveDemandSettings(new SaveDemandSettingsDto
            {
                Items = new List<DemandColumnSettingDto>
                {
                    new DemandColumnSettingDto { SequenceOrder = 1, ItemType = "DEPOSIT_LEDGER", ColumnHeaderMr = "मेंबर ठेव", PrincipalOrDepositLedgerID = 470, IsContributionTarget = true }
                }
            }));
            Assert.False((await db.DemandColumnSettings.FindAsync(pigmySettingId))!.IsActive);

            ParseResultJson(await ctrl.SaveDemandSettings(new SaveDemandSettingsDto
            {
                Items = new List<DemandColumnSettingDto>
                {
                    new DemandColumnSettingDto { SequenceOrder = 1, ItemType = "DEPOSIT_LEDGER", ColumnHeaderMr = "मेंबर ठेव", PrincipalOrDepositLedgerID = 470, IsContributionTarget = true },
                    new DemandColumnSettingDto { SequenceOrder = 2, ItemType = "PIGMY", ColumnHeaderMr = "दैनिक पिग्मी", PigmySchemeID = 1, PrincipalOrDepositLedgerID = 472, DefaultAmount = 300m }
                }
            }));

            var restoredPigmy = await db.DemandColumnSettings.FindAsync(pigmySettingId);
            Assert.True(restoredPigmy!.IsActive);
            Assert.Equal(300m, restoredPigmy.DefaultAmount);
            Assert.Equal(2, await db.DemandColumnSettings.CountAsync());
        }
    }
}
