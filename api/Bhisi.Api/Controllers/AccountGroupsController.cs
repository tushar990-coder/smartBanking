using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    public class AccountGroupsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AccountGroupsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/AccountGroups/NextId or NextCode
        [HttpGet("NextId")]
        [HttpGet("NextCode")]
        public async Task<ActionResult<object>> GetNextGroupId([FromQuery] bool? isPrimary, [FromQuery] int? parentGroupId)
        {
            var allGroups = await _context.AccountGroups.ToListAsync();
            
            // 1. Calculate next primary integer ID / code
            var primaryGroups = allGroups.Where(g => g.ParentGroupID == null).ToList();
            int maxPrimaryNum = 0;
            foreach (var pg in primaryGroups)
            {
                var code = !string.IsNullOrWhiteSpace(pg.GroupCode) ? pg.GroupCode.Trim() : pg.GroupID.ToString();
                if (int.TryParse(code, out int num) && num > maxPrimaryNum)
                {
                    maxPrimaryNum = num;
                }
                else if (pg.GroupID > maxPrimaryNum)
                {
                    maxPrimaryNum = pg.GroupID;
                }
            }
            string nextPrimaryCode = (maxPrimaryNum + 1).ToString();

            // 2. Calculate next subgroup hierarchical code (e.g. 1.1, 1.2, 1.1.1)
            string nextSubCode = "1.1";
            if (parentGroupId.HasValue && parentGroupId.Value > 0)
            {
                var parent = allGroups.FirstOrDefault(g => g.GroupID == parentGroupId.Value);
                string parentCode = !string.IsNullOrWhiteSpace(parent?.GroupCode) 
                    ? parent.GroupCode.Trim() 
                    : (parent?.GroupID.ToString() ?? "1");

                var directChildren = allGroups.Where(g => g.ParentGroupID == parentGroupId.Value).ToList();
                int maxChildIndex = 0;
                string prefix = parentCode + ".";

                foreach (var ch in directChildren)
                {
                    var code = !string.IsNullOrWhiteSpace(ch.GroupCode) ? ch.GroupCode.Trim() : "";
                    if (code.StartsWith(prefix))
                    {
                        string suffix = code.Substring(prefix.Length);
                        var dotParts = suffix.Split('.');
                        if (int.TryParse(dotParts[0], out int idx) && idx > maxChildIndex)
                        {
                            maxChildIndex = idx;
                        }
                    }
                }

                if (maxChildIndex == 0 && directChildren.Any())
                {
                    maxChildIndex = directChildren.Count;
                }

                nextSubCode = $"{parentCode}.{maxChildIndex + 1}";
            }
            else
            {
                nextSubCode = $"{nextPrimaryCode}.1";
            }

            bool isPrim = isPrimary == true || (parentGroupId == null || parentGroupId == 0);
            string selectedCode = isPrim ? nextPrimaryCode : nextSubCode;

            var maxTotalId = allGroups.Any() ? allGroups.Max(g => g.GroupID) : 0;
            int nextIntId = maxTotalId + 1;

            return Ok(new 
            { 
                groupCode = selectedCode,
                nextGroupCode = selectedCode,
                nextPrimaryGroupCode = nextPrimaryCode,
                nextSubGroupCode = nextSubCode,
                nextGroupId = nextIntId,
                nextPrimaryGroupId = maxPrimaryNum + 1,
                nextSubGroupId = nextIntId,
                maxTotalId,
                maxPrimaryId = maxPrimaryNum
            });
        }

        // GET: api/AccountGroups
        [HttpGet]
        public async Task<ActionResult<IEnumerable<AccountGroup>>> GetAccountGroups()
        {
            try
            {
                var list = await _context.AccountGroups
                    .AsNoTracking()
                    .OrderBy(a => a.DisplayOrder)
                    .ThenBy(a => a.GroupID)
                    .ToListAsync();

                return Ok(list);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"खाते गट लोड करताना त्रुटी आली: {ex.Message}");
            }
        }

        // GET: api/AccountGroups/5
        [HttpGet("{id}")]
        public async Task<ActionResult<AccountGroup>> GetAccountGroup(int id)
        {
            var accountGroup = await _context.AccountGroups
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.GroupID == id);

            if (accountGroup == null)
            {
                return NotFound();
            }

            return accountGroup;
        }

        // POST: api/AccountGroups
        [HttpPost]
        public async Task<ActionResult<AccountGroup>> PostAccountGroup(AccountGroup accountGroup)
        {
            accountGroup.ParentGroup = null;
            accountGroup.SubGroups = new List<AccountGroup>();
            accountGroup.Ledgers = new List<Ledger>();

            // Auto-calculate GroupCode if not provided
            if (string.IsNullOrWhiteSpace(accountGroup.GroupCode))
            {
                var allGroups = await _context.AccountGroups.AsNoTracking().ToListAsync();
                if (accountGroup.ParentGroupID.HasValue && accountGroup.ParentGroupID.Value > 0)
                {
                    var parent = allGroups.FirstOrDefault(g => g.GroupID == accountGroup.ParentGroupID.Value);
                    string parentCode = !string.IsNullOrWhiteSpace(parent?.GroupCode) ? parent.GroupCode.Trim() : (parent?.GroupID.ToString() ?? "1");
                    var children = allGroups.Where(g => g.ParentGroupID == accountGroup.ParentGroupID.Value).ToList();
                    int maxIdx = 0;
                    string prefix = parentCode + ".";
                    foreach (var ch in children)
                    {
                        var code = !string.IsNullOrWhiteSpace(ch.GroupCode) ? ch.GroupCode.Trim() : "";
                        if (code.StartsWith(prefix))
                        {
                            var parts = code.Substring(prefix.Length).Split('.');
                            if (int.TryParse(parts[0], out int idx) && idx > maxIdx)
                            {
                                maxIdx = idx;
                            }
                        }
                    }
                    accountGroup.GroupCode = $"{parentCode}.{maxIdx + 1}";
                }
                else
                {
                    int maxPrim = 0;
                    foreach (var pg in allGroups.Where(g => g.ParentGroupID == null))
                    {
                        if (int.TryParse(pg.GroupCode, out int n) && n > maxPrim) maxPrim = n;
                        else if (pg.GroupID > maxPrim) maxPrim = pg.GroupID;
                    }
                    accountGroup.GroupCode = (maxPrim + 1).ToString();
                }
            }

            try
            {
                if (_context.Database.IsSqlServer())
                {
                    try
                    {
                        var maxId = await _context.AccountGroups.MaxAsync(g => (int?)g.GroupID) ?? 0;
                        await _context.Database.ExecuteSqlInterpolatedAsync($"DBCC CHECKIDENT ('[dbo].[AccountGroups]', RESEED, {maxId})");
                    }
                    catch { }
                }

                if (accountGroup.GroupID <= 0)
                {
                    _context.AccountGroups.Add(accountGroup);
                    await _context.SaveChangesAsync();
                }
                else
                {
                    if (await _context.AccountGroups.AnyAsync(g => g.GroupID == accountGroup.GroupID))
                    {
                        return BadRequest($"गट आयडी {accountGroup.GroupID} आधीपासून अस्तित्वात आहे.");
                    }

                    if (_context.Database.IsSqlServer())
                    {
                        using var transaction = await _context.Database.BeginTransactionAsync();
                        try
                        {
                            await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [dbo].[AccountGroups] ON");
                            await _context.Database.ExecuteSqlRawAsync(
                                @"INSERT INTO [dbo].[AccountGroups] ([GroupID], [GroupCode], [GroupName], [GroupNameEnglish], [ParentGroupID], [NatureOfGroup], [DisplayOrder], [IsActive])
                                  VALUES ({0}, {1}, {2}, {3}, {4}, {5}, {6}, {7})",
                                accountGroup.GroupID,
                                accountGroup.GroupCode,
                                accountGroup.GroupName,
                                accountGroup.GroupNameEnglish ?? (object)DBNull.Value,
                                accountGroup.ParentGroupID.HasValue ? (object)accountGroup.ParentGroupID.Value : DBNull.Value,
                                accountGroup.NatureOfGroup,
                                accountGroup.DisplayOrder,
                                accountGroup.IsActive
                            );
                            await _context.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [dbo].[AccountGroups] OFF");
                            await transaction.CommitAsync();
                        }
                        catch (Exception)
                        {
                            await transaction.RollbackAsync();
                            accountGroup.GroupID = 0;
                            _context.AccountGroups.Add(accountGroup);
                            await _context.SaveChangesAsync();
                        }
                    }
                    else
                    {
                        _context.AccountGroups.Add(accountGroup);
                        await _context.SaveChangesAsync();
                    }
                }

                if (_context.Database.IsSqlServer())
                {
                    try
                    {
                        var curMax = await _context.AccountGroups.MaxAsync(g => (int?)g.GroupID) ?? 0;
                        await _context.Database.ExecuteSqlInterpolatedAsync($"DBCC CHECKIDENT ('[dbo].[AccountGroups]', RESEED, {curMax})");
                    }
                    catch { }
                }

                return CreatedAtAction(nameof(GetAccountGroup), new { id = accountGroup.GroupID }, accountGroup);
            }
            catch (Exception ex)
            {
                return BadRequest($"खाते गट जतन करताना त्रुटी आली: {ex.InnerException?.Message ?? ex.Message}");
            }
        }

        // PUT: api/AccountGroups/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutAccountGroup(int id, AccountGroup accountGroup)
        {
            if (id != accountGroup.GroupID)
            {
                return BadRequest();
            }

            // Prevent self-referencing loop
            if (accountGroup.ParentGroupID == id)
            {
                return BadRequest("A group cannot be its own parent.");
            }

            accountGroup.ParentGroup = null;
            accountGroup.SubGroups = new List<AccountGroup>();
            accountGroup.Ledgers = new List<Ledger>();
            _context.Entry(accountGroup).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!AccountGroupExists(id))
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

        // DELETE: api/AccountGroups/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAccountGroup(int id)
        {
            var accountGroup = await _context.AccountGroups.FindAsync(id);
            if (accountGroup == null)
            {
                return NotFound();
            }

            // 1. Check if it has any sub-groups
            var hasChildren = await _context.AccountGroups.AnyAsync(a => a.ParentGroupID == id);
            if (hasChildren)
            {
                return BadRequest("या खाते गटाच्या अंतर्गत उप-गट (Sub-groups) अस्तित्वात असल्यामुळे हा गट डिलीट करता येत नाही.");
            }

            // 2. Check if it has any ledgers created under it
            var hasLedgers = await _context.Ledgers.AnyAsync(l => l.GroupID == id);
            if (hasLedgers)
            {
                return BadRequest("या खाते गटाच्या अंतर्गत खाती (Ledgers) तयार केलेली असल्यामुळे हा गट डिलीट करता येत नाही. प्रथम संबंधित खाती हटवा किंवा दुसऱ्या गटात ट्रान्सफर करा.");
            }

            try
            {
                _context.AccountGroups.Remove(accountGroup);
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (DbUpdateException)
            {
                return BadRequest("या खाते गटाच्या अंतर्गत खाती (Ledgers) किंवा उप-गट (Sub-groups) जोडलेले असल्यामुळे हा गट डिलीट करता येत नाही. प्रथम संबंधित खाती किंवा उप-गट हटवा.");
            }
            catch (Exception ex)
            {
                return BadRequest("खाते गट डिलीट करताना त्रुटी आली: " + ex.Message);
            }
        }

        public class GroupSequenceDto
        {
            public int GroupID { get; set; }
            public int DisplayOrder { get; set; }
        }

        // POST: api/AccountGroups/UpdateSequence
        [HttpPost("UpdateSequence")]
        public async Task<IActionResult> UpdateSequence([FromBody] List<GroupSequenceDto> sequenceList)
        {
            if (sequenceList == null || !sequenceList.Any()) return BadRequest("No sequence items provided.");

            var groupIds = sequenceList.Select(s => s.GroupID).ToList();
            var groups = await _context.AccountGroups.Where(g => groupIds.Contains(g.GroupID)).ToListAsync();

            foreach (var item in sequenceList)
            {
                var grp = groups.FirstOrDefault(g => g.GroupID == item.GroupID);
                if (grp != null)
                {
                    grp.DisplayOrder = item.DisplayOrder;
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Group sequence updated successfully." });
        }

        private bool AccountGroupExists(int id)
        {
            return _context.AccountGroups.Any(e => e.GroupID == id);
        }
    }
}
