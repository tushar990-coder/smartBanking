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
using Xunit;

namespace Bhisi.Api.Tests
{
    public class LoanPenalInterestAndRecoveryTests
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

        private static async Task SeedBaseLedgersAndBranchAsync(AppDbContext db, DateTime refDate)
        {
            db.Branches.Add(new Branch { BranchID = 1, BranchName = "मुख्य शाखा", BranchCode = "HQ", DefaultCashLedgerID = 1 });
            db.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "26-27",
                StartDate = new DateTime(refDate.Year, 1, 1),
                EndDate = new DateTime(refDate.Year + 1, 12, 31),
                IsActive = true
            });
            db.AccountGroups.AddRange(
                new AccountGroup { GroupID = 1, GroupName = "Assets", NatureOfGroup = "Assets" },
                new AccountGroup { GroupID = 2, GroupName = "Income", NatureOfGroup = "Income" },
                new AccountGroup { GroupID = 3, GroupName = "Expenses", NatureOfGroup = "Expenses" }
            );
            db.Ledgers.AddRange(
                new Ledger { LedgerID = 1, GroupID = 1, LedgerCode = "CSH-1", LedgerName = "हातातील रोख शिल्लक", AccountType = "Cash In Hand", IsActive = true },
                new Ledger { LedgerID = 115, GroupID = 1, LedgerCode = "LN-REC", LedgerName = "येणे कर्ज व्याज खाते", AccountType = "Asset", IsActive = true },
                new Ledger { LedgerID = 201, GroupID = 1, LedgerCode = "LN-P", LedgerName = "मेंबर कर्ज खाते", AccountType = "Asset", IsActive = true },
                new Ledger { LedgerID = 301, GroupID = 2, LedgerCode = "LN-INT", LedgerName = "कर्ज व्याज उत्पन्न", AccountType = "Income", IsActive = true },
                new Ledger { LedgerID = 305, GroupID = 2, LedgerCode = "LN-PEN", LedgerName = "दंड व्याज उत्पन्न", AccountType = "Income", IsActive = true }
            );
            db.Customers.Add(new Customer
            {
                CustomerID = 10,
                BranchID = 1,
                FirstName = "अच्युत",
                LastName = "यादव"
            });
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task PutLoanRate_MultipleSchemesSharingSameLoanType_UpdatesPenalInterestRateGraceDaysAndLedgers()
        {
            using var db = GetInMemoryDbContext(nameof(PutLoanRate_MultipleSchemesSharingSameLoanType_UpdatesPenalInterestRateGraceDaysAndLedgers));
            await SeedBaseLedgersAndBranchAsync(db, new DateTime(2026, 4, 1));

            db.LoanRates.AddRange(
                new LoanRate
                {
                    LoanRateID = 1,
                    LoanType = "तारणी",
                    LoanCode = "LN01",
                    ShortName = "मेंबर कर्ज",
                    LoanLedgerID = 201,
                    InterestLedgerID = 301,
                    InterestRate = 15m,
                    OverdueInterestRate = 0m,
                    IsActive = true
                },
                new LoanRate
                {
                    LoanRateID = 2,
                    LoanType = "तारणी",
                    LoanCode = "LN02",
                    ShortName = "सोने तारण",
                    LoanLedgerID = 201,
                    InterestLedgerID = 301,
                    InterestRate = 12m,
                    OverdueInterestRate = 2m,
                    IsActive = true
                }
            );
            await db.SaveChangesAsync();

            var ctrl = new LoanRatesController(db) { ControllerContext = BuildAdminContext() };
            var updatedRate = new LoanRate
            {
                LoanRateID = 1,
                LoanType = "तारणी",
                LoanCode = "LN01",
                ShortName = "मेंबर कर्ज",
                LoanLedgerID = 201,
                InterestLedgerID = 301,
                OverdueInterestLedgerID = 305,
                ReceivableInterestLedgerID = 115,
                InterestRate = 15m,
                OverdueInterestRate = 2.50m,
                PenalInterestGraceDays = 7,
                PenalInterestBasis = "TotalPrincipal",
                AllowManualPenalInRecovery = true,
                DurationMonths = 12,
                InstallmentCount = 12,
                InterestPostingType = "कर्जावर",
                ResolutionNo = "ठराव क्र. ४५/२०२६",
                ResolutionDate = new DateTime(2026, 4, 1),
                EffectiveDate = new DateTime(2026, 4, 1),
                IsActive = true
            };

            var res = await ctrl.PutLoanRate(1, updatedRate);
            Assert.IsType<NoContentResult>(res);

            var saved = await db.LoanRates.AsNoTracking().FirstAsync(r => r.LoanRateID == 1);
            Assert.Equal(2.50m, saved.OverdueInterestRate);
            Assert.Equal(305, saved.OverdueInterestLedgerID);
            Assert.Equal(7, saved.PenalInterestGraceDays);
            Assert.Equal("TotalPrincipal", saved.PenalInterestBasis);
            Assert.True(saved.AllowManualPenalInRecovery);
            Assert.Single(await db.LoanRateHistories.ToListAsync());
        }

        [Fact]
        public void LoanPenalInterestHelper_RespectsGraceDaysBasesAndPreDisbursementDate()
        {
            var rate = new LoanRate
            {
                LoanRateID = 1,
                OverdueInterestRate = 2.00m,
                PenalInterestGraceDays = 5,
                PenalInterestBasis = LoanPenalInterestHelper.BasisOverduePrincipal
            };

            var loan = new LoanAccount
            {
                LoanAccountID = 50,
                SanctionedAmount = 100000m,
                PrincipalBalance = 80000m,
                PurePrincipalBalance = 80000m,
                InterestRate = 12m,
                DurationMonths = 12,
                OpeningDate = new DateTime(2026, 1, 1),
                LoanDisbursementDate = new DateTime(2026, 1, 1),
                MaturityDate = new DateTime(2027, 1, 1),
                Status = "Active"
            };

            var schedules = new List<LoanInstallmentSchedule>
            {
                new LoanInstallmentSchedule
                {
                    LoanAccountID = 50,
                    InstallmentNo = 1,
                    DueDate = new DateTime(2026, 4, 30),
                    PrincipalAmount = 20000m,
                    InterestAmount = 1500m,
                    TotalAmount = 21500m,
                    Status = "Pending"
                }
            };

            // Before disbursement (e.g., 2025-12-01 < 2026-01-01): 0 penal
            var preDisbSnap = LoanPenalInterestHelper.ComputePenalSnapshot(loan, rate, schedules, new DateTime(2025, 12, 1));
            Assert.Equal(0m, preDisbSnap.EstimatedAccruedPenalInterest);

            // As of 2026-06-30 => 61 overdue days minus 5 grace days = 56 effective days
            var overdueSnap = LoanPenalInterestHelper.ComputePenalSnapshot(loan, rate, schedules, new DateTime(2026, 6, 30));
            Assert.Equal(61, overdueSnap.OverdueDays);
            Assert.Equal(56, overdueSnap.EffectivePenalDays);
            // 20000 * 2% * 56 / 36500 = 61.369 -> 61
            Assert.Equal(61m, overdueSnap.EstimatedAccruedPenalInterest);

            // TotalPrincipal basis => 80000 * 2% * 56 / 36500 = 245.479 -> 245
            rate.PenalInterestBasis = LoanPenalInterestHelper.BasisTotalPrincipal;
            var totalPrinSnap = LoanPenalInterestHelper.ComputePenalSnapshot(loan, rate, schedules, new DateTime(2026, 6, 30));
            Assert.Equal(245m, totalPrinSnap.EstimatedAccruedPenalInterest);

            // OverdueEmi basis => 21500 * 2% * 56 / 36500 = 65.97 -> 66
            rate.PenalInterestBasis = LoanPenalInterestHelper.BasisOverdueEmi;
            var emiSnap = LoanPenalInterestHelper.ComputePenalSnapshot(loan, rate, schedules, new DateTime(2026, 6, 30));
            Assert.Equal(66m, emiSnap.EstimatedAccruedPenalInterest);
        }

        [Fact]
        public async Task GetAccountDetailsAndSchedule_WithAsOfDate_ReturnsAccruedPenalAndPolicy()
        {
            using var db = GetInMemoryDbContext(nameof(GetAccountDetailsAndSchedule_WithAsOfDate_ReturnsAccruedPenalAndPolicy));
            await SeedBaseLedgersAndBranchAsync(db, new DateTime(2026, 4, 1));

            db.LoanRates.Add(new LoanRate
            {
                LoanRateID = 1,
                LoanType = "तारणी",
                LoanCode = "LN01",
                ShortName = "मेंबर कर्ज",
                InterestRate = 15m,
                OverdueInterestRate = 3m,
                PenalInterestGraceDays = 2,
                PenalInterestBasis = "OverduePrincipal",
                AllowManualPenalInRecovery = true,
                LoanLedgerID = 201,
                InterestLedgerID = 301,
                OverdueInterestLedgerID = 305,
                IsActive = true
            });
            db.LoanAccounts.Add(new LoanAccount
            {
                LoanAccountID = 10,
                BranchID = 1,
                CustomerID = 10,
                LoanRateID = 1,
                LoanAccountNo = "001-LN-10",
                SanctionedAmount = 50000m,
                PrincipalBalance = 50000m,
                PurePrincipalBalance = 50000m,
                InterestRate = 15m,
                DurationMonths = 12,
                OpeningDate = new DateTime(2026, 1, 1),
                LoanDisbursementDate = new DateTime(2026, 1, 1),
                MaturityDate = new DateTime(2027, 1, 1),
                Status = "Active"
            });
            db.LoanInstallmentSchedules.Add(new LoanInstallmentSchedule
            {
                LoanAccountID = 10,
                InstallmentNo = 1,
                DueDate = new DateTime(2026, 5, 1),
                PrincipalAmount = 25000m,
                InterestAmount = 500m,
                TotalAmount = 25500m,
                Status = "Pending"
            });
            await db.SaveChangesAsync();

            var ctrl = new LoanAccountsController(db) { ControllerContext = BuildAdminContext() };
            var res = await ctrl.GetAccountDetailsAndSchedule(10, new DateTime(2026, 6, 30));
            var dto = Assert.IsType<AccountDetailsAndScheduleDto>(res.Value);

            // 60 overdue days - 2 grace = 58 days; 25000 * 3% * 58 / 36500 = 119.17 -> 119
            Assert.Equal(58, dto.PenalOverdueDays);
            Assert.Equal(119m, dto.AccruedPenalInterest);
            Assert.Equal(119m, dto.EffectivePenalInterestDue);
            Assert.Equal(3m, dto.PenalInterestRate);
            Assert.True(dto.AllowManualPenalInRecovery);
        }

        [Fact]
        public async Task PostLoanCollection_ManualPenalWhenOverdueBalanceIsZero_SavesAndRollbackLeavesZeroBalance()
        {
            using var db = GetInMemoryDbContext(nameof(PostLoanCollection_ManualPenalWhenOverdueBalanceIsZero_SavesAndRollbackLeavesZeroBalance));
            var colDate = new DateTime(2026, 6, 15);
            await SeedBaseLedgersAndBranchAsync(db, colDate);

            db.LoanRates.Add(new LoanRate
            {
                LoanRateID = 1,
                LoanType = "तारणी",
                LoanCode = "LN01",
                ShortName = "मेंबर कर्ज",
                InterestRate = 15m,
                OverdueInterestRate = 2m,
                AllowManualPenalInRecovery = true,
                LoanLedgerID = 201,
                InterestLedgerID = 301,
                OverdueInterestLedgerID = 305,
                IsActive = true
            });
            db.LoanAccounts.Add(new LoanAccount
            {
                LoanAccountID = 1047,
                BranchID = 1,
                CustomerID = 10,
                LoanRateID = 1,
                LoanAccountNo = "001--0-012010000591",
                SanctionedAmount = 12000m,
                PrincipalBalance = 12000m,
                PurePrincipalBalance = 12000m,
                InterestBalance = 0m,
                OverdueInterestBalance = 0m,
                InterestRate = 15m,
                DurationMonths = 12,
                OpeningDate = new DateTime(2026, 5, 2),
                LoanDisbursementDate = new DateTime(2026, 5, 2),
                MaturityDate = new DateTime(2027, 5, 2),
                Status = "Active"
            });
            await db.SaveChangesAsync();

            var rollbackSvc = new VoucherRollbackAndDeleteService(db);
            var ctrl = new LoanCollectionsController(db, rollbackSvc) { ControllerContext = BuildAdminContext() };

            var collection = new LoanCollection
            {
                LoanAccountID = 1047,
                BranchID = 1,
                CollectionDate = colDate,
                PaymentMode = "Cash",
                TotalAmountReceived = 12100m,
                PrincipalCollected = 12000m,
                ReceivableInterestCollected = 0m,
                InterestCollected = 0m,
                PenaltyInterestCollected = 100m,
                SurchargeCollected = 0m
            };

            var postRes = await ctrl.PostLoanCollection(collection);
            Assert.IsType<CreatedAtActionResult>(postRes.Result);

            var savedLoan = await db.LoanAccounts.AsNoTracking().FirstAsync(l => l.LoanAccountID == 1047);
            Assert.Equal(0m, savedLoan.PrincipalBalance);
            Assert.Equal(0m, savedLoan.OverdueInterestBalance);
            Assert.Equal("Closed", savedLoan.Status);

            var savedCol = await db.LoanCollections.AsNoTracking().FirstAsync();
            Assert.Equal(100m, savedCol.PenaltyInterestCollected);
            Assert.Equal(0m, savedCol.BookedPenaltySettled);

            var vDetails = await db.VoucherDetails.AsNoTracking().ToListAsync();
            Assert.Equal(12100m, vDetails.First(vd => vd.DrCr == "Dr" && vd.LedgerID == 1).Amount);
            Assert.Equal(12000m, vDetails.First(vd => vd.DrCr == "Cr" && vd.LedgerID == 201).Amount);
            Assert.Equal(100m, vDetails.First(vd => vd.DrCr == "Cr" && vd.LedgerID == 305).Amount);

            // Rollback/Delete receipt must NOT create phantom OverdueInterestBalance = 100
            var delRes = await ctrl.DeleteLoanCollection(savedCol.LoanCollectionID);
            Assert.IsType<OkObjectResult>(delRes);

            var restoredLoan = await db.LoanAccounts.AsNoTracking().FirstAsync(l => l.LoanAccountID == 1047);
            Assert.Equal(12000m, restoredLoan.PrincipalBalance);
            Assert.Equal(0m, restoredLoan.OverdueInterestBalance);
            Assert.Equal("Active", restoredLoan.Status);
        }

        [Fact]
        public async Task PostLoanCollection_PreBookedPlusManualPenal_RestoresOnlyBookedAndRespectsDisabledManualFlag()
        {
            using var db = GetInMemoryDbContext(nameof(PostLoanCollection_PreBookedPlusManualPenal_RestoresOnlyBookedAndRespectsDisabledManualFlag));
            var colDate = new DateTime(2026, 6, 20);
            await SeedBaseLedgersAndBranchAsync(db, colDate);

            db.LoanRates.AddRange(
                new LoanRate
                {
                    LoanRateID = 1,
                    LoanType = "तारणी",
                    LoanCode = "LN01",
                    ShortName = "Scheme Manual Allowed",
                    InterestRate = 12m,
                    OverdueInterestRate = 2m,
                    AllowManualPenalInRecovery = true,
                    LoanLedgerID = 201,
                    InterestLedgerID = 301,
                    OverdueInterestLedgerID = 305,
                    IsActive = true
                },
                new LoanRate
                {
                    LoanRateID = 2,
                    LoanType = "विनातारणी",
                    LoanCode = "LN02",
                    ShortName = "Scheme Manual Blocked",
                    InterestRate = 12m,
                    OverdueInterestRate = 0m,
                    AllowManualPenalInRecovery = false,
                    LoanLedgerID = 201,
                    InterestLedgerID = 301,
                    OverdueInterestLedgerID = 305,
                    IsActive = true
                }
            );
            db.LoanAccounts.AddRange(
                new LoanAccount
                {
                    LoanAccountID = 2001,
                    BranchID = 1,
                    CustomerID = 10,
                    LoanRateID = 1,
                    LoanAccountNo = "LN-2001",
                    SanctionedAmount = 10000m,
                    PrincipalBalance = 5000m,
                    PurePrincipalBalance = 5000m,
                    OverdueInterestBalance = 150m, // pre-booked
                    InterestRate = 12m,
                    OpeningDate = new DateTime(2026, 5, 1),
                    LoanDisbursementDate = new DateTime(2026, 5, 1),
                    MaturityDate = new DateTime(2027, 5, 1),
                    Status = "Active"
                },
                new LoanAccount
                {
                    LoanAccountID = 2002,
                    BranchID = 1,
                    CustomerID = 10,
                    LoanRateID = 2,
                    LoanAccountNo = "LN-2002",
                    SanctionedAmount = 10000m,
                    PrincipalBalance = 5000m,
                    PurePrincipalBalance = 5000m,
                    OverdueInterestBalance = 0m,
                    InterestRate = 12m,
                    OpeningDate = new DateTime(2026, 5, 1),
                    LoanDisbursementDate = new DateTime(2026, 5, 1),
                    MaturityDate = new DateTime(2027, 5, 1),
                    Status = "Active"
                }
            );
            await db.SaveChangesAsync();

            var rollbackSvc = new VoucherRollbackAndDeleteService(db);
            var ctrl = new LoanCollectionsController(db, rollbackSvc) { ControllerContext = BuildAdminContext() };

            // 1. Scheme with AllowManualPenalInRecovery=false blocks 100 when max system penal is 0
            var blockedRes = await ctrl.PostLoanCollection(new LoanCollection
            {
                LoanAccountID = 2002,
                BranchID = 1,
                CollectionDate = colDate,
                PaymentMode = "Cash",
                TotalAmountReceived = 100m,
                PenaltyInterestCollected = 100m
            });
            Assert.IsType<BadRequestObjectResult>(blockedRes.Result);

            // 2. Hybrid recovery on 2001: 150 pre-booked + 100 extra manual = 250 collected
            var okRes = await ctrl.PostLoanCollection(new LoanCollection
            {
                LoanAccountID = 2001,
                BranchID = 1,
                CollectionDate = colDate,
                PaymentMode = "Cash",
                TotalAmountReceived = 250m,
                PenaltyInterestCollected = 250m
            });
            Assert.IsType<CreatedAtActionResult>(okRes.Result);

            var col = await db.LoanCollections.AsNoTracking().FirstAsync(c => c.LoanAccountID == 2001);
            Assert.Equal(150m, col.BookedPenaltySettled);
            Assert.Equal(0m, (await db.LoanAccounts.AsNoTracking().FirstAsync(l => l.LoanAccountID == 2001)).OverdueInterestBalance);

            // Rollback must restore ONLY 150m (not 250m!)
            var delRes = await ctrl.DeleteLoanCollection(col.LoanCollectionID);
            Assert.IsType<OkObjectResult>(delRes);
            Assert.Equal(150m, (await db.LoanAccounts.AsNoTracking().FirstAsync(l => l.LoanAccountID == 2001)).OverdueInterestBalance);
        }

        [Fact]
        public async Task PostInterestBatch_WithIncludePenalInterest_BooksOverdueBalanceAndRollsBackCleanly()
        {
            using var db = GetInMemoryDbContext(nameof(PostInterestBatch_WithIncludePenalInterest_BooksOverdueBalanceAndRollsBackCleanly));
            var postDate = new DateTime(2026, 6, 30);
            await SeedBaseLedgersAndBranchAsync(db, postDate);

            db.LoanRates.Add(new LoanRate
            {
                LoanRateID = 1,
                LoanType = "तारणी",
                LoanCode = "LN01",
                ShortName = "मेंबर कर्ज",
                InterestRate = 12m,
                OverdueInterestRate = 2m,
                PenalInterestGraceDays = 0,
                PenalInterestBasis = "OverduePrincipal",
                InterestPostingType = "येणे व्याजावर",
                LoanLedgerID = 201,
                InterestLedgerID = 301,
                ReceivableInterestLedgerID = 115,
                OverdueInterestLedgerID = 305,
                IsActive = true
            });
            db.LoanAccounts.Add(new LoanAccount
            {
                LoanAccountID = 3001,
                BranchID = 1,
                CustomerID = 10,
                LoanRateID = 1,
                LoanAccountNo = "LN-3001",
                SanctionedAmount = 100000m,
                PrincipalBalance = 100000m,
                PurePrincipalBalance = 100000m,
                InterestBalance = 0m,
                OverdueInterestBalance = 0m,
                InterestRate = 12m,
                DurationMonths = 12,
                OpeningDate = new DateTime(2026, 1, 1),
                LoanDisbursementDate = new DateTime(2026, 1, 1),
                LastInstallmentPaidDate = new DateTime(2026, 3, 31),
                MaturityDate = new DateTime(2027, 1, 1),
                Status = "Active"
            });
            db.LoanInstallmentSchedules.Add(new LoanInstallmentSchedule
            {
                LoanAccountID = 3001,
                InstallmentNo = 4,
                DueDate = new DateTime(2026, 4, 30),
                PrincipalAmount = 25000m,
                InterestAmount = 1000m,
                TotalAmount = 26000m,
                Status = "Pending"
            });
            await db.SaveChangesAsync();

            var ctrl = new LoanAccountsController(db) { ControllerContext = BuildAdminContext() };
            var req = new LoanInterestPostingRequestDto
            {
                BranchID = 1,
                LoanRateID = 1,
                PostingDate = postDate,
                PostingMode = "SchemeDefault",
                IncludePenalInterest = true
            };

            var prevRes = await ctrl.PreviewInterestPosting(req);
            var prevOk = Assert.IsType<OkObjectResult>(prevRes);
            var prevJson = System.Text.Json.JsonSerializer.SerializeToElement(prevOk.Value);
            Assert.True(prevJson.GetProperty("totalPenalInterest").GetDecimal() > 0m);

            var postRes = await ctrl.PostInterestBatch(req);
            var ok = Assert.IsType<OkObjectResult>(postRes);
            var postJson = System.Text.Json.JsonSerializer.SerializeToElement(ok.Value);
            decimal postedPenal = postJson.GetProperty("totalBatchPenal").GetDecimal();
            // 25000 * 2% * 61 / 36500 = 83.56 -> 84
            Assert.Equal(84m, postedPenal);

            var updatedAcc = await db.LoanAccounts.AsNoTracking().FirstAsync(l => l.LoanAccountID == 3001);
            Assert.Equal(84m, updatedAcc.OverdueInterestBalance);
            Assert.Equal(postDate.Date, updatedAcc.LastPenalPostingDate);

            // Rollback voucher must reverse both regular and penal interest cleanly
            var voucher = await db.Vouchers.AsNoTracking().FirstAsync();
            var rollbackSvc = new VoucherRollbackAndDeleteService(db);
            var delRes = await rollbackSvc.DeleteVoucherWithRollbackAsync(voucher.VoucherID, new VoucherDeleteRequestContext
            {
                UserId = 1,
                Username = "admin",
                UserRole = "Admin",
                UserBranchId = 1,
                IsHeadOfficeAdmin = true,
                Reason = "Test rollback"
            });
            Assert.True(delRes.Success, delRes.Message);

            var rolledAcc = await db.LoanAccounts.AsNoTracking().FirstAsync(l => l.LoanAccountID == 3001);
            Assert.Equal(0m, rolledAcc.OverdueInterestBalance);
            Assert.Null(rolledAcc.LastPenalPostingDate);
        }
    }
}
