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
    public class GoldCustodyAndBorrowingTests
    {
        private sealed class FakeWebHostEnvironment : IWebHostEnvironment
        {
            public string ApplicationName { get; set; } = "Bhisi.Api.Tests";
            public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
            public string ContentRootPath { get; set; } = Path.Combine(Path.GetTempPath(), "bhisi_gold_custody_tests");
            public string EnvironmentName { get; set; } = "Development";
            public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
            public string WebRootPath { get; set; } = Path.Combine(Path.GetTempPath(), "bhisi_gold_custody_tests", "wwwroot");
        }

        private static AppDbContext CreateDbContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase($"BhisiGoldBorrowing_{Guid.NewGuid():N}")
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ControllerContext CreateAdminContext(int branchId = 1, int userId = 1)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Name, "TestAdmin"),
                new Claim(ClaimTypes.Role, "Admin"),
                new Claim("BranchID", branchId.ToString()),
                new Claim("DefaultBranchID", branchId.ToString()),
                new Claim("BusinessDate", "2026-04-15")
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
                SanctionedAmount = 150000m,
                PrincipalBalance = 150000m,
                InterestBalance = 0m,
                OverdueInterestBalance = 0m,
                InterestRate = 13.00m,
                LoanDisbursementDate = new DateTime(2026, 4, 10),
                Status = "Active"
            });

            db.GoldLoanDetails.Add(new GoldLoanDetail
            {
                GoldLoanDetailID = 901,
                LoanAccountID = 501,
                OrnamentName = "सोन्याचा नेकलेस व बांगड्या",
                Quantity = 3,
                GrossWeight = 32.500m,
                NetWeight = 30.250m,
                Purity = 22m,
                GoldRatePerGram = 7000m,
                EstimatedValue = 211750m,
                ValuerValuation = 210000m,
                ValuerName = "श्री. सुवर्णकार"
            });

            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task GoldCustody_AutoInit_MoveOwnAndExternalLocker_LogsMovements()
        {
            await using var db = CreateDbContext();
            await SeedCoreMastersAsync(db);

            var env = new FakeWebHostEnvironment();
            var ctrl = new GoldCustodyController(db, env)
            {
                ControllerContext = CreateAdminContext()
            };

            // 1. Auto-init on first fetch
            var initRes = await ctrl.GetCustodyByLoanAccount(501);
            Assert.IsType<OkObjectResult>(initRes.Result);

            var custody = await db.GoldLoanCustodies.SingleAsync(c => c.LoanAccountID == 501);
            Assert.Equal("BRANCH_SAFE", custody.CustodyStatus);
            Assert.StartsWith("PKT-", custody.PacketNumber);
            Assert.Equal(3, custody.TotalOrnamentsCount);
            Assert.Equal(32.500m, custody.TotalGrossWeight);
            Assert.Equal(30.250m, custody.TotalNetWeight);

            // 2. Move BRANCH_SAFE -> OWN_LOCKER
            var ownMoveRes = await ctrl.AssignCustodyLocation(new AssignGoldCustodyLocationDto
            {
                LoanAccountID = 501,
                PacketNumber = "PKT-501-A",
                SealNumber = "SEAL-99",
                CustodyStatus = "OWN_LOCKER",
                OwnLockerID = 11,
                MovementDate = new DateTime(2026, 4, 11),
                Remarks = "संस्थेच्या लॉकरमध्ये ठेवले"
            });
            Assert.IsType<OkObjectResult>(ownMoveRes.Result);

            custody = await db.GoldLoanCustodies.Include(c => c.OwnLocker).SingleAsync(c => c.LoanAccountID == 501);
            Assert.Equal("OWN_LOCKER", custody.CustodyStatus);
            Assert.Equal(11, custody.OwnLockerID);
            Assert.Equal("PKT-501-A", custody.PacketNumber);

            // 3. Quick-add External Bank Locker & Move OWN_LOCKER -> EXTERNAL_LOCKER
            var extRes = await ctrl.CreateExternalLocker(new SaveExternalLockerDto
            {
                BranchID = 1,
                BankOrSocietyName = "सांगली जिल्हा मध्यवर्ती सहकारी बँक",
                BankBranchName = "मुख्य शाखा",
                LockerNo = "EXT-45",
                CabinetOrBoxNo = "B-2",
                AnnualRentAmount = 3500m
            });
            Assert.IsType<OkObjectResult>(extRes.Result);
            var extLocker = await db.SansthaExternalLockers.SingleAsync();

            var extMoveRes = await ctrl.AssignCustodyLocation(new AssignGoldCustodyLocationDto
            {
                LoanAccountID = 501,
                CustodyStatus = "EXTERNAL_LOCKER",
                ExternalLockerID = extLocker.ExternalLockerID,
                MovementDate = new DateTime(2026, 4, 12),
                Remarks = "जिल्हा बँक लॉकरमध्ये सुरक्षित ठेवले"
            });
            Assert.IsType<OkObjectResult>(extMoveRes.Result);

            custody = await db.GoldLoanCustodies.Include(c => c.ExternalLocker).SingleAsync(c => c.LoanAccountID == 501);
            Assert.Equal("EXTERNAL_LOCKER", custody.CustodyStatus);
            Assert.Equal(extLocker.ExternalLockerID, custody.ExternalLockerID);
            Assert.Null(custody.OwnLockerID);

            var logs = await db.GoldCustodyMovementLogs
                .Where(l => l.LoanAccountID == 501)
                .OrderBy(l => l.MovementLogID)
                .ToListAsync();
            Assert.Equal(3, logs.Count); // INITIAL -> BRANCH_SAFE, BRANCH_SAFE -> OWN_LOCKER, OWN_LOCKER -> EXTERNAL_LOCKER
            Assert.Equal("EXTERNAL_LOCKER", logs.Last().ToStatus);
        }

        [Fact]
        public async Task GoldRepledgeBorrowing_CalculatesSpread_EnforcesRepledgeGuard_AndReleasesOnRepayment()
        {
            await using var db = CreateDbContext();
            await SeedCoreMastersAsync(db);

            var env = new FakeWebHostEnvironment();
            var custodyCtrl = new GoldCustodyController(db, env) { ControllerContext = CreateAdminContext() };
            var brwCtrl = new BorrowingsController(db) { ControllerContext = CreateAdminContext() };

            // First place ornament packet in Own Locker L-101
            await custodyCtrl.AssignCustodyLocation(new AssignGoldCustodyLocationDto
            {
                LoanAccountID = 501,
                PacketNumber = "PKT-GLD-501",
                CustodyStatus = "OWN_LOCKER",
                OwnLockerID = 11,
                MovementDate = new DateTime(2026, 4, 11)
            });

            // Create GOLD_REPLEDGE borrowing at 8.50% (Customer loan is 13.00% => Spread +4.50%)
            var createRes = await brwCtrl.CreateBorrowing(new CreateBorrowingRequestDto
            {
                BranchID = 1,
                LenderName = "श्री छत्रपती सहकारी पतसंस्था",
                LenderBranchName = "शहर शाखा",
                ExternalLoanAccountNo = "EXT-GL-9001",
                BorrowingType = "GOLD_REPLEDGE",
                SanctionDate = new DateTime(2026, 4, 15),
                DisbursementDate = new DateTime(2026, 4, 15),
                SanctionedAmount = 120000m,
                DisbursedAmount = 120000m,
                BorrowingInterestRate = 8.50m,
                BorrowingLiabilityLedgerID = 201,
                InterestExpenseLedgerID = 401,
                PaymentMode = "Bank",
                BankLedgerID = 102,
                ReferenceNo = "UTR123456",
                GoldPledges = new List<BorrowingGoldPledgeInputDto>
                {
                    new BorrowingGoldPledgeInputDto
                    {
                        LoanAccountID = 501,
                        AllocatedBorrowedAmount = 120000m,
                        LenderPledgeReceiptNo = "PLEDGE-77"
                    }
                }
            });
            Assert.IsType<OkObjectResult>(createRes.Result);

            var borrowing = await db.SansthaBorrowings
                .Include(b => b.GoldPledges)
                .SingleAsync();
            Assert.Equal(120000m, borrowing.OutstandingPrincipal);
            Assert.Single(borrowing.GoldPledges);
            Assert.Equal(13.00m, borrowing.GoldPledges.First().CustomerLoanInterestRate);
            Assert.Equal(4.50m, borrowing.GoldPledges.First().InterestSpreadPercent);

            // Verify Drawdown Voucher Dr = Cr = 1,20,000
            var disbVoucher = await db.Vouchers
                .Include(v => v.VoucherDetails)
                .SingleAsync(v => v.VoucherID == borrowing.DisbursementVoucherID);
            Assert.StartsWith("REC-BRW-", disbVoucher.VoucherNo);
            Assert.Equal(120000m, disbVoucher.VoucherDetails.Where(d => d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(120000m, disbVoucher.VoucherDetails.Where(d => d.DrCr == "Cr").Sum(d => d.Amount));

            // Verify Custody is locked in REPLEDGED_BORROWING and manual move is blocked
            var custody = await db.GoldLoanCustodies.SingleAsync(c => c.LoanAccountID == 501);
            Assert.Equal("REPLEDGED_BORROWING", custody.CustodyStatus);
            Assert.Equal(borrowing.BorrowingID, custody.ActiveBorrowingID);

            var blockedMove = await custodyCtrl.AssignCustodyLocation(new AssignGoldCustodyLocationDto
            {
                LoanAccountID = 501,
                CustodyStatus = "BRANCH_SAFE"
            });
            Assert.IsType<BadRequestObjectResult>(blockedMove.Result);

            // Customer pays off 100% of their Gold Loan -> Re-pledge Hard Guard MUST still block handover!
            var loan = await db.LoanAccounts.SingleAsync(l => l.LoanAccountID == 501);
            loan.PrincipalBalance = 0m;
            loan.InterestBalance = 0m;
            loan.OverdueInterestBalance = 0m;
            loan.Status = "Closed";
            await db.SaveChangesAsync();

            var blockedRelease = await custodyCtrl.ReleaseGoldToCustomer(new ReleaseGoldToCustomerDto
            {
                LoanAccountID = 501,
                ReleasedToName = "राजेश शंकर पाटील",
                ReleaseDate = new DateTime(2026, 4, 20)
            });
            var badReq = Assert.IsType<BadRequestObjectResult>(blockedRelease.Result);
            Assert.Contains("श्री छत्रपती सहकारी पतसंस्था", badReq.Value?.ToString() ?? string.Empty);

            // Approve drawdown voucher & repay 100% of external borrowing + release packet
            disbVoucher.Status = "Approved";
            await db.SaveChangesAsync();

            var repayRes = await brwCtrl.RepayBorrowing(borrowing.BorrowingID, new BorrowingRepaymentRequestDto
            {
                RepaymentDate = new DateTime(2026, 4, 20),
                PrincipalPaid = 120000m,
                InterestPaid = 1400m,
                PenalOrChargesPaid = 100m,
                PaymentMode = "Bank",
                BankLedgerID = 102,
                ReferenceNo = "UTR999888",
                ReleaseGoldCustodyIds = new List<int> { custody.GoldCustodyID }
            });
            Assert.IsType<OkObjectResult>(repayRes.Result);

            borrowing = await db.SansthaBorrowings.Include(b => b.Repayments).Include(b => b.GoldPledges).SingleAsync();
            Assert.Equal("Closed", borrowing.Status);
            Assert.Equal(0m, borrowing.OutstandingPrincipal);
            Assert.Equal(1500m, borrowing.TotalInterestPaid);
            Assert.Equal("Released", borrowing.GoldPledges.Single().PledgeStatus);

            var repayVoucher = await db.Vouchers
                .Include(v => v.VoucherDetails)
                .SingleAsync(v => v.VoucherID == borrowing.Repayments.Single().VoucherID);
            Assert.StartsWith("PAY-BRW-", repayVoucher.VoucherNo);
            Assert.Equal(121500m, repayVoucher.VoucherDetails.Where(d => d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(121500m, repayVoucher.VoucherDetails.Where(d => d.DrCr == "Cr").Sum(d => d.Amount));

            // Custody restored back to OWN_LOCKER L-101!
            custody = await db.GoldLoanCustodies.SingleAsync(c => c.LoanAccountID == 501);
            Assert.Equal("OWN_LOCKER", custody.CustodyStatus);
            Assert.Equal(11, custody.OwnLockerID);
            Assert.Null(custody.ActiveBorrowingID);

            // Now ReleaseGoldToCustomer succeeds and creates GRL receipt + LoanDocument!
            string tinyPngBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
            var okRelease = await custodyCtrl.ReleaseGoldToCustomer(new ReleaseGoldToCustomerDto
            {
                LoanAccountID = 501,
                ReleaseDate = new DateTime(2026, 4, 20),
                ReleasedToName = "राजेश शंकर पाटील",
                ReleasedToRelation = "स्वतः कर्जदार (Self)",
                ReceiverMobile = "9876543210",
                ReceiverIdProof = "AADHAAR-1234",
                AcknowledgementBase64Image = tinyPngBase64
            });
            Assert.IsType<OkObjectResult>(okRelease.Result);

            custody = await db.GoldLoanCustodies.SingleAsync(c => c.LoanAccountID == 501);
            Assert.Equal("RELEASED_TO_CUSTOMER", custody.CustodyStatus);
            Assert.StartsWith("GRL-", custody.ReleaseReceiptNo);
            Assert.True(await db.LoanDocuments.AnyAsync(d => d.LoanAccountID == 501));
        }

        [Fact]
        public async Task NonGoldTermLoanBorrowing_WorksWithoutGold_AndRejectsInvalidLedgerNatures()
        {
            await using var db = CreateDbContext();
            await SeedCoreMastersAsync(db);
            var brwCtrl = new BorrowingsController(db) { ControllerContext = CreateAdminContext() };

            // 1. Reject Asset/Bank ledger passed as BorrowingLiabilityLedgerID
            var badLiabRes = await brwCtrl.CreateBorrowing(new CreateBorrowingRequestDto
            {
                BranchID = 1,
                LenderName = "जिल्हा मध्यवर्ती सहकारी बँक",
                BorrowingType = "TERM_LOAN",
                DisbursementDate = new DateTime(2026, 4, 15),
                SanctionedAmount = 500000m,
                DisbursedAmount = 500000m,
                BorrowingInterestRate = 9.25m,
                BorrowingLiabilityLedgerID = 102, // Invalid: Bank Account (Assets)
                InterestExpenseLedgerID = 401,
                PaymentMode = "Bank",
                BankLedgerID = 102
            });
            Assert.IsType<BadRequestObjectResult>(badLiabRes.Result);

            // 2. Reject Income ledger passed as InterestExpenseLedgerID
            var badExpRes = await brwCtrl.CreateBorrowing(new CreateBorrowingRequestDto
            {
                BranchID = 1,
                LenderName = "जिल्हा मध्यवर्ती सहकारी बँक",
                BorrowingType = "TERM_LOAN",
                DisbursementDate = new DateTime(2026, 4, 15),
                SanctionedAmount = 500000m,
                DisbursedAmount = 500000m,
                BorrowingInterestRate = 9.25m,
                BorrowingLiabilityLedgerID = 201,
                InterestExpenseLedgerID = 202, // Invalid: Income ledger
                PaymentMode = "Bank",
                BankLedgerID = 102
            });
            Assert.IsType<BadRequestObjectResult>(badExpRes.Result);

            // 3. Valid TERM_LOAN without gold packets
            var okRes = await brwCtrl.CreateBorrowing(new CreateBorrowingRequestDto
            {
                BranchID = 1,
                LenderName = "जिल्हा मध्यवर्ती सहकारी बँक",
                BorrowingType = "TERM_LOAN",
                DisbursementDate = new DateTime(2026, 4, 15),
                SanctionedAmount = 500000m,
                DisbursedAmount = 500000m,
                BorrowingInterestRate = 9.25m,
                BorrowingLiabilityLedgerID = 201,
                InterestExpenseLedgerID = 401,
                PaymentMode = "Bank",
                BankLedgerID = 102,
                PurposeOrLinkedLoansNote = "संस्थेच्या सर्वसाधारण कर्ज वाटपासाठी निधी"
            });
            Assert.IsType<OkObjectResult>(okRes.Result);

            var saved = await db.SansthaBorrowings.Include(b => b.GoldPledges).SingleAsync();
            Assert.Equal("TERM_LOAN", saved.BorrowingType);
            Assert.Empty(saved.GoldPledges);
            Assert.Equal(500000m, saved.OutstandingPrincipal);
        }

        [Fact]
        public async Task VoucherRollbackAndDeleteService_LosslesslyRestoresBorrowingAndGoldCustody_AndProtectsReleasedGold()
        {
            await using var db = CreateDbContext();
            await SeedCoreMastersAsync(db);

            var env = new FakeWebHostEnvironment();
            var custodyCtrl = new GoldCustodyController(db, env) { ControllerContext = CreateAdminContext() };
            var brwCtrl = new BorrowingsController(db) { ControllerContext = CreateAdminContext() };
            var rollbackSvc = new VoucherRollbackAndDeleteService(db);

            var deleteCtx = new VoucherDeleteRequestContext
            {
                UserId = 1,
                Username = "TestAdmin",
                UserRole = "Admin",
                UserBranchId = 1,
                IsHeadOfficeAdmin = true,
                Reason = "ऑपरेटरकडून चुकीची रक्कम भरली गेली असल्याने रद्द"
            };

            // Place packet in Own Locker L-101
            await custodyCtrl.AssignCustodyLocation(new AssignGoldCustodyLocationDto
            {
                LoanAccountID = 501,
                CustodyStatus = "OWN_LOCKER",
                OwnLockerID = 11
            });

            // Create GOLD_REPLEDGE borrowing
            await brwCtrl.CreateBorrowing(new CreateBorrowingRequestDto
            {
                BranchID = 1,
                LenderName = "महानगर सहकारी बँक",
                BorrowingType = "GOLD_REPLEDGE",
                DisbursementDate = new DateTime(2026, 4, 15),
                SanctionedAmount = 100000m,
                DisbursedAmount = 100000m,
                BorrowingInterestRate = 8.00m,
                BorrowingLiabilityLedgerID = 201,
                InterestExpenseLedgerID = 401,
                PaymentMode = "Cash",
                GoldPledges = new List<BorrowingGoldPledgeInputDto>
                {
                    new BorrowingGoldPledgeInputDto { LoanAccountID = 501, AllocatedBorrowedAmount = 100000m }
                }
            });

            var borrowing = await db.SansthaBorrowings.SingleAsync();
            var custody = await db.GoldLoanCustodies.SingleAsync(c => c.LoanAccountID == 501);
            int disbVoucherId = borrowing.DisbursementVoucherID!.Value;

            // Approve drawdown temporarily so we can test Repayment Rollback first
            var disbVoucher = await db.Vouchers.SingleAsync(v => v.VoucherID == disbVoucherId);
            disbVoucher.Status = "Approved";
            await db.SaveChangesAsync();

            await brwCtrl.RepayBorrowing(borrowing.BorrowingID, new BorrowingRepaymentRequestDto
            {
                RepaymentDate = new DateTime(2026, 4, 18),
                PrincipalPaid = 100000m,
                InterestPaid = 500m,
                PaymentMode = "Cash",
                ReleaseGoldCustodyIds = new List<int> { custody.GoldCustodyID }
            });

            var repayment = await db.SansthaBorrowingRepayments.SingleAsync();
            int repayVoucherId = repayment.VoucherID!.Value;

            // Roll back Pending Repayment Voucher -> Borrowing must re-open & packet must re-lock to REPLEDGED_BORROWING!
            var repayDelResult = await rollbackSvc.DeleteVoucherWithRollbackAsync(repayVoucherId, deleteCtx);
            Assert.True(repayDelResult.Success, repayDelResult.Message);

            borrowing = await db.SansthaBorrowings.Include(b => b.GoldPledges).SingleAsync();
            custody = await db.GoldLoanCustodies.SingleAsync(c => c.LoanAccountID == 501);
            Assert.Equal("Active", borrowing.Status);
            Assert.Equal(100000m, borrowing.OutstandingPrincipal);
            Assert.Equal(0m, borrowing.TotalInterestPaid);
            Assert.Equal("Pledged", borrowing.GoldPledges.Single().PledgeStatus);
            Assert.Equal("REPLEDGED_BORROWING", custody.CustodyStatus);
            Assert.Equal(borrowing.BorrowingID, custody.ActiveBorrowingID);

            // Now set drawdown voucher back to Pending & roll back Drawdown Voucher -> Borrowing removed & custody back to OWN_LOCKER!
            disbVoucher = await db.Vouchers.SingleAsync(v => v.VoucherID == disbVoucherId);
            disbVoucher.Status = "Pending";
            await db.SaveChangesAsync();

            var disbDelResult = await rollbackSvc.DeleteVoucherWithRollbackAsync(disbVoucherId, deleteCtx);
            Assert.True(disbDelResult.Success, disbDelResult.Message);

            Assert.False(await db.SansthaBorrowings.AnyAsync());
            Assert.False(await db.SansthaBorrowingGoldPledges.AnyAsync());
            custody = await db.GoldLoanCustodies.SingleAsync(c => c.LoanAccountID == 501);
            Assert.Equal("OWN_LOCKER", custody.CustodyStatus);
            Assert.Equal(11, custody.OwnLockerID);
            Assert.Null(custody.ActiveBorrowingID);

            // Finally verify domain block (409 Conflict) if gold packet was unpledged & already released to customer
            await brwCtrl.CreateBorrowing(new CreateBorrowingRequestDto
            {
                BranchID = 1,
                LenderName = "महानगर सहकारी बँक",
                BorrowingType = "GOLD_REPLEDGE",
                DisbursementDate = new DateTime(2026, 4, 19),
                SanctionedAmount = 80000m,
                DisbursedAmount = 80000m,
                BorrowingInterestRate = 8.00m,
                BorrowingLiabilityLedgerID = 201,
                InterestExpenseLedgerID = 401,
                PaymentMode = "Cash",
                GoldPledges = new List<BorrowingGoldPledgeInputDto>
                {
                    new BorrowingGoldPledgeInputDto { LoanAccountID = 501, AllocatedBorrowedAmount = 80000m }
                }
            });
            var brw2 = await db.SansthaBorrowings.SingleAsync();
            await brwCtrl.UnpledgeGoldPackets(brw2.BorrowingID, new UnpledgeGoldPacketsRequestDto
            {
                GoldCustodyIds = new List<int> { custody.GoldCustodyID }
            });

            var loan = await db.LoanAccounts.SingleAsync(l => l.LoanAccountID == 501);
            loan.PrincipalBalance = 0m;
            loan.Status = "Closed";
            await db.SaveChangesAsync();

            await custodyCtrl.ReleaseGoldToCustomer(new ReleaseGoldToCustomerDto
            {
                LoanAccountID = 501,
                ReleasedToName = "राजेश शंकर पाटील"
            });

            var blockedDrawdownDelete = await rollbackSvc.DeleteVoucherWithRollbackAsync(brw2.DisbursementVoucherID!.Value, deleteCtx);
            Assert.False(blockedDrawdownDelete.Success);
            Assert.Equal(StatusCodes.Status409Conflict, blockedDrawdownDelete.HttpStatusCode);
        }
    }
}
