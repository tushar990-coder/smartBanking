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
                .Include(a => a.Customer)
                .Include(a => a.Member).ThenInclude(m => m!.Customer)
                .Include(a => a.LinkedSavingAccount)
                .Where(a => a.Status == "Active" && a.ExpiryDate <= targetDate)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(a => a.BranchID == branchId.Value);
            }

            var today = DateTime.Today;
            var allSavingSchemes = await _context.SavingInterestSettings
                .AsNoTracking()
                .OrderByDescending(s => s.EffectiveDate <= today)
                .ThenByDescending(s => s.EffectiveDate)
                .ThenByDescending(s => s.SettingID)
                .ToListAsync();

            var list = await query
                .OrderBy(a => a.ExpiryDate)
                .ToListAsync();

            var result = list.Select(a =>
            {
                var overdueMonths = 0;
                if (DateTime.Today > a.ExpiryDate)
                {
                    overdueMonths = ((DateTime.Today.Year - a.ExpiryDate.Year) * 12) + DateTime.Today.Month - a.ExpiryDate.Month;
                    if (overdueMonths < 1) overdueMonths = 1;
                }

                decimal lateFee = overdueMonths * (a.Locker?.LockerType?.LateFeePerMonth ?? 0);
                decimal baseRent = a.AnnualRent;
                decimal gstRate = a.Locker?.LockerType?.GstRate ?? 0;
                decimal subTotal = baseRent + lateFee;
                decimal gstAmount = Math.Round((subTotal * gstRate) / 100, 2);
                decimal totalPayable = subTotal + gstAmount;

                decimal sbCurrent = a.LinkedSavingAccount?.CurrentBalance ?? 0m;
                decimal sbLien = a.LinkedSavingAccount?.LienAmount ?? 0m;
                SavingInterestSetting? matchedSbScheme = null;
                if (a.LinkedSavingAccount != null)
                {
                    matchedSbScheme = (a.LinkedSavingAccount.SavingSchemeID.HasValue && a.LinkedSavingAccount.SavingSchemeID.Value > 0
                        ? allSavingSchemes.FirstOrDefault(s => s.SettingID == a.LinkedSavingAccount.SavingSchemeID.Value)
                        : null)
                        ?? (a.LinkedSavingAccount.LedgerID > 0
                            ? allSavingSchemes.FirstOrDefault(s => s.SavingLiabilityLedgerID == a.LinkedSavingAccount.LedgerID || s.LedgerID == a.LinkedSavingAccount.LedgerID)
                            : null)
                        ?? (allSavingSchemes.Count == 1 ? allSavingSchemes[0] : null);
                }
                decimal sbMinBal = a.LinkedSavingAccount != null
                    ? Helpers.SavingLedgerHelper.ResolveEffectiveMinimumBalance(a.LinkedSavingAccount, matchedSbScheme)
                    : 0m;
                decimal sbAvailBal = a.LinkedSavingAccount != null
                    ? Math.Max(0m, sbCurrent - sbLien - sbMinBal)
                    : 0m;

                return new
                {
                    a.AllotmentID,
                    a.BranchID,
                    a.LockerAccountNo,
                    a.LockerID,
                    LockerNo = a.Locker?.LockerNo ?? "",
                    CabinetNo = a.Locker?.CabinetNo ?? "",
                    KeyNo = a.Locker?.KeyNo ?? "",
                    TypeName = a.Locker?.LockerType?.TypeName ?? "",
                    a.CustomerID,
                    a.MemberID,
                    MemberNo = a.Member != null ? (a.Member.MemberCode ?? a.Member.MemberID.ToString()) : "",
                    LegacyMemberNo = a.Member != null ? (a.Member.LegacyMemberNo ?? "") : "",
                    LegacyCustomerNo = a.Customer != null ? (a.Customer.LegacyCustomerNo ?? "") : (a.Member?.Customer != null ? (a.Member.Customer.LegacyCustomerNo ?? "") : ""),
                    CIFNo = a.Customer != null ? (a.Customer.CIFNo ?? "") : (a.Member?.Customer != null ? (a.Member.Customer.CIFNo ?? "") : ""),
                    MemberName = a.Customer != null ? $"{a.Customer.FirstName} {a.Customer.LastName}" : (a.Member?.Customer != null ? $"{a.Member.Customer.FirstName} {a.Member.Customer.LastName}" : ""),
                    MemberPhone = a.Customer?.MobileNo ?? a.Member?.Customer?.MobileNo ?? "",
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
                    SavingsBalance = sbCurrent,
                    SavingsMinimumBalance = sbMinBal,
                    SavingsLienAmount = sbLien,
                    AvailableSavingsBalance = sbAvailBal
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
                .Include(a => a.Customer)
                .Include(a => a.Member).ThenInclude(m => m!.Customer)
                .Include(a => a.LinkedSavingAccount)
                .FirstOrDefaultAsync(a => a.AllotmentID == dto.AllotmentID);

            if (allotment == null)
            {
                return BadRequest(new { message = "लॉकर खाते सापडले नाही." });
            }

            var fromDate = allotment.ExpiryDate;
            var toDate = fromDate.AddYears(1).AddDays(-1);

            int cashLedgerId = 1;
            cashLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, allotment.BranchID, "LOCKER");
            var cashLedger = (Ledger?)null;
            if (cashLedger != null) cashLedgerId = cashLedger.LedgerID;

            int debitLedgerId = cashLedgerId;
            if (dto.PaymentMode == "Bank" || dto.PaymentMode == "Transfer" || Helpers.BankLedgerHelper.IsBankPaymentMode(dto.PaymentMode)) { var bankCheck = await Helpers.BankLedgerHelper.ValidateBankLedgerAsync(_context, dto.BankLedgerID); if (!bankCheck.IsValid) return BadRequest(new { message = bankCheck.ErrorMessage }); debitLedgerId = bankCheck.LedgerId; } else if (dto.PaymentMode == "SavingDebit" && allotment.LinkedSavingAccount != null) { var savLiab = await Helpers.SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(_context, allotment.LinkedSavingAccount); if (savLiab <= 0) return BadRequest(new { message = Helpers.SavingLedgerHelper.GetMissingMappingErrorMessage(allotment.LinkedSavingAccount.AccountNo) }); debitLedgerId = savLiab; }

            // If paying through Savings Account, deduct from savings
            if (dto.PaymentMode == "SavingDebit" && allotment.LinkedSavingAccount != null)
            {
                var (availSbBal, effSbMinBal) = await Helpers.SavingLedgerHelper.ResolveAvailableBalanceAsync(_context, allotment.LinkedSavingAccount);
                if (availSbBal < dto.TotalAmount)
                {
                    return BadRequest(new { message = $"बचत खात्यात पुरेशी वर्गपात्र शिल्लक नाही. किमान शिल्लक (₹{effSbMinBal:N2}) व तारण वगळता उपलब्ध शिल्लक: ₹{availSbBal:N2}" });
                }

                allotment.LinkedSavingAccount.CurrentBalance -= dto.TotalAmount;
                // Add Saving transaction
                var savingTxn = new SavingTransaction
                {
                    SavingAccountID = allotment.LinkedSavingAccount.SavingAccountID,
                    CustomerID = allotment.LinkedSavingAccount.CustomerID,
                    BranchID = allotment.BranchID > 0 ? allotment.BranchID : allotment.LinkedSavingAccount.BranchID,
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
                string holderName = allotment.Customer != null ? $"{allotment.Customer.FirstName} {allotment.Customer.LastName}" : (allotment.Member?.Customer != null ? $"{allotment.Member.Customer.FirstName} {allotment.Member.Customer.LastName}" : "Member");

                int vchCount = await _context.Vouchers.CountAsync() + 1;
                var voucher = new Voucher
                {
                    BranchID = allotment.BranchID,
                    VoucherNo = $"VCH-LKR-REN-{DateTime.Today:yyyyMMdd}-{vchCount:D4}",
                    VoucherDate = dto.PaymentDate,
                    VoucherType = dto.PaymentMode == "SavingDebit" ? "Journal" : "Receipt",
                    TotalAmount = dto.TotalAmount,
                    Narration = $"Locker Rent Renewal: {allotment.LockerAccountNo} (Locker No: {allotment.Locker?.LockerNo}) for period {fromDate:dd/MM/yyyy} to {toDate:dd/MM/yyyy}. Member: {holderName}",
                    Status = "Pending",
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

            return Ok(new
            {
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
                .Include(a => a.Customer)
                .Include(a => a.Member).ThenInclude(m => m!.Customer)
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
                string holderName = a.Customer != null ? $"{a.Customer.FirstName} {a.Customer.LastName}" : (a.Member?.Customer != null ? $"{a.Member.Customer.FirstName} {a.Member.Customer.LastName}" : "Member");

                decimal autoAvailSb = a.LinkedSavingAccount != null
                    ? (await Helpers.SavingLedgerHelper.ResolveAvailableBalanceAsync(_context, a.LinkedSavingAccount)).AvailableBalance
                    : 0m;

                if (a.LinkedSavingAccount == null || autoAvailSb < a.AnnualRent)
                {
                    failedCount++;
                    details.Add(new
                    {
                        a.LockerAccountNo,
                        MemberName = holderName,
                        Status = "Failed",
                        Reason = $"अपुरी वर्गपात्र शिल्लक (किमान शिल्लक व तारण वगळता उपलब्ध: ₹{autoAvailSb:N2})"
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
                    details.Add(new
                    {
                        a.LockerAccountNo,
                        MemberName = holderName,
                        Status = "Success",
                        Amount = a.AnnualRent
                    });
                }
                catch (Exception ex)
                {
                    failedCount++;
                    details.Add(new
                    {
                        a.LockerAccountNo,
                        MemberName = holderName,
                        Status = "Failed",
                        Reason = ex.Message
                    });
                }
            }

            return Ok(new
            {
                message = $"ऑटो-डेबिट प्रक्रिया पूर्ण: {successCount} यशस्वी, {failedCount} अयशस्वी.",
                successCount,
                failedCount,
                details
            });
        }

        // GET: api/LockerRent/by-voucher/{voucherId}
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

            var rentPosting = await _context.LockerRentPostings
                .Include(r => r.Allotment).ThenInclude(a => a!.Locker).ThenInclude(l => l!.LockerType)
                .Include(r => r.Allotment).ThenInclude(a => a!.Customer)
                .Include(r => r.Allotment).ThenInclude(a => a!.Member).ThenInclude(m => m!.Customer)
                .Include(r => r.Allotment).ThenInclude(a => a!.LinkedSavingAccount)
                .FirstOrDefaultAsync(r => r.VoucherID == voucherId);

            LockerAllotment? allotment = rentPosting?.Allotment;

            if (allotment == null && !string.IsNullOrEmpty(voucher.Narration))
            {
                var match = System.Text.RegularExpressions.Regex.Match(voucher.Narration, @"(LKR-\d{2}-\d{4})");
                if (match.Success)
                {
                    var accNo = match.Groups[1].Value;
                    allotment = await _context.LockerAllotments
                        .Include(a => a.Locker).ThenInclude(l => l!.LockerType)
                        .Include(a => a.Customer)
                        .Include(a => a.Member).ThenInclude(m => m!.Customer)
                        .Include(a => a.LinkedSavingAccount)
                        .FirstOrDefaultAsync(a => a.LockerAccountNo == accNo);
                }
            }

            var memberName = allotment?.Customer != null
                ? $"{allotment.Customer.FirstName} {allotment.Customer.LastName}".Trim()
                : (allotment?.Member?.Customer != null
                    ? $"{allotment.Member.Customer.FirstName} {allotment.Member.Customer.LastName}".Trim()
                    : "Member");

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
                rentPosting = rentPosting != null ? new
                {
                    rentPosting.PostingID,
                    rentPosting.AllotmentID,
                    rentPosting.FinancialYear,
                    rentPosting.FromDate,
                    rentPosting.ToDate,
                    rentPosting.RentAmount,
                    rentPosting.GstAmount,
                    rentPosting.PenaltyAmount,
                    rentPosting.TotalAmount,
                    rentPosting.PaymentMode,
                    rentPosting.PaymentDate,
                    rentPosting.ReceiptNo,
                    rentPosting.Remarks
                } : null,
                allotment = allotment != null ? new
                {
                    allotment.AllotmentID,
                    allotment.BranchID,
                    allotment.LockerAccountNo,
                    allotment.LockerID,
                    LockerNo = allotment.Locker?.LockerNo,
                    CabinetNo = allotment.Locker?.CabinetNo,
                    KeyNo = allotment.Locker?.KeyNo,
                    TypeName = allotment.Locker?.LockerType?.TypeName,
                    allotment.CustomerID,
                    allotment.MemberID,
                    MemberNo = allotment.Member != null ? (allotment.Member.MemberCode ?? allotment.Member.MemberID.ToString()) : "",
                    MemberName = memberName,
                    MemberPhone = allotment.Customer?.MobileNo ?? allotment.Member?.Customer?.MobileNo,
                    allotment.ExpiryDate,
                    AnnualRent = allotment.AnnualRent
                } : null
            });
        }
    }

    public class RentCollectionDto
    {
        public int AllotmentID { get; set; }
        public DateTime PaymentDate { get; set; } = DateTime.Today;
        public string PaymentMode { get; set; } = "Cash"; // Cash, SavingDebit, Bank
        public int? BankLedgerID { get; set; }
        public string? ReferenceNo { get; set; }
        public decimal RentAmount { get; set; }
        public decimal GstAmount { get; set; }
        public decimal PenaltyAmount { get; set; }
        public decimal TotalAmount { get; set; }
        public string? Remarks { get; set; }
    }
}
