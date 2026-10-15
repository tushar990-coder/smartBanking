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
    public class BranchLedgerOpeningBalancesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public BranchLedgerOpeningBalancesController(AppDbContext context)
        {
            _context = context;
        }

        public class BranchLedgerOpeningDto
        {
            public int LedgerID { get; set; }
            public string? LedgerCode { get; set; }
            public string LedgerName { get; set; } = string.Empty;
            public int GroupID { get; set; }
            public string GroupName { get; set; } = string.Empty;
            public string NatureOfGroup { get; set; } = string.Empty;
            public int BranchID { get; set; }
            public int FinancialYearID { get; set; }
            public decimal OpeningBalance { get; set; }
            public string OpeningBalanceType { get; set; } = "Dr"; // Dr or Cr
            public string? Remarks { get; set; }
            public int? BranchLedgerOpeningBalanceID { get; set; }
        }

        public class BulkSaveOpeningBalanceRequest
        {
            public int BranchID { get; set; }
            public int FinancialYearID { get; set; }
            public List<BranchLedgerOpeningDto> Items { get; set; } = new();
        }

        // GET: api/BranchLedgerOpeningBalances/ledger-rows
        [HttpGet("ledger-rows")]
        public async Task<ActionResult<IEnumerable<BranchLedgerOpeningDto>>> GetLedgerRows(
            [FromQuery] int branchId,
            [FromQuery] int? financialYearId = null)
        {
            if (branchId <= 0)
            {
                return BadRequest("अवैध शाखा निवड.");
            }

            int activeFyId = financialYearId ?? (await _context.FinancialYears
                .Where(fy => fy.IsActive)
                .Select(fy => fy.FinancialYearID)
                .FirstOrDefaultAsync());

            if (activeFyId == 0)
            {
                activeFyId = await _context.FinancialYears
                    .OrderByDescending(fy => fy.FinancialYearID)
                    .Select(fy => fy.FinancialYearID)
                    .FirstOrDefaultAsync();
            }

            var ledgers = await _context.Ledgers
                .AsNoTracking()
                .Include(l => l.AccountGroup)
                .Where(l => l.IsActive)
                .OrderBy(l => l.AccountGroup != null ? l.AccountGroup.GroupID : 9999)
                .ThenBy(l => l.LedgerID)
                .ToListAsync();

            var existingBranchBalances = await _context.BranchLedgerOpeningBalances
                .AsNoTracking()
                .Where(b => b.BranchID == branchId && b.FinancialYearID == activeFyId)
                .ToDictionaryAsync(b => b.LedgerID, b => b);

            var branch = await _context.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.BranchID == branchId);
            bool isHo = branch != null && (string.Equals(branch.BranchType, "HeadOffice", StringComparison.OrdinalIgnoreCase) || branch.BranchID == 1);

            var result = ledgers.Select(l =>
            {
                existingBranchBalances.TryGetValue(l.LedgerID, out var existing);

                decimal balance = 0;
                string balType = "Dr";
                int? existingId = null;
                string? remarks = null;

                if (existing != null)
                {
                    balance = existing.OpeningBalance;
                    balType = existing.OpeningBalanceType;
                    existingId = existing.BranchLedgerOpeningBalanceID;
                    remarks = existing.Remarks;
                }
                else if (isHo && l.OpeningBalance > 0)
                {
                    // Fallback to legacy master opening balance for Head Office only
                    balance = l.OpeningBalance;
                    balType = !string.IsNullOrEmpty(l.OpeningBalanceType) ? l.OpeningBalanceType : "Dr";
                }

                return new BranchLedgerOpeningDto
                {
                    LedgerID = l.LedgerID,
                    LedgerCode = l.LedgerCode,
                    LedgerName = l.LedgerName,
                    GroupID = l.GroupID,
                    GroupName = l.AccountGroup?.GroupName ?? "",
                    NatureOfGroup = l.AccountGroup?.NatureOfGroup ?? "",
                    BranchID = branchId,
                    FinancialYearID = activeFyId,
                    OpeningBalance = balance,
                    OpeningBalanceType = balType,
                    Remarks = remarks,
                    BranchLedgerOpeningBalanceID = existingId
                };
            }).ToList();

            return Ok(result);
        }

        // POST: api/BranchLedgerOpeningBalances/bulk
        [HttpPost("bulk")]
        [Authorize(Roles = "Admin,SuperAdmin,Manager")]
        public async Task<IActionResult> BulkSaveOpeningBalances([FromBody] BulkSaveOpeningBalanceRequest request)
        {
            if (request == null || request.BranchID <= 0 || request.FinancialYearID <= 0)
            {
                return BadRequest("अवैध विनंती. शाखा आणि आर्थिक वर्ष आवश्यक आहे.");
            }

            var existingRows = await _context.BranchLedgerOpeningBalances
                .Where(b => b.BranchID == request.BranchID && b.FinancialYearID == request.FinancialYearID)
                .ToListAsync();

            var existingMap = existingRows.ToDictionary(r => r.LedgerID, r => r);

            foreach (var item in request.Items)
            {
                if (item.LedgerID <= 0) continue;

                decimal safeBal = Math.Max(0, Math.Round(item.OpeningBalance, 2));
                string safeType = string.Equals(item.OpeningBalanceType, "Cr", StringComparison.OrdinalIgnoreCase) ? "Cr" : "Dr";

                if (existingMap.TryGetValue(item.LedgerID, out var existing))
                {
                    existing.OpeningBalance = safeBal;
                    existing.OpeningBalanceType = safeType;
                    existing.Remarks = item.Remarks;
                    existing.UpdatedOn = DateTime.UtcNow;
                }
                else if (safeBal > 0)
                {
                    var newRecord = new BranchLedgerOpeningBalance
                    {
                        LedgerID = item.LedgerID,
                        BranchID = request.BranchID,
                        FinancialYearID = request.FinancialYearID,
                        OpeningBalance = safeBal,
                        OpeningBalanceType = safeType,
                        Remarks = item.Remarks,
                        CreatedOn = DateTime.UtcNow,
                        CreatedBy = 1
                    };
                    _context.BranchLedgerOpeningBalances.Add(newRecord);
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true, message = "शाखानिहाय ओपनिंग बॅलन्स यशस्वीरित्या सेव्ह करण्यात आले." });
        }

        // GET: api/BranchLedgerOpeningBalances/split-summary
        [HttpGet("split-summary")]
        public async Task<IActionResult> GetSplitSummary([FromQuery] int? financialYearId = null)
        {
            int activeFyId = financialYearId ?? (await _context.FinancialYears
                .Where(fy => fy.IsActive)
                .Select(fy => fy.FinancialYearID)
                .FirstOrDefaultAsync());

            if (activeFyId == 0)
            {
                activeFyId = await _context.FinancialYears
                    .OrderByDescending(fy => fy.FinancialYearID)
                    .Select(fy => fy.FinancialYearID)
                    .FirstOrDefaultAsync();
            }

            var branches = await _context.Branches.AsNoTracking().Where(b => b.IsActive).ToListAsync();
            var branchBalances = await _context.BranchLedgerOpeningBalances
                .AsNoTracking()
                .Where(b => b.FinancialYearID == activeFyId && b.OpeningBalance > 0)
                .ToListAsync();

            var activeLedgerIds = branchBalances.Select(b => b.LedgerID).Distinct().ToList();

            var ledgers = await _context.Ledgers
                .AsNoTracking()
                .Where(l => activeLedgerIds.Contains(l.LedgerID) || l.OpeningBalance > 0)
                .Include(l => l.AccountGroup)
                .ToListAsync();

            var summary = ledgers.Select(l =>
            {
                var perBranch = branches.Select(br =>
                {
                    var row = branchBalances.FirstOrDefault(b => b.LedgerID == l.LedgerID && b.BranchID == br.BranchID);
                    return new
                    {
                        br.BranchID,
                        br.BranchName,
                        br.BranchType,
                        OpeningBalance = row?.OpeningBalance ?? 0,
                        OpeningBalanceType = row?.OpeningBalanceType ?? "Dr"
                    };
                }).ToList();

                decimal totalDr = perBranch.Where(b => b.OpeningBalanceType == "Dr").Sum(b => b.OpeningBalance);
                decimal totalCr = perBranch.Where(b => b.OpeningBalanceType == "Cr").Sum(b => b.OpeningBalance);

                return new
                {
                    l.LedgerID,
                    l.LedgerCode,
                    l.LedgerName,
                    GroupName = l.AccountGroup?.GroupName ?? "",
                    Branches = perBranch,
                    TotalDr = totalDr,
                    TotalCr = totalCr,
                    LegacyMasterBalance = l.OpeningBalance,
                    LegacyMasterType = l.OpeningBalanceType
                };
            }).ToList();

            return Ok(summary);
        }
    }
}
