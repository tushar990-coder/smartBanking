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
    public class InvestmentInstitutionsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public InvestmentInstitutionsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/InvestmentInstitutions
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetInvestmentInstitutions([FromQuery] int? branchId)
        {
            var query = _context.InvestmentInstitutions
                .AsNoTracking()
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(i => i.BranchID == branchId.Value);
            }

            var list = await query.ToListAsync();

            if (!list.Any())
            {
                var mainBranch = await _context.Branches.FirstOrDefaultAsync();
                int defaultBranchId = mainBranch?.BranchID ?? 1;

                var defaultInsts = new List<InvestmentInstitution>
                {
                    new InvestmentInstitution { InstitutionMasterID = 1, BranchID = defaultBranchId, InstitutionName = "जिल्हा मध्यवर्ती सहकारी बँक (DCC Bank)", InstitutionType = "Cooperative", InstitutionBranchName = "मुख्य शाखा", IsActive = true },
                    new InvestmentInstitution { InstitutionMasterID = 1, BranchID = defaultBranchId, InstitutionName = "स्टेट बँक ऑफ इंडिया (SBI)", InstitutionType = "Bank", InstitutionBranchName = "मुख्य शाखा", IsActive = true },
                    new InvestmentInstitution { InstitutionMasterID = 1, BranchID = defaultBranchId, InstitutionName = "महाराष्ट्र बँक (Bank of Maharashtra)", InstitutionType = "Bank", InstitutionBranchName = "मुख्य शाखा", IsActive = true },
                    new InvestmentInstitution { InstitutionMasterID = 1, BranchID = defaultBranchId, InstitutionName = "एचडीएफसी बँक (HDFC Bank)", InstitutionType = "Bank", InstitutionBranchName = "मुख्य शाखा", IsActive = true }
                };
                _context.InvestmentInstitutions.AddRange(defaultInsts);
                await _context.SaveChangesAsync();
                list = defaultInsts;
            }

            var branchesMap = await _context.Branches.ToDictionaryAsync(b => b.BranchID, b => b.BranchName);

            var result = list
                .OrderBy(i => i.InstitutionName)
                .Select(i => new {
                    i.InstitutionID,
                    i.BranchID,
                    BranchName = branchesMap.ContainsKey(i.BranchID) ? branchesMap[i.BranchID] : "मुख्य शाखा",
                    i.InstitutionName,
                    i.InstitutionType,
                    i.InstitutionBranchName,
                    i.Address,
                    i.ContactPerson,
                    i.MobileNumber,
                    i.EmailID,
                    i.IsActive
                })
                .ToList();

            return Ok(result);
        }

        // GET: api/InvestmentInstitutions/5
        [HttpGet("{id}")]
        public async Task<ActionResult<InvestmentInstitution>> GetInvestmentInstitution(int id)
        {
            var institution = await _context.InvestmentInstitutions.FindAsync(id);
            if (institution == null)
            {
                return NotFound();
            }
            return institution;
        }

        // POST: api/InvestmentInstitutions
        [HttpPost]
        public async Task<ActionResult> PostInvestmentInstitution([FromBody] InvestmentInstitution institution)
        {
            if (string.IsNullOrWhiteSpace(institution.InstitutionName))
            {
                return BadRequest("संस्थेचे नाव आवश्यक आहे.");
            }

            institution.CreatedDate = DateTime.Now;
            _context.InvestmentInstitutions.Add(institution);
            await _context.SaveChangesAsync();
            return Ok(institution);
        }

        // PUT: api/InvestmentInstitutions/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutInvestmentInstitution(int id, [FromBody] InvestmentInstitution institution)
        {
            var existingInst = await _context.InvestmentInstitutions.FindAsync(id);
            if (existingInst == null)
            {
                return NotFound("संस्था सापडली नाही.");
            }

            if (string.IsNullOrWhiteSpace(institution.InstitutionName))
            {
                return BadRequest("संस्थेचे नाव आवश्यक आहे.");
            }

            existingInst.BranchID = institution.BranchID > 0 ? institution.BranchID : existingInst.BranchID;
            existingInst.InstitutionName = institution.InstitutionName;
            existingInst.InstitutionType = !string.IsNullOrWhiteSpace(institution.InstitutionType) ? institution.InstitutionType : existingInst.InstitutionType;
            existingInst.InstitutionBranchName = institution.InstitutionBranchName ?? string.Empty;
            existingInst.Address = institution.Address;
            existingInst.ContactPerson = institution.ContactPerson;
            existingInst.MobileNumber = institution.MobileNumber;
            existingInst.EmailID = institution.EmailID;
            existingInst.IsActive = institution.IsActive;
            existingInst.ModifiedDate = DateTime.Now;

            await _context.SaveChangesAsync();
            return Ok(existingInst);
        }

        // DELETE: api/InvestmentInstitutions/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteInvestmentInstitution(int id)
        {
            var institution = await _context.InvestmentInstitutions.FindAsync(id);
            if (institution == null)
            {
                return NotFound();
            }

            // Check if any schemes or accounts reference this institution
            var hasSchemes = await _context.InvestmentSchemes.AnyAsync(s => s.InvestmentInstitutionID == id);
            var hasAccounts = await _context.InvestmentAccounts.AnyAsync(a => a.InvestmentInstitutionID == id);
            if (hasSchemes || hasAccounts)
            {
                return BadRequest("या संस्थेवर योजना किंवा गुंतवणूक खाती आहेत. प्रथम ती काढा.");
            }

            _context.InvestmentInstitutions.Remove(institution);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
