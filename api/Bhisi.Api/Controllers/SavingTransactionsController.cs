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
    public class SavingTransactionsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SavingTransactionsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/SavingTransactions
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetSavingTransactions([FromQuery] int? page = null, [FromQuery] int? pageSize = null)
        {
            var query = _context.SavingTransactions
                .Include(t => t.SavingAccount)
                    .ThenInclude(a => a!.Customer)
                        .ThenInclude(c => c!.MemberProfile)
                .OrderByDescending(t => t.TransactionDate)
                .Select(t => new {
                    t.TransactionID,
                    t.TransactionDate,
                    t.TransactionType,
                    t.PaymentMode,
                    t.Amount,
                    t.BalanceAfterTxn,
                    t.Narration,
                    t.VoucherNo,
                    AccountNo = t.SavingAccount != null ? t.SavingAccount.AccountNo : "",
                    MemberName = t.SavingAccount != null 
                        ? (t.SavingAccount.Customer != null 
                            ? (t.SavingAccount.Customer.FirstName + (string.IsNullOrWhiteSpace(t.SavingAccount.Customer.MiddleName) ? "" : " " + t.SavingAccount.Customer.MiddleName) + " " + t.SavingAccount.Customer.LastName).Trim()
                            : (t.SavingAccount.Member != null ? (t.SavingAccount.Member.FirstName + (string.IsNullOrWhiteSpace(t.SavingAccount.Member.MiddleName) ? "" : " " + t.SavingAccount.Member.MiddleName) + " " + t.SavingAccount.Member.LastName).Trim() : ""))
                        : ""
                });

            if (page.HasValue || pageSize.HasValue)
            {
                int p = page ?? 1;
                int ps = pageSize ?? 50;
                if (p < 1) p = 1;
                if (ps < 1 || ps > 500) ps = 50;
                query = query.Skip((p - 1) * ps).Take(ps);
            }

            var txns = await query.ToListAsync();
            return Ok(txns);
        }

        [HttpGet("account/{accountId}")]
        [HttpGet("ByAccount/{accountId}")]
        public async Task<ActionResult<IEnumerable<SavingTransaction>>> GetTransactionsByAccount(int accountId)
        {
            return await _context.SavingTransactions
                .Where(t => t.SavingAccountID == accountId)
                .OrderBy(t => t.TransactionDate)
                .ToListAsync();
        }

        // POST: api/SavingTransactions
        [HttpPost]
        public async Task<ActionResult<SavingTransaction>> PostSavingTransaction(SavingTransaction txn)
        {
            var account = await _context.SavingAccountMasters.FindAsync(txn.SavingAccountID);
            if (account == null)
            {
                return BadRequest("Account not found.");
            }

            if (account.Status == "Closed")
            {
                return BadRequest("Cannot perform transaction on a closed account.");
            }

            if (txn.Amount <= 0)
            {
                return BadRequest("Amount must be greater than zero.");
            }

            SavingAccountMaster? targetAccount = null;
            if (txn.PaymentMode == "Transfer" && txn.TargetSavingAccountID.HasValue)
            {
                if (txn.TargetSavingAccountID.Value == txn.SavingAccountID)
                {
                    return BadRequest("हस्तांतरणासाठी मूळ खाते आणि टार्गेट खाते समान असू शकत नाही.");
                }

                targetAccount = await _context.SavingAccountMasters.FindAsync(txn.TargetSavingAccountID.Value);
                if (targetAccount == null || targetAccount.Status == "Closed")
                {
                    return BadRequest("हस्तांतरणासाठी निवडलेले टार्गेट खाते अमान्य किंवा बंद आहे.");
                }
            }
            else if (txn.PaymentMode == "Bank")
            {
                if (!txn.BankLedgerID.HasValue || txn.BankLedgerID.Value <= 0)
                {
                    return BadRequest("बँक व्यवहारासाठी बँक खाते/लेजर (Bank Ledger) निवडणे बंधनकारक आहे.");
                }

                var bankLedger = await _context.Ledgers.FindAsync(txn.BankLedgerID.Value);
                if (bankLedger == null)
                {
                    return BadRequest("निवडलेले बँक लेजर सापडले नाही.");
                }
            }

            using var dbTransaction = await _context.Database.BeginTransactionAsync();
            try
            {
                if (txn.TransactionType == "Withdrawal")
                {
                    if (account.Status == "Frozen" || account.Status == "Dormant")
                    {
                        return BadRequest($"हे खाते {account.Status} (फ्रीझ/सुप्त) असल्याने यावरून पैसे काढता येणार नाहीत!");
                    }

                    decimal availableBalance = account.CurrentBalance - account.LienAmount - account.MinimumBalance;
                    if (availableBalance < txn.Amount)
                    {
                        decimal maxWithdraw = availableBalance > 0 ? availableBalance : 0;
                        return BadRequest($"अपुऱ्या शिल्लकेमुळे रक्कम काढता येणार नाही! खात्यात तारण होल्ड (₹{account.LienAmount:N2}) व किमान शिल्लक सोडून फक्त ₹{maxWithdraw:N2} उपलब्ध आहेत.");
                    }
                    account.CurrentBalance -= txn.Amount;

                    if (targetAccount != null)
                    {
                        targetAccount.CurrentBalance += txn.Amount;
                    }
                }
                else if (txn.TransactionType == "Deposit" || txn.TransactionType == "Interest")
                {
                    account.CurrentBalance += txn.Amount;

                    if (targetAccount != null)
                    {
                        if (targetAccount.CurrentBalance - txn.Amount < targetAccount.MinimumBalance)
                        {
                            return BadRequest($"टार्गेट खात्यामध्ये अपुरी शिल्लक असल्याने हस्तांतरण करता येत नाही.");
                        }
                        targetAccount.CurrentBalance -= txn.Amount;
                    }
                }
                else if (txn.TransactionType == "Charges")
                {
                    account.CurrentBalance -= txn.Amount;
                }
                else
                {
                    return BadRequest("Invalid Transaction Type.");
                }

                txn.CustomerID = account.CustomerID;
                txn.BalanceAfterTxn = account.CurrentBalance;
                txn.CreatedOn = DateTime.Now;

                _context.SavingTransactions.Add(txn);
                _context.Entry(account).State = EntityState.Modified;

                if (targetAccount != null)
                {
                    var targetTxn = new SavingTransaction
                    {
                        SavingAccountID = targetAccount.SavingAccountID,
                        CustomerID = targetAccount.CustomerID,
                        TargetSavingAccountID = account.SavingAccountID,
                        TransactionDate = txn.TransactionDate,
                        TransactionType = txn.TransactionType == "Withdrawal" ? "Deposit" : "Withdrawal",
                        PaymentMode = "Transfer",
                        Amount = txn.Amount,
                        BalanceAfterTxn = targetAccount.CurrentBalance,
                        Narration = $"हस्तांतरण (Transfer) - खाते क्र. {account.AccountNo}",
                        CreatedBy = txn.CreatedBy,
                        CreatedOn = DateTime.Now
                    };
                    _context.SavingTransactions.Add(targetTxn);
                    _context.Entry(targetAccount).State = EntityState.Modified;
                }

                await _context.SaveChangesAsync();
                
                // === Auto Voucher Generation ===
                int savingControlLedgerID = account.LedgerID;
                
                // Get member/customer info and BranchID for narration, branch routing and numbering
                var memberInfo = await _context.SavingAccountMasters
                    .Include(s => s.Customer)
                    .Where(s => s.SavingAccountID == txn.SavingAccountID)
                    .Select(s => new { 
                        s.AccountNo, 
                        s.BranchID, 
                        MemberName = s.Customer != null 
                            ? (s.Customer.FirstName + " " + s.Customer.LastName).Trim() 
                            : "" 
                    })
                    .FirstOrDefaultAsync();

                int targetBranchId = memberInfo?.BranchID ?? 1;
                var branch = await _context.Branches.FindAsync(targetBranchId);
                string branchCode = branch?.BranchCode ?? "HQ";

                // Determine the cash/bank/target ledger based on PaymentMode
                int cashBankLedgerID;
                if (txn.PaymentMode == "Cash")
                {
                    cashBankLedgerID = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, targetBranchId, "SAVINGS");
                }
                else if (txn.PaymentMode == "Transfer" && targetAccount != null)
                {
                    cashBankLedgerID = targetAccount.LedgerID;
                }
                else if (txn.PaymentMode == "Bank" && txn.BankLedgerID.HasValue && txn.BankLedgerID.Value > 0)
                {
                    cashBankLedgerID = txn.BankLedgerID.Value;
                }
                else
                {
                    cashBankLedgerID = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, targetBranchId, "SAVINGS");
                }

                // Build the voucher
                string voucherType = targetAccount != null ? "Journal" : (txn.TransactionType == "Deposit" ? "Receipt" : "Payment");
                string typeCode = targetAccount != null ? "JRN" : (txn.TransactionType == "Deposit" ? "REC" : "PAY");

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

                int count = await _context.Vouchers.CountAsync(v => v.BranchID == targetBranchId && v.VoucherType == voucherType) + 1;
                string voucherNo = $"{branchCode}-{typeCode}-{fy}-{count:D5}";

                string narration = targetAccount != null
                    ? $"बचत हस्तांतरण - खाते {memberInfo?.AccountNo} ({memberInfo?.MemberName}) ➔ खाते {targetAccount.AccountNo}"
                    : $"बचत {(txn.TransactionType == "Deposit" ? "जमा" : "नावे")} - {memberInfo?.AccountNo} {memberInfo?.MemberName}";
                if (!string.IsNullOrEmpty(txn.Narration))
                    narration += $" | {txn.Narration}";

                var (vStatusSb, appBySb, appOnSb) = await Helpers.ApprovalPolicyHelper.DetermineVoucherStatusAsync(_context, txn.Amount, txn.CreatedBy);

                var voucher = new Voucher
                {
                    BranchID = targetBranchId,
                    VoucherNo = voucherNo,
                    VoucherDate = txn.TransactionDate,
                    VoucherType = voucherType,
                    Narration = narration,
                    TotalAmount = txn.Amount,
                    Status = vStatusSb,
                    ApprovedBy = appBySb,
                    ApprovedOn = appOnSb,
                    CreatedBy = txn.CreatedBy,
                    CreatedOn = DateTime.Now
                };


                // Deposit: Dr Cash/Bank/Target, Cr Saving Control
                // Withdrawal: Dr Saving Control, Cr Cash/Bank/Target
                if (txn.TransactionType == "Deposit" || txn.TransactionType == "Interest")
                {
                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = cashBankLedgerID,
                        DrCr = "Dr",
                        Amount = txn.Amount,
                        MemberID = targetAccount?.MemberID ?? account.MemberID
                    });
                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = savingControlLedgerID,
                        DrCr = "Cr",
                        Amount = txn.Amount,
                        MemberID = account.MemberID
                    });
                }
                else // Withdrawal or Charges
                {
                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = savingControlLedgerID,
                        DrCr = "Dr",
                        Amount = txn.Amount,
                        MemberID = account.MemberID
                    });
                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = cashBankLedgerID,
                        DrCr = "Cr",
                        Amount = txn.Amount,
                        MemberID = targetAccount?.MemberID ?? account.MemberID
                    });
                }

                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();

                // Store the voucher number on the transaction
                txn.VoucherNo = voucherNo;
                await _context.SaveChangesAsync();

                await dbTransaction.CommitAsync();

                return Ok(new {
                    txn.TransactionID,
                    txn.SavingAccountID,
                    txn.TransactionDate,
                    txn.TransactionType,
                    txn.PaymentMode,
                    txn.Amount,
                    txn.BalanceAfterTxn,
                    txn.Narration,
                    txn.VoucherNo,
                    CurrentBalance = account.CurrentBalance,
                    AccountNo = account.AccountNo,
                    TargetCurrentBalance = targetAccount?.CurrentBalance
                });
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<SavingTransaction>> GetSavingTransaction(int id)
        {
            var txn = await _context.SavingTransactions.FindAsync(id);

            if (txn == null)
            {
                return NotFound();
            }

            return txn;
        }

        // DELETE: api/SavingTransactions/5
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteSavingTransaction(int id)
        {
            using var dbTransaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var txn = await _context.SavingTransactions.FindAsync(id);
                if (txn == null)
                {
                    return NotFound(new { message = "Transaction not found." });
                }

                var account = await _context.SavingAccountMasters.FindAsync(txn.SavingAccountID);
                if (account == null)
                {
                    return NotFound(new { message = "खाते सापडले नाही." });
                }

                // 1. Check Closed EOD Business Date
                var dayStatus = await _context.BranchDayEndStatuses
                    .Where(b => b.BranchID == account.BranchID && b.BusinessDate.Date == txn.TransactionDate.Date)
                    .FirstOrDefaultAsync();

                if (dayStatus != null && dayStatus.IsDayClosed)
                {
                    return BadRequest(new { message = $"तारीख {txn.TransactionDate:dd/MM/yyyy} साठी दिवस अखेर (EOD) पूर्ण झाली आहे. बंद झालेल्या तारखेचा व्यवहार डिलीट करता येणार नाही." });
                }

                // 2. Reverse Current Account Balance
                if (txn.TransactionType == "Deposit" || txn.TransactionType == "Interest")
                {
                    account.CurrentBalance -= txn.Amount;
                }
                else if (txn.TransactionType == "Withdrawal" || txn.TransactionType == "Charges")
                {
                    account.CurrentBalance += txn.Amount;
                }
                _context.Entry(account).State = EntityState.Modified;

                // 3. Handle Paired Transfer Transaction Reversal if exists
                if (txn.PaymentMode == "Transfer" && txn.TargetSavingAccountID.HasValue)
                {
                    var targetAccount = await _context.SavingAccountMasters.FindAsync(txn.TargetSavingAccountID.Value);
                    if (targetAccount != null)
                    {
                        if (txn.TransactionType == "Withdrawal")
                        {
                            targetAccount.CurrentBalance -= txn.Amount;
                        }
                        else
                        {
                            targetAccount.CurrentBalance += txn.Amount;
                        }
                        _context.Entry(targetAccount).State = EntityState.Modified;
                    }

                    var pairedTxn = await _context.SavingTransactions
                        .FirstOrDefaultAsync(t => t.TransactionID != id &&
                                                  t.SavingAccountID == txn.TargetSavingAccountID.Value && 
                                                  t.TargetSavingAccountID == txn.SavingAccountID && 
                                                  t.TransactionDate.Date == txn.TransactionDate.Date && 
                                                  t.Amount == txn.Amount);
                    if (pairedTxn != null)
                    {
                        _context.SavingTransactions.Remove(pairedTxn);
                    }
                }

                // 4. Remove Associated Voucher and Details
                if (!string.IsNullOrEmpty(txn.VoucherNo))
                {
                    var voucher = await _context.Vouchers
                        .Include(v => v.VoucherDetails)
                        .FirstOrDefaultAsync(v => v.VoucherNo == txn.VoucherNo);

                    if (voucher != null)
                    {
                        _context.VoucherDetails.RemoveRange(voucher.VoucherDetails);
                        _context.Vouchers.Remove(voucher);
                    }
                }

                // 5. Immutable Security Audit Logging
                _context.AuditLogs.Add(new AuditLog
                {
                    Action = "SAVING_TRANSACTION_DELETED",
                    EntityName = "SavingTransaction",
                    EntityID = txn.TransactionID.ToString(),
                    Details = $"Deleted {txn.TransactionType} of ₹{txn.Amount:N2} on Saving Account #{account.AccountNo}. Linked Voucher: {txn.VoucherNo}",
                    Timestamp = DateTime.Now
                });

                _context.SavingTransactions.Remove(txn);
                await _context.SaveChangesAsync();
                await dbTransaction.CommitAsync();

                return Ok(new { message = "व्यवहार व संबंधित व्हाउचर यशस्वीरित्या डिलीट केले (Transaction & Voucher deleted successfully)." });
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                return StatusCode(500, new { message = $"Error deleting transaction: {ex.Message}" });
            }
        }
    }
}
