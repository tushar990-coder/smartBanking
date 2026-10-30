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
            if (dto == null || dto.TotalAmount <= 0)
            {
                return BadRequest(new { message = "भाड्याची एकूण रक्कम ₹0 पेक्षा जास्त असणे आवश्यक आहे." });
            }

            decimal expectedTotal = Math.Round(dto.RentAmount + dto.PenaltyAmount + dto.GstAmount, 2, MidpointRounding.AwayFromZero);
            if (Math.Abs(dto.TotalAmount - expectedTotal) > 0.01m)
            {
                return BadRequest(new { message = $"भाड्याची एकूण रक्कम (₹{dto.TotalAmount:N2}) आणि भाडे + विलंब शुल्क + GST बेरीज (₹{expectedTotal:N2}) जुळत नाही." });
            }

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

            int debitLedgerId;
            if (string.Equals(dto.PaymentMode, "SavingDebit", StringComparison.OrdinalIgnoreCase))
            {
                if (allotment.LinkedSavingAccount == null)
                {
                    return BadRequest(new { message = "बचत खात्यातून भाडे वजा करण्यासाठी या लॉकर खात्याला कोणतेही बचत खाते जोडलेले नाही." });
                }
                if (allotment.LinkedSavingAccount.Status == "Closed" || allotment.LinkedSavingAccount.Status == "Frozen")
                {
                    return BadRequest(new { message = $"संलग्न बचत खाते (#{allotment.LinkedSavingAccount.AccountNo}) सध्या '{allotment.LinkedSavingAccount.Status}' स्थितीत असल्यामुळे त्यातून भाडे वजा करता येणार नाही." });
                }
                var savLiab = await Helpers.SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(_context, allotment.LinkedSavingAccount);
                if (savLiab <= 0)
                {
                    return BadRequest(new { message = Helpers.SavingLedgerHelper.GetMissingMappingErrorMessage(allotment.LinkedSavingAccount.AccountNo) });
                }
                var (availSbBal, effSbMinBal) = await Helpers.SavingLedgerHelper.ResolveAvailableBalanceAsync(_context, allotment.LinkedSavingAccount);
                if (availSbBal < dto.TotalAmount)
                {
                    return BadRequest(new { message = $"बचत खात्यात पुरेशी वर्गपात्र शिल्लक नाही. किमान शिल्लक (₹{effSbMinBal:N2}) व तारण वगळता उपलब्ध शिल्लक: ₹{availSbBal:N2}" });
                }
                debitLedgerId = savLiab;
            }
            else if (dto.PaymentMode == "Bank" || dto.PaymentMode == "Transfer" || Helpers.BankLedgerHelper.IsBankPaymentMode(dto.PaymentMode))
            {
                var bankCheck = await Helpers.BankLedgerHelper.ValidateBankLedgerAsync(_context, dto.BankLedgerID);
                if (!bankCheck.IsValid)
                {
                    return BadRequest(new { message = bankCheck.ErrorMessage });
                }
                debitLedgerId = bankCheck.LedgerId;
            }
            else
            {
                debitLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, allotment.BranchID, "LOCKER");
                if (debitLedgerId <= 0)
                {
                    return BadRequest(new { message = "या शाखेसाठी रोख शिल्लक लेजर सापडले नाही. कृपया शाखा मास्टरमध्ये रोख खाते तपासा." });
                }
            }

            // Mandatory resolution of Rent Income, Late Fee Income, and GST Liability GL ledgers
            int rentIncomeLedgerId = allotment.Locker?.LockerType?.RentIncomeLedgerID ?? 0;
            if (dto.RentAmount > 0 && rentIncomeLedgerId <= 0)
            {
                var dynRent = await _context.Ledgers
                    .Include(l => l.AccountGroup)
                    .FirstOrDefaultAsync(l => l.IsActive &&
                        (l.AccountType == "Income" || l.AccountType == "Revenue" || (l.AccountGroup != null && (l.AccountGroup.NatureOfGroup == "Income" || l.AccountGroup.NatureOfGroup == "Revenue"))) &&
                        (l.LedgerName.Contains("लॉकर भाडे") || l.LedgerName.Contains("Locker Rent")));
                if (dynRent != null)
                {
                    rentIncomeLedgerId = dynRent.LedgerID;
                }
                else
                {
                    return BadRequest(new { message = $"लॉकर प्रकारास ('{allotment.Locker?.LockerType?.TypeName ?? allotment.Locker?.LockerNo}') 'भाडे उत्पन्न लेजर' (Rent Income Ledger) जोडलेले नाही. कृपया लॉकर प्रकार मास्टरमध्ये जी.एल. लेजर मॅपिंग पूर्ण करा." });
                }
            }

            int lateFeeLedgerId = allotment.Locker?.LockerType?.LateFeeIncomeLedgerID ?? 0;
            if (dto.PenaltyAmount > 0 && lateFeeLedgerId <= 0)
            {
                var dynPenalty = await _context.Ledgers
                    .Include(l => l.AccountGroup)
                    .FirstOrDefaultAsync(l => l.IsActive &&
                        (l.AccountType == "Income" || l.AccountType == "Revenue" || (l.AccountGroup != null && (l.AccountGroup.NatureOfGroup == "Income" || l.AccountGroup.NatureOfGroup == "Revenue"))) &&
                        (l.LedgerName.Contains("लॉकर दंड") || l.LedgerName.Contains("विलंब") || l.LedgerName.Contains("Late Fee") || l.LedgerName.Contains("दंड") || l.LedgerName.Contains("Penalty")));
                if (dynPenalty != null)
                {
                    lateFeeLedgerId = dynPenalty.LedgerID;
                }
                else
                {
                    return BadRequest(new { message = $"विलंब शुल्क/दंड (₹{dto.PenaltyAmount:N2}) आकारण्यासाठी लॉकर प्रकारास 'विलंब शुल्क उत्पन्न लेजर' (Late Fee Income Ledger) जोडलेले नाही. कृपया लॉकर प्रकार मास्टरमध्ये लेजर मॅप करा." });
                }
            }

            int gstLedgerId = allotment.Locker?.LockerType?.GstLiabilityLedgerID ?? 0;
            if (dto.GstAmount > 0 && gstLedgerId <= 0)
            {
                var dynGst = await _context.Ledgers
                    .Include(l => l.AccountGroup)
                    .FirstOrDefaultAsync(l => l.IsActive &&
                        (l.AccountType == "Liabilities" || l.AccountType == "Liability" || l.AccountType == "Duties & Taxes" || (l.AccountGroup != null && l.AccountGroup.NatureOfGroup == "Liabilities")) &&
                        (l.LedgerName.Contains("GST") || l.LedgerName.Contains("जीएसटी") || l.LedgerName.Contains("जी.एस.टी")));
                if (dynGst != null)
                {
                    gstLedgerId = dynGst.LedgerID;
                }
                else
                {
                    return BadRequest(new { message = $"GST रक्कम (₹{dto.GstAmount:N2}) नोंदवण्यासाठी लॉकर प्रकारास 'GST देयता लेजर' (GST Liability Ledger) जोडलेले नाही. कृपया लॉकर प्रकार मास्टरमध्ये GST लेजर मॅप करा." });
                }
            }

            var ownTx = _context.Database.CurrentTransaction == null
                ? await _context.Database.BeginTransactionAsync()
                : null;

            try
            {
                var fromDate = allotment.ExpiryDate;
                var toDate = fromDate.AddYears(1).AddDays(-1);
                bool isSavingDebit = string.Equals(dto.PaymentMode, "SavingDebit", StringComparison.OrdinalIgnoreCase);

                string holderName = allotment.Customer != null
                    ? $"{allotment.Customer.FirstName} {allotment.Customer.LastName}".Trim()
                    : (allotment.Member?.Customer != null
                        ? $"{allotment.Member.Customer.FirstName} {allotment.Member.Customer.LastName}".Trim()
                        : "Member");

                string refSuffix = !string.IsNullOrWhiteSpace(dto.ReferenceNo) ? $" [संदर्भ: {dto.ReferenceNo.Trim()}]" : "";
                string vchNo = await Helpers.VoucherNumberHelper.NextVoucherNoAsync(_context, $"VCH-LKR-REN-{dto.PaymentDate:yyyyMMdd}-", 4);

                var voucher = new Voucher
                {
                    BranchID = allotment.BranchID,
                    VoucherNo = vchNo,
                    VoucherDate = dto.PaymentDate,
                    VoucherType = isSavingDebit ? "Journal" : "Receipt",
                    TotalAmount = dto.TotalAmount,
                    Narration = $"Locker Rent Renewal: {allotment.LockerAccountNo} (Locker No: {allotment.Locker?.LockerNo}) for period {fromDate:dd/MM/yyyy} to {toDate:dd/MM/yyyy}. Member: {holderName}{refSuffix}",
                    Status = "Pending",
                    CreatedBy = 1,
                    VoucherDetails = new List<VoucherDetail>()
                };

                // Debit line (Cash / Bank / Saving Liability)
                voucher.VoucherDetails.Add(new VoucherDetail
                {
                    LedgerID = debitLedgerId,
                    DrCr = "Dr",
                    Amount = dto.TotalAmount,
                    CustomerID = isSavingDebit ? allotment.LinkedSavingAccount?.CustomerID : null
                });

                // Credit Rent Income
                if (dto.RentAmount > 0)
                {
                    voucher.VoucherDetails.Add(new VoucherDetail { LedgerID = rentIncomeLedgerId, DrCr = "Cr", Amount = dto.RentAmount });
                }

                // Credit Late Fee Income
                if (dto.PenaltyAmount > 0)
                {
                    voucher.VoucherDetails.Add(new VoucherDetail { LedgerID = lateFeeLedgerId, DrCr = "Cr", Amount = dto.PenaltyAmount });
                }

                // Credit GST Liability
                if (dto.GstAmount > 0)
                {
                    voucher.VoucherDetails.Add(new VoucherDetail { LedgerID = gstLedgerId, DrCr = "Cr", Amount = dto.GstAmount });
                }

                Helpers.VoucherBalanceHelper.EnsureBalanced(voucher);
                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();

                if (isSavingDebit && allotment.LinkedSavingAccount != null)
                {
                    allotment.LinkedSavingAccount.CurrentBalance -= dto.TotalAmount;
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
                        VoucherNo = voucher.VoucherNo,
                        PaymentMode = "Transfer",
                        CreatedOn = DateTime.UtcNow
                    };
                    _context.SavingTransactions.Add(savingTxn);
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
                    ReceiptNo = voucher.VoucherNo,
                    VoucherID = voucher.VoucherID,
                    IsPaid = true,
                    Remarks = dto.Remarks ?? "Annual Rent Renewal Paid",
                    CreatedAt = DateTime.Now
                };

                _context.LockerRentPostings.Add(rentPosting);
                allotment.ExpiryDate = fromDate.AddYears(1);

                await _context.SaveChangesAsync();
                if (ownTx != null)
                {
                    await ownTx.CommitAsync();
                }

                return Ok(new
                {
                    message = "लॉकर भाडे यशस्वीरीत्या जमा झाले व मुदत १ वर्षाने वाढवली गेली.",
                    postingID = rentPosting.PostingID,
                    newExpiryDate = allotment.ExpiryDate,
                    voucherId = voucher.VoucherID
                });
            }
            catch (Exception ex)
            {
                if (ownTx != null)
                {
                    await ownTx.RollbackAsync();
                }
                return BadRequest(new { message = $"लॉकर भाडे जमा करताना त्रुटी: {ex.Message}" });
            }
            finally
            {
                if (ownTx != null)
                {
                    await ownTx.DisposeAsync();
                }
            }
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

                    var collectResult = await CollectRent(rentDto);
                    if (collectResult.Result is BadRequestObjectResult badReq)
                    {
                        failedCount++;
                        details.Add(new
                        {
                            a.LockerAccountNo,
                            MemberName = holderName,
                            Status = "Failed",
                            Reason = badReq.Value?.ToString() ?? "लेजर मॅपिंग किंवा शिल्लक त्रुटी"
                        });
                    }
                    else
                    {
                        successCount++;
                        details.Add(new
                        {
                            a.LockerAccountNo,
                            MemberName = holderName,
                            Status = "Success",
                            Amount = a.AnnualRent
                        });
                    }
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
