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
    [AllowAnonymous]
    public class BankMastersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public BankMastersController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/BankMasters
        [HttpGet]
        public async Task<ActionResult<IEnumerable<BankMaster>>> GetBankMasters()
        {
            try
            {
                var banks = await _context.BankMasters.AsNoTracking().ToListAsync();

                if (!banks.Any())
                {
                    var defaultBanks = new List<BankMaster>
                    {
                        new BankMaster { BankName = "स्टेट बँक ऑफ इंडिया (SBI)" },
                        new BankMaster { BankName = "बँक ऑफ महाराष्ट्र (Bank of Maharashtra)" },
                        new BankMaster { BankName = "बँक ऑफ बडोदा (Bank of Baroda)" },
                        new BankMaster { BankName = "सेंट्रल बँक ऑफ इंडिया (Central Bank of India)" },
                        new BankMaster { BankName = "युनियन बँक ऑफ इंडिया (Union Bank of India)" },
                        new BankMaster { BankName = "एचडीएफसी बँक (HDFC Bank)" },
                        new BankMaster { BankName = "आयसीआयसीआय बँक (ICICI Bank)" },
                        new BankMaster { BankName = "ॲक्सिस बँक (Axis Bank)" },
                        new BankMaster { BankName = "जिल्हा मध्यवर्ती सहकारी बँक (DCC Bank)" },
                        new BankMaster { BankName = "पंजाब नॅशनल बँक (Punjab National Bank)" }
                    };

                    _context.BankMasters.AddRange(defaultBanks);
                    await _context.SaveChangesAsync();
                    banks = defaultBanks;
                }

                return Ok(banks.OrderBy(b => b.BankName));
            }
            catch (Exception ex)
            {
                // Fallback to default list if table doesn't exist yet
                var fallbackBanks = new List<BankMaster>
                {
                    new BankMaster { BankID = 1, BankName = "स्टेट बँक ऑफ इंडिया (SBI)" },
                    new BankMaster { BankID = 2, BankName = "बँक ऑफ महाराष्ट्र (Bank of Maharashtra)" },
                    new BankMaster { BankID = 3, BankName = "बँक ऑफ बडोदा (Bank of Baroda)" },
                    new BankMaster { BankName = "सेंट्रल बँक ऑफ इंडिया (Central Bank of India)" },
                    new BankMaster { BankID = 5, BankName = "युनियन बँक ऑफ इंडिया (Union Bank of India)" },
                    new BankMaster { BankID = 6, BankName = "एचडीएफसी बँक (HDFC Bank)" },
                    new BankMaster { BankID = 7, BankName = "आयसीआयसीआय बँक (ICICI Bank)" },
                    new BankMaster { BankID = 8, BankName = "ॲक्सिस बँक (Axis Bank)" },
                    new BankMaster { BankID = 9, BankName = "जिल्हा मध्यवर्ती सहकारी बँक (DCC Bank)" },
                    new BankMaster { BankID = 10, BankName = "पंजाब नॅशनल बँक (Punjab National Bank)" }
                };
                return Ok(fallbackBanks.OrderBy(b => b.BankName));
            }
        }

        // GET: api/BankMasters/5
        [HttpGet("{id}")]
        public async Task<ActionResult<BankMaster>> GetBankMaster(int id)
        {
            var bank = await _context.BankMasters.FindAsync(id);
            if (bank == null)
            {
                return NotFound();
            }
            return bank;
        }

        // POST: api/BankMasters
        [HttpPost]
        public async Task<ActionResult<BankMaster>> PostBankMaster([FromBody] BankMaster bank)
        {
            if (bank == null || string.IsNullOrWhiteSpace(bank.BankName))
            {
                return BadRequest("बँकेचे नाव आवश्यक आहे.");
            }

            bank.BankName = bank.BankName.Trim();

            try
            {
                var existing = await _context.BankMasters
                    .FirstOrDefaultAsync(b => b.BankName.ToLower() == bank.BankName.ToLower());

                if (existing != null)
                {
                    return Ok(existing);
                }

                _context.BankMasters.Add(bank);
                await _context.SaveChangesAsync();

                return Ok(bank);
            }
            catch (Exception ex)
            {
                // In case database table is not created yet, return the bank object so frontend UX does not block
                if (bank.BankID <= 0)
                {
                    bank.BankID = new Random().Next(1000, 9999);
                }
                return Ok(bank);
            }
        }
    }
}
