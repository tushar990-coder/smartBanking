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

            Member? mem = null;
            if (memberOpeningBalance.CustomerID.HasValue && memberOpeningBalance.CustomerID.Value > 0)
            {
                existingRecord.CustomerID = memberOpeningBalance.CustomerID.Value;
                mem = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == memberOpeningBalance.CustomerID.Value);
            }
            
            if (mem == null && memberOpeningBalance.MemberID > 0)
            {
                mem = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == memberOpeningBalance.MemberID);
                if (mem != null && mem.CustomerID.HasValue)
                {
                    existingRecord.CustomerID = mem.CustomerID.Value;
                }
                else
                {
                    // Check if MemberID was passed as CustomerID
                    var cust = await _context.Customers.FindAsync(memberOpeningBalance.MemberID);
                    if (cust != null)
                    {
                        existingRecord.CustomerID = cust.CustomerID;
                        mem = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == cust.CustomerID);
                    }
                }
            }
            if (mem != null) existingRecord.MemberID = mem.MemberID;

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
            Member? mem = null;
            if (memberOpeningBalance.CustomerID.HasValue && memberOpeningBalance.CustomerID.Value > 0)
            {
                mem = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == memberOpeningBalance.CustomerID.Value);
            }

            if (mem == null && memberOpeningBalance.MemberID > 0)
            {
                mem = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == memberOpeningBalance.MemberID);
                if (mem != null && mem.CustomerID.HasValue)
                {
                    memberOpeningBalance.CustomerID = mem.CustomerID.Value;
                }
                else
                {
                    // Check if passed MemberID is actually CustomerID
                    var cust = await _context.Customers.FindAsync(memberOpeningBalance.MemberID);
                    if (cust != null)
                    {
                        memberOpeningBalance.CustomerID = cust.CustomerID;
                        mem = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == cust.CustomerID);
                    }
                }
            }
            if (mem != null) memberOpeningBalance.MemberID = mem.MemberID;

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
            await Helpers.BranchLedgerBalanceHelper.SyncMemberOpeningBalancesToBranchAsync(
                _context, new[] { ledgerId }, "सभासद सुरुवातीची शिल्लक सिंक");
            await _context.SaveChangesAsync();
        }

        [HttpGet("SyncAllLedgers")]
        public async Task<IActionResult> SyncAllLedgers()
        {
            var distinctLedgerIds = await _context.MemberOpeningBalances
                .AsNoTracking()
                .Select(m => m.LedgerID)
                .Distinct()
                .ToListAsync();

            await Helpers.BranchLedgerBalanceHelper.SyncMemberOpeningBalancesToBranchAsync(
                _context, distinctLedgerIds, "सभासद सुरुवातीची शिल्लक एकत्रित सिंक");
            await _context.SaveChangesAsync();
            return Ok(new { message = "All branch ledger opening balances synced with member opening balances." });
        }
    }
}
