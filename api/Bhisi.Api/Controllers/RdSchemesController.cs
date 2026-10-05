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
            var schemes = await _context.RdSchemes.ToListAsync();
            int maxNum = 500;
            foreach (var s in schemes)
            {
                if (s.SchemeCodeNumeric > maxNum)
                {
                    maxNum = s.SchemeCodeNumeric;
                }
                else if (!string.IsNullOrWhiteSpace(s.SchemeCode))
                {
                    var digits = new string(s.SchemeCode.Where(char.IsDigit).ToArray());
                    if (int.TryParse(digits, out int num) && num > maxNum)
                    {
                        maxNum = num;
                    }
                }
            }
            int nextNum = maxNum < 501 ? 501 : maxNum + 1;
            return Ok(new { nextCode = $"{nextNum}", nextNumeric = nextNum });
        }

        // POST: api/RdSchemes
        [HttpPost]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<ActionResult<RdScheme>> PostRdScheme(RdScheme rdScheme)
        {
            if (rdScheme.InstitutionID <= 0) rdScheme.InstitutionID = 1;
            if (rdScheme.BranchID <= 0) rdScheme.BranchID = 1;
            if (string.IsNullOrWhiteSpace(rdScheme.InterestMethod)) rdScheme.InterestMethod = "Quarterly";
            if (string.IsNullOrWhiteSpace(rdScheme.CompoundingFrequency)) rdScheme.CompoundingFrequency = "Quarterly";
            if (rdScheme.GracePeriodDays <= 0) rdScheme.GracePeriodDays = 5;

            int numericCode = rdScheme.SchemeCodeNumeric;
            if (numericCode <= 0 && !string.IsNullOrWhiteSpace(rdScheme.SchemeCode))
            {
                var digits = new string(rdScheme.SchemeCode.Where(char.IsDigit).ToArray());
                int.TryParse(digits, out numericCode);
            }

            if (numericCode <= 0)
            {
                int maxNumeric = await _context.RdSchemes.MaxAsync(s => (int?)s.SchemeCodeNumeric) ?? 500;
                if (maxNumeric < 500) maxNumeric = 500;
                numericCode = maxNumeric + 1;
            }

            rdScheme.SchemeCodeNumeric = numericCode;
            rdScheme.SchemeCode = $"{numericCode}";

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
                return BadRequest(new { message = "योजना आयडी मॅच होत नाही." });
            }

            var existing = await _context.RdSchemes.FindAsync(id);
            if (existing == null)
            {
                return NotFound(new { message = "योजना सापडली नाही." });
            }

            if (rdScheme.SchemeCodeNumeric > 0)
            {
                existing.SchemeCodeNumeric = rdScheme.SchemeCodeNumeric;
                existing.SchemeCode = $"{rdScheme.SchemeCodeNumeric}";
            }
            else if (!string.IsNullOrWhiteSpace(rdScheme.SchemeCode) && int.TryParse(new string(rdScheme.SchemeCode.Where(char.IsDigit).ToArray()), out int parsedNum) && parsedNum > 0)
            {
                existing.SchemeCodeNumeric = parsedNum;
                existing.SchemeCode = $"{parsedNum}";
            }

            existing.SchemeName = rdScheme.SchemeName;
            existing.DurationMonths = rdScheme.DurationMonths;
            existing.MinimumInstallment = rdScheme.MinimumInstallment;
            existing.MaximumInstallment = rdScheme.MaximumInstallment;
            existing.InterestRate = rdScheme.InterestRate;
            existing.InterestMethod = string.IsNullOrWhiteSpace(rdScheme.InterestMethod) ? existing.InterestMethod : rdScheme.InterestMethod;
            existing.PenaltyAmount = rdScheme.PenaltyAmount;
            existing.PrematurePenaltyRate = rdScheme.PrematurePenaltyRate;
            existing.EffectiveDate = rdScheme.EffectiveDate;
            existing.IsActive = rdScheme.IsActive;
            if (!string.IsNullOrWhiteSpace(rdScheme.CompoundingFrequency)) existing.CompoundingFrequency = rdScheme.CompoundingFrequency;
            if (rdScheme.GracePeriodDays > 0) existing.GracePeriodDays = rdScheme.GracePeriodDays;
            
            existing.AllowOverdueInterest = rdScheme.AllowOverdueInterest;
            existing.OverdueInterestRate = rdScheme.OverdueInterestRate;
            existing.RdLiabilityLedgerID = rdScheme.RdLiabilityLedgerID;
            existing.InterestExpenseLedgerID = rdScheme.InterestExpenseLedgerID;
            existing.InterestPayableLedgerID = rdScheme.InterestPayableLedgerID;
            existing.PenaltyIncomeLedgerID = rdScheme.PenaltyIncomeLedgerID;
            existing.ModifiedDate = DateTime.Now;

            await _context.SaveChangesAsync();
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
