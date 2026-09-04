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
    public class FdSchemesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public FdSchemesController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/FdSchemes
        [HttpGet]
        public async Task<ActionResult<IEnumerable<FdScheme>>> GetFdSchemes([FromQuery] int? branchId)
        {
            // In Core Banking, FD Schemes are Sanstha-Wide board policies applicable across all branches
            return await _context.FdSchemes
                .Include(s => s.FdLiabilityLedger)
                .Include(s => s.InterestExpenseLedger)
                .Include(s => s.InterestPayableLedger)
                .Include(s => s.PrematurePenaltyLedger)
                .OrderByDescending(s => s.EffectiveDate)
                .ToListAsync();
        }

        // GET: api/FdSchemes/5
        [HttpGet("{id}")]
        public async Task<ActionResult<FdScheme>> GetFdScheme(int id)
        {
            var fdScheme = await _context.FdSchemes
                .Include(s => s.FdLiabilityLedger)
                .Include(s => s.InterestExpenseLedger)
                .Include(s => s.InterestPayableLedger)
                .Include(s => s.PrematurePenaltyLedger)
                .FirstOrDefaultAsync(s => s.FdSchemeID == id);

            if (fdScheme == null)
            {
                return NotFound();
            }
            return fdScheme;
        }

        // GET: api/FdSchemes/NextCode
        [HttpGet("NextCode")]
        public async Task<ActionResult<object>> GetNextSchemeCode()
        {
            var codes = await _context.FdSchemes.Select(s => s.SchemeCode).ToListAsync();
            var existingNumbers = new HashSet<int>();
            foreach (var code in codes)
            {
                if (!string.IsNullOrWhiteSpace(code))
                {
                    var digits = new string(code.Where(char.IsDigit).ToArray());
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
            return Ok(new { nextCode = $"FD{nextNum:D3}" });
        }

        // POST: api/FdSchemes
        [HttpPost]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<ActionResult<FdScheme>> PostFdScheme(FdScheme fdScheme)
        {
            if (string.IsNullOrWhiteSpace(fdScheme.SchemeCode))
            {
                var codes = await _context.FdSchemes.Select(s => s.SchemeCode).ToListAsync();
                var existingNumbers = new HashSet<int>();
                foreach (var code in codes)
                {
                    if (!string.IsNullOrWhiteSpace(code))
                    {
                        var digits = new string(code.Where(char.IsDigit).ToArray());
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
                fdScheme.SchemeCode = $"FD{nextNum:D3}";
            }
            else
            {
                fdScheme.SchemeCode = fdScheme.SchemeCode.Trim();
            }

            if (fdScheme.FdLiabilityLedgerID.HasValue && fdScheme.FdLiabilityLedgerID.Value <= 0) fdScheme.FdLiabilityLedgerID = null;
            if (fdScheme.InterestExpenseLedgerID.HasValue && fdScheme.InterestExpenseLedgerID.Value <= 0) fdScheme.InterestExpenseLedgerID = null;
            if (fdScheme.InterestPayableLedgerID.HasValue && fdScheme.InterestPayableLedgerID.Value <= 0) fdScheme.InterestPayableLedgerID = null;
            if (fdScheme.PrematurePenaltyLedgerID.HasValue && fdScheme.PrematurePenaltyLedgerID.Value <= 0) fdScheme.PrematurePenaltyLedgerID = null;

            fdScheme.FdLiabilityLedger = null;
            fdScheme.InterestExpenseLedger = null;
            fdScheme.InterestPayableLedger = null;
            fdScheme.PrematurePenaltyLedger = null;
            fdScheme.Branch = null;
            fdScheme.IsActive = true;
            fdScheme.CreatedDate = DateTime.Now;

            _context.FdSchemes.Add(fdScheme);
            await _context.SaveChangesAsync();
            return CreatedAtAction("GetFdScheme", new { id = fdScheme.FdSchemeID }, fdScheme);
        }

        // PUT: api/FdSchemes/5
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<IActionResult> PutFdScheme(int id, FdScheme fdScheme)
        {
            if (id != fdScheme.FdSchemeID)
            {
                return BadRequest();
            }

            if (fdScheme.FdLiabilityLedgerID.HasValue && fdScheme.FdLiabilityLedgerID.Value <= 0) fdScheme.FdLiabilityLedgerID = null;
            if (fdScheme.InterestExpenseLedgerID.HasValue && fdScheme.InterestExpenseLedgerID.Value <= 0) fdScheme.InterestExpenseLedgerID = null;
            if (fdScheme.InterestPayableLedgerID.HasValue && fdScheme.InterestPayableLedgerID.Value <= 0) fdScheme.InterestPayableLedgerID = null;
            if (fdScheme.PrematurePenaltyLedgerID.HasValue && fdScheme.PrematurePenaltyLedgerID.Value <= 0) fdScheme.PrematurePenaltyLedgerID = null;

            fdScheme.FdLiabilityLedger = null;
            fdScheme.InterestExpenseLedger = null;
            fdScheme.InterestPayableLedger = null;
            fdScheme.PrematurePenaltyLedger = null;
            fdScheme.Branch = null;

            _context.Entry(fdScheme).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!FdSchemeExists(id))
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

        // DELETE: api/FdSchemes/5
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<IActionResult> DeleteFdScheme(int id)
        {
            var fdScheme = await _context.FdSchemes.FindAsync(id);
            if (fdScheme == null)
            {
                return NotFound();
            }

            // Check if any accounts exist under this scheme
            bool hasAccounts = await _context.FdAccounts.AnyAsync(a => a.FdSchemeID == id);
            if (hasAccounts)
            {
                return BadRequest("ही योजना हटवता येणार नाही कारण या योजनेखाली आधीच काही खाती उघडलेली आहेत.");
            }

            _context.FdSchemes.Remove(fdScheme);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool FdSchemeExists(int id)
        {
            return _context.FdSchemes.Any(e => e.FdSchemeID == id);
        }
    }
}
