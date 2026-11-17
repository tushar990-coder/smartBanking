using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Bhisi.Api.Controllers;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class VoucherPostingLinkedAccountTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"BhisiVoucherLinked_{Guid.NewGuid()}")
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
            db.AccountGroups.Add(new AccountGroup { GroupID = 1, GroupName = "ठेवी व कर्जे", NatureOfGroup = "Liabilities", IsActive = true });
            db.Ledgers.Add(new Ledger { LedgerID = 101, GroupID = 1, LedgerCode = "GEN-101", LedgerName = "मुख्य लेजर", AccountType = "General", IsActive = true });
            db.Customers.Add(new Customer
            {
                CustomerID = 1,
                BranchID = 1,
                CIFNo = "CIF001251",
                LegacyCustomerNo = "OLD-CUST-99",
                FirstName = "रोहित",
                LastName = "गणगटे",
                MobileNo = "9876543210"
            });
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task GetUnpostedVouchers_EnrichesLoanRdFdAndSavingOldAccountNumbers()
        {
            await using var db = CreateContext();
            var dt = new DateTime(2026, 4, 1);
            await SeedBaseAsync(db, dt);

            db.SavingAccountMasters.Add(new SavingAccountMaster
            {
                SavingAccountID = 201,
                BranchID = 1,
                CustomerID = 1,
                AccountNo = "00110100006862",
                OldAccountNo = "441",
                LedgerID = 101,
                CurrentBalance = 5000m,
                Status = "Active"
            });

            db.LoanRates.Add(new LoanRate { LoanRateID = 1, LoanType = "सोनेतारण कर्जे", InterestRate = 12m, IsActive = true });
            db.LoanAccounts.Add(new LoanAccount
            {
                LoanAccountID = 301,
                BranchID = 1,
                CustomerID = 1,
                LoanRateID = 1,
                LoanAccountNo = "001-205-0000071-2",
                LegacyAccountNumber = "GL-77",
                PrincipalBalance = 50000m,
                InterestBalance = 0m,
                Status = "Active"
            });

            db.RdSchemes.Add(new RdScheme { RdSchemeID = 1, SchemeCode = "RD01", SchemeName = "रिकरींग ठेव", DurationMonths = 12, InterestRate = 7.5m, RdLiabilityLedgerID = 101, IsActive = true });
            db.RdAccounts.Add(new RdAccount
            {
                RdAccountID = 401,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = 1,
                RdSchemeID = 1,
                AccountNo = "00130100000012",
                LegacyAccountNumber = "RD-OLD-12",
                InstallmentAmount = 2000m,
                DurationMonths = 12,
                InterestRate = 7.5m,
                MaturityDate = dt.AddMonths(12),
                MaturityAmount = 25000m,
                Status = "Active"
            });

            db.FdSchemes.Add(new FdScheme { FdSchemeID = 1, SchemeCode = "FD01", SchemeName = "मुदतबंद ठेव", DurationMonths = 12, DurationType = "Months", InterestRate = 9m, FdLiabilityLedgerID = 101, IsActive = true });
            db.FdAccounts.AddRange(
                new FdAccount
                {
                    FdAccountID = 501,
                    BranchID = 1,
                    CustomerID = 1,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000206-6",
                    LegacyAccountNumber = "1455",
                    ReceiptNo = "R-1455",
                    DepositAmount = 40000m,
                    InterestRate = 9m,
                    MaturityAmount = 43896m,
                    Status = "Renewed"
                },
                new FdAccount
                {
                    FdAccountID = 502,
                    BranchID = 1,
                    CustomerID = 1,
                    FdSchemeID = 1,
                    AccountNo = "001-401-0000892-3",
                    LegacyAccountNumber = "1456",
                    ReceiptNo = "R-1456",
                    DepositAmount = 43896m,
                    InterestRate = 9.5m,
                    MaturityAmount = 48066m,
                    Status = "Active"
                });

            db.Vouchers.AddRange(
                new Voucher { VoucherID = 10, BranchID = 1, VoucherNo = "REC-LOAN-01", VoucherDate = dt, VoucherType = "Receipt", TotalAmount = 5000m, Status = "Pending", Narration = "Loan Collection" },
                new Voucher { VoucherID = 11, BranchID = 1, VoucherNo = "REC-RD-01", VoucherDate = dt, VoucherType = "Receipt", TotalAmount = 2000m, Status = "Pending", Narration = "आरडी हप्ता भरणा (रोख)" },
                new Voucher { VoucherID = 12, BranchID = 1, VoucherNo = "JV-FD-REN-01", VoucherDate = dt, VoucherType = "Journal", TotalAmount = 43896m, Status = "Pending", Narration = "FD Renewal" },
                new Voucher { VoucherID = 13, BranchID = 1, VoucherNo = "REC-SB-01", VoucherDate = dt, VoucherType = "Receipt", TotalAmount = 1000m, Status = "Pending", Narration = "बचत जमा" }
            );
            db.VoucherDetails.AddRange(
                new VoucherDetail { VoucherID = 10, LedgerID = 101, CustomerID = 1, DrCr = "Cr", Amount = 5000m },
                new VoucherDetail { VoucherID = 11, LedgerID = 101, CustomerID = 1, DrCr = "Cr", Amount = 2000m },
                new VoucherDetail { VoucherID = 12, LedgerID = 101, CustomerID = 1, DrCr = "Cr", Amount = 43896m },
                new VoucherDetail { VoucherID = 13, LedgerID = 101, CustomerID = 1, DrCr = "Cr", Amount = 1000m }
            );

            db.LoanCollections.Add(new LoanCollection
            {
                LoanAccountID = 301,
                SourceSavingAccountID = 201,
                VoucherID = 10,
                ReceiptNo = "REC-01",
                CollectionDate = dt,
                TotalAmountReceived = 5000m
            });
            db.RdTransactions.Add(new RdTransaction
            {
                BranchID = 1,
                FinancialYearID = 1,
                RdAccountID = 401,
                VoucherID = 11,
                TransactionDate = dt,
                TransactionType = "Installment",
                DebitCredit = "Cr",
                PrincipalAmount = 2000m
            });
            db.FdTransactions.AddRange(
                new FdTransaction { BranchID = 1, FdAccountID = 501, VoucherID = 12, TransactionDate = dt, TransactionType = "Renewal", DebitCredit = "Dr", Amount = 40000m },
                new FdTransaction { BranchID = 1, FdAccountID = 502, VoucherID = 12, TransactionDate = dt, TransactionType = "Opening", DebitCredit = "Cr", Amount = 43896m }
            );
            db.SavingTransactions.Add(new SavingTransaction
            {
                SavingAccountID = 201,
                CustomerID = 1,
                BranchID = 1,
                TransactionDate = dt,
                TransactionType = "Deposit",
                Amount = 1000m,
                BalanceAfterTxn = 6000m,
                VoucherNo = "REC-SB-01"
            });

            await db.SaveChangesAsync();

            var postingCtrl = new VoucherPostingController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(postingCtrl, BuildAdminPrincipal(1, dt));

            var actionRes = await postingCtrl.GetUnpostedVouchers(branchId: 1, voucherDate: dt, allDates: false);
            var list = Assert.IsAssignableFrom<IEnumerable<Voucher>>(actionRes.Value).ToList();

            Assert.Equal(4, list.Count);
            Assert.All(list, v => Assert.Equal("OLD-CUST-99", v.VoucherDetails.First().Customer?.LegacyCustomerNo));

            var loanV = list.Single(v => v.VoucherID == 10);
            Assert.Contains(loanV.LinkedAccounts, a => a.AccountType == "Loan" && a.AccountNo == "001-205-0000071-2" && a.OldAccountNo == "GL-77");
            Assert.Contains(loanV.LinkedAccounts, a => a.AccountType == "Saving" && a.AccountNo == "00110100006862" && a.OldAccountNo == "441" && a.RoleLabel == "स्रोत बचत");

            var rdV = list.Single(v => v.VoucherID == 11);
            var rdAcc = Assert.Single(rdV.LinkedAccounts);
            Assert.Equal("RD", rdAcc.AccountType);
            Assert.Equal("00130100000012", rdAcc.AccountNo);
            Assert.Equal("RD-OLD-12", rdAcc.OldAccountNo);

            var fdV = list.Single(v => v.VoucherID == 12);
            Assert.Equal(2, fdV.LinkedAccounts.Count);
            Assert.Contains(fdV.LinkedAccounts, a => a.AccountNo == "001-401-0000206-6" && a.OldAccountNo == "1455" && a.ReceiptNo == "R-1455" && a.RoleLabel == "जुनी ठेव");
            Assert.Contains(fdV.LinkedAccounts, a => a.AccountNo == "001-401-0000892-3" && a.OldAccountNo == "1456" && a.ReceiptNo == "R-1456");

            var sbV = list.Single(v => v.VoucherID == 13);
            var sbAcc = Assert.Single(sbV.LinkedAccounts);
            Assert.Equal("Saving", sbAcc.AccountType);
            Assert.Equal("00110100006862", sbAcc.AccountNo);
            Assert.Equal("441", sbAcc.OldAccountNo);
        }

        [Fact]
        public async Task GetApprovedVouchers_EnrichesPigmyShareAndInvestmentOpeningOldNumbers()
        {
            await using var db = CreateContext();
            var dt = new DateTime(2026, 4, 2);
            await SeedBaseAsync(db, dt);

            db.PigmySchemes.Add(new PigmyScheme { PigmySchemeID = 1, SchemeCode = "PIG01", SchemeName = "पिग्मी", DurationMonths = 12, InterestRate = 5m, Status = "Active" });
            db.PigmyAgents.Add(new PigmyAgent { PigmyAgentID = 1, BranchID = 1, AgentName = "अमोल पाटील", Status = "Active" });
            db.PigmyAccounts.Add(new PigmyAccount
            {
                PigmyAccountID = 601,
                BranchID = 1,
                CustomerID = 1,
                PigmySchemeID = 1,
                PigmyAgentID = 1,
                AccountNo = "00150100000005",
                OldAccountNo = "PIG-OLD-5",
                Status = "Active"
            });

            db.Members.Add(new Member { MemberID = 1, CustomerID = 1, BranchID = 1, MemberCode = "MEM0001", LegacyMemberNo = "51" });
            db.ShareAccounts.Add(new ShareAccount
            {
                ShareAccountId = 701,
                MemberId = 1,
                CustomerID = 1,
                AccountNo = "00100000001",
                LegacyAccountNumber = "SH-OLD-51",
                Status = "Active"
            });

            db.InvestmentInstitutions.Add(new InvestmentInstitution { InstitutionID = 1, InstitutionName = "KDCC Bank" });
            db.InvestmentSchemes.Add(new InvestmentScheme { SchemeID = 1, SchemeName = "Bank FD", InvestmentAssetLedgerID = 101, InterestIncomeLedgerID = 101 });
            db.InvestmentAccounts.Add(new InvestmentAccount
            {
                InvestmentAccountID = 801,
                BranchID = 1,
                FinancialYearID = 1,
                InvestmentInstitutionID = 1,
                SchemeID = 1,
                InvestmentNo = "INV-001",
                OldInvestmentNo = "OLD-INV-88",
                DepositReceiptNo = "FDR-8899",
                PrincipalAmount = 100000m,
                InterestRate = 7.25m,
                MaturityDate = dt.AddYears(1),
                ExpectedMaturityAmount = 107250m,
                BookValue = 100000m
            });

            db.Vouchers.AddRange(
                new Voucher { VoucherID = 20, BranchID = 1, VoucherNo = "REC-PIG-01", VoucherDate = dt, VoucherType = "Receipt", TotalAmount = 500m, Status = "Approved", ScrollNo = 1 },
                new Voucher { VoucherID = 21, BranchID = 1, VoucherNo = "REC-SH-01", VoucherDate = dt, VoucherType = "Receipt", TotalAmount = 1000m, Status = "Approved", ScrollNo = 2 },
                new Voucher { VoucherID = 22, BranchID = 1, VoucherNo = "PAY-INV-OP-INV-001", VoucherDate = dt, VoucherType = "Payment", TotalAmount = 100000m, Status = "Approved", ScrollNo = 3 }
            );
            db.VoucherDetails.AddRange(
                new VoucherDetail { VoucherID = 20, LedgerID = 101, CustomerID = 1, DrCr = "Cr", Amount = 500m },
                new VoucherDetail { VoucherID = 21, LedgerID = 101, CustomerID = 1, MemberID = 1, DrCr = "Cr", Amount = 1000m },
                new VoucherDetail { VoucherID = 22, LedgerID = 101, DrCr = "Dr", Amount = 100000m }
            );

            db.PigmyCollections.Add(new PigmyCollection
            {
                PigmyAccountId = 601,
                AgentId = 1,
                VoucherId = 20,
                CollectionDate = dt,
                OpeningBalance = 0m,
                CollectionAmount = 500m,
                ClosingBalance = 500m,
                ReceiptNo = "P-1",
                CollectionSource = "MANUAL"
            });
            db.ShareTransactions.Add(new ShareTransaction
            {
                ShareAccountId = 701,
                CustomerID = 1,
                VoucherId = 21,
                TransactionDate = dt,
                TransactionType = "Allotment",
                NumberOfShares = 10,
                Amount = 1000m,
                Narration = "Shares"
            });

            await db.SaveChangesAsync();

            var postingCtrl = new VoucherPostingController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(postingCtrl, BuildAdminPrincipal(1, dt));

            var actionRes = await postingCtrl.GetApprovedVouchers(branchId: 1, voucherDate: dt, allDates: false);
            var list = Assert.IsAssignableFrom<IEnumerable<Voucher>>(actionRes.Value).ToList();

            Assert.Equal(3, list.Count);

            var pigV = list.Single(v => v.VoucherID == 20);
            var pigAcc = Assert.Single(pigV.LinkedAccounts);
            Assert.Equal("Pigmy", pigAcc.AccountType);
            Assert.Equal("00150100000005", pigAcc.AccountNo);
            Assert.Equal("PIG-OLD-5", pigAcc.OldAccountNo);

            var shV = list.Single(v => v.VoucherID == 21);
            var shAcc = Assert.Single(shV.LinkedAccounts);
            Assert.Equal("Share", shAcc.AccountType);
            Assert.Equal("00100000001", shAcc.AccountNo);
            Assert.Equal("SH-OLD-51", shAcc.OldAccountNo);

            var invV = list.Single(v => v.VoucherID == 22);
            var invAcc = Assert.Single(invV.LinkedAccounts);
            Assert.Equal("Investment", invAcc.AccountType);
            Assert.Equal("INV-001", invAcc.AccountNo);
            Assert.Equal("OLD-INV-88", invAcc.OldAccountNo);
            Assert.Equal("FDR-8899", invAcc.ReceiptNo);
        }

        [Fact]
        public async Task RejectVoucher_And_BulkRejectVouchers_SavingWithdrawalAndFdMisPayout_RollBackCleanly()
        {
            await using var db = CreateContext();
            var dt = new DateTime(2026, 4, 2);

            db.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "2026-2027",
                StartDate = new DateTime(2026, 4, 1),
                EndDate = new DateTime(2027, 3, 31),
                IsActive = true,
                IsClosed = false
            });
            db.Ledgers.Add(new Ledger
            {
                LedgerID = 101,
                GroupID = 1,
                LedgerCode = "SAV-GL",
                LedgerName = "सेव्हिंग ठेव",
                AccountType = "Liability",
                IsActive = true
            });
            db.Customers.Add(new Customer
            {
                CustomerID = 1,
                BranchID = 1,
                CIFNo = "CIF001338",
                FirstName = "पद्मश्री",
                LastName = "संजय भागाटे"
            });
            db.SavingAccountMasters.Add(new SavingAccountMaster
            {
                SavingAccountID = 801,
                BranchID = 1,
                CustomerID = 1,
                LedgerID = 101,
                AccountNo = "00110100005781",
                OpeningBalance = 10000m,
                CurrentBalance = 8000m,
                Status = "Active"
            });
            db.SavingTransactions.Add(new SavingTransaction
            {
                TransactionID = 901,
                SavingAccountID = 801,
                CustomerID = 1,
                BranchID = 1,
                TransactionDate = dt,
                TransactionType = "Withdrawal",
                PaymentMode = "Cash",
                Amount = 2000m,
                BalanceAfterTxn = 8000m,
                VoucherNo = "001-PAY-26-27-00001",
                Narration = "बचत नावे - 00110100005781 पद्मश्री भागाटे"
            });

            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 802,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = 1,
                FdSchemeID = 1,
                AccountNo = "00140200001588",
                OpeningDate = new DateTime(2025, 10, 1),
                MaturityDate = new DateTime(2026, 10, 1),
                DepositAmount = 50000m,
                InterestRate = 9m,
                MaturityAmount = 50000m,
                LastInterestPostingDate = new DateTime(2026, 4, 2),
                Status = "Active"
            });
            db.Vouchers.AddRange(
                new Voucher
                {
                    VoucherID = 187,
                    BranchID = 1,
                    VoucherNo = "001-PAY-26-27-00001",
                    VoucherDate = dt,
                    VoucherType = "Payment",
                    TotalAmount = 2000m,
                    Narration = "बचत नावे - 00110100005781 पद्मश्री भागाटे",
                    Status = "Pending"
                },
                new Voucher
                {
                    VoucherID = 188,
                    BranchID = 1,
                    VoucherNo = "PAY-FDMIS-001",
                    VoucherDate = dt,
                    VoucherType = "Payment",
                    TotalAmount = 375m,
                    Narration = "FD MIS Payout",
                    Status = "Pending"
                }
            );
            db.VoucherDetails.AddRange(
                new VoucherDetail { VoucherID = 187, LedgerID = 101, CustomerID = 1, DrCr = "Dr", Amount = 2000m },
                new VoucherDetail { VoucherID = 188, LedgerID = 101, CustomerID = 1, DrCr = "Dr", Amount = 375m }
            );
            db.FdMisPayouts.Add(new FdMisPayout
            {
                PayoutID = 501,
                BranchID = 1,
                FinancialYearID = 1,
                FdAccountID = 802,
                PayoutYear = 2026,
                PayoutMonth = 4,
                PayoutDate = dt,
                DepositPrincipal = 50000m,
                InterestRate = 9m,
                GrossInterest = 375m,
                NetDisbursedAmount = 375m,
                DisbursementMode = "Cash",
                VoucherID = 188,
                Status = "Success"
            });
            db.FdTransactions.Add(new FdTransaction
            {
                FdTransactionID = 502,
                BranchID = 1,
                FdAccountID = 802,
                VoucherID = 188,
                TransactionDate = dt,
                TransactionType = "MIS_Payout",
                DebitCredit = "Dr",
                Amount = 375m
            });
            await db.SaveChangesAsync();

            var postingCtrl = new VoucherPostingController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(postingCtrl, BuildAdminPrincipal(1, dt));

            // 1. Single delete via DELETE /api/VoucherPosting/187
            var singleRes = await postingCtrl.RejectVoucher(187, new VoucherPostingController.VoucherRejectDto
            {
                Reason = "Delete pending saving withdrawal"
            });
            Assert.IsType<OkObjectResult>(singleRes);
            Assert.Null(await db.Vouchers.FindAsync(187));
            Assert.Null(await db.SavingTransactions.FindAsync(901));
            Assert.Equal(10000m, (await db.SavingAccountMasters.FindAsync(801))!.CurrentBalance);

            // 2. Bulk delete via POST /api/VoucherPosting/BulkReject (including FD MIS payout voucher 188)
            var bulkRes = await postingCtrl.BulkRejectVouchers(new VoucherPostingController.BulkRejectVouchersRequest
            {
                VoucherIds = new List<int> { 188 },
                Reason = "Bulk reject pending FD MIS payout"
            });
            Assert.IsType<OkObjectResult>(bulkRes);
            Assert.Null(await db.Vouchers.FindAsync(188));
            Assert.Null(await db.FdMisPayouts.FindAsync(501));
            Assert.Null(await db.FdTransactions.FindAsync(502));
            Assert.Null((await db.FdAccounts.FindAsync(802))!.LastInterestPostingDate);
        }
    }
}
