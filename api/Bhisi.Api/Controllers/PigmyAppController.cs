using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Helpers;
using Bhisi.Api.Models;
using Bhisi.Api.Services;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PigmyAppController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IJwtTokenService? _tokenService;
        private readonly IBusinessDateGuardService _businessDateGuard;
        private readonly IAgentLockService _lockService;

        public PigmyAppController(
            AppDbContext context,
            IJwtTokenService? tokenService = null,
            IBusinessDateGuardService? businessDateGuard = null,
            IAgentLockService? lockService = null)
        {
            _context = context;
            _tokenService = tokenService;
            _businessDateGuard = businessDateGuard ?? new BusinessDateGuardService(context);
            _lockService = lockService ?? new AgentLockService(context);
        }

        private bool IsAgentRole()
        {
            var roleClaim = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role)?.Value ?? string.Empty;
            return string.Equals(roleClaim, "AGENT", StringComparison.OrdinalIgnoreCase);
        }

        private int ResolveAuthorizedAgentId(int? requestedAgentId = null, int headerAgentId = 0)
        {
            var roleClaim = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role)?.Value ?? string.Empty;
            if (string.Equals(roleClaim, "CUSTOMER", StringComparison.OrdinalIgnoreCase))
            {
                return 0;
            }

            var jwtClaim = User.Claims.FirstOrDefault(c => c.Type == "agentId" || c.Type == "AgentId")?.Value
                ?? (IsAgentRole() ? User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)?.Value : null);
            int tokenAgentId = int.TryParse(jwtClaim, out int tid) ? tid : 0;

            if (IsAgentRole())
            {
                return tokenAgentId;
            }

            if (requestedAgentId.HasValue && requestedAgentId.Value > 0) return requestedAgentId.Value;
            if (tokenAgentId > 0) return tokenAgentId;
            if (headerAgentId > 0) return headerAgentId;
            return 0;
        }

        public class LoginRequest
        {
            [Required(ErrorMessage = "युझरनेम आवश्यक आहे.")]
            public string Username { get; set; } = string.Empty;

            [Required(ErrorMessage = "पासवर्ड आवश्यक आहे.")]
            public string Password { get; set; } = string.Empty;
        }

        // POST: api/PigmyApp/Login
        [AllowAnonymous]
        [EnableRateLimiting("AuthRateLimit")]
        [HttpPost("Login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var agent = await _context.PigmyAgents
                .Include(a => a.Customer)
                .Include(a => a.Branch)
                .FirstOrDefaultAsync(a => (a.Username == request.Username || (a.Customer != null && a.Customer.MobileNo == request.Username)) && a.Status == "Active");
            
            if (agent == null)
            {
                return Unauthorized(new { message = "अवैध युझरनेम किंवा एजंट सक्रिय नाही." });
            }

            if (agent.IsLocked)
            {
                return Unauthorized(new { message = "आपले एजंट खाते अनेक चुकीच्या प्रयत्नांमुळे लॉक झाले आहे. कृपया शाखेशी संपर्क साधा." });
            }

            bool isPasswordValid = false;
            if (!string.IsNullOrEmpty(agent.PasswordHash))
            {
                string hash = agent.PasswordHash.StartsWith("$2y$") ? "$2a$" + agent.PasswordHash.Substring(4) : agent.PasswordHash;
                try { isPasswordValid = BCrypt.Net.BCrypt.Verify(request.Password, hash); }
                catch { isPasswordValid = false; }
            }

            if (!isPasswordValid)
            {
                agent.FailedLoginAttempts++;
                if (agent.FailedLoginAttempts >= 5) agent.IsLocked = true;
                await _context.SaveChangesAsync();
                return Unauthorized(new { message = "चुकीचा पासवर्ड." });
            }

            if (_tokenService == null)
            {
                return StatusCode(500, new { message = "JWT token service is not configured." });
            }

            int branchId = agent.BranchID ?? 1;
            var fy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive)
                ?? await _context.FinancialYears.FirstOrDefaultAsync();
            var (businessDate, _) = await _businessDateGuard.GetBranchBusinessDateAsync(branchId);

            string jwt = _tokenService.CreateAgentToken(agent, branchId, fy?.FinancialYearID ?? 1, businessDate);
            agent.FailedLoginAttempts = 0;
            agent.IsLocked = false;
            agent.ActiveSessionToken = jwt;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                agentId = agent.PigmyAgentID,
                agentName = agent.AgentName,
                username = agent.Username,
                mobileNo = agent.Customer?.MobileNo ?? string.Empty,
                branchId = agent.BranchID,
                branchName = agent.Branch?.BranchName ?? "",
                businessDate = businessDate.ToString("yyyy-MM-dd"),
                token = jwt
            });
        }

        public class ChangePasswordRequest
        {
            [Required]
            public string OldPassword { get; set; } = string.Empty;

            [Required]
            [MinLength(6, ErrorMessage = "पासवर्ड किमान ६ अक्षरांचा असावा.")]
            public string NewPassword { get; set; } = string.Empty;
        }

        // POST: api/PigmyApp/ChangePassword
        [HttpPost("ChangePassword")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, [FromHeader(Name = "X-Agent-Id")] int headerAgentId)
        {
            int agentId = ResolveAuthorizedAgentId(null, headerAgentId);
            if (agentId <= 0) return Unauthorized(new { message = "वैध Agent JWT टोकन आवश्यक आहे." });

            var agent = await _context.PigmyAgents.FirstOrDefaultAsync(a => a.PigmyAgentID == agentId);
            if (agent == null) return NotFound(new { message = "एजंट सापडला नाही." });
            if (agent.Status != "Active") return Unauthorized(new { message = "एजंट सक्रिय नाही." });

            if (string.IsNullOrEmpty(agent.PasswordHash))
            {
                // If there's no old password set yet, don't allow change via this API, or just fail verification.
                return BadRequest(new { message = "जुना पासवर्ड सेट केलेला नाही. कृपया ॲडमिनशी संपर्क साधा." });
            }

            try
            {
                bool isValidOldPassword = BCrypt.Net.BCrypt.Verify(request.OldPassword, agent.PasswordHash);
                if (!isValidOldPassword)
                {
                    return BadRequest(new { message = "जुना पासवर्ड चुकीचा आहे." });
                }

                agent.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "पासवर्ड यशस्वीरीत्या बदलला!" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "पासवर्ड बदलताना सर्व्हर त्रुटी आली: " + ex.Message });
            }
        }

        // GET: api/PigmyApp/Dashboard
        [HttpGet("Dashboard")]
        public async Task<IActionResult> GetDashboard([FromHeader(Name = "X-Agent-Id")] int headerAgentId)
        {
            int agentId = ResolveAuthorizedAgentId(null, headerAgentId);
            if (agentId <= 0) return Unauthorized("Valid Agent JWT token required.");

            var today = _businessDateGuard.GetIstToday();

            // Today's Collection
            var todaysCollections = await _context.PigmyCollections
                .Where(c => c.AgentId == agentId && c.CollectionDate >= today && c.CollectionDate < today.AddDays(1))
                .ToListAsync();

            var todaysCollectionAmount = todaysCollections.Sum(c => c.CollectionAmount);
            var totalReceipts = todaysCollections.Count;

            var allCollections = await _context.PigmyCollections
                .Where(c => c.AgentId == agentId && c.CollectionDate < today)
                .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;

            var historicalDeposits = await _context.PigmyAgentCashDeposits
                .Where(d => d.AgentId == agentId && d.DepositDate < today)
                .SumAsync(d => (decimal?)d.Amount) ?? 0m;

            var openingBalance = allCollections - historicalDeposits;
            var closingBalance = openingBalance + todaysCollectionAmount;

            return Ok(new
            {
                date = today.ToString("yyyy-MM-dd"),
                openingBalance = openingBalance,
                todaysCollection = todaysCollectionAmount,
                totalReceipts = totalReceipts,
                closingBalance = closingBalance
            });
        }

        // GET: api/PigmyApp/Accounts
        [HttpGet("Accounts")]
        public async Task<IActionResult> GetAssignedAccounts([FromHeader(Name = "X-Agent-Id")] int headerAgentId)
        {
            int agentId = ResolveAuthorizedAgentId(null, headerAgentId);
            if (agentId <= 0) return Unauthorized("Valid Agent JWT token required.");

            var accounts = await _context.PigmyAccounts
                .Include(a => a.Customer)
                .Where(a => a.PigmyAgentID == agentId && a.Status == "Active")
                .Select(a => new
                {
                    a.PigmyAccountID,
                    a.AccountNo,
                    CustomerName = a.Customer != null ? (a.Customer.FirstName + (string.IsNullOrWhiteSpace(a.Customer.MiddleName) ? "" : " " + a.Customer.MiddleName) + (string.IsNullOrWhiteSpace(a.Customer.LastName) ? "" : " " + a.Customer.LastName)).Trim() : "",
                    MemberName = a.Customer != null ? (a.Customer.FirstName + (string.IsNullOrWhiteSpace(a.Customer.MiddleName) ? "" : " " + a.Customer.MiddleName) + (string.IsNullOrWhiteSpace(a.Customer.LastName) ? "" : " " + a.Customer.LastName)).Trim() : "",
                    MobileNo = a.Customer != null ? a.Customer.MobileNo : "",
                    CurrentBalance = a.TotalDepositedAmount
                })
                .ToListAsync();

            return Ok(accounts);
        }

        // ==================== NEW ANDROID API ENDPOINTS ====================

        public class CreateCustomerDto
        {
            [Required]
            public string FirstName { get; set; } = string.Empty;
            public string? MiddleName { get; set; }
            [Required]
            public string LastName { get; set; } = string.Empty;
            [Required]
            public string MobileNo { get; set; } = string.Empty;
            public string? AadhaarNo { get; set; }
            public string? Address { get; set; }
            public string? Gender { get; set; } = "Male";
            public int BranchID { get; set; } = 1;
            public int? AgentId { get; set; }
        }

        // 1. POST: api/PigmyApp/CreateCustomer
        [HttpPost("CreateCustomer")]
        [Authorize(Roles = "Admin,SuperAdmin,HeadOffice,HO_Manager,Manager,BranchManager,Clerk")]
        public async Task<IActionResult> CreateCustomer(
            [FromBody] CreateCustomerDto dto,
            [FromHeader(Name = "X-Agent-Id")] int headerAgentId)
        {
            int agentId = ResolveAuthorizedAgentId(dto.AgentId, headerAgentId);
            if (agentId <= 0) return Unauthorized("वैध AgentId पुरवा.");

            var agent = await _context.PigmyAgents.FirstOrDefaultAsync(a => a.PigmyAgentID == agentId);
            if (agent == null) return BadRequest("नियुक्त एजंट सापडला नाही.");

            int branchId = User.ResolveBranchId(dto.BranchID > 0 ? dto.BranchID : agent.BranchID);
            int creatorUserId = IsAgentRole() ? 1 : User.GetUserId();

            var (businessDate, _) = await _businessDateGuard.GetBranchBusinessDateAsync(branchId);
            if (await _businessDateGuard.IsDateClosedAsync(branchId, businessDate))
            {
                return Conflict(new { message = $"दिनांक {businessDate:dd/MM/yyyy} चा दिवस Day-End ने बंद केला आहे. बंद तारखेवर नवीन खाते उघडता येणार नाही." });
            }

            var closedFy = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(fy => fy.IsClosed && businessDate.Date >= fy.StartDate.Date && businessDate.Date <= fy.EndDate.Date);
            if (closedFy != null)
            {
                return BadRequest(new { message = $"शाखेची चालू तारीख ({businessDate:dd/MM/yyyy}) बंद आर्थिक वर्षात ({closedFy.YearCode}) मोडते. नवीन ग्राहक/खाते उघडता येणार नाही." });
            }

            string? aadhaar = string.IsNullOrWhiteSpace(dto.AadhaarNo)
                ? null
                : dto.AadhaarNo.Trim().Replace(" ", "").Replace("-", "");
            if (!string.IsNullOrEmpty(aadhaar))
            {
                if (!KycValidationHelper.IsValidAadhaar(aadhaar, out var aadhaarError))
                {
                    return BadRequest(new { message = aadhaarError ?? "आधार क्रमांक वैध नाही." });
                }

                var dupCustomer = await _context.Customers
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => !c.IsDeleted && c.AadhaarNo != null &&
                        c.AadhaarNo.Replace(" ", "").Replace("-", "") == aadhaar);
                if (dupCustomer != null)
                {
                    return BadRequest(new { message = $"हा आधार क्रमांक ({aadhaar}) आधीच खातेदार '{dupCustomer.FirstName} {dupCustomer.LastName}' (CIF: {dupCustomer.CIFNo}) यांच्या नावे नोंदवला आहे. कृपया नवीन ग्राहक नोंदणीऐवजी विद्यमान खातेदारावर खाते उघडा." });
                }
            }

            var scheme = await _context.PigmySchemes
                .Where(s => s.Status == "Active")
                .OrderBy(s => s.PigmySchemeID)
                .FirstOrDefaultAsync();
            if (scheme == null)
            {
                return BadRequest(new { message = "कोणतीही सक्रिय (Active) पिग्मी योजना आढळली नाही. कृपया प्रथम पिग्मी योजना सुरू करा." });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Create Customer record using active branch CBS BusinessDate
                var customer = new Customer
                {
                    BranchID = branchId,
                    FirstName = dto.FirstName.Trim(),
                    MiddleName = dto.MiddleName?.Trim(),
                    LastName = dto.LastName.Trim(),
                    MobileNo = dto.MobileNo.Trim(),
                    AadhaarNo = aadhaar,
                    Address = dto.Address?.Trim(),
                    Gender = dto.Gender ?? "Male",
                    RegistrationDate = businessDate,
                    CreatedBy = creatorUserId,
                    CreatedOn = DateTime.UtcNow,
                    Status = "Active",
                    IsDeleted = false
                };

                _context.Customers.Add(customer);
                await _context.SaveChangesAsync();

                // Assign Standard 1-to-1 CBS CIF (e.g. CIF000123)
                string standardCif = $"CIF{customer.CustomerID:D6}";
                customer.CIFNo = !await _context.Customers.AnyAsync(c => c.CustomerID != customer.CustomerID && c.CIFNo == standardCif)
                    ? standardCif
                    : await Bhisi.Api.Helpers.AccountNumberHelper.GenerateUniqueCifAsync(_context);
                await _context.SaveChangesAsync();

                // Generate CBS Standard 14-digit Account Number
                var accountNo = await Bhisi.Api.Helpers.AccountNumberHelper.GenerateNextPigmyAccountNo(
                    _context, 
                    branchId, 
                    scheme.PigmySchemeID, 
                    incrementSequence: true
                );

                // Create Pigmy Account on CBS BusinessDate with scheme InterestRate & DurationMonths
                var pigmyAccount = new PigmyAccount
                {
                    AccountNo = accountNo,
                    CustomerID = customer.CustomerID,
                    BranchID = branchId,
                    PigmySchemeID = scheme.PigmySchemeID,
                    PigmyAgentID = agentId,
                    OpeningDate = businessDate,
                    MaturityDate = businessDate.AddMonths(scheme.DurationMonths > 0 ? scheme.DurationMonths : 12),
                    InterestRate = scheme.InterestRate,
                    TotalDepositedAmount = 0m,
                    Status = "Active",
                    CreatedBy = creatorUserId,
                    CreatedDate = DateTime.UtcNow
                };

                _context.PigmyAccounts.Add(pigmyAccount);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                return Ok(new
                {
                    success = true,
                    message = "नवीन पिग्मी ग्राहक व खाते यशस्वीरीत्या उघडले गेले!",
                    customerId = customer.CustomerID,
                    memberId = customer.CustomerID,
                    cifNo = customer.CIFNo,
                    pigmyAccountId = pigmyAccount.PigmyAccountID,
                    accountNo = pigmyAccount.AccountNo,
                    openingDate = pigmyAccount.OpeningDate.ToString("yyyy-MM-dd"),
                    maturityDate = pigmyAccount.MaturityDate.ToString("yyyy-MM-dd"),
                    customerName = $"{customer.FirstName} {customer.LastName}".Trim(),
                    memberName = $"{customer.FirstName} {customer.LastName}".Trim(),
                    mobileNo = customer.MobileNo,
                    status = pigmyAccount.Status
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "ग्राहक उघडताना त्रुटी आली: " + ex.Message);
            }
        }

        // 2. GET: api/PigmyApp/CollectionStatus
        [HttpGet("CollectionStatus")]
        public async Task<IActionResult> GetCollectionStatus([FromHeader(Name = "X-Agent-Id")] int headerAgentId, [FromQuery] int? agentId)
        {
            int targetAgentId = ResolveAuthorizedAgentId(agentId, headerAgentId);
            if (targetAgentId <= 0) return Unauthorized("Valid Agent JWT token required.");

            var today = _businessDateGuard.GetIstToday();
            var day1 = today.AddDays(-1); // Yesterday
            var day2 = today.AddDays(-2); // Day before yesterday

            var last2Days = new List<DateTime> { day2, day1 };
            int pendingDaysCount = 0;
            var detailsList = new List<object>();

            foreach (var date in last2Days)
            {
                var nextDate = date.AddDays(1);

                // Total collected on date
                var totalCollected = await _context.PigmyCollections
                    .Where(c => c.AgentId == targetAgentId && c.CollectionDate >= date && c.CollectionDate < nextDate)
                    .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;

                // Total remitted to branch on date
                var totalRemitted = await _context.PigmyAgentCashDeposits
                    .Where(d => d.AgentId == targetAgentId && d.DepositDate >= date && d.DepositDate < nextDate)
                    .SumAsync(d => (decimal?)d.Amount) ?? 0m;

                var pendingCash = totalCollected - totalRemitted;
                bool dayPending = totalCollected > 0 && pendingCash > 0;

                if (dayPending)
                {
                    pendingDaysCount++;
                }

                detailsList.Add(new
                {
                    date = date.ToString("yyyy-MM-dd"),
                    totalCollected = totalCollected,
                    totalRemitted = totalRemitted,
                    pendingCash = pendingCash > 0 ? pendingCash : 0m,
                    isSubmitted = !dayPending
                });
            }

            // Lock ONLY if 2 or more distinct past days have unremitted collections
            bool isPendingRemittance = pendingDaysCount >= 2;
            int collectPigmiStatus = isPendingRemittance ? 0 : 1;
            int pendingFlag = isPendingRemittance ? 1 : 0;

            string statusMessage = isPendingRemittance
                ? "मागील २ दिवसांचे पिग्मी संकलन शाखेत जमा केलेले नाही. कृपया आधी शाखेत कॅश जमा करा."
                : "कमिशन व पिग्मी कलेक्शनसाठी एजंट अधिकृत आहे.";

            return Ok(new
            {
                agentId = targetAgentId,
                collect_Pigmi = collectPigmiStatus,
                is_pending = pendingFlag,
                status = collectPigmiStatus == 1 ? "ALLOWED" : "LOCKED",
                message = statusMessage,
                previousDaysCollectionDetails = detailsList
            });
        }

        public class AppCollectionItemDto
        {
            public int PigmyAccountId { get; set; }
            public int? AccountId { get; set; }
            public string? AccountNo { get; set; }
            public string? OldAccountNo { get; set; }
            public string? TransactionId { get; set; }
            [Required]
            public decimal CollectionAmount { get; set; }
            public DateTime? CollectionDate { get; set; }
            public string? ReceiptNo { get; set; }
            public string? PaymentMode { get; set; }
            public int? BankLedgerId { get; set; }
        }

        public class BulkAppCollectionRequest
        {
            public int? AgentId { get; set; }
            public string? PaymentMode { get; set; }
            public int? BankLedgerId { get; set; }
            public List<AppCollectionItemDto> Items { get; set; } = new List<AppCollectionItemDto>();
        }

        // GET: api/PigmyApp/Agents/{agentId}/remittance-status
        [HttpGet("Agents/{agentId}/remittance-status")]
        public async Task<IActionResult> GetRemittanceStatus(int agentId)
        {
            if (agentId <= 0) return BadRequest("वैध AgentId पुरवा.");

            var agent = await _context.PigmyAgents.FindAsync(agentId);
            if (agent == null) return NotFound("एजंट सापडला नाही.");

            var totalCollected = await _context.PigmyCollections
                .Where(c => c.AgentId == agentId)
                .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;

            var totalRemitted = await _context.PigmyAgentCashDeposits
                .Where(d => d.AgentId == agentId)
                .SumAsync(d => (decimal?)d.Amount) ?? 0m;

            var pendingCashInHand = totalCollected - totalRemitted;
            if (pendingCashInHand < 0) pendingCashInHand = 0;

            bool isLocked = pendingCashInHand > agent.MaxCashLimit;

            // Also check 2-day lock: count distinct past days that have unremitted collections
            var today = _businessDateGuard.GetIstToday();
            int pastPendingDaysCount = 0;
            int lockDaysToCheck = agent.MaxLockDays > 0 ? agent.MaxLockDays : 2;

            for (int i = lockDaysToCheck; i >= 1; i--)
            {
                var pastDate = today.AddDays(-i);
                var nextPastDate = pastDate.AddDays(1);

                var dayCollected = await _context.PigmyCollections
                    .Where(c => c.AgentId == agentId && c.CollectionDate >= pastDate && c.CollectionDate < nextPastDate)
                    .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;

                var dayRemitted = await _context.PigmyAgentCashDeposits
                    .Where(d => d.AgentId == agentId && d.DepositDate >= pastDate && d.DepositDate < nextPastDate)
                    .SumAsync(d => (decimal?)d.Amount) ?? 0m;

                if (dayCollected > 0 && (dayCollected - dayRemitted) > 0)
                {
                    pastPendingDaysCount++;
                }
            }

            if (pastPendingDaysCount >= lockDaysToCheck)
            {
                isLocked = true;
            }

            return Ok(new
            {
                agentId = agent.PigmyAgentID,
                agentName = agent.AgentName,
                dailyLimit = agent.MaxCashLimit,
                pendingCashInHand = pendingCashInHand,
                isLocked = isLocked,
                maxLockDays = agent.MaxLockDays
            });
        }

        // 3. POST: api/PigmyApp/BulkCollection
        [HttpPost("BulkCollection")]
        public async Task<IActionResult> BulkCollection(
            [FromBody] BulkAppCollectionRequest request,
            [FromHeader(Name = "X-Agent-Id")] int headerAgentId)
        {
            int agentId = ResolveAuthorizedAgentId(request.AgentId, headerAgentId);
            if (agentId <= 0) return Unauthorized("Valid Agent JWT token required.");

            if (request.Items == null || request.Items.Count == 0)
            {
                return BadRequest("जमा करण्यासाठी कोणतीही खाती पाठवलेली नाहीत.");
            }

            // Step 1: Validate unified AgentLockService (Cash limit + Multi-Product IST MaxLockDays)
            var lockStatus = await _lockService.GetLockStatusAsync(agentId);
            if (lockStatus.IsLocked)
            {
                return StatusCode(403, new
                {
                    collect_Pigmi = 0,
                    is_pending = 1,
                    message = lockStatus.Message
                });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                int savedCount = 0;
                decimal totalCollectionAmount = 0m;
                var savedReceipts = new List<object>();

                foreach (var item in request.Items)
                {
                    if (item.CollectionAmount <= 0) continue;

                    int targetId = item.PigmyAccountId > 0 ? item.PigmyAccountId : (item.AccountId ?? 0);
                    PigmyAccount? account = null;

                    if (targetId > 0)
                    {
                        account = await _context.PigmyAccounts.FirstOrDefaultAsync(a => a.PigmyAccountID == targetId && a.PigmyAgentID == agentId);
                    }
                    if (account == null && !string.IsNullOrWhiteSpace(item.OldAccountNo))
                    {
                        string cleanOld = item.OldAccountNo.Trim();
                        account = await _context.PigmyAccounts.FirstOrDefaultAsync(a => a.PigmyAgentID == agentId &&
                            (a.OldAccountNo == cleanOld || a.LegacyAccountNumber == cleanOld || a.PreviousAccountNo == cleanOld));
                    }
                    if (account == null && !string.IsNullOrWhiteSpace(item.AccountNo))
                    {
                        string cleanAcc = item.AccountNo.Trim();
                        account = await _context.PigmyAccounts.FirstOrDefaultAsync(a => a.AccountNo == cleanAcc && a.PigmyAgentID == agentId);
                    }

                    if (account == null || account.Status != "Active") continue;

                    var dateCheck = await _businessDateGuard.ValidateCollectionDateAsync(account.BranchID, item.CollectionDate, isOfflineSync: true);
                    DateTime collDate = dateCheck.EffectiveCollectionDate;
                    
                    string receiptNo = !string.IsNullOrWhiteSpace(item.ReceiptNo) 
                        ? item.ReceiptNo 
                        : $"PG-AGT-{agentId}-{collDate:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}";

                    // Check if collection with this ReceiptNo already exists (Idempotency Check)
                    var existingReceipt = await _context.PigmyCollections.FirstOrDefaultAsync(c =>
                        c.ReceiptNo == receiptNo);

                    if (existingReceipt != null)
                    {
                        // Duplicate received. Do not process accounting again, just return success for this item.
                        savedReceipts.Add(new
                        {
                            pigmyAccountId = account.PigmyAccountID,
                            accountNo = account.AccountNo,
                            oldAccountNo = account.OldAccountNo ?? account.LegacyAccountNumber ?? account.PreviousAccountNo ?? "",
                            receiptNo = receiptNo,
                            amount = existingReceipt.CollectionAmount,
                            newBalance = account.TotalDepositedAmount,
                            duplicate_ignored = true
                        });
                        continue;
                    }

                    decimal prevOpening = account.TotalDepositedAmount;
                    decimal addedAmount = item.CollectionAmount;

                    var newColl = new PigmyCollection
                    {
                        PigmyAccountId = account.PigmyAccountID,
                        AgentId = agentId,
                        CollectionDate = collDate,
                        OpeningBalance = prevOpening,
                        CollectionAmount = addedAmount,
                        ClosingBalance = prevOpening + addedAmount,
                        ReceiptNo = receiptNo,
                        PaymentMode = string.IsNullOrWhiteSpace(item.PaymentMode) ? (string.IsNullOrWhiteSpace(request.PaymentMode) ? "CASH" : request.PaymentMode.Trim().ToUpperInvariant()) : item.PaymentMode.Trim().ToUpperInvariant(),
                        CollectionSource = "APP",
                        TransactionId = string.IsNullOrWhiteSpace(item.TransactionId) ? Guid.NewGuid().ToString("N") : item.TransactionId.Trim(),
                        SyncReferenceId = string.IsNullOrWhiteSpace(item.TransactionId) ? receiptNo : item.TransactionId.Trim(),
                        CreatedBy = agentId,
                        CreatedOn = DateTime.UtcNow
                    };
                    _context.PigmyCollections.Add(newColl);

                    // Update Account Total Balance
                    account.TotalDepositedAmount += addedAmount;
                    _context.PigmyAccounts.Update(account);

                    // Add Ledger Transaction
                    var pigmyTx = new PigmyTransaction
                    {
                        PigmyAccountID = account.PigmyAccountID,
                        TransactionDate = collDate,
                        ValueDate = collDate,
                        TransactionType = "DEPOSIT",
                        DrAmount = 0m,
                        CrAmount = addedAmount,
                        BalanceAmount = account.TotalDepositedAmount,
                        Narration = $"Pigmy Collection via Mobile App (Receipt: {receiptNo})"
                    };
                    _context.PigmyTransactions.Add(pigmyTx);

                    // No voucher generated on mobile sync; voucher will be generated when agent deposits cash at the branch.
                    newColl.Voucher = null;
                    newColl.VoucherId = null;
                    newColl.IsVoucherGenerated = false;

                    savedCount++;
                    totalCollectionAmount += addedAmount;

                    savedReceipts.Add(new
                    {
                        pigmyAccountId = account.PigmyAccountID,
                        accountNo = account.AccountNo,
                        oldAccountNo = account.OldAccountNo ?? account.LegacyAccountNumber ?? account.PreviousAccountNo ?? "",
                        receiptNo = receiptNo,
                        amount = addedAmount,
                        newBalance = account.TotalDepositedAmount
                    });
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    success = true,
                    collect_Pigmi = 1,
                    message = $"एकूण {savedCount} खात्यांमध्ये ₹{totalCollectionAmount:N2} ची नोंद यशस्वीरीत्या सेव्ह झाली!",
                    savedCount = savedCount,
                    totalAmount = totalCollectionAmount,
                    receipts = savedReceipts
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "पिग्मी जमा सेव्ह करताना सर्व्हर त्रुटी: " + ex.Message);
            }
        }

        // 4. GET: api/PigmyApp/Passbook
        [HttpGet("Passbook")]
        public async Task<IActionResult> GetPassbook(
            [FromQuery] int pigmyAccountId,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate)
        {
            if (pigmyAccountId <= 0) return BadRequest("वैध pigmyAccountId पुरवा.");

            var account = await _context.PigmyAccounts
                .Include(a => a.Customer)
                .Include(a => a.PigmyAgent)
                .FirstOrDefaultAsync(a => a.PigmyAccountID == pigmyAccountId);

            if (account == null) return NotFound("पिग्मी खाते सापडले नाही.");
            if (IsAgentRole() && account.PigmyAgentID != ResolveAuthorizedAgentId())
            {
                return StatusCode(403, new { message = "आपल्याला इतर एजंटच्या खात्याचे पासबुक पाहण्याची परवानगी नाही." });
            }
            if (!IsAgentRole() && !User.CanAccessBranch(account.BranchID))
            {
                return StatusCode(403, new { message = "आपल्याला इतर शाखेतील खात्याचे पासबुक पाहण्याची परवानगी नाही." });
            }

            var istToday = _businessDateGuard.GetIstToday();
            DateTime fDate = fromDate?.Date ?? new DateTime(istToday.Year, 1, 1);
            DateTime tDate = toDate?.Date ?? istToday;
            DateTime nextTDate = tDate.AddDays(1);

            // Compute Opening Balance before fDate using transactions / migrated balances
            var priorCr = await _context.PigmyTransactions
                .Where(t => t.PigmyAccountID == pigmyAccountId && t.TransactionDate.Date < fDate)
                .SumAsync(t => (decimal?)t.CrAmount) ?? 0m;

            var priorDr = await _context.PigmyTransactions
                .Where(t => t.PigmyAccountID == pigmyAccountId && t.TransactionDate.Date < fDate)
                .SumAsync(t => (decimal?)t.DrAmount) ?? 0m;

            decimal openingBalance = priorCr - priorDr;
            if (openingBalance < 0) openingBalance = 0;

            // Fetch transactions in date range
            var transactions = await _context.PigmyTransactions
                .Where(t => t.PigmyAccountID == pigmyAccountId && t.TransactionDate.Date >= fDate && t.TransactionDate.Date < nextTDate)
                .OrderBy(t => t.TransactionDate)
                .ThenBy(t => t.PigmyTransactionID)
                .ToListAsync();

            decimal runningBalance = openingBalance;
            var ledgerItems = new List<object>();

            foreach (var t in transactions)
            {
                runningBalance = runningBalance + t.CrAmount - t.DrAmount;
                ledgerItems.Add(new
                {
                    transactionId = t.PigmyTransactionID,
                    date = t.TransactionDate.ToString("yyyy-MM-dd"),
                    transactionDate = t.TransactionDate.ToString("yyyy-MM-dd"),
                    valueDate = t.ValueDate.ToString("yyyy-MM-dd"),
                    transactionType = t.TransactionType,
                    narration = t.Narration,
                    referenceId = t.ReferenceId,
                    drAmount = t.DrAmount,
                    crAmount = t.CrAmount,
                    runningBalance = runningBalance
                });
            }

            return Ok(new
            {
                pigmyAccountId = account.PigmyAccountID,
                accountNo = account.AccountNo,
                customerName = account.Customer != null ? $"{account.Customer.FirstName} {account.Customer.LastName}".Trim() : "",
                memberName = account.Customer != null ? $"{account.Customer.FirstName} {account.Customer.LastName}".Trim() : "",
                agentName = account.PigmyAgent?.AgentName ?? "",
                openingDate = account.OpeningDate.ToString("yyyy-MM-dd"),
                fromDate = fDate.ToString("yyyy-MM-dd"),
                toDate = tDate.ToString("yyyy-MM-dd"),
                openingBalance = openingBalance,
                totalCredit = transactions.Sum(t => t.CrAmount),
                totalDebit = transactions.Sum(t => t.DrAmount),
                closingBalance = runningBalance,
                currentTotalBalance = account.TotalDepositedAmount,
                transactions = ledgerItems
            });
        }

        // 5. GET: api/PigmyApp/CollectionReport
        [HttpGet("CollectionReport")]
        public async Task<IActionResult> GetCollectionReport(
            [FromHeader(Name = "X-Agent-Id")] int headerAgentId,
            [FromQuery] int? agentId,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate)
        {
            int targetAgentId = ResolveAuthorizedAgentId(agentId, headerAgentId);
            if (targetAgentId <= 0) return Unauthorized("Valid Agent JWT token required.");

            var istToday = _businessDateGuard.GetIstToday();
            DateTime fDate = fromDate?.Date ?? istToday;
            DateTime tDate = toDate?.Date ?? istToday;
            DateTime nextTDate = tDate.AddDays(1);

            var query = _context.PigmyCollections
                .Include(c => c.PigmyAccount)
                    .ThenInclude(a => a!.Customer)
                .Where(c => c.AgentId == targetAgentId && c.CollectionDate >= fDate && c.CollectionDate < nextTDate)
                .OrderByDescending(c => c.CollectionDate)
                .AsQueryable();

            var collections = await query.ToListAsync();

            var summary = new
            {
                agentId = targetAgentId,
                fromDate = fDate.ToString("yyyy-MM-dd"),
                toDate = tDate.ToString("yyyy-MM-dd"),
                totalCollectedAmount = collections.Sum(c => c.CollectionAmount),
                totalReceiptsCount = collections.Count,
                uniqueAccountsCount = collections.Select(c => c.PigmyAccountId).Distinct().Count(),
                collections = collections.Select(c => new
                {
                    c.CollectionId,
                    c.ReceiptNo,
                    date = c.CollectionDate.ToString("yyyy-MM-dd"),
                    c.PigmyAccountId,
                    accountNo = c.PigmyAccount?.AccountNo ?? "",
                    customerName = c.PigmyAccount?.Customer != null ? $"{c.PigmyAccount.Customer.FirstName} {c.PigmyAccount.Customer.LastName}".Trim() : "",
                    memberName = c.PigmyAccount?.Customer != null ? $"{c.PigmyAccount.Customer.FirstName} {c.PigmyAccount.Customer.LastName}".Trim() : "",
                    amount = c.CollectionAmount,
                    source = c.CollectionSource
                })
            };

            return Ok(summary);
        }

        // 6. GET: api/PigmyApp/CommissionReport
        [HttpGet("CommissionReport")]
        public async Task<IActionResult> GetCommissionReport(
            [FromHeader(Name = "X-Agent-Id")] int headerAgentId,
            [FromQuery] int? agentId,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate)
        {
            int targetAgentId = ResolveAuthorizedAgentId(agentId, headerAgentId);
            if (targetAgentId <= 0) return Unauthorized("Valid Agent JWT token required.");

            var istToday = _businessDateGuard.GetIstToday();
            DateTime fDate = fromDate?.Date ?? new DateTime(istToday.Year, istToday.Month, 1);
            DateTime tDate = toDate?.Date ?? istToday;
            DateTime nextTDate = tDate.AddDays(1);

            // Fetch active commission rate setting for agent
            var setting = await _context.PigmyCommissionSettings
                .Where(s => (s.AgentId == targetAgentId || s.AgentId == null) && s.IsActive)
                .OrderByDescending(s => s.AgentId)
                .FirstOrDefaultAsync();

            decimal rateValue = setting?.CommissionValue ?? 2.5m;
            string rateType = setting?.CommissionType ?? "PERCENTAGE";

            // Total collections in period
            var totalCollected = await _context.PigmyCollections
                .Where(c => c.AgentId == targetAgentId && c.CollectionDate >= fDate && c.CollectionDate < nextTDate)
                .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;

            // Calculated Commission
            decimal calculatedCommission = 0m;
            if (rateType == "PERCENTAGE")
            {
                calculatedCommission = Math.Round((totalCollected * rateValue) / 100m, 2);
            }
            else
            {
                if (totalCollected > 0) calculatedCommission = rateValue;
            }

            // Paid commissions in period
            var paidRecords = await _context.PigmyAgentCommissions
                .Where(c => c.AgentId == targetAgentId && c.Status == "PAID" && c.PeriodStartDate >= fDate && c.PeriodEndDate < nextTDate)
                .ToListAsync();

            decimal paidAmount = paidRecords.Sum(p => p.CalculatedCommission);
            decimal pendingAmount = calculatedCommission > paidAmount ? (calculatedCommission - paidAmount) : 0m;

            return Ok(new
            {
                agentId = targetAgentId,
                fromDate = fDate.ToString("yyyy-MM-dd"),
                toDate = tDate.ToString("yyyy-MM-dd"),
                totalCollectedAmount = totalCollected,
                commissionRate = rateValue,
                rateType = rateType,
                calculatedCommission = calculatedCommission,
                paidCommission = paidAmount,
                pendingCommission = pendingAmount,
                paidVouchersCount = paidRecords.Count
            });
        }
    }
}
