using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Bhisi.Api.Controllers;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Caching.Memory;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class FdLedgerSchemeFilterTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"BhisiFdLedgerScheme_{Guid.NewGuid()}")
                .ConfigureWarnings(x => x.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ClaimsPrincipal BuildAdminPrincipal(int branchId)
        {
            return new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "1"),
                new Claim(ClaimTypes.Name, "admin"),
                new Claim(ClaimTypes.Role, "Admin"),
                new Claim("BranchID", branchId.ToString()),
                new Claim("DefaultBranchID", branchId.ToString())
            }, "TestJwt"));
        }

        private static void AttachUser(ControllerBase controller, ClaimsPrincipal principal)
        {
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = principal }
            };
        }

        private static async Task SeedAsync(AppDbContext db)
        {
            db.Branches.Add(new Branch { BranchID = 1, BranchCode = "HO", BranchName = "मुख्य शाखा", IsActive = true });
            db.AccountGroups.Add(new AccountGroup { GroupID = 1, GroupName = "ठेवी", NatureOfGroup = "Liabilities", IsActive = true });
            db.Ledgers.Add(new Ledger { LedgerID = 101, GroupID = 1, LedgerCode = "FD-101", LedgerName = "मुदत ठेव", AccountType = "Fixed Deposit", IsActive = true });

            db.FdSchemes.AddRange(
                new FdScheme { FdSchemeID = 1, SchemeCode = "FD-REG", SchemeName = "मुदतबंद ठेव", DurationMonths = 12, InterestRate = 9m, FdLiabilityLedgerID = 101, IsActive = true },
                new FdScheme { FdSchemeID = 2, SchemeCode = "FD-DBL", SchemeName = "दामदुप्पट ठेव", DurationMonths = 72, InterestRate = 10m, FdLiabilityLedgerID = 101, IsActive = true }
            );

            db.Customers.AddRange(
                new Customer { CustomerID = 1, BranchID = 1, CIFNo = "CIF000001", LegacyCustomerNo = "1", FirstName = "शामराव", LastName = "सुर्वे", FirstNameEng = "Shamrao", MiddleNameEng = "Anandrao", LastNameEng = "Surve", NickName = "Sham", MobileNo = "9800000001" },
                new Customer { CustomerID = 2, BranchID = 1, CIFNo = "CIF000002", LegacyCustomerNo = "2", FirstName = "रमेश", LastName = "पाटील", FirstNameEng = "Ramesh", LastNameEng = "Patil", MobileNo = "9800000002" },
                new Customer { CustomerID = 3, BranchID = 1, CIFNo = "CIF000003", LegacyCustomerNo = "3", FirstName = "सुनील", LastName = "जोशी", MobileNo = "9800000003" } // No FD
            );

            db.FdAccounts.AddRange(
                new FdAccount
                {
                    FdAccountID = 101, BranchID = 1, CustomerID = 1, FdSchemeID = 1,
                    AccountNo = "001-401-0000146-4", LegacyAccountNumber = "1407", ReceiptNo = "REC-1407",
                    OpeningDate = new DateTime(2026, 3, 1), MaturityDate = new DateTime(2027, 3, 1),
                    DepositAmount = 100000m, InterestRate = 9m, MaturityAmount = 109000m, Status = "Active"
                },
                new FdAccount
                {
                    FdAccountID = 102, BranchID = 0, CustomerID = 1, FdSchemeID = 1,
                    AccountNo = "001-401-0000147-2", LegacyAccountNumber = "1408", ReceiptNo = "REC-1408",
                    OpeningDate = new DateTime(2026, 6, 5), MaturityDate = new DateTime(2027, 6, 5),
                    DepositAmount = 50000m, InterestRate = 9m, MaturityAmount = 54500m, Status = "Active"
                },
                new FdAccount
                {
                    FdAccountID = 103, BranchID = 1, CustomerID = 1, FdSchemeID = 2,
                    AccountNo = "001-402-0000001-1", LegacyAccountNumber = "2001",
                    OpeningDate = new DateTime(2026, 4, 1), MaturityDate = new DateTime(2032, 4, 1),
                    DepositAmount = 25000m, InterestRate = 10m, MaturityAmount = 50000m, Status = "Active"
                },
                new FdAccount
                {
                    FdAccountID = 104, BranchID = 1, CustomerID = 2, FdSchemeID = 2,
                    AccountNo = "001-402-0000002-9", LegacyAccountNumber = "2002",
                    OpeningDate = new DateTime(2026, 6, 10), MaturityDate = new DateTime(2032, 6, 10),
                    DepositAmount = 75000m, InterestRate = 10m, MaturityAmount = 150000m, Status = "Active"
                }
            );

            db.Vouchers.AddRange(
                new Voucher { VoucherID = 1, BranchID = 1, VoucherNo = "REC-1", VoucherDate = new DateTime(2026, 3, 1), VoucherType = "Receipt", TotalAmount = 100000m, Status = "Approved" },
                new Voucher { VoucherID = 2, BranchID = 1, VoucherNo = "JV-INT-1", VoucherDate = new DateTime(2026, 6, 15), VoucherType = "Journal", TotalAmount = 2250m, Status = "Approved" },
                new Voucher { VoucherID = 3, BranchID = 1, VoucherNo = "REC-2", VoucherDate = new DateTime(2026, 6, 5), VoucherType = "Receipt", TotalAmount = 50000m, Status = "Approved" },
                new Voucher { VoucherID = 4, BranchID = 1, VoucherNo = "REC-3", VoucherDate = new DateTime(2026, 4, 1), VoucherType = "Receipt", TotalAmount = 25000m, Status = "Approved" },
                new Voucher { VoucherID = 5, BranchID = 1, VoucherNo = "REC-4", VoucherDate = new DateTime(2026, 6, 10), VoucherType = "Receipt", TotalAmount = 75000m, Status = "Approved" }
            );

            db.FdTransactions.AddRange(
                new FdTransaction { FdTransactionID = 1, BranchID = 1, FdAccountID = 101, VoucherID = 1, TransactionDate = new DateTime(2026, 3, 1), TransactionType = "Opening", DebitCredit = "Cr", Amount = 100000m },
                new FdTransaction { FdTransactionID = 2, BranchID = 1, FdAccountID = 101, VoucherID = 2, TransactionDate = new DateTime(2026, 6, 15), TransactionType = "Accrual", DebitCredit = "Cr", Amount = 2250m },
                new FdTransaction { FdTransactionID = 3, BranchID = 1, FdAccountID = 102, VoucherID = 3, TransactionDate = new DateTime(2026, 6, 5), TransactionType = "Opening", DebitCredit = "Cr", Amount = 50000m },
                new FdTransaction { FdTransactionID = 4, BranchID = 1, FdAccountID = 103, VoucherID = 4, TransactionDate = new DateTime(2026, 4, 1), TransactionType = "Opening", DebitCredit = "Cr", Amount = 25000m },
                new FdTransaction { FdTransactionID = 5, BranchID = 1, FdAccountID = 104, VoucherID = 5, TransactionDate = new DateTime(2026, 6, 10), TransactionType = "Opening", DebitCredit = "Cr", Amount = 75000m }
            );

            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task GetFdLedgerOptions_FiltersStrictlyBySelectedScheme()
        {
            await using var db = CreateContext();
            await SeedAsync(db);

            var ctrl = new ReportsController(db, new MemoryCache(new MemoryCacheOptions()));
            AttachUser(ctrl, BuildAdminPrincipal(1));

            // Scheme 1: Only Customer 1 (with 2 accounts: 1407, 1408); Customer 2 & 3 excluded
            var resScheme1 = Assert.IsType<OkObjectResult>(await ctrl.GetFdLedgerOptions(branchID: 1, fdSchemeID: 1));
            var dto1 = Assert.IsType<FdLedgerOptionsResponseDto>(resScheme1.Value);
            Assert.Equal(2, dto1.TotalAccountsCount);
            Assert.Equal(150000m, dto1.TotalDepositAmount);
            var c1 = Assert.Single(dto1.Customers);
            Assert.Equal(1, c1.CustomerID);
            Assert.Equal(2, c1.FdCount);
            Assert.Equal("Shamrao Anandrao Surve", c1.CustomerNameEng);
            Assert.Equal("Sham", c1.NickName);
            Assert.Contains("1407", c1.AccountNumbers);
            Assert.Contains("REC-1407", c1.AccountNumbers);
            Assert.Contains("1408", c1.AccountNumbers);
            Assert.Equal(2, dto1.Accounts.Count);
            Assert.Contains(dto1.Accounts, a => a.FdAccountID == 101 && a.LegacyAccountNumber == "1407" && a.ReceiptNo == "REC-1407" && a.CustomerNameEng == "Shamrao Anandrao Surve");
            Assert.Contains(dto1.Accounts, a => a.FdAccountID == 102 && a.LegacyAccountNumber == "1408");

            // Scheme 2: Both Customer 1 and Customer 2 appear; Customer 3 (no FD) excluded
            var resScheme2 = Assert.IsType<OkObjectResult>(await ctrl.GetFdLedgerOptions(branchID: 1, fdSchemeID: 2));
            var dto2 = Assert.IsType<FdLedgerOptionsResponseDto>(resScheme2.Value);
            Assert.Equal(2, dto2.TotalAccountsCount);
            Assert.Equal(2, dto2.Customers.Count);
            Assert.DoesNotContain(dto2.Customers, c => c.CustomerID == 3);
        }

        [Fact]
        public async Task GetFdLedgerStatement_AllAccountsAndConsolidated_GroupsBySchemeAndBalancesAccurately()
        {
            await using var db = CreateContext();
            await SeedAsync(db);

            var ctrl = new ReportsController(db, new MemoryCache(new MemoryCacheOptions()));
            AttachUser(ctrl, BuildAdminPrincipal(1));

            var from = new DateTime(2026, 6, 1);
            var to = new DateTime(2026, 6, 30);

            // 1. All Customers + All Schemes -> Scheme-wise groups (प्रकारानुसार)
            var allRes = Assert.IsType<OkObjectResult>(await ctrl.GetFdLedgerStatement(branchID: 1, fdSchemeID: 0, customerID: null, fromDate: from, toDate: to));
            var allDto = Assert.IsType<FdLedgerStatementResponseDto>(allRes.Value);
            Assert.True(allDto.IsAllCustomers);
            Assert.Equal(4, allDto.TotalFDAccountsCount);
            Assert.Equal(2, allDto.SchemeGroups.Count);

            var regGroup = allDto.SchemeGroups.Single(g => g.FdSchemeID == 1);
            Assert.Equal(2, regGroup.AccountsCount);
            Assert.Equal(100000m, regGroup.Consolidated.OpeningBalance); // Account 101 opened before 01/06/2026
            Assert.Equal(52250m, regGroup.Consolidated.PeriodTotalCredit); // Account 102 opening (50,000) + Account 101 accrual (2,250)
            Assert.Equal(0m, regGroup.Consolidated.PeriodTotalDebit);
            Assert.Equal(152250m, regGroup.Consolidated.ClosingBalance);
            Assert.Equal(2, regGroup.Consolidated.Transactions.Count);
            Assert.Equal(150000m, regGroup.Consolidated.Transactions[0].Balance); // 2026-06-05: 100,000 + 50,000
            Assert.Equal(152250m, regGroup.Consolidated.Transactions[1].Balance); // 2026-06-15: 150,000 + 2,250

            var dblGroup = allDto.SchemeGroups.Single(g => g.FdSchemeID == 2);
            Assert.Equal(2, dblGroup.AccountsCount);
            Assert.Equal(25000m, dblGroup.Consolidated.OpeningBalance); // Account 103 opened 2026-04-01
            Assert.Equal(75000m, dblGroup.Consolidated.PeriodTotalCredit); // Account 104 opened 2026-06-10
            Assert.Equal(100000m, dblGroup.Consolidated.ClosingBalance);

            // 2. Single Customer + Single Scheme (Customer 1, Scheme 1) -> Only 2 accounts, consolidated accurately
            var custRes = Assert.IsType<OkObjectResult>(await ctrl.GetFdLedgerStatement(branchID: 1, fdSchemeID: 1, customerID: 1, fromDate: from, toDate: to));
            var custDto = Assert.IsType<FdLedgerStatementResponseDto>(custRes.Value);
            Assert.False(custDto.IsAllCustomers);
            Assert.Equal(2, custDto.TotalFDAccountsCount);
            var singleSchemeGrp = Assert.Single(custDto.SchemeGroups);
            Assert.Equal(1, singleSchemeGrp.FdSchemeID);
            Assert.Equal(152250m, singleSchemeGrp.Consolidated.ClosingBalance);
        }
    }
}
