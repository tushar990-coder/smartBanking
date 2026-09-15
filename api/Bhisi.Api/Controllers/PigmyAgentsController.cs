using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PigmyAgentsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PigmyAgentsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/PigmyAgents/next-id
        [HttpGet("next-id")]
        [Microsoft.AspNetCore.Authorization.AllowAnonymous]
        public async Task<ActionResult<object>> GetNextAgentId()
        {
            int maxId = await _context.PigmyAgents.AnyAsync()
                ? await _context.PigmyAgents.MaxAsync(a => a.PigmyAgentID)
                : 0;
            int nextId = maxId + 1;
            string agentCode = $"AGT-{nextId:D3}";
            return Ok(new { nextId, agentCode });
        }

        // GET: api/PigmyAgents
        [HttpGet]
        [Microsoft.AspNetCore.Authorization.AllowAnonymous]
        public async Task<ActionResult<IEnumerable<PigmyAgent>>> GetPigmyAgents()
        {
            return await _context.PigmyAgents
                .Include(a => a.Branch)
                .Include(a => a.Customer)
                .ToListAsync();
        }

        // GET: api/PigmyAgents/5
        [HttpGet("{id}")]
        public async Task<ActionResult<PigmyAgent>> GetPigmyAgent(int id)
        {
            var pigmyAgent = await _context.PigmyAgents
                .Include(a => a.Branch)
                .Include(a => a.Customer)
                .FirstOrDefaultAsync(a => a.PigmyAgentID == id);

            if (pigmyAgent == null)
            {
                return NotFound();
            }

            return pigmyAgent;
        }

        // PUT: api/PigmyAgents/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutPigmyAgent(int id, PigmyAgent pigmyAgent)
        {
            if (id != pigmyAgent.PigmyAgentID)
            {
                return BadRequest(new { message = "अवैध एजंट आयडी (Invalid Agent ID)." });
            }

            var existing = await _context.PigmyAgents.FindAsync(id);
            if (existing == null)
            {
                return NotFound(new { message = "एजंट सापडला नाही." });
            }

            existing.AgentName = pigmyAgent.AgentName;
            existing.JoiningDate = pigmyAgent.JoiningDate;
            existing.Status = pigmyAgent.Status;
            existing.BranchID = pigmyAgent.BranchID;
            existing.CustomerID = pigmyAgent.CustomerID;
            existing.Username = pigmyAgent.Username;
            existing.MaxCashLimit = pigmyAgent.MaxCashLimit;
            existing.MaxLockDays = pigmyAgent.MaxLockDays;

            if (!string.IsNullOrEmpty(pigmyAgent.Password))
            {
                existing.PasswordHash = BCrypt.Net.BCrypt.HashPassword(pigmyAgent.Password);
            }

            try
            {
                await _context.SaveChangesAsync();
                return Ok(new { message = "एजंटची माहिती यशस्वीरित्या अपडेट झाली!" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "अपडेट करताना त्रुटी आली: " + ex.Message });
            }
        }

        // POST: api/PigmyAgents
        [HttpPost]
        public async Task<ActionResult<PigmyAgent>> PostPigmyAgent(PigmyAgent pigmyAgent)
        {
            if (!pigmyAgent.JoiningDate.HasValue)
            {
                pigmyAgent.JoiningDate = DateTime.Today;
            }
            pigmyAgent.CreatedDate = DateTime.Now;

            if (!string.IsNullOrEmpty(pigmyAgent.Password))
            {
                pigmyAgent.PasswordHash = BCrypt.Net.BCrypt.HashPassword(pigmyAgent.Password);
            }

            _context.PigmyAgents.Add(pigmyAgent);
            await _context.SaveChangesAsync();

            // Load branch details before returning
            if (pigmyAgent.BranchID.HasValue)
            {
                await _context.Entry(pigmyAgent).Reference(a => a.Branch).LoadAsync();
            }

            return CreatedAtAction("GetPigmyAgent", new { id = pigmyAgent.PigmyAgentID }, pigmyAgent);
        }

        // DELETE: api/PigmyAgents/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePigmyAgent(int id)
        {
            var pigmyAgent = await _context.PigmyAgents.FindAsync(id);
            if (pigmyAgent == null)
            {
                return NotFound(new { message = "एजंट सापडला नाही." });
            }

            var accountsCount = await _context.PigmyAccounts.CountAsync(a => a.PigmyAgentID == id);
            var collectionsCount = await _context.PigmyCollections.CountAsync(c => c.AgentId == id);
            var commissionsCount = await _context.PigmyAgentCommissions.CountAsync(c => c.AgentId == id);
            var depositsCount = await _context.PigmyAgentCashDeposits.CountAsync(d => d.AgentId == id);

            int totalDependencies = accountsCount + collectionsCount + commissionsCount + depositsCount;

            if (totalDependencies > 0)
            {
                return BadRequest(new
                {
                    hasDependencies = true,
                    accountsCount,
                    collectionsCount,
                    commissionsCount,
                    depositsCount,
                    message = $"या एजंटशी {accountsCount} पिग्मी खाती व {collectionsCount} कलेक्शन नोंदी जोडलेल्या आहेत. व्यवहार झालेले असल्यामुळे हा एजंट डिलीट करता येणार नाही. कृपया एजंटचा Status 'Inactive' (निष्क्रिय) करा."
                });
            }

            try
            {
                _context.PigmyAgents.Remove(pigmyAgent);
                await _context.SaveChangesAsync();
                return Ok(new { message = "एजंट यशस्वीरित्या हटवला (Deleted) गेला." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "एजंट डिलीट करताना त्रुटी आली: " + ex.Message });
            }
        }

        // GET: api/PigmyAgents/5/TransferPreCheck
        [HttpGet("{id}/TransferPreCheck")]
        public async Task<ActionResult<object>> GetTransferPreCheck(int id)
        {
            var agent = await _context.PigmyAgents
                .Include(a => a.Branch)
                .FirstOrDefaultAsync(a => a.PigmyAgentID == id);

            if (agent == null)
            {
                return NotFound(new { message = "एजंट सापडला नाही (Agent not found)." });
            }

            // 1. Calculate pending cash
            var totalCashCollected = await _context.PigmyCollections
                .Where(c => c.AgentId == id && (c.PaymentMode == null || c.PaymentMode == "" || c.PaymentMode.ToUpper() == "CASH"))
                .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;

            var totalCashRemitted = await _context.PigmyAgentCashDeposits
                .Where(d => d.AgentId == id)
                .SumAsync(d => (decimal?)d.Amount) ?? 0m;

            decimal pendingCash = totalCashCollected - totalCashRemitted;
            if (pendingCash < 0) pendingCash = 0m;

            // 2. Query active accounts
            var activeAccounts = await _context.PigmyAccounts
                .Include(a => a.Customer)
                .Include(a => a.PigmyScheme)
                .Where(a => a.PigmyAgentID == id && a.Status == "Active")
                .OrderBy(a => a.AccountNo)
                .Select(a => new
                {
                    pigmyAccountId = a.PigmyAccountID,
                    accountNo = a.AccountNo,
                    customerName = (a.Customer.FirstName + " " + (a.Customer.LastName ?? "")).Trim(),
                    mobileNo = a.Customer.MobileNo,
                    schemeName = a.PigmyScheme != null ? a.PigmyScheme.SchemeName : "-",
                    openingDate = a.OpeningDate,
                    maturityDate = a.MaturityDate,
                    totalDepositedAmount = a.TotalDepositedAmount
                })
                .ToListAsync();

            decimal totalActiveBalance = activeAccounts.Sum(a => a.totalDepositedAmount);

            // 3. Eligible target agents (Active and not the same agent)
            var targetAgents = await _context.PigmyAgents
                .Include(a => a.Branch)
                .Where(a => a.PigmyAgentID != id && a.Status == "Active")
                .OrderBy(a => a.AgentName)
                .Select(a => new
                {
                    pigmyAgentId = a.PigmyAgentID,
                    agentName = a.AgentName,
                    status = a.Status,
                    branchId = a.BranchID,
                    branchName = a.Branch != null ? a.Branch.BranchName : "-"
                })
                .ToListAsync();

            return Ok(new
            {
                agent = new
                {
                    pigmyAgentId = agent.PigmyAgentID,
                    agentName = agent.AgentName,
                    status = agent.Status,
                    branchId = agent.BranchID,
                    branchName = agent.Branch != null ? agent.Branch.BranchName : "-"
                },
                pendingCash,
                hasPendingCash = pendingCash > 0,
                activeAccountsCount = activeAccounts.Count,
                totalActiveBalance,
                activeAccounts,
                targetAgents
            });
        }

        // POST: api/PigmyAgents/TransferAccounts
        [HttpPost("TransferAccounts")]
        public async Task<IActionResult> TransferAccounts([FromBody] AgentAccountTransferRequestDto dto)
        {
            if (dto.FromAgentId <= 0 || dto.ToAgentId <= 0)
            {
                return BadRequest(new { message = "मूळ एजंट आणि नवीन एजंट निवडणे अनिवार्य आहे." });
            }

            if (dto.FromAgentId == dto.ToAgentId)
            {
                return BadRequest(new { message = "मूळ एजंट आणि नवीन एजंट एकच असू शकत नाहीत." });
            }

            var fromAgent = await _context.PigmyAgents.FindAsync(dto.FromAgentId);
            if (fromAgent == null)
            {
                return NotFound(new { message = "मूळ एजंट सापडला नाही." });
            }

            var toAgent = await _context.PigmyAgents.FindAsync(dto.ToAgentId);
            if (toAgent == null)
            {
                return NotFound(new { message = "हस्तांतरणासाठी निवडलेला नवीन एजंट सापडला नाही." });
            }

            if (toAgent.Status != "Active")
            {
                return BadRequest(new { message = "नवीन एजंट सक्रिय (Active) असणे आवश्यक आहे." });
            }

            // Unremitted Cash Check
            var totalCashCollected = await _context.PigmyCollections
                .Where(c => c.AgentId == dto.FromAgentId && (c.PaymentMode == null || c.PaymentMode == "" || c.PaymentMode.ToUpper() == "CASH"))
                .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;

            var totalCashRemitted = await _context.PigmyAgentCashDeposits
                .Where(d => d.AgentId == dto.FromAgentId)
                .SumAsync(d => (decimal?)d.Amount) ?? 0m;

            decimal pendingCash = totalCashCollected - totalCashRemitted;
            if (pendingCash < 0) pendingCash = 0m;

            if (pendingCash > 0 && !dto.ForceAllowWithCashBalance && dto.NewFromAgentStatus != "KeepActive")
            {
                return BadRequest(new
                {
                    hasPendingCash = true,
                    pendingCash,
                    message = $"एजंटकडे ₹{pendingCash:N2} जमा न झालेली रोकड शिल्लक (Unremitted Cash) आहे. कृपया ही रक्कम आधी शाखेत जमा करा अथवा व्यवस्थापकीय मान्यतेने (Force Allow) पुढे जा."
                });
            }

            var query = _context.PigmyAccounts.Where(a => a.PigmyAgentID == dto.FromAgentId && a.Status == "Active");
            if (dto.AccountIds != null && dto.AccountIds.Count > 0)
            {
                query = query.Where(a => dto.AccountIds.Contains(a.PigmyAccountID));
            }

            var accountsToTransfer = await query.ToListAsync();

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                string batchNumber = $"TRF-{DateTime.Now:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";
                var userClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) ?? User.FindFirst("UserID") ?? User.FindFirst("sub");
                int userId = (userClaim != null && int.TryParse(userClaim.Value, out int uid)) ? uid : 1;

                string transferType = (dto.AccountIds != null && dto.AccountIds.Count > 0) ? "SELECTIVE" : "BULK";

                foreach (var account in accountsToTransfer)
                {
                    var transferLog = new PigmyAgentAccountTransfer
                    {
                        BatchNumber = batchNumber,
                        BranchID = fromAgent.BranchID ?? 1,
                        FromAgentID = fromAgent.PigmyAgentID,
                        ToAgentID = toAgent.PigmyAgentID,
                        PigmyAccountID = account.PigmyAccountID,
                        TotalBalanceAtTransfer = account.TotalDepositedAmount,
                        TransferredOn = DateTime.Now,
                        TransferredBy = userId,
                        Reason = string.IsNullOrWhiteSpace(dto.Reason) ? "एजंट कार्यमुक्ती / खाते हस्तांतरण" : dto.Reason,
                        TransferType = transferType
                    };
                    _context.PigmyAgentAccountTransfers.Add(transferLog);

                    // Reassign customer account to target agent
                    account.PigmyAgentID = toAgent.PigmyAgentID;
                }

                // Update outgoing agent's status if requested
                if (!string.IsNullOrWhiteSpace(dto.NewFromAgentStatus) && dto.NewFromAgentStatus != "KeepActive")
                {
                    fromAgent.Status = dto.NewFromAgentStatus;
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    success = true,
                    batchNumber,
                    transferredCount = accountsToTransfer.Count,
                    fromAgentStatus = fromAgent.Status,
                    message = $"{accountsToTransfer.Count} खाती यशस्वीरित्या '{toAgent.AgentName}' यांच्याकडे वर्ग करण्यात आली आहेत!"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "खाती वर्ग करताना त्रुटी उद्भवली: " + ex.Message });
            }
        }

        // GET: api/PigmyAgents/5/TransferHistory
        [HttpGet("{id}/TransferHistory")]
        public async Task<ActionResult<object>> GetTransferHistory(int id)
        {
            var history = await _context.PigmyAgentAccountTransfers
                .Include(t => t.FromAgent)
                .Include(t => t.ToAgent)
                .Include(t => t.PigmyAccount)
                    .ThenInclude(a => a!.Customer)
                .Where(t => t.FromAgentID == id || t.ToAgentID == id)
                .OrderByDescending(t => t.TransferredOn)
                .Take(200)
                .Select(t => new
                {
                    transferID = t.TransferID,
                    batchNumber = t.BatchNumber,
                    fromAgentID = t.FromAgentID,
                    fromAgentName = t.FromAgent != null ? t.FromAgent.AgentName : "-",
                    toAgentID = t.ToAgentID,
                    toAgentName = t.ToAgent != null ? t.ToAgent.AgentName : "-",
                    pigmyAccountID = t.PigmyAccountID,
                    accountNo = t.PigmyAccount != null ? t.PigmyAccount.AccountNo : "-",
                    customerName = t.PigmyAccount != null && t.PigmyAccount.Customer != null
                        ? (t.PigmyAccount.Customer.FirstName + " " + (t.PigmyAccount.Customer.LastName ?? "")).Trim()
                        : "-",
                    totalBalanceAtTransfer = t.TotalBalanceAtTransfer,
                    transferredOn = t.TransferredOn,
                    transferredBy = t.TransferredBy,
                    reason = t.Reason,
                    transferType = t.TransferType
                })
                .ToListAsync();

            return Ok(history);
        }

        private bool PigmyAgentExists(int id)
        {
            return _context.PigmyAgents.Any(e => e.PigmyAgentID == id);
        }
    }

    public class AgentAccountTransferRequestDto
    {
        public int FromAgentId { get; set; }
        public int ToAgentId { get; set; }
        public List<int>? AccountIds { get; set; }
        public string NewFromAgentStatus { get; set; } = "Suspended"; // Suspended, Terminated, Inactive, KeepActive
        public string? Reason { get; set; }
        public string? Remarks { get; set; }
        public bool ForceAllowWithCashBalance { get; set; } = false;
    }
}
