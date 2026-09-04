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
    public class CustomerOpeningBalancesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CustomerOpeningBalancesController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/CustomerOpeningBalances
        [HttpGet]
        public async Task<ActionResult<IEnumerable<CustomerOpeningBalance>>> GetCustomerOpeningBalances()
        {
            return await _context.CustomerOpeningBalances
                                 .Include(c => c.Customer)
                                 .Include(c => c.Ledger)
                                 .ToListAsync();
        }

        // GET: api/CustomerOpeningBalances/5
        [HttpGet("{id}")]
        public async Task<ActionResult<CustomerOpeningBalance>> GetCustomerOpeningBalance(int id)
        {
            var customerOpeningBalance = await _context.CustomerOpeningBalances
                                                       .Include(c => c.Customer)
                                                       .Include(c => c.Ledger)
                                                       .FirstOrDefaultAsync(c => c.CustomerOpeningBalanceID == id);

            if (customerOpeningBalance == null)
            {
                return NotFound();
            }

            return customerOpeningBalance;
        }

        // PUT: api/CustomerOpeningBalances/5
        [HttpPut("{id}")]
        [MigrationLockFilter]
        public async Task<IActionResult> PutCustomerOpeningBalance(int id, CustomerOpeningBalance customerOpeningBalance)
        {
            if (id != customerOpeningBalance.CustomerOpeningBalanceID)
            {
                return BadRequest();
            }

            var existingRecord = await _context.CustomerOpeningBalances.FindAsync(id);
            if (existingRecord == null)
            {
                return NotFound();
            }

            existingRecord.CustomerID = customerOpeningBalance.CustomerID;
            existingRecord.LedgerID = customerOpeningBalance.LedgerID;
            existingRecord.Amount = customerOpeningBalance.Amount;
            existingRecord.BalanceType = customerOpeningBalance.BalanceType;
            existingRecord.UpdatedBy = customerOpeningBalance.UpdatedBy ?? 1;
            existingRecord.UpdatedOn = DateTime.Now;

            try
            {
                await _context.SaveChangesAsync();
                await UpdateLedgerOpeningBalance(customerOpeningBalance.LedgerID);
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!CustomerOpeningBalanceExists(id))
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

        // POST: api/CustomerOpeningBalances
        [HttpPost]
        [MigrationLockFilter]
        public async Task<ActionResult<CustomerOpeningBalance>> PostCustomerOpeningBalance(CustomerOpeningBalance customerOpeningBalance)
        {
            customerOpeningBalance.CreatedOn = DateTime.Now;
            _context.CustomerOpeningBalances.Add(customerOpeningBalance);
            await _context.SaveChangesAsync();

            await UpdateLedgerOpeningBalance(customerOpeningBalance.LedgerID);

            return CreatedAtAction("GetCustomerOpeningBalance", new { id = customerOpeningBalance.CustomerOpeningBalanceID }, customerOpeningBalance);
        }

        // DELETE: api/CustomerOpeningBalances/5
        [HttpDelete("{id}")]
        [MigrationLockFilter]
        public async Task<IActionResult> DeleteCustomerOpeningBalance(int id)
        {
            var customerOpeningBalance = await _context.CustomerOpeningBalances.FindAsync(id);
            if (customerOpeningBalance == null)
            {
                return NotFound();
            }

            int ledgerId = customerOpeningBalance.LedgerID;

            _context.CustomerOpeningBalances.Remove(customerOpeningBalance);
            await _context.SaveChangesAsync();

            await UpdateLedgerOpeningBalance(ledgerId);

            return NoContent();
        }

        private bool CustomerOpeningBalanceExists(int id)
        {
            return _context.CustomerOpeningBalances.Any(e => e.CustomerOpeningBalanceID == id);
        }

        private async Task UpdateLedgerOpeningBalance(int ledgerId)
        {
            var balances = await _context.CustomerOpeningBalances
                                         .Where(b => b.LedgerID == ledgerId)
                                         .ToListAsync();

            decimal totalDebit = balances.Where(b => b.BalanceType == "Dr").Sum(b => b.Amount);
            decimal totalCredit = balances.Where(b => b.BalanceType == "Cr").Sum(b => b.Amount);

            var ledger = await _context.Ledgers.FindAsync(ledgerId);
            if (ledger != null)
            {
                if (totalDebit >= totalCredit)
                {
                    ledger.OpeningBalance = totalDebit - totalCredit;
                    ledger.OpeningBalanceType = "Dr";
                }
                else
                {
                    ledger.OpeningBalance = totalCredit - totalDebit;
                    ledger.OpeningBalanceType = "Cr";
                }
                await _context.SaveChangesAsync();
            }
        }
    }
}
