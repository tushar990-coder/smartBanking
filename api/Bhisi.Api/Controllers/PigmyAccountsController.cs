using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Filters;

namespace Bhisi.Api.Controllers
{
    public class PigmyOpenAccountDto
    {
        public string? AccountNo { get; set; }
        public string? LegacyAccountNumber { get; set; }
        public int CustomerID { get; set; }
        public int BranchID { get; set; }
        public int PigmySchemeID { get; set; }
        public int PigmyAgentID { get; set; }
        public DateTime OpeningDate { get; set; }
        public decimal OpeningBalance { get; set; }
        
        // For migration 
        public string? FinancialYear { get; set; }
        public DateTime? AsOfDate { get; set; }
    }

    [Route("api/[controller]")]
    [ApiController]
    public class PigmyAccountsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PigmyAccountsController(AppDbContext context)
        {
            _context = context;
        }

        // Helper class for Modulo-10 Luhn Check Digit calculation and validation
        public static class LuhnHelper
        {
            public static int CalculateCheckDigit(string digits)
            {
                int sum = 0;
                bool alternate = true;
                for (int i = digits.Length - 1; i >= 0; i--)
                {
                    int d = digits[i] - '0';
                    if (alternate)
                    {
                        d *= 2;
                        if (d > 9) d -= 9;
                    }
                    sum += d;
                    alternate = !alternate;
                }
                int mod = sum % 10;
                return (mod == 0) ? 0 : 10 - mod;
            }

            public static bool ValidateAccountNo(string fullAccountNo)
            {
                if (string.IsNullOrWhiteSpace(fullAccountNo)) return false;
                var digitsOnly = new string(fullAccountNo.Where(char.IsDigit).ToArray());
                if (digitsOnly.Length != 14) return false;
                string prefix13 = digitsOnly.Substring(0, 13);
                int expectedCheck = CalculateCheckDigit(prefix13);
                return (digitsOnly[13] - '0') == expectedCheck;
            }

            public static string Format14Digit(string accountNo)
            {
                if (string.IsNullOrWhiteSpace(accountNo)) return "";
                var d = new string(accountNo.Where(char.IsDigit).ToArray());
                if (d.Length == 14)
                {
                    return $"{d.Substring(0, 3)}-{d.Substring(3, 3)}-{d.Substring(6, 7)}-{d.Substring(13, 1)}";
                }
                return accountNo;
            }
        }

        private async Task SyncSequenceWithAccountNoAsync(int branchId, int schemeCodeNum, string accountNo)
        {
            if (string.IsNullOrWhiteSpace(accountNo)) return;
            var digitsOnly = new string(accountNo.Where(char.IsDigit).ToArray());
            if (digitsOnly.Length == 14)
            {
                string seqPart = digitsOnly.Substring(6, 7);
                if (int.TryParse(seqPart, out int sVal) && sVal > 0)
                {
                    var seq = await _context.PigmyAccountSequences
                        .FirstOrDefaultAsync(s => s.BranchID == branchId && s.SchemeCodeNumeric == schemeCodeNum);
                    if (seq != null)
                    {
                        if (sVal > seq.LastSequenceNumber)
                        {
                            seq.LastSequenceNumber = sVal;
                            seq.UpdatedOn = DateTime.UtcNow;
                            await _context.SaveChangesAsync();
                        }
                    }
                    else
                    {
                        _context.PigmyAccountSequences.Add(new PigmyAccountSequence
                        {
                            BranchID = branchId,
                            SchemeCodeNumeric = schemeCodeNum,
                            LastSequenceNumber = sVal,
                            UpdatedOn = DateTime.UtcNow
                        });
                        await _context.SaveChangesAsync();
                    }
                }
            }
        }

        // CBS Standard 14-digit Account Generator: [3-digit Branch] + [3-digit Scheme (301, 302...)] + [7-digit Sequence] + [1-digit Checksum]
        private async Task<string> GenerateNextPigmyAccountNo(int branchId, int? schemeId = null, bool incrementSequence = false)
        {
            var branch = await _context.Branches.FindAsync(branchId);
            
            // 1. Branch Code: 3 numeric digits (e.g. 001, 002)
            string branchCode3 = branchId.ToString("D3");
            if (branch != null && !string.IsNullOrWhiteSpace(branch.BranchCode))
            {
                var digitsOnly = new string(branch.BranchCode.Where(char.IsDigit).ToArray());
                if (!string.IsNullOrEmpty(digitsOnly) && int.TryParse(digitsOnly, out int parsed) && parsed > 0)
                {
                    branchCode3 = parsed.ToString("D3");
                }
            }

            // 2. Scheme Code: 3 numeric digits (e.g. 301, 302)
            int schemeCodeNum = 301;
            if (schemeId.HasValue && schemeId.Value > 0)
            {
                var scheme = await _context.PigmySchemes.FindAsync(schemeId.Value);
                if (scheme != null && !string.IsNullOrWhiteSpace(scheme.SchemeCode))
                {
                    var sDigits = new string(scheme.SchemeCode.Where(char.IsDigit).ToArray());
                    if (!string.IsNullOrEmpty(sDigits) && int.TryParse(sDigits, out int parsedScheme) && parsedScheme > 0)
                    {
                        schemeCodeNum = parsedScheme;
                    }
                }
            }
            string schemeCode3 = schemeCodeNum.ToString("D3");

            // 3. Scan existing PigmyAccounts in this branch for collision prevention and max sequence derivation
            var existingPigmyAccs = await _context.PigmyAccounts
                .Where(p => p.BranchID == branchId && p.AccountNo != null)
                .Select(p => p.AccountNo!)
                .ToListAsync();

            var existingSet = new HashSet<string>(existingPigmyAccs, StringComparer.OrdinalIgnoreCase);

            int maxSeq = 0;
            foreach (var accNo in existingPigmyAccs)
            {
                var d = new string(accNo.Where(char.IsDigit).ToArray());
                if (d.Length == 14)
                {
                    string seqPart = d.Substring(6, 7);
                    if (int.TryParse(seqPart, out int sVal) && sVal > maxSeq)
                    {
                        maxSeq = sVal;
                    }
                }
            }

            // 4. Sequence: Atomic sequence per (BranchID, SchemeCodeNumeric)
            var seq = await _context.PigmyAccountSequences
                .FirstOrDefaultAsync(s => s.BranchID == branchId && s.SchemeCodeNumeric == schemeCodeNum);

            if (seq == null)
            {
                seq = new PigmyAccountSequence
                {
                    BranchID = branchId,
                    SchemeCodeNumeric = schemeCodeNum,
                    LastSequenceNumber = maxSeq,
                    UpdatedOn = DateTime.UtcNow
                };
                _context.PigmyAccountSequences.Add(seq);
                await _context.SaveChangesAsync();
            }
            else if (maxSeq > seq.LastSequenceNumber)
            {
                seq.LastSequenceNumber = maxSeq;
                seq.UpdatedOn = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            int nextSeqNumber = seq.LastSequenceNumber + 1;
            string thirteenDigits = $"{branchCode3}{schemeCode3}{nextSeqNumber:D7}";
            int checkDigit = LuhnHelper.CalculateCheckDigit(thirteenDigits);
            string candidate = $"{thirteenDigits}{checkDigit}";

            while (existingSet.Contains(candidate))
            {
                nextSeqNumber++;
                thirteenDigits = $"{branchCode3}{schemeCode3}{nextSeqNumber:D7}";
                checkDigit = LuhnHelper.CalculateCheckDigit(thirteenDigits);
                candidate = $"{thirteenDigits}{checkDigit}";
            }

            if (incrementSequence)
            {
                seq.LastSequenceNumber = nextSeqNumber;
                seq.UpdatedOn = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            return candidate;
        }

        // GET: api/PigmyAccounts/next-account-no?branchId=1&schemeId=1
        [HttpGet("next-account-no")]
        public async Task<ActionResult<object>> GetNextAccountNo([FromQuery] int branchId = 1, [FromQuery] int schemeId = 1)
        {
            string nextNo = await GenerateNextPigmyAccountNo(branchId, schemeId, incrementSequence: false);
            string formattedNo = LuhnHelper.Format14Digit(nextNo);

            return Ok(new
            {
                accountNo = nextNo,
                nextAccountNo = nextNo,
                formattedAccountNo = formattedNo,
                displayAccountNo = formattedNo,
                branchID = branchId,
                schemeId = schemeId
            });
        }

        // GET: api/PigmyAccounts
        // GET: api/PigmyAccounts?agentId=2&branchId=1&status=Active&sortOrder=asc
        [HttpGet]
        public async Task<ActionResult<IEnumerable<PigmyAccount>>> GetPigmyAccounts(
            [FromQuery] int? agentId,
            [FromQuery] int? branchId,
            [FromQuery] int? customerId,
            [FromQuery] string? status,
            [FromQuery] string? sortOrder = null)
        {
            var query = _context.PigmyAccounts
                .Include(p => p.Customer)
                .Include(p => p.PigmyScheme)
                .Include(p => p.PigmyAgent)
                .AsQueryable();

            if (agentId.HasValue && agentId.Value > 0)
            {
                query = query.Where(p => p.PigmyAgentID == agentId.Value);
            }

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(p => p.BranchID == branchId.Value);
            }

            if (customerId.HasValue && customerId.Value > 0)
            {
                query = query.Where(p => p.CustomerID == customerId.Value);
            }

            if (!string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(p => p.Status == status);
            }

            List<PigmyAccount> accounts;
            if (string.Equals(sortOrder, "asc", StringComparison.OrdinalIgnoreCase))
            {
                accounts = await query.OrderBy(p => p.AccountNo).ThenBy(p => p.PigmyAccountID).ToListAsync();
            }
            else
            {
                accounts = await query.OrderByDescending(p => p.PigmyAccountID).ToListAsync();
            }

            var accountIds = accounts.Select(a => a.PigmyAccountID).ToList();
            var openingBals = await _context.PigmyOpeningBalances
                .Where(o => accountIds.Contains(o.PigmyAccountID))
                .ToListAsync();

            var opBalMap = openingBals
                .GroupBy(o => o.PigmyAccountID)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.PigmyOpeningBalanceID).First());

            foreach (var acc in accounts)
            {
                acc.FormattedAccountNo = LuhnHelper.Format14Digit(acc.AccountNo);
                if (opBalMap.TryGetValue(acc.PigmyAccountID, out var ob))
                {
                    acc.OpeningBalance = ob.MigratedBalanceAmount;
                    acc.FinancialYear = ob.FinancialYear;
                    acc.AsOfDate = ob.AsOfDate;
                }
                else
                {
                    acc.OpeningBalance = acc.TotalDepositedAmount;
                }
            }

            return accounts;
        }

        // GET: api/PigmyAccounts/Agent/{agentId}
        [HttpGet("Agent/{agentId}")]
        public async Task<ActionResult<IEnumerable<object>>> GetAccountsByAgent(int agentId, [FromQuery] string status = "Active")
        {
            var accounts = await _context.PigmyAccounts
                .Include(p => p.Customer)
                .Include(p => p.PigmyScheme)
                .Where(p => p.PigmyAgentID == agentId && (string.IsNullOrEmpty(status) || p.Status == status))
                .OrderBy(p => p.AccountNo)
                .Select(p => new
                {
                    p.PigmyAccountID,
                    p.AccountNo,
                    FormattedAccountNo = LuhnHelper.Format14Digit(p.AccountNo),
                    p.PreviousAccountNo,
                    p.LegacyAccountNumber,
                    p.CustomerID,
                    CIFNo = p.Customer != null ? p.Customer.CIFNo : "",
                    CustomerName = p.Customer != null 
                        ? (p.Customer.FirstName + (string.IsNullOrWhiteSpace(p.Customer.MiddleName) ? "" : " " + p.Customer.MiddleName) + (string.IsNullOrWhiteSpace(p.Customer.LastName) ? "" : " " + p.Customer.LastName)).Trim()
                        : "",
                    MemberName = p.Customer != null 
                        ? (p.Customer.FirstName + (string.IsNullOrWhiteSpace(p.Customer.MiddleName) ? "" : " " + p.Customer.MiddleName) + (string.IsNullOrWhiteSpace(p.Customer.LastName) ? "" : " " + p.Customer.LastName)).Trim()
                        : "",
                    CustomerNo = p.Customer != null ? (p.Customer.CIFNo ?? p.Customer.LegacyCustomerNo ?? "") : "",
                    MobileNo = p.Customer != null ? p.Customer.MobileNo : "",
                    Address = p.Customer != null ? p.Customer.Address : "",
                    SchemeName = p.PigmyScheme != null ? p.PigmyScheme.SchemeName : "",
                    InterestRate = p.InterestRate,
                    CurrentBalance = p.TotalDepositedAmount,
                    TotalDepositedAmount = p.TotalDepositedAmount,
                    OpeningDate = p.OpeningDate.ToString("yyyy-MM-dd"),
                    MaturityDate = p.MaturityDate.ToString("yyyy-MM-dd"),
                    Status = p.Status
                })
                .ToListAsync();

            return Ok(accounts);
        }

        // GET: api/PigmyAccounts/Customer/{customerId}
        [HttpGet("Customer/{customerId}")]
        public async Task<ActionResult<IEnumerable<PigmyAccount>>> GetAccountsByCustomer(int customerId)
        {
            var accounts = await _context.PigmyAccounts
                .Include(p => p.Customer)
                .Include(p => p.PigmyScheme)
                .Include(p => p.PigmyAgent)
                .Where(p => p.CustomerID == customerId)
                .OrderByDescending(p => p.PigmyAccountID)
                .ToListAsync();

            var accountIds = accounts.Select(a => a.PigmyAccountID).ToList();
            var openingBals = await _context.PigmyOpeningBalances
                .Where(o => accountIds.Contains(o.PigmyAccountID))
                .ToListAsync();

            var opBalMap = openingBals
                .GroupBy(o => o.PigmyAccountID)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.PigmyOpeningBalanceID).First());

            foreach (var acc in accounts)
            {
                acc.FormattedAccountNo = LuhnHelper.Format14Digit(acc.AccountNo);
                if (opBalMap.TryGetValue(acc.PigmyAccountID, out var ob))
                {
                    acc.OpeningBalance = ob.MigratedBalanceAmount;
                    acc.FinancialYear = ob.FinancialYear;
                    acc.AsOfDate = ob.AsOfDate;
                }
                else
                {
                    acc.OpeningBalance = acc.TotalDepositedAmount;
                }
            }

            return accounts;
        }

        // GET: api/PigmyAccounts/5
        [HttpGet("{id}")]
        public async Task<ActionResult<PigmyAccount>> GetPigmyAccount(int id)
        {
            var pigmyAccount = await _context.PigmyAccounts
                .Include(p => p.Customer)
                .Include(p => p.PigmyScheme)
                .Include(p => p.PigmyAgent)
                .FirstOrDefaultAsync(p => p.PigmyAccountID == id);

            if (pigmyAccount == null)
            {
                return NotFound();
            }

            pigmyAccount.FormattedAccountNo = LuhnHelper.Format14Digit(pigmyAccount.AccountNo);

            var ob = await _context.PigmyOpeningBalances
                .Where(o => o.PigmyAccountID == id)
                .OrderByDescending(x => x.PigmyOpeningBalanceID)
                .FirstOrDefaultAsync();

            if (ob != null)
            {
                pigmyAccount.OpeningBalance = ob.MigratedBalanceAmount;
                pigmyAccount.FinancialYear = ob.FinancialYear;
                pigmyAccount.AsOfDate = ob.AsOfDate;
            }
            else
            {
                pigmyAccount.OpeningBalance = pigmyAccount.TotalDepositedAmount;
            }

            return pigmyAccount;
        }

        // POST: api/PigmyAccounts OR api/PigmyAccounts/OpenAccount
        [HttpPost]
        [HttpPost("OpenAccount")]
        public async Task<ActionResult<PigmyAccount>> OpenAccount(PigmyOpenAccountDto request)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // 1. Resolve Customer
                if (request.CustomerID <= 0)
                {
                    return BadRequest("कृपया ग्राहकाची (Customer) निवड करा.");
                }

                var customer = await _context.Customers.FindAsync(request.CustomerID);
                if (customer == null) return BadRequest("निवडलेला ग्राहक सिस्टीममध्ये अस्तित्वात नाही.");
                if (customer.Status != "Active") return BadRequest($"या ग्राहकाचे स्टेटस '{customer.Status}' असल्यामुळे नवीन पिग्मी खाते उघडता येत नाही. केवळ सक्रिय (Active) ग्राहकांचीच ठेव स्वीकारली जाऊ शकते.");

                string accountHolderName = $"{customer.FirstName} {customer.LastName}".Trim();

                var scheme = await _context.PigmySchemes.FindAsync(request.PigmySchemeID);
                if (scheme == null || scheme.Status != "Active") return BadRequest("Invalid or inactive Scheme.");

                var agent = await _context.PigmyAgents.FindAsync(request.PigmyAgentID);
                if (agent == null || agent.Status != "Active") return BadRequest("Invalid or inactive Agent.");

                if (request.OpeningDate.Date > DateTime.Now.Date)
                    return BadRequest("Opening date cannot be in the future.");

                // 2. Determine & Validate Account Number
                int schemeCodeNum = 301;
                if (scheme != null && !string.IsNullOrWhiteSpace(scheme.SchemeCode))
                {
                    var sDigits = new string(scheme.SchemeCode.Where(char.IsDigit).ToArray());
                    if (!string.IsNullOrEmpty(sDigits) && int.TryParse(sDigits, out int parsedScheme) && parsedScheme > 0)
                    {
                        schemeCodeNum = parsedScheme;
                    }
                }

                string accountNo;
                if (!string.IsNullOrWhiteSpace(request.AccountNo))
                {
                    accountNo = request.AccountNo.Trim();
                    bool exists = await _context.PigmyAccounts.AnyAsync(p => p.AccountNo == accountNo || p.PreviousAccountNo == accountNo);
                    if (exists)
                    {
                        return BadRequest($"पिग्मी खाते क्रमांक '{accountNo}' आधीच अस्तित्वात आहे. कृपया दुसरा क्रमांक निवडा.");
                    }

                    // Gap Prevention: Disallow skipping sequence numbers ahead of current sequence
                    var digitsOnly = new string(accountNo.Where(char.IsDigit).ToArray());
                    if (digitsOnly.Length == 14)
                    {
                        string seqPart = digitsOnly.Substring(6, 7);
                        if (int.TryParse(seqPart, out int sVal) && sVal > 0)
                        {
                            var currentSeq = await _context.PigmyAccountSequences
                                .FirstOrDefaultAsync(s => s.BranchID == request.BranchID && s.SchemeCodeNumeric == schemeCodeNum);
                            int lastSeq = currentSeq?.LastSequenceNumber ?? 0;
                            if (sVal > lastSeq + 1)
                            {
                                return BadRequest($"अवैध खाते क्रमांक! अनुक्रमांकामध्ये अंतर (Gap) सोडता येत नाही. पुढील अपेक्षित क्रमांक {lastSeq + 1} असायला हवा.");
                            }
                        }
                    }

                    await SyncSequenceWithAccountNoAsync(request.BranchID, schemeCodeNum, accountNo);
                }
                else
                {
                    accountNo = await GenerateNextPigmyAccountNo(request.BranchID, request.PigmySchemeID, incrementSequence: true);
                }

                // 3. Create Account
                var pigmyAccount = new PigmyAccount
                {
                    AccountNo = accountNo,
                    LegacyAccountNumber = string.IsNullOrWhiteSpace(request.LegacyAccountNumber) ? null : request.LegacyAccountNumber.Trim(),
                    CustomerID = customer.CustomerID,
                    BranchID = request.BranchID,
                    PigmySchemeID = request.PigmySchemeID,
                    PigmyAgentID = request.PigmyAgentID,
                    OpeningDate = request.OpeningDate,
                    InterestRate = scheme!.InterestRate,
                    MaturityDate = request.OpeningDate.AddMonths(scheme!.DurationMonths > 0 ? scheme!.DurationMonths : 12),
                    TotalDepositedAmount = request.OpeningBalance,
                    Status = "Active",
                    CreatedDate = DateTime.Now,
                    CreatedBy = 1 // Default
                };

                _context.PigmyAccounts.Add(pigmyAccount);
                await _context.SaveChangesAsync();

                if (request.OpeningBalance > 0)
                {
                    var initialTx = new PigmyTransaction
                    {
                        PigmyAccountID = pigmyAccount.PigmyAccountID,
                        TransactionDate = request.OpeningDate,
                        ValueDate = request.OpeningDate,
                        TransactionType = "DEPOSIT",
                        DrAmount = 0,
                        CrAmount = request.OpeningBalance,
                        BalanceAmount = request.OpeningBalance,
                        Narration = $"Initial Opening Deposit for A/C {pigmyAccount.AccountNo} (प्रारंभिक जमा रक्कम)",
                        MakerId = 1,
                        PostedOn = DateTime.Now
                    };
                    _context.PigmyTransactions.Add(initialTx);

                    // Create GL Accounting Voucher for Opening Deposit
                    int cashLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, request.BranchID, "PIGMY");
                    int liabilityLedgerId = (scheme.PigmyLiabilityLedgerID.HasValue && scheme.PigmyLiabilityLedgerID > 0)
                        ? scheme.PigmyLiabilityLedgerID.Value
                        : (await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("पिग्मी") || l.LedgerName.Contains("Pigmy")))?.LedgerID ?? 2;

                    string uniqueVoucherNo = $"PV-{request.BranchID}-{request.OpeningDate:yyyyMMdd}-OPN-{Guid.NewGuid().ToString("N").Substring(0, 4)}";
                    var voucher = new Voucher
                    {
                        BranchID = request.BranchID,
                        VoucherNo = uniqueVoucherNo,
                        VoucherDate = request.OpeningDate,
                        VoucherType = "Receipt",
                        Status = "Approved",
                        Narration = $"Pigmy Initial Opening Deposit for A/C {pigmyAccount.AccountNo} - {accountHolderName}",
                        TotalAmount = request.OpeningBalance
                    };

                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = cashLedgerId,
                        CustomerID = customer.CustomerID,
                        DrCr = "Dr",
                        Amount = request.OpeningBalance
                    });

                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = liabilityLedgerId,
                        CustomerID = customer.CustomerID,
                        DrCr = "Cr",
                        Amount = request.OpeningBalance
                    });

                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();
                }

                await transaction.CommitAsync();

                pigmyAccount.FormattedAccountNo = LuhnHelper.Format14Digit(pigmyAccount.AccountNo);
                return CreatedAtAction("GetPigmyAccount", new { id = pigmyAccount.PigmyAccountID }, pigmyAccount);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        // POST: api/PigmyAccounts/Migrate
        [HttpPost("Migrate")]
        [MigrationLockFilter]
        public async Task<ActionResult<PigmyAccount>> MigrateAccount(PigmyOpenAccountDto request)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                if (request.CustomerID <= 0)
                {
                    return BadRequest("कृपया ग्राहकाची (Customer) निवड करा.");
                }

                var customer = await _context.Customers.FindAsync(request.CustomerID);
                if (customer == null) return BadRequest("निवडलेला ग्राहक सिस्टीममध्ये अस्तित्वात नाही.");

                var scheme = await _context.PigmySchemes.FindAsync(request.PigmySchemeID);
                if (scheme == null || scheme.Status != "Active") return BadRequest("Invalid or inactive Scheme.");

                var agent = await _context.PigmyAgents.FindAsync(request.PigmyAgentID);
                if (agent == null || agent.Status != "Active") return BadRequest("Invalid or inactive Agent.");

                int schemeCodeNum = 301;
                if (scheme != null && !string.IsNullOrWhiteSpace(scheme.SchemeCode))
                {
                    var sDigits = new string(scheme.SchemeCode.Where(char.IsDigit).ToArray());
                    if (!string.IsNullOrEmpty(sDigits) && int.TryParse(sDigits, out int parsedScheme) && parsedScheme > 0)
                    {
                        schemeCodeNum = parsedScheme;
                    }
                }

                string accountNo;
                if (!string.IsNullOrWhiteSpace(request.AccountNo))
                {
                    accountNo = request.AccountNo.Trim();
                    bool exists = await _context.PigmyAccounts.AnyAsync(p => p.AccountNo == accountNo || p.PreviousAccountNo == accountNo);
                    if (exists)
                    {
                        return BadRequest($"पिग्मी खाते क्रमांक '{accountNo}' आधीच अस्तित्वात आहे. कृपया दुसरा क्रमांक निवडा.");
                    }

                    // Gap Prevention: Disallow skipping sequence numbers ahead of current sequence
                    var digitsOnly = new string(accountNo.Where(char.IsDigit).ToArray());
                    if (digitsOnly.Length == 14)
                    {
                        string seqPart = digitsOnly.Substring(6, 7);
                        if (int.TryParse(seqPart, out int sVal) && sVal > 0)
                        {
                            var currentSeq = await _context.PigmyAccountSequences
                                .FirstOrDefaultAsync(s => s.BranchID == request.BranchID && s.SchemeCodeNumeric == schemeCodeNum);
                            int lastSeq = currentSeq?.LastSequenceNumber ?? 0;
                            if (sVal > lastSeq + 1)
                            {
                                return BadRequest($"अवैध खाते क्रमांक! अनुक्रमांकामध्ये अंतर (Gap) सोडता येत नाही. पुढील अपेक्षित क्रमांक {lastSeq + 1} असायला हवा.");
                            }
                        }
                    }

                    await SyncSequenceWithAccountNoAsync(request.BranchID, schemeCodeNum, accountNo);
                }
                else
                {
                    accountNo = await GenerateNextPigmyAccountNo(request.BranchID, request.PigmySchemeID, incrementSequence: true);
                }

                var pigmyAccount = new PigmyAccount
                {
                    AccountNo = accountNo,
                    LegacyAccountNumber = string.IsNullOrWhiteSpace(request.LegacyAccountNumber) ? null : request.LegacyAccountNumber.Trim(),
                    CustomerID = customer.CustomerID,
                    BranchID = request.BranchID,
                    PigmySchemeID = request.PigmySchemeID,
                    PigmyAgentID = request.PigmyAgentID,
                    OpeningDate = request.OpeningDate,
                    InterestRate = scheme!.InterestRate,
                    MaturityDate = request.OpeningDate.AddMonths(scheme!.DurationMonths > 0 ? scheme!.DurationMonths : 12),
                    TotalDepositedAmount = request.OpeningBalance,
                    Status = "Active",
                    CreatedDate = DateTime.Now,
                    CreatedBy = 1 // Default
                };

                _context.PigmyAccounts.Add(pigmyAccount);
                await _context.SaveChangesAsync();

                if (request.OpeningBalance > 0)
                {
                    DateTime asOfDate = request.AsOfDate ?? request.OpeningDate;

                    var openingBalanceRecord = new PigmyOpeningBalance
                    {
                        PigmyAccountID = pigmyAccount.PigmyAccountID,
                        FinancialYear = request.FinancialYear ?? "Legacy",
                        AsOfDate = asOfDate,
                        MigratedBalanceAmount = request.OpeningBalance,
                        MigrationRemarks = "Migrated from previous software/year",
                        IsPostedToLedger = true,
                        MigratedOn = DateTime.Now,
                        MigratedBy = 1
                    };
                    _context.PigmyOpeningBalances.Add(openingBalanceRecord);

                    var ledgerEntry = new PigmyTransaction
                    {
                        PigmyAccountID = pigmyAccount.PigmyAccountID,
                        TransactionDate = asOfDate,
                        ValueDate = asOfDate,
                        TransactionType = "OPENING_BALANCE",
                        CrAmount = request.OpeningBalance,
                        DrAmount = 0,
                        BalanceAmount = request.OpeningBalance,
                        Narration = $"Account Opening Deposit / Migration (As Of {asOfDate:dd/MM/yyyy})",
                        ReferenceId = "SYS-OP-BAL",
                        PostedOn = DateTime.Now,
                        MakerId = 1
                    };
                    _context.PigmyTransactions.Add(ledgerEntry);
                    await _context.SaveChangesAsync();
                }

                await transaction.CommitAsync();

                // Auto-sync Pigmy Scheme GL Liability Opening Balance with sub-ledger
                await SyncPigmyGlOpeningBalanceAsync(pigmyAccount.PigmySchemeID);

                pigmyAccount.FormattedAccountNo = LuhnHelper.Format14Digit(pigmyAccount.AccountNo);
                return CreatedAtAction("GetPigmyAccount", new { id = pigmyAccount.PigmyAccountID }, pigmyAccount);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        public class PigmyAccountUpdateDto
        {
            public int PigmyAccountID { get; set; }
            public string? LegacyAccountNumber { get; set; }
            public int PigmyAgentID { get; set; }
            public int PigmySchemeID { get; set; }
            public decimal TotalDepositedAmount { get; set; }
            public decimal? OpeningBalance { get; set; }
            public string? FinancialYear { get; set; }
            public DateTime? AsOfDate { get; set; }
            public DateTime? OpeningDate { get; set; }
            public string Status { get; set; } = "Active";
            public DateTime? MaturityDate { get; set; }
        }

        // PUT: api/PigmyAccounts/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutPigmyAccount(int id, [FromBody] PigmyAccountUpdateDto dto)
        {
            if (dto == null)
            {
                return BadRequest(new { message = "अवैध डेटा पॅरामीटर." });
            }

            var existing = await _context.PigmyAccounts
                .Include(p => p.Customer)
                .FirstOrDefaultAsync(p => p.PigmyAccountID == id);

            if (existing == null)
            {
                return NotFound(new { message = "पिग्मी खाते सापडले नाही." });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                if (dto.LegacyAccountNumber != null)
                {
                    existing.LegacyAccountNumber = string.IsNullOrWhiteSpace(dto.LegacyAccountNumber) ? null : dto.LegacyAccountNumber.Trim();
                }
                if (dto.PigmyAgentID > 0) existing.PigmyAgentID = dto.PigmyAgentID;
                if (dto.PigmySchemeID > 0) existing.PigmySchemeID = dto.PigmySchemeID;
                if (!string.IsNullOrWhiteSpace(dto.Status)) existing.Status = dto.Status;
                if (dto.OpeningDate.HasValue && dto.OpeningDate.Value != default)
                {
                    existing.OpeningDate = dto.OpeningDate.Value;
                }
                if (dto.MaturityDate.HasValue && dto.MaturityDate.Value != default)
                {
                    existing.MaturityDate = dto.MaturityDate.Value;
                }

                // Determine target opening balance
                decimal? targetOpeningBal = dto.OpeningBalance;
                if (!targetOpeningBal.HasValue && dto.TotalDepositedAmount != 0)
                {
                    bool hasOpBalRec = await _context.PigmyOpeningBalances.AnyAsync(o => o.PigmyAccountID == id);
                    if (hasOpBalRec)
                    {
                        targetOpeningBal = dto.TotalDepositedAmount;
                    }
                }

                if (targetOpeningBal.HasValue)
                {
                    DateTime effectiveAsOfDate = dto.AsOfDate ?? dto.OpeningDate ?? existing.OpeningDate;
                    string effectiveFinYear = !string.IsNullOrWhiteSpace(dto.FinancialYear) ? dto.FinancialYear : "Legacy";

                    // 1. Sync PigmyOpeningBalances (Audit table)
                    var opBalRecord = await _context.PigmyOpeningBalances
                        .FirstOrDefaultAsync(o => o.PigmyAccountID == id);

                    if (opBalRecord != null)
                    {
                        opBalRecord.MigratedBalanceAmount = targetOpeningBal.Value;
                        if (!string.IsNullOrWhiteSpace(dto.FinancialYear))
                        {
                            opBalRecord.FinancialYear = dto.FinancialYear;
                        }
                        if (dto.AsOfDate.HasValue && dto.AsOfDate.Value != default)
                        {
                            opBalRecord.AsOfDate = dto.AsOfDate.Value;
                        }
                        else if (dto.OpeningDate.HasValue && dto.OpeningDate.Value != default)
                        {
                            opBalRecord.AsOfDate = dto.OpeningDate.Value;
                        }
                        opBalRecord.MigratedOn = DateTime.UtcNow;
                    }
                    else
                    {
                        opBalRecord = new PigmyOpeningBalance
                        {
                            PigmyAccountID = id,
                            FinancialYear = effectiveFinYear,
                            AsOfDate = effectiveAsOfDate,
                            MigratedBalanceAmount = targetOpeningBal.Value,
                            MigrationRemarks = "Migrated from previous software/year (Updated)",
                            IsPostedToLedger = true,
                            MigratedOn = DateTime.UtcNow,
                            MigratedBy = 1
                        };
                        _context.PigmyOpeningBalances.Add(opBalRecord);
                    }

                    // 2. Sync PigmyTransactions (Passbook opening entry)
                    var opTx = await _context.PigmyTransactions
                        .Where(t => t.PigmyAccountID == id)
                        .OrderBy(t => t.TransactionDate)
                        .ThenBy(t => t.PigmyTransactionID)
                        .FirstOrDefaultAsync(t => t.TransactionType == "OPENING_BALANCE" 
                                               || t.ReferenceId == "SYS-OP-BAL"
                                               || (t.TransactionType == "DEPOSIT" && t.Narration.Contains("Initial Opening Deposit")));

                    DateTime txDate = dto.AsOfDate ?? dto.OpeningDate ?? existing.OpeningDate;

                    if (opTx != null)
                    {
                        opTx.CrAmount = targetOpeningBal.Value;
                        opTx.DrAmount = 0;
                        if (dto.AsOfDate.HasValue && dto.AsOfDate.Value != default)
                        {
                            opTx.TransactionDate = dto.AsOfDate.Value;
                            opTx.ValueDate = dto.AsOfDate.Value;
                            opTx.Narration = $"Account Opening Deposit / Migration (As Of {dto.AsOfDate.Value:dd/MM/yyyy})";
                        }
                        else if (dto.OpeningDate.HasValue && dto.OpeningDate.Value != default)
                        {
                            opTx.TransactionDate = dto.OpeningDate.Value;
                            opTx.ValueDate = dto.OpeningDate.Value;
                        }
                    }
                    else
                    {
                        opTx = new PigmyTransaction
                        {
                            PigmyAccountID = id,
                            TransactionDate = txDate,
                            ValueDate = txDate,
                            TransactionType = "OPENING_BALANCE",
                            CrAmount = targetOpeningBal.Value,
                            DrAmount = 0,
                            BalanceAmount = targetOpeningBal.Value,
                            Narration = $"Account Opening Deposit / Migration (As Of {txDate:dd/MM/yyyy})",
                            ReferenceId = "SYS-OP-BAL",
                            PostedOn = DateTime.UtcNow,
                            MakerId = 1
                        };
                        _context.PigmyTransactions.Add(opTx);
                    }

                    // 3. Sync Opening Voucher if existed
                    if (!string.IsNullOrWhiteSpace(existing.AccountNo))
                    {
                        var opVoucher = await _context.Vouchers
                            .Include(v => v.VoucherDetails)
                            .FirstOrDefaultAsync(v => v.Narration != null && v.Narration.Contains($"Pigmy Initial Opening Deposit for A/C {existing.AccountNo}"));
                        if (opVoucher != null)
                        {
                            opVoucher.TotalAmount = targetOpeningBal.Value;
                            foreach (var vd in opVoucher.VoucherDetails)
                            {
                                vd.Amount = targetOpeningBal.Value;
                            }
                        }
                    }

                    await _context.SaveChangesAsync();

                    // 4. Recalculate running balance for all transactions and reconcile TotalDepositedAmount
                    var allTxs = await _context.PigmyTransactions
                        .Where(t => t.PigmyAccountID == id)
                        .OrderBy(t => t.TransactionDate)
                        .ThenBy(t => t.PigmyTransactionID)
                        .ToListAsync();

                    decimal runningBal = 0;
                    foreach (var tx in allTxs)
                    {
                        runningBal += (tx.CrAmount - tx.DrAmount);
                        tx.BalanceAmount = runningBal;
                    }

                    existing.TotalDepositedAmount = runningBal;
                }
                else
                {
                    existing.TotalDepositedAmount = dto.TotalDepositedAmount;
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                // Auto-sync Pigmy Scheme GL Liability Opening Balance with sub-ledger
                await SyncPigmyGlOpeningBalanceAsync(existing.PigmySchemeID);
                if (dto.PigmySchemeID > 0 && dto.PigmySchemeID != existing.PigmySchemeID)
                {
                    await SyncPigmyGlOpeningBalanceAsync(dto.PigmySchemeID);
                }

                return Ok(new { 
                    message = "पिग्मी खाते माहिती, सुरुवातीची शिल्लक आणि व्यवहार यशस्वीरीत्या अद्ययावत (Updated) झाले!",
                    openingBalance = targetOpeningBal ?? existing.TotalDepositedAmount,
                    totalDepositedAmount = existing.TotalDepositedAmount
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "अद्ययावत करताना त्रुटी आली: " + ex.Message });
            }
        }

        // DELETE: api/PigmyAccounts/5?force=false
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePigmyAccount(int id, [FromQuery] bool force = false)
        {
            var pigmyAccount = await _context.PigmyAccounts.FindAsync(id);
            if (pigmyAccount == null)
            {
                return NotFound(new { message = "पिग्मी खाते सापडले नाही." });
            }
            int schemeIdToSync = pigmyAccount.PigmySchemeID;

            var collectionsCount = await _context.PigmyCollections.CountAsync(c => c.PigmyAccountId == id);
            var transactionsCount = await _context.PigmyTransactions.CountAsync(t => t.PigmyAccountID == id);
            var totalRelated = collectionsCount + transactionsCount;

            if (totalRelated > 0 && !force)
            {
                return BadRequest(new { 
                    message = $"या खात्यावर {collectionsCount} पिग्मी कलेक्शन व {transactionsCount} व्यवहारांच्या नोंदी आहेत.",
                    canForce = true
                });
            }

            try
            {
                // Cascade delete associated records to prevent foreign key errors
                var collections = await _context.PigmyCollections.Where(c => c.PigmyAccountId == id).ToListAsync();
                if (collections.Any()) _context.PigmyCollections.RemoveRange(collections);

                var transactions = await _context.PigmyTransactions.Where(t => t.PigmyAccountID == id).ToListAsync();
                if (transactions.Any()) _context.PigmyTransactions.RemoveRange(transactions);

                var openingBalances = await _context.PigmyOpeningBalances.Where(o => o.PigmyAccountID == id).ToListAsync();
                if (openingBalances.Any()) _context.PigmyOpeningBalances.RemoveRange(openingBalances);

                var interestLogs = await _context.PigmyInterestLogs.Where(i => i.PigmyAccountId == id).ToListAsync();
                if (interestLogs.Any()) _context.PigmyInterestLogs.RemoveRange(interestLogs);

                var scheme = await _context.PigmySchemes.FindAsync(pigmyAccount.PigmySchemeID);
                int schemeCodeNum = 301;
                if (scheme != null && !string.IsNullOrWhiteSpace(scheme.SchemeCode))
                {
                    var sDigits = new string(scheme.SchemeCode.Where(char.IsDigit).ToArray());
                    if (int.TryParse(sDigits, out int parsedScheme) && parsedScheme > 0)
                        schemeCodeNum = parsedScheme;
                }

                var seq = await _context.PigmyAccountSequences.FirstOrDefaultAsync(s => s.BranchID == pigmyAccount.BranchID && s.SchemeCodeNumeric == schemeCodeNum);
                if (seq != null)
                {
                    // Remove the current account and save
                    _context.PigmyAccounts.Remove(pigmyAccount);
                    await _context.SaveChangesAsync();

                    // Recalculate true max sequence from remaining accounts
                    var existingAccs = await _context.PigmyAccounts
                        .Where(a => a.BranchID == pigmyAccount.BranchID && a.PigmySchemeID == pigmyAccount.PigmySchemeID && a.AccountNo != null)
                        .Select(a => a.AccountNo)
                        .ToListAsync();

                    int maxSeq = 0;
                    foreach (var accNo in existingAccs)
                    {
                        var d = new string(accNo!.Where(char.IsDigit).ToArray());
                        if (d.Length == 14)
                        {
                            string seqPart = d.Substring(6, 7);
                            if (int.TryParse(seqPart, out int sVal) && sVal > maxSeq)
                            {
                                maxSeq = sVal;
                            }
                        }
                    }

                    seq.LastSequenceNumber = maxSeq;
                    seq.UpdatedOn = DateTime.UtcNow;
                    _context.PigmyAccountSequences.Update(seq);
                    await _context.SaveChangesAsync();
                    
                    await SyncPigmyGlOpeningBalanceAsync(schemeIdToSync);
                    return Ok(new { message = "पिग्मी खाते यशस्वीरीत्या हटवले!" });
                }

                _context.PigmyAccounts.Remove(pigmyAccount);
                await _context.SaveChangesAsync();

                // If the deleted record was the highest/only PigmyAccountID, automatically decrement/reseed identity counter
                try
                {
                    var maxRemainingId = await _context.PigmyAccounts.MaxAsync(p => (int?)p.PigmyAccountID) ?? 0;
                    if (id >= maxRemainingId)
                    {
                        int reseedVal = maxRemainingId;
                        await _context.Database.ExecuteSqlInterpolatedAsync($"DBCC CHECKIDENT ('PigmyAccounts', RESEED, {reseedVal});");
                    }
                }
                catch (Exception reseedEx)
                {
                    Console.WriteLine($"[WARNING] PigmyAccount reseed error: {reseedEx.Message}");
                }
                await SyncPigmyGlOpeningBalanceAsync(schemeIdToSync);
                return Ok(new { message = "पिग्मी खाते यशस्वीरीत्या डिलीट झाले." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "खाते डिलीट करताना त्रुटी आली: " + ex.Message });
            }
        }

        // POST: api/PigmyAccounts/ClearAllPigmyData
        [HttpPost("ClearAllPigmyData")]
        public async Task<IActionResult> ClearAllPigmyData()
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                _context.PigmyCollections.RemoveRange(_context.PigmyCollections);
                _context.PigmyTransactions.RemoveRange(_context.PigmyTransactions);
                _context.PigmyInterestLogs.RemoveRange(_context.PigmyInterestLogs);
                _context.PigmyOpeningBalances.RemoveRange(_context.PigmyOpeningBalances);
                _context.PigmyAgentCommissions.RemoveRange(_context.PigmyAgentCommissions);
                _context.PigmyAgentCashDeposits.RemoveRange(_context.PigmyAgentCashDeposits);
                _context.PigmyAccounts.RemoveRange(_context.PigmyAccounts);
                _context.PigmyAccountSequences.RemoveRange(_context.PigmyAccountSequences);
                _context.PigmyAgents.RemoveRange(_context.PigmyAgents);
                _context.PigmySchemes.RemoveRange(_context.PigmySchemes);
                _context.PigmyCommissionSettings.RemoveRange(_context.PigmyCommissionSettings);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                // Reset all Pigmy Liability Ledgers OpeningBalance to 0
                var pigmyLedgers = await _context.Ledgers
                    .Where(l => l.LedgerName.Contains("पिग्मी") || l.LedgerName.Contains("Pigmy"))
                    .ToListAsync();
                foreach (var l in pigmyLedgers)
                {
                    l.OpeningBalance = 0;
                    l.OpeningBalanceType = "Cr";
                }
                await _context.SaveChangesAsync();

                return Ok(new { message = "पिग्मी मॉड्युलमधील योजना, एजंट, खाती आणि सर्व व्यवहारांचा डेटा यशस्वीरीत्या डिलीट झाला आहे!" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "डेटा डिलीट करताना त्रुटी आली: " + ex.Message });
            }
        }

        // ==========================================
        // PIGMY REAL-TIME GL RECONCILIATION & AUTO-SYNC
        // ==========================================

        // POST/GET: api/PigmyAccounts/SyncAllGlOpeningBalances
        [HttpPost("SyncAllGlOpeningBalances")]
        [HttpGet("SyncAllGlOpeningBalances")]
        public async Task<IActionResult> SyncAllGlOpeningBalances()
        {
            try
            {
                var schemes = await _context.PigmySchemes.ToListAsync();
                int syncedCount = 0;
                foreach (var scheme in schemes)
                {
                    await SyncPigmyGlOpeningBalanceAsync(scheme.PigmySchemeID);
                    syncedCount++;
                }
                return Ok(new { message = $"सर्व पिग्मी योजनांची मुख्य खतावणी (GL) आरंभिक शिल्लक तेरीज व ताळेबंदशी यशस्वीरित्या सिंक झाली आहे. (एकूण {syncedCount} योजना अद्यतनित)", syncedCount });
            }
            catch (Exception ex)
            {
                return StatusCode(500, "पिग्मी खतावणी सिंक करताना त्रुटी आली: " + ex.Message);
            }
        }

        // GET: api/PigmyAccounts/GlReconciliation?branchId=1
        [HttpGet("GlReconciliation")]
        public async Task<ActionResult<PigmyGlReconciliationResponseDto>> GetGlReconciliation([FromQuery] int branchId = 1)
        {
            var schemes = await _context.PigmySchemes.ToListAsync();
            var response = new PigmyGlReconciliationResponseDto();

            decimal grandTotalGl = 0;
            decimal grandTotalSl = 0;
            int grandTotalAccounts = 0;

            foreach (var scheme in schemes)
            {
                var item = new PigmyGlReconciliationDto
                {
                    BranchID = branchId,
                    PigmySchemeID = scheme.PigmySchemeID,
                    SchemeName = scheme.SchemeName,
                    SchemeCode = scheme.SchemeCode ?? scheme.PigmySchemeID.ToString("D3"),
                    PigmyLiabilityLedgerID = scheme.PigmyLiabilityLedgerID
                };

                Ledger? ledger = null;
                if (scheme.PigmyLiabilityLedgerID.HasValue && scheme.PigmyLiabilityLedgerID.Value > 0)
                {
                    ledger = await _context.Ledgers.FindAsync(scheme.PigmyLiabilityLedgerID.Value);
                }
                else
                {
                    ledger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("पिग्मी") || l.LedgerName.Contains("Pigmy"));
                }

                var processedLedgers = new HashSet<int>();

                if (ledger != null)
                {
                    item.PigmyLiabilityLedgerID = ledger.LedgerID;
                    item.PigmyLiabilityLedgerName = ledger.LedgerName;
                    item.GlLiabilityOpeningBalance = ledger.OpeningBalance;
                    item.GlOpeningBalanceType = ledger.OpeningBalanceType ?? "Cr";
                }
                else
                {
                    item.PigmyLiabilityLedgerName = "(खतावणी लिंक नाही)";
                    item.Status = "NoLedger";
                    item.StatusMessage = "योजनेला मुख्य खतावणी लिंक केलेली नाही.";
                }

                var accounts = await _context.PigmyAccounts
                    .Where(a => a.PigmySchemeID == scheme.PigmySchemeID && (branchId <= 0 || a.BranchID == branchId) && a.Status == "Active")
                    .Select(a => a.PigmyAccountID)
                    .ToListAsync();

                item.TotalAccountsCount = accounts.Count;

                decimal totalSl = 0;
                if (accounts.Any())
                {
                    totalSl = await _context.PigmyOpeningBalances
                        .Where(o => accounts.Contains(o.PigmyAccountID))
                        .GroupBy(o => o.PigmyAccountID)
                        .Select(g => g.OrderByDescending(x => x.PigmyOpeningBalanceID).Select(x => x.MigratedBalanceAmount).FirstOrDefault())
                        .SumAsync();
                }

                item.SlTotalMigratedBalance = totalSl;

                if (ledger != null)
                {
                    var mappedSchemeIds = await _context.PigmySchemes
                        .Where(s => s.PigmyLiabilityLedgerID == ledger.LedgerID)
                        .Select(s => s.PigmySchemeID)
                        .ToListAsync();

                    if (!mappedSchemeIds.Contains(scheme.PigmySchemeID))
                    {
                        mappedSchemeIds.Add(scheme.PigmySchemeID);
                    }

                    var allAccountsUnderLedger = await _context.PigmyAccounts
                        .Where(a => mappedSchemeIds.Contains(a.PigmySchemeID) && (branchId <= 0 || a.BranchID == branchId) && a.Status == "Active")
                        .Select(a => a.PigmyAccountID)
                        .ToListAsync();

                    decimal totalSlForLedger = 0;
                    if (allAccountsUnderLedger.Any())
                    {
                        totalSlForLedger = await _context.PigmyOpeningBalances
                            .Where(o => allAccountsUnderLedger.Contains(o.PigmyAccountID))
                            .GroupBy(o => o.PigmyAccountID)
                            .Select(g => g.OrderByDescending(x => x.PigmyOpeningBalanceID).Select(x => x.MigratedBalanceAmount).FirstOrDefault())
                            .SumAsync();
                    }

                    item.Difference = item.GlLiabilityOpeningBalance - totalSlForLedger;

                    if (item.Difference == 0)
                    {
                        item.Status = "Reconciled";
                        item.StatusMessage = mappedSchemeIds.Count > 1 
                            ? $"मुख्य खतावणी आणि सर्व संलग्न उप-खाती पूर्णतः जुळली आहेत. (एकत्रित शिल्लक: ₹{totalSlForLedger:N2})"
                            : "मुख्य खतावणी व उप-खाती पूर्णतः जुळलेली आहेत.";
                    }
                    else
                    {
                        item.Status = "Difference";
                        item.StatusMessage = $"तफावत: ₹{Math.Abs(item.Difference):N2} (GL: ₹{item.GlLiabilityOpeningBalance:N2}, उप-खाते: ₹{totalSlForLedger:N2})";
                    }
                }

                response.Schemes.Add(item);
                grandTotalSl += item.SlTotalMigratedBalance;
                grandTotalAccounts += item.TotalAccountsCount;
            }

            var uniqueLiabilityLedgerIds = schemes
                .Where(s => s.PigmyLiabilityLedgerID.HasValue && s.PigmyLiabilityLedgerID.Value > 0)
                .Select(s => s.PigmyLiabilityLedgerID!.Value)
                .Distinct()
                .ToList();

            if (uniqueLiabilityLedgerIds.Any())
            {
                grandTotalGl = await _context.Ledgers
                    .Where(l => uniqueLiabilityLedgerIds.Contains(l.LedgerID))
                    .SumAsync(l => l.OpeningBalance);
            }
            else
            {
                grandTotalGl = await _context.Ledgers
                    .Where(l => l.LedgerName.Contains("पिग्मी") || l.LedgerName.Contains("Pigmy"))
                    .SumAsync(l => l.OpeningBalance);
            }

            response.Summary = new PigmyGlReconciliationDto
            {
                SchemeName = "सर्व पिग्मी योजना (एकूण बेरीज)",
                GlLiabilityOpeningBalance = grandTotalGl,
                SlTotalMigratedBalance = grandTotalSl,
                TotalAccountsCount = grandTotalAccounts,
                Difference = grandTotalGl - grandTotalSl,
                Status = (grandTotalGl - grandTotalSl) == 0 ? "Reconciled" : "Difference",
                StatusMessage = (grandTotalGl - grandTotalSl) == 0 
                    ? "सर्व योजनांचा मुख्य खतावणी आणि ताळेबंद ताळमेळ १००% अचूक आहे." 
                    : $"एकूण तफावत: ₹{Math.Abs(grandTotalGl - grandTotalSl):N2}"
            };

            return Ok(response);
        }

        private async Task SyncPigmyGlOpeningBalanceAsync(int schemeId)
        {
            try
            {
                var scheme = await _context.PigmySchemes.FindAsync(schemeId);
                if (scheme == null) return;

                int liabilityLedgerId = 0;
                if (scheme.PigmyLiabilityLedgerID.HasValue && scheme.PigmyLiabilityLedgerID.Value > 0)
                {
                    liabilityLedgerId = scheme.PigmyLiabilityLedgerID.Value;
                }
                else
                {
                    var fallback = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("पिग्मी") || l.LedgerName.Contains("Pigmy"));
                    if (fallback != null)
                    {
                        liabilityLedgerId = fallback.LedgerID;
                        scheme.PigmyLiabilityLedgerID = liabilityLedgerId;
                        await _context.SaveChangesAsync();
                    }
                }

                if (liabilityLedgerId <= 0) return;

                var ledger = await _context.Ledgers.FindAsync(liabilityLedgerId);
                if (ledger == null) return;

                var mappedSchemeIds = await _context.PigmySchemes
                    .Where(s => s.PigmyLiabilityLedgerID == liabilityLedgerId)
                    .Select(s => s.PigmySchemeID)
                    .ToListAsync();

                if (!mappedSchemeIds.Contains(schemeId))
                {
                    mappedSchemeIds.Add(schemeId);
                }

                var accounts = await _context.PigmyAccounts
                    .Where(a => mappedSchemeIds.Contains(a.PigmySchemeID) && a.Status == "Active")
                    .Select(a => a.PigmyAccountID)
                    .ToListAsync();

                decimal totalOpeningCr = 0;
                if (accounts.Any())
                {
                    totalOpeningCr = await _context.PigmyOpeningBalances
                        .Where(o => accounts.Contains(o.PigmyAccountID))
                        .GroupBy(o => o.PigmyAccountID)
                        .Select(g => g.OrderByDescending(x => x.PigmyOpeningBalanceID).Select(x => x.MigratedBalanceAmount).FirstOrDefault())
                        .SumAsync();
                }

                ledger.OpeningBalance = totalOpeningCr;
                ledger.OpeningBalanceType = "Cr";
                _context.Entry(ledger).State = EntityState.Modified;
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WARNING] SyncPigmyGlOpeningBalanceAsync error for Scheme {schemeId}: {ex.Message}");
            }
        }
    }

    public class PigmyGlReconciliationDto
    {
        public int BranchID { get; set; } = 1;
        public int PigmySchemeID { get; set; }
        public string SchemeName { get; set; } = string.Empty;
        public string SchemeCode { get; set; } = string.Empty;
        public int? PigmyLiabilityLedgerID { get; set; }
        public string PigmyLiabilityLedgerName { get; set; } = string.Empty;
        public decimal GlLiabilityOpeningBalance { get; set; }
        public string GlOpeningBalanceType { get; set; } = "Cr";
        public decimal SlTotalMigratedBalance { get; set; }
        public int TotalAccountsCount { get; set; }
        public decimal Difference { get; set; } // GL - SL
        public string Status { get; set; } = "Pending"; // "Reconciled", "Difference", "NoLedger"
        public string StatusMessage { get; set; } = string.Empty;
    }

    public class PigmyGlReconciliationResponseDto
    {
        public PigmyGlReconciliationDto Summary { get; set; } = new();
        public List<PigmyGlReconciliationDto> Schemes { get; set; } = new();
    }
}
