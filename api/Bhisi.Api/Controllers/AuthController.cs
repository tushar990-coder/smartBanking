using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [AllowAnonymous]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;

        public AuthController(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        [HttpPost("login")]
        public async Task<ActionResult<LoginResponseDto>> Login(LoginRequestDto request)
        {
            try
            {
                var user = await _context.Users
                    .Include(u => u.Role)
                    .Include(u => u.DefaultBranch)
                    .FirstOrDefaultAsync(u => u.Username == request.Username);

                // Auto-create initial admin if database has no admin account yet
                if (user == null && request.Username == "admin" && request.Password == "Shri@2026")
                {
                    var adminRole = await _context.Roles.FirstOrDefaultAsync(r => r.RoleName == "Admin")
                                    ?? new Role { RoleName = "Admin", Description = "System Administrator" };
                    if (adminRole.RoleID == 0)
                    {
                        _context.Roles.Add(adminRole);
                        await _context.SaveChangesAsync();
                    }

                    user = new User
                    {
                        Username = "admin",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("Shri@2026"),
                        RoleID = adminRole.RoleID,
                        IsActive = true,
                        IsLocked = false,
                        FailedLoginAttempts = 0
                    };
                    _context.Users.Add(user);
                    await _context.SaveChangesAsync();

                    if (user.Role == null && user.RoleID > 0)
                    {
                        user.Role = await _context.Roles.FindAsync(user.RoleID);
                    }
                }

                if (user == null)
                {
                    // Check if logging in as Pigmy Agent
                    var agent = await _context.PigmyAgents
                        .Include(a => a.Branch)
                        .Include(a => a.Customer)
                        .FirstOrDefaultAsync(a => (a.Username == request.Username || (a.Customer != null && a.Customer.MobileNo == request.Username) || a.AgentName == request.Username) && a.Status == "Active");

                    if (agent != null)
                    {
                        bool isAgentPasswordValid = true;
                        if (!string.IsNullOrEmpty(agent.PasswordHash))
                        {
                            isAgentPasswordValid = BCrypt.Net.BCrypt.Verify(request.Password, agent.PasswordHash);
                        }
                        else if (!string.IsNullOrEmpty(agent.Pin))
                        {
                            isAgentPasswordValid = request.Password == agent.Pin;
                        }

                        if (!isAgentPasswordValid)
                        {
                            return Unauthorized("Invalid agent mobile number or password.");
                        }

                        int branchId = agent.BranchID ?? (request.BranchID > 0 ? request.BranchID : 1);
                        var agentBranch = await _context.Branches.FindAsync(branchId) 
                                          ?? await _context.Branches.FirstOrDefaultAsync() 
                                          ?? new Branch { BranchID = 1, BranchName = "Main Branch" };
                        var agentFy = await _context.FinancialYears.FindAsync(request.FinancialYearID) 
                                      ?? await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive) 
                                      ?? await _context.FinancialYears.FirstOrDefaultAsync();

                        var tokenHandlerAgent = new JwtSecurityTokenHandler();
                        var keyStrAgent = _configuration["Jwt:Key"] ?? "super_secret_key_for_bhisi_software_backend_12345!@#";
                        var keyAgent = Encoding.ASCII.GetBytes(keyStrAgent);
                        var tokenDescriptorAgent = new SecurityTokenDescriptor
                        {
                            Subject = new ClaimsIdentity(new[]
                            {
                                new Claim(ClaimTypes.NameIdentifier, agent.PigmyAgentID.ToString()),
                                new Claim(ClaimTypes.Name, agent.AgentName),
                                new Claim(ClaimTypes.Role, "AGENT"),
                                new Claim("agentId", agent.PigmyAgentID.ToString()),
                                new Claim("AgentId", agent.PigmyAgentID.ToString()),
                                new Claim("MobileNo", agent.Customer?.MobileNo ?? string.Empty),
                                new Claim("BranchID", agentBranch.BranchID.ToString()),
                                new Claim("FinancialYearID", (agentFy?.FinancialYearID ?? 1).ToString())
                            }),
                            Expires = DateTime.Now.AddDays(7),
                            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(keyAgent), SecurityAlgorithms.HmacSha256Signature)
                        };
                        var tokenObj = tokenHandlerAgent.CreateToken(tokenDescriptorAgent);
                        var jwtAgent = tokenHandlerAgent.WriteToken(tokenObj);

                        return Ok(new LoginResponseDto
                        {
                            Token = jwtAgent,
                            Username = agent.AgentName,
                            Role = "AGENT",
                            AgentId = agent.PigmyAgentID,
                            MobileNo = agent.Customer?.MobileNo ?? string.Empty,
                            BranchID = agentBranch.BranchID,
                            BranchName = agentBranch.BranchName,
                            FinancialYearID = agentFy?.FinancialYearID ?? 1,
                            FinancialYearCode = agentFy?.YearCode ?? "2026-2027",
                            BusinessDate = DateTime.Today.ToString("yyyy-MM-dd"),
                            RequirePasswordChange = false
                        });
                    }

                    await LogAudit(0, "Failed - User Not Found");
                    return Unauthorized("Invalid username or password.");
                }

            if (user.IsLocked)
            {
                await LogAudit(user.UserID, "Failed - Account Locked");
                return Unauthorized("Your account is locked due to multiple failed login attempts. Please contact Administrator.");
            }

            if (!user.IsActive)
            {
                await LogAudit(user.UserID, "Failed - Account Inactive");
                return Unauthorized("Your account is inactive.");
            }

            string hashToVerify = user.PasswordHash;
            if (!string.IsNullOrEmpty(hashToVerify) && hashToVerify.StartsWith("$2y$"))
            {
                hashToVerify = "$2a$" + hashToVerify.Substring(4);
            }

            bool isPasswordValid = false;
            try
            {
                if (!string.IsNullOrEmpty(hashToVerify) && (hashToVerify.StartsWith("$2a$") || hashToVerify.StartsWith("$2b$") || hashToVerify.StartsWith("$2y$")))
                {
                    isPasswordValid = BCrypt.Net.BCrypt.Verify(request.Password, hashToVerify);
                }
                else if (user.Username == "admin" && request.Password == "Shri@2026")
                {
                    // One-time safe migration for legacy seed hashes
                    user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
                    await _context.SaveChangesAsync();
                    isPasswordValid = true;
                }
            }
            catch (Exception)
            {
                isPasswordValid = false;
            }

            if (!isPasswordValid)
            {
                user.FailedLoginAttempts++;
                if (user.FailedLoginAttempts >= 3)
                {
                    user.IsLocked = true;
                }
                await _context.SaveChangesAsync();
                
                await LogAudit(user.UserID, "Failed - Incorrect Password");
                return Unauthorized("Invalid username or password.");
            }

            // Reset failed attempts on success
            user.FailedLoginAttempts = 0;
            user.LastLoginDate = DateTime.Now;
            
            // Financial Year and Branch Verification
            var fy = await _context.FinancialYears.FindAsync(request.FinancialYearID)
                     ?? await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive)
                     ?? await _context.FinancialYears.FirstOrDefaultAsync();

            var branch = await _context.Branches.FindAsync(request.BranchID)
                         ?? await _context.Branches.FirstOrDefaultAsync();
            
            if (fy == null || branch == null)
            {
                return BadRequest("Invalid Financial Year or Branch selected.");
            }

            request.FinancialYearID = fy.FinancialYearID;
            request.BranchID = branch.BranchID;

            // Fetch active business date from BranchDayEndStatuses
            var activeDateRecord = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == request.BranchID)
                .OrderByDescending(b => b.BusinessDate)
                .FirstOrDefaultAsync();

            DateTime businessDate = activeDateRecord?.BusinessDate ?? fy.StartDate;

            // Create JWT Token
            var tokenHandler = new JwtSecurityTokenHandler();
            var keyStr = _configuration["Jwt:Key"] ?? "super_secret_key_for_bhisi_software_backend_12345!@#";
            var key = Encoding.ASCII.GetBytes(keyStr);
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, user.UserID.ToString()),
                    new Claim(ClaimTypes.Name, user.Username),
                    new Claim(ClaimTypes.Role, user.Role?.RoleName ?? "User"),
                    new Claim("BranchID", request.BranchID.ToString()),
                    new Claim("FinancialYearID", request.FinancialYearID.ToString())
                }),
                Expires = DateTime.Now.AddHours(8),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };
            var token = tokenHandler.CreateToken(tokenDescriptor);
            var jwt = tokenHandler.WriteToken(token);

            user.ActiveSessionToken = jwt;
            await _context.SaveChangesAsync();

            await LogAudit(user.UserID, "Success");

            return Ok(new LoginResponseDto
            {
                Token = jwt,
                Username = user.Username,
                Role = user.Role?.RoleName ?? "User",
                BranchID = request.BranchID,
                BranchName = branch.BranchName,
                FinancialYearID = request.FinancialYearID,
                FinancialYearCode = fy.YearCode,
                BusinessDate = businessDate.ToString("yyyy-MM-dd"),
                RequirePasswordChange = user.RequirePasswordChange
            });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"लॉगिन करताना त्रुटी आली: {ex.Message}");
            }
        }

        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Username) || 
                    string.IsNullOrWhiteSpace(request.CurrentPassword) || 
                    string.IsNullOrWhiteSpace(request.NewPassword))
                {
                    return BadRequest("युझरनेम, चालू पासवर्ड आणि नवीन पासवर्ड आवश्यक आहेत.");
                }

                if (request.NewPassword != request.ConfirmPassword)
                {
                    return BadRequest("नवीन पासवर्ड आणि पुष्टीकरण पासवर्ड जुळत नाहीत.");
                }

                if (request.CurrentPassword == request.NewPassword)
                {
                    return BadRequest("नवीन पासवर्ड चालू पासवर्डपेक्षा वेगळा असावा.");
                }

                // Password complexity check
                if (request.NewPassword.Length < 8 ||
                    !request.NewPassword.Any(char.IsUpper) ||
                    !request.NewPassword.Any(char.IsLower) ||
                    !request.NewPassword.Any(char.IsDigit) ||
                    !request.NewPassword.Any(c => !char.IsLetterOrDigit(c)))
                {
                    return BadRequest("पासवर्ड किमान ८ अक्षरांचा असावा आणि त्यात किमान १ मोठा वर्ण (A-Z), १ लहान वर्ण (a-z), १ अंक (0-9) व १ विशेष चिन्ह (@, #, $, इ.) आवश्यक आहे.");
                }

                var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == request.Username);
                if (user == null)
                {
                    return NotFound("वापरकर्ता आढळला नाही.");
                }

                if (user.IsLocked)
                {
                    return BadRequest("हे खाते लॉक झालेले आहे. कृपया ॲडमिनिस्ट्रेटरशी संपर्क साधा.");
                }

                if (!user.IsActive)
                {
                    return BadRequest("हे खाते निष्क्रिय आहे.");
                }

                string hashToVerify = user.PasswordHash;
                if (!string.IsNullOrEmpty(hashToVerify) && hashToVerify.StartsWith("$2y$"))
                {
                    hashToVerify = "$2a$" + hashToVerify.Substring(4);
                }

                bool isCurrentPasswordValid = false;
                try
                {
                    if (!string.IsNullOrEmpty(hashToVerify) && (hashToVerify.StartsWith("$2a$") || hashToVerify.StartsWith("$2b$") || hashToVerify.StartsWith("$2y$")))
                    {
                        isCurrentPasswordValid = BCrypt.Net.BCrypt.Verify(request.CurrentPassword, hashToVerify);
                    }
                    else if (user.Username == "admin" && request.CurrentPassword == "Shri@2026")
                    {
                        isCurrentPasswordValid = true;
                    }
                }
                catch
                {
                    isCurrentPasswordValid = false;
                }

                if (!isCurrentPasswordValid)
                {
                    return BadRequest("चालू पासवर्ड चुकीचा आहे.");
                }

                // Update password
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
                user.RequirePasswordChange = false;
                user.LastPasswordChangeDate = DateTime.Now;
                user.FailedLoginAttempts = 0;

                // Log into AuditLog
                _context.AuditLogs.Add(new AuditLog
                {
                    UserID = user.UserID,
                    Username = user.Username,
                    Action = "PASSWORD_CHANGE",
                    EntityName = "User",
                    EntityID = user.UserID.ToString(),
                    Timestamp = DateTime.Now,
                    IPAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown",
                    Details = $"Password successfully changed by user {user.Username}",
                    Status = "Success"
                });

                await _context.SaveChangesAsync();

                return Ok(new { message = "पासवर्ड यशस्वीरित्या बदलला आहे!" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"पासवर्ड बदलताना त्रुटी आली: {ex.Message}");
            }
        }

        [HttpPost("switch-branch")]
        public async Task<ActionResult<SwitchBranchResponseDto>> SwitchBranch([FromBody] SwitchBranchRequestDto request)
        {
            try
            {
                var userClaim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("UserID") ?? User.FindFirst("sub");
                if (userClaim == null || !int.TryParse(userClaim.Value, out int userId))
                {
                    return Unauthorized("कृपया पुन्हा लॉगिन करा.");
                }

                var user = await _context.Users
                    .Include(u => u.Role)
                    .FirstOrDefaultAsync(u => u.UserID == userId);

                if (user == null || !user.IsActive || user.IsLocked)
                {
                    return Unauthorized("युझर खाते अवैध किंवा लॉक केलेले आहे.");
                }

                // Strict Role-based access: Only HO/Admin/SuperAdmin/Auditor can switch branches
                string userRole = user.Role?.RoleName ?? "User";
                bool canSwitch = userRole.Equals("Admin", StringComparison.OrdinalIgnoreCase) ||
                                 userRole.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase) ||
                                 userRole.Equals("Super Admin", StringComparison.OrdinalIgnoreCase) ||
                                 userRole.Equals("HeadOffice", StringComparison.OrdinalIgnoreCase) ||
                                 userRole.Equals("HO_Manager", StringComparison.OrdinalIgnoreCase) ||
                                 userRole.Equals("HO Manager", StringComparison.OrdinalIgnoreCase) ||
                                 userRole.Equals("Auditor", StringComparison.OrdinalIgnoreCase);

                if (!canSwitch)
                {
                    return StatusCode(403, "आपल्या पदाला (Role) इतर शाखेत स्विच करण्याची परवानगी नाही. केवळ मुख्य कार्यालय/ॲडमिनला ही परवानगी आहे.");
                }

                var targetBranch = await _context.Branches.FindAsync(request.TargetBranchID);
                if (targetBranch == null || !targetBranch.IsActive)
                {
                    return BadRequest("निवडलेली शाखा अस्तित्वात नाही किंवा निष्क्रिय आहे.");
                }

                var activeFy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive) 
                               ?? await _context.FinancialYears.FirstOrDefaultAsync();

                var activeDateRecord = await _context.BranchDayEndStatuses
                    .Where(b => b.BranchID == request.TargetBranchID)
                    .OrderByDescending(b => b.BusinessDate)
                    .FirstOrDefaultAsync();

                DateTime businessDate = activeDateRecord?.BusinessDate ?? activeFy?.StartDate ?? DateTime.Today;

                var tokenHandler = new JwtSecurityTokenHandler();
                var keyStr = _configuration["Jwt:Key"] ?? "super_secret_key_for_bhisi_software_backend_12345!@#";
                var key = Encoding.ASCII.GetBytes(keyStr);
                var tokenDescriptor = new SecurityTokenDescriptor
                {
                    Subject = new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, user.UserID.ToString()),
                        new Claim(ClaimTypes.Name, user.Username),
                        new Claim(ClaimTypes.Role, userRole),
                        new Claim("BranchID", targetBranch.BranchID.ToString()),
                        new Claim("FinancialYearID", (activeFy?.FinancialYearID ?? 1).ToString())
                    }),
                    Expires = DateTime.Now.AddHours(8),
                    SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
                };
                var token = tokenHandler.CreateToken(tokenDescriptor);
                var jwt = tokenHandler.WriteToken(token);

                user.ActiveSessionToken = jwt;

                _context.AuditLogs.Add(new AuditLog
                {
                    UserID = user.UserID,
                    Username = user.Username,
                    Action = "BRANCH_SWITCH",
                    EntityName = "Branch",
                    EntityID = targetBranch.BranchID.ToString(),
                    Timestamp = DateTime.Now,
                    IPAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown",
                    Details = $"User '{user.Username}' switched operational branch to '{targetBranch.BranchName}' (BranchID: {targetBranch.BranchID})",
                    Status = "Success"
                });

                await _context.SaveChangesAsync();

                return Ok(new SwitchBranchResponseDto
                {
                    Token = jwt,
                    BranchID = targetBranch.BranchID,
                    BranchName = targetBranch.BranchName,
                    BusinessDate = businessDate.ToString("yyyy-MM-dd"),
                    Message = $"शाखा यशस्वीरित्या बदलली: {targetBranch.BranchName}"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"शाखा बदलताना त्रुटी आली: {ex.Message}");
            }
        }

        private async Task LogAudit(int userId, string status)

        {
            if (userId <= 0) return;
            var audit = new UserLoginAudit
            {
                UserID = userId,
                LoginTime = DateTime.Now,
                Status = status,
                IPAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown"
            };
            _context.UserLoginAudits.Add(audit);
            await _context.SaveChangesAsync();
        }
    }
}
