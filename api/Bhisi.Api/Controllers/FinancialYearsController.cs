using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [AllowAnonymous]
    public class FinancialYearsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public FinancialYearsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<FinancialYear>>> GetFinancialYears()
        {
            try
            {
                var years = await _context.FinancialYears.ToListAsync();
                if (years.Count == 0)
                {
                    var defaultYear = new FinancialYear
                    {
                        YearCode = "2026-2027",
                        StartDate = new DateTime(2026, 4, 1),
                        EndDate = new DateTime(2027, 3, 31),
                        IsActive = true,
                        IsClosed = false
                    };
                    _context.FinancialYears.Add(defaultYear);
                    await _context.SaveChangesAsync();
                    years.Add(defaultYear);
                }
                return years;
            }
            catch
            {
                return Ok(new List<FinancialYear>
                {
                    new FinancialYear
                    {
                        FinancialYearID = 1,
                        YearCode = "2026-2027",
                        StartDate = new DateTime(2026, 4, 1),
                        EndDate = new DateTime(2027, 3, 31),
                        IsActive = true,
                        IsClosed = false
                    }
                });
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<FinancialYear>> GetFinancialYear(int id)
        {
            var financialYear = await _context.FinancialYears.FindAsync(id);

            if (financialYear == null)
            {
                return NotFound();
            }

            return financialYear;
        }

        [HttpPost]
        public async Task<ActionResult<FinancialYear>> PostFinancialYear(FinancialYear financialYear)
        {
            // If the new one is active, deactivate others
            if (financialYear.IsActive)
            {
                var existingActive = await _context.FinancialYears.Where(f => f.IsActive).ToListAsync();
                foreach (var active in existingActive)
                {
                    active.IsActive = false;
                }
            }

            _context.FinancialYears.Add(financialYear);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetFinancialYear), new { id = financialYear.FinancialYearID }, financialYear);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutFinancialYear(int id, FinancialYear financialYear)
        {
            if (id != financialYear.FinancialYearID)
            {
                return BadRequest();
            }

            if (financialYear.IsActive)
            {
                var existingActive = await _context.FinancialYears.Where(f => f.IsActive && f.FinancialYearID != id).ToListAsync();
                foreach (var active in existingActive)
                {
                    active.IsActive = false;
                }
            }

            _context.Entry(financialYear).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!FinancialYearExists(id))
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

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteFinancialYear(int id)
        {
            var financialYear = await _context.FinancialYears.FindAsync(id);
            if (financialYear == null)
            {
                return NotFound("Financial Year not found.");
            }

            try
            {
                _context.FinancialYears.Remove(financialYear);
                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (DbUpdateException)
            {
                return BadRequest("या आर्थिक वर्षाशी संबंधित डेटाबेस मध्ये नोंदी असल्यामुळे हे वर्ष डिलीट करता येत नाही.");
            }
        }

        private bool FinancialYearExists(int id)
        {
            return _context.FinancialYears.Any(e => e.FinancialYearID == id);
        }
    }
}
