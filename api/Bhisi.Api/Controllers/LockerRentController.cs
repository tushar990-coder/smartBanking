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
    public class LockerRentController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LockerRentController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/LockerRent/PendingRenewals
        [HttpGet("PendingRenewals")]
        public async Task<ActionResult<IEnumerable<object>>> GetPendingRenewals([FromQuery] int? branchId, [FromQuery] DateTime? upToDate)
        {
            var targetDate = upToDate?.Date ?? DateTime.Today.AddDays(30);

            var query = _context.LockerAllotments
                .Include(a => a.Locker).ThenInclude(l => l!.LockerType)
                .Include(a => a.Member)
                .Include(a => a.LinkedSavingAccount)
                .Where(a => a.Status == "Active" && a.ExpiryDate <= targetDate)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(a => a.BranchID == branchId.Value);
            }

            var list = await query
                .OrderBy(a => a.ExpiryDate)
                .ToListAsync();

            var result = list.Select(a => {
                var overdueMonths = 0;
                if (DateTime.Today > a.ExpiryDate)
                {
                    overdueMonths = ((DateTime.Today.Year - a.ExpiryDate.Year) * 12) + DateTime.Today.Month - a.ExpiryDate.Month;
                    if (overdueMonths < 1) overdueMonths = 1;
                }

                decimal lateFee = overdueMonths * (a.Locker?.LockerType?.LateFeePerMonth ?? 0);
                decimal baseRent = a.AnnualRent;
                decimal gstRate = a.Locker?.LockerType?.GstRate ?? 0;
                decimal gstAmount = gstRate > 0 ? Math.Round((baseRent * gstRate) / 100, 2) : 0;
                decimal totalPayable = baseRent + gstAmount + lateFee;

                return new {
                    a.AllotmentID,
                    a.BranchID,
                    a.LockerAccountNo,
                    a.LockerID,
                    LockerNo = a.Locker?.LockerNo ?? "",
                    CabinetNo = a.Locker?.CabinetNo ?? "",
                    KeyNo = a.Locker?.KeyNo ?? "",
                    TypeName = a.Locker?.LockerType?.TypeName ?? "",
                    a.MemberID,
                    MemberNo = a.Member != null ? (a.Member.MemberCode ?? a.Member.MemberID.ToString()) : "",
                    MemberName = a.Member != null ? $"{a.Member.FirstName} {a.Member.LastName}" : "",
                    MemberPhone = a.Member?.MobileNo ?? "",
                    a.ExpiryDate,
                    IsOverdue = a.ExpiryDate < DateTime.Today,
                    OverdueDays = (DateTime.Today - a.ExpiryDate).Days > 0 ? (DateTime.Today - a.ExpiryDate).Days : 0,
                    OverdueMonths = overdueMonths,
                    BaseRent = baseRent,
                    LateFee = lateFee,
                    GstAmount = gstAmount,
                    TotalPayable = totalPayable,
                    a.LinkedSavingAccountID,
                    LinkedSavingAccountNo = a.LinkedSavingAccount?.AccountNo ?? "",
                    a.IsAutoDebitEnabled,
                    SavingsBalance = a.LinkedSavingAccount?.CurrentBalance ?? 0
                };
            });

            return Ok(result);
        }

        // POST: api/LockerRent/Collect
        [HttpPost("Collect")]
        public async Task<ActionResult<object>> CollectRent([FromBody] RentCollectionDto dto)
        {
            var allotment = await _context.LockerAllotments
                .Include(a => a.Locker).ThenInclude(l => l!.LockerType)
                .Include(a => a.Member)
                .Include(a => a.LinkedSavingAccount)
                .FirstOrDefaultAsync(a => a.AllotmentID == dto.AllotmentID);

            if (allotment == null)
            {
                return BadRequest(new { message = "लॉकर खाते सापडले नाही." });
            }

            var fromDate = allotment.ExpiryDate;
            var toDate = fromDate.AddYears(1).AddDays(-1);

            int cashLedgerId = 1;
            var cashLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("रोख") || l.LedgerName.Contains("Cash"));
            if (cashLedger != null) cashLedgerId = cashLedger.LedgerID;

            int debitLedgerId = cashLedgerId;

            // If paying through Savings Account, deduct from savings
            if (dto.PaymentMode == "SavingDebit" && allotment.LinkedSavingAccount != null)
            {
                if (allotment.LinkedSavingAccount.CurrentBalance < dto.TotalAmount)
                {
                    return BadRequest(new { message = $"बचत खात्यात पुरेसे शिल्लक नाही. उपलब्ध शिल्लक: ₹{allotment.LinkedSavingAccount.CurrentBalance:N2}" });
                }

                allotment.LinkedSavingAccount.CurrentBalance -= dto.TotalAmount;
                // Add Saving transaction
                var savingTxn = new SavingTransaction
                {
                    SavingAccountID = allotment.LinkedSavingAccount.SavingAccountID,
                    CustomerID = allotment.LinkedSavingAccount.CustomerID,
                    TransactionDate = dto.PaymentDate,
                    TransactionType = "Withdrawal",
                    Amount = dto.TotalAmount,
                    BalanceAfterTxn = allotment.LinkedSavingAccount.CurrentBalance,
                    Narration = $"Locker Rent Auto-Deduction: {allotment.LockerAccountNo} (Locker: {allotment.Locker?.LockerNo})",
                    PaymentMode = "Transfer",
                    CreatedOn = DateTime.UtcNow
                };
                _context.SavingTransactions.Add(savingTxn);
            }

            int? voucherId = null;
            // Create GL Voucher
            if (allotment.Locker?.LockerType?.RentIncomeLedgerID.HasValue == true)
            {
                int vchCount = await _context.Vouchers.CountAsync() + 1;
                var voucher = new Voucher
                {
                    BranchID = allotment.BranchID,
                    VoucherNo = $"VCH-LKR-REN-{DateTime.Today:yyyyMMdd}-{vchCount:D4}",
                    VoucherDate = dto.PaymentDate,
                    VoucherType = dto.PaymentMode == "SavingDebit" ? "Journal" : "Receipt",
                    TotalAmount = dto.TotalAmount,
                    Narration = $"Locker Rent Renewal: {allotment.LockerAccountNo} (Locker No: {allotment.Locker?.LockerNo}) for period {fromDate:dd/MM/yyyy} to {toDate:dd/MM/yyyy}. Member: {allotment.Member?.FirstName} {allotment.Member?.LastName}",
                    Status = "Approved",
                    CreatedBy = 1,
                    VoucherDetails = new List<VoucherDetail>()
                };

                // Debit line (Cash or Saving/Transfer)
                voucher.VoucherDetails.Add(new VoucherDetail { LedgerID = debitLedgerId, DrCr = "Dr", Amount = dto.TotalAmount });

                // Credit Rent Income
                voucher.VoucherDetails.Add(new VoucherDetail { LedgerID = allotment.Locker!.LockerType!.RentIncomeLedgerID!.Value, DrCr = "Cr", Amount = dto.RentAmount });

                // Credit Late fee if any
                if (dto.PenaltyAmount > 0 && allotment.Locker?.LockerType?.LateFeeIncomeLedgerID.HasValue == true)
                {
                    voucher.VoucherDetails.Add(new VoucherDetail { LedgerID = allotment.Locker!.LockerType!.LateFeeIncomeLedgerID!.Value, DrCr = "Cr", Amount = dto.PenaltyAmount });
                }

                // Credit GST if any
                if (dto.GstAmount > 0 && allotment.Locker?.LockerType?.GstLiabilityLedgerID.HasValue == true)
                {
                    voucher.VoucherDetails.Add(new VoucherDetail { LedgerID = allotment.Locker!.LockerType!.GstLiabilityLedgerID!.Value, DrCr = "Cr", Amount = dto.GstAmount });
                }

                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();
                voucherId = voucher.VoucherID;
            }

            var rentPosting = new LockerRentPosting
            {
                BranchID = allotment.BranchID,
                AllotmentID = allotment.AllotmentID,
                FinancialYear = $"{fromDate.Year}-{(fromDate.Year + 1)}",
                FromDate = fromDate,
                ToDate = toDate,
                RentAmount = dto.RentAmount,
                GstAmount = dto.GstAmount,
                PenaltyAmount = dto.PenaltyAmount,
                TotalAmount = dto.TotalAmount,
                PaymentMode = dto.PaymentMode,
                PaymentDate = dto.PaymentDate,
                ReceiptNo = $"REC-LKR-{allotment.AllotmentID}-{DateTime.Today:yyyyMMdd}",
                VoucherID = voucherId,
                IsPaid = true,
                Remarks = dto.Remarks ?? "Annual Rent Renewal Paid",
                CreatedAt = DateTime.Now
            };

            _context.LockerRentPostings.Add(rentPosting);

            // Extend Expiry Date by 1 year
            allotment.ExpiryDate = fromDate.AddYears(1);

            await _context.SaveChangesAsync();

            return Ok(new {
                message = "लॉकर भाडे यशस्वीरीत्या जमा झाले व मुदत १ वर्षाने वाढवली गेली.",
                postingID = rentPosting.PostingID,
                newExpiryDate = allotment.ExpiryDate,
                voucherId
            });
        }

        // POST: api/LockerRent/AutoDebitBatch
        [HttpPost("AutoDebitBatch")]
        public async Task<ActionResult<object>> AutoDebitBatch([FromQuery] int? branchId)
        {
            var eligibleAllotments = await _context.LockerAllotments
                .Include(a => a.Locker).ThenInclude(l => l!.LockerType)
                .Include(a => a.Member)
                .Include(a => a.LinkedSavingAccount)
                .Where(a => a.Status == "Active" && 
                            a.IsAutoDebitEnabled && 
                            a.LinkedSavingAccountID.HasValue && 
                            a.ExpiryDate <= DateTime.Today)
                .ToListAsync();

            if (branchId.HasValue && branchId.Value > 0)
            {
                eligibleAllotments = eligibleAllotments.Where(a => a.BranchID == branchId.Value).ToList();
            }

            int successCount = 0;
            int failedCount = 0;
            var details = new List<object>();

            foreach (var a in eligibleAllotments)
            {
                if (a.LinkedSavingAccount == null || a.LinkedSavingAccount.CurrentBalance < a.AnnualRent)
                {
                    failedCount++;
                    details.Add(new {
                        a.LockerAccountNo,
                        MemberName = $"{a.Member?.FirstName} {a.Member?.LastName}",
                        Status = "Failed",
                        Reason = "अपुरे शिल्लक (Insufficient Balance)"
                    });
                    continue;
                }

                try
                {
                    var rentDto = new RentCollectionDto
                    {
                        AllotmentID = a.AllotmentID,
                        PaymentDate = DateTime.Today,
                        PaymentMode = "SavingDebit",
                        RentAmount = a.AnnualRent,
                        PenaltyAmount = 0,
                        GstAmount = 0,
                        TotalAmount = a.AnnualRent,
                        Remarks = "Auto-Debit Batch Processing"
                    };

                    await CollectRent(rentDto);
                    successCount++;
                    details.Add(new {
                        a.LockerAccountNo,
                        MemberName = $"{a.Member?.FirstName} {a.Member?.LastName}",
                        Status = "Success",
                        Amount = a.AnnualRent
                    });
                }
                catch (Exception ex)
                {
                    failedCount++;
                    details.Add(new {
                        a.LockerAccountNo,
                        MemberName = $"{a.Member?.FirstName} {a.Member?.LastName}",
                        Status = "Failed",
                        Reason = ex.Message
                    });
                }
            }

            return Ok(new {
                message = $"ऑटो-डेबिट प्रक्रिया पूर्ण: {successCount} यशस्वी, {failedCount} अयशस्वी.",
                successCount,
                failedCount,
                details
            });
        }
    }

    public class RentCollectionDto
    {
        public int AllotmentID { get; set; }
        public DateTime PaymentDate { get; set; } = DateTime.Today;
        public string PaymentMode { get; set; } = "Cash"; // Cash, SavingDebit, Transfer
        public decimal RentAmount { get; set; }
        public decimal GstAmount { get; set; }
        public decimal PenaltyAmount { get; set; }
        public decimal TotalAmount { get; set; }
        public string? Remarks { get; set; }
    }
}
