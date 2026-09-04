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
    public class AssetVerificationsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AssetVerificationsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/AssetVerifications
        [HttpGet]
        public async Task<ActionResult<IEnumerable<AssetVerification>>> GetAssetVerifications([FromQuery] int? assetId)
        {
            var query = _context.AssetVerifications
                                .Include(v => v.Asset)
                                .AsQueryable();
            if (assetId.HasValue)
            {
                query = query.Where(v => v.AssetID == assetId.Value);
            }
            return await query.OrderByDescending(v => v.VerificationDate).ToListAsync();
        }

        // POST: api/AssetVerifications
        [HttpPost]
        public async Task<ActionResult<AssetVerification>> PostAssetVerification(AssetVerification verification)
        {
            var asset = await _context.Assets.FindAsync(verification.AssetID);
            if (asset == null)
            {
                return BadRequest("मालमत्ता सापडली नाही. (Asset not found.)");
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Update Asset's status based on physical status found
                if (verification.PhysicalStatus == "Damaged")
                {
                    asset.Status = "Damaged";
                }
                else if (verification.PhysicalStatus == "Missing")
                {
                    asset.Status = "Suspended";
                }
                else if (verification.PhysicalStatus == "Found")
                {
                    asset.Status = "Active";
                }

                asset.UpdatedBy = verification.CreatedBy;
                asset.UpdatedOn = DateTime.Now;
                _context.Entry(asset).State = EntityState.Modified;

                // Save Verification record
                verification.CreatedOn = DateTime.Now;
                _context.AssetVerifications.Add(verification);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return CreatedAtAction("GetAssetVerifications", new { id = verification.VerificationID }, verification);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"Error recording verification: {ex.Message}");
            }
        }
    }
}
