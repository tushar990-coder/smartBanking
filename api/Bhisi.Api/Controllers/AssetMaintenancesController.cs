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
    public class AssetMaintenancesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AssetMaintenancesController(AppDbContext context)
        {
            _context = context;
        }

        public class AssetMaintenanceRequest
        {
            public required AssetMaintenance Maintenance { get; set; }
            public bool PostVoucher { get; set; }
            public int? DebitLedgerID { get; set; }
            public int? CreditLedgerID { get; set; }
        }

        // GET: api/AssetMaintenances
        [HttpGet]
        public async Task<ActionResult<IEnumerable<AssetMaintenance>>> GetAssetMaintenances([FromQuery] int? assetId)
        {
            var query = _context.AssetMaintenances
                                .Include(m => m.Asset)
                                .Include(m => m.Voucher)
                                .AsQueryable();
            if (assetId.HasValue)
            {
                query = query.Where(m => m.AssetID == assetId.Value);
            }
            return await query.OrderByDescending(m => m.MaintenanceDate).ToListAsync();
        }

        // POST: api/AssetMaintenances
        [HttpPost]
        public async Task<ActionResult<AssetMaintenance>> PostAssetMaintenance(AssetMaintenanceRequest request)
        {
            if (request == null || request.Maintenance == null)
            {
                return BadRequest("Invalid request body.");
            }

            var asset = await _context.Assets.FindAsync(request.Maintenance.AssetID);
            if (asset == null)
            {
                return BadRequest("मालमत्ता सापडली नाही. (Asset not found.)");
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Post Voucher if requested
                if (request.PostVoucher && request.DebitLedgerID.HasValue && request.CreditLedgerID.HasValue)
                {
                    string voucherNo = await GenerateVoucherNo(request.Maintenance.BranchID, "Payment");

                    var voucher = new Voucher
                    {
                        BranchID = request.Maintenance.BranchID,
                        VoucherNo = voucherNo,
                        VoucherDate = request.Maintenance.MaintenanceDate,
                        VoucherType = "Payment",
                        Narration = $"मालमत्ता देखभाल (Asset Maintenance - {request.Maintenance.MaintenanceType}): Asset {asset.AssetCode} ({asset.AssetName}) by {request.Maintenance.ServiceProvider}",
                        TotalAmount = request.Maintenance.Cost,
                        CreatedBy = request.Maintenance.CreatedBy,
                        CreatedOn = DateTime.Now,
                        VoucherDetails = new List<VoucherDetail>()
                    };

                    // Debit: Repair/Maintenance Expense Ledger
                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = request.DebitLedgerID.Value,
                        DrCr = "Dr",
                        Amount = request.Maintenance.Cost
                    });

                    // Credit: Cash/Bank Ledger
                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = request.CreditLedgerID.Value,
                        DrCr = "Cr",
                        Amount = request.Maintenance.Cost
                    });

                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    request.Maintenance.VoucherID = voucher.VoucherID;
                }

                // Add Maintenance record
                request.Maintenance.CreatedOn = DateTime.Now;
                _context.AssetMaintenances.Add(request.Maintenance);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return CreatedAtAction("GetAssetMaintenances", new { id = request.Maintenance.MaintenanceID }, request.Maintenance);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"Error recording maintenance: {ex.Message}");
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
            return $"{branchCode}-PAY-{fy}-{count:D5}";
        }
    }
}
