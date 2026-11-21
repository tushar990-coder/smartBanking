using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Bhisi.Api.Data;
using Bhisi.Api.Helpers;
using Bhisi.Api.Models;
using Bhisi.Api.Services;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IJwtTokenService _tokenService;
        private readonly IWebHostEnvironment? _env;

        public AuthController(
            AppDbContext context,
            IConfiguration configuration,
            IJwtTokenService? tokenService = null,
            IWebHostEnvironment? env = null)
        {
            _context = context;
            _configuration = configuration;
            _tokenService = tokenService ?? new JwtTokenService(configuration);
            _env = env;
        }

        [AllowAnonymous]
        [EnableRateLimiting("AuthRateLimit")]
        [HttpPost("login")]
        public async Task<ActionResult<LoginResponseDto>> Login(LoginRequestDto request)
        {
            try
            {
                if (string.Equals(request.LoginAs, "CUSTOMER", StringComparison.OrdinalIgnoreCase))
                {
                    return await LoginCustomerInternalAsync(request);
                }

                var user = await _context.Users
                    .Include(u => u.Role)
                    .Include(u => u.DefaultBranch)
                    .FirstOrDefaultAsync(u => u.Username == request.Username);

                // Auto-create initial admin ONLY in Development when database has no admin account yet
                if (user == null && (_env?.IsDevelopment() ?? false) && request.Username == "admin" && request.Password == "Shri@2026")
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
                        if (agent.IsLocked)
                        {
                            return Unauthorized("आपले एजंट खाते अनेक चुकीच्या प्रयत्नांमुळे लॉक झाले आहे. कृपया शाखेशी संपर्क साधा.");
                        }

                        bool isAgentPasswordValid = false;
                        if (!string.IsNullOrEmpty(agent.PasswordHash))
                        {
                            string agentHash = agent.PasswordHash;
                            if (agentHash.StartsWith("$2y$")) agentHash = "$2a$" + agentHash.Substring(4);
                            try { isAgentPasswordValid = BCrypt.Net.BCrypt.Verify(request.Password, agentHash); }
                            catch { isAgentPasswordValid = false; }
                        }
                        else if (!string.IsNullOrEmpty(agent.Pin))
                        {
                            if (agent.Pin.StartsWith("$2a$") || agent.Pin.StartsWith("$2b$") || agent.Pin.StartsWith("$2y$"))
                            {
                                string pinHash = agent.Pin.StartsWith("$2y$") ? "$2a$" + agent.Pin.Substring(4) : agent.Pin;
                                try { isAgentPasswordValid = BCrypt.Net.BCrypt.Verify(request.Password, pinHash); }
                                catch { isAgentPasswordValid = false; }
                            }
                            else
                            {
                                isAgentPasswordValid = request.Password == agent.Pin;
                                if (isAgentPasswordValid)
                                {
                                    // Auto-upgrade legacy plaintext PIN to BCrypt hash
                                    agent.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
                                    agent.Pin = null;
                                }
                            }
                        }

                        if (!isAgentPasswordValid)
                        {
                            agent.FailedLoginAttempts++;
                            if (agent.FailedLoginAttempts >= 5)
                            {
                                agent.IsLocked = true;
                            }
                            await _context.SaveChangesAsync();
                            return Unauthorized(agent.IsLocked
                                ? "अनेक चुकीच्या प्रयत्नांमुळे एजंट खाते लॉक झाले आहे. कृपया शाखेशी संपर्क साधा."
                                : "Invalid agent mobile number or password.");
                        }

                        if (!agent.BranchID.HasValue || agent.BranchID.Value <= 0)
                        {
                            return BadRequest("या पिग्मी एजंटसाठी शाखा नेमलेली नाही. कृपया मुख्य कार्यालयाकडून शाखा नेमून घ्या.");
                        }

                        if (request.BranchID > 0 && request.BranchID != agent.BranchID.Value)
                        {
                            string assignedBranchName = agent.Branch?.BranchName ?? $"शाखा #{agent.BranchID.Value}";
                            return StatusCode(403, $"आपली नेमणूक '{assignedBranchName}' या शाखेत आहे. आपण इतर शाखेत लॉगिन करू शकत नाही.");
                        }

                        int branchId = agent.BranchID.Value;
                        var agentBranch = await _context.Branches.FindAsync(branchId) 
                                          ?? await _context.Branches.FirstOrDefaultAsync() 
                                          ?? new Branch { BranchID = 1, BranchName = "Main Branch" };
                        var agentFy = await _context.FinancialYears.FindAsync(request.FinancialYearID) 
                                      ?? await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive) 
                                      ?? await _context.FinancialYears.FirstOrDefaultAsync();

                        var agentActiveDateRecord = await _context.BranchDayEndStatuses
                            .Where(b => b.BranchID == branchId && b.BusinessDate.Year >= 2000)
                            .OrderByDescending(b => b.BusinessDate)
                            .FirstOrDefaultAsync();
                        DateTime agentBusinessDate = agentActiveDateRecord != null
                            ? (agentActiveDateRecord.IsDayClosed ? agentActiveDateRecord.BusinessDate.AddDays(1) : agentActiveDateRecord.BusinessDate)
                            : DateTime.Today;

                        var jwtAgent = _tokenService.CreateAgentToken(agent, agentBranch.BranchID, agentFy?.FinancialYearID ?? 1, agentBusinessDate);
                        agent.FailedLoginAttempts = 0;
                        agent.IsLocked = false;
                        agent.ActiveSessionToken = jwtAgent;
                        await _context.SaveChangesAsync();

                        return Ok(new LoginResponseDto
                        {
                            Token = jwtAgent,
                            Username = agent.AgentName,
                            Role = "AGENT",
                            AgentId = agent.PigmyAgentID,
                            MobileNo = agent.Customer?.MobileNo ?? string.Empty,
                            BranchID = agentBranch.BranchID,
                            DefaultBranchID = agentBranch.BranchID,
                            BranchName = agentBranch.BranchName,
                            FinancialYearID = agentFy?.FinancialYearID ?? 1,
                            FinancialYearCode = agentFy?.YearCode ?? "2026-2027",
                            BusinessDate = agentBusinessDate.ToString("yyyy-MM-dd"),
                            RequirePasswordChange = false
                        });
                    }

                    await LogAudit(0, "Failed - User Not Found");
                    return Unauthorized("Invalid username or password.");
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

                // Master Admin emergency fallback ONLY in Development
                if (!isPasswordValid && (_env?.IsDevelopment() ?? false) && string.Equals(user.Username, "admin", StringComparison.OrdinalIgnoreCase) && request.Password == "Shri@2026")
                {
                    user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
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
                
                await LogAudit(user.UserID, user.IsLocked ? "Failed - Account Locked" : "Failed - Incorrect Password");

                if (user.IsLocked)
                {
                    return Unauthorized("Your account is locked due to multiple failed login attempts. Please contact Administrator.");
                }
                return Unauthorized("Invalid username or password.");
            }

            // If password is valid, auto-unlock account and reset failed attempts immediately
            user.IsLocked = false;
            user.FailedLoginAttempts = 0;
            user.LastLoginDate = DateTime.Now;
            await _context.SaveChangesAsync();
            
            // Financial Year and Branch Verification
            var fy = await _context.FinancialYears.FindAsync(request.FinancialYearID)
                     ?? await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive)
                     ?? await _context.FinancialYears.FirstOrDefaultAsync();

            string effectiveRole = user.Role?.RoleName ?? "User";
            bool isHoRole = UserContextExtensions.IsHeadOfficeRole(effectiveRole);

            if (!isHoRole)
            {
                if (!user.DefaultBranchID.HasValue || user.DefaultBranchID.Value <= 0)
                {
                    await LogAudit(user.UserID, "Failed - No Default Branch Assigned");
                    return BadRequest("आपल्या युझर खात्याला कोणतीही शाखा नेमलेली नाही. कृपया मुख्य कार्यालय / ॲडमिनकडून आपल्या खात्याला DefaultBranchID नेमून घ्या.");
                }

                if (request.BranchID > 0 && request.BranchID != user.DefaultBranchID.Value)
                {
                    string assignedBranchName = user.DefaultBranch?.BranchName ?? $"शाखा #{user.DefaultBranchID.Value}";
                    await LogAudit(user.UserID, $"Failed - Cross-Branch Login Blocked (Requested {request.BranchID}, Assigned {user.DefaultBranchID.Value})");
                    return StatusCode(403, $"शाखा सुरक्षा नियम: आपली नेमणूक '{assignedBranchName}' या शाखेत आहे. आपण इतर शाखेत लॉगिन करू शकत नाही.");
                }

                request.BranchID = user.DefaultBranchID.Value;
            }

            var branch = await _context.Branches.FindAsync(request.BranchID)
                         ?? (isHoRole ? await _context.Branches.FirstOrDefaultAsync() : null);
            
            if (fy == null || branch == null || !branch.IsActive)
            {
                return BadRequest("Invalid or Inactive Financial Year / Branch selected.");
            }

            request.FinancialYearID = fy.FinancialYearID;
            request.BranchID = branch.BranchID;

            // Validate Business Date & Day End Status
            DateTime businessDate;
            if (request.BusinessDate.HasValue && request.BusinessDate.Value != default)
            {
                var targetDate = request.BusinessDate.Value.Date;

                // 1. Year Range Validation (2000 to 2099) - Prevents corrupted formats like 0026
                if (targetDate.Year < 2000 || targetDate.Year > 2099)
                {
                    return BadRequest($"अवैध तारीख! वर्ष {targetDate.Year} स्वीकारले जाणार नाही. कृपया योग्य वर्ष (2000 ते 2099 दरम्यान) प्रविष्ट करा.");
                }

                // 2. Financial Year Boundary Validation
                if (targetDate < fy.StartDate.Date || targetDate > fy.EndDate.Date)
                {
                    return BadRequest($"कामकाजाची तारीख ({targetDate:dd/MM/yyyy}) निवडलेल्या आर्थिक वर्षाच्या ({fy.YearCode}: {fy.StartDate:dd/MM/yyyy} ते {fy.EndDate:dd/MM/yyyy}) मर्यादेत असणे आवश्यक आहे.");
                }

                // 3. Check if the requested date is already closed (Day End executed)
                var closedRecord = await _context.BranchDayEndStatuses
                    .FirstOrDefaultAsync(b => b.BranchID == request.BranchID 
                                           && b.BusinessDate.Date == targetDate 
                                           && b.IsDayClosed);
                if (closedRecord != null)
                {
                    return BadRequest($"दिनांक {targetDate:dd/MM/yyyy} चा दिवस आधीच दिवसअखेर (Day End) करून बंद करण्यात आला आहे. बंद तारखेवर लॉगिन करता येणार नाही. कृपया चालू उघडी तारीख निवडा.");
                }

                // 4. Check if the requested date is older than the last closed date
                var lastClosedRecord = await _context.BranchDayEndStatuses
                    .Where(b => b.BranchID == request.BranchID && b.IsDayClosed && b.BusinessDate.Year >= 2000)
                    .OrderByDescending(b => b.BusinessDate)
                    .FirstOrDefaultAsync();

                if (lastClosedRecord != null && targetDate <= lastClosedRecord.BusinessDate.Date)
                {
                    return BadRequest($"दिनांक {targetDate:dd/MM/yyyy} हा शेवटच्या बंद झालेल्या दिवसापेक्षा ({lastClosedRecord.BusinessDate:dd/MM/yyyy}) जुना दिवस आहे. बंद किंवा जुन्या तारखेवर लॉगिन करता येणार नाही.");
                }

                businessDate = targetDate;
            }
            else
            {
                // Default to active open business date from BranchDayEndStatuses
                var activeDateRecord = await _context.BranchDayEndStatuses
                    .Where(b => b.BranchID == request.BranchID)
                    .OrderByDescending(b => b.BusinessDate)
                    .FirstOrDefaultAsync();

                if (activeDateRecord != null && activeDateRecord.IsDayClosed)
                {
                    businessDate = activeDateRecord.BusinessDate.AddDays(1);
                }
                else if (activeDateRecord != null)
                {
                    businessDate = activeDateRecord.BusinessDate;
                }
                else
                {
                    businessDate = fy.StartDate;
                }
            }

            // Ensure sequential active open business date record in BranchDayEndStatuses (NEVER overwrite an unclosed earlier date on login!)
            var lastClosedForBranch = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == request.BranchID && b.IsDayClosed && b.BusinessDate.Year >= 2000)
                .OrderByDescending(b => b.BusinessDate)
                .FirstOrDefaultAsync();

            var oldestUnclosedRecord = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == request.BranchID && !b.IsDayClosed && b.BusinessDate.Year >= 2000
                         && (lastClosedForBranch == null || b.BusinessDate > lastClosedForBranch.BusinessDate))
                .OrderBy(b => b.BusinessDate)
                .FirstOrDefaultAsync();

            if (oldestUnclosedRecord == null)
            {
                DateTime initialOpenDate = lastClosedForBranch != null
                    ? lastClosedForBranch.BusinessDate.Date.AddDays(1)
                    : businessDate.Date;

                oldestUnclosedRecord = new BranchDayEndStatus
                {
                    BranchID = request.BranchID,
                    BusinessDate = initialOpenDate,
                    IsDayClosed = false
                };
                _context.BranchDayEndStatuses.Add(oldestUnclosedRecord);
                await _context.SaveChangesAsync();
            }

            // Create JWT Token
            var jwt = _tokenService.CreateStaffToken(user, request.BranchID, request.FinancialYearID, businessDate);

            user.ActiveSessionToken = jwt;
            await _context.SaveChangesAsync();

            await LogAudit(user.UserID, "Success");

            return Ok(new LoginResponseDto
            {
                Token = jwt,
                Username = user.Username,
                Role = user.Role?.RoleName ?? "User",
                BranchID = request.BranchID,
                DefaultBranchID = user.DefaultBranchID ?? request.BranchID,
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

        [AllowAnonymous]
        [HttpGet("branch-business-date/{branchId}")]
        public async Task<IActionResult> GetBranchBusinessDate(int branchId)
        {
            try
            {
                // Self-healing: Cleanup any corrupt records with Year < 2000
                var corruptRecords = await _context.BranchDayEndStatuses
                    .Where(b => b.BranchID == branchId && b.BusinessDate.Year < 2000)
                    .ToListAsync();
                if (corruptRecords.Any())
                {
                    _context.BranchDayEndStatuses.RemoveRange(corruptRecords);
                    await _context.SaveChangesAsync();
                }

                var lastClosedRecord = await _context.BranchDayEndStatuses
                    .Where(b => b.BranchID == branchId && b.IsDayClosed && b.BusinessDate.Year >= 2000)
                    .OrderByDescending(b => b.BusinessDate)
                    .FirstOrDefaultAsync();

                var oldestUnclosedRecord = await _context.BranchDayEndStatuses
                    .Where(b => b.BranchID == branchId && !b.IsDayClosed && b.BusinessDate.Year >= 2000
                             && (lastClosedRecord == null || b.BusinessDate > lastClosedRecord.BusinessDate))
                    .OrderBy(b => b.BusinessDate)
                    .FirstOrDefaultAsync();

                DateTime businessDate;
                bool isClosed = false;

                if (oldestUnclosedRecord != null)
                {
                    businessDate = oldestUnclosedRecord.BusinessDate;
                }
                else if (lastClosedRecord != null)
                {
                    isClosed = true;
                    businessDate = lastClosedRecord.BusinessDate.AddDays(1);
                }
                else
                {
                    var activeFy = await _context.FinancialYears
                        .FirstOrDefaultAsync(f => f.IsActive);
                    businessDate = activeFy?.StartDate ?? new DateTime(2026, 4, 1);
                }

                return Ok(new
                {
                    branchID = branchId,
                    businessDate = businessDate.ToString("yyyy-MM-dd"),
                    isDayClosed = isClosed,
                    lastClosedDate = lastClosedRecord?.BusinessDate.ToString("yyyy-MM-dd")
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
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
                    else if ((_env?.IsDevelopment() ?? false) && user.Username == "admin" && request.CurrentPassword == "Shri@2026")
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

        [Authorize]
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
                if (!UserContextExtensions.IsHeadOfficeRole(userRole))
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

                DateTime? sessionBusinessDate = null;
                if (Request?.Headers != null && Request.Headers.TryGetValue("X-Business-Date", out var hdrDateVals))
                {
                    var rawHdr = hdrDateVals.FirstOrDefault();
                    if (!string.IsNullOrWhiteSpace(rawHdr) && DateTime.TryParse(rawHdr, out var parsedHdr) && parsedHdr.Year >= 2000)
                    {
                        sessionBusinessDate = parsedHdr.Date;
                    }
                }
                if (!sessionBusinessDate.HasValue)
                {
                    var claimVal = User?.FindFirst("BusinessDate")?.Value;
                    if (!string.IsNullOrWhiteSpace(claimVal) && DateTime.TryParse(claimVal, out var parsedClaim) && parsedClaim.Year >= 2000)
                    {
                        sessionBusinessDate = parsedClaim.Date;
                    }
                }

                var lastClosedRecord = await _context.BranchDayEndStatuses
                    .Where(b => b.BranchID == request.TargetBranchID && b.IsDayClosed && b.BusinessDate.Year >= 2000)
                    .OrderByDescending(b => b.BusinessDate)
                    .FirstOrDefaultAsync();

                var oldestUnclosedRecord = await _context.BranchDayEndStatuses
                    .Where(b => b.BranchID == request.TargetBranchID && !b.IsDayClosed && b.BusinessDate.Year >= 2000
                             && (lastClosedRecord == null || b.BusinessDate > lastClosedRecord.BusinessDate))
                    .OrderBy(b => b.BusinessDate)
                    .FirstOrDefaultAsync();

                DateTime businessDate;
                bool sessionDateClosedInTarget = sessionBusinessDate.HasValue && (
                    (lastClosedRecord != null && sessionBusinessDate.Value <= lastClosedRecord.BusinessDate.Date) ||
                    await _context.BranchDayEndStatuses.AnyAsync(b => b.BranchID == request.TargetBranchID && b.BusinessDate.Date == sessionBusinessDate.Value && b.IsDayClosed));

                if (sessionBusinessDate.HasValue && !sessionDateClosedInTarget)
                {
                    businessDate = sessionBusinessDate.Value;
                }
                else if (oldestUnclosedRecord != null)
                {
                    businessDate = oldestUnclosedRecord.BusinessDate;
                }
                else if (lastClosedRecord != null)
                {
                    businessDate = lastClosedRecord.BusinessDate.AddDays(1);
                }
                else
                {
                    businessDate = activeFy?.StartDate ?? DateTime.Today;
                }

                var jwt = _tokenService.CreateStaffToken(user, targetBranch.BranchID, activeFy?.FinancialYearID ?? 1, businessDate);

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

        private static string NormalizeDigits(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;
            var chars = value.Where(char.IsDigit).ToArray();
            string digits = new string(chars);
            return digits.Length > 10 ? digits.Substring(digits.Length - 10) : digits;
        }

        private static string NormalizeCif(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;
            return value.Replace("-", "").Replace(" ", "").Trim().ToUpperInvariant();
        }

        // Temporary Customer Portal Login (Testing Phase - without SMS OTP)
        private async Task<ActionResult<LoginResponseDto>> LoginCustomerInternalAsync(LoginRequestDto request)
        {
            string cleanId = (request.Username ?? string.Empty).Trim();
            string normDigits = NormalizeDigits(cleanId);
            string normCif = NormalizeCif(cleanId);
            if (string.IsNullOrWhiteSpace(cleanId) || normDigits == "0000000000")
            {
                return BadRequest("कृपया वैध मोबाईल नंबर किंवा CIF क्रमांक प्रविष्ट करा.");
            }

            var candidates = await _context.Customers
                .Include(c => c.Branch)
                .Where(c => !c.IsDeleted && c.Status != null && c.Status.ToUpper() == "ACTIVE" &&
                    ((!string.IsNullOrEmpty(normCif) && c.CIFNo != null && c.CIFNo.Replace("-", "").Replace(" ", "").ToUpper() == normCif) ||
                     (normDigits.Length == 10 && c.MobileNo != null && c.MobileNo.EndsWith(normDigits)) ||
                     (c.MobileNo != null && c.MobileNo == cleanId)))
                .Take(20)
                .ToListAsync();

            var customer = candidates.FirstOrDefault(c => !string.IsNullOrEmpty(normCif) && NormalizeCif(c.CIFNo) == normCif)
                ?? candidates.FirstOrDefault(c => normDigits.Length == 10 && NormalizeDigits(c.MobileNo) == normDigits)
                ?? candidates.FirstOrDefault();

            if (customer == null)
            {
                return Unauthorized("नोंदणीकृत खातेदार आढळला नाही किंवा खाते निष्क्रिय आहे.");
            }

            if (customer.IsPortalLocked)
            {
                return Unauthorized("अनेक चुकीच्या प्रयत्नांमुळे खातेदार लॉगिन लॉक झाले आहे. कृपया शाखेशी संपर्क साधा.");
            }

            bool isValid = false;
            if (!string.IsNullOrEmpty(customer.PortalPinHash))
            {
                string hash = customer.PortalPinHash.StartsWith("$2y$")
                    ? "$2a$" + customer.PortalPinHash.Substring(4)
                    : customer.PortalPinHash;
                try { isValid = BCrypt.Net.BCrypt.Verify(request.Password, hash); }
                catch { isValid = false; }
            }
            else if (!string.IsNullOrWhiteSpace(customer.CIFNo) &&
                     string.Equals(request.Password.Trim(), customer.CIFNo.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                // First-time temporary testing login using CIF No as initial PIN, auto-upgraded to BCrypt
                customer.PortalPinHash = BCrypt.Net.BCrypt.HashPassword(request.Password.Trim());
                isValid = true;
            }
            else
            {
                return Unauthorized("तुमचा पोर्टल mPIN सेट केलेला नाही. कृपया खालील 'तात्पुरता mPIN सेट करा' वापरून मोबाईल व CIF क्र. ने पिन सेट करा.");
            }

            if (!isValid)
            {
                customer.PortalFailedAttempts++;
                if (customer.PortalFailedAttempts >= 5)
                {
                    customer.IsPortalLocked = true;
                }
                await _context.SaveChangesAsync();
                return Unauthorized(customer.IsPortalLocked
                    ? "अनेक चुकीच्या प्रयत्नांमुळे खातेदार लॉगिन लॉक झाले आहे."
                    : "चुकीचा मोबाईल नंबर / CIF किंवा mPIN.");
            }

            return await IssueCustomerTokenResponseAsync(customer, request.BranchID, request.FinancialYearID);
        }

        [AllowAnonymous]
        [EnableRateLimiting("AuthRateLimit")]
        [HttpPost("customer/activate-temp-pin")]
        public async Task<ActionResult<LoginResponseDto>> ActivateCustomerTempPin([FromBody] CustomerTempActivatePinDto dto)
        {
            string mobile = (dto.MobileNo ?? string.Empty).Trim();
            string cif = (dto.CifNo ?? string.Empty).Trim();
            string pin = (dto.NewPin ?? string.Empty).Trim();
            string normMobile = NormalizeDigits(mobile);
            string normCif = NormalizeCif(cif);

            if (string.IsNullOrWhiteSpace(normMobile) || normMobile == "0000000000" || string.IsNullOrWhiteSpace(normCif))
            {
                return BadRequest("कृपया वैध नोंदणीकृत मोबाईल नंबर आणि CIF क्रमांक प्रविष्ट करा.");
            }

            if (pin.Length < 4 || pin.Length > 12)
            {
                return BadRequest("mPIN किमान ४ ते १२ अंकांचा असणे आवश्यक आहे.");
            }

            var candidates = await _context.Customers
                .Include(c => c.Branch)
                .Where(c => !c.IsDeleted && c.Status != null && c.Status.ToUpper() == "ACTIVE" &&
                    c.CIFNo != null && c.CIFNo.Replace("-", "").Replace(" ", "").ToUpper() == normCif)
                .Take(20)
                .ToListAsync();

            var customer = candidates.FirstOrDefault(c =>
                (normMobile.Length == 10 && NormalizeDigits(c.MobileNo) == normMobile) ||
                string.Equals((c.MobileNo ?? string.Empty).Trim(), mobile, StringComparison.Ordinal));

            if (customer == null)
            {
                return Unauthorized("मोबाईल नंबर आणि CIF क्रमांक शाखेच्या नोंदीशी जुळत नाहीत.");
            }

            if (customer.IsPortalLocked)
            {
                return Unauthorized("खातेदार पोर्टल लॉक आहे. कृपया शाखेशी संपर्क साधा.");
            }

            customer.PortalPinHash = BCrypt.Net.BCrypt.HashPassword(pin);
            customer.PortalFailedAttempts = 0;

            return await IssueCustomerTokenResponseAsync(customer, 0, 0);
        }

        [Authorize(Roles = "Admin,SuperAdmin,HeadOffice,HO_Manager,Manager,BranchManager")]
        [HttpPost("customer/{customerId:int}/set-temp-pin")]
        public async Task<IActionResult> AdminSetCustomerTempPin(int customerId, [FromBody] AdminSetCustomerPinDto dto)
        {
            string pin = (dto.Pin ?? string.Empty).Trim();
            if (pin.Length < 4 || pin.Length > 12)
            {
                return BadRequest(new { message = "mPIN किमान ४ ते १२ अंकांचा असावा." });
            }

            var customer = await _context.Customers.FirstOrDefaultAsync(c => c.CustomerID == customerId && !c.IsDeleted);
            if (customer == null) return NotFound(new { message = "खातेदार आढळला नाही." });
            if (!User.CanAccessBranch(customer.BranchID))
            {
                return StatusCode(403, new { message = "इतर शाखेतील खातेदाराचा पिन बदलण्याची परवानगी नाही." });
            }

            customer.PortalPinHash = BCrypt.Net.BCrypt.HashPassword(pin);
            customer.PortalFailedAttempts = 0;
            customer.IsPortalLocked = false;
            customer.PortalSessionToken = null;
            await _context.SaveChangesAsync();

            return Ok(new { message = $"खातेदार '{customer.FullName}' साठी तात्पुरता mPIN यशस्वीरीत्या सेट केला आहे." });
        }

        private async Task<ActionResult<LoginResponseDto>> IssueCustomerTokenResponseAsync(Customer customer, int requestedBranchId, int requestedFyId)
        {
            int branchId = customer.BranchID > 0 ? customer.BranchID : 1;
            if (requestedBranchId > 0 && requestedBranchId != branchId)
            {
                return StatusCode(403, "खातेदार केवळ आपल्या मूळ शाखेतूनच लॉगिन करू शकतो.");
            }

            var branch = await _context.Branches.FindAsync(branchId)
                         ?? await _context.Branches.FirstOrDefaultAsync()
                         ?? new Branch { BranchID = 1, BranchName = "Main Branch" };
            var fy = await _context.FinancialYears.FindAsync(requestedFyId)
                     ?? await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive)
                     ?? await _context.FinancialYears.FirstOrDefaultAsync();

            var dateGuard = new BusinessDateGuardService(_context);
            var (bizDate, _) = await dateGuard.GetBranchBusinessDateAsync(branch.BranchID);

            var jwt = _tokenService.CreateCustomerToken(customer, branch.BranchID, fy?.FinancialYearID ?? 1, bizDate);
            customer.PortalFailedAttempts = 0;
            customer.IsPortalLocked = false;
            customer.PortalSessionToken = jwt;
            await _context.SaveChangesAsync();

            return Ok(new LoginResponseDto
            {
                Token = jwt,
                Username = customer.FullName,
                Role = "CUSTOMER",
                CustomerId = customer.CustomerID,
                CifNo = customer.CIFNo ?? string.Empty,
                MobileNo = customer.MobileNo ?? string.Empty,
                BranchID = branch.BranchID,
                DefaultBranchID = branch.BranchID,
                BranchName = branch.BranchName,
                FinancialYearID = fy?.FinancialYearID ?? 1,
                FinancialYearCode = fy?.YearCode ?? "2026-2027",
                BusinessDate = bizDate.ToString("yyyy-MM-dd"),
                RequirePasswordChange = false
            });
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
