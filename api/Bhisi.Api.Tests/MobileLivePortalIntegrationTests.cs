using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Bhisi.Api.Controllers;
using Bhisi.Api.Data;
using Bhisi.Api.Filters;
using Bhisi.Api.Models;
using Bhisi.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class MobileLivePortalIntegrationTests
    {
        private static AppDbContext CreateDb(string name)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: name)
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ControllerContext BuildRoleContext(string role, int id, int branchId = 1)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, id.ToString()),
                new Claim(ClaimTypes.Role, role),
                new Claim("BranchID", branchId.ToString()),
                new Claim("DefaultBranchID", branchId.ToString())
            };
            if (string.Equals(role, "CUSTOMER", StringComparison.OrdinalIgnoreCase))
            {
                claims.Add(new Claim("CustomerId", id.ToString()));
            }
            return new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"))
                }
            };
        }

        private sealed class FakeAgentLockService : IAgentLockService
        {
            private readonly AppDbContext _db;
            public FakeAgentLockService(AppDbContext db) => _db = db;

            public async Task<AgentLockStatusResult> GetLockStatusAsync(int agentId)
            {
                var agt = await _db.PigmyAgents.AsNoTracking().FirstOrDefaultAsync(a => a.PigmyAgentID == agentId);
                decimal collected = await _db.PigmyCollections.AsNoTracking()
                    .Where(c => c.AgentId == agentId && c.PaymentMode == "CASH")
                    .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;
                decimal remitted = await _db.PigmyAgentCashDeposits.AsNoTracking()
                    .Where(d => d.AgentId == agentId)
                    .SumAsync(d => (decimal?)d.Amount) ?? 0m;
                decimal pending = Math.Max(0m, collected - remitted);
                decimal limit = agt?.MaxCashLimit ?? 20000m;
                bool locked = (agt?.IsLocked ?? false) || pending > limit;
                return new AgentLockStatusResult
                {
                    AgentId = agentId,
                    PendingCash = pending,
                    MaxCashLimit = limit,
                    Status = locked ? "LOCKED" : "ALLOWED",
                    Message = locked ? "Locked" : "Allowed"
                };
            }

            public Task<(bool IsAllowed, string? ErrorMessage)> ValidateCollectionAllowedAsync(int agentId, decimal incomingAmount, string paymentMode)
                => Task.FromResult((true, (string?)null));
        }

        private static JsonElement ToJson(object? value)
        {
            string json = JsonSerializer.Serialize(value);
            return JsonDocument.Parse(json).RootElement;
        }

        [Fact]
        public void EnforceRoleBoundary_BlocksCustomerAndAgentOnMobileManager_AllowsManager()
        {
            var filter = new EnforceRoleBoundaryAttribute();

            IActionResult? ExecuteForRole(string role)
            {
                var http = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, "5"),
                        new Claim(ClaimTypes.Role, role)
                    }, "TestAuth"))
                };
                var actionCtx = new ActionContext(
                    http,
                    new RouteData(),
                    new ControllerActionDescriptor { ControllerName = "MobileManager", ActionName = "GetCommandCenter" });
                var execCtx = new ActionExecutingContext(actionCtx, new List<IFilterMetadata>(), new Dictionary<string, object?>(), new object());
                filter.OnActionExecuting(execCtx);
                return execCtx.Result;
            }

            Assert.IsType<ForbidResult>(ExecuteForRole("CUSTOMER"));
            Assert.IsType<ForbidResult>(ExecuteForRole("AGENT"));
            Assert.Null(ExecuteForRole("Manager"));
            Assert.Null(ExecuteForRole("Admin"));
        }

        [Fact]
        public async Task MobileManagerCommandCenter_ReturnsFullPortfolioOverdueMaturitiesAndEod()
        {
            using var db = CreateDb(nameof(MobileManagerCommandCenter_ReturnsFullPortfolioOverdueMaturitiesAndEod));
            var today = DateTime.UtcNow.AddHours(5.5).Date;

            db.Branches.Add(new Branch { BranchID = 1, BranchCode = "BR01", BranchName = "मुख्य शाखा", IsActive = true });
            db.Customers.Add(new Customer
            {
                CustomerID = 10,
                BranchID = 1,
                CIFNo = "CIF-010",
                FirstName = "राजेश",
                LastName = "पाटील",
                MobileNo = "9876543210",
                Status = "Active"
            });
            db.Members.Add(new Member { MemberID = 1, CustomerID = 10, BranchID = 1, MemberCode = "MEM-01", Status = "Active" });
            db.FdSchemes.Add(new FdScheme { FdSchemeID = 1, SchemeCode = "FD1", SchemeName = "FD 1Y", DurationMonths = 12, InterestRate = 8.5m, SeniorCitizenInterestRate = 9.0m, MinimumAmount = 5000m, MaximumAmount = 1000000m, PrematureInterestRate = 6.0m });
            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 1,
                BranchID = 1,
                CustomerID = 10,
                FdSchemeID = 1,
                AccountNo = "FD-1001",
                DepositAmount = 100000m,
                InterestRate = 8.5m,
                MaturityDate = today.AddDays(5),
                MaturityAmount = 108500m,
                Status = "Active"
            });
            db.SavingAccountMasters.Add(new SavingAccountMaster
            {
                SavingAccountID = 1,
                BranchID = 1,
                CustomerID = 10,
                AccountNo = "SB-1001",
                LedgerID = 1,
                CurrentBalance = 25000m,
                InterestRate = 4.0m,
                Status = "Active"
            });
            db.LoanRates.Add(new LoanRate { LoanRateID = 1, LoanType = "सुवर्ण तारण कर्ज", InterestRate = 11.0m });
            db.LoanAccounts.Add(new LoanAccount
            {
                LoanAccountID = 1,
                BranchID = 1,
                CustomerID = 10,
                LoanRateID = 1,
                LoanAccountNo = "LN-1001",
                PrincipalBalance = 60000m,
                SanctionedAmount = 80000m,
                InterestRate = 11.0m,
                DurationMonths = 24,
                InstallmentAmount = 4000m,
                OpeningDate = today.AddMonths(-6),
                Status = "Active"
            });
            db.LoanInstallmentSchedules.Add(new LoanInstallmentSchedule
            {
                ScheduleID = 1,
                LoanAccountID = 1,
                InstallmentNo = 1,
                DueDate = today.AddDays(-95),
                PrincipalAmount = 3200m,
                InterestAmount = 800m,
                TotalAmount = 4000m,
                BalanceAmount = 4000m,
                Status = "Overdue"
            });
            db.ShareAccounts.Add(new ShareAccount
            {
                ShareAccountId = 1,
                AccountNo = "SH-1001",
                MemberId = 1,
                CustomerID = 10,
                TotalShareAmount = 5000m,
                TotalShareCount = 50,
                Status = "Active"
            });
            db.Vouchers.Add(new Voucher
            {
                VoucherID = 50,
                BranchID = 1,
                VoucherNo = "VCH-050",
                VoucherDate = today,
                VoucherType = "Payment",
                TotalAmount = 45000m,
                Narration = "FD Maturity Payout",
                Status = "Pending"
            });
            await db.SaveChangesAsync();

            var controller = new MobileManagerController(db, new FakeAgentLockService(db))
            {
                ControllerContext = BuildRoleContext("Admin", 1, 1)
            };

            var res = await controller.GetCommandCenter(null);
            var ok = Assert.IsType<OkObjectResult>(res);
            var root = ToJson(ok.Value);

            var portfolio = root.GetProperty("portfolio");
            Assert.Equal(125000m, portfolio.GetProperty("totalDeposits").GetDecimal());
            Assert.Equal(60000m, portfolio.GetProperty("totalLoanOutstanding").GetDecimal());
            Assert.Equal(4000m, portfolio.GetProperty("totalLoanOverdue").GetDecimal());
            Assert.Equal(100m, portfolio.GetProperty("npaPercent").GetDecimal());
            Assert.Equal(1, root.GetProperty("overdueLoans").GetArrayLength());
            Assert.Equal("NPA_90", root.GetProperty("overdueLoans")[0].GetProperty("bucket").GetString());
            Assert.Equal(1, root.GetProperty("maturityItems").GetArrayLength());
            Assert.Equal("UPCOMING_7", root.GetProperty("maturityItems")[0].GetProperty("bucket").GetString());
            Assert.Equal(1, root.GetProperty("approvals").GetArrayLength());
            Assert.Equal("VOUCHER:50", root.GetProperty("approvals")[0].GetProperty("id").GetString());
            Assert.Equal(4, root.GetProperty("eodChecklist").GetArrayLength());
        }

        [Fact]
        public async Task EndToEnd_CustomerServiceRequest_AppearsInManagerApprovals_AndDecisionReflectsInCustomerPortal()
        {
            using var db = CreateDb(nameof(EndToEnd_CustomerServiceRequest_AppearsInManagerApprovals_AndDecisionReflectsInCustomerPortal));
            db.Branches.Add(new Branch { BranchID = 1, BranchCode = "BR01", BranchName = "मुख्य शाखा", IsActive = true });
            db.Customers.Add(new Customer
            {
                CustomerID = 21,
                BranchID = 1,
                CIFNo = "CIF-021",
                FirstName = "सुरेश",
                LastName = "कुलकर्णी",
                MobileNo = "9822001122",
                Status = "Active"
            });
            await db.SaveChangesAsync();

            // 1. Customer submits Loan Application request
            var custController = new CustomerPortalController(db)
            {
                ControllerContext = BuildRoleContext("CUSTOMER", 21, 1)
            };
            var createRes = await custController.CreateServiceRequest(new CustomerCreateServiceRequestDto
            {
                Type = "LOAN_APPLY",
                Title = "सुवर्ण तारण कर्ज अर्ज",
                Subtitle = "कालावधी: २४ महिने • रक्कम: ₹1,00,000",
                Amount = 100000m,
                PreferredSlot = "२४ महिने"
            });
            var okCreate = Assert.IsType<OkObjectResult>(createRes);
            var createdJson = ToJson(okCreate.Value);
            string createdId = createdJson.GetProperty("id").GetString()!;
            Assert.StartsWith("CUST_REQ:", createdId);
            int numericReqId = int.Parse(createdId.Split(':')[1]);

            // 2. Manager sees request live in Command Center Approvals
            var mgrController = new MobileManagerController(db, new FakeAgentLockService(db))
            {
                ControllerContext = BuildRoleContext("Manager", 2, 1)
            };
            var cmdRes = await mgrController.GetCommandCenter(1);
            var cmdJson = ToJson(Assert.IsType<OkObjectResult>(cmdRes).Value);
            var approvals = cmdJson.GetProperty("approvals").EnumerateArray().ToList();
            Assert.Contains(approvals, a => a.GetProperty("id").GetString() == createdId && a.GetProperty("category").GetString() == "LOAN_APP");

            // 3. Manager approves request
            var decideRes = await mgrController.DecideApproval("CUST_REQ", numericReqId, new ManagerApprovalDecisionDto
            {
                Status = "APPROVED",
                Remarks = "कागदपत्रे तपासून मंजूर"
            });
            Assert.IsType<OkObjectResult>(decideRes);

            // 4. Customer Full Portal immediately reflects APPROVED status
            var portalRes = await custController.GetFullPortal();
            var portalJson = ToJson(Assert.IsType<OkObjectResult>(portalRes).Value);
            var reqs = portalJson.GetProperty("serviceRequests").EnumerateArray().ToList();
            Assert.Single(reqs);
            Assert.Equal("APPROVED", reqs[0].GetProperty("status").GetString());
        }

        [Fact]
        public async Task MobileManager_ToggleAgentLock_And_RemitCash_PersistsDepositAndUnlocksAgent()
        {
            using var db = CreateDb(nameof(MobileManager_ToggleAgentLock_And_RemitCash_PersistsDepositAndUnlocksAgent));
            var today = DateTime.UtcNow.AddHours(5.5).Date;

            db.Branches.Add(new Branch { BranchID = 1, BranchCode = "BR01", BranchName = "मुख्य शाखा", IsActive = true });
            db.PigmyAgents.Add(new PigmyAgent
            {
                PigmyAgentID = 7,
                AgentName = "विकास जाधव",
                BranchID = 1,
                MaxCashLimit = 10000m,
                IsLocked = true,
                Status = "Locked"
            });
            db.PigmyCollections.Add(new PigmyCollection
            {
                CollectionId = 1,
                PigmyAccountId = 101,
                AgentId = 7,
                CollectionDate = today,
                OpeningBalance = 0m,
                CollectionAmount = 15000m,
                ClosingBalance = 15000m,
                ReceiptNo = "PG-101",
                CollectionSource = "APP",
                PaymentMode = "CASH"
            });
            await db.SaveChangesAsync();

            var mgrController = new MobileManagerController(db, new FakeAgentLockService(db))
            {
                ControllerContext = BuildRoleContext("Manager", 2, 1)
            };

            // 1. Remit ₹15,000 cash -> drops pending cash to 0 & unlocks agent automatically
            var remitRes = await mgrController.RemitAgentCash(7, new ManagerAgentRemitDto { Amount = 15000m });
            var remitJson = ToJson(Assert.IsType<OkObjectResult>(remitRes).Value);
            Assert.True(remitJson.GetProperty("success").GetBoolean());
            Assert.Equal(0m, remitJson.GetProperty("remainingCash").GetDecimal());
            Assert.False(remitJson.GetProperty("isLocked").GetBoolean());
            Assert.Equal(1, await db.PigmyAgentCashDeposits.CountAsync());

            // 2. Toggle lock -> locks agent cleanly
            var lockRes = await mgrController.ToggleAgentLock(7);
            var lockJson = ToJson(Assert.IsType<OkObjectResult>(lockRes).Value);
            Assert.True(lockJson.GetProperty("isLocked").GetBoolean());
            Assert.Equal("Locked", (await db.PigmyAgents.FindAsync(7))!.Status);
        }

        [Fact]
        public async Task CustomerPortal_LoanScheduleIsolation_And_ChangeMpin_EnforcesSecurity()
        {
            using var db = CreateDb(nameof(CustomerPortal_LoanScheduleIsolation_And_ChangeMpin_EnforcesSecurity));
            var today = DateTime.UtcNow.AddHours(5.5).Date;

            db.Branches.Add(new Branch { BranchID = 1, BranchCode = "BR01", BranchName = "मुख्य शाखा", IsActive = true });
            db.Customers.AddRange(
                new Customer { CustomerID = 31, BranchID = 1, CIFNo = "CIF-31", FirstName = "A", LastName = "One", MobileNo = "9111111111", Status = "Active", PortalPinHash = BCrypt.Net.BCrypt.HashPassword("1234") },
                new Customer { CustomerID = 32, BranchID = 1, CIFNo = "CIF-32", FirstName = "B", LastName = "Two", MobileNo = "9222222222", Status = "Active" }
            );
            db.LoanRates.Add(new LoanRate { LoanRateID = 1, LoanType = "व्यवसाय कर्ज", InterestRate = 12m });
            db.LoanAccounts.Add(new LoanAccount
            {
                LoanAccountID = 500,
                BranchID = 1,
                CustomerID = 32,
                LoanRateID = 1,
                LoanAccountNo = "LN-500",
                PrincipalBalance = 50000m,
                OpeningDate = today.AddMonths(-2),
                Status = "Active"
            });
            db.LoanInstallmentSchedules.Add(new LoanInstallmentSchedule
            {
                ScheduleID = 1,
                LoanAccountID = 500,
                InstallmentNo = 1,
                DueDate = today.AddDays(10),
                PrincipalAmount = 2000m,
                InterestAmount = 500m,
                TotalAmount = 2500m,
                BalanceAmount = 2500m,
                ClosingBalance = 48000m,
                Status = "Pending"
            });
            await db.SaveChangesAsync();

            var cust31 = new CustomerPortalController(db) { ControllerContext = BuildRoleContext("CUSTOMER", 31, 1) };
            var cust32 = new CustomerPortalController(db) { ControllerContext = BuildRoleContext("CUSTOMER", 32, 1) };

            // Customer 31 cannot access Customer 32's loan schedule
            Assert.IsType<NotFoundObjectResult>(await cust31.GetLoanSchedule(500));

            // Customer 32 can access their own schedule
            var ownSched = Assert.IsType<OkObjectResult>(await cust32.GetLoanSchedule(500));
            Assert.Equal(1, ToJson(ownSched.Value).GetArrayLength());

            // Wrong old mPIN rejected
            Assert.IsType<BadRequestObjectResult>(await cust31.ChangeMpin(new CustomerChangeMpinDto { OldPin = "0000", NewPin = "5678" }));

            // Valid old mPIN updates hash cleanly
            var okPin = Assert.IsType<OkObjectResult>(await cust31.ChangeMpin(new CustomerChangeMpinDto { OldPin = "1234", NewPin = "5678" }));
            Assert.True(ToJson(okPin.Value).GetProperty("success").GetBoolean());
            var updatedCust = await db.Customers.FindAsync(31);
            Assert.True(BCrypt.Net.BCrypt.Verify("5678", updatedCust!.PortalPinHash));
        }
    }
}
