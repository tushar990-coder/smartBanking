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
    public class SansthaDetailsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SansthaDetailsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/SansthaDetails
        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<SansthaDetail>>> GetSansthaDetails()
        {
            return await _context.SansthaDetails.ToListAsync();
        }

        // GET: api/SansthaDetails/5
        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<ActionResult<SansthaDetail>> GetSansthaDetail(int id)
        {
            var sansthaDetail = await _context.SansthaDetails.FindAsync(id);

            if (sansthaDetail == null)
            {
                return NotFound();
            }

            return sansthaDetail;
        }

        // PUT: api/SansthaDetails/5
        [HttpPut("{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> PutSansthaDetail(int id, SansthaDetail sansthaDetail)
        {
            try
            {
                var existing = await _context.SansthaDetails.FindAsync(id);
                if (existing == null)
                {
                    existing = await _context.SansthaDetails.FirstOrDefaultAsync();
                    if (existing == null)
                    {
                        _context.SansthaDetails.Add(sansthaDetail);
                        await _context.SaveChangesAsync();
                        return Ok(sansthaDetail);
                    }
                }

                existing.SansthaName = sansthaDetail.SansthaName;
                existing.Address = sansthaDetail.Address;
                existing.Village = sansthaDetail.Village;
                existing.Taluka = sansthaDetail.Taluka;
                existing.District = sansthaDetail.District;
                existing.State = sansthaDetail.State;
                existing.PinCode = sansthaDetail.PinCode;
                existing.ContactNo = sansthaDetail.ContactNo;
                existing.Email = sansthaDetail.Email;
                existing.RegistrationNo = sansthaDetail.RegistrationNo;
                existing.RegistrationDate = sansthaDetail.RegistrationDate;
                existing.GSTNo = sansthaDetail.GSTNo;
                existing.LogoPath = sansthaDetail.LogoPath;
                existing.AutoPostVouchers = sansthaDetail.AutoPostVouchers;
                existing.AutoPostVoucherLimit = sansthaDetail.AutoPostVoucherLimit;
                existing.IsMobileCompulsory = sansthaDetail.IsMobileCompulsory;
                existing.IsAadhaarCompulsory = sansthaDetail.IsAadhaarCompulsory;
                existing.IsPanCompulsory = sansthaDetail.IsPanCompulsory;

                await _context.SaveChangesAsync();
                return Ok(existing);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "संस्था माहिती सेव्ह करताना तांत्रिक त्रुटी आली: " + ex.Message });
            }
        }

        // POST: api/SansthaDetails
        [HttpPost]
        [AllowAnonymous]
        public async Task<ActionResult<SansthaDetail>> PostSansthaDetail(SansthaDetail sansthaDetail)
        {
            try
            {
                var existing = await _context.SansthaDetails.FirstOrDefaultAsync();
                if (existing != null)
                {
                    existing.SansthaName = sansthaDetail.SansthaName;
                    existing.Address = sansthaDetail.Address;
                    existing.Village = sansthaDetail.Village;
                    existing.Taluka = sansthaDetail.Taluka;
                    existing.District = sansthaDetail.District;
                    existing.State = sansthaDetail.State;
                    existing.PinCode = sansthaDetail.PinCode;
                    existing.ContactNo = sansthaDetail.ContactNo;
                    existing.Email = sansthaDetail.Email;
                    existing.RegistrationNo = sansthaDetail.RegistrationNo;
                    existing.RegistrationDate = sansthaDetail.RegistrationDate;
                    existing.GSTNo = sansthaDetail.GSTNo;
                    existing.LogoPath = sansthaDetail.LogoPath;
                    existing.AutoPostVouchers = sansthaDetail.AutoPostVouchers;
                    existing.AutoPostVoucherLimit = sansthaDetail.AutoPostVoucherLimit;
                    existing.IsMobileCompulsory = sansthaDetail.IsMobileCompulsory;
                    existing.IsAadhaarCompulsory = sansthaDetail.IsAadhaarCompulsory;
                    existing.IsPanCompulsory = sansthaDetail.IsPanCompulsory;

                    await _context.SaveChangesAsync();
                    return Ok(existing);
                }

                _context.SansthaDetails.Add(sansthaDetail);
                await _context.SaveChangesAsync();

                return CreatedAtAction("GetSansthaDetail", new { id = sansthaDetail.SansthaID }, sansthaDetail);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "संस्था माहिती तयार करताना तांत्रिक त्रुटी आली: " + ex.Message });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSansthaDetail(int id)
        {
            var sansthaDetail = await _context.SansthaDetails.FindAsync(id);
            if (sansthaDetail == null)
            {
                return NotFound();
            }

            _context.SansthaDetails.Remove(sansthaDetail);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpPost("ToggleMigrationLock")]
        public async Task<IActionResult> ToggleMigrationLock()
        {
            var sansthaDetail = await _context.SansthaDetails.FirstOrDefaultAsync();
            if (sansthaDetail == null)
            {
                return NotFound("Sanstha details not found.");
            }

            sansthaDetail.IsMigrationLocked = !sansthaDetail.IsMigrationLocked;
            await _context.SaveChangesAsync();

            return Ok(new { message = $"Migration lock is now {(sansthaDetail.IsMigrationLocked ? "LOCKED" : "OPEN")}.", isLocked = sansthaDetail.IsMigrationLocked });
        }

        private bool SansthaDetailExists(int id)
        {
            return _context.SansthaDetails.Any(e => e.SansthaID == id);
        }
    }
}
