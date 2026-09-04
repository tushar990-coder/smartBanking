using System;
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
    public class LockerVisitsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LockerVisitsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/LockerVisits
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetLockerVisits([FromQuery] int? branchId, [FromQuery] int? allotmentId, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate)
        {
            var query = _context.LockerVisitRegisters
                .Include(v => v.Allotment).ThenInclude(a => a!.Locker)
                .Include(v => v.Allotment).ThenInclude(a => a!.Member)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(v => v.BranchID == branchId.Value);
            }
            if (allotmentId.HasValue && allotmentId.Value > 0)
            {
                query = query.Where(v => v.AllotmentID == allotmentId.Value);
            }
            if (fromDate.HasValue)
            {
                query = query.Where(v => v.VisitDate >= fromDate.Value.Date);
            }
            if (toDate.HasValue)
            {
                query = query.Where(v => v.VisitDate <= toDate.Value.Date);
            }

            var list = await query
                .OrderByDescending(v => v.VisitDate)
                .ThenByDescending(v => v.VisitID)
                .Select(v => new {
                    v.VisitID,
                    v.BranchID,
                    v.AllotmentID,
                    LockerAccountNo = v.Allotment != null ? v.Allotment.LockerAccountNo : "",
                    LockerNo = v.Allotment != null && v.Allotment.Locker != null ? v.Allotment.Locker.LockerNo : "",
                    CabinetNo = v.Allotment != null && v.Allotment.Locker != null ? v.Allotment.Locker.CabinetNo : "",
                    KeyNo = v.Allotment != null && v.Allotment.Locker != null ? v.Allotment.Locker.KeyNo : "",
                    MemberName = v.Allotment != null && v.Allotment.Member != null ? $"{v.Allotment.Member.FirstName} {v.Allotment.Member.LastName}" : "",
                    v.VisitDate,
                    v.TimeIn,
                    v.TimeOut,
                    v.OperatedBy,
                    v.OperatorName,
                    v.IsSignatureVerified,
                    v.BankOfficerName,
                    v.Remarks,
                    v.CreatedAt
                })
                .ToListAsync();

            return Ok(list);
        }

        // POST: api/LockerVisits
        [HttpPost]
        public async Task<ActionResult<object>> PostLockerVisit([FromBody] LockerVisitCreateDto dto)
        {
            var allotment = await _context.LockerAllotments
                .Include(a => a.Locker)
                .Include(a => a.Member)
                .FirstOrDefaultAsync(a => a.AllotmentID == dto.AllotmentID);

            if (allotment == null)
            {
                return BadRequest(new { message = "लॉकर खाते सापडले नाही." });
            }

            if (allotment.Status != "Active")
            {
                return BadRequest(new { message = $"हे लॉकर खाते सक्रिय नाही. स्थिती: {allotment.Status}" });
            }

            var visit = new LockerVisitRegister
            {
                BranchID = dto.BranchID,
                AllotmentID = dto.AllotmentID,
                VisitDate = dto.VisitDate,
                TimeIn = string.IsNullOrWhiteSpace(dto.TimeIn) ? DateTime.Now.ToString("hh:mm tt") : dto.TimeIn,
                TimeOut = dto.TimeOut,
                OperatedBy = dto.OperatedBy,
                OperatorName = dto.OperatorName,
                IsSignatureVerified = dto.IsSignatureVerified,
                BankOfficerName = dto.BankOfficerName,
                Remarks = dto.Remarks,
                CreatedAt = DateTime.Now
            };

            _context.LockerVisitRegisters.Add(visit);
            await _context.SaveChangesAsync();

            return Ok(new {
                message = "लॉकर हाताळणी नोंद यशस्वीरीत्या सेव्ह झाली.",
                visitID = visit.VisitID
            });
        }

        // PUT: api/LockerVisits/5/TimeOut
        [HttpPut("{id}/TimeOut")]
        public async Task<IActionResult> UpdateTimeOut(int id, [FromBody] TimeOutUpdateDto dto)
        {
            var visit = await _context.LockerVisitRegisters.FindAsync(id);
            if (visit == null)
            {
                return NotFound(new { message = "व्हिजिट नोंद सापडली नाही." });
            }

            visit.TimeOut = string.IsNullOrWhiteSpace(dto.TimeOut) ? DateTime.Now.ToString("hh:mm tt") : dto.TimeOut;
            if (!string.IsNullOrWhiteSpace(dto.Remarks))
            {
                visit.Remarks = (string.IsNullOrEmpty(visit.Remarks) ? "" : visit.Remarks + " | ") + dto.Remarks;
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "बाहेर पडण्याची वेळ (Time Out) नोंदवली गेली." });
        }

        // DELETE: api/LockerVisits/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteLockerVisit(int id)
        {
            var visit = await _context.LockerVisitRegisters.FindAsync(id);
            if (visit == null)
            {
                return NotFound(new { message = "व्हिजिट नोंद सापडली नाही." });
            }

            _context.LockerVisitRegisters.Remove(visit);
            await _context.SaveChangesAsync();

            return Ok(new { message = "व्हिजिट नोंद डिलीट केली." });
        }
    }

    public class LockerVisitCreateDto
    {
        public int BranchID { get; set; } = 1;
        public int AllotmentID { get; set; }
        public DateTime VisitDate { get; set; } = DateTime.Today;
        public string? TimeIn { get; set; }
        public string? TimeOut { get; set; }
        public string OperatedBy { get; set; } = "PrimaryMember";
        public string OperatorName { get; set; } = string.Empty;
        public bool IsSignatureVerified { get; set; } = true;
        public string? BankOfficerName { get; set; }
        public string? Remarks { get; set; }
    }

    public class TimeOutUpdateDto
    {
        public string? TimeOut { get; set; }
        public string? Remarks { get; set; }
    }
}
