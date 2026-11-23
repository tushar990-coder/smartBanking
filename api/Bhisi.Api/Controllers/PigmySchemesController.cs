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
    public class PigmySchemesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PigmySchemesController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/PigmySchemes
        [HttpGet]
        public async Task<ActionResult<IEnumerable<PigmyScheme>>> GetPigmySchemes()
        {
            return await _context.PigmySchemes
                .Include(s => s.PigmyLiabilityLedger)
                .Include(s => s.InterestExpenseLedger)
                .Include(s => s.InterestPayableLedger)
                .Include(s => s.CommissionExpenseLedger)
                .Include(s => s.PrematureDeductionLedger)
                .Include(s => s.Slabs.OrderBy(sl => sl.FromDays))
                .ToListAsync();
        }

        // GET: api/PigmySchemes/5
        [HttpGet("{id}")]
        public async Task<ActionResult<PigmyScheme>> GetPigmyScheme(int id)
        {
            var pigmyScheme = await _context.PigmySchemes
                .Include(s => s.PigmyLiabilityLedger)
                .Include(s => s.InterestExpenseLedger)
                .Include(s => s.InterestPayableLedger)
                .Include(s => s.CommissionExpenseLedger)
                .Include(s => s.PrematureDeductionLedger)
                .Include(s => s.Slabs.OrderBy(sl => sl.FromDays))
                .FirstOrDefaultAsync(s => s.PigmySchemeID == id);

            if (pigmyScheme == null)
            {
                return NotFound();
            }

            return pigmyScheme;
        }

        // PUT: api/PigmySchemes/5
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<IActionResult> PutPigmyScheme(int id, PigmyScheme pigmyScheme)
        {
            if (pigmyScheme.PigmySchemeID != 0 && id != pigmyScheme.PigmySchemeID)
            {
                return BadRequest(new { message = "अवैध योजना आयडी (Invalid Scheme ID)." });
            }

            var existing = await _context.PigmySchemes.FindAsync(id);
            if (existing == null)
            {
                return NotFound(new { message = "पिग्मी योजना सापडली नाही." });
            }

            var ledgerCheck = await Helpers.PigmySettlementHelper.ValidatePigmySchemeMappingsAsync(_context, pigmyScheme);
            if (!ledgerCheck.IsValid)
            {
                return BadRequest(new { message = ledgerCheck.ErrorMessage });
            }

            int resolvedTenureDays = pigmyScheme.Slabs != null && pigmyScheme.Slabs.Any(s => s.IsActive)
                ? pigmyScheme.Slabs.Where(s => s.IsActive).Max(s => s.ToDays)
                : (pigmyScheme.TenureDays > 0 ? pigmyScheme.TenureDays : (pigmyScheme.DurationMonths > 60 ? pigmyScheme.DurationMonths : Math.Max(1, pigmyScheme.DurationMonths) * 30));

            int resolvedDurationMonths = pigmyScheme.DurationMonths > 0 && pigmyScheme.DurationMonths <= 60
                ? pigmyScheme.DurationMonths
                : Math.Max(1, (int)Math.Round(resolvedTenureDays / 30.0, MidpointRounding.AwayFromZero));

            existing.SchemeCode = !string.IsNullOrWhiteSpace(pigmyScheme.SchemeCode) ? pigmyScheme.SchemeCode.Trim() : existing.SchemeCode;
            existing.SchemeName = pigmyScheme.SchemeName;
            existing.InterestRate = pigmyScheme.InterestRate;
            existing.DurationMonths = resolvedDurationMonths;
            existing.TenureDays = resolvedTenureDays;
            existing.InterestDaysInYear = pigmyScheme.InterestDaysInYear >= 360 && pigmyScheme.InterestDaysInYear <= 366 ? pigmyScheme.InterestDaysInYear : 365;
            existing.Status = pigmyScheme.Status;
            existing.PigmyLiabilityLedgerID = pigmyScheme.PigmyLiabilityLedgerID;
            existing.InterestExpenseLedgerID = pigmyScheme.InterestExpenseLedgerID;
            existing.InterestPayableLedgerID = pigmyScheme.InterestPayableLedgerID;
            existing.CommissionExpenseLedgerID = pigmyScheme.CommissionExpenseLedgerID;
            existing.PrematureDeductionLedgerID = pigmyScheme.PrematureDeductionLedgerID;
            existing.PrematureInterestRate = pigmyScheme.PrematureInterestRate;
            existing.MinDurationMonths = pigmyScheme.MinDurationMonths;
            existing.PenaltyInterestRate = pigmyScheme.PenaltyInterestRate;
            existing.InterestCalculationMethod = pigmyScheme.InterestCalculationMethod;
            existing.InterestPostingFrequency = pigmyScheme.InterestPostingFrequency;

            // Synchronize Slabs
            if (pigmyScheme.Slabs != null)
            {
                var currentSlabs = await _context.PigmySchemeInterestSlabs
                    .Where(sl => sl.PigmySchemeID == id)
                    .ToListAsync();

                _context.PigmySchemeInterestSlabs.RemoveRange(currentSlabs);

                foreach (var slab in pigmyScheme.Slabs)
                {
                    _context.PigmySchemeInterestSlabs.Add(new PigmySchemeInterestSlab
                    {
                        PigmySchemeID = id,
                        FromDays = slab.FromDays,
                        ToDays = slab.ToDays,
                        InterestRate = slab.InterestRate,
                        PenaltyRate = slab.PenaltyRate,
                        SlabDescription = slab.SlabDescription,
                        IsActive = slab.IsActive,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            try
            {
                await _context.SaveChangesAsync();
                return Ok(new { message = "पिग्मी योजना व स्लॅब यशस्वीरीत्या अद्ययावत झाली!" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "योजना अद्ययावत करताना त्रुटी आली: " + ex.Message });
            }
        }

        // GET: api/PigmySchemes/NextCode
        [HttpGet("NextCode")]
        public async Task<ActionResult<object>> GetNextSchemeCode()
        {
            var codes = await _context.PigmySchemes.Select(s => s.SchemeCode).ToListAsync();
            int maxNum = 0;
            foreach (var code in codes)
            {
                if (!string.IsNullOrWhiteSpace(code))
                {
                    var digits = new string(code.Where(char.IsDigit).ToArray());
                    if (int.TryParse(digits, out int num))
                    {
                        if (num > maxNum) maxNum = num;
                    }
                }
            }
            int nextNum = maxNum + 1;
            return Ok(new { nextCode = nextNum.ToString() });
        }

        // POST: api/PigmySchemes
        [HttpPost]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<ActionResult<PigmyScheme>> PostPigmyScheme(PigmyScheme pigmyScheme)
        {
            var ledgerCheck = await Helpers.PigmySettlementHelper.ValidatePigmySchemeMappingsAsync(_context, pigmyScheme);
            if (!ledgerCheck.IsValid)
            {
                return BadRequest(new { message = ledgerCheck.ErrorMessage });
            }

            pigmyScheme.CreatedDate = DateTime.Now;
            if (string.IsNullOrWhiteSpace(pigmyScheme.SchemeCode))
            {
                var codes = await _context.PigmySchemes.Select(s => s.SchemeCode).ToListAsync();
                int maxNum = 0;
                foreach (var code in codes)
                {
                    if (!string.IsNullOrWhiteSpace(code))
                    {
                        var digits = new string(code.Where(char.IsDigit).ToArray());
                        if (int.TryParse(digits, out int num))
                        {
                            if (num > maxNum) maxNum = num;
                        }
                    }
                }
                pigmyScheme.SchemeCode = (maxNum + 1).ToString();
            }
            else
            {
                pigmyScheme.SchemeCode = pigmyScheme.SchemeCode.Trim();
            }

            // Auto-populate 4 standard default slabs if none provided
            if (pigmyScheme.Slabs == null || !pigmyScheme.Slabs.Any())
            {
                int duration = pigmyScheme.DurationMonths > 0 && pigmyScheme.DurationMonths <= 60 ? pigmyScheme.DurationMonths : 12;
                int maxDays = pigmyScheme.TenureDays > 0 ? pigmyScheme.TenureDays : (duration == 12 ? 365 : duration * 30);
                decimal pRate = pigmyScheme.PenaltyInterestRate ?? 0.00m;
                decimal premRate = pigmyScheme.PrematureInterestRate ?? 5.50m;
                decimal regRate = pigmyScheme.InterestRate;

                pigmyScheme.Slabs = new List<PigmySchemeInterestSlab>
                {
                    new PigmySchemeInterestSlab { FromDays = 0, ToDays = 90, InterestRate = 0.00m, PenaltyRate = pRate, SlabDescription = pRate > 0 ? $"० ते ९० दिवस ({pRate}% कमिशन/दंड कपात)" : "० ते ९० दिवस (०% व्याज)", IsActive = true },
                    new PigmySchemeInterestSlab { FromDays = 91, ToDays = 180, InterestRate = 0.00m, PenaltyRate = 0.00m, SlabDescription = "९१ ते १८० दिवस (मुद्दल परत, ०% व्याज)", IsActive = true },
                    new PigmySchemeInterestSlab { FromDays = 181, ToDays = Math.Max(182, maxDays - 30), InterestRate = premRate, PenaltyRate = 0.00m, SlabDescription = $"१८१ ते {Math.Max(182, maxDays - 30)} दिवस ({premRate}% मुदतपूर्व व्याज)", IsActive = true },
                    new PigmySchemeInterestSlab { FromDays = Math.Max(183, maxDays - 29), ToDays = maxDays, InterestRate = regRate, PenaltyRate = 0.00m, SlabDescription = $"{Math.Max(183, maxDays - 29)} ते {maxDays} दिवस ({regRate}% पूर्ण नियमित व्याज)", IsActive = true }
                };
            }

            int postTenureDays = pigmyScheme.Slabs.Where(s => s.IsActive).Select(s => s.ToDays).DefaultIfEmpty(365).Max();
            pigmyScheme.TenureDays = postTenureDays > 0 ? postTenureDays : 365;
            if (pigmyScheme.DurationMonths <= 0 || pigmyScheme.DurationMonths > 60)
            {
                pigmyScheme.DurationMonths = Math.Max(1, (int)Math.Round(pigmyScheme.TenureDays / 30.0, MidpointRounding.AwayFromZero));
            }
            if (pigmyScheme.InterestDaysInYear < 360 || pigmyScheme.InterestDaysInYear > 366)
            {
                pigmyScheme.InterestDaysInYear = 365;
            }

            _context.PigmySchemes.Add(pigmyScheme);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetPigmyScheme", new { id = pigmyScheme.PigmySchemeID }, pigmyScheme);
        }


        // DELETE: api/PigmySchemes/5?force=false
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<IActionResult> DeletePigmyScheme(int id, [FromQuery] bool force = false)
        {
            var pigmyScheme = await _context.PigmySchemes.FindAsync(id);
            if (pigmyScheme == null)
            {
                return NotFound(new { message = "पिग्मी योजना सापडली नाही." });
            }

            var accountsCount = await _context.PigmyAccounts.CountAsync(a => a.PigmySchemeID == id);

            if (accountsCount > 0 && !force)
            {
                return BadRequest(new
                {
                    hasDependencies = true,
                    accountsCount,
                    message = $"या योजनेशी {accountsCount} पिग्मी खाती जोडलेली आहेत. थेट डिलीट केल्यास संदर्भ (Constraint) खराब होऊ शकतो."
                });
            }

            try
            {
                if (accountsCount > 0 && force)
                {
                    var otherScheme = await _context.PigmySchemes
                        .Where(s => s.PigmySchemeID != id)
                        .OrderBy(s => s.PigmySchemeID)
                        .FirstOrDefaultAsync();

                    if (otherScheme != null)
                    {
                        var accountsToUpdate = await _context.PigmyAccounts.Where(a => a.PigmySchemeID == id).ToListAsync();
                        foreach (var acc in accountsToUpdate)
                        {
                            acc.PigmySchemeID = otherScheme.PigmySchemeID;
                        }
                        await _context.SaveChangesAsync();
                    }
                }

                _context.PigmySchemes.Remove(pigmyScheme);
                await _context.SaveChangesAsync();
                return Ok(new { message = "पिग्मी योजना यशस्वीरीत्या हटवली (Deleted) गेली." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "योजना हटवताना त्रुटी आली: " + ex.Message });
            }
        }

        private bool PigmySchemeExists(int id)
        {
            return _context.PigmySchemes.Any(e => e.PigmySchemeID == id);
        }
    }
}
