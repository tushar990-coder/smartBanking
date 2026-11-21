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

        [Fact]
        public async Task Renew_WithLongExistingRemarksAndManualOverride_ClampsRemarksSafelyWithoutOverflow()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 4, 1);
            var (_, custA, _) = await SeedBaseFdEnvironmentAsync(db, "RETAIN_ORIGINAL", allowManual: false, businessDate);

            string longExistingRemarks = new string('A', 210);
            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 980,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = custA.CustomerID,
                FdSchemeID = 1,
                AccountNo = "001-401-0000212-4",
                ReceiptNo = "1455",
                LegacyAccountNumber = "1455",
                OpeningDate = new DateTime(2025, 3, 1),
                MaturityDate = businessDate,
                DurationType = "Months",
                DurationValue = 13,
                DurationInDays = 396,
                DepositAmount = 40000m,
                MaturityAmount = 43906m,
                InterestRate = 9m,
                Status = "Matured",
                Remarks = longExistingRemarks
            });
            await db.SaveChangesAsync();

            var fdController = new FdAccountsController(db);
            AttachUser(fdController, BuildPrincipal(10, "ho_admin", "Admin", branchId: 1, businessDate: businessDate));

            string longOverrideReason = new string('B', 400);
            var res = await fdController.Renew(980, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 12,
                IsManualAmountOverride = true,
                CustomAccruedInterest = 3896m,
                ManualOverrideReason = longOverrideReason
            });

            var json = ParseOkJson(res);
            int newFdId = json.GetProperty("NewFdAccountId").GetInt32();
            decimal newDep = json.GetProperty("NewDeposit").GetDecimal();
            Assert.Equal(43896m, newDep);

            var oldFd = await db.FdAccounts.FindAsync(980);
            var newFd = await db.FdAccounts.FindAsync(newFdId);
            Assert.NotNull(oldFd);
            Assert.NotNull(newFd);
            Assert.True((oldFd!.Remarks ?? "").Length <= 1000);
            Assert.True((newFd!.Remarks ?? "").Length <= 1000);
        }

        [Fact]
        public async Task Renew_AutoRateDefaultAndEditableCustomInterestRate_UpdatesMaturityAndLogsAudit()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 4, 1);
            var (_, custA, _) = await SeedBaseFdEnvironmentAsync(db, "NEW_RECEIPT", allowManual: false, businessDate);

            db.FdAccounts.AddRange(
                new FdAccount
                {
                    FdAccountID = 981,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custA.CustomerID,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000213-2",
                    ReceiptNo = "213",
                    OpeningDate = new DateTime(2025, 4, 1),
                    MaturityDate = businessDate,
                    DurationType = "Months",
                    DurationValue = 12,
                    DurationInDays = 365,
                    DepositAmount = 100000m,
                    MaturityAmount = 110000m,
                    InterestRate = 10m,
                    Status = "Matured"
                },
                new FdAccount
                {
                    FdAccountID = 982,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custA.CustomerID,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000214-0",
                    ReceiptNo = "214",
                    OpeningDate = new DateTime(2025, 4, 1),
                    MaturityDate = businessDate,
                    DurationType = "Months",
                    DurationValue = 12,
                    DurationInDays = 365,
                    DepositAmount = 100000m,
                    MaturityAmount = 110000m,
                    InterestRate = 10m,
                    Status = "Matured"
                }
            );
            await db.SaveChangesAsync();

            var fdController = new FdAccountsController(db);
            AttachUser(fdController, BuildPrincipal(10, "ho_admin", "Admin", branchId: 1, businessDate: businessDate));

            // 1. Default Auto rate when CustomInterestRate is null (scheme = 10%)
            var autoRes = ParseOkJson(await fdController.Renew(981, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 12,
                CustomInterestRate = null
            }));
            Assert.Equal(10m, autoRes.GetProperty("InterestRate").GetDecimal());
            Assert.False(autoRes.GetProperty("IsCustomInterestRate").GetBoolean());

            // 2. Edited custom rate (8.25% instead of scheme 10%)
            var editedRes = ParseOkJson(await fdController.Renew(982, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 12,
                CustomInterestRate = 8.25m
            }));
            Assert.Equal(8.25m, editedRes.GetProperty("InterestRate").GetDecimal());
            Assert.Equal(10m, editedRes.GetProperty("DefaultSchemeRate").GetDecimal());
            Assert.True(editedRes.GetProperty("IsCustomInterestRate").GetBoolean());

            // Maturity on 1,10,000 for 365 days @ 8.25% simple = 110000 * 1.0825 = 119075
            Assert.Equal(119075m, editedRes.GetProperty("MaturityAmount").GetDecimal());

            int editedNewFdId = editedRes.GetProperty("NewFdAccountId").GetInt32();
            var editedFd = await db.FdAccounts.FindAsync(editedNewFdId);
            Assert.Equal(8.25m, editedFd!.InterestRate);
            Assert.True(await db.AuditLogs.AnyAsync(a =>
                a.Action == "FD_RENEWAL_CUSTOM_INTEREST_RATE" &&
                a.EntityID == editedFd.AccountNo));
        }

        [Fact]
        public async Task Renew_InvalidCustomInterestRate_FailsFastWithoutPartialSave()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 4, 1);
            var (_, custA, _) = await SeedBaseFdEnvironmentAsync(db, "NEW_RECEIPT", allowManual: false, businessDate);

            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 983,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = custA.CustomerID,
                FdSchemeID = 1,
                AccountNo = "001-401-0000215-9",
                ReceiptNo = "215",
                OpeningDate = new DateTime(2025, 4, 1),
                MaturityDate = businessDate,
                DurationType = "Months",
                DurationValue = 12,
                DurationInDays = 365,
                DepositAmount = 50000m,
                MaturityAmount = 55000m,
                InterestRate = 10m,
                Status = "Matured"
            });
            await db.SaveChangesAsync();

            var fdController = new FdAccountsController(db);
            AttachUser(fdController, BuildPrincipal(10, "ho_admin", "Admin", branchId: 1, businessDate: businessDate));

            var zeroRate = await fdController.Renew(983, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 12,
                CustomInterestRate = 0m
            });
            Assert.IsType<BadRequestObjectResult>(zeroRate);
            Assert.Equal("Matured", (await db.FdAccounts.FindAsync(983))!.Status);
        }

        [Fact]
        public async Task RetainOriginal_And_Custom_AllowSameReceiptNoAcrossDifferentFdSchemes_ButBlockSameSchemeConflict()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 4, 27);
            var (_, custA, custB) = await SeedBaseFdEnvironmentAsync(db, "RETAIN_ORIGINAL", allowManual: true, businessDate);

            db.FdSchemes.Add(new FdScheme
            {
                FdSchemeID = 3,
                SchemeCode = "FD403",
                SchemeName = "मासिक ठेव योजना",
                DurationMonths = 13,
                DurationType = "Months",
                SchemeDurationModel = "Fixed",
                InterestRate = 9.00m,
                SeniorCitizenInterestRate = 9.50m,
                InterestType = "Simple",
                PrematureInterestRate = 7.00m,
                FdLiabilityLedgerID = 101,
                InterestPayableLedgerID = 102,
                InterestExpenseLedgerID = 103,
                IsActive = true
            });

            // Scheme 1 Matured FD (#182) with legacy/receipt "1471" AND Scheme 3 active FD ("001-403-0000768-3") ALSO with "1471"
            db.FdAccounts.AddRange(
                new FdAccount
                {
                    FdAccountID = 182,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custA.CustomerID,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000182-1",
                    ReceiptNo = "1471",
                    LegacyAccountNumber = "1471",
                    OpeningDate = new DateTime(2025, 3, 22),
                    MaturityDate = new DateTime(2026, 4, 22),
                    DurationType = "Months",
                    DurationValue = 13,
                    DurationInDays = 396,
                    DepositAmount = 54870m,
                    MaturityAmount = 60214m,
                    InterestRate = 9m,
                    Status = "Matured"
                },
                new FdAccount
                {
                    FdAccountID = 768,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custB.CustomerID,
                    FdSchemeID = 3,
                    AccountNo = "001-403-0000768-3",
                    ReceiptNo = "1471",
                    LegacyAccountNumber = "1471",
                    OpeningDate = new DateTime(2026, 1, 1),
                    MaturityDate = new DateTime(2027, 2, 1),
                    DurationType = "Months",
                    DurationValue = 13,
                    DurationInDays = 396,
                    DepositAmount = 50000m,
                    MaturityAmount = 54500m,
                    InterestRate = 9m,
                    Status = "Active"
                }
            );
            await db.SaveChangesAsync();

            var controller = new FdAccountsController(db);
            AttachUser(controller, BuildPrincipal(10, "ho_admin", "Admin", branchId: 1, businessDate: businessDate));

            // 1. Renewing #182 into TargetSchemeID = 1 under RETAIN_ORIGINAL MUST SUCCEED despite Scheme 3 holding active "1471"
            var retainRes = await controller.Renew(182, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 13,
                ReceiptNoMode = "RETAIN_ORIGINAL"
            });
            var retainJson = ParseOkJson(retainRes);
            Assert.Equal("1471", retainJson.GetProperty("NewReceiptNo").GetString());
            int newFdId = retainJson.GetProperty("NewFdAccountId").GetInt32();
            var newFd = await db.FdAccounts.FindAsync(newFdId);
            Assert.Equal("1471", newFd!.ReceiptNo);
            Assert.Equal("1471", newFd.LegacyAccountNumber);

            // 2. Trying to renew ANOTHER Scheme 1 FD (#183) with ReceiptNo "1471" (RETAIN_ORIGINAL) MUST BE BLOCKED because Scheme 1 now has active #newFdId
            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 183,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = custB.CustomerID,
                FdSchemeID = 1,
                AccountNo = "001-401-0000183-9",
                ReceiptNo = "1471",
                LegacyAccountNumber = "1471",
                OpeningDate = new DateTime(2025, 4, 1),
                MaturityDate = businessDate,
                DurationType = "Months",
                DurationValue = 12,
                DurationInDays = 365,
                DepositAmount = 20000m,
                MaturityAmount = 22000m,
                InterestRate = 9m,
                Status = "Matured"
            });
            await db.SaveChangesAsync();

            var sameSchemeBlocked = await controller.Renew(183, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 12,
                ReceiptNoMode = "RETAIN_ORIGINAL"
            });
            Assert.IsType<BadRequestObjectResult>(sameSchemeBlocked);

            // 3. Cross-scheme target switch: Renewing Scheme 1 FD (#184) with "1471" INTO TargetSchemeID = 3 MUST BE BLOCKED because Scheme 3 already has active "1471"
            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 184,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = custA.CustomerID,
                FdSchemeID = 1,
                AccountNo = "001-401-0000184-7",
                ReceiptNo = "1471",
                LegacyAccountNumber = "1471",
                OpeningDate = new DateTime(2025, 4, 1),
                MaturityDate = businessDate,
                DurationType = "Months",
                DurationValue = 12,
                DurationInDays = 365,
                DepositAmount = 25000m,
                MaturityAmount = 27500m,
                InterestRate = 9m,
                Status = "Matured"
            });
            await db.SaveChangesAsync();

            var crossTargetBlocked = await controller.Renew(184, new FdRenewalRequest
            {
                TargetSchemeID = 3,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 13,
                ReceiptNoMode = "RETAIN_ORIGINAL"
            });
            Assert.IsType<BadRequestObjectResult>(crossTargetBlocked);

            // 4. HYBRID_CHOICE + CUSTOM reusing another scheme's receipt ("9901" exists only in Scheme 3) in Scheme 1 MUST SUCCEED
            var sanstha = await db.SansthaDetails.FirstAsync();
            sanstha.FdRenewalReceiptPolicy = "HYBRID_CHOICE";
            sanstha.AllowManualReceiptNoOnRenewal = true;
            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 1769,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = custB.CustomerID,
                FdSchemeID = 3,
                AccountNo = "001-403-0000769-1",
                ReceiptNo = "9901",
                LegacyAccountNumber = "9901",
                OpeningDate = new DateTime(2026, 2, 1),
                MaturityDate = new DateTime(2027, 2, 1),
                DepositAmount = 15000m,
                InterestRate = 9m,
                Status = "Active"
            });
            await db.SaveChangesAsync();

            var customCrossSchemeOk = await controller.Renew(184, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 12,
                ReceiptNoMode = "CUSTOM",
                CustomReceiptNo = "9901"
            });
            var customJson = ParseOkJson(customCrossSchemeOk);
            Assert.Equal("9901", customJson.GetProperty("NewReceiptNo").GetString());
        }

        [Fact]
        public async Task NextLegacy_And_PostFdAccount_ScopeReceiptConflictsToTargetScheme_WhileKeeping14DigitCbsBranchUnique()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 4, 27);
            var (_, custA, custB) = await SeedBaseFdEnvironmentAsync(db, "NEXT_LEGACY", allowManual: true, businessDate);

            db.FdSchemes.Add(new FdScheme
            {
                FdSchemeID = 3,
                SchemeCode = "FD403",
                SchemeName = "मासिक ठेव योजना",
                DurationMonths = 12,
                DurationType = "Months",
                SchemeDurationModel = "Fixed",
                InterestRate = 9.00m,
                SeniorCitizenInterestRate = 9.50m,
                InterestType = "Simple",
                PrematureInterestRate = 7.00m,
                FdLiabilityLedgerID = 101,
                InterestPayableLedgerID = 102,
                InterestExpenseLedgerID = 103,
                IsActive = true
            });

            db.FdAccounts.AddRange(
                new FdAccount
                {
                    FdAccountID = 801,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custA.CustomerID,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000801-1",
                    ReceiptNo = "10",
                    LegacyAccountNumber = "10",
                    OpeningDate = new DateTime(2025, 4, 27),
                    MaturityDate = businessDate,
                    DurationType = "Months",
                    DurationValue = 12,
                    DurationInDays = 365,
                    DepositAmount = 20000m,
                    MaturityAmount = 22000m,
                    InterestRate = 10m,
                    Status = "Active"
                },
                // ReceiptNo "11" is ONLY occupied in Scheme 3, NOT in Scheme 1
                new FdAccount
                {
                    FdAccountID = 802,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custB.CustomerID,
                    FdSchemeID = 3,
                    AccountNo = "001-403-0000802-9",
                    ReceiptNo = "11",
                    LegacyAccountNumber = "11",
                    OpeningDate = new DateTime(2026, 1, 1),
                    MaturityDate = new DateTime(2027, 1, 1),
                    DurationType = "Months",
                    DurationValue = 12,
                    DurationInDays = 365,
                    DepositAmount = 30000m,
                    MaturityAmount = 32700m,
                    InterestRate = 9m,
                    Status = "Active"
                }
            );
            await db.SaveChangesAsync();

            // 1. Next legacy generation for Scheme 1 should yield "11" (not skip because of Scheme 3)
            string nextScheme1Legacy = await FdRenewalPolicyHelper.GenerateNextLegacyAccountNoAsync(db, branchId: 1, schemeId: 1);
            Assert.Equal("11", nextScheme1Legacy);

            // 2. PostFdAccount for Scheme 1 reusing ReceiptNo "11" (used only in Scheme 3) MUST SUCCEED
            var controller = new FdAccountsController(db);
            AttachUser(controller, BuildPrincipal(10, "ho_admin", "Admin", branchId: 1, businessDate: businessDate));

            var newOpenCrossSchemeOk = await controller.PostFdAccount(new FdAccount
            {
                BranchID = 1,
                CustomerID = custA.CustomerID,
                FdSchemeID = 1,
                ReceiptNo = "11",
                DepositAmount = 15000m,
                OpeningDate = businessDate,
                DurationType = "Months",
                DurationValue = 12,
                PaymentMode = "Cash"
            });
            Assert.IsType<CreatedAtActionResult>(newOpenCrossSchemeOk.Result);

            // 3. PostFdAccount for Scheme 1 trying to reuse ReceiptNo "10" (same scheme) MUST BE BLOCKED
            var newOpenSameSchemeBlocked = await controller.PostFdAccount(new FdAccount
            {
                BranchID = 1,
                CustomerID = custB.CustomerID,
                FdSchemeID = 1,
                ReceiptNo = "10",
                DepositAmount = 15000m,
                OpeningDate = businessDate,
                DurationType = "Months",
                DurationValue = 12,
                PaymentMode = "Cash"
            });
            Assert.IsType<BadRequestObjectResult>(newOpenSameSchemeBlocked.Result);

            // 4. Attempting CUSTOM renewal in Scheme 1 using Scheme 3's 14-digit CBS AccountNo MUST STILL BE BLOCKED branch-wide
            var cbsConflict = await FdRenewalPolicyHelper.FindUnrelatedActiveReceiptConflictAsync(
                db, branchId: 1, chainRootId: 0, currentParentId: 801, receiptNo: "00140300008029", schemeId: 1);
            Assert.NotNull(cbsConflict);
            Assert.Equal(802, cbsConflict!.FdAccountID);
        }

        [Fact]
        public async Task Renew_WhenCustomerHasOverdueOrActiveLoan_AllowsBothPrincipalOnlyCashAndFullRoll()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 4, 30);
            var (_, custA, _) = await SeedBaseFdEnvironmentAsync(db, "RETAIN_ORIGINAL", allowManual: false, businessDate);

            // Seed ₹2,81,224 active/overdue loan on custA (exact screenshot scenario)
            db.LoanAccounts.Add(new LoanAccount
            {
                LoanAccountID = 501,
                BranchID = 1,
                CustomerID = custA.CustomerID,
                LoanAccountNo = "001-601-0000501-1",
                SanctionedAmount = 300000m,
                PrincipalBalance = 250000m,
                InterestBalance = 25000m,
                OverdueInterestBalance = 6224m,
                InterestRate = 14m,
                OpeningDate = new DateTime(2025, 1, 1),
                LastInterestPostingDate = businessDate,
                Status = "Active"
            });

            db.FdAccounts.AddRange(
                new FdAccount
                {
                    FdAccountID = 941,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custA.CustomerID,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000263-7",
                    ReceiptNo = "1177",
                    LegacyAccountNumber = "1177",
                    OpeningDate = new DateTime(2025, 3, 29),
                    MaturityDate = new DateTime(2026, 4, 29),
                    DurationType = "Days",
                    DurationValue = 396,
                    DurationInDays = 396,
                    DepositAmount = 50000m,
                    MaturityAmount = 54870m,
                    InterestRate = 9m,
                    Status = "Active"
                },
                new FdAccount
                {
                    FdAccountID = 942,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custA.CustomerID,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000264-5",
                    ReceiptNo = "1178",
                    LegacyAccountNumber = "1178",
                    OpeningDate = new DateTime(2025, 3, 29),
                    MaturityDate = new DateTime(2026, 4, 29),
                    DurationType = "Days",
                    DurationValue = 396,
                    DurationInDays = 396,
                    DepositAmount = 50000m,
                    MaturityAmount = 54870m,
                    InterestRate = 9m,
                    Status = "Active"
                }
            );
            await db.SaveChangesAsync();

            var controller = new FdAccountsController(db);
            AttachUser(controller, BuildPrincipal(10, "ho_admin", "Admin", branchId: 1, businessDate: businessDate));

            // 1. PrincipalOnly renewal (₹50,000 renewed + ₹4,870 Cash interest payout) MUST SUCCEED despite ₹2,81,224 overdue loan
            var prinOnlyRes = ParseOkJson(await controller.Renew(941, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalOnly",
                PaymentMode = "Cash",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 13
            }));
            Assert.Equal(50000m, prinOnlyRes.GetProperty("NewDeposit").GetDecimal());
            string intVoucherNo = prinOnlyRes.GetProperty("InterestVoucherNo").GetString()!;
            Assert.False(string.IsNullOrWhiteSpace(intVoucherNo));
            var intVoucher = await db.Vouchers.FirstAsync(v => v.VoucherNo == intVoucherNo);
            Assert.Equal(4870m, intVoucher.TotalAmount);
            Assert.Equal("1177", prinOnlyRes.GetProperty("NewReceiptNo").GetString());

            // 2. PrincipalPlusInterest renewal MUST ALSO SUCCEED
            var fullRollRes = ParseOkJson(await controller.Renew(942, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 13
            }));
            Assert.Equal(54870m, fullRollRes.GetProperty("NewDeposit").GetDecimal());
            Assert.Equal("1178", fullRollRes.GetProperty("NewReceiptNo").GetString());
        }

        [Fact]
        public async Task Renew_WhenFdIsLienMarked_AllowsRenewalAndCarriesForwardLienAndCollateral_AndRestoresOnRollback()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 4, 30);
            var (_, custA, _) = await SeedBaseFdEnvironmentAsync(db, "RETAIN_ORIGINAL", allowManual: false, businessDate);

            db.LoanAccounts.Add(new LoanAccount
            {
                LoanAccountID = 502,
                BranchID = 1,
                CustomerID = custA.CustomerID,
                LoanAccountNo = "LN-FD-502",
                SanctionedAmount = 40000m,
                PrincipalBalance = 35000m,
                InterestBalance = 1200m,
                OverdueInterestBalance = 0m,
                InterestRate = 12m,
                OpeningDate = new DateTime(2025, 5, 1),
                LastInterestPostingDate = businessDate,
                SecurityDetails = "FD Pledge: 001-401-0000950-1",
                Status = "Active"
            });

            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 950,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = custA.CustomerID,
                FdSchemeID = 1,
                AccountNo = "001-401-0000950-1",
                ReceiptNo = "1250",
                LegacyAccountNumber = "1250",
                OpeningDate = new DateTime(2025, 4, 29),
                MaturityDate = new DateTime(2026, 4, 29),
                DurationType = "Months",
                DurationValue = 12,
                DurationInDays = 365,
                DepositAmount = 50000m,
                MaturityAmount = 55000m,
                InterestRate = 10m,
                IsLienMarked = true,
                LienLoanAccountNo = "LN-FD-502",
                LienAmount = 40000m,
                Status = "Active"
            });

            db.LoanDepositCollaterals.Add(new LoanDepositCollateral
            {
                CollateralID = 701,
                LoanAccountID = 502,
                CustomerID = custA.CustomerID,
                CollateralType = "FixedDeposit",
                DepositAccountID = 950,
                DepositAccountNo = "001-401-0000950-1",
                DepositAmount = 50000m,
                CurrentDepositBalance = 50000m,
                LienAmount = 40000m,
                LienStatus = "LienMarked"
            });
            await db.SaveChangesAsync();

            var adminUser = BuildPrincipal(10, "ho_admin", "Admin", branchId: 1, businessDate: businessDate);
            var fdController = new FdAccountsController(db);
            AttachUser(fdController, adminUser);

            var renewRes = ParseOkJson(await fdController.Renew(950, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = businessDate,
                DurationType = "Months",
                DurationValue = 12
            }));

            string newAccNo = renewRes.GetProperty("NewAccountNo").GetString()!;
            string voucherNo = renewRes.GetProperty("VoucherNo").GetString()!;

            var newFd = await db.FdAccounts.FirstAsync(a => a.AccountNo == newAccNo);
            Assert.True(newFd.IsLienMarked);
            Assert.Equal("LN-FD-502", newFd.LienLoanAccountNo);
            Assert.Equal(40000m, newFd.LienAmount);

            var colAfterRenew = await db.LoanDepositCollaterals.FindAsync(701);
            Assert.Equal(newFd.FdAccountID, colAfterRenew!.DepositAccountID);
            Assert.Equal(newAccNo, colAfterRenew.DepositAccountNo);

            var loanAfterRenew = await db.LoanAccounts.FindAsync(502);
            Assert.Contains(newAccNo, loanAfterRenew!.SecurityDetails);

            // Rollback the pending renewal voucher and verify lien + collateral restore cleanly onto old FD 950
            var renVoucher = await db.Vouchers.FirstAsync(v => v.VoucherNo == voucherNo);
            var postingController = new VoucherPostingController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(postingController, adminUser);

            var rejectRes = await postingController.RejectVoucher(renVoucher.VoucherID, new VoucherPostingController.VoucherRejectDto
            {
                Reason = "Rollback inherited lien test"
            });
            Assert.IsType<OkObjectResult>(rejectRes);

            var restoredOld = await db.FdAccounts.FindAsync(950);
            Assert.Equal("Matured", restoredOld!.Status);
            Assert.True(restoredOld.IsLienMarked);

            var colRestored = await db.LoanDepositCollaterals.FindAsync(701);
            Assert.Equal(950, colRestored!.DepositAccountID);
            Assert.Equal("001-401-0000950-1", colRestored.DepositAccountNo);

            var loanRestored = await db.LoanAccounts.FindAsync(502);
            Assert.Contains("001-401-0000950-1", loanRestored!.SecurityDetails);
        }

        [Fact]
        public async Task CloseAndPrematureClose_WhenActiveOrOverdueLoanExists_BlocksDirectCashBreak_ButAllowsFullLoanAdjustment()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 4, 30);
            var (_, custA, _) = await SeedBaseFdEnvironmentAsync(db, "RETAIN_ORIGINAL", allowManual: false, businessDate);

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 105, GroupID = 3, LedgerCode = "LN-PRIN", LedgerName = "कर्ज मुद्दल येणे", AccountType = "Loan", IsActive = true },
                new Ledger { LedgerID = 106, GroupID = 2, LedgerCode = "LN-INT", LedgerName = "कर्ज व्याज उत्पन्न", AccountType = "Income", IsActive = true },
                new Ledger { LedgerID = 107, GroupID = 2, LedgerCode = "LN-PEN", LedgerName = "थकीत दंड व्याज", AccountType = "Income", IsActive = true }
            );
            db.LoanRates.Add(new LoanRate
            {
                LoanRateID = 1,
                LoanType = "वैयक्तिक कर्ज",
                LoanCode = "LN601",
                LoanLedgerID = 105,
                InterestLedgerID = 106,
                OverdueInterestLedgerID = 107,
                InterestRate = 14m,
                OverdueInterestRate = 2m
            });
            db.LoanAccounts.Add(new LoanAccount
            {
                LoanAccountID = 503,
                BranchID = 1,
                CustomerID = custA.CustomerID,
                LoanRateID = 1,
                LoanAccountNo = "001-601-0000503-8",
                SanctionedAmount = 100000m,
                PrincipalBalance = 80000m,
                InterestBalance = 5000m,
                OverdueInterestBalance = 2000m,
                InterestRate = 14m,
                OpeningDate = new DateTime(2025, 1, 1),
                LastInterestPostingDate = businessDate,
                Status = "Active"
            });

            db.FdAccounts.AddRange(
                new FdAccount
                {
                    FdAccountID = 961,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custA.CustomerID,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000961-1",
                    ReceiptNo = "1301",
                    LegacyAccountNumber = "1301",
                    OpeningDate = new DateTime(2025, 4, 20),
                    MaturityDate = new DateTime(2026, 4, 20),
                    DurationType = "Months",
                    DurationValue = 12,
                    DurationInDays = 365,
                    DepositAmount = 50000m,
                    MaturityAmount = 55000m,
                    InterestRate = 10m,
                    IsLienMarked = true,
                    LienLoanAccountNo = "001-601-0000503-8",
                    Status = "Active"
                },
                new FdAccount
                {
                    FdAccountID = 962,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custA.CustomerID,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000962-9",
                    ReceiptNo = "1302",
                    LegacyAccountNumber = "1302",
                    OpeningDate = new DateTime(2026, 1, 1),
                    MaturityDate = new DateTime(2027, 1, 1),
                    DurationType = "Months",
                    DurationValue = 12,
                    DurationInDays = 365,
                    DepositAmount = 40000m,
                    MaturityAmount = 44000m,
                    InterestRate = 10m,
                    IsLienMarked = true,
                    LienLoanAccountNo = "001-601-0000503-8",
                    Status = "Active"
                }
            );
            await db.SaveChangesAsync();

            var controller = new FdAccountsController(db);
            AttachUser(controller, BuildPrincipal(10, "ho_admin", "Admin", branchId: 1, businessDate: businessDate));

            // 1. MaturedClose with AdjustInLoan = false MUST BE BLOCKED when active/overdue loan exists
            var directMaturedBreak = await controller.MaturedClose(961, new FdClosureRequest
            {
                ClosureDate = businessDate,
                PaymentMode = "Cash",
                AdjustInLoan = false
            });
            Assert.IsType<BadRequestObjectResult>(directMaturedBreak);
            Assert.Equal("Active", (await db.FdAccounts.FindAsync(961))!.Status);

            // 2. PrematureClose with AdjustInLoan = false MUST ALSO BE BLOCKED when active/overdue loan exists
            var directPrematureBreak = await controller.PrematureClose(962, businessDate, new FdClosureRequest
            {
                ClosureDate = businessDate,
                PaymentMode = "Cash",
                AdjustInLoan = false
            });
            Assert.IsType<BadRequestObjectResult>(directPrematureBreak);
            Assert.Equal("Active", (await db.FdAccounts.FindAsync(962))!.Status);

            // 3. Partial LoanAdjustmentAmount (< maxAdjustable) MUST BE BLOCKED (no cash leak loophole)
            var partialLoanAdj = await controller.MaturedClose(961, new FdClosureRequest
            {
                ClosureDate = businessDate,
                PaymentMode = "Cash",
                AdjustInLoan = true,
                TargetLoanAccountID = 503,
                LoanAdjustmentAmount = 1000m
            });
            Assert.IsType<BadRequestObjectResult>(partialLoanAdj);

            // 4. Full AdjustInLoan (entire ₹55,000 maturity payout applied to loan 503) MUST SUCCEED
            var fullLoanAdj = await controller.MaturedClose(961, new FdClosureRequest
            {
                ClosureDate = businessDate,
                PaymentMode = "Cash",
                AdjustInLoan = true,
                TargetLoanAccountID = 503
            });
            Assert.IsType<OkObjectResult>(fullLoanAdj);

            var closedFd = await db.FdAccounts.FindAsync(961);
            Assert.Equal("Closed", closedFd!.Status);

            var updatedLoan = await db.LoanAccounts.FindAsync(503);
            Assert.Equal(0m, updatedLoan!.OverdueInterestBalance);
            Assert.Equal(0m, updatedLoan.InterestBalance);
            Assert.Equal(32000m, updatedLoan.PrincipalBalance); // 80,000 - (55,000 - 2,000 - 5,000) = 32,000
        }

        [Fact]
        public async Task CloseAndPrematureClose_WhenFdIsUnpledgedRegular_AllowsDirectSavingTransferEvenWhenCustomerHasActiveLoan()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 4, 27);
            var (_, custA, _) = await SeedBaseFdEnvironmentAsync(db, "RETAIN_ORIGINAL", allowManual: false, businessDate);

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 105, GroupID = 3, LedgerCode = "LN-PRIN", LedgerName = "कर्ज मुद्दल येणे", AccountType = "Loan", IsActive = true },
                new Ledger { LedgerID = 106, GroupID = 2, LedgerCode = "LN-INT", LedgerName = "कर्ज व्याज उत्पन्न", AccountType = "Income", IsActive = true },
                new Ledger { LedgerID = 107, GroupID = 2, LedgerCode = "LN-PEN", LedgerName = "थकीत दंड व्याज", AccountType = "Income", IsActive = true },
                new Ledger { LedgerID = 108, GroupID = 1, LedgerCode = "SB-LIAB", LedgerName = "बचत ठेव", AccountType = "Saving", IsActive = true }
            );
            db.LoanRates.Add(new LoanRate
            {
                LoanRateID = 1,
                LoanType = "ठेव तारण",
                LoanCode = "LN204",
                LoanLedgerID = 105,
                InterestLedgerID = 106,
                OverdueInterestLedgerID = 107,
                InterestRate = 12m,
                OverdueInterestRate = 2m
            });

            // Customer has another active FD (1340) pledged against active Loan 001-204-0000482-2 (₹3,15,551)
            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 1340,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = custA.CustomerID,
                FdSchemeID = 1,
                AccountNo = "001-401-0001340-1",
                ReceiptNo = "1340",
                LegacyAccountNumber = "1340",
                OpeningDate = new DateTime(2025, 4, 1),
                MaturityDate = new DateTime(2027, 4, 1),
                DurationType = "Months",
                DurationValue = 24,
                DurationInDays = 730,
                DepositAmount = 400000m,
                MaturityAmount = 480000m,
                InterestRate = 10m,
                IsLienMarked = true,
                LienLoanAccountNo = "001-204-0000482-2",
                Status = "Active"
            });

            db.LoanAccounts.Add(new LoanAccount
            {
                LoanAccountID = 482,
                BranchID = 1,
                CustomerID = custA.CustomerID,
                LoanRateID = 1,
                LoanAccountNo = "001-204-0000482-2",
                SanctionedAmount = 315551m,
                PrincipalBalance = 315551m,
                InterestBalance = 0m,
                OverdueInterestBalance = 0m,
                InterestRate = 12m,
                OpeningDate = new DateTime(2025, 11, 17),
                LastInterestPostingDate = businessDate,
                SecurityDetails = "ठेव तारण: 001-401-0001340-1",
                Status = "Active"
            });

            // Unpledged regular FDs (1343 Premature, 1345 Matured)
            db.FdAccounts.AddRange(
                new FdAccount
                {
                    FdAccountID = 1343,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custA.CustomerID,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0001343-5",
                    ReceiptNo = "1343",
                    LegacyAccountNumber = "1343",
                    OpeningDate = new DateTime(2025, 11, 17),
                    MaturityDate = new DateTime(2026, 12, 17),
                    DurationType = "Days",
                    DurationValue = 395,
                    DurationInDays = 395,
                    DepositAmount = 100000m,
                    MaturityAmount = 110833m,
                    InterestRate = 10m,
                    IsLienMarked = false,
                    Status = "Active"
                },
                new FdAccount
                {
                    FdAccountID = 1345,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = custA.CustomerID,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0001345-2",
                    ReceiptNo = "1345",
                    LegacyAccountNumber = "1345",
                    OpeningDate = new DateTime(2025, 4, 20),
                    MaturityDate = new DateTime(2026, 4, 20),
                    DurationType = "Months",
                    DurationValue = 12,
                    DurationInDays = 365,
                    DepositAmount = 100000m,
                    MaturityAmount = 110000m,
                    InterestRate = 10m,
                    IsLienMarked = false,
                    Status = "Active"
                }
            );

            var savingAccount = new SavingAccountMaster
            {
                SavingAccountID = 601,
                BranchID = 1,
                CustomerID = custA.CustomerID,
                LedgerID = 108,
                AccountNo = "00110100000601",
                OpeningDate = new DateTime(2025, 1, 1),
                CurrentBalance = 1000m,
                Status = "Active"
            };
            db.SavingAccountMasters.Add(savingAccount);
            await db.SaveChangesAsync();

            var controller = new FdAccountsController(db);
            AttachUser(controller, BuildPrincipal(10, "ho_admin", "Admin", branchId: 1, businessDate: businessDate));

            // 1. ActiveLoans endpoint must report hasActiveLoan = true AND hasDirectLien = false for FD 1343
            var activeLoansJson = ParseOkJson(await controller.GetActiveLoansForFd(1343, businessDate));
            Assert.True(activeLoansJson.GetProperty("hasActiveLoan").GetBoolean());
            Assert.False(activeLoansJson.GetProperty("hasDirectLien").GetBoolean());

            // 2. PrematureClose on unpledged FD 1343 directly to Saving Transfer (AdjustInLoan = false) MUST SUCCEED
            var prematureRes = await controller.PrematureClose(1343, businessDate, new FdClosureRequest
            {
                ClosureDate = businessDate,
                PaymentMode = "Transfer",
                SavingAccountID = savingAccount.SavingAccountID,
                AdjustInLoan = false,
                IsManualAmountOverride = true,
                CustomAccruedInterest = 3529m,
                ManualOverrideReason = "थेट सेटलमेंट संपादन",
                InterestDebitMode = "Expense"
            });
            Assert.IsType<OkObjectResult>(prematureRes);
            Assert.Equal("Closed", (await db.FdAccounts.FindAsync(1343))!.Status);
            Assert.Equal(104529m, (await db.SavingAccountMasters.FindAsync(601))!.CurrentBalance); // 1,000 + 1,03,529

            // 3. MaturedClose on unpledged FD 1345 directly to Saving Transfer (AdjustInLoan = false) MUST ALSO SUCCEED
            var maturedRes = await controller.MaturedClose(1345, new FdClosureRequest
            {
                ClosureDate = businessDate,
                PaymentMode = "Transfer",
                SavingAccountID = savingAccount.SavingAccountID,
                AdjustInLoan = false,
                InterestDebitMode = "Expense"
            });
            Assert.IsType<OkObjectResult>(maturedRes);
            Assert.Equal("Closed", (await db.FdAccounts.FindAsync(1345))!.Status);
            Assert.Equal(214529m, (await db.SavingAccountMasters.FindAsync(601))!.CurrentBalance); // 1,04,529 + 1,10,000
        }
    }
}
