using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Helpers;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Admin,SuperAdmin,Super Admin,SystemAdmin,HeadOffice,HO_Manager,HO Manager")]
    [SkipBranchScope]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public UsersController(AppDbContext context)
        {
            _context = context;
        }

        private static int GetRoleSortOrder(string? roleName)
        {
            if (UserContextExtensions.IsSuperAdminRole(roleName)) return 0;
            if (UserContextExtensions.IsAdminRole(roleName)) return 1;
            string r = (roleName ?? string.Empty).Trim();
            if (r.Equals("HeadOffice", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("HO_Manager", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("HO Manager", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("CEO", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("Chairman", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("GeneralManager", StringComparison.OrdinalIgnoreCase)) return 2;
            if (r.Equals("Manager", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("BranchManager", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("Branch_Manager", StringComparison.OrdinalIgnoreCase)) return 3;
            if (r.Equals("Accountant", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("Officer", StringComparison.OrdinalIgnoreCase)) return 4;
            if (r.Equals("Cashier", StringComparison.OrdinalIgnoreCase)) return 5;
            if (r.Equals("Clerk", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("Operator", StringComparison.OrdinalIgnoreCase)) return 6;
            if (r.Equals("Auditor", StringComparison.OrdinalIgnoreCase)) return 7;
            return 8;
        }

        private async Task EnsureSuperAdminRoleExistsAsync()
        {
            bool exists = await _context.Roles.AnyAsync(r =>
                r.RoleName == "SuperAdmin" ||
                r.RoleName == "Super Admin" ||
                r.RoleCode == "SuperAdmin");

            if (!exists)
            {
                _context.Roles.Add(new Role
                {
                    RoleCode = "SuperAdmin",
                    RoleName = "SuperAdmin",
                    Description = "सर्वोच्च प्रणाली प्रशासक (Master Super Administrator)",
                    IsSystemRole = true,
                    Status = true
                });
                await _context.SaveChangesAsync();
            }
        }

        private async Task<(bool isCallerSuperAdmin, bool canManageSuperAdmin, int callerUserId, string callerRole)> ResolveCallerHierarchyAsync()
        {
            int callerUserId = User?.GetUserId() ?? 0;
            string callerUsername = User?.GetUsername() ?? string.Empty;
            string callerRole = User?.GetUserRole() ?? string.Empty;

            bool isCallerSuperAdmin = UserContextExtensions.IsSuperAdminRole(callerRole);
            if (!isCallerSuperAdmin && callerUserId > 0)
            {
                var dbCallerRole = await _context.Users
                    .AsNoTracking()
                    .Where(u => u.UserID == callerUserId && u.IsActive && !u.IsLocked)
                    .Select(u => u.Role != null ? u.Role.RoleName : null)
                    .FirstOrDefaultAsync();

                if (UserContextExtensions.IsSuperAdminRole(dbCallerRole))
                {
                    isCallerSuperAdmin = true;
                    callerRole = "SuperAdmin";
                }
            }

            if (isCallerSuperAdmin)
            {
                return (true, true, callerUserId, callerRole);
            }

            // Safe Bootstrap Rule: If zero active SuperAdmin accounts exist in DB yet,
            // allow the Master Administrator (UserID == 1 / 'admin', or initial Admin if no 'admin' row exists)
            // to create or promote the very first SuperAdmin.
            bool anyActiveSuperAdminExists = await _context.Users
                .AsNoTracking()
                .Include(u => u.Role)
                .AnyAsync(u => u.IsActive && !u.IsLocked && u.Role != null &&
                               (u.Role.RoleName == "SuperAdmin" ||
                                u.Role.RoleName == "Super Admin" ||
                                u.Role.RoleCode == "SuperAdmin"));

            if (!anyActiveSuperAdminExists)
            {
                bool hasMasterAdminRow = await _context.Users
                    .AsNoTracking()
                    .AnyAsync(u => u.UserID == 1 || u.Username.ToLower() == "admin");

                bool isBootstrapMasterAdmin =
                    callerUserId == 1 ||
                    string.Equals(callerUsername, "admin", StringComparison.OrdinalIgnoreCase) ||
                    (!hasMasterAdminRow && UserContextExtensions.IsAdminRole(callerRole));

                if (isBootstrapMasterAdmin)
                {
                    return (false, true, callerUserId, callerRole);
                }
            }

            return (false, false, callerUserId, callerRole);
        }

        private async Task<int> CountOtherActiveSuperAdminsAsync(int excludeUserId)
        {
            return await _context.Users
                .AsNoTracking()
                .Include(u => u.Role)
                .CountAsync(u => u.UserID != excludeUserId &&
                                 u.IsActive &&
                                 !u.IsLocked &&
                                 u.Role != null &&
                                 (u.Role.RoleName == "SuperAdmin" ||
                                  u.Role.RoleName == "Super Admin" ||
                                  u.Role.RoleCode == "SuperAdmin"));
        }

        // GET: api/Users
        [HttpGet]
        public async Task<ActionResult<IEnumerable<UserDto>>> GetUsers()
        {
            await EnsureSuperAdminRoleExistsAsync();

            var users = await _context.Users
                .Include(u => u.Role)
                .Include(u => u.DefaultBranch)
                .Select(u => new UserDto
                {
                    UserID = u.UserID,
                    Username = u.Username,
                    RoleID = u.RoleID,
                    RoleName = u.Role != null ? u.Role.RoleName : "",
                    DefaultBranchID = u.DefaultBranchID,
                    BranchName = u.DefaultBranch != null ? u.DefaultBranch.BranchName : "",
                    IsActive = u.IsActive,
                    IsLocked = u.IsLocked,
                    FailedLoginAttempts = u.FailedLoginAttempts,
                    RequirePasswordChange = u.RequirePasswordChange,
                    LastLoginDate = u.LastLoginDate
                })
                .ToListAsync();

            return Ok(users);
        }

        // GET: api/Users/Roles
        [HttpGet("Roles")]
        public async Task<ActionResult<IEnumerable<Role>>> GetRoles()
        {
            await EnsureSuperAdminRoleExistsAsync();
            var roles = await _context.Roles
                .Where(r => r.Status)
                .ToListAsync();

            return roles
                .OrderBy(r => GetRoleSortOrder(r.RoleName))
                .ThenBy(r => r.RoleID)
                .ToList();
        }

        // POST: api/Users
        [HttpPost]
        public async Task<ActionResult<UserDto>> CreateUser(CreateUserDto dto)
        {
            string cleanUsername = (dto.Username ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(cleanUsername))
            {
                return BadRequest("युझरनेम प्रविष्ट करणे आवश्यक आहे.");
            }

            if (await _context.Users.AnyAsync(u => u.Username == cleanUsername))
            {
                return BadRequest("Username already exists.");
            }

            var targetRole = await _context.Roles.FindAsync(dto.RoleID);
            if (targetRole == null)
            {
                return BadRequest("अवैध रोल निवडला आहे.");
            }

            var hierarchy = await ResolveCallerHierarchyAsync();
            if (UserContextExtensions.IsSuperAdminRole(targetRole.RoleName) && !hierarchy.canManageSuperAdmin)
            {
                return StatusCode(403, "सुरक्षा नियम: 'SuperAdmin' रोल असलेला नवीन युजर तयार करण्याचा अधिकार फक्त 'SuperAdmin' लाच आहे.");
            }

            if (UserContextExtensions.IsAdminRole(targetRole.RoleName) &&
                !hierarchy.isCallerSuperAdmin &&
                !UserContextExtensions.IsAdminRole(hierarchy.callerRole))
            {
                return StatusCode(403, "सुरक्षा नियम: 'Admin' रोल देण्याचा अधिकार फक्त 'SuperAdmin' किंवा 'Admin' लाच आहे.");
            }

            if (!UserContextExtensions.IsHeadOfficeRole(targetRole.RoleName) && (!dto.DefaultBranchID.HasValue || dto.DefaultBranchID.Value <= 0))
            {
                return BadRequest("शाखा-स्तरीय रोलसाठी (Clerk / Cashier / Manager / Accountant) DefaultBranchID निवडणे अनिवार्य आहे.");
            }

            var user = new User
            {
                Username = cleanUsername,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Welcome@123"), // Default password
                RoleID = dto.RoleID,
                DefaultBranchID = dto.DefaultBranchID,
                IsActive = dto.IsActive,
                RequirePasswordChange = true,
                IsLocked = false,
                FailedLoginAttempts = 0
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            LogUserAudit("USER_CREATE", user.UserID, user.Username, $"Created user '{user.Username}' (Role={targetRole.RoleName}, RoleID={user.RoleID}, BranchID={user.DefaultBranchID})");
            await _context.SaveChangesAsync();

            // Load navigation properties for response
            await _context.Entry(user).Reference(u => u.Role).LoadAsync();
            await _context.Entry(user).Reference(u => u.DefaultBranch).LoadAsync();

            var userDto = new UserDto
            {
                UserID = user.UserID,
                Username = user.Username,
                RoleID = user.RoleID,
                RoleName = user.Role?.RoleName ?? "",
                DefaultBranchID = user.DefaultBranchID,
                BranchName = user.DefaultBranch?.BranchName ?? "",
                IsActive = user.IsActive,
                IsLocked = user.IsLocked,
                FailedLoginAttempts = user.FailedLoginAttempts,
                RequirePasswordChange = user.RequirePasswordChange,
                LastLoginDate = user.LastLoginDate
            };

            return CreatedAtAction(nameof(GetUsers), new { id = user.UserID }, userDto);
        }

        // PUT: api/Users/5
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateUser(int id, UpdateUserDto dto)
        {
            var user = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.UserID == id);
            if (user == null)
            {
                return NotFound();
            }

            string cleanUsername = (dto.Username ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(cleanUsername))
            {
                return BadRequest("युझरनेम प्रविष्ट करणे आवश्यक आहे.");
            }

            // Check if username is changed and already exists
            if (!string.Equals(user.Username, cleanUsername, StringComparison.OrdinalIgnoreCase) &&
                await _context.Users.AnyAsync(u => u.Username == cleanUsername && u.UserID != id))
            {
                return BadRequest("Username already exists.");
            }

            var targetRole = await _context.Roles.FindAsync(dto.RoleID);
            if (targetRole == null)
            {
                return BadRequest("अवैध रोल निवडला आहे.");
            }

            var hierarchy = await ResolveCallerHierarchyAsync();
            bool targetIsCurrentlySuperAdmin = UserContextExtensions.IsSuperAdminRole(user.Role?.RoleName);
            bool targetWillBeSuperAdmin = UserContextExtensions.IsSuperAdminRole(targetRole.RoleName);
            bool isMasterAdminTarget = user.UserID == 1 || string.Equals(user.Username, "admin", StringComparison.OrdinalIgnoreCase);

            // 1. Protect SuperAdmin accounts & SuperAdmin role promotion from non-SuperAdmins
            if ((targetIsCurrentlySuperAdmin || targetWillBeSuperAdmin) && !hierarchy.canManageSuperAdmin)
            {
                return StatusCode(403, "सुरक्षा नियम: 'SuperAdmin' खात्यामध्ये बदल करण्याचा किंवा 'SuperAdmin' रोल देण्याचा अधिकार फक्त 'SuperAdmin' लाच आहे.");
            }

            // 2. Protect Admin accounts from lower-tier HO_Manager edits
            if ((UserContextExtensions.IsAdminRole(user.Role?.RoleName) || UserContextExtensions.IsAdminRole(targetRole.RoleName)) &&
                !hierarchy.isCallerSuperAdmin &&
                !UserContextExtensions.IsAdminRole(hierarchy.callerRole))
            {
                return StatusCode(403, "सुरक्षा नियम: 'Admin' खात्यामध्ये बदल करण्याचा अधिकार फक्त 'SuperAdmin' किंवा 'Admin' लाच आहे.");
            }

            // 3. Prevent self-deactivation
            if (hierarchy.callerUserId > 0 && user.UserID == hierarchy.callerUserId && !dto.IsActive)
            {
                return BadRequest("सुरक्षा नियम: तुम्ही स्वतःचे चालू लॉगिन खाते निष्क्रिय (Deactivate) करू शकत नाही.");
            }

            // 4. Protect Master Administrator ('admin' / UserID=1) from deactivation or username rename
            if (isMasterAdminTarget)
            {
                if (!dto.IsActive)
                {
                    return BadRequest("Master Administrator account cannot be deactivated.");
                }
                if (!hierarchy.isCallerSuperAdmin && hierarchy.callerUserId != user.UserID)
                {
                    return StatusCode(403, "सुरक्षा नियम: मास्टर 'admin' खात्यामध्ये बदल करण्याचा अधिकार फक्त 'SuperAdmin' लाच आहे.");
                }
            }

            // 5. Protect the last remaining active SuperAdmin from being deactivated or demoted
            if (targetIsCurrentlySuperAdmin && (!dto.IsActive || !targetWillBeSuperAdmin))
            {
                int otherActiveSuperAdmins = await CountOtherActiveSuperAdminsAsync(user.UserID);
                if (otherActiveSuperAdmins == 0)
                {
                    return BadRequest("सुरक्षा नियम: सिस्टीममधील शेवटचा एकमेव सक्रिय 'SuperAdmin' युजर निष्क्रिय करता येणार नाही किंवा त्याचा रोल बदलता येणार नाही.");
                }
            }

            if (!UserContextExtensions.IsHeadOfficeRole(targetRole.RoleName) && (!dto.DefaultBranchID.HasValue || dto.DefaultBranchID.Value <= 0))
            {
                return BadRequest("शाखा-स्तरीय रोलसाठी (Clerk / Cashier / Manager / Accountant) DefaultBranchID निवडणे अनिवार्य आहे.");
            }

            user.Username = isMasterAdminTarget && string.Equals(user.Username, "admin", StringComparison.OrdinalIgnoreCase)
                ? user.Username
                : cleanUsername;
            user.RoleID = dto.RoleID;
            user.DefaultBranchID = dto.DefaultBranchID;
            user.IsActive = dto.IsActive;

            try
            {
                await _context.SaveChangesAsync();
                LogUserAudit("USER_UPDATE", user.UserID, user.Username, $"Updated user '{user.Username}' (Role={targetRole.RoleName}, RoleID={user.RoleID}, BranchID={user.DefaultBranchID}, Active={user.IsActive})");
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!UserExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        // POST: api/Users/5/reset-password
        [HttpPost("{id}/reset-password")]
        public async Task<IActionResult> ResetPassword(int id)
        {
            var user = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.UserID == id);
            if (user == null)
            {
                return NotFound();
            }

            var hierarchy = await ResolveCallerHierarchyAsync();
            bool targetIsSuperAdmin = UserContextExtensions.IsSuperAdminRole(user.Role?.RoleName);
            bool isMasterAdminTarget = user.UserID == 1 || string.Equals(user.Username, "admin", StringComparison.OrdinalIgnoreCase);

            if (targetIsSuperAdmin && !hierarchy.isCallerSuperAdmin)
            {
                return StatusCode(403, "सुरक्षा नियम: 'SuperAdmin' खात्याचा पासवर्ड रिसेट करण्याचा अधिकार फक्त 'SuperAdmin' लाच आहे.");
            }

            // Protect master administrator account from accidental reset by non-SuperAdmin
            if (isMasterAdminTarget && !hierarchy.isCallerSuperAdmin)
            {
                return BadRequest("Master Administrator account password cannot be reset from this interface.");
            }

            if (hierarchy.callerUserId > 0 && user.UserID == hierarchy.callerUserId)
            {
                return BadRequest("स्वतःचा पासवर्ड बदलण्यासाठी कृपया 'पासवर्ड बदला (Change Password)' पर्याय वापरा.");
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword("Welcome@123");
            user.RequirePasswordChange = true;
            user.IsLocked = false; // Also unlock the account on reset
            user.FailedLoginAttempts = 0;

            await _context.SaveChangesAsync();
            LogUserAudit("USER_RESET_PASSWORD", user.UserID, user.Username, $"Password reset to 'Welcome@123' for user '{user.Username}'");
            await _context.SaveChangesAsync();

            return Ok(new { message = "Password has been reset to 'Welcome@123'." });
        }

        // POST: api/Users/5/toggle-lock
        [HttpPost("{id}/toggle-lock")]
        public async Task<IActionResult> ToggleLock(int id)
        {
            var user = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.UserID == id);
            if (user == null)
            {
                return NotFound();
            }

            var hierarchy = await ResolveCallerHierarchyAsync();
            bool targetIsSuperAdmin = UserContextExtensions.IsSuperAdminRole(user.Role?.RoleName);
            bool isMasterAdminTarget = user.UserID == 1 || string.Equals(user.Username, "admin", StringComparison.OrdinalIgnoreCase);

            if (targetIsSuperAdmin && !hierarchy.isCallerSuperAdmin)
            {
                return StatusCode(403, "सुरक्षा नियम: 'SuperAdmin' खाते लॉक किंवा अनलॉक करण्याचा अधिकार फक्त 'SuperAdmin' लाच आहे.");
            }

            // Prevent self-lock
            if (hierarchy.callerUserId > 0 && user.UserID == hierarchy.callerUserId && !user.IsLocked)
            {
                return BadRequest("सुरक्षा नियम: तुम्ही स्वतःचे चालू लॉगिन खाते लॉक करू शकत नाही.");
            }

            // Protect master administrator account from lock by non-SuperAdmin
            if (isMasterAdminTarget && !hierarchy.isCallerSuperAdmin)
            {
                return BadRequest("Master Administrator account cannot be locked.");
            }

            // Protect last active SuperAdmin from being locked
            if (targetIsSuperAdmin && !user.IsLocked)
            {
                int otherActiveSuperAdmins = await CountOtherActiveSuperAdminsAsync(user.UserID);
                if (otherActiveSuperAdmins == 0)
                {
                    return BadRequest("सुरक्षा नियम: सिस्टीममधील शेवटचा एकमेव सक्रिय 'SuperAdmin' युजर लॉक करता येणार नाही.");
                }
            }

            user.IsLocked = !user.IsLocked;
            
            // If unlocking, reset failed attempts
            if (!user.IsLocked)
            {
                user.FailedLoginAttempts = 0;
            }

            await _context.SaveChangesAsync();
            LogUserAudit("USER_TOGGLE_LOCK", user.UserID, user.Username, $"User '{user.Username}' account {(user.IsLocked ? "Locked" : "Unlocked")}");
            await _context.SaveChangesAsync();

            return Ok(new { isLocked = user.IsLocked, message = user.IsLocked ? "Account locked." : "Account unlocked." });
        }

        private void LogUserAudit(string action, int targetUserId, string targetUsername, string details)
        {
            try
            {
                var adminUser = User.Identity?.Name 
                                ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value 
                                ?? "Admin";

                _context.AuditLogs.Add(new AuditLog
                {
                    Username = adminUser,
                    Action = action,
                    EntityName = "User",
                    EntityID = targetUserId.ToString(),
                    Timestamp = DateTime.Now,
                    IPAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown",
                    Details = details,
                    Status = "Success"
                });
            }
            catch { }
        }

        private bool UserExists(int id)
        {
            return _context.Users.Any(e => e.UserID == id);
        }
    }
}
