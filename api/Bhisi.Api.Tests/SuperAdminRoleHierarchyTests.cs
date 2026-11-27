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
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class SuperAdminRoleHierarchyTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"BhisiSuperAdmin_{Guid.NewGuid()}")
                .ConfigureWarnings(x => x.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ClaimsPrincipal BuildPrincipal(int userId, string username, string role, int branchId = 1)
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

        private static async Task SeedBaseSansthaWithoutSuperAdminAsync(AppDbContext db)
        {
            db.Branches.AddRange(
                new Branch { BranchID = 1, BranchCode = "001", BranchName = "मुख्य शाखा (Main Branch)", IsActive = true },
                new Branch { BranchID = 2, BranchCode = "002", BranchName = "गोटखिंडी शाखा", IsActive = true }
            );
            db.Roles.AddRange(
                new Role { RoleID = 1, RoleCode = "Admin", RoleName = "Admin", Status = true },
                new Role { RoleID = 2, RoleCode = "Manager", RoleName = "Manager", Status = true },
                new Role { RoleID = 3, RoleCode = "Cashier", RoleName = "Cashier", Status = true }
            );
            db.Users.AddRange(
                new User
                {
                    UserID = 1,
                    Username = "admin",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("Welcome@123"),
                    RoleID = 1,
                    DefaultBranchID = 1,
                    IsActive = true,
                    IsLocked = false
                },
                new User
                {
                    UserID = 2,
                    Username = "second_admin",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("Welcome@123"),
                    RoleID = 1,
                    DefaultBranchID = 1,
                    IsActive = true,
                    IsLocked = false
                }
            );
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task GetRoles_AutoSeedsSuperAdminRole_AndSortsSuperAdminFirst()
        {
            using var db = CreateContext();
            await SeedBaseSansthaWithoutSuperAdminAsync(db);

            var controller = new UsersController(db);
            AttachUser(controller, BuildPrincipal(1, "admin", "Admin"));

            var actionResult = await controller.GetRoles();
            var roles = Assert.IsAssignableFrom<IEnumerable<Role>>(actionResult.Value).ToList();

            Assert.Contains(roles, r => r.RoleName == "SuperAdmin" && r.RoleCode == "SuperAdmin");
            Assert.Equal("SuperAdmin", roles.First().RoleName);
        }

        [Fact]
        public async Task Bootstrap_WhenNoSuperAdminExists_OnlyMasterAdminCanCreateFirstSuperAdmin()
        {
            using var db = CreateContext();
            await SeedBaseSansthaWithoutSuperAdminAsync(db);

            var controller = new UsersController(db);
            await controller.GetRoles();
            var superRole = await db.Roles.SingleAsync(r => r.RoleName == "SuperAdmin");

            // Non-master secondary admin cannot bootstrap SuperAdmin when master 'admin' exists
            AttachUser(controller, BuildPrincipal(2, "second_admin", "Admin"));
            var blockedResult = await controller.CreateUser(new CreateUserDto
            {
                Username = "rogue_super",
                RoleID = superRole.RoleID,
                DefaultBranchID = null,
                IsActive = true
            });
            var forbidden = Assert.IsType<ObjectResult>(blockedResult.Result);
            Assert.Equal(403, forbidden.StatusCode);

            // Master 'admin' (UserID=1) CAN bootstrap the very first SuperAdmin with All-Branches (null DefaultBranchID)
            AttachUser(controller, BuildPrincipal(1, "admin", "Admin"));
            var createdResult = await controller.CreateUser(new CreateUserDto
            {
                Username = "chairman_super",
                RoleID = superRole.RoleID,
                DefaultBranchID = null,
                IsActive = true
            });

            var createdAt = Assert.IsType<CreatedAtActionResult>(createdResult.Result);
            var createdUser = Assert.IsType<UserDto>(createdAt.Value);
            Assert.Equal("chairman_super", createdUser.Username);
            Assert.Equal("SuperAdmin", createdUser.RoleName);
            Assert.Null(createdUser.DefaultBranchID);
        }

        [Fact]
        public async Task PrivilegeEscalationBlocked_OnceSuperAdminExists_RegularAdminCannotCreateEditResetOrLockSuperAdmin()
        {
            using var db = CreateContext();
            await SeedBaseSansthaWithoutSuperAdminAsync(db);

            var controller = new UsersController(db);
            AttachUser(controller, BuildPrincipal(1, "admin", "Admin"));
            await controller.GetRoles();
            var superRole = await db.Roles.SingleAsync(r => r.RoleName == "SuperAdmin");
            var adminRole = await db.Roles.SingleAsync(r => r.RoleName == "Admin");

            // Master admin creates first SuperAdmin
            var createRes = await controller.CreateUser(new CreateUserDto
            {
                Username = "super_root",
                RoleID = superRole.RoleID,
                DefaultBranchID = null,
                IsActive = true
            });
            var superUser = Assert.IsType<UserDto>(Assert.IsType<CreatedAtActionResult>(createRes.Result).Value);

            // Now that an active SuperAdmin exists, even 'admin' (Role = Admin) CANNOT:
            // 1) Create another SuperAdmin
            var secondSuperAttempt = await controller.CreateUser(new CreateUserDto
            {
                Username = "another_super",
                RoleID = superRole.RoleID,
                DefaultBranchID = null,
                IsActive = true
            });
            Assert.Equal(403, Assert.IsType<ObjectResult>(secondSuperAttempt.Result).StatusCode);

            // 2) Self-promote to SuperAdmin
            var selfPromoteAttempt = await controller.UpdateUser(1, new UpdateUserDto
            {
                Username = "admin",
                RoleID = superRole.RoleID,
                DefaultBranchID = 1,
                IsActive = true
            });
            Assert.Equal(403, Assert.IsType<ObjectResult>(selfPromoteAttempt).StatusCode);

            // 3) Demote or edit SuperAdmin
            var demoteSuperAttempt = await controller.UpdateUser(superUser.UserID, new UpdateUserDto
            {
                Username = "super_root",
                RoleID = adminRole.RoleID,
                DefaultBranchID = 1,
                IsActive = true
            });
            Assert.Equal(403, Assert.IsType<ObjectResult>(demoteSuperAttempt).StatusCode);

            // 4) Reset password or Lock SuperAdmin
            var resetSuperAttempt = await controller.ResetPassword(superUser.UserID);
            Assert.Equal(403, Assert.IsType<ObjectResult>(resetSuperAttempt).StatusCode);

            var lockSuperAttempt = await controller.ToggleLock(superUser.UserID);
            Assert.Equal(403, Assert.IsType<ObjectResult>(lockSuperAttempt).StatusCode);
        }

        [Fact]
        public async Task SuperAdminAuthority_CanManageAdmins_AndProtectsSoleActiveSuperAdmin()
        {
            using var db = CreateContext();
            await SeedBaseSansthaWithoutSuperAdminAsync(db);

            var superRole = new Role { RoleID = 10, RoleCode = "SuperAdmin", RoleName = "SuperAdmin", Status = true };
            db.Roles.Add(superRole);
            var superUser = new User
            {
                UserID = 10,
                Username = "superadmin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Welcome@123"),
                RoleID = 10,
                DefaultBranchID = null,
                IsActive = true,
                IsLocked = false
            };
            db.Users.Add(superUser);
            await db.SaveChangesAsync();

            var controller = new UsersController(db);
            AttachUser(controller, BuildPrincipal(10, "superadmin", "SuperAdmin"));

            // SuperAdmin CAN reset password and lock/unlock regular Admin (including UserID=1)
            var resetAdminRes = await controller.ResetPassword(1);
            Assert.IsType<OkObjectResult>(resetAdminRes);

            var lockAdminRes = await controller.ToggleLock(2);
            Assert.IsType<OkObjectResult>(lockAdminRes);
            Assert.True((await db.Users.FindAsync(2))!.IsLocked);

            // Sole active SuperAdmin CANNOT be demoted or deactivated
            var demoteLastSuper = await controller.UpdateUser(10, new UpdateUserDto
            {
                Username = "superadmin",
                RoleID = 1, // Admin
                DefaultBranchID = 1,
                IsActive = true
            });
            Assert.IsType<BadRequestObjectResult>(demoteLastSuper);
        }

        [Fact]
        public void JwtAndBranchHelpers_NormalizeSuperAdminAndGrantFullHeadOfficeScope()
        {
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Jwt:Key"] = "unit_test_secret_key_for_bhisi_software_backend_98765!@#"
                })
                .Build();

            var tokenService = new JwtTokenService(config);
            var userWithSpacedRole = new User
            {
                UserID = 99,
                Username = "chairman",
                Role = new Role { RoleID = 9, RoleCode = "SuperAdmin", RoleName = "Super Admin" },
                DefaultBranchID = null
            };

            string jwt = tokenService.CreateStaffToken(userWithSpacedRole, 1, 1, new DateTime(2026, 11, 27));
            var parsed = new JwtSecurityTokenHandler().ReadJwtToken(jwt);
            string? roleClaim = parsed.Claims.FirstOrDefault(c => c.Type == "role" || c.Type == ClaimTypes.Role)?.Value;

            Assert.Equal("SuperAdmin", roleClaim);

            var principal = BuildPrincipal(99, "chairman", "SuperAdmin", branchId: 1);
            Assert.True(principal.IsSuperAdmin());
            Assert.True(principal.IsHeadOfficeAdmin());
            Assert.Null(principal.ResolveOptionalBranchId(null)); // Consolidated All-Branches allowed
            Assert.Equal(2, principal.ResolveRequiredBranchId(2)); // Cross-branch write allowed
        }
    }
}
