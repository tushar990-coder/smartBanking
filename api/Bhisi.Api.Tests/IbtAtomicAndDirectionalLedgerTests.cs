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
    public class IbtAtomicAndDirectionalLedgerTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"BhisiIbtQa_{Guid.NewGuid()}")
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

        private static async Task SeedMultiBranchIbtEnvironmentAsync(AppDbContext db)
        {
            db.AccountGroups.AddRange(
                new AccountGroup { GroupID = 1, GroupName = "Assets", NatureOfGroup = "Assets", IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "Liabilities", NatureOfGroup = "Liabilities", IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 10, GroupID = 1, LedgerCode = "CSH-1", LedgerName = "Cash Branch 1", AccountType = "Cash", IsActive = true },
                new Ledger { LedgerID = 20, GroupID = 1, LedgerCode = "CSH-2", LedgerName = "Cash Branch 2", AccountType = "Cash", IsActive = true },
                new Ledger { LedgerID = 30, GroupID = 2, LedgerCode = "SB-CTRL", LedgerName = "Saving Deposits Control", AccountType = "Liability", IsActive = true },
                new Ledger { LedgerID = 101, GroupID = 2, LedgerCode = "IBT-B1", LedgerName = "IBT Account - Branch 1", AccountType = "Nominal", IsActive = true },
                new Ledger { LedgerID = 202, GroupID = 2, LedgerCode = "IBT-B2", LedgerName = "IBT Account - Branch 2", AccountType = "Nominal", IsActive = true }
            );

            db.Branches.AddRange(
                new Branch
                {
                    BranchID = 1,
                    BranchCode = "HO",
                    BranchName = "Head Office Pune",
                    BranchType = "HeadOffice",
                    DefaultCashLedgerID = 10,
                    DefaultIbtLedgerID = 101,
                    IsActive = true
                },
                new Branch
                {
                    BranchID = 2,
                    BranchCode = "SSW",
                    BranchName = "Saswad Branch",
                    BranchType = "Branch",
                    DefaultCashLedgerID = 20,
                    DefaultIbtLedgerID = 202,
                    IsActive = true
                }
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

            db.Customers.Add(new Customer
            {
                CustomerID = 1,
                BranchID = 1,
                CIFNo = "CIF000001",
                FirstName = "Patil",
                LastName = "Home",
                IsDeleted = false
            });

            db.SavingInterestSettings.Add(new SavingInterestSetting
            {
                SettingID = 1,
                SchemeName = "Regular Saving",
                SchemeCode = "SB",
                InterestRate = 4m,
                MinimumBalance = 100m,
                SavingLiabilityLedgerID = 30,
                EffectiveDate = new DateTime(2026, 4, 1)
            });

            db.SavingAccountMasters.Add(new SavingAccountMaster
            {
                SavingAccountID = 1,
                CustomerID = 1,
                BranchID = 1,
                SavingSchemeID = 1,
                AccountNo = "00101100000001",
                Status = "Active",
                CurrentBalance = 10000m,
                OpeningDate = new DateTime(2026, 4, 1)
            });

            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task DirectionalIbtHelper_AndCrossBranchSavingTransactions_UseDistinctLedgersPerBranch()
        {
            await using var db = CreateContext();
            await SeedMultiBranchIbtEnvironmentAsync(db);

            // 1. Direct helper check
            var (counterIbt, homeIbt) = await IbtLedgerHelper.GetDirectionalPairIbtLedgerIdsAsync(db, counterBranchId: 2, homeBranchId: 1);
            Assert.Equal(202, counterIbt);
            Assert.Equal(101, homeIbt);

            // 2. End-to-end cross-branch Deposit on Branch 2 for Branch 1's Saving Account
            var savingCtrl = new SavingTransactionsController(db);
            AttachUser(savingCtrl, BuildPrincipal(12, "clerk2", "Clerk", branchId: 2));

            var depositTxn = new SavingTransaction
            {
                SavingAccountID = 1,
                BranchID = 2,
                TransactionDate = new DateTime(2026, 6, 15),
                TransactionType = "Deposit",
                Amount = 1500m,
                PaymentMode = "Cash",
                Narration = "Cross-branch deposit test",
                CreatedBy = 12
            };

            var depositRes = await savingCtrl.PostSavingTransaction(depositTxn);
            Assert.IsType<OkObjectResult>(depositRes.Result);

            var depositVouchers = await db.Vouchers.Include(v => v.VoucherDetails).OrderBy(v => v.BranchID).ToListAsync();
            Assert.Equal(2, depositVouchers.Count);

            var homeDepositVoucher = depositVouchers.Single(v => v.BranchID == 1);
            var counterDepositVoucher = depositVouchers.Single(v => v.BranchID == 2);

            Assert.Equal(homeDepositVoucher.VoucherID, counterDepositVoucher.RelatedVoucherID);
            Assert.Equal(counterDepositVoucher.VoucherID, homeDepositVoucher.RelatedVoucherID);
            Assert.Contains(counterDepositVoucher.VoucherDetails, d => d.LedgerID == 202 && d.DrCr == "Cr" && d.Amount == 1500m);
            Assert.DoesNotContain(counterDepositVoucher.VoucherDetails, d => d.LedgerID == 101);
            Assert.Contains(homeDepositVoucher.VoucherDetails, d => d.LedgerID == 101 && d.DrCr == "Dr" && d.Amount == 1500m);
            Assert.DoesNotContain(homeDepositVoucher.VoucherDetails, d => d.LedgerID == 202);

            // 3. End-to-end cross-branch Withdrawal on Branch 2 for Branch 1's Saving Account
            var wdrTxn = new SavingTransaction
            {
                SavingAccountID = 1,
                BranchID = 2,
                TransactionDate = new DateTime(2026, 6, 15),
                TransactionType = "Withdrawal",
                Amount = 500m,
                PaymentMode = "Cash",
                Narration = "Cross-branch withdrawal test",
                CreatedBy = 12
            };

            var wdrRes = await savingCtrl.PostSavingTransaction(wdrTxn);
            Assert.IsType<OkObjectResult>(wdrRes.Result);

            var wdrVouchers = await db.Vouchers.Include(v => v.VoucherDetails)
                .Where(v => v.VoucherID != homeDepositVoucher.VoucherID && v.VoucherID != counterDepositVoucher.VoucherID)
                .ToListAsync();
            Assert.Equal(2, wdrVouchers.Count);

            var homeWdrVoucher = wdrVouchers.Single(v => v.BranchID == 1);
            var counterWdrVoucher = wdrVouchers.Single(v => v.BranchID == 2);

            Assert.Contains(counterWdrVoucher.VoucherDetails, d => d.LedgerID == 202 && d.DrCr == "Dr" && d.Amount == 500m);
            Assert.Contains(homeWdrVoucher.VoucherDetails, d => d.LedgerID == 101 && d.DrCr == "Cr" && d.Amount == 500m);
        }

        [Fact]
        public async Task PostVouchers_And_UnpassVouchers_SynchronizePairedIbtVouchersAcrossBranches()
        {
            await using var db = CreateContext();
            await SeedMultiBranchIbtEnvironmentAsync(db);

            var txDate = new DateTime(2026, 6, 15);
            var counterVoucher = new Voucher
            {
                VoucherID = 10,
                BranchID = 2,
                VoucherNo = "SSW-REC-26-27-00001",
                VoucherDate = txDate,
                VoucherType = "Receipt",
                TotalAmount = 2000m,
                Status = "Pending",
                IsIbtVoucher = true,
                TargetBranchID = 1,
                CreatedBy = 12,
                RelatedVoucherID = 11,
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { VoucherID = 10, LedgerID = 20, DrCr = "Dr", Amount = 2000m },
                    new VoucherDetail { VoucherID = 10, LedgerID = 202, DrCr = "Cr", Amount = 2000m }
                }
            };
            var homeVoucher = new Voucher
            {
                VoucherID = 11,
                BranchID = 1,
                VoucherNo = "HO-JV-26-27-00001",
                VoucherDate = txDate,
                VoucherType = "Journal",
                TotalAmount = 2000m,
                Status = "Pending",
                IsIbtVoucher = true,
                TargetBranchID = 2,
                CreatedBy = 12,
                RelatedVoucherID = 10,
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { VoucherID = 11, LedgerID = 101, DrCr = "Dr", Amount = 2000m },
                    new VoucherDetail { VoucherID = 11, LedgerID = 30, DrCr = "Cr", Amount = 2000m }
                }
            };
            db.Vouchers.AddRange(counterVoucher, homeVoucher);
            await db.SaveChangesAsync();

            var rollback = new VoucherRollbackAndDeleteService(db);
            var postingCtrl = new VoucherPostingController(db, rollback);
            // Branch 2 Manager (user 22 != maker 12) posts ONLY Counter Voucher #10
            AttachUser(postingCtrl, BuildPrincipal(22, "bm2", "BranchManager", branchId: 2));

            var postResult = await postingCtrl.PostVouchers(new VoucherPostingController.PostVouchersRequest
            {
                VoucherIds = new List<int> { 10 },
                BusinessDate = txDate
            });
            Assert.IsType<OkObjectResult>(postResult);

            var reloadedCounter = await db.Vouchers.FindAsync(10);
            var reloadedHome = await db.Vouchers.FindAsync(11);
            Assert.Equal("Approved", reloadedCounter!.Status);
            Assert.Equal("Approved", reloadedHome!.Status);
            Assert.True(reloadedCounter.ScrollNo > 0);
            Assert.True(reloadedHome.ScrollNo > 0);
            Assert.Equal(22, reloadedCounter.ApprovedBy);
            Assert.Equal(22, reloadedHome.ApprovedBy);

            // Same Branch 2 Manager unpasses ONLY Counter Voucher #10 -> both revert cleanly to Pending without 403
            var unpassResult = await postingCtrl.UnpassVouchers(new VoucherPostingController.UnpassVouchersRequest
            {
                VoucherIds = new List<int> { 10 },
                Reason = "QA IBT pair revert"
            });
            Assert.IsType<OkObjectResult>(unpassResult);

            Assert.Equal("Pending", (await db.Vouchers.FindAsync(10))!.Status);
            Assert.Null((await db.Vouchers.FindAsync(10))!.ScrollNo);
            Assert.Equal("Pending", (await db.Vouchers.FindAsync(11))!.Status);
            Assert.Null((await db.Vouchers.FindAsync(11))!.ScrollNo);
        }

        [Fact]
        public async Task ApproveVoucher_ApprovesPairedIbtSiblingsAtomically_WithScrollNo()
        {
            await using var db = CreateContext();
            await SeedMultiBranchIbtEnvironmentAsync(db);

            var txDate = new DateTime(2026, 6, 15);
            db.Vouchers.AddRange(
                new Voucher
                {
                    VoucherID = 30,
                    BranchID = 2,
                    VoucherNo = "SSW-PAY-26-27-00001",
                    VoucherDate = txDate,
                    VoucherType = "Payment",
                    TotalAmount = 3000m,
                    Status = "Pending",
                    IsIbtVoucher = true,
                    TargetBranchID = 1,
                    CreatedBy = 12,
                    RelatedVoucherID = 31,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        new VoucherDetail { VoucherID = 30, LedgerID = 202, DrCr = "Dr", Amount = 3000m },
                        new VoucherDetail { VoucherID = 30, LedgerID = 20, DrCr = "Cr", Amount = 3000m }
                    }
                },
                new Voucher
                {
                    VoucherID = 31,
                    BranchID = 1,
                    VoucherNo = "HO-JV-26-27-00002",
                    VoucherDate = txDate,
                    VoucherType = "Journal",
                    TotalAmount = 3000m,
                    Status = "Pending",
                    IsIbtVoucher = true,
                    TargetBranchID = 2,
                    CreatedBy = 12,
                    RelatedVoucherID = 30,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        new VoucherDetail { VoucherID = 31, LedgerID = 30, DrCr = "Dr", Amount = 3000m },
                        new VoucherDetail { VoucherID = 31, LedgerID = 101, DrCr = "Cr", Amount = 3000m }
                    }
                }
            );
            await db.SaveChangesAsync();

            var rollback = new VoucherRollbackAndDeleteService(db);
            var vouchersCtrl = new VouchersController(db, rollback);
            AttachUser(vouchersCtrl, BuildPrincipal(22, "bm2", "BranchManager", branchId: 2));

            var approveRes = await vouchersCtrl.ApproveVoucher(30, new VouchersController.ApprovalDto { BusinessDate = txDate });
            Assert.IsType<OkObjectResult>(approveRes);

            var v30 = await db.Vouchers.FindAsync(30);
            var v31 = await db.Vouchers.FindAsync(31);
            Assert.Equal("Approved", v30!.Status);
            Assert.Equal("Approved", v31!.Status);
            Assert.True(v30.ScrollNo > 0);
            Assert.True(v31.ScrollNo > 0);
        }

        [Fact]
        public async Task PostVouchers_And_ApproveVoucher_BlockBothVouchers_WhenHomeBranchDayIsClosed()
        {
            await using var db = CreateContext();
            await SeedMultiBranchIbtEnvironmentAsync(db);

            var txDate = new DateTime(2026, 6, 15);
            db.BranchDayEndStatuses.Add(new BranchDayEndStatus
            {
                BranchID = 1, // Home branch closed!
                BusinessDate = txDate,
                IsDayClosed = true
            });

            db.Vouchers.AddRange(
                new Voucher
                {
                    VoucherID = 40,
                    BranchID = 2,
                    VoucherNo = "SSW-REC-26-27-00009",
                    VoucherDate = txDate,
                    VoucherType = "Receipt",
                    TotalAmount = 900m,
                    Status = "Pending",
                    IsIbtVoucher = true,
                    TargetBranchID = 1,
                    CreatedBy = 12,
                    RelatedVoucherID = 41,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        new VoucherDetail { VoucherID = 40, LedgerID = 20, DrCr = "Dr", Amount = 900m },
                        new VoucherDetail { VoucherID = 40, LedgerID = 202, DrCr = "Cr", Amount = 900m }
                    }
                },
                new Voucher
                {
                    VoucherID = 41,
                    BranchID = 1,
                    VoucherNo = "HO-JV-26-27-00009",
                    VoucherDate = txDate,
                    VoucherType = "Journal",
                    TotalAmount = 900m,
                    Status = "Pending",
                    IsIbtVoucher = true,
                    TargetBranchID = 2,
                    CreatedBy = 12,
                    RelatedVoucherID = 40,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        new VoucherDetail { VoucherID = 41, LedgerID = 101, DrCr = "Dr", Amount = 900m },
                        new VoucherDetail { VoucherID = 41, LedgerID = 30, DrCr = "Cr", Amount = 900m }
                    }
                }
            );
            await db.SaveChangesAsync();

            var rollback = new VoucherRollbackAndDeleteService(db);
            var branch2Mgr = BuildPrincipal(22, "bm2", "BranchManager", branchId: 2);

            var postingCtrl = new VoucherPostingController(db, rollback);
            AttachUser(postingCtrl, branch2Mgr);
            var postRes = await postingCtrl.PostVouchers(new VoucherPostingController.PostVouchersRequest
            {
                VoucherIds = new List<int> { 40 },
                BusinessDate = txDate
            });
            Assert.IsType<BadRequestObjectResult>(postRes);

            // Verify NEITHER voucher became Approved
            Assert.Equal("Pending", (await db.Vouchers.FindAsync(40))!.Status);
            Assert.Equal("Pending", (await db.Vouchers.FindAsync(41))!.Status);

            var vouchersCtrl = new VouchersController(db, rollback);
            AttachUser(vouchersCtrl, branch2Mgr);
            var approveRes = await vouchersCtrl.ApproveVoucher(40, new VouchersController.ApprovalDto { BusinessDate = txDate });
            Assert.IsType<BadRequestObjectResult>(approveRes);

            Assert.Equal("Pending", (await db.Vouchers.FindAsync(40))!.Status);
            Assert.Equal("Pending", (await db.Vouchers.FindAsync(41))!.Status);
        }

        [Fact]
        public async Task RepairHalfApprovedIbtPairsAsync_SyncsOpenBalancedPair_SkipsClosedHomeDay()
        {
            await using var db = CreateContext();
            await SeedMultiBranchIbtEnvironmentAsync(db);

            var openDate = new DateTime(2026, 6, 15);
            var closedDate = new DateTime(2026, 6, 14);
            db.BranchDayEndStatuses.Add(new BranchDayEndStatus
            {
                BranchID = 1,
                BusinessDate = closedDate,
                IsDayClosed = true
            });

            db.Vouchers.AddRange(
                // Pair A: Open day -> Pending home sibling #51 should auto-sync to Approved
                new Voucher
                {
                    VoucherID = 50,
                    BranchID = 2,
                    VoucherNo = "SSW-REC-OPEN",
                    VoucherDate = openDate,
                    VoucherType = "Receipt",
                    TotalAmount = 500m,
                    Status = "Approved",
                    ApprovedBy = 22,
                    ScrollNo = 1,
                    IsIbtVoucher = true,
                    TargetBranchID = 1,
                    RelatedVoucherID = 51
                },
                new Voucher
                {
                    VoucherID = 51,
                    BranchID = 1,
                    VoucherNo = "HO-JV-OPEN",
                    VoucherDate = openDate,
                    VoucherType = "Journal",
                    TotalAmount = 500m,
                    Status = "Pending",
                    IsIbtVoucher = true,
                    TargetBranchID = 2,
                    RelatedVoucherID = 50,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        new VoucherDetail { VoucherID = 51, LedgerID = 101, DrCr = "Dr", Amount = 500m },
                        new VoucherDetail { VoucherID = 51, LedgerID = 30, DrCr = "Cr", Amount = 500m }
                    }
                },
                // Pair B: Closed day in Home Branch -> Pending #61 must NOT be silently approved
                new Voucher
                {
                    VoucherID = 60,
                    BranchID = 2,
                    VoucherNo = "SSW-REC-CLOSED",
                    VoucherDate = closedDate,
                    VoucherType = "Receipt",
                    TotalAmount = 700m,
                    Status = "Approved",
                    ApprovedBy = 22,
                    ScrollNo = 1,
                    IsIbtVoucher = true,
                    TargetBranchID = 1,
                    RelatedVoucherID = 61
                },
                new Voucher
                {
                    VoucherID = 61,
                    BranchID = 1,
                    VoucherNo = "HO-JV-CLOSED",
                    VoucherDate = closedDate,
                    VoucherType = "Journal",
                    TotalAmount = 700m,
                    Status = "Pending",
                    IsIbtVoucher = true,
                    TargetBranchID = 2,
                    RelatedVoucherID = 60,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        new VoucherDetail { VoucherID = 61, LedgerID = 101, DrCr = "Dr", Amount = 700m },
                        new VoucherDetail { VoucherID = 61, LedgerID = 30, DrCr = "Cr", Amount = 700m }
                    }
                }
            );
            await db.SaveChangesAsync();

            int synced = await IbtLedgerHelper.RepairHalfApprovedIbtPairsAsync(db);
            Assert.Equal(1, synced);

            var openHome = await db.Vouchers.FindAsync(51);
            Assert.Equal("Approved", openHome!.Status);
            Assert.Equal(1, openHome.ScrollNo);
            Assert.Equal(22, openHome.ApprovedBy);

            var closedHome = await db.Vouchers.FindAsync(61);
            Assert.Equal("Pending", closedHome!.Status);
        }
    }
}
