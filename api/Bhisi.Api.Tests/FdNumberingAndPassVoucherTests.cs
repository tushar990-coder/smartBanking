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
    public class FdNumberingAndPassVoucherTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"BhisiFdNumberingPass_{Guid.NewGuid()}")
                .ConfigureWarnings(x => x.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ClaimsPrincipal BuildPrincipal(int userId, string username, string role, int branchId, DateTime businessDate)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Name, username),
                new Claim(ClaimTypes.Role, role),
                new Claim("BranchID", branchId.ToString()),
                new Claim("DefaultBranchID", branchId.ToString()),
                new Claim("BusinessDate", businessDate.ToString("yyyy-MM-dd"))
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

        private static JsonElement ParseOkJson(IActionResult actionResult)
        {
            var ok = Assert.IsType<OkObjectResult>(actionResult);
            var json = JsonSerializer.Serialize(ok.Value);
            return JsonDocument.Parse(json).RootElement;
        }

        private static async Task SeedEnvironmentAsync(AppDbContext db, DateTime businessDate, bool includeSchemeLedgers = true)
        {
            db.SansthaDetails.Add(new SansthaDetail
            {
                SansthaID = 1,
                SansthaName = "स्मार्ट पतसंस्था",
                FdRenewalReceiptPolicy = "NEW_RECEIPT",
                AllowManualReceiptNoOnRenewal = false
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
                StartDate = businessDate.AddYears(-2),
                EndDate = businessDate.AddYears(2),
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
                new AccountGroup { GroupID = 2, GroupName = "खर्च", NatureOfGroup = "Expenses", IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 101, GroupID = 1, LedgerCode = "FD-LIAB", LedgerName = "मुदत ठेव दायित्व", AccountType = "Fixed Deposit", IsActive = true },
                new Ledger { LedgerID = 102, GroupID = 1, LedgerCode = "FD-PAY", LedgerName = "मुदत ठेव देणे व्याज", AccountType = "Payable", IsActive = true },
                new Ledger { LedgerID = 103, GroupID = 2, LedgerCode = "FD-EXP", LedgerName = "मुदत ठेव व्याज खर्च", AccountType = "Expenses", IsActive = true },
                new Ledger { LedgerID = 104, GroupID = 1, LedgerCode = "SAV-LIAB", LedgerName = "बचत ठेव दायित्व", AccountType = "Saving", IsActive = true }
            );

            db.FdSchemes.Add(new FdScheme
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
                FdLiabilityLedgerID = includeSchemeLedgers ? 101 : null,
                InterestPayableLedgerID = includeSchemeLedgers ? 102 : null,
                InterestExpenseLedgerID = includeSchemeLedgers ? 103 : null,
                IsActive = true
            });

            db.Customers.Add(new Customer
            {
                CustomerID = 1,
                CIFNo = "CIF000001",
                FirstName = "विजय",
                LastName = "जाधव",
                BirthDate = new DateTime(1980, 1, 1),
                BranchID = 1
            });

            db.Members.Add(new Member
            {
                MemberID = 1,
                CustomerID = 1,
                MemberCode = "M001",
                BranchID = 1,
                Status = "Active"
            });

            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task RetroactiveAutoRenewal_BackdatedMaturityDate_PendingInTodayQueue_AndZeroAsOnDateDoubleCounting()
        {
            await using var db = CreateContext();
            var todayOpen = DateTime.Today;
            var overdueMaturity = todayOpen.AddDays(-10);
            await SeedEnvironmentAsync(db, todayOpen);

            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 1001,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = 1,
                FdSchemeID = 1,
                AccountNo = "001-401-0000001-9",
                ReceiptNo = "001-401-0000001-9",
                OpeningDate = overdueMaturity.AddYears(-1),
                MaturityDate = overdueMaturity,
                DepositAmount = 100000m,
                InterestRate = 10.00m,
                DurationType = "Months",
                DurationValue = 12,
                DurationInDays = 365,
                MaturityAmount = 110000m,
                Status = "Active",
                IsAutoRenewable = true,
                AutoRenewalOption = "PrincipalPlusInterest",
                MaxAutoRenewalCycles = 3,
                AutoRenewalCount = 0
            });
            await db.SaveChangesAsync();

            var creatorUser = BuildPrincipal(10, "maker", "Admin", 1, todayOpen);
            var fdCtrl = new FdAccountsController(db);
            AttachUser(fdCtrl, creatorUser);

            var batchRes = ParseOkJson(await fdCtrl.RunAutoRenewalBatch(new AutoRenewalBatchRequest
            {
                BranchID = 1,
                ProcessDate = todayOpen,
                SpecificAccountIDs = new List<int> { 1001 }
            }));

            Assert.Equal(1, batchRes.GetProperty("SuccessCount").GetInt32());
            var item = batchRes.GetProperty("Items")[0];
            int newFdId = item.GetProperty("NewFdAccountID").GetInt32();
            string newAccNo = item.GetProperty("NewAccountNo").GetString()!;
            string voucherNo = item.GetProperty("VoucherNo").GetString()!;
            int voucherId = item.GetProperty("VoucherID").GetInt32();

            // 1. Unified 14-digit CBS AccountNo & sequential numbering
            Assert.Matches(@"^\d{3}-\d{3}-\d{7}-\d$", newAccNo);
            Assert.StartsWith("JV-FD-AUTOREN-", voucherNo);

            // 2. New FD OpeningDate = oldAccount.MaturityDate, while VoucherDate = todayOpen & Pending
            var newFd = await db.FdAccounts.FindAsync(newFdId);
            Assert.NotNull(newFd);
            Assert.Equal(overdueMaturity.Date, newFd!.OpeningDate.Date);

            var voucher = await db.Vouchers.FindAsync(voucherId);
            Assert.NotNull(voucher);
            Assert.Equal("Pending", voucher!.Status);
            Assert.Equal(todayOpen.Date, voucher.VoucherDate.Date);

            // 3. CRITICAL: As of overdueMaturity (after OpeningDate, before VoucherDate), NO double counting (ONLY old 1,00,000)!
            decimal asOfMaturityTotal = await FdDepositQueryHelper.GetLiveFdTotalAsOfAsync(db, overdueMaturity, branchId: 1);
            Assert.Equal(100000m, asOfMaturityTotal);

            // As of todayOpen, ONLY renewed amount 1,10,000 is live
            decimal asOfTodayTotal = await FdDepositQueryHelper.GetLiveFdTotalAsOfAsync(db, todayOpen, branchId: 1);
            Assert.Equal(110000m, asOfTodayTotal);

            // 4. Visible in Pass Voucher Queue & Postable cleanly
            var approverUser = BuildPrincipal(20, "checker", "Admin", 1, todayOpen);
            var postingCtrl = new VoucherPostingController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(postingCtrl, approverUser);

            var pendingRes = await postingCtrl.GetUnpostedVouchers(branchId: 1, voucherDate: todayOpen);
            var pendingList = Assert.IsAssignableFrom<IEnumerable<Voucher>>(pendingRes.Value).ToList();
            Assert.Contains(pendingList, v => v.VoucherID == voucherId && v.VoucherNo == voucherNo);

            var postRes = await postingCtrl.PostVouchers(new VoucherPostingController.PostVouchersRequest
            {
                VoucherIds = new List<int> { voucherId },
                BusinessDate = todayOpen
            });
            Assert.IsType<OkObjectResult>(postRes);
            Assert.Equal("Approved", (await db.Vouchers.FindAsync(voucherId))!.Status);
        }

        [Fact]
        public async Task PrincipalOnly_AutoRenewal_WithoutActiveLinkedSaving_FailsStrictlyWithoutCashOrOtherSavingFallback()
        {
            await using var db = CreateContext();
            var todayOpen = DateTime.Today;
            await SeedEnvironmentAsync(db, todayOpen);

            // Even though customer has another Active saving account 502, FD 1010 points to missing/closed SavingAccountID = 501
            db.SavingAccountMasters.AddRange(
                new SavingAccountMaster { SavingAccountID = 501, BranchID = 1, CustomerID = 1, AccountNo = "SAV-CLOSED", LedgerID = 104, CurrentBalance = 0m, Status = "Closed" },
                new SavingAccountMaster { SavingAccountID = 502, BranchID = 1, CustomerID = 1, AccountNo = "SAV-OTHER", LedgerID = 104, CurrentBalance = 1000m, Status = "Active" }
            );

            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 1010,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = 1,
                FdSchemeID = 1,
                AccountNo = "001-401-0000010-1",
                ReceiptNo = "001-401-0000010-1",
                OpeningDate = todayOpen.AddYears(-1),
                MaturityDate = todayOpen,
                DepositAmount = 50000m,
                InterestRate = 10.00m,
                MaturityAmount = 55000m,
                Status = "Matured",
                IsAutoRenewable = true,
                AutoRenewalOption = "PrincipalOnly",
                SavingAccountID = 501,
                MaxAutoRenewalCycles = 3
            });
            await db.SaveChangesAsync();

            var adminUser = BuildPrincipal(10, "admin", "Admin", 1, todayOpen);
            var fdCtrl = new FdAccountsController(db);
            AttachUser(fdCtrl, adminUser);

            var batchRes = ParseOkJson(await fdCtrl.RunAutoRenewalBatch(new AutoRenewalBatchRequest
            {
                BranchID = 1,
                ProcessDate = todayOpen,
                SpecificAccountIDs = new List<int> { 1010 }
            }));

            Assert.Equal(0, batchRes.GetProperty("SuccessCount").GetInt32());
            Assert.Equal(1, batchRes.GetProperty("FailedCount").GetInt32());
            Assert.Equal("Failed", batchRes.GetProperty("Items")[0].GetProperty("Status").GetString());

            // Strictly no voucher, no child FD, no credit to other saving account 502
            Assert.False(await db.Vouchers.AnyAsync());
            Assert.Single(await db.FdAccounts.ToListAsync());
            Assert.Equal(1000m, (await db.SavingAccountMasters.FindAsync(502))!.CurrentBalance);
        }

        [Fact]
        public async Task AutoRenewal_BlockedWhenLoanCollateralOrPendingVoucherExists()
        {
            await using var db = CreateContext();
            var todayOpen = DateTime.Today;
            await SeedEnvironmentAsync(db, todayOpen);

            db.FdAccounts.AddRange(
                // Account 1020: Pledged in LoanDepositCollaterals (IsLienMarked=false to verify collateral table check)
                new FdAccount
                {
                    FdAccountID = 1020,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = 1,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000020-1",
                    OpeningDate = todayOpen.AddYears(-1),
                    MaturityDate = todayOpen,
                    DepositAmount = 50000m,
                    InterestRate = 10m,
                    MaturityAmount = 55000m,
                    Status = "Matured",
                    IsAutoRenewable = true,
                    IsLienMarked = false,
                    MaxAutoRenewalCycles = 3
                },
                // Account 1021: Has an existing Pending closure/settlement voucher
                new FdAccount
                {
                    FdAccountID = 1021,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = 1,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000021-1",
                    OpeningDate = todayOpen.AddYears(-1),
                    MaturityDate = todayOpen,
                    DepositAmount = 40000m,
                    InterestRate = 10m,
                    MaturityAmount = 44000m,
                    Status = "Matured",
                    IsAutoRenewable = true,
                    MaxAutoRenewalCycles = 3
                }
            );

            db.LoanDepositCollaterals.Add(new LoanDepositCollateral
            {
                CollateralID = 1,
                LoanAccountID = 1,
                CustomerID = 1,
                CollateralType = "FixedDeposit",
                DepositAccountID = 1020,
                DepositAccountNo = "001-401-0000020-1",
                LienAmount = 50000m
            });

            db.Vouchers.Add(new Voucher
            {
                VoucherID = 8001,
                BranchID = 1,
                VoucherNo = "JV-FD-CLOSE-001-401-0000021-1",
                VoucherDate = todayOpen,
                VoucherType = "Journal",
                TotalAmount = 44000m,
                Status = "Pending"
            });

            db.FdTransactions.Add(new FdTransaction
            {
                FdTransactionID = 8001,
                BranchID = 1,
                FdAccountID = 1021,
                VoucherID = 8001,
                TransactionDate = todayOpen,
                TransactionType = "Payout",
                DebitCredit = "Dr",
                Amount = 44000m
            });
            await db.SaveChangesAsync();

            var adminUser = BuildPrincipal(10, "admin", "Admin", 1, todayOpen);
            var fdCtrl = new FdAccountsController(db);
            AttachUser(fdCtrl, adminUser);

            var batchRes = ParseOkJson(await fdCtrl.RunAutoRenewalBatch(new AutoRenewalBatchRequest
            {
                BranchID = 1,
                ProcessDate = todayOpen,
                SpecificAccountIDs = new List<int> { 1020, 1021 }
            }));

            Assert.Equal(0, batchRes.GetProperty("SuccessCount").GetInt32());
            Assert.Equal(2, batchRes.GetProperty("FailedCount").GetInt32());
        }

        [Fact]
        public async Task MissingSchemeLiabilityLedger_FailsStrictlyInBothManualAndAutoRenewal()
        {
            await using var db = CreateContext();
            var todayOpen = DateTime.Today;
            await SeedEnvironmentAsync(db, todayOpen, includeSchemeLedgers: false);

            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 1030,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = 1,
                FdSchemeID = 1,
                AccountNo = "001-401-0000030-1",
                OpeningDate = todayOpen.AddYears(-1),
                MaturityDate = todayOpen,
                DepositAmount = 25000m,
                InterestRate = 10m,
                MaturityAmount = 27500m,
                Status = "Matured",
                IsAutoRenewable = true,
                MaxAutoRenewalCycles = 3
            });
            await db.SaveChangesAsync();

            var adminUser = BuildPrincipal(10, "admin", "Admin", 1, todayOpen);
            var fdCtrl = new FdAccountsController(db);
            AttachUser(fdCtrl, adminUser);

            // Auto-renewal must fail strictly even though Ledger 101 exists in Ledgers table by name
            var batchRes = ParseOkJson(await fdCtrl.RunAutoRenewalBatch(new AutoRenewalBatchRequest
            {
                BranchID = 1,
                ProcessDate = todayOpen,
                SpecificAccountIDs = new List<int> { 1030 }
            }));
            Assert.Equal(0, batchRes.GetProperty("SuccessCount").GetInt32());
            Assert.Equal(1, batchRes.GetProperty("FailedCount").GetInt32());

            // Manual renew must also return BadRequest cleanly without guessing FD ledger by name
            var manualRes = await fdCtrl.Renew(1030, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalPlusInterest",
                ClosureDate = todayOpen,
                DurationType = "Months",
                DurationValue = 12
            });
            Assert.IsType<BadRequestObjectResult>(manualRes);
        }

        [Fact]
        public async Task ManualRenew_PrincipalOnly_LinksRelatedVoucherPair_AndPostVouchersApprovesBothAtomically()
        {
            await using var db = CreateContext();
            var todayOpen = DateTime.Today;
            await SeedEnvironmentAsync(db, todayOpen);

            db.SavingAccountMasters.Add(new SavingAccountMaster
            {
                SavingAccountID = 510,
                BranchID = 1,
                CustomerID = 1,
                AccountNo = "SAV-510",
                LedgerID = 104,
                OpeningBalance = 2000m,
                CurrentBalance = 2000m,
                Status = "Active"
            });

            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 1040,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = 1,
                FdSchemeID = 1,
                AccountNo = "001-401-0000040-1",
                ReceiptNo = "001-401-0000040-1",
                OpeningDate = todayOpen.AddYears(-1),
                MaturityDate = todayOpen,
                DepositAmount = 100000m,
                InterestRate = 10m,
                DurationType = "Months",
                DurationValue = 12,
                DurationInDays = 365,
                MaturityAmount = 110000m,
                Status = "Matured"
            });
            await db.SaveChangesAsync();

            var makerUser = BuildPrincipal(10, "maker", "Admin", 1, todayOpen);
            var fdCtrl = new FdAccountsController(db);
            AttachUser(fdCtrl, makerUser);

            var renRes = ParseOkJson(await fdCtrl.Renew(1040, new FdRenewalRequest
            {
                TargetSchemeID = 1,
                RenewalType = "PrincipalOnly",
                ClosureDate = todayOpen,
                PaymentMode = "Transfer",
                SavingAccountID = 510,
                DurationType = "Months",
                DurationValue = 12
            }));

            string vNo1 = renRes.GetProperty("VoucherNo").GetString()!;
            string vNo2 = renRes.GetProperty("InterestVoucherNo").GetString()!;
            Assert.StartsWith("JV-FD-REN-", vNo1);
            Assert.StartsWith("JV-FD-INT-", vNo2);

            var v1 = await db.Vouchers.FirstAsync(v => v.VoucherNo == vNo1);
            var v2 = await db.Vouchers.FirstAsync(v => v.VoucherNo == vNo2);

            Assert.Equal(v2.VoucherID, v1.RelatedVoucherID);
            Assert.Equal(v1.VoucherID, v2.RelatedVoucherID);

            // Passing only voucher1 must atomically approve BOTH voucher1 and voucher2 via RelatedVoucherID
            var checkerUser = BuildPrincipal(20, "checker", "Admin", 1, todayOpen);
            var postingCtrl = new VoucherPostingController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(postingCtrl, checkerUser);

            var postRes = await postingCtrl.PostVouchers(new VoucherPostingController.PostVouchersRequest
            {
                VoucherIds = new List<int> { v1.VoucherID },
                BusinessDate = todayOpen
            });
            Assert.IsType<OkObjectResult>(postRes);

            Assert.Equal("Approved", (await db.Vouchers.FindAsync(v1.VoucherID))!.Status);
            Assert.Equal("Approved", (await db.Vouchers.FindAsync(v2.VoucherID))!.Status);
        }
    }
}
