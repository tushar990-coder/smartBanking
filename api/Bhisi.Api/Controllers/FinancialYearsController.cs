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
    [AllowAnonymous]
    public class FinancialYearsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public FinancialYearsController(AppDbContext context)
        {
            _context = context;
        }

        public class CarryForwardRequestDto
        {
            public int? TargetFinancialYearID { get; set; }
            public int? ProfitLossLedgerID { get; set; }
            public bool ActivateTargetYear { get; set; } = true;
            public bool CloseSourceYear { get; set; } = false;
        }

        public class ToggleLockRequestDto
        {
            public bool IsClosed { get; set; }
            public string? Reason { get; set; }
        }

        private static string NormalizeGroupNature(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return "";
            string s = raw.Trim().ToLowerInvariant();
            if (s.Contains("asset") || s.Contains("मालमत्ता") || s.Contains("येणे") || s.Contains("संपत्ती")) return "Assets";
            if (s.Contains("liabilit") || s.Contains("देयता") || s.Contains("देणे") || s.Contains("भांडवल") || s.Contains("capital") || s.Contains("निधी")) return "Liabilities";
            if (s.Contains("income") || s.Contains("revenue") || s.Contains("उत्पन्न") || s.Contains("जमा")) return "Income";
            if (s.Contains("expense") || s.Contains("expenditure") || s.Contains("खर्च") || s.Contains("नावे")) return "Expenses";
            return "";
        }

        private static string ResolveGroupRootNature(int groupId, List<AccountGroup> allGroups)
        {
            var currentGroup = allGroups.FirstOrDefault(g => g.GroupID == groupId);
            int guard = 0;
            while (currentGroup != null && guard++ < 25)
            {
                string n = NormalizeGroupNature(currentGroup.NatureOfGroup);
                if (!string.IsNullOrEmpty(n))
                {
                    return n;
                }
                if (currentGroup.ParentGroupID.HasValue)
                {
                    currentGroup = allGroups.FirstOrDefault(g => g.GroupID == currentGroup.ParentGroupID.Value);
                }
                else
                {
                    break;
                }
            }
            return "Assets";
        }

        private static bool IsOperationalVoucher(Voucher v)
        {
            if (v.VoucherType == "Opening" || v.VoucherType == "Opening Balance") return false;
            string vNo = v.VoucherNo ?? "";
            if (vNo.Contains("-OP-") ||
                vNo.Contains("-IMP-") ||
                vNo.StartsWith("JV-FD-OP-") ||
                vNo.StartsWith("REC-FD-OP-") ||
                vNo.StartsWith("JV-RD-OP-") ||
                vNo.StartsWith("REC-RD-OP-") ||
                vNo.StartsWith("JV-SH-OP-") ||
                vNo.StartsWith("JV-INV-OP-"))
            {
                return false;
            }
            string narr = v.Narration ?? "";
            if (narr.Contains("आरंभिक शिल्लक") ||
                narr.Contains("Opening Balance Migration") ||
                narr.Contains("Pigmy Chart Import") ||
                narr.Contains("Import"))
            {
                return false;
            }
            return true;
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<FinancialYear>>> GetFinancialYears()
        {
            try
            {
                var years = await _context.FinancialYears
                    .OrderByDescending(f => f.StartDate)
                    .ToListAsync();
                if (years.Count == 0)
                {
                    var defaultYear = new FinancialYear
                    {
                        YearCode = "2026-2027",
                        StartDate = new DateTime(2026, 4, 1),
                        EndDate = new DateTime(2027, 3, 31),
                        IsActive = true,
                        IsClosed = false
                    };
                    _context.FinancialYears.Add(defaultYear);
                    await _context.SaveChangesAsync();
                    years.Add(defaultYear);
                }
                return years;
            }
            catch
            {
                return Ok(new List<FinancialYear>
                {
                    new FinancialYear
                    {
                        FinancialYearID = 1,
                        YearCode = "2026-2027",
                        StartDate = new DateTime(2026, 4, 1),
                        EndDate = new DateTime(2027, 3, 31),
                        IsActive = true,
                        IsClosed = false
                    }
                });
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<FinancialYear>> GetFinancialYear(int id)
        {
            var financialYear = await _context.FinancialYears.FindAsync(id);

            if (financialYear == null)
            {
                return NotFound();
            }

            return financialYear;
        }

        // GET: api/FinancialYears/{id}/year-end-preview
        [HttpGet("{id}/year-end-preview")]
        public async Task<IActionResult> GetYearEndPreview(int id)
        {
            var sourceFy = await _context.FinancialYears.AsNoTracking().FirstOrDefaultAsync(f => f.FinancialYearID == id);
            if (sourceFy == null)
            {
                return NotFound("आर्थिक वर्ष सापडले नाही.");
            }

            DateTime fyStart = sourceFy.StartDate.Date;
            DateTime fyEnd = sourceFy.EndDate.Date;
            DateTime fyEndExclusive = fyEnd.AddDays(1);

            DateTime nextStart = fyEnd.AddDays(1);
            DateTime nextEnd = nextStart.AddYears(1).AddDays(-1);
            string nextYearCode = $"{nextStart.Year}-{nextEnd.Year}";

            var existingNextFy = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.YearCode == nextYearCode || (f.StartDate.Date == nextStart && f.EndDate.Date == nextEnd));

            var branches = await _context.Branches.AsNoTracking().Where(b => b.IsActive).ToListAsync();
            if (branches.Count == 0)
            {
                branches = await _context.Branches.AsNoTracking().ToListAsync();
            }

            var allGroups = await _context.AccountGroups.AsNoTracking().ToListAsync();
            var allLedgers = await _context.Ledgers.AsNoTracking().Where(l => l.IsActive).ToListAsync();

            var ledgerNatureMap = allLedgers.ToDictionary(
                l => l.LedgerID,
                l => ResolveGroupRootNature(l.GroupID, allGroups));

            // Candidate P&L / Reserve ledgers (Liabilities)
            var candidatePlLedgers = allLedgers
                .Where(l => ledgerNatureMap.TryGetValue(l.LedgerID, out var nat) && nat == "Liabilities")
                .OrderByDescending(l =>
                    l.LedgerName.Contains("नफा") ||
                    l.LedgerName.Contains("तोटा") ||
                    l.LedgerName.Contains("Profit", StringComparison.OrdinalIgnoreCase) ||
                    l.LedgerName.Contains("राखीव") ||
                    l.LedgerName.Contains("Reserve", StringComparison.OrdinalIgnoreCase))
                .ThenBy(l => l.LedgerID)
                .Select(l => new
                {
                    l.LedgerID,
                    l.LedgerCode,
                    l.LedgerName
                })
                .ToList();

            var defaultPlLedger = allLedgers.FirstOrDefault(l =>
                l.LedgerName.Contains("संचित नफा") ||
                l.LedgerName.Contains("चालू नफा") ||
                l.LedgerName.Contains("नफा-तोटा") ||
                l.LedgerName.Contains("नफा तोटा") ||
                l.LedgerName.Contains("Profit & Loss", StringComparison.OrdinalIgnoreCase) ||
                l.LedgerName.Contains("Profit and Loss", StringComparison.OrdinalIgnoreCase));

            // 1. Check pending operational vouchers in [fyStart, fyEndExclusive)
            var pendingVouchersInPeriod = await _context.Vouchers
                .AsNoTracking()
                .Where(v => v.Status == "Pending" && v.VoucherDate >= fyStart && v.VoucherDate < fyEndExclusive)
                .ToListAsync();

            int pendingOperationalCount = pendingVouchersInPeriod.Count(IsOperationalVoucher);

            // 2. Compute Income, Expense, Net Profit & Asset/Liability totals across branches
            var periodVoucherLines = await _context.VoucherDetails
                .AsNoTracking()
                .Include(vd => vd.Voucher)
                .Where(vd => vd.Voucher != null &&
                             (vd.Voucher.Status == "Approved" || vd.Voucher.Status == "Posted" || string.IsNullOrEmpty(vd.Voucher.Status)) &&
                             vd.Voucher.Status != "Rejected" &&
                             vd.Voucher.Status != "Cancelled" &&
                             vd.Voucher.VoucherDate >= fyStart &&
                             vd.Voucher.VoucherDate < fyEndExclusive)
                .Select(vd => new
                {
                    BranchID = vd.Voucher!.BranchID,
                    vd.LedgerID,
                    vd.DrCr,
                    vd.Amount
                })
                .ToListAsync();

            var sourceOpeningBalances = await _context.BranchLedgerOpeningBalances
                .AsNoTracking()
                .Where(b => b.FinancialYearID == sourceFy.FinancialYearID)
                .ToListAsync();

            decimal totalIncome = 0m;
            decimal totalExpense = 0m;
            int carriedLedgerCount = 0;

            foreach (var ledger in allLedgers)
            {
                string nat = ledgerNatureMap[ledger.LedgerID];
                decimal lDr = periodVoucherLines.Where(x => x.LedgerID == ledger.LedgerID && x.DrCr == "Dr").Sum(x => x.Amount);
                decimal lCr = periodVoucherLines.Where(x => x.LedgerID == ledger.LedgerID && x.DrCr == "Cr").Sum(x => x.Amount);

                if (nat == "Income")
                {
                    totalIncome += (lCr - lDr);
                }
                else if (nat == "Expenses")
                {
                    totalExpense += (lDr - lCr);
                }
                else
                {
                    var obRows = sourceOpeningBalances.Where(b => b.LedgerID == ledger.LedgerID).ToList();
                    decimal obDr = obRows.Where(x => x.OpeningBalanceType == "Dr").Sum(x => x.OpeningBalance);
                    decimal obCr = obRows.Where(x => x.OpeningBalanceType == "Cr").Sum(x => x.OpeningBalance);
                    if (obRows.Count == 0 && ledger.OpeningBalance > 0)
                    {
                        if (ledger.OpeningBalanceType == "Cr") obCr += ledger.OpeningBalance;
                        else obDr += ledger.OpeningBalance;
                    }
                    if (Math.Abs((obDr + lDr) - (obCr + lCr)) >= 0.01m)
                    {
                        carriedLedgerCount++;
                    }
                }
            }

            decimal netProfit = totalIncome - totalExpense;

            return Ok(new
            {
                SourceFinancialYearID = sourceFy.FinancialYearID,
                SourceYearCode = sourceFy.YearCode,
                SourceStartDate = fyStart,
                SourceEndDate = fyEnd,
                IsSourceClosed = sourceFy.IsClosed,
                NextFinancialYearID = existingNextFy?.FinancialYearID,
                NextYearCode = existingNextFy?.YearCode ?? nextYearCode,
                NextStartDate = existingNextFy?.StartDate.Date ?? nextStart,
                NextEndDate = existingNextFy?.EndDate.Date ?? nextEnd,
                NextYearAlreadyExists = existingNextFy != null,
                PendingVouchersCount = pendingOperationalCount,
                TotalBranches = branches.Count,
                CarriedLedgerCount = carriedLedgerCount,
                TotalIncome = Math.Round(totalIncome, 2),
                TotalExpense = Math.Round(totalExpense, 2),
                NetProfit = Math.Round(netProfit, 2),
                DefaultProfitLossLedgerID = defaultPlLedger?.LedgerID ?? 0,
                DefaultProfitLossLedgerName = defaultPlLedger?.LedgerName ?? "संचित नफा-तोटा खाते (स्वयं-निर्मित)",
                CandidateProfitLossLedgers = candidatePlLedgers
            });
        }

        // POST: api/FinancialYears/{id}/carry-forward
        [HttpPost("{id}/carry-forward")]
        public async Task<IActionResult> CarryForwardBalances(int id, [FromBody] CarryForwardRequestDto? request)
        {
            request ??= new CarryForwardRequestDto();

            var sourceFy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.FinancialYearID == id);
            if (sourceFy == null)
            {
                return NotFound(new { message = "स्रोत आर्थिक वर्ष सापडले नाही." });
            }

            DateTime fyStart = sourceFy.StartDate.Date;
            DateTime fyEnd = sourceFy.EndDate.Date;
            DateTime fyEndExclusive = fyEnd.AddDays(1);

            // 1. Ensure 0 pending operational vouchers in the source financial year
            var pendingVouchers = await _context.Vouchers
                .AsNoTracking()
                .Where(v => v.Status == "Pending" && v.VoucherDate >= fyStart && v.VoucherDate < fyEndExclusive)
                .ToListAsync();

            int pendingCount = pendingVouchers.Count(IsOperationalVoucher);
            if (pendingCount > 0)
            {
                return BadRequest(new
                {
                    message = $"आर्थिक वर्ष {sourceFy.YearCode} मध्ये {pendingCount} प्रलंबित (Pending) व्हाउचर्स आहेत. कृपया वार्षिक शिल्लक पुढे ओढण्यापूर्वी सर्व प्रलंबित व्हाउचर्स पास किंवा डिलीट करा."
                });
            }

            // 2. Resolve or create target next Financial Year
            DateTime nextStart = fyEnd.AddDays(1);
            DateTime nextEnd = nextStart.AddYears(1).AddDays(-1);
            string nextYearCode = $"{nextStart.Year}-{nextEnd.Year}";

            FinancialYear? targetFy = null;
            if (request.TargetFinancialYearID.HasValue && request.TargetFinancialYearID.Value > 0)
            {
                targetFy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.FinancialYearID == request.TargetFinancialYearID.Value);
            }
            if (targetFy == null)
            {
                targetFy = await _context.FinancialYears
                    .FirstOrDefaultAsync(f => f.YearCode == nextYearCode || (f.StartDate.Date == nextStart && f.EndDate.Date == nextEnd));
            }
            if (targetFy == null)
            {
                targetFy = new FinancialYear
                {
                    YearCode = nextYearCode,
                    StartDate = nextStart,
                    EndDate = nextEnd,
                    IsActive = false,
                    IsClosed = false
                };
                _context.FinancialYears.Add(targetFy);
                await _context.SaveChangesAsync();
            }

            if (targetFy.IsClosed)
            {
                return BadRequest(new
                {
                    message = $"पुढील आर्थिक वर्ष ({targetFy.YearCode}) सध्या लॉक (Closed) आहे. त्यामध्ये शिल्लक ट्रान्सफर करण्यासाठी प्रथम ते अनलॉक करा."
                });
            }

            // 3. Resolve or auto-create the Profit & Loss Appropriation Ledger under Liabilities
            var allGroups = await _context.AccountGroups.AsNoTracking().ToListAsync();
            var allLedgers = await _context.Ledgers.Where(l => l.IsActive).ToListAsync();

            Ledger? plLedger = null;
            if (request.ProfitLossLedgerID.HasValue && request.ProfitLossLedgerID.Value > 0)
            {
                plLedger = allLedgers.FirstOrDefault(l => l.LedgerID == request.ProfitLossLedgerID.Value);
            }
            if (plLedger == null)
            {
                plLedger = allLedgers.FirstOrDefault(l =>
                    l.LedgerName.Contains("संचित नफा") ||
                    l.LedgerName.Contains("चालू नफा") ||
                    l.LedgerName.Contains("नफा-तोटा") ||
                    l.LedgerName.Contains("नफा तोटा") ||
                    l.LedgerName.Contains("Profit & Loss", StringComparison.OrdinalIgnoreCase) ||
                    l.LedgerName.Contains("Profit and Loss", StringComparison.OrdinalIgnoreCase));
            }
            if (plLedger == null)
            {
                var liabilityGroup = allGroups.FirstOrDefault(g =>
                    NormalizeGroupNature(g.NatureOfGroup) == "Liabilities" &&
                    (g.GroupName.Contains("नफा") || g.GroupName.Contains("राखीव") || g.GroupName.Contains("निधी") || g.GroupName.Contains("Reserve", StringComparison.OrdinalIgnoreCase)))
                    ?? allGroups.FirstOrDefault(g => NormalizeGroupNature(g.NatureOfGroup) == "Liabilities")
                    ?? allGroups.First();

                plLedger = new Ledger
                {
                    LedgerName = "संचित नफा-तोटा खाते (Profit & Loss A/c)",
                    LedgerCode = "PL-RESERVE",
                    GroupID = liabilityGroup.GroupID,
                    OpeningBalance = 0m,
                    OpeningBalanceType = "Cr",
                    IsActive = true
                };
                _context.Ledgers.Add(plLedger);
                await _context.SaveChangesAsync();
                allLedgers.Add(plLedger);
            }

            var ledgerNatureMap = allLedgers.ToDictionary(
                l => l.LedgerID,
                l => ResolveGroupRootNature(l.GroupID, allGroups));

            var branches = await _context.Branches.AsNoTracking().Where(b => b.IsActive).ToListAsync();
            if (branches.Count == 0)
            {
                branches = await _context.Branches.AsNoTracking().ToListAsync();
            }

            var sourceObsAll = await _context.BranchLedgerOpeningBalances
                .AsNoTracking()
                .Where(b => b.FinancialYearID == sourceFy.FinancialYearID)
                .ToListAsync();

            var targetObsAll = await _context.BranchLedgerOpeningBalances
                .Where(b => b.FinancialYearID == targetFy.FinancialYearID)
                .ToListAsync();

            var periodLines = await _context.VoucherDetails
                .AsNoTracking()
                .Include(vd => vd.Voucher)
                .Where(vd => vd.Voucher != null &&
                             (vd.Voucher.Status == "Approved" || vd.Voucher.Status == "Posted" || string.IsNullOrEmpty(vd.Voucher.Status)) &&
                             vd.Voucher.Status != "Rejected" &&
                             vd.Voucher.Status != "Cancelled" &&
                             vd.Voucher.VoucherDate >= fyStart &&
                             vd.Voucher.VoucherDate < fyEndExclusive)
                .Select(vd => new
                {
                    BranchID = vd.Voucher!.BranchID,
                    vd.LedgerID,
                    vd.DrCr,
                    vd.Amount
                })
                .ToListAsync();

            int updatedRecordsCount = 0;

            foreach (var branch in branches)
            {
                int bId = branch.BranchID;
                bool isHoBranch = string.Equals(branch.BranchType, "HeadOffice", StringComparison.OrdinalIgnoreCase) || bId == 1;

                var branchSourceObs = sourceObsAll
                    .Where(b => b.BranchID == bId)
                    .GroupBy(b => b.LedgerID)
                    .ToDictionary(g => g.Key, g => g.First());

                var branchTargetObs = targetObsAll
                    .Where(b => b.BranchID == bId)
                    .GroupBy(b => b.LedgerID)
                    .ToDictionary(g => g.Key, g => g.First());

                var branchLinesByLedger = periodLines
                    .Where(x => x.BranchID == bId)
                    .GroupBy(x => x.LedgerID)
                    .ToDictionary(
                        g => g.Key,
                        g => (
                            Dr: g.Where(x => x.DrCr == "Dr").Sum(x => x.Amount),
                            Cr: g.Where(x => x.DrCr == "Cr").Sum(x => x.Amount)
                        ));

                // Accumulate Net Profit/Loss for this branch: positive = Net Profit (Cr), negative = Net Loss (Dr)
                decimal branchNetProfitCr = 0m;
                decimal plOwnClosingNetDr = 0m; // positive = Dr, negative = Cr

                foreach (var ledger in allLedgers)
                {
                    decimal obDr = 0m;
                    decimal obCr = 0m;

                    if (branchSourceObs.TryGetValue(ledger.LedgerID, out var srcOb))
                    {
                        if (srcOb.OpeningBalanceType == "Cr") obCr = srcOb.OpeningBalance;
                        else obDr = srcOb.OpeningBalance;
                    }
                    else if (isHoBranch && ledger.OpeningBalance > 0)
                    {
                        if (ledger.OpeningBalanceType == "Cr") obCr = ledger.OpeningBalance;
                        else obDr = ledger.OpeningBalance;
                    }

                    decimal periodDr = 0m;
                    decimal periodCr = 0m;
                    if (branchLinesByLedger.TryGetValue(ledger.LedgerID, out var pTotals))
                    {
                        periodDr = pTotals.Dr;
                        periodCr = pTotals.Cr;
                    }

                    // Net balance where positive = Dr, negative = Cr
                    decimal closingNetDr = (obDr + periodDr) - (obCr + periodCr);
                    string rootNature = ledgerNatureMap[ledger.LedgerID];

                    if (ledger.LedgerID == plLedger.LedgerID)
                    {
                        plOwnClosingNetDr = closingNetDr;
                        continue;
                    }

                    if (rootNature == "Income" || rootNature == "Expenses")
                    {
                        // Income/Expense ledgers reset to 0 in the new FY, and their balance transfers to P&L ledger
                        // Note: if closingNetDr < 0 (Cr > Dr), that adds to Net Profit (Cr); if closingNetDr > 0 (Dr > Cr), that reduces Net Profit
                        branchNetProfitCr += (-closingNetDr);

                        if (branchTargetObs.TryGetValue(ledger.LedgerID, out var existingIncomeExpenseTarget))
                        {
                            existingIncomeExpenseTarget.OpeningBalance = 0m;
                            existingIncomeExpenseTarget.OpeningBalanceType = rootNature == "Income" ? "Cr" : "Dr";
                            existingIncomeExpenseTarget.Remarks = $"FY {sourceFy.YearCode} -> {targetFy.YearCode} (Income/Expense Reset)";
                            existingIncomeExpenseTarget.UpdatedOn = DateTime.UtcNow;
                        }
                    }
                    else
                    {
                        // Asset / Liability ledger -> Carry forward closing balance as new Opening Balance
                        decimal newObAmount = Math.Round(Math.Abs(closingNetDr), 2);
                        string newObType = closingNetDr >= 0m ? "Dr" : "Cr";
                        bool hadPriorOrLegacyBalance = branchSourceObs.ContainsKey(ledger.LedgerID) || (isHoBranch && ledger.OpeningBalance > 0);

                        if (branchTargetObs.TryGetValue(ledger.LedgerID, out var existingTarget))
                        {
                            existingTarget.OpeningBalance = newObAmount;
                            existingTarget.OpeningBalanceType = newObType;
                            existingTarget.Remarks = $"Carried forward from FY {sourceFy.YearCode}";
                            existingTarget.UpdatedOn = DateTime.UtcNow;
                            updatedRecordsCount++;
                        }
                        else if (newObAmount >= 0.01m || hadPriorOrLegacyBalance)
                        {
                            _context.BranchLedgerOpeningBalances.Add(new BranchLedgerOpeningBalance
                            {
                                BranchID = bId,
                                FinancialYearID = targetFy.FinancialYearID,
                                LedgerID = ledger.LedgerID,
                                OpeningBalance = newObAmount,
                                OpeningBalanceType = newObType,
                                Remarks = $"Carried forward from FY {sourceFy.YearCode}",
                                CreatedOn = DateTime.UtcNow
                            });
                            updatedRecordsCount++;
                        }
                    }
                }

                // Now save the combined P&L Ledger Opening Balance for this branch
                // plOwnClosingNetDr (positive = Dr, negative = Cr) combined with branchNetProfitCr (positive = Cr, negative = Dr)
                decimal plFinalNetDr = plOwnClosingNetDr - branchNetProfitCr;
                decimal plFinalAmount = Math.Round(Math.Abs(plFinalNetDr), 2);
                string plFinalType = plFinalNetDr > 0m ? "Dr" : "Cr";

                if (branchTargetObs.TryGetValue(plLedger.LedgerID, out var existingPlTarget))
                {
                    existingPlTarget.OpeningBalance = plFinalAmount;
                    existingPlTarget.OpeningBalanceType = plFinalType;
                    existingPlTarget.Remarks = $"Includes Net P&L (₹{Math.Round(branchNetProfitCr, 2):N2}) from FY {sourceFy.YearCode}";
                    existingPlTarget.UpdatedOn = DateTime.UtcNow;
                    updatedRecordsCount++;
                }
                else if (plFinalAmount >= 0.01m)
                {
                    _context.BranchLedgerOpeningBalances.Add(new BranchLedgerOpeningBalance
                    {
                        BranchID = bId,
                        FinancialYearID = targetFy.FinancialYearID,
                        LedgerID = plLedger.LedgerID,
                        OpeningBalance = plFinalAmount,
                        OpeningBalanceType = plFinalType,
                        Remarks = $"Includes Net P&L (₹{Math.Round(branchNetProfitCr, 2):N2}) from FY {sourceFy.YearCode}",
                        CreatedOn = DateTime.UtcNow
                    });
                    updatedRecordsCount++;
                }
            }

            if (request.ActivateTargetYear)
            {
                var allYears = await _context.FinancialYears.ToListAsync();
                foreach (var fy in allYears)
                {
                    fy.IsActive = (fy.FinancialYearID == targetFy.FinancialYearID);
                }
            }

            if (request.CloseSourceYear)
            {
                sourceFy.IsClosed = true;
            }

            int userId = User.GetUserId();
            string username = User.GetUsername() ?? (userId > 0 ? $"User_{userId}" : "Admin");

            _context.AuditLogs.Add(new AuditLog
            {
                UserID = userId > 0 ? userId : null,
                Username = username,
                Action = "YEAR_END_CARRY_FORWARD",
                EntityName = "FinancialYear",
                EntityID = $"{sourceFy.YearCode}->{targetFy.YearCode}",
                Timestamp = DateTime.Now,
                Details = $"Carried forward closing balances from FY {sourceFy.YearCode} to FY {targetFy.YearCode} across {branches.Count} branches ({updatedRecordsCount} ledger records). P&L Ledger: {plLedger.LedgerName}."
            });

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"आर्थिक वर्ष {sourceFy.YearCode} ची ३१ मार्चची अखेरची शिल्लक आणि नफा-तोटा पुढील आर्थिक वर्ष {targetFy.YearCode} मध्ये यशस्वीरित्या पुढे ओढण्यात (Carry Forward) आली आहे!",
                sourceYearCode = sourceFy.YearCode,
                targetFinancialYearID = targetFy.FinancialYearID,
                targetYearCode = targetFy.YearCode,
                updatedRecordsCount,
                profitLossLedgerName = plLedger.LedgerName
            });
        }

        // POST: api/FinancialYears/{id}/toggle-lock
        [HttpPost("{id}/toggle-lock")]
        public async Task<IActionResult> ToggleFinancialYearLock(int id, [FromBody] ToggleLockRequestDto? request)
        {
            var fy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.FinancialYearID == id);
            if (fy == null)
            {
                return NotFound(new { message = "आर्थिक वर्ष सापडले नाही." });
            }

            bool targetClosedState = request?.IsClosed ?? !fy.IsClosed;

            if (targetClosedState)
            {
                DateTime fyStart = fy.StartDate.Date;
                DateTime fyEndExclusive = fy.EndDate.Date.AddDays(1);

                var pendingInFy = await _context.Vouchers
                    .AsNoTracking()
                    .Where(v => v.Status == "Pending" && v.VoucherDate >= fyStart && v.VoucherDate < fyEndExclusive)
                    .ToListAsync();

                int pendingOperational = pendingInFy.Count(IsOperationalVoucher);
                if (pendingOperational > 0)
                {
                    return BadRequest(new
                    {
                        message = $"आर्थिक वर्ष {fy.YearCode} बंद (Lock) करता येत नाही! या वर्षात अद्याप {pendingOperational} प्रलंबित (Pending) व्हाउचर्स आहेत."
                    });
                }
            }

            fy.IsClosed = targetClosedState;

            int userId = User.GetUserId();
            string username = User.GetUsername() ?? (userId > 0 ? $"User_{userId}" : "Admin");

            _context.AuditLogs.Add(new AuditLog
            {
                UserID = userId > 0 ? userId : null,
                Username = username,
                Action = targetClosedState ? "FINANCIAL_YEAR_LOCKED" : "FINANCIAL_YEAR_UNLOCKED",
                EntityName = "FinancialYear",
                EntityID = fy.YearCode,
                Timestamp = DateTime.Now,
                Details = $"Financial Year {fy.YearCode} {(targetClosedState ? "LOCKED (IsClosed = true)" : "UNLOCKED (IsClosed = false)")}. Reason: {request?.Reason ?? "Admin Action"}"
            });

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = targetClosedState
                    ? $"आर्थिक वर्ष {fy.YearCode} यशस्वीरित्या लॉक (Closed) करण्यात आले आहे!"
                    : $"आर्थिक वर्ष {fy.YearCode} पुन्हा उघडण्यात (Unlocked) आले आहे!",
                financialYearID = fy.FinancialYearID,
                yearCode = fy.YearCode,
                isClosed = fy.IsClosed
            });
        }

        [HttpPost]
        public async Task<ActionResult<FinancialYear>> PostFinancialYear(FinancialYear financialYear)
        {
            if (string.IsNullOrWhiteSpace(financialYear.YearCode))
            {
                return BadRequest("कृपया आर्थिक वर्षाचा कोड (उदा. 2026-2027) प्रविष्ट करा.");
            }

            financialYear.YearCode = financialYear.YearCode.Trim();
            DateTime startDate = financialYear.StartDate.Date;
            DateTime endDate = financialYear.EndDate.Date;

            if (startDate.Year < 2000 || endDate.Year > 2099)
            {
                return BadRequest("अवैध तारीख! वर्ष 2000 ते 2099 दरम्यान असणे आवश्यक आहे.");
            }

            if (startDate >= endDate)
            {
                return BadRequest("सुरुवातीची तारीख (Start Date) ही शेवटच्या तारखेपेक्षा (End Date) लहान असणे आवश्यक आहे.");
            }

            if (financialYear.IsActive && financialYear.IsClosed)
            {
                return BadRequest("बंद (Closed) केलेले आर्थिक वर्ष एकाच वेळी सक्रिय (Active) करता येत नाही.");
            }

            var duplicateCode = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.YearCode.ToLower() == financialYear.YearCode.ToLower());
            if (duplicateCode != null)
            {
                return BadRequest($"आर्थिक वर्ष '{financialYear.YearCode}' आधीच नोंदवलेले आहे.");
            }

            var overlappingFy = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(f => startDate <= f.EndDate.Date && endDate >= f.StartDate.Date);
            if (overlappingFy != null)
            {
                return BadRequest($"निवडलेला कालावधी ({startDate:dd/MM/yyyy} ते {endDate:dd/MM/yyyy}) आधीच नोंदवलेल्या आर्थिक वर्ष '{overlappingFy.YearCode}' ({overlappingFy.StartDate:dd/MM/yyyy} ते {overlappingFy.EndDate:dd/MM/yyyy}) शी ओव्हरलॅप होत आहे.");
            }

            financialYear.StartDate = startDate;
            financialYear.EndDate = endDate;

            // If no active year exists at all and this new year is not closed, make it active automatically
            bool anyActiveExists = await _context.FinancialYears.AnyAsync(f => f.IsActive);
            if (!anyActiveExists && !financialYear.IsClosed)
            {
                financialYear.IsActive = true;
            }

            // If the new one is active, deactivate others
            if (financialYear.IsActive)
            {
                var existingActive = await _context.FinancialYears.Where(f => f.IsActive).ToListAsync();
                foreach (var active in existingActive)
                {
                    active.IsActive = false;
                }
            }

            _context.FinancialYears.Add(financialYear);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetFinancialYear), new { id = financialYear.FinancialYearID }, financialYear);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutFinancialYear(int id, FinancialYear financialYear)
        {
            if (id != financialYear.FinancialYearID)
            {
                return BadRequest("अवैध आर्थिक वर्ष आयडी.");
            }

            if (string.IsNullOrWhiteSpace(financialYear.YearCode))
            {
                return BadRequest("कृपया आर्थिक वर्षाचा कोड (उदा. 2026-2027) प्रविष्ट करा.");
            }

            financialYear.YearCode = financialYear.YearCode.Trim();
            DateTime startDate = financialYear.StartDate.Date;
            DateTime endDate = financialYear.EndDate.Date;

            if (startDate.Year < 2000 || endDate.Year > 2099)
            {
                return BadRequest("अवैध तारीख! वर्ष 2000 ते 2099 दरम्यान असणे आवश्यक आहे.");
            }

            if (startDate >= endDate)
            {
                return BadRequest("सुरुवातीची तारीख (Start Date) ही शेवटच्या तारखेपेक्षा (End Date) लहान असणे आवश्यक आहे.");
            }

            if (financialYear.IsActive && financialYear.IsClosed)
            {
                return BadRequest("बंद (Closed) केलेले आर्थिक वर्ष एकाच वेळी सक्रिय (Active) ठेवता येत नाही.");
            }

            var duplicateCode = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.FinancialYearID != id && f.YearCode.ToLower() == financialYear.YearCode.ToLower());
            if (duplicateCode != null)
            {
                return BadRequest($"आर्थिक वर्ष '{financialYear.YearCode}' आधीच नोंदवलेले आहे.");
            }

            var overlappingFy = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.FinancialYearID != id && startDate <= f.EndDate.Date && endDate >= f.StartDate.Date);
            if (overlappingFy != null)
            {
                return BadRequest($"निवडलेला कालावधी ({startDate:dd/MM/yyyy} ते {endDate:dd/MM/yyyy}) आधीच नोंदवलेल्या आर्थिक वर्ष '{overlappingFy.YearCode}' शी ओव्हरलॅप होत आहे.");
            }

            var otherActiveExists = await _context.FinancialYears.AnyAsync(f => f.IsActive && f.FinancialYearID != id);
            if (!financialYear.IsActive && !otherActiveExists)
            {
                return BadRequest("प्रणालीमध्ये किमान एक आर्थिक वर्ष सक्रिय (Active) असणे आवश्यक आहे. हे वर्ष निष्क्रिय करण्यापूर्वी दुसरे आर्थिक वर्ष सक्रिय करा.");
            }

            financialYear.StartDate = startDate;
            financialYear.EndDate = endDate;

            if (financialYear.IsActive)
            {
                var existingActive = await _context.FinancialYears.Where(f => f.IsActive && f.FinancialYearID != id).ToListAsync();
                foreach (var active in existingActive)
                {
                    active.IsActive = false;
                }
            }

            _context.Entry(financialYear).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!FinancialYearExists(id))
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

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteFinancialYear(int id)
        {
            var financialYear = await _context.FinancialYears.FindAsync(id);
            if (financialYear == null)
            {
                return NotFound("आर्थिक वर्ष सापडले नाही.");
            }

            if (financialYear.IsClosed)
            {
                return BadRequest("बंद (Closed) केलेले आर्थिक वर्ष डिलीट करता येत नाही.");
            }

            if (financialYear.IsActive)
            {
                return BadRequest("सध्याचे चालू सक्रिय (Active) आर्थिक वर्ष डिलीट करता येत नाही. कृपया आधी दुसरे आर्थिक वर्ष सक्रिय करा.");
            }

            bool hasOpeningBalances = await _context.BranchLedgerOpeningBalances.AnyAsync(b => b.FinancialYearID == id);
            if (hasOpeningBalances)
            {
                return BadRequest("या आर्थिक वर्षात शाखानिहाय सुरुवातीची शिल्लक (Opening Balances) नोंदवलेली असल्यामुळे हे वर्ष डिलीट करता येत नाही.");
            }

            DateTime fyStart = financialYear.StartDate.Date;
            DateTime fyEndExclusive = financialYear.EndDate.Date.AddDays(1);
            bool hasVouchers = await _context.Vouchers.AnyAsync(v => v.VoucherDate >= fyStart && v.VoucherDate < fyEndExclusive);
            if (hasVouchers)
            {
                return BadRequest($"आर्थिक वर्ष {financialYear.YearCode} च्या कालावधीत व्हाउचर्स नोंदवलेले असल्यामुळे हे वर्ष डिलीट करता येत नाही.");
            }

            try
            {
                _context.FinancialYears.Remove(financialYear);
                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (DbUpdateException)
            {
                return BadRequest("या आर्थिक वर्षाशी संबंधित डेटाबेस मध्ये नोंदी असल्यामुळे हे वर्ष डिलीट करता येत नाही.");
            }
        }

        private bool FinancialYearExists(int id)
        {
            return _context.FinancialYears.Any(e => e.FinancialYearID == id);
        }
    }
}
