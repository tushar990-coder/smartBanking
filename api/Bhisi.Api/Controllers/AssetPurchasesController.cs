using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using System.Text.Json;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AssetPurchasesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AssetPurchasesController(AppDbContext context)
        {
            _context = context;
        }

        public class AssetPurchaseRequest
        {
            public required AssetPurchase Purchase { get; set; }
            public int CategoryID { get; set; }
            public int Quantity { get; set; }
            public required string AssetCodePrefix { get; set; }
            public required string AssetName { get; set; }
            public bool PostVoucher { get; set; }
            public int? DebitLedgerID { get; set; }
            public int? CreditLedgerID { get; set; }
        }

        // GET: api/AssetPurchases
        [HttpGet]
        public async Task<ActionResult<IEnumerable<AssetPurchase>>> GetAssetPurchases([FromQuery] int? branchId)
        {
            var query = _context.AssetPurchases
                                .Include(p => p.Branch)
                                .Include(p => p.BankLedger)
                                .Include(p => p.Voucher)
                                .AsQueryable();
            if (branchId.HasValue)
            {
                query = query.Where(p => p.BranchID == branchId.Value);
            }
            return await query.OrderByDescending(p => p.InvoiceDate).ToListAsync();
        }

        // POST: api/AssetPurchases
        [HttpPost]
        public async Task<ActionResult<AssetPurchase>> PostAssetPurchase(AssetPurchaseRequest request)
        {
            if (request == null || request.Purchase == null)
            {
                return BadRequest("Invalid purchase request.");
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // 1. Create individual Asset entries
                int existingCount = await _context.Assets.CountAsync(a => a.CategoryID == request.CategoryID);
                var assetIds = new List<int>();

                // Cost per asset (split taxable cost)
                decimal costPerAsset = request.Purchase.TaxableAmount / request.Quantity;
                
                for (int i = 1; i <= request.Quantity; i++)
                {
                    var asset = new Asset
                    {
                        InstitutionID = request.Purchase.InstitutionID,
                        BranchID = request.Purchase.BranchID,
                        FinancialYearID = request.Purchase.FinancialYearID,
                        CategoryID = request.CategoryID,
                        AssetCode = $"{request.AssetCodePrefix}-{(existingCount + i):D3}",
                        AssetName = $"{request.AssetName} {i}",
                        PurchaseDate = request.Purchase.InvoiceDate,
                        OriginalCost = costPerAsset,
                        AccumulatedDepreciation = 0,
                        CurrentBookValue = costPerAsset,
                        Status = "Active",
                        IsOpeningBalance = false,
                        CreatedBy = request.Purchase.CreatedBy,
                        CreatedOn = DateTime.Now
                    };
                    _context.Assets.Add(asset);
                    await _context.SaveChangesAsync(); // save each to get id
                    assetIds.Add(asset.AssetID);
                }

                // 2. Set Asset IDs in Purchase
                request.Purchase.AssetIdsJson = JsonSerializer.Serialize(assetIds);
                request.Purchase.CreatedOn = DateTime.Now;

                // 3. Post Accounting Voucher if requested
                if (request.PostVoucher && request.DebitLedgerID.HasValue)
                {
                    // Find credit ledger based on payment mode
                    int creditLedgerId = 0;
                    if (request.Purchase.PaymentMode == "Bank" && request.Purchase.BankLedgerID.HasValue)
                    {
                        creditLedgerId = request.Purchase.BankLedgerID.Value;
                    }
                    else if (request.Purchase.PaymentMode == "Cash")
                    {
                        // Find cash ledger
                        var cashLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("रोख शिल्लक") || l.LedgerName.ToLower().Contains("cash"));
                        if (cashLedger == null)
                        {
                            return BadRequest("रोख शिल्लक खाते सापडले नाही. (Cash ledger not found.)");
                        }
                        creditLedgerId = cashLedger.LedgerID;
                    }
                    else if (request.Purchase.PaymentMode == "Credit" && request.CreditLedgerID.HasValue)
                    {
                        creditLedgerId = request.CreditLedgerID.Value;
                    }
                    else
                    {
                        return BadRequest("क्रेडिट लेजर किंवा बँक खाते देणे आवश्यक आहे. (Credit ledger or bank ledger is required based on payment mode.)");
                    }

                    // Generate next voucher no
                    string voucherType = request.Purchase.PaymentMode == "Credit" ? "Journal" : "Payment";
                    string voucherNo = await GenerateVoucherNo(request.Purchase.BranchID, voucherType);

                    var voucher = new Voucher
                    {
                        BranchID = request.Purchase.BranchID,
                        VoucherNo = voucherNo,
                        VoucherDate = request.Purchase.InvoiceDate,
                        VoucherType = voucherType,
                        Narration = $"मालमत्ता खरेदी (Asset Purchase): {request.AssetName} x{request.Quantity} from {request.Purchase.SupplierName}, बिल क्र: {request.Purchase.InvoiceNo}",
                        TotalAmount = request.Purchase.TotalAmount,
                        CreatedBy = request.Purchase.CreatedBy,
                        CreatedOn = DateTime.Now,
                        VoucherDetails = new List<VoucherDetail>()
                    };

                    // Debit Asset Ledger
                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = request.DebitLedgerID.Value,
                        DrCr = "Dr",
                        Amount = request.Purchase.TotalAmount
                    });

                    // Credit Cash/Bank/Supplier Ledger
                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = creditLedgerId,
                        DrCr = "Cr",
                        Amount = request.Purchase.TotalAmount
                    });

                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    request.Purchase.VoucherID = voucher.VoucherID;
                }

                _context.AssetPurchases.Add(request.Purchase);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();
                return CreatedAtAction("GetAssetPurchases", new { id = request.Purchase.PurchaseID }, request.Purchase);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"Error recording purchase: {ex.Message}");
            }
        }

        private async Task<string> GenerateVoucherNo(int branchId, string voucherType)
        {
            var branch = await _context.Branches.FindAsync(branchId);
            string branchCode = branch?.BranchCode ?? "HQ";

            string typeCode = "PAY";
            if (voucherType == "Journal") typeCode = "JV";

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
