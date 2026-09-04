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
        public int? CustomerID { get; set; }
        public int? MemberID { get; set; }
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

        // GET: api/PigmyAccounts/next-account-no?branchId=1&schemeId=1
        [HttpGet("next-account-no")]
        public async Task<ActionResult<object>> GetNextAccountNo([FromQuery] int branchId = 1, [FromQuery] int schemeId = 1)
        {
            var branch = await _context.Branches.FindAsync(branchId);
            string branchPrefix = branch != null && !string.IsNullOrWhiteSpace(branch.BranchCode)
                ? branch.BranchCode.Trim()
                : $"{branchId:D2}";

            var sequence = await _context.PigmyAccountSequences
                .FirstOrDefaultAsync(s => s.BranchID == branchId);

            int lastSeq = sequence != null ? sequence.LastSequenceNumber : 0;
            if (sequence == null)
            {
                lastSeq = await _context.PigmyAccounts.CountAsync(p => p.BranchID == branchId);
            }

            int nextSeq = lastSeq + 1;
            string accountNo = $"{branchPrefix}-PG-{nextSeq:D5}";

            return Ok(new
            {
                accountNo,
                nextSequence = nextSeq,
                branchID = branchId,
                branchCode = branchPrefix
            });
        }

        // GET: api/PigmyAccounts
        // GET: api/PigmyAccounts?agentId=2&branchId=1&status=Active
        [HttpGet]
        public async Task<ActionResult<IEnumerable<PigmyAccount>>> GetPigmyAccounts(
            [FromQuery] int? agentId,
            [FromQuery] int? branchId,
            [FromQuery] int? memberId,
            [FromQuery] int? customerId,
            [FromQuery] string? status)
        {
            var query = _context.PigmyAccounts
                .Include(p => p.Customer)
                .Include(p => p.Member)
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
            else if (memberId.HasValue && memberId.Value > 0)
            {
                query = query.Where(p => p.MemberID == memberId.Value);
            }

            if (!string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(p => p.Status == status);
            }

            return await query.OrderByDescending(p => p.PigmyAccountID).ToListAsync();
        }

        // GET: api/PigmyAccounts/Agent/{agentId}
        [HttpGet("Agent/{agentId}")]
        public async Task<ActionResult<IEnumerable<object>>> GetAccountsByAgent(int agentId, [FromQuery] string status = "Active")
        {
            var accounts = await _context.PigmyAccounts
                .Include(p => p.Customer)
                .Include(p => p.Member)
                .Include(p => p.PigmyScheme)
                .Where(p => p.PigmyAgentID == agentId && (string.IsNullOrEmpty(status) || p.Status == status))
                .OrderBy(p => p.AccountNo)
                .Select(p => new
                {
                    p.PigmyAccountID,
                    p.AccountNo,
                    p.CustomerID,
                    p.MemberID,
                    CIFNo = p.Customer != null ? p.Customer.CIFNo : (p.Member != null ? p.Member.CIFNo : ""),
                    MemberName = p.Customer != null 
                        ? (p.Customer.FirstName + (string.IsNullOrWhiteSpace(p.Customer.MiddleName) ? "" : " " + p.Customer.MiddleName) + (string.IsNullOrWhiteSpace(p.Customer.LastName) ? "" : " " + p.Customer.LastName)).Trim()
                        : (p.Member != null ? (p.Member.FirstName + (string.IsNullOrWhiteSpace(p.Member.MiddleName) ? "" : " " + p.Member.MiddleName) + (string.IsNullOrWhiteSpace(p.Member.LastName) ? "" : " " + p.Member.LastName)).Trim() : ""),
                    MemberCode = p.Member != null ? p.Member.MemberCode : "",
                    MobileNo = p.Customer != null ? p.Customer.MobileNo : (p.Member != null ? p.Member.MobileNo : ""),
                    Address = p.Customer != null ? p.Customer.Address : (p.Member != null ? p.Member.Address : ""),
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

        // GET: api/PigmyAccounts/Member/{memberId}
        [HttpGet("Member/{memberId}")]
        public async Task<ActionResult<IEnumerable<PigmyAccount>>> GetAccountsByMember(int memberId)
        {
            return await _context.PigmyAccounts
                .Include(p => p.Member)
                .Include(p => p.PigmyScheme)
                .Include(p => p.PigmyAgent)
                .Where(p => p.MemberID == memberId)
                .OrderByDescending(p => p.PigmyAccountID)
                .ToListAsync();
        }

        // GET: api/PigmyAccounts/5
        [HttpGet("{id}")]
        public async Task<ActionResult<PigmyAccount>> GetPigmyAccount(int id)
        {
            var pigmyAccount = await _context.PigmyAccounts
                .Include(p => p.Member)
                .Include(p => p.PigmyScheme)
                .Include(p => p.PigmyAgent)
                .FirstOrDefaultAsync(p => p.PigmyAccountID == id);

            if (pigmyAccount == null)
            {
                return NotFound();
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
                // 1. Resolve Customer and Member
                Customer? customer = null;
                Member? member = null;

                if (request.CustomerID.HasValue && request.CustomerID.Value > 0)
                {
                    customer = await _context.Customers.FindAsync(request.CustomerID.Value);
                    if (customer == null) return BadRequest("निवडलेला ग्राहक सिस्टीममध्ये अस्तित्वात नाही.");
                    if (customer.Status != "Active") return BadRequest($"या ग्राहकाचे स्टेटस '{customer.Status}' असल्यामुळे नवीन पिग्मी खाते उघडता येत नाही. केवळ सक्रिय (Active) ग्राहकांचीच ठेव स्वीकारली जाऊ शकते.");

                    member = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == customer.CustomerID);
                }
                else if (request.MemberID.HasValue && request.MemberID.Value > 0)
                {
                    member = await _context.Members.FindAsync(request.MemberID.Value);
                    if (member == null) return BadRequest("निवडलेला सभासद सिस्टीममध्ये अस्तित्वात नाही.");
                    if (member.Status != "Active") return BadRequest($"या सभासदाचे स्टेटस '{member.Status}' असल्यामुळे नवीन पिग्मी खाते उघडता येत नाही. केवळ सक्रिय (Active) सभासदांचीच ठेव स्वीकारली जाऊ शकते.");

                    if (member.CustomerID > 0)
                    {
                        customer = await _context.Customers.FindAsync(member.CustomerID);
                    }
                }
                else
                {
                    return BadRequest("कृपया खातेदाराची (Customer / Member) निवड करा.");
                }

                int? resolvedCustomerId = customer?.CustomerID ?? (member?.CustomerID > 0 ? member.CustomerID : null);
                int? resolvedMemberId = member?.MemberID;
                string accountHolderName = customer != null
                    ? $"{customer.FirstName} {customer.LastName}".Trim()
                    : (member != null ? $"{member.FirstName} {member.LastName}".Trim() : "Account Holder");

                var scheme = await _context.PigmySchemes.FindAsync(request.PigmySchemeID);
                if (scheme == null || scheme.Status != "Active") return BadRequest("Invalid or inactive Scheme.");

                var agent = await _context.PigmyAgents.FindAsync(request.PigmyAgentID);
                if (agent == null || agent.Status != "Active") return BadRequest("Invalid or inactive Agent.");

                if (request.OpeningDate.Date > DateTime.Now.Date)
                    return BadRequest("Opening date cannot be in the future.");

                // 2. Determine & Validate Account Number
                var branch = await _context.Branches.FindAsync(request.BranchID);
                string branchPrefix = branch != null && !string.IsNullOrWhiteSpace(branch.BranchCode)
                    ? branch.BranchCode.Trim()
                    : $"{request.BranchID:D2}";

                var sequence = await _context.PigmyAccountSequences
                    .FirstOrDefaultAsync(s => s.BranchID == request.BranchID);
                
                if (sequence == null)
                {
                    int existingCount = await _context.PigmyAccounts.CountAsync(p => p.BranchID == request.BranchID);
                    sequence = new PigmyAccountSequence { BranchID = request.BranchID, LastSequenceNumber = existingCount };
                    _context.PigmyAccountSequences.Add(sequence);
                    await _context.SaveChangesAsync();
                }

                string accountNo;
                if (!string.IsNullOrWhiteSpace(request.AccountNo))
                {
                    accountNo = request.AccountNo.Trim();
                    bool exists = await _context.PigmyAccounts.AnyAsync(p => p.AccountNo == accountNo);
                    if (exists)
                    {
                        return BadRequest($"पिग्मी खाते क्रमांक '{accountNo}' आधीच अस्तित्वात आहे. कृपया दुसरा क्रमांक निवडा.");
                    }

                    // If numeric part is greater than current sequence, advance sequence
                    var digitsOnly = new string(accountNo.Where(char.IsDigit).ToArray());
                    if (int.TryParse(digitsOnly, out int customSeq) && customSeq > sequence.LastSequenceNumber)
                    {
                        sequence.LastSequenceNumber = customSeq;
                    }
                }
                else
                {
                    sequence.LastSequenceNumber++;
                    accountNo = $"{branchPrefix}-PG-{sequence.LastSequenceNumber:D5}";

                    while (await _context.PigmyAccounts.AnyAsync(p => p.AccountNo == accountNo))
                    {
                        sequence.LastSequenceNumber++;
                        accountNo = $"{branchPrefix}-PG-{sequence.LastSequenceNumber:D5}";
                    }
                }

                // 3. Create Account
                var pigmyAccount = new PigmyAccount
                {
                    AccountNo = accountNo,
                    CustomerID = resolvedCustomerId,
                    MemberID = resolvedMemberId,
                    BranchID = request.BranchID,
                    PigmySchemeID = request.PigmySchemeID,
                    PigmyAgentID = request.PigmyAgentID,
                    OpeningDate = request.OpeningDate,
                    InterestRate = scheme.InterestRate,
                    MaturityDate = request.OpeningDate.AddMonths(scheme.DurationMonths),
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
                        MemberID = null,
                        DrCr = "Dr",
                        Amount = request.OpeningBalance
                    });

                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = liabilityLedgerId,
                        MemberID = resolvedMemberId,
                        DrCr = "Cr",
                        Amount = request.OpeningBalance
                    });

                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();
                }

                await transaction.CommitAsync();

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
                Customer? customer = null;
                Member? member = null;

                if (request.CustomerID.HasValue && request.CustomerID.Value > 0)
                {
                    customer = await _context.Customers.FindAsync(request.CustomerID.Value);
                    if (customer == null) return BadRequest("Invalid Customer.");
                    member = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == customer.CustomerID);
                }
                else if (request.MemberID.HasValue && request.MemberID.Value > 0)
                {
                    member = await _context.Members.FindAsync(request.MemberID.Value);
                    if (member == null) return BadRequest("Invalid Member.");
                    if (member.CustomerID > 0) customer = await _context.Customers.FindAsync(member.CustomerID);
                }
                else
                {
                    return BadRequest("Invalid Customer or Member.");
                }

                int? resolvedCustomerId = customer?.CustomerID ?? (member?.CustomerID > 0 ? member.CustomerID : null);
                int? resolvedMemberId = member?.MemberID;

                var scheme = await _context.PigmySchemes.FindAsync(request.PigmySchemeID);
                if (scheme == null || scheme.Status != "Active") return BadRequest("Invalid or inactive Scheme.");

                var agent = await _context.PigmyAgents.FindAsync(request.PigmyAgentID);
                if (agent == null || agent.Status != "Active") return BadRequest("Invalid or inactive Agent.");

                var sequence = await _context.PigmyAccountSequences
                    .FirstOrDefaultAsync(s => s.BranchID == request.BranchID);
                
                if (sequence == null)
                {
                    sequence = new PigmyAccountSequence { BranchID = request.BranchID, LastSequenceNumber = 0 };
                    _context.PigmyAccountSequences.Add(sequence);
                    await _context.SaveChangesAsync();
                }

                sequence.LastSequenceNumber++;
                string accountNo = $"{request.BranchID:D2}{request.PigmySchemeID:D2}{sequence.LastSequenceNumber:D5}";

                var pigmyAccount = new PigmyAccount
                {
                    AccountNo = accountNo,
                    CustomerID = resolvedCustomerId,
                    MemberID = resolvedMemberId,
                    BranchID = request.BranchID,
                    PigmySchemeID = request.PigmySchemeID,
                    PigmyAgentID = request.PigmyAgentID,
                    OpeningDate = request.OpeningDate,
                    InterestRate = scheme.InterestRate,
                    MaturityDate = request.OpeningDate.AddMonths(scheme.DurationMonths),
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
                var seq = await _context.PigmyAccountSequences.FirstOrDefaultAsync(s => s.BranchID == pigmyAccount.BranchID);
                if (seq != null)
                {
                    var remainingAccounts = await _context.PigmyAccounts
                        .Where(a => a.BranchID == pigmyAccount.BranchID && a.PigmyAccountID != id)
                        .Select(a => a.AccountNo)
                        .ToListAsync();

                    int maxSeq = 0;
                    foreach (var accNo in remainingAccounts)
                    {
                        if (!string.IsNullOrWhiteSpace(accNo) && accNo.Length >= 5)
                        {
                            var lastDigits = accNo.Substring(accNo.Length - 5);
                            if (int.TryParse(lastDigits, out int parsed))
                            {
                                if (parsed > maxSeq) maxSeq = parsed;
                            }
                        }
                    }
                    seq.LastSequenceNumber = maxSeq;
                    _context.PigmyAccountSequences.Update(seq);
                }

                _context.PigmyAccounts.Remove(pigmyAccount);
                await _context.SaveChangesAsync();
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
