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
                .Select(s => new {
                    s.SurrenderID,
                    s.BranchID,
                    s.AllotmentID,
                    LockerAccountNo = s.Allotment != null ? s.Allotment.LockerAccountNo : "",
                    LockerNo = s.Allotment != null && s.Allotment.Locker != null ? s.Allotment.Locker.LockerNo : "",
                    MemberName = s.Allotment != null && s.Allotment.Member != null ? $"{s.Allotment.Member.FirstName} {s.Allotment.Member.LastName}" : "",
                    s.SurrenderDate,
                    s.KeyReceived,
                    s.KeysCondition,
                    s.DepositAmount,
                    s.UnpaidRentDeduction,
                    s.DamagePenaltyDeduction,
                    s.NetRefundAmount,
                    s.RefundPaymentMode,
                    s.VoucherID,
                    VoucherNo = s.Voucher != null ? s.Voucher.VoucherNo : "",
                    s.Remarks,
                    s.CreatedAt
                })
                .ToListAsync();

            return Ok(list);
        }

        // POST: api/LockerSurrender
        [HttpPost]
        public async Task<ActionResult<object>> PostSurrender([FromBody] LockerSurrenderCreateDto dto)
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

            if (allotment.Status != "Active")
            {
                return BadRequest(new { message = $"हे लॉकर खाते आधीच बंद किंवा समर्पित केलेले आहे. स्थिती: {allotment.Status}" });
            }

            // Update Allotment and Locker Status
            allotment.Status = "Surrendered";
            if (allotment.Locker != null)
            {
                allotment.Locker.Status = "Available"; // Make locker available for next customer
            }

            int? voucherId = null;
            // Generate Deposit Refund Voucher if refund amount > 0 and GL configured
            if (dto.NetRefundAmount > 0 && allotment.Locker?.LockerType?.DepositLiabilityLedgerID.HasValue == true)
            {
                int cashLedgerId = 1;
                var cashLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("रोख") || l.LedgerName.Contains("Cash"));
                if (cashLedger != null) cashLedgerId = cashLedger.LedgerID;

                int vchCount = await _context.Vouchers.CountAsync() + 1;
                var voucher = new Voucher
                {
                    BranchID = allotment.BranchID,
                    VoucherNo = $"VCH-LKR-REF-{DateTime.Today:yyyyMMdd}-{vchCount:D4}",
                    VoucherDate = dto.SurrenderDate,
                    VoucherType = dto.RefundPaymentMode == "SavingCredit" ? "Journal" : "Payment",
                    TotalAmount = dto.DepositAmount,
                    Narration = $"Locker Surrender & Security Deposit Refund: {allotment.LockerAccountNo} (Locker: {allotment.Locker?.LockerNo}) - {allotment.Member?.FirstName} {allotment.Member?.LastName}. Net Refund: ₹{dto.NetRefundAmount:N2}",
                    Status = "Approved",
                    CreatedBy = 1,
                    VoucherDetails = new List<VoucherDetail>()
                };

                // Debit Locker Deposit Liability Ledger
                voucher.VoucherDetails.Add(new VoucherDetail { 
                    LedgerID = allotment.Locker!.LockerType!.DepositLiabilityLedgerID!.Value, 
                    DrCr = "Dr", 
                    Amount = dto.DepositAmount 
                });

                // Credit Cash or Saving for Net Refund
                voucher.VoucherDetails.Add(new VoucherDetail { 
                    LedgerID = cashLedgerId, 
                    DrCr = "Cr", 
                    Amount = dto.NetRefundAmount 
                });

                // Credit Deductions to Rent / Penalty if any
                if (dto.UnpaidRentDeduction > 0 && allotment.Locker?.LockerType?.RentIncomeLedgerID.HasValue == true)
                {
                    voucher.VoucherDetails.Add(new VoucherDetail { 
                        LedgerID = allotment.Locker!.LockerType!.RentIncomeLedgerID!.Value, 
                        DrCr = "Cr", 
                        Amount = dto.UnpaidRentDeduction 
                    });
                }
                if (dto.DamagePenaltyDeduction > 0 && allotment.Locker?.LockerType?.LateFeeIncomeLedgerID.HasValue == true)
                {
                    voucher.VoucherDetails.Add(new VoucherDetail { 
                        LedgerID = allotment.Locker!.LockerType!.LateFeeIncomeLedgerID!.Value, 
                        DrCr = "Cr", 
                        Amount = dto.DamagePenaltyDeduction 
                    });
                }

                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();
                voucherId = voucher.VoucherID;

                // If SavingCredit, credit to saving account
                if (dto.RefundPaymentMode == "SavingCredit" && allotment.LinkedSavingAccount != null)
                {
                    allotment.LinkedSavingAccount.CurrentBalance += dto.NetRefundAmount;
                    var savingTxn = new SavingTransaction
                    {
                        SavingAccountID = allotment.LinkedSavingAccount.SavingAccountID,
                        CustomerID = allotment.LinkedSavingAccount.CustomerID,
                        TransactionDate = dto.SurrenderDate,
                        TransactionType = "Deposit",
                        Amount = dto.NetRefundAmount,
                        BalanceAfterTxn = allotment.LinkedSavingAccount.CurrentBalance,
                        Narration = $"Locker Deposit Refund Credit: {allotment.LockerAccountNo}",
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

            return Ok(new {
                message = "लॉकर यशस्वीरीत्या समर्पित (Surrender) करण्यात आला व डिपॉझिट परतावा नोंद सेव्ह झाली.",
                surrenderID = surrender.SurrenderID,
                voucherId
            });
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
        public string? Remarks { get; set; }
    }
}
