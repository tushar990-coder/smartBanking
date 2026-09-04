using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SavingSettingsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SavingSettingsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("Interest")]
        public async Task<IActionResult> GetInterestSettings()
        {
            try
            {
                var settings = await _context.SavingInterestSettings
                    .Include(s => s.Ledger)
                    .Include(s => s.SavingLiabilityLedger)
                    .Include(s => s.InterestExpenseLedger)
                    .Include(s => s.InterestPayableLedger)
                    .OrderByDescending(s => s.EffectiveDate)
                    .Select(s => new {
                        s.SettingID,
                        s.SchemeCode,
                        s.SchemeName,
                        s.InterestRate,
                        s.CalculationMethod,
                        s.PostingFrequency,
                        s.EffectiveDate,
                        s.LedgerID,
                        s.SavingLiabilityLedgerID,
                        s.InterestExpenseLedgerID,
                        s.InterestPayableLedgerID,
                        s.CreatedBy,
                        s.CreatedOn,
                        Ledger = s.Ledger != null ? new { s.Ledger.LedgerID, s.Ledger.LedgerName } : null,
                        SavingLiabilityLedger = s.SavingLiabilityLedger != null ? new { s.SavingLiabilityLedger.LedgerID, s.SavingLiabilityLedger.LedgerName } : null,
                        InterestExpenseLedger = s.InterestExpenseLedger != null ? new { s.InterestExpenseLedger.LedgerID, s.InterestExpenseLedger.LedgerName } : null,
                        InterestPayableLedger = s.InterestPayableLedger != null ? new { s.InterestPayableLedger.LedgerID, s.InterestPayableLedger.LedgerName } : null
                    })
                    .ToListAsync();
                return Ok(settings);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"व्याज दर सेटिंग लोड करताना त्रुटी आली: {ex.Message}", details = ex.InnerException?.Message });
            }
        }
        
        [HttpGet("Interest/Current")]
        public async Task<IActionResult> GetCurrentInterestSetting()
        {
            try
            {
                var setting = await _context.SavingInterestSettings
                    .Include(s => s.Ledger)
                    .Include(s => s.SavingLiabilityLedger)
                    .Include(s => s.InterestExpenseLedger)
                    .Include(s => s.InterestPayableLedger)
                    .Where(s => s.EffectiveDate <= DateTime.Today)
                    .OrderByDescending(s => s.EffectiveDate)
                    .Select(s => new {
                        s.SettingID,
                        s.SchemeCode,
                        s.SchemeName,
                        s.InterestRate,
                        s.CalculationMethod,
                        s.PostingFrequency,
                        s.EffectiveDate,
                        s.LedgerID,
                        s.SavingLiabilityLedgerID,
                        s.InterestExpenseLedgerID,
                        s.InterestPayableLedgerID,
                        s.CreatedBy,
                        s.CreatedOn,
                        Ledger = s.Ledger != null ? new { s.Ledger.LedgerID, s.Ledger.LedgerName } : null,
                        SavingLiabilityLedger = s.SavingLiabilityLedger != null ? new { s.SavingLiabilityLedger.LedgerID, s.SavingLiabilityLedger.LedgerName } : null,
                        InterestExpenseLedger = s.InterestExpenseLedger != null ? new { s.InterestExpenseLedger.LedgerID, s.InterestExpenseLedger.LedgerName } : null,
                        InterestPayableLedger = s.InterestPayableLedger != null ? new { s.InterestPayableLedger.LedgerID, s.InterestPayableLedger.LedgerName } : null
                    })
                    .FirstOrDefaultAsync();

                if (setting == null)
                {
                    return NotFound(new { message = "सध्याचे सक्रिय व्याज दर सेटिंग सापडले नाही." });
                }

                return Ok(setting);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"सध्याचे व्याज दर सेटिंग मिळवताना त्रुटी आली: {ex.Message}" });
            }
        }

        [HttpGet("Interest/NextCode")]
        public async Task<ActionResult<object>> GetNextSchemeCode()
        {
            var codes = await _context.SavingInterestSettings.Select(s => s.SchemeCode).ToListAsync();
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
            return Ok(new { nextCode = $"SAV{nextNum:D3}" });
        }

        [HttpPost("Interest")]
        public async Task<ActionResult<SavingInterestSetting>> PostInterestSetting(SavingInterestSetting setting)
        {
            int liabId = setting.SavingLiabilityLedgerID ?? setting.LedgerID ?? 0;
            int expId = setting.InterestExpenseLedgerID ?? 0;

            if (liabId <= 0)
            {
                return BadRequest("बचत ठेव देयता लेजर (Saving Liability Ledger) निवडणे सक्तीचे आहे.");
            }

            var liabExists = await _context.Ledgers.AnyAsync(l => l.LedgerID == liabId);
            if (!liabExists)
            {
                return BadRequest("निवडलेले बचत ठेव देयता लेजर (Saving Liability Ledger) अस्तित्वात नाही.");
            }

            if (expId > 0)
            {
                var expExists = await _context.Ledgers.AnyAsync(l => l.LedgerID == expId);
                if (!expExists)
                {
                    return BadRequest("निवडलेले बचत व्याज खर्च लेजर (Interest Expense Ledger) अस्तित्वात नाही.");
                }
            }

            setting.SavingLiabilityLedgerID = liabId;
            setting.LedgerID = liabId;
            setting.InterestExpenseLedgerID = expId > 0 ? expId : null;
            if (setting.InterestPayableLedgerID.HasValue && setting.InterestPayableLedgerID.Value <= 0) setting.InterestPayableLedgerID = null;

            setting.Ledger = null;
            setting.SavingLiabilityLedger = null;
            setting.InterestExpenseLedger = null;
            setting.InterestPayableLedger = null;

            if (string.IsNullOrWhiteSpace(setting.SchemeCode))
            {
                var codes = await _context.SavingInterestSettings.Select(s => s.SchemeCode).ToListAsync();
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
                setting.SchemeCode = $"SAV{(maxNum + 1):D3}";
            }
            else
            {
                setting.SchemeCode = setting.SchemeCode.Trim();
                var codeExists = await _context.SavingInterestSettings.AnyAsync(s => s.SchemeCode != null && s.SchemeCode.ToLower() == setting.SchemeCode.ToLower());
                if (codeExists)
                {
                    return BadRequest($"या योजना कोडची (Scheme Code: '{setting.SchemeCode}') बचत ठेव योजना आधीच अस्तित्वात आहे.");
                }
            }

            if (!string.IsNullOrWhiteSpace(setting.SchemeName))
            {
                setting.SchemeName = setting.SchemeName.Trim();
                var nameExists = await _context.SavingInterestSettings.AnyAsync(s => s.SchemeName != null && s.SchemeName.ToLower() == setting.SchemeName.ToLower());
                if (nameExists)
                {
                    return BadRequest($"या नावाची ('{setting.SchemeName}') बचत ठेव योजना आधीच अस्तित्वात आहे.");
                }
            }

            setting.CreatedOn = DateTime.Now;
            _context.SavingInterestSettings.Add(setting);
            await _context.SaveChangesAsync();

            return Ok(setting);
        }

        [HttpPut("Interest/{id}")]
        public async Task<IActionResult> PutInterestSetting(int id, SavingInterestSetting setting)
        {
            if (id != setting.SettingID)
            {
                return BadRequest("ID mismatch");
            }

            var existing = await _context.SavingInterestSettings.FindAsync(id);
            if (existing == null)
            {
                return NotFound("Setting not found");
            }

            int liabId = setting.SavingLiabilityLedgerID ?? setting.LedgerID ?? existing.SavingLiabilityLedgerID ?? existing.LedgerID ?? 0;
            int expId = setting.InterestExpenseLedgerID ?? existing.InterestExpenseLedgerID ?? 0;

            if (liabId <= 0)
            {
                return BadRequest("बचत ठेव देयता लेजर (Saving Liability Ledger) निवडणे सक्तीचे आहे.");
            }

            var liabExists = await _context.Ledgers.AnyAsync(l => l.LedgerID == liabId);
            if (!liabExists)
            {
                return BadRequest("निवडलेले बचत ठेव देयता लेजर (Saving Liability Ledger) अस्तित्वात नाही.");
            }

            if (expId > 0)
            {
                var expExists = await _context.Ledgers.AnyAsync(l => l.LedgerID == expId);
                if (!expExists)
                {
                    return BadRequest("निवडलेले बचत व्याज खर्च लेजर (Interest Expense Ledger) अस्तित्वात नाही.");
                }
            }

            if (!string.IsNullOrWhiteSpace(setting.SchemeCode))
            {
                var trimmedCode = setting.SchemeCode.Trim();
                var codeExists = await _context.SavingInterestSettings.AnyAsync(s => s.SettingID != id && s.SchemeCode != null && s.SchemeCode.ToLower() == trimmedCode.ToLower());
                if (codeExists)
                {
                    return BadRequest($"या योजना कोडची (Scheme Code: '{trimmedCode}') बचत ठेव योजना आधीच अस्तित्वात आहे.");
                }
                existing.SchemeCode = trimmedCode;
            }

            if (!string.IsNullOrWhiteSpace(setting.SchemeName))
            {
                var trimmedName = setting.SchemeName.Trim();
                var nameExists = await _context.SavingInterestSettings.AnyAsync(s => s.SettingID != id && s.SchemeName != null && s.SchemeName.ToLower() == trimmedName.ToLower());
                if (nameExists)
                {
                    return BadRequest($"या नावाची ('{trimmedName}') बचत ठेव योजना आधीच अस्तित्वात आहे.");
                }
                existing.SchemeName = trimmedName;
            }

            existing.InterestRate = setting.InterestRate;
            existing.CalculationMethod = setting.CalculationMethod;
            existing.PostingFrequency = setting.PostingFrequency;
            existing.EffectiveDate = setting.EffectiveDate;
            existing.SavingLiabilityLedgerID = liabId;
            existing.LedgerID = liabId;
            existing.InterestExpenseLedgerID = expId > 0 ? expId : null;
            existing.InterestPayableLedgerID = (setting.InterestPayableLedgerID.HasValue && setting.InterestPayableLedgerID.Value > 0) ? setting.InterestPayableLedgerID : null;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("Interest/{id}")]
        public async Task<IActionResult> DeleteInterestSetting(int id)
        {
            var setting = await _context.SavingInterestSettings.FindAsync(id);
            if (setting == null)
            {
                return NotFound();
            }

            _context.SavingInterestSettings.Remove(setting);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool SavingInterestSettingExists(int id)
        {
            return _context.SavingInterestSettings.Any(e => e.SettingID == id);
        }
    }
}
