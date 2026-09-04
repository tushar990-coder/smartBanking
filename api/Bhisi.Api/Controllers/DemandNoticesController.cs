using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DemandNoticesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DemandNoticesController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/DemandNotices
        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<DemandNotice>>> GetDemandNotices()
        {
            return await _context.DemandNotices
                .Include(d => d.Employer)
                .OrderByDescending(d => d.Year)
                .ThenByDescending(d => d.Month)
                .ToListAsync();
        }

        // GET: api/DemandNotices/5
        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<ActionResult<DemandNotice>> GetDemandNotice(int id)
        {
            var demandNotice = await _context.DemandNotices
                .Include(d => d.Employer)
                .Include(d => d.MemberDetails)
                    .ThenInclude(md => md.Member)
                .FirstOrDefaultAsync(d => d.DemandNoticeId == id);

            if (demandNotice == null)
            {
                return NotFound();
            }

            return demandNotice;
        }

        [HttpPost("generate")]
        [AllowAnonymous]
        public async Task<ActionResult<DemandNotice>> GenerateDemand([FromBody] GenerateDemandDto request)
        {
            // Check if demand already exists for this employer, month and year
            var existing = await _context.DemandNotices
                .FirstOrDefaultAsync(d => d.EmployerId == request.EmployerId && d.Month == request.Month && d.Year == request.Year);
            
            if (existing != null)
            {
                return BadRequest("Demand notice already exists for this employer for the specified month and year.");
            }

            var employer = await _context.EmployerMasters.FindAsync(request.EmployerId);
            if (employer == null) return NotFound("Employer not found.");

            // 1. Fetch all active members for this employer
            var members = await _context.Members
                .Where(m => m.EmployerId == request.EmployerId && m.Status == "Active")
                .ToListAsync();

            var memberIds = members.Select(m => m.MemberID).ToList();

            // 2. Fetch all active loan accounts for these members (example: EMI deduction)
            var activeLoans = await _context.LoanAccounts
                .Where(l => l.MemberID.HasValue && memberIds.Contains(l.MemberID.Value) && l.Status == "Active")
                .ToListAsync();

            // 3. Fetch saving accounts for compulsory deduction, etc. (Simplification)
            
            var demandNotice = new DemandNotice
            {
                NoticeNumber = $"DEM-{request.EmployerId}-{request.Month}-{request.Year}",
                Month = request.Month,
                Year = request.Year,
                EmployerId = request.EmployerId,
                Status = "Pending"
            };

            var details = new List<DemandMemberDetail>();

            foreach (var member in members)
            {
                // Calculate EMI
                var memberLoans = activeLoans.Where(l => l.MemberID == member.MemberID).ToList();
                decimal emiTotal = memberLoans.Sum(l => l.InstallmentAmount);

                // Assuming some fixed saving/share deduction for example
                decimal savingDeduction = 500; // Example fixed amount
                decimal shareDeduction = 100; // Example fixed amount

                var detail = new DemandMemberDetail
                {
                    MemberId = member.MemberID,
                    LoanInstallment = emiTotal,
                    SavingDeposit = savingDeduction,
                    ShareDeposit = shareDeduction,
                    TotalDeduction = emiTotal + savingDeduction + shareDeduction
                };

                if (detail.TotalDeduction > 0)
                {
                    details.Add(detail);
                }
            }

            demandNotice.MemberDetails = details;
            demandNotice.TotalDemandAmount = details.Sum(d => d.TotalDeduction);

            _context.DemandNotices.Add(demandNotice);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetDemandNotice", new { id = demandNotice.DemandNoticeId }, demandNotice);
        }
    }

    public class GenerateDemandDto
    {
        public int EmployerId { get; set; }
        public int Month { get; set; }
        public int Year { get; set; }
    }
}
