using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Filters;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SavingAccountsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SavingAccountsController(AppDbContext context)
        {
            _context = context;
        }

        private async Task<string> GenerateNextSavingAccountNo(int branchId)
        {
            var branch = await _context.Branches.FindAsync(branchId);
            string branchCode = branch?.BranchCode ?? "01";
            string prefix = $"{branchCode}01";

            var existingNos = await _context.SavingAccountMasters
                .Where(a => a.BranchID == branchId && a.AccountNo != null && a.AccountNo.StartsWith(prefix))
                .Select(a => a.AccountNo!)
                .ToListAsync();

            int maxSeq = 0;
            foreach (var accNo in existingNos)
            {
                if (accNo.Length > prefix.Length && int.TryParse(accNo.Substring(prefix.Length), out int num))
                {
                    if (num > maxSeq) maxSeq = num;
                }
            }

            int nextSeq = maxSeq + 1;
            string nextAccNo = $"{prefix}{nextSeq:D5}";

            while (existingNos.Contains(nextAccNo))
            {
                nextSeq++;
                nextAccNo = $"{prefix}{nextSeq:D5}";
            }

            return nextAccNo;
        }

        // GET: api/SavingAccounts/next-account-no?branchId=1
        [HttpGet("next-account-no")]
        public async Task<ActionResult<object>> GetNextAccountNo([FromQuery] int? branchId = null)
        {
            int targetBranchId = branchId ?? 1;
            string nextNo = await GenerateNextSavingAccountNo(targetBranchId);
            return Ok(new { nextAccountNo = nextNo, accountNo = nextNo });
        }

        // GET: api/SavingAccounts
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetSavingAccountMasters([FromQuery] int? branchId = null, [FromQuery] int? memberId = null, [FromQuery] int? customerId = null)
        {
            var query = _context.SavingAccountMasters.AsQueryable();
            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(s => s.BranchID == branchId.Value);
            }
            if (customerId.HasValue && customerId.Value > 0)
            {
                query = query.Where(s => s.CustomerID == customerId.Value);
            }
            else if (memberId.HasValue && memberId.Value > 0)
            {
                query = query.Where(s => s.MemberID == memberId.Value);
            }

            var accounts = await query
                .Include(s => s.Customer)
                .Include(s => s.Member)
                .Include(s => s.Branch)
                .Include(s => s.Ledger)
                .Include(s => s.JointHolders)
                    .ThenInclude(jh => jh.Member)
                .Select(s => new {
                    s.SavingAccountID,
                    s.BranchID,
                    BranchName = s.Branch != null ? s.Branch.BranchName : "",
                    BranchCode = s.Branch != null ? s.Branch.BranchCode : "",
                    s.AccountNo,
                    s.CustomerID,
                    s.MemberID,
                    CIFNo = s.Customer != null ? s.Customer.CIFNo : (s.Member != null ? s.Member.CIFNo : ""),
                    MemberCode = s.Member != null ? s.Member.MemberCode : "",
                    MemberName = s.Customer != null 
                        ? (s.Customer.FirstName + (string.IsNullOrWhiteSpace(s.Customer.MiddleName) ? "" : " " + s.Customer.MiddleName) + " " + s.Customer.LastName).Trim()
                        : (s.Member != null ? (s.Member.FirstName + (string.IsNullOrWhiteSpace(s.Member.MiddleName) ? "" : " " + s.Member.MiddleName) + " " + s.Member.LastName).Trim() : ""),
                    MemberNameEng = s.Customer != null 
                        ? (s.Customer.FirstNameEng + (string.IsNullOrWhiteSpace(s.Customer.MiddleNameEng) ? "" : " " + s.Customer.MiddleNameEng) + " " + s.Customer.LastNameEng).Trim()
                        : (s.Member != null ? (s.Member.FirstNameEng + (string.IsNullOrWhiteSpace(s.Member.MiddleNameEng) ? "" : " " + s.Member.MiddleNameEng) + " " + s.Member.LastNameEng).Trim() : ""),
                    s.AccountType,
                    s.OpeningDate,
                    s.IsLegacyAccount,
                    s.OldAccountNo,
                    s.LegacyAccountNumber,
                    s.LedgerID,
                    LedgerName = s.Ledger != null ? s.Ledger.LedgerName : "बचत ठेव",
                    s.OpeningBalance,
                    s.CurrentBalance,
                    s.InterestRate,
                    s.MinimumBalance,
                    s.LienAmount,
                    s.LienReason,
                    s.Status,
                    s.NomineeName,
                    s.NomineeRelation,
                    s.NomineeAddress,
                    s.LastInterestPostingDate,
                    s.LastInterestAmount,
                    JointHolders = s.JointHolders.Select(jh => new {
                        jh.JointHolderID,
                        jh.MemberID,
                        MemberName = jh.Member != null ? (jh.Member.FirstName + " " + jh.Member.LastName).Trim() : "",
                        MemberCode = jh.Member != null ? jh.Member.MemberCode : ""
                    }).ToList()
                })
                .ToListAsync();

            return Ok(accounts);
        }

        // GET: api/SavingAccounts/ByMember/5
        [HttpGet("ByMember/{memberId}")]
        public async Task<ActionResult<IEnumerable<object>>> GetSavingAccountsByMember(int memberId)
        {
            return await GetSavingAccountMasters(branchId: null, memberId: memberId);
        }

        // GET: api/SavingAccounts/5
        [HttpGet("{id:int}")]
        public async Task<ActionResult<object>> GetSavingAccountMaster(int id)
        {
            var s = await _context.SavingAccountMasters
                .Include(sa => sa.Customer)
                .Include(sa => sa.Member)
                .Include(sa => sa.Branch)
                .Include(sa => sa.JointHolders)
                    .ThenInclude(jh => jh.Member)
                .FirstOrDefaultAsync(m => m.SavingAccountID == id);

            if (s == null)
            {
                return NotFound();
            }

            return new {
                s.SavingAccountID,
                s.BranchID,
                BranchName = s.Branch != null ? s.Branch.BranchName : "",
                BranchCode = s.Branch != null ? s.Branch.BranchCode : "",
                s.AccountNo,
                s.CustomerID,
                s.MemberID,
                CIFNo = s.Customer != null ? s.Customer.CIFNo : (s.Member != null ? s.Member.CIFNo : ""),
                MemberName = s.Customer != null 
                    ? $"{s.Customer.FirstName} {s.Customer.LastName}".Trim()
                    : (s.Member != null ? $"{s.Member.FirstName} {s.Member.LastName}".Trim() : ""),
                MemberCode = s.Member?.MemberCode ?? "",
                s.AccountType,
                s.OpeningDate,
                s.IsLegacyAccount,
                s.OldAccountNo,
                s.LegacyAccountNumber,
                s.LedgerID,
                LedgerName = s.Ledger?.LedgerName ?? "बचत ठेव",
                s.OpeningBalance,
                s.CurrentBalance,
                s.InterestRate,
                s.MinimumBalance,
                s.LienAmount,
                s.LienReason,
                s.Status,
                s.NomineeName,
                s.NomineeRelation,
                s.NomineeAddress,
                s.LastInterestPostingDate,
                s.LastInterestAmount,
                JointHolders = s.JointHolders.Select(jh => new {
                    jh.JointHolderID,
                    jh.MemberID,
                    MemberName = jh.Member != null ? jh.Member.FirstName + " " + jh.Member.LastName : "",
                    MemberCode = jh.Member != null ? jh.Member.MemberCode : ""
                }).ToList()
            };
        }

        // DTO for creating saving account with joint holders
        public class CreateSavingAccountDto
        {
            public int BranchID { get; set; } = 1;
            public int? CustomerID { get; set; }
            public int? MemberID { get; set; }
            public string AccountType { get; set; } = "Personal";
            public DateTime OpeningDate { get; set; } = DateTime.Today;
            public bool IsLegacyAccount { get; set; } = false;
            public string? OldAccountNo { get; set; }
            public string? LegacyAccountNumber { get; set; }
            public int LedgerID { get; set; }
            public decimal OpeningBalance { get; set; } = 0;
            public decimal InterestRate { get; set; } = 0;
            public decimal MinimumBalance { get; set; } = 500;
            public decimal LienAmount { get; set; } = 0;
            public string? LienReason { get; set; }
            public string Status { get; set; } = "Active";
            public string? NomineeName { get; set; }
            public string? NomineeRelation { get; set; }
            public string? NomineeAddress { get; set; }
            public int? SettingID { get; set; }
            public DateTime? LastInterestPostingDate { get; set; }
            public decimal? LastInterestAmount { get; set; }
            public List<int>? JointHolderMemberIDs { get; set; }
            public List<int>? JointHolderCustomerIDs { get; set; }
        }

        // POST: api/SavingAccounts
        [HttpPost]
        public async Task<ActionResult<object>> PostSavingAccountMaster([FromBody] CreateSavingAccountDto dto)
        {
            var branch = await _context.Branches.FindAsync(dto.BranchID);
            if (branch == null) return BadRequest("निवडलेली शाखा सापडली नाही.");

            int targetLedgerId = dto.LedgerID;
            if (targetLedgerId <= 0 && dto.SettingID.HasValue && dto.SettingID.Value > 0)
            {
                var scheme = await _context.SavingInterestSettings.FindAsync(dto.SettingID.Value);
                if (scheme != null)
                {
                    targetLedgerId = scheme.SavingLiabilityLedgerID ?? scheme.LedgerID ?? 7;
                }
            }
            if (targetLedgerId <= 0) targetLedgerId = 7;

            // Auto-sync interest rate from active SavingInterestSetting if interest rate is not provided
            if (dto.InterestRate <= 0)
            {
                var schemeSetting = await _context.SavingInterestSettings
                    .Where(s => s.SavingLiabilityLedgerID == targetLedgerId || s.LedgerID == targetLedgerId || s.InterestExpenseLedgerID == targetLedgerId)
                    .OrderByDescending(s => s.EffectiveDate)
                    .FirstOrDefaultAsync();

                if (schemeSetting != null && schemeSetting.InterestRate > 0)
                {
                    dto.InterestRate = schemeSetting.InterestRate;
                }
                else
                {
                    dto.InterestRate = 4.0m;
                }
            }

            // Verify Customer & Member existence
            Customer? customer = null;
            Member? member = null;

            if (dto.CustomerID.HasValue && dto.CustomerID.Value > 0)
            {
                customer = await _context.Customers.FindAsync(dto.CustomerID.Value);
                if (customer == null) return BadRequest("निवडलेला खातेदार ग्राहक सिस्टीममध्ये अस्तित्वात नाही.");
                if (customer.Status != "Active") return BadRequest($"या ग्राहकाचे स्टेटस '{customer.Status}' असल्यामुळे नवीन बचत खाते उघडता येत नाही. केवळ सक्रिय (Active) ग्राहकांचेच खाते उघडता येते.");

                member = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == customer.CustomerID);
            }
            else if (dto.MemberID.HasValue && dto.MemberID.Value > 0)
            {
                member = await _context.Members.FindAsync(dto.MemberID.Value);
                if (member == null) return BadRequest("निवडलेला खातेदार सभासद सिस्टीममध्ये अस्तित्वात नाही.");
                if (member.Status != "Active") return BadRequest($"या सभासदाचे स्टेटस '{member.Status}' असल्यामुळे नवीन बचत खाते उघडता येत नाही. केवळ सक्रिय (Active) सभासदांचेच खाते उघडता येते.");

                if (member.CustomerID > 0) customer = await _context.Customers.FindAsync(member.CustomerID);
            }
            else
            {
                return BadRequest("कृपया खातेदाराची (Customer / Member) निवड करा.");
            }

            int? resolvedCustomerId = customer?.CustomerID ?? (member?.CustomerID > 0 ? member.CustomerID : null);
            int? resolvedMemberId = member?.MemberID;

            if (resolvedCustomerId == null || resolvedCustomerId <= 0)
            {
                return BadRequest("कृपया ग्राहकाची निवड करा (Customer ID is required).");
            }

            // Generate account number: [BranchCode]01[5-digit sequence] safely
            string generatedAccountNo = await GenerateNextSavingAccountNo(dto.BranchID);

            var savingAccount = new SavingAccountMaster
            {
                BranchID = dto.BranchID,
                AccountNo = generatedAccountNo,
                CustomerID = resolvedCustomerId.Value,
                MemberID = resolvedMemberId,
                AccountType = dto.AccountType,
                OpeningDate = dto.OpeningDate,
                IsLegacyAccount = dto.IsLegacyAccount,
                OldAccountNo = dto.OldAccountNo ?? dto.LegacyAccountNumber,
                LegacyAccountNumber = dto.OldAccountNo ?? dto.LegacyAccountNumber,
                LedgerID = targetLedgerId,
                OpeningBalance = dto.OpeningBalance,
                CurrentBalance = dto.OpeningBalance,
                InterestRate = dto.InterestRate,
                MinimumBalance = dto.MinimumBalance,
                LienAmount = dto.LienAmount,
                LienReason = dto.LienReason,
                Status = dto.Status,
                NomineeName = dto.NomineeName,
                NomineeRelation = dto.NomineeRelation,
                NomineeAddress = dto.NomineeAddress,
                LastInterestPostingDate = dto.LastInterestPostingDate,
                LastInterestAmount = dto.LastInterestAmount,
                CreatedOn = DateTime.Now
            };

            _context.SavingAccountMasters.Add(savingAccount);
            await _context.SaveChangesAsync();

            // Add Joint Holders with active member validation
            if (dto.AccountType == "Joint" && dto.JointHolderMemberIDs != null && dto.JointHolderMemberIDs.Count > 0)
            {
                var validMemberIds = dto.JointHolderMemberIDs
                    .Where(mId => mId > 0 && mId != dto.MemberID)
                    .Distinct()
                    .ToList();

                if (validMemberIds.Count > 0)
                {
                    var existingMembersCount = await _context.Members
                        .CountAsync(m => validMemberIds.Contains(m.MemberID));

                    if (existingMembersCount != validMemberIds.Count)
                    {
                        return BadRequest(new { message = "निवडलेले काही सह-खातेदार (Joint Holders) सभासद अस्तित्वात नाहीत." });
                    }

                    foreach (var memberId in validMemberIds)
                    {
                        var jointHolder = new SavingAccountJointHolder
                        {
                            SavingAccountID = savingAccount.SavingAccountID,
                            MemberID = memberId,
                            CreatedOn = DateTime.Now
                        };
                        _context.SavingAccountJointHolders.Add(jointHolder);
                    }
                    await _context.SaveChangesAsync();
                }
            }

            // Generate Cash Receipt Voucher and Transaction for standard new Account opening
            if (savingAccount.OpeningBalance > 0 && !savingAccount.IsLegacyAccount)
            {
                // 1. Resolve Cash Ledger
                var cashLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.AccountType == "Cash" || l.LedgerName.Contains("रोख") || l.LedgerName.Contains("Cash in Hand"))
                    ?? await _context.Ledgers.FindAsync(1);

                int cashLedgerId = cashLedger?.LedgerID ?? 1;

                // 2. Generate Receipt Voucher
                var todayStr = DateTime.Now.ToString("yyyyMMdd");
                var lastVoucher = await _context.Vouchers.OrderByDescending(v => v.VoucherID).FirstOrDefaultAsync();
                int nextVchSeq = (lastVoucher?.VoucherID ?? 0) + 1;

                var voucher = new Voucher
                {
                    BranchID = savingAccount.BranchID,
                    VoucherNo = $"VCH-SAV-OPN-{todayStr}-{nextVchSeq:D4}",
                    VoucherDate = savingAccount.OpeningDate,
                    VoucherType = "Receipt",
                    TotalAmount = savingAccount.OpeningBalance,
                    Narration = $"नवीन बचत खाते उघडणे - आरंभिक रोख ठेव जमा (खाते क्र.: {savingAccount.AccountNo})",
                    CreatedBy = savingAccount.CreatedBy,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        new VoucherDetail { LedgerID = cashLedgerId, DrCr = "Dr", Amount = savingAccount.OpeningBalance },
                        new VoucherDetail { LedgerID = savingAccount.LedgerID, DrCr = "Cr", Amount = savingAccount.OpeningBalance }
                    }
                };
                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();

                // 3. Add Saving Transaction linked to Voucher
                var txn = new SavingTransaction
                {
                    SavingAccountID = savingAccount.SavingAccountID,
                    CustomerID = savingAccount.CustomerID,
                    TransactionDate = savingAccount.OpeningDate,
                    TransactionType = "Deposit",
                    PaymentMode = "Cash",
                    Amount = savingAccount.OpeningBalance,
                    BalanceAfterTxn = savingAccount.OpeningBalance,
                    Narration = $"Opening Balance (Voucher: {voucher.VoucherNo})",
                    VoucherNo = voucher.VoucherNo,
                    CreatedBy = savingAccount.CreatedBy,
                    CreatedOn = DateTime.Now
                };
                _context.SavingTransactions.Add(txn);
                await _context.SaveChangesAsync();
            }

            return CreatedAtAction("GetSavingAccountMaster", new { id = savingAccount.SavingAccountID }, new { savingAccount.SavingAccountID, savingAccount.AccountNo });
        }

        // POST: api/SavingAccounts/Migrate
        [HttpPost("Migrate")]
        [MigrationLockFilter]
        public async Task<ActionResult<object>> MigrateSavingAccountMaster([FromBody] CreateSavingAccountDto dto)
        {
            var branch = await _context.Branches.FindAsync(dto.BranchID);
            if (branch == null) return BadRequest("निवडलेली शाखा सापडली नाही.");

            int targetLedgerId = dto.LedgerID;
            if (targetLedgerId <= 0 && dto.SettingID.HasValue && dto.SettingID.Value > 0)
            {
                var scheme = await _context.SavingInterestSettings.FindAsync(dto.SettingID.Value);
                if (scheme != null)
                {
                    targetLedgerId = scheme.SavingLiabilityLedgerID ?? scheme.LedgerID ?? 7;
                }
            }
            if (targetLedgerId <= 0) targetLedgerId = 7;

            var savingAccount = new SavingAccountMaster
            {
                BranchID = dto.BranchID,
                AccountNo = "AUTO", // Replace with logic if needed
                CustomerID = dto.CustomerID ?? dto.MemberID ?? 1,
                MemberID = dto.MemberID,
                AccountType = dto.AccountType,
                OpeningDate = dto.OpeningDate,
                IsLegacyAccount = true,
                OldAccountNo = dto.OldAccountNo ?? dto.LegacyAccountNumber,
                LegacyAccountNumber = dto.OldAccountNo ?? dto.LegacyAccountNumber,
                LedgerID = targetLedgerId,
                OpeningBalance = dto.OpeningBalance,
                CurrentBalance = dto.OpeningBalance,
                InterestRate = dto.InterestRate,
                MinimumBalance = dto.MinimumBalance,
                LienAmount = dto.LienAmount,
                LienReason = dto.LienReason,
                Status = dto.Status,
                NomineeName = dto.NomineeName,
                NomineeRelation = dto.NomineeRelation,
                NomineeAddress = dto.NomineeAddress,
                LastInterestPostingDate = dto.LastInterestPostingDate,
                LastInterestAmount = dto.LastInterestAmount,
                CreatedOn = DateTime.Now
            };

            string generatedAccountNo = await GenerateNextSavingAccountNo(dto.BranchID);
            savingAccount.AccountNo = generatedAccountNo;

            _context.SavingAccountMasters.Add(savingAccount);
            await _context.SaveChangesAsync();

            // Add Joint Holders for Migrated Joint Saving Account
            if (dto.AccountType == "Joint" && dto.JointHolderMemberIDs != null && dto.JointHolderMemberIDs.Count > 0)
            {
                var validMemberIds = dto.JointHolderMemberIDs
                    .Where(mId => mId > 0 && mId != dto.MemberID)
                    .Distinct()
                    .ToList();

                if (validMemberIds.Count > 0)
                {
                    foreach (var memberId in validMemberIds)
                    {
                        var jointHolder = new SavingAccountJointHolder
                        {
                            SavingAccountID = savingAccount.SavingAccountID,
                            MemberID = memberId,
                            CreatedOn = DateTime.Now
                        };
                        _context.SavingAccountJointHolders.Add(jointHolder);
                    }
                    await _context.SaveChangesAsync();
                }
            }

            // Legacy Account Logic
            var ledger = await _context.Ledgers.FindAsync(savingAccount.LedgerID);
            if (ledger != null)
            {
                if (ledger.OpeningBalanceType == "Cr")
                {
                    ledger.OpeningBalance += savingAccount.OpeningBalance;
                }
                else
                {
                    ledger.OpeningBalance -= savingAccount.OpeningBalance;
                    if (ledger.OpeningBalance < 0)
                    {
                        ledger.OpeningBalance = Math.Abs(ledger.OpeningBalance);
                        ledger.OpeningBalanceType = "Cr";
                    }
                }
                _context.Entry(ledger).State = EntityState.Modified;
            }

            var memberOb = new MemberOpeningBalance
            {
                MemberID = savingAccount.MemberID ?? savingAccount.CustomerID,
                LedgerID = savingAccount.LedgerID,
                Amount = savingAccount.OpeningBalance,
                BalanceType = "Cr",
                CreatedBy = savingAccount.CreatedBy,
                CreatedOn = DateTime.Now
            };
            _context.MemberOpeningBalances.Add(memberOb);
            
            var txn = new SavingTransaction
            {
                SavingAccountID = savingAccount.SavingAccountID,
                CustomerID = savingAccount.CustomerID,
                TransactionDate = savingAccount.OpeningDate,
                TransactionType = "Deposit",
                PaymentMode = "Cash",
                Amount = savingAccount.OpeningBalance,
                BalanceAfterTxn = savingAccount.OpeningBalance,
                Narration = "Opening Balance",
                CreatedBy = savingAccount.CreatedBy,
                CreatedOn = DateTime.Now
            };
            _context.SavingTransactions.Add(txn);
            
            await _context.SaveChangesAsync();

            return Ok(new { savingAccount.SavingAccountID, savingAccount.AccountNo });
        }

        // DTO for updating saving account
        public class UpdateSavingAccountDto
        {
            public int SavingAccountID { get; set; }
            public int BranchID { get; set; } = 1;
            public int MemberID { get; set; }
            public string AccountType { get; set; } = "Personal";
            public DateTime OpeningDate { get; set; } = DateTime.Today;
            public decimal OpeningBalance { get; set; } = 0;
            public string? OldAccountNo { get; set; }
            public string? LegacyAccountNumber { get; set; }
            public int LedgerID { get; set; }
            public decimal InterestRate { get; set; } = 0;
            public decimal MinimumBalance { get; set; } = 500;
            public decimal LienAmount { get; set; } = 0;
            public string? LienReason { get; set; }
            public string Status { get; set; } = "Active";
            public string? NomineeName { get; set; }
            public string? NomineeRelation { get; set; }
            public string? NomineeAddress { get; set; }
            public int? SettingID { get; set; }
            public DateTime? LastInterestPostingDate { get; set; }
            public decimal? LastInterestAmount { get; set; }
            public List<int>? JointHolderMemberIDs { get; set; }
        }

        // PUT: api/SavingAccounts/5
        [HttpPut("{id:int}")]
        public async Task<IActionResult> PutSavingAccountMaster(int id, [FromBody] UpdateSavingAccountDto dto)
        {
            if (dto.SavingAccountID <= 0)
            {
                dto.SavingAccountID = id;
            }
            else if (id != dto.SavingAccountID)
            {
                return BadRequest(new { message = "Account ID mismatch" });
            }

            var existing = await _context.SavingAccountMasters
                .Include(s => s.JointHolders)
                .FirstOrDefaultAsync(s => s.SavingAccountID == id);

            if (existing == null)
            {
                return NotFound(new { message = "बचत खाते सापडले नाही." });
            }

            if (existing.IsLegacyAccount && dto.OpeningBalance >= 0)
            {
                decimal oldBalance = existing.OpeningBalance;
                decimal newBalance = dto.OpeningBalance;
                int oldLedgerId = existing.LedgerID;
                int newLedgerId = dto.LedgerID > 0 ? dto.LedgerID : existing.LedgerID;
                if (newLedgerId <= 0 && dto.SettingID.HasValue && dto.SettingID.Value > 0)
                {
                    var scheme = await _context.SavingInterestSettings.FindAsync(dto.SettingID.Value);
                    if (scheme != null)
                    {
                        newLedgerId = scheme.SavingLiabilityLedgerID ?? scheme.LedgerID ?? 7;
                    }
                }
                if (newLedgerId <= 0) newLedgerId = 7;

                if (oldLedgerId == newLedgerId)
                {
                    // Case 1: Same ledger, balance difference adjustment
                    decimal balanceDiff = newBalance - oldBalance;
                    if (balanceDiff != 0)
                    {
                        var ledger = await _context.Ledgers.FindAsync(newLedgerId);
                        if (ledger != null)
                        {
                            if (ledger.OpeningBalanceType == "Cr")
                            {
                                ledger.OpeningBalance += balanceDiff;
                            }
                            else
                            {
                                ledger.OpeningBalance -= balanceDiff;
                                if (ledger.OpeningBalance < 0)
                                {
                                    ledger.OpeningBalance = Math.Abs(ledger.OpeningBalance);
                                    ledger.OpeningBalanceType = "Cr";
                                }
                            }
                            _context.Entry(ledger).State = EntityState.Modified;
                        }
                    }
                }
                else
                {
                    // Case 2: Ledger changed! Reverse from old ledger, add to new ledger
                    if (oldBalance > 0)
                    {
                        var oldLedger = await _context.Ledgers.FindAsync(oldLedgerId);
                        if (oldLedger != null)
                        {
                            if (oldLedger.OpeningBalanceType == "Cr")
                            {
                                oldLedger.OpeningBalance -= oldBalance;
                                if (oldLedger.OpeningBalance < 0)
                                {
                                    oldLedger.OpeningBalance = Math.Abs(oldLedger.OpeningBalance);
                                    oldLedger.OpeningBalanceType = "Dr";
                                }
                            }
                            else
                            {
                                oldLedger.OpeningBalance += oldBalance;
                            }
                            _context.Entry(oldLedger).State = EntityState.Modified;
                        }
                    }

                    if (newBalance > 0)
                    {
                        var newLedger = await _context.Ledgers.FindAsync(newLedgerId);
                        if (newLedger != null)
                        {
                            if (newLedger.OpeningBalanceType == "Cr")
                            {
                                newLedger.OpeningBalance += newBalance;
                            }
                            else
                            {
                                newLedger.OpeningBalance -= newBalance;
                                if (newLedger.OpeningBalance < 0)
                                {
                                    newLedger.OpeningBalance = Math.Abs(newLedger.OpeningBalance);
                                    newLedger.OpeningBalanceType = "Cr";
                                }
                            }
                            _context.Entry(newLedger).State = EntityState.Modified;
                        }
                    }

                    // Update MemberOpeningBalance ledger and amount reference
                    var memberOb = await _context.MemberOpeningBalances.FirstOrDefaultAsync(m => 
                        m.MemberID == existing.MemberID && m.LedgerID == oldLedgerId && m.Amount == oldBalance);
                    if (memberOb != null)
                    {
                        memberOb.LedgerID = newLedgerId;
                        memberOb.Amount = newBalance;
                        _context.Entry(memberOb).State = EntityState.Modified;
                    }
                }

                existing.LedgerID = newLedgerId;
                existing.OpeningBalance = newBalance;
                existing.CurrentBalance = (existing.CurrentBalance - oldBalance) + newBalance;
                existing.OpeningDate = dto.OpeningDate;

                // Update opening balance baseline transaction
                var obTxn = await _context.SavingTransactions.FirstOrDefaultAsync(t => t.SavingAccountID == id && t.Narration == "Opening Balance");
                if (obTxn != null)
                {
                    obTxn.Amount = newBalance;
                    obTxn.BalanceAfterTxn = newBalance;
                    obTxn.TransactionDate = dto.OpeningDate;
                    _context.Entry(obTxn).State = EntityState.Modified;
                }
            }

            existing.MinimumBalance = dto.MinimumBalance;
            existing.InterestRate = dto.InterestRate;
            existing.LienAmount = dto.LienAmount;
            existing.LienReason = dto.LienReason;
            existing.Status = dto.Status;
            existing.NomineeName = dto.NomineeName;
            existing.NomineeRelation = dto.NomineeRelation;
            existing.NomineeAddress = dto.NomineeAddress;
            existing.OldAccountNo = dto.OldAccountNo ?? dto.LegacyAccountNumber;
            existing.LegacyAccountNumber = dto.OldAccountNo ?? dto.LegacyAccountNumber;
            existing.LastInterestPostingDate = dto.LastInterestPostingDate;
            existing.LastInterestAmount = dto.LastInterestAmount;
            existing.UpdatedOn = DateTime.Now;

            // Handle joint holders update
            if (dto.AccountType == "Joint" && dto.JointHolderMemberIDs != null)
            {
                existing.AccountType = "Joint";
                _context.SavingAccountJointHolders.RemoveRange(existing.JointHolders);
                foreach (var memberId in dto.JointHolderMemberIDs)
                {
                    existing.JointHolders.Add(new SavingAccountJointHolder
                    {
                        SavingAccountID = id,
                        MemberID = memberId,
                        CreatedOn = DateTime.Now
                    });
                }
            }
            else
            {
                existing.AccountType = "Personal";
                _context.SavingAccountJointHolders.RemoveRange(existing.JointHolders);
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "बचत खाते यशस्वीरित्या अपडेट केले!" });
        }

        // DELETE: api/SavingAccounts/5
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteSavingAccountMaster(int id)
        {
            var savingAccount = await _context.SavingAccountMasters
                .Include(s => s.JointHolders)
                .FirstOrDefaultAsync(m => m.SavingAccountID == id);

            if (savingAccount == null)
            {
                return NotFound(new { message = "खाते सापडले नाही." });
            }

            // Check if there are transactions other than "Opening Balance"
            var transactions = await _context.SavingTransactions
                .Where(t => t.SavingAccountID == id)
                .ToListAsync();

            if (transactions.Count > 1 || (transactions.Count == 1 && transactions[0].Narration != "Opening Balance"))
            {
                return BadRequest(new { message = "या खात्यावर व्यवहार झालेले आहेत. त्यामुळे खाते डिलीट करता येणार नाही." });
            }

            // If it's a legacy account, reverse the Ledger and reconcile MemberOpeningBalances safely
            if (savingAccount.IsLegacyAccount && savingAccount.OpeningBalance > 0)
            {
                // 1. Adjust General Ledger Opening Balance
                var ledger = await _context.Ledgers.FindAsync(savingAccount.LedgerID);
                if (ledger != null)
                {
                    if (ledger.OpeningBalanceType == "Cr")
                    {
                        ledger.OpeningBalance -= savingAccount.OpeningBalance;
                        if (ledger.OpeningBalance < 0)
                        {
                            ledger.OpeningBalance = Math.Abs(ledger.OpeningBalance);
                            ledger.OpeningBalanceType = "Dr";
                        }
                    }
                    else // Dr
                    {
                        ledger.OpeningBalance += savingAccount.OpeningBalance;
                    }
                    _context.Entry(ledger).State = EntityState.Modified;
                }

                // 2. Safe MemberOpeningBalances Reconciliation
                // Check if the member has other remaining legacy accounts under the same ledger
                var otherLegacyAccounts = await _context.SavingAccountMasters
                    .Where(a => a.SavingAccountID != id && a.MemberID == savingAccount.MemberID && a.LedgerID == savingAccount.LedgerID && a.IsLegacyAccount)
                    .ToListAsync();

                decimal requiredRemainingAmount = otherLegacyAccounts.Sum(a => a.OpeningBalance);

                var memberObs = await _context.MemberOpeningBalances
                    .Where(m => m.MemberID == savingAccount.MemberID && m.LedgerID == savingAccount.LedgerID)
                    .ToListAsync();

                if (requiredRemainingAmount <= 0)
                {
                    // No other legacy accounts exist for this member under this ledger -> Remove all
                    if (memberObs.Any())
                    {
                        _context.MemberOpeningBalances.RemoveRange(memberObs);
                    }
                }
                else
                {
                    // Other legacy accounts still exist -> Reconcile total amount safely without deleting other accounts' balance
                    if (memberObs.Any())
                    {
                        var primaryMob = memberObs.First();
                        primaryMob.Amount = requiredRemainingAmount;
                        _context.Entry(primaryMob).State = EntityState.Modified;

                        if (memberObs.Count > 1)
                        {
                            _context.MemberOpeningBalances.RemoveRange(memberObs.Skip(1));
                        }
                    }
                    else
                    {
                        _context.MemberOpeningBalances.Add(new MemberOpeningBalance
                        {
                            MemberID = savingAccount.MemberID ?? savingAccount.CustomerID,
                            LedgerID = savingAccount.LedgerID,
                            Amount = requiredRemainingAmount,
                            BalanceType = "Cr",
                            CreatedBy = savingAccount.CreatedBy,
                            CreatedOn = DateTime.Now
                        });
                    }
                }
            }

            // Delete Transactions
            if (transactions.Any())
            {
                _context.SavingTransactions.RemoveRange(transactions);
            }

            // Delete Joint Holders
            if (savingAccount.JointHolders != null && savingAccount.JointHolders.Any())
            {
                _context.SavingAccountJointHolders.RemoveRange(savingAccount.JointHolders);
            }

            // Delete the account
            try
            {
                _context.SavingAccountMasters.Remove(savingAccount);
                await _context.SaveChangesAsync();
                return Ok(new { message = "खाते यशस्वीरित्या डिलीट केले." });
            }
            catch (Exception)
            {
                return BadRequest(new { message = "या खात्यावर व्यवहाराच्या किंवा इतर मॉड्यूलमध्ये (उदा. कर्ज/व्हाउचर) नोंदी जोडलेल्या आहेत. त्यामुळे खाते डिलीट करता येणार नाही." });
            }
        }

        private bool SavingAccountMasterExists(int id)
        {
            return _context.SavingAccountMasters.Any(e => e.SavingAccountID == id);
        }
    }
}
