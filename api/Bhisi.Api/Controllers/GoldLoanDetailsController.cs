using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class GoldLoanDetailsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public GoldLoanDetailsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/GoldLoanDetails/ByLoanAccount/5
        [HttpGet("ByLoanAccount/{loanAccountId}")]
        public async Task<ActionResult<IEnumerable<GoldLoanDetail>>> GetGoldDetailsForLoan(int loanAccountId)
        {
            return await _context.GoldLoanDetails
                .Where(g => g.LoanAccountID == loanAccountId)
                .ToListAsync();
        }

        // GET: api/GoldLoanDetails/5
        [HttpGet("{id}")]
        public async Task<ActionResult<GoldLoanDetail>> GetGoldLoanDetail(int id)
        {
            var goldLoanDetail = await _context.GoldLoanDetails.FindAsync(id);

            if (goldLoanDetail == null)
            {
                return NotFound();
            }

            return goldLoanDetail;
        }

        // POST: api/GoldLoanDetails
        [HttpPost]
        public async Task<ActionResult<GoldLoanDetail>> PostGoldLoanDetail(GoldLoanDetail goldLoanDetail)
        {
            // Auto-calculate EstimatedValue if frontend didn't set it accurately
            if(goldLoanDetail.EstimatedValue == 0)
            {
                goldLoanDetail.EstimatedValue = goldLoanDetail.NetWeight * goldLoanDetail.GoldRatePerGram;
            }

            _context.GoldLoanDetails.Add(goldLoanDetail);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetGoldLoanDetail), new { id = goldLoanDetail.GoldLoanDetailID }, goldLoanDetail);
        }

        // PUT: api/GoldLoanDetails/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutGoldLoanDetail(int id, GoldLoanDetail goldLoanDetail)
        {
            if (id != goldLoanDetail.GoldLoanDetailID)
            {
                return BadRequest();
            }

            _context.Entry(goldLoanDetail).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!GoldLoanDetailExists(id))
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

        // DELETE: api/GoldLoanDetails/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteGoldLoanDetail(int id)
        {
            var goldLoanDetail = await _context.GoldLoanDetails.FindAsync(id);
            if (goldLoanDetail == null)
            {
                return NotFound();
            }

            _context.GoldLoanDetails.Remove(goldLoanDetail);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool GoldLoanDetailExists(int id)
        {
            return _context.GoldLoanDetails.Any(e => e.GoldLoanDetailID == id);
        }
    }
}
