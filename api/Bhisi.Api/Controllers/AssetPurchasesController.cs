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
            public int? GstLedgerID { get; set; }
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
                return BadRequest("अवैध मालमत्ता खरेदी माहिती. (Invalid purchase request.)");
            }

            if (request.Quantity <= 0)
            {
                return BadRequest("मालमत्ता संख्या (Quantity) किमान १ असणे आवश्यक आहे.");
            }

            if (request.Purchase.TotalAmount <= 0)
            {
                return BadRequest("खरेदीची एकूण रक्कम ₹0 पेक्षा जास्त असणे आवश्यक आहे.");
            }

            decimal expectedTotal = Math.Round(request.Purchase.TaxableAmount + request.Purchase.GstAmount, 2, MidpointRounding.AwayFromZero);
            if (request.Purchase.TaxableAmount > 0 && Math.Abs(request.Purchase.TotalAmount - expectedTotal) > 0.01m)
            {
                return BadRequest($"एकूण बिल रक्कम (₹{request.Purchase.TotalAmount:N2}) आणि करपात्र रक्कम + GST बेरीज (₹{expectedTotal:N2}) जुळत नाही.");
            }

            // Determine whether GST is booked separately to an Input GST Ledger or capitalized into Asset Cost
            bool bookSeparateGst = request.Purchase.GstAmount > 0 && request.GstLedgerID.HasValue && request.GstLedgerID.Value > 0;
            decimal totalCapitalizedAssetCost = bookSeparateGst
                ? request.Purchase.TaxableAmount
                : request.Purchase.TotalAmount;

            if (request.PostVoucher && (!request.DebitLedgerID.HasValue || request.DebitLedgerID.Value <= 0))
            {
                var cat = await _context.AssetCategories.FindAsync(request.CategoryID);
                int resolvedCatLedgerId = await Helpers.DeadstockLedgerHelper.ResolveLedgerIdForCategoryAsync(_context, cat);
                if (resolvedCatLedgerId > 0)
                {
                    request.DebitLedgerID = resolvedCatLedgerId;
                }
                else
                {
                    return BadRequest("मालमत्ता खरेदी व्हाउचर तयार करण्यासाठी 'मालमत्ता जी.एल. लेजर' (Asset Debit Ledger) निवडणे अनिवार्य आहे.");
                }
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // 1. Create individual Asset entries with 100% consistent capitalized cost matching GL Debit
                int existingCount = await _context.Assets.CountAsync(a => a.AssetCode.StartsWith(request.AssetCodePrefix));
                var assetIds = new List<int>();

                decimal baseCostPerUnit = Math.Round(totalCapitalizedAssetCost / request.Quantity, 2, MidpointRounding.AwayFromZero);
                decimal allocatedSoFar = 0m;

                for (int i = 1; i <= request.Quantity; i++)
                {
                    decimal unitCost = (i == request.Quantity)
                        ? Math.Round(totalCapitalizedAssetCost - allocatedSoFar, 2, MidpointRounding.AwayFromZero)
                        : baseCostPerUnit;
                    allocatedSoFar += unitCost;

                    var asset = new Asset
                    {
                        InstitutionID = request.Purchase.InstitutionID,
                        BranchID = request.Purchase.BranchID,
                        FinancialYearID = request.Purchase.FinancialYearID,
                        CategoryID = request.CategoryID,
                        AssetCode = $"{request.AssetCodePrefix}-{(existingCount + i):D3}",
                        AssetName = $"{request.AssetName} {i}",
                        PurchaseDate = request.Purchase.InvoiceDate,
                        OriginalCost = unitCost,
                        AccumulatedDepreciation = 0,
                        CurrentBookValue = unitCost,
                        Status = "Active",
                        IsOpeningBalance = false,
                        CreatedBy = request.Purchase.CreatedBy,
                        CreatedOn = DateTime.Now
                    };
                    _context.Assets.Add(asset);
                    await _context.SaveChangesAsync();
                    assetIds.Add(asset.AssetID);
                }

                // 2. Set Asset IDs in Purchase
                request.Purchase.AssetIdsJson = JsonSerializer.Serialize(assetIds);
                request.Purchase.CreatedOn = DateTime.Now;

                // 3. Post Accounting Voucher if requested
                if (request.PostVoucher && request.DebitLedgerID.HasValue && request.DebitLedgerID.Value > 0)
                {
                    int creditLedgerId = 0;
                    if (Helpers.BankLedgerHelper.IsBankPaymentMode(request.Purchase.PaymentMode))
                    {
                        var bankCheck = await Helpers.BankLedgerHelper.ValidateBankLedgerAsync(_context, request.Purchase.BankLedgerID);
                        if (!bankCheck.IsValid)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(bankCheck.ErrorMessage);
                        }
                        creditLedgerId = bankCheck.LedgerId;
                    }
                    else if (string.Equals(request.Purchase.PaymentMode, "Cash", StringComparison.OrdinalIgnoreCase))
                    {
                        int cashLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, request.Purchase.BranchID, "ASSET");
                        if (cashLedgerId <= 0)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest("या शाखेसाठी रोख शिल्लक खाते सापडले नाही. कृपया शाखा मास्टरमध्ये रोख लेजर तपासा. (Cash ledger not found for this branch.)");
                        }
                        creditLedgerId = cashLedgerId;
                    }
                    else if (string.Equals(request.Purchase.PaymentMode, "Credit", StringComparison.OrdinalIgnoreCase) && request.CreditLedgerID.HasValue && request.CreditLedgerID.Value > 0)
                    {
                        creditLedgerId = request.CreditLedgerID.Value;
                    }
                    else
                    {
                        await transaction.RollbackAsync();
                        return BadRequest("क्रेडिट लेजर किंवा बँक खाते देणे आवश्यक आहे. (Credit ledger or bank ledger is required based on payment mode.)");
                    }

                    string voucherType = string.Equals(request.Purchase.PaymentMode, "Credit", StringComparison.OrdinalIgnoreCase) ? "Journal" : "Payment";
                    string voucherNo = await GenerateVoucherNo(request.Purchase.BranchID, voucherType);

                    var voucher = new Voucher
                    {
                        BranchID = request.Purchase.BranchID,
                        VoucherNo = voucherNo,
                        VoucherDate = request.Purchase.InvoiceDate,
                        VoucherType = voucherType,
                        Status = "Pending",
                        Narration = $"मालमत्ता खरेदी (Asset Purchase): {request.AssetName} x{request.Quantity} from {request.Purchase.SupplierName}, बिल क्र: {request.Purchase.InvoiceNo}",
                        TotalAmount = request.Purchase.TotalAmount,
                        CreatedBy = request.Purchase.CreatedBy,
                        CreatedOn = DateTime.Now,
                        VoucherDetails = new List<VoucherDetail>()
                    };

                    // Debit Asset Ledger (matching exact sum of Asset.OriginalCost)
                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = request.DebitLedgerID.Value,
                        DrCr = "Dr",
                        Amount = totalCapitalizedAssetCost
                    });

                    // Debit separate Input GST Ledger when explicitly supplied
                    if (bookSeparateGst)
                    {
                        voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = request.GstLedgerID!.Value,
                            DrCr = "Dr",
                            Amount = request.Purchase.GstAmount
                        });
                    }

                    // Credit Cash/Bank/Supplier Ledger
                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = creditLedgerId,
                        DrCr = "Cr",
                        Amount = request.Purchase.TotalAmount
                    });

                    Helpers.VoucherBalanceHelper.EnsureBalanced(voucher);
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

            int count = await Helpers.VoucherNumberHelper.NextSequenceAsync(_context, $"{branchCode}-{typeCode}-{fy}-", 5);
            return $"{branchCode}-{typeCode}-{fy}-{count:D5}";
        }

        // GET: api/AssetPurchases/by-voucher/{voucherId}
        [HttpGet("by-voucher/{voucherId}")]
        public async Task<IActionResult> GetByVoucher(int voucherId)
        {
            var voucher = await _context.Vouchers
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Ledger)
                .FirstOrDefaultAsync(v => v.VoucherID == voucherId);

            if (voucher == null)
            {
                return NotFound(new { message = "व्हाउचर सापडले नाही." });
            }

            var purchase = await _context.AssetPurchases
                .Include(p => p.Branch)
                .Include(p => p.BankLedger)
                .FirstOrDefaultAsync(p => p.VoucherID == voucherId);

            return Ok(new
            {
                voucher = new
                {
                    voucher.VoucherID,
                    voucher.VoucherNo,
                    voucher.VoucherDate,
                    voucher.VoucherType,
                    voucher.Status,
                    voucher.Narration,
                    voucher.TotalAmount
                },
                canPass = voucher.Status == "Pending" || voucher.Status == "Draft" || voucher.Status != "Approved",
                purchase = purchase != null ? new
                {
                    purchase.PurchaseID,
                    purchase.BranchID,
                    BranchName = purchase.Branch?.BranchName,
                    purchase.InvoiceNo,
                    purchase.InvoiceDate,
                    purchase.SupplierName,
                    purchase.TotalAmount,
                    purchase.TaxableAmount,
                    GSTAmount = purchase.GstAmount,
                    purchase.PaymentMode,
                    purchase.BankLedgerID,
                    BankName = purchase.BankLedger?.LedgerName,
                    purchase.AssetIdsJson
                } : null
            });
        }
    }
}
