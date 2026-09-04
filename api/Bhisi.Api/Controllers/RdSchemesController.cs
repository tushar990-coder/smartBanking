using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class RdSchemesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public RdSchemesController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/RdSchemes
        [HttpGet]
        public async Task<ActionResult<IEnumerable<RdScheme>>> GetRdSchemes([FromQuery] int? branchId)
        {
            // In Core Banking, RD Schemes are Sanstha-Wide board policies applicable across all branches
            return await _context.RdSchemes
                .Include(s => s.RdLiabilityLedger)
                .Include(s => s.InterestExpenseLedger)
                .Include(s => s.InterestPayableLedger)
                .Include(s => s.PenaltyIncomeLedger)
                .OrderByDescending(s => s.EffectiveDate)
                .ToListAsync();
        }

        // GET: api/RdSchemes/5
        [HttpGet("{id}")]
        public async Task<ActionResult<RdScheme>> GetRdScheme(int id)
        {
            var rdScheme = await _context.RdSchemes
                .Include(s => s.RdLiabilityLedger)
                .Include(s => s.InterestExpenseLedger)
                .Include(s => s.InterestPayableLedger)
                .Include(s => s.PenaltyIncomeLedger)
                .FirstOrDefaultAsync(s => s.RdSchemeID == id);

            if (rdScheme == null)
            {
                return NotFound();
            }
            return rdScheme;
        }

        // GET: api/RdSchemes/NextCode
        [HttpGet("NextCode")]
        public async Task<ActionResult<object>> GetNextSchemeCode()
        {
            var codes = await _context.RdSchemes.Select(s => s.SchemeCode).ToListAsync();
            int maxNum = 0;
            foreach (var code in codes)
            {
                if (!string.IsNullOrWhiteSpace(code))
                {
                    var digits = new string(code.Where(char.IsDigit).ToArray());
                    if (int.TryParse(digits, out int num))
                    {
                        if (num > maxNum) maxNum = num;
                    }
                }
            }
            int nextNum = maxNum + 1;
            return Ok(new { nextCode = $"RD{nextNum:D3}" });
        }

        // POST: api/RdSchemes
        [HttpPost]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<ActionResult<RdScheme>> PostRdScheme(RdScheme rdScheme)
        {
            if (string.IsNullOrWhiteSpace(rdScheme.SchemeCode))
            {
                var codes = await _context.RdSchemes.Select(s => s.SchemeCode).ToListAsync();
                int maxNum = 0;
                foreach (var code in codes)
                {
                    if (!string.IsNullOrWhiteSpace(code))
                    {
                        var digits = new string(code.Where(char.IsDigit).ToArray());
                        if (int.TryParse(digits, out int num))
                        {
                            if (num > maxNum) maxNum = num;
                        }
                    }
                }
                rdScheme.SchemeCode = $"RD{(maxNum + 1):D3}";
            }
            else
            {
                rdScheme.SchemeCode = rdScheme.SchemeCode.Trim();
            }

            rdScheme.CreatedDate = DateTime.Now;
            _context.RdSchemes.Add(rdScheme);
            await _context.SaveChangesAsync();
            return CreatedAtAction("GetRdScheme", new { id = rdScheme.RdSchemeID }, rdScheme);
        }

        // PUT: api/RdSchemes/5
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<IActionResult> PutRdScheme(int id, RdScheme rdScheme)
        {
            if (id != rdScheme.RdSchemeID)
            {
                return BadRequest();
            }

            _context.Entry(rdScheme).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!RdSchemeExists(id))
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

        // DELETE: api/RdSchemes/5
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<IActionResult> DeleteRdScheme(int id)
        {
            var rdScheme = await _context.RdSchemes.FindAsync(id);
            if (rdScheme == null)
            {
                return NotFound(new { message = "योजना सापडली नाही." });
            }

            var hasAccounts = await _context.RdAccounts.AnyAsync(a => a.RdSchemeID == id);
            if (hasAccounts)
            {
                return BadRequest("या योजनेच्या अंतर्गत RD खाती नोंदवलेली असल्यामुळे ही योजना डिलीट करता येत नाही.");
            }

            try
            {
                _context.RdSchemes.Remove(rdScheme);
                await _context.SaveChangesAsync();
                return Ok(new { message = "योजना यशस्वीरित्या हटवण्यात आली." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, "योजना हटवताना त्रुटी आली: " + ex.Message);
            }
        }

        private bool RdSchemeExists(int id)
        {
            return _context.RdSchemes.Any(e => e.RdSchemeID == id);
        }
    }
}
