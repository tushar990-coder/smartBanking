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
    public class FdAutoRenewalRollbackTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"BhisiFdAutoRenRollback_{Guid.NewGuid()}")
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

        private static async Task<FdScheme> SeedEnvironmentAsync(AppDbContext db, DateTime businessDate, string policy = "RETAIN_ORIGINAL")
        {
            db.SansthaDetails.Add(new SansthaDetail
            {
                SansthaID = 1,
                SansthaName = "स्मार्ट पतसंस्था",
                FdRenewalReceiptPolicy = policy,
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
                new AccountGroup { GroupID = 3, GroupName = "रोख शिल्लक", NatureOfGroup = "Assets", IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 101, GroupID = 1, LedgerCode = "FD-LIAB", LedgerName = "मुदत ठेव दायित्व", AccountType = "Fixed Deposit", IsActive = true },
                new Ledger { LedgerID = 102, GroupID = 1, LedgerCode = "FD-PAY", LedgerName = "मुदत ठेव देणे व्याज", AccountType = "Payable", IsActive = true },
                new Ledger { LedgerID = 103, GroupID = 2, LedgerCode = "FD-EXP", LedgerName = "मुदत ठेव व्याज खर्च", AccountType = "Expenses", IsActive = true },
                new Ledger { LedgerID = 104, GroupID = 1, LedgerCode = "SAV-LIAB", LedgerName = "बचत ठेव दायित्व", AccountType = "Saving", IsActive = true },
                new Ledger { LedgerID = 105, GroupID = 3, LedgerCode = "CASH-HO", LedgerName = "हाता. रोख शिल्लक मेन शाखा", AccountType = "Cash In Hand", IsActive = true, OpeningBalance = 100000m, CurrentBalance = 100000m }
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

            db.SavingAccountMasters.Add(new SavingAccountMaster
            {
                SavingAccountID = 50,
                BranchID = 1,
                CustomerID = 1,
                AccountNo = "SAV-001",
                LedgerID = 104,
                OpeningBalance = 5000m,
                CurrentBalance = 5000m,
                Status = "Active"
            });

            await db.SaveChangesAsync();
            return scheme;
        }

        [Fact]
        public async Task RejectVoucher_AutoRenewal_PrincipalOnly_WithSavingTransfer_AtomicallyReversesAndRestoresMatured()
        {
            await using var db = CreateContext();
            var businessDate = DateTime.Today;
            await SeedEnvironmentAsync(db, businessDate, policy: "RETAIN_ORIGINAL");

            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 901,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = 1,
                FdSchemeID = 1,
                AccountNo = "001-401-0000901-1",
                ReceiptNo = "FD-RCPT-901",
                OpeningDate = businessDate.AddYears(-1),
                MaturityDate = businessDate,
                DepositAmount = 100000m,
                InterestRate = 10.00m,
                DurationType = "Months",
                DurationValue = 12,
                DurationInDays = 365,
                MaturityAmount = 110000m,
                Status = "Matured",
                IsAutoRenewable = true,
                AutoRenewalOption = "PrincipalOnly",
                SavingAccountID = 50,
                MaxAutoRenewalCycles = 3,
                AutoRenewalCount = 0
            });
            await db.SaveChangesAsync();

            var adminUser = BuildPrincipal(1, "admin", "Admin", 1, businessDate);
            var fdCtrl = new FdAccountsController(db);
            AttachUser(fdCtrl, adminUser);

            var batchRes = ParseOkJson(await fdCtrl.RunAutoRenewalBatch(new AutoRenewalBatchRequest
            {
                BranchID = 1,
                ProcessDate = businessDate,
                SpecificAccountIDs = new List<int> { 901 }
            }));

            var item = batchRes.GetProperty("Items")[0];
            int newFdId = item.GetProperty("NewFdAccountID").GetInt32();
            string voucherNo = item.GetProperty("VoucherNo").GetString()!;
            Assert.StartsWith("JV-FD-AUTOREN-", voucherNo);

            // Confirm PrincipalOnly credited interest into linked SavingAccount 50
            var savAfterAutoRen = await db.SavingAccountMasters.FindAsync(50);
            Assert.True(savAfterAutoRen!.CurrentBalance > 5000m);
            Assert.True(await db.SavingTransactions.AnyAsync(st => st.VoucherNo == voucherNo));

            var voucher = await db.Vouchers.FirstAsync(v => v.VoucherNo == voucherNo);
            var postingCtrl = new VoucherPostingController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(postingCtrl, adminUser);

            var rejectRes = await postingCtrl.RejectVoucher(voucher.VoucherID, new VoucherPostingController.VoucherRejectDto
            {
                Reason = "Auto-renewal PrincipalOnly rollback verification"
            });
            Assert.IsType<OkObjectResult>(rejectRes);

            // Strict assertions: child FD removed, logs & txs removed, saving balance & tx reversed, parent restored to Matured
            Assert.Null(await db.FdAccounts.FindAsync(newFdId));
            Assert.False(await db.FdAutoRenewalLogs.AnyAsync());
            Assert.False(await db.FdTransactions.AnyAsync(t => t.FdAccountID == newFdId || t.VoucherID == voucher.VoucherID));
            Assert.False(await db.SavingTransactions.AnyAsync(st => st.VoucherNo == voucherNo));

            var savRestored = await db.SavingAccountMasters.FindAsync(50);
            Assert.Equal(5000m, savRestored!.CurrentBalance);

            var oldRestored = await db.FdAccounts.FindAsync(901);
            Assert.NotNull(oldRestored);
            Assert.Equal("Matured", oldRestored!.Status);
            Assert.Equal(0, oldRestored.AutoRenewalCount);
            Assert.Equal("FD-RCPT-901", oldRestored.ReceiptNo);
        }

        [Fact]
        public async Task RejectVoucher_StrictZeroFallback_IncompleteFkChain_FailsExplicitlyWithoutGuessing()
        {
            await using var db = CreateContext();
            var businessDate = DateTime.Today;
            await SeedEnvironmentAsync(db, businessDate);

            // Intentionally seed text Remarks + Narration matching old/new numbers WITHOUT FdTransactions/FdAutoRenewalLogs/ParentFdAccountID FKs
            db.FdAccounts.AddRange(
                new FdAccount
                {
                    FdAccountID = 910,
                    BranchID = 1,
                    CustomerID = 1,
                    FdSchemeID = 1,
                    AccountNo = "FD-OLD-910",
                    OpeningDate = businessDate.AddYears(-1),
                    MaturityDate = businessDate.AddDays(-1),
                    DepositAmount = 50000m,
                    Status = "Renewed"
                },
                new FdAccount
                {
                    FdAccountID = 911,
                    BranchID = 1,
                    CustomerID = 1,
                    FdSchemeID = 1,
                    AccountNo = "FD-NEW-911",
                    OpeningDate = businessDate,
                    MaturityDate = businessDate.AddYears(1),
                    DepositAmount = 55000m,
                    Status = "Active",
                    ParentFdAccountID = null,
                    Remarks = "Renewed from: FD-OLD-910"
                }
            );

            var brokenVoucher = new Voucher
            {
                VoucherID = 5001,
                BranchID = 1,
                VoucherNo = "JV-FD-REN-FD-NEW-911",
                VoucherDate = businessDate,
                VoucherType = "Journal",
                TotalAmount = 55000m,
                Status = "Pending",
                Narration = "मुदत ठेव नूतनीकरण (FD Renewal): FD-OLD-910 -> FD-NEW-911"
            };
            db.Vouchers.Add(brokenVoucher);
            await db.SaveChangesAsync();

            var adminUser = BuildPrincipal(1, "admin", "Admin", 1, businessDate);
            var postingCtrl = new VoucherPostingController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(postingCtrl, adminUser);

            // Must fail fast (400) instead of using regex/Narration/Remarks fallback!
            var res = await postingCtrl.RejectVoucher(5001, new VoucherPostingController.VoucherRejectDto
            {
                Reason = "Verify zero fallback failure"
            });
            var objRes = Assert.IsAssignableFrom<ObjectResult>(res);
            Assert.Equal(StatusCodes.Status400BadRequest, objRes.StatusCode);

            // Nothing guessed or deleted
            Assert.NotNull(await db.Vouchers.FindAsync(5001));
            Assert.NotNull(await db.FdAccounts.FindAsync(911));
            Assert.Equal("Renewed", (await db.FdAccounts.FindAsync(910))!.Status);
        }

        [Fact]
        public async Task RejectVoucher_DownstreamGuards_BlocksLien_NextCycle_InterestAccrual_And_ApprovedSibling()
        {
            await using var db = CreateContext();
            var businessDate = DateTime.Today;
            await SeedEnvironmentAsync(db, businessDate);

            // Scenario A: Lien marked on renewed newAccount
            db.FdAccounts.AddRange(
                new FdAccount { FdAccountID = 920, BranchID = 1, CustomerID = 1, FdSchemeID = 1, AccountNo = "FD-920", OpeningDate = businessDate.AddYears(-1), MaturityDate = businessDate, DepositAmount = 50000m, Status = "Renewed" },
                new FdAccount { FdAccountID = 921, BranchID = 1, CustomerID = 1, FdSchemeID = 1, AccountNo = "FD-921", OpeningDate = businessDate, MaturityDate = businessDate.AddYears(1), DepositAmount = 55000m, Status = "Active", ParentFdAccountID = 920, IsLienMarked = true }
            );
            db.Vouchers.Add(new Voucher { VoucherID = 5010, BranchID = 1, VoucherNo = "JV-FD-AUTOREN-FD-921", VoucherDate = businessDate, VoucherType = "Journal", TotalAmount = 55000m, Status = "Pending" });
            db.FdTransactions.AddRange(
                new FdTransaction { FdTransactionID = 701, BranchID = 1, FdAccountID = 920, VoucherID = 5010, TransactionDate = businessDate, TransactionType = "Renewal", DebitCredit = "Dr", Amount = 55000m },
                new FdTransaction { FdTransactionID = 702, BranchID = 1, FdAccountID = 921, VoucherID = 5010, TransactionDate = businessDate, TransactionType = "Opening", DebitCredit = "Cr", Amount = 55000m }
            );

            // Scenario B: Next cycle (Cycle 2) already created from renewed account
            db.FdAccounts.AddRange(
                new FdAccount { FdAccountID = 930, BranchID = 1, CustomerID = 1, FdSchemeID = 1, AccountNo = "FD-930", OpeningDate = businessDate.AddYears(-2), MaturityDate = businessDate.AddYears(-1), DepositAmount = 40000m, Status = "Renewed" },
                new FdAccount { FdAccountID = 931, BranchID = 1, CustomerID = 1, FdSchemeID = 1, AccountNo = "FD-931", OpeningDate = businessDate.AddYears(-1), MaturityDate = businessDate, DepositAmount = 44000m, Status = "Renewed", ParentFdAccountID = 930 },
                new FdAccount { FdAccountID = 932, BranchID = 1, CustomerID = 1, FdSchemeID = 1, AccountNo = "FD-932", OpeningDate = businessDate, MaturityDate = businessDate.AddYears(1), DepositAmount = 48000m, Status = "Active", ParentFdAccountID = 931 }
            );
            db.Vouchers.Add(new Voucher { VoucherID = 5011, BranchID = 1, VoucherNo = "JV-FD-AUTOREN-FD-931", VoucherDate = businessDate, VoucherType = "Journal", TotalAmount = 44000m, Status = "Pending" });
            db.FdTransactions.AddRange(
                new FdTransaction { FdTransactionID = 703, BranchID = 1, FdAccountID = 930, VoucherID = 5011, TransactionDate = businessDate, TransactionType = "Renewal", DebitCredit = "Dr", Amount = 44000m },
                new FdTransaction { FdTransactionID = 704, BranchID = 1, FdAccountID = 931, VoucherID = 5011, TransactionDate = businessDate, TransactionType = "Opening", DebitCredit = "Cr", Amount = 44000m }
            );

            // Scenario C: Subsequent Interest Accrual exists on renewed account
            db.FdAccounts.AddRange(
                new FdAccount { FdAccountID = 940, BranchID = 1, CustomerID = 1, FdSchemeID = 1, AccountNo = "FD-940", OpeningDate = businessDate.AddYears(-1), MaturityDate = businessDate, DepositAmount = 30000m, Status = "Renewed" },
                new FdAccount { FdAccountID = 941, BranchID = 1, CustomerID = 1, FdSchemeID = 1, AccountNo = "FD-941", OpeningDate = businessDate, MaturityDate = businessDate.AddYears(1), DepositAmount = 33000m, Status = "Active", ParentFdAccountID = 940 }
            );
            db.Vouchers.AddRange(
                new Voucher { VoucherID = 5012, BranchID = 1, VoucherNo = "JV-FD-REN-FD-941", VoucherDate = businessDate, VoucherType = "Journal", TotalAmount = 33000m, Status = "Pending" },
                new Voucher { VoucherID = 5013, BranchID = 1, VoucherNo = "JV-FD-ACC-941", VoucherDate = businessDate, VoucherType = "Journal", TotalAmount = 500m, Status = "Pending" }
            );
            db.FdTransactions.AddRange(
                new FdTransaction { FdTransactionID = 705, BranchID = 1, FdAccountID = 940, VoucherID = 5012, TransactionDate = businessDate, TransactionType = "Renewal", DebitCredit = "Dr", Amount = 33000m },
                new FdTransaction { FdTransactionID = 706, BranchID = 1, FdAccountID = 941, VoucherID = 5012, TransactionDate = businessDate, TransactionType = "Opening", DebitCredit = "Cr", Amount = 33000m }
            );
            db.FdInterestAccruals.Add(new FdInterestAccrual { AccrualID = 801, BranchID = 1, FdAccountID = 941, VoucherID = 5013, AccrualDate = businessDate, InterestAmount = 500m });

            // Scenario D: Paired sibling PAY-FD-INT-* voucher is Approved
            db.FdAccounts.AddRange(
                new FdAccount { FdAccountID = 950, BranchID = 1, CustomerID = 1, FdSchemeID = 1, AccountNo = "FD-950", OpeningDate = businessDate.AddYears(-1), MaturityDate = businessDate, DepositAmount = 20000m, Status = "Renewed" },
                new FdAccount { FdAccountID = 951, BranchID = 1, CustomerID = 1, FdSchemeID = 1, AccountNo = "FD-951", OpeningDate = businessDate, MaturityDate = businessDate.AddYears(1), DepositAmount = 20000m, Status = "Active", ParentFdAccountID = 950 }
            );
            db.Vouchers.AddRange(
                new Voucher { VoucherID = 5014, BranchID = 1, VoucherNo = "JV-FD-REN-FD-951", VoucherDate = businessDate, VoucherType = "Journal", TotalAmount = 20000m, Status = "Pending", RelatedVoucherID = 5015 },
                new Voucher { VoucherID = 5015, BranchID = 1, VoucherNo = "PAY-FD-INT-FD-951", VoucherDate = businessDate, VoucherType = "Payment", TotalAmount = 2000m, Status = "Approved", RelatedVoucherID = 5014 }
            );
            db.FdTransactions.AddRange(
                new FdTransaction { FdTransactionID = 707, BranchID = 1, FdAccountID = 950, VoucherID = 5014, TransactionDate = businessDate, TransactionType = "Renewal", DebitCredit = "Dr", Amount = 20000m },
                new FdTransaction { FdTransactionID = 708, BranchID = 1, FdAccountID = 951, VoucherID = 5014, TransactionDate = businessDate, TransactionType = "Opening", DebitCredit = "Cr", Amount = 20000m },
                new FdTransaction { FdTransactionID = 709, BranchID = 1, FdAccountID = 950, VoucherID = 5015, TransactionDate = businessDate, TransactionType = "Interest Payout", DebitCredit = "Dr", Amount = 2000m }
            );

            await db.SaveChangesAsync();

            var adminUser = BuildPrincipal(1, "admin", "Admin", 1, businessDate);
            var postingCtrl = new VoucherPostingController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(postingCtrl, adminUser);

            foreach (int vId in new[] { 5010, 5011, 5012, 5014 })
            {
                var res = await postingCtrl.RejectVoucher(vId, new VoucherPostingController.VoucherRejectDto
                {
                    Reason = "Downstream protection check"
                });
                var objRes = Assert.IsAssignableFrom<ObjectResult>(res);
                Assert.Equal(StatusCodes.Status400BadRequest, objRes.StatusCode);
            }

            // Ensure protected accounts were NOT deleted
            Assert.NotNull(await db.FdAccounts.FindAsync(921));
            Assert.NotNull(await db.FdAccounts.FindAsync(931));
            Assert.NotNull(await db.FdAccounts.FindAsync(941));
            Assert.NotNull(await db.FdAccounts.FindAsync(951));
            Assert.NotNull(await db.Vouchers.FindAsync(5015));
        }

        [Fact]
        public async Task DeleteFdAccount_OnAutoRenewedChild_CleansAutoRenVoucherAndLogsAndRestoresOldMatured()
        {
            await using var db = CreateContext();
            var businessDate = DateTime.Today;
            await SeedEnvironmentAsync(db, businessDate, policy: "RETAIN_ORIGINAL");

            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 960,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = 1,
                FdSchemeID = 1,
                AccountNo = "001-401-0000960-1",
                ReceiptNo = "FD-RCPT-960",
                OpeningDate = businessDate.AddYears(-1),
                MaturityDate = businessDate,
                DepositAmount = 75000m,
                InterestRate = 10.00m,
                DurationType = "Months",
                DurationValue = 12,
                DurationInDays = 365,
                MaturityAmount = 82500m,
                Status = "Matured",
                IsAutoRenewable = true,
                AutoRenewalOption = "PrincipalPlusInterest",
                MaxAutoRenewalCycles = 3,
                AutoRenewalCount = 0
            });
            await db.SaveChangesAsync();

            var adminUser = BuildPrincipal(1, "admin", "Admin", 1, businessDate);
            var fdCtrl = new FdAccountsController(db);
            AttachUser(fdCtrl, adminUser);

            var batchRes = ParseOkJson(await fdCtrl.RunAutoRenewalBatch(new AutoRenewalBatchRequest
            {
                BranchID = 1,
                ProcessDate = businessDate,
                SpecificAccountIDs = new List<int> { 960 }
            }));

            int newFdId = batchRes.GetProperty("Items")[0].GetProperty("NewFdAccountID").GetInt32();
            string voucherNo = batchRes.GetProperty("Items")[0].GetProperty("VoucherNo").GetString()!;

            var deleteRes = await fdCtrl.DeleteFdAccount(newFdId);
            Assert.IsType<OkObjectResult>(deleteRes);

            Assert.Null(await db.FdAccounts.FindAsync(newFdId));
            Assert.False(await db.Vouchers.AnyAsync(v => v.VoucherNo == voucherNo));
            Assert.False(await db.FdAutoRenewalLogs.AnyAsync());

            var restoredOld = await db.FdAccounts.FindAsync(960);
            Assert.NotNull(restoredOld);
            Assert.Equal("Matured", restoredOld!.Status);
            Assert.Equal(0, restoredOld.AutoRenewalCount);
        }

        [Fact]
        public async Task HealOrphanedRenewalsAsync_StrictFkPass1_Pass2_Pass3A_Pass3B_WorksWithoutTextFallback()
        {
            await using var db = CreateContext();
            var businessDate = DateTime.Today;
            await SeedEnvironmentAsync(db, businessDate);

            // Pass 1: Orphaned Pending JV-FD-AUTOREN-* voucher whose child FD doesn't exist
            db.FdAccounts.Add(new FdAccount { FdAccountID = 970, BranchID = 1, CustomerID = 1, FdSchemeID = 1, AccountNo = "FD-970", OpeningDate = businessDate.AddYears(-1), MaturityDate = businessDate, DepositAmount = 10000m, Status = "Renewed", AutoRenewalCount = 1 });
            db.Vouchers.Add(new Voucher { VoucherID = 6001, BranchID = 1, VoucherNo = "JV-FD-AUTOREN-MISSING970", VoucherDate = businessDate, VoucherType = "Journal", TotalAmount = 11000m, Status = "Pending" });
            db.FdTransactions.Add(new FdTransaction { FdTransactionID = 801, BranchID = 1, FdAccountID = 970, VoucherID = 6001, TransactionDate = businessDate, TransactionType = "Renewal", DebitCredit = "Dr", Amount = 11000m });
            db.FdAutoRenewalLogs.Add(new FdAutoRenewalLog { LogID = 901, BranchID = 1, BatchDate = businessDate, OldFdAccountID = 970, NewFdAccountID = 99999, VoucherID = 6001, OldAccountNo = "FD-970", NewAccountNo = "MISSING", CustomerID = 1, CustomerName = "विजय जाधव" });

            // Pass 2: Orphaned child FD with ParentFdAccountID FK whose renewal voucher is missing
            db.FdAccounts.AddRange(
                new FdAccount { FdAccountID = 971, BranchID = 1, CustomerID = 1, FdSchemeID = 1, AccountNo = "FD-971", OpeningDate = businessDate.AddYears(-1), MaturityDate = businessDate, DepositAmount = 20000m, Status = "Renewed" },
                new FdAccount { FdAccountID = 972, BranchID = 1, CustomerID = 1, FdSchemeID = 1, AccountNo = "FD-972", OpeningDate = businessDate, MaturityDate = businessDate.AddYears(1), DepositAmount = 22000m, Status = "Active", ParentFdAccountID = 971 }
            );

            // Pass 3A: Orphaned Renewal FdTransaction with no child FD
            db.FdAccounts.Add(new FdAccount { FdAccountID = 973, BranchID = 1, CustomerID = 1, FdSchemeID = 1, AccountNo = "FD-973", OpeningDate = businessDate.AddYears(-1), MaturityDate = businessDate, DepositAmount = 30000m, Status = "Renewed" });
            db.FdTransactions.Add(new FdTransaction { FdTransactionID = 802, BranchID = 1, FdAccountID = 973, VoucherID = 6099, TransactionDate = businessDate, TransactionType = "Renewal", DebitCredit = "Dr", Amount = 33000m });

            // Pass 3B: Stuck Renewed parent account with zero Renewal tx and zero child FK
            db.FdAccounts.Add(new FdAccount { FdAccountID = 974, BranchID = 1, CustomerID = 1, FdSchemeID = 1, AccountNo = "FD-974", OpeningDate = businessDate.AddYears(-1), MaturityDate = businessDate, DepositAmount = 40000m, Status = "Renewed" });

            await db.SaveChangesAsync();

            await FdRenewalRollbackHelper.HealOrphanedRenewalsAsync(db, force: true);

            Assert.Null(await db.Vouchers.FindAsync(6001));
            Assert.Null(await db.FdAccounts.FindAsync(972));
            Assert.Null(await db.FdTransactions.FindAsync(802));
            Assert.False(await db.FdAutoRenewalLogs.AnyAsync());

            Assert.Equal("Matured", (await db.FdAccounts.FindAsync(970))!.Status);
            Assert.Equal(0, (await db.FdAccounts.FindAsync(970))!.AutoRenewalCount);
            Assert.Equal("Matured", (await db.FdAccounts.FindAsync(971))!.Status);
            Assert.Equal("Matured", (await db.FdAccounts.FindAsync(973))!.Status);
            Assert.Equal("Matured", (await db.FdAccounts.FindAsync(974))!.Status);
        }

        [Fact]
        public async Task BuildCollisionSafeVoucherNoAsync_StrictZeroFallback_ThrowsOnDuplicate()
        {
            await using var db = CreateContext();
            var businessDate = DateTime.Today;
            await SeedEnvironmentAsync(db, businessDate);

            db.Vouchers.Add(new Voucher
            {
                VoucherID = 7001,
                BranchID = 1,
                VoucherNo = "JV-FD-AUTOREN-FD001",
                VoucherDate = businessDate,
                VoucherType = "Journal",
                TotalAmount = 1000m,
                Status = "Pending"
            });
            await db.SaveChangesAsync();

            await Assert.ThrowsAsync<InvalidOperationException>(() =>
                FdRenewalRollbackHelper.BuildCollisionSafeVoucherNoAsync(db, "JV-FD-AUTOREN-FD001"));

            string okNo = await FdRenewalRollbackHelper.BuildCollisionSafeVoucherNoAsync(db, "JV-FD-AUTOREN-FD002");
            Assert.Equal("JV-FD-AUTOREN-FD002", okNo);
        }

        [Fact]
        public async Task RejectVoucher_AfterPassAndUnpassRenewal_IgnoresParentOpeningMigrationVoucher_AndRollsBackCleanly()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 4, 1);
            await SeedEnvironmentAsync(db, businessDate);

            // Seed old migrated FD account with Approved JV-FD-OP-* voucher
            var oldFd = new FdAccount
            {
                FdAccountID = 980,
                BranchID = 1,
                CustomerID = 1,
                FdSchemeID = 1,
                AccountNo = "001-401-0000206-6",
                OpeningDate = new DateTime(2025, 4, 1),
                MaturityDate = new DateTime(2026, 3, 31),
                DepositAmount = 50000m,
                Status = "Renewed",
                IsLegacyAccount = true
            };
            var newFd = new FdAccount
            {
                FdAccountID = 981,
                BranchID = 1,
                CustomerID = 1,
                FdSchemeID = 1,
                AccountNo = "001-401-0000892-3",
                OpeningDate = businessDate,
                MaturityDate = businessDate.AddYears(1),
                DepositAmount = 50000m,
                Status = "Active",
                ParentFdAccountID = 980,
                RootFdAccountID = 980,
                RenewalCycleNo = 1
            };
            db.FdAccounts.AddRange(oldFd, newFd);

            var opVoucher = new Voucher
            {
                VoucherID = 8001,
                BranchID = 1,
                VoucherNo = "JV-FD-OP-001-401-0000206-6",
                VoucherDate = new DateTime(2026, 3, 31),
                VoucherType = "Journal",
                TotalAmount = 50000m,
                Status = "Approved",
                ApprovedBy = 1,
                ApprovedOn = new DateTime(2026, 3, 31)
            };
            var renVoucher = new Voucher
            {
                VoucherID = 8002,
                BranchID = 1,
                VoucherNo = "JV-FD-REN-001-401-0000892-3",
                VoucherDate = businessDate,
                VoucherType = "Journal",
                TotalAmount = 50000m,
                Status = "Pending",
                CreatedBy = 2
            };
            renVoucher.VoucherDetails.Add(new VoucherDetail { VoucherDetailID = 9001, VoucherID = 8002, LedgerID = 101, DrCr = "Dr", Amount = 50000m, CustomerID = 1 });
            renVoucher.VoucherDetails.Add(new VoucherDetail { VoucherDetailID = 9002, VoucherID = 8002, LedgerID = 101, DrCr = "Cr", Amount = 50000m, CustomerID = 1 });
            db.Vouchers.AddRange(opVoucher, renVoucher);

            db.FdTransactions.AddRange(
                // Normal Opening row for old FD tied to JV-FD-OP-*
                new FdTransaction { FdTransactionID = 810, BranchID = 1, FdAccountID = 980, VoucherID = 8001, TransactionDate = new DateTime(2025, 4, 1), TransactionType = "Opening", DebitCredit = "Cr", Amount = 50000m },
                // Cross-linked rows matching the exact discovery paths that previously leaked JV-FD-OP-* into candidateSiblingIds
                new FdTransaction { FdTransactionID = 811, BranchID = 1, FdAccountID = 980, VoucherID = 8001, TransactionDate = businessDate, TransactionType = "Interest Payout", DebitCredit = "Dr", Amount = 0m },
                new FdTransaction { FdTransactionID = 812, BranchID = 1, FdAccountID = 981, VoucherID = 8001, TransactionDate = businessDate, TransactionType = "Opening", DebitCredit = "Cr", Amount = 50000m },
                // Renewal cycle rows on JV-FD-REN-*
                new FdTransaction { FdTransactionID = 813, BranchID = 1, FdAccountID = 980, VoucherID = 8002, TransactionDate = businessDate, TransactionType = "Renewal", DebitCredit = "Dr", Amount = 50000m },
                new FdTransaction { FdTransactionID = 814, BranchID = 1, FdAccountID = 981, VoucherID = 8002, TransactionDate = businessDate, TransactionType = "Opening", DebitCredit = "Cr", Amount = 50000m }
            );
            await db.SaveChangesAsync();

            var adminUser = BuildPrincipal(1, "admin", "Admin", 1, businessDate);
            var postingCtrl = new VoucherPostingController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(postingCtrl, adminUser);

            // 1. Pass then Unpass the renewal voucher
            var passRes = await postingCtrl.PostVouchers(new VoucherPostingController.PostVouchersRequest
            {
                VoucherIds = new List<int> { 8002 },
                BusinessDate = businessDate
            });
            Assert.IsType<OkObjectResult>(passRes);

            var unpassRes = await postingCtrl.UnpassVouchers(new VoucherPostingController.UnpassVouchersRequest
            {
                VoucherIds = new List<int> { 8002 },
                Reason = "Test unpass before delete"
            });
            Assert.IsType<OkObjectResult>(unpassRes);

            // 2. Delete the unpassed renewal voucher -> must NOT complain about Approved JV-FD-OP-001-401-0000206-6
            var rejectRes = await postingCtrl.RejectVoucher(8002, new VoucherPostingController.VoucherRejectDto
            {
                Reason = "Rollback erroneous renewal after unpass"
            });
            Assert.IsType<OkObjectResult>(rejectRes);

            Assert.Null(await db.Vouchers.FindAsync(8002));
            Assert.Null(await db.FdAccounts.FindAsync(981));

            var preservedOpVoucher = await db.Vouchers.FindAsync(8001);
            Assert.NotNull(preservedOpVoucher);
            Assert.Equal("Approved", preservedOpVoucher!.Status);

            var restoredOldFd = await db.FdAccounts.FindAsync(980);
            Assert.NotNull(restoredOldFd);
            Assert.Equal("Matured", restoredOldFd!.Status);
            Assert.NotNull(await db.FdTransactions.FindAsync(810));
            Assert.Null(await db.FdTransactions.FindAsync(813));
        }

        [Fact]
        public async Task RejectVoucher_PrincipalOnlyRenewal_StillStrictlyBlocksApprovedCycleInterestSibling()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 4, 1);
            await SeedEnvironmentAsync(db, businessDate);

            db.FdAccounts.AddRange(
                new FdAccount { FdAccountID = 985, BranchID = 1, CustomerID = 1, FdSchemeID = 1, AccountNo = "001-401-0000207-4", OpeningDate = new DateTime(2025, 4, 1), MaturityDate = new DateTime(2026, 3, 31), DepositAmount = 50000m, Status = "Renewed" },
                new FdAccount { FdAccountID = 986, BranchID = 1, CustomerID = 1, FdSchemeID = 1, AccountNo = "001-401-0000893-5", OpeningDate = businessDate, MaturityDate = businessDate.AddYears(1), DepositAmount = 50000m, Status = "Active", ParentFdAccountID = 985, RootFdAccountID = 985, RenewalCycleNo = 1 }
            );

            // Even without RelatedVoucherID, PAY-FD-INT-{newAcc} linked via Interest Payout on oldFd must block delete while Approved
            db.Vouchers.AddRange(
                new Voucher { VoucherID = 8010, BranchID = 1, VoucherNo = "JV-FD-REN-001-401-0000893-5", VoucherDate = businessDate, VoucherType = "Journal", TotalAmount = 50000m, Status = "Pending" },
                new Voucher { VoucherID = 8011, BranchID = 1, VoucherNo = "PAY-FD-INT-001-401-0000893-5", VoucherDate = businessDate, VoucherType = "Payment", TotalAmount = 4500m, Status = "Approved", ApprovedBy = 1, ApprovedOn = businessDate }
            );
            db.FdTransactions.AddRange(
                new FdTransaction { FdTransactionID = 820, BranchID = 1, FdAccountID = 985, VoucherID = 8010, TransactionDate = businessDate, TransactionType = "Renewal", DebitCredit = "Dr", Amount = 50000m },
                new FdTransaction { FdTransactionID = 821, BranchID = 1, FdAccountID = 986, VoucherID = 8010, TransactionDate = businessDate, TransactionType = "Opening", DebitCredit = "Cr", Amount = 50000m },
                new FdTransaction { FdTransactionID = 822, BranchID = 1, FdAccountID = 985, VoucherID = 8011, TransactionDate = businessDate, TransactionType = "Interest Payout", DebitCredit = "Dr", Amount = 4500m }
            );
            await db.SaveChangesAsync();

            var adminUser = BuildPrincipal(1, "admin", "Admin", 1, businessDate);
            var postingCtrl = new VoucherPostingController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(postingCtrl, adminUser);

            var rejectRes = await postingCtrl.RejectVoucher(8010, new VoucherPostingController.VoucherRejectDto
            {
                Reason = "Should block because PAY-FD-INT is still approved"
            });
            var objRes = Assert.IsAssignableFrom<ObjectResult>(rejectRes);
            Assert.Equal(StatusCodes.Status400BadRequest, objRes.StatusCode);
            Assert.Contains("PAY-FD-INT-001-401-0000893-5", objRes.Value?.ToString() ?? "");

            Assert.NotNull(await db.Vouchers.FindAsync(8010));
            Assert.NotNull(await db.Vouchers.FindAsync(8011));
            Assert.NotNull(await db.FdAccounts.FindAsync(986));
        }

        [Fact]
        public async Task Renew_MultipleSequentialPrincipalOnlyCashEntries_PreservesAllCashInterestVouchersAcrossHealAndShowsInPassingAndDraftDaybook()
        {
            await using var db = CreateContext();
            var businessDate = DateTime.Today;
            await SeedEnvironmentAsync(db, businessDate, policy: "NEW_RECEIPT");

            db.FdAccounts.AddRange(
                new FdAccount
                {
                    FdAccountID = 991,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = 1,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000208-2",
                    ReceiptNo = "208",
                    OpeningDate = businessDate.AddYears(-1),
                    MaturityDate = businessDate,
                    DepositAmount = 25000m,
                    InterestRate = 9.00m,
                    DurationType = "Months",
                    DurationValue = 12,
                    DurationInDays = 365,
                    MaturityAmount = 27250m,
                    Status = "Matured"
                },
                new FdAccount
                {
                    FdAccountID = 992,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = 1,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000237-1",
                    ReceiptNo = "237",
                    OpeningDate = businessDate.AddYears(-1),
                    MaturityDate = businessDate,
                    DepositAmount = 50000m,
                    InterestRate = 9.00m,
                    DurationType = "Months",
                    DurationValue = 12,
                    DurationInDays = 365,
                    MaturityAmount = 52435m,
                    Status = "Matured"
                },
                new FdAccount
                {
                    FdAccountID = 993,
                    BranchID = 1,
                    FinancialYearID = 1,
                    CustomerID = 1,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000245-2",
                    ReceiptNo = "245",
                    OpeningDate = businessDate.AddYears(-1),
                    MaturityDate = businessDate,
                    DepositAmount = 30000m,
                    InterestRate = 9.00m,
                    DurationType = "Months",
                    DurationValue = 12,
                    DurationInDays = 365,
                    MaturityAmount = 31500m,
                    Status = "Matured"
                }
            );
            await db.SaveChangesAsync();

            var adminUser = BuildPrincipal(1, "admin", "Admin", 1, businessDate);
            var fdCtrl = new FdAccountsController(db);
            AttachUser(fdCtrl, adminUser);

            var renVoucherNos = new List<string>();
            var intVoucherNos = new List<string>();

            foreach (int accId in new[] { 991, 992, 993 })
            {
                // Simulate >60s elapsed before each subsequent renewal entry & full account refresh
                FdRenewalRollbackHelper.InvalidateHealCooldown();

                var renewRes = ParseOkJson(await fdCtrl.Renew(accId, new FdRenewalRequest
                {
                    TargetSchemeID = 1,
                    RenewalType = "PrincipalOnly",
                    PaymentMode = "Cash",
                    ClosureDate = businessDate,
                    DurationType = "Months",
                    DurationValue = 12,
                    ReceiptNoMode = "NEW_RECEIPT"
                }));

                string v1 = renewRes.GetProperty("VoucherNo").GetString()!;
                string? v2 = renewRes.GetProperty("InterestVoucherNo").GetString();
                Assert.StartsWith("JV-FD-REN-", v1);
                Assert.False(string.IsNullOrWhiteSpace(v2));
                Assert.StartsWith("PAY-FD-INT-", v2);
                renVoucherNos.Add(v1);
                intVoucherNos.Add(v2!);
            }

            // Force a full un-scoped HealOrphanedRenewalsAsync sweep (simulates GetFdAccounts after >60s)
            await FdRenewalRollbackHelper.HealOrphanedRenewalsAsync(db, targetFdAccountId: null, force: true);

            // All 3 old FD accounts must remain Renewed, and all 3 PAY-FD-INT vouchers + Interest Payout txs must survive
            foreach (int oldId in new[] { 991, 992, 993 })
            {
                var oldAcc = await db.FdAccounts.FindAsync(oldId);
                Assert.NotNull(oldAcc);
                Assert.Equal("Renewed", oldAcc!.Status);
                Assert.True(await db.FdTransactions.AnyAsync(t => t.FdAccountID == oldId && t.TransactionType == "Interest Payout"));
            }

            foreach (string ivNo in intVoucherNos)
            {
                var iv = await db.Vouchers.FirstOrDefaultAsync(v => v.VoucherNo == ivNo);
                Assert.NotNull(iv);
                Assert.Equal("Pending", iv!.Status);
                Assert.NotNull(iv.RelatedVoucherID);
            }

            // Voucher Posting (Unposted) must list all 3 JV-FD-REN-* and all 3 PAY-FD-INT-* vouchers
            var postingCtrl = new VoucherPostingController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(postingCtrl, adminUser);
            var unpostedRes = Assert.IsType<ActionResult<IEnumerable<Voucher>>>(
                await postingCtrl.GetUnpostedVouchers(branchId: 1, voucherDate: businessDate, allDates: false));
            var unpostedList = Assert.IsAssignableFrom<IEnumerable<Voucher>>(unpostedRes.Value).ToList();

            foreach (string rvNo in renVoucherNos)
                Assert.Contains(unpostedList, v => v.VoucherNo == rvNo);
            foreach (string ivNo in intVoucherNos)
                Assert.Contains(unpostedList, v => v.VoucherNo == ivNo);

            // Draft Daybook (voucherStatus = "pending") must include all 3 PAY-FD-INT-* payments
            using var memoryCache = new MemoryCache(new MemoryCacheOptions());
            var reportsCtrl = new ReportsController(db, memoryCache);
            AttachUser(reportsCtrl, adminUser);
            var daybookRes = await reportsCtrl.GetDaybook(
                date: businessDate,
                toDate: null,
                branchId: 1,
                voucherStatus: "pending");
            var daybookDto = daybookRes.Value ?? Assert.IsType<DaybookResponseDto>(Assert.IsType<OkObjectResult>(daybookRes.Result).Value);

            var expRow = daybookDto.Payments.FirstOrDefault(r => r.LedgerId == 103);
            Assert.NotNull(expRow);
            var expVouchers = expRow!.Entries.Select(v => v.VoucherNo).ToList();
            foreach (string ivNo in intVoucherNos)
                Assert.Contains(ivNo, expVouchers);
        }

        [Fact]
        public async Task HealOrphanedRenewals_PreservesPrincipalOnlySavingTransfer_AndCleansTrueOrphanWithoutCorruptingUnrelatedParent()
        {
            await using var db = CreateContext();
            var businessDate = DateTime.Today;
            await SeedEnvironmentAsync(db, businessDate, policy: "NEW_RECEIPT");

            // 1. Live PrincipalOnly + Saving Transfer renewal (has JV-FD-REN-* + JV-FD-INT-*, no RelatedVoucherID set to simulate legacy)
            db.FdAccounts.AddRange(
                new FdAccount { FdAccountID = 995, BranchID = 1, FinancialYearID = 1, CustomerID = 1, FdSchemeID = 1, AccountNo = "001-401-0000301-1", OpeningDate = businessDate.AddYears(-1), MaturityDate = businessDate, DepositAmount = 40000m, MaturityAmount = 44000m, Status = "Renewed" },
                new FdAccount { FdAccountID = 996, BranchID = 1, FinancialYearID = 1, CustomerID = 1, FdSchemeID = 1, AccountNo = "001-401-0000916-1", OpeningDate = businessDate, MaturityDate = businessDate.AddYears(1), DepositAmount = 40000m, Status = "Active", ParentFdAccountID = 995, RootFdAccountID = 995, RenewalCycleNo = 1 },
                // 2. Old FD that only had a broken orphan PAY-FD-INT-* (child FD & JV-FD-REN-* do not exist)
                new FdAccount { FdAccountID = 997, BranchID = 1, FinancialYearID = 1, CustomerID = 1, FdSchemeID = 1, AccountNo = "001-401-0000302-9", OpeningDate = businessDate.AddYears(-1), MaturityDate = businessDate, DepositAmount = 20000m, MaturityAmount = 22000m, Status = "Renewed" }
            );

            db.Vouchers.AddRange(
                new Voucher { VoucherID = 9101, BranchID = 1, VoucherNo = "JV-FD-REN-001-401-0000916-1", VoucherDate = businessDate, VoucherType = "Journal", TotalAmount = 40000m, Status = "Pending" },
                new Voucher { VoucherID = 9102, BranchID = 1, VoucherNo = "JV-FD-INT-001-401-0000916-1", VoucherDate = businessDate, VoucherType = "Journal", TotalAmount = 4000m, Status = "Pending" },
                new Voucher { VoucherID = 9103, BranchID = 1, VoucherNo = "PAY-FD-INT-001-401-0000999-9", VoucherDate = businessDate, VoucherType = "Payment", TotalAmount = 2000m, Status = "Pending" }
            );
            db.FdTransactions.AddRange(
                new FdTransaction { FdTransactionID = 911, BranchID = 1, FdAccountID = 995, VoucherID = 9101, TransactionDate = businessDate, TransactionType = "Renewal", DebitCredit = "Dr", Amount = 40000m },
                new FdTransaction { FdTransactionID = 912, BranchID = 1, FdAccountID = 996, VoucherID = 9101, TransactionDate = businessDate, TransactionType = "Opening", DebitCredit = "Cr", Amount = 40000m },
                new FdTransaction { FdTransactionID = 913, BranchID = 1, FdAccountID = 995, VoucherID = 9102, TransactionDate = businessDate, TransactionType = "Interest Payout", DebitCredit = "Dr", Amount = 4000m },
                new FdTransaction { FdTransactionID = 914, BranchID = 1, FdAccountID = 997, VoucherID = 9103, TransactionDate = businessDate, TransactionType = "Interest Payout", DebitCredit = "Dr", Amount = 2000m }
            );
            db.SavingTransactions.Add(new SavingTransaction
            {
                TransactionID = 920,
                SavingAccountID = 50,
                CustomerID = 1,
                BranchID = 1,
                TransactionDate = businessDate,
                TransactionType = "Deposit",
                PaymentMode = "Transfer",
                Amount = 4000m,
                BalanceAfterTxn = 9000m,
                VoucherNo = "JV-FD-INT-001-401-0000916-1"
            });
            var sav = await db.SavingAccountMasters.FindAsync(50);
            sav!.CurrentBalance = 9000m;
            await db.SaveChangesAsync();

            await FdRenewalRollbackHelper.HealOrphanedRenewalsAsync(db, targetFdAccountId: null, force: true);

            // Live Saving-Transfer renewal must remain completely intact
            Assert.NotNull(await db.Vouchers.FindAsync(9101));
            Assert.NotNull(await db.Vouchers.FindAsync(9102));
            Assert.NotNull(await db.FdTransactions.FindAsync(913));
            Assert.NotNull(await db.SavingTransactions.FindAsync(920));
            Assert.Equal("Renewed", (await db.FdAccounts.FindAsync(995))!.Status);
            Assert.Equal(9000m, (await db.SavingAccountMasters.FindAsync(50))!.CurrentBalance);

            // True orphan PAY-FD-INT-001-401-0000999-9 (no child FD & no JV-FD-REN) must be cleaned & 997 restored to Matured
            Assert.Null(await db.Vouchers.FindAsync(9103));
            Assert.Null(await db.FdTransactions.FindAsync(914));
            Assert.Equal("Matured", (await db.FdAccounts.FindAsync(997))!.Status);
        }
    }
}
