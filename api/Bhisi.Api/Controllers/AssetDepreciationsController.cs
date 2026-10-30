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
    public class AssetDepreciationsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AssetDepreciationsController(AppDbContext context)
        {
            _context = context;
        }

        public class DepreciationPreviewItem
        {
            public int AssetID { get; set; }
            public int BranchID { get; set; }
            public string BranchName { get; set; } = string.Empty;
            public string AssetCode { get; set; } = string.Empty;
            public string AssetName { get; set; } = string.Empty;
            public decimal OriginalCost { get; set; }
            public decimal BookValueBefore { get; set; }
            public decimal Rate { get; set; }
            public string Method { get; set; } = "WDV";
            public decimal DepreciationAmount { get; set; }
            public decimal BookValueAfter { get; set; }
        }

        public class DepreciationCalculationRequest
        {
            public int? BranchID { get; set; } // 0 or null = All Branches
            public int? CategoryID { get; set; }
            public DateTime CalculationDate { get; set; } = DateTime.Today;
        }

        public class DepreciationCommitRequest
        {
            public int BranchID { get; set; } = 1; // 0 = Consolidated All Branches
            public int FinancialYearID { get; set; } = 1;
            public DateTime CalculationDate { get; set; } = DateTime.Today;
            public required List<DepreciationPreviewItem> Items { get; set; }
            public bool PostVoucher { get; set; }
            public int? DebitLedgerID { get; set; } // Depreciation Expense Ledger
            public int? CreditLedgerID { get; set; } // Asset Ledger or Accum Depreciation
            public int CreatedBy { get; set; } = 1;
        }

        // GET: api/AssetDepreciations
        [HttpGet]
        public async Task<ActionResult<IEnumerable<AssetDepreciation>>> GetAssetDepreciations([FromQuery] int? assetId, [FromQuery] int? branchId)
        {
            var query = _context.AssetDepreciations
                                .Include(d => d.Asset)
                                    .ThenInclude(a => a.Branch)
                                .Include(d => d.Voucher)
                                .AsQueryable();
            if (assetId.HasValue)
            {
                query = query.Where(d => d.AssetID == assetId.Value);
            }
            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(d => d.BranchID == branchId.Value);
            }
            return await query.OrderByDescending(d => d.CalculationDate).ToListAsync();
        }

        // POST: api/AssetDepreciations/preview
        [HttpPost("preview")]
        public async Task<ActionResult<IEnumerable<DepreciationPreviewItem>>> PreviewDepreciation(DepreciationCalculationRequest request)
        {
            var query = _context.Assets
                                .Include(a => a.Category)
                                .Include(a => a.Branch)
                                .Where(a => a.Status == "Active" && a.CurrentBookValue > 1)
                                .AsQueryable();

            if (request.BranchID.HasValue && request.BranchID.Value > 0)
            {
                query = query.Where(a => a.BranchID == request.BranchID.Value);
            }

            if (request.CategoryID.HasValue && request.CategoryID.Value > 0)
            {
                query = query.Where(a => a.CategoryID == request.CategoryID.Value);
            }

            var assets = await query.ToListAsync();
            var previewItems = new List<DepreciationPreviewItem>();

            foreach (var asset in assets)
            {
                if (asset.Category == null) continue;

                decimal rate = asset.Category.DepreciationRate;
                string method = asset.Category.DepreciationMethod;
                decimal bookValueBefore = asset.CurrentBookValue;

                // Simple flat-rate annual calculation
                decimal depAmount = 0;
                if (method == "SLM")
                {
                    depAmount = asset.OriginalCost * (rate / 100);
                }
                else // WDV
                {
                    depAmount = bookValueBefore * (rate / 100);
                }

                // Ensure book value doesn't drop below 1 rupee
                depAmount = Math.Round(depAmount, 2);
                if (bookValueBefore - depAmount < 1)
                {
                    depAmount = Math.Max(0, bookValueBefore - 1);
                }

                if (depAmount > 0)
                {
                    previewItems.Add(new DepreciationPreviewItem
                    {
                        AssetID = asset.AssetID,
                        BranchID = asset.BranchID,
                        BranchName = asset.Branch?.BranchName ?? $"शाखा {asset.BranchID}",
                        AssetCode = asset.AssetCode,
                        AssetName = asset.AssetName,
                        OriginalCost = asset.OriginalCost,
                        BookValueBefore = bookValueBefore,
                        Rate = rate,
                        Method = method,
                        DepreciationAmount = depAmount,
                        BookValueAfter = bookValueBefore - depAmount
                    });
                }
            }

            return Ok(previewItems);
        }

        // POST: api/AssetDepreciations/commit
        [HttpPost("commit")]
        public async Task<IActionResult> CommitDepreciation(DepreciationCommitRequest request)
        {
            if (request.Items == null || request.Items.Count == 0)
            {
                return BadRequest("घसारा आकारणीसाठी कोणतीही मालमत्ता निवडली नाही. (No items to calculate depreciation for.)");
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Fetch all assets involved to ensure correct branch ownership
                var assetIds = request.Items.Select(i => i.AssetID).ToList();
                var dbAssets = await _context.Assets.Where(a => assetIds.Contains(a.AssetID)).ToDictionaryAsync(a => a.AssetID);

                // Group items by BranchID to post branch-specific balanced vouchers and audit records
                var branchGroups = request.Items.GroupBy(i => 
                {
                    if (dbAssets.TryGetValue(i.AssetID, out var a) && a.BranchID > 0) return a.BranchID;
                    return i.BranchID > 0 ? i.BranchID : (request.BranchID > 0 ? request.BranchID : 1);
                });

                var branchVoucherMap = new Dictionary<int, int?>();

                // 1. Post Accounting Voucher per branch if requested
                if (request.PostVoucher && request.DebitLedgerID.HasValue && request.CreditLedgerID.HasValue)
                {
                    foreach (var group in branchGroups)
                    {
                        int branchId = group.Key;
                        decimal branchTotalDep = group.Sum(i => i.DepreciationAmount);
                        if (branchTotalDep <= 0) continue;

                        string voucherNo = await GenerateVoucherNo(branchId, "Journal");

                        var voucher = new Voucher
                        {
                            BranchID = branchId,
                            VoucherNo = voucherNo,
                            VoucherDate = request.CalculationDate,
                            VoucherType = "Journal",
                            Narration = $"मालमत्ता घसारा आकारणी (Asset Depreciation) as of {request.CalculationDate.ToShortDateString()} - शाखा {branchId}",
                            TotalAmount = branchTotalDep,
                            CreatedBy = request.CreatedBy,
                            CreatedOn = DateTime.Now,
                            VoucherDetails = new List<VoucherDetail>
                            {
                                // Debit: Depreciation Expense Ledger
                                new VoucherDetail
                                {
                                    LedgerID = request.DebitLedgerID.Value,
                                    DrCr = "Dr",
                                    Amount = branchTotalDep
                                },
                                // Credit: Asset Ledger or Accumulated Depreciation
                                new VoucherDetail
                                {
                                    LedgerID = request.CreditLedgerID.Value,
                                    DrCr = "Cr",
                                    Amount = branchTotalDep
                                }
                            }
                        };

                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();

                        branchVoucherMap[branchId] = voucher.VoucherID;
                    }
                }

                // 2. Process each asset and save depreciation record
                foreach (var item in request.Items)
                {
                    if (!dbAssets.TryGetValue(item.AssetID, out var asset)) continue;

                    int itemBranchId = asset.BranchID > 0 ? asset.BranchID : (item.BranchID > 0 ? item.BranchID : 1);
                    int? voucherId = branchVoucherMap.ContainsKey(itemBranchId) ? branchVoucherMap[itemBranchId] : null;

                    // Update Asset values
                    asset.AccumulatedDepreciation += item.DepreciationAmount;
                    asset.CurrentBookValue = item.BookValueAfter;
                    asset.UpdatedBy = request.CreatedBy;
                    asset.UpdatedOn = DateTime.Now;

                    _context.Entry(asset).State = EntityState.Modified;

                    // Create Depreciation record
                    var depRecord = new AssetDepreciation
                    {
                        InstitutionID = 1,
                        BranchID = itemBranchId,
                        FinancialYearID = request.FinancialYearID,
                        AssetID = item.AssetID,
                        CalculationDate = request.CalculationDate,
                        Method = item.Method,
                        Rate = item.Rate,
                        DepreciationAmount = item.DepreciationAmount,
                        BookValueBefore = item.BookValueBefore,
                        BookValueAfter = item.BookValueAfter,
                        VoucherID = voucherId,
                        CreatedBy = request.CreatedBy,
                        CreatedOn = DateTime.Now
                    };
                    _context.AssetDepreciations.Add(depRecord);
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { 
                    Message = $"{request.Items.Count} मालमत्तांसाठी घसारा यशस्वीरित्या आकारण्यात आला! ({branchGroups.Count()} शाखा)", 
                    VoucherCount = branchVoucherMap.Count 
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"Error committing depreciation: {ex.Message}");
            }
        }

        private async Task<string> GenerateVoucherNo(int branchId, string voucherType)
        {
            var branch = await _context.Branches.FindAsync(branchId);
            string branchCode = branch?.BranchCode ?? "HQ";

            var activeYear = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
            string fy = "26-27";
            if (activeYear != null)
            {
                var parts = activeYear.YearCode.Split('-');
                if (parts.Length == 2)
                {
                    string y1 = parts[0].Length >= 4 ? parts[0].Substring(parts[0].Length - 2) : parts[0];
                    string y2 = parts[1].Length >= 4 ? parts[1].Substring(parts[1].Length - 2) : parts[1];
                    fy = $"{y1}-{y2}";
                }
                else
                {
                    fy = activeYear.YearCode;
                }
            }

            int count = await Helpers.VoucherNumberHelper.NextSequenceAsync(_context, $"{branchCode}-JV-{fy}-", 5);
            return $"{branchCode}-JV-{fy}-{count:D5}";
        }
    }
}
