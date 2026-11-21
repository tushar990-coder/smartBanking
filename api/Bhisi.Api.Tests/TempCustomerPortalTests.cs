using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Bhisi.Api.Controllers;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class TempCustomerPortalTests
    {
        private static AppDbContext GetInMemoryDbContext(string dbName)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: dbName)
                .ConfigureWarnings(x => x.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static IConfiguration BuildJwtConfig()
        {
            return new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Jwt:Key"] = "SuperSecretUnitTestingJwtKeyForBhisiApi32PlusChars!",
                    ["Jwt:ExpireDays"] = "1"
                })
                .Build();
        }

        private static ControllerContext BuildCustomerContext(int customerId, int branchId = 1)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, customerId.ToString()),
                new Claim("CustomerId", customerId.ToString()),
                new Claim(ClaimTypes.Role, "CUSTOMER"),
                new Claim("BranchID", branchId.ToString()),
                new Claim("DefaultBranchID", branchId.ToString())
            };
            return new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"))
                }
            };
        }

        [Fact]
        public async Task CustomerTempPinActivationAndLogin_ShouldIssueJwtAndLockAfter5Failures()
        {
            using var context = GetInMemoryDbContext(nameof(CustomerTempPinActivationAndLogin_ShouldIssueJwtAndLockAfter5Failures));
            context.Branches.Add(new Branch { BranchID = 1, BranchName = "Main Branch", IsActive = true });
            context.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "2026-2027",
                IsActive = true,
                StartDate = new DateTime(2026, 4, 1),
                EndDate = new DateTime(2027, 3, 31)
            });
            context.Customers.Add(new Customer
            {
                CustomerID = 11,
                BranchID = 1,
                CIFNo = "CIF-0011",
                FirstName = "Ramesh",
                LastName = "Patil",
                MobileNo = "9876543211",
                Status = "Active"
            });
            await context.SaveChangesAsync();

            var authController = new AuthController(context, BuildJwtConfig());

            // 1. Activate temporary PIN via Mobile (+91/format variations) + CIF (without hyphen)
            var actRes = await authController.ActivateCustomerTempPin(new CustomerTempActivatePinDto
            {
                MobileNo = "+919876543211",
                CifNo = "cif0011",
                NewPin = "1234"
            });
            var okAct = Assert.IsType<OkObjectResult>(actRes.Result);
            var actDto = Assert.IsType<LoginResponseDto>(okAct.Value);
            Assert.Equal("CUSTOMER", actDto.Role);
            Assert.Equal(11, actDto.CustomerId);
            Assert.False(string.IsNullOrWhiteSpace(actDto.Token));

            // 2. Subsequent login with LoginAs="CUSTOMER" works
            var loginRes = await authController.Login(new LoginRequestDto
            {
                Username = "9876543211",
                Password = "1234",
                LoginAs = "CUSTOMER"
            });
            var okLogin = Assert.IsType<OkObjectResult>(loginRes.Result);
            var loginDto = Assert.IsType<LoginResponseDto>(okLogin.Value);
            Assert.Equal("CUSTOMER", loginDto.Role);
            Assert.Equal(11, loginDto.CustomerId);

            // 3. Five wrong mPIN attempts lock portal access
            for (int i = 0; i < 5; i++)
            {
                var bad = await authController.Login(new LoginRequestDto
                {
                    Username = "9876543211",
                    Password = "9999",
                    LoginAs = "CUSTOMER"
                });
                Assert.IsType<UnauthorizedObjectResult>(bad.Result);
            }

            var lockedCust = await context.Customers.FindAsync(11);
            Assert.True(lockedCust!.IsPortalLocked);

            var lockedLogin = await authController.Login(new LoginRequestDto
            {
                Username = "9876543211",
                Password = "1234",
                LoginAs = "CUSTOMER"
            });
            Assert.IsType<UnauthorizedObjectResult>(lockedLogin.Result);
        }

        [Fact]
        public async Task CustomerPortalController_EnforcesOwnCustomerIdAndReturnsAllAccounts()
        {
            using var context = GetInMemoryDbContext(nameof(CustomerPortalController_EnforcesOwnCustomerIdAndReturnsAllAccounts));
            context.Branches.Add(new Branch { BranchID = 1, BranchName = "Main Branch" });
            context.Customers.AddRange(
                new Customer { CustomerID = 1, BranchID = 1, CIFNo = "CIF-1", FirstName = "Asha", LastName = "More", MobileNo = "9111111111", Status = "Active" },
                new Customer { CustomerID = 2, BranchID = 1, CIFNo = "CIF-2", FirstName = "Vijay", LastName = "Kadam", MobileNo = "9222222222", Status = "Active" }
            );
            context.PigmySchemes.Add(new PigmyScheme { PigmySchemeID = 1, SchemeName = "Daily Pigmy" });
            context.PigmyAgents.Add(new PigmyAgent { PigmyAgentID = 1, AgentName = "Agent One", BranchID = 1 });
            context.PigmyAccounts.AddRange(
                new PigmyAccount { PigmyAccountID = 10, CustomerID = 1, BranchID = 1, PigmySchemeID = 1, PigmyAgentID = 1, AccountNo = "PG-10", TotalDepositedAmount = 2500m, DailyDepositAmount = 100m, Status = "Active" },
                new PigmyAccount { PigmyAccountID = 20, CustomerID = 2, BranchID = 1, PigmySchemeID = 1, PigmyAgentID = 1, AccountNo = "PG-20", TotalDepositedAmount = 9999m, DailyDepositAmount = 100m, Status = "Active" }
            );
            context.PigmyTransactions.Add(new PigmyTransaction
            {
                PigmyTransactionID = 1,
                PigmyAccountID = 10,
                ValueDate = new DateTime(2026, 11, 20),
                TransactionDate = new DateTime(2026, 11, 20),
                TransactionType = "DEPOSIT",
                CrAmount = 100m,
                BalanceAmount = 2500m,
                Narration = "Cash Deposit"
            });
            await context.SaveChangesAsync();

            var controller = new CustomerPortalController(context)
            {
                ControllerContext = BuildCustomerContext(customerId: 1)
            };

            var sumRes = await controller.GetSummary();
            Assert.IsType<OkObjectResult>(sumRes);

            // Customer 1 cannot read Customer 2's Pigmy account passbook
            var forbiddenPb = await controller.GetPassbook("PIGMY", 20);
            Assert.IsType<NotFoundObjectResult>(forbiddenPb);

            var ownPb = await controller.GetPassbook("PIGMY", 10);
            Assert.IsType<OkObjectResult>(ownPb);
        }

        [Fact]
        public async Task RoleBoundaryFilter_BlocksCustomerFromAgentAndCbsControllers_AndBlocksAgentFromCbsControllers()
        {
            var filter = new Bhisi.Api.Filters.EnforceRoleBoundaryAttribute();

            static Microsoft.AspNetCore.Mvc.Filters.ActionExecutingContext MakeCtx(string role, string controllerName, string actionName, int id = 1)
            {
                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.NameIdentifier, id.ToString()),
                    new Claim(ClaimTypes.Role, role)
                };
                if (role == "AGENT") claims.Add(new Claim("agentId", id.ToString()));
                if (role == "CUSTOMER") claims.Add(new Claim("CustomerId", id.ToString()));

                var http = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"))
                };
                http.Request.Method = "GET";

                var cad = new Microsoft.AspNetCore.Mvc.Controllers.ControllerActionDescriptor
                {
                    ControllerName = controllerName,
                    ActionName = actionName
                };
                var actionCtx = new ActionContext(http, new Microsoft.AspNetCore.Routing.RouteData(), cad);
                return new Microsoft.AspNetCore.Mvc.Filters.ActionExecutingContext(
                    actionCtx,
                    new List<Microsoft.AspNetCore.Mvc.Filters.IFilterMetadata>(),
                    new Dictionary<string, object?>(),
                    new object());
            }

            // 1. CUSTOMER blocked from PigmyMobileApi, PigmyApp, and Ledgers
            var c1 = MakeCtx("CUSTOMER", "PigmyMobileApi", "GetCustomers");
            filter.OnActionExecuting(c1);
            Assert.IsType<ForbidResult>(c1.Result);

            var c2 = MakeCtx("CUSTOMER", "Ledgers", "GetLedgers");
            filter.OnActionExecuting(c2);
            Assert.IsType<ForbidResult>(c2.Result);

            // CUSTOMER allowed on CustomerPortal
            var cOk = MakeCtx("CUSTOMER", "CustomerPortal", "GetSummary");
            filter.OnActionExecuting(cOk);
            Assert.Null(cOk.Result);

            // 2. AGENT blocked from internal CBS Ledgers & PigmyAccounts.ClearAllPigmyData, allowed on PigmyMobileApi
            var a1 = MakeCtx("AGENT", "Ledgers", "GetLedgers");
            filter.OnActionExecuting(a1);
            Assert.IsType<ForbidResult>(a1.Result);

            var a2 = MakeCtx("AGENT", "PigmyAccounts", "ClearAllPigmyData");
            filter.OnActionExecuting(a2);
            Assert.IsType<ForbidResult>(a2.Result);

            var aOk = MakeCtx("AGENT", "PigmyMobileApi", "CollectRdInstallment");
            filter.OnActionExecuting(aOk);
            Assert.Null(aOk.Result);

            // 3. PigmyAccountsController.GetAccountsByAgent rejects AGENT accessing another agentId and rejects CUSTOMER
            using var db = GetInMemoryDbContext(nameof(RoleBoundaryFilter_BlocksCustomerFromAgentAndCbsControllers_AndBlocksAgentFromCbsControllers));
            var pigmyAccCtrl = new PigmyAccountsController(db)
            {
                ControllerContext = BuildCustomerContext(customerId: 1)
            };
            var custRes = await pigmyAccCtrl.GetAccountsByAgent(1);
            Assert.IsType<ForbidResult>(custRes.Result);
        }
    }
}
