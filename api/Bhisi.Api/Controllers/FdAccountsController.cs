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
        public string? DurationType { get; set; } = "Months";
        public int? DurationValue { get; set; }
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

            var seniorCutoffDate = DateTime.Today.AddYears(-60);

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
                    InterestType = f.FdScheme != null ? f.FdScheme.InterestType : "Simple",
                    MonthlyInterestAmount = (f.FdScheme != null && (f.FdScheme.InterestType == "MIS" || f.FdScheme.InterestType == "Monthly Interest"))
                        ? Math.Round((f.DepositAmount * f.InterestRate) / 1200.0m, 0, MidpointRounding.AwayFromZero)
                        : 0m,
                    FdLiabilityLedgerID = f.FdScheme != null ? f.FdScheme.FdLiabilityLedgerID : null,
                    FdLiabilityLedgerName = f.FdScheme != null && f.FdScheme.FdLiabilityLedger != null ? f.FdScheme.FdLiabilityLedger.LedgerName : "",
                    InterestExpenseLedgerID = f.FdScheme != null ? f.FdScheme.InterestExpenseLedgerID : null,
                    InterestExpenseLedgerName = f.FdScheme != null && f.FdScheme.InterestExpenseLedger != null ? f.FdScheme.InterestExpenseLedger.LedgerName : "",
                    InterestPayableLedgerID = f.FdScheme != null ? f.FdScheme.InterestPayableLedgerID : null,
                    InterestPayableLedgerName = f.FdScheme != null && f.FdScheme.InterestPayableLedger != null ? f.FdScheme.InterestPayableLedger.LedgerName : "",
                    PrematurePenaltyLedgerID = f.FdScheme != null ? f.FdScheme.PrematurePenaltyLedgerID : null,
                    PrematurePenaltyLedgerName = f.FdScheme != null && f.FdScheme.PrematurePenaltyLedger != null ? f.FdScheme.PrematurePenaltyLedger.LedgerName : "",
                    f.AccountNo,
                    f.LegacyAccountNumber,
                    f.OpeningDate,
                    f.DepositAmount,
                    f.DurationType,
                    f.DurationValue,
                    f.DurationInDays,
                    f.InterestRate,
                    f.MaturityDate,
                    f.MaturityAmount,
                    f.IsLegacyAccount,
                    f.LegacyAccruedInt,
                    f.LastInterestPostingDate,
                    f.Status,
                    f.NomineeName,
                    f.NomineeRelation,
                    f.Remarks,
                    BirthDate = f.Customer != null ? f.Customer.BirthDate : null,
                    IsSeniorCitizen = f.Customer != null && f.Customer.BirthDate.HasValue && f.Customer.BirthDate.Value <= seniorCutoffDate
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
                InterestType = f.FdScheme != null ? f.FdScheme.InterestType : "Simple",
                MonthlyInterestAmount = (f.FdScheme != null && (f.FdScheme.InterestType == "MIS" || f.FdScheme.InterestType == "Monthly Interest"))
                    ? Math.Round((f.DepositAmount * f.InterestRate) / 1200.0m, 0, MidpointRounding.AwayFromZero)
                    : 0m,
                f.AccountNo,
                f.LegacyAccountNumber,
                f.OpeningDate,
                f.DepositAmount,
                f.DurationType,
                f.DurationValue,
                f.DurationInDays,
                f.InterestRate,
                f.MaturityDate,
                f.MaturityAmount,
                f.IsLegacyAccount,
                f.LegacyAccruedInt,
                f.LastInterestPostingDate,
                f.Status,
                f.NomineeName,
                f.NomineeRelation,
                f.Remarks,
                BirthDate = f.Customer != null ? f.Customer.BirthDate : null,
                IsSeniorCitizen = f.Customer != null && f.Customer.BirthDate.HasValue && (f.Customer.BirthDate.Value.Date <= DateTime.Today.AddYears(-60))
            });
        }

        // POST: api/FdAccounts
        [HttpPost]
        public async Task<ActionResult<FdAccount>> PostFdAccount(FdAccount account)
        {
            // 1. Load Scheme
            var scheme = await _context.FdSchemes
                .Include(s => s.Slabs)
                .FirstOrDefaultAsync(s => s.FdSchemeID == account.FdSchemeID);
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

                    // 4. Auto-Calculate Maturity Date & Amount with Slabs & Duration Support
                    string durType = !string.IsNullOrWhiteSpace(account.DurationType) ? account.DurationType : (scheme.DurationType ?? "Months");
                    int durVal = account.DurationValue.HasValue && account.DurationValue.Value > 0 ? account.DurationValue.Value : (scheme.DurationMonths > 0 ? scheme.DurationMonths : 12);
                    account.DurationType = durType;
                    account.DurationValue = durVal;

                    DateTime maturityDate;
                    int totalDays;
                    if (durType.Equals("Days", StringComparison.OrdinalIgnoreCase))
                    {
                        totalDays = durVal;
                        maturityDate = account.OpeningDate.AddDays(totalDays);
                    }
                    else if (durType.Equals("Years", StringComparison.OrdinalIgnoreCase))
                    {
                        maturityDate = account.OpeningDate.AddYears(durVal);
                        totalDays = (int)(maturityDate - account.OpeningDate).TotalDays;
                    }
                    else
                    {
                        maturityDate = account.OpeningDate.AddMonths(durVal);
                        totalDays = (int)(maturityDate - account.OpeningDate).TotalDays;
                    }
                    account.DurationInDays = totalDays;
                    account.MaturityDate = maturityDate;

                    bool isSenior = customer.BirthDate.HasValue && (customer.BirthDate.Value.Date <= account.OpeningDate.Date.AddYears(-60));

                    // Resolve Interest Rate based on Slabs or Scheme fixed rate
                    decimal appliedRate;
                    if (scheme.SchemeDurationModel == "Slab")
                    {
                        var matchedSlab = scheme.Slabs?.FirstOrDefault(s => totalDays >= s.FromDays && totalDays <= s.ToDays && s.IsActive);
                        if (matchedSlab == null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"निवडलेला कालावधी ({totalDays} दिवस) मुदत ठेव योजनेच्या कोणत्याही मंजूर स्लॅबमध्ये बसत नाही (योजना मर्यादा: {scheme.MinDurationDays ?? 1} ते {scheme.MaxDurationDays ?? 0} दिवस).");
                        }
                        appliedRate = isSenior ? matchedSlab.SeniorCitizenRate : matchedSlab.InterestRate;
                    }
                    else
                    {
                        appliedRate = isSenior ? scheme.SeniorCitizenInterestRate : scheme.InterestRate;
                    }
                    account.InterestRate = appliedRate;

                    decimal p = account.DepositAmount;
                    decimal r = appliedRate;

                    if (scheme.InterestType == "Cumulative")
                    {
                        int n = 4; // Default Quarterly
                        if (scheme.InterestCompoundingFrequency == "Half-Yearly") n = 2;
                        if (scheme.InterestCompoundingFrequency == "Yearly") n = 1;
                        if (scheme.InterestCompoundingFrequency == "Monthly") n = 12;

                        double baseVal = 1.0 + ((double)r / (n * 100.0));
                        double exponent = n * ((double)totalDays / 365.0);
                        account.MaturityAmount = Math.Round(p * (decimal)Math.Pow(baseVal, exponent), 0, MidpointRounding.AwayFromZero);
                    }
                    else if (scheme.InterestType == "MIS" || scheme.InterestType == "Monthly Interest")
                    {
                        account.MaturityAmount = p;
                    }
                    else
                    {
                        // Simple Interest: A = P * (1 + R*T/100)
                        account.MaturityAmount = Math.Round(p * (1.0m + ((r * (decimal)totalDays) / (365.0m * 100.0m))), 0, MidpointRounding.AwayFromZero);
                    }

                    // 5. Default attributes
                    account.Status = "Active";
                    // Do not override IsLegacyAccount and LegacyAccruedInt sent from frontend
                    account.FinancialYearID = (await _context.FinancialYears.FirstOrDefaultAsync(fy => fy.IsActive))?.FinancialYearID ?? 1;

                    _context.FdAccounts.Add(account);
                    await _context.SaveChangesAsync();

                    // 6. Post Accounting Voucher (Only if it's a NEW account, not Legacy)
                    Ledger? fdLiabilityLedger = await ResolveFdLiabilityLedgerAsync(scheme);

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

                    if (!account.IsLegacyAccount)
                    {
                        if (fdLiabilityLedger == null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest("मुदत ठेव दायित्व लेजर (FD Liability Ledger) सापडले नाही. कृपया योजनेमध्ये लेजर खाते मॅप केले असल्याची खात्री करा.");
                        }

                        if (debitLedger == null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest("डिपॉझिट जमा करण्यासाठी डेबिट लेजर (Cash/Bank/SB) सापडले नाही.");
                        }

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
                        bool isDebitCustomerPersonal = (account.PaymentMode == "Transfer" || account.PaymentMode == "Savings") 
                            && debitLedger.AccountType != "Cash In Hand" 
                            && !debitLedger.LedgerName.Contains("रोख")
                            && !debitLedger.LedgerName.ToLower().Contains("cash");

                        var debitDetail = new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = debitLedger.LedgerID,
                            DrCr = "Dr",
                            Amount = account.DepositAmount,
                            CustomerID = isDebitCustomerPersonal ? account.CustomerID : null,
                            MemberID = isDebitCustomerPersonal ? linkedMemberId : null
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

        // DELETE: api/FdAccounts/5
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,SuperAdmin,Manager,HeadOffice")]
        public async Task<IActionResult> DeleteFdAccount(int id)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var account = await _context.FdAccounts
                    .Include(a => a.Customer)
                    .FirstOrDefaultAsync(a => a.FdAccountID == id);

                if (account == null)
                {
                    return NotFound(new { message = "मुदत ठेव खाते सापडले नाही." });
                }

                // 1. Status Guard: Closed किंवा Renewed खाती ऑडिट रेकॉर्ड असल्याने नष्ट करता येत नाहीत
                if (string.Equals(account.Status, "Closed", StringComparison.OrdinalIgnoreCase) || 
                    string.Equals(account.Status, "Renewed", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new { message = $"सदर मुदत ठेव खाते आधीच '{account.Status}' झालेले आहे. बंद किंवा नूतनीकरण झालेली खाती वैधानिक ऑडिट रेकॉर्डचा भाग असल्याने नष्ट (Delete) करता येत नाहीत." });
                }

                // 2. Lien / Loan Security Guard: जर खातेदाराकडे सक्रिय कर्ज असेल तर कर्ज वसुली सुरक्षेसाठी डिलीट करण्यास मनाई
                if (account.CustomerID > 0)
                {
                    int custId = account.CustomerID;
                    int? linkedMemId = null;
                    var mem = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == custId);
                    if (mem != null) linkedMemId = mem.MemberID;

                    var activeLoansQuery = _context.LoanAccounts
                        .Where(l => l.Status == "Active" && (l.PrincipalBalance > 0 || l.InterestBalance > 0 || l.OverdueInterestBalance > 0));

                    if (linkedMemId.HasValue && linkedMemId.Value > 0)
                    {
                        activeLoansQuery = activeLoansQuery.Where(l => l.CustomerID == custId || l.MemberID == linkedMemId.Value);
                    }
                    else
                    {
                        activeLoansQuery = activeLoansQuery.Where(l => l.CustomerID == custId);
                    }

                    var activeLoans = await activeLoansQuery.ToListAsync();

                    if (activeLoans.Any())
                    {
                        decimal totalLoanLiability = activeLoans.Sum(l => l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance);
                        return BadRequest(new { message = $"सदर खातेदाराकडे एकूण ₹{totalLoanLiability:N2} चे सक्रिय कर्ज थकीत आहे. पतसंस्थेच्या सुरक्षा नियमांनुसार (Lien/Collateral Protection) हे मुदत ठेव खाते नष्ट करता येणार नाही." });
                    }
                }

                string accountNo = account.AccountNo;
                int branchId = account.BranchID;
                decimal depositAmount = account.DepositAmount;
                string customerName = account.Customer != null ? $"{account.Customer.FirstName} {account.Customer.LastName}".Trim() : "";

                // 1. Delete linked Voucher and VoucherDetails (removes it completely from Voucher Passing)
                string expectedVoucherNo = $"REC-FD-OP-{accountNo}";
                var linkedVouchers = await _context.Vouchers
                    .Include(v => v.VoucherDetails)
                    .Where(v => v.VoucherNo == expectedVoucherNo || (v.Narration != null && v.Narration.Contains(accountNo)))
                    .ToListAsync();

                foreach (var vch in linkedVouchers)
                {
                    if (vch.VoucherDetails != null && vch.VoucherDetails.Any())
                    {
                        _context.VoucherDetails.RemoveRange(vch.VoucherDetails);
                    }
                    _context.Vouchers.Remove(vch);
                }

                // 2. Refund Savings Account if PaymentMode was Transfer
                if (account.PaymentMode == "Transfer" && account.SavingAccountID.HasValue && account.SavingAccountID.Value > 0)
                {
                    var sbAcc = await _context.SavingAccountMasters.FindAsync(account.SavingAccountID.Value);
                    if (sbAcc != null)
                    {
                        sbAcc.CurrentBalance += depositAmount;

                        var sbTx = await _context.SavingTransactions
                            .Where(st => st.SavingAccountID == sbAcc.SavingAccountID && st.Narration != null && st.Narration.Contains(accountNo))
                            .FirstOrDefaultAsync();

                        if (sbTx != null)
                        {
                            _context.SavingTransactions.Remove(sbTx);
                        }
                    }
                }

                // 3. Remove all FdTransactions and FdInterestAccruals
                var fdTxs = await _context.FdTransactions.Where(t => t.FdAccountID == id).ToListAsync();
                if (fdTxs.Any()) _context.FdTransactions.RemoveRange(fdTxs);

                var fdAccruals = await _context.FdInterestAccruals.Where(a => a.FdAccountID == id).ToListAsync();
                if (fdAccruals.Any()) _context.FdInterestAccruals.RemoveRange(fdAccruals);

                // 4. Remove FdAccount itself
                bool isLegacy = account.IsLegacyAccount;
                _context.FdAccounts.Remove(account);
                await _context.SaveChangesAsync();

                if (isLegacy)
                {
                    try { await SyncFdOpeningBalancesInternalAsync(); } catch { }
                }

                // 5. Rollback FdAccountSequences by -1 (Sync to max remaining sequence in this branch)
                var branchSeq = await _context.FdAccountSequences
                    .FirstOrDefaultAsync(s => s.BranchID == branchId && s.ProductType == "FD");

                int remainingMaxSeq = 0;
                var remainingAccounts = await _context.FdAccounts
                    .Where(f => f.BranchID == branchId)
                    .Select(f => f.AccountNo)
                    .ToListAsync();

                foreach (var accStr in remainingAccounts)
                {
                    // Pattern: {Prefix}-{BranchID:D3}-FD-{SeqNo:D6}
                    var lastDash = accStr.LastIndexOf('-');
                    if (lastDash >= 0 && lastDash < accStr.Length - 1)
                    {
                        if (int.TryParse(accStr.Substring(lastDash + 1), out int parsedSeq))
                        {
                            if (parsedSeq > remainingMaxSeq) remainingMaxSeq = parsedSeq;
                        }
                    }
                }

                if (branchSeq != null)
                {
                    branchSeq.CurrentValue = remainingMaxSeq;
                    await _context.SaveChangesAsync();
                }

                // 6. Record Audit Log
                _context.AuditLogs.Add(new AuditLog
                {
                    Action = "FD_OPENING_DIRECT_DELETED",
                    EntityName = "FdAccount",
                    EntityID = accountNo,
                    Details = $"मुदत ठेव खाते {accountNo} (रक्कम: ₹{depositAmount:N2}, खातेदार: {customerName}) नवीन खाते फॉर्मवरून थेट डिलीट केले. व्हाउचर पासिंगमधून व्हाउचर हटवले आणि पावती अनुक्रमांक रोलबॅक करून {remainingMaxSeq} केला.",
                    Timestamp = DateTime.Now,
                    Status = "Success"
                });
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                return Ok(new
                {
                    message = $"मुदत ठेव खाते '{accountNo}' आणि त्याचे पासिंग व्हाउचर यशस्वीरीत्या डिलीट झाले. पावती क्र. रोलबॅक झाला.",
                    accountNo = accountNo,
                    rolledBackSequence = remainingMaxSeq
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = $"खाते डिलीट करताना त्रुटी आली: {ex.Message}" });
            }
        }


        // POST: api/FdAccounts/BulkCreate (Create multiple split FD receipts sequentially)
        [HttpPost("BulkCreate")]
        [Authorize(Roles = "Admin,SuperAdmin,Manager,Officer,Cashier")]
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

            var scheme = await _context.FdSchemes
                .Include(s => s.Slabs)
                .FirstOrDefaultAsync(s => s.FdSchemeID == req.FdSchemeID);
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

                    // 4. Calculate Duration and Maturity metrics with Slabs Support
                    string durType = !string.IsNullOrWhiteSpace(req.DurationType) ? req.DurationType : (scheme.DurationType ?? "Months");
                    int durVal = req.DurationValue.HasValue && req.DurationValue.Value > 0 ? req.DurationValue.Value : (scheme.DurationMonths > 0 ? scheme.DurationMonths : 12);

                    DateTime matDate;
                    int totalDays;
                    if (durType.Equals("Days", StringComparison.OrdinalIgnoreCase))
                    {
                        totalDays = durVal;
                        matDate = req.OpeningDate.AddDays(totalDays);
                    }
                    else if (durType.Equals("Years", StringComparison.OrdinalIgnoreCase))
                    {
                        matDate = req.OpeningDate.AddYears(durVal);
                        totalDays = (int)(matDate - req.OpeningDate).TotalDays;
                    }
                    else
                    {
                        matDate = req.OpeningDate.AddMonths(durVal);
                        totalDays = (int)(matDate - req.OpeningDate).TotalDays;
                    }

                    // Resolve Rate
                    decimal appliedRate;
                    if (scheme.SchemeDurationModel == "Slab")
                    {
                        var matchedSlab = scheme.Slabs?.FirstOrDefault(s => totalDays >= s.FromDays && totalDays <= s.ToDays && s.IsActive);
                        if (matchedSlab == null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"निवडलेला कालावधी ({totalDays} दिवस) मुदत ठेव योजनेच्या कोणत्याही मंजूर स्लॅबमध्ये बसत नाही (योजना मर्यादा: {scheme.MinDurationDays ?? 1} ते {scheme.MaxDurationDays ?? 0} दिवस).");
                        }
                        appliedRate = req.IsSeniorCitizen ? matchedSlab.SeniorCitizenRate : matchedSlab.InterestRate;
                    }
                    else
                    {
                        appliedRate = req.IsSeniorCitizen ? scheme.SeniorCitizenInterestRate : scheme.InterestRate;
                    }

                    decimal p = perReceiptAmount;
                    decimal r = appliedRate;
                    decimal matAmount = 0;

                    if (scheme.InterestType == "Cumulative")
                    {
                        int n = 4;
                        if (scheme.InterestCompoundingFrequency == "Half-Yearly") n = 2;
                        if (scheme.InterestCompoundingFrequency == "Yearly") n = 1;
                        if (scheme.InterestCompoundingFrequency == "Monthly") n = 12;

                        double baseVal = 1.0 + ((double)r / (n * 100.0));
                        double exponent = n * ((double)totalDays / 365.0);
                        matAmount = Math.Round(p * (decimal)Math.Pow(baseVal, exponent), 0, MidpointRounding.AwayFromZero);
                    }
                    else if (scheme.InterestType == "MIS" || scheme.InterestType == "Monthly Interest")
                    {
                        matAmount = p;
                    }
                    else
                    {
                        matAmount = Math.Round(p * (1.0m + ((r * (decimal)totalDays) / (365.0m * 100.0m))), 0, MidpointRounding.AwayFromZero);
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
                            DurationType = durType,
                            DurationValue = durVal,
                            DurationInDays = totalDays,
                            InterestRate = appliedRate,
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
                    Status = "Approved",
                    ApprovedBy = account.CreatedBy > 0 ? account.CreatedBy : 1,
                    ApprovedOn = DateTime.Now,
                    CreatedBy = account.CreatedBy > 0 ? account.CreatedBy : 1,
                    CreatedOn = DateTime.Now
                };
                _context.Vouchers.Add(dummyVoucher);
                await _context.SaveChangesAsync();
            }
            else if (dummyVoucher.Status == "Pending")
            {
                dummyVoucher.Status = "Approved";
                dummyVoucher.ApprovedBy = account.CreatedBy > 0 ? account.CreatedBy : 1;
                dummyVoucher.ApprovedOn = DateTime.Now;
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

            // Automatically sync with CustomerOpeningBalances & Ledgers (Financial Statements)
            try
            {
                await SyncFdOpeningBalancesInternalAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error auto-syncing FD opening balances: {ex.Message}");
            }

            return Ok(account);
        }

        // POST: api/FdAccounts/AccrueInterest
        [HttpPost("AccrueInterest")]
        [Authorize(Roles = "Admin,SuperAdmin,Manager")]
        public async Task<IActionResult> AccrueInterest([FromQuery] int branchId, [FromQuery] DateTime accrualDate)
        {
            if (accrualDate.Date > DateTime.Today)
            {
                return BadRequest($"अवैध तारीख! भविष्यातील तारीख ({accrualDate:dd/MM/yyyy}) अनुज्ञेय नाही. व्याज तरतूद आजच्या किंवा मागील तारखेचीच असणे आवश्यक आहे.");
            }

            var closedFy = await _context.FinancialYears
                .FirstOrDefaultAsync(fy => fy.IsClosed && accrualDate.Date >= fy.StartDate.Date && accrualDate.Date <= fy.EndDate.Date);
            if (closedFy != null)
            {
                return BadRequest($"अवैध तारीख! निवडलेली व्याज तरतूद तारीख ({accrualDate:dd/MM/yyyy}) ही बंद/ऑडिट झालेल्या आर्थिक वर्षात ({closedFy.YearCode}) मोडते. बंद आर्थिक वर्षात थेट व्हाउचर पोस्ट करणे वैधानिक नियमांनुसार (MCS Act) प्रतिबंधित आहे.");
            }

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

                    var expenseLedger = await ResolveInterestExpenseLedgerAsync(null);
                    var payableLedger = await ResolveInterestPayableLedgerAsync(null);
                    
                    if (expenseLedger == null || payableLedger == null)
                    {
                        return BadRequest("व्याज खर्च (Interest Expense) किंवा देय व्याज (Interest Payable) लेजर कॉन्फिगर केलेले नाही.");
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

                        DateTime fromDate = lastAccrual?.AccrualDate 
                            ?? acc.LastInterestPostingDate 
                            ?? acc.OpeningDate;
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
                            acc.LastInterestPostingDate = accrualDate;

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

        // GET: api/FdAccounts/5/ActiveLoans
        [HttpGet("{id}/ActiveLoans")]
        public async Task<IActionResult> GetActiveLoansForFd(int id)
        {
            var account = await _context.FdAccounts
                .Include(a => a.Customer)
                .FirstOrDefaultAsync(a => a.FdAccountID == id);

            if (account == null)
            {
                return NotFound(new { message = "मुदत ठेव खाते सापडले नाही." });
            }

            int custId = account.CustomerID;
            int? memberId = null;
            if (custId > 0)
            {
                var mem = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == custId);
                if (mem != null) memberId = mem.MemberID;
            }

            var loansQuery = _context.LoanAccounts
                .Include(l => l.LoanRate)
                .Where(l => l.Status == "Active");

            if (memberId.HasValue && memberId.Value > 0)
            {
                loansQuery = loansQuery.Where(l => l.CustomerID == custId || l.MemberID == memberId.Value);
            }
            else
            {
                loansQuery = loansQuery.Where(l => l.CustomerID == custId);
            }

            var activeLoans = await loansQuery
                .Where(l => l.PrincipalBalance > 0 || l.InterestBalance > 0 || l.OverdueInterestBalance > 0)
                .OrderBy(l => l.LoanAccountNo)
                .ToListAsync();

            var loanList = activeLoans.Select(l => new
            {
                loanAccountId = l.LoanAccountID,
                loanAccountNo = l.LoanAccountNo,
                loanType = l.LoanRate?.LoanType ?? "कर्ज खाते",
                principalBalance = l.PrincipalBalance,
                interestBalance = l.InterestBalance,
                overdueInterestBalance = l.OverdueInterestBalance,
                totalDue = l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance,
                openingDate = l.OpeningDate,
                sanctionedAmount = l.SanctionedAmount,
                interestRate = l.LoanRate?.InterestRate ?? l.InterestRate
            }).ToList();

            decimal totalOutstanding = loanList.Sum(l => l.totalDue);

            return Ok(new
            {
                hasActiveLoan = loanList.Count > 0,
                totalOutstandingLiability = totalOutstanding,
                loans = loanList
            });
        }

        private async Task<(LoanAccount loan, LoanCollection collection, decimal principalPaid, decimal interestPaid, decimal penaltyPaid)> ProcessLoanSettlementAsync(
            int targetLoanId, 
            decimal adjustAmount, 
            DateTime txDate, 
            string accountNo, 
            int branchId)
        {
            var targetLoan = await _context.LoanAccounts
                .Include(l => l.LoanRate)
                .FirstOrDefaultAsync(l => l.LoanAccountID == targetLoanId);

            if (targetLoan == null)
            {
                throw new InvalidOperationException("निवडलेले कर्ज खाते सापडले नाही किंवा ते सक्रिय नाही.");
            }

            decimal penaltyPaid = Math.Min(adjustAmount, targetLoan.OverdueInterestBalance);
            decimal remainingAdj = adjustAmount - penaltyPaid;

            decimal interestPaid = Math.Min(remainingAdj, targetLoan.InterestBalance);
            remainingAdj -= interestPaid;

            decimal principalPaid = Math.Min(remainingAdj, targetLoan.PrincipalBalance);
            remainingAdj -= principalPaid;

            targetLoan.OverdueInterestBalance -= penaltyPaid;
            targetLoan.InterestBalance -= interestPaid;
            targetLoan.PrincipalBalance -= principalPaid;
            targetLoan.LastInstallmentPaidDate = txDate;

            if (targetLoan.PrincipalBalance <= 0.01m && targetLoan.InterestBalance <= 0.01m && targetLoan.OverdueInterestBalance <= 0.01m)
            {
                targetLoan.PrincipalBalance = 0;
                targetLoan.InterestBalance = 0;
                targetLoan.OverdueInterestBalance = 0;
                targetLoan.Status = "Closed";
            }
            _context.Entry(targetLoan).State = EntityState.Modified;

            var branch = await _context.Branches.FindAsync(branchId);
            string branchCode = !string.IsNullOrWhiteSpace(branch?.BranchCode) ? branch.BranchCode.Trim() : "HQ";
            string loanReceiptNo = $"{branchCode}-REC-LN-FDADJ-{accountNo}";

            var loanCollection = new LoanCollection
            {
                LoanAccountID = targetLoan.LoanAccountID,
                CollectionDate = txDate,
                ReceiptNo = loanReceiptNo,
                TotalAmountReceived = adjustAmount,
                PenaltyInterestCollected = penaltyPaid,
                InterestCollected = interestPaid,
                PrincipalCollected = principalPaid,
                PaymentMode = "FD Settlement",
                BankName = $"मुदत ठेव वर्ग: {accountNo}",
                ChequeNo = accountNo
            };
            _context.LoanCollections.Add(loanCollection);
            await _context.SaveChangesAsync();

            // Sync loan installment schedule
            var allSchedules = await _context.LoanInstallmentSchedules
                .Where(s => s.LoanAccountID == targetLoan.LoanAccountID)
                .OrderBy(s => s.InstallmentNo)
                .ToListAsync();

            if (allSchedules.Any())
            {
                var allCollections = await _context.LoanCollections
                    .Where(c => c.LoanAccountID == targetLoan.LoanAccountID)
                    .ToListAsync();

                Services.LoanScheduleGenerator.SynchronizeSchedules(targetLoan, allSchedules, allCollections);
                foreach (var sch in allSchedules)
                {
                    _context.Entry(sch).State = EntityState.Modified;
                }
                await _context.SaveChangesAsync();
            }

            return (targetLoan, loanCollection, principalPaid, interestPaid, penaltyPaid);
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
                .Include(a => a.FdScheme)
                .ThenInclude(s => s!.InterestExpenseLedger)
                .FirstOrDefaultAsync(a => a.FdAccountID == id);

            if (account == null || account.Status != "Active")
            {
                return BadRequest("मुदत ठेव खाते सक्रिय (Active) नाही किंवा यापूर्वीच बंद/नूतनीकरण करण्यात आलेले आहे.");
            }

            // Fetch accrued interest
            var accruedFromTx = await _context.FdTransactions
                .Where(t => t.FdAccountID == id && t.TransactionType == "Accrual")
                .SumAsync(t => t.Amount);

            bool isPeriodicScheme = account.FdScheme != null && 
                (account.FdScheme.InterestType == "MIS" || account.FdScheme.InterestType == "Monthly Interest");

            decimal totalInterest = isPeriodicScheme 
                ? 0m 
                : ((account.MaturityAmount > account.DepositAmount)
                    ? (account.MaturityAmount - account.DepositAmount)
                    : Math.Max(accruedFromTx, account.LegacyAccruedInt));

            DateTime closureDate = req?.ClosureDate ?? DateTime.Today;
            if (closureDate.Date < account.OpeningDate.Date)
            {
                return BadRequest($"अवैध व्यवहाराची तारीख! व्यवहाराची तारीख ({closureDate:dd/MM/yyyy}) ही मुदत ठेव खाते उघडल्याच्या तारखेपेक्षा ({account.OpeningDate:dd/MM/yyyy}) आधीची असू शकत नाही.");
            }
            if (closureDate.Date > DateTime.Today)
            {
                return BadRequest($"अवैध व्यवहाराची तारीख! भविष्यातील तारीख ({closureDate:dd/MM/yyyy}) अनुज्ञेय नाही. व्यवहार आजच्या किंवा मागील तारखेचाच असणे आवश्यक आहे.");
            }

            // 🛡️ सर्व्हर-साइड मुदतपूर्ती तारीख गार्ड (Primary Server-Side Maturity Date Guard)
            if (closureDate.Date < account.MaturityDate.Date)
            {
                return BadRequest($"अवैध क्लोजर विनंती! सदर मुदत ठेव पावती अद्याप मुदतपूर्ण (Matured) झालेली नाही. या खात्याची मुदतपूर्ती तारीख {account.MaturityDate:dd/MM/yyyy} आहे (उर्वरित कालावधी: {(account.MaturityDate.Date - closureDate.Date).Days} दिवस). मुदतीआधी ठेव बंद करण्यासाठी कृपया 'मुदतपूर्व बंद (Premature Close)' पर्याय वापरा.");
            }

            var closedFy = await _context.FinancialYears
                .FirstOrDefaultAsync(fy => fy.IsClosed && closureDate.Date >= fy.StartDate.Date && closureDate.Date <= fy.EndDate.Date);
            if (closedFy != null)
            {
                return BadRequest($"अवैध व्यवहाराची तारीख! निवडलेली तारीख ({closureDate:dd/MM/yyyy}) ही बंद/ऑडिट झालेल्या आर्थिक वर्षात ({closedFy.YearCode}) मोडते. बंद आर्थिक वर्षात थेट व्हाउचर पोस्ट करणे वैधानिक लेखापरीक्षण नियमांनुसार (MCS Act) प्रतिबंधित आहे.");
            }

            DateTime? lastAccrualDate = account.LastInterestPostingDate;
            if (!lastAccrualDate.HasValue)
            {
                lastAccrualDate = await _context.FdInterestAccruals
                    .Where(a => a.FdAccountID == account.FdAccountID && a.IsPosted)
                    .OrderByDescending(a => a.AccrualDate)
                    .Select(a => (DateTime?)a.AccrualDate)
                    .FirstOrDefaultAsync();
            }
            if (!lastAccrualDate.HasValue)
            {
                lastAccrualDate = await _context.FdTransactions
                    .Where(t => t.FdAccountID == account.FdAccountID && t.TransactionType == "Accrual")
                    .OrderByDescending(t => t.TransactionDate)
                    .Select(t => (DateTime?)t.TransactionDate)
                    .FirstOrDefaultAsync();
            }

            if (lastAccrualDate.HasValue && closureDate.Date < lastAccrualDate.Value.Date)
            {
                return BadRequest($"अवैध व्यवहाराची तारीख! या खात्यावर {lastAccrualDate.Value:dd/MM/yyyy} रोजी व्याज तरतूद (Interest Accrual) झालेली आहे. व्यवहाराची तारीख शेवटच्या व्याज तरतुदीच्या तारखेपेक्षा ({lastAccrualDate.Value:dd/MM/yyyy}) आधीची असू शकत नाही, अन्यथा देणे व्याज खात्यात (Interest Payable) अनैसर्गिक निगेटिव्ह (Debit) शिल्लक निर्माण होईल.");
            }
            string paymentMode = string.IsNullOrWhiteSpace(req?.PaymentMode) ? "Cash" : req.PaymentMode;
            if (paymentMode == "Transfer" && req?.SavingAccountID > 0)
            {
                if (closureDate.Date < DateTime.Today)
                {
                    return BadRequest($"अवैध व्यवहाराची तारीख! बचत खात्यात (Saving Account Transfer) परतावा वर्ग करताना मागील तारीख ({closureDate:dd/MM/yyyy}) अनुज्ञेय नाही. ग्राहकाच्या पासबुकमधील रनिंग शिल्लक (Running Balance) विस्कळीत होणे टाळण्यासाठी आणि एसएमएस ताळमेळ राखण्यासाठी बचत खात्यातील हस्तांतरण आजच्याच तारखेने ({DateTime.Today:dd/MM/yyyy}) होणे बंधनकारक आहे. जर व्यवहार मागील तारखेने झाला असेल, तर कृपया 'रोख' किंवा इतर माध्यम निवडा.");
                }
                var targetSav = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.SavingAccountID == req.SavingAccountID.Value);
                if (targetSav == null || targetSav.Status != "Active")
                {
                    return BadRequest($"निवडलेले बचत खाते ({targetSav?.AccountNo ?? "अज्ञात"}) सापडले नाही किंवा ते सक्रिय (Active) नाही. बंद किंवा निष्क्रिय बचत खात्यात रक्कम वर्ग करता येत नाही.");
                }
            }

            if (req?.AdjustInLoan == true && req.SurplusPaymentMode == "Transfer" && req.SurplusSavingAccountID > 0)
            {
                var surplusSav = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.SavingAccountID == req.SurplusSavingAccountID.Value);
                if (surplusSav == null || surplusSav.Status != "Active")
                {
                    return BadRequest($"शिल्लक परताव्यासाठी निवडलेले बचत खाते ({surplusSav?.AccountNo ?? "अज्ञात"}) सापडले नाही किंवा ते सक्रिय (Active) नाही. बंद किंवा निष्क्रिय बचत खात्यात रक्कम वर्ग करता येत नाही.");
                }
            }

            // 🛡️ Lien & Active Loan Check: खातेदाराचे थकीत कर्ज तपासणी
            int custId = account.CustomerID;
            int? linkedMemberId = null;
            if (custId > 0)
            {
                var linkedMem = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == custId);
                if (linkedMem != null) linkedMemberId = linkedMem.MemberID;
            }

            var loansQuery = _context.LoanAccounts
                .Include(l => l.LoanRate)
                .Where(l => l.Status == "Active");

            if (linkedMemberId.HasValue && linkedMemberId.Value > 0)
            {
                loansQuery = loansQuery.Where(l => l.CustomerID == custId || l.MemberID == linkedMemberId.Value);
            }
            else
            {
                loansQuery = loansQuery.Where(l => l.CustomerID == custId);
            }

            var activeLoans = await loansQuery
                .Where(l => l.PrincipalBalance > 0 || l.InterestBalance > 0 || l.OverdueInterestBalance > 0)
                .ToListAsync();

            decimal totalActiveLoanDebt = activeLoans.Sum(l => l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance);

            if (totalActiveLoanDebt > 0 && !(req?.AdjustInLoan ?? false))
            {
                return BadRequest(new
                {
                    errorCode = "LOAN_OUTSTANDING_EXISTS",
                    message = $"सदर खातेदाराकडे एकूण ₹{totalActiveLoanDebt:N2} चे कर्ज थकीत आहे. पतसंस्थेच्या सुरक्षा नियमांनुसार (Lien/Collateral Protection) हे मुदत ठेव खाते परस्पर बंद करता येणार नाही. कृपया 'कर्ज खात्यात रक्कम वर्ग करा (Adjust in Loan)' हा पर्याय निवडा किंवा कर्ज पूर्ण भरा.",
                    totalDebt = totalActiveLoanDebt,
                    activeLoansCount = activeLoans.Count
                });
            }

            // Overdue post-maturity interest calculation (Strictly Governed by FdScheme Policy)
            decimal overdueInterest = 0m;
            int overdueDays = 0;
            bool isSchemeOverdueAllowed = account.FdScheme?.AllowOverdueInterest ?? false;

            if (isSchemeOverdueAllowed && closureDate.Date > account.MaturityDate.Date)
            {
                bool applyOverdue = req?.ApplyOverdueInterest ?? true;
                if (applyOverdue)
                {
                    overdueDays = (closureDate.Date - account.MaturityDate.Date).Days;
                    decimal overdueRate = account.FdScheme?.OverdueInterestRate ?? req?.OverdueInterestRate ?? 3.00m;
                    overdueInterest = Math.Round((account.MaturityAmount * overdueRate * overdueDays) / 36500.0m, 2);
                }
            }

            decimal totalMaturityPayout = account.DepositAmount + totalInterest + overdueInterest;

            LoanAccount? targetLoan = null;
            decimal loanAdjustAmount = 0m;
            decimal surplusPayoutAmount = totalMaturityPayout;

            if (req?.AdjustInLoan == true)
            {
                int targetLoanId = req.TargetLoanAccountID ?? (activeLoans.FirstOrDefault()?.LoanAccountID ?? 0);
                if (targetLoanId == 0)
                {
                    return BadRequest(new { message = "कृपया मुदत ठेवीची रक्कम वर्ग करण्यासाठी कर्ज खाते निवडा." });
                }

                targetLoan = activeLoans.FirstOrDefault(l => l.LoanAccountID == targetLoanId) 
                    ?? await _context.LoanAccounts.Include(l => l.LoanRate).FirstOrDefaultAsync(l => l.LoanAccountID == targetLoanId);

                if (targetLoan == null)
                {
                    return BadRequest(new { message = "निवडलेले कर्ज खाते सापडले नाही किंवा ते सक्रिय नाही." });
                }

                decimal targetLoanTotalDue = targetLoan.PrincipalBalance + targetLoan.InterestBalance + targetLoan.OverdueInterestBalance;
                decimal maxAdjustable = Math.Min(totalMaturityPayout, targetLoanTotalDue);
                loanAdjustAmount = req.LoanAdjustmentAmount.HasValue && req.LoanAdjustmentAmount.Value > 0
                    ? Math.Min(req.LoanAdjustmentAmount.Value, maxAdjustable)
                    : maxAdjustable;

                surplusPayoutAmount = totalMaturityPayout - loanAdjustAmount;
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    account.Status = "Closed";
                    account.Remarks = (account.Remarks ?? "") + 
                        (req?.AdjustInLoan == true 
                            ? $" | बंद दिनांक: {closureDate:dd/MM/yyyy} [कर्ज वजावट: ₹{loanAdjustAmount:N2} -> कर्ज क्र: {targetLoan?.LoanAccountNo}, शिल्लक परतावा: ₹{surplusPayoutAmount:N2} ({req.SurplusPaymentMode})]"
                            : $" | बंद दिनांक: {closureDate:dd/MM/yyyy} ({paymentMode})" + (overdueInterest > 0 ? $" [मुदत संपल्यानंतरचे (Overdue) व्याज: ₹{overdueInterest:F2} ({overdueDays} दिवस)]" : ""));
                    await _context.SaveChangesAsync();

                    var fdLiabilityLedger = await ResolveFdLiabilityLedgerAsync(account.FdScheme);
                    var payableLedger = await ResolveInterestPayableLedgerAsync(account.FdScheme);
                    var expenseLedger = await ResolveInterestExpenseLedgerAsync(account.FdScheme);

                    if (fdLiabilityLedger == null)
                    {
                        return BadRequest("मुदत ठेव दायित्व लेजर (FD Liability Ledger) सापडले नाही. कृपया योजनेत लेजर मॅपिंग तपासा.");
                    }

                    if (overdueInterest > 0 && expenseLedger == null)
                    {
                        return BadRequest("मुदत संपल्यानंतरच्या (Overdue) व्याजासाठी व्याज खर्च लेजर (FD Interest Expense Ledger) उपलब्ध नाही. कृपया योजनेत लेजर मॅपिंग तपासा.");
                    }

                    if (req?.AdjustInLoan == true && targetLoan != null)
                    {
                        // 1. Process Loan Settlement via Waterfall
                        var (settledLoan, loanColl, prinPaid, intPaid, penPaid) = await ProcessLoanSettlementAsync(
                            targetLoan.LoanAccountID, 
                            loanAdjustAmount, 
                            closureDate, 
                            account.AccountNo, 
                            account.BranchID);

                        // 2. Resolve Surplus Payout Ledger (if surplus > 0)
                        string surplusMode = !string.IsNullOrWhiteSpace(req.SurplusPaymentMode) ? req.SurplusPaymentMode : "Cash";
                        int surplusLedgerId = 0;
                        if (surplusPayoutAmount > 0)
                        {
                            if (surplusMode == "Bank" && req.SurplusBankLedgerID > 0)
                            {
                                surplusLedgerId = req.SurplusBankLedgerID.Value;
                            }
                            else if (surplusMode == "Transfer" && req.SurplusSavingAccountID > 0)
                            {
                                var savAccount = await _context.SavingAccountMasters
                                    .Include(s => s.Ledger)
                                    .FirstOrDefaultAsync(s => s.SavingAccountID == req.SurplusSavingAccountID.Value);

                                if (savAccount != null)
                                {
                                    savAccount.CurrentBalance += surplusPayoutAmount;
                                    surplusLedgerId = savAccount.LedgerID > 0 ? savAccount.LedgerID : (savAccount.Ledger?.LedgerID ?? 7);

                                    var savTx = new SavingTransaction
                                    {
                                        SavingAccountID = savAccount.SavingAccountID,
                                        CustomerID = savAccount.CustomerID,
                                        TransactionDate = closureDate,
                                        TransactionType = "Deposit",
                                        PaymentMode = "Transfer",
                                        Amount = surplusPayoutAmount,
                                        BalanceAfterTxn = savAccount.CurrentBalance,
                                        Narration = $"मुदत ठेव शिल्लक परतावा जमा (FD Settlement Surplus): {account.AccountNo}",
                                        VoucherNo = $"JV-FD-CLOSE-{account.AccountNo}",
                                        CreatedBy = 1,
                                        CreatedOn = DateTime.Now
                                    };
                                    _context.SavingTransactions.Add(savTx);
                                }
                                else
                                {
                                    surplusLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, account.BranchID, "FD");
                                }
                            }
                            else
                            {
                                surplusLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, account.BranchID, "FD");
                            }
                        }

                        // 3. Create Compound Journal Voucher
                        var voucher = new Voucher
                        {
                            BranchID = account.BranchID,
                            VoucherNo = $"JV-FD-CLOSE-{account.AccountNo}",
                            VoucherDate = closureDate,
                            VoucherType = "Journal",
                            TotalAmount = totalMaturityPayout,
                            Narration = string.IsNullOrWhiteSpace(req?.Narration)
                                ? $"मुदत ठेव परतावा व कर्ज वजावट (FD Maturity Payout & Loan Set-Off): {account.AccountNo} -> कर्ज: {settledLoan.LoanAccountNo} (कर्ज जमा: ₹{loanAdjustAmount:N2}, शिल्लक परतावा: ₹{surplusPayoutAmount:N2} {surplusMode}){(overdueInterest > 0 ? $" (समाविष्ट Overdue व्याज: ₹{overdueInterest:F2})" : "")}"
                                : req.Narration,
                            CreatedBy = 1,
                            CreatedOn = DateTime.Now
                        };
                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();
                        loanColl.VoucherID = voucher.VoucherID;

                        // Dr FD Liability (Principal)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = fdLiabilityLedger.LedgerID, DrCr = "Dr", Amount = account.DepositAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                        // Dr Interest Payable (Contracted Matured Interest)
                        if (payableLedger != null && totalInterest > 0)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = totalInterest, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        }

                        // Dr Interest Expense (Overdue Post-Maturity Interest)
                        if (overdueInterest > 0 && expenseLedger != null)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = expenseLedger.LedgerID, DrCr = "Dr", Amount = overdueInterest, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        }

                        // Cr Loan Ledgers
                        var loanRate = settledLoan.LoanRate ?? await _context.LoanRates.FindAsync(settledLoan.LoanRateID);
                        int loanLedgerId = loanRate?.LoanLedgerID ?? 0;
                        int loanInterestLedgerId = loanRate?.InterestLedgerID ?? 0;
                        int loanOverdueLedgerId = (loanRate?.OverdueInterestLedgerID ?? 0) > 0 ? loanRate!.OverdueInterestLedgerID!.Value : loanInterestLedgerId;

                        if (prinPaid > 0)
                        {
                            if (loanLedgerId <= 0)
                            {
                                return BadRequest("कर्ज योजनेचे मुद्दल लेजर (Loan Principal Ledger) मॅप केलेले नाही.");
                            }
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = loanLedgerId, DrCr = "Cr", Amount = prinPaid, CustomerID = settledLoan.CustomerID, MemberID = settledLoan.MemberID });
                        }
                        if (intPaid > 0)
                        {
                            if (loanInterestLedgerId <= 0)
                            {
                                return BadRequest("कर्ज योजनेचे व्याज लेजर (Loan Interest Ledger) मॅप केलेले नाही.");
                            }
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = loanInterestLedgerId, DrCr = "Cr", Amount = intPaid, CustomerID = settledLoan.CustomerID, MemberID = settledLoan.MemberID });
                        }
                        if (penPaid > 0)
                        {
                            if (loanOverdueLedgerId <= 0)
                            {
                                return BadRequest("कर्ज योजनेचे दंड व्याज लेजर (Loan Overdue Interest Ledger) मॅप केलेले नाही.");
                            }
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = loanOverdueLedgerId, DrCr = "Cr", Amount = penPaid, CustomerID = settledLoan.CustomerID, MemberID = settledLoan.MemberID });
                        }

                        // Cr Surplus Payout Ledger (if surplus > 0)
                        if (surplusPayoutAmount > 0 && surplusLedgerId > 0)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = surplusLedgerId, DrCr = "Cr", Amount = surplusPayoutAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        }

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

                        if (overdueInterest > 0)
                        {
                            _context.FdTransactions.Add(new FdTransaction
                            {
                                BranchID = account.BranchID,
                                FdAccountID = account.FdAccountID,
                                VoucherID = voucher.VoucherID,
                                TransactionDate = closureDate,
                                TransactionType = "Accrual",
                                DebitCredit = "Cr",
                                Amount = overdueInterest
                            });
                        }

                        await _context.SaveChangesAsync();
                        await transaction.CommitAsync();

                        return Ok(new
                        {
                            message = $"मुदत ठेव बंद करून कर्ज खात्यात ₹{loanAdjustAmount:N2} वर्ग करण्यात आले." + (surplusPayoutAmount > 0 ? $" शिल्लक रक्कम ₹{surplusPayoutAmount:N2} ({surplusMode}) अदा केली." : ""),
                            loanAdjusted = loanAdjustAmount,
                            surplusPaid = surplusPayoutAmount,
                            loanAccountNo = settledLoan.LoanAccountNo,
                            remainingLoanBalance = settledLoan.PrincipalBalance + settledLoan.InterestBalance + settledLoan.OverdueInterestBalance
                        });
                    }
                    else
                    {
                        // Standard Non-Loan Closure
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
                                    Narration = $"मुदत ठेव परतावा जमा (FD Maturity Payout): {account.AccountNo}{(overdueInterest > 0 ? $" (समाविष्ट Overdue व्याज: ₹{overdueInterest:F2})" : "")}",
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
                        if (payoutLedger == null)
                        {
                            return BadRequest("Required payout ledger not found.");
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
                                ? $"मुदत ठेव पूर्ण क्लोजर (FD Maturity Payout - {paymentMode}): {account.AccountNo} [मुदतपूर्ती: {account.MaturityDate:dd/MM/yyyy}, प्रक्रिया: {DateTime.Now:dd/MM/yyyy}{(closureDate.Date < DateTime.Today ? $", As-on: {closureDate:dd/MM/yyyy}" : "")}]{(paymentMode == "Bank" && !string.IsNullOrEmpty(req?.ChequeNo) ? $" Cheque: {req.ChequeNo}" : "")}{(overdueInterest > 0 ? $" (समाविष्ट Overdue व्याज: ₹{overdueInterest:F2})" : "")}"
                                : req.Narration,
                            CreatedBy = 1,
                            CreatedOn = DateTime.Now
                        };
                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();

                        // Dr FD Liability (Principal)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = fdLiabilityLedger.LedgerID, DrCr = "Dr", Amount = account.DepositAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        
                        // Dr Interest Payable (Contracted Matured Interest)
                        if (payableLedger != null && totalInterest > 0)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = totalInterest, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        }

                        // Dr Interest Expense (Overdue Post-Maturity Interest)
                        if (overdueInterest > 0 && expenseLedger != null)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = expenseLedger.LedgerID, DrCr = "Dr", Amount = overdueInterest, CustomerID = account.CustomerID, MemberID = linkedMemberId });
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

                        if (overdueInterest > 0)
                        {
                            _context.FdTransactions.Add(new FdTransaction
                            {
                                BranchID = account.BranchID,
                                FdAccountID = account.FdAccountID,
                                VoucherID = voucher.VoucherID,
                                TransactionDate = closureDate,
                                TransactionType = "Accrual",
                                DebitCredit = "Cr",
                                Amount = overdueInterest
                            });
                        }

                        await _context.SaveChangesAsync();
                        await transaction.CommitAsync();
                        return Ok($"FD Account matured closed ({paymentMode}). Total payout: ₹{totalMaturityPayout:F2}" + (overdueInterest > 0 ? $" (समाविष्ट Overdue व्याज: ₹{overdueInterest:F2})" : ""));
                    }
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
                .ThenInclude(s => s!.InterestExpenseLedger)
                .Include(a => a.FdScheme)
                .ThenInclude(s => s!.PrematurePenaltyLedger)
                .FirstOrDefaultAsync(a => a.FdAccountID == id);

            if (account == null || account.Status != "Active")
            {
                return BadRequest("मुदत ठेव खाते सक्रिय (Active) नाही किंवा यापूर्वीच बंद/नूतनीकरण करण्यात आलेले आहे.");
            }

            DateTime effectiveClosureDate = req?.ClosureDate ?? closureDate ?? DateTime.Today;
            if (effectiveClosureDate.Date < account.OpeningDate.Date)
            {
                return BadRequest($"अवैध व्यवहाराची तारीख! व्यवहाराची तारीख ({effectiveClosureDate:dd/MM/yyyy}) ही मुदत ठेव खाते उघडल्याच्या तारखेपेक्षा ({account.OpeningDate:dd/MM/yyyy}) आधीची असू शकत नाही.");
            }
            if (effectiveClosureDate.Date > DateTime.Today)
            {
                return BadRequest($"अवैध व्यवहाराची तारीख! भविष्यातील तारीख ({effectiveClosureDate:dd/MM/yyyy}) अनुज्ञेय नाही. व्यवहार आजच्या किंवा मागील तारखेचाच असणे आवश्यक आहे.");
            }

            // 🛡️ मुदत संपलेल्या खात्यावर मुदतपूर्व दंड लागू होऊ नये यासाठी गार्ड
            if (effectiveClosureDate.Date >= account.MaturityDate.Date)
            {
                return BadRequest($"अवैध विनंती! सदर मुदत ठेव खात्याची मुदत दिनांक {account.MaturityDate:dd/MM/yyyy} रोजीच पूर्ण झालेली आहे. मुदत पूर्ण झालेल्या ठेवीवर मुदतपूर्व दंड (Penalty) आकारला जाऊ नये यासाठी कृपया 'मुदतपूर्ती बंद (Matured Close)' हा पर्याय वापरा.");
            }

            var closedFy = await _context.FinancialYears
                .FirstOrDefaultAsync(fy => fy.IsClosed && effectiveClosureDate.Date >= fy.StartDate.Date && effectiveClosureDate.Date <= fy.EndDate.Date);
            if (closedFy != null)
            {
                return BadRequest($"अवैध व्यवहाराची तारीख! निवडलेली तारीख ({effectiveClosureDate:dd/MM/yyyy}) ही बंद/ऑडिट झालेल्या आर्थिक वर्षात ({closedFy.YearCode}) मोडते. बंद आर्थिक वर्षात थेट व्हाउचर पोस्ट करणे वैधानिक लेखापरीक्षण नियमांनुसार (MCS Act) प्रतिबंधित आहे.");
            }

            DateTime? lastAccrualDate = account.LastInterestPostingDate;
            if (!lastAccrualDate.HasValue)
            {
                lastAccrualDate = await _context.FdInterestAccruals
                    .Where(a => a.FdAccountID == account.FdAccountID && a.IsPosted)
                    .OrderByDescending(a => a.AccrualDate)
                    .Select(a => (DateTime?)a.AccrualDate)
                    .FirstOrDefaultAsync();
            }
            if (!lastAccrualDate.HasValue)
            {
                lastAccrualDate = await _context.FdTransactions
                    .Where(t => t.FdAccountID == account.FdAccountID && t.TransactionType == "Accrual")
                    .OrderByDescending(t => t.TransactionDate)
                    .Select(t => (DateTime?)t.TransactionDate)
                    .FirstOrDefaultAsync();
            }

            if (lastAccrualDate.HasValue && effectiveClosureDate.Date < lastAccrualDate.Value.Date)
            {
                return BadRequest($"अवैध व्यवहाराची तारीख! या खात्यावर {lastAccrualDate.Value:dd/MM/yyyy} रोजी व्याज तरतूद (Interest Accrual) झालेली आहे. व्यवहाराची तारीख शेवटच्या व्याज तरतुदीच्या तारखेपेक्षा ({lastAccrualDate.Value:dd/MM/yyyy}) आधीची असू शकत नाही, अन्यथा देणे व्याज खात्यात (Interest Payable) अनैसर्गिक निगेटिव्ह (Debit) शिल्लक निर्माण होईल.");
            }
            string paymentMode = string.IsNullOrWhiteSpace(req?.PaymentMode) ? "Cash" : req.PaymentMode;
            if (paymentMode == "Transfer" && req?.SavingAccountID > 0)
            {
                if (effectiveClosureDate.Date < DateTime.Today)
                {
                    return BadRequest($"अवैध व्यवहाराची तारीख! बचत खात्यात (Saving Account Transfer) परतावा वर्ग करताना मागील तारीख ({effectiveClosureDate:dd/MM/yyyy}) अनुज्ञेय नाही. ग्राहकाच्या पासबुकमधील रनिंग शिल्लक (Running Balance) विस्कळीत होणे टाळण्यासाठी आणि एसएमएस ताळमेळ राखण्यासाठी बचत खात्यातील हस्तांतरण आजच्याच तारखेने ({DateTime.Today:dd/MM/yyyy}) होणे बंधनकारक आहे. जर व्यवहार मागील तारखेने झाला असेल, तर कृपया 'रोख' किंवा इतर माध्यम निवडा.");
                }
                var targetSav = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.SavingAccountID == req.SavingAccountID.Value);
                if (targetSav == null || targetSav.Status != "Active")
                {
                    return BadRequest($"निवडलेले बचत खाते ({targetSav?.AccountNo ?? "अज्ञात"}) सापडले नाही किंवा ते सक्रिय (Active) नाही. बंद किंवा निष्क्रिय बचत खात्यात रक्कम वर्ग करता येत नाही.");
                }
            }

            if (req?.AdjustInLoan == true && req.SurplusPaymentMode == "Transfer" && req.SurplusSavingAccountID > 0)
            {
                var surplusSav = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.SavingAccountID == req.SurplusSavingAccountID.Value);
                if (surplusSav == null || surplusSav.Status != "Active")
                {
                    return BadRequest($"शिल्लक परताव्यासाठी निवडलेले बचत खाते ({surplusSav?.AccountNo ?? "अज्ञात"}) सापडले नाही किंवा ते सक्रिय (Active) नाही. बंद किंवा निष्क्रिय बचत खात्यात रक्कम वर्ग करता येत नाही.");
                }
            }

            // 🛡️ Lien & Active Loan Check: खातेदाराचे थकीत कर्ज तपासणी
            int custId = account.CustomerID;
            int? linkedMemberId = null;
            if (custId > 0)
            {
                var linkedMem = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == custId);
                if (linkedMem != null) linkedMemberId = linkedMem.MemberID;
            }

            var loansQuery = _context.LoanAccounts
                .Include(l => l.LoanRate)
                .Where(l => l.Status == "Active");

            if (linkedMemberId.HasValue && linkedMemberId.Value > 0)
            {
                loansQuery = loansQuery.Where(l => l.CustomerID == custId || l.MemberID == linkedMemberId.Value);
            }
            else
            {
                loansQuery = loansQuery.Where(l => l.CustomerID == custId);
            }

            var activeLoans = await loansQuery
                .Where(l => l.PrincipalBalance > 0 || l.InterestBalance > 0 || l.OverdueInterestBalance > 0)
                .ToListAsync();

            decimal totalActiveLoanDebt = activeLoans.Sum(l => l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance);

            if (totalActiveLoanDebt > 0 && !(req?.AdjustInLoan ?? false))
            {
                return BadRequest(new
                {
                    errorCode = "LOAN_OUTSTANDING_EXISTS",
                    message = $"सदर खातेदाराकडे एकूण ₹{totalActiveLoanDebt:N2} चे कर्ज थकीत आहे. पतसंस्थेच्या सुरक्षा नियमांनुसार (Lien/Collateral Protection) हे मुदत ठेव खाते परस्पर बंद करता येणार नाही. कृपया 'कर्ज खात्यात रक्कम वर्ग करा (Adjust in Loan)' हा पर्याय निवडा किंवा कर्ज पूर्ण भरा.",
                    totalDebt = totalActiveLoanDebt,
                    activeLoansCount = activeLoans.Count
                });
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    // 1. Calculate actual days held (Same-day close receives minimum 1 day)
                    int actualDays = Math.Max(1, (effectiveClosureDate.Date - account.OpeningDate.Date).Days);

                    // 2. Determine premature interest rate
                    decimal originalRate = account.InterestRate;
                    decimal prematureRate = account.FdScheme?.PrematureInterestRate ?? (originalRate - 1.0m);
                    if (prematureRate < 0) prematureRate = 0;

                    // 3. Recalculate interest
                    decimal recalculatedInterest = Math.Round((account.DepositAmount * prematureRate * actualDays) / 36500.0m, 2);

                    // 4. Determine already provisioned/paid interest
                    decimal dbAccrued = await _context.FdTransactions
                        .Where(t => t.FdAccountID == id && t.TransactionType == "Accrual")
                        .SumAsync(t => t.Amount);
                    decimal alreadyAccruedInt = Math.Max(dbAccrued, account.LegacyAccruedInt);

                    bool isPeriodicPayout = account.FdScheme != null && 
                        (account.FdScheme.InterestType == "MIS" || account.FdScheme.InterestType == "Monthly Interest");

                    // 5. Final payable calculations
                    decimal penaltyClawback = 0;
                    decimal netPayoutAmount = account.DepositAmount + recalculatedInterest;

                    if (isPeriodicPayout)
                    {
                        // In MIS: interest was physically disbursed to customer monthly.
                        // If already paid interest exceeds recalculated interest, recover from Principal payout.
                        if (alreadyAccruedInt > recalculatedInterest)
                        {
                            penaltyClawback = alreadyAccruedInt - recalculatedInterest;
                            netPayoutAmount = account.DepositAmount - penaltyClawback;
                        }
                    }
                    else
                    {
                        // In Cumulative / Simple FD: customer never received cash interest periodically.
                        // Customer is legally entitled to full Principal + Recalculated Interest!
                        // Any excess internal provision in Interest Payable is reversed to the Society's P&L / Expense.
                        netPayoutAmount = account.DepositAmount + recalculatedInterest;
                        if (alreadyAccruedInt > recalculatedInterest)
                        {
                            penaltyClawback = alreadyAccruedInt - recalculatedInterest;
                        }
                    }

                    LoanAccount? targetLoan = null;
                    decimal loanAdjustAmount = 0m;
                    decimal surplusPayoutAmount = netPayoutAmount;

                    if (req?.AdjustInLoan == true)
                    {
                        int targetLoanId = req.TargetLoanAccountID ?? (activeLoans.FirstOrDefault()?.LoanAccountID ?? 0);
                        if (targetLoanId == 0)
                        {
                            return BadRequest(new { message = "कृपया मुदत ठेवीची रक्कम वर्ग करण्यासाठी कर्ज खाते निवडा." });
                        }

                        targetLoan = activeLoans.FirstOrDefault(l => l.LoanAccountID == targetLoanId) 
                            ?? await _context.LoanAccounts.Include(l => l.LoanRate).FirstOrDefaultAsync(l => l.LoanAccountID == targetLoanId);

                        if (targetLoan == null)
                        {
                            return BadRequest(new { message = "निवडलेले कर्ज खाते सापडले नाही किंवा ते सक्रिय नाही." });
                        }

                        decimal targetLoanTotalDue = targetLoan.PrincipalBalance + targetLoan.InterestBalance + targetLoan.OverdueInterestBalance;
                        decimal maxAdjustable = Math.Min(netPayoutAmount, targetLoanTotalDue);
                        loanAdjustAmount = req.LoanAdjustmentAmount.HasValue && req.LoanAdjustmentAmount.Value > 0
                            ? Math.Min(req.LoanAdjustmentAmount.Value, maxAdjustable)
                            : maxAdjustable;

                        surplusPayoutAmount = netPayoutAmount - loanAdjustAmount;
                    }

                    account.Status = "Closed";
                    account.Remarks = (account.Remarks ?? "") + 
                        (req?.AdjustInLoan == true 
                            ? $" | मुदतपूर्व बंद: {effectiveClosureDate:dd/MM/yyyy} [कर्ज वजावट: ₹{loanAdjustAmount:N2} -> कर्ज क्र: {targetLoan?.LoanAccountNo}, शिल्लक परतावा: ₹{surplusPayoutAmount:N2} ({req.SurplusPaymentMode})]"
                            : $" | मुदतपूर्व बंद: {effectiveClosureDate:dd/MM/yyyy} ({paymentMode})");
                    await _context.SaveChangesAsync();

                    var fdLiabilityLedger = await ResolveFdLiabilityLedgerAsync(account.FdScheme);
                    var payableLedger = await ResolveInterestPayableLedgerAsync(account.FdScheme);
                    var expenseLedger = await ResolveInterestExpenseLedgerAsync(account.FdScheme);
                    var clawbackLedger = await ResolveClawbackLedgerAsync(account.FdScheme);
                    
                    if (fdLiabilityLedger == null)
                    {
                        return BadRequest("मुदत ठेव दायित्व लेजर (FD Liability Ledger) सापडले नाही. कृपया योजनेत लेजर मॅपिंग तपासा.");
                    }

                    if (req?.AdjustInLoan == true && targetLoan != null)
                    {
                        // 1. Process Loan Settlement via Waterfall
                        var (settledLoan, loanColl, prinPaid, intPaid, penPaid) = await ProcessLoanSettlementAsync(
                            targetLoan.LoanAccountID, 
                            loanAdjustAmount, 
                            effectiveClosureDate, 
                            account.AccountNo, 
                            account.BranchID);

                        // 2. Resolve Surplus Payout Ledger (if surplus > 0)
                        string surplusMode = !string.IsNullOrWhiteSpace(req.SurplusPaymentMode) ? req.SurplusPaymentMode : "Cash";
                        int surplusLedgerId = 0;
                        if (surplusPayoutAmount > 0)
                        {
                            if (surplusMode == "Bank" && req.SurplusBankLedgerID > 0)
                            {
                                surplusLedgerId = req.SurplusBankLedgerID.Value;
                            }
                            else if (surplusMode == "Transfer" && req.SurplusSavingAccountID > 0)
                            {
                                var savAccount = await _context.SavingAccountMasters
                                    .Include(s => s.Ledger)
                                    .FirstOrDefaultAsync(s => s.SavingAccountID == req.SurplusSavingAccountID.Value);

                                if (savAccount != null)
                                {
                                    savAccount.CurrentBalance += surplusPayoutAmount;
                                    surplusLedgerId = savAccount.LedgerID > 0 ? savAccount.LedgerID : (savAccount.Ledger?.LedgerID ?? 7);

                                    var savTx = new SavingTransaction
                                    {
                                        SavingAccountID = savAccount.SavingAccountID,
                                        CustomerID = savAccount.CustomerID,
                                        TransactionDate = effectiveClosureDate,
                                        TransactionType = "Deposit",
                                        PaymentMode = "Transfer",
                                        Amount = surplusPayoutAmount,
                                        BalanceAfterTxn = savAccount.CurrentBalance,
                                        Narration = $"मुदत ठेव मुदतपूर्व परतावा जमा (FD Premature Surplus): {account.AccountNo}",
                                        VoucherNo = $"JV-FD-PRECLOSE-{account.AccountNo}",
                                        CreatedBy = 1,
                                        CreatedOn = DateTime.Now
                                    };
                                    _context.SavingTransactions.Add(savTx);
                                }
                                else
                                {
                                    surplusLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, account.BranchID, "FD");
                                }
                            }
                            else
                            {
                                surplusLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, account.BranchID, "FD");
                            }
                        }

                        // 3. Create Compound Journal Voucher
                        var voucher = new Voucher
                        {
                            BranchID = account.BranchID,
                            VoucherNo = $"JV-FD-PRECLOSE-{account.AccountNo}",
                            VoucherDate = effectiveClosureDate,
                            VoucherType = "Journal",
                            TotalAmount = netPayoutAmount,
                            Narration = string.IsNullOrWhiteSpace(req?.Narration)
                                ? $"मुदतपूर्व बंद व कर्ज वजावट (FD Premature & Loan Set-Off): {account.AccountNo} -> कर्ज: {settledLoan.LoanAccountNo} (कर्ज जमा: ₹{loanAdjustAmount:N2}, शिल्लक परतावा: ₹{surplusPayoutAmount:N2} {surplusMode})"
                                : req.Narration,
                            CreatedBy = 1,
                            CreatedOn = DateTime.Now
                        };
                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();
                        loanColl.VoucherID = voucher.VoucherID;

                        // Dr FD Liability (Principal)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = fdLiabilityLedger.LedgerID, DrCr = "Dr", Amount = account.DepositAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                        if (isPeriodicPayout)
                        {
                            // In MIS:
                            // Cr Clawback Income / Recovery
                            if (penaltyClawback > 0 && clawbackLedger != null)
                            {
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = clawbackLedger.LedgerID, DrCr = "Cr", Amount = penaltyClawback, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            }
                        }
                        else
                        {
                            // In Cumulative / Simple FD:
                            if (payableLedger != null && alreadyAccruedInt > 0)
                            {
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = alreadyAccruedInt, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            }

                            if (recalculatedInterest > alreadyAccruedInt && expenseLedger != null)
                            {
                                decimal unprovisionedInterest = recalculatedInterest - alreadyAccruedInt;
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = expenseLedger.LedgerID, DrCr = "Dr", Amount = unprovisionedInterest, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            }

                            if (penaltyClawback > 0 && clawbackLedger != null)
                            {
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = clawbackLedger.LedgerID, DrCr = "Cr", Amount = penaltyClawback, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            }
                        }

                        // Cr Loan Ledgers
                        var loanRate = settledLoan.LoanRate ?? await _context.LoanRates.FindAsync(settledLoan.LoanRateID);
                        int loanLedgerId = loanRate?.LoanLedgerID ?? 0;
                        int loanInterestLedgerId = loanRate?.InterestLedgerID ?? 0;
                        int loanOverdueLedgerId = (loanRate?.OverdueInterestLedgerID ?? 0) > 0 ? loanRate!.OverdueInterestLedgerID!.Value : loanInterestLedgerId;

                        if (prinPaid > 0)
                        {
                            if (loanLedgerId <= 0)
                            {
                                return BadRequest("कर्ज योजनेचे मुद्दल लेजर (Loan Principal Ledger) मॅप केलेले नाही.");
                            }
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = loanLedgerId, DrCr = "Cr", Amount = prinPaid, CustomerID = settledLoan.CustomerID, MemberID = settledLoan.MemberID });
                        }
                        if (intPaid > 0)
                        {
                            if (loanInterestLedgerId <= 0)
                            {
                                return BadRequest("कर्ज योजनेचे व्याज लेजर (Loan Interest Ledger) मॅप केलेले नाही.");
                            }
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = loanInterestLedgerId, DrCr = "Cr", Amount = intPaid, CustomerID = settledLoan.CustomerID, MemberID = settledLoan.MemberID });
                        }
                        if (penPaid > 0)
                        {
                            if (loanOverdueLedgerId <= 0)
                            {
                                return BadRequest("कर्ज योजनेचे दंड व्याज लेजर (Loan Overdue Interest Ledger) मॅप केलेले नाही.");
                            }
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = loanOverdueLedgerId, DrCr = "Cr", Amount = penPaid, CustomerID = settledLoan.CustomerID, MemberID = settledLoan.MemberID });
                        }

                        // Cr Surplus Payout Ledger (if surplus > 0)
                        if (surplusPayoutAmount > 0 && surplusLedgerId > 0)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = surplusLedgerId, DrCr = "Cr", Amount = surplusPayoutAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
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

                        return Ok(new
                        {
                            Message = $"मुदतपूर्व बंद करून कर्ज खात्यात ₹{loanAdjustAmount:N2} वर्ग करण्यात आले." + (surplusPayoutAmount > 0 ? $" शिल्लक रक्कम ₹{surplusPayoutAmount:N2} ({surplusMode}) अदा केली." : ""),
                            ActualDays = actualDays,
                            RecalcInt = recalculatedInterest,
                            Clawback = penaltyClawback,
                            NetPayout = netPayoutAmount,
                            LoanAdjusted = loanAdjustAmount,
                            SurplusPaid = surplusPayoutAmount,
                            LoanAccountNo = settledLoan.LoanAccountNo,
                            RemainingLoanBalance = settledLoan.PrincipalBalance + settledLoan.InterestBalance + settledLoan.OverdueInterestBalance
                        });
                    }
                    else
                    {
                        // Standard Non-Loan Closure
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
                        if (payoutLedger == null)
                        {
                            return BadRequest("Required payout ledger not found.");
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
                                ? $"मुदतपूर्व बंद (Premature Close - {paymentMode}) - कालावधी: {actualDays} दिवस{(effectiveClosureDate.Date < DateTime.Today ? $" ({effectiveClosureDate:dd/MM/yyyy} As-on)" : "")}, पुनर्हिशोब व्याज: ₹{recalculatedInterest}, दंड कपात: ₹{penaltyClawback}{(paymentMode == "Bank" && !string.IsNullOrEmpty(req?.ChequeNo) ? $" Cheque: {req.ChequeNo}" : "")}"
                                : req.Narration,
                            CreatedBy = 1,
                            CreatedOn = DateTime.Now
                        };
                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();

                        // Dr FD Liability (Principal)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = fdLiabilityLedger.LedgerID, DrCr = "Dr", Amount = account.DepositAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                        if (isPeriodicPayout)
                        {
                            // In MIS: Periodic cash payouts already took place, so no Interest Payable balance to clear.
                            // Cr Payout Ledger (Net payout)
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payoutLedger.LedgerID, DrCr = "Cr", Amount = netPayoutAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                            // Cr Clawback Income / Recovery
                            if (penaltyClawback > 0 && clawbackLedger != null)
                            {
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = clawbackLedger.LedgerID, DrCr = "Cr", Amount = penaltyClawback, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            }
                        }
                        else
                        {
                            // In Cumulative / Simple FD:
                            // Dr Interest Payable (Interest already accrued is fully debited to clear balance sheet liability)
                            if (payableLedger != null && alreadyAccruedInt > 0)
                            {
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = alreadyAccruedInt, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            }

                            // Dr Additional Current Interest Expense (if recalculated interest exceeds already accrued)
                            if (recalculatedInterest > alreadyAccruedInt && expenseLedger != null)
                            {
                                decimal unprovisionedInterest = recalculatedInterest - alreadyAccruedInt;
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = expenseLedger.LedgerID, DrCr = "Dr", Amount = unprovisionedInterest, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            }

                            // Cr Payout Ledger (Net payout = Principal + recalculatedInterest)
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payoutLedger.LedgerID, DrCr = "Cr", Amount = netPayoutAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                            // Cr Interest Expense / Clawback Income (Reversing excess prior year provisions back to P&L)
                            if (penaltyClawback > 0 && clawbackLedger != null)
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
                .Include(a => a.FdScheme)
                .ThenInclude(s => s!.InterestExpenseLedger)
                .FirstOrDefaultAsync(a => a.FdAccountID == id);

            if (oldAccount == null || oldAccount.Status != "Active")
            {
                return BadRequest("जुने मुदत ठेव खाते सक्रिय (Active) नाही किंवा यापूर्वीच बंद/नूतनीकरण करण्यात आलेले आहे.");
            }

            var scheme = await _context.FdSchemes
                .Include(s => s.FdLiabilityLedger)
                .Include(s => s.Slabs)
                .FirstOrDefaultAsync(s => s.FdSchemeID == request.TargetSchemeID);

            if (scheme == null)
            {
                return BadRequest("Target Scheme not found.");
            }

            DateTime closureDate = request.ClosureDate ?? DateTime.Today;
            if (closureDate.Date < oldAccount.OpeningDate.Date)
            {
                return BadRequest($"अवैध नूतनीकरण तारीख! नूतनीकरणाची तारीख ({closureDate:dd/MM/yyyy}) ही जुने मुदत ठेव खाते उघडल्याच्या तारखेपेक्षा ({oldAccount.OpeningDate:dd/MM/yyyy}) आधीची असू शकत नाही.");
            }
            if (closureDate.Date > DateTime.Today)
            {
                return BadRequest($"अवैध नूतनीकरण तारीख! भविष्यातील तारीख ({closureDate:dd/MM/yyyy}) अनुज्ञेय नाही. नूतनीकरण आजच्या किंवा मागील तारखेलाच केले जाऊ शकते.");
            }

            // 🛡️ मुदतपूर्व नूतनीकरण गार्ड (Premature Renewal Guard)
            if (closureDate.Date < oldAccount.MaturityDate.Date)
            {
                return BadRequest($"अवैध नूतनीकरण विनंती! सदर मुदत ठेव पावती अद्याप मुदतपूर्ण (Matured) झालेली नाही. या खात्याची मुदतपूर्ती तारीख {oldAccount.MaturityDate:dd/MM/yyyy} आहे (उर्वरित कालावधी: {(oldAccount.MaturityDate.Date - closureDate.Date).Days} दिवस). मुदतीआधी नूतनीकरण अनुज्ञेय नाही. ठेव बंद करायची असल्यास 'मुदतपूर्व बंद' पर्याय वापरा.");
            }

            var closedFy = await _context.FinancialYears
                .FirstOrDefaultAsync(fy => fy.IsClosed && closureDate.Date >= fy.StartDate.Date && closureDate.Date <= fy.EndDate.Date);
            if (closedFy != null)
            {
                return BadRequest($"अवैध नूतनीकरण तारीख! निवडलेली तारीख ({closureDate:dd/MM/yyyy}) ही बंद/ऑडिट झालेल्या आर्थिक वर्षात ({closedFy.YearCode}) मोडते. बंद आर्थिक वर्षात थेट व्हाउचर पोस्ट करणे वैधानिक लेखापरीक्षण नियमांनुसार (MCS Act) प्रतिबंधित आहे.");
            }

            DateTime? lastAccrualDate = oldAccount.LastInterestPostingDate;
            if (!lastAccrualDate.HasValue)
            {
                lastAccrualDate = await _context.FdInterestAccruals
                    .Where(a => a.FdAccountID == oldAccount.FdAccountID && a.IsPosted)
                    .OrderByDescending(a => a.AccrualDate)
                    .Select(a => (DateTime?)a.AccrualDate)
                    .FirstOrDefaultAsync();
            }
            if (!lastAccrualDate.HasValue)
            {
                lastAccrualDate = await _context.FdTransactions
                    .Where(t => t.FdAccountID == oldAccount.FdAccountID && t.TransactionType == "Accrual")
                    .OrderByDescending(t => t.TransactionDate)
                    .Select(t => (DateTime?)t.TransactionDate)
                    .FirstOrDefaultAsync();
            }

            if (lastAccrualDate.HasValue && closureDate.Date < lastAccrualDate.Value.Date)
            {
                return BadRequest($"अवैध नूतनीकरण तारीख! या जुन्या मुदत ठेव खात्यावर {lastAccrualDate.Value:dd/MM/yyyy} रोजी व्याज तरतूद (Interest Accrual) झालेली आहे. नूतनीकरणाची तारीख शेवटच्या व्याज तरतुदीच्या तारखेपेक्षा ({lastAccrualDate.Value:dd/MM/yyyy}) आधीची असू शकत नाही, अन्यथा देणे व्याज खात्यात (Interest Payable) अनैसर्गिक निगेटिव्ह (Debit) शिल्लक निर्माण होईल.");
            }

            if (request.RenewalType == "PrincipalOnly" && request.PaymentMode == "Transfer" && request.SavingAccountID.HasValue && request.SavingAccountID.Value > 0)
            {
                if (closureDate.Date < DateTime.Today)
                {
                    return BadRequest($"अवैध नूतनीकरण तारीख! मुदत ठेवीचे व्याज बचत खात्यात (Saving Account Transfer) वर्ग करताना मागील तारीख ({closureDate:dd/MM/yyyy}) अनुज्ञेय नाही. पासबुकमधील रनिंग शिल्लक विस्कळीत होणे टाळण्यासाठी आणि एसएमएस ताळमेळ राखण्यासाठी बचत खात्यातील हस्तांतरण आजच्याच तारखेने ({DateTime.Today:dd/MM/yyyy}) होणे आवश्यक आहे.");
                }
                var targetSav = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.SavingAccountID == request.SavingAccountID.Value);
                if (targetSav == null || targetSav.Status != "Active")
                {
                    return BadRequest($"निवडलेले बचत खाते ({targetSav?.AccountNo ?? "अज्ञात"}) सापडले नाही किंवा ते सक्रिय (Active) नाही. बंद किंवा निष्क्रिय बचत खात्यात रक्कम वर्ग करता येत नाही.");
                }
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    // 1. Calculate Old Interest
                    var accruedFromTx = await _context.FdTransactions
                        .Where(t => t.FdAccountID == id && t.TransactionType == "Accrual")
                        .SumAsync(t => t.Amount);

                    bool isOldPeriodicScheme = oldAccount.FdScheme != null && 
                        (oldAccount.FdScheme.InterestType == "MIS" || oldAccount.FdScheme.InterestType == "Monthly Interest");

                    decimal accruedInt = isOldPeriodicScheme
                        ? 0m
                        : ((oldAccount.MaturityAmount > oldAccount.DepositAmount)
                            ? (oldAccount.MaturityAmount - oldAccount.DepositAmount)
                            : Math.Max(accruedFromTx, oldAccount.LegacyAccruedInt));

                    DateTime newOpeningDate = closureDate;
                    decimal overdueInterest = 0m;
                    int overdueDays = 0;

                    bool isOverdue = closureDate.Date > oldAccount.MaturityDate.Date;
                    bool isSchemeOverdueAllowed = oldAccount.FdScheme?.AllowOverdueInterest ?? false;

                    if (isOverdue && request.RenewalEffectiveFrom == "MaturityDate")
                    {
                        // Retroactive renewal: new deposit starts from original maturity date
                        newOpeningDate = oldAccount.MaturityDate.Date;
                        overdueInterest = 0m;
                    }
                    else if (isOverdue && isSchemeOverdueAllowed && request.ApplyOverdueInterest)
                    {
                        // Renewing from closure date with overdue interest for the gap
                        overdueDays = (closureDate.Date - oldAccount.MaturityDate.Date).Days;
                        decimal overdueRate = oldAccount.FdScheme?.OverdueInterestRate ?? request.OverdueInterestRate ?? 3.00m;
                        overdueInterest = Math.Round((oldAccount.MaturityAmount * overdueRate * overdueDays) / 36500.0m, 2);
                    }

                    decimal totalMaturityAmount = oldAccount.DepositAmount + accruedInt + overdueInterest;
                    decimal newDepositAmount = request.RenewalType == "PrincipalOnly" ? oldAccount.DepositAmount : totalMaturityAmount;
                    decimal interestPayoutAmount = request.RenewalType == "PrincipalOnly" ? (accruedInt + overdueInterest) : 0m;
                    string paymentMode = string.IsNullOrWhiteSpace(request.PaymentMode) ? "Cash" : request.PaymentMode;

                    // 🛡️ Lien & Active Loan Check: जर खातेदाराकडे सक्रिय कर्ज असेल तर नूतनीकरणात रोख/बँकेने व्याज देण्यास मज्जाव
                    if (request.RenewalType == "PrincipalOnly" && interestPayoutAmount > 0)
                    {
                        int custId = oldAccount.CustomerID;
                        int? linkedMemId = null;
                        var mem = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == custId);
                        if (mem != null) linkedMemId = mem.MemberID;

                        var activeLoansQuery = _context.LoanAccounts
                            .Where(l => l.Status == "Active" && (l.PrincipalBalance > 0 || l.InterestBalance > 0 || l.OverdueInterestBalance > 0));

                        if (linkedMemId.HasValue && linkedMemId.Value > 0)
                        {
                            activeLoansQuery = activeLoansQuery.Where(l => l.CustomerID == custId || l.MemberID == linkedMemId.Value);
                        }
                        else
                        {
                            activeLoansQuery = activeLoansQuery.Where(l => l.CustomerID == custId);
                        }

                        var activeLoans = await activeLoansQuery.ToListAsync();
                        if (activeLoans.Any())
                        {
                            decimal totalLoanDebt = activeLoans.Sum(l => l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance);
                            return BadRequest(new {
                                errorCode = "LOAN_OUTSTANDING_EXISTS",
                                message = $"सदर खातेदाराकडे एकूण ₹{totalLoanDebt:N2} चे सक्रिय कर्ज थकीत आहे. पतसंस्थेच्या सुरक्षा नियमांनुसार (Lien/Collateral Protection) थकीत कर्जदारास मुदत ठेवीचे व्याज (₹{interestPayoutAmount:N2}) थेट रोख/बँकेने देता येणार नाही. कृपया नूतनीकरणात संपूर्ण रक्कम (मुद्दल + व्याज) समाविष्ट करा किंवा आधी कर्ज फेडा."
                            });
                        }
                    }

                    // Close Old Account
                    oldAccount.Status = "Closed";
                    oldAccount.Remarks = (oldAccount.Remarks ?? "") + $" | नूतनीकरण दिनांक: {closureDate:dd/MM/yyyy} ({request.RenewalType})" + (overdueInterest > 0 ? $" [मुदत उलटून गेलेले (Overdue) व्याज: ₹{overdueInterest:F2} ({overdueDays} दिवस)]" : "");
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

                    // Determine correct Financial Year corresponding to new deposit opening date
                    var matchingFy = await _context.FinancialYears
                        .FirstOrDefaultAsync(fy => newOpeningDate.Date >= fy.StartDate.Date && newOpeningDate.Date <= fy.EndDate.Date);

                    int targetFinancialYearId = matchingFy?.FinancialYearID 
                        ?? (await _context.FinancialYears.FirstOrDefaultAsync(fy => fy.IsActive))?.FinancialYearID 
                        ?? (oldAccount.FinancialYearID > 0 ? oldAccount.FinancialYearID : 1);

                    // 🛡️ कालावधी प्रकार व मूल्य निश्चिती (Days, Months, Years Support)
                    string durType = !string.IsNullOrWhiteSpace(request.DurationType)
                        ? request.DurationType
                        : (!string.IsNullOrWhiteSpace(scheme.DurationType) ? scheme.DurationType : "Months");

                    int durVal = request.DurationValue.HasValue && request.DurationValue.Value > 0
                        ? request.DurationValue.Value
                        : (scheme.DurationMonths > 0 ? scheme.DurationMonths : 12);

                    DateTime maturityDate;
                    int totalDays;
                    if (durType.Equals("Days", StringComparison.OrdinalIgnoreCase))
                    {
                        totalDays = durVal;
                        maturityDate = newOpeningDate.AddDays(totalDays);
                    }
                    else if (durType.Equals("Years", StringComparison.OrdinalIgnoreCase))
                    {
                        maturityDate = newOpeningDate.AddYears(durVal);
                        totalDays = (int)(maturityDate - newOpeningDate).TotalDays;
                    }
                    else
                    {
                        maturityDate = newOpeningDate.AddMonths(durVal);
                        totalDays = (int)(maturityDate - newOpeningDate).TotalDays;
                    }

                    // Determine customer senior citizen status (exact 60th birthday check)
                    var customer = await _context.Customers.FindAsync(oldAccount.CustomerID);
                    bool isSenior = customer?.BirthDate.HasValue == true && (customer.BirthDate.Value.Date <= newOpeningDate.Date.AddYears(-60));

                    // Resolve Interest Rate based on Slabs or Scheme fixed rate
                    decimal appliedRate;
                    if (scheme.SchemeDurationModel == "Slab")
                    {
                        var matchedSlab = scheme.Slabs?.FirstOrDefault(s => totalDays >= s.FromDays && totalDays <= s.ToDays && s.IsActive);
                        if (matchedSlab == null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"निवडलेला नूतनीकरण कालावधी ({totalDays} दिवस) मुदत ठेव योजनेच्या कोणत्याही मंजूर स्लॅबमध्ये बसत नाही (योजना मर्यादा: {scheme.MinDurationDays ?? 1} ते {scheme.MaxDurationDays ?? 0} दिवस).");
                        }
                        appliedRate = isSenior ? matchedSlab.SeniorCitizenRate : matchedSlab.InterestRate;
                    }
                    else
                    {
                        appliedRate = isSenior ? scheme.SeniorCitizenInterestRate : scheme.InterestRate;
                    }

                    // Create New FD Account
                    var newAccount = new FdAccount
                    {
                        InstitutionID = oldAccount.InstitutionID,
                        BranchID = oldAccount.BranchID,
                        FinancialYearID = targetFinancialYearId,
                        CustomerID = oldAccount.CustomerID,
                        FdSchemeID = request.TargetSchemeID,
                        AccountNo = $"{branchPrefix}-{oldAccount.BranchID:D3}-FD-{seq.CurrentValue:D6}",
                        OpeningDate = newOpeningDate,
                        DepositAmount = newDepositAmount,
                        InterestRate = appliedRate,
                        DurationType = durType,
                        DurationValue = durVal,
                        DurationInDays = totalDays,
                        MaturityDate = maturityDate,
                        Status = "Active",
                        NomineeName = oldAccount.NomineeName,
                        NomineeRelation = oldAccount.NomineeRelation,
                        Remarks = $"नूतनीकरण खाते (Renewed from): {oldAccount.AccountNo}" 
                            + (isSenior ? $" [ज्येष्ठ नागरिक सवलत दर: {appliedRate}%]" : "")
                            + (newOpeningDate != closureDate ? $" [सुरुवात दिनांक: {newOpeningDate:dd/MM/yyyy}]" : "") 
                            + (overdueInterest > 0 ? $" [समाविष्ट Overdue व्याज: ₹{overdueInterest:F2}]" : "")
                    };

                    // Maturity Calculations (Exact 365-Day Banking Basis)
                    decimal p = newDepositAmount;
                    decimal r = appliedRate;

                    if (scheme.InterestType == "Cumulative")
                    {
                        int n = 4; // Default Quarterly
                        if (scheme.InterestCompoundingFrequency == "Half-Yearly") n = 2;
                        if (scheme.InterestCompoundingFrequency == "Yearly") n = 1;
                        if (scheme.InterestCompoundingFrequency == "Monthly") n = 12;

                        double baseVal = 1.0 + ((double)r / (n * 100.0));
                        double exponent = n * ((double)totalDays / 365.0);
                        newAccount.MaturityAmount = Math.Round(p * (decimal)Math.Pow(baseVal, exponent), 0, MidpointRounding.AwayFromZero);
                    }
                    else if (scheme.InterestType == "MIS" || scheme.InterestType == "Monthly Interest")
                    {
                        newAccount.MaturityAmount = p;
                    }
                    else
                    {
                        // Simple Interest: A = P * (1 + (R * totalDays) / (365 * 100))
                        newAccount.MaturityAmount = Math.Round(p * (1.0m + ((r * (decimal)totalDays) / (365.0m * 100.0m))), 0, MidpointRounding.AwayFromZero);
                    }

                    _context.FdAccounts.Add(newAccount);
                    await _context.SaveChangesAsync();

                    // 3. Post Renewal Vouchers
                    var fdLiabilityLedger = await ResolveFdLiabilityLedgerAsync(scheme ?? oldAccount.FdScheme);
                    var payableLedger = await ResolveInterestPayableLedgerAsync(oldAccount.FdScheme ?? scheme);
                    var expenseLedger = await ResolveInterestExpenseLedgerAsync(oldAccount.FdScheme ?? scheme);

                    if (fdLiabilityLedger == null)
                    {
                        return BadRequest("मुदत ठेव दायित्व लेजर (FD Liability Ledger) सापडले नाही. कृपया योजनेत लेजर मॅपिंग तपासा.");
                    }
                    
                    int interestPayoutLedgerId = 0;
                    if (request.RenewalType == "PrincipalOnly" && interestPayoutAmount > 0)
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
                                savAccount.CurrentBalance += interestPayoutAmount;
                                interestPayoutLedgerId = savAccount.LedgerID > 0 ? savAccount.LedgerID : (savAccount.Ledger?.LedgerID ?? 7);

                                var savTx = new SavingTransaction
                                {
                                    SavingAccountID = savAccount.SavingAccountID,
                                    CustomerID = savAccount.CustomerID,
                                    TransactionDate = closureDate,
                                    TransactionType = "Deposit",
                                    PaymentMode = "Transfer",
                                    Amount = interestPayoutAmount,
                                    BalanceAfterTxn = savAccount.CurrentBalance,
                                    Narration = $"मुदत ठेव नूतनीकरण व्याज जमा (FD Renewal Interest): {oldAccount.AccountNo}{(overdueInterest > 0 ? $" (समाविष्ट Overdue व्याज: ₹{overdueInterest:F2})" : "")}",
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

                    if (overdueInterest > 0 && expenseLedger == null)
                    {
                        return BadRequest("मुदत संपल्यानंतरच्या (Overdue) व्याजासाठी व्याज खर्च लेजर (FD Interest Expense Ledger) उपलब्ध नाही. कृपया योजनेत लेजर मॅपिंग तपासा.");
                    }

                    var voucher = new Voucher
                    {
                        BranchID = oldAccount.BranchID,
                        VoucherNo = $"JV-FD-REN-{newAccount.AccountNo}",
                        VoucherDate = closureDate,
                        VoucherType = "Journal",
                        TotalAmount = totalMaturityAmount,
                        Narration = $"मुदत ठेव नूतनीकरण (FD Renewal): {oldAccount.AccountNo} -> {newAccount.AccountNo}{(overdueInterest > 0 ? $" (समाविष्ट Overdue व्याज: ₹{overdueInterest:F2})" : "")}",
                        CreatedBy = 1,
                        CreatedOn = DateTime.Now
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    var linkedMember = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == oldAccount.CustomerID);
                    int? linkedMemberId = linkedMember?.MemberID;

                    // Dr Old FD Liability (Principal)
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = fdLiabilityLedger.LedgerID, DrCr = "Dr", Amount = oldAccount.DepositAmount, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });
                    
                    // Dr Interest Payable (Accumulated Contract Interest)
                    if (payableLedger != null && accruedInt > 0)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = accruedInt, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });
                    }

                    // Dr Interest Expense (Overdue Interest)
                    if (overdueInterest > 0 && expenseLedger != null)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = expenseLedger.LedgerID, DrCr = "Dr", Amount = overdueInterest, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });
                    }

                    // Cr New FD Liability
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = fdLiabilityLedger?.LedgerID ?? 12, DrCr = "Cr", Amount = newDepositAmount, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });

                    // Cr Interest Payout (If Principal Only, pay out interest to Cash, Bank, or Saving)
                    if (request.RenewalType == "PrincipalOnly" && interestPayoutAmount > 0 && interestPayoutLedgerId > 0)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = interestPayoutLedgerId, DrCr = "Cr", Amount = interestPayoutAmount, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });
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

                    if (overdueInterest > 0)
                    {
                        _context.FdTransactions.Add(new FdTransaction
                        {
                            BranchID = oldAccount.BranchID,
                            FdAccountID = oldAccount.FdAccountID,
                            VoucherID = voucher.VoucherID,
                            TransactionDate = closureDate,
                            TransactionType = "Accrual",
                            DebitCredit = "Cr",
                            Amount = overdueInterest
                        });
                    }

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
                    return Ok(new { Message = "FD Renewed successfully", NewAccountNo = newAccount.AccountNo, NewDeposit = newDepositAmount, OverdueInterest = overdueInterest });
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
        [Authorize(Roles = "Admin,SuperAdmin,Manager")]
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

            if (string.Equals(existing.Status, "Closed", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest("सदर मुदत ठेव खाते आधीच बंद (Closed) झालेले असल्याने संपादित करता येत नाही.");
            }

            existing.BranchID = account.BranchID;
            existing.CustomerID = account.CustomerID;
            existing.FdSchemeID = account.FdSchemeID;
            if (!string.IsNullOrWhiteSpace(account.AccountNo)) existing.AccountNo = account.AccountNo;
            existing.LegacyAccountNumber = !string.IsNullOrWhiteSpace(account.LegacyAccountNumber) ? account.LegacyAccountNumber.Trim() : null;
            existing.OpeningDate = account.OpeningDate;
            existing.DepositAmount = account.DepositAmount;
            if (!string.IsNullOrWhiteSpace(account.DurationType)) existing.DurationType = account.DurationType;
            if (account.DurationValue.HasValue) existing.DurationValue = account.DurationValue;
            if (account.DurationInDays.HasValue) existing.DurationInDays = account.DurationInDays;
            existing.InterestRate = account.InterestRate;
            existing.MaturityDate = account.MaturityDate;
            existing.MaturityAmount = account.MaturityAmount;
            existing.LegacyAccruedInt = account.LegacyAccruedInt;
            existing.LastInterestPostingDate = account.LastInterestPostingDate;
            if (account.NomineeName != null) existing.NomineeName = account.NomineeName;
            if (account.NomineeRelation != null) existing.NomineeRelation = account.NomineeRelation;
            if (account.Remarks != null) existing.Remarks = account.Remarks;

            try
            {
                await _context.SaveChangesAsync();
                if (existing.IsLegacyAccount)
                {
                    try { await SyncFdOpeningBalancesInternalAsync(); } catch { }
                }
                return Ok(existing);
            }
            catch (Exception ex)
            {
                return BadRequest("Update करताना त्रुटी आली: " + ex.Message);
            }
        }




        // DELETE: api/FdAccounts/ClearData (Clear all test FD records & reset sequences - STRICTLY DEVELOPMENT ONLY)
        [HttpDelete("ClearData")]
        [Authorize(Roles = "Admin,SuperAdmin")]
        public async Task<IActionResult> ClearData()
        {
            var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
            if (!string.Equals(env, "Development", StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(403, new { message = "सुरक्षा निर्बंध: संपूर्ण मुदत ठेव डेटा पुसण्याची कृती थेट उत्पादन (Production) प्रणालीमध्ये पूर्णपणे प्रतिबंधित आहे. केवळ Development मोडमध्येच ही कृती करता येऊ शकते." });
            }

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
        [Authorize]
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

                DateTime fromDate = lastAccrual?.AccrualDate 
                    ?? acc.LastInterestPostingDate 
                    ?? acc.OpeningDate;
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
                    FromDate = fromDate,
                    LastInterestPostingDate = acc.LastInterestPostingDate,
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
        [Authorize(Roles = "Admin,SuperAdmin,Manager")]
        public async Task<IActionResult> PostSelectedInterest([FromBody] FdInterestPostRequestDto req)
        {
            if (req.SelectedItems == null || !req.SelectedItems.Any())
            {
                return BadRequest("कृपया व्याज पोस्ट करण्यासाठी किमान एक खाते निवडा (Select at least one account).");
            }

            if (req.AccrualDate.Date > DateTime.Today)
            {
                return BadRequest($"अवैध तारीख! भविष्यातील तारीख ({req.AccrualDate:dd/MM/yyyy}) अनुज्ञेय नाही. व्याज तरतूद आजच्या किंवा मागील तारखेचीच असणे आवश्यक आहे.");
            }

            var closedFy = await _context.FinancialYears
                .FirstOrDefaultAsync(fy => fy.IsClosed && req.AccrualDate.Date >= fy.StartDate.Date && req.AccrualDate.Date <= fy.EndDate.Date);
            if (closedFy != null)
            {
                return BadRequest($"अवैध तारीख! निवडलेली व्याज तरतूद तारीख ({req.AccrualDate:dd/MM/yyyy}) ही बंद/ऑडिट झालेल्या आर्थिक वर्षात ({closedFy.YearCode}) मोडते. बंद आर्थिक वर्षात थेट व्हाउचर पोस्ट करणे वैधानिक नियमांनुसार (MCS Act) प्रतिबंधित आहे.");
            }

            var expenseLedger = await ResolveInterestExpenseLedgerAsync(null);
            var payableLedger = await ResolveInterestPayableLedgerAsync(null);

            if (expenseLedger == null || payableLedger == null)
            {
                return BadRequest("व्याज खर्च (Interest Expense) किंवा देय व्याज (Interest Payable) लेजर कॉन्फिगर केलेले नाही.");
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
                        acc.LastInterestPostingDate = req.AccrualDate;
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
                : (member?.Customer != null ? $"{member.Customer.FirstName} {member.Customer.MiddleName} {member.Customer.LastName}".Replace("  ", " ").Trim() : "");

            if (string.IsNullOrWhiteSpace(fullName))
            {
                fullName = customer != null 
                    ? $"{customer.FirstNameEng} {customer.MiddleNameEng} {customer.LastNameEng}".Replace("  ", " ").Trim()
                    : (member?.Customer != null ? $"{member.Customer.FirstNameEng} {member.Customer.MiddleNameEng} {member.Customer.LastNameEng}".Replace("  ", " ").Trim() : "");
            }

            return Ok(new {
                CustomerID = targetCustId,
                MemberID = targetMemId ?? (customer?.CustomerID ?? 0),
                MemberCode = member?.MemberCode ?? (customer?.CIFNo ?? ""),
                CIFNo = customer?.CIFNo ?? member?.Customer?.CIFNo ?? "",
                MemberName = fullName,
                MobileNo = customer?.MobileNo ?? member?.Customer?.MobileNo ?? "",
                Address = customer?.Address ?? member?.Customer?.Address ?? "",
                BranchName = customer?.Branch?.BranchName ?? member?.Branch?.BranchName ?? "",
                TotalFDAccountsCount = accounts.Count,
                TotalPrincipalInvested = accounts.Sum(a => a.DepositAmount),
                TotalMaturityValue = accounts.Sum(a => a.MaturityAmount),
                Accounts = accountLedgerList
            });
        }

        // POST: api/FdAccounts/SyncOpeningBalances
        [HttpPost("SyncOpeningBalances")]
        public async Task<IActionResult> SyncOpeningBalances()
        {
            try
            {
                var result = await SyncFdOpeningBalancesInternalAsync();
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "आर्थिक पत्रक सिंक करताना त्रुटी आली: " + ex.Message });
            }
        }

        private async Task<object> SyncFdOpeningBalancesInternalAsync()
        {
            // 1. Fetch all active legacy FD accounts
            var legacyAccounts = await _context.FdAccounts
                .Include(a => a.FdScheme)
                .Where(a => a.IsLegacyAccount && a.Status == "Active")
                .ToListAsync();

            var schemes = await _context.FdSchemes.ToListAsync();
            var allLedgers = await _context.Ledgers.ToListAsync();
            var allCustObs = await _context.CustomerOpeningBalances.ToListAsync();
            var allMemObs = await _context.MemberOpeningBalances.ToListAsync();
            var allMembers = await _context.Members.Where(m => m.CustomerID.HasValue).ToListAsync();
            var memberByCustId = allMembers.GroupBy(m => m.CustomerID!.Value).ToDictionary(g => g.Key, g => g.First());

            var affectedLedgerIds = new HashSet<int>();
            decimal totalDepositsSynced = 0;
            decimal totalAccruedSynced = 0;

            // Map each scheme to its Liability and Payable Ledgers
            var schemeLiabilityMap = new Dictionary<int, Ledger>();
            var schemePayableMap = new Dictionary<int, Ledger>();

            foreach (var scheme in schemes)
            {
                // Resolve Liability Ledger (मुदत ठेव मुख्य खाते)
                Ledger? liabilityLedger = null;
                if (scheme.FdLiabilityLedgerID.HasValue && scheme.FdLiabilityLedgerID.Value > 0)
                {
                    liabilityLedger = allLedgers.FirstOrDefault(l => l.LedgerID == scheme.FdLiabilityLedgerID.Value);
                }
                if (liabilityLedger == null)
                {
                    liabilityLedger = allLedgers.FirstOrDefault(l =>
                        (l.LedgerName != null && l.LedgerName.Trim() == scheme.SchemeName.Trim()) ||
                        (l.LedgerName != null && (l.LedgerName.Contains("मुदत बंद ठेव") || l.LedgerName.Contains("मुदत ठेव") || l.LedgerName.Contains("दामदुप्पट ठेव"))) ||
                        (l.AccountType == "FD" || l.AccountType == "FixedDeposit"));

                    if (liabilityLedger != null && (!scheme.FdLiabilityLedgerID.HasValue || scheme.FdLiabilityLedgerID == 0))
                    {
                        scheme.FdLiabilityLedgerID = liabilityLedger.LedgerID;
                        _context.Entry(scheme).State = EntityState.Modified;
                    }
                }
                if (liabilityLedger != null)
                {
                    schemeLiabilityMap[scheme.FdSchemeID] = liabilityLedger;
                    affectedLedgerIds.Add(liabilityLedger.LedgerID);
                }

                // Resolve Payable Ledger (मुदत ठेव देणे व्याज खाते)
                Ledger? payableLedger = null;
                if (scheme.InterestPayableLedgerID.HasValue && scheme.InterestPayableLedgerID.Value > 0)
                {
                    payableLedger = allLedgers.FirstOrDefault(l => l.LedgerID == scheme.InterestPayableLedgerID.Value);
                }
                if (payableLedger == null)
                {
                    payableLedger = allLedgers.FirstOrDefault(l =>
                        l.LedgerName != null && (
                            l.LedgerName.Contains("देणे मुदत") ||
                            (l.LedgerName.Contains("देणे") && l.LedgerName.Contains("ठेव") && l.LedgerName.Contains("व्याज")) ||
                            l.LedgerName.Contains("देणे सभासद ठेव व्याज") ||
                            l.LedgerName.Contains("देय व्याज") ||
                            l.LedgerName.ToLower().Contains("interest payable")));

                    if (payableLedger != null && (!scheme.InterestPayableLedgerID.HasValue || scheme.InterestPayableLedgerID == 0))
                    {
                        scheme.InterestPayableLedgerID = payableLedger.LedgerID;
                        _context.Entry(scheme).State = EntityState.Modified;
                    }
                }
                if (payableLedger != null)
                {
                    schemePayableMap[scheme.FdSchemeID] = payableLedger;
                    affectedLedgerIds.Add(payableLedger.LedgerID);
                }
            }

            // Group legacy accounts by resolved Liability Ledger and Customer
            var accountsWithLiabilityLedger = legacyAccounts
                .Where(a => schemeLiabilityMap.ContainsKey(a.FdSchemeID))
                .Select(a => new { Account = a, Ledger = schemeLiabilityMap[a.FdSchemeID] })
                .ToList();

            var liabilityLedgerGroups = accountsWithLiabilityLedger
                .GroupBy(x => x.Ledger.LedgerID)
                .ToList();

            foreach (var lGrp in liabilityLedgerGroups)
            {
                int ledgerId = lGrp.Key;
                var custGroups = lGrp.GroupBy(x => x.Account.CustomerID).ToList();

                foreach (var cGrp in custGroups)
                {
                    int custId = cGrp.Key;
                    decimal custDepositTotal = cGrp.Sum(x => x.Account.DepositAmount);
                    totalDepositsSynced += custDepositTotal;

                    // Sync CustomerOpeningBalances
                    var custOb = allCustObs.FirstOrDefault(c => c.CustomerID == custId && c.LedgerID == ledgerId);
                    if (custOb != null)
                    {
                        custOb.Amount = custDepositTotal;
                        custOb.BalanceType = "Cr";
                        custOb.UpdatedOn = DateTime.Now;
                        _context.Entry(custOb).State = EntityState.Modified;
                    }
                    else if (custDepositTotal > 0)
                    {
                        var newOb = new CustomerOpeningBalance
                        {
                            CustomerID = custId,
                            LedgerID = ledgerId,
                            Amount = custDepositTotal,
                            BalanceType = "Cr",
                            CreatedBy = 1,
                            CreatedOn = DateTime.Now
                        };
                        _context.CustomerOpeningBalances.Add(newOb);
                        allCustObs.Add(newOb);
                    }

                    // Sync MemberOpeningBalances
                    if (memberByCustId.TryGetValue(custId, out var mem))
                    {
                        var memOb = allMemObs.FirstOrDefault(m => m.MemberID == mem.MemberID && m.LedgerID == ledgerId);
                        if (memOb != null)
                        {
                            memOb.Amount = custDepositTotal;
                            memOb.BalanceType = "Cr";
                            memOb.UpdatedOn = DateTime.Now;
                            _context.Entry(memOb).State = EntityState.Modified;
                        }
                        else if (custDepositTotal > 0)
                        {
                            var newMemOb = new MemberOpeningBalance
                            {
                                MemberID = mem.MemberID,
                                CustomerID = custId,
                                LedgerID = ledgerId,
                                Amount = custDepositTotal,
                                BalanceType = "Cr",
                                CreatedBy = 1,
                                CreatedOn = DateTime.Now
                            };
                            _context.MemberOpeningBalances.Add(newMemOb);
                            allMemObs.Add(newMemOb);
                        }
                    }
                }
            }

            // Group legacy accounts with Accrued Interest by resolved Payable Ledger and Customer
            var accountsWithPayableLedger = legacyAccounts
                .Where(a => a.LegacyAccruedInt > 0 && schemePayableMap.ContainsKey(a.FdSchemeID))
                .Select(a => new { Account = a, Ledger = schemePayableMap[a.FdSchemeID] })
                .ToList();

            var payableLedgerGroups = accountsWithPayableLedger
                .GroupBy(x => x.Ledger.LedgerID)
                .ToList();

            foreach (var pGrp in payableLedgerGroups)
            {
                int ledgerId = pGrp.Key;
                var custGroups = pGrp.GroupBy(x => x.Account.CustomerID).ToList();

                foreach (var cGrp in custGroups)
                {
                    int custId = cGrp.Key;
                    decimal custAccruedTotal = cGrp.Sum(x => x.Account.LegacyAccruedInt);
                    totalAccruedSynced += custAccruedTotal;

                    // Sync CustomerOpeningBalances
                    var custOb = allCustObs.FirstOrDefault(c => c.CustomerID == custId && c.LedgerID == ledgerId);
                    if (custOb != null)
                    {
                        custOb.Amount = custAccruedTotal;
                        custOb.BalanceType = "Cr";
                        custOb.UpdatedOn = DateTime.Now;
                        _context.Entry(custOb).State = EntityState.Modified;
                    }
                    else if (custAccruedTotal > 0)
                    {
                        var newOb = new CustomerOpeningBalance
                        {
                            CustomerID = custId,
                            LedgerID = ledgerId,
                            Amount = custAccruedTotal,
                            BalanceType = "Cr",
                            CreatedBy = 1,
                            CreatedOn = DateTime.Now
                        };
                        _context.CustomerOpeningBalances.Add(newOb);
                        allCustObs.Add(newOb);
                    }

                    // Sync MemberOpeningBalances
                    if (memberByCustId.TryGetValue(custId, out var mem))
                    {
                        var memOb = allMemObs.FirstOrDefault(m => m.MemberID == mem.MemberID && m.LedgerID == ledgerId);
                        if (memOb != null)
                        {
                            memOb.Amount = custAccruedTotal;
                            memOb.BalanceType = "Cr";
                            memOb.UpdatedOn = DateTime.Now;
                            _context.Entry(memOb).State = EntityState.Modified;
                        }
                        else if (custAccruedTotal > 0)
                        {
                            var newMemOb = new MemberOpeningBalance
                            {
                                MemberID = mem.MemberID,
                                CustomerID = custId,
                                LedgerID = ledgerId,
                                Amount = custAccruedTotal,
                                BalanceType = "Cr",
                                CreatedBy = 1,
                                CreatedOn = DateTime.Now
                            };
                            _context.MemberOpeningBalances.Add(newMemOb);
                            allMemObs.Add(newMemOb);
                        }
                    }
                }
            }

            // Save all Customer/Member Opening Balances changes
            await _context.SaveChangesAsync();

            // 3. Update Ledgers Opening Balance
            var updatedLedgers = new List<object>();
            foreach (var lId in affectedLedgerIds)
            {
                var ledger = allLedgers.FirstOrDefault(l => l.LedgerID == lId);
                if (ledger == null) continue;

                var custObsForLedger = await _context.CustomerOpeningBalances.Where(b => b.LedgerID == lId).ToListAsync();
                decimal totalDr = custObsForLedger.Where(b => b.BalanceType == "Dr").Sum(b => b.Amount);
                decimal totalCr = custObsForLedger.Where(b => b.BalanceType == "Cr").Sum(b => b.Amount);

                if (totalCr >= totalDr)
                {
                    ledger.OpeningBalance = totalCr - totalDr;
                    ledger.OpeningBalanceType = "Cr";
                }
                else
                {
                    ledger.OpeningBalance = totalDr - totalCr;
                    ledger.OpeningBalanceType = "Dr";
                }

                _context.Entry(ledger).State = EntityState.Modified;
                updatedLedgers.Add(new {
                    ledgerId = ledger.LedgerID,
                    ledgerName = ledger.LedgerName,
                    openingBalance = ledger.OpeningBalance,
                    openingBalanceType = ledger.OpeningBalanceType
                });
            }

            await _context.SaveChangesAsync();

            return new
            {
                success = true,
                message = "मुदत ठेव सुरुवातीची शिल्लक आणि साचलेले जुने व्याज आर्थिक पत्रके (ताळेबंद / तेरीज) सह यशस्वीरीत्या सिंक करण्यात आले आहे.",
                totalLegacyAccounts = legacyAccounts.Count,
                totalDepositsSynced,
                totalAccruedSynced,
                affectedLedgers = updatedLedgers
            };
        }

        private async Task<Ledger?> ResolveFdLiabilityLedgerAsync(FdScheme? scheme)
        {
            if (scheme?.FdLiabilityLedger != null && scheme.FdLiabilityLedger.IsActive)
                return scheme.FdLiabilityLedger;

            if (scheme?.FdLiabilityLedgerID.HasValue == true && scheme.FdLiabilityLedgerID.Value > 0)
            {
                var ledger = await _context.Ledgers.FindAsync(scheme.FdLiabilityLedgerID.Value);
                if (ledger != null && ledger.IsActive) return ledger;
            }

            return await _context.Ledgers.FirstOrDefaultAsync(l => l.IsActive && (
                (l.GroupID == 4 && (l.LedgerName.Contains("मुदतबंद") || l.LedgerName.Contains("मुदत") || l.AccountType == "FD")) ||
                l.LedgerName.Contains("मेंबर मुदतबंद ठेव") ||
                l.LedgerName.Contains("मुदतबंद ठेव") ||
                l.LedgerName.Contains("मुदत ठेव") ||
                l.LedgerName.ToLower().Contains("fixed deposit")
            ));
        }

        private async Task<Ledger?> ResolveInterestPayableLedgerAsync(FdScheme? scheme)
        {
            if (scheme?.InterestPayableLedger != null && scheme.InterestPayableLedger.IsActive)
                return scheme.InterestPayableLedger;

            if (scheme?.InterestPayableLedgerID.HasValue == true && scheme.InterestPayableLedgerID.Value > 0)
            {
                var ledger = await _context.Ledgers.FindAsync(scheme.InterestPayableLedgerID.Value);
                if (ledger != null && ledger.IsActive) return ledger;
            }

            return await _context.Ledgers.FirstOrDefaultAsync(l => l.IsActive && (
                (l.GroupID == 6 && l.LedgerName.Contains("देणे") && l.LedgerName.Contains("व्याज")) ||
                l.LedgerName.Contains("देणे मुदत ठेवीवरील व्याज") ||
                l.LedgerName.Contains("देणे सभासद ठेव व्याज") ||
                l.LedgerName.ToLower().Contains("interest payable")
            ));
        }

        private async Task<Ledger?> ResolveInterestExpenseLedgerAsync(FdScheme? scheme)
        {
            if (scheme?.InterestExpenseLedger != null && scheme.InterestExpenseLedger.IsActive)
                return scheme.InterestExpenseLedger;

            if (scheme?.InterestExpenseLedgerID.HasValue == true && scheme.InterestExpenseLedgerID.Value > 0)
            {
                var ledger = await _context.Ledgers.FindAsync(scheme.InterestExpenseLedgerID.Value);
                if (ledger != null && ledger.IsActive) return ledger;
            }

            return await _context.Ledgers.FirstOrDefaultAsync(l => l.IsActive && (
                (l.GroupID == 17 && !l.LedgerName.Contains("देणे") && (l.LedgerName.Contains("मुदत") || l.LedgerName.Contains("व्याज"))) ||
                l.LedgerName.Contains("मुदत ठेवीवरील व्याज") ||
                l.LedgerName.ToLower().Contains("interest expense")
            ));
        }

        private async Task<Ledger?> ResolveClawbackLedgerAsync(FdScheme? scheme)
        {
            if (scheme?.PrematurePenaltyLedger != null && scheme.PrematurePenaltyLedger.IsActive)
                return scheme.PrematurePenaltyLedger;

            if (scheme?.PrematurePenaltyLedgerID.HasValue == true && scheme.PrematurePenaltyLedgerID.Value > 0)
            {
                var ledger = await _context.Ledgers.FindAsync(scheme.PrematurePenaltyLedgerID.Value);
                if (ledger != null && ledger.IsActive) return ledger;
            }

            return await ResolveInterestExpenseLedgerAsync(scheme);
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
        public DateTime FromDate { get; set; }
        public DateTime? LastInterestPostingDate { get; set; }
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

        // Overdue FD Support
        public bool ApplyOverdueInterest { get; set; } = false;
        public decimal? OverdueInterestRate { get; set; }
        public decimal? OverdueInterestAmount { get; set; }

        // 🛡️ Lien & Loan Recovery Support
        public bool AdjustInLoan { get; set; } = false;
        public int? TargetLoanAccountID { get; set; }
        public decimal? LoanAdjustmentAmount { get; set; }
        public string SurplusPaymentMode { get; set; } = "Cash"; // "Cash", "Bank", "Transfer"
        public int? SurplusSavingAccountID { get; set; }
        public int? SurplusBankLedgerID { get; set; }
        public string? SurplusChequeNo { get; set; }
        public DateTime? SurplusChequeDate { get; set; }
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

        // Flexible Duration Support
        public string? DurationType { get; set; } // "Days", "Months", "Years"
        public int? DurationValue { get; set; }

        // Overdue Renewal Support
        public string RenewalEffectiveFrom { get; set; } = "ClosureDate"; // "ClosureDate" or "MaturityDate"
        public bool ApplyOverdueInterest { get; set; } = false;
        public decimal? OverdueInterestRate { get; set; }
    }
}
