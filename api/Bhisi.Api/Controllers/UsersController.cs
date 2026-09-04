using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    // [Authorize(Roles = "Admin")] // Uncomment when auth is strictly enforced across the app
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public UsersController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/Users
        [HttpGet]
        public async Task<ActionResult<IEnumerable<UserDto>>> GetUsers()
        {
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
            return await _context.Roles.ToListAsync();
        }

        // POST: api/Users
        [HttpPost]
        public async Task<ActionResult<UserDto>> CreateUser(CreateUserDto dto)
        {
            if (await _context.Users.AnyAsync(u => u.Username == dto.Username))
            {
                return BadRequest("Username already exists.");
            }

            var user = new User
            {
                Username = dto.Username,
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
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound();
            }

            // Check if username is changed and already exists
            if (user.Username != dto.Username && await _context.Users.AnyAsync(u => u.Username == dto.Username))
            {
                return BadRequest("Username already exists.");
            }

            user.Username = dto.Username;
            user.RoleID = dto.RoleID;
            user.DefaultBranchID = dto.DefaultBranchID;
            user.IsActive = dto.IsActive;

            try
            {
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
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound();
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword("Welcome@123");
            user.RequirePasswordChange = true;
            user.IsLocked = false; // Also unlock the account on reset
            user.FailedLoginAttempts = 0;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Password has been reset to 'Welcome@123'." });
        }

        // POST: api/Users/5/toggle-lock
        [HttpPost("{id}/toggle-lock")]
        public async Task<IActionResult> ToggleLock(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound();
            }

            user.IsLocked = !user.IsLocked;
            
            // If unlocking, reset failed attempts
            if (!user.IsLocked)
            {
                user.FailedLoginAttempts = 0;
            }

            await _context.SaveChangesAsync();

            return Ok(new { isLocked = user.IsLocked, message = user.IsLocked ? "Account locked." : "Account unlocked." });
        }

        private bool UserExists(int id)
        {
            return _context.Users.Any(e => e.UserID == id);
        }
    }
}
