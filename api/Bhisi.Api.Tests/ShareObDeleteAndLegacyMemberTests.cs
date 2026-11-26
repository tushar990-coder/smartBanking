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
using Microsoft.Extensions.Caching.Memory;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class ShareObDeleteAndLegacyMemberTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"ShareObDelete_{Guid.NewGuid():N}")
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ClaimsPrincipal BuildAdminPrincipal(int branchId, DateTime bizDate)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, "1"),
                new Claim(ClaimTypes.Name, "admin"),
                new Claim(ClaimTypes.Role, "Admin"),
                new Claim("BranchID", branchId.ToString()),
                new Claim("DefaultBranchID", branchId.ToString()),
                new Claim("IsHeadOffice", "true"),
                new Claim("BusinessDate", bizDate.ToString("yyyy-MM-dd"))
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

        private static async Task SeedShareEnvironmentAsync(AppDbContext db, DateTime bizDate)
        {
            db.Branches.Add(new Branch
            {
                BranchID = 1,
                BranchCode = "HO",
                BranchName = "मुख्य शाखा",
                BranchType = "HeadOffice",
                DefaultCashLedgerID = 10,
                IsActive = true
            });

            db.BranchDayEndStatuses.Add(new BranchDayEndStatus
            {
                BranchID = 1,
                BusinessDate = bizDate.Date,
                IsDayClosed = false
            });

            db.AccountGroups.AddRange(
                new AccountGroup { GroupID = 1, GroupName = "भाग भांडवल व निधी", NatureOfGroup = "Liabilities", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "मालमत्ता व येणी", NatureOfGroup = "Assets", DisplayOrder = 2, IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 1, GroupID = 1, LedgerCode = "1", LedgerName = "सभासद भाग भांडवल", AccountType = "Share Capital", ReportType = "Balance Sheet", IsActive = true },
                new Ledger { LedgerID = 2, GroupID = 1, LedgerCode = "2", LedgerName = "देणे लाभांश", AccountType = "Dividend Payable", ReportType = "Balance Sheet", IsActive = true },
                new Ledger { LedgerID = 10, GroupID = 2, LedgerCode = "10", LedgerName = "हातातील रोख शिल्लक", AccountType = "Cash In Hand", ReportType = "Balance Sheet", IsActive = true }
            );

            db.ShareSchemes.Add(new ShareScheme
            {
                ShareSchemeId = 1,
                SchemeCode = "SHR-REG-01",
                SchemeName = "नियमित सभासद शेअर योजना",
                MemberType = "Regular",
                ShareFaceValue = 100m,
                MinSharesCount = 1,
                MaxSharesCount = 5000,
                ShareCapitalLedgerID = 1,
                DividendPayableLedgerID = 2,
                IsActive = true
            });

            // CIF000004 (LegacyCustomerNo = 4): प्रकाश विठ्ठल काले
            // CIF000005 (LegacyCustomerNo = 5): नामदेव उद्धव पालवे
            db.Customers.AddRange(
                new Customer
                {
                    CustomerID = 4,
                    BranchID = 1,
                    CIFNo = "CIF000004",
                    LegacyCustomerNo = "4",
                    FirstName = "प्रकाश",
                    MiddleName = "विठ्ठल",
                    LastName = "काले",
                    BirthDate = new DateTime(1982, 5, 10)
                },
                new Customer
                {
                    CustomerID = 5,
                    BranchID = 1,
                    CIFNo = "CIF000005",
                    LegacyCustomerNo = "5",
                    FirstName = "नामदेव",
                    MiddleName = "उद्धव",
                    LastName = "पालवे",
                    BirthDate = new DateTime(1980, 3, 15)
                }
            );

            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task DeleteOpeningBalance_PhysicallyDeletesShareAccountCertTxnMob_AndZeroShareMember_FreeingLegacyMemberNoImmediately()
        {
            await using var db = CreateContext();
            var bizDate = new DateTime(2026, 4, 1);
            await SeedShareEnvironmentAsync(db, bizDate);

            var cache = new MemoryCache(new MemoryCacheOptions());
            var rollback = new VoucherRollbackAndDeleteService(db);
            var shareCtrl = new ShareAccountsController(db, rollback, cache);
            var custCtrl = new CustomersController(db, cache);
            var principal = BuildAdminPrincipal(branchId: 1, bizDate);
            AttachUser(shareCtrl, principal);
            AttachUser(custCtrl, principal);

            // 1. Create Share OB for Customer 5 (नामदेव उद्धव पालवे, CIF000005) with Old Member No = "5"
            var createRes = await shareCtrl.CreateOpeningBalance(new ShareAccountsController.ShareOpeningBalanceRequest
            {
                MemberId = 0,
                CustomerId = 5,
                ShareSchemeId = 1,
                LegacyMemberNo = "5",
                OpeningDate = new DateTime(2026, 3, 31),
                ShareQuantity = 10,
                FaceValue = 100m,
                DividendPayable = 100m,
                DividendPayableLedgerId = 2,
                FromShareNo = 1,
                ToShareNo = 10,
                CertificateNo = "CERT-0001",
                LedgerId = 1
            });
            Assert.IsType<OkObjectResult>(createRes);

            var createdAcc = await db.ShareAccounts.AsNoTracking().SingleAsync();
            var createdMember = await db.Members.AsNoTracking().SingleAsync();
            var createdCert = await db.ShareCertificates.AsNoTracking().SingleAsync();
            Assert.Equal("5", createdMember.LegacyMemberNo);

            // Attach certificate print history + DemandMemberDetail + AgentCustomerRequest to ensure all FKs unlink cleanly on delete
            db.ShareCertificatePrintHistories.Add(new ShareCertificatePrintHistory
            {
                CertificateId = createdCert.CertificateId,
                PrintedBy = 1,
                PrintedOn = bizDate,
                ActionType = "Print"
            });
            db.DemandNotices.Add(new DemandNotice
            {
                DemandNoticeId = 1,
                NoticeNumber = "DN-2026-04-01",
                BranchId = 1,
                EmployerId = 1,
                Month = 4,
                Year = 2026,
                DemandDate = bizDate,
                Status = "Pending"
            });
            db.DemandMemberDetails.Add(new DemandMemberDetail
            {
                DemandMemberDetailId = 1,
                DemandNoticeId = 1,
                CustomerId = 5,
                MemberId = createdMember.MemberID,
                TotalDeduction = 1000m
            });
            db.AgentCustomerRequests.Add(new AgentCustomerRequest
            {
                RequestID = 1,
                PigmyAgentID = 1,
                BranchID = 1,
                FirstName = "नामदेव",
                LastName = "पालवे",
                MobileNo = "9999999999",
                CreatedCustomerID = 5,
                CreatedMemberID = createdMember.MemberID,
                Status = "Approved"
            });
            await db.SaveChangesAsync();

            // Prime CustomersController cache while Customer 5 is an active shareholder
            var cachedBefore = (await custCtrl.GetCustomers()).Value!.ToList();
            Assert.Equal("5", cachedBefore.Single(c => c.CustomerID == 5).MemberProfile?.LegacyMemberNo);

            // 2. Delete Share OB for Customer 5 -> MUST physically purge ShareAccount, Cert, CertPrints, Txns, MOBs AND Member row!
            var delRes = await shareCtrl.DeleteOpeningBalance(createdAcc.ShareAccountId, null);
            Assert.IsType<OkObjectResult>(delRes);

            Assert.Empty(await db.ShareAccounts.AsNoTracking().ToListAsync());
            Assert.Empty(await db.ShareCertificates.AsNoTracking().ToListAsync());
            Assert.Empty(await db.ShareCertificatePrintHistories.AsNoTracking().ToListAsync());
            Assert.Empty(await db.ShareTransactions.AsNoTracking().ToListAsync());
            Assert.Empty(await db.MemberOpeningBalances.AsNoTracking().ToListAsync());
            Assert.Empty(await db.Members.AsNoTracking().ToListAsync()); // 0-share Member row 100% hard-deleted!

            // Customer 5, DemandMemberDetail (unlinked MemberId=null), and AgentCustomerRequest (CreatedMemberID=null) remain safe!
            Assert.Equal(2, await db.Customers.CountAsync());
            Assert.Null((await db.DemandMemberDetails.AsNoTracking().SingleAsync()).MemberId);
            Assert.Null((await db.AgentCustomerRequests.AsNoTracking().SingleAsync()).CreatedMemberID);

            // Cache was immediately invalidated: Customer 5 no longer has MemberProfile!
            var customersAfterDelete = (await custCtrl.GetCustomers()).Value!.ToList();
            Assert.Null(customersAfterDelete.Single(c => c.CustomerID == 5).MemberProfile);

            // 3. Re-use Old Member No = "5" on Customer 4 (प्रकाश विठ्ठल काले, CIF000004) even though Customer 5 has LegacyCustomerNo = "5"
            var reuseRes = await shareCtrl.CreateOpeningBalance(new ShareAccountsController.ShareOpeningBalanceRequest
            {
                MemberId = 0,
                CustomerId = 4,
                ShareSchemeId = 1,
                LegacyMemberNo = "5",
                OpeningDate = new DateTime(2026, 3, 31),
                ShareQuantity = 5,
                FaceValue = 100m,
                DividendPayable = 0m,
                FromShareNo = 1,
                ToShareNo = 5,
                CertificateNo = "CERT-0001",
                LedgerId = 1
            });
            Assert.IsType<OkObjectResult>(reuseRes);

            var newMember = await db.Members.AsNoTracking().SingleAsync();
            Assert.Equal(4, newMember.CustomerID);
            Assert.Equal("5", newMember.LegacyMemberNo);
            Assert.Equal("MEM0005", newMember.MemberCode); // Aligned 1-to-1 with LegacyMemberNo = "5"
        }

        [Fact]
        public async Task CancelShareAllotmentVoucher_PhysicallyPurgesZeroShareAccount_AndOrphanMemberRow()
        {
            await using var db = CreateContext();
            var bizDate = new DateTime(2026, 4, 1);
            await SeedShareEnvironmentAsync(db, bizDate);

            // Seed a Member + ShareAccount + ShareCertificate + Pending Share Allotment Voucher for Customer 5 (Old Member No = "5")
            var member = new Member
            {
                MemberID = 10,
                BranchID = 1,
                CustomerID = 5,
                MemberCode = "MEM0005",
                LegacyMemberNo = "5",
                MembershipType = "Regular",
                Status = "Active"
            };
            db.Members.Add(member);

            var shareAcc = new ShareAccount
            {
                ShareAccountId = 20,
                MemberId = 10,
                CustomerID = 5,
                AccountNo = "SA-MEM0005",
                TotalShareCount = 5,
                TotalShareAmount = 500m,
                OpeningDate = bizDate,
                Status = "Active"
            };
            db.ShareAccounts.Add(shareAcc);

            var vch = new Voucher
            {
                VoucherID = 30,
                BranchID = 1,
                VoucherNo = "VCH-SHR-20260401-0001",
                VoucherDate = bizDate,
                VoucherType = "Receipt",
                TotalAmount = 500m,
                Status = "Pending",
                Narration = "Share Allotment",
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { LedgerID = 10, DrCr = "Dr", Amount = 500m },
                    new VoucherDetail { LedgerID = 1, DrCr = "Cr", Amount = 500m, CustomerID = 5, MemberID = 10 }
                }
            };
            db.Vouchers.Add(vch);

            db.ShareCertificates.Add(new ShareCertificate
            {
                CertificateId = 40,
                ShareAccountId = 20,
                CustomerID = 5,
                CertificateNo = "CERT-0005",
                NumberOfShares = 5,
                FaceValue = 100m,
                FromShareNo = 1,
                ToShareNo = 5,
                IssueDate = bizDate,
                Status = "PendingApproval"
            });

            db.ShareTransactions.Add(new ShareTransaction
            {
                TransactionId = 50,
                ShareAccountId = 20,
                CustomerID = 5,
                VoucherId = 30,
                TransactionDate = bizDate,
                TransactionType = "Allotment",
                NumberOfShares = 5,
                Amount = 500m,
                Narration = "Allotment Cert CERT-0005"
            });

            await db.SaveChangesAsync();

            var rollback = new VoucherRollbackAndDeleteService(db);
            var delRes = await rollback.DeleteVoucherWithRollbackAsync(30, new VoucherDeleteRequestContext
            {
                UserId = 1,
                Username = "admin",
                UserRole = "Admin",
                UserBranchId = 1,
                IsHeadOfficeAdmin = true,
                Reason = "Delete wrong share allotment entry",
                ActionSource = "VOUCHER_DELETED",
                RequireMinTenCharReason = true
            });

            Assert.True(delRes.Success, delRes.Message);
            Assert.Empty(await db.Vouchers.AsNoTracking().ToListAsync());
            Assert.Empty(await db.ShareTransactions.AsNoTracking().ToListAsync());
            Assert.Empty(await db.ShareCertificates.AsNoTracking().ToListAsync());
            Assert.Empty(await db.ShareAccounts.AsNoTracking().ToListAsync()); // 0-share ShareAccount physically deleted!
            Assert.Empty(await db.Members.AsNoTracking().ToListAsync());       // 0-share Member (LegacyMemberNo="5") physically deleted!
        }
    }
}
