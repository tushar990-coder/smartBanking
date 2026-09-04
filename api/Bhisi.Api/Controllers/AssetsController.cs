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

            return CreatedAtAction("GetAsset", new { id = asset.AssetID }, asset);
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

        private bool AssetExists(int id)
        {
            return _context.Assets.Any(e => e.AssetID == id);
        }
    }
}
