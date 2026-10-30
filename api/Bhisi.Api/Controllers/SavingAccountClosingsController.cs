using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Helpers;

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

            // Security Audit: Prevent closing accounts with active lien holds (e.g. pledged to a loan)
            if (account.LienAmount > 0)
            {
                return BadRequest($"सदर बचत खात्यावर ₹{account.LienAmount:N2} इतकी रक्कम तारण (Lien/Hold) म्हणून अडकवलेली आहे (कारण: {account.LienReason ?? "कर्ज तारण"}). जोपर्यंत तारण बोजा मोकळा (Lien Released) होत नाही, तोपर्यंत हे खाते बंद करता येणार नाही!");
            }

            // Multi-branch Security: Only Home Branch or Head Office can close the account
            int userBranchId = User.GetOperatingBranchId();
            bool isHO = User.IsHeadOfficeAdmin();

            if (!isHO && userBranchId > 0 && account.BranchID != userBranchId)
            {
                return BadRequest($"बचत खाते बंद करण्याची प्रक्रिया फक्त खात्याच्या मूळ शाखेत (Home Branch #{account.BranchID}) किंवा मुख्य कार्यालयातूनच (HO) करता येते.");
            }

            if (account.CurrentBalance < request.ClosingCharges)
            {
                return BadRequest("खात्यातील शिल्लक क्लोजिंग चार्जेसपेक्षा कमी आहे.");
            }

            decimal grossBalance = account.CurrentBalance;
            decimal netPayable = grossBalance - request.ClosingCharges;
            string normalizedMode = (request.PaymentMode ?? "Cash").Trim();
            bool isCashMode = string.Equals(normalizedMode, "Cash", StringComparison.OrdinalIgnoreCase);
            bool isBankMode = BankLedgerHelper.IsBankPaymentMode(normalizedMode);
            bool isTransferMode = string.Equals(normalizedMode, "Transfer", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalizedMode, "Saving Transfer", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalizedMode, "Saving", StringComparison.OrdinalIgnoreCase);

            if (!isCashMode && !isBankMode && !isTransferMode)
            {
                return BadRequest($"अवैध पेमेंट पद्धत '{request.PaymentMode}'. कृपया रोख (Cash), बँक (Bank) किंवा हस्तांतरण (Transfer) निवडा.");
            }

            int validatedBankLedgerId = 0;
            if (netPayable > 0 && isBankMode)
            {
                var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(_context, request.BankLedgerID);
                if (!bankCheck.IsValid) return BadRequest(bankCheck.ErrorMessage);
                validatedBankLedgerId = bankCheck.LedgerId;
            }

            SavingAccountMaster? targetSavingAccount = null;
            if (netPayable > 0 && isTransferMode)
            {
                if (!request.TargetSavingAccountID.HasValue || request.TargetSavingAccountID.Value <= 0)
                {
                    return BadRequest("हस्तांतरण (Transfer) पद्धतीसाठी रक्कम वर्ग करण्याचे दुसरे सक्रिय बचत खाते (Target Saving Account) निवडणे बंधनकारक आहे.");
                }

                if (request.TargetSavingAccountID.Value == account.SavingAccountID)
                {
                    return BadRequest("जे बचत खाते बंद करत आहात त्याच खात्यात रक्कम वर्ग करता येत नाही. कृपया दुसरे सक्रिय बचत खाते निवडा.");
                }

                targetSavingAccount = await _context.SavingAccountMasters.FindAsync(request.TargetSavingAccountID.Value);
                if (targetSavingAccount == null || targetSavingAccount.Status == "Closed")
                {
                    return BadRequest("रक्कम वर्ग करण्यासाठी निवडलेले टार्गेट बचत खाते सापडले नाही किंवा बंद (Closed) आहे.");
                }
            }

            using var dbTransaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var now = DateTime.Now;

                // 1. Resolve Ledgers for Double-Entry Accounting (NO silent fallback to Cash!)
                int savingControlLedgerID = await Helpers.SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(_context, account);
                if (savingControlLedgerID <= 0)
                {
                    await dbTransaction.RollbackAsync();
                    return BadRequest(Helpers.SavingLedgerHelper.GetMissingMappingErrorMessage());
                }

                int payoutLedgerID = 0;
                if (netPayable > 0)
                {
                    if (isCashMode)
                    {
                        payoutLedgerID = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, account.BranchID, "SAVINGS");
                    }
                    else if (isBankMode)
                    {
                        payoutLedgerID = validatedBankLedgerId;
                    }
                    else if (isTransferMode && targetSavingAccount != null)
                    {
                        payoutLedgerID = await Helpers.SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(_context, targetSavingAccount);
                        if (payoutLedgerID <= 0)
                        {
                            await dbTransaction.RollbackAsync();
                            return BadRequest(Helpers.SavingLedgerHelper.GetMissingMappingErrorMessage());
                        }
                    }
                    else
                    {
                        await dbTransaction.RollbackAsync();
                        return BadRequest($"अवैध पेमेंट पद्धत '{request.PaymentMode}' किंवा संबंधित खाते निवडलेले नाही.");
                    }
                }

                // Resolve Closing Charges Income Ledger from SavingVoucherMappings or Ledgers
                var closingChargeMapping = await _context.SavingVoucherMappings
                    .FirstOrDefaultAsync(m => m.OperationType == "ClosingCharges" || m.OperationType == "ClosingCharge");

                int closingChargesLedgerID = 0;
                if (request.ClosingCharges > 0)
                {
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
                            ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.AccountType == "Income" && (l.LedgerName.Contains("Charge") || l.LedgerName.Contains("शुल्क") || l.LedgerName.Contains("फी")))
                            ?? await _context.Ledgers.Include(l => l.AccountGroup).FirstOrDefaultAsync(l => l.IsActive && l.AccountGroup != null && l.AccountGroup.NatureOfGroup == "Income");

                        if (closingChargesLedger == null)
                        {
                            await dbTransaction.RollbackAsync();
                            return BadRequest("खाते बंद शुल्क (Closing Charges) जमा करण्यासाठी उत्पन्न जी.एल. खाते (Income Ledger) सापडले नाही. कृपया बचत व्हाउचर मॅपिंग किंवा लेजर मास्टर तपासा.");
                        }

                        closingChargesLedgerID = closingChargesLedger.LedgerID;
                    }
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

                    string transferNote = (isTransferMode && targetSavingAccount != null)
                        ? $" | वर्ग बचत खाते: {targetSavingAccount.AccountNo}"
                        : "";

                    var voucher = new Voucher
                    {
                        BranchID = account.BranchID,
                        VoucherNo = voucherNo,
                        VoucherDate = request.ClosureDate,
                        VoucherType = isTransferMode ? "Journal" : "Payment",
                        TotalAmount = grossBalance,
                        Narration = $"बचत खाते बंद करणे (अंतिम हिशोब) - खाते क्र. {account.AccountNo} ({customerName}) | एकूण: ₹{grossBalance:N2}, आकार: ₹{request.ClosingCharges:N2}, दिलेली रक्कम: ₹{netPayable:N2}{transferNote}{(!string.IsNullOrWhiteSpace(request.CheckNo) ? $" | चेक/UTR: {request.CheckNo.Trim()}" : "")}",
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

                    // Cr: Cash / Bank / Target Saving Liability Ledger = netPayable
                    if (netPayable > 0)
                    {
                        voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = payoutLedgerID,
                            DrCr = "Cr",
                            Amount = netPayable,
                            CustomerID = isTransferMode && targetSavingAccount != null ? targetSavingAccount.CustomerID : account.CustomerID
                        });
                    }

                    // Cr: Closing Charges Income Ledger = ClosingCharges
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
                        BranchID = account.BranchID,
                        TransactionDate = request.ClosureDate,
                        TransactionType = "Charges",
                        PaymentMode = request.PaymentMode ?? "Cash",
                        Amount = request.ClosingCharges,
                        BalanceAfterTxn = account.CurrentBalance,
                        Narration = "Account Closing Charges",
                        VoucherNo = voucherNo,
                        CreatedBy = request.CreatedBy,
                        CreatedOn = now
                    };
                    _context.SavingTransactions.Add(chargeTxn);
                }

                // 4. Post Withdrawal of the remaining net payable balance (and Deposit on Target Saving Account if Transfer)
                if (account.CurrentBalance > 0)
                {
                    decimal withdrawalAmt = account.CurrentBalance;
                    account.CurrentBalance = 0;
                    var closingTxn = new SavingTransaction
                    {
                        SavingAccountID = account.SavingAccountID,
                        CustomerID = account.CustomerID,
                        BranchID = account.BranchID,
                        TransactionDate = request.ClosureDate,
                        TransactionType = "Withdrawal",
                        PaymentMode = isTransferMode ? "Transfer" : (request.PaymentMode ?? "Cash"),
                        TargetSavingAccountID = isTransferMode ? targetSavingAccount?.SavingAccountID : null,
                        Amount = withdrawalAmt,
                        BalanceAfterTxn = 0,
                        Narration = isTransferMode && targetSavingAccount != null
                            ? $"Account Closure Transfer to Saving A/c {targetSavingAccount.AccountNo}"
                            : "Account Closure Final Settlement",
                        VoucherNo = voucherNo,
                        CreatedBy = request.CreatedBy,
                        CreatedOn = now
                    };
                    _context.SavingTransactions.Add(closingTxn);

                    if (isTransferMode && targetSavingAccount != null)
                    {
                        targetSavingAccount.CurrentBalance += withdrawalAmt;
                        _context.Entry(targetSavingAccount).State = EntityState.Modified;

                        var targetDepositTxn = new SavingTransaction
                        {
                            SavingAccountID = targetSavingAccount.SavingAccountID,
                            CustomerID = targetSavingAccount.CustomerID,
                            BranchID = targetSavingAccount.BranchID > 0 ? targetSavingAccount.BranchID : account.BranchID,
                            TransactionDate = request.ClosureDate,
                            TransactionType = "Deposit",
                            PaymentMode = "Transfer",
                            TargetSavingAccountID = account.SavingAccountID,
                            Amount = withdrawalAmt,
                            BalanceAfterTxn = targetSavingAccount.CurrentBalance,
                            Narration = $"बंद बचत खाते क्र. {account.AccountNo} मधून अंतिम रक्कम वर्ग",
                            VoucherNo = voucherNo,
                            CreatedBy = request.CreatedBy,
                            CreatedOn = now
                        };
                        _context.SavingTransactions.Add(targetDepositTxn);
                    }
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
                    PaymentMode = isTransferMode ? "Transfer" : (request.PaymentMode ?? "Cash"),
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
                    Details = $"Closed Saving Account #{account.AccountNo}. Gross: ₹{grossBalance:N2}, Charges: ₹{request.ClosingCharges:N2}, Net Paid: ₹{netPayable:N2} ({closing.PaymentMode}). Voucher: {voucherNo}",
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
            var voucher = await _context.Vouchers
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Ledger)
                        .ThenInclude(l => l!.AccountGroup)
                .FirstOrDefaultAsync(v => v.VoucherID == voucherId);
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

            int? bankLedgerId = null;
            if (BankLedgerHelper.IsBankPaymentMode(closing.PaymentMode))
            {
                var bankCrLine = voucher.VoucherDetails
                    .FirstOrDefault(d => d.DrCr == "Cr" && BankLedgerHelper.IsBankLedger(d.Ledger))
                    ?? voucher.VoucherDetails.FirstOrDefault(d => d.DrCr == "Cr" && d.Amount == closing.NetPayable)
                    ?? voucher.VoucherDetails.FirstOrDefault(d => d.DrCr == "Cr");
                bankLedgerId = bankCrLine?.LedgerID;
            }

            int? targetSavingAccountId = null;
            if (string.Equals(closing.PaymentMode, "Transfer", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(closing.VoucherNo))
            {
                var depositTxn = await _context.SavingTransactions
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t => t.VoucherNo == closing.VoucherNo && t.TransactionType == "Deposit" && t.SavingAccountID != closing.SavingAccountID);
                targetSavingAccountId = depositTxn?.SavingAccountID;
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
                BankLedgerID = bankLedgerId,
                TargetSavingAccountID = targetSavingAccountId,
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
        public int? TargetSavingAccountID { get; set; }
        public string? CheckNo { get; set; }
        public int CreatedBy { get; set; } = 1;
    }
}
