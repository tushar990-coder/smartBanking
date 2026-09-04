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
    public class LockerTypesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LockerTypesController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/LockerTypes
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetLockerTypes([FromQuery] int? branchId)
        {
            var query = _context.LockerTypes
                .Include(t => t.DepositLiabilityLedger)
                .Include(t => t.RentIncomeLedger)
                .Include(t => t.LateFeeIncomeLedger)
                .Include(t => t.GstLiabilityLedger)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(t => t.BranchID == branchId.Value);
            }

            var types = await query
                .OrderBy(t => t.TypeName)
                .Select(t => new {
                    t.LockerTypeID,
                    t.BranchID,
                    t.TypeCode,
                    t.TypeName,
                    t.Dimensions,
                    t.AnnualRent,
                    t.SecurityDeposit,
                    t.LateFeePerMonth,
                    t.GstRate,
                    t.DepositLiabilityLedgerID,
                    DepositLiabilityLedgerName = t.DepositLiabilityLedger != null ? t.DepositLiabilityLedger.LedgerName : "",
                    t.RentIncomeLedgerID,
                    RentIncomeLedgerName = t.RentIncomeLedger != null ? t.RentIncomeLedger.LedgerName : "",
                    t.LateFeeIncomeLedgerID,
                    LateFeeIncomeLedgerName = t.LateFeeIncomeLedger != null ? t.LateFeeIncomeLedger.LedgerName : "",
                    t.GstLiabilityLedgerID,
                    GstLiabilityLedgerName = t.GstLiabilityLedger != null ? t.GstLiabilityLedger.LedgerName : "",
                    t.IsActive,
                    t.CreatedAt,
                    TotalLockersCount = _context.Lockers.Count(l => l.LockerTypeID == t.LockerTypeID),
                    AvailableLockersCount = _context.Lockers.Count(l => l.LockerTypeID == t.LockerTypeID && l.Status == "Available")
                })
                .ToListAsync();

            return Ok(types);
        }

        // GET: api/LockerTypes/5
        [HttpGet("{id}")]
        public async Task<ActionResult<LockerType>> GetLockerType(int id)
        {
            var lockerType = await _context.LockerTypes
                .Include(t => t.DepositLiabilityLedger)
                .Include(t => t.RentIncomeLedger)
                .Include(t => t.LateFeeIncomeLedger)
                .Include(t => t.GstLiabilityLedger)
                .FirstOrDefaultAsync(t => t.LockerTypeID == id);

            if (lockerType == null)
            {
                return NotFound(new { message = "लॉकर प्रकार सापडला नाही." });
            }

            return Ok(lockerType);
        }

        // POST: api/LockerTypes
        [HttpPost]
        public async Task<ActionResult<LockerType>> PostLockerType(LockerType lockerType)
        {
            if (string.IsNullOrWhiteSpace(lockerType.TypeName))
            {
                return BadRequest(new { message = "लॉकर प्रकाराचे नाव आवश्यक आहे." });
            }

            lockerType.CreatedAt = DateTime.Now;
            _context.LockerTypes.Add(lockerType);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetLockerType", new { id = lockerType.LockerTypeID }, lockerType);
        }

        // PUT: api/LockerTypes/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutLockerType(int id, LockerType lockerType)
        {
            if (id != lockerType.LockerTypeID)
            {
                return BadRequest(new { message = "अवैध लॉकर प्रकार आयडी." });
            }

            var existing = await _context.LockerTypes.FindAsync(id);
            if (existing == null)
            {
                return NotFound(new { message = "लॉकर प्रकार सापडला नाही." });
            }

            existing.TypeCode = lockerType.TypeCode;
            existing.TypeName = lockerType.TypeName;
            existing.Dimensions = lockerType.Dimensions;
            existing.AnnualRent = lockerType.AnnualRent;
            existing.SecurityDeposit = lockerType.SecurityDeposit;
            existing.LateFeePerMonth = lockerType.LateFeePerMonth;
            existing.GstRate = lockerType.GstRate;
            existing.DepositLiabilityLedgerID = lockerType.DepositLiabilityLedgerID;
            existing.RentIncomeLedgerID = lockerType.RentIncomeLedgerID;
            existing.LateFeeIncomeLedgerID = lockerType.LateFeeIncomeLedgerID;
            existing.GstLiabilityLedgerID = lockerType.GstLiabilityLedgerID;
            existing.IsActive = lockerType.IsActive;

            await _context.SaveChangesAsync();
            return Ok(existing);
        }

        // DELETE: api/LockerTypes/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteLockerType(int id)
        {
            var lockerType = await _context.LockerTypes.FindAsync(id);
            if (lockerType == null)
            {
                return NotFound(new { message = "लॉकर प्रकार सापडला नाही." });
            }

            bool hasLockers = await _context.Lockers.AnyAsync(l => l.LockerTypeID == id);
            if (hasLockers)
            {
                return BadRequest(new { message = "या प्रकारांतर्गत लॉकर्स नोंदणीकृत असल्याने हा प्रकार डिलीट करता येणार नाही. त्याऐवजी तो निष्क्रिय (Inactive) करा." });
            }

            _context.LockerTypes.Remove(lockerType);
            await _context.SaveChangesAsync();

            return Ok(new { message = "लॉकर प्रकार यशस्वीरीत्या डिलीट केला." });
        }
    }
}
