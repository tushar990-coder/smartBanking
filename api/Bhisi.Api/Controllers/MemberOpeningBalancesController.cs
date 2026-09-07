using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Filters;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MemberOpeningBalancesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public MemberOpeningBalancesController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/MemberOpeningBalances
        [HttpGet]
        public async Task<ActionResult<IEnumerable<MemberOpeningBalance>>> GetMemberOpeningBalances()
        {
            return await _context.MemberOpeningBalances
                                 .Include(m => m.Member)
                                 .Include(m => m.Customer)
                                 .Include(m => m.Ledger)
                                 .ToListAsync();
        }

        // GET: api/MemberOpeningBalances/5
        [HttpGet("{id}")]
        public async Task<ActionResult<MemberOpeningBalance>> GetMemberOpeningBalance(int id)
        {
            var memberOpeningBalance = await _context.MemberOpeningBalances
                                                     .Include(m => m.Member)
                                                     .Include(m => m.Customer)
                                                     .Include(m => m.Ledger)
                                                     .FirstOrDefaultAsync(m => m.MemberOpeningBalanceID == id);

            if (memberOpeningBalance == null)
            {
                return NotFound();
            }

            return memberOpeningBalance;
        }

        // PUT: api/MemberOpeningBalances/5
        [HttpPut("{id}")]
        [MigrationLockFilter]
        public async Task<IActionResult> PutMemberOpeningBalance(int id, MemberOpeningBalance memberOpeningBalance)
        {
            if (id != memberOpeningBalance.MemberOpeningBalanceID)
            {
                return BadRequest();
            }

            var existingRecord = await _context.MemberOpeningBalances.FindAsync(id);
            if (existingRecord == null)
            {
                return NotFound();
            }

            existingRecord.MemberID = memberOpeningBalance.MemberID;
            if (memberOpeningBalance.CustomerID.HasValue && memberOpeningBalance.CustomerID.Value > 0)
            {
                existingRecord.CustomerID = memberOpeningBalance.CustomerID.Value;
            }
            else
            {
                var mem = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == memberOpeningBalance.MemberID);
                if (mem != null && mem.CustomerID.HasValue)
                {
                    existingRecord.CustomerID = mem.CustomerID.Value;
                }
            }
            existingRecord.LedgerID = memberOpeningBalance.LedgerID;
            existingRecord.Amount = memberOpeningBalance.Amount;
            existingRecord.BalanceType = memberOpeningBalance.BalanceType;
            existingRecord.UpdatedBy = memberOpeningBalance.UpdatedBy ?? 1;
            existingRecord.UpdatedOn = DateTime.Now;

            try
            {
                await _context.SaveChangesAsync();
                await UpdateLedgerOpeningBalance(memberOpeningBalance.LedgerID);
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!MemberOpeningBalanceExists(id))
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

        // POST: api/MemberOpeningBalances
        [HttpPost]
        [MigrationLockFilter]
        public async Task<ActionResult<MemberOpeningBalance>> PostMemberOpeningBalance(MemberOpeningBalance memberOpeningBalance)
        {
            if (!memberOpeningBalance.CustomerID.HasValue || memberOpeningBalance.CustomerID.Value <= 0)
            {
                var mem = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == memberOpeningBalance.MemberID);
                if (mem != null && mem.CustomerID.HasValue)
                {
                    memberOpeningBalance.CustomerID = mem.CustomerID.Value;
                }
            }
            memberOpeningBalance.CreatedOn = DateTime.Now;
            _context.MemberOpeningBalances.Add(memberOpeningBalance);
            await _context.SaveChangesAsync();

            await UpdateLedgerOpeningBalance(memberOpeningBalance.LedgerID);

            return CreatedAtAction("GetMemberOpeningBalance", new { id = memberOpeningBalance.MemberOpeningBalanceID }, memberOpeningBalance);
        }

        // DELETE: api/MemberOpeningBalances/5
        [HttpDelete("{id}")]
        [MigrationLockFilter]
        public async Task<IActionResult> DeleteMemberOpeningBalance(int id)
        {
            var memberOpeningBalance = await _context.MemberOpeningBalances.FindAsync(id);
            if (memberOpeningBalance == null)
            {
                return NotFound();
            }

            int ledgerId = memberOpeningBalance.LedgerID;
            _context.MemberOpeningBalances.Remove(memberOpeningBalance);
            await _context.SaveChangesAsync();

            await UpdateLedgerOpeningBalance(ledgerId);

            return NoContent();
        }

        private bool MemberOpeningBalanceExists(int id)
        {
            return _context.MemberOpeningBalances.Any(e => e.MemberOpeningBalanceID == id);
        }

        private async Task UpdateLedgerOpeningBalance(int ledgerId)
        {
            var ledger = await _context.Ledgers.FindAsync(ledgerId);
            if (ledger != null)
            {
                var totalDr = await _context.MemberOpeningBalances
                    .Where(m => m.LedgerID == ledgerId && m.BalanceType == "Dr")
                    .SumAsync(m => m.Amount);

                var totalCr = await _context.MemberOpeningBalances
                    .Where(m => m.LedgerID == ledgerId && m.BalanceType == "Cr")
                    .SumAsync(m => m.Amount);

                if (totalDr >= totalCr)
                {
                    ledger.OpeningBalance = totalDr - totalCr;
                    ledger.OpeningBalanceType = "Dr";
                }
                else
                {
                    ledger.OpeningBalance = totalCr - totalDr;
                    ledger.OpeningBalanceType = "Cr";
                }
                
                await _context.SaveChangesAsync();
            }
        }

        [HttpGet("SyncAllLedgers")]
        public async Task<IActionResult> SyncAllLedgers()
        {
            var ledgers = await _context.Ledgers.ToListAsync();
            foreach (var ledger in ledgers)
            {
                var totalDr = await _context.MemberOpeningBalances
                    .Where(m => m.LedgerID == ledger.LedgerID && m.BalanceType == "Dr")
                    .SumAsync(m => m.Amount);

                var totalCr = await _context.MemberOpeningBalances
                    .Where(m => m.LedgerID == ledger.LedgerID && m.BalanceType == "Cr")
                    .SumAsync(m => m.Amount);

                if (totalDr == 0 && totalCr == 0) continue; // Skip if no member balances

                if (totalDr >= totalCr)
                {
                    ledger.OpeningBalance = totalDr - totalCr;
                    ledger.OpeningBalanceType = "Dr";
                }
                else
                {
                    ledger.OpeningBalance = totalCr - totalDr;
                    ledger.OpeningBalanceType = "Cr";
                }
            }
            await _context.SaveChangesAsync();
            return Ok(new { message = "All ledger opening balances synced with member opening balances." });
        }
    }
}
