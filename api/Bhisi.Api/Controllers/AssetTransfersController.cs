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
    public class AssetTransfersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AssetTransfersController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/AssetTransfers
        [HttpGet]
        public async Task<ActionResult<IEnumerable<AssetTransfer>>> GetAssetTransfers([FromQuery] int? assetId)
        {
            var query = _context.AssetTransfers
                                .Include(t => t.Asset)
                                .Include(t => t.FromBranch)
                                .Include(t => t.ToBranch)
                                .AsQueryable();
            if (assetId.HasValue)
            {
                query = query.Where(t => t.AssetID == assetId.Value);
            }
            return await query.OrderByDescending(t => t.TransferDate).ToListAsync();
        }

        // POST: api/AssetTransfers
        [HttpPost]
        public async Task<ActionResult<AssetTransfer>> PostAssetTransfer(AssetTransfer transfer)
        {
            var asset = await _context.Assets.FindAsync(transfer.AssetID);
            if (asset == null)
            {
                return BadRequest("मालमत्ता सापडली नाही. (Asset not found.)");
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Update Asset branch and custodian details
                asset.BranchID = transfer.ToBranchID;
                asset.Custodian = transfer.ToCustodian;
                asset.Location = "हस्तांतरित (Transferred)";
                asset.UpdatedBy = transfer.CreatedBy;
                asset.UpdatedOn = DateTime.Now;

                _context.Entry(asset).State = EntityState.Modified;

                // Add Transfer record
                transfer.CreatedOn = DateTime.Now;
                _context.AssetTransfers.Add(transfer);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return CreatedAtAction("GetAssetTransfers", new { id = transfer.TransferID }, transfer);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"Error recording transfer: {ex.Message}");
            }
        }
    }
}
