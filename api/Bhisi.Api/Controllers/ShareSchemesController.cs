using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ShareSchemesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ShareSchemesController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/ShareSchemes
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ShareScheme>>> GetShareSchemes([FromQuery] int? branchId)
        {
            // In Core Banking, Share Capital and Membership Schemes are Sanstha-Wide policies applicable to all branches
            return await _context.ShareSchemes
                .Include(s => s.ShareCapitalLedger)
                .Include(s => s.EntranceFeeLedger)
                .Include(s => s.ShareTransferFeeLedger)
                .Include(s => s.BuildingFundLedger)
                .Include(s => s.DividendPayableLedger)
                .OrderByDescending(s => s.EffectiveDate)
                .ThenBy(s => s.ShareSchemeId)
                .ToListAsync();
        }

        // GET: api/ShareSchemes/5
        [HttpGet("{id}")]
        public async Task<ActionResult<ShareScheme>> GetShareScheme(int id)
        {
            var scheme = await _context.ShareSchemes
                .Include(s => s.ShareCapitalLedger)
                .Include(s => s.EntranceFeeLedger)
                .Include(s => s.ShareTransferFeeLedger)
                .Include(s => s.BuildingFundLedger)
                .Include(s => s.DividendPayableLedger)
                .FirstOrDefaultAsync(s => s.ShareSchemeId == id);

            if (scheme == null)
            {
                return NotFound();
            }

            return scheme;
        }

        // GET: api/ShareSchemes/NextCode or NextSchemeCode
        [AllowAnonymous]
        [HttpGet("NextCode")]
        [HttpGet("NextSchemeCode")]
        public async Task<ActionResult<object>> GetNextSchemeCode([FromQuery] string? memberType)
        {
            var schemes = await _context.ShareSchemes.AsNoTracking().ToListAsync();
            string prefix = "SHR";
            if (!string.IsNullOrWhiteSpace(memberType))
            {
                if (memberType.Equals("Nominal", StringComparison.OrdinalIgnoreCase)) prefix = "SHR-NOM";
                else if (memberType.Equals("Associate", StringComparison.OrdinalIgnoreCase)) prefix = "SHR-ASC";
                else if (memberType.Equals("Institutional", StringComparison.OrdinalIgnoreCase)) prefix = "SHR-INS";
                else prefix = "SHR-REG";
            }

            var existingNumbers = new HashSet<int>();
            foreach (var s in schemes)
            {
                if (!string.IsNullOrWhiteSpace(s.SchemeCode) && s.SchemeCode.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                {
                    var suffix = s.SchemeCode.Substring(prefix.Length).TrimStart('-', '_');
                    if (int.TryParse(suffix, out int parsedNum))
                    {
                        existingNumbers.Add(parsedNum);
                    }
                }
            }

            int nextNum = 1;
            while (existingNumbers.Contains(nextNum))
            {
                nextNum++;
            }

            string nextCode = $"{prefix}-{nextNum:D2}";
            return Ok(new { nextCode, schemeCode = nextCode });
        }

        // POST: api/ShareSchemes
        [HttpPost]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<ActionResult<ShareScheme>> PostShareScheme(ShareScheme scheme)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(scheme.SchemeCode))
                {
                    string prefix = "SHR";
                    if (!string.IsNullOrWhiteSpace(scheme.MemberType))
                    {
                        if (scheme.MemberType.Equals("Nominal", StringComparison.OrdinalIgnoreCase)) prefix = "SHR-NOM";
                        else if (scheme.MemberType.Equals("Associate", StringComparison.OrdinalIgnoreCase)) prefix = "SHR-ASC";
                        else if (scheme.MemberType.Equals("Institutional", StringComparison.OrdinalIgnoreCase)) prefix = "SHR-INS";
                        else prefix = "SHR-REG";
                    }

                    var schemes = await _context.ShareSchemes.AsNoTracking().ToListAsync();
                    var existingNumbers = new HashSet<int>();
                    foreach (var s in schemes)
                    {
                        if (!string.IsNullOrWhiteSpace(s.SchemeCode) && s.SchemeCode.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                        {
                            var suffix = s.SchemeCode.Substring(prefix.Length).TrimStart('-', '_');
                            if (int.TryParse(suffix, out int parsedNum))
                            {
                                existingNumbers.Add(parsedNum);
                            }
                        }
                    }

                    int nextNum = 1;
                    while (existingNumbers.Contains(nextNum))
                    {
                        nextNum++;
                    }

                    scheme.SchemeCode = $"{prefix}-{nextNum:D2}";
                }

                _context.ShareSchemes.Add(scheme);
                await _context.SaveChangesAsync();

                // Core Banking Real-time Sync: Sync selected scheme ledgers to Voucher Mappings table
                await Helpers.ShareLedgerHelper.SyncSchemeToVoucherMappingsAsync(_context, scheme);

                return CreatedAtAction(nameof(GetShareScheme), new { id = scheme.ShareSchemeId }, scheme);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"भागभांडवल योजना सेव्ह करताना त्रुटी: {ex.Message} {(ex.InnerException != null ? ex.InnerException.Message : "")}" });
            }
        }

        // PUT: api/ShareSchemes/5
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<IActionResult> PutShareScheme(int id, ShareScheme scheme)
        {
            if (id != scheme.ShareSchemeId)
            {
                return BadRequest(new { message = "योजना आयडी जुळत नाही (Scheme ID mismatch)." });
            }

            var existing = await _context.ShareSchemes.FindAsync(id);
            if (existing == null)
            {
                return NotFound(new { message = "दिलेली भागभांडवल योजना सापडली नाही (Scheme not found)." });
            }

            existing.BranchID = scheme.BranchID;
            existing.SchemeCode = scheme.SchemeCode?.Trim() ?? existing.SchemeCode;
            existing.SchemeName = scheme.SchemeName?.Trim() ?? existing.SchemeName;
            existing.MemberType = scheme.MemberType ?? existing.MemberType;
            existing.ShareFaceValue = scheme.ShareFaceValue;
            existing.MinSharesCount = scheme.MinSharesCount;
            existing.MaxSharesCount = scheme.MaxSharesCount;
            existing.EntranceFee = scheme.EntranceFee;
            existing.BuildingFund = scheme.BuildingFund;
            existing.ShareTransferFee = scheme.ShareTransferFee;
            existing.DividendRate = scheme.DividendRate;
            existing.HasVotingRights = scheme.HasVotingRights;
            existing.IsMobileCompulsory = scheme.IsMobileCompulsory;
            existing.IsAadhaarCompulsory = scheme.IsAadhaarCompulsory;
            existing.IsPanCompulsory = scheme.IsPanCompulsory;
            existing.LoanEligibilityMultiplier = scheme.LoanEligibilityMultiplier;
            existing.EffectiveDate = scheme.EffectiveDate;
            existing.IsActive = scheme.IsActive;
            existing.ShareCapitalLedgerID = scheme.ShareCapitalLedgerID;
            existing.EntranceFeeLedgerID = scheme.EntranceFeeLedgerID;
            existing.ShareTransferFeeLedgerID = scheme.ShareTransferFeeLedgerID;
            existing.BuildingFundLedgerID = scheme.BuildingFundLedgerID;
            existing.DividendPayableLedgerID = scheme.DividendPayableLedgerID;

            try
            {
                await _context.SaveChangesAsync();

                // Core Banking Real-time Sync: Sync selected scheme ledgers to Voucher Mappings table
                await Helpers.ShareLedgerHelper.SyncSchemeToVoucherMappingsAsync(_context, existing);

                return Ok(existing);
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!ShareSchemeExists(id))
                {
                    return NotFound(new { message = "दिलेली योजना अस्तित्वात नाही." });
                }
                else
                {
                    throw;
                }
            }
            catch (Exception ex)
            {
                string errorMsg = ex.InnerException?.Message ?? ex.Message;
                return StatusCode(500, new { message = $"भागभांडवल योजना अपडेट करताना त्रुटी: {errorMsg}" });
            }
        }

        // DELETE: api/ShareSchemes/5
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<IActionResult> DeleteShareScheme(int id)
        {
            try
            {
                var scheme = await _context.ShareSchemes.FindAsync(id);
                if (scheme == null)
                {
                    return NotFound();
                }

                _context.ShareSchemes.Remove(scheme);
                await _context.SaveChangesAsync();

                return Ok(new { message = "भागभांडवल योजना यशस्वीरित्या डिलीट केली." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"भागभांडवल योजना डिलीट करताना त्रुटी: {ex.Message}" });
            }
        }

        // POST: api/ShareSchemes/SyncVoucherMappings
        [HttpPost("SyncVoucherMappings")]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<IActionResult> SyncAllSchemeMappings()
        {
            try
            {
                var activeScheme = await _context.ShareSchemes
                    .OrderByDescending(s => s.IsActive)
                    .ThenByDescending(s => s.EffectiveDate)
                    .FirstOrDefaultAsync();

                if (activeScheme != null)
                {
                    await Helpers.ShareLedgerHelper.SyncSchemeToVoucherMappingsAsync(_context, activeScheme);
                    return Ok(new { message = $"सक्रिय योजना '{activeScheme.SchemeName}' मधील लेजर्स व्हाउचर मॅपिंगशी यशस्वीरित्या सिंक करण्यात आले." });
                }
                else
                {
                    // Fallback to resolve/heal
                    var shareLedger = await Helpers.ShareLedgerHelper.GetShareCapitalLedgerAsync(_context);
                    return Ok(new { message = $"डिफॉल्ट शेअर भांडवल लेजर '{shareLedger.LedgerName}' मॅप करण्यात आले." });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"मॅपिंग सिंक करताना त्रुटी: {ex.Message}" });
            }
        }

        private bool ShareSchemeExists(int id)
        {
            return _context.ShareSchemes.Any(e => e.ShareSchemeId == id);
        }
    }
}
