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
    public class LegalRecoveryMappingController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LegalRecoveryMappingController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/LegalRecoveryMapping?branchId=1
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetMappings([FromQuery] int? branchId = null)
        {
            var query = _context.LegalRecoveryLedgerMappings
                .Include(m => m.Branch)
                .Include(m => m.DebitLedger)
                .Include(m => m.CreditLedger)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(m => m.BranchId == branchId.Value || m.BranchId == 0);
            }

            var list = await query
                .OrderBy(m => m.BranchId)
                .ThenBy(m => m.TransactionType)
                .Select(m => new
                {
                    m.MappingId,
                    m.BranchId,
                    BranchName = m.Branch != null ? m.Branch.BranchName : "सर्व शाखा (Global)",
                    m.TransactionType,
                    m.DebitLedgerId,
                    DebitLedgerName = m.DebitLedger != null ? m.DebitLedger.LedgerName : "",
                    m.CreditLedgerId,
                    CreditLedgerName = m.CreditLedger != null ? m.CreditLedger.LedgerName : "",
                    m.IsActive,
                    m.UpdatedAt
                })
                .ToListAsync();

            return Ok(list);
        }

        // GET: api/LegalRecoveryMapping/5
        [HttpGet("{id}")]
        public async Task<ActionResult<LegalRecoveryLedgerMapping>> GetMapping(int id)
        {
            var mapping = await _context.LegalRecoveryLedgerMappings
                .Include(m => m.DebitLedger)
                .Include(m => m.CreditLedger)
                .FirstOrDefaultAsync(m => m.MappingId == id);

            if (mapping == null) return NotFound();
            return Ok(mapping);
        }

        // POST: api/LegalRecoveryMapping
        [HttpPost]
        public async Task<ActionResult<LegalRecoveryLedgerMapping>> SaveMapping([FromBody] LegalRecoveryLedgerMapping dto)
        {
            if (dto == null) return BadRequest("Invalid mapping data.");

            var existing = await _context.LegalRecoveryLedgerMappings
                .FirstOrDefaultAsync(m => m.BranchId == dto.BranchId && m.TransactionType == dto.TransactionType);

            if (existing != null)
            {
                existing.DebitLedgerId = dto.DebitLedgerId;
                existing.CreditLedgerId = dto.CreditLedgerId;
                existing.IsActive = dto.IsActive;
                existing.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return Ok(existing);
            }
            else
            {
                dto.UpdatedAt = DateTime.UtcNow;
                _context.LegalRecoveryLedgerMappings.Add(dto);
                await _context.SaveChangesAsync();
                return CreatedAtAction(nameof(GetMapping), new { id = dto.MappingId }, dto);
            }
        }

        // POST: api/LegalRecoveryMapping/bulk-save
        [HttpPost("bulk-save")]
        public async Task<IActionResult> BulkSaveMappings([FromBody] List<LegalRecoveryLedgerMapping> mappings)
        {
            if (mappings == null || !mappings.Any()) return BadRequest("No mappings provided.");

            foreach (var item in mappings)
            {
                var existing = await _context.LegalRecoveryLedgerMappings
                    .FirstOrDefaultAsync(m => m.BranchId == item.BranchId && m.TransactionType == item.TransactionType);

                if (existing != null)
                {
                    existing.DebitLedgerId = item.DebitLedgerId;
                    existing.CreditLedgerId = item.CreditLedgerId;
                    existing.IsActive = item.IsActive;
                    existing.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    item.UpdatedAt = DateTime.UtcNow;
                    _context.LegalRecoveryLedgerMappings.Add(item);
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { Message = "सर्व लेजर मॅपिंग यशस्वीरीत्या सेव्ह झाले आहेत. (Mappings saved successfully)" });
        }

        // DELETE: api/LegalRecoveryMapping/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteMapping(int id)
        {
            var mapping = await _context.LegalRecoveryLedgerMappings.FindAsync(id);
            if (mapping == null) return NotFound();

            _context.LegalRecoveryLedgerMappings.Remove(mapping);
            await _context.SaveChangesAsync();
            return Ok(new { Message = "लेजर मॅपिंग हटवले गेले आहे." });
        }
    }
}
