using System;
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
    public class PigmySchemesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PigmySchemesController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/PigmySchemes
        [HttpGet]
        public async Task<ActionResult<IEnumerable<PigmyScheme>>> GetPigmySchemes()
        {
            return await _context.PigmySchemes
                .Include(s => s.PigmyLiabilityLedger)
                .Include(s => s.InterestExpenseLedger)
                .Include(s => s.InterestPayableLedger)
                .Include(s => s.CommissionExpenseLedger)
                .ToListAsync();
        }

        // GET: api/PigmySchemes/5
        [HttpGet("{id}")]
        public async Task<ActionResult<PigmyScheme>> GetPigmyScheme(int id)
        {
            var pigmyScheme = await _context.PigmySchemes
                .Include(s => s.PigmyLiabilityLedger)
                .Include(s => s.InterestExpenseLedger)
                .Include(s => s.InterestPayableLedger)
                .Include(s => s.CommissionExpenseLedger)
                .FirstOrDefaultAsync(s => s.PigmySchemeID == id);

            if (pigmyScheme == null)
            {
                return NotFound();
            }

            return pigmyScheme;
        }

        // PUT: api/PigmySchemes/5
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<IActionResult> PutPigmyScheme(int id, PigmyScheme pigmyScheme)
        {
            if (pigmyScheme.PigmySchemeID != 0 && id != pigmyScheme.PigmySchemeID)
            {
                return BadRequest(new { message = "अवैध योजना आयडी (Invalid Scheme ID)." });
            }

            var existing = await _context.PigmySchemes.FindAsync(id);
            if (existing == null)
            {
                return NotFound(new { message = "पिग्मी योजना सापडली नाही." });
            }

            existing.SchemeCode = !string.IsNullOrWhiteSpace(pigmyScheme.SchemeCode) ? pigmyScheme.SchemeCode.Trim() : existing.SchemeCode;
            existing.SchemeName = pigmyScheme.SchemeName;
            existing.InterestRate = pigmyScheme.InterestRate;
            existing.DurationMonths = pigmyScheme.DurationMonths;
            existing.Status = pigmyScheme.Status;
            existing.PigmyLiabilityLedgerID = pigmyScheme.PigmyLiabilityLedgerID;
            existing.InterestExpenseLedgerID = pigmyScheme.InterestExpenseLedgerID;
            existing.InterestPayableLedgerID = pigmyScheme.InterestPayableLedgerID;
            existing.CommissionExpenseLedgerID = pigmyScheme.CommissionExpenseLedgerID;

            try
            {
                await _context.SaveChangesAsync();
                return Ok(new { message = "पिग्मी योजना यशस्वीरीत्या अद्ययावत झाली!" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "योजना अद्ययावत करताना त्रुटी आली: " + ex.Message });
            }
        }

        // GET: api/PigmySchemes/NextCode
        [HttpGet("NextCode")]
        public async Task<ActionResult<object>> GetNextSchemeCode()
        {
            var codes = await _context.PigmySchemes.Select(s => s.SchemeCode).ToListAsync();
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
            return Ok(new { nextCode = $"PGS{nextNum:D3}" });
        }

        // POST: api/PigmySchemes
        [HttpPost]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<ActionResult<PigmyScheme>> PostPigmyScheme(PigmyScheme pigmyScheme)
        {
            pigmyScheme.CreatedDate = DateTime.Now;
            if (string.IsNullOrWhiteSpace(pigmyScheme.SchemeCode))
            {
                var codes = await _context.PigmySchemes.Select(s => s.SchemeCode).ToListAsync();
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
                pigmyScheme.SchemeCode = $"PGS{(maxNum + 1):D3}";
            }
            else
            {
                pigmyScheme.SchemeCode = pigmyScheme.SchemeCode.Trim();
            }

            _context.PigmySchemes.Add(pigmyScheme);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetPigmyScheme", new { id = pigmyScheme.PigmySchemeID }, pigmyScheme);
        }

        // DELETE: api/PigmySchemes/5?force=false
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<IActionResult> DeletePigmyScheme(int id, [FromQuery] bool force = false)
        {
            var pigmyScheme = await _context.PigmySchemes.FindAsync(id);
            if (pigmyScheme == null)
            {
                return NotFound(new { message = "पिग्मी योजना सापडली नाही." });
            }

            var accountsCount = await _context.PigmyAccounts.CountAsync(a => a.PigmySchemeID == id);

            if (accountsCount > 0 && !force)
            {
                return BadRequest(new
                {
                    hasDependencies = true,
                    accountsCount,
                    message = $"या योजनेशी {accountsCount} पिग्मी खाती जोडलेली आहेत. थेट डिलीट केल्यास संदर्भ (Constraint) खराब होऊ शकतो."
                });
            }

            try
            {
                if (accountsCount > 0 && force)
                {
                    var otherScheme = await _context.PigmySchemes
                        .Where(s => s.PigmySchemeID != id)
                        .OrderBy(s => s.PigmySchemeID)
                        .FirstOrDefaultAsync();

                    if (otherScheme != null)
                    {
                        var accountsToUpdate = await _context.PigmyAccounts.Where(a => a.PigmySchemeID == id).ToListAsync();
                        foreach (var acc in accountsToUpdate)
                        {
                            acc.PigmySchemeID = otherScheme.PigmySchemeID;
                        }
                        await _context.SaveChangesAsync();
                    }
                }

                _context.PigmySchemes.Remove(pigmyScheme);
                await _context.SaveChangesAsync();
                return Ok(new { message = "पिग्मी योजना यशस्वीरीत्या हटवली (Deleted) गेली." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "योजना हटवताना त्रुटी आली: " + ex.Message });
            }
        }

        private bool PigmySchemeExists(int id)
        {
            return _context.PigmySchemes.Any(e => e.PigmySchemeID == id);
        }
    }
}
