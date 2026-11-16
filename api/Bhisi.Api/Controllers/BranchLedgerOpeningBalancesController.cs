using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Helpers;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [EnforceBranchScope]
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
            public string AccountNature { get; set; } = string.Empty;
            public decimal MasterOpeningBalance { get; set; } = 0;
            public string MasterOpeningBalanceType { get; set; } = "Dr";
            public int BranchID { get; set; }
            public int FinancialYearID { get; set; }
            public decimal OpeningBalance { get; set; }
            public string OpeningBalanceType { get; set; } = "Dr"; // Dr or Cr
            public string? Remarks { get; set; }
            public int? BranchLedgerOpeningBalanceID { get; set; }
            public bool HasUnmigratedLegacyBalance { get; set; }
        }

        public class BulkSaveOpeningBalanceRequest
        {
            public int BranchID { get; set; }
            public int FinancialYearID { get; set; }
            public bool RequireBalanced { get; set; } = false;
            public List<BranchLedgerOpeningDto> Items { get; set; } = new();
            public List<BranchLedgerOpeningDto> Entries { get; set; } = new();
        }

        public class MigrateHoLegacyRequest
        {
            public int? FinancialYearID { get; set; }
            public bool OverwriteExisting { get; set; } = false;
            public bool ClearLegacyMasterBalances { get; set; } = true;
            public bool AllowUnbalancedClear { get; set; } = false;
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
            if (!User.CanAccessBranch(branchId))
            {
                return Forbid();
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
                bool hasUnmigratedLegacy = false;

                if (existing != null)
                {
                    balance = existing.OpeningBalance;
                    balType = existing.OpeningBalanceType;
                    existingId = existing.BranchLedgerOpeningBalanceID;
                    remarks = existing.Remarks;
                    hasUnmigratedLegacy = isHo && l.OpeningBalance > 0 && existing.OpeningBalance <= 0;
                }
                else if (isHo && l.OpeningBalance > 0)
                {
                    // Flag legacy master balance explicitly instead of masquerading as saved BranchLedgerOpeningBalance
                    hasUnmigratedLegacy = true;
                }

                return new BranchLedgerOpeningDto
                {
                    LedgerID = l.LedgerID,
                    LedgerCode = l.LedgerCode,
                    LedgerName = l.LedgerName,
                    GroupID = l.GroupID,
                    GroupName = l.AccountGroup?.GroupName ?? "",
                    NatureOfGroup = l.AccountGroup?.NatureOfGroup ?? "",
                    AccountNature = l.AccountGroup?.NatureOfGroup ?? "",
                    MasterOpeningBalance = l.OpeningBalance,
                    MasterOpeningBalanceType = !string.IsNullOrEmpty(l.OpeningBalanceType) ? l.OpeningBalanceType : "Dr",
                    BranchID = branchId,
                    FinancialYearID = activeFyId,
                    OpeningBalance = balance,
                    OpeningBalanceType = balType,
                    Remarks = remarks,
                    BranchLedgerOpeningBalanceID = existingId,
                    HasUnmigratedLegacyBalance = hasUnmigratedLegacy
                };
            }).ToList();

            return Ok(result);
        }

        // POST: api/BranchLedgerOpeningBalances/bulk
        [HttpPost("bulk")]
        [Authorize(Roles = "Admin,SuperAdmin,Manager,BranchManager,HO_Manager,HeadOffice,GeneralManager,CEO,Chairman,SystemAdmin")]
        public async Task<IActionResult> BulkSaveOpeningBalances([FromBody] BulkSaveOpeningBalanceRequest request)
        {
            if (request == null || request.BranchID <= 0 || request.FinancialYearID <= 0)
            {
                return BadRequest("अवैध विनंती. शाखा आणि आर्थिक वर्ष आवश्यक आहे.");
            }

            if (!User.CanAccessBranch(request.BranchID))
            {
                return Forbid();
            }

            var existingRows = await _context.BranchLedgerOpeningBalances
                .Where(b => b.BranchID == request.BranchID && b.FinancialYearID == request.FinancialYearID)
                .ToListAsync();

            var existingMap = existingRows.ToDictionary(r => r.LedgerID, r => r);

            // Compute effective full-branch Dr/Cr tally including unmodified existing rows + incoming changes
            var effectiveBalances = existingRows.ToDictionary(
                r => r.LedgerID,
                r => (Amount: r.OpeningBalance, Type: string.Equals(r.OpeningBalanceType, "Cr", StringComparison.OrdinalIgnoreCase) ? "Cr" : "Dr"));

            var itemsToSave = (request.Items != null && request.Items.Count > 0) ? request.Items : (request.Entries ?? new List<BranchLedgerOpeningDto>());
            int actorUserId = User.GetUserId();
            int safeUserId = actorUserId > 0 ? actorUserId : 1;

            foreach (var item in itemsToSave)
            {
                if (item.LedgerID <= 0) continue;

                decimal safeBal = Math.Max(0, Math.Round(item.OpeningBalance, 2));
                string safeType = string.Equals(item.OpeningBalanceType, "Cr", StringComparison.OrdinalIgnoreCase) ? "Cr" : "Dr";
                effectiveBalances[item.LedgerID] = (safeBal, safeType);

                if (existingMap.TryGetValue(item.LedgerID, out var existing))
                {
                    existing.OpeningBalance = safeBal;
                    existing.OpeningBalanceType = safeType;
                    existing.Remarks = item.Remarks;
                    existing.UpdatedOn = DateTime.UtcNow;
                    existing.UpdatedBy = safeUserId;
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
                        CreatedBy = safeUserId
                    };
                    _context.BranchLedgerOpeningBalances.Add(newRecord);
                }
            }

            decimal totalDr = Math.Round(effectiveBalances.Values.Where(v => v.Type == "Dr").Sum(v => v.Amount), 2);
            decimal totalCr = Math.Round(effectiveBalances.Values.Where(v => v.Type == "Cr").Sum(v => v.Amount), 2);
            decimal diff = Math.Round(Math.Abs(totalDr - totalCr), 2);
            bool isBalanced = diff < 0.01m;

            if (request.RequireBalanced && !isBalanced)
            {
                return BadRequest($"शाखेचा ओपनिंग बॅलन्स ताळेबंद (Dr == Cr) जुळत नाही. एकूण नावे (Dr): ₹{totalDr:N2}, एकूण जमा (Cr): ₹{totalCr:N2}, तफावत: ₹{diff:N2}");
            }

            await _context.SaveChangesAsync();
            return Ok(new
            {
                success = true,
                message = isBalanced
                    ? "शाखानिहाय ओपनिंग बॅलन्स यशस्वीरित्या सेव्ह करण्यात आले (ताळेबंद संतुलित)."
                    : $"शाखानिहाय ओपनिंग बॅलन्स सेव्ह करण्यात आले, मात्र Dr व Cr मध्ये ₹{diff:N2} ची तफावत आहे.",
                totalDr,
                totalCr,
                difference = diff,
                isBalanced
            });
        }

        // GET: api/BranchLedgerOpeningBalances/legacy-migration-status
        [HttpGet("legacy-migration-status")]
        public async Task<IActionResult> GetLegacyMigrationStatus([FromQuery] int? financialYearId = null)
        {
            if (!User.IsHeadOfficeAdmin())
            {
                return Forbid();
            }

            int hoBranchId = await BranchLedgerBalanceHelper.GetHeadOfficeBranchIdAsync(_context);
            int targetFyId = financialYearId.HasValue && financialYearId.Value > 0
                ? financialYearId.Value
                : await BranchLedgerBalanceHelper.GetInitialFinancialYearIdAsync(_context);

            var legacyLedgers = await _context.Ledgers
                .AsNoTracking()
                .Include(l => l.AccountGroup)
                .Where(l => l.OpeningBalance > 0)
                .OrderBy(l => l.LedgerID)
                .ToListAsync();

            var hoRows = await _context.BranchLedgerOpeningBalances
                .AsNoTracking()
                .Where(b => b.BranchID == hoBranchId && (targetFyId == 0 || b.FinancialYearID == targetFyId))
                .ToDictionaryAsync(b => b.LedgerID, b => b);

            var items = legacyLedgers.Select(l =>
            {
                hoRows.TryGetValue(l.LedgerID, out var hoRow);
                return new
                {
                    l.LedgerID,
                    l.LedgerCode,
                    l.LedgerName,
                    GroupName = l.AccountGroup?.GroupName ?? "",
                    LegacyOpeningBalance = l.OpeningBalance,
                    LegacyOpeningBalanceType = !string.IsNullOrEmpty(l.OpeningBalanceType) ? l.OpeningBalanceType : "Dr",
                    HoBranchOpeningBalance = hoRow?.OpeningBalance ?? 0m,
                    HoBranchOpeningBalanceType = hoRow?.OpeningBalanceType ?? "Dr",
                    HasHoRow = hoRow != null && hoRow.OpeningBalance > 0m
                };
            }).ToList();

            decimal legacyDr = legacyLedgers.Where(l => !string.Equals(l.OpeningBalanceType, "Cr", StringComparison.OrdinalIgnoreCase)).Sum(l => l.OpeningBalance);
            decimal legacyCr = legacyLedgers.Where(l => string.Equals(l.OpeningBalanceType, "Cr", StringComparison.OrdinalIgnoreCase)).Sum(l => l.OpeningBalance);
            var hoTally = targetFyId > 0
                ? await BranchLedgerBalanceHelper.GetBranchOpeningTallySummaryAsync(_context, hoBranchId, targetFyId)
                : (TotalDr: 0m, TotalCr: 0m, Difference: 0m, IsBalanced: true);

            return Ok(new
            {
                hoBranchId,
                targetFinancialYearId = targetFyId,
                legacyLedgerCount = items.Count,
                pendingMigrationCount = items.Count(i => !i.HasHoRow),
                legacyTotalDr = Math.Round(legacyDr, 2),
                legacyTotalCr = Math.Round(legacyCr, 2),
                hoCurrentTally = new
                {
                    hoTally.TotalDr,
                    hoTally.TotalCr,
                    hoTally.Difference,
                    hoTally.IsBalanced
                },
                items
            });
        }

        // POST: api/BranchLedgerOpeningBalances/migrate-ho-legacy
        [HttpPost("migrate-ho-legacy")]
        [Authorize(Roles = "Admin,SuperAdmin,HO_Manager,HeadOffice,GeneralManager,CEO,Chairman,SystemAdmin")]
        public async Task<IActionResult> MigrateHoLegacyOpeningBalances([FromBody] MigrateHoLegacyRequest? request = null)
        {
            if (!User.IsHeadOfficeAdmin())
            {
                return Forbid();
            }

            request ??= new MigrateHoLegacyRequest();
            int hoBranchId = await BranchLedgerBalanceHelper.GetHeadOfficeBranchIdAsync(_context);
            int targetFyId = request.FinancialYearID.HasValue && request.FinancialYearID.Value > 0
                ? request.FinancialYearID.Value
                : await BranchLedgerBalanceHelper.GetInitialFinancialYearIdAsync(_context);

            if (targetFyId <= 0)
            {
                return BadRequest("आर्थिक वर्ष उपलब्ध नाही.");
            }

            var legacyLedgers = await _context.Ledgers
                .Where(l => l.OpeningBalance > 0)
                .ToListAsync();

            var existingHoRows = await _context.BranchLedgerOpeningBalances
                .Where(b => b.BranchID == hoBranchId && b.FinancialYearID == targetFyId)
                .ToDictionaryAsync(b => b.LedgerID, b => b);

            int actorUserId = User.GetUserId();
            int safeUserId = actorUserId > 0 ? actorUserId : 1;
            int migratedCount = 0;

            foreach (var l in legacyLedgers)
            {
                string safeType = string.Equals(l.OpeningBalanceType, "Cr", StringComparison.OrdinalIgnoreCase) ? "Cr" : "Dr";
                decimal safeBal = Math.Round(l.OpeningBalance, 2);

                if (existingHoRows.TryGetValue(l.LedgerID, out var existing))
                {
                    if (request.OverwriteExisting || existing.OpeningBalance <= 0m)
                    {
                        existing.OpeningBalance = safeBal;
                        existing.OpeningBalanceType = safeType;
                        existing.Remarks = "HO Legacy Master OB Migration";
                        existing.UpdatedOn = DateTime.UtcNow;
                        existing.UpdatedBy = safeUserId;
                        migratedCount++;
                    }
                }
                else
                {
                    var newRow = new BranchLedgerOpeningBalance
                    {
                        BranchID = hoBranchId,
                        LedgerID = l.LedgerID,
                        FinancialYearID = targetFyId,
                        OpeningBalance = safeBal,
                        OpeningBalanceType = safeType,
                        Remarks = "HO Legacy Master OB Migration",
                        CreatedOn = DateTime.UtcNow,
                        CreatedBy = safeUserId
                    };
                    _context.BranchLedgerOpeningBalances.Add(newRow);
                    existingHoRows[l.LedgerID] = newRow;
                    migratedCount++;
                }
            }

            decimal totalDr = Math.Round(existingHoRows.Values.Where(v => string.Equals(v.OpeningBalanceType, "Dr", StringComparison.OrdinalIgnoreCase)).Sum(v => v.OpeningBalance), 2);
            decimal totalCr = Math.Round(existingHoRows.Values.Where(v => string.Equals(v.OpeningBalanceType, "Cr", StringComparison.OrdinalIgnoreCase)).Sum(v => v.OpeningBalance), 2);
            decimal diff = Math.Round(Math.Abs(totalDr - totalCr), 2);
            bool isBalanced = diff < 0.01m;

            bool clearedLegacy = false;
            if (request.ClearLegacyMasterBalances && (isBalanced || request.AllowUnbalancedClear))
            {
                foreach (var l in legacyLedgers)
                {
                    l.OpeningBalance = 0m;
                }
                clearedLegacy = true;
            }

            _context.AuditLogs.Add(new AuditLog
            {
                UserID = actorUserId > 0 ? actorUserId : null,
                Username = User.GetUsername() ?? $"User_{safeUserId}",
                Action = "MIGRATE_HO_LEGACY_OB",
                EntityName = "BranchLedgerOpeningBalance",
                EntityID = $"Branch:{hoBranchId}|FY:{targetFyId}",
                Details = $"Migrated {migratedCount} legacy ledger OBs to Branch {hoBranchId} FY {targetFyId}. HO Tally Dr={totalDr:N2}, Cr={totalCr:N2}, Diff={diff:N2}, ClearedMasterOB={clearedLegacy}.",
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                hoBranchId,
                targetFinancialYearId = targetFyId,
                migratedCount,
                clearedLegacyMasterBalances = clearedLegacy,
                totalDr,
                totalCr,
                difference = diff,
                isBalanced,
                message = clearedLegacy
                    ? $"HO चे {migratedCount} लेजर ओपनिंग बॅलन्स BranchLedgerOpeningBalances मध्ये स्थलांतरित केले आणि जुने Ledgers.OpeningBalance शून्य केले."
                    : $"HO चे {migratedCount} लेजर ओपनिंग बॅलन्स स्थलांतरित केले. ताळेबंद तफावत (₹{diff:N2}) असल्यामुळे जुने Ledgers.OpeningBalance राखून ठेवले आहेत."
            });
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

            int? scopedBranch = User.ResolveOptionalBranchId(null);
            var branchesQuery = _context.Branches.AsNoTracking().Where(b => b.IsActive);
            if (scopedBranch.HasValue && scopedBranch.Value > 0)
            {
                branchesQuery = branchesQuery.Where(b => b.BranchID == scopedBranch.Value);
            }
            var branches = await branchesQuery.ToListAsync();

            var branchObsQuery = _context.BranchLedgerOpeningBalances
                .AsNoTracking()
                .Where(b => b.FinancialYearID == activeFyId && b.OpeningBalance > 0);
            if (scopedBranch.HasValue && scopedBranch.Value > 0)
            {
                branchObsQuery = branchObsQuery.Where(b => b.BranchID == scopedBranch.Value);
            }
            var branchBalances = await branchObsQuery.ToListAsync();

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
