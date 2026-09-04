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
    public class InvestmentSchemesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public InvestmentSchemesController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/InvestmentSchemes
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetInvestmentSchemes([FromQuery] int? branchId, [FromQuery] int? institutionId)
        {
            // In Core Banking, Investment Schemes are Sanstha-Wide institutional treasury products
            var query = _context.InvestmentSchemes
                .Include(s => s.InvestmentInstitution)
                .Include(s => s.Branch)
                .Include(s => s.InvestmentAssetLedger)
                .Include(s => s.InterestIncomeLedger)
                .Include(s => s.InterestReceivableLedger)
                .AsQueryable();

            if (institutionId.HasValue && institutionId.Value > 0)
            {
                query = query.Where(s => s.InvestmentInstitutionID == institutionId.Value);
            }

            var schemes = await query
                .OrderBy(s => s.SchemeName)
                .Select(s => new {
                    s.SchemeID,
                    s.BranchID,
                    s.InvestmentInstitutionID,
                    InstitutionName = s.InvestmentInstitution != null ? s.InvestmentInstitution.InstitutionName : "",
                    s.SchemeCode,
                    s.SchemeName,
                    s.InvestmentType,
                    s.InterestRate,
                    s.DurationMonths,
                    s.InterestCalculationMethod,
                    s.PrematureWithdrawalRate,
                    s.IsActive,
                    s.InvestmentAssetLedgerID,
                    s.InterestIncomeLedgerID,
                    s.InterestReceivableLedgerID,
                    InvestmentAssetLedger = s.InvestmentAssetLedger != null ? new { s.InvestmentAssetLedger.LedgerID, s.InvestmentAssetLedger.LedgerName } : null,
                    InterestIncomeLedger = s.InterestIncomeLedger != null ? new { s.InterestIncomeLedger.LedgerID, s.InterestIncomeLedger.LedgerName } : null,
                    InterestReceivableLedger = s.InterestReceivableLedger != null ? new { s.InterestReceivableLedger.LedgerID, s.InterestReceivableLedger.LedgerName } : null
                })
                .ToListAsync();

            return Ok(schemes);
        }

        // GET: api/InvestmentSchemes/5
        [HttpGet("{id}")]
        public async Task<ActionResult<InvestmentScheme>> GetInvestmentScheme(int id)
        {
            var scheme = await _context.InvestmentSchemes
                .Include(s => s.InvestmentInstitution)
                .Include(s => s.Branch)
                .Include(s => s.InvestmentAssetLedger)
                .Include(s => s.InterestIncomeLedger)
                .Include(s => s.InterestReceivableLedger)
                .FirstOrDefaultAsync(s => s.SchemeID == id);

            if (scheme == null)
            {
                return NotFound();
            }
            return scheme;
        }

        // GET: api/InvestmentSchemes/NextCode
        [HttpGet("NextCode")]
        public async Task<ActionResult<object>> GetNextSchemeCode([FromQuery] string? investmentType)
        {
            var schemes = await _context.InvestmentSchemes.AsNoTracking().ToListAsync();
            var existingNumbers = new HashSet<int>();
            foreach (var s in schemes)
            {
                if (!string.IsNullOrWhiteSpace(s.SchemeCode))
                {
                    var digits = new string(s.SchemeCode.Where(char.IsDigit).ToArray());
                    if (int.TryParse(digits, out int num) && num > 0)
                    {
                        existingNumbers.Add(num);
                    }
                }
            }

            int nextNum = 1;
            while (existingNumbers.Contains(nextNum))
            {
                nextNum++;
            }

            string nextCode = $"INV{nextNum:D3}";
            return Ok(new { nextCode });
        }

        // POST: api/InvestmentSchemes
        [HttpPost]
        public async Task<ActionResult> PostInvestmentScheme([FromBody] InvestmentScheme scheme)
        {
            if (scheme.InvestmentInstitutionID <= 0)
            {
                return BadRequest("कृपया बँक / वित्तीय संस्था निवडा.");
            }
            if (string.IsNullOrWhiteSpace(scheme.SchemeName))
            {
                return BadRequest("योजना नाव आवश्यक आहे.");
            }

            if (string.IsNullOrWhiteSpace(scheme.SchemeCode))
            {
                var schemes = await _context.InvestmentSchemes.AsNoTracking().ToListAsync();
                var existingNumbers = new HashSet<int>();
                foreach (var s in schemes)
                {
                    if (!string.IsNullOrWhiteSpace(s.SchemeCode))
                    {
                        var digits = new string(s.SchemeCode.Where(char.IsDigit).ToArray());
                        if (int.TryParse(digits, out int num) && num > 0)
                        {
                            existingNumbers.Add(num);
                        }
                    }
                }

                int nextNum = 1;
                while (existingNumbers.Contains(nextNum))
                {
                    nextNum++;
                }

                scheme.SchemeCode = $"INV{nextNum:D3}";
            }
            else
            {
                scheme.SchemeCode = scheme.SchemeCode.Trim();
            }

            scheme.CreatedDate = DateTime.Now;
            _context.InvestmentSchemes.Add(scheme);
            await _context.SaveChangesAsync();
            return Ok(scheme);
        }

        // PUT: api/InvestmentSchemes/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutInvestmentScheme(int id, [FromBody] InvestmentScheme scheme)
        {
            var existingScheme = await _context.InvestmentSchemes.FindAsync(id);
            if (existingScheme == null)
            {
                return NotFound("योजना सापडली नाही.");
            }

            if (scheme.InvestmentInstitutionID <= 0)
            {
                return BadRequest("कृपया बँक / वित्तीय संस्था निवडा.");
            }
            if (string.IsNullOrWhiteSpace(scheme.SchemeCode) || string.IsNullOrWhiteSpace(scheme.SchemeName))
            {
                return BadRequest("योजना कोड आणि नाव आवश्यक आहे.");
            }

            existingScheme.BranchID = scheme.BranchID > 0 ? scheme.BranchID : existingScheme.BranchID;
            existingScheme.InvestmentInstitutionID = scheme.InvestmentInstitutionID;
            existingScheme.SchemeCode = scheme.SchemeCode;
            existingScheme.SchemeName = scheme.SchemeName;
            existingScheme.InvestmentType = !string.IsNullOrWhiteSpace(scheme.InvestmentType) ? scheme.InvestmentType : existingScheme.InvestmentType;
            existingScheme.InterestRate = scheme.InterestRate;
            existingScheme.DurationMonths = scheme.DurationMonths;
            existingScheme.InterestCalculationMethod = !string.IsNullOrWhiteSpace(scheme.InterestCalculationMethod) ? scheme.InterestCalculationMethod : existingScheme.InterestCalculationMethod;
            existingScheme.PrematureWithdrawalRate = scheme.PrematureWithdrawalRate;
            existingScheme.IsActive = scheme.IsActive;
            existingScheme.InvestmentAssetLedgerID = scheme.InvestmentAssetLedgerID;
            existingScheme.InterestIncomeLedgerID = scheme.InterestIncomeLedgerID;
            existingScheme.InterestReceivableLedgerID = scheme.InterestReceivableLedgerID;
            existingScheme.ModifiedDate = DateTime.Now;

            await _context.SaveChangesAsync();
            return Ok(existingScheme);
        }

        // DELETE: api/InvestmentSchemes/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteInvestmentScheme(int id)
        {
            var scheme = await _context.InvestmentSchemes.FindAsync(id);
            if (scheme == null)
            {
                return NotFound();
            }

            var hasAccounts = await _context.InvestmentAccounts.AnyAsync(a => a.SchemeID == id);
            if (hasAccounts)
            {
                return BadRequest("या योजनेवर गुंतवणूक खाती आहेत. प्रथम ती काढा.");
            }

            _context.InvestmentSchemes.Remove(scheme);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
