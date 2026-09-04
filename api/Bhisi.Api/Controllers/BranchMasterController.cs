using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    public class BranchMasterController : ControllerBase
    {
        private readonly AppDbContext _context;

        public BranchMasterController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<BranchMaster>>> GetBranchMasters()
        {
            return await _context.BranchMasters.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<BranchMaster>> GetBranchMaster(int id)
        {
            var branch = await _context.BranchMasters.FindAsync(id);

            if (branch == null)
            {
                return NotFound();
            }

            return branch;
        }

        [HttpPost]
        public async Task<ActionResult<BranchMaster>> PostBranchMaster(BranchMaster branch)
        {
            _context.BranchMasters.Add(branch);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetBranchMaster), new { id = branch.BranchID }, branch);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutBranchMaster(int id, BranchMaster branch)
        {
            if (id != branch.BranchID)
            {
                return BadRequest();
            }

            _context.Entry(branch).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!BranchMasterExists(id))
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
        public async Task<IActionResult> DeleteBranchMaster(int id)
        {
            var branch = await _context.BranchMasters.FindAsync(id);
            if (branch == null)
            {
                return NotFound();
            }

            var isUsed = await _context.EmployeeBankDetails.AnyAsync(e => e.BranchID == id);
            if (isUsed)
            {
                return BadRequest("ही कंपनी शाखा कर्मचाऱ्यांसाठी वापरली गेली आहे, त्यामुळे डिलीट करता येणार नाही.");
            }

            _context.BranchMasters.Remove(branch);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool BranchMasterExists(int id)
        {
            return _context.BranchMasters.Any(e => e.BranchID == id);
        }
    }
}
