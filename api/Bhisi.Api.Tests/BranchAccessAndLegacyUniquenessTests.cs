using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Bhisi.Api.Controllers;
using Bhisi.Api.Data;
using Bhisi.Api.Helpers;
using Bhisi.Api.Models;
using Bhisi.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class BranchAccessAndLegacyUniquenessTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"BhisiBranchQa_{Guid.NewGuid()}")
                .ConfigureWarnings(x => x.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ClaimsPrincipal BuildPrincipal(int userId, string username, string role, int branchId, int? defaultBranchId = null)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Name, username),
                new Claim(ClaimTypes.Role, role),
                new Claim("BranchID", branchId.ToString()),
                new Claim("DefaultBranchID", (defaultBranchId ?? branchId).ToString())
            };
            return new ClaimsPrincipal(new ClaimsIdentity(claims, "TestJwt"));
        }

        private static void AttachUser(ControllerBase controller, ClaimsPrincipal principal)
        {
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = principal
                }
            };
        }

        private static IConfiguration BuildTestConfig()
        {
            return new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Jwt:Key"] = "unit_test_secret_key_for_bhisi_software_backend_98765!@#"
                })
                .Build();
        }

        private static async Task SeedBranchesAndRolesAsync(AppDbContext db)
        {
            db.Branches.AddRange(
                new Branch { BranchID = 1, BranchCode = "001", BranchName = "Pune (HO)", IsActive = true },
                new Branch { BranchID = 2, BranchCode = "002", BranchName = "Saswad", IsActive = true },
                new Branch { BranchID = 3, BranchCode = "003", BranchName = "Baramati", IsActive = true }
            );
            db.Roles.AddRange(
                new Role { RoleID = 1, RoleCode = "ADM", RoleName = "Admin", Status = true },
                new Role { RoleID = 2, RoleCode = "CSH", RoleName = "Cashier", Status = true },
                new Role { RoleID = 3, RoleCode = "BM", RoleName = "BranchManager", Status = true },
                new Role { RoleID = 4, RoleCode = "CLK", RoleName = "Clerk", Status = true },
                new Role { RoleID = 5, RoleCode = "AUD", RoleName = "Auditor", Status = true }
            );
            db.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "2026-2027",
                StartDate = new DateTime(2026, 4, 1),
                EndDate = new DateTime(2027, 3, 31),
                IsActive = true,
                IsClosed = false
            });
            await db.SaveChangesAsync();
        }

        // =========================================================================
        // PART A1: CENTRALIZED ROLE POLICY & CONTEXT HELPERS
        // =========================================================================

        [Theory]
        [InlineData("Admin", true)]
        [InlineData("SuperAdmin", true)]
        [InlineData("Super Admin", true)]
        [InlineData("SystemAdmin", true)]
        [InlineData("HeadOffice", true)]
        [InlineData("HO_Manager", true)]
        [InlineData("HO Manager", true)]
        [InlineData("Auditor", true)]
        [InlineData("GeneralManager", true)]
        [InlineData("CEO", true)]
        [InlineData("Chairman", true)]
        [InlineData("BranchManager", false)]
        [InlineData("Manager", false)]
        [InlineData("Cashier", false)]
        [InlineData("Clerk", false)]
        [InlineData("Accountant", false)]
        [InlineData("User", false)]
        [InlineData("AGENT", false)]
        public void IsHeadOfficeRole_EnforcesStrictRoleHierarchy(string roleName, bool expected)
        {
            Assert.Equal(expected, UserContextExtensions.IsHeadOfficeRole(roleName));
        }

        [Fact]
        public void BranchLockedUser_EvenInBranch1_IsNotHeadOfficeAndCannotAccessBranch2()
        {
            var branch1Clerk = BuildPrincipal(10, "clerk_pune", "Clerk", branchId: 1);
            var branch2Cashier = BuildPrincipal(11, "ramesh_saswad", "Cashier", branchId: 2);
            var hoAdminInBranch2 = BuildPrincipal(1, "admin", "Admin", branchId: 2, defaultBranchId: 1);

            Assert.False(branch1Clerk.IsHeadOfficeAdmin());
            Assert.True(branch1Clerk.IsBranchLockedUser());
            Assert.Equal(1, branch1Clerk.ResolveOptionalBranchId(null));
            Assert.Equal(1, branch1Clerk.ResolveRequiredBranchId(2));
            Assert.False(branch1Clerk.CanAccessBranch(2));

            Assert.False(branch2Cashier.IsHeadOfficeAdmin());
            Assert.Equal(2, branch2Cashier.ResolveOptionalBranchId(1));
            Assert.Equal(2, branch2Cashier.ResolveRequiredBranchId(1));
            Assert.False(branch2Cashier.CanAccessBranch(1));
            Assert.True(branch2Cashier.CanAccessBranch(2));

            Assert.True(hoAdminInBranch2.IsHeadOfficeAdmin());
            Assert.Null(hoAdminInBranch2.ResolveOptionalBranchId(null));
            Assert.Equal(3, hoAdminInBranch2.ResolveRequiredBranchId(3));
            Assert.True(hoAdminInBranch2.CanAccessBranch(1));
            Assert.True(hoAdminInBranch2.CanAccessBranch(3));
        }

        // =========================================================================
        // PART A2: LOGIN, SWITCH BRANCH & USER CREATION
        // =========================================================================

        [Fact]
        public async Task AuthLogin_BlocksCrossBranchForCashier_AllowsOwnBranchAndHoAdmin()
        {
            await using var db = CreateContext();
            await SeedBranchesAndRolesAsync(db);

            db.Users.AddRange(
                new User
                {
                    UserID = 10,
                    Username = "ramesh",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("Pass@123"),
                    RoleID = 2, // Cashier
                    DefaultBranchID = 2,
                    IsActive = true
                },
                new User
                {
                    UserID = 11,
                    Username = "unassigned_clerk",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("Pass@123"),
                    RoleID = 4, // Clerk
                    DefaultBranchID = null,
                    IsActive = true
                },
                new User
                {
                    UserID = 1,
                    Username = "admin_ho",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
                    RoleID = 1, // Admin
                    DefaultBranchID = 1,
                    IsActive = true
                }
            );
            await db.SaveChangesAsync();

            var controller = new AuthController(db, BuildTestConfig());
            AttachUser(controller, new ClaimsPrincipal());

            // 1. Branch 2 Cashier tries Branch 1 -> 403 Forbidden
            var crossRes = await controller.Login(new LoginRequestDto
            {
                Username = "ramesh",
                Password = "Pass@123",
                BranchID = 1,
                FinancialYearID = 1
            });
            var forbidden = Assert.IsType<ObjectResult>(crossRes.Result);
            Assert.Equal(403, forbidden.StatusCode);

            // 2. Clerk without DefaultBranchID -> 400 BadRequest (never defaults silently to 1)
            var unassignedRes = await controller.Login(new LoginRequestDto
            {
                Username = "unassigned_clerk",
                Password = "Pass@123",
                BranchID = 1,
                FinancialYearID = 1
            });
            Assert.IsType<BadRequestObjectResult>(unassignedRes.Result);

            // 3. Branch 2 Cashier logs into Branch 2 -> 200 OK with DefaultBranchID claim & ActiveSessionToken
            var okRes = await controller.Login(new LoginRequestDto
            {
                Username = "ramesh",
                Password = "Pass@123",
                BranchID = 2,
                FinancialYearID = 1
            });
            var okObj = Assert.IsType<OkObjectResult>(okRes.Result);
            var dto = Assert.IsType<LoginResponseDto>(okObj.Value);
            Assert.Equal(2, dto.BranchID);
            Assert.Equal(2, dto.DefaultBranchID);
            Assert.False(string.IsNullOrWhiteSpace(dto.Token));

            var jwt = new JwtSecurityTokenHandler().ReadJwtToken(dto.Token);
            Assert.Equal("2", jwt.Claims.First(c => c.Type == "DefaultBranchID").Value);

            var reloadedCashier = await db.Users.FindAsync(10);
            Assert.Equal(dto.Token, reloadedCashier!.ActiveSessionToken);

            // 4. HO Admin can log into Branch 3 directly -> 200 OK
            var adminRes = await controller.Login(new LoginRequestDto
            {
                Username = "admin_ho",
                Password = "Admin@123",
                BranchID = 3,
                FinancialYearID = 1
            });
            var adminOk = Assert.IsType<OkObjectResult>(adminRes.Result);
            var adminDto = Assert.IsType<LoginResponseDto>(adminOk.Value);
            Assert.Equal(3, adminDto.BranchID);
        }

        [Fact]
        public async Task AuthLogin_PigmyAgent_BlocksCrossBranchAndMissingBranch()
        {
            await using var db = CreateContext();
            await SeedBranchesAndRolesAsync(db);

            var agentCust2 = new Customer { CustomerID = 50, BranchID = 2, FirstName = "A", LastName = "B", MobileNo = "9876543210", CIFNo = "CIF000050" };
            var agentCustNoBranch = new Customer { CustomerID = 51, BranchID = 1, FirstName = "C", LastName = "D", MobileNo = "9876543211", CIFNo = "CIF000051" };
            db.Customers.AddRange(agentCust2, agentCustNoBranch);
            db.PigmyAgents.AddRange(
                new PigmyAgent { PigmyAgentID = 1, AgentName = "Saswad Agent", BranchID = 2, CustomerID = 50, Pin = "1234", Status = "Active" },
                new PigmyAgent { PigmyAgentID = 2, AgentName = "NoBranch Agent", BranchID = null, CustomerID = 51, Pin = "1234", Status = "Active" }
            );
            await db.SaveChangesAsync();

            var controller = new AuthController(db, BuildTestConfig());
            AttachUser(controller, new ClaimsPrincipal());

            // Agent assigned to Branch 2 trying Branch 1 -> 403 Forbidden
            var crossAgent = await controller.Login(new LoginRequestDto { Username = "9876543210", Password = "1234", BranchID = 1, FinancialYearID = 1 });
            var forbidden = Assert.IsType<ObjectResult>(crossAgent.Result);
            Assert.Equal(403, forbidden.StatusCode);

            // Agent without BranchID -> 400 BadRequest
            var noBranchAgent = await controller.Login(new LoginRequestDto { Username = "9876543211", Password = "1234", BranchID = 1, FinancialYearID = 1 });
            Assert.IsType<BadRequestObjectResult>(noBranchAgent.Result);
        }

        [Fact]
        public async Task SwitchBranch_BlocksNonHoManager_AllowsHoAdminAndAdvancesClosedBusinessDate()
        {
            await using var db = CreateContext();
            await SeedBranchesAndRolesAsync(db);

            db.Users.AddRange(
                new User { UserID = 1, Username = "admin", PasswordHash = "x", RoleID = 1, DefaultBranchID = 1, IsActive = true, ActiveSessionToken = "old-token" },
                new User { UserID = 2, Username = "bm2", PasswordHash = "x", RoleID = 3, DefaultBranchID = 2, IsActive = true }
            );
            db.BranchDayEndStatuses.Add(new BranchDayEndStatus
            {
                BranchID = 3,
                BusinessDate = new DateTime(2026, 6, 15),
                IsDayClosed = true
            });
            await db.SaveChangesAsync();

            var controller = new AuthController(db, BuildTestConfig());

            // Non-HO BranchManager tries to switch -> 403
            AttachUser(controller, BuildPrincipal(2, "bm2", "BranchManager", branchId: 2));
            var bmSwitch = await controller.SwitchBranch(new SwitchBranchRequestDto { TargetBranchID = 1 });
            var forbidden = Assert.IsType<ObjectResult>(bmSwitch.Result);
            Assert.Equal(403, forbidden.StatusCode);

            // HO Admin switches to Branch 3 (where 2026-06-15 is closed) -> 200 OK with 2026-06-16 and rotated ActiveSessionToken
            AttachUser(controller, BuildPrincipal(1, "admin", "Admin", branchId: 1));
            var hoSwitch = await controller.SwitchBranch(new SwitchBranchRequestDto { TargetBranchID = 3 });
            var okObj = Assert.IsType<OkObjectResult>(hoSwitch.Result);
            var dto = Assert.IsType<SwitchBranchResponseDto>(okObj.Value);
            Assert.Equal(3, dto.BranchID);
            Assert.Equal("2026-06-16", dto.BusinessDate);

            var jwt = new JwtSecurityTokenHandler().ReadJwtToken(dto.Token);
            Assert.Equal("2026-06-16", jwt.Claims.First(c => c.Type == "BusinessDate").Value);

            var adminDb = await db.Users.FindAsync(1);
            Assert.NotEqual("old-token", adminDb!.ActiveSessionToken);
            Assert.Equal(dto.Token, adminDb.ActiveSessionToken);
        }

        [Fact]
        public async Task UsersController_CreateUser_RequiresDefaultBranchForNonHoRole()
        {
            await using var db = CreateContext();
            await SeedBranchesAndRolesAsync(db);

            var controller = new UsersController(db);
            AttachUser(controller, BuildPrincipal(1, "admin", "Admin", branchId: 1));

            var missingBranch = await controller.CreateUser(new CreateUserDto
            {
                Username = "new_cashier",
                RoleID = 2, // Cashier
                DefaultBranchID = null,
                IsActive = true
            });
            Assert.IsType<BadRequestObjectResult>(missingBranch.Result);

            var validCashier = await controller.CreateUser(new CreateUserDto
            {
                Username = "new_cashier",
                RoleID = 2,
                DefaultBranchID = 2,
                IsActive = true
            });
            Assert.IsType<CreatedAtActionResult>(validCashier.Result);
        }

        // =========================================================================
        // PART A3: ENFORCE BRANCH SCOPE FILTER & CROSS-BRANCH IDOR BLOCKING
        // =========================================================================

        private class DummyBranchDto
        {
            public int BranchID { get; set; }
            public string Name { get; set; } = "";
        }

        private class DummyNullableBranchDto
        {
            public int? BranchId { get; set; }
        }

        [Fact]
        public void EnforceBranchScopeAttribute_RewritesParamsAndDtosForNonHo_PreservesForHo()
        {
            var filter = new EnforceBranchScopeAttribute();

            // Non-HO Branch 2 Cashier tries passing branchId=1 and DTO BranchID=1
            var httpNonHo = new DefaultHttpContext { User = BuildPrincipal(11, "ramesh", "Cashier", branchId: 2) };
            var dto1 = new DummyBranchDto { BranchID = 1 };
            var dto2 = new DummyNullableBranchDto { BranchId = 3 };
            var argsNonHo = new Dictionary<string, object?>
            {
                ["branchId"] = 1,
                ["queryBranchId"] = 3,
                ["dto1"] = dto1,
                ["dto2"] = dto2
            };
            var ctxNonHo = new ActionExecutingContext(
                new ActionContext(httpNonHo, new RouteData(), new ActionDescriptor()),
                new List<IFilterMetadata>(),
                argsNonHo,
                new object());

            filter.OnActionExecuting(ctxNonHo);
            Assert.Equal(2, argsNonHo["branchId"]);
            Assert.Equal(2, argsNonHo["queryBranchId"]);
            Assert.Equal(2, dto1.BranchID);
            Assert.Equal(2, dto2.BranchId);

            // HO Admin tries passing branchId=3 and DTO BranchID=2 -> Preserved!
            var httpHo = new DefaultHttpContext { User = BuildPrincipal(1, "admin", "Admin", branchId: 1) };
            var hoDto = new DummyBranchDto { BranchID = 2 };
            var argsHo = new Dictionary<string, object?> { ["branchId"] = 3, ["dto"] = hoDto };
            var ctxHo = new ActionExecutingContext(
                new ActionContext(httpHo, new RouteData(), new ActionDescriptor()),
                new List<IFilterMetadata>(),
                argsHo,
                new object());

            filter.OnActionExecuting(ctxHo);
            Assert.Equal(3, argsHo["branchId"]);
            Assert.Equal(2, hoDto.BranchID);

            // SkipBranchScope bypasses rewriting even for Cashier
            var skipDescriptor = new ActionDescriptor
            {
                EndpointMetadata = new List<object> { new SkipBranchScopeAttribute() }
            };
            var argsSkip = new Dictionary<string, object?> { ["branchId"] = 1 };
            var ctxSkip = new ActionExecutingContext(
                new ActionContext(httpNonHo, new RouteData(), skipDescriptor),
                new List<IFilterMetadata>(),
                argsSkip,
                new object());

            filter.OnActionExecuting(ctxSkip);
            Assert.Equal(1, argsSkip["branchId"]);
        }

        [Fact]
        public async Task VouchersAndPostingControllers_BlockCrossBranchIdor()
        {
            await using var db = CreateContext();
            await SeedBranchesAndRolesAsync(db);

            db.Vouchers.Add(new Voucher
            {
                VoucherID = 500,
                BranchID = 1,
                VoucherNo = "RCP-001",
                VoucherType = "Receipt",
                VoucherDate = new DateTime(2026, 6, 15),
                TotalAmount = 1000m,
                Status = "Approved"
            });
            await db.SaveChangesAsync();

            var rollback = new VoucherRollbackAndDeleteService(db);
            var branch2Mgr = BuildPrincipal(20, "bm2", "BranchManager", branchId: 2);

            var vouchersController = new VouchersController(db, rollback);
            AttachUser(vouchersController, branch2Mgr);
            var getRes = await vouchersController.GetVoucher(500);
            var getStatus = Assert.IsType<ObjectResult>(getRes.Result);
            Assert.Equal(403, getStatus.StatusCode);

            var postingController = new VoucherPostingController(db, rollback);
            AttachUser(postingController, branch2Mgr);
            // Even if payload spoofs UserRole = "Admin", server claims determine it's BranchManager (Branch 2) -> 403
            var unpassRes = await postingController.UnpassVouchers(new VoucherPostingController.UnpassVouchersRequest
            {
                VoucherIds = new List<int> { 500 },
                UserRole = "Admin",
                Reason = "Test cross-branch IDOR"
            });
            var unpassStatus = Assert.IsType<ObjectResult>(unpassRes);
            Assert.Equal(403, unpassStatus.StatusCode);
        }

        // =========================================================================
        // PART B: BRANCH-WISE UNIQUE LEGACY NUMBERS
        // =========================================================================

        [Fact]
        public async Task Customers_LegacyCustomerNo_AllowedAcrossBranches_BlockedWithinSameBranch()
        {
            await using var db = CreateContext();
            await SeedBranchesAndRolesAsync(db);

            db.Customers.Add(new Customer
            {
                CustomerID = 1,
                BranchID = 1,
                CIFNo = "CIF000001",
                LegacyCustomerNo = "105",
                FirstName = "Patil",
                LastName = "Pune",
                IsDeleted = false
            });
            await db.SaveChangesAsync();

            var controller = new CustomersController(db, new MemoryCache(new MemoryCacheOptions()));
            AttachUser(controller, BuildPrincipal(12, "clerk2", "Clerk", branchId: 2));

            // 1. CheckLegacyCustomerNo for Branch 2 should return exists=false despite Branch 1 having "105"
            var checkRes = await controller.CheckLegacyCustomerNo("105", null, branchId: 1); // Branch 2 clerk locked to Branch 2
            var checkOk = Assert.IsType<OkObjectResult>(checkRes);
            var existsProp = checkOk.Value!.GetType().GetProperty("exists")!.GetValue(checkOk.Value);
            Assert.False((bool)existsProp!);

            // 2. Creating customer with LegacyCustomerNo = "105" in Branch 2 succeeds (and locks payload BranchID=1 to 2)
            var postB2 = await controller.PostCustomer(new Customer
            {
                BranchID = 1, // spoofed
                CIFNo = "CIF000002",
                LegacyCustomerNo = "105",
                FirstName = "Jadhav",
                LastName = "Saswad"
            });
            var created = Assert.IsType<CreatedAtActionResult>(postB2.Result);
            var createdCust = Assert.IsType<Customer>(created.Value);
            Assert.Equal(2, createdCust.BranchID);

            // 3. Trying to create ANOTHER customer with LegacyCustomerNo = "105" in Branch 2 is BLOCKED
            var dupB2 = await controller.PostCustomer(new Customer
            {
                BranchID = 2,
                CIFNo = "CIF000003",
                LegacyCustomerNo = "105",
                FirstName = "Shinde",
                LastName = "Saswad"
            });
            Assert.IsType<BadRequestObjectResult>(dupB2.Result);
        }

        [Fact]
        public async Task Members_LegacyMemberNo_AllowedAcrossBranches_BlockedWithinSameBranch()
        {
            await using var db = CreateContext();
            await SeedBranchesAndRolesAsync(db);

            db.Customers.AddRange(
                new Customer { CustomerID = 1, BranchID = 1, CIFNo = "CIF000001", FirstName = "A", LastName = "Pune" },
                new Customer { CustomerID = 2, BranchID = 2, CIFNo = "CIF000002", FirstName = "B", LastName = "Saswad" },
                new Customer { CustomerID = 3, BranchID = 2, CIFNo = "CIF000003", FirstName = "C", LastName = "Saswad2" }
            );
            db.Members.Add(new Member
            {
                MemberID = 1,
                CustomerID = 1,
                BranchID = 1,
                MemberCode = "MEM000001",
                LegacyMemberNo = "105",
                IsDeleted = false
            });
            await db.SaveChangesAsync();

            var controller = new MembersController(db);
            AttachUser(controller, BuildPrincipal(12, "clerk2", "Clerk", branchId: 2));

            // 1. Branch 2 can create member with LegacyMemberNo = "105"
            var okRes = await controller.PostMember(new MemberRequestDto
            {
                CustomerID = 2,
                BranchID = 1, // locked to 2 for Clerk
                MemberCode = "MEM000002",
                LegacyMemberNo = "105",
                FirstName = "B",
                LastName = "Saswad"
            });
            var created = Assert.IsType<CreatedAtActionResult>(okRes.Result);
            var dto = Assert.IsType<MemberResponseDto>(created.Value);
            Assert.Equal(2, dto.BranchID);

            // 2. Duplicate "105" in SAME Branch 2 -> BadRequest
            var dupRes = await controller.PostMember(new MemberRequestDto
            {
                CustomerID = 3,
                BranchID = 2,
                MemberCode = "MEM000003",
                LegacyMemberNo = "105",
                FirstName = "C",
                LastName = "Saswad2"
            });
            Assert.IsType<BadRequestObjectResult>(dupRes.Result);
        }

        [Fact]
        public async Task LoanAccounts_LegacyAccountNumber_UniquePerBranchAndScheme()
        {
            await using var db = CreateContext();
            await SeedBranchesAndRolesAsync(db);

            db.LoanRates.AddRange(
                new LoanRate { LoanRateID = 1, LoanType = "Sadharan Karj", LoanCode = "SK", ShortName = "SK" },
                new LoanRate { LoanRateID = 2, LoanType = "Sone Tarana", LoanCode = "GT", ShortName = "GT" }
            );
            db.Customers.Add(new Customer { CustomerID = 1, BranchID = 2, CIFNo = "CIF000001", FirstName = "Jadhav", LastName = "Saswad" });
            db.LoanAccounts.Add(new LoanAccount
            {
                LoanAccountID = 1,
                BranchID = 1,
                CustomerID = 1,
                LoanRateID = 1,
                LoanAccountNo = "00120100000001",
                LegacyAccountNumber = "105"
            });
            await db.SaveChangesAsync();

            var controller = new LoanAccountsController(db);
            AttachUser(controller, BuildPrincipal(12, "clerk2", "Clerk", branchId: 2));

            // 1. Same scheme (1) & same legacy "105" in DIFFERENT branch (2) -> ALLOWED
            var b2SameScheme = await controller.PostLoanAccount(new LoanAccount
            {
                BranchID = 2,
                CustomerID = 1,
                LoanRateID = 1,
                LoanAccountNo = "00220100000001",
                LegacyAccountNumber = "105",
                PrincipalBalance = 50000m
            });
            Assert.IsType<CreatedAtActionResult>(b2SameScheme.Result);

            // 2. Same branch (2) & same scheme (1) & same legacy "105" again -> BLOCKED
            var b2Dup = await controller.PostLoanAccount(new LoanAccount
            {
                BranchID = 2,
                CustomerID = 1,
                LoanRateID = 1,
                LoanAccountNo = "00220100000002",
                LegacyAccountNumber = "105",
                PrincipalBalance = 10000m
            });
            Assert.IsType<BadRequestObjectResult>(b2Dup.Result);

            // 3. Same branch (2) & DIFFERENT scheme (2) & legacy "105" -> ALLOWED
            var b2DiffScheme = await controller.PostLoanAccount(new LoanAccount
            {
                BranchID = 2,
                CustomerID = 1,
                LoanRateID = 2,
                LoanAccountNo = "00220200000001",
                LegacyAccountNumber = "105",
                PrincipalBalance = 25000m
            });
            Assert.IsType<CreatedAtActionResult>(b2DiffScheme.Result);
        }

        [Fact]
        public async Task FdAccounts_CheckLegacyReceipt_ScopedToOperatingBranchForNonHo()
        {
            await using var db = CreateContext();
            await SeedBranchesAndRolesAsync(db);

            db.FdSchemes.Add(new FdScheme { FdSchemeID = 1, SchemeCode = "FD1", SchemeName = "Regular FD", DurationMonths = 12, InterestRate = 8m, SeniorCitizenInterestRate = 8.5m });
            db.Customers.Add(new Customer { CustomerID = 1, BranchID = 1, CIFNo = "CIF000001", FirstName = "Patil", LastName = "Pune" });
            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 1,
                BranchID = 1,
                CustomerID = 1,
                FdSchemeID = 1,
                AccountNo = "00140100000001",
                LegacyAccountNumber = "105",
                DepositAmount = 10000m
            });
            await db.SaveChangesAsync();

            var controller = new FdAccountsController(db);
            AttachUser(controller, BuildPrincipal(12, "clerk2", "Clerk", branchId: 2));

            // Even if query passes branchId=1 or 0, Branch 2 clerk is resolved to Branch 2 -> NOT duplicate in Branch 2
            var res = await controller.CheckLegacyReceipt(branchId: 1, schemeId: 1, receiptNo: "105");
            var ok = Assert.IsType<OkObjectResult>(res.Result);
            bool isDup = (bool)ok.Value!.GetType().GetProperty("isDuplicate")!.GetValue(ok.Value)!;
            Assert.False(isDup);

            // Add same receipt "105" in Branch 2 -> now Branch 2 clerk sees isDuplicate == true
            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 2,
                BranchID = 2,
                CustomerID = 1,
                FdSchemeID = 1,
                AccountNo = "00240100000001",
                LegacyAccountNumber = "105",
                DepositAmount = 10000m
            });
            await db.SaveChangesAsync();

            var resAfter = await controller.CheckLegacyReceipt(branchId: 2, schemeId: 1, receiptNo: "105");
            var okAfter = Assert.IsType<OkObjectResult>(resAfter.Result);
            bool isDupAfter = (bool)okAfter.Value!.GetType().GetProperty("isDuplicate")!.GetValue(okAfter.Value)!;
            Assert.True(isDupAfter);
        }
    }
}
