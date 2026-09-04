using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    public class CashManagementController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CashManagementController(AppDbContext context)
        {
            _context = context;
        }

        private int GetEffectiveBranchId(int? branchId)
        {
            if (branchId.HasValue && branchId.Value > 0)
            {
                return branchId.Value;
            }

            if (Request.Headers.TryGetValue("X-Branch-ID", out var headerVal) &&
                int.TryParse(headerVal.FirstOrDefault(), out int parsedHeaderBranch) &&
                parsedHeaderBranch > 0)
            {
                return parsedHeaderBranch;
            }

            return 1;
        }

        // ==========================================
        // 1. CASH MANAGEMENT SCHEME SETTINGS
        // ==========================================

        // GET: api/CashManagement/Settings?branchId=1
        [HttpGet("Settings")]
        public async Task<ActionResult<object>> GetSettings([FromQuery] int? branchId = null)
        {
            try
            {
                int targetBranchId = GetEffectiveBranchId(branchId);

                var setting = await _context.CashManagementSettings
                    .AsNoTracking()
                    .Include(s => s.MainVaultLedger)
                    .Include(s => s.CashShortageLedger)
                    .Include(s => s.CashExcessLedger)
                    .Include(s => s.Branch)
                    .FirstOrDefaultAsync(s => s.BranchId == targetBranchId);

                if (setting == null)
                {
                    var branch = await _context.Branches.FindAsync(targetBranchId);
                    var defaultCashId = branch?.DefaultCashLedgerID;

                    // Auto-create default settings for this branch if none exist
                    var newSetting = new CashManagementSetting
                    {
                        BranchId = targetBranchId,
                        MainVaultLedgerId = defaultCashId,
                        AutoGenerateVouchers = false,
                        EnableDenominationMandatory = true,
                        MaxBranchVaultLimit = 5000000,
                        DefaultCounterLimit = 500000,
                        Remarks = $"शाखा {branch?.BranchName ?? targetBranchId.ToString()} डीफॉल्ट कॅश सेटिंग",
                        LastUpdated = DateTime.UtcNow
                    };

                    _context.CashManagementSettings.Add(newSetting);
                    await _context.SaveChangesAsync();

                    setting = await _context.CashManagementSettings
                        .AsNoTracking()
                        .Include(s => s.MainVaultLedger)
                        .Include(s => s.CashShortageLedger)
                        .Include(s => s.CashExcessLedger)
                        .Include(s => s.Branch)
                        .FirstOrDefaultAsync(s => s.Id == newSetting.Id);
                }

                if (setting == null)
                {
                    return Ok(new
                    {
                        Id = 0,
                        BranchId = targetBranchId,
                        BranchName = "मुख्य शाखा",
                        MainVaultLedgerId = (int?)null,
                        MainVaultLedgerName = "निवडले नाही (Not Set)",
                        CashShortageLedgerId = (int?)null,
                        CashShortageLedgerName = "निवडले नाही (Not Set)",
                        CashExcessLedgerId = (int?)null,
                        CashExcessLedgerName = "निवडले नाही (Not Set)",
                        AutoGenerateVouchers = false,
                        EnableDenominationMandatory = true,
                        MaxBranchVaultLimit = 5000000m,
                        DefaultCounterLimit = 500000m,
                        Remarks = "मुख्य तिजोरी व रोख योजना सेटिंग",
                        LastUpdated = DateTime.UtcNow
                    });
                }

                return Ok(new
                {
                    setting.Id,
                    setting.BranchId,
                    BranchName = setting.Branch?.BranchName ?? "मुख्य शाखा",
                    setting.MainVaultLedgerId,
                    MainVaultLedgerName = setting.MainVaultLedger != null ? setting.MainVaultLedger.LedgerName : "निवडले नाही (Not Set)",
                    setting.CashShortageLedgerId,
                    CashShortageLedgerName = setting.CashShortageLedger != null ? setting.CashShortageLedger.LedgerName : "निवडले नाही (Not Set)",
                    setting.CashExcessLedgerId,
                    CashExcessLedgerName = setting.CashExcessLedger != null ? setting.CashExcessLedger.LedgerName : "निवडले नाही (Not Set)",
                    setting.AutoGenerateVouchers,
                    setting.EnableDenominationMandatory,
                    setting.MaxBranchVaultLimit,
                    setting.DefaultCounterLimit,
                    setting.Remarks,
                    setting.LastUpdated
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"कॅश सेटिंग लोड करताना त्रुटी: {ex.Message} {(ex.InnerException != null ? ex.InnerException.Message : "")}" });
            }
        }

        // POST: api/CashManagement/Settings
        [HttpPost("Settings")]
        public async Task<ActionResult<CashManagementSetting>> PostSettings([FromBody] CashManagementSetting dto)
        {
            try
            {
                int targetBranchId = GetEffectiveBranchId(dto.BranchId);

                var existing = await _context.CashManagementSettings
                    .FirstOrDefaultAsync(s => s.BranchId == targetBranchId);

                if (existing != null)
                {
                    existing.MainVaultLedgerId = dto.MainVaultLedgerId > 0 ? dto.MainVaultLedgerId : null;
                    existing.CashShortageLedgerId = dto.CashShortageLedgerId > 0 ? dto.CashShortageLedgerId : null;
                    existing.CashExcessLedgerId = dto.CashExcessLedgerId > 0 ? dto.CashExcessLedgerId : null;
                    existing.AutoGenerateVouchers = dto.AutoGenerateVouchers;
                    existing.EnableDenominationMandatory = dto.EnableDenominationMandatory;
                    existing.MaxBranchVaultLimit = dto.MaxBranchVaultLimit;
                    existing.DefaultCounterLimit = dto.DefaultCounterLimit;
                    existing.Remarks = dto.Remarks;
                    existing.LastUpdated = DateTime.UtcNow;

                    await _context.SaveChangesAsync();
                    return Ok(existing);
                }
                else
                {
                    dto.BranchId = targetBranchId;
                    dto.MainVaultLedgerId = dto.MainVaultLedgerId > 0 ? dto.MainVaultLedgerId : null;
                    dto.CashShortageLedgerId = dto.CashShortageLedgerId > 0 ? dto.CashShortageLedgerId : null;
                    dto.CashExcessLedgerId = dto.CashExcessLedgerId > 0 ? dto.CashExcessLedgerId : null;
                    dto.LastUpdated = DateTime.UtcNow;
                    _context.CashManagementSettings.Add(dto);
                    await _context.SaveChangesAsync();
                    return Ok(dto);
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"कॅश सेटिंग सेव्ह करताना त्रुटी: {ex.Message} {(ex.InnerException != null ? ex.InnerException.Message : "")}" });
            }
        }

        // ==========================================
        // 2. CASHIERS & COUNTERS MANAGEMENT (MULTI-BRANCH SCOPED)
        // ==========================================

        // GET: api/CashManagement/Cashiers
        [HttpGet("Cashiers")]
        public async Task<ActionResult<object>> GetCashiers([FromQuery] int? branchId = null)
        {
            try
            {
                int targetBranchId = GetEffectiveBranchId(branchId);

                var query = _context.Cashiers
                    .AsNoTracking()
                    .Include(c => c.Branch)
                    .Include(c => c.User)
                    .Include(c => c.CashLedger)
                    .Where(c => c.BranchId == targetBranchId || !c.BranchId.HasValue);

                var cashiers = await query.OrderBy(c => c.IsHeadCashier ? 0 : 1).ThenBy(c => c.CashierName).ToListAsync();

                // If no cashiers exist for this branch, create default standard counters
                if (cashiers.Count == 0)
                {
                    try
                    {
                        var defaultCashiers = new List<Cashier>
                        {
                            new Cashier
                            {
                                BranchId = targetBranchId,
                                CashierName = "मुख्य कॅशिअर (Head Cashier)",
                                CounterNumber = "तिजोरी कक्ष (Main Vault)",
                                IsHeadCashier = true,
                                IsActive = true,
                                MaxCashLimit = 2500000m,
                                Remarks = "मुख्य तिजोरी व बँक रोख व्यवस्थापन",
                                CreatedAt = DateTime.UtcNow
                            },
                            new Cashier
                            {
                                BranchId = targetBranchId,
                                CashierName = "काउंटर १ (जमा-नावे टेलर)",
                                CounterNumber = "काउंटर १",
                                IsHeadCashier = false,
                                IsActive = true,
                                MaxCashLimit = 500000m,
                                Remarks = "दैनंदिन बचत, ठेव व कर्ज रोख व्यवहार",
                                CreatedAt = DateTime.UtcNow
                            },
                            new Cashier
                            {
                                BranchId = targetBranchId,
                                CashierName = "काउंटर २ (पिग्मी व इतर संकलन)",
                                CounterNumber = "काउंटर २",
                                IsHeadCashier = false,
                                IsActive = true,
                                MaxCashLimit = 300000m,
                                Remarks = "पिग्मी एजंट संकलन व इतर रोख पावत्या",
                                CreatedAt = DateTime.UtcNow
                            }
                        };
                        _context.Cashiers.AddRange(defaultCashiers);
                        await _context.SaveChangesAsync();

                        cashiers = await _context.Cashiers
                            .AsNoTracking()
                            .Include(c => c.Branch)
                            .Include(c => c.User)
                            .Include(c => c.CashLedger)
                            .Where(c => c.BranchId == targetBranchId || !c.BranchId.HasValue)
                            .OrderBy(c => c.IsHeadCashier ? 0 : 1).ThenBy(c => c.CashierName)
                            .ToListAsync();
                    }
                    catch (Exception seedEx)
                    {
                        Console.WriteLine($"Error seeding cashiers: {seedEx.Message}");
                    }
                }

                var today = DateTime.Today;
                var result = new List<object>();

                foreach (var c in cashiers)
                {
                    decimal allocIn = 0;
                    decimal allocOut = 0;
                    decimal physicalTally = 0;
                    decimal openingBalance = 0;
                    string balanceStatus = "OPEN";

                    try
                    {
                        allocIn = await _context.CashAllocations
                            .Where(a => a.ToCashierId == c.Id && a.AllocationDate.Date == today && a.Status == "ACCEPTED")
                            .SumAsync(a => (decimal?)a.Amount) ?? 0;

                        allocOut = await _context.CashAllocations
                            .Where(a => a.FromCashierId == c.Id && a.AllocationDate.Date == today && a.Status == "ACCEPTED")
                            .SumAsync(a => (decimal?)a.Amount) ?? 0;
                    }
                    catch { }

                    try
                    {
                        var latestDenom = await _context.CashDenominations
                            .Where(d => d.CashierId == c.Id && d.DenominationDate.Date == today)
                            .OrderByDescending(d => d.CreatedAt)
                            .FirstOrDefaultAsync();
                        if (latestDenom != null)
                        {
                            physicalTally = latestDenom.TotalAmount;
                        }
                    }
                    catch { }

                    try
                    {
                        var balanceRec = await _context.CashierBalances
                            .Where(b => b.CashierId == c.Id && b.BalanceDate.Date == today)
                            .FirstOrDefaultAsync();
                        if (balanceRec != null)
                        {
                            openingBalance = balanceRec.OpeningBalance;
                            balanceStatus = balanceRec.Status ?? "OPEN";
                        }
                    }
                    catch { }

                    decimal currentBalance = openingBalance + allocIn - allocOut;

                    result.Add(new
                    {
                        c.Id,
                        c.BranchId,
                        BranchName = c.Branch?.BranchName ?? "मुख्य शाखा",
                        c.CashierName,
                        c.CounterNumber,
                        c.CashLedgerId,
                        CashLedgerName = c.CashLedger != null ? c.CashLedger.LedgerName : "डिफॉल्ट रोख खाते",
                        c.UserId,
                        UserName = c.User?.Username ?? "N/A",
                        c.IsActive,
                        c.IsHeadCashier,
                        c.MaxCashLimit,
                        c.Remarks,
                        c.CreatedAt,
                        TodayAllocatedIn = allocIn,
                        TodayAllocatedOut = allocOut,
                        OpeningBalance = openingBalance,
                        CurrentBalance = currentBalance,
                        PhysicalTally = physicalTally,
                        Difference = (physicalTally > 0) ? (physicalTally - currentBalance) : 0,
                        Status = balanceStatus
                    });
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"कॅशिअर यादी लोड करताना त्रुटी: {ex.Message} {(ex.InnerException != null ? ex.InnerException.Message : "")}" });
            }
        }

        // POST: api/CashManagement/Cashiers
        [HttpPost("Cashiers")]
        public async Task<ActionResult<Cashier>> PostCashier([FromBody] Cashier cashier)
        {
            if (string.IsNullOrWhiteSpace(cashier.CashierName))
            {
                return BadRequest("कॅशिअरचे नाव आवश्यक आहे.");
            }

            if (!cashier.BranchId.HasValue || cashier.BranchId.Value <= 0)
            {
                cashier.BranchId = GetEffectiveBranchId(null);
            }

            if (cashier.CreatedAt == default)
            {
                cashier.CreatedAt = DateTime.UtcNow;
            }

            if (cashier.CashLedgerId.HasValue && cashier.CashLedgerId.Value <= 0)
            {
                cashier.CashLedgerId = null;
            }

            _context.Cashiers.Add(cashier);
            await _context.SaveChangesAsync();

            return Ok(cashier);
        }

        // PUT: api/CashManagement/Cashiers/5
        [HttpPut("Cashiers/{id}")]
        public async Task<IActionResult> PutCashier(int id, [FromBody] Cashier cashier)
        {
            if (id != cashier.Id)
            {
                return BadRequest("आयडी जुळत नाही.");
            }

            var existing = await _context.Cashiers.FindAsync(id);
            if (existing == null)
            {
                return NotFound("कॅशिअर सापडला नाही.");
            }

            existing.CashierName = cashier.CashierName;
            existing.CounterNumber = cashier.CounterNumber;
            if (cashier.BranchId.HasValue && cashier.BranchId.Value > 0)
            {
                existing.BranchId = cashier.BranchId;
            }
            existing.CashLedgerId = (cashier.CashLedgerId.HasValue && cashier.CashLedgerId.Value > 0) ? cashier.CashLedgerId : null;
            existing.UserId = cashier.UserId;
            existing.IsActive = cashier.IsActive;
            existing.IsHeadCashier = cashier.IsHeadCashier;
            existing.MaxCashLimit = cashier.MaxCashLimit;
            existing.Remarks = cashier.Remarks;

            await _context.SaveChangesAsync();
            return Ok(existing);
        }

        // DELETE: api/CashManagement/Cashiers/5
        [HttpDelete("Cashiers/{id}")]
        public async Task<IActionResult> DeleteCashier(int id)
        {
            var cashier = await _context.Cashiers.FindAsync(id);
            if (cashier == null)
            {
                return NotFound("कॅशिअर सापडला नाही.");
            }

            var hasAllocations = await _context.CashAllocations.AnyAsync(a => a.FromCashierId == id || a.ToCashierId == id);
            if (hasAllocations)
            {
                return BadRequest("या कॅशिअरचे रोख हस्तांतरण व्यवहार आहेत, त्यामुळे डिलीट करता येणार नाही. त्याऐवजी निष्क्रिय (Inactive) करा.");
            }

            _context.Cashiers.Remove(cashier);
            await _context.SaveChangesAsync();
            return Ok(new { message = "कॅशिअर यशस्वीरित्या हटवला गेला." });
        }

        // ==========================================
        // 3. CASH ALLOCATIONS / HANDOVER / RETURN (MULTI-BRANCH & INTER-BRANCH)
        // ==========================================

        // GET: api/CashManagement/Allocations
        [HttpGet("Allocations")]
        public async Task<ActionResult<IEnumerable<object>>> GetAllocations(
            [FromQuery] int? branchId = null,
            [FromQuery] int? cashierId = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            int targetBranchId = GetEffectiveBranchId(branchId);

            var query = _context.CashAllocations
                .Include(a => a.FromCashier)
                .Include(a => a.ToCashier)
                .Include(a => a.Branch)
                .Where(a => !a.BranchId.HasValue || a.BranchId == targetBranchId);

            if (cashierId.HasValue && cashierId.Value > 0)
            {
                query = query.Where(a => a.FromCashierId == cashierId.Value || a.ToCashierId == cashierId.Value);
            }

            if (fromDate.HasValue)
            {
                query = query.Where(a => a.AllocationDate.Date >= fromDate.Value.Date);
            }

            if (toDate.HasValue)
            {
                query = query.Where(a => a.AllocationDate.Date <= toDate.Value.Date);
            }

            var list = await query
                .OrderByDescending(a => a.AllocationDate)
                .ThenByDescending(a => a.Id)
                .Select(a => new
                {
                    a.Id,
                    a.BranchId,
                    BranchName = a.Branch != null ? a.Branch.BranchName : "मुख्य शाखा",
                    a.FromCashierId,
                    FromCashierName = a.FromCashier != null ? a.FromCashier.CashierName : "मुख्य तिजोरी (Main Vault)",
                    FromCounter = a.FromCashier != null ? a.FromCashier.CounterNumber : "तिजोरी",
                    a.ToCashierId,
                    ToCashierName = a.ToCashier != null ? a.ToCashier.CashierName : "मुख्य तिजोरी (Main Vault)",
                    ToCounter = a.ToCashier != null ? a.ToCashier.CounterNumber : "तिजोरी",
                    a.Amount,
                    a.AllocationDate,
                    a.AllocationType,
                    a.Status,
                    a.Remarks,
                    a.IsReturn,
                    a.CreatedBy,
                    a.CreatedAt
                })
                .ToListAsync();

            return Ok(list);
        }

        // POST: api/CashManagement/Allocations
        [HttpPost("Allocations")]
        public async Task<ActionResult<CashAllocation>> PostAllocation([FromBody] CashAllocation allocation)
        {
            if (allocation.Amount <= 0)
            {
                return BadRequest("रक्कम ० पेक्षा जास्त असावी.");
            }

            if (!allocation.BranchId.HasValue || allocation.BranchId.Value <= 0)
            {
                allocation.BranchId = GetEffectiveBranchId(null);
            }

            if (allocation.AllocationDate == default)
            {
                allocation.AllocationDate = DateTime.Today;
            }

            if (allocation.CreatedAt == default)
            {
                allocation.CreatedAt = DateTime.UtcNow;
            }

            if (string.IsNullOrEmpty(allocation.Status))
            {
                allocation.Status = "ACCEPTED";
            }

            _context.CashAllocations.Add(allocation);
            await _context.SaveChangesAsync();

            return Ok(allocation);
        }

        // PUT: api/CashManagement/Allocations/{id}/status
        [HttpPut("Allocations/{id}/status")]
        public async Task<IActionResult> UpdateAllocationStatus(int id, [FromBody] UpdateStatusDto dto)
        {
            var alloc = await _context.CashAllocations.FindAsync(id);
            if (alloc == null)
            {
                return NotFound("हस्तांतरण नोंद सापडली नाही.");
            }

            alloc.Status = dto.Status;
            if (!string.IsNullOrWhiteSpace(dto.Remarks))
            {
                alloc.Remarks = (alloc.Remarks ?? "") + " | " + dto.Remarks;
            }

            await _context.SaveChangesAsync();
            return Ok(alloc);
        }

        // ==========================================
        // 4. CASH DENOMINATIONS & DAY-END TALLY (BRANCH SCOPED)
        // ==========================================

        // GET: api/CashManagement/Denominations
        [HttpGet("Denominations")]
        public async Task<ActionResult<IEnumerable<object>>> GetDenominations(
            [FromQuery] int? branchId = null,
            [FromQuery] int? cashierId = null,
            [FromQuery] DateTime? date = null)
        {
            int targetBranchId = GetEffectiveBranchId(branchId);

            var query = _context.CashDenominations
                .Include(d => d.Cashier)
                .Include(d => d.Branch)
                .Where(d => !d.BranchId.HasValue || d.BranchId == targetBranchId);

            if (cashierId.HasValue && cashierId.Value > 0)
            {
                query = query.Where(d => d.CashierId == cashierId.Value);
            }

            if (date.HasValue)
            {
                query = query.Where(d => d.DenominationDate.Date == date.Value.Date);
            }

            var list = await query
                .OrderByDescending(d => d.DenominationDate)
                .ThenByDescending(d => d.CreatedAt)
                .Select(d => new
                {
                    d.Id,
                    d.BranchId,
                    BranchName = d.Branch != null ? d.Branch.BranchName : "मुख्य शाखा",
                    d.CashierId,
                    CashierName = d.Cashier != null ? d.Cashier.CashierName : "N/A",
                    CounterNumber = d.Cashier != null ? d.Cashier.CounterNumber : "N/A",
                    d.DenominationDate,
                    d.EntryType,
                    d.Count2000,
                    d.Count500,
                    d.Count200,
                    d.Count100,
                    d.Count50,
                    d.Count20,
                    d.Count10,
                    d.Count5,
                    d.CountCoins,
                    d.TotalAmount,
                    d.ExpectedAmount,
                    d.DifferenceAmount,
                    d.DifferenceType,
                    d.Remarks,
                    d.VerifiedBy,
                    d.CreatedAt
                })
                .ToListAsync();

            return Ok(list);
        }

        // POST: api/CashManagement/Denominations
        [HttpPost("Denominations")]
        public async Task<ActionResult<CashDenomination>> PostDenomination([FromBody] CashDenomination denom)
        {
            if (!denom.BranchId.HasValue || denom.BranchId.Value <= 0)
            {
                denom.BranchId = GetEffectiveBranchId(null);
            }

            decimal calcTotal = (denom.Count2000 * 2000) +
                                (denom.Count500 * 500) +
                                (denom.Count200 * 200) +
                                (denom.Count100 * 100) +
                                (denom.Count50 * 50) +
                                (denom.Count20 * 20) +
                                (denom.Count10 * 10) +
                                (denom.Count5 * 5) +
                                denom.CountCoins;

            denom.TotalAmount = calcTotal;

            if (denom.ExpectedAmount > 0)
            {
                denom.DifferenceAmount = denom.TotalAmount - denom.ExpectedAmount;
                if (denom.DifferenceAmount == 0)
                    denom.DifferenceType = "MATCHED";
                else if (denom.DifferenceAmount < 0)
                    denom.DifferenceType = "SHORT";
                else
                    denom.DifferenceType = "EXCESS";
            }
            else
            {
                denom.DifferenceType = "MATCHED";
                denom.DifferenceAmount = 0;
            }

            if (denom.DenominationDate == default)
            {
                denom.DenominationDate = DateTime.Today;
            }

            if (denom.CreatedAt == default)
            {
                denom.CreatedAt = DateTime.UtcNow;
            }

            _context.CashDenominations.Add(denom);
            await _context.SaveChangesAsync();

            return Ok(denom);
        }

        // ==========================================
        // 5. CASHIER DASHBOARD & SUMMARY (STRICT MULTI-BRANCH ISOLATION)
        // ==========================================

        // GET: api/CashManagement/DashboardSummary
        [HttpGet("DashboardSummary")]
        public async Task<ActionResult<object>> GetDashboardSummary(
            [FromQuery] int? branchId = null,
            [FromQuery] int? cashierId = null,
            [FromQuery] DateTime? date = null)
        {
            var targetDate = date.HasValue ? date.Value.Date : DateTime.Today;
            int targetBranchId = GetEffectiveBranchId(branchId);

            // 1. Cashiers list strictly filtered by target branch
            var cashiers = await _context.Cashiers
                .Include(c => c.CashLedger)
                .Where(c => c.IsActive && (c.BranchId == targetBranchId || !c.BranchId.HasValue))
                .ToListAsync();

            var headCashier = cashiers.FirstOrDefault(c => c.IsHeadCashier);

            // 2. Fetch dynamic scheme settings for this specific branch
            var setting = await _context.CashManagementSettings
                .Include(s => s.MainVaultLedger)
                .FirstOrDefaultAsync(s => s.BranchId == targetBranchId || !s.BranchId.HasValue);

            // 3. Allocations for today in this branch
            var allocationsToday = await _context.CashAllocations
                .Where(a => a.AllocationDate.Date == targetDate && 
                            a.Status == "ACCEPTED" &&
                            (!a.BranchId.HasValue || a.BranchId == targetBranchId))
                .ToListAsync();

            decimal totalAllocatedToTellers = allocationsToday
                .Where(a => a.AllocationType == "HEAD_TO_TELLER")
                .Sum(a => a.Amount);

            decimal totalReturnedToHead = allocationsToday
                .Where(a => a.AllocationType == "TELLER_TO_HEAD" || a.IsReturn)
                .Sum(a => a.Amount);

            // 4. Branch Specific Cash Ledger IDs
            var targetCashLedgerIds = new HashSet<int>();

            if (setting?.MainVaultLedgerId.HasValue == true && setting.MainVaultLedgerId.Value > 0)
            {
                targetCashLedgerIds.Add(setting.MainVaultLedgerId.Value);
            }

            foreach (var c in cashiers)
            {
                if (c.CashLedgerId.HasValue && c.CashLedgerId.Value > 0)
                {
                    targetCashLedgerIds.Add(c.CashLedgerId.Value);
                }
            }

            // Fallback to Branch's Default Cash Ledger if none set
            if (!targetCashLedgerIds.Any())
            {
                var branch = await _context.Branches.FindAsync(targetBranchId);
                if (branch?.DefaultCashLedgerID.HasValue == true)
                {
                    targetCashLedgerIds.Add(branch.DefaultCashLedgerID.Value);
                }
                else
                {
                    var fallbackIds = await _context.Ledgers
                        .Where(l => l.LedgerName.Contains("रोख") || l.LedgerName.ToLower().Contains("cash"))
                        .Select(l => l.LedgerID)
                        .ToListAsync();
                    foreach (var id in fallbackIds) targetCashLedgerIds.Add(id);
                }
            }

            // 5. Today's Vouchers strictly filtered by target branch & cash ledgers
            decimal todayCashReceipts = 0;
            decimal todayCashPayments = 0;

            if (targetCashLedgerIds.Any())
            {
                var voucherDetailsToday = await _context.VoucherDetails
                    .Include(vd => vd.Voucher)
                    .Where(vd => vd.Voucher != null &&
                                 vd.Voucher.VoucherDate.Date == targetDate &&
                                 vd.Voucher.BranchID == targetBranchId &&
                                 targetCashLedgerIds.Contains(vd.LedgerID))
                    .ToListAsync();

                todayCashReceipts = voucherDetailsToday
                    .Where(vd => vd.DrCr == "DR" || vd.DrCr == "Dr" || vd.DrCr == "dr")
                    .Sum(vd => vd.Amount);

                todayCashPayments = voucherDetailsToday
                    .Where(vd => vd.DrCr == "CR" || vd.DrCr == "Cr" || vd.DrCr == "cr")
                    .Sum(vd => vd.Amount);
            }

            // 6. Denominations for today in this branch
            var denominationsToday = await _context.CashDenominations
                .Where(d => d.DenominationDate.Date == targetDate && d.BranchId == targetBranchId)
                .OrderByDescending(d => d.CreatedAt)
                .ToListAsync();

            decimal totalPhysicalCashCounted = denominationsToday
                .GroupBy(d => d.CashierId)
                .Select(g => g.First())
                .Sum(d => d.TotalAmount);

            int activeCounters = cashiers.Count(c => !c.IsHeadCashier);

            return Ok(new
            {
                BranchId = targetBranchId,
                TargetDate = targetDate,
                TotalCashiers = cashiers.Count,
                ActiveCounters = activeCounters,
                HeadCashierName = headCashier?.CashierName ?? "मुख्य कॅशिअर",
                MainVaultLedgerName = setting?.MainVaultLedger?.LedgerName ?? "डिफॉल्ट रोख खाते",
                TotalAllocatedToTellers = totalAllocatedToTellers,
                TotalReturnedToHead = totalReturnedToHead,
                NetCashWithTellers = totalAllocatedToTellers - totalReturnedToHead,
                TodayCashReceipts = todayCashReceipts,
                TodayCashPayments = todayCashPayments,
                TodayNetCashFlow = todayCashReceipts - todayCashPayments,
                TotalPhysicalCashCounted = totalPhysicalCashCounted
            });
        }

        // ==========================================
        // 6. SEED INITIAL DATA FOR SPECIFIC BRANCH
        // ==========================================

        [HttpPost("SeedDefaults")]
        public async Task<IActionResult> SeedDefaults([FromQuery] int? branchId = null)
        {
            int targetBranchId = GetEffectiveBranchId(branchId);

            var count = await _context.Cashiers.CountAsync(c => c.BranchId == targetBranchId);
            if (count > 0)
            {
                return Ok(new { message = $"शाखा {targetBranchId} साठी कॅश काउंटर्स आधीपासून अस्तित्वात आहेत." });
            }

            var branch = await _context.Branches.FindAsync(targetBranchId);

            var head = new Cashier
            {
                CashierName = "मुख्य कॅशिअर (Head Cashier)",
                CounterNumber = "तिजोरी कक्ष (Vault)",
                IsHeadCashier = true,
                IsActive = true,
                MaxCashLimit = 2500000,
                BranchId = targetBranchId,
                CashLedgerId = branch?.DefaultCashLedgerID,
                Remarks = "मुख्य तिजोरी व बँक रोख व्यवस्थापन",
                CreatedAt = DateTime.UtcNow
            };

            var counter1 = new Cashier
            {
                CashierName = "काउंटर १ (जमा-नावे टेलर)",
                CounterNumber = "काउंटर १",
                IsHeadCashier = false,
                IsActive = true,
                MaxCashLimit = 500000,
                BranchId = targetBranchId,
                CashLedgerId = branch?.DefaultCashLedgerID,
                Remarks = "दैनंदिन बचत, ठेव व कर्ज रोख व्यवहार",
                CreatedAt = DateTime.UtcNow
            };

            var counter2 = new Cashier
            {
                CashierName = "काउंटर २ (पिग्मी व इतर संकलन)",
                CounterNumber = "काउंटर २",
                IsHeadCashier = false,
                IsActive = true,
                MaxCashLimit = 300000,
                BranchId = targetBranchId,
                CashLedgerId = branch?.DefaultCashLedgerID,
                Remarks = "पिग्मी एजंट संकलन व इतर रोख पावत्या",
                CreatedAt = DateTime.UtcNow
            };

            _context.Cashiers.AddRange(head, counter1, counter2);

            // Also seed default CashManagementSetting for this branch if none
            if (!await _context.CashManagementSettings.AnyAsync(s => s.BranchId == targetBranchId))
            {
                var defaultSetting = new CashManagementSetting
                {
                    BranchId = targetBranchId,
                    MainVaultLedgerId = branch?.DefaultCashLedgerID,
                    AutoGenerateVouchers = false,
                    EnableDenominationMandatory = true,
                    MaxBranchVaultLimit = 5000000,
                    DefaultCounterLimit = 500000,
                    Remarks = $"शाखा {branch?.BranchName ?? targetBranchId.ToString()} मुख्य तिजोरी व रोख योजना सेटिंग"
                };
                _context.CashManagementSettings.Add(defaultSetting);
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = $"शाखा {branch?.BranchName ?? targetBranchId.ToString()} साठी डीफॉल्ट कॅश काउंटर्स व सेटिंग्ज तयार झाले!" });
        }
    }

    public class UpdateStatusDto
    {
        public string Status { get; set; }
        public string Remarks { get; set; }
    }
}
