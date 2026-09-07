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
                    customerId = a.CustomerID,
                    memberId = a.CustomerID,
                    customerName = a.Customer != null ? (a.Customer.FirstName + (string.IsNullOrWhiteSpace(a.Customer.MiddleName) ? "" : " " + a.Customer.MiddleName) + (string.IsNullOrWhiteSpace(a.Customer.LastName) ? "" : " " + a.Customer.LastName)).Trim() : "",
                    memberName = a.Customer != null ? (a.Customer.FirstName + (string.IsNullOrWhiteSpace(a.Customer.MiddleName) ? "" : " " + a.Customer.MiddleName) + (string.IsNullOrWhiteSpace(a.Customer.LastName) ? "" : " " + a.Customer.LastName)).Trim() : "",
                    mobileNo = a.Customer != null ? a.Customer.MobileNo : "",
                    address = a.Customer != null ? a.Customer.Address : "",
                    cifNo = a.Customer != null ? a.Customer.CIFNo : "",
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
        // 4. POST /api/collections (Single Sync)
        // ==========================================
        [HttpPost("api/collections")]
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
    }
}
