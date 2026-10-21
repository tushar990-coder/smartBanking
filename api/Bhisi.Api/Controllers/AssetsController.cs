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
    public class AssetsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AssetsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/Assets
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Asset>>> GetAssets(
            [FromQuery] int? branchId, 
            [FromQuery] int? categoryId, 
            [FromQuery] string? status)
        {
            var query = _context.Assets
                                .Include(a => a.Category)
                                .Include(a => a.Branch)
                                .AsQueryable();

            if (branchId.HasValue)
            {
                query = query.Where(a => a.BranchID == branchId.Value);
            }

            if (categoryId.HasValue)
            {
                query = query.Where(a => a.CategoryID == categoryId.Value);
            }

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(a => a.Status == status);
            }

            return await query.OrderBy(a => a.AssetCode).ToListAsync();
        }

        // GET: api/Assets/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Asset>> GetAsset(int id)
        {
            var asset = await _context.Assets
                                      .Include(a => a.Category)
                                      .Include(a => a.Branch)
                                      .FirstOrDefaultAsync(a => a.AssetID == id);

            if (asset == null)
            {
                return NotFound();
            }

            return asset;
        }

        // POST: api/Assets
        [HttpPost]
        public async Task<ActionResult<Asset>> PostAsset(Asset asset)
        {
            // Validate category
            var category = await _context.AssetCategories.FindAsync(asset.CategoryID);
            if (category == null)
            {
                return BadRequest("मालमत्ता वर्ग सापडला नाही. (Asset Category not found.)");
            }

            // Set default values if empty
            asset.CreatedOn = DateTime.Now;
            if (asset.IsOpeningBalance)
            {
                // For opening balance, Book value is Cost - Accumulated Depr
                asset.CurrentBookValue = asset.OriginalCost - asset.AccumulatedDepreciation;
                asset.Status = "Active";
            }
            else
            {
                // New asset purchase should normally go through AssetPurchasesController,
                // but if created directly, ensure book value is correct.
                asset.AccumulatedDepreciation = 0;
                asset.CurrentBookValue = asset.OriginalCost;
            }

            _context.Assets.Add(asset);
            await _context.SaveChangesAsync();

            if (asset.IsOpeningBalance)
            {
                try { await Helpers.DeadstockLedgerHelper.SyncDeadstockOpeningBalancesAsync(_context, asset.BranchID); } catch { }
            }

            return CreatedAtAction("GetAsset", new { id = asset.AssetID }, asset);
        }

        // POST: api/Assets/opening-batch
        [HttpPost("opening-batch")]
        public async Task<ActionResult<IEnumerable<Asset>>> PostOpeningBatch([FromBody] AssetOpeningBatchDto request)
        {
            if (request == null)
            {
                return BadRequest("अवैध विनंती डेटा. (Invalid request data.)");
            }

            var category = await _context.AssetCategories.FindAsync(request.CategoryID);
            if (category == null)
            {
                return BadRequest("मालमत्ता वर्ग सापडला नाही. (Asset Category not found.)");
            }

            int qty = request.Quantity > 0 ? request.Quantity : 1;
            decimal costPerUnit = request.CostMode == "total" 
                ? Math.Round(request.OriginalCost / qty, 2) 
                : Math.Round(request.OriginalCost, 2);

            decimal deprPerUnit = request.CostMode == "total" 
                ? Math.Round(request.AccumulatedDepreciation / qty, 2) 
                : Math.Round(request.AccumulatedDepreciation, 2);

            decimal bookValuePerUnit = costPerUnit - deprPerUnit;

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var createdAssets = new List<Asset>();
                string baseCode = request.AssetCode?.Trim() ?? "ASSET";
                string baseName = request.AssetName?.Trim() ?? "Asset";

                if (qty == 1)
                {
                    if (await _context.Assets.AnyAsync(a => a.AssetCode == baseCode))
                    {
                        return BadRequest($"मालमत्ता कोड '{baseCode}' आधीच अस्तित्वात आहे. कृपया दुसरा कोड वापरा.");
                    }

                    var singleAsset = new Asset
                    {
                        InstitutionID = 1,
                        BranchID = request.BranchID,
                        FinancialYearID = 1,
                        CategoryID = request.CategoryID,
                        AssetCode = baseCode,
                        AssetName = baseName,
                        PurchaseDate = request.PurchaseDate,
                        OriginalCost = costPerUnit,
                        AccumulatedDepreciation = deprPerUnit,
                        CurrentBookValue = bookValuePerUnit,
                        Status = "Active",
                        Location = request.Location,
                        Custodian = request.Custodian,
                        IsOpeningBalance = true,
                        CreatedBy = request.CreatedBy,
                        CreatedOn = DateTime.Now
                    };

                    _context.Assets.Add(singleAsset);
                    createdAssets.Add(singleAsset);
                }
                else
                {
                    int existingCount = await _context.Assets.CountAsync(a => a.AssetCode.StartsWith(baseCode));

                    for (int i = 1; i <= qty; i++)
                    {
                        int seq = existingCount + i;
                        string finalCode = $"{baseCode}-{seq:D3}";
                        while (await _context.Assets.AnyAsync(a => a.AssetCode == finalCode))
                        {
                            seq++;
                            finalCode = $"{baseCode}-{seq:D3}";
                        }

                        string finalName = $"{baseName} - {i}";

                        var batchAsset = new Asset
                        {
                            InstitutionID = 1,
                            BranchID = request.BranchID,
                            FinancialYearID = 1,
                            CategoryID = request.CategoryID,
                            AssetCode = finalCode,
                            AssetName = finalName,
                            PurchaseDate = request.PurchaseDate,
                            OriginalCost = costPerUnit,
                            AccumulatedDepreciation = deprPerUnit,
                            CurrentBookValue = bookValuePerUnit,
                            Status = "Active",
                            Location = request.Location,
                            Custodian = request.Custodian,
                            IsOpeningBalance = true,
                            CreatedBy = request.CreatedBy,
                            CreatedOn = DateTime.Now
                        };

                        _context.Assets.Add(batchAsset);
                        createdAssets.Add(batchAsset);
                    }
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                try { await Helpers.DeadstockLedgerHelper.SyncDeadstockOpeningBalancesAsync(_context, request.BranchID); } catch { }

                return Ok(createdAssets);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"ओपनिंग शिल्लक जतन करताना त्रुटी आली: {ex.Message}");
            }
        }

        // PUT: api/Assets/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutAsset(int id, Asset asset)
        {
            if (id != asset.AssetID)
            {
                return BadRequest();
            }

            var existing = await _context.Assets.FindAsync(id);
            if (existing == null)
            {
                return NotFound();
            }

            existing.CategoryID = asset.CategoryID;
            existing.AssetCode = asset.AssetCode;
            existing.AssetName = asset.AssetName;
            existing.PurchaseDate = asset.PurchaseDate;
            existing.OriginalCost = asset.OriginalCost;
            existing.AccumulatedDepreciation = asset.AccumulatedDepreciation;
            existing.CurrentBookValue = asset.CurrentBookValue;
            existing.Status = asset.Status;
            existing.Location = asset.Location;
            existing.Custodian = asset.Custodian;
            existing.IsOpeningBalance = asset.IsOpeningBalance;
            existing.UpdatedBy = asset.UpdatedBy ?? 1;
            existing.UpdatedOn = DateTime.Now;

            _context.Entry(existing).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
                try { await Helpers.DeadstockLedgerHelper.SyncDeadstockOpeningBalancesAsync(_context, existing.BranchID); } catch { }
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!AssetExists(id))
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

        // DELETE: api/Assets/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAsset(int id)
        {
            var asset = await _context.Assets.FindAsync(id);
            if (asset == null)
            {
                return NotFound();
            }

            // Check if there are any activities logged against this asset (Allocations, Maintenance, etc.)
            var hasAllocations = await _context.AssetAllocations.AnyAsync(a => a.AssetID == id);
            var hasMaintenance = await _context.AssetMaintenances.AnyAsync(m => m.AssetID == id);
            var hasTransfers = await _context.AssetTransfers.AnyAsync(t => t.AssetID == id);
            var hasDepreciation = await _context.AssetDepreciations.AnyAsync(d => d.AssetID == id);
            var hasVerification = await _context.AssetVerifications.AnyAsync(v => v.AssetID == id);
            var hasDisposal = await _context.AssetDisposals.AnyAsync(d => d.AssetID == id);

            if (hasAllocations || hasMaintenance || hasTransfers || hasDepreciation || hasVerification || hasDisposal)
            {
                return BadRequest("या मालमत्तेचे व्यवहार (Allocation/Maintenance/Transfer/Depreciation) नोंदवलेले असल्यामुळे ही मालमत्ता डिलीट करता येणार नाही. (Cannot delete asset because transaction history exists.)");
            }

            _context.Assets.Remove(asset);
            await _context.SaveChangesAsync();

            try { await Helpers.DeadstockLedgerHelper.SyncDeadstockOpeningBalancesAsync(_context, asset.BranchID); } catch { }

            return NoContent();
        }

        // GET: api/Assets/5/history
        [HttpGet("{id}/history")]
        public async Task<IActionResult> GetAssetHistory(int id)
        {
            var asset = await _context.Assets.FindAsync(id);
            if (asset == null) return NotFound();

            var allocations = await _context.AssetAllocations.Where(a => a.AssetID == id).ToListAsync();
            var transfers = await _context.AssetTransfers.Include(t => t.FromBranch).Include(t => t.ToBranch).Where(t => t.AssetID == id).ToListAsync();
            var maintenances = await _context.AssetMaintenances.Where(m => m.AssetID == id).ToListAsync();
            var depreciations = await _context.AssetDepreciations.Where(d => d.AssetID == id).ToListAsync();
            var verifications = await _context.AssetVerifications.Where(v => v.AssetID == id).ToListAsync();
            var disposal = await _context.AssetDisposals.FirstOrDefaultAsync(d => d.AssetID == id);

            var history = new List<object>();

            foreach (var item in allocations)
            {
                history.Add(new
                {
                    Type = "Allocation",
                    Date = item.AllocationDate,
                    Description = $"विभागाला वाटप (Allocated to Dept): {item.Department}, ताबा (Custodian): {item.CustodianName}",
                    Remarks = item.Remarks
                });
            }

            foreach (var item in transfers)
            {
                history.Add(new
                {
                    Type = "Transfer",
                    Date = item.TransferDate,
                    Description = $"शाखा हस्तांतरण (Transferred): {item.FromBranch?.BranchName} -> {item.ToBranch?.BranchName}. ताबा (Custodian): {item.FromCustodian} -> {item.ToCustodian}",
                    Remarks = item.Remarks
                });
            }

            foreach (var item in maintenances)
            {
                history.Add(new
                {
                    Type = "Maintenance",
                    Date = item.MaintenanceDate,
                    Description = $"देखभाल (Maintenance): {item.MaintenanceType} by {item.ServiceProvider}. खर्च (Cost): ₹{item.Cost:N2}",
                    Remarks = item.Remarks
                });
            }

            foreach (var item in depreciations)
            {
                history.Add(new
                {
                    Type = "Depreciation",
                    Date = item.CalculationDate,
                    Description = $"घसारा आकारणी (Depreciation): {item.Rate}%. घसारा रक्कम: ₹{item.DepreciationAmount:N2}. पूर्वीचे मूल्य: ₹{item.BookValueBefore:N2}, नवीन मूल्य: ₹{item.BookValueAfter:N2}",
                    Remarks = ""
                });
            }

            foreach (var item in verifications)
            {
                history.Add(new
                {
                    Type = "Verification",
                    Date = item.VerificationDate,
                    Description = $"भौतिक तपासणी (Physical Verification) by {item.AuditorName}. स्थिती: {item.PhysicalStatus}",
                    Remarks = item.Remarks
                });
            }

            if (disposal != null)
            {
                history.Add(new
                {
                    Type = "Disposal",
                    Date = disposal.DisposalDate,
                    Description = $"मालमत्ता विल्हेवाट (Disposed - {disposal.DisposalType}). पुस्तकी मूल्य: ₹{disposal.BookValueAtDisposal:N2}. विक्री रक्कम: ₹{disposal.SaleAmount:N2}. नफा/तोटा: ₹{disposal.ProfitOrLoss:N2}",
                    Remarks = disposal.BuyerName != null ? $"खरेदीदार (Buyer): {disposal.BuyerName}" : ""
                });
            }

            var sortedHistory = history.OrderByDescending(h => ((dynamic)h).Date).ToList();

            return Ok(sortedHistory);
        }

        // POST: api/Assets/sync-opening-balances?branchId=1
        [HttpPost("sync-opening-balances")]
        public async Task<IActionResult> SyncOpeningBalances([FromQuery] int? branchId)
        {
            try
            {
                await Helpers.DeadstockLedgerHelper.SyncDeadstockOpeningBalancesAsync(_context, branchId);
                return Ok(new
                {
                    success = true,
                    message = "डेडस्टॉक सुरुवातीची शिल्लक तेरीज, ताळेबंद व GL खात्यांशी यशस्वीरीत्या सिंक करण्यात आली."
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = $"डेडस्टॉक सिंक करताना त्रुटी आली: {ex.Message}"
                });
            }
        }

        private bool AssetExists(int id)
        {
            return _context.Assets.Any(e => e.AssetID == id);
        }
    }

    public class AssetOpeningBatchDto
    {
        public int BranchID { get; set; } = 1;
        public int CategoryID { get; set; }
        public string AssetCode { get; set; } = string.Empty;
        public string AssetName { get; set; } = string.Empty;
        public DateTime PurchaseDate { get; set; }
        public int Quantity { get; set; } = 1;
        public string CostMode { get; set; } = "perUnit"; // "perUnit" or "total"
        public decimal OriginalCost { get; set; }
        public decimal AccumulatedDepreciation { get; set; }
        public string? Location { get; set; }
        public string? Custodian { get; set; }
        public bool IsOpeningBalance { get; set; } = true;
        public int CreatedBy { get; set; } = 1;
    }
}

