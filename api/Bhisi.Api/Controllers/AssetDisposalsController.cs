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
    public class AssetDisposalsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AssetDisposalsController(AppDbContext context)
        {
            _context = context;
        }

        public class AssetDisposalRequest
        {
            public required AssetDisposal Disposal { get; set; }
            public bool PostVoucher { get; set; }
            public int? DebitLedgerID { get; set; } // Cash/Bank Ledger (or Expense Ledger if write-off)
            public int? CreditLedgerID { get; set; } // Asset Ledger
            public int? ProfitLossLedgerID { get; set; } // Profit/Loss Ledger
        }

        // GET: api/AssetDisposals
        [HttpGet]
        public async Task<ActionResult<IEnumerable<AssetDisposal>>> GetAssetDisposals([FromQuery] int? assetId)
        {
            var query = _context.AssetDisposals
                                .Include(d => d.Asset)
                                .Include(d => d.Voucher)
                                .AsQueryable();
            if (assetId.HasValue)
            {
                query = query.Where(d => d.AssetID == assetId.Value);
            }
            return await query.OrderByDescending(d => d.DisposalDate).ToListAsync();
        }

        // POST: api/AssetDisposals
        [HttpPost]
        public async Task<ActionResult<AssetDisposal>> PostAssetDisposal(AssetDisposalRequest request)
        {
            if (request == null || request.Disposal == null)
            {
                return BadRequest("Invalid request body.");
            }

            var asset = await _context.Assets.FindAsync(request.Disposal.AssetID);
            if (asset == null)
            {
                return BadRequest("मालमत्ता सापडली नाही. (Asset not found.)");
            }

            if (asset.Status == "Disposed")
            {
                return BadRequest("ही मालमत्ता आधीच विल्हेवाट लावलेली आहे. (Asset is already disposed.)");
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Ensure BookValue is captured correctly from the Asset
                request.Disposal.BookValueAtDisposal = asset.CurrentBookValue;
                
                // Calculate Profit or Loss (SaleAmount - BookValue)
                request.Disposal.ProfitOrLoss = request.Disposal.SaleAmount - request.Disposal.BookValueAtDisposal;

                // Post Accounting Voucher if requested
                if (request.PostVoucher && request.CreditLedgerID.HasValue)
                {
                    decimal gainOrLoss = request.Disposal.ProfitOrLoss;
                    decimal bookValue = request.Disposal.BookValueAtDisposal;
                    decimal saleAmount = request.Disposal.SaleAmount;

                    string voucherType = "Journal";
                    if (saleAmount > 0 && request.Disposal.DisposalType == "Sale")
                    {
                        voucherType = "Receipt";
                    }

                    string voucherNo = await GenerateVoucherNo(request.Disposal.BranchID, voucherType);

                    var voucher = new Voucher
                    {
                        BranchID = request.Disposal.BranchID,
                        VoucherNo = voucherNo,
                        VoucherDate = request.Disposal.DisposalDate,
                        VoucherType = voucherType,
                        Narration = $"मालमत्ता विल्हेवाट (Asset Disposal - {request.Disposal.DisposalType}): Asset {asset.AssetCode} ({asset.AssetName}). Book Value: ₹{bookValue:N2}, Sale Amount: ₹{saleAmount:N2}, Profit/Loss: ₹{gainOrLoss:N2}",
                        TotalAmount = saleAmount > 0 ? Math.Max(saleAmount, bookValue) : bookValue,
                        CreatedBy = request.Disposal.CreatedBy,
                        CreatedOn = DateTime.Now,
                        VoucherDetails = new List<VoucherDetail>()
                    };

                    if (gainOrLoss == 0)
                    {
                        // Book Value = Sale Amount
                        if (saleAmount > 0 && request.DebitLedgerID.HasValue)
                        {
                            // Debit: Cash/Bank Ledger
                            voucher.VoucherDetails.Add(new VoucherDetail { LedgerID = request.DebitLedgerID.Value, DrCr = "Dr", Amount = saleAmount });
                        }
                        // Credit: Asset Ledger
                        voucher.VoucherDetails.Add(new VoucherDetail { LedgerID = request.CreditLedgerID.Value, DrCr = "Cr", Amount = bookValue });
                    }
                    else if (gainOrLoss > 0) // Profit
                    {
                        // Debit: Cash/Bank = SaleAmount
                        if (request.DebitLedgerID.HasValue)
                        {
                            voucher.VoucherDetails.Add(new VoucherDetail { LedgerID = request.DebitLedgerID.Value, DrCr = "Dr", Amount = saleAmount });
                        }
                        // Credit: Asset Ledger = BookValue
                        voucher.VoucherDetails.Add(new VoucherDetail { LedgerID = request.CreditLedgerID.Value, DrCr = "Cr", Amount = bookValue });
                        // Credit: Profit Ledger = ProfitAmount
                        if (request.ProfitLossLedgerID.HasValue)
                        {
                            voucher.VoucherDetails.Add(new VoucherDetail { LedgerID = request.ProfitLossLedgerID.Value, DrCr = "Cr", Amount = gainOrLoss });
                        }
                    }
                    else // Loss (gainOrLoss < 0)
                    {
                        decimal lossAmount = Math.Abs(gainOrLoss);

                        // Debit: Cash/Bank = SaleAmount (if sold)
                        if (saleAmount > 0 && request.DebitLedgerID.HasValue)
                        {
                            voucher.VoucherDetails.Add(new VoucherDetail { LedgerID = request.DebitLedgerID.Value, DrCr = "Dr", Amount = saleAmount });
                        }
                        // Debit: Loss Ledger = LossAmount
                        if (request.ProfitLossLedgerID.HasValue)
                        {
                            voucher.VoucherDetails.Add(new VoucherDetail { LedgerID = request.ProfitLossLedgerID.Value, DrCr = "Dr", Amount = lossAmount });
                        }
                        // Credit: Asset Ledger = BookValue
                        voucher.VoucherDetails.Add(new VoucherDetail { LedgerID = request.CreditLedgerID.Value, DrCr = "Cr", Amount = bookValue });
                    }

                    // Fix voucher total amount to match debit totals
                    voucher.TotalAmount = voucher.VoucherDetails.Where(d => d.DrCr == "Dr").Sum(d => d.Amount);

                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    request.Disposal.VoucherID = voucher.VoucherID;
                }

                // Update Asset details
                asset.Status = "Disposed";
                asset.CurrentBookValue = 0;
                asset.UpdatedBy = request.Disposal.CreatedBy;
                asset.UpdatedOn = DateTime.Now;
                _context.Entry(asset).State = EntityState.Modified;

                // Save Disposal record
                request.Disposal.CreatedOn = DateTime.Now;
                _context.AssetDisposals.Add(request.Disposal);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return CreatedAtAction("GetAssetDisposals", new { id = request.Disposal.DisposalID }, request.Disposal);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"Error disposing asset: {ex.Message}");
            }
        }

        private async Task<string> GenerateVoucherNo(int branchId, string voucherType)
        {
            var branch = await _context.Branches.FindAsync(branchId);
            string branchCode = branch?.BranchCode ?? "HQ";

            string typeCode = "JV";
            if (voucherType == "Receipt") typeCode = "REC";

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
            return $"{branchCode}-{typeCode}-{fy}-{count:D5}";
        }
    }
}
