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
using Xunit;

namespace Bhisi.Api.Tests
{
    public class FdRenewalPolicyAndAutoRenewalTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"BhisiFdRenPolicy_{Guid.NewGuid()}")
                .ConfigureWarnings(x => x.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ClaimsPrincipal BuildPrincipal(int userId, string username, string role, int branchId, DateTime? businessDate = null)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Name, username),
                new Claim(ClaimTypes.Role, role),
                new Claim("BranchID", branchId.ToString()),
                new Claim("DefaultBranchID", branchId.ToString())
            };
            if (businessDate.HasValue)
            {
                claims.Add(new Claim("BusinessDate", businessDate.Value.ToString("yyyy-MM-dd")));
            }
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

        private static async Task<(FdScheme Scheme, Customer CustA, Customer CustB)> SeedBaseFdEnvironmentAsync(
            AppDbContext db,
            string renewalPolicy,
            bool allowManual,
            DateTime businessDate)
        {
            db.SansthaDetails.Add(new SansthaDetail
            {
                SansthaID = 1,
                SansthaName = "स्मार्ट पतसंस्था",
                FdRenewalReceiptPolicy = renewalPolicy,
                AllowManualReceiptNoOnRenewal = allowManual
            });

            db.Branches.Add(new Branch
            {
                BranchID = 1,
                BranchCode = "HO",
                BranchName = "मुख्य शाखा (HO)",
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

            db.BranchDayEndStatuses.Add(new BranchDayEndStatus
            {
                BranchID = 1,
                BusinessDate = businessDate.Date,
                IsDayClosed = false
            });

            db.AccountGroups.AddRange(
                new AccountGroup { GroupID = 1, GroupName = "ठेवी", NatureOfGroup = "Liabilities", IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "खर्च", NatureOfGroup = "Expenses", IsActive = true },
                new AccountGroup { GroupID = 3, GroupName = "रोख", NatureOfGroup = "Assets", IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 101, GroupID = 1, LedgerCode = "FD-LIAB", LedgerName = "मुदत ठेव दायित्व", AccountType = "Fixed Deposit", IsActive = true },
                new Ledger { LedgerID = 102, GroupID = 1, LedgerCode = "FD-PAY", LedgerName = "मुदत ठेव देणे व्याज", AccountType = "Payable", IsActive = true },
                new Ledger { LedgerID = 103, GroupID = 2, LedgerCode = "FD-EXP", LedgerName = "मुदत ठेव व्याज खर्च", AccountType = "Expenses", IsActive = true },
                new Ledger { LedgerID = 104, GroupID = 3, LedgerCode = "CASH-HO", LedgerName = "रोख शिल्लक", AccountType = "Cash", IsActive = true }
            );

            var scheme = new FdScheme
            {
                FdSchemeID = 1,
                SchemeCode = "FD401",
                SchemeName = "साधारण मुदत ठेव",
                DurationMonths = 12,
                DurationType = "Months",
                SchemeDurationModel = "Fixed",
                InterestRate = 10.00m,
                SeniorCitizenInterestRate = 10.50m,
                InterestType = "Simple",
                PrematureInterestRate = 8.00m,
                FdLiabilityLedgerID = 101,
                InterestPayableLedgerID = 102,
                InterestExpenseLedgerID = 103,
                IsActive = true
            };
            db.FdSchemes.Add(scheme);

            var custA = new Customer
            {
                CustomerID = 1,
                CIFNo = "CIF000001",
                FirstName = "शरद",
                LastName = "कुलकर्णी",
                BirthDate = new DateTime(1980, 1, 1),
                BranchID = 1
            };
            var custB = new Customer
            {
                CustomerID = 2,
                CIFNo = "CIF000002",
                FirstName = "महेश",
                LastName = "देशमुख",
                BirthDate = new DateTime(1982, 5, 10),
                BranchID = 1
            };
            db.Customers.AddRange(custA, custB);
            db.Members.AddRange(
                new Member { MemberID = 1, CustomerID = 1, MemberCode = "M001", BranchID = 1 },
                new Member { MemberID = 2, CustomerID = 2, MemberCode = "M002", BranchID = 1 }
            );

            await db.SaveChangesAsync();
            return (scheme, custA, custB);
        }

        [Fact]
        public async Task NewReceiptPolicy_ManualRenew_And_RunAutoRenewalBatch_BothUse14DigitCbsAndTrackChain()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 11, 16);
            var (_, custA, custB) = await SeedBaseFdEnvironmentAsync(db, "NEW_RECEIPT", false, businessDate);

            db.FdAccounts.AddRange(
                new FdAccount
                {
                    FdAccountID = 501,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custA.CustomerID,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000001-0",
                    ReceiptNo = "451",
                    LegacyAccountNumber = "451",
                    OpeningDate = new DateTime(2025, 11, 16),
                    MaturityDate = new DateTime(2026, 11, 16),
                    DurationType = "Months",
                    DurationValue = 12,
                    DurationInDays = 365,
                    DepositAmount = 100000m,
                    MaturityAmount = 110000m,
                    InterestRate = 10.00m,
                    Status = "Active",
                    RenewalCycleNo = 0
                },
                new FdAccount
                {
                    FdAccountID = 502,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custB.CustomerID,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000002-7",
                    ReceiptNo = "452",
                    LegacyAccountNumber = "452",
                    OpeningDate = new DateTime(2025, 11, 16),
                    MaturityDate = new DateTime(2026, 11, 16),
                    DurationType = "Months",
                    DurationValue = 12,
                    DurationInDays = 365,
                    DepositAmount = 50000m,
                    MaturityAmount = 55000m,
                    InterestRate = 10.00m,
                    Status = "Active",
                    IsAutoRenewable = true,
                    AutoRenewalOption = "PrincipalPlusInterest",
                    MaxAutoRenewalCycles = 3,
                    AutoRenewalCount = 0,
                    RenewalCycleNo = 0
                }
            );
            await db.SaveChangesAsync();

            var controller = new FdAccountsController(db);
            AttachUser(controller, BuildPrincipal(10, "ho_admin", "Admin", branchId: 1, businessDate: businessDate));

            // 1. Manual Renew on FD 501
            var manualRes = ParseOkJson(await controller.Renew(501, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 12
            }));
            string manualNewAccNo = manualRes.GetProperty("NewAccountNo").GetString()!;
            string manualNewReceipt = manualRes.GetProperty("NewReceiptNo").GetString()!;
            int manualNewId = manualRes.GetProperty("NewFdAccountId").GetInt32();

            Assert.Equal(14, new string(manualNewAccNo.Where(char.IsDigit).ToArray()).Length);
            Assert.DoesNotContain("-FD-", manualNewAccNo);
            Assert.Equal(manualNewAccNo, manualNewReceipt); // New receipt issued
            Assert.Equal(1, manualRes.GetProperty("RenewalCycleNo").GetInt32());
            Assert.Equal("Pending", manualRes.GetProperty("VoucherStatus").GetString());

            var old501 = await db.FdAccounts.FindAsync(501);
            var newManualAcc = await db.FdAccounts.FindAsync(manualNewId);
            Assert.Equal("Renewed", old501!.Status);
            Assert.Equal(501, newManualAcc!.ParentFdAccountID);
            Assert.Equal(501, newManualAcc.RootFdAccountID);
            Assert.Equal(1, newManualAcc.RenewalCycleNo);

            // 2. Auto-Renewal Batch on FD 502 (must also use 14-digit CBS format, NOT legacy -FD-)
            var autoRes = ParseOkJson(await controller.RunAutoRenewalBatch(new AutoRenewalBatchRequest
            {
                BranchID = 1,
                ProcessDate = businessDate,
                SpecificAccountIDs = new List<int> { 502 }
            }));
            Assert.Equal(1, autoRes.GetProperty("SuccessCount").GetInt32());
            var item0 = autoRes.GetProperty("Items")[0];
            string autoNewAccNo = item0.GetProperty("NewAccountNo").GetString()!;
            string autoNewReceipt = item0.GetProperty("NewReceiptNo").GetString()!;
            int autoNewId = item0.GetProperty("NewFdAccountID").GetInt32();

            Assert.Equal(14, new string(autoNewAccNo.Where(char.IsDigit).ToArray()).Length);
            Assert.DoesNotContain("-FD-", autoNewAccNo);
            Assert.Equal(autoNewAccNo, autoNewReceipt);
            Assert.NotEqual(manualNewAccNo, autoNewAccNo);

            var old502 = await db.FdAccounts.FindAsync(502);
            var newAutoAcc = await db.FdAccounts.FindAsync(autoNewId);
            Assert.Equal("Renewed", old502!.Status);
            Assert.Equal(502, newAutoAcc!.ParentFdAccountID);
            Assert.Equal(502, newAutoAcc.RootFdAccountID);
            Assert.Equal(1, newAutoAcc.RenewalCycleNo);
        }

        [Fact]
        public async Task RetainOriginalPolicy_ManualAndAutoRenewal_RetainOriginalReceiptNoAndLegacyNoAcrossCycles_WhileBlockingUnrelatedCustomer()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 11, 16);
            var (_, custA, custB) = await SeedBaseFdEnvironmentAsync(db, "RETAIN_ORIGINAL", false, businessDate);

            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 601,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = custA.CustomerID,
                FdSchemeID = 1,
                AccountNo = "001-401-0000010-2",
                ReceiptNo = "451",
                LegacyAccountNumber = "451",
                OpeningDate = new DateTime(2025, 11, 16),
                MaturityDate = new DateTime(2026, 11, 16),
                DurationType = "Months",
                DurationValue = 12,
                DurationInDays = 365,
                DepositAmount = 100000m,
                MaturityAmount = 110000m,
                InterestRate = 10.00m,
                Status = "Active",
                IsAutoRenewable = true,
                AutoRenewalOption = "PrincipalPlusInterest",
                MaxAutoRenewalCycles = 3,
                AutoRenewalCount = 0,
                RenewalCycleNo = 0
            });
            await db.SaveChangesAsync();

            var controller = new FdAccountsController(db);
            AttachUser(controller, BuildPrincipal(10, "ho_admin", "Admin", branchId: 1, businessDate: businessDate));

            // Cycle 1 via Auto-Renewal
            var batchRes = ParseOkJson(await controller.RunAutoRenewalBatch(new AutoRenewalBatchRequest
            {
                BranchID = 1,
                ProcessDate = businessDate,
                SpecificAccountIDs = new List<int> { 601 }
            }));
            Assert.Equal(1, batchRes.GetProperty("SuccessCount").GetInt32());
            var batchItem = batchRes.GetProperty("Items")[0];
            int cycle1Id = batchItem.GetProperty("NewFdAccountID").GetInt32();
            string cycle1AccNo = batchItem.GetProperty("NewAccountNo").GetString()!;

            Assert.Equal("451", batchItem.GetProperty("OldReceiptNo").GetString());
            Assert.Equal("451", batchItem.GetProperty("NewReceiptNo").GetString());
            Assert.NotEqual("001-401-0000010-2", cycle1AccNo);

            var cycle1Acc = await db.FdAccounts.FindAsync(cycle1Id);
            Assert.NotNull(cycle1Acc);
            Assert.Equal("451", cycle1Acc!.ReceiptNo);
            Assert.Equal("451", cycle1Acc.LegacyAccountNumber);
            Assert.Equal(601, cycle1Acc.ParentFdAccountID);
            Assert.Equal(601, cycle1Acc.RootFdAccountID);
            Assert.Equal(1, cycle1Acc.RenewalCycleNo);

            // Simulate Cycle 1 maturity reached and perform Manual Renew (Cycle 2)
            cycle1Acc.MaturityDate = new DateTime(2026, 11, 16);
            await db.SaveChangesAsync();

            var cycle2Res = ParseOkJson(await controller.Renew(cycle1Id, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 12
            }));
            int cycle2Id = cycle2Res.GetProperty("NewFdAccountId").GetInt32();
            Assert.Equal("451", cycle2Res.GetProperty("NewReceiptNo").GetString());
            Assert.Equal(2, cycle2Res.GetProperty("RenewalCycleNo").GetInt32());
            Assert.Equal(601, cycle2Res.GetProperty("RootFdAccountId").GetInt32());

            var cycle2Acc = await db.FdAccounts.FindAsync(cycle2Id);
            Assert.Equal("451", cycle2Acc!.ReceiptNo);
            Assert.Equal("451", cycle2Acc.LegacyAccountNumber);
            Assert.Equal(cycle1Id, cycle2Acc.ParentFdAccountID);
            Assert.Equal(601, cycle2Acc.RootFdAccountID);
            Assert.Equal(2, cycle2Acc.RenewalCycleNo);
            Assert.Equal("Renewed", (await db.FdAccounts.FindAsync(cycle1Id))!.Status);

            // Unrelated Customer B attempting to reuse LegacyAccountNumber "451" MUST still be blocked
            var dupPost = await controller.PostFdAccount(new FdAccount
            {
                BranchID = 1,
                CustomerID = custB.CustomerID,
                FdSchemeID = 1,
                LegacyAccountNumber = "451",
                DepositAmount = 25000m,
                OpeningDate = businessDate,
                DurationType = "Months",
                DurationValue = 12
            });
            Assert.IsType<BadRequestObjectResult>(dupPost.Result);
        }

        [Fact]
        public async Task RunAutoRenewalBatch_BackdatedMaturityDate_AppearsInTodayPassVoucherQueue_AndPassesCleanly()
        {
            await using var db = CreateContext();
            var todayOpen = new DateTime(2026, 11, 16);
            var overdueMaturity = new DateTime(2026, 11, 10); // Matured 6 days before current open business date
            var (_, custA, _) = await SeedBaseFdEnvironmentAsync(db, "RETAIN_ORIGINAL", false, todayOpen);

            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 701,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = custA.CustomerID,
                FdSchemeID = 1,
                AccountNo = "001-401-0000105-7",
                ReceiptNo = "701-R",
                LegacyAccountNumber = "701-R",
                OpeningDate = new DateTime(2025, 11, 10),
                MaturityDate = overdueMaturity,
                DurationType = "Months",
                DurationValue = 12,
                DurationInDays = 365,
                DepositAmount = 100000m,
                MaturityAmount = 110000m,
                InterestRate = 10.00m,
                Status = "Active",
                IsAutoRenewable = true,
                AutoRenewalOption = "PrincipalPlusInterest",
                MaxAutoRenewalCycles = 3,
                AutoRenewalCount = 0
            });
            await db.SaveChangesAsync();

            var branchUser = BuildPrincipal(22, "ho_mgr", "Admin", branchId: 1, businessDate: todayOpen);
            var fdController = new FdAccountsController(db);
            AttachUser(fdController, branchUser);

            var batchRes = ParseOkJson(await fdController.RunAutoRenewalBatch(new AutoRenewalBatchRequest
            {
                BranchID = 1,
                ProcessDate = todayOpen,
                SpecificAccountIDs = new List<int> { 701 }
            }));

            Assert.Equal(1, batchRes.GetProperty("SuccessCount").GetInt32());
            var item = batchRes.GetProperty("Items")[0];
            string voucherNo = item.GetProperty("VoucherNo").GetString()!;
            int newFdId = item.GetProperty("NewFdAccountID").GetInt32();

            // 1. New FD retains MaturityDate as OpeningDate (zero interest gap)
            var newFd = await db.FdAccounts.FindAsync(newFdId);
            Assert.NotNull(newFd);
            Assert.Equal(overdueMaturity.Date, newFd!.OpeningDate.Date);

            // 2. Journal Voucher has Status = "Pending" and VoucherDate = todayOpen (so Pass Voucher finds it!)
            var voucher = await db.Vouchers.FirstAsync(v => v.VoucherNo == voucherNo);
            Assert.Equal("Pending", voucher.Status);
            Assert.Equal(todayOpen.Date, voucher.VoucherDate.Date);

            // 3. VoucherPostingController.GetUnpostedVouchers(allDates: false) returns it on todayOpen
            var postingController = new VoucherPostingController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(postingController, branchUser);

            var pendingAction = await postingController.GetUnpostedVouchers(branchId: 1, voucherDate: todayOpen, allDates: false);
            var pendingList = Assert.IsAssignableFrom<IEnumerable<Voucher>>(pendingAction.Value).ToList();
            Assert.Contains(pendingList, v => v.VoucherID == voucher.VoucherID && v.Status == "Pending");

            // 4. Manager passes the voucher cleanly
            var postAction = await postingController.PostVouchers(new VoucherPostingController.PostVouchersRequest
            {
                VoucherIds = new List<int> { voucher.VoucherID },
                ApprovedBy = 22,
                BusinessDate = todayOpen
            });
            Assert.IsType<OkObjectResult>(postAction);

            var postedVoucher = await db.Vouchers.FindAsync(voucher.VoucherID);
            Assert.Equal("Approved", postedVoucher!.Status);
            Assert.Equal(1, postedVoucher.ScrollNo);
        }

        [Fact]
        public async Task RejectAutoRenewalVoucher_RollsBackNewAccount_AndRestoresOriginalAccountEligibleForReAutoRenewal()
        {
            await using var db = CreateContext();
            var todayOpen = new DateTime(2026, 11, 16);
            var (_, custA, _) = await SeedBaseFdEnvironmentAsync(db, "RETAIN_ORIGINAL", false, todayOpen);

            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 801,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = custA.CustomerID,
                FdSchemeID = 1,
                AccountNo = "001-401-0000150-5",
                ReceiptNo = "801-R",
                LegacyAccountNumber = "801-R",
                OpeningDate = new DateTime(2025, 11, 16),
                MaturityDate = new DateTime(2026, 11, 16),
                DurationType = "Months",
                DurationValue = 12,
                DurationInDays = 365,
                DepositAmount = 75000m,
                MaturityAmount = 82500m,
                InterestRate = 10.00m,
                Status = "Active",
                IsAutoRenewable = true,
                AutoRenewalOption = "PrincipalPlusInterest",
                MaxAutoRenewalCycles = 3,
                AutoRenewalCount = 0
            });
            await db.SaveChangesAsync();

            var adminUser = BuildPrincipal(10, "ho_admin", "Admin", branchId: 1, businessDate: todayOpen);
            var fdController = new FdAccountsController(db);
            AttachUser(fdController, adminUser);

            var batchRes = ParseOkJson(await fdController.RunAutoRenewalBatch(new AutoRenewalBatchRequest
            {
                BranchID = 1,
                ProcessDate = todayOpen,
                SpecificAccountIDs = new List<int> { 801 }
            }));
            var item = batchRes.GetProperty("Items")[0];
            int newFdId = item.GetProperty("NewFdAccountID").GetInt32();
            string voucherNo = item.GetProperty("VoucherNo").GetString()!;
            var voucher = await db.Vouchers.FirstAsync(v => v.VoucherNo == voucherNo);

            // Reject/Delete the Pending Auto-Renewal voucher from Voucher Passing
            var postingController = new VoucherPostingController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(postingController, adminUser);

            var rejectRes = await postingController.RejectVoucher(voucher.VoucherID, new VoucherPostingController.VoucherRejectDto
            {
                Reason = "Auto-renewal verification rollback test"
            });
            if (rejectRes is not OkObjectResult)
            {
                var errObj = rejectRes as ObjectResult;
                Assert.Fail($"RejectVoucher failed with Status={errObj?.StatusCode}, Body={JsonSerializer.Serialize(errObj?.Value)}");
            }

            // Verify child account and logs removed, original account restored to Matured and re-eligible for candidates
            Assert.Null(await db.FdAccounts.FindAsync(newFdId));
            Assert.False(await db.FdAutoRenewalLogs.AnyAsync());

            var restoredOld = await db.FdAccounts.FindAsync(801);
            Assert.NotNull(restoredOld);
            Assert.Equal("Matured", restoredOld!.Status);
            Assert.Equal(0, restoredOld.AutoRenewalCount);

            var candidatesRes = await fdController.GetAutoRenewalCandidates(branchId: 1, asOfDate: todayOpen);
            var okCand = Assert.IsType<OkObjectResult>(candidatesRes);
            var candidates = Assert.IsAssignableFrom<IEnumerable<AutoRenewalCandidateDto>>(okCand.Value).ToList();
            Assert.Contains(candidates, c => c.FdAccountID == 801 && c.ReceiptNo == "801-R");
        }

        [Fact]
        public async Task HybridPolicy_DisallowsCustomWhenAllowManualIsFalse_AndRejectsEmptyCustomWithoutFallback()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 11, 16);
            var (_, custA, custB) = await SeedBaseFdEnvironmentAsync(db, "HYBRID_CHOICE", allowManual: false, businessDate);

            db.FdAccounts.AddRange(
                new FdAccount
                {
                    FdAccountID = 901,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custA.CustomerID,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000110-1",
                    ReceiptNo = "R-901",
                    OpeningDate = new DateTime(2025, 11, 16),
                    MaturityDate = businessDate,
                    DurationType = "Months",
                    DurationValue = 12,
                    DurationInDays = 365,
                    DepositAmount = 50000m,
                    MaturityAmount = 55000m,
                    InterestRate = 10m,
                    Status = "Matured"
                },
                new FdAccount
                {
                    FdAccountID = 902,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custB.CustomerID,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000111-1",
                    ReceiptNo = "R-902",
                    OpeningDate = new DateTime(2025, 11, 16),
                    MaturityDate = businessDate,
                    DurationType = "Months",
                    DurationValue = 12,
                    DurationInDays = 365,
                    DepositAmount = 40000m,
                    MaturityAmount = 44000m,
                    InterestRate = 10m,
                    Status = "Matured",
                    IsAutoRenewable = true,
                    MaxAutoRenewalCycles = 3
                }
            );
            await db.SaveChangesAsync();

            var controller = new FdAccountsController(db);
            AttachUser(controller, BuildPrincipal(10, "ho_admin", "Admin", branchId: 1, businessDate: businessDate));

            // 1. HYBRID_CHOICE with allowManual=false MUST block CUSTOM mode (no bypass)
            var bypassAttempt = await controller.Renew(901, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 12,
                ReceiptNoMode = "CUSTOM",
                CustomReceiptNo = "BK-999"
            });
            Assert.IsType<BadRequestObjectResult>(bypassAttempt);

            // 2. Enable allowManual=true: empty CUSTOM MUST fail instead of silent fallback
            var sanstha = await db.SansthaDetails.FirstAsync();
            sanstha.AllowManualReceiptNoOnRenewal = true;
            await db.SaveChangesAsync();

            var emptyCustomAttempt = await controller.Renew(901, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 12,
                ReceiptNoMode = "CUSTOM",
                CustomReceiptNo = "   "
            });
            Assert.IsType<BadRequestObjectResult>(emptyCustomAttempt);

            // 3. Explicit RETAIN_ORIGINAL choice succeeds under HYBRID_CHOICE
            var retainRes = ParseOkJson(await controller.Renew(901, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 12,
                ReceiptNoMode = "RETAIN_ORIGINAL"
            }));
            Assert.Equal("R-901", retainRes.GetProperty("NewReceiptNo").GetString());
            Assert.Equal("RETAIN_ORIGINAL", retainRes.GetProperty("EffectivePolicy").GetString());

            // 4. Auto-Renewal batch under HYBRID_CHOICE defaults deterministically to NEW_RECEIPT
            var batchRes = ParseOkJson(await controller.RunAutoRenewalBatch(new AutoRenewalBatchRequest
            {
                BranchID = 1,
                ProcessDate = businessDate,
                SpecificAccountIDs = new List<int> { 902 }
            }));
            var item = batchRes.GetProperty("Items")[0];
            Assert.Equal("NEW_RECEIPT", item.GetProperty("EffectivePolicy").GetString());
            Assert.Equal(item.GetProperty("NewAccountNo").GetString(), item.GetProperty("NewReceiptNo").GetString());
        }

        [Fact]
        public async Task StrictPolicyEngine_RejectsDisallowedRequestedModes_AndInvalidSansthaPolicyWithoutFallback()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 11, 16);
            var (_, custA, _) = await SeedBaseFdEnvironmentAsync(db, "NEW_RECEIPT", allowManual: false, businessDate);

            var acc = new FdAccount
            {
                FdAccountID = 920,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = custA.CustomerID,
                FdSchemeID = 1,
                AccountNo = "001-401-0000120-1",
                ReceiptNo = "R-920",
                OpeningDate = new DateTime(2025, 11, 16),
                MaturityDate = businessDate,
                DurationType = "Months",
                DurationValue = 12,
                DurationInDays = 365,
                DepositAmount = 25000m,
                MaturityAmount = 27500m,
                InterestRate = 10m,
                Status = "Matured"
            };
            db.FdAccounts.Add(acc);
            await db.SaveChangesAsync();

            var controller = new FdAccountsController(db);
            AttachUser(controller, BuildPrincipal(10, "ho_admin", "Admin", branchId: 1, businessDate: businessDate));

            // 1. NEW_RECEIPT policy forbids explicit RETAIN_ORIGINAL request
            var disallowRetain = await controller.Renew(920, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 12,
                ReceiptNoMode = "RETAIN_ORIGINAL"
            });
            Assert.IsType<BadRequestObjectResult>(disallowRetain);

            // 2. Invalid requested mode fails fast
            var invalidMode = await controller.Renew(920, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 12,
                ReceiptNoMode = "UNKNOWN_MODE"
            });
            Assert.IsType<BadRequestObjectResult>(invalidMode);

            // 3. Invalid Sanstha policy never silently falls back to NEW_RECEIPT
            var sanstha = await db.SansthaDetails.FirstAsync();
            sanstha.FdRenewalReceiptPolicy = "INVALID_POLICY";
            await db.SaveChangesAsync();

            var policyErr = await FdRenewalPolicyHelper.ResolveRenewalReceiptNumbersAsync(
                db, acc, 1, "00140100001211", "001-401-0000121-1");
            Assert.False(string.IsNullOrEmpty(policyErr.ValidationError));
        }

        [Fact]
        public async Task ConflictGuard_BlocksUnrelatedActiveAccountNoVariantAndActiveReceiptNo_OnRenewalAndNewOpening()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 11, 16);
            var (_, custA, custB) = await SeedBaseFdEnvironmentAsync(db, "NEW_RECEIPT", allowManual: true, businessDate);

            db.FdAccounts.AddRange(
                new FdAccount
                {
                    FdAccountID = 930,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custA.CustomerID,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000130-1",
                    ReceiptNo = "BK-130",
                    OpeningDate = new DateTime(2025, 11, 16),
                    MaturityDate = businessDate,
                    DurationType = "Months",
                    DurationValue = 12,
                    DurationInDays = 365,
                    DepositAmount = 30000m,
                    MaturityAmount = 33000m,
                    InterestRate = 10m,
                    Status = "Matured"
                },
                // Customer B holds active FD with ReceiptNo = null -> effective number is AccountNo "001-401-0000131-8"
                new FdAccount
                {
                    FdAccountID = 931,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custB.CustomerID,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000131-8",
                    ReceiptNo = null,
                    OpeningDate = new DateTime(2026, 1, 1),
                    MaturityDate = new DateTime(2027, 1, 1),
                    DepositAmount = 20000m,
                    InterestRate = 10m,
                    Status = "Active"
                }
            );
            await db.SaveChangesAsync();

            var controller = new FdAccountsController(db);
            AttachUser(controller, BuildPrincipal(10, "ho_admin", "Admin", branchId: 1, businessDate: businessDate));

            // 1. Attempting CUSTOM renewal with Customer B's active AccountNo (formatted or raw 14-digit) MUST be blocked
            var formattedCollision = await controller.Renew(930, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 12,
                ReceiptNoMode = "CUSTOM",
                CustomReceiptNo = "001-401-0000131-8"
            });
            Assert.IsType<BadRequestObjectResult>(formattedCollision);

            var rawCollision = await controller.Renew(930, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 12,
                ReceiptNoMode = "CUSTOM",
                CustomReceiptNo = "00140100001318"
            });
            Assert.IsType<BadRequestObjectResult>(rawCollision);

            // 2. Customer B opening a new FD reusing Customer A's active ReceiptNo "BK-130" MUST be blocked
            var newOpenCollision = await controller.PostFdAccount(new FdAccount
            {
                BranchID = 1,
                CustomerID = custB.CustomerID,
                FdSchemeID = 1,
                ReceiptNo = "BK-130",
                DepositAmount = 15000m,
                OpeningDate = businessDate,
                DurationType = "Months",
                DurationValue = 12
            });
            Assert.IsType<BadRequestObjectResult>(newOpenCollision.Result);
        }

        [Fact]
        public async Task NextLegacyPolicy_ManualRenew_AssignsNextSequentialLegacyAndReceiptNo()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 11, 16);
            var (_, custA, custB) = await SeedBaseFdEnvironmentAsync(db, "NEXT_LEGACY", allowManual: false, businessDate);

            db.FdAccounts.AddRange(
                new FdAccount
                {
                    FdAccountID = 940,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custA.CustomerID,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000140-1",
                    ReceiptNo = "451",
                    LegacyAccountNumber = "451",
                    OpeningDate = new DateTime(2025, 11, 16),
                    MaturityDate = businessDate,
                    DurationType = "Months",
                    DurationValue = 12,
                    DurationInDays = 365,
                    DepositAmount = 25000m,
                    MaturityAmount = 27500m,
                    InterestRate = 10m,
                    Status = "Matured"
                },
                new FdAccount
                {
                    FdAccountID = 941,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custB.CustomerID,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000141-9",
                    ReceiptNo = "600",
                    LegacyAccountNumber = "600",
                    OpeningDate = new DateTime(2026, 1, 1),
                    MaturityDate = new DateTime(2027, 1, 1),
                    DurationType = "Months",
                    DurationValue = 12,
                    DurationInDays = 365,
                    DepositAmount = 20000m,
                    InterestRate = 10m,
                    Status = "Active"
                }
            );
            await db.SaveChangesAsync();

            var controller = new FdAccountsController(db);
            AttachUser(controller, BuildPrincipal(10, "ho_admin", "Admin", branchId: 1, businessDate: businessDate));

            var res = await controller.Renew(940, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 12
            });

            var json = ParseOkJson(res);
            string newCbsAccNo = json.GetProperty("NewAccountNo").GetString()!;
            Assert.Equal("601", json.GetProperty("NewReceiptNo").GetString());
            Assert.Equal("NEXT_LEGACY", json.GetProperty("EffectivePolicy").GetString());
            Assert.NotEqual("601", newCbsAccNo);

            var renewedChild = await db.FdAccounts.FirstAsync(a => a.AccountNo == newCbsAccNo);
            Assert.Equal("601", renewedChild.LegacyAccountNumber);
            Assert.Equal("601", renewedChild.ReceiptNo);
            Assert.Equal(940, renewedChild.ParentFdAccountID);
            Assert.Equal(940, renewedChild.RootFdAccountID);
            Assert.Equal(1, renewedChild.RenewalCycleNo);

            var oldAcc = await db.FdAccounts.FindAsync(940);
            Assert.Equal("Renewed", oldAcc!.Status);
            Assert.Equal("451", oldAcc.LegacyAccountNumber);
        }

        [Fact]
        public async Task NextLegacyPolicy_RunAutoRenewalBatch_AssignsUniqueSequentialLegacyNumbers()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 11, 16);
            var (_, custA, custB) = await SeedBaseFdEnvironmentAsync(db, "NEXT_LEGACY", allowManual: false, businessDate);

            db.FdAccounts.AddRange(
                new FdAccount
                {
                    FdAccountID = 950,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custA.CustomerID,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000150-1",
                    ReceiptNo = "451",
                    LegacyAccountNumber = "451",
                    OpeningDate = new DateTime(2025, 11, 16),
                    MaturityDate = businessDate,
                    DurationType = "Months",
                    DurationValue = 12,
                    DurationInDays = 365,
                    DepositAmount = 20000m,
                    MaturityAmount = 22000m,
                    InterestRate = 10m,
                    Status = "Active",
                    IsAutoRenewable = true,
                    AutoRenewalOption = "PrincipalPlusInterest",
                    MaxAutoRenewalCycles = 3,
                    AutoRenewalCount = 0
                },
                new FdAccount
                {
                    FdAccountID = 951,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custB.CustomerID,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000151-9",
                    ReceiptNo = "600",
                    LegacyAccountNumber = "600",
                    OpeningDate = new DateTime(2025, 11, 16),
                    MaturityDate = businessDate,
                    DurationType = "Months",
                    DurationValue = 12,
                    DurationInDays = 365,
                    DepositAmount = 30000m,
                    MaturityAmount = 33000m,
                    InterestRate = 10m,
                    Status = "Active",
                    IsAutoRenewable = true,
                    AutoRenewalOption = "PrincipalPlusInterest",
                    MaxAutoRenewalCycles = 3,
                    AutoRenewalCount = 0
                }
            );
            await db.SaveChangesAsync();

            var controller = new FdAccountsController(db);
            AttachUser(controller, BuildPrincipal(10, "ho_admin", "Admin", branchId: 1, businessDate: businessDate));

            var batchRes = await controller.RunAutoRenewalBatch(new AutoRenewalBatchRequest
            {
                ProcessDate = businessDate,
                BranchID = 1,
                SpecificAccountIDs = new List<int> { 950, 951 },
                ExecutedBy = "Test-EOD"
            });

            var json = ParseOkJson(batchRes);
            Assert.Equal(2, json.GetProperty("SuccessCount").GetInt32());
            Assert.Equal(0, json.GetProperty("FailedCount").GetInt32());

            var child1 = await db.FdAccounts.FirstAsync(a => a.ParentFdAccountID == 950);
            var child2 = await db.FdAccounts.FirstAsync(a => a.ParentFdAccountID == 951);
            Assert.Equal("601", child1.LegacyAccountNumber);
            Assert.Equal("601", child1.ReceiptNo);
            Assert.Equal("602", child2.LegacyAccountNumber);
            Assert.Equal("602", child2.ReceiptNo);
            Assert.NotEqual(child1.AccountNo, child2.AccountNo);
        }

        [Fact]
        public async Task NextLegacyPolicy_SkipsActiveReceiptNoConflict_WhenGeneratingNextLegacyNumber()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 11, 16);
            var (_, custA, custB) = await SeedBaseFdEnvironmentAsync(db, "NEXT_LEGACY", allowManual: false, businessDate);

            db.FdAccounts.AddRange(
                new FdAccount
                {
                    FdAccountID = 960,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custA.CustomerID,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000160-1",
                    ReceiptNo = "600",
                    LegacyAccountNumber = "600",
                    OpeningDate = new DateTime(2025, 11, 16),
                    MaturityDate = businessDate,
                    DurationType = "Months",
                    DurationValue = 12,
                    DurationInDays = 365,
                    DepositAmount = 15000m,
                    MaturityAmount = 16500m,
                    InterestRate = 10m,
                    Status = "Matured"
                },
                // Another live FD uses "601" as ReceiptNo (with LegacyAccountNumber = null)
                new FdAccount
                {
                    FdAccountID = 961,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custB.CustomerID,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000161-9",
                    ReceiptNo = "601",
                    LegacyAccountNumber = null,
                    OpeningDate = new DateTime(2026, 1, 1),
                    MaturityDate = new DateTime(2027, 1, 1),
                    DurationType = "Months",
                    DurationValue = 12,
                    DurationInDays = 365,
                    DepositAmount = 18000m,
                    InterestRate = 10m,
                    Status = "Active"
                }
            );
            await db.SaveChangesAsync();

            var controller = new FdAccountsController(db);
            AttachUser(controller, BuildPrincipal(10, "ho_admin", "Admin", branchId: 1, businessDate: businessDate));

            var res = await controller.Renew(960, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 12
            });

            var json = ParseOkJson(res);
            Assert.Equal("602", json.GetProperty("NewReceiptNo").GetString());
        }

        [Fact]
        public async Task NextLegacyPolicy_StrictValidation_RejectsInvalidPolicyAndMismatchedModeWithoutFallback()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 11, 16);
            var (_, custA, _) = await SeedBaseFdEnvironmentAsync(db, "NEXT_LEGACY", allowManual: false, businessDate);

            var sansthaController = new SansthaDetailsController(db);
            var invalidSave = await sansthaController.PutSansthaDetail(1, new SansthaDetail
            {
                SansthaID = 1,
                SansthaName = "स्मार्ट पतसंस्था",
                FdRenewalReceiptPolicy = "INVALID_MODE",
                AllowManualReceiptNoOnRenewal = false
            });
            Assert.IsType<BadRequestObjectResult>(invalidSave);

            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 970,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = custA.CustomerID,
                FdSchemeID = 1,
                AccountNo = "001-401-0000170-1",
                ReceiptNo = "451",
                LegacyAccountNumber = "451",
                OpeningDate = new DateTime(2025, 11, 16),
                MaturityDate = businessDate,
                DurationType = "Months",
                DurationValue = 12,
                DurationInDays = 365,
                DepositAmount = 10000m,
                MaturityAmount = 11000m,
                InterestRate = 10m,
                Status = "Matured"
            });
            await db.SaveChangesAsync();

            var fdController = new FdAccountsController(db);
            AttachUser(fdController, BuildPrincipal(10, "ho_admin", "Admin", branchId: 1, businessDate: businessDate));

            var mismatched = await fdController.Renew(970, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 12,
                ReceiptNoMode = "RETAIN_ORIGINAL"
            });
            Assert.IsType<BadRequestObjectResult>(mismatched);
        }
    }
}
