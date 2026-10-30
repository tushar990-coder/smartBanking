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
    public class LockerSurrenderController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LockerSurrenderController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/LockerSurrender
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetSurrenders([FromQuery] int? branchId)
        {
            var query = _context.LockerSurrenders
                .Include(s => s.Allotment).ThenInclude(a => a!.Locker)
                .Include(s => s.Allotment).ThenInclude(a => a!.Member)
                .Include(s => s.Voucher)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(s => s.BranchID == branchId.Value);
            }

            var list = await query
                .OrderByDescending(s => s.SurrenderDate)
                .Select(s => new
                {
                    s.SurrenderID,
                    s.BranchID,
                    s.AllotmentID,
                    LockerAccountNo = s.Allotment != null ? s.Allotment.LockerAccountNo : "",
                    LockerNo = s.Allotment != null && s.Allotment.Locker != null ? s.Allotment.Locker.LockerNo : "",
                    MemberName = s.Allotment != null && s.Allotment.Customer != null ? $"{s.Allotment.Customer.FirstName} {s.Allotment.Customer.LastName}" : (s.Allotment != null && s.Allotment.Member != null && s.Allotment.Member.Customer != null ? $"{s.Allotment.Member.Customer.FirstName} {s.Allotment.Member.Customer.LastName}" : ""),
                    s.SurrenderDate,
                    s.KeyReceived,
                    s.KeysCondition,
                    s.DepositAmount,
                    s.UnpaidRentDeduction,
                    s.DamagePenaltyDeduction,
                    s.NetRefundAmount,
                    s.RefundPaymentMode,
                    BankLedgerID = (s.RefundPaymentMode == "BankTransfer" || s.RefundPaymentMode == "Bank") && s.Voucher != null ? (s.Voucher.VoucherDetails.Where(d => d.DrCr == "Cr" && d.Ledger != null && (d.Ledger.AccountType == "Bank Account" || d.Ledger.AccountType == "Bank")).Select(d => (int?)d.LedgerID).FirstOrDefault() ?? 0) : 0,
                    s.VoucherID,
                    VoucherNo = s.Voucher != null ? s.Voucher.VoucherNo : "",
                    s.Remarks,
                    s.CreatedAt
                })
                .ToListAsync();

            return Ok(list);
        }

        // GET: api/LockerSurrender/by-voucher/5
        [HttpGet("by-voucher/{voucherId}")]
        public async Task<ActionResult<object>> GetSurrenderByVoucher(int voucherId)
        {
            var s = await _context.LockerSurrenders
                .Include(x => x.Allotment).ThenInclude(a => a!.Locker).ThenInclude(l => l!.LockerType)
                .Include(x => x.Allotment).ThenInclude(a => a!.Customer)
                .Include(x => x.Allotment).ThenInclude(a => a!.Member).ThenInclude(m => m!.Customer)
                .Include(x => x.Voucher).ThenInclude(v => v!.VoucherDetails).ThenInclude(vd => vd.Ledger)
                .FirstOrDefaultAsync(x => x.VoucherID == voucherId);

            if (s == null)
            {
                var voucher = await _context.Vouchers
                    .Include(v => v.VoucherDetails).ThenInclude(vd => vd.Ledger)
                    .FirstOrDefaultAsync(v => v.VoucherID == voucherId);

                if (voucher == null)
                {
                    return NotFound(new { message = "व्हाउचर नोंद सापडली नाही." });
                }

                return Ok(new
                {
                    SurrenderID = 0,
                    BranchID = voucher.BranchID,
                    AllotmentID = 0,
                    LockerAccountNo = "",
                    LockerNo = "",
                    CabinetNo = "",
                    KeyNo = "",
                    LockerTypeName = "",
                    MemberName = "",
                    CustomerCode = "",
                    SurrenderDate = voucher.VoucherDate,
                    KeyReceived = true,
                    KeysCondition = "Good",
                    DepositAmount = voucher.TotalAmount,
                    UnpaidRentDeduction = 0,
                    DamagePenaltyDeduction = 0,
                    NetRefundAmount = voucher.TotalAmount,
                    RefundPaymentMode = voucher.VoucherType == "Journal" ? "SavingCredit" : "Cash",
                    Remarks = voucher.Narration,
                    Voucher = new
                    {
                        voucher.VoucherID,
                        voucher.VoucherNo,
                        voucher.VoucherDate,
                        voucher.VoucherType,
                        voucher.TotalAmount,
                        voucher.Narration,
                        voucher.Status,
                        Details = voucher.VoucherDetails.Select(d => new
                        {
                            d.VoucherDetailID,
                            d.LedgerID,
                            LedgerName = d.Ledger != null ? d.Ledger.LedgerName : "",
                            d.DrCr,
                            d.Amount
                        })
                    }
                });
            }

            return Ok(new
            {
                s.SurrenderID,
                s.BranchID,
                s.AllotmentID,
                LockerAccountNo = s.Allotment != null ? s.Allotment.LockerAccountNo : "",
                LockerNo = s.Allotment != null && s.Allotment.Locker != null ? s.Allotment.Locker.LockerNo : "",
                CabinetNo = s.Allotment != null && s.Allotment.Locker != null ? s.Allotment.Locker.CabinetNo : "",
                KeyNo = s.Allotment != null && s.Allotment.Locker != null ? s.Allotment.Locker.KeyNo : "",
                LockerTypeName = s.Allotment != null && s.Allotment.Locker != null && s.Allotment.Locker.LockerType != null ? s.Allotment.Locker.LockerType.TypeName : "",
                MemberName = s.Allotment != null && s.Allotment.Customer != null
                    ? $"{s.Allotment.Customer.FirstName} {s.Allotment.Customer.LastName}"
                    : (s.Allotment != null && s.Allotment.Member != null && s.Allotment.Member.Customer != null
                        ? $"{s.Allotment.Member.Customer.FirstName} {s.Allotment.Member.Customer.LastName}"
                        : ""),
                CustomerCode = s.Allotment != null && s.Allotment.Customer != null
                    ? (s.Allotment.Customer.CIFNo ?? "")
                    : (s.Allotment != null && s.Allotment.Member != null && s.Allotment.Member.Customer != null
                        ? (s.Allotment.Member.Customer.CIFNo ?? "")
                        : ""),
                s.SurrenderDate,
                s.KeyReceived,
                s.KeysCondition,
                s.DepositAmount,
                s.UnpaidRentDeduction,
                s.DamagePenaltyDeduction,
                s.NetRefundAmount,
                s.RefundPaymentMode,
                BankLedgerID = (s.RefundPaymentMode == "BankTransfer" || s.RefundPaymentMode == "Bank") && s.Voucher != null ? (s.Voucher.VoucherDetails.Where(d => d.DrCr == "Cr" && d.Ledger != null && (d.Ledger.AccountType == "Bank Account" || d.Ledger.AccountType == "Bank")).Select(d => (int?)d.LedgerID).FirstOrDefault() ?? 0) : 0,
                s.Remarks,
                Voucher = s.Voucher != null ? new
                {
                    s.Voucher.VoucherID,
                    s.Voucher.VoucherNo,
                    s.Voucher.VoucherDate,
                    s.Voucher.VoucherType,
                    s.Voucher.TotalAmount,
                    s.Voucher.Narration,
                    s.Voucher.Status,
                    Details = s.Voucher.VoucherDetails.Select(d => new
                    {
                        d.VoucherDetailID,
                        d.LedgerID,
                        LedgerName = d.Ledger != null ? d.Ledger.LedgerName : "",
                        d.DrCr,
                        d.Amount
                    })
                } : null
            });
        }

        // POST: api/LockerSurrender
        [HttpPost]
        public async Task<ActionResult<object>> PostSurrender([FromBody] LockerSurrenderCreateDto dto)
        {
            if (dto == null)
            {
                return BadRequest(new { message = "अवैध लॉकर समर्पण माहिती." });
            }

            if (dto.DepositAmount < 0 || dto.UnpaidRentDeduction < 0 || dto.DamagePenaltyDeduction < 0 || dto.NetRefundAmount < 0)
            {
                return BadRequest(new { message = "रक्कम नकारात्मक (Negative) असू शकत नाही." });
            }

            decimal expectedDeposit = Math.Round(dto.NetRefundAmount + dto.UnpaidRentDeduction + dto.DamagePenaltyDeduction, 2, MidpointRounding.AwayFromZero);
            if (Math.Abs(dto.DepositAmount - expectedDeposit) > 0.01m)
            {
                return BadRequest(new { message = $"डिपॉझिट रक्कम (₹{dto.DepositAmount:N2}) आणि निव्वळ परतावा + थकीत भाडे कपात + नुकसान दंड कपात बेरीज (₹{expectedDeposit:N2}) जुळत नाही." });
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

            if (allotment.Status != "Active")
            {
                return BadRequest(new { message = $"हे लॉकर खाते आधीच बंद किंवा समर्पित केलेले आहे. स्थिती: {allotment.Status}" });
            }

            int refundBankLedgerId = 0;
            if (dto.NetRefundAmount > 0 && Helpers.BankLedgerHelper.IsBankPaymentMode(dto.RefundPaymentMode))
            {
                var bankCheck = await Helpers.BankLedgerHelper.ValidateBankLedgerAsync(_context, dto.BankLedgerID);
                if (!bankCheck.IsValid)
                {
                    return BadRequest(new { message = bankCheck.ErrorMessage });
                }
                refundBankLedgerId = bankCheck.LedgerId;
            }

            int savingLiabilityLedgerId = 0;
            if (dto.NetRefundAmount > 0 && dto.RefundPaymentMode == "SavingCredit")
            {
                if (allotment.LinkedSavingAccount == null)
                {
                    return BadRequest(new { message = "बचत खात्यावर परतावा जमा करण्यासाठी या लॉकर खात्याशी संलग्न बचत खाते सापडले नाही." });
                }

                if (allotment.LinkedSavingAccount.Status == "Closed" || allotment.LinkedSavingAccount.Status == "Frozen")
                {
                    return BadRequest(new { message = $"संलग्न बचत खाते (#{allotment.LinkedSavingAccount.AccountNo}) सध्या '{allotment.LinkedSavingAccount.Status}' स्थितीत असल्यामुळे त्यावर परतावा जमा करता येणार नाही." });
                }

                savingLiabilityLedgerId = await Helpers.SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(_context, allotment.LinkedSavingAccount);
                if (savingLiabilityLedgerId <= 0)
                {
                    return BadRequest(new { message = Helpers.SavingLedgerHelper.GetMissingMappingErrorMessage(allotment.LinkedSavingAccount.AccountNo) });
                }
            }

            int depositLiabilityLedgerId = allotment.Locker?.LockerType?.DepositLiabilityLedgerID ?? 0;
            if (dto.DepositAmount > 0 && depositLiabilityLedgerId <= 0)
            {
                var dynDep = await _context.Ledgers
                    .Include(l => l.AccountGroup)
                    .FirstOrDefaultAsync(l => l.IsActive &&
                        (l.AccountType == "Liabilities" || l.AccountType == "Liability" || (l.AccountGroup != null && l.AccountGroup.NatureOfGroup == "Liabilities")) &&
                        (l.LedgerName.Contains("लॉकर अनामत") || l.LedgerName.Contains("लॉकर डिपॉझिट") || l.LedgerName.Contains("Locker Deposit") || l.LedgerName.Contains("Security Deposit")));
                if (dynDep != null)
                {
                    depositLiabilityLedgerId = dynDep.LedgerID;
                }
                else
                {
                    return BadRequest(new { message = $"लॉकर प्रकारास ('{allotment.Locker?.LockerType?.TypeName ?? allotment.Locker?.LockerNo}') 'डिपॉझिट देयता लेजर' (Deposit Liability Ledger) जोडलेले नाही. कृपया लॉकर प्रकार मास्टरमध्ये जी.एल. लेजर मॅपिंग पूर्ण करा." });
                }
            }

            int rentIncomeLedgerId = allotment.Locker?.LockerType?.RentIncomeLedgerID ?? 0;
            if (dto.UnpaidRentDeduction > 0 && rentIncomeLedgerId <= 0)
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
                    return BadRequest(new { message = $"थकीत भाडे कपात (₹{dto.UnpaidRentDeduction:N2}) नोंदवण्यासाठी लॉकर प्रकारास 'भाडे उत्पन्न लेजर' (Rent Income Ledger) जोडलेले नाही." });
                }
            }

            int penaltyLedgerId = allotment.Locker?.LockerType?.LateFeeIncomeLedgerID ?? 0;
            if (dto.DamagePenaltyDeduction > 0 && penaltyLedgerId <= 0)
            {
                var dynPenalty = await _context.Ledgers
                    .Include(l => l.AccountGroup)
                    .FirstOrDefaultAsync(l => l.IsActive &&
                        (l.AccountType == "Income" || l.AccountType == "Revenue" || (l.AccountGroup != null && (l.AccountGroup.NatureOfGroup == "Income" || l.AccountGroup.NatureOfGroup == "Revenue"))) &&
                        (l.LedgerName.Contains("लॉकर दंड") || l.LedgerName.Contains("विलंब") || l.LedgerName.Contains("Late Fee") || l.LedgerName.Contains("दंड") || l.LedgerName.Contains("Penalty")));
                if (dynPenalty != null)
                {
                    penaltyLedgerId = dynPenalty.LedgerID;
                }
                else
                {
                    return BadRequest(new { message = $"नुकसान/चावी दंड कपात (₹{dto.DamagePenaltyDeduction:N2}) नोंदवण्यासाठी लॉकर प्रकारास 'दंड उत्पन्न लेजर' (Late Fee / Penalty Income Ledger) जोडलेले नाही." });
                }
            }

            int refundCreditLedgerId = 0;
            if (dto.NetRefundAmount > 0)
            {
                if (dto.RefundPaymentMode == "SavingCredit")
                {
                    refundCreditLedgerId = savingLiabilityLedgerId;
                }
                else if (refundBankLedgerId > 0)
                {
                    refundCreditLedgerId = refundBankLedgerId;
                }
                else
                {
                    refundCreditLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, allotment.BranchID, "LOCKER");
                    if (refundCreditLedgerId <= 0)
                    {
                        return BadRequest(new { message = "या शाखेसाठी रोख शिल्लक लेजर सापडले नाही. कृपया शाखा मास्टरमध्ये रोख खाते तपासा." });
                    }
                }
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Update Allotment and Locker Status
                allotment.Status = "Surrendered";
                if (allotment.Locker != null)
                {
                    allotment.Locker.Status = "Available";
                }

                int? voucherId = null;

                // Generate Deposit Refund / Forfeiture Voucher whenever DepositAmount > 0
                // (Even if NetRefundAmount == 0 and 100% of deposit is adjusted into unpaid rent / damage penalty!)
                if (dto.DepositAmount > 0)
                {
                    int? allotmentCustomerId = allotment.CustomerID ?? allotment.Member?.CustomerID;
                    int? creditCustomerId = dto.RefundPaymentMode == "SavingCredit"
                        ? allotment.LinkedSavingAccount?.CustomerID
                        : allotmentCustomerId;

                    string holderName = allotment.Customer != null
                        ? $"{allotment.Customer.FirstName} {allotment.Customer.LastName}".Trim()
                        : (allotment.Member?.Customer != null
                            ? $"{allotment.Member.Customer.FirstName} {allotment.Member.Customer.LastName}".Trim()
                            : "Holder");

                    string voucherType = (dto.NetRefundAmount == 0 || dto.RefundPaymentMode == "SavingCredit")
                        ? "Journal"
                        : "Payment";

                    string refSuffix = !string.IsNullOrWhiteSpace(dto.ReferenceNo) ? $" [संदर्भ: {dto.ReferenceNo.Trim()}]" : "";
                    string vchNo = await Helpers.VoucherNumberHelper.NextVoucherNoAsync(_context, $"VCH-LKR-REF-{dto.SurrenderDate:yyyyMMdd}-", 4);

                    var voucher = new Voucher
                    {
                        BranchID = allotment.BranchID,
                        VoucherNo = vchNo,
                        VoucherDate = dto.SurrenderDate,
                        VoucherType = voucherType,
                        TotalAmount = dto.DepositAmount,
                        Narration = $"Locker Surrender & Security Deposit Settlement: {allotment.LockerAccountNo} (Locker: {allotment.Locker?.LockerNo}) - {holderName}. Net Refund: ₹{dto.NetRefundAmount:N2}{refSuffix}",
                        Status = "Pending",
                        CreatedBy = 1,
                        VoucherDetails = new List<VoucherDetail>()
                    };

                    // Debit Locker Deposit Liability Ledger
                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = depositLiabilityLedgerId,
                        DrCr = "Dr",
                        Amount = dto.DepositAmount,
                        CustomerID = allotmentCustomerId,
                        MemberID = allotment.MemberID
                    });

                    // Credit Cash / Bank / Saving Liability for Net Refund (only when NetRefundAmount > 0)
                    if (dto.NetRefundAmount > 0)
                    {
                        voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = refundCreditLedgerId,
                            DrCr = "Cr",
                            Amount = dto.NetRefundAmount,
                            CustomerID = dto.RefundPaymentMode == "SavingCredit" ? creditCustomerId : null,
                            MemberID = null
                        });
                    }

                    // Credit Unpaid Rent Deduction
                    if (dto.UnpaidRentDeduction > 0)
                    {
                        voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = rentIncomeLedgerId,
                            DrCr = "Cr",
                            Amount = dto.UnpaidRentDeduction
                        });
                    }

                    // Credit Damage / Key Penalty Deduction
                    if (dto.DamagePenaltyDeduction > 0)
                    {
                        voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = penaltyLedgerId,
                            DrCr = "Cr",
                            Amount = dto.DamagePenaltyDeduction
                        });
                    }

                    Helpers.VoucherBalanceHelper.EnsureBalanced(voucher);
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();
                    voucherId = voucher.VoucherID;

                    // If SavingCredit and NetRefundAmount > 0, credit to saving account
                    if (dto.NetRefundAmount > 0 && dto.RefundPaymentMode == "SavingCredit" && allotment.LinkedSavingAccount != null)
                    {
                        allotment.LinkedSavingAccount.CurrentBalance += dto.NetRefundAmount;
                        var savingTxn = new SavingTransaction
                        {
                            SavingAccountID = allotment.LinkedSavingAccount.SavingAccountID,
                            CustomerID = allotment.LinkedSavingAccount.CustomerID,
                            BranchID = allotment.BranchID > 0 ? allotment.BranchID : allotment.LinkedSavingAccount.BranchID,
                            TransactionDate = dto.SurrenderDate,
                            TransactionType = "Deposit",
                            Amount = dto.NetRefundAmount,
                            BalanceAfterTxn = allotment.LinkedSavingAccount.CurrentBalance,
                            Narration = $"Locker Deposit Refund Credit: {allotment.LockerAccountNo}",
                            VoucherNo = voucher.VoucherNo,
                            PaymentMode = "Transfer",
                            CreatedOn = DateTime.UtcNow
                        };
                        _context.SavingTransactions.Add(savingTxn);
                    }
                }

                var surrender = new LockerSurrender
                {
                    BranchID = allotment.BranchID,
                    AllotmentID = allotment.AllotmentID,
                    SurrenderDate = dto.SurrenderDate,
                    KeyReceived = dto.KeyReceived,
                    KeysCondition = dto.KeysCondition,
                    DepositAmount = dto.DepositAmount,
                    UnpaidRentDeduction = dto.UnpaidRentDeduction,
                    DamagePenaltyDeduction = dto.DamagePenaltyDeduction,
                    NetRefundAmount = dto.NetRefundAmount,
                    RefundPaymentMode = dto.RefundPaymentMode,
                    VoucherID = voucherId,
                    Remarks = dto.Remarks,
                    CreatedAt = DateTime.Now
                };

                _context.LockerSurrenders.Add(surrender);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                return Ok(new
                {
                    message = "लॉकर यशस्वीरीत्या समर्पित (Surrender) करण्यात आला व डिपॉझिट परतावा नोंद सेव्ह झाली.",
                    surrenderID = surrender.SurrenderID,
                    voucherId
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { message = $"लॉकर समर्पण सेव्ह करताना त्रुटी: {ex.Message}" });
            }
        }
    }

    public class LockerSurrenderCreateDto
    {
        public int AllotmentID { get; set; }
        public DateTime SurrenderDate { get; set; } = DateTime.Today;
        public bool KeyReceived { get; set; } = true;
        public string KeysCondition { get; set; } = "Good";
        public decimal DepositAmount { get; set; }
        public decimal UnpaidRentDeduction { get; set; }
        public decimal DamagePenaltyDeduction { get; set; }
        public decimal NetRefundAmount { get; set; }
        public string RefundPaymentMode { get; set; } = "Cash"; // Cash, SavingCredit, BankTransfer
        public int? BankLedgerID { get; set; }
        public string? ReferenceNo { get; set; }
        public string? Remarks { get; set; }
    }
}
