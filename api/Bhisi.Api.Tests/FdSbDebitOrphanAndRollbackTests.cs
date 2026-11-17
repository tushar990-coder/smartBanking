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
using Microsoft.Extensions.Caching.Memory;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class FdSbDebitOrphanAndRollbackTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"BhisiFdSbOrphan_{Guid.NewGuid()}")
                .ConfigureWarnings(x => x.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ClaimsPrincipal BuildAdminPrincipal(int branchId, DateTime businessDate)
        {
            return new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "1"),
                new Claim(ClaimTypes.Name, "admin"),
                new Claim(ClaimTypes.Role, "Admin"),
                new Claim("BranchID", branchId.ToString()),
                new Claim("DefaultBranchID", branchId.ToString()),
                new Claim("BusinessDate", businessDate.ToString("yyyy-MM-dd"))
            }, "TestJwt"));
        }

        private static void AttachUser(ControllerBase controller, ClaimsPrincipal principal)
        {
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = principal }
            };
        }

        private static async Task SeedBaseAsync(AppDbContext db, DateTime businessDate)
        {
            db.Branches.Add(new Branch { BranchID = 1, BranchCode = "HO", BranchName = "मुख्य शाखा", IsActive = true });
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
            db.AccountGroups.Add(new AccountGroup { GroupID = 1, GroupName = "ठेवी", NatureOfGroup = "Liabilities", IsActive = true });
            db.Ledgers.AddRange(
                new Ledger { LedgerID = 101, GroupID = 1, LedgerCode = "FD-401", LedgerName = "मुदत ठेव", AccountType = "Fixed Deposit", IsActive = true },
                new Ledger { LedgerID = 102, GroupID = 1, LedgerCode = "SB-101", LedgerName = "सेव्हिंग ठेव", AccountType = "Savings", IsActive = true }
            );
            db.FdSchemes.Add(new FdScheme
            {
                FdSchemeID = 1,
                SchemeCode = "FD401",
                SchemeName = "साधारण मुदत ठेव",
                DurationMonths = 12,
                DurationType = "Months",
                InterestRate = 9m,
                SeniorCitizenInterestRate = 9.5m,
                InterestType = "Simple",
                FdLiabilityLedgerID = 101,
                IsActive = true
            });
            db.Customers.Add(new Customer
            {
                CustomerID = 1,
                CIFNo = "CIF000001",
                FirstName = "सागर",
                MiddleName = "रघुनाथ",
                LastName = "फार्णे",
                BranchID = 1,
                Status = "Active"
            });
            db.SavingAccountMasters.Add(new SavingAccountMaster
            {
                SavingAccountID = 4164,
                BranchID = 1,
                CustomerID = 1,
                LedgerID = 102,
                AccountNo = "00110100004164",
                LegacyAccountNumber = "441",
                OpeningDate = new DateTime(2026, 3, 31),
                OpeningBalance = 150548m,
                CurrentBalance = 548m,
                Status = "Active"
            });
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task VoucherRollback_CleansNullVoucherNoFdSbDebit_AndRecalculatesRunningBalance()
        {
            await using var db = CreateContext();
            var dt = new DateTime(2026, 4, 1);
            await SeedBaseAsync(db, dt);

            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 8436,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = 1,
                FdSchemeID = 1,
                AccountNo = "001-401-0000843-6",
                ReceiptNo = "001-401-0000843-6",
                OpeningDate = dt,
                MaturityDate = dt.AddMonths(12),
                DurationType = "Months",
                DurationValue = 12,
                DurationInDays = 365,
                DepositAmount = 150000m,
                MaturityAmount = 163500m,
                InterestRate = 9m,
                PaymentMode = "Transfer",
                SavingAccountID = 4164,
                Status = "Active",
                IsLegacyAccount = false
            });

            var voucher = new Voucher
            {
                VoucherID = 5001,
                BranchID = 1,
                VoucherNo = "JV-FD-00140100008436",
                VoucherDate = dt,
                VoucherType = "Journal",
                Status = "Pending",
                TotalAmount = 150000m,
                Narration = "मुदत ठेव खाते उघडले (FD Account Opened - Transfer): 00140100008436"
            };
            db.Vouchers.Add(voucher);
            db.FdTransactions.Add(new FdTransaction
            {
                FdTransactionID = 1,
                BranchID = 1,
                FdAccountID = 8436,
                VoucherID = 5001,
                TransactionDate = dt,
                TransactionType = "Opening",
                DebitCredit = "Cr",
                Amount = 150000m
            });
            db.SavingTransactions.AddRange(
                new SavingTransaction
                {
                    TransactionID = 10,
                    BranchID = 1,
                    SavingAccountID = 4164,
                    CustomerID = 1,
                    TransactionDate = dt,
                    TransactionType = "Withdrawal",
                    PaymentMode = "Transfer",
                    Amount = 150000m,
                    BalanceAfterTxn = 548m,
                    VoucherNo = null, // Simulates legacy/null VoucherNo on FD SB Debit
                    Narration = "मुदत ठेव खात्यासाठी वर्ग (FD Opening SB Debit): 00140100008436"
                },
                new SavingTransaction
                {
                    TransactionID = 11,
                    BranchID = 1,
                    SavingAccountID = 4164,
                    CustomerID = 1,
                    TransactionDate = dt.AddDays(1),
                    TransactionType = "Deposit",
                    PaymentMode = "Cash",
                    Amount = 100m,
                    BalanceAfterTxn = 648m, // Before rollback
                    VoucherNo = "REC-SB-11",
                    Narration = "Subsequent deposit"
                }
            );
            var sb = await db.SavingAccountMasters.FindAsync(4164);
            sb!.CurrentBalance = 648m;
            await db.SaveChangesAsync();

            var rollbackSvc = new VoucherRollbackAndDeleteService(db);
            var postingCtrl = new VoucherPostingController(db, rollbackSvc);
            AttachUser(postingCtrl, BuildAdminPrincipal(1, dt));

            var result = await postingCtrl.RejectVoucher(5001, reason: "डिलीट करून बचत शिल्लक पूर्ववत करा");
            Assert.IsType<OkObjectResult>(result);

            Assert.Null(await db.FdAccounts.FindAsync(8436));
            Assert.Null(await db.SavingTransactions.FindAsync(10));

            var updatedSb = await db.SavingAccountMasters.FindAsync(4164);
            Assert.Equal(150648m, updatedSb!.CurrentBalance);

            var survivingTxn = await db.SavingTransactions.FindAsync(11);
            Assert.NotNull(survivingTxn);
            Assert.Equal(150648m, survivingTxn!.BalanceAfterTxn);
        }

        [Fact]
        public async Task DeleteFdAccount_MatchesNormalized14DigitVariants_AndResyncsSavingBalances()
        {
            await using var db = CreateContext();
            var dt = new DateTime(2026, 4, 1);
            await SeedBaseAsync(db, dt);

            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 8437,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = 1,
                FdSchemeID = 1,
                AccountNo = "001-401-0000843-6",
                ReceiptNo = "001-401-0000843-6",
                OpeningDate = dt,
                MaturityDate = dt.AddMonths(12),
                DurationType = "Months",
                DurationValue = 12,
                DurationInDays = 365,
                DepositAmount = 150000m,
                MaturityAmount = 163500m,
                InterestRate = 9m,
                PaymentMode = "Transfer",
                SavingAccountID = 4164,
                Status = "Active"
            });
            db.SavingTransactions.Add(new SavingTransaction
            {
                TransactionID = 20,
                BranchID = 1,
                SavingAccountID = 4164,
                CustomerID = 1,
                TransactionDate = dt,
                TransactionType = "Withdrawal",
                PaymentMode = "Transfer",
                Amount = 150000m,
                BalanceAfterTxn = 548m,
                VoucherNo = null,
                Narration = "मुदत ठेव खात्यासाठी वर्ग (FD Opening SB Debit): 00140100008436" // Undashed vs dashed FdAccount.AccountNo
            });
            db.SavingPassbooks.Add(new SavingPassbook
            {
                PassbookLogID = 201,
                SavingAccountID = 4164,
                TransactionID = 20,
                CustomerID = 1,
                PrintedLineNo = 1,
                PrintedPageNo = 1
            });
            await db.SaveChangesAsync();

            var fdCtrl = new FdAccountsController(db);
            AttachUser(fdCtrl, BuildAdminPrincipal(1, dt));

            var res = await fdCtrl.DeleteFdAccount(8437);
            Assert.IsType<OkObjectResult>(res);

            Assert.Null(await db.FdAccounts.FindAsync(8437));
            Assert.Null(await db.SavingTransactions.FindAsync(20));
            Assert.False(await db.SavingPassbooks.AnyAsync(p => p.TransactionID == 20));
            Assert.Equal(150548m, (await db.SavingAccountMasters.FindAsync(4164))!.CurrentBalance);
        }

        [Fact]
        public async Task DeleteSavingTransaction_BlocksLiveLinkedFd_AndAllowsCleanOrphanDeletionWithAudit()
        {
            await using var db = CreateContext();
            var dt = new DateTime(2026, 4, 1);
            await SeedBaseAsync(db, dt);

            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 8438,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = 1,
                FdSchemeID = 1,
                AccountNo = "00140100008436",
                OpeningDate = dt,
                MaturityDate = dt.AddMonths(12),
                DepositAmount = 150000m,
                InterestRate = 9m,
                Status = "Active"
            });

            db.SavingTransactions.AddRange(
                new SavingTransaction
                {
                    TransactionID = 30,
                    BranchID = 1,
                    SavingAccountID = 4164,
                    CustomerID = 1,
                    TransactionDate = dt,
                    TransactionType = "Withdrawal",
                    PaymentMode = "Transfer",
                    Amount = 150000m,
                    BalanceAfterTxn = 548m,
                    VoucherNo = null,
                    Narration = "मुदत ठेव खात्यासाठी वर्ग (FD Opening SB Debit): 00140100008436"
                },
                new SavingTransaction
                {
                    TransactionID = 31,
                    BranchID = 1,
                    SavingAccountID = 4164,
                    CustomerID = 1,
                    TransactionDate = dt,
                    TransactionType = "Withdrawal",
                    PaymentMode = "Transfer",
                    Amount = 150000m,
                    BalanceAfterTxn = 548m,
                    VoucherNo = null,
                    Narration = "मुदत ठेव खात्यासाठी वर्ग (FD Opening SB Debit): 00140100009999" // True orphan (FD does not exist)
                }
            );
            await db.SaveChangesAsync();

            var stCtrl = new SavingTransactionsController(db);
            AttachUser(stCtrl, BuildAdminPrincipal(1, dt));

            // 1. Live FD exists -> MUST block deletion
            var blocked = await stCtrl.DeleteSavingTransaction(30);
            Assert.IsType<BadRequestObjectResult>(blocked);
            Assert.NotNull(await db.SavingTransactions.FindAsync(30));

            // 2. True orphan (FD 00140100009999 does not exist, VoucherNo is null) -> deletes & restores balance
            var deleted = await stCtrl.DeleteSavingTransaction(31);
            Assert.IsType<OkObjectResult>(deleted);
            Assert.Null(await db.SavingTransactions.FindAsync(31));
            Assert.Equal(150548m, (await db.SavingAccountMasters.FindAsync(4164))!.CurrentBalance);
            Assert.True(await db.AuditLogs.AnyAsync(a => a.Action == "SAVING_TRANSACTION_DELETED" && a.EntityID == "31"));
        }

        [Fact]
        public async Task VoucherPosting_RespectsAllDatesFlag_ForFindingOffDateVouchers()
        {
            await using var db = CreateContext();
            var dtApr1 = new DateTime(2026, 4, 1);
            var dtNov17 = new DateTime(2026, 11, 17);
            await SeedBaseAsync(db, dtApr1);

            db.Vouchers.Add(new Voucher
            {
                VoucherID = 7001,
                BranchID = 1,
                VoucherNo = "JV-FD-00140100008436",
                VoucherDate = dtNov17,
                VoucherType = "Journal",
                Status = "Pending",
                TotalAmount = 150000m,
                Narration = "FD Opening 00140100008436"
            });
            await db.SaveChangesAsync();

            var rollbackSvc = new VoucherRollbackAndDeleteService(db);
            var postingCtrl = new VoucherPostingController(db, rollbackSvc);
            AttachUser(postingCtrl, BuildAdminPrincipal(1, dtApr1));

            var singleDateRes = await postingCtrl.GetUnpostedVouchers(branchId: 1, voucherDate: dtApr1, allDates: false);
            var singleList = Assert.IsAssignableFrom<IEnumerable<Voucher>>(
                (singleDateRes.Result as OkObjectResult)?.Value ?? singleDateRes.Value);
            Assert.Empty(singleList);

            var allDatesRes = await postingCtrl.GetUnpostedVouchers(branchId: 1, voucherDate: dtApr1, allDates: true);
            var list = Assert.IsAssignableFrom<IEnumerable<Voucher>>(
                (allDatesRes.Result as OkObjectResult)?.Value ?? allDatesRes.Value).ToList();
            Assert.Single(list);
            Assert.Equal("JV-FD-00140100008436", list[0].VoucherNo);
        }

        [Fact]
        public async Task HealVerifiedOrphanFdSbDebitsAsync_RemovesOnlyVerifiedOrphans_PreservesLiveFdAndLiveVoucher()
        {
            await using var db = CreateContext();
            var dt = new DateTime(2026, 4, 1);
            await SeedBaseAsync(db, dt);

            // Live FD exists for 00140100008437 -> must NOT be touched even if VoucherNo is null
            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 502,
                BranchID = 1,
                CustomerID = 1,
                FdSchemeID = 1,
                AccountNo = "001-401-0000843-7",
                OpeningDate = dt,
                MaturityDate = dt.AddYears(1),
                DepositAmount = 25000m,
                Status = "Active"
            });

            // Live Voucher exists for tx 402 -> must NOT be touched even if FD is missing
            db.Vouchers.Add(new Voucher
            {
                VoucherID = 7101,
                BranchID = 1,
                VoucherNo = "JV-FD-001-401-0000843-8",
                VoucherDate = dt,
                VoucherType = "Journal",
                TotalAmount = 10000m,
                Status = "Approved"
            });

            db.SavingTransactions.AddRange(
                // Tx 401: True Orphan (VoucherNo = null, FD 00140100008436 missing) -> MUST be healed
                new SavingTransaction
                {
                    TransactionID = 401,
                    SavingAccountID = 4164,
                    CustomerID = 1,
                    BranchID = 1,
                    TransactionDate = dt,
                    TransactionType = "Withdrawal",
                    PaymentMode = "Transfer",
                    Amount = 150000m,
                    BalanceAfterTxn = 548m,
                    VoucherNo = null,
                    Narration = "मुदत ठेव खात्यासाठी वर्ग (FD Opening SB Debit): 00140100008436"
                },
                // Tx 402: Live FD exists -> MUST stay
                new SavingTransaction
                {
                    TransactionID = 402,
                    SavingAccountID = 4164,
                    CustomerID = 1,
                    BranchID = 1,
                    TransactionDate = dt,
                    TransactionType = "Withdrawal",
                    PaymentMode = "Transfer",
                    Amount = 25000m,
                    BalanceAfterTxn = 548m,
                    VoucherNo = null,
                    Narration = "मुदत ठेव खात्यासाठी वर्ग (FD Opening SB Debit): 00140100008437"
                },
                // Tx 403: Live Voucher exists -> MUST stay
                new SavingTransaction
                {
                    TransactionID = 403,
                    SavingAccountID = 4164,
                    CustomerID = 1,
                    BranchID = 1,
                    TransactionDate = dt,
                    TransactionType = "Withdrawal",
                    PaymentMode = "Transfer",
                    Amount = 10000m,
                    BalanceAfterTxn = 548m,
                    VoucherNo = "JV-FD-001-401-0000843-8",
                    Narration = "मुदत ठेव खात्यासाठी वर्ग (FD Opening SB Debit): 001-401-0000843-8"
                }
            );
            db.SavingPassbooks.Add(new SavingPassbook { PassbookLogID = 901, SavingAccountID = 4164, TransactionID = 401 });
            await db.SaveChangesAsync();

            int healed = await SavingLedgerHelper.HealVerifiedOrphanFdSbDebitsAsync(db);
            Assert.Equal(1, healed);

            // Second run must be 100% idempotent
            Assert.Equal(0, await SavingLedgerHelper.HealVerifiedOrphanFdSbDebitsAsync(db));

            Assert.Null(await db.SavingTransactions.FindAsync(401));
            Assert.Null(await db.SavingPassbooks.FindAsync(901));
            Assert.NotNull(await db.SavingTransactions.FindAsync(402));
            Assert.NotNull(await db.SavingTransactions.FindAsync(403));
            Assert.Equal(150548m, (await db.SavingAccountMasters.FindAsync(4164))!.CurrentBalance);
            Assert.True(await db.AuditLogs.AnyAsync(a => a.Action == "ORPHAN_FD_SB_DEBIT_HEALED" && a.EntityID == "401"));
        }

        [Fact]
        public async Task ReportsController_SavingKhatavani_FlagsOrphanAndLiveLinkedFdAccurately()
        {
            await using var db = CreateContext();
            var dt = new DateTime(2026, 4, 1);
            await SeedBaseAsync(db, dt);

            db.SavingAccountMasters.Add(new SavingAccountMaster
            {
                SavingAccountID = 4165,
                BranchID = 1,
                CustomerID = 1,
                LedgerID = 102,
                AccountNo = "00110100004165",
                OpeningDate = new DateTime(2026, 3, 31),
                OpeningBalance = 200000m,
                CurrentBalance = 40000m,
                Status = "Active"
            });

            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 510,
                BranchID = 1,
                CustomerID = 1,
                FdSchemeID = 1,
                AccountNo = "001-401-0000844-4",
                OpeningDate = dt,
                MaturityDate = dt.AddYears(1),
                DepositAmount = 10000m,
                Status = "Active"
            });

            db.SavingTransactions.AddRange(
                new SavingTransaction
                {
                    TransactionID = 410,
                    SavingAccountID = 4165,
                    CustomerID = 1,
                    BranchID = 1,
                    TransactionDate = dt,
                    TransactionType = "Withdrawal",
                    PaymentMode = "Transfer",
                    Amount = 150000m,
                    VoucherNo = null,
                    Narration = "मुदत ठेव खात्यासाठी वर्ग (FD Opening SB Debit): 00140100008436"
                },
                new SavingTransaction
                {
                    TransactionID = 411,
                    SavingAccountID = 4165,
                    CustomerID = 1,
                    BranchID = 1,
                    TransactionDate = dt,
                    TransactionType = "Withdrawal",
                    PaymentMode = "Transfer",
                    Amount = 10000m,
                    VoucherNo = null,
                    Narration = "मुदत ठेव खात्यासाठी वर्ग (FD Opening SB Debit): 00140100008444"
                }
            );
            await db.SaveChangesAsync();

            using var cache = new MemoryCache(new MemoryCacheOptions());
            var repCtrl = new ReportsController(db, cache);
            AttachUser(repCtrl, BuildAdminPrincipal(1, dt));

            var res = await repCtrl.GetSavingKhatavani(4165, dt, dt.AddMonths(1));
            var ok = Assert.IsType<OkObjectResult>(res.Result);
            var dto = Assert.IsType<SavingKhatavaniReportDto>(ok.Value);

            var rowOrphan = dto.Transactions.Single(t => t.TransactionID == 410);
            Assert.True(rowOrphan.IsOrphanEntry);
            Assert.False(rowOrphan.HasLiveLinkedFd);

            var rowLiveFd = dto.Transactions.Single(t => t.TransactionID == 411);
            Assert.True(rowLiveFd.IsOrphanEntry);
            Assert.True(rowLiveFd.HasLiveLinkedFd);
            Assert.Equal("001-401-0000844-4", rowLiveFd.LinkedFdAccountNo);
        }

        [Fact]
        public async Task DeleteFdAccount_WithoutSavingAccountIdMetadata_StillReversesExactVariantSbDebit()
        {
            await using var db = CreateContext();
            var dt = new DateTime(2026, 4, 1);
            await SeedBaseAsync(db, dt);

            db.SavingAccountMasters.Add(new SavingAccountMaster
            {
                SavingAccountID = 4166,
                BranchID = 1,
                CustomerID = 1,
                LedgerID = 102,
                AccountNo = "00110100004166",
                OpeningDate = new DateTime(2026, 3, 31),
                OpeningBalance = 150548m,
                CurrentBalance = 548m,
                Status = "Active"
            });

            // Simulate FD record missing SavingAccountID & PaymentMode metadata
            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 520,
                BranchID = 1,
                CustomerID = 1,
                FdSchemeID = 1,
                AccountNo = "001-401-0000843-6",
                OpeningDate = dt,
                MaturityDate = dt.AddYears(1),
                DepositAmount = 150000m,
                Status = "Active",
                PaymentMode = "Cash",
                SavingAccountID = null
            });

            db.SavingTransactions.Add(new SavingTransaction
            {
                TransactionID = 420,
                SavingAccountID = 4166,
                CustomerID = 1,
                BranchID = 1,
                TransactionDate = dt,
                TransactionType = "Withdrawal",
                PaymentMode = "Transfer",
                Amount = 150000m,
                BalanceAfterTxn = 548m,
                VoucherNo = null,
                Narration = "मुदत ठेव खात्यासाठी वर्ग (FD Opening SB Debit): 00140100008436"
            });
            await db.SaveChangesAsync();

            var fdCtrl = new FdAccountsController(db);
            AttachUser(fdCtrl, BuildAdminPrincipal(1, dt));

            var delRes = await fdCtrl.DeleteFdAccount(520);
            Assert.IsType<OkObjectResult>(delRes);

            Assert.Null(await db.FdAccounts.FindAsync(520));
            Assert.Null(await db.SavingTransactions.FindAsync(420));
            Assert.Equal(150548m, (await db.SavingAccountMasters.FindAsync(4166))!.CurrentBalance);
        }
    }
}
