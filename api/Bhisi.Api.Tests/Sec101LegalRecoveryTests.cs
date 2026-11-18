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
using Xunit;

namespace Bhisi.Api.Tests
{
    public class Sec101LegalRecoveryTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"BhisiSec101_{Guid.NewGuid()}")
                .ConfigureWarnings(x => x.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ClaimsPrincipal BuildPrincipal(int userId, string username, string role, int branchId, DateTime? bizDate = null)
        {
            var dt = (bizDate ?? new DateTime(2026, 11, 15)).ToString("yyyy-MM-dd");
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Name, username),
                new Claim(ClaimTypes.Role, role),
                new Claim("BranchID", branchId.ToString()),
                new Claim("DefaultBranchID", branchId.ToString()),
                new Claim("BusinessDate", dt)
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

        private static JsonElement ParseJson(IActionResult actionResult)
        {
            var ok = Assert.IsType<OkObjectResult>(actionResult);
            var opts = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
            return JsonDocument.Parse(JsonSerializer.Serialize(ok.Value, opts)).RootElement;
        }

        private static async Task<(Customer borrower, LoanAccount loanBranch1, LoanAccount loanBranch2)> SeedCoreDataAsync(
            AppDbContext db,
            DateTime bizDate,
            bool seedLegalMappings = true)
        {
            db.SansthaDetails.Add(new SansthaDetail
            {
                SansthaID = 1,
                SansthaName = "स्मार्ट नागरी सहकारी पतसंस्था",
                Address = "पुणे",
                RegistrationNo = "REG/101"
            });

            db.Branches.AddRange(
                new Branch { BranchID = 1, BranchCode = "001", BranchName = "मुख्य शाखा", IsActive = true },
                new Branch { BranchID = 2, BranchCode = "002", BranchName = "बारामती शाखा", IsActive = true }
            );

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
                new AccountGroup { GroupID = 1, GroupName = "रोख व बँक", NatureOfGroup = "Assets", IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "कर्ज येणे", NatureOfGroup = "Assets", IsActive = true },
                new AccountGroup { GroupID = 3, GroupName = "उत्पन्न", NatureOfGroup = "Income", IsActive = true },
                new AccountGroup { GroupID = 4, GroupName = "खर्च", NatureOfGroup = "Expenses", IsActive = true },
                new AccountGroup { GroupID = 5, GroupName = "देय रकमा", NatureOfGroup = "Liabilities", IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 1, GroupID = 1, LedgerCode = "CASH-1", LedgerName = "रोख खाते", AccountType = "Cash", IsActive = true },
                new Ledger { LedgerID = 2, GroupID = 2, LedgerCode = "LOAN-PRIN", LedgerName = "साधारण कर्ज मुद्दल", AccountType = "Loan", IsActive = true },
                new Ledger { LedgerID = 3, GroupID = 2, LedgerCode = "LOAN-RECINT", LedgerName = "येणे कर्ज व्याज", AccountType = "Loan Interest", IsActive = true },
                new Ledger { LedgerID = 4, GroupID = 3, LedgerCode = "LOAN-PENAL", LedgerName = "दंडव्याज उत्पन्न", AccountType = "Interest Income", IsActive = true },
                new Ledger { LedgerID = 5, GroupID = 2, LedgerCode = "LEG-REC", LedgerName = "येणे कायदेशीर खर्च", AccountType = "Receivable", IsActive = true },
                new Ledger { LedgerID = 6, GroupID = 3, LedgerCode = "NOTICE-INC", LedgerName = "नोटीस फी उत्पन्न", AccountType = "Income", IsActive = true },
                new Ledger { LedgerID = 7, GroupID = 4, LedgerCode = "COURT-EXP", LedgerName = "कोर्ट व कायदेशीर खर्च", AccountType = "Expense", IsActive = true },
                new Ledger { LedgerID = 8, GroupID = 5, LedgerCode = "SURPLUS-PAY", LedgerName = "लिलाव अतिरिक्त देय", AccountType = "Payable", IsActive = true }
            );

            db.LoanRates.Add(new LoanRate
            {
                LoanRateID = 1,
                LoanType = "वैयक्तिक कर्ज",
                InterestRate = 14.00m,
                OverdueInterestRate = 2.00m,
                LoanLedgerID = 2,
                InterestLedgerID = 3,
                ReceivableInterestLedgerID = 3,
                OverdueInterestLedgerID = 4,
                IsActive = true
            });

            if (seedLegalMappings)
            {
                db.LegalRecoveryLedgerMappings.AddRange(
                    new LegalRecoveryLedgerMapping { BranchId = null, TransactionType = "NOTICE_FEE", DebitLedgerId = 5, CreditLedgerId = 6, IsActive = true },
                    new LegalRecoveryLedgerMapping { BranchId = 1, TransactionType = "COURT_FEE", DebitLedgerId = 5, CreditLedgerId = 1, IsActive = true },
                    new LegalRecoveryLedgerMapping { BranchId = 1, TransactionType = "ADVOCATE_FEE", DebitLedgerId = 5, CreditLedgerId = 1, IsActive = true },
                    new LegalRecoveryLedgerMapping { BranchId = null, TransactionType = "OTHER_LEGAL", DebitLedgerId = 5, CreditLedgerId = 1, IsActive = true },
                    new LegalRecoveryLedgerMapping { BranchId = null, TransactionType = "BORROWER_SURPLUS_PAYABLE", DebitLedgerId = 1, CreditLedgerId = 8, IsActive = true }
                );
            }

            var borrower = new Customer
            {
                CustomerID = 10,
                BranchID = 1,
                CIFNo = "CIF00010",
                LegacyCustomerNo = "OLD-10",
                FirstName = "रमेश",
                LastName = "कुलकर्णी",
                Address = "कोथरूड, पुणे",
                MobileNo = "9876543210",
                BirthDate = new DateTime(1982, 5, 10)
            };
            var g1 = new Customer
            {
                CustomerID = 11,
                BranchID = 1,
                CIFNo = "CIF00011",
                FirstName = "सुरेश",
                LastName = "देशमुख",
                Address = "वारजे, पुणे",
                MobileNo = "9876500001",
                BirthDate = new DateTime(1980, 3, 12)
            };
            var b2Cust = new Customer
            {
                CustomerID = 20,
                BranchID = 2,
                CIFNo = "CIF00020",
                FirstName = "महेश",
                LastName = "जाधव",
                Address = "बारामती",
                MobileNo = "9876500002",
                BirthDate = new DateTime(1979, 8, 1)
            };
            db.Customers.AddRange(borrower, g1, b2Cust);

            // Customer-First Loan: MemberID is explicitly null!
            var loan1 = new LoanAccount
            {
                LoanAccountID = 101,
                BranchID = 1,
                CustomerID = 10,
                MemberID = null,
                Guarantor1CustomerID = 11,
                LoanRateID = 1,
                LoanAccountNo = "001-LN-101",
                LegacyAccountNumber = "L-101",
                SanctionedAmount = 100000m,
                PrincipalBalance = 50000m,
                PurePrincipalBalance = 50000m,
                InterestBalance = 4000m,
                OverdueInterestBalance = 1000m,
                InterestRate = 14.00m,
                OpeningDate = bizDate.AddYears(-2),
                MaturityDate = bizDate.AddMonths(-3),
                Status = "Active"
            };

            var loan2 = new LoanAccount
            {
                LoanAccountID = 201,
                BranchID = 2,
                CustomerID = 20,
                MemberID = null,
                LoanRateID = 1,
                LoanAccountNo = "002-LN-201",
                SanctionedAmount = 75000m,
                PrincipalBalance = 75000m,
                InterestBalance = 2000m,
                OverdueInterestBalance = 500m,
                InterestRate = 14.00m,
                OpeningDate = bizDate.AddYears(-1),
                Status = "Active"
            };

            db.LoanAccounts.AddRange(loan1, loan2);
            await db.SaveChangesAsync();
            return (borrower, loan1, loan2);
        }

        [Fact]
        public async Task GenerateNotice_CustomerFirstWithoutMember_CreatesGuarantorCopyAndCustomerIdLink()
        {
            using var db = CreateContext();
            var bizDate = new DateTime(2026, 11, 15);
            await SeedCoreDataAsync(db, bizDate);

            var ctrl = new LegalRecoveryController(db);
            AttachUser(ctrl, BuildPrincipal(5, "clerk1", "Clerk", 1, bizDate));

            var res = await ctrl.GenerateNotice(new GenerateNoticeDto
            {
                BranchId = 1,
                LoanAccountId = 101,
                CaseType = "SEC_101",
                NoticeType = "FINAL_NOTICE",
                NoticeDate = bizDate,
                PrincipalDue = 50000m,
                InterestDue = 4000m,
                PenalInterestDue = 1000m,
                NoticeFee = 150m,
                PaymentMode = "CASH",
                GuarantorNoticeRecipients = new List<string> { "GUARANTOR_1" }
            });

            var json = ParseJson(res);
            Assert.NotNull(json.GetProperty("noticeNumber").GetString());

            var savedNotices = await db.Sec101NoticeHistories.ToListAsync();
            Assert.Equal(2, savedNotices.Count);
            Assert.All(savedNotices, n =>
            {
                Assert.Null(n.MemberId);
                Assert.Equal(10, n.CustomerId);
            });
            Assert.Contains(savedNotices, n => n.RecipientType == "BORROWER" && n.NoticeFee == 150m);
            Assert.Contains(savedNotices, n => n.RecipientType == "GUARANTOR_1" && n.RecipientCustomerId == 11 && n.NoticeFee == 0m);
        }

        [Fact]
        public async Task CrossBranchAccess_NonHoUserIsBlockedWith403()
        {
            using var db = CreateContext();
            var bizDate = new DateTime(2026, 11, 15);
            await SeedCoreDataAsync(db, bizDate);

            var ctrl = new LegalRecoveryController(db);
            AttachUser(ctrl, BuildPrincipal(5, "bm1", "BranchManager", 1, bizDate));

            var noticeRes = await ctrl.GenerateNotice(new GenerateNoticeDto
            {
                BranchId = 2,
                LoanAccountId = 201,
                NoticeType = "NOTICE_1",
                NoticeDate = bizDate,
                PrincipalDue = 75000m
            });
            var obj1 = Assert.IsType<ObjectResult>(noticeRes);
            Assert.Equal(403, obj1.StatusCode);

            var trackerRes = await ctrl.GetCustomerLegalTracker(customerId: 20, branchId: 2);
            var obj2 = Assert.IsType<ObjectResult>(trackerRes);
            Assert.Equal(403, obj2.StatusCode);

            var mapCtrl = new LegalRecoveryMappingController(db);
            AttachUser(mapCtrl, BuildPrincipal(6, "clerk1", "Clerk", 1, bizDate));
            var mapRes = await mapCtrl.BulkSaveMappings(new List<LegalRecoveryLedgerMapping>
            {
                new LegalRecoveryLedgerMapping { BranchId = 1, TransactionType = "COURT_FEE", DebitLedgerId = 5, CreditLedgerId = 1 }
            });
            var obj3 = Assert.IsType<ObjectResult>(mapRes);
            Assert.Equal(403, obj3.StatusCode);
        }

        [Fact]
        public async Task LegalExpense_ZeroFallback_MakerCheckerApprovalAndRollbackSync()
        {
            using var db = CreateContext();
            var bizDate = new DateTime(2026, 11, 15);
            await SeedCoreDataAsync(db, bizDate, seedLegalMappings: false);

            var legalCtrl = new LegalRecoveryController(db);
            AttachUser(legalCtrl, BuildPrincipal(7, "maker_clerk", "Clerk", 1, bizDate));

            // 1. Missing mapping MUST reject (Zero-Fallback!)
            var missingRes = await legalCtrl.AddLegalExpense(new AddLegalExpenseDto
            {
                BranchId = 1,
                LoanAccountId = 101,
                ExpenseType = "ADVOCATE_FEE",
                ExpenseDate = bizDate,
                Amount = 1200m,
                PaymentMode = "CASH",
                IsDebitedToBorrower = true
            });
            Assert.IsType<BadRequestObjectResult>(missingRes);

            // Seed mapping and retry
            db.LegalRecoveryLedgerMappings.Add(new LegalRecoveryLedgerMapping
            {
                BranchId = 1,
                TransactionType = "ADVOCATE_FEE",
                DebitLedgerId = 5,
                CreditLedgerId = 1,
                IsActive = true
            });
            await db.SaveChangesAsync();

            var addRes = await legalCtrl.AddLegalExpense(new AddLegalExpenseDto
            {
                BranchId = 1,
                LoanAccountId = 101,
                ExpenseType = "ADVOCATE_FEE",
                ExpenseDate = bizDate,
                Amount = 1200m,
                PaidTo = "Adv. Deshmukh",
                PaymentMode = "CASH",
                IsDebitedToBorrower = true
            });
            var addJson = ParseJson(addRes);
            int voucherId = addJson.GetProperty("voucherId").GetInt32();

            var pendingVoucher = await db.Vouchers.FindAsync(voucherId);
            Assert.NotNull(pendingVoucher);
            Assert.Equal("Pending", pendingVoucher!.Status);
            Assert.Equal(7, pendingVoucher.CreatedBy); // Maker ID captured!

            // OverdueRecoveryLedger must NOT be debited before checker approval!
            Assert.Empty(await db.OverdueRecoveryLedgers.Where(o => o.LoanAccountID == 101).ToListAsync());

            // 2. Checker Posts/Approves Voucher -> OverdueRecoveryLedger debited atomically
            var rollbackService = new VoucherRollbackAndDeleteService(db);
            var postingCtrl = new VoucherPostingController(db, rollbackService);
            AttachUser(postingCtrl, BuildPrincipal(9, "checker_bm", "BranchManager", 1, bizDate));

            var postRes = await postingCtrl.PostVouchers(new VoucherPostingController.PostVouchersRequest
            {
                VoucherIds = new List<int> { voucherId },
                ApprovedBy = 9,
                BusinessDate = bizDate
            });
            Assert.IsType<OkObjectResult>(postRes);

            var approvedVoucher = await db.Vouchers.FindAsync(voucherId);
            Assert.Equal("Approved", approvedVoucher!.Status);
            var overdueRows = await db.OverdueRecoveryLedgers.Where(o => o.LoanAccountID == 101 && o.VoucherID == voucherId).ToListAsync();
            Assert.Single(overdueRows);
            Assert.Equal(1200m, overdueRows[0].DebitAmount);

            // 3. Unpass reverts OverdueRecoveryLedger & Voucher to Pending
            var unpassRes = await postingCtrl.UnpassVouchers(new VoucherPostingController.UnpassVouchersRequest
            {
                VoucherIds = new List<int> { voucherId },
                Reason = "Correction needed",
                UnpassedBy = 9
            });
            Assert.IsType<OkObjectResult>(unpassRes);
            Assert.Equal("Pending", (await db.Vouchers.FindAsync(voucherId))!.Status);
            Assert.Empty(await db.OverdueRecoveryLedgers.Where(o => o.VoucherID == voucherId).ToListAsync());

            // 4. Delete Pending Voucher removes Sec101LegalExpense & Voucher completely
            var delRes = await postingCtrl.RejectVoucher(voucherId, new VoucherPostingController.VoucherRejectDto { Reason = "Delete test" });
            Assert.IsType<OkObjectResult>(delRes);
            Assert.Null(await db.Vouchers.FindAsync(voucherId));
            Assert.Empty(await db.Sec101LegalExpenses.Where(e => e.VoucherId == voucherId).ToListAsync());
        }

        [Fact]
        public async Task Sec91_Rule107Lifecycle_SettlementWithSurplus_AndVoucherRollbackReopensLoanAndCase()
        {
            using var db = CreateContext();
            var bizDate = new DateTime(2026, 11, 15);
            await SeedCoreDataAsync(db, bizDate);

            var ctrl = new LegalRecoveryController(db);
            AttachUser(ctrl, BuildPrincipal(1, "ho_admin", "Admin", 1, bizDate));

            // Notice finalized 20 days ago
            db.Sec101NoticeHistories.Add(new Sec101NoticeHistory
            {
                BranchId = 1,
                LoanAccountId = 101,
                CustomerId = 10,
                CaseType = "SEC_91",
                NoticeType = "FINAL_NOTICE",
                NoticeNumber = "NOT/2026/001",
                NoticeDate = bizDate.AddDays(-20),
                DueDate = bizDate.AddDays(-5),
                PrincipalDue = 50000m,
                InterestDue = 4000m,
                PenalInterestDue = 1000m,
                TotalDemandAmount = 55000m,
                CreatedBy = 1
            });
            await db.SaveChangesAsync();

            // 1. File SEC_91 Case
            var fileRes = await ctrl.FileCase(new FileCaseDto
            {
                BranchId = 1,
                LoanAccountId = 101,
                CaseType = "SEC_91",
                CaseNumber = "91/2026/001",
                CourtName = "सहकारी न्यायालय, पुणे",
                FilingDate = bizDate,
                PrincipalClaim = 50000m,
                InterestClaim = 4000m,
                PenalInterestClaim = 1000m,
                CourtFeeAmount = 500m,
                PaymentMode = "CASH"
            });
            var fileJson = ParseJson(fileRes);
            int caseId = fileJson.GetProperty("caseId").GetInt32();

            // 2. Grant Sec 91 Award
            var certRes = await ctrl.GrantCertificate(new GrantCertificateDto
            {
                CaseId = caseId,
                AwardNumber = "AWD-91-2026",
                AwardDate = bizDate,
                SanctionedAmount = 55000m,
                FutureInterestRate = 14.0m
            });
            Assert.IsType<OkObjectResult>(certRes);
            Assert.Equal("AWARDED", (await db.Sec101CaseMasters.FindAsync(caseId))!.Status);

            // 3. Create Rule 107 Execution
            var execRes = await ctrl.CreateExecution(new CreateExecutionDto
            {
                CaseId = caseId,
                ExecutionType = "IMMOVABLE_PROPERTY",
                PropertyDetails = "सर्व्हे नं. ४५, प्लॉट २",
                EstimatedValue = 200000m,
                ReservePrice = 150000m,
                WarrantIssueDate = bizDate
            });
            var execJson = ParseJson(execRes);
            int execId = execJson.GetProperty("executionId").GetInt32();

            // Reject < 30 days auction gap per Rule 107(11)(e)
            var badStage = await ctrl.UpdateExecutionStage(execId, new UpdateExecutionStageDto
            {
                Status = "AUCTION_SCHEDULED",
                AuctionNoticeDate = bizDate,
                AuctionDate = bizDate.AddDays(10)
            });
            Assert.IsType<BadRequestObjectResult>(badStage);

            // Valid >= 30 days auction schedule
            var goodStage = await ctrl.UpdateExecutionStage(execId, new UpdateExecutionStageDto
            {
                Status = "AUCTION_SCHEDULED",
                AuctionNoticeDate = bizDate,
                AuctionDate = bizDate.AddDays(31)
            });
            Assert.IsType<OkObjectResult>(goodStage);

            // 4. Atomic Rule 107 Auction Settlement (Total Dues = 50000+4000+1000 = 55000; Bid = 60000 => Surplus = 5000!)
            var settleRes = await ctrl.SettleExecution(execId, new SettleExecutionDto
            {
                RecoveredAmount = 60000m,
                SettlementDate = bizDate,
                PaymentMode = "CASH"
            });
            var settleJson = ParseJson(settleRes);
            int settleVoucherId = settleJson.GetProperty("voucherId").GetInt32();
            Assert.Equal(5000m, settleJson.GetProperty("surplusAmount").GetDecimal());

            var closedLoan = await db.LoanAccounts.FindAsync(101);
            Assert.Equal("Closed", closedLoan!.Status);
            Assert.Equal(0m, closedLoan.PrincipalBalance);

            var closedCase = await db.Sec101CaseMasters.FindAsync(caseId);
            Assert.Equal("CLOSED_RECOVERED", closedCase!.Status);

            // 5. Rollback / Delete Rule 107 Settlement Voucher -> Must reopen Loan & Case & Execution!
            var rollbackService = new VoucherRollbackAndDeleteService(db);
            var delRes = await rollbackService.DeleteVoucherWithRollbackAsync(settleVoucherId, new VoucherDeleteRequestContext
            {
                UserId = 1,
                Username = "ho_admin",
                UserRole = "Admin",
                UserBranchId = 1,
                IsHeadOfficeAdmin = true,
                Reason = "Test rollback"
            });
            Assert.True(delRes.Success, delRes.Message);

            var reopenedLoan = await db.LoanAccounts.FindAsync(101);
            Assert.Equal("Active", reopenedLoan!.Status);
            Assert.Equal(50000m, reopenedLoan.PrincipalBalance);

            var reopenedCase = await db.Sec101CaseMasters.FindAsync(caseId);
            Assert.Equal("EXECUTION_RULE107", reopenedCase!.Status);

            var reopenedExec = await db.Sec101AttachmentAuctions.FindAsync(execId);
            Assert.Null(reopenedExec!.SettlementVoucherId);
            Assert.Equal("AUCTION_COMPLETED", reopenedExec.Status);
        }

        [Fact]
        public async Task CustomerLegalTracker_ReturnsEightStageProgressAndTimeline()
        {
            using var db = CreateContext();
            var bizDate = new DateTime(2026, 11, 15);
            await SeedCoreDataAsync(db, bizDate);

            db.Sec101NoticeHistories.Add(new Sec101NoticeHistory
            {
                BranchId = 1,
                LoanAccountId = 101,
                CustomerId = 10,
                NoticeType = "FINAL_NOTICE",
                NoticeNumber = "NOT/101/01",
                NoticeDate = bizDate.AddDays(-20),
                DueDate = bizDate.AddDays(-5),
                PrincipalDue = 50000m,
                TotalDemandAmount = 50000m
            });
            var secCase = new Sec101CaseMaster
            {
                BranchId = 1,
                LoanAccountId = 101,
                CustomerId = 10,
                CaseType = "SEC_101",
                CaseNumber = "101/2026/001",
                FilingDate = bizDate.AddDays(-2),
                TotalClaimAmount = 55000m,
                Status = "FILED"
            };
            db.Sec101CaseMasters.Add(secCase);
            await db.SaveChangesAsync();

            var ctrl = new LegalRecoveryController(db);
            AttachUser(ctrl, BuildPrincipal(1, "ho_admin", "Admin", 1, bizDate));

            var trackerRes = await ctrl.GetCustomerLegalTracker(customerId: 10);
            var json = ParseJson(trackerRes);

            Assert.Equal("CIF00010", json.GetProperty("customer").GetProperty("cifNo").GetString());
            Assert.Equal(1, json.GetProperty("summary").GetProperty("totalLoans").GetInt32());
            Assert.Equal(1, json.GetProperty("summary").GetProperty("activeCases").GetInt32());

            var loans = json.GetProperty("loans");
            Assert.Equal(1, loans.GetArrayLength());
            var loan0 = loans[0];
            Assert.Equal(8, loan0.GetProperty("stages").GetArrayLength());
            Assert.True(loan0.GetProperty("timeline").GetArrayLength() >= 2);
            Assert.Equal("hearings", loan0.GetProperty("nextActionTab").GetString());
        }

        [Fact]
        public async Task EligibleLoansAndPreview_WhenInterestBalanceIsZero_ComputesAccruedRegularInterestAndFullDetails()
        {
            using var db = CreateContext();
            var bizDate = new DateTime(2026, 6, 30);
            await SeedCoreDataAsync(db, bizDate);

            // Create Daily Reducing loan with InterestBalance = 0, LastInstallmentPaidDate = 2026-03-31 (91 days to 2026-06-30)
            db.LoanRates.Add(new LoanRate
            {
                LoanRateID = 2,
                LoanType = "तारणी (3)",
                InterestRate = 12.00m,
                OverdueInterestRate = 2.00m,
                InterestCalculationMethod = "Daily Reducing",
                SecurityType = "तारणी",
                LoanLedgerID = 2,
                InterestLedgerID = 3,
                IsActive = true
            });

            db.LoanAccounts.Add(new LoanAccount
            {
                LoanAccountID = 105,
                BranchID = 1,
                CustomerID = 10,
                MemberID = null,
                LoanRateID = 2,
                LoanAccountNo = "001-203-0000456-7",
                SanctionedAmount = 2000000m,
                PrincipalBalance = 1800000m,
                PurePrincipalBalance = 1800000m,
                InterestBalance = 0m,
                OverdueInterestBalance = 0m,
                InterestRate = 12.00m,
                DurationMonths = 36,
                InstallmentAmount = 55000m,
                NoOfInstallments = 36,
                OpeningDate = new DateTime(2025, 4, 1),
                LoanDisbursementDate = new DateTime(2025, 4, 1),
                LastInstallmentPaidDate = new DateTime(2026, 3, 31),
                MaturityDate = new DateTime(2028, 3, 31),
                SecurityDetails = "जमीन गट क्र. ४५ गहाण",
                Status = "Active"
            });

            db.LoanInstallmentSchedules.Add(new LoanInstallmentSchedule
            {
                LoanAccountID = 105,
                InstallmentNo = 13,
                DueDate = new DateTime(2026, 4, 30),
                PrincipalAmount = 50000m,
                InterestAmount = 18000m,
                TotalAmount = 68000m,
                BalanceAmount = 68000m,
                Status = "Overdue"
            });
            await db.SaveChangesAsync();

            var ctrl = new LegalRecoveryController(db);
            AttachUser(ctrl, BuildPrincipal(1, "ho_admin", "Admin", 1, bizDate));

            var eligRes = await ctrl.GetEligibleOverdueLoans(branchId: 1, asOnDate: bizDate);
            var eligJson = ParseJson(eligRes);
            var targetLoan = eligJson.EnumerateArray().First(x => x.GetProperty("loanAccountID").GetInt32() == 105);

            // 1800000 * 12% * 91 days / 36500 = 53852
            Assert.Equal(53852m, targetLoan.GetProperty("accruedRegularInterest").GetDecimal());
            Assert.Equal(53852m, targetLoan.GetProperty("totalRegularInterestDue").GetDecimal());
            Assert.Equal(91, targetLoan.GetProperty("interestDays").GetInt32());
            Assert.Equal(2000000m, targetLoan.GetProperty("sanctionedAmount").GetDecimal());
            Assert.Equal(55000m, targetLoan.GetProperty("installmentAmount").GetDecimal());
            Assert.Equal(1, targetLoan.GetProperty("overdueInstallmentsCount").GetInt32());
            Assert.Equal(61, targetLoan.GetProperty("overdueDays").GetInt32());
            Assert.True(targetLoan.GetProperty("estimatedPenalInterest").GetDecimal() > 0m);
            Assert.Equal("जमीन गट क्र. ४५ गहाण", targetLoan.GetProperty("securityDetails").GetString());

            // Date-change preview for 10 days later (+10 days = 101 days): 1800000 * 12 * 101 / 36500 = 59770
            var previewRes = await ctrl.GetLoanDuesPreview(105, new DateTime(2026, 7, 10));
            var previewJson = ParseJson(previewRes);
            Assert.Equal(101, previewJson.GetProperty("interestDays").GetInt32());
            Assert.Equal(59770m, previewJson.GetProperty("totalRegularInterestDue").GetDecimal());

            // Form M consistency check
            var formMRes = await ctrl.GetFormMData(105, bizDate);
            var formMJson = ParseJson(formMRes);
            Assert.Equal(53852m, formMJson.GetProperty("loanDetails").GetProperty("interestBalance").GetDecimal());
            Assert.Equal(53852m, formMJson.GetProperty("loanDetails").GetProperty("accruedRegularInterest").GetDecimal());
        }

        [Fact]
        public async Task EligibleLoansAndPreview_OpeningBalanceWithZeroAccountMetadata_ResolvesRateDurationDisbursementAndSanctionedFallback()
        {
            using var db = CreateContext();
            var bizDate = new DateTime(2026, 11, 17);
            await SeedCoreDataAsync(db, bizDate);

            db.LoanRates.Add(new LoanRate
            {
                LoanRateID = 5,
                LoanType = "सोने तारण",
                InterestRate = 11.50m,
                OverdueInterestRate = 2.00m,
                InterestCalculationMethod = "Daily Reducing",
                SecurityType = "सोने तारण",
                DurationMonths = 12,
                LoanLedgerID = 2,
                InterestLedgerID = 3,
                IsActive = true
            });

            // Simulate Opening Balance migrated account where LoanAccount.SanctionedAmount = 0, InterestRate = 0, DurationMonths = 0, MaturityDate = null
            db.LoanAccounts.Add(new LoanAccount
            {
                LoanAccountID = 205,
                BranchID = 1,
                CustomerID = 10,
                LoanRateID = 5,
                LoanAccountNo = "001-205-0000149-6",
                SanctionedAmount = 0m,
                PrincipalBalance = 145734m,
                PurePrincipalBalance = 145734m,
                InterestBalance = 0m,
                OverdueInterestBalance = 0m,
                InterestRate = 0m,
                DurationMonths = 0,
                InstallmentAmount = 0m,
                OpeningDate = new DateTime(2026, 3, 31),
                LoanDisbursementDate = null,
                MaturityDate = null,
                IsOpeningBalance = true,
                Status = "Active"
            });

            db.LoanAccountNpaStatuses.Add(new LoanAccountNpaStatus
            {
                LoanAccountNpaStatusID = 205,
                LoanAccountID = 205,
                AsOfDate = new DateTime(2026, 11, 17),
                Category = "SubStandard"
            });

            await db.SaveChangesAsync();

            var ctrl = new LegalRecoveryController(db);
            AttachUser(ctrl, BuildPrincipal(1, "ho_admin", "Admin", 1, bizDate));

            var eligRes = await ctrl.GetEligibleOverdueLoans(branchId: 1, asOnDate: bizDate);
            var eligJson = ParseJson(eligRes);
            var targetLoan = eligJson.EnumerateArray().First(x => x.GetProperty("loanAccountID").GetInt32() == 205);

            // Fallback resolution: SanctionedAmount -> PrincipalBalance (145734), Rate -> Scheme InterestRate (11.5%), Duration -> Scheme DurationMonths (12), Maturity -> 2027-03-31
            Assert.Equal(145734m, targetLoan.GetProperty("sanctionedAmount").GetDecimal());
            Assert.Equal(11.50m, targetLoan.GetProperty("interestRate").GetDecimal());
            Assert.Equal(2.00m, targetLoan.GetProperty("penalRate").GetDecimal());
            Assert.Equal(12, targetLoan.GetProperty("durationMonths").GetInt32());
            Assert.Equal("2026-03-31", targetLoan.GetProperty("loanDisbursementDate").GetString());
            Assert.Equal("2027-03-31", targetLoan.GetProperty("maturityDate").GetString());

            // 2026-03-31 to 2026-11-17 = 231 days -> 145734 * 11.5 * 231 / 36500 = 10606.80 -> 10607
            Assert.Equal(231, targetLoan.GetProperty("interestDays").GetInt32());
            Assert.Equal(10607m, targetLoan.GetProperty("accruedRegularInterest").GetDecimal());

            var previewRes = await ctrl.GetLoanDuesPreview(205, bizDate);
            var previewJson = ParseJson(previewRes);
            Assert.Equal(231, previewJson.GetProperty("interestDays").GetInt32());
            Assert.Equal(10607m, previewJson.GetProperty("totalRegularInterestDue").GetDecimal());
            Assert.Equal(145734m, previewJson.GetProperty("sanctionedAmount").GetDecimal());
            Assert.Equal("2027-03-31", previewJson.GetProperty("maturityDate").GetString());
        }
    }
}
