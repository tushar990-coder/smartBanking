using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Services;

namespace Bhisi.Api.Controllers
{
    [ApiController]
    [Authorize]
    public class PigmyMobileApiController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IAgentLockService _lockService;
        private readonly IPigmySyncService _syncService;

        public PigmyMobileApiController(
            AppDbContext context,
            IAgentLockService lockService,
            IPigmySyncService syncService)
        {
            _context = context;
            _lockService = lockService;
            _syncService = syncService;
        }

        private int GetCurrentAgentId(int? explicitAgentId = null)
        {
            if (explicitAgentId.HasValue && explicitAgentId.Value > 0)
            {
                return explicitAgentId.Value;
            }

            // 1. Check explicit X-Agent-Id header
            if (Request.Headers.TryGetValue("X-Agent-Id", out var headerVal) && int.TryParse(headerVal, out int hId) && hId > 0)
            {
                return hId;
            }

            // 2. Try JWT Claims: "agentId" or "AgentId"
            var agentClaim = User.Claims.FirstOrDefault(c => 
                c.Type == "agentId" || 
                c.Type == "AgentId");

            if (agentClaim != null && int.TryParse(agentClaim.Value, out int id) && id > 0)
            {
                return id;
            }

            // 3. Fallback to query param
            if (Request.Query.TryGetValue("agentId", out var qVal) && int.TryParse(qVal, out int qId) && qId > 0)
            {
                return qId;
            }

            // 4. Fallback to NameIdentifier if role is AGENT
            var nameIdClaim = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier);
            var roleClaim = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role);
            if (roleClaim?.Value == "AGENT" && nameIdClaim != null && int.TryParse(nameIdClaim.Value, out int nId) && nId > 0)
            {
                return nId;
            }

            return 0;
        }

        // ==========================================
        // 1. GET /api/agent/lock-status
        // ==========================================
        [HttpGet("api/agent/lock-status")]
        [HttpGet("api/PigmyApp/lock-status")]
        public async Task<IActionResult> GetAgentLockStatus([FromQuery] int? agentId)
        {
            int targetAgentId = agentId.HasValue && agentId.Value > 0 ? agentId.Value : GetCurrentAgentId();
            if (targetAgentId <= 0)
            {
                return Unauthorized(new { message = "Valid Agent JWT token or X-Agent-Id header required." });
            }

            var lockResult = await _lockService.GetLockStatusAsync(targetAgentId);

            return Ok(new
            {
                agentId = targetAgentId.ToString(),
                status = lockResult.Status, // ALLOWED | LOCKED
                pendingCash = lockResult.PendingCash,
                maxCashLimit = lockResult.MaxCashLimit,
                message = lockResult.Message,
                isLocked = lockResult.IsLocked
            });
        }

        // ==========================================
        // 2. GET /api/accounts
        // ==========================================
        [HttpGet("api/accounts")]
        [HttpGet("api/PigmyApp/accounts-list")]
        public async Task<IActionResult> GetAgentAccounts([FromQuery] int? agentId)
        {
            int targetAgentId = agentId.HasValue && agentId.Value > 0 ? agentId.Value : GetCurrentAgentId();
            if (targetAgentId <= 0)
            {
                return Unauthorized(new { message = "Valid Agent JWT token or X-Agent-Id header required." });
            }

            var accounts = await _context.PigmyAccounts
                .Include(a => a.Customer)
                .Where(a => a.PigmyAgentID == targetAgentId && a.Status == "Active")
                .OrderBy(a => a.AccountNo)
                .Select(a => new
                {
                    accountId = a.PigmyAccountID,
                    pigmyAccountId = a.PigmyAccountID,
                    accountNo = a.AccountNo,
                    oldAccountNo = a.OldAccountNo ?? a.LegacyAccountNumber ?? a.PreviousAccountNo ?? "",
                    customerId = a.CustomerID,
                    memberId = a.CustomerID,
                    customerName = a.Customer != null ? (a.Customer.FirstName + (string.IsNullOrWhiteSpace(a.Customer.MiddleName) ? "" : " " + a.Customer.MiddleName) + (string.IsNullOrWhiteSpace(a.Customer.LastName) ? "" : " " + a.Customer.LastName)).Trim() : "",
                    memberName = a.Customer != null ? (a.Customer.FirstName + (string.IsNullOrWhiteSpace(a.Customer.MiddleName) ? "" : " " + a.Customer.MiddleName) + (string.IsNullOrWhiteSpace(a.Customer.LastName) ? "" : " " + a.Customer.LastName)).Trim() : "",
                    mobileNo = a.Customer != null ? a.Customer.MobileNo : "",
                    address = a.Customer != null ? a.Customer.Address : "",
                    cifNo = a.Customer != null ? a.Customer.CIFNo : "",
                    dailyDepositAmount = a.DailyDepositAmount > 0 ? a.DailyDepositAmount : 100m,
                    dailyTargetAmount = a.DailyDepositAmount > 0 ? a.DailyDepositAmount : 100m,
                    currentBalance = a.TotalDepositedAmount,
                    totalDepositedAmount = a.TotalDepositedAmount,
                    interestRate = a.InterestRate,
                    openingDate = a.OpeningDate.ToString("yyyy-MM-dd"),
                    maturityDate = a.MaturityDate.ToString("yyyy-MM-dd"),
                    status = a.Status
                })
                .ToListAsync();

            return Ok(accounts);
        }

        // ==========================================
        // 2b. GET /api/PigmyApp/customers
        // ==========================================
        [AllowAnonymous]
        [HttpGet("api/PigmyApp/customers")]
        public async Task<IActionResult> GetMobileCustomers([FromQuery] int? agentId)
        {
            int targetAgentId = agentId.HasValue && agentId.Value > 0 ? agentId.Value : GetCurrentAgentId();
            if (targetAgentId <= 0)
            {
                return BadRequest(new { message = "Agent ID is required (e.g. ?agentId=1 or X-Agent-Id header or Bearer token)." });
            }

            var accounts = await _context.PigmyAccounts
                .AsNoTracking()
                .Include(a => a.Customer)
                .Where(a => a.PigmyAgentID == targetAgentId && (a.Status == "Active" || a.Status == null))
                .OrderBy(a => a.AccountNo)
                .ToListAsync();

            var customers = accounts.Select(a => new
            {
                customerId = a.CustomerID,
                memberId = a.CustomerID,
                cifNo = a.Customer?.CIFNo ?? "",
                customerName = a.Customer != null 
                    ? (a.Customer.FirstName + (string.IsNullOrWhiteSpace(a.Customer.MiddleName) ? "" : " " + a.Customer.MiddleName) + (string.IsNullOrWhiteSpace(a.Customer.LastName) ? "" : " " + a.Customer.LastName)).Trim() 
                    : "",
                firstName = a.Customer?.FirstName ?? "",
                middleName = a.Customer?.MiddleName ?? "",
                lastName = a.Customer?.LastName ?? "",
                accountNo = a.AccountNo,
                oldAccountNo = a.OldAccountNo ?? a.LegacyAccountNumber ?? a.PreviousAccountNo ?? "",
                accountId = a.PigmyAccountID,
                pigmyAccountId = a.PigmyAccountID,
                mobileNo = a.Customer?.MobileNo,
                address = a.Customer?.Address,
                aadhaarNo = a.Customer?.AadhaarNo,
                panNo = a.Customer?.PANNo,
                gender = a.Customer?.Gender,
                photoPath = a.Customer?.PhotoPath ?? "",
                totalAccounts = 1,
                totalBalance = a.TotalDepositedAmount,
                currentBalance = a.TotalDepositedAmount,
                dailyDepositAmount = a.DailyDepositAmount > 0 ? a.DailyDepositAmount : 100m,
                dailyTargetAmount = a.DailyDepositAmount > 0 ? a.DailyDepositAmount : 100m,
                status = a.Status ?? "Active"
            }).ToList();

            return Ok(customers);
        }

        // ==========================================
        // 3. POST /api/accounts (Create Customer & Pigmi Account)
        // ==========================================
        public class CreateAccountRequestDto
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
            public string? OldAccountNo { get; set; }
            public decimal DailyDepositAmount { get; set; } = 100;
        }

        [HttpPost("api/accounts")]
        public async Task<IActionResult> CreateAccount([FromBody] CreateAccountRequestDto dto)
        {
            int agentId = dto.AgentId.HasValue && dto.AgentId.Value > 0 ? dto.AgentId.Value : GetCurrentAgentId();
            if (agentId <= 0)
            {
                return Unauthorized(new { message = "Valid Agent JWT token or X-Agent-Id header required." });
            }

            var agent = await _context.PigmyAgents.FirstOrDefaultAsync(a => a.PigmyAgentID == agentId);
            if (agent == null)
            {
                return BadRequest(new { message = "Assigned agent not found." });
            }

            int branchId = dto.BranchID > 0 ? dto.BranchID : (agent.BranchID ?? 1);

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // 1. Create Customer
                var customer = new Customer
                {
                    BranchID = branchId,
                    FirstName = dto.FirstName.Trim(),
                    MiddleName = dto.MiddleName?.Trim(),
                    LastName = dto.LastName.Trim(),
                    MobileNo = dto.MobileNo.Trim(),
                    AadhaarNo = !string.IsNullOrWhiteSpace(dto.AadhaarNo) ? dto.AadhaarNo.Trim() : "000000000000",
                    Address = dto.Address?.Trim(),
                    Gender = dto.Gender ?? "Male",
                    CreatedOn = DateTime.UtcNow,
                    CreatedBy = agentId,
                    Status = "Active"
                };
                _context.Customers.Add(customer);
                await _context.SaveChangesAsync();

                // Assign CIF
                customer.CIFNo = $"CIF-{branchId:D2}-{customer.CustomerID:D6}";
                await _context.SaveChangesAsync();

                // 2. Default Pigmy Scheme
                var scheme = await _context.PigmySchemes.FirstOrDefaultAsync() 
                    ?? new PigmyScheme { PigmySchemeID = 1, InterestRate = 4.0m };

                // 3. Generate Account No
                var dateStr = DateTime.Now.ToString("yyyyMMdd");
                var accountNo = $"PGM-{branchId}-{dateStr}-{customer.CustomerID:D4}";

                var pigmyAccount = new PigmyAccount
                {
                    AccountNo = accountNo,
                    CustomerID = customer.CustomerID,
                    BranchID = branchId,
                    PigmySchemeID = scheme.PigmySchemeID,
                    PigmyAgentID = agentId,
                    OpeningDate = DateTime.Today,
                    MaturityDate = DateTime.Today.AddYears(1),
                    InterestRate = scheme.InterestRate,
                    TotalDepositedAmount = 0m,
                    Status = "Active",
                    OldAccountNo = string.IsNullOrWhiteSpace(dto.OldAccountNo) ? null : dto.OldAccountNo.Trim(),
                    LegacyAccountNumber = string.IsNullOrWhiteSpace(dto.OldAccountNo) ? null : dto.OldAccountNo.Trim(),
                    DailyDepositAmount = dto.DailyDepositAmount > 0 ? dto.DailyDepositAmount : 100m,
                    CreatedBy = agentId,
                    CreatedDate = DateTime.UtcNow
                };
                _context.PigmyAccounts.Add(pigmyAccount);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                return Ok(new
                {
                    success = true,
                    message = "Customer and Pigmy Account created successfully.",
                    accountId = pigmyAccount.PigmyAccountID,
                    pigmyAccountId = pigmyAccount.PigmyAccountID,
                    accountNo = pigmyAccount.AccountNo,
                    customerId = customer.CustomerID,
                    memberId = customer.CustomerID,
                    customerName = $"{customer.FirstName} {customer.LastName}".Trim(),
                    memberName = $"{customer.FirstName} {customer.LastName}".Trim(),
                    mobileNo = customer.MobileNo,
                    currentBalance = 0m,
                    status = pigmyAccount.Status
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = $"Error creating account: {ex.Message}" });
            }
        }

        // ==========================================
        // 3.5 POST /api/PigmyApp/create-request
        // ==========================================
        public class MobileCreateRequestDto
        {
            [Required(ErrorMessage = "First name is required.")]
            public string FirstName { get; set; } = string.Empty;
            public string? MiddleName { get; set; }
            public string? LastName { get; set; }
            [Required(ErrorMessage = "Mobile number is required.")]
            public string MobileNo { get; set; } = string.Empty;
            public decimal DailyDepositAmount { get; set; } = 100;
            public string? Address { get; set; }
            public string? AadhaarNo { get; set; }
            public string? PANNo { get; set; }
            public int? PigmySchemeID { get; set; }
            public int BranchID { get; set; } = 1;
            public int? AgentId { get; set; }
            public string? OldAccountNo { get; set; }
        }

        [HttpPost("api/PigmyApp/create-request")]
        [AllowAnonymous]
        public async Task<IActionResult> CreateAccountRequest([FromBody] MobileCreateRequestDto dto)
        {
            int agentId = dto.AgentId.HasValue && dto.AgentId.Value > 0 ? dto.AgentId.Value : GetCurrentAgentId();
            if (agentId <= 0)
            {
                return Unauthorized(new { message = "Valid Agent JWT token or X-Agent-Id header required." });
            }

            var agent = await _context.PigmyAgents.FirstOrDefaultAsync(a => a.PigmyAgentID == agentId);
            if (agent == null)
            {
                return BadRequest(new { message = "Assigned agent not found." });
            }

            int branchId = dto.BranchID > 0 ? dto.BranchID : (agent.BranchID ?? 1);

            try
            {
                string firstName = (dto.FirstName ?? string.Empty).Trim();
                string lastName = !string.IsNullOrWhiteSpace(dto.LastName) 
                    ? dto.LastName.Trim() 
                    : (!string.IsNullOrWhiteSpace(firstName) ? firstName : "Customer");

                var newRequest = new AgentCustomerRequest
                {
                    FirstName = firstName,
                    MiddleName = dto.MiddleName?.Trim(),
                    LastName = lastName,
                    MobileNo = dto.MobileNo?.Trim(),
                    Address = dto.Address?.Trim(),
                    AadhaarNo = dto.AadhaarNo?.Trim(),
                    PANNo = dto.PANNo?.Trim(),
                    PigmySchemeID = dto.PigmySchemeID,
                    DailyDepositAmount = dto.DailyDepositAmount,
                    OldAccountNo = string.IsNullOrWhiteSpace(dto.OldAccountNo) ? null : dto.OldAccountNo.Trim(),
                    OpenPigmyAccount = true,
                    BranchID = branchId,
                    PigmyAgentID = agentId,
                    AgentName = agent.AgentName,
                    RequestDate = DateTime.Now,
                    Status = "Pending"
                };

                _context.AgentCustomerRequests.Add(newRequest);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    success = true,
                    message = "Customer request submitted successfully. It is pending branch approval.",
                    requestId = newRequest.RequestID,
                    status = newRequest.Status
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Error submitting request: {ex.Message}" });
            }
        }

        // ==========================================
        // 4. POST /api/collections (Single Sync) & POST /api/PigmyApp/collect
        // ==========================================
        [HttpPost("api/collections")]
        [HttpPost("api/PigmyApp/collect")]
        public async Task<IActionResult> ProcessSingleCollection([FromBody] SingleCollectionRequestDto dto)
        {
            int agentId = GetCurrentAgentId(dto.AgentId);
            if (agentId <= 0)
            {
                return Unauthorized(new { message = "Valid Agent JWT token or X-Agent-Id header required." });
            }

            var result = await _syncService.ProcessSingleCollectionAsync(agentId, dto);

            if (result.StatusCode == 403)
            {
                return StatusCode(403, new
                {
                    success = false,
                    status = "LOCKED",
                    message = result.Message,
                    transactionId = result.TransactionId,
                    accountId = result.AccountId
                });
            }

            if (!result.Success && result.StatusCode != 200)
            {
                return StatusCode(result.StatusCode, result);
            }

            return Ok(new
            {
                success = result.Success,
                isDuplicate = result.IsDuplicate,
                receiptNo = result.ReceiptNo,
                transactionId = result.TransactionId,
                accountId = result.AccountId,
                accountNo = result.AccountNo,
                memberName = result.MemberName,
                amount = result.Amount,
                currentBalance = result.CurrentBalance,
                paymentMode = result.PaymentMode,
                timestamp = result.Timestamp?.ToString("yyyy-MM-dd HH:mm:ss"),
                message = result.Message
            });
        }

        // ==========================================
        // 5. POST /api/collections/bulk-sync (Offline Bulk Sync)
        // ==========================================
        [HttpPost("api/collections/bulk-sync")]
        public async Task<IActionResult> ProcessBulkSync([FromBody] object payload)
        {
            int agentId = GetCurrentAgentId();
            if (agentId <= 0)
            {
                return Unauthorized(new { message = "Valid Agent JWT token or X-Agent-Id header required." });
            }

            List<SingleCollectionRequestDto> items = new List<SingleCollectionRequestDto>();

            try
            {
                var jsonStr = System.Text.Json.JsonSerializer.Serialize(payload);
                
                // Try deserializing as BulkSyncRequestDto
                if (jsonStr.Contains("\"collections\"") || jsonStr.Contains("\"Collections\"") || jsonStr.Contains("\"items\"") || jsonStr.Contains("\"Items\""))
                {
                    var bulkObj = System.Text.Json.JsonSerializer.Deserialize<BulkSyncRequestDto>(jsonStr, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    if (bulkObj?.Collections != null && bulkObj.Collections.Count > 0)
                    {
                        items = bulkObj.Collections;
                    }
                }
                else
                {
                    // Direct array of items
                    var listObj = System.Text.Json.JsonSerializer.Deserialize<List<SingleCollectionRequestDto>>(jsonStr, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    if (listObj != null)
                    {
                        items = listObj;
                    }
                }
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = $"Invalid bulk collections JSON format: {ex.Message}" });
            }

            var bulkResult = await _syncService.ProcessBulkSyncAsync(agentId, items);

            return Ok(bulkResult);
        }

        // ==========================================
        // 6. GET /api/dashboard/summary
        // ==========================================
        [HttpGet("api/dashboard/summary")]
        public async Task<IActionResult> GetDashboardSummary([FromQuery] int? agentId)
        {
            int targetAgentId = agentId.HasValue && agentId.Value > 0 ? agentId.Value : GetCurrentAgentId();
            if (targetAgentId <= 0)
            {
                return Unauthorized(new { message = "Valid Agent JWT token or X-Agent-Id header required." });
            }

            var today = DateTime.Today;
            var tomorrow = today.AddDays(1);

            // Today's Collection
            var todaysCollections = await _context.PigmyCollections
                .Where(c => c.AgentId == targetAgentId && c.CollectionDate >= today && c.CollectionDate < tomorrow)
                .ToListAsync();

            decimal todaysCollectionAmount = todaysCollections.Sum(c => c.CollectionAmount);
            int totalReceipts = todaysCollections.Count;

            // Historical Collections before today
            decimal historicalCollections = await _context.PigmyCollections
                .Where(c => c.AgentId == targetAgentId && c.CollectionDate < today)
                .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;

            // Historical Deposits to branch before today
            decimal historicalRemittances = await _context.PigmyAgentCashDeposits
                .Where(d => d.AgentId == targetAgentId && d.DepositDate < today)
                .SumAsync(d => (decimal?)d.Amount) ?? 0m;

            decimal openingBalance = historicalCollections - historicalRemittances;
            if (openingBalance < 0) openingBalance = 0;

            // Today's Remittances to branch
            decimal todaysRemittances = await _context.PigmyAgentCashDeposits
                .Where(d => d.AgentId == targetAgentId && d.DepositDate >= today && d.DepositDate < tomorrow)
                .SumAsync(d => (decimal?)d.Amount) ?? 0m;

            decimal closingBalance = openingBalance + todaysCollectionAmount - todaysRemittances;
            if (closingBalance < 0) closingBalance = 0;

            var lockStatus = await _lockService.GetLockStatusAsync(targetAgentId);

            return Ok(new
            {
                date = today.ToString("yyyy-MM-dd"),
                agentId = targetAgentId,
                openingBalance = openingBalance,
                todaysCollection = todaysCollectionAmount,
                todaysRemittance = todaysRemittances,
                totalReceipts = totalReceipts,
                closingBalance = closingBalance,
                pendingCashInHand = lockStatus.PendingCash,
                lockStatus = lockStatus.Status,
                isLocked = lockStatus.IsLocked
            });
        }

        // ==========================================
        // 7. GET /api/reports/passbook/:accountId
        // ==========================================
        [HttpGet("api/reports/passbook/{accountId}")]
        [HttpGet("api/reports/passbook")]
        public async Task<IActionResult> GetPassbookReport(
            [FromRoute] int? accountId,
            [FromQuery] int? queryAccountId,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate)
        {
            int targetAccountId = (accountId.HasValue && accountId.Value > 0)
                ? accountId.Value
                : (queryAccountId.HasValue ? queryAccountId.Value : 0);

            if (targetAccountId <= 0)
            {
                return BadRequest(new { message = "Valid accountId path or query parameter required." });
            }

            var account = await _context.PigmyAccounts
                .Include(a => a.Customer)
                .Include(a => a.PigmyAgent)
                .FirstOrDefaultAsync(a => a.PigmyAccountID == targetAccountId);

            if (account == null)
            {
                return NotFound(new { message = $"Pigmy account with ID {targetAccountId} not found." });
            }

            DateTime fDate = fromDate?.Date ?? new DateTime(DateTime.Today.Year, 1, 1);
            DateTime tDate = toDate?.Date ?? DateTime.Today;
            DateTime nextTDate = tDate.AddDays(1);

            // Calculate Opening Balance prior to fDate
            decimal priorCr = await _context.PigmyTransactions
                .Where(t => t.PigmyAccountID == targetAccountId && t.TransactionDate.Date < fDate)
                .SumAsync(t => (decimal?)t.CrAmount) ?? 0m;

            decimal priorDr = await _context.PigmyTransactions
                .Where(t => t.PigmyAccountID == targetAccountId && t.TransactionDate.Date < fDate)
                .SumAsync(t => (decimal?)t.DrAmount) ?? 0m;

            decimal openingBalance = priorCr - priorDr;

            // Fetch Transactions in date range
            var transactions = await _context.PigmyTransactions
                .Where(t => t.PigmyAccountID == targetAccountId 
                    && t.TransactionDate >= fDate 
                    && t.TransactionDate < nextTDate)
                .OrderBy(t => t.TransactionDate)
                .ThenBy(t => t.PigmyTransactionID)
                .ToListAsync();

            decimal runningBal = openingBalance;
            var statementItems = new List<object>();

            foreach (var tx in transactions)
            {
                runningBal += (tx.CrAmount - tx.DrAmount);
                statementItems.Add(new
                {
                    transactionId = tx.PigmyTransactionID,
                    date = tx.TransactionDate.ToString("yyyy-MM-dd"),
                    type = tx.TransactionType,
                    crAmount = tx.CrAmount,
                    drAmount = tx.DrAmount,
                    balance = runningBal,
                    narration = tx.Narration,
                    referenceId = tx.ReferenceId
                });
            }

            return Ok(new
            {
                accountId = account.PigmyAccountID,
                pigmyAccountId = account.PigmyAccountID,
                accountNo = account.AccountNo,
                customerId = account.CustomerID,
                customerName = account.Customer != null ? $"{account.Customer.FirstName} {account.Customer.LastName}".Trim() : "",
                memberName = account.Customer != null ? $"{account.Customer.FirstName} {account.Customer.LastName}".Trim() : "",
                mobileNo = account.Customer?.MobileNo ?? "",
                agentName = account.PigmyAgent?.AgentName ?? "",
                openingDate = account.OpeningDate.ToString("yyyy-MM-dd"),
                fromDate = fDate.ToString("yyyy-MM-dd"),
                toDate = tDate.ToString("yyyy-MM-dd"),
                openingBalance = openingBalance,
                totalCredit = transactions.Sum(t => t.CrAmount),
                totalDebit = transactions.Sum(t => t.DrAmount),
                closingBalance = runningBal,
                currentBalance = account.TotalDepositedAmount,
                transactions = statementItems
            });
        }

        // ==========================================
        // 8. GET /api/reports/collections
        // ==========================================
        [HttpGet("api/reports/collections")]
        public async Task<IActionResult> GetCollectionsReport(
            [FromQuery] int? agentId,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate)
        {
            int targetAgentId = agentId.HasValue && agentId.Value > 0 ? agentId.Value : GetCurrentAgentId();
            if (targetAgentId <= 0)
            {
                return Unauthorized(new { message = "Valid Agent JWT token or X-Agent-Id header required." });
            }

            DateTime fDate = fromDate?.Date ?? DateTime.Today;
            DateTime tDate = toDate?.Date ?? DateTime.Today;
            DateTime nextTDate = tDate.AddDays(1);

            var collections = await _context.PigmyCollections
                .Include(c => c.PigmyAccount)
                    .ThenInclude(a => a!.Customer)
                .Where(c => c.AgentId == targetAgentId && c.CollectionDate >= fDate && c.CollectionDate < nextTDate)
                .OrderByDescending(c => c.CollectionDate)
                .ThenByDescending(c => c.CollectionId)
                .Select(c => new
                {
                    collectionId = c.CollectionId,
                    transactionId = c.TransactionId,
                    receiptNo = c.ReceiptNo,
                    date = c.CollectionDate.ToString("yyyy-MM-dd"),
                    accountId = c.PigmyAccountId,
                    accountNo = c.PigmyAccount != null ? c.PigmyAccount.AccountNo : "",
                    customerId = c.PigmyAccount != null ? c.PigmyAccount.CustomerID : (int?)null,
                    customerName = c.PigmyAccount != null && c.PigmyAccount.Customer != null 
                        ? $"{c.PigmyAccount.Customer.FirstName} {c.PigmyAccount.Customer.LastName}".Trim() 
                        : "",
                    memberName = c.PigmyAccount != null && c.PigmyAccount.Customer != null 
                        ? $"{c.PigmyAccount.Customer.FirstName} {c.PigmyAccount.Customer.LastName}".Trim() 
                        : "",
                    amount = c.CollectionAmount,
                    paymentMode = c.PaymentMode,
                    notes = c.Notes,
                    source = c.CollectionSource
                })
                .ToListAsync();

            return Ok(new
            {
                agentId = targetAgentId,
                fromDate = fDate.ToString("yyyy-MM-dd"),
                toDate = tDate.ToString("yyyy-MM-dd"),
                totalCollectedAmount = collections.Sum(c => c.amount),
                totalReceipts = collections.Count,
                collections = collections
            });
        }

        // ==========================================
        // 9. GET /api/reports/commission
        // ==========================================
        [HttpGet("api/reports/commission")]
        public async Task<IActionResult> GetCommissionReport(
            [FromQuery] int? agentId,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate)
        {
            int targetAgentId = agentId.HasValue && agentId.Value > 0 ? agentId.Value : GetCurrentAgentId();
            if (targetAgentId <= 0)
            {
                return Unauthorized(new { message = "Valid Agent JWT token or X-Agent-Id header required." });
            }

            DateTime fDate = fromDate?.Date ?? new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1);
            DateTime tDate = toDate?.Date ?? DateTime.Today;
            DateTime nextTDate = tDate.AddDays(1);

            // Fetch commission rate setting
            var setting = await _context.PigmyCommissionSettings
                .Where(s => (s.AgentId == targetAgentId || s.AgentId == null) && s.IsActive)
                .OrderByDescending(s => s.AgentId)
                .FirstOrDefaultAsync();

            decimal rateValue = setting?.CommissionValue ?? 2.5m;
            string rateType = setting?.CommissionType ?? "PERCENTAGE";

            // Total collections in range
            decimal totalCollected = await _context.PigmyCollections
                .Where(c => c.AgentId == targetAgentId && c.CollectionDate >= fDate && c.CollectionDate < nextTDate)
                .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;

            decimal calculatedCommission = 0m;
            if (rateType == "PERCENTAGE")
            {
                calculatedCommission = Math.Round((totalCollected * rateValue) / 100m, 2);
            }
            else
            {
                if (totalCollected > 0) calculatedCommission = rateValue;
            }

            // Paid commissions in range
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
        // ==========================================
        // 10. GET /api/PigmyApp/schemes
        // ==========================================
        [HttpGet("api/PigmyApp/schemes")]
        public async Task<IActionResult> GetActivePigmySchemes()
        {
            var schemes = await _context.PigmySchemes
                .Where(s => s.Status == "Active")
                .Select(s => new
                {
                    schemeId = s.PigmySchemeID,
                    schemeCode = s.SchemeCode,
                    schemeName = s.SchemeName,
                    interestRate = s.InterestRate,
                    durationMonths = s.DurationMonths,
                    minDurationMonths = s.MinDurationMonths,
                    prematureInterestRate = s.PrematureInterestRate,
                    penaltyInterestRate = s.PenaltyInterestRate,
                    interestCalculationMethod = s.InterestCalculationMethod
                })
                .ToListAsync();

            return Ok(schemes);
        }

        // ==========================================
        // 11. GET /api/reports/pigmy-book
        // ==========================================
        public class PigmyDailyRecord
        {
            public string Date { get; set; } = string.Empty;
            public int Customers { get; set; }
            public decimal Amount { get; set; }
        }

        public class PigmyBookReportResponse
        {
            public decimal TotalCollection { get; set; }
            public List<PigmyDailyRecord> DailyRecords { get; set; } = new List<PigmyDailyRecord>();
        }

        [HttpGet("api/reports/pigmy-book")]
        public async Task<IActionResult> GetPigmyBookReport([FromQuery] int? agentId, [FromQuery] string? filter, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate)
        {
            int targetAgentId = agentId.HasValue && agentId.Value > 0 ? agentId.Value : GetCurrentAgentId();
            if (targetAgentId <= 0)
            {
                return Unauthorized(new { message = "Valid Agent JWT token or X-Agent-Id header required." });
            }

            DateTime fDate = DateTime.Today;
            DateTime tDate = DateTime.Today;

            if (fromDate.HasValue && toDate.HasValue)
            {
                fDate = fromDate.Value.Date;
                tDate = toDate.Value.Date;
            }
            else if (!string.IsNullOrWhiteSpace(filter))
            {
                var today = DateTime.Today;
                switch (filter.Trim().ToUpper())
                {
                    case "LAST_7_DAYS":
                        fDate = today.AddDays(-7);
                        tDate = today;
                        break;
                    case "THIS_MONTH":
                        fDate = new DateTime(today.Year, today.Month, 1);
                        tDate = today;
                        break;
                    case "LAST_MONTH":
                        fDate = new DateTime(today.Year, today.Month, 1).AddMonths(-1);
                        tDate = new DateTime(today.Year, today.Month, 1).AddDays(-1);
                        break;
                    default:
                        fDate = today;
                        tDate = today;
                        break;
                }
            }

            DateTime nextTDate = tDate.AddDays(1);

            var query = _context.PigmyCollections
                .Where(c => c.AgentId == targetAgentId && c.CollectionDate >= fDate && c.CollectionDate < nextTDate);

            // Fetch to memory first to ensure Distinct Count works perfectly across any EF Core provider
            var rawData = await query
                .Select(c => new { 
                    c.CollectionDate.Date, 
                    c.PigmyAccountId, 
                    c.CollectionAmount 
                })
                .ToListAsync();

            var dailyData = rawData
                .GroupBy(x => x.Date)
                .Select(g => new PigmyDailyRecord
                {
                    Date = g.Key.ToString("yyyy-MM-dd"),
                    Customers = g.Select(x => x.PigmyAccountId).Distinct().Count(),
                    Amount = g.Sum(x => x.CollectionAmount)
                })
                .OrderByDescending(r => r.Date)
                .ToList();

            var response = new PigmyBookReportResponse
            {
                TotalCollection = dailyData.Sum(d => d.Amount),
                DailyRecords = dailyData
            };

            return Ok(response);
        }

        // ==========================================
        // 11. DOORSTEP MULTI-PRODUCT PROFILE & PRIVACY
        // GET /api/PigmyApp/customers/{customerId}/doorstep-profile
        // ==========================================
        [AllowAnonymous]
        [HttpGet("api/PigmyApp/customers/{customerId}/doorstep-profile")]
        [HttpGet("api/PigmyApp/accounts/{pigmyAccountId}/doorstep-profile")]
        public async Task<IActionResult> GetDoorstepCustomerProfile(
            [FromRoute] int? customerId = null,
            [FromRoute] int? pigmyAccountId = null,
            [FromQuery] int? agentId = null,
            [FromQuery] int? pigmyAccountIdQuery = null)
        {
            int targetAgentId = agentId.HasValue && agentId.Value > 0 ? agentId.Value : GetCurrentAgentId();
            if (targetAgentId <= 0)
            {
                return BadRequest(new { message = "Agent ID is required (?agentId=... or X-Agent-Id header)." });
            }

            int resolvedCustomerId = customerId ?? 0;
            int effectivePigmyAccountId = pigmyAccountId ?? pigmyAccountIdQuery ?? 0;

            // If a pigmyAccountId route or query param was supplied, resolve customer from that pigmy account
            if (effectivePigmyAccountId > 0)
            {
                var pigmyAcc = await _context.PigmyAccounts
                    .AsNoTracking()
                    .FirstOrDefaultAsync(p => p.PigmyAccountID == effectivePigmyAccountId);
                if (pigmyAcc != null)
                {
                    resolvedCustomerId = pigmyAcc.CustomerID;
                }
            }

            var customer = await _context.Customers
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.CustomerID == resolvedCustomerId);

            // Fallback: If customer not found, check if resolvedCustomerId itself was actually a PigmyAccountID under this agent
            if (customer == null && resolvedCustomerId > 0)
            {
                var accFallback = await _context.PigmyAccounts
                    .AsNoTracking()
                    .FirstOrDefaultAsync(p => p.PigmyAccountID == resolvedCustomerId && (targetAgentId <= 0 || p.PigmyAgentID == targetAgentId));
                if (accFallback != null)
                {
                    resolvedCustomerId = accFallback.CustomerID;
                    customer = await _context.Customers
                        .AsNoTracking()
                        .FirstOrDefaultAsync(c => c.CustomerID == resolvedCustomerId);
                }
            }

            if (customer == null)
            {
                return NotFound(new { message = "ग्राहक सापडला नाही (Customer not found)." });
            }

            // 1. Pigmy Accounts assigned to this agent (By default allowed)
            var pigmyAccounts = await _context.PigmyAccounts
                .AsNoTracking()
                .Include(p => p.PigmyScheme)
                .Where(p => p.CustomerID == resolvedCustomerId && p.PigmyAgentID == targetAgentId && (p.Status == "Active" || p.Status == null))
                .Select(p => new
                {
                    accountId = p.PigmyAccountID,
                    accountNo = p.AccountNo,
                    productType = "PIGMY",
                    productTitle = "दैनिक ठेव (Pigmy)",
                    schemeName = p.PigmyScheme != null ? p.PigmyScheme.SchemeName : "दैनिक ठेव",
                    currentBalance = p.TotalDepositedAmount,
                    targetAmount = p.DailyDepositAmount > 0 ? p.DailyDepositAmount : 100m,
                    openingDate = p.OpeningDate.ToString("yyyy-MM-dd"),
                    maturityDate = p.MaturityDate.ToString("yyyy-MM-dd"),
                    isAgentAllowed = true,
                    status = p.Status ?? "Active"
                })
                .ToListAsync();

            // 2. Loan Accounts: STRICT PRIVACY FILTER (Only allowed & assigned to this agent)
            var loanAccounts = await _context.LoanAccounts
                .AsNoTracking()
                .Include(l => l.LoanRate)
                .Where(l => l.CustomerID == resolvedCustomerId && l.IsAgentCollectionAllowed && l.AssignedAgentID == targetAgentId && (l.Status == "Active" || l.Status == "Disbursed"))
                .Select(l => new
                {
                    accountId = l.LoanAccountID,
                    accountNo = l.LoanAccountNo ?? $"LN-{l.LoanAccountID}",
                    productType = "LOAN",
                    productTitle = "कर्ज खाते (Loan EMI)",
                    schemeName = l.LoanRate != null ? l.LoanRate.LoanType : "कर्ज योजना",
                    currentBalance = l.PrincipalBalance,
                    targetAmount = l.InstallmentAmount,
                    interestRate = l.InterestRate,
                    lastPaidDate = l.LastInstallmentPaidDate.HasValue ? l.LastInstallmentPaidDate.Value.ToString("yyyy-MM-dd") : null,
                    isAgentAllowed = true,
                    status = l.Status
                })
                .ToListAsync();

            // 3. Saving Accounts: STRICT PRIVACY FILTER (Only allowed & assigned to this agent)
            var savingAccounts = await _context.SavingAccountMasters
                .AsNoTracking()
                .Where(s => s.CustomerID == resolvedCustomerId && s.IsAgentCollectionAllowed && s.AssignedAgentID == targetAgentId && s.Status == "Active")
                .Select(s => new
                {
                    accountId = s.SavingAccountID,
                    accountNo = s.AccountNo,
                    productType = "SAVING",
                    productTitle = "बचत ठेव (Saving)",
                    schemeName = "बचत ठेव खाते",
                    currentBalance = s.CurrentBalance,
                    targetAmount = 0m,
                    isAgentAllowed = true,
                    status = s.Status
                })
                .ToListAsync();

            // 4. RD Accounts: STRICT PRIVACY FILTER (Only allowed & assigned to this agent)
            var rdAccounts = await _context.RdAccounts
                .AsNoTracking()
                .Include(r => r.RdScheme)
                .Where(r => r.CustomerID == resolvedCustomerId && r.IsAgentCollectionAllowed && r.AssignedAgentID == targetAgentId && r.Status == "Active")
                .Select(r => new
                {
                    accountId = r.RdAccountID,
                    accountNo = r.AccountNo,
                    productType = "RD",
                    productTitle = "आवर्ती ठेव (RD)",
                    schemeName = r.RdScheme != null ? r.RdScheme.SchemeName : "आरडी योजना",
                    currentBalance = r.TotalDepositedAmount,
                    targetAmount = r.InstallmentAmount,
                    paidInstallments = r.TotalPaidInstallments,
                    totalDurationMonths = r.DurationMonths,
                    maturityDate = r.MaturityDate.ToString("yyyy-MM-dd"),
                    isAgentAllowed = true,
                    status = r.Status
                })
                .ToListAsync();

            var fullName = $"{customer.FirstName} {(string.IsNullOrWhiteSpace(customer.MiddleName) ? "" : customer.MiddleName + " ")}{customer.LastName}".Trim();

            return Ok(new
            {
                customerId = customer.CustomerID,
                cifNo = customer.CIFNo ?? "",
                customerName = fullName,
                mobileNo = customer.MobileNo ?? "",
                photoPath = customer.PhotoPath ?? "",
                address = customer.Address ?? "",
                agentId = targetAgentId,
                pigmyAccounts,
                loanAccounts,
                savingAccounts,
                rdAccounts,
                totalPermittedAccounts = pigmyAccounts.Count + loanAccounts.Count + savingAccounts.Count + rdAccounts.Count
            });
        }

        // ==========================================
        // 12. DOORSTEP LOAN EMI COLLECTION
        // POST /api/PigmyApp/collect-loan-emi
        // ==========================================
        public class CollectLoanEmiRequestDto
        {
            public int? AgentId { get; set; }
            [Required]
            public int LoanAccountId { get; set; }
            [Required]
            [Range(1, 10000000)]
            public decimal Amount { get; set; }
            public string? PaymentMode { get; set; } = "CASH";
            public DateTime? CollectionDate { get; set; }
            public string? SyncReferenceId { get; set; }
            public string? Latitude { get; set; }
            public string? Longitude { get; set; }
            public string? Remarks { get; set; }
        }

        [AllowAnonymous]
        [HttpPost("api/PigmyApp/collect-loan-emi")]
        public async Task<IActionResult> CollectLoanEmi([FromBody] CollectLoanEmiRequestDto request)
        {
            if (request == null || request.Amount <= 0)
            {
                return BadRequest(new { message = "अवैध रक्कम (Invalid collection amount)." });
            }

            int targetAgentId = request.AgentId.HasValue && request.AgentId.Value > 0 ? request.AgentId.Value : GetCurrentAgentId();
            if (targetAgentId <= 0)
            {
                return BadRequest(new { message = "Agent ID is required." });
            }

            // 1. Agent Lock Check
            var (isAllowed, lockError) = await _lockService.ValidateCollectionAllowedAsync(targetAgentId, request.Amount, request.PaymentMode ?? "CASH");
            if (!isAllowed)
            {
                return BadRequest(new { message = lockError ?? "एजंट लॉक आहे. कृपया शाखेत कॅश जमा करा." });
            }

            // 2. Check duplicate sync reference
            if (!string.IsNullOrWhiteSpace(request.SyncReferenceId))
            {
                var existing = await _context.LoanCollections
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.SyncReferenceId == request.SyncReferenceId);
                if (existing != null)
                {
                    return Ok(new
                    {
                        success = true,
                        isDuplicate = true,
                        message = "पावती आधीच यशस्वीपणे जमा झाली आहे.",
                        receiptNo = existing.ReceiptNo,
                        collectionId = existing.LoanCollectionID,
                        amount = existing.TotalAmountReceived,
                        collectedDate = existing.CollectionDate.ToString("yyyy-MM-dd")
                    });
                }
            }

            var agent = await _context.PigmyAgents.FindAsync(targetAgentId);
            var loan = await _context.LoanAccounts
                .Include(l => l.Customer)
                .Include(l => l.LoanRate)
                .FirstOrDefaultAsync(l => l.LoanAccountID == request.LoanAccountId);

            if (loan == null)
            {
                return NotFound(new { message = "कर्ज खाते सापडले नाही." });
            }

            // 3. Privacy & Permission Check
            if (!loan.IsAgentCollectionAllowed || loan.AssignedAgentID != targetAgentId)
            {
                return StatusCode(403, new { message = "या कर्ज खात्यावर एजंट वसुलीची परवानगी नाही किंवा खाते गोपनीय ठेवले आहे." });
            }

            if (loan.Status == "Closed")
            {
                return BadRequest(new { message = "कर्ज खाते आधीच बंद झाले आहे." });
            }

            using var dbTx = await _context.Database.BeginTransactionAsync();
            try
            {
                DateTime collDate = request.CollectionDate ?? DateTime.Today;

                // Waterfall Application: Overdue/Interest -> Principal
                decimal remaining = request.Amount;
                decimal overduePaid = 0m;
                decimal interestPaid = 0m;
                decimal principalPaid = 0m;

                if (loan.OverdueInterestBalance > 0)
                {
                    overduePaid = Math.Min(remaining, loan.OverdueInterestBalance);
                    loan.OverdueInterestBalance -= overduePaid;
                    remaining -= overduePaid;
                }

                if (remaining > 0 && loan.InterestBalance > 0)
                {
                    interestPaid = Math.Min(remaining, loan.InterestBalance);
                    loan.InterestBalance -= interestPaid;
                    remaining -= interestPaid;
                }

                if (remaining > 0)
                {
                    principalPaid = Math.Min(remaining, loan.PrincipalBalance);
                    loan.PrincipalBalance = Math.Max(0, loan.PrincipalBalance - principalPaid);
                    if (loan.PurePrincipalBalance > 0)
                    {
                        loan.PurePrincipalBalance = Math.Max(0, loan.PurePrincipalBalance - principalPaid);
                    }
                    remaining -= principalPaid;
                }

                loan.LastInstallmentPaidDate = collDate;
                if (loan.PrincipalBalance <= 0)
                {
                    loan.Status = "Closed";
                }

                string receiptNo = $"LN-AGT-{targetAgentId}-{DateTime.Now:yyyyMMddHHmmss}-{new Random().Next(100, 999)}";

                var loanCollection = new LoanCollection
                {
                    LoanAccountID = loan.LoanAccountID,
                    AgentID = targetAgentId,
                    CollectionSource = "AGENT_MOBILE",
                    SyncReferenceId = request.SyncReferenceId,
                    TransactionId = Guid.NewGuid().ToString("N"),
                    ReceiptNo = receiptNo,
                    CollectionDate = collDate,
                    PaymentMode = request.PaymentMode ?? "CASH",
                    TotalAmountReceived = request.Amount,
                    PrincipalCollected = principalPaid,
                    InterestCollected = interestPaid,
                    PenaltyInterestCollected = overduePaid,
                    Remarks = $"डोअरस्टेप एजंट वसुली: {agent?.AgentName ?? targetAgentId.ToString()}" + 
                              (string.IsNullOrWhiteSpace(request.Remarks) ? "" : $" - {request.Remarks}"),
                    BranchID = loan.BranchID > 0 ? loan.BranchID : 1
                };

                _context.LoanCollections.Add(loanCollection);
                await _context.SaveChangesAsync();
                await dbTx.CommitAsync();

                return Ok(new
                {
                    success = true,
                    receiptNo,
                    collectionId = loanCollection.LoanCollectionID,
                    customerName = loan.Customer != null ? $"{loan.Customer.FirstName} {loan.Customer.LastName}".Trim() : "",
                    loanAccountNo = loan.LoanAccountNo ?? $"LN-{loan.LoanAccountID}",
                    amount = request.Amount,
                    principalPaid,
                    interestPaid,
                    newPrincipalBalance = loan.PrincipalBalance,
                    collectionDate = collDate.ToString("yyyy-MM-dd"),
                    message = "कर्ज EMI यशस्वीरीत्या गोळा करण्यात आला आहे."
                });
            }
            catch (Exception ex)
            {
                await dbTx.RollbackAsync();
                return StatusCode(500, new { message = $"कर्ज हप्ता नोंदवताना त्रुटी: {ex.Message}" });
            }
        }

        // ==========================================
        // 13. DOORSTEP SAVING DEPOSIT COLLECTION
        // POST /api/PigmyApp/collect-saving
        // ==========================================
        public class CollectSavingDepositRequestDto
        {
            public int? AgentId { get; set; }
            [Required]
            public int SavingAccountId { get; set; }
            [Required]
            [Range(1, 10000000)]
            public decimal Amount { get; set; }
            public string? PaymentMode { get; set; } = "CASH";
            public DateTime? CollectionDate { get; set; }
            public string? SyncReferenceId { get; set; }
            public string? Remarks { get; set; }
        }

        [AllowAnonymous]
        [HttpPost("api/PigmyApp/collect-saving")]
        public async Task<IActionResult> CollectSavingDeposit([FromBody] CollectSavingDepositRequestDto request)
        {
            if (request == null || request.Amount <= 0)
            {
                return BadRequest(new { message = "अवैध रक्कम (Invalid deposit amount)." });
            }

            int targetAgentId = request.AgentId.HasValue && request.AgentId.Value > 0 ? request.AgentId.Value : GetCurrentAgentId();
            if (targetAgentId <= 0)
            {
                return BadRequest(new { message = "Agent ID is required." });
            }

            // 1. Agent Lock Check
            var (isAllowed, lockError) = await _lockService.ValidateCollectionAllowedAsync(targetAgentId, request.Amount, request.PaymentMode ?? "CASH");
            if (!isAllowed)
            {
                return BadRequest(new { message = lockError ?? "एजंट लॉक आहे. कृपया शाखेत कॅश जमा करा." });
            }

            // 2. Check duplicate sync reference
            if (!string.IsNullOrWhiteSpace(request.SyncReferenceId))
            {
                var existing = await _context.SavingTransactions
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t => t.SyncReferenceId == request.SyncReferenceId);
                if (existing != null)
                {
                    return Ok(new
                    {
                        success = true,
                        isDuplicate = true,
                        message = "बचत ठेव आधीच जमा झाली आहे.",
                        voucherNo = existing.VoucherNo,
                        transactionId = existing.TransactionID,
                        amount = existing.Amount
                    });
                }
            }

            var agent = await _context.PigmyAgents.FindAsync(targetAgentId);
            var saving = await _context.SavingAccountMasters
                .Include(s => s.Customer)
                .FirstOrDefaultAsync(s => s.SavingAccountID == request.SavingAccountId);

            if (saving == null)
            {
                return NotFound(new { message = "बचत खाते सापडले नाही." });
            }

            // 3. Privacy & Permission Check
            if (!saving.IsAgentCollectionAllowed || saving.AssignedAgentID != targetAgentId)
            {
                return StatusCode(403, new { message = "या बचत खात्यावर एजंट ठेव स्वीकारण्याची परवानगी नाही किंवा खाते गोपनीय ठेवले आहे." });
            }

            if (saving.Status == "Closed")
            {
                return BadRequest(new { message = "बचत खाते बंद आहे." });
            }

            using var dbTx = await _context.Database.BeginTransactionAsync();
            try
            {
                DateTime collDate = request.CollectionDate ?? DateTime.Today;
                saving.CurrentBalance += request.Amount;

                string voucherNo = $"SB-AGT-{targetAgentId}-{DateTime.Now:yyyyMMddHHmmss}";

                var savingTx = new SavingTransaction
                {
                    SavingAccountID = saving.SavingAccountID,
                    CustomerID = saving.CustomerID,
                    BranchID = saving.BranchID > 0 ? saving.BranchID : 1,
                    TransactionDate = collDate,
                    TransactionType = "Deposit",
                    PaymentMode = request.PaymentMode ?? "Cash",
                    Amount = request.Amount,
                    BalanceAfterTxn = saving.CurrentBalance,
                    Narration = $"डोअरस्टेप एजंट ठेव: {agent?.AgentName ?? targetAgentId.ToString()}" +
                                (string.IsNullOrWhiteSpace(request.Remarks) ? "" : $" - {request.Remarks}"),
                    VoucherNo = voucherNo,
                    AgentID = targetAgentId,
                    CollectionSource = "AGENT_MOBILE",
                    SyncReferenceId = request.SyncReferenceId,
                    CreatedBy = 1,
                    CreatedOn = DateTime.UtcNow
                };

                _context.SavingTransactions.Add(savingTx);
                await _context.SaveChangesAsync();
                await dbTx.CommitAsync();

                return Ok(new
                {
                    success = true,
                    voucherNo,
                    transactionId = savingTx.TransactionID,
                    accountNo = saving.AccountNo,
                    customerName = saving.Customer != null ? $"{saving.Customer.FirstName} {saving.Customer.LastName}".Trim() : "",
                    amount = request.Amount,
                    newBalance = saving.CurrentBalance,
                    message = "बचत ठेव यशस्वीरीत्या खात्यात जमा झाली."
                });
            }
            catch (Exception ex)
            {
                await dbTx.RollbackAsync();
                return StatusCode(500, new { message = $"बचत ठेव नोंदवताना त्रुटी: {ex.Message}" });
            }
        }

        // ==========================================
        // 14. DOORSTEP RD INSTALLMENT COLLECTION
        // POST /api/PigmyApp/collect-rd
        // ==========================================
        public class CollectRdInstallmentRequestDto
        {
            public int? AgentId { get; set; }
            [Required]
            public int RdAccountId { get; set; }
            [Required]
            [Range(1, 10000000)]
            public decimal Amount { get; set; }
            public string? PaymentMode { get; set; } = "CASH";
            public DateTime? CollectionDate { get; set; }
            public string? SyncReferenceId { get; set; }
            public string? Remarks { get; set; }
        }

        [AllowAnonymous]
        [HttpPost("api/PigmyApp/collect-rd")]
        public async Task<IActionResult> CollectRdInstallment([FromBody] CollectRdInstallmentRequestDto request)
        {
            if (request == null || request.Amount <= 0)
            {
                return BadRequest(new { message = "अवैध रक्कम (Invalid RD amount)." });
            }

            int targetAgentId = request.AgentId.HasValue && request.AgentId.Value > 0 ? request.AgentId.Value : GetCurrentAgentId();
            if (targetAgentId <= 0)
            {
                return BadRequest(new { message = "Agent ID is required." });
            }

            // 1. Agent Lock Check
            var (isAllowed, lockError) = await _lockService.ValidateCollectionAllowedAsync(targetAgentId, request.Amount, request.PaymentMode ?? "CASH");
            if (!isAllowed)
            {
                return BadRequest(new { message = lockError ?? "एजंट लॉक आहे. कृपया शाखेत कॅश जमा करा." });
            }

            // 2. Check duplicate sync reference
            if (!string.IsNullOrWhiteSpace(request.SyncReferenceId))
            {
                var existing = await _context.RdTransactions
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t => t.SyncReferenceId == request.SyncReferenceId);
                if (existing != null)
                {
                    return Ok(new
                    {
                        success = true,
                        isDuplicate = true,
                        message = "आरडी हप्ता आधीच जमा झाला आहे.",
                        transactionId = existing.RdTransactionID,
                        amount = existing.PrincipalAmount
                    });
                }
            }

            var agent = await _context.PigmyAgents.FindAsync(targetAgentId);
            var rd = await _context.RdAccounts
                .Include(r => r.Customer)
                .Include(r => r.RdScheme)
                .FirstOrDefaultAsync(r => r.RdAccountID == request.RdAccountId);

            if (rd == null)
            {
                return NotFound(new { message = "आरडी खाते सापडले नाही." });
            }

            // 3. Privacy & Permission Check
            if (!rd.IsAgentCollectionAllowed || rd.AssignedAgentID != targetAgentId)
            {
                return StatusCode(403, new { message = "या आरडी खात्यावर एजंट वसुलीची परवानगी नाही किंवा खाते गोपनीय ठेवले आहे." });
            }

            if (rd.Status == "Closed")
            {
                return BadRequest(new { message = "आरडी खाते बंद आहे." });
            }

            using var dbTx = await _context.Database.BeginTransactionAsync();
            try
            {
                DateTime collDate = request.CollectionDate ?? DateTime.Today;
                rd.TotalDepositedAmount += request.Amount;

                int installments = rd.InstallmentAmount > 0 ? (int)Math.Max(1, Math.Floor(request.Amount / rd.InstallmentAmount)) : 1;
                rd.TotalPaidInstallments += installments;

                if (rd.TotalPaidInstallments >= rd.DurationMonths)
                {
                    rd.Status = "Matured";
                }

                var rdTx = new RdTransaction
                {
                    InstitutionID = rd.InstitutionID > 0 ? rd.InstitutionID : 1,
                    BranchID = rd.BranchID > 0 ? rd.BranchID : 1,
                    FinancialYearID = rd.FinancialYearID > 0 ? rd.FinancialYearID : 1,
                    RdAccountID = rd.RdAccountID,
                    VoucherID = 1,
                    TransactionDate = collDate,
                    TransactionType = "Installment",
                    InstallmentNo = rd.TotalPaidInstallments,
                    DebitCredit = "Cr",
                    PrincipalAmount = request.Amount,
                    PenaltyAmount = 0m,
                    InterestAmount = 0m,
                    BalanceAfterTxn = rd.TotalDepositedAmount,
                    Narration = $"डोअरस्टेप एजंट आरडी हप्ता: {agent?.AgentName ?? targetAgentId.ToString()}" +
                                (string.IsNullOrWhiteSpace(request.Remarks) ? "" : $" - {request.Remarks}"),
                    AgentID = targetAgentId,
                    CollectionSource = "AGENT_MOBILE",
                    SyncReferenceId = request.SyncReferenceId,
                    CreatedBy = 1,
                    CreatedDate = DateTime.UtcNow
                };

                _context.RdTransactions.Add(rdTx);
                await _context.SaveChangesAsync();
                await dbTx.CommitAsync();

                return Ok(new
                {
                    success = true,
                    transactionId = rdTx.RdTransactionID,
                    accountNo = rd.AccountNo,
                    customerName = rd.Customer != null ? $"{rd.Customer.FirstName} {rd.Customer.LastName}".Trim() : "",
                    amount = request.Amount,
                    paidInstallments = rd.TotalPaidInstallments,
                    totalDurationMonths = rd.DurationMonths,
                    totalDeposited = rd.TotalDepositedAmount,
                    message = "आरडी हप्ता यशस्वीरीत्या जमा झाला आहे."
                });
            }
            catch (Exception ex)
            {
                await dbTx.RollbackAsync();
                return StatusCode(500, new { message = $"आरडी हप्ता नोंदवताना त्रुटी: {ex.Message}" });
            }
        }
    }
}
