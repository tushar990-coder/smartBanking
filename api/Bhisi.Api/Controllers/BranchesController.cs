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
    public class BranchesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public BranchesController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<Branch>>> GetBranches()
        {
            try
            {
                var branches = await _context.Branches
                    .Include(b => b.DefaultCashLedger)
                    .ToListAsync();

                if (branches.Count == 0)
                {
                    var defaultBranch = new Branch
                    {
                        BranchCode = "MAIN",
                        BranchName = "मुख्य शाखा (Main Branch)",
                        Address = "मुख्य कार्यालय",
                        IsActive = true
                    };
                    _context.Branches.Add(defaultBranch);
                    await _context.SaveChangesAsync();
                    branches.Add(defaultBranch);
                }

                return branches;
            }
            catch
            {
                return Ok(new List<Branch>
                {
                    new Branch
                    {
                        BranchID = 1,
                        BranchCode = "MAIN",
                        BranchName = "मुख्य शाखा (Main Branch)",
                        Address = "मुख्य कार्यालय",
                        IsActive = true
                    }
                });
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Branch>> GetBranch(int id)
        {
            var branch = await _context.Branches
                .Include(b => b.DefaultCashLedger)
                .FirstOrDefaultAsync(b => b.BranchID == id);

            if (branch == null)
            {
                return NotFound();
            }

            return branch;
        }

        [HttpPost]
        public async Task<ActionResult<Branch>> PostBranch(Branch branch)
        {
            if (string.IsNullOrWhiteSpace(branch.BranchCode))
            {
                return BadRequest("शाखा कोड प्रविष्ट करणे अनिवार्य आहे.");
            }

            if (string.IsNullOrWhiteSpace(branch.BranchName))
            {
                return BadRequest("शाखेचे नाव प्रविष्ट करणे अनिवार्य आहे.");
            }

            // Check duplicate branch code
            var codeExists = await _context.Branches.AnyAsync(b => b.BranchCode.ToLower() == branch.BranchCode.Trim().ToLower());
            if (codeExists)
            {
                return BadRequest($"'{branch.BranchCode}' हा शाखा कोड आधीच वापरलेला आहे. कृपया दुसरा नवीन कोड प्रविष्ट करा.");
            }

            // Check single Head Office constraint
            if (string.Equals(branch.BranchType, "HeadOffice", StringComparison.OrdinalIgnoreCase))
            {
                var existingHo = await _context.Branches.AnyAsync(b => b.IsActive && b.BranchType != null && b.BranchType.ToLower() == "headoffice");
                if (existingHo)
                {
                    return BadRequest("सिस्टीममध्ये फक्त एकच मुख्य कार्यालय (Head Office) असू शकते.");
                }
            }

            branch.BranchCode = branch.BranchCode.Trim().ToUpper();
            branch.BranchName = branch.BranchName.Trim();

            _context.Branches.Add(branch);
            await _context.SaveChangesAsync();

            return Ok(branch);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutBranch(int id, Branch branch)
        {
            if (id != branch.BranchID)
            {
                return BadRequest("अवैध शाखा ID.");
            }

            if (string.IsNullOrWhiteSpace(branch.BranchCode))
            {
                return BadRequest("शाखा कोड प्रविष्ट करणे अनिवार्य आहे.");
            }

            if (string.IsNullOrWhiteSpace(branch.BranchName))
            {
                return BadRequest("शाखेचे नाव प्रविष्ट करणे अनिवार्य आहे.");
            }

            // Check duplicate branch code for other branches
            var codeExists = await _context.Branches.AnyAsync(b => b.BranchID != id && b.BranchCode.ToLower() == branch.BranchCode.Trim().ToLower());
            if (codeExists)
            {
                return BadRequest($"'{branch.BranchCode}' हा शाखा कोड आधीच वापरलेला आहे. कृपया दुसरा नवीन कोड प्रविष्ट करा.");
            }

            // Check single Head Office constraint
            if (string.Equals(branch.BranchType, "HeadOffice", StringComparison.OrdinalIgnoreCase))
            {
                var existingHo = await _context.Branches.AnyAsync(b => b.BranchID != id && b.IsActive && b.BranchType != null && b.BranchType.ToLower() == "headoffice");
                if (existingHo)
                {
                    return BadRequest("सिस्टीममध्ये फक्त एकच मुख्य कार्यालय (Head Office) असू शकते.");
                }
            }

            branch.BranchCode = branch.BranchCode.Trim().ToUpper();
            branch.BranchName = branch.BranchName.Trim();

            _context.Entry(branch).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!BranchExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return Ok(branch);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteBranch(int id)
        {
            var branch = await _context.Branches.FindAsync(id);
            if (branch == null)
            {
                return NotFound();
            }

            if (string.Equals(branch.BranchType, "HeadOffice", StringComparison.OrdinalIgnoreCase) || branch.BranchID == 1)
            {
                return BadRequest("मुख्य कार्यालय (Head Office) डिलीट करता येणार नाही. ही सिस्टीमची मुख्य शाखा आहे.");
            }

            // Core Banking Rule: Do not delete branch with mapped data
            var hasMembers = await _context.Members.AnyAsync(m => m.BranchID == id);
            var hasSavings = await _context.SavingAccountMasters.AnyAsync(s => s.BranchID == id);
            var hasLoans = await _context.LoanAccounts.AnyAsync(l => l.BranchID == id);
            var hasVouchers = await _context.Vouchers.AnyAsync(v => v.BranchID == id);

            if (hasMembers || hasSavings || hasLoans || hasVouchers)
            {
                return BadRequest("या शाखेमध्ये सभासद, बचत किंवा कर्ज खाती उपलब्ध असल्यामुळे ही शाखा डिलीट करता येणार नाही.");
            }

            _context.Branches.Remove(branch);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool BranchExists(int id)
        {
            return _context.Branches.Any(e => e.BranchID == id);
        }
    }
}
