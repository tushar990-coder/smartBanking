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
using Xunit;

namespace Bhisi.Api.Tests
{
    public class PigmyClosureAccountSearchTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"PigmyClosureSearchTests_{Guid.NewGuid():N}")
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static void AttachUser(ControllerBase controller, int branchId, bool isHeadOffice)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, "1"),
                new Claim(ClaimTypes.Name, isHeadOffice ? "ho_admin" : "branch_clerk"),
                new Claim(ClaimTypes.Role, isHeadOffice ? "Admin" : "Clerk"),
                new Claim("BranchID", branchId.ToString()),
                new Claim("DefaultBranchID", branchId.ToString()),
                new Claim("IsHeadOffice", isHeadOffice ? "true" : "false")
            };
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestJwt")) }
            };
        }

        private static async Task SeedPigmyDataAsync(AppDbContext db)
        {
            db.Branches.AddRange(
                new Branch { BranchID = 1, BranchCode = "001", BranchName = "मुख्य शाखा", IsActive = true },
                new Branch { BranchID = 2, BranchCode = "002", BranchName = "शाखा २", IsActive = true }
            );

            db.PigmySchemes.Add(new PigmyScheme
            {
                PigmySchemeID = 1,
                SchemeCode = "301",
                SchemeName = "दैनिक पिग्मी ठेव",
                InterestRate = 6.5m,
                DurationMonths = 12,
                Status = "Active"
            });

            db.PigmyAgents.Add(new PigmyAgent
            {
                PigmyAgentID = 1,
                AgentName = "संतोष शिंदे",
                Username = "agt01",
                BranchID = 1,
                Status = "Active"
            });

            db.Customers.AddRange(
                new Customer
                {
                    CustomerID = 101,
                    BranchID = 1,
                    CIFNo = "CIF000101",
                    FirstName = "प्रशांत",
                    MiddleName = "संपतराव",
                    LastName = "जाधव",
                    FirstNameEng = "Prashant",
                    MiddleNameEng = "Sampatrao",
                    LastNameEng = "Jadhav",
                    MobileNo = "9822000101"
                },
                new Customer
                {
                    CustomerID = 102,
                    BranchID = 1,
                    CIFNo = "CIF000102",
                    FirstName = "सुनीता",
                    MiddleName = "राजाराम",
                    LastName = "पाटील",
                    FirstNameEng = "Sunita",
                    LastNameEng = "Patil",
                    MobileNo = "9822000102"
                },
                new Customer
                {
                    CustomerID = 201,
                    BranchID = 2,
                    CIFNo = "CIF000201",
                    FirstName = "गणेश",
                    LastName = "कुलकर्णी",
                    FirstNameEng = "Ganesh",
                    MobileNo = "9822000201"
                }
            );

            db.PigmyAccounts.AddRange(
                new PigmyAccount
                {
                    PigmyAccountID = 1,
                    BranchID = 1,
                    CustomerID = 101,
                    PigmySchemeID = 1,
                    PigmyAgentID = 1,
                    AccountNo = "00130100001054",
                    LegacyAccountNumber = "105",
                    OpeningDate = DateTime.Today.AddMonths(-6),
                    MaturityDate = DateTime.Today.AddMonths(6),
                    TotalDepositedAmount = 12500m,
                    Status = "Active"
                },
                new PigmyAccount
                {
                    PigmyAccountID = 2,
                    BranchID = 1,
                    CustomerID = 102,
                    PigmySchemeID = 1,
                    PigmyAgentID = 1,
                    AccountNo = "00130100001062",
                    LegacyAccountNumber = "106",
                    OpeningDate = DateTime.Today.AddMonths(-14),
                    MaturityDate = DateTime.Today.AddMonths(-2),
                    TotalDepositedAmount = 24000m,
                    Status = "Matured"
                },
                new PigmyAccount
                {
                    PigmyAccountID = 3,
                    BranchID = 1,
                    CustomerID = 102,
                    PigmySchemeID = 1,
                    PigmyAgentID = 1,
                    AccountNo = "00130100001070",
                    LegacyAccountNumber = "107",
                    OpeningDate = DateTime.Today.AddMonths(-18),
                    MaturityDate = DateTime.Today.AddMonths(-6),
                    TotalDepositedAmount = 0m,
                    Status = "Closed"
                },
                new PigmyAccount
                {
                    PigmyAccountID = 4,
                    BranchID = 2,
                    CustomerID = 201,
                    PigmySchemeID = 1,
                    PigmyAgentID = 1,
                    AccountNo = "00230100000011",
                    LegacyAccountNumber = "201",
                    OpeningDate = DateTime.Today.AddMonths(-3),
                    MaturityDate = DateTime.Today.AddMonths(9),
                    TotalDepositedAmount = 5000m,
                    Status = "Active"
                }
            );

            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task GetPigmyAccounts_WithExcludeClosedAndSearch_ReturnsOnlyActiveAndMatured_MatchesMiddleAndEnglishNameAndBranchScope()
        {
            await using var db = CreateContext();
            await SeedPigmyDataAsync(db);

            var controller = new PigmyAccountsController(db);
            // Branch 1 user even requesting branchId=2 must only see Branch 1 active/matured accounts
            AttachUser(controller, branchId: 1, isHeadOffice: false);

            var allNonClosedRes = await controller.GetPigmyAccounts(
                agentId: null, branchId: 2, customerId: null, status: null,
                search: null, sortOrder: "asc", excludeClosed: true);

            var list = Assert.IsAssignableFrom<IEnumerable<PigmyAccount>>(allNonClosedRes.Value).ToList();
            Assert.Equal(2, list.Count); // Closed ID 3 & Branch-2 ID 4 excluded!
            Assert.DoesNotContain(list, a => a.Status == "Closed" || a.BranchID == 2);

            // Search by MiddleName ("संपतराव")
            var midSearchRes = await controller.GetPigmyAccounts(
                agentId: null, branchId: null, customerId: null, status: null,
                search: "संपतराव", sortOrder: "asc", excludeClosed: true);
            var midList = Assert.IsAssignableFrom<IEnumerable<PigmyAccount>>(midSearchRes.Value).ToList();
            Assert.Single(midList);
            Assert.Equal("00130100001054", midList[0].AccountNo);

            // Search by English name ("Prashant")
            var engSearchRes = await controller.GetPigmyAccounts(
                agentId: null, branchId: null, customerId: null, status: null,
                search: "Prashant", sortOrder: "asc", excludeClosed: true);
            var engList = Assert.IsAssignableFrom<IEnumerable<PigmyAccount>>(engSearchRes.Value).ToList();
            Assert.Single(engList);
            Assert.Equal("105", engList[0].LegacyAccountNumber);
        }

        [Fact]
        public async Task PreviewClosureAndWithdrawal_ReturnsFullCustomerNameIncludingMiddleName()
        {
            await using var db = CreateContext();
            await SeedPigmyDataAsync(db);

            var controller = new PigmyClosureController(db);
            AttachUser(controller, branchId: 1, isHeadOffice: true);

            var closureRes = await controller.PreviewClosure("105", branchId: 1);
            var closureOk = Assert.IsType<OkObjectResult>(closureRes.Result);
            var closureDto = Assert.IsType<PigmyClosureController.ClosurePreviewResult>(closureOk.Value);
            Assert.Equal("प्रशांत संपतराव जाधव", closureDto.CustomerName);
            Assert.Equal("प्रशांत संपतराव जाधव", closureDto.MemberName);

            var withdrawRes = await controller.PreviewWithdrawal("00130100001054", amount: 5000m, branchId: 1);
            var withdrawOk = Assert.IsType<OkObjectResult>(withdrawRes.Result);
            var withdrawDto = Assert.IsType<PigmyClosureController.WithdrawalPreviewResult>(withdrawOk.Value);
            Assert.Equal("प्रशांत संपतराव जाधव", withdrawDto.CustomerName);
            Assert.Equal("प्रशांत संपतराव जाधव", withdrawDto.MemberName);
        }
    }
}
