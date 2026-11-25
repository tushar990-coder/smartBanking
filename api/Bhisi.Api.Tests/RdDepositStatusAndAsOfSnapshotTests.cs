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
    public class RdDepositStatusAndAsOfSnapshotTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"BhisiRdAsOf_{Guid.NewGuid()}")
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

        private static async Task SeedBaseDataAsync(AppDbContext db)
        {
            db.Branches.Add(new Branch
            {
                BranchID = 1,
                BranchCode = "BR01",
                BranchName = "मुख्य शाखा (HO)",
                BranchType = "HeadOffice",
                IsActive = true
            });

            db.SansthaDetails.Add(new SansthaDetail
            {
                SansthaID = 1,
                SansthaName = "टेस्ट नागरी पतसंस्था",
                RegistrationNo = "REG-RD-01",
                ContactNo = "9999999999"
            });

            db.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "2026-2027",
                StartDate = new DateTime(2026, 4, 1),
                EndDate = new DateTime(2027, 3, 31),
                IsActive = true
            });

            db.AccountGroups.AddRange(
                new AccountGroup { GroupID = 1, GroupName = "रोख व बँक", NatureOfGroup = "Assets", IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "ठेवी", NatureOfGroup = "Liabilities", IsActive = true },
                new AccountGroup { GroupID = 3, GroupName = "देणे व्याज", NatureOfGroup = "Liabilities", IsActive = true },
                new AccountGroup { GroupID = 4, GroupName = "ठेवीवरील व्याज", NatureOfGroup = "Expenses", IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 1, GroupID = 1, LedgerCode = "CASH", LedgerName = "रोख शिल्लक", AccountType = "Cash", IsActive = true },
                new Ledger { LedgerID = 49, GroupID = 2, LedgerCode = "RD49", LedgerName = "रिकरींग ठेव", AccountType = "RD", IsActive = true },
                new Ledger { LedgerID = 64, GroupID = 2, LedgerCode = "RD64", LedgerName = "लक्षाधीश ठेव", AccountType = "RD", IsActive = true },
                new Ledger { LedgerID = 70, GroupID = 3, LedgerCode = "RDINTPAY", LedgerName = "देणे आवर्ती व्याज", AccountType = "Liability", IsActive = true },
                new Ledger { LedgerID = 71, GroupID = 4, LedgerCode = "RDINTEXP", LedgerName = "आरडी ठेवीवरील व्याज", AccountType = "Expense", IsActive = true }
            );

            db.RdSchemes.AddRange(
                new RdScheme
                {
                    RdSchemeID = 3,
                    SchemeCode = "503",
                    SchemeName = "रिकारींग ठेव - 12 महीने",
                    DurationMonths = 12,
                    InterestRate = 8m,
                    RdLiabilityLedgerID = 49,
                    InterestPayableLedgerID = 70,
                    InterestExpenseLedgerID = 71,
                    IsActive = true
                },
                new RdScheme
                {
                    RdSchemeID = 4,
                    SchemeCode = "504",
                    SchemeName = "लक्षाधीश रिकारींग ठेव",
                    DurationMonths = 12,
                    InterestRate = 9m,
                    RdLiabilityLedgerID = 64,
                    InterestPayableLedgerID = 70,
                    InterestExpenseLedgerID = 71,
                    IsActive = true
                }
            );

            db.Customers.AddRange(
                new Customer { CustomerID = 1, BranchID = 1, FirstName = "राम", LastName = "पाटील", CIFNo = "CIF001" },
                new Customer { CustomerID = 2, BranchID = 1, FirstName = "सीता", LastName = "कुलकर्णी", CIFNo = "CIF002" },
                new Customer { CustomerID = 3, BranchID = 1, FirstName = "गणेश", LastName = "जोशी", CIFNo = "CIF003" },
                new Customer { CustomerID = 4, BranchID = 1, FirstName = "विजय", LastName = "मोरे", CIFNo = "CIF004" }
            );

            db.Members.AddRange(
                new Member { MemberID = 1, BranchID = 1, CustomerID = 1, MemberCode = "M001", Status = "Active" },
                new Member { MemberID = 2, BranchID = 1, CustomerID = 2, MemberCode = "M002", Status = "Active" },
                new Member { MemberID = 3, BranchID = 1, CustomerID = 3, MemberCode = "M003", Status = "Active" },
                new Member { MemberID = 4, BranchID = 1, CustomerID = 4, MemberCode = "M004", Status = "Active" }
            );

            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task RdOutstandingReport_AsOf31Mar2026_ExcludesPostCutoffInstallments_AndIncludesLaterClosedAccounts()
        {
            await using var db = CreateContext();
            await SeedBaseDataAsync(db);

            var mar31 = new DateTime(2026, 3, 31);
            var apr09 = new DateTime(2026, 4, 9);
            var apr10 = new DateTime(2026, 4, 10);
            var apr15 = new DateTime(2026, 4, 15);
            var may18 = new DateTime(2026, 5, 18);

            // 1. Active legacy RD: 10,000 up to 31-03 + 6,000 in Apr/May = 16,000 live
            // 2. Matured legacy RD: 20,000 up to 31-03 + 4,000 in Apr = 24,000 live
            // 3. Closed AFTER 31-03 (Closed 10-04-2026 Pending): 2,000 on 27-03 + 4,000 in Apr/May = 6,000 live
            // 4. Opened AFTER 31-03 (15-04-2026): 3,000 live (must be excluded on 31-03-2026)
            db.RdAccounts.AddRange(
                new RdAccount
                {
                    RdAccountID = 74,
                    BranchID = 1,
                    CustomerID = 1,
                    RdSchemeID = 3,
                    AccountNo = "001-503-0000074-5",
                    OpeningDate = new DateTime(2025, 10, 22),
                    MaturityDate = new DateTime(2026, 10, 22),
                    InstallmentAmount = 2000m,
                    DurationMonths = 12,
                    InterestRate = 8m,
                    TotalPaidInstallments = 8,
                    TotalDepositedAmount = 16000m,
                    IsLegacyAccount = true,
                    Status = "Active"
                },
                new RdAccount
                {
                    RdAccountID = 38,
                    BranchID = 1,
                    CustomerID = 2,
                    RdSchemeID = 3,
                    AccountNo = "001-503-0000038-0",
                    OpeningDate = new DateTime(2025, 6, 2),
                    MaturityDate = new DateTime(2026, 6, 2),
                    InstallmentAmount = 2000m,
                    DurationMonths = 12,
                    InterestRate = 8m,
                    TotalPaidInstallments = 12,
                    TotalDepositedAmount = 24000m,
                    IsLegacyAccount = true,
                    Status = "Matured"
                },
                new RdAccount
                {
                    RdAccountID = 121,
                    BranchID = 1,
                    CustomerID = 3,
                    RdSchemeID = 3,
                    AccountNo = "001-503-0000121-4",
                    OpeningDate = new DateTime(2026, 3, 27),
                    MaturityDate = new DateTime(2027, 3, 27),
                    InstallmentAmount = 2000m,
                    DurationMonths = 12,
                    InterestRate = 8m,
                    TotalPaidInstallments = 3,
                    TotalDepositedAmount = 6000m,
                    IsLegacyAccount = true,
                    Status = "Closed",
                    ClosureDate = apr10
                },
                new RdAccount
                {
                    RdAccountID = 200,
                    BranchID = 1,
                    CustomerID = 4,
                    RdSchemeID = 4,
                    AccountNo = "001-504-0000200-1",
                    OpeningDate = apr15,
                    MaturityDate = apr15.AddMonths(12),
                    InstallmentAmount = 3000m,
                    DurationMonths = 12,
                    InterestRate = 9m,
                    TotalPaidInstallments = 1,
                    TotalDepositedAmount = 3000m,
                    IsLegacyAccount = false,
                    Status = "Active"
                }
            );

            db.Vouchers.AddRange(
                new Voucher { VoucherID = 1, BranchID = 1, VoucherNo = "JV-RD-OP-001-503-0000074-5", VoucherDate = new DateTime(2025, 10, 22), VoucherType = "Journal", TotalAmount = 10000m, Status = "Approved" },
                new Voucher { VoucherID = 2, BranchID = 1, VoucherNo = "JV-RD-COLL-74-6", VoucherDate = apr09, VoucherType = "Receipt", TotalAmount = 2000m, Status = "Approved" },
                new Voucher { VoucherID = 3, BranchID = 1, VoucherNo = "JV-RD-COLL-74-7", VoucherDate = may18, VoucherType = "Receipt", TotalAmount = 4000m, Status = "Approved" },
                new Voucher { VoucherID = 4, BranchID = 1, VoucherNo = "JV-RD-OP-001-503-0000038-0", VoucherDate = new DateTime(2025, 6, 2), VoucherType = "Journal", TotalAmount = 20000m, Status = "Approved" },
                new Voucher { VoucherID = 5, BranchID = 1, VoucherNo = "JV-RD-COLL-38-11", VoucherDate = apr09, VoucherType = "Receipt", TotalAmount = 4000m, Status = "Approved" },
                new Voucher { VoucherID = 6, BranchID = 1, VoucherNo = "JV-RD-OP-001-503-0000121-4", VoucherDate = new DateTime(2026, 3, 27), VoucherType = "Journal", TotalAmount = 2000m, Status = "Approved" },
                new Voucher { VoucherID = 7, BranchID = 1, VoucherNo = "JV-RD-COLL-121-2", VoucherDate = apr09, VoucherType = "Receipt", TotalAmount = 4000m, Status = "Approved" },
                new Voucher { VoucherID = 8, BranchID = 1, VoucherNo = "JV-RD-PRECLOSE-121", VoucherDate = apr10, VoucherType = "Payment", TotalAmount = 6000m, Status = "Pending" },
                new Voucher { VoucherID = 9, BranchID = 1, VoucherNo = "REC-RD-OPEN-200", VoucherDate = apr15, VoucherType = "Receipt", TotalAmount = 3000m, Status = "Approved" },
                new Voucher { VoucherID = 10, BranchID = 1, VoucherNo = "JV-RD-PROV-20261027", VoucherDate = new DateTime(2026, 10, 27), VoucherType = "Journal", TotalAmount = 5000m, Status = "Pending" }
            );

            db.RdTransactions.AddRange(
                new RdTransaction { RdTransactionID = 1, BranchID = 1, RdAccountID = 74, VoucherID = 1, TransactionDate = new DateTime(2025, 10, 22), TransactionType = "Installment", InstallmentNo = 5, DebitCredit = "Cr", PrincipalAmount = 10000m },
                new RdTransaction { RdTransactionID = 2, BranchID = 1, RdAccountID = 74, VoucherID = 2, TransactionDate = apr09, TransactionType = "Installment", InstallmentNo = 6, DebitCredit = "Cr", PrincipalAmount = 2000m },
                new RdTransaction { RdTransactionID = 3, BranchID = 1, RdAccountID = 74, VoucherID = 3, TransactionDate = may18, TransactionType = "Installment", InstallmentNo = 8, DebitCredit = "Cr", PrincipalAmount = 4000m },
                new RdTransaction { RdTransactionID = 4, BranchID = 1, RdAccountID = 38, VoucherID = 4, TransactionDate = new DateTime(2025, 6, 2), TransactionType = "Installment", InstallmentNo = 10, DebitCredit = "Cr", PrincipalAmount = 20000m },
                new RdTransaction { RdTransactionID = 5, BranchID = 1, RdAccountID = 38, VoucherID = 5, TransactionDate = apr09, TransactionType = "Installment", InstallmentNo = 12, DebitCredit = "Cr", PrincipalAmount = 4000m },
                new RdTransaction { RdTransactionID = 6, BranchID = 1, RdAccountID = 121, VoucherID = 6, TransactionDate = new DateTime(2026, 3, 27), TransactionType = "Installment", InstallmentNo = 1, DebitCredit = "Cr", PrincipalAmount = 2000m },
                new RdTransaction { RdTransactionID = 7, BranchID = 1, RdAccountID = 121, VoucherID = 7, TransactionDate = apr09, TransactionType = "Installment", InstallmentNo = 3, DebitCredit = "Cr", PrincipalAmount = 4000m },
                new RdTransaction { RdTransactionID = 8, BranchID = 1, RdAccountID = 121, VoucherID = 8, TransactionDate = apr10, TransactionType = "Premature_Close", DebitCredit = "Dr", PrincipalAmount = 6000m },
                new RdTransaction { RdTransactionID = 9, BranchID = 1, RdAccountID = 200, VoucherID = 9, TransactionDate = apr15, TransactionType = "Installment", InstallmentNo = 1, DebitCredit = "Cr", PrincipalAmount = 3000m },
                // Pending interest accrual must NEVER alter principal balance
                new RdTransaction { RdTransactionID = 10, BranchID = 1, RdAccountID = 74, VoucherID = 10, TransactionDate = new DateTime(2026, 10, 27), TransactionType = "Accrual", DebitCredit = "Cr", PrincipalAmount = 0m, InterestAmount = 500m }
            );

            await db.SaveChangesAsync();

            using var cache = new MemoryCache(new MemoryCacheOptions());
            var reportsCtrl = new ReportsController(db, cache);
            AttachUser(reportsCtrl, BuildPrincipal(1, "admin", "SuperAdmin", 1));

            // 1. Query as of 31-03-2026
            var resMar31 = ParseOkJson(await reportsCtrl.GetRdReport("outstanding", branchId: 1, schemeId: null, fromDate: null, toDate: mar31, asOfDate: mar31));
            Assert.Equal(3, resMar31.GetProperty("TotalAccounts").GetInt32());
            Assert.Equal(32000m, resMar31.GetProperty("TotalDepositedAmount").GetDecimal()); // 10,000 + 20,000 + 2,000

            var rowsMar31 = resMar31.GetProperty("Rows").EnumerateArray().ToDictionary(x => x.GetProperty("RdAccountID").GetInt32());
            Assert.Equal(10000m, rowsMar31[74].GetProperty("TotalDepositedAmount").GetDecimal());
            Assert.Equal(5, rowsMar31[74].GetProperty("TotalPaidInstallments").GetInt32());
            Assert.Equal(20000m, rowsMar31[38].GetProperty("TotalDepositedAmount").GetDecimal());
            Assert.Equal(10, rowsMar31[38].GetProperty("TotalPaidInstallments").GetInt32());
            Assert.Equal("Active", rowsMar31[38].GetProperty("Status").GetString());
            Assert.Equal(2000m, rowsMar31[121].GetProperty("TotalDepositedAmount").GetDecimal());
            Assert.True(rowsMar31[121].GetProperty("IsClosedLater").GetBoolean());
            Assert.False(rowsMar31.ContainsKey(200));

            // 2. Query as of 30-06-2026 (live) -> 74 (16k) + 38 (24k) + 200 (3k) = 43,000; 121 is Closed
            var jun30 = new DateTime(2026, 6, 30);
            var resJun30 = ParseOkJson(await reportsCtrl.GetRdReport("outstanding", branchId: 1, schemeId: null, fromDate: null, toDate: jun30, asOfDate: jun30));
            Assert.Equal(3, resJun30.GetProperty("TotalAccounts").GetInt32());
            Assert.Equal(43000m, resJun30.GetProperty("TotalDepositedAmount").GetDecimal());

            // 3. Closed report between 01-04-2026 and 30-04-2026 includes #121
            var closedRes = ParseOkJson(await reportsCtrl.GetRdReport("closed", branchId: 1, schemeId: null, fromDate: new DateTime(2026, 4, 1), toDate: new DateTime(2026, 4, 30), asOfDate: null));
            Assert.Equal(1, closedRes.GetProperty("TotalAccounts").GetInt32());
            Assert.Equal(121, closedRes.GetProperty("Rows")[0].GetProperty("RdAccountID").GetInt32());

            // 4. Regulatory CRR & Audit Compliance honor historical asOfDate for RD
            var crrCtrl = new CrrReportController(db);
            AttachUser(crrCtrl, BuildPrincipal(1, "admin", "SuperAdmin", 1));
            var crrMar31 = ParseOkJson(await crrCtrl.GetSummary("2026-03-31", branchId: 1));
            Assert.Equal(32000m, crrMar31.GetProperty("depositBreakup").GetProperty("recurringDeposits").GetDecimal());
        }

        [Fact]
        public async Task InflatedLegacyMigrationTx_DoesNotOverstateAsOfBalance_SimulatingSahyadriKarmachari()
        {
            await using var db = CreateContext();
            await SeedBaseDataAsync(db);

            // Real balance: 10,000 up to 31-03 + 4,000 in April = 14,000 TotalDepositedAmount
            // Corrupted legacy JV-RD-OP transaction carries ₹17.60 Cr from an old quantity*amount entry bug
            db.RdAccounts.Add(new RdAccount
            {
                RdAccountID = 6,
                BranchID = 1,
                CustomerID = 1,
                RdSchemeID = 3,
                AccountNo = "001-503-0000006-7",
                OpeningDate = new DateTime(2025, 10, 1),
                MaturityDate = new DateTime(2026, 10, 1),
                InstallmentAmount = 2000m,
                DurationMonths = 12,
                TotalPaidInstallments = 7,
                TotalDepositedAmount = 14000m,
                IsLegacyAccount = true,
                Status = "Active"
            });

            db.RdTransactions.AddRange(
                new RdTransaction
                {
                    RdTransactionID = 1,
                    BranchID = 1,
                    RdAccountID = 6,
                    TransactionDate = new DateTime(2025, 10, 1),
                    TransactionType = "Installment",
                    DebitCredit = "Cr",
                    PrincipalAmount = 176000000m,
                    Narration = "मायग्रेटेड आरडी खाते सुरुवाती शिल्लक: 001-503-0000006-7"
                },
                new RdTransaction
                {
                    RdTransactionID = 2,
                    BranchID = 1,
                    RdAccountID = 6,
                    TransactionDate = new DateTime(2026, 4, 12),
                    TransactionType = "Installment",
                    DebitCredit = "Cr",
                    PrincipalAmount = 4000m,
                    Narration = "आरडी हप्ता भरणा"
                }
            );

            await db.SaveChangesAsync();

            decimal totalMar31 = await RdDepositQueryHelper.GetLiveRdTotalAsOfAsync(db, new DateTime(2026, 3, 31), branchId: 1);
            Assert.Equal(10000m, totalMar31);
        }

        [Fact]
        public async Task GetRdAccounts_IsReadOnly_AndSyncOpeningBalances_UsesPreFyBalancesIncludingMaturedAndLaterClosed()
        {
            await using var db = CreateContext();
            await SeedBaseDataAsync(db);

            db.RdAccounts.AddRange(
                new RdAccount
                {
                    RdAccountID = 1,
                    BranchID = 1,
                    CustomerID = 1,
                    RdSchemeID = 3,
                    AccountNo = "001-503-0000001-0",
                    OpeningDate = new DateTime(2025, 9, 1),
                    MaturityDate = new DateTime(2026, 9, 1),
                    InstallmentAmount = 1000m,
                    DurationMonths = 12,
                    TotalPaidInstallments = 7,
                    TotalDepositedAmount = 7000m, // 5,000 pre-FY + 2,000 post-FY
                    IsLegacyAccount = true,
                    Status = "Active"
                },
                new RdAccount
                {
                    RdAccountID = 2,
                    BranchID = 1,
                    CustomerID = 2,
                    RdSchemeID = 3,
                    AccountNo = "001-503-0000002-8",
                    OpeningDate = new DateTime(2025, 4, 1),
                    MaturityDate = new DateTime(2026, 4, 1),
                    InstallmentAmount = 1000m,
                    DurationMonths = 12,
                    TotalPaidInstallments = 12,
                    TotalDepositedAmount = 12000m, // Matured account — must stay in FY opening balance!
                    IsLegacyAccount = true,
                    Status = "Matured"
                },
                new RdAccount
                {
                    RdAccountID = 3,
                    BranchID = 1,
                    CustomerID = 3,
                    RdSchemeID = 3,
                    AccountNo = "001-503-0000003-6",
                    OpeningDate = new DateTime(2026, 3, 27),
                    MaturityDate = new DateTime(2027, 3, 27),
                    InstallmentAmount = 2000m,
                    DurationMonths = 12,
                    TotalPaidInstallments = 2,
                    TotalDepositedAmount = 4000m, // 2,000 pre-FY + 2,000 in April; closed in April
                    IsLegacyAccount = true,
                    Status = "Closed",
                    ClosureDate = new DateTime(2026, 4, 15)
                }
            );

            db.RdTransactions.AddRange(
                new RdTransaction { RdTransactionID = 1, BranchID = 1, RdAccountID = 1, TransactionDate = new DateTime(2025, 9, 1), TransactionType = "Installment", DebitCredit = "Cr", PrincipalAmount = 5000m },
                new RdTransaction { RdTransactionID = 2, BranchID = 1, RdAccountID = 1, TransactionDate = new DateTime(2026, 4, 8), TransactionType = "Installment", DebitCredit = "Cr", PrincipalAmount = 2000m },
                new RdTransaction { RdTransactionID = 3, BranchID = 1, RdAccountID = 2, TransactionDate = new DateTime(2025, 4, 1), TransactionType = "Installment", DebitCredit = "Cr", PrincipalAmount = 12000m },
                new RdTransaction { RdTransactionID = 4, BranchID = 1, RdAccountID = 3, TransactionDate = new DateTime(2026, 3, 27), TransactionType = "Installment", DebitCredit = "Cr", PrincipalAmount = 2000m },
                new RdTransaction { RdTransactionID = 5, BranchID = 1, RdAccountID = 3, TransactionDate = new DateTime(2026, 4, 5), TransactionType = "Installment", DebitCredit = "Cr", PrincipalAmount = 2000m },
                new RdTransaction { RdTransactionID = 6, BranchID = 1, RdAccountID = 3, TransactionDate = new DateTime(2026, 4, 15), TransactionType = "Premature_Close", DebitCredit = "Dr", PrincipalAmount = 4000m }
            );

            await db.SaveChangesAsync();

            var rdCtrl = new RdAccountsController(db);
            AttachUser(rdCtrl, BuildPrincipal(1, "admin", "SuperAdmin", 1));

            // Calling GetRdAccounts must NOT mutate CustomerOpeningBalances or BranchLedgerOpeningBalances
            await rdCtrl.GetRdAccounts(branchId: 1);
            Assert.Empty(await db.CustomerOpeningBalances.ToListAsync());
            Assert.Empty(await db.BranchLedgerOpeningBalances.ToListAsync());

            // Explicit SyncOpeningBalances writes strictly pre-FY 31-03-2026 balances: 5,000 + 12,000 + 2,000 = 19,000
            await rdCtrl.SyncRdOpeningBalances();

            var branchOb = await db.BranchLedgerOpeningBalances.FirstOrDefaultAsync(b => b.LedgerID == 49 && b.FinancialYearID == 1);
            Assert.NotNull(branchOb);
            Assert.Equal(19000m, branchOb!.OpeningBalance);

            var custObs = await db.CustomerOpeningBalances.Where(c => c.LedgerID == 49).ToDictionaryAsync(c => c.CustomerID, c => c.Amount);
            Assert.Equal(5000m, custObs[1]);
            Assert.Equal(12000m, custObs[2]);
            Assert.Equal(2000m, custObs[3]);
        }

        [Fact]
        public async Task PutRdAccount_BlocksPrincipalEditAfterPostMigrationCollections_AndSyncsVoucherWhenSafe()
        {
            await using var db = CreateContext();
            await SeedBaseDataAsync(db);

            // 1. Migrated account with NO post-migration collections -> editing from 500 -> 5,000 updates JV-RD-OP + schedules
            db.RdAccounts.Add(new RdAccount
            {
                RdAccountID = 30,
                BranchID = 1,
                CustomerID = 1,
                RdSchemeID = 3,
                AccountNo = "001-503-0000030-7",
                OpeningDate = new DateTime(2025, 10, 22),
                MaturityDate = new DateTime(2026, 10, 22),
                InstallmentAmount = 500m,
                DurationMonths = 12,
                TotalPaidInstallments = 1,
                TotalDepositedAmount = 500m,
                IsLegacyAccount = true,
                Status = "Active"
            });
            db.Vouchers.Add(new Voucher { VoucherID = 10, BranchID = 1, VoucherNo = "JV-RD-OP-001-503-0000030-7", VoucherDate = new DateTime(2025, 10, 22), VoucherType = "Journal", TotalAmount = 500m, Status = "Approved" });
            db.RdTransactions.Add(new RdTransaction { RdTransactionID = 10, BranchID = 1, RdAccountID = 30, VoucherID = 10, TransactionDate = new DateTime(2025, 10, 22), TransactionType = "Installment", InstallmentNo = 1, DebitCredit = "Cr", PrincipalAmount = 500m, Narration = "मायग्रेटेड आरडी खाते सुरुवाती शिल्लक: 001-503-0000030-7" });

            // 2. Migrated account WITH post-migration collection -> editing TotalDepositedAmount must be rejected
            db.RdAccounts.Add(new RdAccount
            {
                RdAccountID = 122,
                BranchID = 1,
                CustomerID = 2,
                RdSchemeID = 4,
                AccountNo = "001-504-0000122-1",
                OpeningDate = new DateTime(2025, 5, 30),
                MaturityDate = new DateTime(2026, 5, 30),
                InstallmentAmount = 5000m,
                DurationMonths = 12,
                TotalPaidInstallments = 13,
                TotalDepositedAmount = 65000m,
                IsLegacyAccount = true,
                Status = "Active"
            });
            db.Vouchers.Add(new Voucher { VoucherID = 11, BranchID = 1, VoucherNo = "JV-RD-OP-001-504-0000122-1", VoucherDate = new DateTime(2025, 5, 30), VoucherType = "Journal", TotalAmount = 55000m, Status = "Approved" });
            db.Vouchers.Add(new Voucher { VoucherID = 12, BranchID = 1, VoucherNo = "JV-RD-COLL-001-504-0000122-1-12", VoucherDate = new DateTime(2026, 4, 27), VoucherType = "Receipt", TotalAmount = 10000m, Status = "Approved" });
            db.RdTransactions.AddRange(
                new RdTransaction { RdTransactionID = 11, BranchID = 1, RdAccountID = 122, VoucherID = 11, TransactionDate = new DateTime(2025, 5, 30), TransactionType = "Installment", InstallmentNo = 11, DebitCredit = "Cr", PrincipalAmount = 55000m, Narration = "मायग्रेटेड आरडी खाते सुरुवाती शिल्लक: 001-504-0000122-1" },
                new RdTransaction { RdTransactionID = 12, BranchID = 1, RdAccountID = 122, VoucherID = 12, TransactionDate = new DateTime(2026, 4, 27), TransactionType = "Installment", InstallmentNo = 13, DebitCredit = "Cr", PrincipalAmount = 10000m, Narration = "आरडी हप्ता भरणा" }
            );
            await db.SaveChangesAsync();

            var rdCtrl = new RdAccountsController(db);
            AttachUser(rdCtrl, BuildPrincipal(1, "admin", "SuperAdmin", 1));

            // Edit #30 safely
            var okRes = await rdCtrl.PutRdAccount(30, new RdAccount
            {
                RdAccountID = 30,
                CustomerID = 1,
                RdSchemeID = 3,
                OpeningDate = new DateTime(2025, 10, 22),
                MaturityDate = new DateTime(2026, 10, 22),
                InstallmentAmount = 500m,
                DurationMonths = 12,
                InterestRate = 8m,
                TotalPaidInstallments = 10,
                TotalDepositedAmount = 5000m
            });
            Assert.IsType<OkObjectResult>(okRes);
            var opTx30 = await db.RdTransactions.FirstAsync(t => t.RdAccountID == 30);
            Assert.Equal(5000m, opTx30.PrincipalAmount);
            Assert.Equal(10, await db.RDInstallmentSchedules.CountAsync(s => s.RdAccountID == 30 && s.Status == "Paid"));

            // Attempt to overwrite #122 back down after April collection -> blocked
            var badRes = await rdCtrl.PutRdAccount(122, new RdAccount
            {
                RdAccountID = 122,
                CustomerID = 2,
                RdSchemeID = 4,
                OpeningDate = new DateTime(2025, 5, 30),
                MaturityDate = new DateTime(2026, 5, 30),
                InstallmentAmount = 5000m,
                DurationMonths = 12,
                InterestRate = 9m,
                TotalPaidInstallments = 11,
                TotalDepositedAmount = 55000m
            });
            Assert.IsType<BadRequestObjectResult>(badRes);
            Assert.Equal(65000m, (await db.RdAccounts.FindAsync(122))!.TotalDepositedAmount);
        }
    }
}
