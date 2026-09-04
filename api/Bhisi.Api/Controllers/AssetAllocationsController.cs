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
    public class AssetAllocationsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AssetAllocationsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/AssetAllocations
        [HttpGet]
        public async Task<ActionResult<IEnumerable<AssetAllocation>>> GetAssetAllocations([FromQuery] int? assetId)
        {
            var query = _context.AssetAllocations
                                .Include(a => a.Asset)
                                .Include(a => a.AllocatedBranch)
                                .AsQueryable();
            if (assetId.HasValue)
            {
                query = query.Where(a => a.AssetID == assetId.Value);
            }
            return await query.OrderByDescending(a => a.AllocationDate).ToListAsync();
        }

        // POST: api/AssetAllocations
        [HttpPost]
        public async Task<ActionResult<AssetAllocation>> PostAssetAllocation(AssetAllocation allocation)
        {
            var asset = await _context.Assets.FindAsync(allocation.AssetID);
            if (asset == null)
            {
                return BadRequest("मालमत्ता सापडली नाही. (Asset not found.)");
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Update Asset's current custodian and location
                asset.Custodian = allocation.CustodianName;
                asset.Location = allocation.Department;
                asset.BranchID = allocation.AllocatedBranchID;
                asset.UpdatedBy = allocation.CreatedBy;
                asset.UpdatedOn = DateTime.Now;

                _context.Entry(asset).State = EntityState.Modified;

                // Add Allocation record
                allocation.CreatedOn = DateTime.Now;
                _context.AssetAllocations.Add(allocation);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return CreatedAtAction("GetAssetAllocations", new { id = allocation.AllocationID }, allocation);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"Error saving allocation: {ex.Message}");
            }
        }
    }
}
