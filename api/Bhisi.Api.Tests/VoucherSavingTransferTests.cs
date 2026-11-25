using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
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
using Xunit;

namespace Bhisi.Api.Tests
{
    public class VoucherSavingTransferTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"VoucherSavingTransfer_{Guid.NewGuid():N}")
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
                SansthaName = "रयत पतसंस्था"
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
                new AccountGroup { GroupID = 2, GroupName = "रोख व बँक", NatureOfGroup = "Assets", DisplayOrder = 2, IsActive = true },
                new AccountGroup { GroupID = 3, GroupName = "खर्च", NatureOfGroup = "Expenses", DisplayOrder = 3, IsActive = true },
                new AccountGroup { GroupID = 4, GroupName = "देणी", NatureOfGroup = "Liabilities", DisplayOrder = 4, IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 10, GroupID = 2, LedgerCode = "10", LedgerName = "हातातील रोख शिल्लक (मुख्य)", AccountType = "Cash", IsActive = true },
                new Ledger { LedgerID = 15, GroupID = 2, LedgerCode = "15", LedgerName = "जिल्हा मध्यवर्ती बँक", AccountType = "Bank Account", IsActive = true },
                new Ledger { LedgerID = 20, GroupID = 2, LedgerCode = "20", LedgerName = "हातातील रोख शिल्लक (शाखा २)", AccountType = "Cash", IsActive = true },
                new Ledger { LedgerID = 46, GroupID = 1, LedgerCode = "46", LedgerName = "सेव्हिंग ठेव", AccountType = "Savings", IsActive = true },
                new Ledger { LedgerID = 144, GroupID = 4, LedgerCode = "144", LedgerName = "देणे मानधन खाते", AccountType = "General Ledger", IsActive = true },
                new Ledger { LedgerID = 351, GroupID = 3, LedgerCode = "351", LedgerName = "नोकर पगार", AccountType = "Expenses", IsActive = true },
                new Ledger { LedgerID = 352, GroupID = 3, LedgerCode = "352", LedgerName = "कर्मचारी मानधन", AccountType = "Expenses", IsActive = true }
            );

            db.Branches.AddRange(
                new Branch { BranchID = 1, BranchCode = "HO", BranchName = "मुख्य शाखा", BranchType = "HeadOffice", DefaultCashLedgerID = 10, IsActive = true },
                new Branch { BranchID = 2, BranchCode = "BR2", BranchName = "तासगाव शाखा", BranchType = "Branch", DefaultCashLedgerID = 20, IsActive = true }
            );

            db.SavingInterestSettings.Add(new SavingInterestSetting
            {
                SettingID = 1,
                SchemeCode = "101",
                SchemeName = "सामान्य बचत योजना",
                InterestRate = 4m,
                MinimumBalance = 500m,
                LedgerID = 46,
                SavingLiabilityLedgerID = 46,
                EffectiveDate = new DateTime(2025, 4, 1)
            });

            db.Customers.AddRange(
                new Customer { CustomerID = 101, BranchID = 1, CIFNo = "CIF000101", FirstName = "राजेश", LastName = "कुलकर्णी", BirthDate = new DateTime(1988, 5, 1) },
                new Customer { CustomerID = 102, BranchID = 1, CIFNo = "CIF000102", FirstName = "संतोष", LastName = "पाटील", BirthDate = new DateTime(1985, 3, 12) },
                new Customer { CustomerID = 103, BranchID = 1, CIFNo = "CIF000103", FirstName = "अमोल", LastName = "जाधव", BirthDate = new DateTime(1990, 7, 20) },
                new Customer { CustomerID = 104, BranchID = 2, CIFNo = "CIF000104", FirstName = "महेश", LastName = "देशमुख", BirthDate = new DateTime(1987, 9, 10) },
                new Customer { CustomerID = 105, BranchID = 1, CIFNo = "CIF000105", FirstName = "विनोद", LastName = "शिंदे", BirthDate = new DateTime(1991, 2, 15) },
                new Customer { CustomerID = 106, BranchID = 1, CIFNo = "CIF000106", FirstName = "सुभाष", LastName = "मोरे", BirthDate = new DateTime(1984, 11, 4) }
            );

            db.SavingAccountMasters.AddRange(
                new SavingAccountMaster
                {
                    SavingAccountID = 201,
                    BranchID = 1,
                    CustomerID = 101,
                    SavingSchemeID = 1,
                    LedgerID = 46,
                    AccountNo = "00130100000201",
                    OldAccountNo = "SB-201",
                    OpeningDate = new DateTime(2026, 4, 1),
                    OpeningBalance = 2000m,
                    CurrentBalance = 2000m,
                    MinimumBalance = 500m,
                    LienAmount = 0m,
                    Status = "Active"
                },
                new SavingAccountMaster
                {
                    SavingAccountID = 202,
                    BranchID = 1,
                    CustomerID = 102,
                    SavingSchemeID = 1,
                    LedgerID = 46,
                    AccountNo = "00130100000202",
                    OldAccountNo = "SB-202",
                    OpeningDate = new DateTime(2026, 4, 1),
                    OpeningBalance = 500m,
                    CurrentBalance = 500m,
                    MinimumBalance = 500m,
                    LienAmount = 0m,
                    Status = "Active"
                },
                new SavingAccountMaster
                {
                    SavingAccountID = 203,
                    BranchID = 1,
                    CustomerID = 103,
                    SavingSchemeID = 1,
                    LedgerID = 46,
                    AccountNo = "00130100000203",
                    OldAccountNo = "SB-203",
                    OpeningDate = new DateTime(2026, 4, 1),
                    OpeningBalance = 2500m,
                    CurrentBalance = 2500m,
                    MinimumBalance = 500m,
                    LienAmount = 0m,
                    Status = "Active"
                },
                new SavingAccountMaster
                {
                    SavingAccountID = 204,
                    BranchID = 2,
                    CustomerID = 104,
                    SavingSchemeID = 1,
                    LedgerID = 46,
                    AccountNo = "00230100000204",
                    OpeningDate = new DateTime(2026, 4, 1),
                    OpeningBalance = 1000m,
                    CurrentBalance = 1000m,
                    MinimumBalance = 500m,
                    LienAmount = 0m,
                    Status = "Active"
                },
                new SavingAccountMaster
                {
                    SavingAccountID = 205,
                    BranchID = 1,
                    CustomerID = 105,
                    SavingSchemeID = 1,
                    LedgerID = 46,
                    AccountNo = "00130100000205",
                    OpeningDate = new DateTime(2026, 4, 1),
                    OpeningBalance = 0m,
                    CurrentBalance = 0m,
                    MinimumBalance = 500m,
                    LienAmount = 0m,
                    Status = "Closed"
                },
                new SavingAccountMaster
                {
                    SavingAccountID = 206,
                    BranchID = 1,
                    CustomerID = 106,
                    SavingSchemeID = 1,
                    LedgerID = 46,
                    AccountNo = "00130100000206",
                    OpeningDate = new DateTime(2026, 4, 1),
                    OpeningBalance = 3000m,
                    CurrentBalance = 3000m,
                    MinimumBalance = 500m,
                    LienAmount = 500m,
                    Status = "Active"
                },
                new SavingAccountMaster
                {
                    SavingAccountID = 207,
                    BranchID = 1,
                    CustomerID = 106,
                    SavingSchemeID = 1,
                    LedgerID = 46,
                    AccountNo = "00130100000207",
                    OpeningDate = new DateTime(2026, 4, 1),
                    OpeningBalance = 5000m,
                    CurrentBalance = 5000m,
                    MinimumBalance = 500m,
                    LienAmount = 0m,
                    Status = "Dormant"
                }
            );

            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task SalaryJournal_ValidatesSavingLinkBranchStatus_AndStaysPendingWithLinkedPreview()
        {
            await using var db = CreateContext();
            var bizDate = new DateTime(2026, 6, 15);
            await SeedEnvironmentAsync(db, bizDate);

            var vouchersCtrl = new VouchersController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(vouchersCtrl, BuildPrincipal(11, "maker", "Accountant", branchId: 1, bizDate));

            // 1. Missing SavingAccountID & CustomerID on Saving Control Ledger (46) -> BadRequest
            var missingRes = await vouchersCtrl.PostVoucher(new Voucher
            {
                BranchID = 1,
                VoucherNo = "JV-MISS-01",
                VoucherDate = bizDate,
                VoucherType = "Journal",
                Narration = "नोकर पगार",
                TotalAmount = 15000m,
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { LedgerID = 351, DrCr = "Dr", Amount = 15000m },
                    new VoucherDetail { LedgerID = 46, DrCr = "Cr", Amount = 15000m }
                }
            });
            Assert.IsType<BadRequestObjectResult>(missingRes.Result);

            // 2. Cross-Branch SavingAccount (Branch 2 account in Branch 1 voucher) -> BadRequest
            var crossBranchRes = await vouchersCtrl.PostVoucher(new Voucher
            {
                BranchID = 1,
                VoucherNo = "JV-XBR-01",
                VoucherDate = bizDate,
                VoucherType = "Journal",
                Narration = "नोकर पगार",
                TotalAmount = 15000m,
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { LedgerID = 351, DrCr = "Dr", Amount = 15000m },
                    new VoucherDetail { LedgerID = 46, DrCr = "Cr", Amount = 15000m, SavingAccountID = 204 }
                }
            });
            Assert.IsType<BadRequestObjectResult>(crossBranchRes.Result);

            // 3. Closed SavingAccount -> BadRequest
            var closedRes = await vouchersCtrl.PostVoucher(new Voucher
            {
                BranchID = 1,
                VoucherNo = "JV-CLS-01",
                VoucherDate = bizDate,
                VoucherType = "Journal",
                Narration = "नोकर पगार",
                TotalAmount = 15000m,
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { LedgerID = 351, DrCr = "Dr", Amount = 15000m },
                    new VoucherDetail { LedgerID = 46, DrCr = "Cr", Amount = 15000m, SavingAccountID = 205 }
                }
            });
            Assert.IsType<BadRequestObjectResult>(closedRes.Result);

            // 4. Valid Salary Journal -> Saved as Pending with Zero Auto-Post
            var okAction = await vouchersCtrl.PostVoucher(new Voucher
            {
                BranchID = 1,
                VoucherNo = "JV-SAL-01",
                VoucherDate = bizDate,
                VoucherType = "Journal",
                Narration = "जून २०२६ नोकर पगार बचत खात्यावर वर्ग",
                TotalAmount = 15000m,
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { LedgerID = 351, DrCr = "Dr", Amount = 15000m },
                    new VoucherDetail { LedgerID = 46, DrCr = "Cr", Amount = 15000m, SavingAccountID = 201 }
                }
            });
            var created = Assert.IsType<CreatedAtActionResult>(okAction.Result);
            var savedVoucher = Assert.IsType<Voucher>(created.Value);

            Assert.Equal("Pending", savedVoucher.Status);
            Assert.Equal(101, savedVoucher.VoucherDetails!.Single(d => d.LedgerID == 46).CustomerID);
            Assert.Equal(2000m, (await db.SavingAccountMasters.FindAsync(201))!.CurrentBalance);
            Assert.Empty(db.SavingTransactions);

            // 5. Pending Passing Screen shows LinkedAccounts badge
            var postingCtrl = new VoucherPostingController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(postingCtrl, BuildPrincipal(22, "checker", "Admin", branchId: 1, bizDate));
            var pendingRes = await postingCtrl.GetUnpostedVouchers(branchId: 1, voucherDate: bizDate, allDates: false);
            var pendingList = Assert.IsAssignableFrom<IEnumerable<Voucher>>(pendingRes.Value).ToList();
            var pendingSal = Assert.Single(pendingList);
            Assert.Contains(pendingSal.LinkedAccounts, a => a.AccountType == "Saving" && a.AccountNo == "00130100000201" && a.OldAccountNo == "SB-201");
        }

        [Fact]
        public async Task MultiStaffSalaryAndHonorariumSplit_PostVouchersCreditsAll_IsIdempotent_AndUnpassReverses()
        {
            await using var db = CreateContext();
            var bizDate = new DateTime(2026, 6, 15);
            await SeedEnvironmentAsync(db, bizDate);

            var vouchersCtrl = new VouchersController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(vouchersCtrl, BuildPrincipal(11, "maker", "Accountant", branchId: 1, bizDate));

            // One combined Salary + Honorarium Journal split across 3 employee/officer Saving Accounts (201, 202, 203)
            var saveRes = await vouchersCtrl.PostVoucher(new Voucher
            {
                BranchID = 1,
                VoucherNo = "JV-PAYROLL-01",
                VoucherDate = bizDate,
                VoucherType = "Journal",
                Narration = "पगार व वसूली अधिकारी मानधन बचत वर्ग",
                TotalAmount = 25000m,
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { LedgerID = 351, DrCr = "Dr", Amount = 20000m },
                    new VoucherDetail { LedgerID = 352, DrCr = "Dr", Amount = 5000m },
                    new VoucherDetail { LedgerID = 46, DrCr = "Cr", Amount = 12000m, SavingAccountID = 201 },
                    new VoucherDetail { LedgerID = 46, DrCr = "Cr", Amount = 8000m, SavingAccountID = 202 },
                    new VoucherDetail { LedgerID = 46, DrCr = "Cr", Amount = 5000m, SavingAccountID = 203 }
                }
            });
            var created = Assert.IsType<CreatedAtActionResult>(saveRes.Result);
            var voucher = Assert.IsType<Voucher>(created.Value);

            // Checker approves via PostVouchers
            var postingCtrl = new VoucherPostingController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(postingCtrl, BuildPrincipal(22, "checker", "Admin", branchId: 1, bizDate));

            var postRes = await postingCtrl.PostVouchers(new VoucherPostingController.PostVouchersRequest
            {
                VoucherIds = new List<int> { voucher.VoucherID },
                BusinessDate = bizDate
            });
            Assert.IsType<OkObjectResult>(postRes);

            Assert.Equal("Approved", (await db.Vouchers.FindAsync(voucher.VoucherID))!.Status);
            Assert.Equal(14000m, (await db.SavingAccountMasters.FindAsync(201))!.CurrentBalance);
            Assert.Equal(8500m, (await db.SavingAccountMasters.FindAsync(202))!.CurrentBalance);
            Assert.Equal(7500m, (await db.SavingAccountMasters.FindAsync(203))!.CurrentBalance);

            var savTxns = await db.SavingTransactions.Where(st => st.VoucherID == voucher.VoucherID).ToListAsync();
            Assert.Equal(3, savTxns.Count);
            Assert.All(savTxns, st =>
            {
                Assert.Equal("Deposit", st.TransactionType);
                Assert.Equal("Transfer", st.PaymentMode);
                Assert.Equal("JV-PAYROLL-01", st.VoucherNo);
                Assert.Contains("नोकर पगार", st.Narration);
            });

            // Re-running ApplyApprovedVoucherSavingTransfersAsync must be strictly idempotent
            await VoucherSavingTransferHelper.ApplyApprovedVoucherSavingTransfersAsync(db, voucher, 22);
            Assert.Equal(3, await db.SavingTransactions.CountAsync(st => st.VoucherID == voucher.VoucherID));
            Assert.Equal(14000m, (await db.SavingAccountMasters.FindAsync(201))!.CurrentBalance);

            // Unpass reverts all 3 Saving Accounts and removes SavingTransactions cleanly
            var unpassRes = await postingCtrl.UnpassVouchers(new VoucherPostingController.UnpassVouchersRequest
            {
                VoucherIds = new List<int> { voucher.VoucherID },
                Reason = "Salary amount correction"
            });
            Assert.IsType<OkObjectResult>(unpassRes);

            var unpassedVoucher = await db.Vouchers.FindAsync(voucher.VoucherID);
            Assert.Equal("Pending", unpassedVoucher!.Status);
            Assert.Null(unpassedVoucher.ScrollNo);
            Assert.Empty(db.SavingTransactions);
            Assert.Equal(2000m, (await db.SavingAccountMasters.FindAsync(201))!.CurrentBalance);
            Assert.Equal(500m, (await db.SavingAccountMasters.FindAsync(202))!.CurrentBalance);
            Assert.Equal(2500m, (await db.SavingAccountMasters.FindAsync(203))!.CurrentBalance);
        }

        [Fact]
        public async Task UnpassVouchers_BlockedIfCreditedSavingFundsWereAlreadyWithdrawn()
        {
            await using var db = CreateContext();
            var bizDate = new DateTime(2026, 6, 15);
            await SeedEnvironmentAsync(db, bizDate);

            var vouchersCtrl = new VouchersController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(vouchersCtrl, BuildPrincipal(11, "maker", "Accountant", branchId: 1, bizDate));

            var saveRes = await vouchersCtrl.PostVoucher(new Voucher
            {
                BranchID = 1,
                VoucherNo = "JV-SAL-WD-01",
                VoucherDate = bizDate,
                VoucherType = "Journal",
                Narration = "मानधन वर्ग",
                TotalAmount = 5000m,
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { LedgerID = 352, DrCr = "Dr", Amount = 5000m },
                    new VoucherDetail { LedgerID = 46, DrCr = "Cr", Amount = 5000m, SavingAccountID = 202 }
                }
            });
            var voucher = Assert.IsType<Voucher>(Assert.IsType<CreatedAtActionResult>(saveRes.Result).Value);

            var postingCtrl = new VoucherPostingController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(postingCtrl, BuildPrincipal(22, "checker", "Admin", branchId: 1, bizDate));

            Assert.IsType<OkObjectResult>(await postingCtrl.PostVouchers(new VoucherPostingController.PostVouchersRequest
            {
                VoucherIds = new List<int> { voucher.VoucherID },
                BusinessDate = bizDate
            }));

            // Officer withdraws most of the credited balance, leaving only ₹1,000
            var savAcc = await db.SavingAccountMasters.FindAsync(202);
            savAcc!.CurrentBalance = 1000m;
            await db.SaveChangesAsync();

            // Unpass must fail and keep voucher Approved + balance untouched
            var unpassRes = await postingCtrl.UnpassVouchers(new VoucherPostingController.UnpassVouchersRequest
            {
                VoucherIds = new List<int> { voucher.VoucherID },
                Reason = "Should fail"
            });
            var objRes = Assert.IsAssignableFrom<ObjectResult>(unpassRes);
            Assert.NotEqual(200, objRes.StatusCode);

            Assert.Equal("Approved", (await db.Vouchers.FindAsync(voucher.VoucherID))!.Status);
            Assert.Equal(1000m, (await db.SavingAccountMasters.FindAsync(202))!.CurrentBalance);
            Assert.Single(db.SavingTransactions);
        }

        [Fact]
        public async Task DebitFromSavingAccount_EnforcesAvailableBalanceAndDormant_ApprovesViaVouchersController_AndRollsBack()
        {
            await using var db = CreateContext();
            var bizDate = new DateTime(2026, 6, 15);
            await SeedEnvironmentAsync(db, bizDate);

            var rollback = new VoucherRollbackAndDeleteService(db);
            var vouchersCtrl = new VouchersController(db, rollback);
            AttachUser(vouchersCtrl, BuildPrincipal(11, "maker", "Accountant", branchId: 1, bizDate));

            // Account 206 has CurrentBalance=3000, MinBalance=500, Lien=500 => AvailableBalance=2000
            var overLimitRes = await vouchersCtrl.PostVoucher(new Voucher
            {
                BranchID = 1,
                VoucherNo = "JV-SB-DR-OVER",
                VoucherDate = bizDate,
                VoucherType = "Journal",
                Narration = "बचत कपात",
                TotalAmount = 2200m,
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { LedgerID = 46, DrCr = "Dr", Amount = 2200m, SavingAccountID = 206 },
                    new VoucherDetail { LedgerID = 144, DrCr = "Cr", Amount = 2200m }
                }
            });
            Assert.IsType<BadRequestObjectResult>(overLimitRes.Result);

            // Account 207 is Dormant => Dr must be rejected
            var dormantRes = await vouchersCtrl.PostVoucher(new Voucher
            {
                BranchID = 1,
                VoucherNo = "JV-SB-DR-DORM",
                VoucherDate = bizDate,
                VoucherType = "Journal",
                Narration = "बचत कपात",
                TotalAmount = 500m,
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { LedgerID = 46, DrCr = "Dr", Amount = 500m, SavingAccountID = 207 },
                    new VoucherDetail { LedgerID = 144, DrCr = "Cr", Amount = 500m }
                }
            });
            Assert.IsType<BadRequestObjectResult>(dormantRes.Result);

            // Valid Dr ₹1,500 on 206
            var validSave = await vouchersCtrl.PostVoucher(new Voucher
            {
                BranchID = 1,
                VoucherNo = "JV-SB-DR-OK",
                VoucherDate = bizDate,
                VoucherType = "Journal",
                Narration = "मानधन समायोजन बचत नावे",
                TotalAmount = 1500m,
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { LedgerID = 46, DrCr = "Dr", Amount = 1500m, SavingAccountID = 206 },
                    new VoucherDetail { LedgerID = 144, DrCr = "Cr", Amount = 1500m }
                }
            });
            var voucher = Assert.IsType<Voucher>(Assert.IsType<CreatedAtActionResult>(validSave.Result).Value);

            // Approve directly via VouchersController.ApproveVoucher
            AttachUser(vouchersCtrl, BuildPrincipal(22, "checker", "Admin", branchId: 1, bizDate));
            var appRes = await vouchersCtrl.ApproveVoucher(voucher.VoucherID, new VouchersController.ApprovalDto
            {
                ApprovedBy = 22,
                BusinessDate = bizDate
            });
            Assert.IsType<OkObjectResult>(appRes);

            Assert.Equal(1500m, (await db.SavingAccountMasters.FindAsync(206))!.CurrentBalance);
            var wdTxn = Assert.Single(db.SavingTransactions);
            Assert.Equal("Withdrawal", wdTxn.TransactionType);
            Assert.Equal("Transfer", wdTxn.PaymentMode);
            Assert.Equal(voucher.VoucherID, wdTxn.VoucherID);

            // Unpass + Reject/Delete restores exact ₹3,000 balance
            var postingCtrl = new VoucherPostingController(db, rollback);
            AttachUser(postingCtrl, BuildPrincipal(22, "checker", "Admin", branchId: 1, bizDate));

            Assert.IsType<OkObjectResult>(await postingCtrl.UnpassVouchers(new VoucherPostingController.UnpassVouchersRequest
            {
                VoucherIds = new List<int> { voucher.VoucherID },
                Reason = "Rollback deduction test"
            }));
            Assert.Equal(3000m, (await db.SavingAccountMasters.FindAsync(206))!.CurrentBalance);

            Assert.IsType<OkObjectResult>(await postingCtrl.RejectVoucher(
                voucher.VoucherID,
                new VoucherPostingController.VoucherRejectDto { Reason = "Clean delete after unpass" }));
            Assert.Null(await db.Vouchers.FindAsync(voucher.VoucherID));
            Assert.Empty(db.SavingTransactions);
        }

        [Fact]
        public async Task GetSavingControlLedgers_ReturnsOnlySavingLiabilityControlLedgers()
        {
            await using var db = CreateContext();
            await SeedEnvironmentAsync(db, new DateTime(2026, 6, 15));

            var vouchersCtrl = new VouchersController(db, new VoucherRollbackAndDeleteService(db));
            var res = await vouchersCtrl.GetSavingControlLedgers();
            var okRes = Assert.IsType<OkObjectResult>(res.Result);

            var json = System.Text.Json.JsonSerializer.Serialize(okRes.Value);
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            var ids = doc.RootElement.GetProperty("ledgerIds").EnumerateArray().Select(e => e.GetInt32()).ToList();

            var singleId = Assert.Single(ids);
            Assert.Equal(46, singleId);
        }

        [Fact]
        public async Task ExistingModuleSavingTransaction_SameVoucherNo_NeverDoublePostsOnApproval()
        {
            await using var db = CreateContext();
            var bizDate = new DateTime(2026, 6, 15);
            await SeedEnvironmentAsync(db, bizDate);

            // Simulate a Loan Disbursement voucher whose SavingTransaction was already created by the Loan module under VoucherNo = "PAY-LN-001"
            db.SavingTransactions.Add(new SavingTransaction
            {
                TransactionID = 9001,
                SavingAccountID = 201,
                CustomerID = 101,
                BranchID = 1,
                TransactionDate = bizDate,
                TransactionType = "Deposit",
                PaymentMode = "Transfer",
                Amount = 10000m,
                BalanceAfterTxn = 12000m,
                VoucherNo = "PAY-LN-001"
            });
            var sav201 = await db.SavingAccountMasters.FindAsync(201);
            sav201!.CurrentBalance = 12000m;

            var voucher = new Voucher
            {
                VoucherID = 777,
                BranchID = 1,
                VoucherNo = "PAY-LN-001",
                VoucherDate = bizDate,
                VoucherType = "Journal",
                Status = "Approved",
                TotalAmount = 10000m,
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { VoucherID = 777, LedgerID = 144, DrCr = "Dr", Amount = 10000m },
                    new VoucherDetail { VoucherID = 777, LedgerID = 46, DrCr = "Cr", Amount = 10000m, SavingAccountID = 201 }
                }
            };
            db.Vouchers.Add(voucher);
            await db.SaveChangesAsync();

            await VoucherSavingTransferHelper.ApplyApprovedVoucherSavingTransfersAsync(db, voucher, 22);

            Assert.Equal(1, await db.SavingTransactions.CountAsync());
            Assert.Equal(12000m, (await db.SavingAccountMasters.FindAsync(201))!.CurrentBalance);
        }
    }
}
