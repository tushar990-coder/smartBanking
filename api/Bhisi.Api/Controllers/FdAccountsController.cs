using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Filters;

using Microsoft.AspNetCore.Authorization;

namespace Bhisi.Api.Controllers
{
    public class BulkFdAccountRequest
    {
        public int BranchID { get; set; } = 1;
        public int? CustomerID { get; set; }
        public int? MemberID { get; set; }
        public int FdSchemeID { get; set; }
        public DateTime OpeningDate { get; set; } = DateTime.Today;
        public decimal TotalAmount { get; set; }
        public int SplitCount { get; set; } = 1;
        public decimal AmountPerReceipt { get; set; }
        public string? NomineeName { get; set; }
        public string? NomineeRelation { get; set; }
        public string? Remarks { get; set; }
        public bool IsSeniorCitizen { get; set; }

        public string PaymentMode { get; set; } = "Cash"; // Cash, Bank, Transfer
        public int? BankAccountLedgerID { get; set; }
        public string? ChequeNo { get; set; }
        public DateTime? ChequeDate { get; set; }
        public int? SavingAccountID { get; set; }
    }

    [Route("api/[controller]")]
    [ApiController]
    public class FdAccountsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public FdAccountsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/FdAccounts/next-account-no  (global fallback)
        [HttpGet("next-account-no")]
        public async Task<ActionResult<string>> GetNextAccountNo()
        {
            var maxId = await _context.FdAccounts.MaxAsync(f => (int?)f.FdAccountID) ?? 0;
            var nextId = maxId + 1;
            return Content($"FDA-{nextId:D5}", "text/plain");
        }

        // GET: api/FdAccounts/next-account-no/{branchId}  (branch-specific, matches actual PostFdAccount logic)
        [HttpGet("next-account-no/{branchId}")]
        public async Task<ActionResult<string>> GetNextAccountNoForBranch(int branchId)
        {
            var branch = await _context.Branches.FindAsync(branchId);
            if (branch == null) return NotFound("Branch not found.");

            string branchPrefix = branch.BranchCode;

            var seq = await _context.FdAccountSequences
                .FirstOrDefaultAsync(s => s.BranchID == branchId && s.ProductType == "FD");

            int nextSeq = (seq?.CurrentValue ?? 0) + 1;

            // Same format as PostFdAccount: {BranchCode}-{BranchID:D3}-FD-{SeqNo:D6}
            string nextAccountNo = $"{branchPrefix}-{branchId:D3}-FD-{nextSeq:D6}";
            return Content(nextAccountNo, "text/plain");
        }

        // GET: api/FdAccounts
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetFdAccounts([FromQuery] int? branchId)
        {
            var query = _context.FdAccounts
                .Include(f => f.Customer)
                    .ThenInclude(c => c!.MemberProfile)
                .Include(f => f.FdScheme)
                .Include(f => f.Branch)
                .AsQueryable();

            if (branchId.HasValue)
            {
                query = query.Where(f => f.BranchID == branchId.Value);
            }

            var accounts = await query
                .OrderByDescending(f => f.OpeningDate)
                .Select(f => new {
                    f.FdAccountID,
                    f.BranchID,
                    BranchName = f.Branch != null ? f.Branch.BranchName : "",
                    f.CustomerID,
                    CustomerName = f.Customer != null ? (f.Customer.FirstName + " " + f.Customer.LastName).Trim() : "",
                    CIFNo = f.Customer != null ? f.Customer.CIFNo : "",
                    MemberID = f.Customer != null && f.Customer.MemberProfile != null ? f.Customer.MemberProfile.MemberID : (int?)null,
                    MemberName = f.Customer != null ? (f.Customer.FirstName + " " + f.Customer.LastName).Trim() : "",
                    MemberCode = f.Customer != null && f.Customer.MemberProfile != null ? f.Customer.MemberProfile.MemberCode : (f.Customer != null ? f.Customer.CIFNo : ""),
                    f.FdSchemeID,
                    SchemeName = f.FdScheme != null ? f.FdScheme.SchemeName : "",
                    SchemeCode = f.FdScheme != null ? f.FdScheme.SchemeCode : "",
                    FdLiabilityLedgerID = f.FdScheme != null ? f.FdScheme.FdLiabilityLedgerID : null,
                    FdLiabilityLedgerName = f.FdScheme != null && f.FdScheme.FdLiabilityLedger != null ? f.FdScheme.FdLiabilityLedger.LedgerName : "",
                    InterestExpenseLedgerID = f.FdScheme != null ? f.FdScheme.InterestExpenseLedgerID : null,
                    InterestExpenseLedgerName = f.FdScheme != null && f.FdScheme.InterestExpenseLedger != null ? f.FdScheme.InterestExpenseLedger.LedgerName : "",
                    InterestPayableLedgerID = f.FdScheme != null ? f.FdScheme.InterestPayableLedgerID : null,
                    InterestPayableLedgerName = f.FdScheme != null && f.FdScheme.InterestPayableLedger != null ? f.FdScheme.InterestPayableLedger.LedgerName : "",
                    PrematurePenaltyLedgerID = f.FdScheme != null ? f.FdScheme.PrematurePenaltyLedgerID : null,
                    PrematurePenaltyLedgerName = f.FdScheme != null && f.FdScheme.PrematurePenaltyLedger != null ? f.FdScheme.PrematurePenaltyLedger.LedgerName : "",
                    f.AccountNo,
                    f.OpeningDate,
                    f.DepositAmount,
                    f.InterestRate,
                    f.MaturityDate,
                    f.MaturityAmount,
                    f.IsLegacyAccount,
                    f.LegacyAccruedInt,
                    f.Status,
                    f.NomineeName,
                    f.NomineeRelation,
                    f.Remarks
                })
                .ToListAsync();

            return Ok(accounts);
        }

        // GET: api/FdAccounts/5
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetFdAccount(int id)
        {
            var f = await _context.FdAccounts
                .Include(x => x.Customer)
                    .ThenInclude(c => c!.MemberProfile)
                .Include(x => x.FdScheme)
                .Include(x => x.Branch)
                .FirstOrDefaultAsync(x => x.FdAccountID == id);

            if (f == null)
            {
                return NotFound();
            }

            return Ok(new {
                f.FdAccountID,
                f.BranchID,
                BranchName = f.Branch != null ? f.Branch.BranchName : "",
                f.CustomerID,
                CustomerName = f.Customer != null ? (f.Customer.FirstName + " " + f.Customer.LastName).Trim() : "",
                CIFNo = f.Customer != null ? f.Customer.CIFNo : "",
                MemberID = f.Customer?.MemberProfile?.MemberID,
                MemberName = f.Customer != null ? (f.Customer.FirstName + " " + f.Customer.LastName).Trim() : "",
                MemberCode = f.Customer?.MemberProfile?.MemberCode ?? f.Customer?.CIFNo ?? "",
                f.FdSchemeID,
                SchemeName = f.FdScheme != null ? f.FdScheme.SchemeName : "",
                SchemeCode = f.FdScheme != null ? f.FdScheme.SchemeCode : "",
                f.AccountNo,
                f.OpeningDate,
                f.DepositAmount,
                f.InterestRate,
                f.MaturityDate,
                f.MaturityAmount,
                f.IsLegacyAccount,
                f.LegacyAccruedInt,
                f.Status,
                f.NomineeName,
                f.NomineeRelation,
                f.Remarks
            });
        }

        // POST: api/FdAccounts
        [HttpPost]
        public async Task<ActionResult<FdAccount>> PostFdAccount(FdAccount account)
        {
            // 1. Load Scheme
            var scheme = await _context.FdSchemes.FindAsync(account.FdSchemeID);
            if (scheme == null)
            {
                return BadRequest("Invalid FD Scheme.");
            }

            // 1b. Validate Customer
            if (account.CustomerID <= 0)
            {
                return BadRequest("कृपया खातेदाराची (Customer) निवड करा.");
            }
            var customer = await _context.Customers.FindAsync(account.CustomerID);
            if (customer == null)
            {
                return BadRequest("निवडलेला ग्राहक (Customer) सिस्टीममध्ये अस्तित्वात नाही.");
            }
            if (customer.Status != "Active")
            {
                return BadRequest($"या ग्राहकाचे स्टेटस '{customer.Status}' असल्यामुळे नवीन मुदत ठेव खाते उघडता येत नाही. केवळ सक्रिय (Active) ग्राहकांचीच ठेव स्वीकारली जाऊ शकते.");
            }

            // 2. Validate Limits
            if (account.DepositAmount < scheme.MinimumAmount || account.DepositAmount > scheme.MaximumAmount)
            {
                return BadRequest($"Deposit amount must be between ₹{scheme.MinimumAmount} and ₹{scheme.MaximumAmount}.");
            }

            // 3. Generate Auto Account No
            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    var branch = await _context.Branches.FindAsync(account.BranchID);
                    string branchPrefix = branch != null ? branch.BranchCode : "BR";

                    var seq = await _context.FdAccountSequences
                        .FirstOrDefaultAsync(s => s.BranchID == account.BranchID && s.ProductType == "FD");
                    
                    if (seq == null)
                    {
                        seq = new FdAccountSequence { BranchID = account.BranchID, ProductType = "FD", CurrentValue = 0 };
                        _context.FdAccountSequences.Add(seq);
                    }
                    
                    seq.CurrentValue += 1;
                    await _context.SaveChangesAsync();

                    // E.g., KOP-001-FD-000001
                    account.AccountNo = $"{branchPrefix}-{account.BranchID:D3}-FD-{seq.CurrentValue:D6}";

                    // 4. Auto-Calculate Maturity Date & Amount
                    account.InterestRate = scheme.InterestRate;
                    account.MaturityDate = account.OpeningDate.AddMonths(scheme.DurationMonths);

                    decimal p = account.DepositAmount;
                    decimal r = scheme.InterestRate;
                    decimal t = (decimal)scheme.DurationMonths / 12.0m;

                    if (scheme.InterestType == "Cumulative")
                    {
                        int n = 4; // Default Quarterly
                        if (scheme.InterestCompoundingFrequency == "Half-Yearly") n = 2;
                        if (scheme.InterestCompoundingFrequency == "Yearly") n = 1;
                        if (scheme.InterestCompoundingFrequency == "Monthly") n = 12;

                        double baseVal = 1.0 + ((double)r / (n * 100.0));
                        double exponent = n * (double)t;
                        account.MaturityAmount = Math.Round(p * (decimal)Math.Pow(baseVal, exponent), 0, MidpointRounding.AwayFromZero);
                    }
                    else
                    {
                        // Simple Interest: A = P * (1 + R*T/100)
                        account.MaturityAmount = Math.Round(p * (1.0m + (r * t / 100.0m)), 0, MidpointRounding.AwayFromZero);
                    }

                    // 5. Default attributes
                    account.Status = "Active";
                    // Do not override IsLegacyAccount and LegacyAccruedInt sent from frontend
                    account.FinancialYearID = (await _context.FinancialYears.FirstOrDefaultAsync(fy => fy.IsActive))?.FinancialYearID ?? 1;

                    _context.FdAccounts.Add(account);
                    await _context.SaveChangesAsync();

                    // 6. Post Accounting Voucher (Only if it's a NEW account, not Legacy)
                    Ledger? fdLiabilityLedger = null;

                    if (scheme.FdLiabilityLedgerID.HasValue && scheme.FdLiabilityLedgerID.Value > 0)
                    {
                        fdLiabilityLedger = await _context.Ledgers.FindAsync(scheme.FdLiabilityLedgerID.Value);
                    }

                    if (fdLiabilityLedger == null)
                    {
                        fdLiabilityLedger = await _context.Ledgers.FirstOrDefaultAsync(l => 
                            l.AccountType == "FD" ||
                            l.AccountType == "FixedDeposit" ||
                            l.LedgerName.Contains("मुदत ठेव") || 
                            l.LedgerName.ToLower().Contains("fixed deposit") || 
                            l.LedgerName.ToLower().Contains("fd"));
                    }

                    Ledger? debitLedger = null;
                    if (account.PaymentMode == "Bank" && account.BankAccountLedgerID.HasValue && account.BankAccountLedgerID.Value > 0)
                    {
                        debitLedger = await _context.Ledgers.FindAsync(account.BankAccountLedgerID.Value);
                    }
                    else if (account.PaymentMode == "Transfer")
                    {
                        if (!account.SavingAccountID.HasValue || account.SavingAccountID.Value <= 0)
                        {
                            return BadRequest("कृपया वर्ग करण्यासाठी सभासदाचे बचत खाते निवडा.");
                        }

                        var sbAcc = await _context.SavingAccountMasters.FindAsync(account.SavingAccountID.Value);
                        if (sbAcc == null)
                        {
                            return BadRequest("निवडलेले बचत खाते आढळले नाही.");
                        }

                        if (sbAcc.CurrentBalance < account.DepositAmount)
                        {
                            return BadRequest($"अपुऱ्या शिल्लकेमुळे वर्ग करता येणार नाही! बचत खात्यात फक्त ₹{sbAcc.CurrentBalance:N2} शिल्लक आहेत (हवी असलेली रक्कम ₹{account.DepositAmount:N2}).");
                        }

                        if (sbAcc.LedgerID > 0)
                        {
                            debitLedger = await _context.Ledgers.FindAsync(sbAcc.LedgerID);
                        }

                        // Deduct balance from Member Savings Account
                        sbAcc.CurrentBalance -= account.DepositAmount;
                        _context.SavingTransactions.Add(new SavingTransaction
                        {
                            SavingAccountID = sbAcc.SavingAccountID,
                            CustomerID = sbAcc.CustomerID,
                            TransactionDate = account.OpeningDate,
                            TransactionType = "Withdrawal",
                            PaymentMode = "Transfer",
                            Amount = account.DepositAmount,
                            BalanceAfterTxn = sbAcc.CurrentBalance,
                            Narration = $"मुदत ठेव खात्यासाठी वर्ग (FD Opening SB Debit): {account.AccountNo}",
                            CreatedBy = account.CreatedBy,
                            CreatedOn = DateTime.Now
                        });

                        if (debitLedger == null)
                        {
                            debitLedger = await _context.Ledgers.FirstOrDefaultAsync(l => 
                                l.AccountType == "Savings" ||
                                l.LedgerName.Contains("सभासद बचत ठेव") || 
                                l.LedgerName.Contains("बचत ठेव") || 
                                l.LedgerName.ToLower().Contains("savings"));
                        }
                    }

                    if (debitLedger == null)
                    {
                        int branchCashId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, account.BranchID, "FD");
                        debitLedger = await _context.Ledgers.FindAsync(branchCashId);
                    }

                    var (voucherStatus, approvedBy, approvedOn) = await Helpers.ApprovalPolicyHelper.DetermineVoucherStatusAsync(_context, account.DepositAmount, account.CreatedBy);

                    if (!account.IsLegacyAccount && fdLiabilityLedger != null && debitLedger != null)
                    {
                        var voucher = new Voucher
                        {
                            BranchID = account.BranchID,
                            VoucherNo = $"REC-FD-OP-{account.AccountNo}",
                            VoucherDate = account.OpeningDate,
                            VoucherType = "Receipt",
                            Status = voucherStatus,
                            ApprovedBy = approvedBy,
                            ApprovedOn = approvedOn,
                            TotalAmount = account.DepositAmount,
                            Narration = $"मुदत ठेव खाते उघडले (FD Account Opened - {account.PaymentMode}): {account.AccountNo}",
                            CreatedBy = account.CreatedBy,
                            CreatedOn = DateTime.Now
                        };

                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();

                        var linkedMember = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == account.CustomerID);
                        int? linkedMemberId = linkedMember?.MemberID;

                        // Debit Cash / Bank / SB Savings
                        var debitDetail = new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = debitLedger.LedgerID,
                            DrCr = "Dr",
                            Amount = account.DepositAmount,
                            CustomerID = account.CustomerID,
                            MemberID = linkedMemberId
                        };

                        // Credit FD Liability (Mapped Scheme Ledger)
                        var creditDetail = new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = fdLiabilityLedger.LedgerID,
                            DrCr = "Cr",
                            Amount = account.DepositAmount,
                            CustomerID = account.CustomerID,
                            MemberID = linkedMemberId
                        };

                        _context.VoucherDetails.Add(debitDetail);
                        _context.VoucherDetails.Add(creditDetail);

                        await _context.SaveChangesAsync();
                    }

                    // Log initial transaction entry
                    if (fdLiabilityLedger != null)
                    {
                        var tx = new FdTransaction
                        {
                            BranchID = account.BranchID,
                            FdAccountID = account.FdAccountID,
                            VoucherID = _context.Vouchers.Local.FirstOrDefault()?.VoucherID ?? 1,
                            TransactionDate = account.OpeningDate,
                            TransactionType = "Opening",
                            DebitCredit = "Cr",
                            Amount = account.DepositAmount,
                            CreatedBy = account.CreatedBy
                        };
                        _context.FdTransactions.Add(tx);
                        await _context.SaveChangesAsync();
                    }

                    await transaction.CommitAsync();
                    return CreatedAtAction("GetFdAccount", new { id = account.FdAccountID }, account);
                }
                catch (Exception)
                {
                    await transaction.RollbackAsync();
                    throw;
                }
            }
        }

        // POST: api/FdAccounts/BulkCreate (Create multiple split FD receipts sequentially)
        [HttpPost("BulkCreate")]
        [AllowAnonymous]
        public async Task<IActionResult> BulkCreateFdAccounts([FromBody] BulkFdAccountRequest req)
        {
            // Resolve Customer & Member
            Customer? customer = null;
            Member? member = null;

            if (req.CustomerID.HasValue && req.CustomerID.Value > 0)
            {
                customer = await _context.Customers.FindAsync(req.CustomerID.Value);
                if (customer == null) return BadRequest("निवडलेला ग्राहक सिस्टीममध्ये अस्तित्वात नाही.");
                if (customer.Status != "Active") return BadRequest($"या ग्राहकाचे स्टेटस '{customer.Status}' असल्यामुळे नवीन मुदत ठेव खाते उघडता येत नाही. केवळ सक्रिय (Active) ग्राहकांचीच ठेव स्वीकारली जाऊ शकते.");

                member = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == customer.CustomerID);
            }
            else if (req.MemberID.HasValue && req.MemberID.Value > 0)
            {
                member = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == req.MemberID.Value);
                if (member == null) return BadRequest("निवडलेला सभासद सिस्टीममध्ये अस्तित्वात नाही.");
                if (member.Status != "Active") return BadRequest($"या सभासदाचे स्टेटस '{member.Status}' असल्यामुळे नवीन मुदत ठेव खाते उघडता येत नाही. केवळ सक्रिय (Active) सभासदांचीच ठेव स्वीकारली जाऊ शकते.");

                if (member.CustomerID > 0) customer = await _context.Customers.FindAsync(member.CustomerID);
            }
            else
            {
                return BadRequest("कृपया खातेदाराची (Customer / Member) निवड करा.");
            }

            int? resolvedCustomerId = customer?.CustomerID ?? (member?.CustomerID > 0 ? member.CustomerID : null);
            int? resolvedMemberId = member?.MemberID;

            if (!resolvedCustomerId.HasValue || resolvedCustomerId.Value <= 0)
            {
                return BadRequest("खातेदाराचा ग्राहक आयडी (Customer ID) उपलब्ध नाही.");
            }

            int finalCustomerId = resolvedCustomerId.Value;

            if (req.FdSchemeID <= 0) return BadRequest("कृपया ठेव योजना निवडा.");
            if (req.SplitCount <= 0) return BadRequest("पावत्यांची संख्या १ किंवा अधिक असावी.");

            var scheme = await _context.FdSchemes.FindAsync(req.FdSchemeID);
            if (scheme == null) return BadRequest("निवडलेली ठेव योजना अमान्य आहे.");

            decimal perReceiptAmount = req.AmountPerReceipt > 0 ? req.AmountPerReceipt : Math.Round(req.TotalAmount / req.SplitCount, 2);
            if (perReceiptAmount <= 0) return BadRequest("प्रति पावती रक्कम ० पेक्षा जास्त असावी.");

            if (perReceiptAmount < scheme.MinimumAmount || perReceiptAmount > scheme.MaximumAmount)
            {
                return BadRequest($"प्रति पावती रक्कम ₹{scheme.MinimumAmount} आणि ₹{scheme.MaximumAmount} च्या दरम्यान असावी.");
            }

            var createdAccounts = new List<FdAccount>();

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    var branch = await _context.Branches.FindAsync(req.BranchID);
                    string branchPrefix = branch != null ? branch.BranchCode : "BR";

                    var seq = await _context.FdAccountSequences
                        .FirstOrDefaultAsync(s => s.BranchID == req.BranchID && s.ProductType == "FD");

                    if (seq == null)
                    {
                        seq = new FdAccountSequence { BranchID = req.BranchID, ProductType = "FD", CurrentValue = 0 };
                        _context.FdAccountSequences.Add(seq);
                        await _context.SaveChangesAsync();
                    }

                    // Calculate maturity metrics for perReceiptAmount
                    decimal rate = req.IsSeniorCitizen ? scheme.SeniorCitizenInterestRate : scheme.InterestRate;
                    DateTime matDate = req.OpeningDate.AddMonths(scheme.DurationMonths);

                    decimal p = perReceiptAmount;
                    decimal r = rate;
                    decimal t = (decimal)scheme.DurationMonths / 12.0m;
                    decimal matAmount = 0;

                    if (scheme.InterestType == "Cumulative")
                    {
                        int n = 4;
                        if (scheme.InterestCompoundingFrequency == "Half-Yearly") n = 2;
                        if (scheme.InterestCompoundingFrequency == "Yearly") n = 1;
                        if (scheme.InterestCompoundingFrequency == "Monthly") n = 12;

                        double baseVal = 1.0 + ((double)r / (n * 100.0));
                        double exponent = n * (double)t;
                        matAmount = Math.Round(p * (decimal)Math.Pow(baseVal, exponent), 0, MidpointRounding.AwayFromZero);
                    }
                    else
                    {
                        matAmount = Math.Round(p * (1.0m + (r * t / 100.0m)), 0, MidpointRounding.AwayFromZero);
                    }

                    var activeFy = await _context.FinancialYears.FirstOrDefaultAsync(fy => fy.IsActive);
                    int fyId = activeFy?.FinancialYearID ?? 1;

                    // Resolve ledgers
                    Ledger? fdLiabilityLedger = null;
                    if (scheme.FdLiabilityLedgerID.HasValue && scheme.FdLiabilityLedgerID.Value > 0)
                    {
                        fdLiabilityLedger = await _context.Ledgers.FindAsync(scheme.FdLiabilityLedgerID.Value);
                    }
                    if (fdLiabilityLedger == null)
                    {
                        fdLiabilityLedger = await _context.Ledgers.FirstOrDefaultAsync(l =>
                            l.AccountType == "FD" ||
                            l.AccountType == "FixedDeposit" ||
                            l.LedgerName.Contains("मुदत ठेव") ||
                            l.LedgerName.ToLower().Contains("fixed deposit") ||
                            l.LedgerName.ToLower().Contains("fd"));
                    }

                    Ledger? debitLedger = null;
                    SavingAccountMaster? sbAcc = null;

                    if (req.PaymentMode == "Bank" && req.BankAccountLedgerID.HasValue && req.BankAccountLedgerID.Value > 0)
                    {
                        debitLedger = await _context.Ledgers.FindAsync(req.BankAccountLedgerID.Value);
                    }
                    else if (req.PaymentMode == "Transfer")
                    {
                        if (!req.SavingAccountID.HasValue || req.SavingAccountID.Value <= 0)
                        {
                            return BadRequest("कृपया वर्ग करण्यासाठी सभासदाचे बचत खाते निवडा.");
                        }

                        sbAcc = await _context.SavingAccountMasters.FindAsync(req.SavingAccountID.Value);
                        if (sbAcc == null)
                        {
                            return BadRequest("निवडलेले बचत खाते आढळले नाही.");
                        }

                        decimal totalRequired = perReceiptAmount * req.SplitCount;
                        if (sbAcc.CurrentBalance < totalRequired)
                        {
                            return BadRequest($"अपुऱ्या शिल्लकेमुळे वर्ग करता येणार नाही! बचत खात्यात फक्त ₹{sbAcc.CurrentBalance:N2} शिल्लक आहेत (एकूण वर्ग करायची रक्कम ₹{totalRequired:N2}).");
                        }

                        if (sbAcc.LedgerID > 0)
                        {
                            debitLedger = await _context.Ledgers.FindAsync(sbAcc.LedgerID);
                        }

                        if (debitLedger == null)
                        {
                            debitLedger = await _context.Ledgers.FirstOrDefaultAsync(l =>
                                l.AccountType == "Savings" ||
                                l.LedgerName.Contains("सभासद बचत ठेव") ||
                                l.LedgerName.Contains("बचत ठेव") ||
                                l.LedgerName.ToLower().Contains("savings"));
                        }
                    }

                    if (debitLedger == null)
                    {
                        int branchCashId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, req.BranchID, "FD");
                        debitLedger = await _context.Ledgers.FindAsync(branchCashId);
                    }

                    var sanstha = await _context.SansthaDetails.FirstOrDefaultAsync();
                    bool autoPost = sanstha?.AutoPostVouchers ?? false;
                    string voucherStatus = autoPost ? "Approved" : "Pending";

                    for (int i = 1; i <= req.SplitCount; i++)
                    {
                        seq.CurrentValue += 1;
                        string accNo = $"{branchPrefix}-{req.BranchID:D3}-FD-{seq.CurrentValue:D6}";

                        var acc = new FdAccount
                        {
                            BranchID = req.BranchID,
                            CustomerID = finalCustomerId,
                            FdSchemeID = req.FdSchemeID,
                            AccountNo = accNo,
                            OpeningDate = req.OpeningDate,
                            DepositAmount = perReceiptAmount,
                            InterestRate = rate,
                            MaturityDate = matDate,
                            MaturityAmount = matAmount,
                            IsLegacyAccount = false,
                            LegacyAccruedInt = 0,
                            Status = "Active",
                            NomineeName = req.NomineeName ?? "",
                            NomineeRelation = req.NomineeRelation ?? "",
                            Remarks = string.IsNullOrWhiteSpace(req.Remarks) 
                                ? $"बल्क स्प्लिट मुदत ठेव पावती ({i}/{req.SplitCount})"
                                : $"{req.Remarks} - स्प्लिट पावती ({i}/{req.SplitCount})",
                            PaymentMode = req.PaymentMode ?? "Cash",
                            BankAccountLedgerID = req.BankAccountLedgerID,
                            ChequeNo = req.ChequeNo,
                            ChequeDate = req.ChequeDate,
                            SavingAccountID = req.SavingAccountID,
                            FinancialYearID = fyId,
                            CreatedBy = 1,
                            CreatedDate = DateTime.UtcNow
                        };

                        _context.FdAccounts.Add(acc);
                        await _context.SaveChangesAsync();

                        // If SB account transfer, deduct balance per receipt
                        if (req.PaymentMode == "Transfer" && sbAcc != null)
                        {
                            sbAcc.CurrentBalance -= perReceiptAmount;
                            _context.SavingTransactions.Add(new SavingTransaction
                            {
                                SavingAccountID = sbAcc.SavingAccountID,
                                CustomerID = sbAcc.CustomerID,
                                TransactionDate = req.OpeningDate,
                                TransactionType = "Withdrawal",
                                PaymentMode = "Transfer",
                                Amount = perReceiptAmount,
                                BalanceAfterTxn = sbAcc.CurrentBalance,
                                Narration = $"बल्क मुदत ठेव पावतीसाठी वर्ग (Bulk FD Opening SB Debit {i}/{req.SplitCount}): {acc.AccountNo}",
                                CreatedBy = 1,
                                CreatedOn = DateTime.Now
                            });
                        }

                        // Create Accounting Voucher for each receipt
                        if (fdLiabilityLedger != null && debitLedger != null)
                        {
                            var voucher = new Voucher
                            {
                                BranchID = req.BranchID,
                                VoucherNo = $"JV-FD-{acc.AccountNo}",
                                VoucherDate = req.OpeningDate,
                                VoucherType = "Receipt",
                                TotalAmount = perReceiptAmount,
                                Narration = $"मुदत ठेव पावती जमा (FD Receipt Opened - Bulk {i}/{req.SplitCount} - {acc.PaymentMode}): {acc.AccountNo}",
                                Status = voucherStatus,
                                ApprovedBy = autoPost ? 1 : null,
                                ApprovedOn = autoPost ? DateTime.Now : null,
                                CreatedBy = 1,
                                CreatedOn = DateTime.Now
                            };
                            _context.Vouchers.Add(voucher);
                            await _context.SaveChangesAsync();

                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = debitLedger.LedgerID, DrCr = "Dr", Amount = perReceiptAmount, CustomerID = finalCustomerId, MemberID = resolvedMemberId });
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = fdLiabilityLedger.LedgerID, DrCr = "Cr", Amount = perReceiptAmount, CustomerID = finalCustomerId, MemberID = resolvedMemberId });

                            // Transaction log
                            var tx = new FdTransaction
                            {
                                BranchID = req.BranchID,
                                FdAccountID = acc.FdAccountID,
                                VoucherID = voucher.VoucherID,
                                TransactionDate = req.OpeningDate,
                                TransactionType = "Opening",
                                DebitCredit = "Cr",
                                Amount = perReceiptAmount,
                                CreatedBy = 1
                            };
                            _context.FdTransactions.Add(tx);
                        }

                        createdAccounts.Add(acc);
                    }

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    string startNo = createdAccounts.First().AccountNo;
                    string endNo = createdAccounts.Last().AccountNo;

                    return Ok(new
                    {
                        Message = $"एकूण {createdAccounts.Count} पावत्या यशस्वीरीत्या उघडल्या गेल्या! (पावती क्र. {startNo} ते {endNo})",
                        TotalCount = createdAccounts.Count,
                        StartAccountNo = startNo,
                        EndAccountNo = endNo,
                        Accounts = createdAccounts
                    });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("बल्क पावत्या उघडताना त्रुटी आली: " + ex.Message);
                }
            }
        }

        // POST: api/FdAccounts/Migrate (Legacy Data Migration)
        [HttpPost("Migrate")]
        [MigrationLockFilter]
        public async Task<ActionResult<FdAccount>> MigrateFdAccount(FdAccount account)
        {
            // Simple validation
            if (account.DepositAmount <= 0)
            {
                return BadRequest("Invalid deposit amount.");
            }

            account.IsLegacyAccount = true;
            account.Status = "Active";
            account.FinancialYearID = (await _context.FinancialYears.FirstOrDefaultAsync(fy => fy.IsActive))?.FinancialYearID ?? 1;

            if (string.IsNullOrWhiteSpace(account.AccountNo) || account.AccountNo == "AUTO")
            {
                var branch = await _context.Branches.FindAsync(account.BranchID);
                string branchPrefix = branch != null ? branch.BranchCode : "BR";

                var seq = await _context.FdAccountSequences
                    .FirstOrDefaultAsync(s => s.BranchID == account.BranchID && s.ProductType == "FD");
                
                if (seq == null)
                {
                    seq = new FdAccountSequence { BranchID = account.BranchID, ProductType = "FD", CurrentValue = 0 };
                    _context.FdAccountSequences.Add(seq);
                }
                
                seq.CurrentValue += 1;
                await _context.SaveChangesAsync();

                account.AccountNo = $"{branchPrefix}-{account.BranchID:D3}-FD-{seq.CurrentValue:D6}";
            }

            _context.FdAccounts.Add(account);
            await _context.SaveChangesAsync();

            // Create or fetch real opening voucher for data integrity
            var openingVoucherNo = $"JV-FD-OP-{account.AccountNo}";
            var dummyVoucher = await _context.Vouchers.FirstOrDefaultAsync(v => v.VoucherNo == openingVoucherNo);
            if (dummyVoucher == null)
            {
                dummyVoucher = new Voucher
                {
                    BranchID = account.BranchID,
                    VoucherNo = openingVoucherNo,
                    VoucherDate = account.OpeningDate,
                    VoucherType = "Journal",
                    TotalAmount = account.DepositAmount,
                    Narration = $"मुदत ठेव आरंभिक शिल्लक स्थलांतर (FD Opening Balance Migration): {account.AccountNo}",
                    CreatedBy = account.CreatedBy,
                    CreatedOn = DateTime.Now
                };
                _context.Vouchers.Add(dummyVoucher);
                await _context.SaveChangesAsync();
            }

            var tx = new FdTransaction
            {
                BranchID = account.BranchID,
                FdAccountID = account.FdAccountID,
                VoucherID = dummyVoucher.VoucherID,
                TransactionDate = account.OpeningDate,
                TransactionType = "Opening",
                DebitCredit = "Cr",
                Amount = account.DepositAmount,
                CreatedBy = account.CreatedBy
            };
            _context.FdTransactions.Add(tx);

            if (account.LegacyAccruedInt > 0)
            {
                var intTx = new FdTransaction
                {
                    BranchID = account.BranchID,
                    FdAccountID = account.FdAccountID,
                    VoucherID = dummyVoucher.VoucherID,
                    TransactionDate = account.OpeningDate,
                    TransactionType = "Accrual",
                    DebitCredit = "Cr",
                    Amount = account.LegacyAccruedInt,
                    CreatedBy = account.CreatedBy
                };
                _context.FdTransactions.Add(intTx);
            }

            await _context.SaveChangesAsync();
            return Ok(account);
        }

        // POST: api/FdAccounts/AccrueInterest
        [HttpPost("AccrueInterest")]
        public async Task<IActionResult> AccrueInterest([FromQuery] int branchId, [FromQuery] DateTime accrualDate)
        {
            var activeAccounts = await _context.FdAccounts
                .Include(a => a.FdScheme)
                .Where(a => a.BranchID == branchId && a.Status == "Active" && a.OpeningDate <= accrualDate)
                .ToListAsync();

            if (!activeAccounts.Any())
            {
                return Ok("No active accounts found for interest provision.");
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    decimal totalProvisionAmount = 0;
                    var provisionLogs = new List<FdInterestAccrual>();

                    var expenseLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("१३२ मुदत ठेवीवरील व्याज") || l.LedgerName.ToLower().Contains("interest expense"));
                    var payableLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("२३ देणे सभासद ठेव व्याज") || l.LedgerName.ToLower().Contains("interest payable"));
                    
                    if (expenseLedger == null || payableLedger == null)
                    {
                        return BadRequest("FD Interest expense or payable ledgers not configured.");
                    }

                    // Create provision voucher
                    var voucher = new Voucher
                    {
                        BranchID = branchId,
                        VoucherNo = $"JV-FD-PROV-{accrualDate:yyyyMMdd}",
                        VoucherDate = accrualDate,
                        VoucherType = "Journal",
                        TotalAmount = 0,
                        Narration = $"मुदत ठेव व्याज तरतूद (FD Interest Provision Run): {accrualDate:dd/MM/yyyy}",
                        CreatedBy = 1,
                        CreatedOn = DateTime.Now
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    foreach (var acc in activeAccounts)
                    {
                        // Calculate accrued days since opening or last accrual
                        var lastAccrual = await _context.FdInterestAccruals
                            .Where(a => a.FdAccountID == acc.FdAccountID)
                            .OrderByDescending(a => a.AccrualDate)
                            .FirstOrDefaultAsync();

                        DateTime fromDate = lastAccrual?.AccrualDate ?? acc.OpeningDate;
                        int days = (accrualDate - fromDate).Days;

                        if (days <= 0) continue;

                        decimal effectivePrincipal = acc.DepositAmount;
                        
                        if (acc.FdScheme != null && acc.FdScheme.InterestPostingMethod == "On Interest")
                        {
                            int monthsPerPeriod = 12; // Default Yearly
                            if (acc.FdScheme.InterestCompoundingFrequency == "Quarterly") monthsPerPeriod = 3;
                            if (acc.FdScheme.InterestCompoundingFrequency == "Half-Yearly") monthsPerPeriod = 6;
                            if (acc.FdScheme.InterestCompoundingFrequency == "Monthly") monthsPerPeriod = 1;

                            int monthsSinceOpening = (accrualDate.Year - acc.OpeningDate.Year) * 12 + accrualDate.Month - acc.OpeningDate.Month;
                            if (accrualDate.Day < acc.OpeningDate.Day) monthsSinceOpening--;

                            int completedPeriods = monthsSinceOpening / monthsPerPeriod;
                            
                            if (completedPeriods > 0)
                            {
                                DateTime lastCompoundingDate = acc.OpeningDate.AddMonths(completedPeriods * monthsPerPeriod);
                                
                                // Sum accrued interest up to the last compounding date
                                var capitalizedInterest = await _context.FdTransactions
                                    .Where(t => t.FdAccountID == acc.FdAccountID 
                                             && t.TransactionType == "Accrual" 
                                             && t.TransactionDate <= lastCompoundingDate)
                                    .SumAsync(t => t.Amount);
                                    
                                effectivePrincipal += capitalizedInterest;
                            }
                        }

                        // Daily Interest Formula: Interest = (Principal * Rate * Days) / 36500
                        decimal dailyInterest = Math.Round((effectivePrincipal * acc.InterestRate * days) / 36500.0m, 2);

                        if (dailyInterest > 0)
                        {
                            totalProvisionAmount += dailyInterest;

                            var log = new FdInterestAccrual
                            {
                                BranchID = branchId,
                                FdAccountID = acc.FdAccountID,
                                VoucherID = voucher.VoucherID,
                                AccrualDate = accrualDate,
                                CalculatedDays = days,
                                InterestAmount = dailyInterest,
                                IsPosted = true
                            };
                            _context.FdInterestAccruals.Add(log);

                            // Log Transaction Details
                            var tx = new FdTransaction
                            {
                                BranchID = branchId,
                                FdAccountID = acc.FdAccountID,
                                VoucherID = voucher.VoucherID,
                                TransactionDate = accrualDate,
                                TransactionType = "Accrual",
                                DebitCredit = "Cr",
                                Amount = dailyInterest
                            };
                            _context.FdTransactions.Add(tx);
                        }
                    }

                    if (totalProvisionAmount > 0)
                    {
                        // Update voucher amount
                        voucher.TotalAmount = totalProvisionAmount;

                        // Dr Expense, Cr Payable
                        var drDetail = new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = expenseLedger.LedgerID, DrCr = "Dr", Amount = totalProvisionAmount };
                        var crDetail = new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Cr", Amount = totalProvisionAmount };
                        
                        _context.VoucherDetails.Add(drDetail);
                        _context.VoucherDetails.Add(crDetail);

                        await _context.SaveChangesAsync();
                        await transaction.CommitAsync();
                        return Ok($"Successfully provisioned ₹{totalProvisionAmount:F2} interest across accounts.");
                    }
                    else
                    {
                        await transaction.RollbackAsync();
                        return Ok("No interest calculated for the given period.");
                    }
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("Failed to process provision: " + ex.Message);
                }
            }
        }

        // POST: api/FdAccounts/5/MaturedClose (Standard Maturity Close)
        [HttpPost("{id}/MaturedClose")]
        public async Task<IActionResult> MaturedClose(int id, [FromBody] FdClosureRequest? req = null)
        {
            var account = await _context.FdAccounts
                .Include(a => a.FdScheme)
                .ThenInclude(s => s!.FdLiabilityLedger)
                .Include(a => a.FdScheme)
                .ThenInclude(s => s!.InterestPayableLedger)
                .FirstOrDefaultAsync(a => a.FdAccountID == id);

            if (account == null || account.Status == "Closed")
            {
                return BadRequest("Account is closed or invalid.");
            }

            // Fetch accrued interest
            var accruedInt = await _context.FdTransactions
                .Where(t => t.FdAccountID == id && t.TransactionType == "Accrual")
                .SumAsync(t => t.Amount);

            decimal totalMaturityPayout = account.DepositAmount + accruedInt + account.LegacyAccruedInt;
            DateTime closureDate = req?.ClosureDate ?? DateTime.Today;
            string paymentMode = string.IsNullOrWhiteSpace(req?.PaymentMode) ? "Cash" : req.PaymentMode;

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    account.Status = "Closed";
                    account.Remarks = (account.Remarks ?? "") + $" | बंद दिनांक: {closureDate:dd/MM/yyyy} ({paymentMode})";
                    await _context.SaveChangesAsync();

                    var fdLiabilityLedger = account.FdScheme?.FdLiabilityLedger ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("१२ मेंबर मुदत ठेव") || l.LedgerName.ToLower().Contains("fixed deposit"));
                    var payableLedger = account.FdScheme?.InterestPayableLedger ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("२३ देणे सभासद ठेव व्याज") || l.LedgerName.ToLower().Contains("interest payable"));

                    int payoutLedgerId = 0;
                    if (paymentMode == "Bank" && req?.BankAccountLedgerID > 0)
                    {
                        payoutLedgerId = req.BankAccountLedgerID.Value;
                    }
                    else if (paymentMode == "Transfer" && req?.SavingAccountID > 0)
                    {
                        var savAccount = await _context.SavingAccountMasters
                            .Include(s => s.Ledger)
                            .FirstOrDefaultAsync(s => s.SavingAccountID == req.SavingAccountID.Value);

                        if (savAccount != null)
                        {
                            savAccount.CurrentBalance += totalMaturityPayout;
                            payoutLedgerId = savAccount.LedgerID > 0 ? savAccount.LedgerID : (savAccount.Ledger?.LedgerID ?? 7);

                            var savTx = new SavingTransaction
                            {
                                SavingAccountID = savAccount.SavingAccountID,
                                CustomerID = savAccount.CustomerID,
                                TransactionDate = closureDate,
                                TransactionType = "Deposit",
                                PaymentMode = "Transfer",
                                Amount = totalMaturityPayout,
                                BalanceAfterTxn = savAccount.CurrentBalance,
                                Narration = $"मुदत ठेव परतावा जमा (FD Maturity Payout): {account.AccountNo}",
                                VoucherNo = $"JV-FD-CLOSE-{account.AccountNo}",
                                CreatedBy = 1,
                                CreatedOn = DateTime.Now
                            };
                            _context.SavingTransactions.Add(savTx);
                        }
                        else
                        {
                            payoutLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, account.BranchID, "FD");
                        }
                    }
                    else
                    {
                        payoutLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, account.BranchID, "FD");
                    }

                    var payoutLedger = await _context.Ledgers.FindAsync(payoutLedgerId);
                    if (fdLiabilityLedger == null || payoutLedger == null)
                    {
                        return BadRequest("Required ledgers not found.");
                    }

                    // Create Voucher
                    var voucher = new Voucher
                    {
                        BranchID = account.BranchID,
                        VoucherNo = $"JV-FD-CLOSE-{account.AccountNo}",
                        VoucherDate = closureDate,
                        VoucherType = paymentMode == "Cash" ? "Payment" : (paymentMode == "Bank" ? "Bank Payment" : "Transfer"),
                        TotalAmount = totalMaturityPayout,
                        Narration = string.IsNullOrWhiteSpace(req?.Narration) 
                            ? $"मुदत ठेव पूर्ण क्लोजर (FD Maturity Payout - {paymentMode}): {account.AccountNo}{(paymentMode == "Bank" && !string.IsNullOrEmpty(req?.ChequeNo) ? $" Cheque: {req.ChequeNo}" : "")}"
                            : req.Narration,
                        CreatedBy = 1,
                        CreatedOn = DateTime.Now
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    var linkedMember = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == account.CustomerID);
                    int? linkedMemberId = linkedMember?.MemberID;

                    // Dr FD Liability (Principal)
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = fdLiabilityLedger.LedgerID, DrCr = "Dr", Amount = account.DepositAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                    
                    // Dr Interest Payable (Interest)
                    if (payableLedger != null && (accruedInt + account.LegacyAccruedInt) > 0)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = accruedInt + account.LegacyAccruedInt, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                    }

                    // Cr Payout Ledger (Cash, Bank, or Saving)
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payoutLedger.LedgerID, DrCr = "Cr", Amount = totalMaturityPayout, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                    // Log Close Transaction
                    var tx = new FdTransaction
                    {
                        BranchID = account.BranchID,
                        FdAccountID = account.FdAccountID,
                        VoucherID = voucher.VoucherID,
                        TransactionDate = closureDate,
                        TransactionType = "Payout",
                        DebitCredit = "Dr",
                        Amount = totalMaturityPayout
                    };
                    _context.FdTransactions.Add(tx);

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();
                    return Ok($"FD Account matured closed ({paymentMode}). Total payout: ₹{totalMaturityPayout:F2}");
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("Failed to mature close: " + ex.Message);
                }
            }
        }

        // POST: api/FdAccounts/5/PrematureClose
        [HttpPost("{id}/PrematureClose")]
        public async Task<IActionResult> PrematureClose(int id, [FromQuery] DateTime? closureDate = null, [FromBody] FdClosureRequest? req = null)
        {
            var account = await _context.FdAccounts
                .Include(a => a.FdScheme)
                .ThenInclude(s => s!.FdLiabilityLedger)
                .Include(a => a.FdScheme)
                .ThenInclude(s => s!.InterestPayableLedger)
                .Include(a => a.FdScheme)
                .ThenInclude(s => s!.PrematurePenaltyLedger)
                .FirstOrDefaultAsync(a => a.FdAccountID == id);

            if (account == null || account.Status == "Closed")
            {
                return BadRequest("Account is closed or invalid.");
            }

            DateTime effectiveClosureDate = req?.ClosureDate ?? closureDate ?? DateTime.Today;
            string paymentMode = string.IsNullOrWhiteSpace(req?.PaymentMode) ? "Cash" : req.PaymentMode;

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    // 1. Calculate actual days held
                    int actualDays = (effectiveClosureDate - account.OpeningDate).Days;
                    if (actualDays <= 0) actualDays = 1;

                    // 2. Determine premature interest rate
                    decimal originalRate = account.InterestRate;
                    decimal prematureRate = account.FdScheme?.PrematureInterestRate ?? (originalRate - 1.0m);
                    if (prematureRate < 0) prematureRate = 0;

                    // 3. Recalculate interest
                    decimal recalculatedInterest = Math.Round((account.DepositAmount * prematureRate * actualDays) / 36500.0m, 2);

                    // 4. Determine already provisioned/paid interest
                    decimal alreadyAccruedInt = await _context.FdTransactions
                        .Where(t => t.FdAccountID == id && t.TransactionType == "Accrual")
                        .SumAsync(t => t.Amount) + account.LegacyAccruedInt;

                    // 5. Final payable calculations
                    decimal penaltyClawback = 0;
                    decimal netPayoutAmount = account.DepositAmount + recalculatedInterest;

                    // If we already paid/accrued more than recalculated, clawback from principal
                    if (alreadyAccruedInt > recalculatedInterest)
                    {
                        penaltyClawback = alreadyAccruedInt - recalculatedInterest;
                        netPayoutAmount = account.DepositAmount - penaltyClawback;
                    }

                    account.Status = "Closed";
                    account.Remarks = (account.Remarks ?? "") + $" | मुदतपूर्व बंद: {effectiveClosureDate:dd/MM/yyyy} ({paymentMode})";
                    await _context.SaveChangesAsync();

                    var fdLiabilityLedger = account.FdScheme?.FdLiabilityLedger ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("१२ मेंबर मुदत ठेव") || l.LedgerName.ToLower().Contains("fixed deposit"));
                    var payableLedger = account.FdScheme?.InterestPayableLedger ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("२३ देणे सभासद ठेव व्याज") || l.LedgerName.ToLower().Contains("interest payable"));
                    
                    int payoutLedgerId = 0;
                    if (paymentMode == "Bank" && req?.BankAccountLedgerID > 0)
                    {
                        payoutLedgerId = req.BankAccountLedgerID.Value;
                    }
                    else if (paymentMode == "Transfer" && req?.SavingAccountID > 0)
                    {
                        var savAccount = await _context.SavingAccountMasters
                            .Include(s => s.Ledger)
                            .FirstOrDefaultAsync(s => s.SavingAccountID == req.SavingAccountID.Value);

                        if (savAccount != null)
                        {
                            savAccount.CurrentBalance += netPayoutAmount;
                            payoutLedgerId = savAccount.LedgerID > 0 ? savAccount.LedgerID : (savAccount.Ledger?.LedgerID ?? 7);

                            var savTx = new SavingTransaction
                            {
                                SavingAccountID = savAccount.SavingAccountID,
                                CustomerID = savAccount.CustomerID,
                                TransactionDate = effectiveClosureDate,
                                TransactionType = "Deposit",
                                PaymentMode = "Transfer",
                                Amount = netPayoutAmount,
                                BalanceAfterTxn = savAccount.CurrentBalance,
                                Narration = $"मुदत ठेव मुदतपूर्व परतावा जमा (FD Premature Payout): {account.AccountNo}",
                                VoucherNo = $"JV-FD-PRECLOSE-{account.AccountNo}",
                                CreatedBy = 1,
                                CreatedOn = DateTime.Now
                            };
                            _context.SavingTransactions.Add(savTx);
                        }
                        else
                        {
                            payoutLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, account.BranchID, "FD");
                        }
                    }
                    else
                    {
                        payoutLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, account.BranchID, "FD");
                    }

                    var payoutLedger = await _context.Ledgers.FindAsync(payoutLedgerId);
                    if (fdLiabilityLedger == null || payoutLedger == null)
                    {
                        return BadRequest("Required ledgers not found.");
                    }

                    // Create Voucher
                    var voucher = new Voucher
                    {
                        BranchID = account.BranchID,
                        VoucherNo = $"JV-FD-PRECLOSE-{account.AccountNo}",
                        VoucherDate = effectiveClosureDate,
                        VoucherType = paymentMode == "Cash" ? "Payment" : (paymentMode == "Bank" ? "Bank Payment" : "Transfer"),
                        TotalAmount = netPayoutAmount,
                        Narration = string.IsNullOrWhiteSpace(req?.Narration)
                            ? $"मुदतपूर्व बंद (Premature Close - {paymentMode}) - Days: {actualDays}, Recalc Int: ₹{recalculatedInterest}, Clawback: ₹{penaltyClawback}{(paymentMode == "Bank" && !string.IsNullOrEmpty(req?.ChequeNo) ? $" Cheque: {req.ChequeNo}" : "")}"
                            : req.Narration,
                        CreatedBy = 1,
                        CreatedOn = DateTime.Now
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    var linkedMember = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == account.CustomerID);
                    int? linkedMemberId = linkedMember?.MemberID;

                    // Dr FD Liability (Principal)
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = fdLiabilityLedger.LedgerID, DrCr = "Dr", Amount = account.DepositAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                    // Dr Interest Payable (Interest already accrued is fully debited)
                    if (payableLedger != null && alreadyAccruedInt > 0)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = alreadyAccruedInt, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                    }

                    // Dr Additional Current Interest Expense (if recalculated interest exceeds already accrued)
                    if (recalculatedInterest > alreadyAccruedInt)
                    {
                        decimal unprovisionedInterest = recalculatedInterest - alreadyAccruedInt;
                        var expenseLedger = account.FdScheme?.InterestExpenseLedger ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("१३२ मुदत ठेवीवरील व्याज") || l.LedgerName.ToLower().Contains("interest expense"));
                        if (expenseLedger != null)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = expenseLedger.LedgerID, DrCr = "Dr", Amount = unprovisionedInterest, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        }
                    }

                    // Cr Payout Ledger (Net payout)
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payoutLedger.LedgerID, DrCr = "Cr", Amount = netPayoutAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                    // Cr Interest Expense / Clawback Income
                    if (penaltyClawback > 0)
                    {
                        var clawbackLedger = account.FdScheme?.PrematurePenaltyLedger ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("१३२ मुदत ठेवीवरील व्याज") || l.LedgerName.ToLower().Contains("interest expense"));
                        if (clawbackLedger != null)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = clawbackLedger.LedgerID, DrCr = "Cr", Amount = penaltyClawback, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        }
                    }

                    // Log Close Transaction
                    var tx = new FdTransaction
                    {
                        BranchID = account.BranchID,
                        FdAccountID = account.FdAccountID,
                        VoucherID = voucher.VoucherID,
                        TransactionDate = effectiveClosureDate,
                        TransactionType = "Premature_Close",
                        DebitCredit = "Dr",
                        Amount = netPayoutAmount
                    };
                    _context.FdTransactions.Add(tx);

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();
                    return Ok(new { Message = $"FD Prematurely Closed ({paymentMode})", ActualDays = actualDays, RecalcInt = recalculatedInterest, Clawback = penaltyClawback, NetPayout = netPayoutAmount });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("Failed to premature close: " + ex.Message);
                }
            }
        }

        // POST: api/FdAccounts/5/Renew
        [HttpPost("{id}/Renew")]
        public async Task<IActionResult> Renew(int id, [FromBody] FdRenewalRequest request)
        {
            var oldAccount = await _context.FdAccounts
                .Include(a => a.FdScheme)
                .ThenInclude(s => s!.FdLiabilityLedger)
                .Include(a => a.FdScheme)
                .ThenInclude(s => s!.InterestPayableLedger)
                .FirstOrDefaultAsync(a => a.FdAccountID == id);

            if (oldAccount == null || oldAccount.Status == "Closed")
            {
                return BadRequest("Account is closed or invalid.");
            }

            var scheme = await _context.FdSchemes
                .Include(s => s.FdLiabilityLedger)
                .FirstOrDefaultAsync(s => s.FdSchemeID == request.TargetSchemeID);

            if (scheme == null)
            {
                return BadRequest("Target Scheme not found.");
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    // 1. Calculate Old Interest
                    var accruedInt = await _context.FdTransactions
                        .Where(t => t.FdAccountID == id && t.TransactionType == "Accrual")
                        .SumAsync(t => t.Amount) + oldAccount.LegacyAccruedInt;

                    decimal totalMaturityAmount = oldAccount.DepositAmount + accruedInt;
                    decimal newDepositAmount = request.RenewalType == "PrincipalOnly" ? oldAccount.DepositAmount : totalMaturityAmount;
                    DateTime closureDate = request.ClosureDate ?? DateTime.Today;
                    string paymentMode = string.IsNullOrWhiteSpace(request.PaymentMode) ? "Cash" : request.PaymentMode;

                    // Close Old Account
                    oldAccount.Status = "Closed";
                    oldAccount.Remarks = (oldAccount.Remarks ?? "") + $" | नूतनीकरण दिनांक: {closureDate:dd/MM/yyyy} ({request.RenewalType})";
                    await _context.SaveChangesAsync();

                    // 2. Generate Account Number
                    var branch = await _context.Branches.FindAsync(oldAccount.BranchID);
                    string branchPrefix = branch != null ? branch.BranchCode : "HO";

                    var seq = await _context.FdAccountSequences
                        .FirstOrDefaultAsync(s => s.BranchID == oldAccount.BranchID && s.ProductType == "FD");
                    
                    if (seq == null)
                    {
                        seq = new FdAccountSequence { BranchID = oldAccount.BranchID, ProductType = "FD", CurrentValue = 0 };
                        _context.FdAccountSequences.Add(seq);
                    }
                    
                    seq.CurrentValue += 1;
                    await _context.SaveChangesAsync();

                    // Create New FD Account
                    var newAccount = new FdAccount
                    {
                        InstitutionID = oldAccount.InstitutionID,
                        BranchID = oldAccount.BranchID,
                        FinancialYearID = oldAccount.FinancialYearID,
                        CustomerID = oldAccount.CustomerID,
                        FdSchemeID = request.TargetSchemeID,
                        AccountNo = $"{branchPrefix}-{oldAccount.BranchID:D3}-FD-{seq.CurrentValue:D6}",
                        OpeningDate = closureDate,
                        DepositAmount = newDepositAmount,
                        InterestRate = scheme.InterestRate,
                        MaturityDate = closureDate.AddMonths(scheme.DurationMonths),
                        Status = "Active",
                        NomineeName = oldAccount.NomineeName,
                        NomineeRelation = oldAccount.NomineeRelation,
                        Remarks = $"नूतनीकरण खाते (Renewed from): {oldAccount.AccountNo}"
                    };

                    // Maturity Calculations
                    decimal p = newDepositAmount;
                    decimal r = scheme.InterestRate;
                    decimal t = (decimal)scheme.DurationMonths / 12.0m;

                    if (scheme.InterestType == "Cumulative")
                    {
                        int n = 4; // Default Quarterly
                        if (scheme.InterestCompoundingFrequency == "Half-Yearly") n = 2;
                        if (scheme.InterestCompoundingFrequency == "Yearly") n = 1;
                        if (scheme.InterestCompoundingFrequency == "Monthly") n = 12;

                        double baseVal = 1.0 + ((double)r / (n * 100.0));
                        double exponent = n * (double)t;
                        newAccount.MaturityAmount = p * (decimal)Math.Pow(baseVal, exponent);
                    }
                    else
                    {
                        newAccount.MaturityAmount = p * (1.0m + (r * t / 100.0m));
                    }

                    _context.FdAccounts.Add(newAccount);
                    await _context.SaveChangesAsync();

                    // 3. Post Renewal Vouchers
                    var fdLiabilityLedger = scheme.FdLiabilityLedger ?? oldAccount.FdScheme?.FdLiabilityLedger ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("१२ मेंबर मुदत ठेव") || l.LedgerName.ToLower().Contains("fixed deposit"));
                    var payableLedger = oldAccount.FdScheme?.InterestPayableLedger ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("२३ देणे सभासद ठेव व्याज") || l.LedgerName.ToLower().Contains("interest payable"));
                    
                    int interestPayoutLedgerId = 0;
                    if (request.RenewalType == "PrincipalOnly" && accruedInt > 0)
                    {
                        if (paymentMode == "Bank" && request.BankAccountLedgerID > 0)
                        {
                            interestPayoutLedgerId = request.BankAccountLedgerID.Value;
                        }
                        else if (paymentMode == "Transfer" && request.SavingAccountID > 0)
                        {
                            var savAccount = await _context.SavingAccountMasters
                                .Include(s => s.Ledger)
                                .FirstOrDefaultAsync(s => s.SavingAccountID == request.SavingAccountID.Value);

                            if (savAccount != null)
                            {
                                savAccount.CurrentBalance += accruedInt;
                                interestPayoutLedgerId = savAccount.LedgerID > 0 ? savAccount.LedgerID : (savAccount.Ledger?.LedgerID ?? 7);

                                var savTx = new SavingTransaction
                                {
                                    SavingAccountID = savAccount.SavingAccountID,
                                    CustomerID = savAccount.CustomerID,
                                    TransactionDate = closureDate,
                                    TransactionType = "Deposit",
                                    PaymentMode = "Transfer",
                                    Amount = accruedInt,
                                    BalanceAfterTxn = savAccount.CurrentBalance,
                                    Narration = $"मुदत ठेव नूतनीकरण व्याज जमा (FD Renewal Interest): {oldAccount.AccountNo}",
                                    VoucherNo = $"JV-FD-REN-{newAccount.AccountNo}",
                                    CreatedBy = 1,
                                    CreatedOn = DateTime.Now
                                };
                                _context.SavingTransactions.Add(savTx);
                            }
                            else
                            {
                                interestPayoutLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, oldAccount.BranchID, "FD");
                            }
                        }
                        else
                        {
                            interestPayoutLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, oldAccount.BranchID, "FD");
                        }
                    }

                    var voucher = new Voucher
                    {
                        BranchID = oldAccount.BranchID,
                        VoucherNo = $"JV-FD-REN-{newAccount.AccountNo}",
                        VoucherDate = closureDate,
                        VoucherType = "Journal",
                        TotalAmount = totalMaturityAmount,
                        Narration = $"मुदत ठेव नूतनीकरण (FD Renewal): {oldAccount.AccountNo} -> {newAccount.AccountNo}",
                        CreatedBy = 1,
                        CreatedOn = DateTime.Now
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    var linkedMember = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == oldAccount.CustomerID);
                    int? linkedMemberId = linkedMember?.MemberID;

                    // Dr Old FD Liability (Principal)
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = fdLiabilityLedger?.LedgerID ?? 12, DrCr = "Dr", Amount = oldAccount.DepositAmount, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });
                    
                    // Dr Interest Payable (Accumulated Interest)
                    if (payableLedger != null && accruedInt > 0)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = accruedInt, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });
                    }

                    // Cr New FD Liability
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = fdLiabilityLedger?.LedgerID ?? 12, DrCr = "Cr", Amount = newDepositAmount, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });

                    // Cr Interest Payout (If Principal Only, pay out interest to Cash, Bank, or Saving)
                    if (request.RenewalType == "PrincipalOnly" && accruedInt > 0 && interestPayoutLedgerId > 0)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = interestPayoutLedgerId, DrCr = "Cr", Amount = accruedInt, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });
                    }

                    // Log Transactions
                    _context.FdTransactions.Add(new FdTransaction
                    {
                        BranchID = oldAccount.BranchID,
                        FdAccountID = oldAccount.FdAccountID,
                        VoucherID = voucher.VoucherID,
                        TransactionDate = closureDate,
                        TransactionType = "Renewal",
                        DebitCredit = "Dr",
                        Amount = totalMaturityAmount
                    });

                    _context.FdTransactions.Add(new FdTransaction
                    {
                        BranchID = newAccount.BranchID,
                        FdAccountID = newAccount.FdAccountID,
                        VoucherID = voucher.VoucherID,
                        TransactionDate = closureDate,
                        TransactionType = "Opening",
                        DebitCredit = "Cr",
                        Amount = newDepositAmount
                    });

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();
                    return Ok(new { Message = "FD Renewed successfully", NewAccountNo = newAccount.AccountNo, NewDeposit = newDepositAmount });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("Failed to process renewal: " + ex.Message);
                }
            }
        }

        // PUT: api/FdAccounts/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutFdAccount(int id, FdAccount account)
        {
            if (id != account.FdAccountID)
            {
                return BadRequest("ID mismatch.");
            }

            var existing = await _context.FdAccounts.FindAsync(id);
            if (existing == null)
            {
                return NotFound("मुदत ठेव खाते सापडले नाही.");
            }

            existing.BranchID = account.BranchID;
            existing.CustomerID = account.CustomerID;
            existing.FdSchemeID = account.FdSchemeID;
            if (!string.IsNullOrWhiteSpace(account.AccountNo)) existing.AccountNo = account.AccountNo;
            existing.OpeningDate = account.OpeningDate;
            existing.DepositAmount = account.DepositAmount;
            existing.InterestRate = account.InterestRate;
            existing.MaturityDate = account.MaturityDate;
            existing.MaturityAmount = account.MaturityAmount;
            existing.LegacyAccruedInt = account.LegacyAccruedInt;
            if (account.NomineeName != null) existing.NomineeName = account.NomineeName;
            if (account.NomineeRelation != null) existing.NomineeRelation = account.NomineeRelation;
            if (account.Remarks != null) existing.Remarks = account.Remarks;

            try
            {
                await _context.SaveChangesAsync();
                return Ok(existing);
            }
            catch (Exception ex)
            {
                return BadRequest("Update करताना त्रुटी आली: " + ex.Message);
            }
        }

        // DELETE: api/FdAccounts/{id}
        // फक्त Active आणि transaction नसलेले खाते delete करता येते (Only Active accounts with no transactions)
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteFdAccount(int id)
        {
            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    var account = await _context.FdAccounts
                        .FirstOrDefaultAsync(f => f.FdAccountID == id);

                    if (account == null)
                        return NotFound("मुदत ठेव खाते सापडले नाही.");

                    // Safety: Only allow deletion of Active accounts
                    if (account.Status != "Active")
                        return BadRequest($"फक्त 'Active' स्थितीतील खाते delete करता येते. सध्याची स्थिती: {account.Status}");

                    // Check transactions
                    var transactions = await _context.FdTransactions.Where(t => t.FdAccountID == id).ToListAsync();
                    if (account.IsLegacyAccount)
                    {
                        bool hasOtherTx = transactions.Any(t => t.TransactionType != "Opening" && t.TransactionType != "Accrual");
                        if (hasOtherTx)
                        {
                            return BadRequest("या खात्यावर पुढील व्यवहार नोंद आहेत. खाते delete करता येत नाही.");
                        }
                        _context.FdTransactions.RemoveRange(transactions);
                    }
                    else
                    {
                        if (transactions.Any())
                            return BadRequest("या खात्यावर व्यवहार (transactions) नोंद आहेत. खाते delete करता येत नाही.");
                    }

                    // Delete related opening voucher if it exists (JV-FD-OP-{AccountNo})
                    var openingVoucherNo = $"JV-FD-OP-{account.AccountNo}";
                    var openingVoucher = await _context.Vouchers
                        .Include(v => v.VoucherDetails)
                        .FirstOrDefaultAsync(v => v.VoucherNo == openingVoucherNo);

                    if (openingVoucher != null)
                    {
                        _context.VoucherDetails.RemoveRange(openingVoucher.VoucherDetails);
                        _context.Vouchers.Remove(openingVoucher);
                    }

                    // Delete related interest accruals
                    var accruals = await _context.FdInterestAccruals
                        .Where(a => a.FdAccountID == id)
                        .ToListAsync();
                    if (accruals.Any())
                        _context.FdInterestAccruals.RemoveRange(accruals);

                    // Recalculate remaining max sequence counter
                    var seq = await _context.FdAccountSequences
                        .FirstOrDefaultAsync(s => s.BranchID == account.BranchID && s.ProductType == "FD");
                    if (seq != null)
                    {
                        var remainingMaxSeq = await _context.FdAccounts
                            .Where(a => a.BranchID == account.BranchID && a.FdAccountID != id)
                            .Select(a => a.AccountNo)
                            .ToListAsync();

                        int maxNum = 0;
                        foreach (var accNo in remainingMaxSeq)
                        {
                            var parts = accNo.Split('-');
                            if (parts.Length > 0 && int.TryParse(parts.Last(), out int parsed))
                            {
                                if (parsed > maxNum) maxNum = parsed;
                            }
                        }
                        seq.CurrentValue = maxNum;
                        _context.FdAccountSequences.Update(seq);
                    }

                    _context.FdAccounts.Remove(account);
                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok(new { Message = $"मुदत ठेव खाते '{account.AccountNo}' यशस्वीरित्या delete केले." });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("Delete करताना त्रुटी आली: " + ex.Message);
                }
            }
        }

        // DELETE: api/FdAccounts/ClearData (Clear all test FD records & reset sequences)
        [HttpDelete("ClearData")]
        [AllowAnonymous]
        public async Task<IActionResult> ClearData()
        {
            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    // 1. Delete FD Transactions
                    var txs = await _context.FdTransactions.ToListAsync();
                    if (txs.Any()) _context.FdTransactions.RemoveRange(txs);

                    // 2. Delete FD Interest Accruals
                    var accruals = await _context.FdInterestAccruals.ToListAsync();
                    if (accruals.Any()) _context.FdInterestAccruals.RemoveRange(accruals);

                    // 3. Delete FD Vouchers
                    var fdVouchers = await _context.Vouchers
                        .Include(v => v.VoucherDetails)
                        .Where(v => v.VoucherNo.StartsWith("JV-FD-"))
                        .ToListAsync();
                    foreach (var v in fdVouchers)
                    {
                        if (v.VoucherDetails != null && v.VoucherDetails.Any())
                        {
                            _context.VoucherDetails.RemoveRange(v.VoucherDetails);
                        }
                    }
                    if (fdVouchers.Any()) _context.Vouchers.RemoveRange(fdVouchers);

                    // 4. Delete FD Accounts
                    var accounts = await _context.FdAccounts.ToListAsync();
                    if (accounts.Any()) _context.FdAccounts.RemoveRange(accounts);

                    // 5. Reset FD Sequences
                    var seqs = await _context.FdAccountSequences.Where(s => s.ProductType == "FD").ToListAsync();
                    foreach (var s in seqs)
                    {
                        s.CurrentValue = 0;
                    }

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok(new { Message = "मुदत ठेव मॉडेलमधील सर्व डेटा यशस्वीरीत्या साफ (Cleared) करण्यात आला आहे." });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("डेटा साफ करताना त्रुटी आली: " + ex.Message);
                }
            }
        }

        // POST: api/FdAccounts/CalculateInterestPreview
        [HttpPost("CalculateInterestPreview")]
        [AllowAnonymous]
        public async Task<IActionResult> CalculateInterestPreview([FromBody] FdInterestPreviewRequestDto req)
        {
            var activeAccounts = await _context.FdAccounts
                .Include(a => a.Customer)
                    .ThenInclude(c => c!.MemberProfile)
                .Include(a => a.FdScheme)
                .Where(a => a.BranchID == req.BranchID && a.Status == "Active")
                .ToListAsync();

            var previewItems = new List<FdInterestPreviewItemDto>();

            foreach (var acc in activeAccounts)
            {
                var lastAccrual = await _context.FdInterestAccruals
                    .Where(a => a.FdAccountID == acc.FdAccountID)
                    .OrderByDescending(a => a.AccrualDate)
                    .FirstOrDefaultAsync();

                DateTime fromDate = lastAccrual?.AccrualDate ?? acc.OpeningDate;
                int days = (req.AccrualDate - fromDate).Days;
                if (days <= 0) days = 0;

                decimal alreadyAccrued = await _context.FdTransactions
                    .Where(t => t.FdAccountID == acc.FdAccountID && t.TransactionType == "Accrual")
                    .SumAsync(t => t.Amount) + acc.LegacyAccruedInt;

                decimal effectivePrincipal = acc.DepositAmount;
                if (req.CalculationMethod == "OnInterest")
                {
                    effectivePrincipal += alreadyAccrued;
                }

                decimal calculatedInterest = 0;
                if (days > 0)
                {
                    calculatedInterest = Math.Round((effectivePrincipal * acc.InterestRate * days) / 36500.0m, 0, MidpointRounding.AwayFromZero);
                }

                string memberNameStr = acc.Customer != null 
                    ? $"{acc.Customer.FirstName} {acc.Customer.MiddleName} {acc.Customer.LastName}".Replace("  ", " ").Trim()
                    : "Unknown";

                previewItems.Add(new FdInterestPreviewItemDto
                {
                    FdAccountID = acc.FdAccountID,
                    AccountNo = acc.AccountNo,
                    CustomerID = acc.CustomerID,
                    CustomerName = memberNameStr,
                    CIFNo = acc.Customer?.CIFNo ?? "",
                    MemberID = acc.Customer?.MemberProfile?.MemberID ?? acc.CustomerID,
                    MemberName = memberNameStr,
                    MemberCode = acc.Customer?.MemberProfile?.MemberCode ?? acc.Customer?.CIFNo ?? "",
                    SchemeName = acc.FdScheme?.SchemeName ?? "Standard Scheme",
                    OpeningDate = acc.OpeningDate,
                    DepositAmount = acc.DepositAmount,
                    EffectivePrincipal = effectivePrincipal,
                    AlreadyAccruedInterest = alreadyAccrued,
                    ElapsedDays = days,
                    InterestRate = acc.InterestRate,
                    CalculatedInterest = calculatedInterest,
                    CalculationMethod = req.CalculationMethod,
                    IsSelected = calculatedInterest > 0
                });
            }

            return Ok(previewItems);
        }

        // POST: api/FdAccounts/PostSelectedInterest
        [HttpPost("PostSelectedInterest")]
        [AllowAnonymous]
        public async Task<IActionResult> PostSelectedInterest([FromBody] FdInterestPostRequestDto req)
        {
            if (req.SelectedItems == null || !req.SelectedItems.Any())
            {
                return BadRequest("कृपया व्याज पोस्ट करण्यासाठी किमान एक खाते निवडा (Select at least one account).");
            }

            var expenseLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("१३२ मुदत ठेवीवरील व्याज") || l.LedgerName.ToLower().Contains("interest expense"));
            var payableLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("२३ देणे सभासद ठेव व्याज") || l.LedgerName.ToLower().Contains("interest payable"));

            if (expenseLedger == null || payableLedger == null)
            {
                return BadRequest("FD Interest expense or payable ledgers not configured.");
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    decimal totalProvisionAmount = req.SelectedItems.Sum(x => x.CalculatedInterest);
                    if (totalProvisionAmount <= 0)
                    {
                        return BadRequest("निवडलेल्या खात्यांची एकूण व्याज रक्कम ० आहे.");
                    }

                    var voucher = new Voucher
                    {
                        BranchID = req.BranchID,
                        VoucherNo = $"JV-FD-PROV-{req.AccrualDate:yyyyMMdd}-{DateTime.Now:HHmmss}",
                        VoucherDate = req.AccrualDate,
                        VoucherType = "Journal",
                        TotalAmount = totalProvisionAmount,
                        Narration = $"ग्राहक-निहाय मुदत ठेव व्याज तरतूद (Customer-wise FD Interest Provision [{req.CalculationMethod}]): {req.AccrualDate:dd/MM/yyyy}",
                        CreatedBy = 1,
                        CreatedOn = DateTime.Now
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    int postedCount = 0;
                    foreach (var item in req.SelectedItems)
                    {
                        if (item.CalculatedInterest <= 0) continue;

                        var acc = await _context.FdAccounts.FindAsync(item.FdAccountID);
                        if (acc == null) continue;

                        var log = new FdInterestAccrual
                        {
                            BranchID = req.BranchID,
                            FdAccountID = acc.FdAccountID,
                            VoucherID = voucher.VoucherID,
                            AccrualDate = req.AccrualDate,
                            CalculatedDays = item.ElapsedDays,
                            InterestAmount = item.CalculatedInterest,
                            IsPosted = true
                        };
                        _context.FdInterestAccruals.Add(log);

                        var tx = new FdTransaction
                        {
                            BranchID = req.BranchID,
                            FdAccountID = acc.FdAccountID,
                            VoucherID = voucher.VoucherID,
                            TransactionDate = req.AccrualDate,
                            TransactionType = "Accrual",
                            DebitCredit = "Cr",
                            Amount = item.CalculatedInterest
                        };
                        _context.FdTransactions.Add(tx);
                        postedCount++;
                    }

                    // Dr Expense, Cr Payable
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = expenseLedger.LedgerID, DrCr = "Dr", Amount = totalProvisionAmount });
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Cr", Amount = totalProvisionAmount });

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok(new {
                        Message = $"✅ एकूण {postedCount} ग्राहकांच्या खात्यांवर ₹ {totalProvisionAmount:N0} व्याज यशस्वीरित्या पोस्ट झाले!",
                        VoucherNo = voucher.VoucherNo,
                        TotalAmount = totalProvisionAmount,
                        PostedCount = postedCount
                    });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("व्याज पोस्ट करताना त्रुटी आली: " + ex.Message);
                }
            }
        }

        // GET: api/FdAccounts/MemberLedger/5 or api/FdAccounts/CustomerLedger/5
        [HttpGet("MemberLedger/{memberId}")]
        [HttpGet("CustomerLedger/{customerId}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetMemberFdLedger(int? memberId, int? customerId)
        {
            Customer? customer = null;
            Member? member = null;

            if (customerId.HasValue && customerId.Value > 0)
            {
                customer = await _context.Customers.Include(c => c.Branch).FirstOrDefaultAsync(c => c.CustomerID == customerId.Value);
                if (customer != null)
                {
                    member = await _context.Members.Include(m => m.Customer).Include(m => m.Branch).FirstOrDefaultAsync(m => m.CustomerID == customer.CustomerID);
                }
            }
            else
            {
                int lookupId = memberId ?? customerId ?? 0;
                if (lookupId <= 0) return BadRequest("वैध सभासद किंवा ग्राहक आयडी आवश्यक आहे.");

                customer = await _context.Customers.Include(c => c.Branch).FirstOrDefaultAsync(c => c.CustomerID == lookupId);
                if (customer != null)
                {
                    member = await _context.Members.Include(m => m.Customer).Include(m => m.Branch).FirstOrDefaultAsync(m => m.CustomerID == customer.CustomerID);
                }
                else
                {
                    member = await _context.Members.Include(m => m.Customer).Include(m => m.Branch).FirstOrDefaultAsync(m => m.MemberID == lookupId);
                    if (member?.CustomerID != null)
                    {
                        customer = await _context.Customers.Include(c => c.Branch).FirstOrDefaultAsync(c => c.CustomerID == member.CustomerID.Value);
                    }
                }
            }

            if (member == null && customer == null) return NotFound("सभासद किंवा ग्राहक सापडला नाही.");

            int? targetCustId = customer?.CustomerID ?? member?.CustomerID;
            int? targetMemId = member?.MemberID;

            var accounts = await _context.FdAccounts
                .Include(a => a.FdScheme)
                .Where(a => targetCustId != null && a.CustomerID == targetCustId)
                .OrderByDescending(a => a.OpeningDate)
                .ToListAsync();

            var accountLedgerList = new List<object>();

            foreach (var acc in accounts)
            {
                var transactions = await _context.FdTransactions
                    .Include(t => t.Voucher)
                    .Where(t => t.FdAccountID == acc.FdAccountID)
                    .OrderBy(t => t.TransactionDate)
                    .ThenBy(t => t.FdTransactionID)
                    .Select(t => new {
                        t.FdTransactionID,
                        t.TransactionDate,
                        t.TransactionType,
                        t.DebitCredit,
                        t.Amount,
                        VoucherNo = t.Voucher != null ? t.Voucher.VoucherNo : "",
                        Narration = t.Voucher != null ? t.Voucher.Narration : ""
                    })
                    .ToListAsync();

                decimal totalAccruedInt = await _context.FdTransactions
                    .Where(t => t.FdAccountID == acc.FdAccountID && t.TransactionType == "Accrual")
                    .SumAsync(t => t.Amount) + acc.LegacyAccruedInt;

                accountLedgerList.Add(new {
                    acc.FdAccountID,
                    acc.AccountNo,
                    acc.OpeningDate,
                    acc.MaturityDate,
                    acc.DepositAmount,
                    acc.InterestRate,
                    acc.MaturityAmount,
                    acc.Status,
                    acc.PaymentMode,
                    acc.NomineeName,
                    acc.NomineeRelation,
                    acc.Remarks,
                    SchemeName = acc.FdScheme != null ? acc.FdScheme.SchemeName : "Standard Scheme",
                    DurationMonths = acc.FdScheme != null ? acc.FdScheme.DurationMonths : 12,
                    TotalAccruedInterest = totalAccruedInt,
                    Transactions = transactions
                });
            }

            string fullName = customer != null
                ? $"{customer.FirstName} {customer.MiddleName} {customer.LastName}".Replace("  ", " ").Trim()
                : (member != null ? $"{member.FirstName} {member.MiddleName} {member.LastName}".Replace("  ", " ").Trim() : "");

            if (string.IsNullOrWhiteSpace(fullName))
            {
                fullName = customer != null 
                    ? $"{customer.FirstNameEng} {customer.MiddleNameEng} {customer.LastNameEng}".Replace("  ", " ").Trim()
                    : (member != null ? $"{member.FirstNameEng} {member.MiddleNameEng} {member.LastNameEng}".Replace("  ", " ").Trim() : "");
            }

            return Ok(new {
                CustomerID = targetCustId,
                MemberID = targetMemId ?? (customer?.CustomerID ?? 0),
                MemberCode = member?.MemberCode ?? (customer?.CIFNo ?? ""),
                CIFNo = customer?.CIFNo ?? member?.CIFNo ?? "",
                MemberName = fullName,
                MobileNo = customer?.MobileNo ?? member?.MobileNo ?? "",
                Address = customer?.Address ?? member?.Address ?? "",
                BranchName = customer?.Branch?.BranchName ?? member?.Branch?.BranchName ?? "",
                TotalFDAccountsCount = accounts.Count,
                TotalPrincipalInvested = accounts.Sum(a => a.DepositAmount),
                TotalMaturityValue = accounts.Sum(a => a.MaturityAmount),
                Accounts = accountLedgerList
            });
        }
    }

    public class FdInterestPreviewRequestDto
    {
        public int BranchID { get; set; } = 1;
        public DateTime AccrualDate { get; set; } = DateTime.Today;
        public string CalculationMethod { get; set; } = "OnPrincipal"; // "OnPrincipal" or "OnInterest"
    }

    public class FdInterestPreviewItemDto
    {
        public int FdAccountID { get; set; }
        public string AccountNo { get; set; } = string.Empty;
        public int CustomerID { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string CIFNo { get; set; } = string.Empty;
        public int MemberID { get; set; }
        public string MemberName { get; set; } = string.Empty;
        public string MemberCode { get; set; } = string.Empty;
        public string SchemeName { get; set; } = string.Empty;
        public DateTime OpeningDate { get; set; }
        public decimal DepositAmount { get; set; }
        public decimal EffectivePrincipal { get; set; }
        public decimal AlreadyAccruedInterest { get; set; }
        public int ElapsedDays { get; set; }
        public decimal InterestRate { get; set; }
        public decimal CalculatedInterest { get; set; }
        public string CalculationMethod { get; set; } = "OnPrincipal";
        public bool IsSelected { get; set; } = true;
    }

    public class FdInterestPostRequestDto
    {
        public int BranchID { get; set; } = 1;
        public DateTime AccrualDate { get; set; } = DateTime.Today;
        public string CalculationMethod { get; set; } = "OnPrincipal";
        public List<FdInterestPostItemDto> SelectedItems { get; set; } = new List<FdInterestPostItemDto>();
    }

    public class FdInterestPostItemDto
    {
        public int FdAccountID { get; set; }
        public decimal CalculatedInterest { get; set; }
        public int ElapsedDays { get; set; }
    }

    public class FdClosureRequest
    {
        public DateTime? ClosureDate { get; set; }
        public string PaymentMode { get; set; } = "Cash"; // "Cash", "Bank", "Transfer"
        public int? BankAccountLedgerID { get; set; }
        public string? ChequeNo { get; set; }
        public DateTime? ChequeDate { get; set; }
        public int? SavingAccountID { get; set; }
        public string? Narration { get; set; }
    }

    public class FdRenewalRequest
    {
        public int TargetSchemeID { get; set; }
        public string RenewalType { get; set; } = "PrincipalPlusInterest"; // "PrincipalPlusInterest", "PrincipalOnly"
        public DateTime? ClosureDate { get; set; }
        public string PaymentMode { get; set; } = "Cash"; // For PrincipalOnly interest payout: "Cash", "Bank", "Transfer"
        public int? BankAccountLedgerID { get; set; }
        public string? ChequeNo { get; set; }
        public DateTime? ChequeDate { get; set; }
        public int? SavingAccountID { get; set; }
        public string? Narration { get; set; }
    }
}
