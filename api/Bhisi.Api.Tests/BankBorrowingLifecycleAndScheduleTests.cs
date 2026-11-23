using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Bhisi.Api.Controllers;
using Bhisi.Api.Data;
using Bhisi.Api.Helpers;
using Bhisi.Api.Models;
using Bhisi.Api.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.FileProviders;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class BankBorrowingLifecycleAndScheduleTests
    {
        private sealed class FakeWebHostEnvironment : IWebHostEnvironment
        {
            public string ApplicationName { get; set; } = "Bhisi.Api.Tests";
            public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
            public string ContentRootPath { get; set; } = Path.Combine(Path.GetTempPath(), "bhisi_borrowing_lifecycle_tests");
            public string EnvironmentName { get; set; } = "Development";
            public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
            public string WebRootPath { get; set; } = Path.Combine(Path.GetTempPath(), "bhisi_borrowing_lifecycle_tests", "wwwroot");
        }

        private static AppDbContext CreateDbContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase($"BhisiBorrowingLifecycle_{Guid.NewGuid():N}")
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ControllerContext CreateAdminContext(string businessDate = "2026-04-15", int branchId = 1, int userId = 1)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Name, "TestAdmin"),
                new Claim(ClaimTypes.Role, "Admin"),
                new Claim("BranchID", branchId.ToString()),
                new Claim("DefaultBranchID", branchId.ToString()),
                new Claim("BusinessDate", businessDate)
            };

            return new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestJwt"))
                }
            };
        }

        private static async Task SeedCoreMastersAsync(AppDbContext db)
        {
            db.Branches.Add(new Branch
            {
                BranchID = 1,
                BranchCode = "001",
                BranchName = "मुख्य शाखा",
                IsActive = true
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

            db.AccountGroups.AddRange(
                new AccountGroup { GroupID = 10, GroupName = "देणे व बाह्य कर्जे", NatureOfGroup = "Liabilities", IsActive = true },
                new AccountGroup { GroupID = 20, GroupName = "उत्पन्न", NatureOfGroup = "Income", IsActive = true },
                new AccountGroup { GroupID = 30, GroupName = "मालमत्ता व बँक", NatureOfGroup = "Assets", IsActive = true },
                new AccountGroup { GroupID = 40, GroupName = "व्याज व प्रशासकीय खर्च", NatureOfGroup = "Expenses", IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 101, GroupID = 30, LedgerCode = "CSH-01", LedgerName = "रोख खाते (Cash)", AccountType = "Cash", IsActive = true },
                new Ledger { LedgerID = 102, GroupID = 30, LedgerCode = "BNK-01", LedgerName = "जिल्हा मध्यवर्ती बँक चालू खाते", AccountType = "Bank Account", IsActive = true },
                new Ledger { LedgerID = 201, GroupID = 10, LedgerCode = "BRW-01", LedgerName = "बाह्य बँक देणे कर्ज (DCCB Borrowing)", AccountType = "Borrowings", IsActive = true },
                new Ledger { LedgerID = 401, GroupID = 40, LedgerCode = "EXP-BRW-01", LedgerName = "बाह्य कर्जावरील दिलेले व्याज खर्च", AccountType = "Expenses", IsActive = true },
                new Ledger { LedgerID = 402, GroupID = 40, LedgerCode = "EXP-BRW-02", LedgerName = "बाह्य कर्ज प्रोसेसिंग व बँक चार्जेस खर्च", AccountType = "Expenses", IsActive = true },
                new Ledger { LedgerID = 301, GroupID = 30, LedgerCode = "GLN-01", LedgerName = "सोने तारण कर्ज येणे", AccountType = "Loan", IsActive = true },
                new Ledger { LedgerID = 202, GroupID = 20, LedgerCode = "INC-GLN-01", LedgerName = "सोने तारण व्याज उत्पन्न", AccountType = "Income", IsActive = true }
            );

            db.LockerTypes.Add(new LockerType
            {
                LockerTypeID = 1,
                TypeName = "मोठा लॉकर",
                AnnualRent = 2000m,
                IsActive = true
            });

            db.Lockers.Add(new Locker
            {
                LockerID = 11,
                BranchID = 1,
                LockerTypeID = 1,
                LockerNo = "L-101",
                CabinetNo = "CAB-A",
                KeyNo = "K-101",
                Status = "Available",
                IsActive = true
            });

            db.Customers.Add(new Customer
            {
                CustomerID = 1,
                BranchID = 1,
                CIFNo = "CIF000101",
                FirstName = "राजेश",
                MiddleName = "शंकर",
                LastName = "पाटील",
                MobileNo = "9876543210"
            });

            db.LoanRates.Add(new LoanRate
            {
                LoanRateID = 1,
                LoanCode = "GLD",
                LoanType = "सोने तारण कर्ज",
                ShortName = "सुवर्ण तारण",
                CollateralCategory = "Gold",
                InterestRate = 13.00m,
                LoanLedgerID = 301,
                InterestLedgerID = 202,
                IsActive = true
            });

            db.LoanAccounts.Add(new LoanAccount
            {
                LoanAccountID = 501,
                BranchID = 1,
                CustomerID = 1,
                LoanRateID = 1,
                LoanAccountNo = "00120500005011",
                SanctionedAmount = 250000m,
                PrincipalBalance = 250000m,
                InterestRate = 13.00m,
                LoanDisbursementDate = new DateTime(2026, 4, 10),
                Status = "Active"
            });

            db.GoldLoanDetails.Add(new GoldLoanDetail
            {
                GoldLoanDetailID = 901,
                LoanAccountID = 501,
                OrnamentName = "सोन्याचा गोफ व पाटल्या",
                Quantity = 3,
                GrossWeight = 52.000m,
                NetWeight = 50.000m,
                Purity = 22m,
                GoldRatePerGram = 7000m,
                EstimatedValue = 350000m,
                ValuerValuation = 350000m,
                ValuerName = "श्री. सुवर्णकार"
            });

            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task AccountOpening_ThenDisbursementWithProcessingFeeAndGoldRepledge_GeneratesBalancedVoucherAndEmiSchedule()
        {
            await using var db = CreateDbContext();
            await SeedCoreMastersAsync(db);

            var env = new FakeWebHostEnvironment();
            var custodyCtrl = new GoldCustodyController(db, env) { ControllerContext = CreateAdminContext() };
            var brwCtrl = new BorrowingsController(db) { ControllerContext = CreateAdminContext() };

            await custodyCtrl.AssignCustodyLocation(new AssignGoldCustodyLocationDto
            {
                LoanAccountID = 501,
                CustodyStatus = "OWN_LOCKER",
                OwnLockerID = 11
            });

            // 1. Account Opening (Sanctioned state — zero financial voucher yet)
            var openRes = await brwCtrl.CreateBorrowingAccount(new CreateBorrowingAccountDto
            {
                BranchID = 1,
                LenderName = "सांगली जिल्हा मध्यवर्ती बँक",
                LenderBranchName = "मुख्य शाखा",
                ExternalLoanAccountNo = "DCCB-GL-2026-99",
                SanctionLetterNo = "SL/2026/45",
                BorrowingType = "GOLD_REPLEDGE",
                SanctionDate = new DateTime(2026, 4, 15),
                SanctionedAmount = 500000m,
                BorrowingInterestRate = 9.00m,
                InstallmentType = "EMI",
                InstallmentFrequency = "Monthly",
                TenureMonths = 12,
                TotalInstallments = 12,
                BorrowingLiabilityLedgerID = 201,
                InterestExpenseLedgerID = 401,
                ProcessingChargesLedgerID = 402
            });
            Assert.IsType<OkObjectResult>(openRes.Result);

            var account = await db.SansthaBorrowings.SingleAsync();
            Assert.Equal("Sanctioned", account.Status);
            Assert.Equal(0m, account.DisbursedAmount);
            Assert.Equal(0m, account.OutstandingPrincipal);
            Assert.False(await db.Vouchers.AnyAsync());

            // 2. Loan Disbursement with ₹2,500 processing fee deduction & Gold Packet Re-pledge
            var disbRes = await brwCtrl.DisburseBorrowing(account.BorrowingID, new BorrowingDisbursementRequestDto
            {
                DisbursementDate = new DateTime(2026, 4, 15),
                GrossDisbursedAmount = 500000m,
                ProcessingFeeDeducted = 2500m,
                OtherDeductionsAmount = 0m,
                DeductionLedgerID = 402,
                PaymentMode = "Bank",
                BankLedgerID = 102,
                ReferenceNo = "UTR99887766",
                FirstInstallmentDueDate = new DateTime(2026, 5, 15),
                GoldPledges = new List<BorrowingGoldPledgeInputDto>
                {
                    new BorrowingGoldPledgeInputDto
                    {
                        LoanAccountID = 501,
                        AllocatedBorrowedAmount = 200000m,
                        LenderPledgeReceiptNo = "PLEDGE-77"
                    }
                }
            });
            Assert.IsType<OkObjectResult>(disbRes.Result);

            account = await db.SansthaBorrowings
                .Include(b => b.Disbursements)
                .Include(b => b.InstallmentSchedules)
                .Include(b => b.GoldPledges)
                .SingleAsync();

            Assert.Equal("Active", account.Status);
            Assert.Equal(500000m, account.DisbursedAmount);
            Assert.Equal(500000m, account.OutstandingPrincipal);

            var disbRow = Assert.Single(account.Disbursements);
            Assert.Equal(500000m, disbRow.GrossDisbursedAmount);
            Assert.Equal(2500m, disbRow.ProcessingFeeDeducted);
            Assert.Equal(497500m, disbRow.NetReceivedAmount);

            // Verify balanced 3-line voucher (Dr Bank 4,97,500 + Dr Charges 2,500 = Cr Liability 5,00,000)
            var voucher = await db.Vouchers.Include(v => v.VoucherDetails).SingleAsync(v => v.VoucherID == disbRow.VoucherID);
            Assert.Equal(500000m, voucher.VoucherDetails.Where(d => d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(500000m, voucher.VoucherDetails.Where(d => d.DrCr == "Cr").Sum(d => d.Amount));
            Assert.Contains(voucher.VoucherDetails, d => d.LedgerID == 102 && d.DrCr == "Dr" && d.Amount == 497500m);
            Assert.Contains(voucher.VoucherDetails, d => d.LedgerID == 402 && d.DrCr == "Dr" && d.Amount == 2500m);
            Assert.Contains(voucher.VoucherDetails, d => d.LedgerID == 201 && d.DrCr == "Cr" && d.Amount == 500000m);

            // Verify 12-month EMI schedule whose PrincipalDue sums strictly to 5,00,000
            Assert.Equal(12, account.InstallmentSchedules.Count);
            Assert.Equal(500000m, account.InstallmentSchedules.Sum(s => s.PrincipalDue));
            Assert.True(account.InstallmentAmount > 43000m);

            // Verify Gold Packet Re-pledge & Spread (13% - 9% = +4%)
            var pledge = Assert.Single(account.GoldPledges);
            Assert.Equal(4.00m, pledge.InterestSpreadPercent);
            var custody = await db.GoldLoanCustodies.SingleAsync(c => c.LoanAccountID == 501);
            Assert.Equal("REPLEDGED_BORROWING", custody.CustodyStatus);
        }

        [Fact]
        public async Task RepayBorrowing_RegularEmis_MarksInstallmentsPaid_AndServesLedgerAndUpcomingEmis()
        {
            await using var db = CreateDbContext();
            await SeedCoreMastersAsync(db);

            var brwCtrl = new BorrowingsController(db) { ControllerContext = CreateAdminContext("2026-04-15") };

            await brwCtrl.CreateBorrowingAccount(new CreateBorrowingAccountDto
            {
                BranchID = 1,
                LenderName = "कोल्हापूर जिल्हा बँक",
                BorrowingType = "TERM_LOAN",
                SanctionDate = new DateTime(2026, 4, 15),
                SanctionedAmount = 120000m,
                BorrowingInterestRate = 10.00m,
                InstallmentType = "EqualPrincipal",
                InstallmentFrequency = "Monthly",
                TenureMonths = 12,
                TotalInstallments = 12,
                BorrowingLiabilityLedgerID = 201,
                InterestExpenseLedgerID = 401
            });

            var borrowing = await db.SansthaBorrowings.SingleAsync();
            await brwCtrl.DisburseBorrowing(borrowing.BorrowingID, new BorrowingDisbursementRequestDto
            {
                DisbursementDate = new DateTime(2026, 4, 15),
                GrossDisbursedAmount = 120000m,
                PaymentMode = "Bank",
                BankLedgerID = 102,
                FirstInstallmentDueDate = new DateTime(2026, 5, 15)
            });

            // Approve disbursement voucher
            var disbVoucher = await db.Vouchers.SingleAsync();
            disbVoucher.Status = "Approved";
            await db.SaveChangesAsync();

            var sch1 = await db.SansthaBorrowingInstallmentSchedules
                .SingleAsync(s => s.BorrowingID == borrowing.BorrowingID && s.InstallmentNo == 1);
            var sch2 = await db.SansthaBorrowingInstallmentSchedules
                .SingleAsync(s => s.BorrowingID == borrowing.BorrowingID && s.InstallmentNo == 2);

            // Pay EMI #1 on 2026-05-15
            brwCtrl.ControllerContext = CreateAdminContext("2026-05-15");
            var repay1Res = await brwCtrl.RepayBorrowing(borrowing.BorrowingID, new BorrowingRepaymentRequestDto
            {
                RepaymentDate = new DateTime(2026, 5, 15),
                RepaymentType = "RegularEMI",
                PrincipalPaid = sch1.PrincipalDue,
                InterestPaid = sch1.InterestDue,
                PaymentMode = "Bank",
                BankLedgerID = 102,
                ReferenceNo = "NEFT-EMI-01"
            });
            Assert.IsType<OkObjectResult>(repay1Res.Result);

            // Approve EMI #1 voucher
            foreach (var v in await db.Vouchers.Where(v => v.Status == "Pending").ToListAsync())
            {
                v.Status = "Approved";
            }
            await db.SaveChangesAsync();

            // Pay EMI #2 on 2026-06-15
            brwCtrl.ControllerContext = CreateAdminContext("2026-06-15");
            var repay2Res = await brwCtrl.RepayBorrowing(borrowing.BorrowingID, new BorrowingRepaymentRequestDto
            {
                RepaymentDate = new DateTime(2026, 6, 15),
                RepaymentType = "RegularEMI",
                PrincipalPaid = sch2.PrincipalDue,
                InterestPaid = sch2.InterestDue,
                PaymentMode = "Bank",
                BankLedgerID = 102,
                ReferenceNo = "NEFT-EMI-02"
            });
            Assert.IsType<OkObjectResult>(repay2Res.Result);

            var updatedSchedules = await db.SansthaBorrowingInstallmentSchedules
                .Where(s => s.BorrowingID == borrowing.BorrowingID)
                .OrderBy(s => s.InstallmentNo)
                .ToListAsync();

            Assert.Equal("Paid", updatedSchedules[0].Status);
            Assert.Equal("Paid", updatedSchedules[1].Status);
            Assert.Equal("Pending", updatedSchedules[2].Status);

            var repayments = await db.SansthaBorrowingRepayments
                .OrderBy(r => r.BorrowingRepaymentID)
                .ToListAsync();
            Assert.Equal(2, repayments.Count);
            Assert.Equal("हप्ता क्र. 1", repayments[0].InstallmentsCovered);
            Assert.Equal("हप्ता क्र. 2", repayments[1].InstallmentsCovered);

            // Verify Khatavani Statement
            var ledgerRes = await brwCtrl.GetBorrowingLedgerStatement(borrowing.BorrowingID);
            var okLedger = Assert.IsType<OkObjectResult>(ledgerRes.Result);
            var entriesProp = okLedger.Value!.GetType().GetProperty("entries")!.GetValue(okLedger.Value) as System.Collections.IEnumerable;
            Assert.Equal(3, entriesProp!.Cast<object>().Count());

            // Verify Upcoming EMIs (35-day horizon from 2026-06-15 should show Installment #3 due 2026-07-15, and exclude #1 & #2)
            var upcomingRes = await brwCtrl.GetUpcomingAndOverdueEmis(branchId: 1, days: 35);
            var okUpcoming = Assert.IsType<OkObjectResult>(upcomingRes.Result);
            var upItems = (okUpcoming.Value!.GetType().GetProperty("items")!.GetValue(okUpcoming.Value) as System.Collections.IEnumerable)!
                .Cast<object>()
                .ToList();
            Assert.Single(upItems);
            int nextInstNo = Convert.ToInt32(upItems[0].GetType().GetProperty("InstallmentNo")!.GetValue(upItems[0]));
            Assert.Equal(3, nextInstNo);
        }

        [Fact]
        public async Task ForeclosureRepayment_ClosesAccount_MarksAllSchedulesPaid_AndReleasesGoldPackets()
        {
            await using var db = CreateDbContext();
            await SeedCoreMastersAsync(db);

            var env = new FakeWebHostEnvironment();
            var custodyCtrl = new GoldCustodyController(db, env) { ControllerContext = CreateAdminContext("2026-04-15") };
            var brwCtrl = new BorrowingsController(db) { ControllerContext = CreateAdminContext("2026-04-15") };

            await custodyCtrl.AssignCustodyLocation(new AssignGoldCustodyLocationDto
            {
                LoanAccountID = 501,
                CustodyStatus = "OWN_LOCKER",
                OwnLockerID = 11
            });

            await brwCtrl.CreateBorrowingAccount(new CreateBorrowingAccountDto
            {
                BranchID = 1,
                LenderName = "जनता सहकारी बँक",
                BorrowingType = "GOLD_REPLEDGE",
                SanctionDate = new DateTime(2026, 4, 15),
                SanctionedAmount = 200000m,
                BorrowingInterestRate = 8.50m,
                TenureMonths = 12,
                TotalInstallments = 12,
                BorrowingLiabilityLedgerID = 201,
                InterestExpenseLedgerID = 401
            });

            var account = await db.SansthaBorrowings.SingleAsync();
            await brwCtrl.DisburseBorrowing(account.BorrowingID, new BorrowingDisbursementRequestDto
            {
                DisbursementDate = new DateTime(2026, 4, 15),
                GrossDisbursedAmount = 200000m,
                PaymentMode = "Bank",
                BankLedgerID = 102,
                GoldPledges = new List<BorrowingGoldPledgeInputDto>
                {
                    new BorrowingGoldPledgeInputDto { LoanAccountID = 501, AllocatedBorrowedAmount = 200000m }
                }
            });

            var vch = await db.Vouchers.SingleAsync();
            vch.Status = "Approved";
            await db.SaveChangesAsync();

            // Foreclose on 2026-05-15
            brwCtrl.ControllerContext = CreateAdminContext("2026-05-15");
            var forecloseRes = await brwCtrl.RepayBorrowing(account.BorrowingID, new BorrowingRepaymentRequestDto
            {
                RepaymentDate = new DateTime(2026, 5, 15),
                RepaymentType = "Foreclosure",
                PrincipalPaid = 200000m,
                InterestPaid = 1397.26m,
                PenalOrChargesPaid = 500m,
                ChargesLedgerID = 402,
                PaymentMode = "Bank",
                BankLedgerID = 102,
                CloseAccount = true,
                ReturnCustodyStatus = "OWN_LOCKER",
                ReturnOwnLockerID = 11
            });
            Assert.IsType<OkObjectResult>(forecloseRes.Result);

            account = await db.SansthaBorrowings
                .Include(b => b.InstallmentSchedules)
                .Include(b => b.GoldPledges)
                .SingleAsync();

            Assert.Equal("Closed", account.Status);
            Assert.Equal(0m, account.OutstandingPrincipal);
            Assert.All(account.InstallmentSchedules, s => Assert.Equal("Paid", s.Status));
            Assert.Equal("Released", account.GoldPledges.Single().PledgeStatus);

            var custody = await db.GoldLoanCustodies.SingleAsync(c => c.LoanAccountID == 501);
            Assert.Equal("OWN_LOCKER", custody.CustodyStatus);
            Assert.Equal(11, custody.OwnLockerID);
            Assert.Null(custody.ActiveBorrowingID);
        }

        [Fact]
        public async Task LosslessRollback_RepaymentRevertsScheduleToPending_AndDisbursementReverts2StepAccountToSanctioned()
        {
            await using var db = CreateDbContext();
            await SeedCoreMastersAsync(db);

            var env = new FakeWebHostEnvironment();
            var custodyCtrl = new GoldCustodyController(db, env) { ControllerContext = CreateAdminContext("2026-04-15") };
            var brwCtrl = new BorrowingsController(db) { ControllerContext = CreateAdminContext("2026-04-15") };
            var rollbackSvc = new VoucherRollbackAndDeleteService(db);

            var deleteCtx = new VoucherDeleteRequestContext
            {
                UserId = 1,
                Username = "TestAdmin",
                UserRole = "Admin",
                UserBranchId = 1,
                IsHeadOfficeAdmin = true,
                Reason = "चुकीची नोंद झाली असल्याने पूर्ववत (Rollback)"
            };

            await custodyCtrl.AssignCustodyLocation(new AssignGoldCustodyLocationDto
            {
                LoanAccountID = 501,
                CustodyStatus = "OWN_LOCKER",
                OwnLockerID = 11
            });

            // 1. Open 2-step Account
            await brwCtrl.CreateBorrowingAccount(new CreateBorrowingAccountDto
            {
                BranchID = 1,
                LenderName = "सातारा जिल्हा मध्यवर्ती बँक",
                BorrowingType = "GOLD_REPLEDGE",
                SanctionDate = new DateTime(2026, 4, 15),
                SanctionedAmount = 150000m,
                BorrowingInterestRate = 9.00m,
                InstallmentType = "EqualPrincipal",
                InstallmentFrequency = "Monthly",
                TenureMonths = 6,
                TotalInstallments = 6,
                BorrowingLiabilityLedgerID = 201,
                InterestExpenseLedgerID = 401
            });

            var account = await db.SansthaBorrowings.SingleAsync();

            // 2. Disburse
            await brwCtrl.DisburseBorrowing(account.BorrowingID, new BorrowingDisbursementRequestDto
            {
                DisbursementDate = new DateTime(2026, 4, 15),
                GrossDisbursedAmount = 150000m,
                PaymentMode = "Bank",
                BankLedgerID = 102,
                FirstInstallmentDueDate = new DateTime(2026, 5, 15),
                GoldPledges = new List<BorrowingGoldPledgeInputDto>
                {
                    new BorrowingGoldPledgeInputDto { LoanAccountID = 501, AllocatedBorrowedAmount = 150000m }
                }
            });

            account = await db.SansthaBorrowings.SingleAsync();
            int disbVoucherId = account.DisbursementVoucherID!.Value;
            var disbVoucher = await db.Vouchers.SingleAsync(v => v.VoucherID == disbVoucherId);
            disbVoucher.Status = "Approved";
            await db.SaveChangesAsync();

            // 3. Pay EMI #1
            var sch1 = await db.SansthaBorrowingInstallmentSchedules.SingleAsync(s => s.InstallmentNo == 1);
            brwCtrl.ControllerContext = CreateAdminContext("2026-05-15");
            await brwCtrl.RepayBorrowing(account.BorrowingID, new BorrowingRepaymentRequestDto
            {
                RepaymentDate = new DateTime(2026, 5, 15),
                RepaymentType = "RegularEMI",
                PrincipalPaid = sch1.PrincipalDue,
                InterestPaid = sch1.InterestDue,
                PaymentMode = "Bank",
                BankLedgerID = 102
            });

            sch1 = await db.SansthaBorrowingInstallmentSchedules.SingleAsync(s => s.InstallmentNo == 1);
            Assert.Equal("Paid", sch1.Status);

            var repayRow = await db.SansthaBorrowingRepayments.SingleAsync();
            int repayVoucherId = repayRow.VoucherID!.Value;

            // 4. Roll back EMI #1 Repayment Voucher -> Schedule #1 reverts from Paid & OutstandingPrincipal returns to 1,50,000!
            var repayRollback = await rollbackSvc.DeleteVoucherWithRollbackAsync(repayVoucherId, deleteCtx);
            Assert.True(repayRollback.Success, repayRollback.Message);

            account = await db.SansthaBorrowings.SingleAsync();
            sch1 = await db.SansthaBorrowingInstallmentSchedules.SingleAsync(s => s.InstallmentNo == 1);
            Assert.Equal(150000m, account.OutstandingPrincipal);
            Assert.NotEqual("Paid", sch1.Status);
            Assert.Equal(0m, sch1.PrincipalPaid);

            // 5. Roll back Disbursement Voucher -> 2-step Account Master is PRESERVED in "Sanctioned" status, schedules cleared, and Gold Custody restored!
            disbVoucher = await db.Vouchers.SingleAsync(v => v.VoucherID == disbVoucherId);
            disbVoucher.Status = "Pending";
            await db.SaveChangesAsync();

            var disbRollback = await rollbackSvc.DeleteVoucherWithRollbackAsync(disbVoucherId, deleteCtx);
            Assert.True(disbRollback.Success, disbRollback.Message);

            account = await db.SansthaBorrowings.SingleAsync();
            Assert.Equal("Sanctioned", account.Status);
            Assert.Equal(0m, account.DisbursedAmount);
            Assert.Equal(0m, account.OutstandingPrincipal);
            Assert.False(await db.SansthaBorrowingDisbursements.AnyAsync());
            Assert.False(await db.SansthaBorrowingInstallmentSchedules.AnyAsync());

            var custody = await db.GoldLoanCustodies.SingleAsync(c => c.LoanAccountID == 501);
            Assert.Equal("OWN_LOCKER", custody.CustodyStatus);
            Assert.Equal(11, custody.OwnLockerID);
        }
    }
}
