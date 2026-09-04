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
    public class LockersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LockersController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/Lockers
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetLockers([FromQuery] int? branchId, [FromQuery] string? cabinetNo, [FromQuery] string? status)
        {
            var query = _context.Lockers
                .Include(l => l.LockerType)
                .Include(l => l.Branch)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(l => l.BranchID == branchId.Value);
            }
            if (!string.IsNullOrWhiteSpace(cabinetNo))
            {
                query = query.Where(l => l.CabinetNo == cabinetNo);
            }
            if (!string.IsNullOrWhiteSpace(status) && status != "All")
            {
                query = query.Where(l => l.Status == status);
            }

            var activeAllotments = await _context.LockerAllotments
                .Include(a => a.Member)
                .Where(a => a.Status == "Active")
                .ToDictionaryAsync(a => a.LockerID, a => new {
                    a.AllotmentID,
                    a.LockerAccountNo,
                    MemberName = (a.Member != null ? $"{a.Member.MemberCode ?? a.Member.MemberID.ToString()} - {a.Member.FirstName} {a.Member.LastName}" : ""),
                    a.AllotmentDate,
                    a.ExpiryDate
                });

            var lockers = await query
                .OrderBy(l => l.CabinetNo)
                .ThenBy(l => l.LockerNo)
                .Select(l => new {
                    l.LockerID,
                    l.BranchID,
                    l.CabinetNo,
                    l.LockerNo,
                    l.KeyNo,
                    l.LockerTypeID,
                    TypeName = l.LockerType != null ? l.LockerType.TypeName : "",
                    TypeCode = l.LockerType != null ? l.LockerType.TypeCode : "",
                    Dimensions = l.LockerType != null ? l.LockerType.Dimensions : "",
                    AnnualRent = l.LockerType != null ? l.LockerType.AnnualRent : 0,
                    SecurityDeposit = l.LockerType != null ? l.LockerType.SecurityDeposit : 0,
                    l.Status,
                    l.Remarks,
                    l.IsActive,
                    l.CreatedAt
                })
                .ToListAsync();

            var result = lockers.Select(l => new {
                l.LockerID,
                l.BranchID,
                l.CabinetNo,
                l.LockerNo,
                l.KeyNo,
                l.LockerTypeID,
                l.TypeName,
                l.TypeCode,
                l.Dimensions,
                l.AnnualRent,
                l.SecurityDeposit,
                l.Status,
                l.Remarks,
                l.IsActive,
                l.CreatedAt,
                CurrentAllotment = activeAllotments.ContainsKey(l.LockerID) ? activeAllotments[l.LockerID] : null
            });

            return Ok(result);
        }

        // GET: api/Lockers/Cabinets
        [HttpGet("Cabinets")]
        public async Task<ActionResult<IEnumerable<string>>> GetCabinets([FromQuery] int? branchId)
        {
            var query = _context.Lockers.AsQueryable();
            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(l => l.BranchID == branchId.Value);
            }

            var cabinets = await query
                .Select(l => l.CabinetNo)
                .Distinct()
                .OrderBy(c => c)
                .ToListAsync();

            return Ok(cabinets);
        }

        // GET: api/Lockers/RackOverview
        [HttpGet("RackOverview")]
        public async Task<ActionResult<object>> GetRackOverview([FromQuery] int? branchId)
        {
            var query = _context.Lockers
                .Include(l => l.LockerType)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(l => l.BranchID == branchId.Value);
            }

            var lockersList = await query
                .OrderBy(l => l.CabinetNo)
                .ThenBy(l => l.LockerNo)
                .ToListAsync();

            var activeAllotments = await _context.LockerAllotments
                .Include(a => a.Member)
                .Where(a => a.Status == "Active")
                .ToDictionaryAsync(a => a.LockerID, a => new {
                    a.AllotmentID,
                    a.LockerAccountNo,
                    MemberName = (a.Member != null ? $"{a.Member.MemberCode ?? a.Member.MemberID.ToString()} - {a.Member.FirstName} {a.Member.LastName}" : ""),
                    a.AllotmentDate,
                    a.ExpiryDate,
                    IsOverdue = a.ExpiryDate < DateTime.Today
                });

            var groupedByCabinet = lockersList
                .GroupBy(l => l.CabinetNo)
                .Select(g => new {
                    CabinetNo = g.Key,
                    TotalCount = g.Count(),
                    AvailableCount = g.Count(x => x.Status == "Available"),
                    AllottedCount = g.Count(x => x.Status == "Allotted"),
                    MaintenanceCount = g.Count(x => x.Status == "UnderMaintenance"),
                    SealedCount = g.Count(x => x.Status == "Sealed"),
                    Lockers = g.Select(l => new {
                        l.LockerID,
                        l.CabinetNo,
                        l.LockerNo,
                        l.KeyNo,
                        l.LockerTypeID,
                        TypeName = l.LockerType?.TypeName ?? "",
                        TypeCode = l.LockerType?.TypeCode ?? "",
                        Dimensions = l.LockerType?.Dimensions ?? "",
                        AnnualRent = l.LockerType?.AnnualRent ?? 0,
                        SecurityDeposit = l.LockerType?.SecurityDeposit ?? 0,
                        l.Status,
                        l.Remarks,
                        Allotment = activeAllotments.ContainsKey(l.LockerID) ? activeAllotments[l.LockerID] : null
                    }).ToList()
                }).ToList();

            var summary = new {
                TotalLockers = lockersList.Count,
                AvailableLockers = lockersList.Count(l => l.Status == "Available"),
                AllottedLockers = lockersList.Count(l => l.Status == "Allotted"),
                MaintenanceLockers = lockersList.Count(l => l.Status == "UnderMaintenance"),
                SealedLockers = lockersList.Count(l => l.Status == "Sealed"),
                Cabinets = groupedByCabinet
            };

            return Ok(summary);
        }

        // GET: api/Lockers/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Locker>> GetLocker(int id)
        {
            var locker = await _context.Lockers
                .Include(l => l.LockerType)
                .FirstOrDefaultAsync(l => l.LockerID == id);

            if (locker == null)
            {
                return NotFound(new { message = "लॉकर सापडला नाही." });
            }

            return Ok(locker);
        }

        // POST: api/Lockers
        [HttpPost]
        public async Task<ActionResult<Locker>> PostLocker(Locker locker)
        {
            if (string.IsNullOrWhiteSpace(locker.LockerNo))
            {
                return BadRequest(new { message = "लॉकर क्रमांक आवश्यक आहे." });
            }

            bool exists = await _context.Lockers.AnyAsync(l => 
                l.BranchID == locker.BranchID && 
                l.CabinetNo == locker.CabinetNo && 
                l.LockerNo == locker.LockerNo);

            if (exists)
            {
                return BadRequest(new { message = $"कपाट '{locker.CabinetNo}' मध्ये लॉकर क्र. '{locker.LockerNo}' आधीच नोंदणीकृत आहे." });
            }

            locker.CreatedAt = DateTime.Now;
            _context.Lockers.Add(locker);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetLocker", new { id = locker.LockerID }, locker);
        }

        // POST: api/Lockers/BulkCreate
        [HttpPost("BulkCreate")]
        public async Task<ActionResult<object>> BulkCreateLockers([FromBody] BulkLockerCreateDto dto)
        {
            if (dto.StartNo > dto.EndNo || dto.EndNo - dto.StartNo > 200)
            {
                return BadRequest(new { message = "क्रमांकांची मर्यादा कमाल २०० लॉकर्स असावी." });
            }

            var createdLockers = new List<Locker>();
            for (int i = dto.StartNo; i <= dto.EndNo; i++)
            {
                string lockerNo = $"{dto.Prefix}{i}{dto.Suffix}";
                string keyNo = string.IsNullOrWhiteSpace(dto.KeyPrefix) ? $"K-{lockerNo}" : $"{dto.KeyPrefix}{i}";

                bool exists = await _context.Lockers.AnyAsync(l => 
                    l.BranchID == dto.BranchID && 
                    l.CabinetNo == dto.CabinetNo && 
                    l.LockerNo == lockerNo);

                if (!exists)
                {
                    var l = new Locker
                    {
                        BranchID = dto.BranchID,
                        CabinetNo = dto.CabinetNo,
                        LockerNo = lockerNo,
                        KeyNo = keyNo,
                        LockerTypeID = dto.LockerTypeID,
                        Status = "Available",
                        Remarks = dto.Remarks,
                        IsActive = true,
                        CreatedAt = DateTime.Now
                    };
                    _context.Lockers.Add(l);
                    createdLockers.Add(l);
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { 
                message = $"{createdLockers.Count} लॉकर्स यशस्वीरीत्या तयार केले.",
                count = createdLockers.Count
            });
        }

        // PUT: api/Lockers/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutLocker(int id, Locker locker)
        {
            if (id != locker.LockerID)
            {
                return BadRequest(new { message = "अवैध लॉकर आयडी." });
            }

            var existing = await _context.Lockers.FindAsync(id);
            if (existing == null)
            {
                return NotFound(new { message = "लॉकर सापडला नाही." });
            }

            existing.CabinetNo = locker.CabinetNo;
            existing.LockerNo = locker.LockerNo;
            existing.KeyNo = locker.KeyNo;
            existing.LockerTypeID = locker.LockerTypeID;
            existing.Status = locker.Status;
            existing.Remarks = locker.Remarks;
            existing.IsActive = locker.IsActive;

            await _context.SaveChangesAsync();
            return Ok(existing);
        }

        // DELETE: api/Lockers/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteLocker(int id)
        {
            var locker = await _context.Lockers.FindAsync(id);
            if (locker == null)
            {
                return NotFound(new { message = "लॉकर सापडला नाही." });
            }

            bool hasAllotments = await _context.LockerAllotments.AnyAsync(a => a.LockerID == id);
            if (hasAllotments)
            {
                return BadRequest(new { message = "या लॉकरचे वाटप रेकॉर्ड अस्तित्वात असल्याने हा लॉकर डिलीट करता येणार नाही." });
            }

            _context.Lockers.Remove(locker);
            await _context.SaveChangesAsync();

            return Ok(new { message = "लॉकर यशस्वीरीत्या डिलीट केला." });
        }
    }

    public class BulkLockerCreateDto
    {
        public int BranchID { get; set; } = 1;
        public string CabinetNo { get; set; } = "C-1";
        public int StartNo { get; set; }
        public int EndNo { get; set; }
        public string Prefix { get; set; } = "";
        public string Suffix { get; set; } = "";
        public string KeyPrefix { get; set; } = "K-";
        public int LockerTypeID { get; set; }
        public string? Remarks { get; set; }
    }
}
