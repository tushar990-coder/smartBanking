using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Filters;
using Bhisi.Api.Helpers;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [EnforceBranchScope]
    public class LegalRecoveryMappingController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LegalRecoveryMappingController(AppDbContext context)
        {
            _context = context;
        }

        private bool IsManagerOrAdmin()
        {
            if (User.IsHeadOfficeAdmin()) return true;
            string role = User.GetUserRole();
            return string.Equals(role, "Manager", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(role, "BranchManager", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase);
        }

        // GET: api/LegalRecoveryMapping?branchId=1
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetMappings([FromQuery] int? branchId = null)
        {
            bool isHO = User.IsHeadOfficeAdmin();
            int operatingBranch = User.GetOperatingBranchId();
            int? scopedBranch = isHO
                ? (branchId.HasValue && branchId.Value > 0 ? branchId.Value : (int?)null)
                : (operatingBranch > 0 ? operatingBranch : 1);

            var query = _context.LegalRecoveryLedgerMappings
                .AsNoTracking()
                .Include(m => m.Branch)
                .Include(m => m.DebitLedger)
                .Include(m => m.CreditLedger)
                .AsQueryable();

            if (scopedBranch.HasValue && scopedBranch.Value > 0)
            {
                query = query.Where(m => m.BranchId == scopedBranch.Value || m.BranchId == null || m.BranchId == 0);
            }

            var list = await query
                .OrderByDescending(m => m.BranchId.HasValue && m.BranchId.Value > 0 ? 1 : 0)
                .ThenBy(m => m.TransactionType)
                .Select(m => new
                {
                    m.MappingId,
                    BranchId = m.BranchId ?? 0,
                    IsGlobalDefault = !m.BranchId.HasValue || m.BranchId.Value <= 0,
                    BranchName = m.Branch != null ? m.Branch.BranchName : "सर्व शाखा (Global Default)",
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
            if (!User.IsHeadOfficeAdmin() && mapping.BranchId.HasValue && mapping.BranchId.Value > 0 && !User.CanAccessBranch(mapping.BranchId.Value))
            {
                return StatusCode(403, new { message = "इतर शाखेचे लेजर मॅपिंग पाहण्याची परवानगी नाही." });
            }
            return Ok(mapping);
        }

        // POST: api/LegalRecoveryMapping
        [HttpPost]
        public async Task<ActionResult<LegalRecoveryLedgerMapping>> SaveMapping([FromBody] LegalRecoveryLedgerMapping dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.TransactionType))
            {
                return BadRequest(new { message = "अवैध लेजर मॅपिंग माहिती." });
            }
            if (!IsManagerOrAdmin())
            {
                return StatusCode(403, new { message = "लेजर मॅपिंग बदलण्यासाठी केवळ अ‍ॅडमिन किंवा शाखा व्यवस्थापक अधिकृत आहेत." });
            }

            int? targetBranchId = dto.BranchId.HasValue && dto.BranchId.Value > 0 ? dto.BranchId.Value : (int?)null;
            if (!targetBranchId.HasValue && !User.IsHeadOfficeAdmin())
            {
                return StatusCode(403, new { message = "ग्लोबल (सर्व शाखा) मॅपिंग बदलण्याची परवानगी केवळ मुख्य कार्यालयास (HO) आहे." });
            }
            if (targetBranchId.HasValue && !User.CanAccessBranch(targetBranchId.Value))
            {
                return StatusCode(403, new { message = "आपण केवळ स्वतःच्या शाखेचे लेजर मॅपिंग अद्ययावत करू शकता." });
            }

            if (dto.DebitLedgerId <= 0 || dto.CreditLedgerId <= 0)
            {
                return BadRequest(new { message = $"'{dto.TransactionType}' साठी डेबिट आणि क्रेडिट दोन्ही वैध लेजर निवडणे बंधनकारक आहे." });
            }

            bool ledgersValid = await _context.Ledgers.CountAsync(l => l.LedgerID == dto.DebitLedgerId || l.LedgerID == dto.CreditLedgerId) >= (dto.DebitLedgerId == dto.CreditLedgerId ? 1 : 2);
            if (!ledgersValid)
            {
                return BadRequest(new { message = "निवडलेले डेबिट किंवा क्रेडिट लेजर डेटाबेसमध्ये अस्तित्वात नाही." });
            }

            string cleanType = dto.TransactionType.Trim().ToUpperInvariant();
            var existing = await _context.LegalRecoveryLedgerMappings
                .FirstOrDefaultAsync(m => m.BranchId == targetBranchId && m.TransactionType == cleanType);

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
                dto.BranchId = targetBranchId;
                dto.TransactionType = cleanType;
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
            if (mappings == null || !mappings.Any()) return BadRequest(new { message = "कोणतेही मॅपिंग पाठवलेले नाही." });
            if (!IsManagerOrAdmin())
            {
                return StatusCode(403, new { message = "लेजर मॅपिंग बदलण्यासाठी केवळ अ‍ॅडमिन किंवा शाखा व्यवस्थापक अधिकृत आहेत." });
            }

            var validItems = mappings.Where(m => m != null && !string.IsNullOrWhiteSpace(m.TransactionType) && (m.DebitLedgerId > 0 || m.CreditLedgerId > 0)).ToList();
            if (!validItems.Any())
            {
                return BadRequest(new { message = "सेव्ह करण्यासाठी किमान एक पूर्ण डेबिट/क्रेडिट लेजर मॅपिंग निवडा." });
            }

            bool isHo = User.IsHeadOfficeAdmin();
            var ledgerIds = validItems.SelectMany(i => new[] { i.DebitLedgerId, i.CreditLedgerId }).Where(id => id > 0).Distinct().ToList();
            var existingLedgerIds = (await _context.Ledgers.Where(l => ledgerIds.Contains(l.LedgerID)).Select(l => l.LedgerID).ToListAsync()).ToHashSet();

            foreach (var item in validItems)
            {
                int? targetBranchId = item.BranchId.HasValue && item.BranchId.Value > 0 ? item.BranchId.Value : (int?)null;
                if (!targetBranchId.HasValue && !isHo)
                {
                    return StatusCode(403, new { message = "ग्लोबल (सर्व शाखा) मॅपिंग बदलण्याची परवानगी केवळ मुख्य कार्यालयास (HO) आहे." });
                }
                if (targetBranchId.HasValue && !User.CanAccessBranch(targetBranchId.Value))
                {
                    return StatusCode(403, new { message = "इतर शाखेचे लेजर मॅपिंग बदलण्याची परवानगी नाही." });
                }
                if (item.DebitLedgerId <= 0 || item.CreditLedgerId <= 0 || !existingLedgerIds.Contains(item.DebitLedgerId) || !existingLedgerIds.Contains(item.CreditLedgerId))
                {
                    return BadRequest(new { message = $"'{item.TransactionType}' साठी डेबिट आणि क्रेडिट दोन्ही वैध लेजर निवडणे बंधनकारक आहे (अपूर्ण रो काढून टाका किंवा दोन्ही निवडा)." });
                }

                string cleanType = item.TransactionType.Trim().ToUpperInvariant();
                var existing = await _context.LegalRecoveryLedgerMappings
                    .FirstOrDefaultAsync(m => m.BranchId == targetBranchId && m.TransactionType == cleanType);

                if (existing != null)
                {
                    existing.DebitLedgerId = item.DebitLedgerId;
                    existing.CreditLedgerId = item.CreditLedgerId;
                    existing.IsActive = item.IsActive;
                    existing.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    item.BranchId = targetBranchId;
                    item.TransactionType = cleanType;
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
            if (!IsManagerOrAdmin())
            {
                return StatusCode(403, new { message = "लेजर मॅपिंग हटवण्यासाठी केवळ अ‍ॅडमिन किंवा शाखा व्यवस्थापक अधिकृत आहेत." });
            }

            var mapping = await _context.LegalRecoveryLedgerMappings.FindAsync(id);
            if (mapping == null) return NotFound();

            if (!User.IsHeadOfficeAdmin())
            {
                if (!mapping.BranchId.HasValue || mapping.BranchId.Value <= 0 || !User.CanAccessBranch(mapping.BranchId.Value))
                {
                    return StatusCode(403, new { message = "ग्लोबल किंवा इतर शाखेचे लेजर मॅपिंग हटवण्याची परवानगी नाही." });
                }
            }

            _context.LegalRecoveryLedgerMappings.Remove(mapping);
            await _context.SaveChangesAsync();
            return Ok(new { Message = "लेजर मॅपिंग हटवले गेले आहे." });
        }
    }
}
