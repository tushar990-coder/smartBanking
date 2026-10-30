using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
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
    public class SavingTransactionsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SavingTransactionsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/SavingTransactions
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetSavingTransactions(
            [FromQuery] int? branchId = null,
            [FromQuery] int? page = null,
            [FromQuery] int? pageSize = null)
        {
            var query = _context.SavingTransactions
                .AsNoTracking()
                .Include(t => t.SavingAccount)
                    .ThenInclude(a => a!.Customer)
                .AsQueryable();

            if (!User.IsHeadOfficeAdmin())
            {
                int opId = User.GetOperatingBranchId();
                query = query.Where(t => t.BranchID == opId || (t.SavingAccount != null && t.SavingAccount.BranchID == opId));
            }
            else if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(t => t.BranchID == branchId.Value || (t.SavingAccount != null && t.SavingAccount.BranchID == branchId.Value));
            }

            var projected = query
                .OrderByDescending(t => t.TransactionDate)
                .ThenByDescending(t => t.TransactionID)
                .Select(t => new
                {
                    t.TransactionID,
                    t.TransactionDate,
                    t.TransactionType,
                    t.PaymentMode,
                    t.Amount,
                    t.BalanceAfterTxn,
                    t.Narration,
                    t.VoucherNo,
                    BranchID = t.BranchID,
                    HomeBranchID = t.SavingAccount != null ? t.SavingAccount.BranchID : 1,
                    AccountNo = t.SavingAccount != null ? t.SavingAccount.AccountNo : "",
                    CustomerName = t.SavingAccount != null && t.SavingAccount.Customer != null
                        ? (t.SavingAccount.Customer.FirstName + (string.IsNullOrWhiteSpace(t.SavingAccount.Customer.MiddleName) ? "" : " " + t.SavingAccount.Customer.MiddleName) + " " + t.SavingAccount.Customer.LastName).Trim()
                        : ""
                });

            int p = page ?? 1;
            int ps = pageSize ?? 50;
            if (p < 1) p = 1;
            if (ps < 1 || ps > 500) ps = 50;
            projected = projected.Skip((p - 1) * ps).Take(ps);

            var txns = await projected.ToListAsync();
            return Ok(txns);
        }

        [HttpGet("account/{accountId}")]
        [HttpGet("ByAccount/{accountId}")]
        public async Task<ActionResult<IEnumerable<SavingTransaction>>> GetTransactionsByAccount(int accountId)
        {
            return await _context.SavingTransactions
                .AsNoTracking()
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

            int branchId = account.BranchID > 0 ? account.BranchID : 1;

            var dayStatus = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == branchId && b.BusinessDate.Date == txn.TransactionDate.Date)
                .FirstOrDefaultAsync();

            if (dayStatus != null && dayStatus.IsDayClosed)
            {
                return BadRequest($"तारीख {txn.TransactionDate:dd/MM/yyyy} साठी दिवस अखेर (EOD) पूर्ण झाली आहे. बंद झालेल्या तारखेमध्ये नवीन बचत व्यवहार नोंदवता येणार नाही.");
            }

            var lastClosedCheck = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == branchId && b.IsDayClosed)
                .OrderByDescending(b => b.BusinessDate)
                .FirstOrDefaultAsync();

            if (lastClosedCheck != null && txn.TransactionDate.Date <= lastClosedCheck.BusinessDate.Date)
            {
                return BadRequest($"तारीख {txn.TransactionDate:dd/MM/yyyy} ही शेवटच्या बंद झालेल्या दिवसापेक्षा ({lastClosedCheck.BusinessDate:dd/MM/yyyy}) जुनी किंवा बंद असलेली तारीख आहे. बंद तारखेत नवीन बचत व्यवहार नोंदवता येणार नाही.");
            }

            if (txn.Amount <= 0)
            {
                return BadRequest("Amount must be greater than zero.");
            }

            SavingAccountMaster? targetAccount = null;
            string normalizedTxnMode = (txn.PaymentMode ?? "Cash").Trim();
            bool isTxnCash = string.Equals(normalizedTxnMode, "Cash", StringComparison.OrdinalIgnoreCase);
            bool isTxnTransfer = string.Equals(normalizedTxnMode, "Transfer", StringComparison.OrdinalIgnoreCase);
            bool isTxnBank = Helpers.BankLedgerHelper.IsBankPaymentMode(normalizedTxnMode);
            if (!isTxnCash && !isTxnTransfer && !isTxnBank)
            {
                return BadRequest($"अवैध पेमेंट पद्धत '{txn.PaymentMode}'. कृपया रोख (Cash), बँक (Bank) किंवा ट्रान्सफर (Transfer) निवडा.");
            }
            if (isTxnTransfer && (!txn.TargetSavingAccountID.HasValue || txn.TargetSavingAccountID.Value <= 0))
            {
                return BadRequest("हस्तांतरण (Transfer) व्यवहारासाठी टार्गेट बचत खाते निवडणे बंधनकारक आहे.");
            }
            if (isTxnBank)
            {
                var bankCheck = await Helpers.BankLedgerHelper.ValidateBankLedgerAsync(_context, txn.BankLedgerID);
                if (!bankCheck.IsValid)
                {
                    return BadRequest(bankCheck.ErrorMessage);
                }
                txn.BankLedgerID = bankCheck.LedgerId;
            }
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
                if (!(await Helpers.BankLedgerHelper.ValidateBankLedgerAsync(_context, txn.BankLedgerID)).IsValid)
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

                    var (availableBalance, effectiveMinBalance) = await Helpers.SavingLedgerHelper.ResolveAvailableBalanceAsync(_context, account);
                    if (availableBalance < txn.Amount)
                    {
                        return BadRequest($"अपुऱ्या शिल्लकेमुळे रक्कम काढता येणार नाही! खात्यात तारण होल्ड (₹{account.LienAmount:N2}) व किमान शिल्लक मर्यादा (₹{effectiveMinBalance:N2}) सोडून फक्त ₹{availableBalance:N2} काढता येतील.");
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
                        if (targetAccount.Status == "Frozen" || targetAccount.Status == "Dormant")
                        {
                            return BadRequest($"टार्गेट बचत खाते (#{targetAccount.AccountNo}) {targetAccount.Status} असल्याने त्यावरून रक्कम वर्ग करता येणार नाही.");
                        }

                        var (targetAvailable, targetEffectiveMin) = await Helpers.SavingLedgerHelper.ResolveAvailableBalanceAsync(_context, targetAccount);
                        if (targetAvailable < txn.Amount)
                        {
                            return BadRequest($"टार्गेट खात्यामध्ये (#{targetAccount.AccountNo}) अपुरी शिल्लक असल्याने हस्तांतरण करता येत नाही! तारण होल्ड (₹{targetAccount.LienAmount:N2}) व किमान शिल्लक मर्यादा (₹{targetEffectiveMin:N2}) वगळता फक्त ₹{targetAvailable:N2} उपलब्ध आहेत.");
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

                var currentUser = HttpContext.User;
                int userBranchId = currentUser.GetOperatingBranchId();
                bool isHO = currentUser.IsHeadOfficeAdmin();

                // Operating counter branch where cash is deposited or withdrawn
                int operatingBranchId = (isHO && txn.BranchID > 0)
                    ? txn.BranchID
                    : (userBranchId > 0 ? userBranchId : (account.BranchID > 0 ? account.BranchID : 1));

                int targetBranchId = operatingBranchId;

                txn.BranchID = targetBranchId;
                SavingTransaction? targetTxn = null;
                txn.CustomerID = account.CustomerID;
                txn.BalanceAfterTxn = account.CurrentBalance;
                txn.CreatedOn = DateTime.Now;

                if (!string.IsNullOrWhiteSpace(txn.CheckNo))
                {
                    var cleanRef = txn.CheckNo.Trim();
                    var refTag = $"[संदर्भ/UTR: {cleanRef}]";
                    txn.Narration = string.IsNullOrWhiteSpace(txn.Narration)
                        ? refTag
                        : (txn.Narration.Contains(cleanRef) ? txn.Narration : $"{txn.Narration} {refTag}");
                }

                _context.SavingTransactions.Add(txn);
                _context.Entry(account).State = EntityState.Modified;

                if (targetAccount != null)
                {
                    targetTxn = new SavingTransaction
                    {
                        SavingAccountID = targetAccount.SavingAccountID,
                        CustomerID = targetAccount.CustomerID,
                        BranchID = targetBranchId,
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
                int savingControlLedgerID = await Helpers.SavingLedgerHelper.ResolveSavingLiabilityLedgerIdAsync(_context, account);

                // Get customer info and BranchID for narration, branch routing and numbering
                var customerInfo = await _context.SavingAccountMasters
                    .Include(s => s.Customer)
                    .Where(s => s.SavingAccountID == txn.SavingAccountID)
                    .Select(s => new
                    {
                        s.AccountNo,
                        s.BranchID,
                        CustomerName = s.Customer != null
                            ? (s.Customer.FirstName + " " + s.Customer.LastName).Trim()
                            : ""
                    })
                    .FirstOrDefaultAsync();

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
                    cashBankLedgerID = await Helpers.SavingLedgerHelper.ResolveSavingLiabilityLedgerIdAsync(_context, targetAccount);
                }
                else if (Helpers.BankLedgerHelper.IsBankPaymentMode(txn.PaymentMode) && txn.BankLedgerID.HasValue && txn.BankLedgerID.Value > 0)
                {
                    cashBankLedgerID = txn.BankLedgerID.Value;
                }
                else if (!string.Equals((txn.PaymentMode ?? "Cash").Trim(), "Cash", StringComparison.OrdinalIgnoreCase))
                {
                    await dbTransaction.RollbackAsync();
                    return BadRequest($"अवैध पेमेंट पद्धत '{txn.PaymentMode}' किंवा संबंधित खाते निवडलेले नाही.");
                }
                else if (txn.BankLedgerID.HasValue && txn.BankLedgerID.Value < 0)
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

                int count = await Helpers.VoucherNumberHelper.NextSequenceAsync(_context, $"{branchCode}-{typeCode}-{fy}-", 5);
                string voucherNo = $"{branchCode}-{typeCode}-{fy}-{count:D5}";

                string narration = targetAccount != null
                    ? $"बचत हस्तांतरण - खाते {customerInfo?.AccountNo} ({customerInfo?.CustomerName}) ➔ खाते {targetAccount.AccountNo}"
                    : $"बचत {(txn.TransactionType == "Deposit" ? "जमा" : "नावे")} - {customerInfo?.AccountNo} {customerInfo?.CustomerName}";

                if (customerInfo?.BranchID != null && customerInfo.BranchID > 0 && customerInfo.BranchID != targetBranchId)
                {
                    narration += $" [आंतर-शाखा / Cross-Branch: खाते मूळ शाखा #{customerInfo.BranchID}]";
                }

                if (!string.IsNullOrEmpty(txn.Narration))
                    narration += $" | {txn.Narration}";

                var (vStatusSb, appBySb, appOnSb) = await Helpers.ApprovalPolicyHelper.DetermineVoucherStatusAsync(_context, txn.Amount, txn.CreatedBy);

                bool isCrossBranchTxn = (customerInfo?.BranchID != null && customerInfo.BranchID > 0 && customerInfo.BranchID != targetBranchId);
                int homeBranchId = customerInfo?.BranchID ?? account.BranchID;

                if (!isCrossBranchTxn)
                {
                    // STANDARD SINGLE-BRANCH VOUCHER
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

                    if (txn.TransactionType == "Deposit" || txn.TransactionType == "Interest")
                    {
                        voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = cashBankLedgerID,
                            DrCr = "Dr",
                            Amount = txn.Amount,
                            CustomerID = targetAccount?.CustomerID ?? account.CustomerID
                        });
                        voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = savingControlLedgerID,
                            DrCr = "Cr",
                            Amount = txn.Amount,
                            CustomerID = account.CustomerID
                        });
                    }
                    else // Withdrawal or Charges
                    {
                        voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = savingControlLedgerID,
                            DrCr = "Dr",
                            Amount = txn.Amount,
                            CustomerID = account.CustomerID
                        });
                        voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = cashBankLedgerID,
                            DrCr = "Cr",
                            Amount = txn.Amount,
                            CustomerID = targetAccount?.CustomerID ?? account.CustomerID
                        });
                    }

                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();
                    txn.VoucherNo = voucherNo; if (targetTxn != null) { targetTxn.VoucherNo = voucherNo; }
                }
                else
                {
                    // DUAL-VOUCHER IBT ENGINE FOR CROSS-BRANCH SAVING TRANSACTION
                    int ibtLedgerId = await Helpers.IbtLedgerHelper.GetIbtLedgerIdAsync(_context, targetBranchId, homeBranchId);
                    var homeBranch = await _context.Branches.FindAsync(homeBranchId);
                    string hbCode = homeBranch?.BranchCode ?? "HB";

                    int countHb = await Helpers.VoucherNumberHelper.NextSequenceAsync(_context, $"{hbCode}-JV-{fy}-", 5);
                    string voucherNoHb = $"{hbCode}-JV-{fy}-{countHb:D5}";

                    if (txn.TransactionType == "Deposit" || txn.TransactionType == "Interest")
                    {
                        // 1. Counter Voucher (Branch A, Receipt): Dr Cash, Cr IBT
                        var counterVoucher = new Voucher
                        {
                            BranchID = targetBranchId,
                            VoucherNo = voucherNo,
                            VoucherDate = txn.TransactionDate,
                            VoucherType = voucherType,
                            Narration = $"[आंतर-शाखा बचत जमा] खाते: {customerInfo?.AccountNo} ({customerInfo?.CustomerName}, मूळ शाखा #{homeBranchId}) साठी काऊंटरवर रोख जमा",
                            TotalAmount = txn.Amount,
                            Status = vStatusSb,
                            ApprovedBy = appBySb,
                            ApprovedOn = appOnSb,
                            CreatedBy = txn.CreatedBy,
                            CreatedOn = DateTime.Now,
                            IsIbtVoucher = true,
                            TargetBranchID = homeBranchId
                        };
                        _context.Vouchers.Add(counterVoucher);
                        await _context.SaveChangesAsync();

                        counterVoucher.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = counterVoucher.VoucherID,
                            LedgerID = cashBankLedgerID,
                            DrCr = "Dr",
                            Amount = txn.Amount,
                            CustomerID = account.CustomerID
                        });
                        counterVoucher.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = counterVoucher.VoucherID,
                            LedgerID = ibtLedgerId,
                            DrCr = "Cr",
                            Amount = txn.Amount,
                            CustomerID = account.CustomerID
                        });

                        // 2. Home Branch Voucher (Branch B, Journal): Dr IBT, Cr Saving Control
                        var homeVoucher = new Voucher
                        {
                            BranchID = homeBranchId,
                            VoucherNo = voucherNoHb,
                            VoucherDate = txn.TransactionDate,
                            VoucherType = "Journal",
                            Narration = $"[आंतर-शाखा बचत जमा] काऊंटर शाखा #{targetBranchId} कडून ठेव जमा (खाते: {customerInfo?.AccountNo}, {customerInfo?.CustomerName})",
                            TotalAmount = txn.Amount,
                            Status = vStatusSb,
                            ApprovedBy = appBySb,
                            ApprovedOn = appOnSb,
                            CreatedBy = txn.CreatedBy,
                            CreatedOn = DateTime.Now,
                            IsIbtVoucher = true,
                            TargetBranchID = targetBranchId
                        };
                        _context.Vouchers.Add(homeVoucher);
                        await _context.SaveChangesAsync();

                        homeVoucher.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = homeVoucher.VoucherID,
                            LedgerID = ibtLedgerId,
                            DrCr = "Dr",
                            Amount = txn.Amount,
                            CustomerID = account.CustomerID
                        });
                        homeVoucher.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = homeVoucher.VoucherID,
                            LedgerID = savingControlLedgerID,
                            DrCr = "Cr",
                            Amount = txn.Amount,
                            CustomerID = account.CustomerID
                        });

                        counterVoucher.RelatedVoucherID = homeVoucher.VoucherID;
                        homeVoucher.RelatedVoucherID = counterVoucher.VoucherID;
                        await _context.SaveChangesAsync();

                        txn.VoucherNo = voucherNo; if (targetTxn != null) { targetTxn.VoucherNo = voucherNo; }
                    }
                    else // Withdrawal
                    {
                        // 1. Home Branch Voucher (Branch B, Journal): Dr Saving Control, Cr IBT
                        var homeVoucher = new Voucher
                        {
                            BranchID = homeBranchId,
                            VoucherNo = voucherNoHb,
                            VoucherDate = txn.TransactionDate,
                            VoucherType = "Journal",
                            Narration = $"[आंतर-शाखा बचत उचल] काऊंटर शाखा #{targetBranchId} वरून रक्कम उचल (खाते: {customerInfo?.AccountNo}, {customerInfo?.CustomerName})",
                            TotalAmount = txn.Amount,
                            Status = vStatusSb,
                            ApprovedBy = appBySb,
                            ApprovedOn = appOnSb,
                            CreatedBy = txn.CreatedBy,
                            CreatedOn = DateTime.Now,
                            IsIbtVoucher = true,
                            TargetBranchID = targetBranchId
                        };
                        _context.Vouchers.Add(homeVoucher);
                        await _context.SaveChangesAsync();

                        homeVoucher.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = homeVoucher.VoucherID,
                            LedgerID = savingControlLedgerID,
                            DrCr = "Dr",
                            Amount = txn.Amount,
                            CustomerID = account.CustomerID
                        });
                        homeVoucher.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = homeVoucher.VoucherID,
                            LedgerID = ibtLedgerId,
                            DrCr = "Cr",
                            Amount = txn.Amount,
                            CustomerID = account.CustomerID
                        });

                        // 2. Counter Voucher (Branch A, Payment): Dr IBT, Cr Cash
                        var counterVoucher = new Voucher
                        {
                            BranchID = targetBranchId,
                            VoucherNo = voucherNo,
                            VoucherDate = txn.TransactionDate,
                            VoucherType = voucherType,
                            Narration = $"[आंतर-शाखा बचत उचल] खाते: {customerInfo?.AccountNo} ({customerInfo?.CustomerName}, मूळ शाखा #{homeBranchId}) साठी काऊंटरवरून रोख अदा",
                            TotalAmount = txn.Amount,
                            Status = vStatusSb,
                            ApprovedBy = appBySb,
                            ApprovedOn = appOnSb,
                            CreatedBy = txn.CreatedBy,
                            CreatedOn = DateTime.Now,
                            IsIbtVoucher = true,
                            TargetBranchID = homeBranchId
                        };
                        _context.Vouchers.Add(counterVoucher);
                        await _context.SaveChangesAsync();

                        counterVoucher.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = counterVoucher.VoucherID,
                            LedgerID = ibtLedgerId,
                            DrCr = "Dr",
                            Amount = txn.Amount,
                            CustomerID = account.CustomerID
                        });
                        counterVoucher.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = counterVoucher.VoucherID,
                            LedgerID = cashBankLedgerID,
                            DrCr = "Cr",
                            Amount = txn.Amount,
                            CustomerID = account.CustomerID
                        });

                        counterVoucher.RelatedVoucherID = homeVoucher.VoucherID;
                        homeVoucher.RelatedVoucherID = counterVoucher.VoucherID;
                        await _context.SaveChangesAsync();

                        txn.VoucherNo = voucherNo; if (targetTxn != null) { targetTxn.VoucherNo = voucherNo; }
                    }
                }
                await _context.SaveChangesAsync();

                await dbTransaction.CommitAsync();

                return Ok(new
                {
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

        // GET: api/SavingTransactions/by-voucher/{voucherId}
        [HttpGet("by-voucher/{voucherId}")]
        public async Task<ActionResult<object>> GetSavingTransactionByVoucher(int voucherId)
        {
            var voucher = await _context.Vouchers
                .Include(v => v.VoucherDetails)
                    .ThenInclude(d => d.Ledger)
                .FirstOrDefaultAsync(v => v.VoucherID == voucherId);

            if (voucher == null)
            {
                return NotFound(new { message = "व्हाउचर सापडले नाही (Voucher not found)." });
            }

            // 1. Try matching by VoucherNo on SavingTransaction
            SavingTransaction? txn = null;
            if (!string.IsNullOrEmpty(voucher.VoucherNo))
            {
                txn = await _context.SavingTransactions
                    .Include(t => t.SavingAccount)
                        .ThenInclude(s => s!.Customer)
                    .Include(t => t.Customer)
                    .Include(t => t.TargetSavingAccount)
                        .ThenInclude(ts => ts!.Customer)
                    .FirstOrDefaultAsync(t => t.VoucherNo == voucher.VoucherNo);
            }

            // 2. Fallback: match by CustomerID & Amount from VoucherDetails
            if (txn == null)
            {
                var custId = voucher.VoucherDetails.FirstOrDefault(d => d.CustomerID.HasValue && d.CustomerID.Value > 0)?.CustomerID;
                if (custId.HasValue)
                {
                    txn = await _context.SavingTransactions
                        .Include(t => t.SavingAccount)
                            .ThenInclude(s => s!.Customer)
                        .Include(t => t.Customer)
                        .Include(t => t.TargetSavingAccount)
                            .ThenInclude(ts => ts!.Customer)
                        .Where(t => t.CustomerID == custId.Value && t.Amount == voucher.TotalAmount)
                        .OrderByDescending(t => t.TransactionID)
                        .FirstOrDefaultAsync();
                }
            }

            if (txn == null)
            {
                return NotFound(new { message = "सदर व्हाउचरशी जोडलेला बचत व्यवहार सापडला नाही." });
            }

            decimal effectiveSavingMin = txn.SavingAccount != null
                ? await Helpers.SavingLedgerHelper.ResolveEffectiveMinimumBalanceAsync(_context, txn.SavingAccount)
                : 0m;
            decimal effectiveTargetMin = txn.TargetSavingAccount != null
                ? await Helpers.SavingLedgerHelper.ResolveEffectiveMinimumBalanceAsync(_context, txn.TargetSavingAccount)
                : 0m;

            return Ok(new
            {
                txn.TransactionID,
                txn.SavingAccountID,
                txn.CustomerID,
                txn.TargetSavingAccountID,
                BankLedgerID = string.Equals(txn.PaymentMode, "Bank", StringComparison.OrdinalIgnoreCase)
                    ? (voucher.VoucherDetails.FirstOrDefault(d => d.DrCr == ((txn.TransactionType == "Deposit" || txn.TransactionType == "Interest") ? "Dr" : "Cr"))?.LedgerID
                        ?? voucher.VoucherDetails.FirstOrDefault(d => d.Ledger != null &&
                            (string.Equals(d.Ledger.AccountType, "Bank Account", StringComparison.OrdinalIgnoreCase) ||
                             string.Equals(d.Ledger.AccountType, "Bank", StringComparison.OrdinalIgnoreCase)))?.LedgerID
                        ?? 0)
                    : 0,
                txn.TransactionDate,
                txn.TransactionType,
                txn.PaymentMode,
                txn.Amount,
                txn.BalanceAfterTxn,
                txn.Narration,
                txn.VoucherNo,
                SavingAccount = txn.SavingAccount != null ? new
                {
                    txn.SavingAccount.SavingAccountID,
                    txn.SavingAccount.AccountNo,
                    txn.SavingAccount.OpeningBalance,
                    txn.SavingAccount.CurrentBalance,
                    txn.SavingAccount.LienAmount,
                    MinimumBalance = effectiveSavingMin,
                    txn.SavingAccount.Status,
                    Customer = txn.SavingAccount.Customer != null ? new
                    {
                        txn.SavingAccount.Customer.CustomerID,
                        FullName = $"{txn.SavingAccount.Customer.FirstName} {txn.SavingAccount.Customer.LastName}".Trim(),
                        txn.SavingAccount.Customer.MobileNo,
                        txn.SavingAccount.Customer.CIFNo
                    } : null
                } : null,
                TargetSavingAccount = txn.TargetSavingAccount != null ? new
                {
                    txn.TargetSavingAccount.SavingAccountID,
                    txn.TargetSavingAccount.AccountNo,
                    txn.TargetSavingAccount.OpeningBalance,
                    txn.TargetSavingAccount.CurrentBalance,
                    txn.TargetSavingAccount.LienAmount,
                    MinimumBalance = effectiveTargetMin,
                    txn.TargetSavingAccount.Status,
                    Customer = txn.TargetSavingAccount.Customer != null ? new
                    {
                        txn.TargetSavingAccount.Customer.CustomerID,
                        FullName = $"{txn.TargetSavingAccount.Customer.FirstName} {txn.TargetSavingAccount.Customer.LastName}".Trim()
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
}
