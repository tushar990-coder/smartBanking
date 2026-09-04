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
    [AllowAnonymous]
    public class VoucherMappingsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public VoucherMappingsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/VoucherMappings
        [HttpGet]
        public async Task<ActionResult<IEnumerable<VoucherMapping>>> GetVoucherMappings()
        {
            return await _context.VoucherMappings
                                 .Include(v => v.DebitLedger)
                                 .Include(v => v.CreditLedger)
                                 .ToListAsync();
        }

        // GET: api/VoucherMappings/5
        [HttpGet("{id}")]
        public async Task<ActionResult<VoucherMapping>> GetVoucherMapping(int id)
        {
            var voucherMapping = await _context.VoucherMappings
                                               .Include(v => v.DebitLedger)
                                               .Include(v => v.CreditLedger)
                                               .FirstOrDefaultAsync(v => v.MappingID == id);

            if (voucherMapping == null)
            {
                return NotFound();
            }

            return voucherMapping;
        }

        // PUT: api/VoucherMappings/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutVoucherMapping(int id, VoucherMapping voucherMapping)
        {
            if (id != voucherMapping.MappingID)
            {
                return BadRequest();
            }

            _context.Entry(voucherMapping).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!VoucherMappingExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        // POST: api/VoucherMappings
        [HttpPost]
        public async Task<ActionResult<VoucherMapping>> PostVoucherMapping(VoucherMapping voucherMapping)
        {
            _context.VoucherMappings.Add(voucherMapping);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetVoucherMapping", new { id = voucherMapping.MappingID }, voucherMapping);
        }

        // DELETE: api/VoucherMappings/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteVoucherMapping(int id)
        {
            var voucherMapping = await _context.VoucherMappings.FindAsync(id);
            if (voucherMapping == null)
            {
                return NotFound();
            }

            _context.VoucherMappings.Remove(voucherMapping);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // POST: api/VoucherMappings/AutoConfigure
        [HttpPost("AutoConfigure")]
        public async Task<IActionResult> AutoConfigureMappings()
        {
            try
            {
                int updatedCount = 0;

                // 1. Sync from Share & Customer Scheme Master
                var activeShareScheme = await _context.ShareSchemes
                    .OrderByDescending(s => s.IsActive)
                    .ThenByDescending(s => s.EffectiveDate)
                    .FirstOrDefaultAsync();

                if (activeShareScheme != null)
                {
                    await Helpers.ShareLedgerHelper.SyncSchemeToVoucherMappingsAsync(_context, activeShareScheme);
                    updatedCount++;
                }
                else
                {
                    var shareLedger = await Helpers.ShareLedgerHelper.GetShareCapitalLedgerAsync(_context);
                    await Helpers.ShareLedgerHelper.GetDividendPayableLedgerAsync(_context);
                    updatedCount++;
                }

                // 2. Auto-map other core transaction types from existing ledgers
                var allLedgers = await _context.Ledgers.Include(l => l.AccountGroup).Where(l => l.IsActive).ToListAsync();

                // Loan Recovery - Interest
                var interestIncome = allLedgers.FirstOrDefault(l => 
                    l.LedgerName.Contains("व्याज") && (l.LedgerName.Contains("कर्ज") || l.LedgerName.Contains("मिळालेले") || (l.AccountGroup != null && l.AccountGroup.NatureOfGroup == "Income")));
                if (interestIncome != null)
                {
                    await UpsertMappingAsync("Loan Recovery - Interest", null, interestIncome.LedgerID);
                    updatedCount++;
                }

                // Loan Recovery - Principal / Disbursement
                var loanAsset = allLedgers.FirstOrDefault(l => 
                    l.LedgerName.Contains("मेंबर कर्ज") || l.LedgerName.Contains("कर्ज") || (l.AccountGroup != null && l.AccountGroup.GroupName.Contains("कर्ज")));
                if (loanAsset != null)
                {
                    await UpsertMappingAsync("Loan Disbursement", loanAsset.LedgerID, null);
                    await UpsertMappingAsync("Loan Recovery - Principal", null, loanAsset.LedgerID);
                    updatedCount += 2;
                }

                // Bank Interest Received
                var bankInterest = allLedgers.FirstOrDefault(l => l.LedgerName.Contains("बँक व्याज") || l.LedgerName.Contains("व्याज मिळाले"));
                if (bankInterest != null)
                {
                    await UpsertMappingAsync("Bank Interest Received", null, bankInterest.LedgerID);
                    updatedCount++;
                }

                // Expenses
                var expLedger = allLedgers.FirstOrDefault(l => l.AccountGroup != null && (l.AccountGroup.NatureOfGroup == "Expense" || l.AccountGroup.NatureOfGroup == "Expenses"));
                if (expLedger != null)
                {
                    await UpsertMappingAsync("Expenses", expLedger.LedgerID, null);
                    updatedCount++;
                }

                await _context.SaveChangesAsync();

                var mappings = await _context.VoucherMappings
                    .Include(v => v.DebitLedger)
                    .Include(v => v.CreditLedger)
                    .ToListAsync();

                return Ok(new 
                { 
                    message = "भाग भांडवल योजना व इतर लेजर्सनुसार सर्व व्हाउचर मॅपिंग्ज यशस्वीरित्या अपडेट करण्यात आली.",
                    mappings 
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"ऑटो-कॉन्फिगर करताना त्रुटी आली: {ex.Message}" });
            }
        }

        private async Task UpsertMappingAsync(string transactionType, int? debitLedgerId, int? creditLedgerId)
        {
            var mapping = await _context.VoucherMappings.FirstOrDefaultAsync(m => m.TransactionType == transactionType);
            if (mapping == null)
            {
                _context.VoucherMappings.Add(new VoucherMapping
                {
                    TransactionType = transactionType,
                    DebitLedgerID = debitLedgerId,
                    CreditLedgerID = creditLedgerId
                });
            }
            else
            {
                if (debitLedgerId.HasValue && !mapping.DebitLedgerID.HasValue) mapping.DebitLedgerID = debitLedgerId;
                if (creditLedgerId.HasValue && !mapping.CreditLedgerID.HasValue) mapping.CreditLedgerID = creditLedgerId;
                _context.Entry(mapping).State = EntityState.Modified;
            }
        }

        private bool VoucherMappingExists(int id)
        {
            return _context.VoucherMappings.Any(e => e.MappingID == id);
        }
    }
}
