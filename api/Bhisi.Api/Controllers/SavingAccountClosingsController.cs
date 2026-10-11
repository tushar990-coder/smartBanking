using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SavingAccountClosingsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SavingAccountClosingsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/SavingAccountClosings
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetSavingAccountClosings()
        {
            var closings = await _context.SavingAccountClosings
                .Include(c => c.SavingAccount)
                    .ThenInclude(a => a!.Customer)
                .OrderByDescending(c => c.ClosureDate)
                .Select(c => new {
                    c.ClosingID,
                    AccountNo = c.SavingAccount != null ? c.SavingAccount.AccountNo : "",
                    CIFNo = c.SavingAccount != null && c.SavingAccount.Customer != null ? c.SavingAccount.Customer.CIFNo : "",
                    CustomerName = c.SavingAccount != null && c.SavingAccount.Customer != null
                        ? $"{c.SavingAccount.Customer.FirstName} {c.SavingAccount.Customer.LastName}".Trim()
                        : "",
                    c.ClosureDate,
                    c.GrossBalance,
                    c.ClosingCharges,
                    c.NetPayable,
                    c.PaymentMode,
                    c.VoucherNo
                })
                .ToListAsync();

            return Ok(closings);
        }

        // POST: api/SavingAccountClosings
        [HttpPost]
        public async Task<ActionResult<SavingAccountClosing>> PostSavingAccountClosing([FromBody] SavingAccountClosingRequest request)
        {
            var account = await _context.SavingAccountMasters.FindAsync(request.SavingAccountID);
            if (account == null)
            {
                return NotFound("Account not found.");
            }

            if (account.Status == "Closed")
            {
                return BadRequest("Account is already closed.");
            }

            if (account.CurrentBalance < request.ClosingCharges)
            {
                return BadRequest("Account balance is less than the closing charges.");
            }

            if (request.PaymentMode == "Bank" && (!request.BankLedgerID.HasValue || request.BankLedgerID.Value <= 0))
            {
                return BadRequest("बँक व्यवहारासाठी बँक खाते/लेजर (Bank Ledger) निवडणे बंधनकारक आहे.");
            }

            using var dbTransaction = await _context.Database.BeginTransactionAsync();
            try
            {
                decimal grossBalance = account.CurrentBalance;
                decimal netPayable = grossBalance - request.ClosingCharges;
                var now = DateTime.Now;

                // 1. Resolve Ledgers for Double-Entry Accounting
                int savingControlLedgerID = account.LedgerID > 0 ? account.LedgerID : 7;
                int cashBankLedgerID;
                if (request.PaymentMode == "Cash")
                {
                    cashBankLedgerID = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, account.BranchID, "SAVINGS");
                }
                else if (request.PaymentMode == "Bank" && request.BankLedgerID.HasValue && request.BankLedgerID.Value > 0)
                {
                    cashBankLedgerID = request.BankLedgerID.Value;
                }
                else
                {
                    cashBankLedgerID = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, account.BranchID, "SAVINGS");
                }

                // Resolve Closing Charges Income Ledger from SavingVoucherMappings or Ledgers
                var closingChargeMapping = await _context.SavingVoucherMappings
                    .FirstOrDefaultAsync(m => m.OperationType == "ClosingCharges" || m.OperationType == "ClosingCharge");

                int closingChargesLedgerID;
                if (closingChargeMapping != null && closingChargeMapping.LedgerID > 0)
                {
                    closingChargesLedgerID = closingChargeMapping.LedgerID;
                }
                else
                {
                    var closingChargesLedger = await _context.Ledgers
                        .FirstOrDefaultAsync(l => l.LedgerName.Contains("Account Closing") || 
                                                  l.LedgerName.Contains("खाते बंद") || 
                                                  l.LedgerName.Contains("Closing Charges") || 
                                                  l.LedgerName.Contains("Closing Charge") ||
                                                  l.LedgerName.Contains("इतर फी") ||
                                                  l.LedgerName.Contains("Other Charges"))
                        ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.AccountType == "Income" && (l.LedgerName.Contains("Charge") || l.LedgerName.Contains("शुल्क") || l.LedgerName.Contains("फी")));

                    closingChargesLedgerID = closingChargesLedger?.LedgerID ?? 52;
                }

                // 2. Generate Double-Entry Closing Voucher if grossBalance > 0
                string? voucherNo = null;
                if (grossBalance > 0)
                {
                    var branch = await _context.Branches.FindAsync(account.BranchID);
                    string branchCode = branch?.BranchCode ?? "01";
                    var todayStr = DateTime.Now.ToString("yyyyMMdd");
                    var lastVoucher = await _context.Vouchers.OrderByDescending(v => v.VoucherID).FirstOrDefaultAsync();
                    int nextSeq = (lastVoucher?.VoucherID ?? 0) + 1;
                    voucherNo = $"VCH-SAV-CLS-{branchCode}-{todayStr}-{nextSeq:D4}";

                    var customer = account.CustomerID > 0 ? await _context.Customers.FindAsync(account.CustomerID) : null;
                    string customerName = customer != null 
                        ? $"{customer.FirstName} {customer.LastName}".Trim() 
                        : "";

                    var voucher = new Voucher
                    {
                        BranchID = account.BranchID,
                        VoucherNo = voucherNo,
                        VoucherDate = request.ClosureDate,
                        VoucherType = request.PaymentMode == "Cash" ? "Payment" : "Journal",
                        TotalAmount = grossBalance,
                        Narration = $"बचत खाते बंद करणे (अंतिम हिशोब) - खाते क्र. {account.AccountNo} ({customerName}) | एकूण: ₹{grossBalance:N2}, आकार: ₹{request.ClosingCharges:N2}, दिलेली रक्कम: ₹{netPayable:N2}",
                        CreatedBy = request.CreatedBy,
                        VoucherDetails = new List<VoucherDetail>()
                    };

                    // Dr: Saving Liability Ledger = grossBalance (Reduces saving liability)
                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = savingControlLedgerID,
                        DrCr = "Dr",
                        Amount = grossBalance,
                        CustomerID = account.CustomerID
                    });

                    // Cr: Cash / Bank Ledger = netPayable (Payout from drawer/bank)
                    if (netPayable > 0)
                    {
                        voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = cashBankLedgerID,
                            DrCr = "Cr",
                            Amount = netPayable,
                            CustomerID = account.CustomerID
                        });
                    }

                    // Cr: Closing Charges Income Ledger = ClosingCharges (Income fee earned)
                    if (request.ClosingCharges > 0)
                    {
                        voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = closingChargesLedgerID,
                            DrCr = "Cr",
                            Amount = request.ClosingCharges,
                            CustomerID = account.CustomerID
                        });
                    }

                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();
                }

                // 3. Post Charges Transaction if any
                if (request.ClosingCharges > 0)
                {
                    account.CurrentBalance -= request.ClosingCharges;
                    var chargeTxn = new SavingTransaction
                    {
                        SavingAccountID = account.SavingAccountID,
                        CustomerID = account.CustomerID,
                        TransactionDate = request.ClosureDate,
                        TransactionType = "Charges",
                        PaymentMode = request.PaymentMode,
                        Amount = request.ClosingCharges,
                        BalanceAfterTxn = account.CurrentBalance,
                        Narration = "Account Closing Charges",
                        VoucherNo = voucherNo,
                        CreatedBy = request.CreatedBy,
                        CreatedOn = now
                    };
                    _context.SavingTransactions.Add(chargeTxn);
                }

                // 4. Post Withdrawal of the remaining net payable balance
                if (account.CurrentBalance > 0)
                {
                    decimal withdrawalAmt = account.CurrentBalance;
                    account.CurrentBalance = 0;
                    var closingTxn = new SavingTransaction
                    {
                        SavingAccountID = account.SavingAccountID,
                        CustomerID = account.CustomerID,
                        TransactionDate = request.ClosureDate,
                        TransactionType = "Withdrawal",
                        PaymentMode = request.PaymentMode,
                        Amount = withdrawalAmt,
                        BalanceAfterTxn = 0,
                        Narration = "Account Closure Final Settlement",
                        VoucherNo = voucherNo,
                        CreatedBy = request.CreatedBy,
                        CreatedOn = now
                    };
                    _context.SavingTransactions.Add(closingTxn);
                }

                // 5. Update account status
                account.Status = "Closed";
                account.ClosingDate = request.ClosureDate;
                _context.Entry(account).State = EntityState.Modified;

                // 6. Save closing record
                var closing = new SavingAccountClosing
                {
                    SavingAccountID = account.SavingAccountID,
                    CustomerID = account.CustomerID,
                    ClosureDate = request.ClosureDate,
                    GrossBalance = grossBalance,
                    ClosingCharges = request.ClosingCharges,
                    NetPayable = netPayable,
                    PaymentMode = request.PaymentMode,
                    VoucherNo = voucherNo,
                    CreatedBy = request.CreatedBy,
                    CreatedOn = now
                };
                _context.SavingAccountClosings.Add(closing);

                // 7. Security Audit Logging
                _context.AuditLogs.Add(new AuditLog
                {
                    Action = "SAVING_ACCOUNT_CLOSED",
                    EntityName = "SavingAccountMaster",
                    EntityID = account.SavingAccountID.ToString(),
                    Details = $"Closed Saving Account #{account.AccountNo}. Gross: ₹{grossBalance:N2}, Charges: ₹{request.ClosingCharges:N2}, Net Paid: ₹{netPayable:N2}. Voucher: {voucherNo}",
                    Timestamp = DateTime.Now
                });

                await _context.SaveChangesAsync();
                await dbTransaction.CommitAsync();

                return CreatedAtAction("GetSavingAccountClosings", new { id = closing.ClosingID }, closing);
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        // GET: api/SavingAccountClosings/by-voucher/{voucherId}
        [HttpGet("by-voucher/{voucherId}")]
        public async Task<ActionResult<object>> GetSavingAccountClosingByVoucher(int voucherId)
        {
            var voucher = await _context.Vouchers.FindAsync(voucherId);
            if (voucher == null)
            {
                return NotFound(new { message = "व्हाउचर सापडले नाही (Voucher not found)." });
            }

            SavingAccountClosing? closing = null;
            if (!string.IsNullOrEmpty(voucher.VoucherNo))
            {
                closing = await _context.SavingAccountClosings
                    .Include(c => c.SavingAccount)
                        .ThenInclude(s => s!.Customer)
                    .Include(c => c.Customer)
                    .FirstOrDefaultAsync(c => c.VoucherNo == voucher.VoucherNo);
            }

            // Fallback: match by CustomerID
            if (closing == null)
            {
                var custId = voucher.VoucherDetails.FirstOrDefault(d => d.CustomerID.HasValue && d.CustomerID.Value > 0)?.CustomerID;
                if (custId.HasValue)
                {
                    closing = await _context.SavingAccountClosings
                        .Include(c => c.SavingAccount)
                            .ThenInclude(s => s!.Customer)
                        .Include(c => c.Customer)
                        .Where(c => c.CustomerID == custId.Value)
                        .OrderByDescending(c => c.ClosingID)
                        .FirstOrDefaultAsync();
                }
            }

            if (closing == null)
            {
                return NotFound(new { message = "सदर व्हाउचरशी जोडलेली बचत खाते बंद नोंद सापडली नाही." });
            }

            return Ok(new
            {
                closing.ClosingID,
                closing.SavingAccountID,
                closing.CustomerID,
                closing.ClosureDate,
                closing.GrossBalance,
                closing.ClosingCharges,
                closing.NetPayable,
                closing.PaymentMode,
                closing.VoucherNo,
                SavingAccount = closing.SavingAccount != null ? new
                {
                    closing.SavingAccount.SavingAccountID,
                    closing.SavingAccount.AccountNo,
                    closing.SavingAccount.CurrentBalance,
                    closing.SavingAccount.Status,
                    Customer = closing.SavingAccount.Customer != null ? new
                    {
                        closing.SavingAccount.Customer.CustomerID,
                        FullName = $"{closing.SavingAccount.Customer.FirstName} {closing.SavingAccount.Customer.LastName}".Trim(),
                        closing.SavingAccount.Customer.MobileNo,
                        closing.SavingAccount.Customer.CIFNo
                    } : null
                } : null,
                Voucher = new
                {
                    voucher.VoucherID,
                    voucher.VoucherNo,
                    voucher.VoucherDate,
                    voucher.VoucherType,
                    voucher.Narration,
                    voucher.TotalAmount,
                    voucher.Status
                }
            });
        }
    }

    public class SavingAccountClosingRequest
    {
        public int SavingAccountID { get; set; }
        public DateTime ClosureDate { get; set; } = DateTime.Now;
        public decimal ClosingCharges { get; set; } = 0;
        public string PaymentMode { get; set; } = "Cash";
        public int? BankLedgerID { get; set; }
        public int CreatedBy { get; set; } = 1;
    }
}
