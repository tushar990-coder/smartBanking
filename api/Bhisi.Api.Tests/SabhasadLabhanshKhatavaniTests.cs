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
    public class SabhasadLabhanshKhatavaniTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase($"BhisiDividendKhatavani_{Guid.NewGuid()}")
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
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

        private static ReportsController CreateController(AppDbContext db, string role = "SuperAdmin", int branchId = 1)
        {
            var cache = new MemoryCache(new MemoryCacheOptions());
            var controller = new ReportsController(db, cache);
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = BuildPrincipal(1, "tester", role, branchId)
                }
            };
            return controller;
        }

        private static async Task SeedBaseLedgersAndBranchesAsync(AppDbContext db)
        {
            db.Branches.AddRange(
                new Branch { BranchID = 1, BranchCode = "MAIN", BranchName = "मुख्य शाखा", IsActive = true },
                new Branch { BranchID = 2, BranchCode = "BR2", BranchName = "इस्लामपूर शाखा", IsActive = true }
            );

            db.SansthaDetails.Add(new SansthaDetail
            {
                SansthaID = 1,
                SansthaName = "श्री समर्थ सहकारी पतसंस्था मर्यादित",
                RegistrationNo = "REG-101"
            });

            db.AccountGroups.AddRange(
                new AccountGroup { GroupID = 1, GroupName = "रोख व बँक", NatureOfGroup = "Assets", IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "इतर देयता", NatureOfGroup = "Liabilities", IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 10, GroupID = 1, LedgerCode = "CASH", LedgerName = "रोख शिल्लक", AccountType = "Cash", OpeningBalanceType = "Dr", IsActive = true },
                new Ledger { LedgerID = 20, GroupID = 2, LedgerCode = "DIVPAY", LedgerName = "देणे लाभांश खाते", AccountType = "Dividend Payable", OpeningBalanceType = "Cr", IsActive = true },
                new Ledger { LedgerID = 30, GroupID = 2, LedgerCode = "PROFIT", LedgerName = "नफा वाटप खाते", AccountType = "GL", OpeningBalanceType = "Cr", IsActive = true }
            );

            db.ShareSchemes.Add(new ShareScheme
            {
                ShareSchemeId = 1,
                SchemeCode = "SH-01",
                SchemeName = "सामान्य सभासद शेअर्स",
                DividendPayableLedgerID = 20,
                IsActive = true
            });

            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task Khatavani_CalculatesOpening_RunningBalance_Enrichment_AndMatchesBalancesList()
        {
            using var db = CreateContext();
            await SeedBaseLedgersAndBranchesAsync(db);

            db.Customers.Add(new Customer
            {
                CustomerID = 101,
                BranchID = 1,
                CIFNo = "CIF00101",
                FirstName = "रमेश",
                MiddleName = "पांडुरंग",
                LastName = "पाटील",
                MobileNo = "9876543210",
                Village = "सांगली"
            });

            db.Members.Add(new Member
            {
                MemberID = 11,
                CustomerID = 101,
                BranchID = 1,
                MemberCode = "MEM-0011",
                LegacyMemberNo = "45",
                Status = "Active"
            });

            db.ShareAccounts.Add(new ShareAccount
            {
                ShareAccountId = 51,
                MemberId = 11,
                CustomerID = 101,
                AccountNo = "SH-00051",
                TotalShareCount = 50,
                TotalShareAmount = 5000m,
                DividendPayableBalance = 500m,
                Status = "Active"
            });

            db.MemberOpeningBalances.Add(new MemberOpeningBalance
            {
                MemberOpeningBalanceID = 1,
                MemberID = 11,
                CustomerID = 101,
                LedgerID = 20,
                Amount = 500m,
                BalanceType = "Cr"
            });

            // Pre-period Approved Dividend Credit (+200) => Opening on 2026-04-01 should be 700 Cr
            db.Vouchers.Add(new Voucher
            {
                VoucherID = 1001,
                BranchID = 1,
                VoucherNo = "JV-DIV-PREV",
                VoucherDate = new DateTime(2026, 3, 25),
                VoucherType = "Journal",
                Narration = "मागील वर्षाचा लाभांश जमा",
                TotalAmount = 200m,
                Status = "Approved",
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { VoucherDetailID = 1, LedgerID = 30, DrCr = "Dr", Amount = 200m },
                    new VoucherDetail { VoucherDetailID = 2, LedgerID = 20, CustomerID = 101, MemberID = 11, DrCr = "Cr", Amount = 200m }
                }
            });

            // Period Approved Dividend Credit (+350) linked to DividendDistribution (FY 2025-26 @ 12%)
            db.Vouchers.Add(new Voucher
            {
                VoucherID = 1002,
                BranchID = 1,
                VoucherNo = "JV-DIV-2026-01",
                VoucherDate = new DateTime(2026, 5, 10),
                VoucherType = "Journal",
                Narration = "वार्षिक सभासद लाभांश जमा",
                TotalAmount = 350m,
                Status = "Approved",
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { VoucherDetailID = 3, LedgerID = 30, DrCr = "Dr", Amount = 350m },
                    new VoucherDetail { VoucherDetailID = 4, LedgerID = 20, CustomerID = 101, MemberID = 11, DrCr = "Cr", Amount = 350m }
                }
            });

            db.DividendDistributions.Add(new DividendDistribution
            {
                DividendId = 1,
                ShareAccountId = 51,
                FinancialYear = "2025-26",
                DividendPercentage = 12.00m,
                DividendAmount = 350m,
                PayoutDate = new DateTime(2026, 5, 10),
                IsPaid = false,
                VoucherId = 1002
            });

            // Period Approved Cash Payout (-400) => Running 1050 - 400 = 650 Cr
            db.Vouchers.Add(new Voucher
            {
                VoucherID = 1003,
                BranchID = 1,
                VoucherNo = "PAY-DIV-2026-01",
                VoucherDate = new DateTime(2026, 6, 15),
                VoucherType = "Payment",
                Narration = "सभासद लाभांश रोख वाटप",
                TotalAmount = 400m,
                Status = "Approved",
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { VoucherDetailID = 5, LedgerID = 20, CustomerID = 101, MemberID = 11, DrCr = "Dr", Amount = 400m },
                    new VoucherDetail { VoucherDetailID = 6, LedgerID = 10, DrCr = "Cr", Amount = 400m }
                }
            });

            // Pending & Rejected vouchers MUST be excluded
            db.Vouchers.Add(new Voucher
            {
                VoucherID = 1004,
                BranchID = 1,
                VoucherNo = "PAY-DIV-PEND",
                VoucherDate = new DateTime(2026, 6, 20),
                VoucherType = "Payment",
                Narration = "प्रलंबित लाभांश वाटप",
                TotalAmount = 999m,
                Status = "Pending",
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { VoucherDetailID = 7, LedgerID = 20, CustomerID = 101, MemberID = 11, DrCr = "Dr", Amount = 999m },
                    new VoucherDetail { VoucherDetailID = 8, LedgerID = 10, DrCr = "Cr", Amount = 999m }
                }
            });

            db.Vouchers.Add(new Voucher
            {
                VoucherID = 1005,
                BranchID = 1,
                VoucherNo = "PAY-DIV-REJ",
                VoucherDate = new DateTime(2026, 6, 21),
                VoucherType = "Payment",
                Narration = "रद्द लाभांश वाटप",
                TotalAmount = 888m,
                Status = "Rejected",
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { VoucherDetailID = 9, LedgerID = 20, CustomerID = 101, MemberID = 11, DrCr = "Dr", Amount = 888m },
                    new VoucherDetail { VoucherDetailID = 10, LedgerID = 10, DrCr = "Cr", Amount = 888m }
                }
            });

            await db.SaveChangesAsync();

            var controller = CreateController(db, "SuperAdmin", 1);

            var khatavaniAction = await controller.GetSabhasadLabhanshKhatavani(
                memberId: 11,
                customerId: null,
                ledgerId: null, // Verify auto-resolution via ShareScheme.DividendPayableLedgerID
                fromDate: new DateTime(2026, 4, 1),
                toDate: new DateTime(2026, 6, 30),
                branchId: 1);

            var ok = Assert.IsType<OkObjectResult>(khatavaniAction.Result);
            var report = Assert.IsType<DividendKhatavaniReportDto>(ok.Value);

            Assert.Equal(20, report.LedgerID);
            Assert.Equal("MEM-0011", report.MemberNo);
            Assert.Equal("45", report.LegacyMemberNo);
            Assert.Equal(50, report.TotalShareCount);
            Assert.Equal(5000m, report.TotalShareCapital);

            Assert.Equal(700m, report.OpeningBalance);
            Assert.Equal("Cr", report.OpeningBalanceType);
            Assert.Equal("MemberOpeningBalance", report.OpeningBalanceSource);

            Assert.Equal(2, report.Transactions.Count);
            Assert.Equal(350m, report.Transactions[0].CreditAmount);
            Assert.Equal(1050m, report.Transactions[0].RunningBalance);
            Assert.Equal("2025-26", report.Transactions[0].FinancialYear);
            Assert.Equal(12.00m, report.Transactions[0].DividendPercentage);

            Assert.Equal(400m, report.Transactions[1].DebitAmount);
            Assert.Equal(650m, report.Transactions[1].RunningBalance);
            Assert.Equal("रोख (Cash)", report.Transactions[1].PaymentMode);

            Assert.Equal(400m, report.TotalDebit);
            Assert.Equal(350m, report.TotalCredit);
            Assert.Equal(650m, report.ClosingBalance);
            Assert.Equal("Cr", report.ClosingBalanceType);

            // Cross-reconcile with Sabhasad Labhansh List (member-ledger-balances)
            var listAction = await controller.GetMemberLedgerBalances(20, new DateTime(2026, 6, 30), 1);
            var listOk = Assert.IsType<OkObjectResult>(listAction.Result);
            var listDto = Assert.IsType<MemberLedgerBalanceReportDto>(listOk.Value);
            var memberRow = Assert.Single(listDto.Rows);
            Assert.Equal(report.ClosingBalance, memberRow.Balance);
            Assert.Equal("45", memberRow.LegacyMemberNo);
        }

        [Fact]
        public async Task Khatavani_DoesNotDoubleCount_OpeningMigrationVoucher_WhenBaseObExists()
        {
            using var db = CreateContext();
            await SeedBaseLedgersAndBranchesAsync(db);

            db.Customers.Add(new Customer { CustomerID = 201, BranchID = 1, CIFNo = "CIF201", FirstName = "सुनील", LastName = "जोशी" });
            db.Members.Add(new Member { MemberID = 21, CustomerID = 201, BranchID = 1, MemberCode = "MEM-21", Status = "Active" });

            db.MemberOpeningBalances.Add(new MemberOpeningBalance
            {
                MemberOpeningBalanceID = 10,
                MemberID = 21,
                CustomerID = 201,
                LedgerID = 20,
                Amount = 1000m,
                BalanceType = "Cr"
            });

            // Opening balance migration voucher for the same ₹1000 MUST NOT double-count
            db.Vouchers.Add(new Voucher
            {
                VoucherID = 2001,
                BranchID = 1,
                VoucherNo = "JV-DIV-OP-001",
                VoucherDate = new DateTime(2026, 3, 31),
                VoucherType = "Opening",
                Narration = "लाभांश आरंभिक शिल्लक",
                TotalAmount = 1000m,
                Status = "Approved",
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { VoucherDetailID = 21, LedgerID = 30, DrCr = "Dr", Amount = 1000m },
                    new VoucherDetail { VoucherDetailID = 22, LedgerID = 20, CustomerID = 201, MemberID = 21, DrCr = "Cr", Amount = 1000m }
                }
            });

            await db.SaveChangesAsync();

            var controller = CreateController(db);
            var action = await controller.GetSabhasadLabhanshKhatavani(
                memberId: 21,
                ledgerId: 20,
                fromDate: new DateTime(2026, 4, 1),
                toDate: new DateTime(2026, 6, 30),
                branchId: 1);

            var ok = Assert.IsType<OkObjectResult>(action.Result);
            var report = Assert.IsType<DividendKhatavaniReportDto>(ok.Value);

            Assert.Equal(1000m, report.OpeningBalance);
            Assert.Equal(1000m, report.ClosingBalance);
            Assert.Empty(report.Transactions);
        }

        [Fact]
        public async Task Khatavani_EnforcesBranchIsolation_ForBranchUser_AndAllowsSuperAdmin()
        {
            using var db = CreateContext();
            await SeedBaseLedgersAndBranchesAsync(db);

            db.Customers.Add(new Customer { CustomerID = 301, BranchID = 2, CIFNo = "CIF301", FirstName = "विजय", LastName = "कदम" });
            db.Members.Add(new Member { MemberID = 31, CustomerID = 301, BranchID = 2, MemberCode = "MEM-31", Status = "Active" });
            db.MemberOpeningBalances.Add(new MemberOpeningBalance
            {
                MemberOpeningBalanceID = 30,
                MemberID = 31,
                CustomerID = 301,
                LedgerID = 20,
                Amount = 250m,
                BalanceType = "Cr"
            });

            await db.SaveChangesAsync();

            // Branch 1 Clerk requesting Branch 2 member => Forbid
            var branchClerkController = CreateController(db, role: "Clerk", branchId: 1);
            var forbidden = await branchClerkController.GetSabhasadLabhanshKhatavani(
                memberId: 31,
                ledgerId: 20,
                fromDate: new DateTime(2026, 4, 1),
                toDate: new DateTime(2026, 6, 30),
                branchId: 2);
            Assert.IsType<ForbidResult>(forbidden.Result);

            // SuperAdmin requesting Branch 2 member => Allowed
            var superAdminController = CreateController(db, role: "SuperAdmin", branchId: 1);
            var allowed = await superAdminController.GetSabhasadLabhanshKhatavani(
                memberId: 31,
                ledgerId: 20,
                fromDate: new DateTime(2026, 4, 1),
                toDate: new DateTime(2026, 6, 30),
                branchId: 2);
            var ok = Assert.IsType<OkObjectResult>(allowed.Result);
            var dto = Assert.IsType<DividendKhatavaniReportDto>(ok.Value);
            Assert.Equal(250m, dto.ClosingBalance);
            Assert.Equal("इस्लामपूर शाखा", dto.BranchName);
        }

        [Fact]
        public async Task Khatavani_SupportsCustomerIdFirst_AndCustomerOpeningBalanceFallback()
        {
            using var db = CreateContext();
            await SeedBaseLedgersAndBranchesAsync(db);

            db.Customers.Add(new Customer { CustomerID = 401, BranchID = 1, CIFNo = "CIF401", FirstName = "आशा", LastName = "कुलकर्णी" });
            db.CustomerOpeningBalances.Add(new CustomerOpeningBalance
            {
                CustomerOpeningBalanceID = 41,
                CustomerID = 401,
                LedgerID = 20,
                Amount = 300m,
                BalanceType = "Cr",
                SourceModule = "CustomerOpeningBalance"
            });

            db.Vouchers.Add(new Voucher
            {
                VoucherID = 4001,
                BranchID = 1,
                VoucherNo = "PAY-401",
                VoucherDate = new DateTime(2026, 5, 1),
                VoucherType = "Payment",
                Narration = "लाभांश वाटप",
                TotalAmount = 100m,
                Status = "Approved",
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { VoucherDetailID = 41, LedgerID = 20, CustomerID = 401, MemberID = null, DrCr = "Dr", Amount = 100m },
                    new VoucherDetail { VoucherDetailID = 42, LedgerID = 10, DrCr = "Cr", Amount = 100m }
                }
            });

            await db.SaveChangesAsync();

            var controller = CreateController(db);
            var action = await controller.GetSabhasadLabhanshKhatavani(
                memberId: null,
                customerId: 401,
                ledgerId: null,
                fromDate: new DateTime(2026, 4, 1),
                toDate: new DateTime(2026, 5, 31));

            var ok = Assert.IsType<OkObjectResult>(action.Result);
            var dto = Assert.IsType<DividendKhatavaniReportDto>(ok.Value);

            Assert.Equal("CustomerOpeningBalance", dto.OpeningBalanceSource);
            Assert.Equal(300m, dto.OpeningBalance);
            Assert.Equal(100m, dto.TotalDebit);
            Assert.Equal(200m, dto.ClosingBalance);
            Assert.Equal("CIF401", dto.CIFNo);
        }

        [Fact]
        public async Task Khatavani_RejectsMissingParty_AndInvalidDateRange()
        {
            using var db = CreateContext();
            await SeedBaseLedgersAndBranchesAsync(db);
            db.Customers.Add(new Customer { CustomerID = 501, BranchID = 1, CIFNo = "CIF501", FirstName = "राजेश", LastName = "मोरे" });
            await db.SaveChangesAsync();

            var controller = CreateController(db);

            var missingParty = await controller.GetSabhasadLabhanshKhatavani(memberId: null, customerId: null);
            Assert.IsType<BadRequestObjectResult>(missingParty.Result);

            var badDates = await controller.GetSabhasadLabhanshKhatavani(
                customerId: 501,
                ledgerId: 20,
                fromDate: new DateTime(2026, 6, 1),
                toDate: new DateTime(2026, 5, 1));
            Assert.IsType<BadRequestObjectResult>(badDates.Result);
        }
    }
}
