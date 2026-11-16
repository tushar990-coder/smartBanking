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

        private static bool TryValidateFdRenewalReceiptPolicy(string? rawPolicy, out string normalizedPolicy, out string? errorMessage)
        {
            if (Helpers.FdRenewalPolicyHelper.TryNormalizePolicy(rawPolicy, out normalizedPolicy))
            {
                errorMessage = null;
                return true;
            }

            errorMessage = $"अवैध मुदत ठेव नूतनीकरण पावती धोरण '{rawPolicy}'. वैध पर्याय: NEW_RECEIPT, RETAIN_ORIGINAL, NEXT_LEGACY, HYBRID_CHOICE.";
            return false;
        }

        private static void ApplySansthaEditableFields(SansthaDetail target, SansthaDetail source, string normalizedPolicy)
        {
            target.SansthaName = source.SansthaName;
            target.Address = source.Address;
            target.Village = source.Village;
            target.Taluka = source.Taluka;
            target.District = source.District;
            target.State = source.State;
            target.PinCode = source.PinCode;
            target.ContactNo = source.ContactNo;
            target.Email = source.Email;
            target.RegistrationNo = source.RegistrationNo;
            target.RegistrationDate = source.RegistrationDate;
            target.GSTNo = source.GSTNo;
            target.LogoPath = source.LogoPath;
            target.AutoPostVouchers = false;
            target.AutoPostVoucherLimit = 0m;
            target.IsMobileCompulsory = source.IsMobileCompulsory;
            target.IsAadhaarCompulsory = source.IsAadhaarCompulsory;
            target.IsPanCompulsory = source.IsPanCompulsory;
            target.FdRenewalReceiptPolicy = normalizedPolicy;
            target.AllowManualReceiptNoOnRenewal = normalizedPolicy == Helpers.FdRenewalPolicyHelper.PolicyRetainOriginal
                ? false
                : source.AllowManualReceiptNoOnRenewal;
        }

        // PUT: api/SansthaDetails/5
        [HttpPut("{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> PutSansthaDetail(int id, SansthaDetail sansthaDetail)
        {
            try
            {
                if (!TryValidateFdRenewalReceiptPolicy(sansthaDetail.FdRenewalReceiptPolicy, out string normalizedPolicy, out string? policyError))
                {
                    return BadRequest(new { message = policyError });
                }

                var existing = await _context.SansthaDetails.FindAsync(id);
                if (existing == null)
                {
                    existing = await _context.SansthaDetails.FirstOrDefaultAsync();
                    if (existing == null)
                    {
                        sansthaDetail.AutoPostVouchers = false;
                        sansthaDetail.AutoPostVoucherLimit = 0m;
                        sansthaDetail.FdRenewalReceiptPolicy = normalizedPolicy;
                        sansthaDetail.AllowManualReceiptNoOnRenewal = normalizedPolicy == Helpers.FdRenewalPolicyHelper.PolicyRetainOriginal
                            ? false
                            : sansthaDetail.AllowManualReceiptNoOnRenewal;
                        _context.SansthaDetails.Add(sansthaDetail);
                        await _context.SaveChangesAsync();
                        return Ok(sansthaDetail);
                    }
                }

                ApplySansthaEditableFields(existing, sansthaDetail, normalizedPolicy);

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
                if (!TryValidateFdRenewalReceiptPolicy(sansthaDetail.FdRenewalReceiptPolicy, out string normalizedPolicy, out string? policyError))
                {
                    return BadRequest(new { message = policyError });
                }

                var existing = await _context.SansthaDetails.FirstOrDefaultAsync();
                if (existing != null)
                {
                    ApplySansthaEditableFields(existing, sansthaDetail, normalizedPolicy);

                    await _context.SaveChangesAsync();
                    return Ok(existing);
                }

                sansthaDetail.AutoPostVouchers = false;
                sansthaDetail.AutoPostVoucherLimit = 0m;
                sansthaDetail.FdRenewalReceiptPolicy = normalizedPolicy;
                sansthaDetail.AllowManualReceiptNoOnRenewal = normalizedPolicy == Helpers.FdRenewalPolicyHelper.PolicyRetainOriginal
                    ? false
                    : sansthaDetail.AllowManualReceiptNoOnRenewal;
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
