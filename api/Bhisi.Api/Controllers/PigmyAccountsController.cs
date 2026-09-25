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

            foreach (var acc in accounts)
            {
                acc.FormattedAccountNo = LuhnHelper.Format14Digit(acc.AccountNo);
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

            foreach (var acc in accounts)
            {
                acc.FormattedAccountNo = LuhnHelper.Format14Digit(acc.AccountNo);
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
                    InterestRate = scheme.InterestRate,
                    MaturityDate = request.OpeningDate.AddMonths(scheme.DurationMonths > 0 ? scheme.DurationMonths : 12),
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
                    InterestRate = scheme.InterestRate,
                    MaturityDate = request.OpeningDate.AddMonths(scheme.DurationMonths > 0 ? scheme.DurationMonths : 12),
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

            var existing = await _context.PigmyAccounts.FindAsync(id);
            if (existing == null)
            {
                return NotFound(new { message = "पिग्मी खाते सापडले नाही." });
            }

            if (dto.LegacyAccountNumber != null)
            {
                existing.LegacyAccountNumber = string.IsNullOrWhiteSpace(dto.LegacyAccountNumber) ? null : dto.LegacyAccountNumber.Trim();
            }
            if (dto.PigmyAgentID > 0) existing.PigmyAgentID = dto.PigmyAgentID;
            if (dto.PigmySchemeID > 0) existing.PigmySchemeID = dto.PigmySchemeID;
            if (!string.IsNullOrWhiteSpace(dto.Status)) existing.Status = dto.Status;
            existing.TotalDepositedAmount = dto.TotalDepositedAmount;
            if (dto.MaturityDate.HasValue && dto.MaturityDate.Value != default)
            {
                existing.MaturityDate = dto.MaturityDate.Value;
            }

            try
            {
                await _context.SaveChangesAsync();
                return Ok(new { message = "पिग्मी खाते माहिती यशस्वीरीत्या अद्ययावत (Updated) झाली!" });
            }
            catch (Exception ex)
            {
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
                    int remainingCount = await _context.PigmyAccounts
                        .CountAsync(a => a.BranchID == pigmyAccount.BranchID && a.PigmySchemeID == pigmyAccount.PigmySchemeID && a.PigmyAccountID != id);
                    if (remainingCount == 0)
                    {
                        seq.LastSequenceNumber = 0;
                    }
                    seq.UpdatedOn = DateTime.UtcNow;
                    _context.PigmyAccountSequences.Update(seq);
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

                return Ok(new { message = "पिग्मी मॉड्युलमधील योजना, एजंट, खाती आणि सर्व व्यवहारांचा डेटा यशस्वीरीत्या डिलीट झाला आहे!" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "डेटा डिलीट करताना त्रुटी आली: " + ex.Message });
            }
        }
    }
}
