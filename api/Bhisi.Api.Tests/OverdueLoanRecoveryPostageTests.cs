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
using Bhisi.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Caching.Memory;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class OverdueLoanRecoveryPostageTests
    {
        private static JsonDocument SerializeCamelCase(object? value) =>
            JsonDocument.Parse(JsonSerializer.Serialize(value, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }));

        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"OverdueLoanCharges_{Guid.NewGuid():N}")
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ClaimsPrincipal BuildPrincipal(int userId, string username, string role, int branchId, DateTime bizDate, bool isHo = true)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Name, username),
                new Claim(ClaimTypes.Role, role),
                new Claim("BranchID", branchId.ToString()),
                new Claim("DefaultBranchID", branchId.ToString()),
                new Claim("IsHeadOffice", isHo ? "true" : "false"),
                new Claim("BusinessDate", bizDate.ToString("yyyy-MM-dd"))
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

        private static async Task SeedEnvironmentAsync(AppDbContext db, DateTime bizDate)
        {
            db.SansthaDetails.Add(new SansthaDetail
            {
                SansthaID = 1,
                SansthaName = "रयत पतसंस्था मर्यादित"
            });

            db.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "2026-2027",
                StartDate = new DateTime(2026, 4, 1),
                EndDate = new DateTime(2027, 3, 31),
                IsActive = true,
                IsClosed = false
            });

            db.BranchDayEndStatuses.AddRange(
                new BranchDayEndStatus { BranchID = 1, BusinessDate = bizDate.Date, IsDayClosed = false },
                new BranchDayEndStatus { BranchID = 2, BusinessDate = bizDate.Date, IsDayClosed = false }
            );

            db.AccountGroups.AddRange(
                new AccountGroup { GroupID = 1, GroupName = "ठेवी", NatureOfGroup = "Liabilities", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "मालमत्ता व येणी", NatureOfGroup = "Assets", DisplayOrder = 2, IsActive = true },
                new AccountGroup { GroupID = 3, GroupName = "खर्च", NatureOfGroup = "Expenses", DisplayOrder = 3, IsActive = true },
                new AccountGroup { GroupID = 4, GroupName = "उत्पन्न", NatureOfGroup = "Income", DisplayOrder = 4, IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 10, GroupID = 2, LedgerCode = "10", LedgerName = "हातातील रोख शिल्लक (मुख्य)", AccountType = "Cash In Hand", ReportType = "Balance Sheet", IsActive = true },
                new Ledger { LedgerID = 20, GroupID = 2, LedgerCode = "20", LedgerName = "हातातील रोख शिल्लक (शाखा २)", AccountType = "Cash In Hand", ReportType = "Balance Sheet", IsActive = true },
                new Ledger { LedgerID = 46, GroupID = 1, LedgerCode = "46", LedgerName = "सेव्हिंग ठेव", AccountType = "Savings", ReportType = "Balance Sheet", IsActive = true },
                new Ledger { LedgerID = 101, GroupID = 2, LedgerCode = "101", LedgerName = "सर्वसाधारण तारण कर्ज मुद्दल", AccountType = "Loan", ReportType = "Balance Sheet", IsActive = true },
                new Ledger { LedgerID = 102, GroupID = 2, LedgerCode = "102", LedgerName = "येणे कर्ज व्याज", AccountType = "Receivable", ReportType = "Balance Sheet", IsActive = true },
                new Ledger { LedgerID = 103, GroupID = 2, LedgerCode = "103", LedgerName = "येणे दंड व्याज", AccountType = "Receivable", ReportType = "Balance Sheet", IsActive = true },
                new Ledger { LedgerID = 104, GroupID = 2, LedgerCode = "104", LedgerName = "कायदेशीर वसुली खर्च येणे", AccountType = "Receivable", ReportType = "Balance Sheet", IsActive = true },
                new Ledger { LedgerID = 351, GroupID = 3, LedgerCode = "351", LedgerName = "नोकर पगार खर्च", AccountType = "Expenses", ReportType = "Profit & Loss", IsActive = true },
                new Ledger { LedgerID = 401, GroupID = 4, LedgerCode = "401", LedgerName = "कर्ज व्याज उत्पन्न", AccountType = "Income", ReportType = "Profit & Loss", IsActive = true },
                new Ledger { LedgerID = 402, GroupID = 4, LedgerCode = "402", LedgerName = "दंड व्याज उत्पन्न", AccountType = "Income", ReportType = "Profit & Loss", IsActive = true },
                new Ledger { LedgerID = 403, GroupID = 4, LedgerCode = "403", LedgerName = "इतर उत्पन्न", AccountType = "Income", ReportType = "Profit & Loss", IsActive = true },
                new Ledger { LedgerID = 404, GroupID = 4, LedgerCode = "404", LedgerName = "पोसटेज खर्च उत्पन्न", AccountType = "Income", ReportType = "Profit & Loss", IsActive = true },
                new Ledger { LedgerID = 405, GroupID = 4, LedgerCode = "405", LedgerName = "वसूली खर्च उत्पन्न", AccountType = "Income", ReportType = "Profit & Loss", IsActive = true }
            );

            db.Branches.AddRange(
                new Branch { BranchID = 1, BranchCode = "HO", BranchName = "मुख्य शाखा", BranchType = "HeadOffice", DefaultCashLedgerID = 10, IsActive = true },
                new Branch { BranchID = 2, BranchCode = "BR2", BranchName = "तासगाव शाखा", BranchType = "Branch", DefaultCashLedgerID = 20, IsActive = true }
            );

            db.LoanRates.Add(new LoanRate
            {
                LoanRateID = 1,
                LoanCode = "GL",
                LoanType = "तारण मुदती कर्ज",
                ShortName = "तारण कर्ज",
                InterestRate = 14m,
                OverdueInterestRate = 2m,
                InterestCalculationMethod = "Flat",
                LoanInstallmentType = "मासिक हप्ता (EMI)",
                LoanLedgerID = 101,
                InterestLedgerID = 401,
                ReceivableInterestLedgerID = 102,
                OverdueInterestLedgerID = 402,
                IsActive = true
            });

            db.Customers.AddRange(
                new Customer { CustomerID = 201, BranchID = 1, CIFNo = "CIF000201", FirstName = "प्रकाश", LastName = "कुलकर्णी", BirthDate = new DateTime(1980, 1, 1) },
                new Customer { CustomerID = 202, BranchID = 2, CIFNo = "CIF000202", FirstName = "राहुल", LastName = "कदम", BirthDate = new DateTime(1982, 2, 2) }
            );

            db.Members.AddRange(
                new Member { MemberID = 301, BranchID = 1, CustomerID = 201, MemberCode = "M-301", Status = "Active" },
                new Member { MemberID = 302, BranchID = 2, CustomerID = 202, MemberCode = "M-302", Status = "Active" }
            );

            // Post-maturity overdue loan in Branch 1 with NO Sec 101 Case
            db.LoanAccounts.AddRange(
                new LoanAccount
                {
                    LoanAccountID = 501,
                    BranchID = 1,
                    CustomerID = 201,
                    MemberID = 301,
                    LoanRateID = 1,
                    LoanAccountNo = "00150100000501",
                    LegacyAccountNumber = "OLD-LN-501",
                    OpeningDate = new DateTime(2025, 4, 1),
                    LoanDisbursementDate = new DateTime(2025, 4, 1),
                    MaturityDate = new DateTime(2026, 4, 1), // Past Maturity as of 2026-06-15
                    DurationMonths = 12,
                    NoOfInstallments = 12,
                    SanctionedAmount = 10000m,
                    PrincipalBalance = 10000m,
                    PurePrincipalBalance = 10000m,
                    CapitalizedInterestAmount = 0m,
                    CapitalizedRecoveryCharges = 0m,
                    InterestBalance = 0m,
                    OverdueInterestBalance = 0m,
                    InterestRate = 14m,
                    InstallmentAmount = 1000m,
                    Status = "Active",
                    IsOpeningBalance = false
                },
                new LoanAccount
                {
                    LoanAccountID = 502,
                    BranchID = 2,
                    CustomerID = 202,
                    MemberID = 302,
                    LoanRateID = 1,
                    LoanAccountNo = "00250100000502",
                    OpeningDate = new DateTime(2025, 4, 1),
                    LoanDisbursementDate = new DateTime(2025, 4, 1),
                    MaturityDate = new DateTime(2026, 4, 1),
                    DurationMonths = 12,
                    NoOfInstallments = 12,
                    SanctionedAmount = 20000m,
                    PrincipalBalance = 20000m,
                    PurePrincipalBalance = 20000m,
                    InterestRate = 14m,
                    InstallmentAmount = 2000m,
                    Status = "Active",
                    IsOpeningBalance = false
                }
            );

            db.LoanDisbursements.Add(new LoanDisbursement
            {
                LoanDisbursementID = 1,
                LoanAccountID = 501,
                DisbursementDate = new DateTime(2025, 4, 1),
                DisbursementAmount = 10000m,
                NetAmountPaid = 10000m,
                PaymentMode = "Cash"
            });

            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task GetLoanChargeLedgers_ReturnsDynamicIncomeLedgersOnly_AndLoanControlLedgers()
        {
            await using var db = CreateContext();
            var bizDate = new DateTime(2026, 6, 15);
            await SeedEnvironmentAsync(db, bizDate);

            var vouchersCtrl = new VouchersController(db, new VoucherRollbackAndDeleteService(db));
            var res = await vouchersCtrl.GetLoanChargeLedgers();
            var okRes = Assert.IsType<OkObjectResult>(res.Result);

            using var doc = SerializeCamelCase(okRes.Value);
            var loanIds = doc.RootElement.GetProperty("loanLedgerIds").EnumerateArray().Select(e => e.GetInt32()).ToList();
            var incomeIds = doc.RootElement.GetProperty("incomeLedgers").EnumerateArray().Select(e => e.GetProperty("ledgerID").GetInt32()).ToList();

            Assert.Single(loanIds);
            Assert.Equal(101, loanIds[0]);

            Assert.Contains(403, incomeIds); // इतर उत्पन्न
            Assert.Contains(404, incomeIds); // पोसटेज खर्च उत्पन्न
            Assert.Contains(405, incomeIds); // वसूली खर्च उत्पन्न
            Assert.DoesNotContain(10, incomeIds);  // Cash
            Assert.DoesNotContain(46, incomeIds);  // Saving control
            Assert.DoesNotContain(101, incomeIds); // Loan asset control
            Assert.DoesNotContain(351, incomeIds); // Expense
        }

        [Fact]
        public async Task PreCaseOverdueLoan_PostageAndRecoveryCharges_CapitalizeOnApproval_AndReflectInReports()
        {
            await using var db = CreateContext();
            var bizDate = new DateTime(2026, 6, 15);
            await SeedEnvironmentAsync(db, bizDate);

            var legalCtrl = new LegalRecoveryController(db);
            AttachUser(legalCtrl, BuildPrincipal(11, "maker", "Accountant", branchId: 1, bizDate));

            // 1. Reject non-Income CreditLedger (Expense ledger 351)
            var badCreditRes = await legalCtrl.AddLegalExpense(new AddLegalExpenseDto
            {
                BranchId = 1,
                CaseId = null,
                LoanAccountId = 501,
                ExpenseType = "POSTAGE_EXPENSE",
                Amount = 500m,
                ExpenseDate = bizDate,
                CapitalizeToLoanPrincipal = true,
                CreditLedgerId = 351,
                PaymentMode = "JOURNAL",
                IsDebitedToBorrower = true,
                PostVoucher = true
            });
            Assert.IsType<BadRequestObjectResult>(badCreditRes);

            // 2. Valid pre-case Postage Charge added to Loan Principal (Dr 101 Loan GL / Cr 404 Postage Income GL)
            var addPostageRes = await legalCtrl.AddLegalExpense(new AddLegalExpenseDto
            {
                BranchId = 1,
                CaseId = null, // No Sec 101 case required
                LoanAccountId = 501,
                ExpenseType = "POSTAGE_EXPENSE",
                Amount = 500m,
                ExpenseDate = bizDate,
                CapitalizeToLoanPrincipal = true,
                CreditLedgerId = 404,
                PaymentMode = "JOURNAL",
                IsDebitedToBorrower = true,
                PostVoucher = true,
                Remarks = "रजिस्टर पोस्ट नोटीस खर्च"
            });
            var okPostage = Assert.IsType<OkObjectResult>(addPostageRes);
            using var postJson = SerializeCamelCase(okPostage.Value);
            int voucherId = postJson.RootElement.GetProperty("voucherId").GetInt32();
            string voucherNo = postJson.RootElement.GetProperty("voucherNo").GetString()!;

            Assert.StartsWith("JV-CHG-", voucherNo);

            // Zero Auto-Post: loan balance must remain untouched while voucher is Pending
            var loanBefore = await db.LoanAccounts.AsNoTracking().FirstAsync(l => l.LoanAccountID == 501);
            Assert.Equal(10000m, loanBefore.PrincipalBalance);
            Assert.Equal(0m, loanBefore.CapitalizedRecoveryCharges);

            var pendingExp = await db.Sec101LegalExpenses.AsNoTracking().SingleAsync(e => e.VoucherId == voucherId);
            Assert.True(pendingExp.CapitalizeToLoanPrincipal);
            Assert.False(pendingExp.IsPrincipalApplied);

            var voucherDetails = await db.VoucherDetails.AsNoTracking().Where(d => d.VoucherID == voucherId).ToListAsync();
            Assert.Contains(voucherDetails, d => d.DrCr == "Dr" && d.LedgerID == 101 && d.ChargeLoanAccountID == 501 && d.ChargeExpenseType == "POSTAGE_EXPENSE" && d.Amount == 500m);
            Assert.Contains(voucherDetails, d => d.DrCr == "Cr" && d.LedgerID == 404 && d.Amount == 500m);

            // AccountDetails shows PendingPrincipalCharges = 500 before approval
            var loanAccCtrl = new LoanAccountsController(db);
            AttachUser(loanAccCtrl, BuildPrincipal(11, "maker", "Accountant", branchId: 1, bizDate));
            var detailsBefore = (await loanAccCtrl.GetAccountDetailsAndSchedule(501, bizDate)).Value!;
            Assert.Equal(10000m, detailsBefore.CurrentPrincipalBalance);
            Assert.Equal(500m, detailsBefore.PendingPrincipalCharges);
            Assert.Equal(0m, detailsBefore.CapitalizedRecoveryCharges);

            // 3. Approve via VoucherPostingController.PostVouchers
            var postingCtrl = new VoucherPostingController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(postingCtrl, BuildPrincipal(22, "checker", "Admin", branchId: 1, bizDate));
            var postRes = await postingCtrl.PostVouchers(new VoucherPostingController.PostVouchersRequest
            {
                VoucherIds = new List<int> { voucherId },
                BusinessDate = bizDate
            });
            Assert.IsType<OkObjectResult>(postRes);

            // Re-calling helper is strictly idempotent
            var approvedVoucher = await db.Vouchers.FindAsync(voucherId);
            await VoucherLoanChargeHelper.ApplyApprovedVoucherLoanChargesAsync(db, approvedVoucher!);

            var loanAfter = await db.LoanAccounts.AsNoTracking().FirstAsync(l => l.LoanAccountID == 501);
            Assert.Equal(10500m, loanAfter.PrincipalBalance);
            Assert.Equal(10000m, loanAfter.PurePrincipalBalance);
            Assert.Equal(0m, loanAfter.CapitalizedInterestAmount);
            Assert.Equal(500m, loanAfter.CapitalizedRecoveryCharges);
            Assert.Empty(db.OverdueRecoveryLedgers); // Capitalized charges are inside LoanAccount, NOT OverdueRecoveryLedgers

            // 4. Verify AccountDetailsAndSchedule does NOT mislabel ₹500 postage charge as CapitalizedInterestAmount
            var detailsAfter = (await loanAccCtrl.GetAccountDetailsAndSchedule(501, bizDate)).Value!;
            Assert.Equal(10500m, detailsAfter.CurrentPrincipalBalance);
            Assert.Equal(10000m, detailsAfter.PurePrincipalBalance);
            Assert.Equal(0m, detailsAfter.CapitalizedInterestAmount);
            Assert.Equal(500m, detailsAfter.CapitalizedRecoveryCharges);
            Assert.Equal(0m, detailsAfter.PendingPrincipalCharges);

            // 5. Verify LoanLedgerReport & OverdueLoans Report
            var reportsCtrl = new ReportsController(db, new MemoryCache(new MemoryCacheOptions()));
            AttachUser(reportsCtrl, BuildPrincipal(22, "checker", "Admin", branchId: 1, bizDate));

            var ledgerRes = await reportsCtrl.GetLoanLedger(501, new DateTime(2026, 4, 1), bizDate);
            var ledgerDto = Assert.IsType<Controllers.ReportsController>(reportsCtrl) != null
                ? (ledgerRes.Result is OkObjectResult okL ? okL.Value as Bhisi.Api.Models.LoanLedgerReportDto : ledgerRes.Value)!
                : null!;

            Assert.Equal(10000m, ledgerDto.PurePrincipalBalance);
            Assert.Equal(0m, ledgerDto.CapitalizedInterestAmount);
            Assert.Equal(500m, ledgerDto.CapitalizedRecoveryCharges);
            var chgRow = Assert.Single(ledgerDto.Transactions, t => t.RecoveryCharges == 500m && t.LoanDisbursement == 500m);
            Assert.Equal(10500m, chgRow.Balance);
            Assert.Equal(10500m, ledgerDto.Transactions.Last().Balance);

            var overdueRes = await reportsCtrl.GetOverdueLoans(bizDate, branchId: 1);
            var overdueDto = overdueRes.Result is OkObjectResult okO
                ? (Bhisi.Api.Models.OverdueLoanReportDto)okO.Value!
                : overdueRes.Value!;
            var overdueRow = Assert.Single(overdueDto.Rows, r => r.LoanAccountID == 501);
            Assert.Equal(10500m, overdueRow.PrincipalBalance);
            Assert.Equal(10500m, overdueRow.OverduePrincipal);
            Assert.Equal(500m, overdueRow.CapitalizedRecoveryCharges);
        }

        [Fact]
        public async Task LoanCollection_SettlesCapitalizedChargesFirst_BlocksRecoveredUnpass_AndRestoresOnRollback()
        {
            await using var db = CreateContext();
            var bizDate = new DateTime(2026, 6, 15);
            await SeedEnvironmentAsync(db, bizDate);

            // Add ₹500 Recovery Expense on 2026-05-10 via LegalRecovery + Post on 2026-05-10 business date
            var chargeDate = new DateTime(2026, 5, 10);
            db.BranchDayEndStatuses.Add(new BranchDayEndStatus { BranchID = 1, BusinessDate = chargeDate, IsDayClosed = false });
            await db.SaveChangesAsync();

            var legalCtrl = new LegalRecoveryController(db);
            AttachUser(legalCtrl, BuildPrincipal(11, "maker", "Accountant", branchId: 1, chargeDate));
            var addRes = await legalCtrl.AddLegalExpense(new AddLegalExpenseDto
            {
                BranchId = 1,
                LoanAccountId = 501,
                ExpenseType = "RECOVERY_EXPENSE",
                Amount = 500m,
                ExpenseDate = chargeDate,
                CapitalizeToLoanPrincipal = true,
                CreditLedgerId = 405,
                PaymentMode = "JOURNAL",
                IsDebitedToBorrower = true,
                PostVoucher = true
            });
            using var doc = SerializeCamelCase(Assert.IsType<OkObjectResult>(addRes).Value);
            int chgVoucherId = doc.RootElement.GetProperty("voucherId").GetInt32();

            var rollback = new VoucherRollbackAndDeleteService(db);
            var postingCtrl = new VoucherPostingController(db, rollback);
            AttachUser(postingCtrl, BuildPrincipal(22, "checker", "Admin", branchId: 1, chargeDate));
            Assert.IsType<OkObjectResult>(await postingCtrl.PostVouchers(new VoucherPostingController.PostVouchersRequest
            {
                VoucherIds = new List<int> { chgVoucherId },
                BusinessDate = chargeDate
            }));

            // Collect ₹800 Principal on 2026-06-15 via LoanCollectionsController
            var colCtrl = new LoanCollectionsController(db, rollback);
            AttachUser(colCtrl, BuildPrincipal(22, "checker", "Admin", branchId: 1, bizDate));
            var colAction = await colCtrl.PostLoanCollection(new LoanCollection
            {
                BranchID = 1,
                LoanAccountID = 501,
                CollectionDate = bizDate,
                TotalAmountReceived = 800m,
                PrincipalCollected = 800m,
                InterestCollected = 0m,
                ReceivableInterestCollected = 0m,
                PenaltyInterestCollected = 0m,
                SurchargeCollected = 0m,
                PaymentMode = "Cash",
                ReceiptNo = "REC-LN-001",
                IsManualInterestOverride = true
            });
            var colObj = colAction.Result is CreatedAtActionResult cRes
                ? (LoanCollection)cRes.Value!
                : (colAction.Result is OkObjectResult okC ? (LoanCollection)okC.Value! : colAction.Value!);

            Assert.Equal(500m, colObj.ChargesPrincipalCollected);
            Assert.Equal(0m, colObj.ExpensesCollected);

            var loanAfterCol = await db.LoanAccounts.AsNoTracking().FirstAsync(l => l.LoanAccountID == 501);
            Assert.Equal(9700m, loanAfterCol.PrincipalBalance);       // 10500 - 800
            Assert.Equal(0m, loanAfterCol.CapitalizedRecoveryCharges); // 500 settled first
            Assert.Equal(9700m, loanAfterCol.PurePrincipalBalance);    // 10000 - 300 pure principal

            // Attempting to Unpass the ₹500 charge voucher while already collected MUST be blocked
            var blockedUnpass = await postingCtrl.UnpassVouchers(new VoucherPostingController.UnpassVouchersRequest
            {
                VoucherIds = new List<int> { chgVoucherId },
                Reason = "Should be blocked after recovery"
            });
            var unpassObj = Assert.IsAssignableFrom<ObjectResult>(blockedUnpass);
            Assert.NotEqual(200, unpassObj.StatusCode);

            // Roll back the LoanCollection voucher (unpass if approved, then delete) -> must restore PrincipalBalance=10500, CapCharges=500, Pure=10000
            var colVoucherId = colObj.VoucherID!.Value;
            var colVoucher = await db.Vouchers.AsNoTracking().FirstAsync(v => v.VoucherID == colVoucherId);
            if (string.Equals(colVoucher.Status, "Approved", StringComparison.OrdinalIgnoreCase))
            {
                Assert.IsType<OkObjectResult>(await postingCtrl.UnpassVouchers(new VoucherPostingController.UnpassVouchersRequest
                {
                    VoucherIds = new List<int> { colVoucherId },
                    Reason = "Unpass collection before rollback"
                }));
            }
            var delResult = await rollback.DeleteVoucherWithRollbackAsync(colVoucherId, new VoucherDeleteRequestContext
            {
                UserId = 22,
                Username = "admin",
                UserRole = "Admin",
                UserBranchId = 1,
                IsHeadOfficeAdmin = true,
                Reason = "Rollback collection before unpassing charge",
                ActionSource = "VOUCHER_DELETED",
                RequireMinTenCharReason = true
            });
            Assert.True(delResult.Success);

            var loanAfterRollback = await db.LoanAccounts.AsNoTracking().FirstAsync(l => l.LoanAccountID == 501);
            Assert.Equal(10500m, loanAfterRollback.PrincipalBalance);
            Assert.Equal(500m, loanAfterRollback.CapitalizedRecoveryCharges);
            Assert.Equal(10000m, loanAfterRollback.PurePrincipalBalance);

            // Now Unpass of charge voucher succeeds -> PrincipalBalance returns to 10000, CapCharges=0
            Assert.IsType<OkObjectResult>(await postingCtrl.UnpassVouchers(new VoucherPostingController.UnpassVouchersRequest
            {
                VoucherIds = new List<int> { chgVoucherId },
                Reason = "Unpass after collection rollback"
            }));
            var loanAfterUnpass = await db.LoanAccounts.AsNoTracking().FirstAsync(l => l.LoanAccountID == 501);
            Assert.Equal(10000m, loanAfterUnpass.PrincipalBalance);
            Assert.Equal(0m, loanAfterUnpass.CapitalizedRecoveryCharges);
            Assert.False((await db.Sec101LegalExpenses.AsNoTracking().SingleAsync(e => e.VoucherId == chgVoucherId)).IsPrincipalApplied);

            // Re-approve directly via VouchersController.ApproveVoucher on chargeDate
            var vouchersCtrl = new VouchersController(db, rollback);
            AttachUser(vouchersCtrl, BuildPrincipal(22, "checker", "Admin", branchId: 1, chargeDate));
            Assert.IsType<OkObjectResult>(await vouchersCtrl.ApproveVoucher(chgVoucherId, new VouchersController.ApprovalDto
            {
                ApprovedBy = 22,
                BusinessDate = chargeDate
            }));
            var loanReapproved = await db.LoanAccounts.AsNoTracking().FirstAsync(l => l.LoanAccountID == 501);
            Assert.Equal(10500m, loanReapproved.PrincipalBalance);
            Assert.Equal(500m, loanReapproved.CapitalizedRecoveryCharges);
        }

        [Fact]
        public async Task ManualVoucherEntry_LoanChargeLink_ValidatesDrOnlyAndBranch_AppliesAndDeletesCleanly()
        {
            await using var db = CreateContext();
            var bizDate = new DateTime(2026, 6, 15);
            await SeedEnvironmentAsync(db, bizDate);

            var rollback = new VoucherRollbackAndDeleteService(db);
            var vouchersCtrl = new VouchersController(db, rollback);
            AttachUser(vouchersCtrl, BuildPrincipal(11, "maker", "Accountant", branchId: 1, bizDate));

            // 1. Cross-branch Loan 502 in Branch 1 voucher -> BadRequest
            var crossBranchRes = await vouchersCtrl.PostVoucher(new Voucher
            {
                BranchID = 1,
                VoucherNo = "JV-CROSS-LN",
                VoucherDate = bizDate,
                VoucherType = "Journal",
                Narration = "आंतर-शाखा वसूली खर्च",
                TotalAmount = 250m,
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { LedgerID = 101, DrCr = "Dr", Amount = 250m, ChargeLoanAccountID = 502, ChargeExpenseType = "RECOVERY_EXPENSE" },
                    new VoucherDetail { LedgerID = 403, DrCr = "Cr", Amount = 250m }
                }
            });
            Assert.IsType<BadRequestObjectResult>(crossBranchRes.Result);

            // 2. Cr side with ChargeLoanAccountID -> BadRequest
            var crSideRes = await vouchersCtrl.PostVoucher(new Voucher
            {
                BranchID = 1,
                VoucherNo = "JV-CR-LN",
                VoucherDate = bizDate,
                VoucherType = "Journal",
                Narration = "जमा चुकीची बाजू",
                TotalAmount = 250m,
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { LedgerID = 403, DrCr = "Dr", Amount = 250m },
                    new VoucherDetail { LedgerID = 101, DrCr = "Cr", Amount = 250m, ChargeLoanAccountID = 501, ChargeExpenseType = "RECOVERY_EXPENSE" }
                }
            });
            Assert.IsType<BadRequestObjectResult>(crSideRes.Result);

            // 3. Valid manual Journal entry: Dr 101 (Loan 501, RECOVERY_EXPENSE) / Cr 403 (इतर उत्पन्न)
            var okSave = await vouchersCtrl.PostVoucher(new Voucher
            {
                BranchID = 1,
                VoucherNo = "JV-MAN-CHG-01",
                VoucherDate = bizDate,
                VoucherType = "Journal",
                Narration = "थकबाकी वसूली खर्च नावे",
                TotalAmount = 350m,
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { LedgerID = 101, DrCr = "Dr", Amount = 350m, ChargeLoanAccountID = 501, ChargeExpenseType = "RECOVERY_EXPENSE" },
                    new VoucherDetail { LedgerID = 403, DrCr = "Cr", Amount = 350m }
                }
            });
            var voucher = Assert.IsType<Voucher>(Assert.IsType<CreatedAtActionResult>(okSave.Result).Value);
            Assert.Equal("Pending", voucher.Status);
            Assert.Equal(10000m, (await db.LoanAccounts.AsNoTracking().FirstAsync(l => l.LoanAccountID == 501)).PrincipalBalance);

            // Linked Sec101LegalExpense synced as Pending (!IsPrincipalApplied)
            var syncedExp = await db.Sec101LegalExpenses.AsNoTracking().SingleAsync(e => e.VoucherId == voucher.VoucherID);
            Assert.True(syncedExp.CapitalizeToLoanPrincipal);
            Assert.False(syncedExp.IsPrincipalApplied);

            // Approve via VouchersController.ApproveVoucher
            AttachUser(vouchersCtrl, BuildPrincipal(22, "checker", "Admin", branchId: 1, bizDate));
            Assert.IsType<OkObjectResult>(await vouchersCtrl.ApproveVoucher(voucher.VoucherID, new VouchersController.ApprovalDto
            {
                ApprovedBy = 22,
                BusinessDate = bizDate
            }));

            var loanApproved = await db.LoanAccounts.AsNoTracking().FirstAsync(l => l.LoanAccountID == 501);
            Assert.Equal(10350m, loanApproved.PrincipalBalance);
            Assert.Equal(350m, loanApproved.CapitalizedRecoveryCharges);

            // Direct delete while Approved must be rejected by Maker-Checker rollback policy
            var delApprovedRes = await rollback.DeleteVoucherWithRollbackAsync(voucher.VoucherID, new VoucherDeleteRequestContext
            {
                UserId = 22,
                Username = "admin",
                UserRole = "Admin",
                UserBranchId = 1,
                IsHeadOfficeAdmin = true,
                Reason = "Attempt direct delete on approved voucher",
                ActionSource = "VOUCHER_DELETED",
                RequireMinTenCharReason = true
            });
            Assert.False(delApprovedRes.Success);

            // Unpass reverses PrincipalBalance & CapitalizedRecoveryCharges cleanly
            var postingCtrl = new VoucherPostingController(db, rollback);
            AttachUser(postingCtrl, BuildPrincipal(22, "checker", "Admin", branchId: 1, bizDate));
            Assert.IsType<OkObjectResult>(await postingCtrl.UnpassVouchers(new VoucherPostingController.UnpassVouchersRequest
            {
                VoucherIds = new List<int> { voucher.VoucherID },
                Reason = "Unpass manual recovery charge voucher"
            }));

            var loanUnpassed = await db.LoanAccounts.AsNoTracking().FirstAsync(l => l.LoanAccountID == 501);
            Assert.Equal(10000m, loanUnpassed.PrincipalBalance);
            Assert.Equal(0m, loanUnpassed.CapitalizedRecoveryCharges);

            // Delete via VoucherRollbackAndDeleteService -> removes Sec101LegalExpense & Voucher cleanly
            var delRes = await rollback.DeleteVoucherWithRollbackAsync(voucher.VoucherID, new VoucherDeleteRequestContext
            {
                UserId = 22,
                Username = "admin",
                UserRole = "Admin",
                UserBranchId = 1,
                IsHeadOfficeAdmin = true,
                Reason = "Delete manual recovery charge voucher",
                ActionSource = "VOUCHER_DELETED",
                RequireMinTenCharReason = true
            });
            Assert.True(delRes.Success);

            var loanDeleted = await db.LoanAccounts.AsNoTracking().FirstAsync(l => l.LoanAccountID == 501);
            Assert.Equal(10000m, loanDeleted.PrincipalBalance);
            Assert.Equal(0m, loanDeleted.CapitalizedRecoveryCharges);
            Assert.Empty(db.Sec101LegalExpenses.Where(e => e.VoucherId == voucher.VoucherID));
        }

        [Fact]
        public async Task NonPrincipalOverdueRecoveryLedger_SurfacedInAccountDetails_AndCollectedWithoutAllocationMismatch()
        {
            await using var db = CreateContext();
            var bizDate = new DateTime(2026, 6, 15);
            await SeedEnvironmentAsync(db, bizDate);

            db.LegalRecoveryLedgerMappings.Add(new LegalRecoveryLedgerMapping
            {
                BranchId = 1,
                TransactionType = "NOTICE_FEE",
                DebitLedgerId = 104,
                CreditLedgerId = 403,
                IsActive = true
            });
            await db.SaveChangesAsync();

            var legalCtrl = new LegalRecoveryController(db);
            AttachUser(legalCtrl, BuildPrincipal(11, "maker", "Accountant", branchId: 1, bizDate));
            var addRes = await legalCtrl.AddLegalExpense(new AddLegalExpenseDto
            {
                BranchId = 1,
                LoanAccountId = 501,
                ExpenseType = "NOTICE_FEE",
                Amount = 300m,
                ExpenseDate = bizDate,
                CapitalizeToLoanPrincipal = false, // Legacy separate OverdueRecoveryLedger path
                PaymentMode = "CASH",
                IsDebitedToBorrower = true,
                PostVoucher = true
            });
            using var doc = SerializeCamelCase(Assert.IsType<OkObjectResult>(addRes).Value);
            int legVoucherId = doc.RootElement.GetProperty("voucherId").GetInt32();

            var rollback = new VoucherRollbackAndDeleteService(db);
            var postingCtrl = new VoucherPostingController(db, rollback);
            AttachUser(postingCtrl, BuildPrincipal(22, "checker", "Admin", branchId: 1, bizDate));
            Assert.IsType<OkObjectResult>(await postingCtrl.PostVouchers(new VoucherPostingController.PostVouchersRequest
            {
                VoucherIds = new List<int> { legVoucherId },
                BusinessDate = bizDate
            }));

            // Check AccountDetailsAndSchedule surfaces UnpaidRecoveryExpenses = 300 while Principal stays 10000
            var loanAccCtrl = new LoanAccountsController(db);
            AttachUser(loanAccCtrl, BuildPrincipal(22, "checker", "Admin", branchId: 1, bizDate));
            var accDetails = (await loanAccCtrl.GetAccountDetailsAndSchedule(501, bizDate)).Value!;
            Assert.Equal(300m, accDetails.UnpaidRecoveryExpenses);
            Assert.Equal(0m, accDetails.CapitalizedRecoveryCharges);
            Assert.Equal(10000m, accDetails.CurrentPrincipalBalance);

            // Collect ₹1000 (300 goes to OverdueRecoveryLedger + 700 goes to Principal) -> 0 allocation mismatch!
            var colCtrl = new LoanCollectionsController(db, rollback);
            AttachUser(colCtrl, BuildPrincipal(22, "checker", "Admin", branchId: 1, bizDate));
            var colAction = await colCtrl.PostLoanCollection(new LoanCollection
            {
                BranchID = 1,
                LoanAccountID = 501,
                CollectionDate = bizDate,
                TotalAmountReceived = 1000m,
                PrincipalCollected = 700m,
                InterestCollected = 0m,
                ReceivableInterestCollected = 0m,
                PenaltyInterestCollected = 0m,
                SurchargeCollected = 0m,
                PaymentMode = "Cash",
                ReceiptNo = "REC-LN-EXP-01",
                IsManualInterestOverride = true
            });
            var colObj = colAction.Result is CreatedAtActionResult cRes
                ? (LoanCollection)cRes.Value!
                : (colAction.Result is OkObjectResult okC ? (LoanCollection)okC.Value! : colAction.Value!);

            Assert.Equal(300m, colObj.ExpensesCollected);
            Assert.Equal(700m, colObj.PrincipalCollected);
            Assert.Equal(0m, (await loanAccCtrl.GetAccountDetailsAndSchedule(501, bizDate)).Value!.UnpaidRecoveryExpenses);
            Assert.Equal(9300m, (await db.LoanAccounts.AsNoTracking().FirstAsync(l => l.LoanAccountID == 501)).PrincipalBalance);
        }
    }
}
