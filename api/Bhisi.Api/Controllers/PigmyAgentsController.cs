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

        private bool PigmyAgentExists(int id)
        {
            return _context.PigmyAgents.Any(e => e.PigmyAgentID == id);
        }
    }
}
