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
using Microsoft.Extensions.Caching.Memory;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class LoanCollectionOtherFeeLedgersTests
    {
        private static AppDbContext GetInMemoryDbContext(string dbName)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: dbName)
                .ConfigureWarnings(x => x.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ControllerContext BuildAdminContext(int branchId = 1, int userId = 1)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, "admin"),
                new Claim(ClaimTypes.Role, "Admin"),
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
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

        private static async Task SeedFullChartAsync(AppDbContext db, DateTime refDate)
        {
            db.Branches.Add(new Branch { BranchID = 1, BranchName = "मुख्य शाखा (Main Branch)", BranchCode = "001", DefaultCashLedgerID = 1 });
            db.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "26-27",
                StartDate = new DateTime(refDate.Year, 1, 1),
                EndDate = new DateTime(refDate.Year + 1, 12, 31),
                IsActive = true
            });
            db.AccountGroups.AddRange(
                new AccountGroup { GroupID = 1, GroupName = "Assets", NatureOfGroup = "Assets", IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "Liabilities", NatureOfGroup = "Liabilities", IsActive = true },
                new AccountGroup { GroupID = 3, GroupName = "अप्रत्यक्ष उत्पन्न (Indirect Income)", NatureOfGroup = "Income", IsActive = true },
                new AccountGroup { GroupID = 4, GroupName = "Expenses", NatureOfGroup = "Expenses", IsActive = true }
            );
            db.Ledgers.AddRange(
                new Ledger { LedgerID = 1, GroupID = 1, LedgerCode = "CSH-1", LedgerName = "हातातील रोख शिल्लक", AccountType = "Cash In Hand", ReportType = "ताळेबंद", IsActive = true },
                new Ledger { LedgerID = 2, GroupID = 1, LedgerCode = "BNK-1", LedgerName = "स्टेट बँक चालू खाते", AccountType = "Bank Account", ReportType = "ताळेबंद", IsActive = true },
                new Ledger { LedgerID = 115, GroupID = 1, LedgerCode = "LN-REC", LedgerName = "येणे व्याज कर्जावरील", AccountType = "Asset", ReportType = "ताळेबंद", IsActive = true },
                new Ledger { LedgerID = 201, GroupID = 1, LedgerCode = "LN-P", LedgerName = "मेंबर कर्ज खाते", AccountType = "Asset", ReportType = "ताळेबंद", IsActive = true },
                new Ledger { LedgerID = 210, GroupID = 2, LedgerCode = "FD-L", LedgerName = "मुदत ठेव खाते", AccountType = "Liabilities", ReportType = "ताळेबंद", IsActive = true },
                new Ledger { LedgerID = 220, GroupID = 2, LedgerCode = "SB-L", LedgerName = "बचत ठेव खाते", AccountType = "Liabilities", ReportType = "ताळेबंद", IsActive = true },
                new Ledger { LedgerID = 301, GroupID = 3, LedgerCode = "LN-INT", LedgerName = "मेंबर कर्ज व्याज", AccountType = "Income", ReportType = "नफातोटा पत्रक", IsActive = true },
                new Ledger { LedgerID = 401, GroupID = 3, LedgerCode = "INC-OTH", LedgerName = "अन्य इतर उत्पन्न", AccountType = "Income", ReportType = "नफातोटा पत्रक", IsActive = true },
                new Ledger { LedgerID = 402, GroupID = 3, LedgerCode = "INC-NTC", LedgerName = "नोटीस फी उत्पन्न", AccountType = "Income", ReportType = "नफातोटा पत्रक", IsActive = true },
                new Ledger { LedgerID = 403, GroupID = 3, LedgerCode = "INC-BS", LedgerName = "चुकीचे ताळेबंद लेजर", AccountType = "Income", ReportType = "ताळेबंद", IsActive = true },
                new Ledger { LedgerID = 404, GroupID = 3, LedgerCode = "INC-CTRL", LedgerName = "योजनेस जोडलेले खाते", AccountType = "Income", ReportType = "नफातोटा पत्रक", IsActive = true },
                new Ledger { LedgerID = 501, GroupID = 4, LedgerCode = "EXP-1", LedgerName = "स्टेशनरी खर्च", AccountType = "Expenses", ReportType = "नफातोटा पत्रक", IsActive = true }
            );
            db.Customers.Add(new Customer
            {
                CustomerID = 10,
                BranchID = 1,
                CIFNo = "CIF001376",
                FirstName = "ऋषिकेश",
                MiddleName = "दिनकर",
                LastName = "कारंडे"
            });
            db.LoanRates.Add(new LoanRate
            {
                LoanRateID = 1,
                LoanType = "मेंबर कर्ज",
                LoanCode = "LN01",
                ShortName = "मेंबर कर्ज",
                InterestRate = 15m,
                LoanLedgerID = 201,
                InterestLedgerID = 301,
                ReceivableInterestLedgerID = 115,
                IsActive = true
            });
            // Mark 404 as a personal/scheme control ledger (FD Liability) to verify strict exclusion even if placed under Income group
            db.FdSchemes.Add(new FdScheme
            {
                FdSchemeID = 1,
                SchemeName = "Test FD Scheme",
                SchemeCode = "FD01",
                InterestRate = 8m,
                FdLiabilityLedgerID = 404,
                IsActive = true
            });
            db.LoanAccounts.Add(new LoanAccount
            {
                LoanAccountID = 50,
                BranchID = 1,
                CustomerID = 10,
                LoanRateID = 1,
                LoanAccountNo = "001--0-012010000359",
                SanctionedAmount = 100000m,
                PrincipalBalance = 65315m,
                PurePrincipalBalance = 65315m,
                InterestBalance = 0m,
                OverdueInterestBalance = 0m,
                InterestRate = 15m,
                DurationMonths = 24,
                OpeningDate = new DateTime(2025, 6, 5),
                LoanDisbursementDate = new DateTime(2025, 6, 5),
                LastInstallmentPaidDate = new DateTime(2026, 4, 1),
                MaturityDate = new DateTime(2027, 6, 5),
                Status = "Active"
            });
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task GetFeeIncomeLedgers_ReturnsOnlyIncomeLedgersAndExcludesCashBankExpensesAndPersonalControlLedgers()
        {
            using var db = GetInMemoryDbContext(nameof(GetFeeIncomeLedgers_ReturnsOnlyIncomeLedgersAndExcludesCashBankExpensesAndPersonalControlLedgers));
            await SeedFullChartAsync(db, new DateTime(2026, 4, 1));

            var ctrl = new LoanCollectionsController(db, new VoucherRollbackAndDeleteService(db))
            {
                ControllerContext = BuildAdminContext()
            };

            var res = await ctrl.GetFeeIncomeLedgers();
            var okResult = Assert.IsType<OkObjectResult>(res.Result);
            var ledgers = Assert.IsAssignableFrom<IEnumerable<Ledger>>(okResult.Value).ToList();
            var ids = ledgers.Select(l => l.LedgerID).ToList();

            Assert.Contains(301, ids);
            Assert.Contains(401, ids);
            Assert.Contains(402, ids);

            Assert.DoesNotContain(1, ids);   // Cash
            Assert.DoesNotContain(2, ids);   // Bank
            Assert.DoesNotContain(115, ids); // Receivable Interest Asset
            Assert.DoesNotContain(201, ids); // Loan Principal Asset
            Assert.DoesNotContain(210, ids); // FD Liability
            Assert.DoesNotContain(220, ids); // SB Liability
            Assert.DoesNotContain(403, ids); // ReportType = ताळेबंद
            Assert.DoesNotContain(404, ids); // Scheme personal/control ledger
            Assert.DoesNotContain(501, ids); // Expense
        }

        [Fact]
        public async Task PostLoanCollection_WithOtherFeeLedger_ReflectsAcrossVoucherRegisterLedgerDaybookMember360AndClosedReport()
        {
            using var db = GetInMemoryDbContext(nameof(PostLoanCollection_WithOtherFeeLedger_ReflectsAcrossVoucherRegisterLedgerDaybookMember360AndClosedReport));
            var colDate = new DateTime(2026, 4, 1);
            await SeedFullChartAsync(db, colDate);

            var rollbackSvc = new VoucherRollbackAndDeleteService(db);
            var collectionsCtrl = new LoanCollectionsController(db, rollbackSvc)
            {
                ControllerContext = BuildAdminContext()
            };
            using var cache = new MemoryCache(new MemoryCacheOptions());
            var reportsCtrl = new ReportsController(db, cache)
            {
                ControllerContext = BuildAdminContext()
            };

            // Matches UI behavior: Loan-only recovery (65,315) + Fee Row (1,000) => Receipt Voucher = 66,315
            var collection = new LoanCollection
            {
                LoanAccountID = 50,
                BranchID = 1,
                CollectionDate = colDate,
                PaymentMode = "Cash",
                TotalAmountReceived = 65315m,
                PrincipalCollected = 65315m,
                ReceivableInterestCollected = 0m,
                InterestCollected = 0m,
                PenaltyInterestCollected = 0m,
                SurchargeCollected = 0m,
                Fees = new List<LoanCollectionFee>
                {
                    new LoanCollectionFee { LedgerID = 401, Amount = 1000m }
                }
            };

            var postRes = await collectionsCtrl.PostLoanCollection(collection);
            var created = Assert.IsType<CreatedAtActionResult>(postRes.Result);
            Assert.NotNull(created.Value);

            var voucher = await db.Vouchers.AsNoTracking().Include(v => v.VoucherDetails).FirstAsync();
            Assert.Equal(66315m, voucher.TotalAmount);
            Assert.Equal(66315m, voucher.VoucherDetails.Single(vd => vd.DrCr == "Dr" && vd.LedgerID == 1).Amount);
            Assert.Equal(65315m, voucher.VoucherDetails.Single(vd => vd.DrCr == "Cr" && vd.LedgerID == 201).Amount);
            Assert.Equal(1000m, voucher.VoucherDetails.Single(vd => vd.DrCr == "Cr" && vd.LedgerID == 401).Amount);

            // 1. LoanCollectionRegister reflects 1,000 Fee and 66,315 Grand Total
            var regRes = await reportsCtrl.GetLoanCollectionRegister(colDate, colDate, 1);
            var regOk = Assert.IsType<OkObjectResult>(regRes.Result);
            var regRows = Assert.IsAssignableFrom<IEnumerable<LoanCollectionRegisterDto>>(regOk.Value).ToList();
            Assert.Single(regRows);
            Assert.Equal(65315m, regRows[0].TotalAmountReceived);
            Assert.Equal(1000m, regRows[0].FeesCollected);
            Assert.Equal(66315m, regRows[0].GrandTotalReceived);
            Assert.Contains("अन्य इतर उत्पन्न", regRows[0].FeesSummary);

            // 2. LoanLedger shows OtherFees = 1,000, Total = 66,315, and Balance reduces ONLY by Principal (0)
            var ledgerRes = await reportsCtrl.GetLoanLedger(50, new DateTime(2025, 4, 1), colDate);
            var ledgerDto = Assert.IsType<LoanLedgerReportDto>(ledgerRes.Value ?? (ledgerRes.Result as OkObjectResult)?.Value);
            var colRow = ledgerDto.Transactions.Single(t => t.ReceiptNo != "-" && !t.Particulars.Contains("Disbursement"));
            Assert.Equal(65315m, colRow.PrincipalDeposit);
            Assert.Equal(1000m, colRow.OtherFees);
            Assert.Equal(66315m, colRow.Total);
            Assert.Equal(0m, colRow.Balance);

            // 3. Closed Loan Report reflects 66,315
            var closedRes = await reportsCtrl.GetClosedLoanReport(fromDate: null, toDate: null, allDates: true, loanRateId: null, branchId: 1);
            var closedOk = Assert.IsType<OkObjectResult>(closedRes.Result);
            var closedDto = Assert.IsType<ClosedLoanReportResponseDto>(closedOk.Value);
            Assert.Single(closedDto.Rows);
            Assert.Equal(66315m, closedDto.Rows[0].TotalCollected);

            // 4. Unvouchered Daybook includes Fee ledger on Jama side (simulate direct unvouchered collection cleanly)
            var savedCol = await db.LoanCollections.Include(c => c.Fees).FirstAsync();
            savedCol.VoucherID = null;
            db.VoucherDetails.RemoveRange(db.VoucherDetails);
            db.Vouchers.RemoveRange(db.Vouchers);
            await db.SaveChangesAsync();

            var daybookRes = await reportsCtrl.GetDaybook(colDate, colDate, 1, "all");
            var daybookDto = Assert.IsType<DaybookResponseDto>(daybookRes.Value ?? (daybookRes.Result as OkObjectResult)?.Value);
            var feeGroup = daybookDto.Receipts.FirstOrDefault(g => g.LedgerId == 401);
            Assert.NotNull(feeGroup);
            Assert.Equal(1000m, feeGroup!.TotalCash);
        }

        [Fact]
        public async Task PostLoanCollection_FeeOnlyCollection_SavesWithoutAdvancingInstallmentPaidDate()
        {
            using var db = GetInMemoryDbContext(nameof(PostLoanCollection_FeeOnlyCollection_SavesWithoutAdvancingInstallmentPaidDate));
            var initialPaidDate = new DateTime(2026, 4, 1);
            await SeedFullChartAsync(db, initialPaidDate);

            var ctrl = new LoanCollectionsController(db, new VoucherRollbackAndDeleteService(db))
            {
                ControllerContext = BuildAdminContext()
            };

            var colDate = new DateTime(2026, 4, 15);
            var collection = new LoanCollection
            {
                LoanAccountID = 50,
                BranchID = 1,
                CollectionDate = colDate,
                PaymentMode = "Cash",
                TotalAmountReceived = 0m,
                PrincipalCollected = 0m,
                ReceivableInterestCollected = 0m,
                InterestCollected = 0m,
                PenaltyInterestCollected = 0m,
                SurchargeCollected = 0m,
                Fees = new List<LoanCollectionFee>
                {
                    new LoanCollectionFee { LedgerID = 402, Amount = 500m }
                }
            };

            var res = await ctrl.PostLoanCollection(collection);
            Assert.IsType<CreatedAtActionResult>(res.Result);

            var loanAcc = await db.LoanAccounts.AsNoTracking().FirstAsync(l => l.LoanAccountID == 50);
            Assert.Equal(65315m, loanAcc.PrincipalBalance);
            Assert.Equal(initialPaidDate, loanAcc.LastInstallmentPaidDate);

            var voucher = await db.Vouchers.AsNoTracking().Include(v => v.VoucherDetails).FirstAsync();
            Assert.Equal(500m, voucher.TotalAmount);
            Assert.Equal(500m, voucher.VoucherDetails.Single(vd => vd.DrCr == "Cr" && vd.LedgerID == 402).Amount);
        }

        [Theory]
        [InlineData(1)]   // Cash
        [InlineData(2)]   // Bank
        [InlineData(201)] // Loan Principal (Asset/Personal Control)
        [InlineData(210)] // FD Liability (Personal Control)
        [InlineData(403)] // Balance Sheet ReportType
        [InlineData(404)] // Scheme Control Ledger under Income
        [InlineData(501)] // Expense
        public async Task PostLoanCollection_RejectsNonIncomeAndPersonalControlLedgersInFees(int invalidFeeLedgerId)
        {
            using var db = GetInMemoryDbContext($"{nameof(PostLoanCollection_RejectsNonIncomeAndPersonalControlLedgersInFees)}_{invalidFeeLedgerId}");
            var colDate = new DateTime(2026, 4, 1);
            await SeedFullChartAsync(db, colDate);

            var ctrl = new LoanCollectionsController(db, new VoucherRollbackAndDeleteService(db))
            {
                ControllerContext = BuildAdminContext()
            };

            var collection = new LoanCollection
            {
                LoanAccountID = 50,
                BranchID = 1,
                CollectionDate = colDate,
                PaymentMode = "Cash",
                TotalAmountReceived = 1000m,
                PrincipalCollected = 1000m,
                Fees = new List<LoanCollectionFee>
                {
                    new LoanCollectionFee { LedgerID = invalidFeeLedgerId, Amount = 250m }
                }
            };

            var res = await ctrl.PostLoanCollection(collection);
            Assert.IsType<BadRequestObjectResult>(res.Result);
            Assert.Empty(db.LoanCollectionFees);
        }

        [Fact]
        public async Task DeleteLoanCollection_WithOtherFees_CleansUpLoanCollectionFeesAndRestoresLoanBalance()
        {
            using var db = GetInMemoryDbContext(nameof(DeleteLoanCollection_WithOtherFees_CleansUpLoanCollectionFeesAndRestoresLoanBalance));
            var colDate = new DateTime(2026, 4, 1);
            await SeedFullChartAsync(db, colDate);

            var ctrl = new LoanCollectionsController(db, new VoucherRollbackAndDeleteService(db))
            {
                ControllerContext = BuildAdminContext()
            };

            var collection = new LoanCollection
            {
                LoanAccountID = 50,
                BranchID = 1,
                CollectionDate = colDate,
                PaymentMode = "Cash",
                TotalAmountReceived = 65315m,
                PrincipalCollected = 65315m,
                Fees = new List<LoanCollectionFee>
                {
                    new LoanCollectionFee { LedgerID = 401, Amount = 1000m }
                }
            };

            var postRes = await ctrl.PostLoanCollection(collection);
            Assert.IsType<CreatedAtActionResult>(postRes.Result);
            Assert.Single(db.LoanCollectionFees);

            var savedCol = await db.LoanCollections.AsNoTracking().FirstAsync();
            var delRes = await ctrl.DeleteLoanCollection(savedCol.LoanCollectionID);
            Assert.IsType<OkObjectResult>(delRes);

            Assert.Empty(db.LoanCollectionFees);
            Assert.Empty(db.LoanCollections);
            var restoredLoan = await db.LoanAccounts.AsNoTracking().FirstAsync(l => l.LoanAccountID == 50);
            Assert.Equal(65315m, restoredLoan.PrincipalBalance);
            Assert.Equal("Active", restoredLoan.Status);
        }
    }
}
