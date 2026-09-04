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
            public int? BranchID { get; set; }
            public int? CategoryID { get; set; }
            public DateTime CalculationDate { get; set; } = DateTime.Today;
        }

        public class DepreciationCommitRequest
        {
            public int BranchID { get; set; } = 1;
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
        public async Task<ActionResult<IEnumerable<AssetDepreciation>>> GetAssetDepreciations([FromQuery] int? assetId)
        {
            var query = _context.AssetDepreciations
                                .Include(d => d.Asset)
                                .Include(d => d.Voucher)
                                .AsQueryable();
            if (assetId.HasValue)
            {
                query = query.Where(d => d.AssetID == assetId.Value);
            }
            return await query.OrderByDescending(d => d.CalculationDate).ToListAsync();
        }

        // POST: api/AssetDepreciations/preview
        [HttpPost("preview")]
        public async Task<ActionResult<IEnumerable<DepreciationPreviewItem>>> PreviewDepreciation(DepreciationCalculationRequest request)
        {
            var query = _context.Assets
                                .Include(a => a.Category)
                                .Where(a => a.Status == "Active" && a.CurrentBookValue > 1)
                                .AsQueryable();

            if (request.BranchID.HasValue)
            {
                query = query.Where(a => a.BranchID == request.BranchID.Value);
            }

            if (request.CategoryID.HasValue)
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
                return BadRequest("No items to calculate depreciation for.");
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                int? voucherId = null;
                decimal totalDepAmount = request.Items.Sum(i => i.DepreciationAmount);

                // 1. Post Accounting Voucher if requested
                if (request.PostVoucher && request.DebitLedgerID.HasValue && request.CreditLedgerID.HasValue && totalDepAmount > 0)
                {
                    string voucherNo = await GenerateVoucherNo(request.BranchID, "Journal");

                    var voucher = new Voucher
                    {
                        BranchID = request.BranchID,
                        VoucherNo = voucherNo,
                        VoucherDate = request.CalculationDate,
                        VoucherType = "Journal",
                        Narration = $"मालमत्ता घसारा आकारणी (Batch Asset Depreciation Calculation) as of {request.CalculationDate.ToShortDateString()}",
                        TotalAmount = totalDepAmount,
                        CreatedBy = request.CreatedBy,
                        CreatedOn = DateTime.Now,
                        VoucherDetails = new List<VoucherDetail>()
                    };

                    // Debit: Depreciation Expense Ledger
                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = request.DebitLedgerID.Value,
                        DrCr = "Dr",
                        Amount = totalDepAmount
                    });

                    // Credit: Asset Ledger or Accumulated Depreciation
                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = request.CreditLedgerID.Value,
                        DrCr = "Cr",
                        Amount = totalDepAmount
                    });

                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    voucherId = voucher.VoucherID;
                }

                // 2. Process each asset and save depreciation record
                foreach (var item in request.Items)
                {
                    var asset = await _context.Assets.FindAsync(item.AssetID);
                    if (asset == null) continue;

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
                        BranchID = request.BranchID,
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

                return Ok(new { Message = $"{request.Items.Count} मालमत्तांसाठी घसारा यशस्वीरित्या आकारण्यात आला! (Depreciation successfully run for {request.Items.Count} assets.)", VoucherID = voucherId });
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

            int count = await _context.Vouchers.CountAsync(v => v.BranchID == branchId && v.VoucherType == voucherType) + 1;
            return $"{branchCode}-JV-{fy}-{count:D5}";
        }
    }
}
