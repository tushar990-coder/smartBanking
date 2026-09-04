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
    public class DemandRecoveriesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DemandRecoveriesController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/DemandRecoveries
        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<DemandRecovery>>> GetDemandRecoveries()
        {
            return await _context.DemandRecoveries
                .Include(d => d.DemandNotice)
                .OrderByDescending(d => d.RecoveryDate)
                .ToListAsync();
        }

        [HttpPost("process")]
        [AllowAnonymous]
        public async Task<ActionResult<DemandRecovery>> ProcessRecovery([FromBody] ProcessRecoveryDto request)
        {
            var demand = await _context.DemandNotices
                .Include(d => d.MemberDetails)
                .FirstOrDefaultAsync(d => d.DemandNoticeId == request.DemandNoticeId);

            if (demand == null) return NotFound("Demand notice not found.");
            
            if (demand.Status == "Received") return BadRequest("Demand already fully received.");

            var recovery = new DemandRecovery
            {
                DemandNoticeId = request.DemandNoticeId,
                RecoveryDate = request.RecoveryDate,
                TotalReceivedAmount = request.TotalReceivedAmount,
                Remarks = request.Remarks
            };

            // Process recovery logic:
            // - Distribute received amount to individual member accounts.
            // - If partial payment, decide how to distribute.
            // - Update `DemandMemberDetail.IsProcessed = true`.
            // - Update DemandNotice.Status to "Received" or "PartiallyReceived".
            
            // For now, simple implementation
            demand.Status = "Received";
            foreach (var detail in demand.MemberDetails)
            {
                detail.IsProcessed = true;
                // Here we would create actual SavingTransaction, LoanCollection, etc.
            }

            _context.DemandRecoveries.Add(recovery);
            await _context.SaveChangesAsync();

            return Ok(recovery);
        }
    }

    public class ProcessRecoveryDto
    {
        public int DemandNoticeId { get; set; }
        public DateTime RecoveryDate { get; set; }
        public decimal TotalReceivedAmount { get; set; }
        public string? Remarks { get; set; }
    }
}
