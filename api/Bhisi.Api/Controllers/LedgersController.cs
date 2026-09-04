using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    public class LedgersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LedgersController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/Ledgers/NextId
        [HttpGet("NextId")]
        public async Task<ActionResult<object>> GetNextLedgerId()
        {
            var maxId = await _context.Ledgers.MaxAsync(l => (int?)l.LedgerID) ?? 0;

            if (_context.Database.IsSqlServer())
            {
                try
                {
                    await _context.Database.ExecuteSqlInterpolatedAsync($"DBCC CHECKIDENT ('[dbo].[Ledgers]', RESEED, {maxId})");
                }
                catch { }
            }

            return Ok(new { nextLedgerId = maxId + 1 });
        }

        // GET: api/Ledgers
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Ledger>>> GetLedgers()
        {
            return await _context.Ledgers
                .Include(l => l.AccountGroup)
                .ToListAsync();
        }

        // GET: api/Ledgers/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Ledger>> GetLedger(int id)
        {
            var ledger = await _context.Ledgers
                .Include(l => l.AccountGroup)
                .FirstOrDefaultAsync(l => l.LedgerID == id);

            if (ledger == null)
            {
                return NotFound();
            }

            return ledger;
        }

        // GET: api/Ledgers/5/info
        [HttpGet("{id}/info")]
        public async Task<ActionResult<object>> GetLedgerInfo(int id)
        {
            var ledger = await _context.Ledgers.FindAsync(id);
            if (ledger == null) return NotFound();

            // 1. Calculate Balance
            var vds = await _context.VoucherDetails
                .Include(vd => vd.Voucher)
                .Where(vd => vd.LedgerID == id && vd.Voucher.Status == "Approved")
                .ToListAsync();
            decimal totalDr = vds.Where(vd => vd.DrCr == "Dr").Sum(vd => vd.Amount);
            decimal totalCr = vds.Where(vd => vd.DrCr == "Cr").Sum(vd => vd.Amount);

            decimal drBal = ledger.OpeningBalanceType == "Dr" ? ledger.OpeningBalance : 0;
            decimal crBal = ledger.OpeningBalanceType == "Cr" ? ledger.OpeningBalance : 0;
            drBal += totalDr;
            crBal += totalCr;

            decimal netBalance = 0;
            string balType = "";
            if (drBal > crBal) { netBalance = drBal - crBal; balType = "Dr"; }
            else if (crBal > drBal) { netBalance = crBal - drBal; balType = "Cr"; }

            // 2. Compute Path (Flow)
            var groups = await _context.AccountGroups.ToListAsync();
            var currentGroup = groups.FirstOrDefault(g => g.GroupID == ledger.GroupID);
            
            var path = new List<string>();
            path.Add(ledger.LedgerName);

            string nature = currentGroup?.NatureOfGroup ?? "";
            string primaryReport = (nature == "Assets" || nature == "Liabilities") ? "ताळेबंद" : "नफातोटा पत्रक";
            string side = "";
            if (nature == "Assets") side = "Dr";
            else if (nature == "Liabilities") side = "Cr";
            else if (nature == "Expenses") side = "Dr";
            else if (nature == "Income") side = "Cr";

            while (currentGroup != null)
            {
                path.Insert(0, currentGroup.GroupName);
                if (currentGroup.ParentGroupID.HasValue)
                    currentGroup = groups.FirstOrDefault(g => g.GroupID == currentGroup.ParentGroupID.Value);
                else
                    break;
            }
            
            if (!string.IsNullOrEmpty(side)) path.Insert(0, side);
            if (!string.IsNullOrEmpty(primaryReport)) path.Insert(0, primaryReport);

            string flowPath = string.Join(" ➔ ", path);

            return new {
                Balance = netBalance,
                BalanceType = balType,
                Path = flowPath
            };
        }

        // POST: api/Ledgers
        [HttpPost]
        public async Task<ActionResult<Ledger>> PostLedger(Ledger ledger)
        {
            ledger.AccountGroup = null; // Prevent creating new group
            if (string.IsNullOrEmpty(ledger.OpeningBalanceType))
            {
                ledger.OpeningBalanceType = "Dr";
            }

            if (string.IsNullOrWhiteSpace(ledger.LedgerName))
            {
                return BadRequest("खात्याचे नाव प्रविष्ट करणे अनिवार्य आहे.");
            }

            ledger.LedgerName = ledger.LedgerName.Trim();
            if (!string.IsNullOrWhiteSpace(ledger.LedgerNameEnglish))
            {
                ledger.LedgerNameEnglish = ledger.LedgerNameEnglish.Trim();
            }

            // Verify GroupID exists, or auto-recover if AccountGroups is empty
            var groupExists = await _context.AccountGroups.AnyAsync(g => g.GroupID == ledger.GroupID);
            if (!groupExists)
            {
                var firstGroup = await _context.AccountGroups.FirstOrDefaultAsync();
                if (firstGroup != null)
                {
                    ledger.GroupID = firstGroup.GroupID;
                }
                else
                {
                    var newGroup = new AccountGroup
                    {
                        GroupName = "सामान्य खाते गट (General Group)",
                        NatureOfGroup = "Assets",
                        IsActive = true
                    };
                    _context.AccountGroups.Add(newGroup);
                    await _context.SaveChangesAsync();
                    ledger.GroupID = newGroup.GroupID;
                }
            }

            try
            {
                if (_context.Database.IsSqlServer())
                {
                    try
                    {
                        var maxId = await _context.Ledgers.MaxAsync(l => (int?)l.LedgerID) ?? 0;
                        await _context.Database.ExecuteSqlInterpolatedAsync($"DBCC CHECKIDENT ('[dbo].[Ledgers]', RESEED, {maxId})");
                    }
                    catch { }
                }

                if (ledger.LedgerID <= 0)
                {
                    _context.Ledgers.Add(ledger);
                    await _context.SaveChangesAsync();
                }
                else
                {
                    if (await _context.Ledgers.AnyAsync(l => l.LedgerID == ledger.LedgerID))
                    {
                        return BadRequest($"खाते क्रमांक {ledger.LedgerID} आधीपासून अस्तित्वात आहे.");
                    }

                    if (_context.Database.IsSqlServer())
                    {
                        using var transaction = await _context.Database.BeginTransactionAsync();
                        try
                        {
                            await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [dbo].[Ledgers] ON");
                            await _context.Database.ExecuteSqlRawAsync(
                                @"INSERT INTO [dbo].[Ledgers] ([LedgerID], [LedgerName], [LedgerNameEnglish], [GroupID], [OpeningBalance], [OpeningBalanceType], [ReportType], [AccountType], [ExcludeFromRule35Swanidhi], [IsActive])
                                  VALUES ({0}, {1}, {2}, {3}, {4}, {5}, {6}, {7}, {8}, {9})",
                                ledger.LedgerID,
                                ledger.LedgerName,
                                ledger.LedgerNameEnglish ?? (object)DBNull.Value,
                                ledger.GroupID,
                                ledger.OpeningBalance,
                                ledger.OpeningBalanceType ?? "Dr",
                                ledger.ReportType ?? (object)DBNull.Value,
                                ledger.AccountType ?? (object)DBNull.Value,
                                ledger.ExcludeFromRule35Swanidhi,
                                ledger.IsActive
                            );
                            await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [dbo].[Ledgers] OFF");
                            await transaction.CommitAsync();
                        }
                        catch (Exception)
                        {
                            await transaction.RollbackAsync();
                            ledger.LedgerID = 0;
                            _context.Ledgers.Add(ledger);
                            await _context.SaveChangesAsync();
                        }
                    }
                    else
                    {
                        _context.Ledgers.Add(ledger);
                        await _context.SaveChangesAsync();
                    }
                }

                if (_context.Database.IsSqlServer())
                {
                    try
                    {
                        var curMax = await _context.Ledgers.MaxAsync(l => (int?)l.LedgerID) ?? 0;
                        await _context.Database.ExecuteSqlInterpolatedAsync($"DBCC CHECKIDENT ('[dbo].[Ledgers]', RESEED, {curMax})");
                    }
                    catch { }
                }

                return CreatedAtAction(nameof(GetLedger), new { id = ledger.LedgerID }, ledger);
            }
            catch (Exception ex)
            {
                return BadRequest($"खाते माहिती जतन करताना त्रुटी आली: {ex.InnerException?.Message ?? ex.Message}");
            }
        }

        // PUT: api/Ledgers/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutLedger(int id, Ledger ledger)
        {
            if (id != ledger.LedgerID)
            {
                return BadRequest("अवैध खाते क्रमांक.");
            }

            if (string.IsNullOrWhiteSpace(ledger.LedgerName))
            {
                return BadRequest("खात्याचे नाव प्रविष्ट करणे अनिवार्य आहे.");
            }

            ledger.LedgerName = ledger.LedgerName.Trim();
            if (!string.IsNullOrWhiteSpace(ledger.LedgerNameEnglish))
            {
                ledger.LedgerNameEnglish = ledger.LedgerNameEnglish.Trim();
            }

            ledger.AccountGroup = null;
            _context.Entry(ledger).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!LedgerExists(id))
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

        // DELETE: api/Ledgers/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteLedger(int id)
        {
            var ledger = await _context.Ledgers.FindAsync(id);
            if (ledger == null)
            {
                return NotFound();
            }

            // 1. Check if it has any vouchers created under it
            var hasVouchers = await _context.VoucherDetails.AnyAsync(v => v.LedgerID == id);
            if (hasVouchers)
            {
                return BadRequest("या खात्यावर व्हाउचर्स (Voucher नोंदी / व्यवहार) नोंदवलेले असल्यामुळे हे खाते डिलीट करता येत नाही. खात्याचा वापर थांबवण्यासाठी तुम्ही हे खाते 'निष्क्रिय (Inactive)' करू शकता किंवा संबंधित व्हाउचर्स हटवा.");
            }

            try
            {
                _context.Ledgers.Remove(ledger);
                await _context.SaveChangesAsync();

                if (_context.Database.IsSqlServer())
                {
                    try
                    {
                        var newMaxId = await _context.Ledgers.MaxAsync(l => (int?)l.LedgerID) ?? 0;
                        await _context.Database.ExecuteSqlInterpolatedAsync($"DBCC CHECKIDENT ('[dbo].[Ledgers]', RESEED, {newMaxId})");
                    }
                    catch { }
                }

                return NoContent();
            }
            catch (DbUpdateException)
            {
                return BadRequest("या खात्याशी संबंधित व्हाउचर्स, योजना किंवा इतर नोंदी जोडलेल्या असल्यामुळे हे खाते डिलीट करता येत नाही. खात्याचा वापर थांबवण्यासाठी हे खाते 'निष्क्रिय (Inactive)' करा.");
            }
            catch (Exception ex)
            {
                return BadRequest("खाते डिलीट करताना त्रुटी आली: " + ex.Message);
            }
        }

        private bool LedgerExists(int id)
        {
            return _context.Ledgers.Any(e => e.LedgerID == id);
        }
    }
}
