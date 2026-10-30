using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Helpers;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RdAccountsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public RdAccountsController(AppDbContext context)
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

        // CBS Standard 14-digit Account Generator: [3-digit Branch] + [3-digit Scheme] + [7-digit Sequence] + [1-digit Checksum]
        private async Task<string> GenerateNextRdAccountNo(int branchId, int? schemeId = null, bool incrementSequence = false)
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

            // 2. Scheme Code: 3 numeric digits (default 501 for RD)
            int schemeCodeNum = 501;
            if (schemeId.HasValue && schemeId.Value > 0)
            {
                var scheme = await _context.RdSchemes.FindAsync(schemeId.Value);
                if (scheme != null)
                {
                    if (scheme.SchemeCodeNumeric > 0)
                    {
                        schemeCodeNum = scheme.SchemeCodeNumeric;
                    }
                    else if (!string.IsNullOrWhiteSpace(scheme.SchemeCode))
                    {
                        var sDigits = new string(scheme.SchemeCode.Where(char.IsDigit).ToArray());
                        if (!string.IsNullOrEmpty(sDigits) && int.TryParse(sDigits, out int parsedScheme) && parsedScheme > 0)
                        {
                            schemeCodeNum = parsedScheme;
                        }
                    }
                }
            }
            string schemeCode3 = schemeCodeNum.ToString("D3");

            // 3. Sequence: Atomic sequence per (BranchID, SchemeCodeNumeric / ProductType)
            // Inspect existing accounts to find the maximum assigned sequence number in this branch
            int maxExistingSeq = 0;
            var existingAccNos = await _context.RdAccounts
                .Where(s => s.BranchID == branchId)
                .Select(s => s.AccountNo)
                .ToListAsync();

            foreach (var accNo in existingAccNos)
            {
                if (string.IsNullOrWhiteSpace(accNo)) continue;
                var digits = new string(accNo.Where(char.IsDigit).ToArray());
                if (digits.Length == 14)
                {
                    // [Branch:3][Scheme:3][Seq:7][Luhn:1]
                    if (int.TryParse(digits.Substring(6, 7), out int parsedSeq) && parsedSeq > maxExistingSeq)
                    {
                        maxExistingSeq = parsedSeq;
                    }
                }
            }

            var seq = await _context.RdAccountSequences
                .FirstOrDefaultAsync(s => s.BranchID == branchId && (s.SchemeCodeNumeric == schemeCodeNum || s.ProductType == "RD"));

            if (seq == null)
            {
                int initialVal = Math.Max(existingAccNos.Count, maxExistingSeq);
                seq = new RdAccountSequence
                {
                    BranchID = branchId,
                    ProductType = "RD",
                    CurrentValue = initialVal,
                    SchemeCodeNumeric = schemeCodeNum,
                    LastSequenceNumber = initialVal,
                    UpdatedOn = DateTime.UtcNow
                };
                _context.RdAccountSequences.Add(seq);
                await _context.SaveChangesAsync();
            }
            else
            {
                // Self-healing / Auto-sync with actual remaining accounts in database:
                if (seq.CurrentValue != maxExistingSeq || seq.LastSequenceNumber != maxExistingSeq)
                {
                    seq.CurrentValue = maxExistingSeq;
                    seq.LastSequenceNumber = maxExistingSeq;
                    seq.UpdatedOn = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }
                if (seq.SchemeCodeNumeric == 0)
                {
                    seq.SchemeCodeNumeric = schemeCodeNum;
                }
            }

            int currentVal = Math.Max(seq.CurrentValue, seq.LastSequenceNumber);
            int nextSeqNumber = currentVal + 1;
            if (incrementSequence)
            {
                seq.CurrentValue = nextSeqNumber;
                seq.LastSequenceNumber = nextSeqNumber;
                seq.UpdatedOn = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            string thirteenDigits = $"{branchCode3}{schemeCode3}{nextSeqNumber:D7}";
            int checkDigit = LuhnHelper.CalculateCheckDigit(thirteenDigits);
            return $"{thirteenDigits}{checkDigit}";
        }

        // GET: api/RdAccounts/next-account-no?branchId=1&schemeId=1
        [AllowAnonymous]
        [HttpGet("next-account-no")]
        [HttpGet("next-account-no/{branchId:int?}")]
        public async Task<ActionResult<object>> GetNextAccountNo(
            int? branchId = null,
            [FromQuery(Name = "branchId")] int? queryBranchId = null,
            [FromQuery(Name = "schemeId")] int? schemeId = null)
        {
            int targetBranchId = branchId ?? queryBranchId ?? 1;
            string nextNo = await GenerateNextRdAccountNo(targetBranchId, schemeId, incrementSequence: false);
            string formattedNo = LuhnHelper.Format14Digit(nextNo);
            return Ok(new
            {
                nextAccountNo = nextNo,
                accountNo = nextNo,
                formattedAccountNo = formattedNo,
                displayAccountNo = formattedNo,
                debugDb = _context.Database.GetDbConnection().Database,
                debugServer = _context.Database.GetDbConnection().DataSource
            });
        }

        // GET: api/RdAccounts
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetRdAccounts([FromQuery] int? branchId, [FromQuery] int? customerId = null, [FromQuery] int? memberId = null, [FromQuery] int? schemeId = null)
        {
            var query = _context.RdAccounts
                .AsNoTracking()
                .Include(r => r.Customer)
                    .ThenInclude(c => c!.MemberProfile)
                .Include(r => r.RdScheme)
                .Include(r => r.Branch)
                .AsQueryable();

            if (branchId.HasValue)
            {
                query = query.Where(r => r.BranchID == branchId.Value);
            }
            if (schemeId.HasValue && schemeId.Value > 0)
            {
                query = query.Where(r => r.RdSchemeID == schemeId.Value);
            }
            if (customerId.HasValue && customerId.Value > 0)
            {
                query = query.Where(r => r.CustomerID == customerId.Value);
            }
            else if (memberId.HasValue && memberId.Value > 0)
            {
                query = query.Where(r => r.Customer != null && r.Customer.MemberProfile != null && r.Customer.MemberProfile.MemberID == memberId.Value);
            }

            // Self-healing: Ensure legacy RD accounts opening balances are synchronized to General Ledger (skip on targeted customer queries)
            if (!customerId.HasValue && !memberId.HasValue)
            {
                try
                {
                    var hasLegacy = await _context.RdAccounts.AnyAsync(a => a.IsLegacyAccount && a.Status == "Active");
                    if (hasLegacy)
                    {
                        var schemeLedgerIds = await _context.RdSchemes
                            .Where(s => s.RdLiabilityLedgerID.HasValue)
                            .Select(s => s.RdLiabilityLedgerID!.Value)
                            .ToListAsync();

                        var totalLegacySum = await _context.RdAccounts
                            .Where(a => a.IsLegacyAccount && a.Status == "Active")
                            .SumAsync(a => a.TotalDepositedAmount);

                        var currentLedgerSum = await _context.Ledgers
                            .Where(l => schemeLedgerIds.Contains(l.LedgerID))
                            .SumAsync(l => l.OpeningBalance);

                        if (totalLegacySum > 0 && currentLedgerSum != totalLegacySum)
                        {
                            await SyncRdOpeningBalancesInternalAsync();
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Auto-heal RD check error: {ex.Message}");
                }
            }

            var accounts = await query
                .OrderByDescending(r => r.OpeningDate)
                .Select(r => new {
                    r.RdAccountID,
                    r.BranchID,
                    BranchName = r.Branch != null ? r.Branch.BranchName : "",
                    r.CustomerID,
                    MemberID = r.Customer != null && r.Customer.MemberProfile != null ? (int?)r.Customer.MemberProfile.MemberID : null,
                    CIFNo = r.Customer != null ? r.Customer.CIFNo : "",
                    CustomerName = r.Customer != null 
                        ? $"{r.Customer.FirstName} {r.Customer.MiddleName} {r.Customer.LastName}".Replace("  ", " ").Trim() 
                        : "",
                    MemberName = r.Customer != null 
                        ? $"{r.Customer.FirstName} {r.Customer.MiddleName} {r.Customer.LastName}".Replace("  ", " ").Trim() 
                        : "",
                    MemberCode = r.Customer != null && r.Customer.MemberProfile != null ? r.Customer.MemberProfile.MemberCode : "",
                    r.RdSchemeID,
                    SchemeName = r.RdScheme != null ? r.RdScheme.SchemeName : "",
                    SchemeCode = r.RdScheme != null ? r.RdScheme.SchemeCode : "",
                    r.AccountNo,
                    FormattedAccountNo = LuhnHelper.Format14Digit(r.AccountNo),
                    r.LegacyAccountNumber,
                    r.OpeningDate,
                    r.InstallmentAmount,
                    r.DurationMonths,
                    r.InterestRate,
                    r.MaturityDate,
                    r.MaturityAmount,
                    r.TotalPaidInstallments,
                    r.TotalDepositedAmount,
                    r.IsLegacyAccount,
                    r.LegacyAccruedInt,
                    r.Status,
                    r.AccountType,
                    r.JointCustomerID,
                    r.GuardianName,
                    r.GuardianRelation,
                    r.PaymentMode,
                    r.SavingAccountID,
                    r.MaturityInstruction,
                    r.AgentID,
                    r.PassbookNo,
                    r.NomineeName,
                    r.NomineeRelation,
                    r.Remarks
                })
                .ToListAsync();

            return Ok(accounts);
        }

        // GET: api/RdAccounts/5
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetRdAccount(int id)
        {
            var r = await _context.RdAccounts
                .AsNoTracking()
                .Include(x => x.Customer)
                    .ThenInclude(c => c!.MemberProfile)
                .Include(x => x.RdScheme)
                    .ThenInclude(s => s!.RdLiabilityLedger)
                .Include(x => x.RdScheme)
                    .ThenInclude(s => s!.InterestPayableLedger)
                .Include(x => x.RdScheme)
                    .ThenInclude(s => s!.InterestExpenseLedger)
                .Include(x => x.RdScheme)
                    .ThenInclude(s => s!.PenaltyIncomeLedger)
                .Include(x => x.Branch)
                .FirstOrDefaultAsync(x => x.RdAccountID == id);

            if (r == null)
            {
                return NotFound();
            }

            var (effectiveAccruedInt, _) = await Helpers.RdClosureSettlementHelper.ComputeRdAccrualStateAsync(_context, r);

            // Get payment history details
            var history = await _context.RdTransactions
                .AsNoTracking()
                .Where(t => t.RdAccountID == id)
                .OrderBy(t => t.TransactionDate)
                .ThenBy(t => t.RdTransactionID)
                .Select(t => new {
                    t.RdTransactionID,
                    t.VoucherID,
                    t.TransactionDate,
                    t.TransactionType,
                    t.InstallmentNo,
                    t.DebitCredit,
                    t.PrincipalAmount,
                    t.PenaltyAmount,
                    t.InterestAmount,
                    t.BalanceAfterTxn,
                    t.Narration
                })
                .ToListAsync();

            return Ok(new {
                AccountDetails = new {
                    EffectiveAccruedInt = effectiveAccruedInt,
                    PrematurePenaltyRate = r.RdScheme != null ? r.RdScheme.PrematurePenaltyRate : 1.00m,
                    RdLiabilityLedgerName = r.RdScheme?.RdLiabilityLedger?.LedgerName ?? "१३ मेंबर आरडी ठेव",
                    InterestPayableLedgerName = r.RdScheme?.InterestPayableLedger?.LedgerName ?? "२३ देणे सभासद ठेव व्याज",
                    InterestExpenseLedgerName = r.RdScheme?.InterestExpenseLedger?.LedgerName ?? "१३४ आरडी ठेवीवरील व्याज",
                    PenaltyIncomeLedgerName = r.RdScheme?.PenaltyIncomeLedger?.LedgerName ?? "४६ आरडी दंड आकारणी",
                    r.ClosureDate,
                    r.ClosureType,
                    r.ClosedPayoutAmount,
                    r.IsLienMarked,
                    r.LienLoanAccountNo,
                    r.RdAccountID,
                    r.BranchID,
                    BranchName = r.Branch != null ? r.Branch.BranchName : "",
                    r.CustomerID,
                    CIFNo = r.Customer != null ? r.Customer.CIFNo : "",
                    CustomerName = r.Customer != null ? $"{r.Customer.FirstName} {r.Customer.MiddleName} {r.Customer.LastName}".Replace("  ", " ").Trim() : "",
                    MemberID = r.Customer != null && r.Customer.MemberProfile != null ? (int?)r.Customer.MemberProfile.MemberID : null,
                    MemberName = r.Customer != null ? $"{r.Customer.FirstName} {r.Customer.MiddleName} {r.Customer.LastName}".Replace("  ", " ").Trim() : "",
                    MemberCode = r.Customer != null && r.Customer.MemberProfile != null ? r.Customer.MemberProfile.MemberCode : "",
                    r.RdSchemeID,
                    SchemeName = r.RdScheme != null ? r.RdScheme.SchemeName : "",
                    SchemeCode = r.RdScheme != null ? r.RdScheme.SchemeCode : "",
                    r.AccountNo,
                    FormattedAccountNo = LuhnHelper.Format14Digit(r.AccountNo),
                    r.LegacyAccountNumber,
                    r.OpeningDate,
                    r.InstallmentAmount,
                    r.DurationMonths,
                    r.InterestRate,
                    r.MaturityDate,
                    r.MaturityAmount,
                    r.TotalPaidInstallments,
                    r.TotalDepositedAmount,
                    r.IsLegacyAccount,
                    r.LegacyAccruedInt,
                    r.Status,
                    r.AccountType,
                    r.JointCustomerID,
                    r.GuardianName,
                    r.GuardianRelation,
                    r.PaymentMode,
                    r.SavingAccountID,
                    r.MaturityInstruction,
                    r.AgentID,
                    r.PassbookNo,
                    r.NomineeName,
                    r.NomineeRelation,
                    r.Remarks
                },
                History = history
            });
        }

        // Helper to resolve/create Ledgers dynamically
        private async Task<Ledger> GetOrCreateLedgerAsync(string ledgerName, string groupName, string type)
        {
            var ledger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName == ledgerName);
            if (ledger == null)
            {
                var group = await _context.AccountGroups.FirstOrDefaultAsync(g => g.GroupName == groupName);
                int gId = group?.GroupID ?? 1;

                ledger = new Ledger
                {
                    LedgerName = ledgerName,
                    GroupID = gId,
                    OpeningBalance = 0,
                    OpeningBalanceType = type,
                    IsActive = true
                };
                _context.Ledgers.Add(ledger);
                await _context.SaveChangesAsync();
            }
            return ledger;
        }

        private async Task<Ledger> GetLiabilityLedgerAsync(RdScheme? scheme)
        {
            if (scheme?.RdLiabilityLedgerID.HasValue == true)
            {
                var l = await _context.Ledgers.FindAsync(scheme.RdLiabilityLedgerID.Value);
                if (l != null) return l;
            }
            return await GetOrCreateLedgerAsync("१३ मेंबर आरडी ठेव", "ठेवी", "Cr");
        }

        private async Task<Ledger> GetExpenseLedgerAsync(RdScheme? scheme)
        {
            if (scheme?.InterestExpenseLedgerID.HasValue == true)
            {
                var l = await _context.Ledgers.FindAsync(scheme.InterestExpenseLedgerID.Value);
                if (l != null) return l;
            }
            return await GetOrCreateLedgerAsync("१३४ आरडी ठेवीवरील व्याज", "ठेवीवरील व्याज", "Dr");
        }

        private async Task<Ledger> GetPayableLedgerAsync(RdScheme? scheme)
        {
            if (scheme?.InterestPayableLedgerID.HasValue == true)
            {
                var l = await _context.Ledgers.FindAsync(scheme.InterestPayableLedgerID.Value);
                if (l != null) return l;
            }
            return await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("२३ देणे सभासद ठेव व्याज") || l.LedgerName.ToLower().Contains("interest payable"))
                   ?? await GetOrCreateLedgerAsync("२३ देणे सभासद ठेव व्याज", "देणे व्याज", "Cr");
        }

        private async Task<Ledger> GetPenaltyLedgerAsync(RdScheme? scheme)
        {
            if (scheme?.PenaltyIncomeLedgerID.HasValue == true)
            {
                var l = await _context.Ledgers.FindAsync(scheme.PenaltyIncomeLedgerID.Value);
                if (l != null) return l;
            }
            return await GetOrCreateLedgerAsync("४६ आरडी दंड आकारणी", "इतर किरकोळ खर्च", "Cr");
        }

        // POST: api/RdAccounts (New Account Opening)
        [HttpPost]
        public async Task<ActionResult<RdAccount>> PostRdAccount(RdAccount account)
        {
            // Resolve Customer & Member
            if (account.CustomerID <= 0)
            {
                return BadRequest("कृपया खातेदाराची (CustomerID) निवड करा.");
            }

            var customer = await _context.Customers.FindAsync(account.CustomerID);
            if (customer == null) return BadRequest("निवडलेला ग्राहक सिस्टीममध्ये अस्तित्वात नाही.");
            if (customer.Status != "Active") return BadRequest($"या ग्राहकाचे स्टेटस '{customer.Status}' असल्यामुळे नवीन आवर्ती ठेव (RD) खाते उघडता येत नाही. केवळ सक्रिय (Active) ग्राहकांचीच ठेव स्वीकारली जाऊ शकते.");

            var member = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == customer.CustomerID);
            int? linkedMemberId = member?.MemberID;

            var scheme = await _context.RdSchemes.FindAsync(account.RdSchemeID);
            if (scheme == null)
            {
                return BadRequest("Invalid RD Scheme.");
            }

            if (scheme.BranchID.HasValue && scheme.BranchID.Value != account.BranchID)
            {
                return BadRequest($"निवडलेली आवर्ती ठेव योजना फक्त विशिष्ट शाखेसाठी (शाखा क्र. {scheme.BranchID.Value}) मर्यादित आहे. चालू शाखेतून ({account.BranchID}) या योजनेखाली खाते उघडता येत नाही.");
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    int? validatedOpeningBankLedgerId = null;
                    string? validatedOpeningBankName = null;
                    if (BankLedgerHelper.IsBankPaymentMode(account.PaymentMode))
                    {
                        var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(_context, account.BankLedgerID);
                        if (!bankCheck.IsValid)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(bankCheck.ErrorMessage);
                        }
                        validatedOpeningBankLedgerId = bankCheck.LedgerId;
                        validatedOpeningBankName = bankCheck.Ledger?.LedgerName;
                        account.PaymentMode = "Bank";
                    }

                    // Generate Standard 14-Digit CBS Account Number or accept Custom Number
                    if (string.IsNullOrWhiteSpace(account.AccountNo) || account.AccountNo == "AUTO")
                    {
                        account.AccountNo = await GenerateNextRdAccountNo(account.BranchID, account.RdSchemeID, incrementSequence: true);
                    }
                    else
                    {
                        account.AccountNo = account.AccountNo.Trim();
                        bool exists = await _context.RdAccounts.AnyAsync(r => r.AccountNo == account.AccountNo);
                        if (exists)
                        {
                            return BadRequest($"आवर्ती ठेव (RD) खाते क्रमांक '{account.AccountNo}' आधीच अस्तित्वात आहे. कृपया दुसरा खाते क्रमांक निवडा.");
                        }

                        // Sync sequence if 14-digit CBS format
                        var digitsOnly = new string(account.AccountNo.Where(char.IsDigit).ToArray());
                        if (digitsOnly.Length == 14)
                        {
                            string seqPart = digitsOnly.Substring(6, 7);
                            if (int.TryParse(seqPart, out int sVal) && sVal > 0)
                            {
                                int sNum = scheme.SchemeCodeNumeric > 0 ? scheme.SchemeCodeNumeric : 501;
                                var seq = await _context.RdAccountSequences
                                    .FirstOrDefaultAsync(s => s.BranchID == account.BranchID && (s.SchemeCodeNumeric == sNum || s.ProductType == "RD"));
                                if (seq != null)
                                {
                                    if (sVal > seq.LastSequenceNumber)
                                    {
                                        seq.LastSequenceNumber = sVal;
                                        seq.CurrentValue = sVal;
                                        seq.UpdatedOn = DateTime.UtcNow;
                                        await _context.SaveChangesAsync();
                                    }
                                }
                            }
                        }
                    }

                    // Validate LegacyAccountNumber duplicate within the same scheme
                    if (!string.IsNullOrWhiteSpace(account.LegacyAccountNumber))
                    {
                        account.LegacyAccountNumber = account.LegacyAccountNumber.Trim();
                        bool legacyExists = await _context.RdAccounts.AnyAsync(r => 
                            r.RdSchemeID == account.RdSchemeID && 
                            r.LegacyAccountNumber != null && 
                            r.LegacyAccountNumber.Trim() == account.LegacyAccountNumber);
                        if (legacyExists)
                        {
                            return BadRequest($"जुना आरडी खाते / पावती क्रमांक '{account.LegacyAccountNumber}' या योजनेखाली आधीच नोंदवला आहे.");
                        }
                    }

                    // Calculations
                    account.DurationMonths = scheme.DurationMonths;
                    account.InterestRate = scheme.InterestRate;
                    account.MaturityDate = account.OpeningDate.AddMonths(scheme.DurationMonths);

                    // IBA Quarterly Compounding Formula for RD Maturity Amount
                    double p = (double)account.InstallmentAmount;
                    double r = (double)scheme.InterestRate;
                    int n = scheme.DurationMonths;

                    double totalMaturity = 0;
                    for (int k = 1; k <= n; k++)
                    {
                        int monthsInBank = n - k + 1;
                        double factor = Math.Pow(1.0 + (r / 400.0), monthsInBank / 3.0);
                        totalMaturity += p * factor;
                    }

                    account.MaturityAmount = Math.Round((decimal)totalMaturity);

                    account.TotalPaidInstallments = 1; // Pay first installment on open
                    account.TotalDepositedAmount = account.InstallmentAmount;
                    account.Status = "Active";
                    account.IsLegacyAccount = false;
                    account.LegacyAccruedInt = 0;
                    account.FinancialYearID = (await _context.FinancialYears.FirstOrDefaultAsync(fy => fy.IsActive))?.FinancialYearID ?? 1;

                    _context.RdAccounts.Add(account);
                    await _context.SaveChangesAsync();

                    // Auto-debit from Saving Account if PaymentMode == AutoDebit_Saving
                    int? autoDebitSavingLedgerId = null;
                    int? autoDebitSavingCustomerId = null;
                    if (account.PaymentMode == "AutoDebit_Saving")
                    {
                        if (!account.SavingAccountID.HasValue || account.SavingAccountID.Value <= 0)
                        {
                            return BadRequest("बचत खात्यातून ऑटो-डेबिटसाठी वैध बचत खाते निवडणे बंधनकारक आहे.");
                        }

                        var sbAcc = await _context.SavingAccountMasters.FindAsync(account.SavingAccountID.Value);
                        if (sbAcc == null || sbAcc.Status == "Closed" || sbAcc.Status == "Frozen")
                        {
                            return BadRequest("ऑटो-डेबिटसाठी निवडलेले बचत खाते सापडले नाही किंवा सक्रिय नाही.");
                        }

                        var (availableSbBal, effectiveSbMinBal) = await Helpers.SavingLedgerHelper.ResolveAvailableBalanceAsync(_context, sbAcc);
                        if (availableSbBal < account.InstallmentAmount)
                        {
                            return BadRequest($"बचत खात्यात अपुरी शिल्लक आहे! आवश्यक: ₹{account.InstallmentAmount:N2}, किमान शिल्लक (₹{effectiveSbMinBal:N2}) व तारण वगळता उपलब्ध: ₹{availableSbBal:N2}");
                        }

                        int resolvedSbLedgerId = await Helpers.SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(_context, sbAcc);
                        if (resolvedSbLedgerId <= 0)
                        {
                            return BadRequest(Helpers.SavingLedgerHelper.GetMissingMappingErrorMessage(sbAcc.AccountNo));
                        }

                        autoDebitSavingLedgerId = resolvedSbLedgerId;
                        autoDebitSavingCustomerId = sbAcc.CustomerID;

                        sbAcc.CurrentBalance -= account.InstallmentAmount;
                        _context.SavingTransactions.Add(new SavingTransaction
                        {
                            SavingAccountID = sbAcc.SavingAccountID,
                            CustomerID = sbAcc.CustomerID,
                            BranchID = account.BranchID > 0 ? account.BranchID : sbAcc.BranchID,
                            TransactionDate = account.OpeningDate,
                            TransactionType = "Withdrawal",
                            PaymentMode = "Transfer",
                            Amount = account.InstallmentAmount,
                            BalanceAfterTxn = sbAcc.CurrentBalance,
                            Narration = $"आरडी खाते हप्ता क्र. १ ऑटो-डेबिट: {account.AccountNo}",
                            CreatedBy = account.CreatedBy
                        });
                    }

                    // Accounting
                    var rdLiabilityLedger = await GetLiabilityLedgerAsync(scheme);
                    int openingDebitLedgerId = autoDebitSavingLedgerId ?? validatedOpeningBankLedgerId
                        ?? await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, account.BranchID, "RD");
                    var debitGlLedger = await _context.Ledgers.FindAsync(openingDebitLedgerId);

                    int? generatedVoucherId = null;
                    if (rdLiabilityLedger != null && debitGlLedger != null)
                    {
                        var (vStatus, appBy, appOn) = await Helpers.ApprovalPolicyHelper.DetermineVoucherStatusAsync(_context, account.InstallmentAmount, account.CreatedBy);
                        var voucher = new Voucher
                        {
                            BranchID = account.BranchID,
                            VoucherNo = autoDebitSavingLedgerId.HasValue ? $"JV-RD-OPEN-{account.AccountNo}" : $"REC-RD-OPEN-{account.AccountNo}",
                            VoucherDate = account.OpeningDate,
                            VoucherType = autoDebitSavingLedgerId.HasValue ? "Journal" : "Receipt",
                            Status = vStatus,
                            ApprovedBy = appBy,
                            ApprovedOn = appOn,
                            TotalAmount = account.InstallmentAmount,
                            Narration = account.PaymentMode == "AutoDebit_Saving" 
                                ? $"नवीन आरडी खाते हप्ता क्र. १ (बचत खात्यातून ऑटो-डेबिट): {account.AccountNo}" 
                                : validatedOpeningBankLedgerId.HasValue
                                    ? $"नवीन आरडी खाते हप्ता क्र. १ (बँक जमा - {validatedOpeningBankName}): {account.AccountNo}"
                                    : $"नवीन आरडी खाते हप्ता क्र. १ भरून उघडले: {account.AccountNo}",
                            CreatedBy = account.CreatedBy,
                            CreatedOn = DateTime.Now
                        };
                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();
                        generatedVoucherId = voucher.VoucherID;
                        foreach (var st in _context.SavingTransactions.Local.Where(x => string.IsNullOrEmpty(x.VoucherNo)))
                        {
                            st.VoucherNo = voucher.VoucherNo;
                        }

                        // Dr Cash / Saving Liability, Cr RD Liability
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = debitGlLedger.LedgerID, DrCr = "Dr", Amount = account.InstallmentAmount, CustomerID = autoDebitSavingCustomerId ?? account.CustomerID, MemberID = linkedMemberId });
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = rdLiabilityLedger.LedgerID, DrCr = "Cr", Amount = account.InstallmentAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        
                        await _context.SaveChangesAsync();

                        // Log Transaction Detail
                        var tx = new RdTransaction
                        {
                            BranchID = account.BranchID,
                            RdAccountID = account.RdAccountID,
                            VoucherID = voucher.VoucherID,
                            TransactionDate = account.OpeningDate,
                            TransactionType = "Installment",
                            InstallmentNo = 1,
                            DebitCredit = "Cr",
                            PrincipalAmount = account.InstallmentAmount,
                            PenaltyAmount = 0,
                            InterestAmount = 0,
                            BalanceAfterTxn = account.TotalDepositedAmount,
                            Narration = $"नवीन आरडी खाते उघडले - हप्ता क्र. १: {account.AccountNo}",
                            CreatedBy = account.CreatedBy
                        };
                        _context.RdTransactions.Add(tx);
                        await _context.SaveChangesAsync();
                    }

                    // Generate Full RD Installment Amortization Schedule (Installments 1 to N)
                    var schedules = new List<RdInstallmentSchedule>();
                    int gracePeriod = scheme.GracePeriodDays > 0 ? scheme.GracePeriodDays : 5;
                    for (int i = 1; i <= scheme.DurationMonths; i++)
                    {
                        DateTime dueDate = account.OpeningDate.AddMonths(i - 1);
                        var sched = new RdInstallmentSchedule
                        {
                            RdAccountID = account.RdAccountID,
                            InstallmentNo = i,
                            DueDate = dueDate,
                            GraceDate = dueDate.AddDays(gracePeriod),
                            ExpectedAmount = account.InstallmentAmount,
                            Status = i == 1 ? "Paid" : "Pending",
                            PaidDate = i == 1 ? account.OpeningDate : null,
                            PaidAmount = i == 1 ? account.InstallmentAmount : 0,
                            OverdueDays = 0,
                            PenaltyCharged = 0,
                            PenaltyWaived = 0,
                            VoucherID = i == 1 ? generatedVoucherId : null
                        };
                        schedules.Add(sched);
                    }
                    _context.RDInstallmentSchedules.AddRange(schedules);
                    await _context.SaveChangesAsync();

                    await transaction.CommitAsync();
                    return CreatedAtAction("GetRdAccount", new { id = account.RdAccountID }, account);
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    string msg = ex.Message + (ex.InnerException != null ? " | " + ex.InnerException.Message : "");
                    return BadRequest("नवीन आरडी खाते उघडताना त्रुटी आली: " + msg);
                }
            }
        }

        // POST: api/RdAccounts/Migrate
        [HttpPost("Migrate")]
        public async Task<ActionResult<RdAccount>> MigrateRdAccount(RdAccount account)
        {
            if (account.CustomerID <= 0)
            {
                return BadRequest("कृपया खातेदाराची (CustomerID) निवड करा.");
            }
            var customer = await _context.Customers.FindAsync(account.CustomerID);
            if (customer == null) return BadRequest("निवडलेला ग्राहक सिस्टीममध्ये अस्तित्वात नाही.");
            if (customer.Status != "Active") return BadRequest($"या ग्राहकाचे स्टेटस '{customer.Status}' असल्यामुळे जुने आवर्ती ठेव (RD) खाते मायग्रेट करता येत नाही.");

            if (account.InstallmentAmount <= 0)
            {
                return BadRequest("Invalid installment amount.");
            }

            // Standardize and generate auto-incremented CBS 14-digit Account Number
            if (string.IsNullOrWhiteSpace(account.AccountNo) || account.AccountNo == "AUTO" || !LuhnHelper.ValidateAccountNo(account.AccountNo) || await _context.RdAccounts.AnyAsync(a => a.AccountNo == account.AccountNo))
            {
                string rawNext = await GenerateNextRdAccountNo(account.BranchID, account.RdSchemeID, incrementSequence: true);
                account.AccountNo = LuhnHelper.Format14Digit(rawNext);
            }
            else
            {
                account.AccountNo = LuhnHelper.Format14Digit(account.AccountNo);
                await GenerateNextRdAccountNo(account.BranchID, account.RdSchemeID, incrementSequence: true);
            }

            account.IsLegacyAccount = true;
            account.Status = "Active";
            account.FinancialYearID = (await _context.FinancialYears.FirstOrDefaultAsync(fy => fy.IsActive))?.FinancialYearID ?? 1;

            _context.RdAccounts.Add(account);
            await _context.SaveChangesAsync();

            // Create or fetch real opening migration voucher for data integrity
            var openingVoucherNo = $"JV-RD-OP-{account.AccountNo}";
            var dummyVoucher = await _context.Vouchers.FirstOrDefaultAsync(v => v.VoucherNo == openingVoucherNo);
            if (dummyVoucher == null)
            {
                dummyVoucher = new Voucher
                {
                    BranchID = account.BranchID,
                    VoucherNo = openingVoucherNo,
                    VoucherDate = account.OpeningDate,
                    VoucherType = "Journal",
                    TotalAmount = account.TotalDepositedAmount,
                    Narration = $"आवर्ती ठेव आरंभिक शिल्लक स्थलांतर (RD Opening Balance Migration): {account.AccountNo}",
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

            var tx = new RdTransaction
            {
                BranchID = account.BranchID,
                RdAccountID = account.RdAccountID,
                VoucherID = dummyVoucher.VoucherID,
                TransactionDate = account.OpeningDate,
                TransactionType = "Installment",
                InstallmentNo = account.TotalPaidInstallments,
                DebitCredit = "Cr",
                PrincipalAmount = account.TotalDepositedAmount,
                PenaltyAmount = 0,
                InterestAmount = 0,
                BalanceAfterTxn = account.TotalDepositedAmount,
                Narration = $"मायग्रेटेड आरडी खाते सुरुवाती शिल्लक: {account.AccountNo}",
                CreatedBy = account.CreatedBy
            };
            _context.RdTransactions.Add(tx);

            if (account.LegacyAccruedInt > 0)
            {
                var intTx = new RdTransaction
                {
                    BranchID = account.BranchID,
                    RdAccountID = account.RdAccountID,
                    VoucherID = dummyVoucher.VoucherID,
                    TransactionDate = account.OpeningDate,
                    TransactionType = "Accrual",
                    DebitCredit = "Cr",
                    PrincipalAmount = 0,
                    PenaltyAmount = 0,
                    InterestAmount = account.LegacyAccruedInt,
                    BalanceAfterTxn = account.TotalDepositedAmount,
                    Narration = $"मायग्रेटेड आरडी संचित व्याज: {account.AccountNo}",
                    CreatedBy = account.CreatedBy
                };
                _context.RdTransactions.Add(intTx);
            }

            await _context.SaveChangesAsync();

            // Generate / Reconcile Amortization Schedule for Migrated Account (supports > DurationMonths & partial balances)
            await Helpers.RdInstallmentCollectionRollbackHelper.ReconcileRdSchedulesWithDepositedAmountAsync(
                _context,
                account,
                deletedVoucherIds: null,
                fallbackPaidDate: account.OpeningDate);

            // Automatically sync with CustomerOpeningBalances & Ledgers (Taleband / Financial Statements)
            try
            {
                await SyncRdOpeningBalancesInternalAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error auto-syncing RD opening balances: {ex.Message}");
            }

            return Ok(account);
        }

        // PUT: api/RdAccounts/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutRdAccount(int id, RdAccount updated)
        {
            var account = await _context.RdAccounts.FindAsync(id);
            if (account == null)
            {
                return NotFound(new { message = "आरडी खाते सापडले नाही." });
            }

            // Keep the same AccountNo on edit - do not change account number!
            if (updated.CustomerID > 0) account.CustomerID = updated.CustomerID;
            if (updated.RdSchemeID > 0) account.RdSchemeID = updated.RdSchemeID;
            account.LegacyAccountNumber = updated.LegacyAccountNumber;
            account.PassbookNo = updated.PassbookNo;
            account.OpeningDate = updated.OpeningDate;
            account.InstallmentAmount = updated.InstallmentAmount;
            account.DurationMonths = updated.DurationMonths;
            account.InterestRate = updated.InterestRate;
            account.MaturityDate = updated.MaturityDate;
            account.MaturityAmount = updated.MaturityAmount;
            account.TotalPaidInstallments = updated.TotalPaidInstallments;
            account.TotalDepositedAmount = updated.TotalDepositedAmount;
            account.LegacyAccruedInt = updated.LegacyAccruedInt;
            account.NomineeName = updated.NomineeName;
            account.NomineeRelation = updated.NomineeRelation;
            account.Remarks = updated.Remarks;

            await _context.SaveChangesAsync();
            if (account.IsLegacyAccount)
            {
                try
                {
                    await SyncRdOpeningBalancesInternalAsync();
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error syncing RD opening balance on update: {ex.Message}");
                }
            }
            return Ok(account);
        }

        // DELETE: api/RdAccounts/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteRdAccount(int id)
        {
            var account = await _context.RdAccounts
                .FirstOrDefaultAsync(a => a.RdAccountID == id);

            if (account == null)
            {
                return NotFound(new { message = "आरडी खाते सापडले नाही." });
            }

            var transactions = await _context.RdTransactions.Where(t => t.RdAccountID == id).ToListAsync();
            
            // कठोर बँकिंग नियम: खात्यावर नंतरचे कोणतेही आर्थिक व्यवहार (हप्ते / दंड / व्याज / इतर व्यवहार) झालेले नसावेत
            int initialAllowedInstallments = account.IsLegacyAccount ? account.TotalPaidInstallments : 1;
            bool hasSubsequentTxns = transactions.Any(t =>
                t.InstallmentNo > initialAllowedInstallments ||
                (t.TransactionType != "Installment" && t.TransactionType != "Accrual" && t.TransactionType != "Opening") ||
                (!account.IsLegacyAccount && t.TransactionDate.Date > account.OpeningDate.Date && !(t.Narration ?? "").Contains("नवीन आरडी खाते उघडले")) ||
                (account.IsLegacyAccount && t.TransactionDate.Date > account.OpeningDate.Date && !(t.Narration ?? "").Contains("मायग्रेटेड"))
            );

            bool hasSubsequentPaidSchedules = await _context.RDInstallmentSchedules
                .AnyAsync(s => s.RdAccountID == id && s.InstallmentNo > initialAllowedInstallments && s.Status == "Paid");

            var txVoucherIds = transactions.Where(t => t.VoucherID > 0).Select(t => t.VoucherID).Distinct().ToList();
            var schedVoucherIds = await _context.RDInstallmentSchedules
                .Where(s => s.RdAccountID == id && s.VoucherID.HasValue && s.VoucherID.Value > 0)
                .Select(s => s.VoucherID!.Value)
                .Distinct()
                .ToListAsync();
            var allCandidateVIds = txVoucherIds.Union(schedVoucherIds).Distinct().ToList();

            var linkedOpeningVouchers = await _context.Vouchers
                .Include(v => v.VoucherDetails)
                .Where(v => allCandidateVIds.Contains(v.VoucherID) ||
                            (!string.IsNullOrEmpty(account.AccountNo) &&
                             (v.VoucherNo == $"REC-RD-OPEN-{account.AccountNo}" ||
                              v.VoucherNo == $"JV-RD-OPEN-{account.AccountNo}")))
                .ToListAsync();

            if (!account.IsLegacyAccount && linkedOpeningVouchers.Any(v => v.Status == "Approved"))
            {
                return BadRequest(new { message = "या आरडी खात्याचे ओपनिंग व्हाउचर मंजूर (Approved) झालेले आहे. खाते डिलीट करण्यापूर्वी व्हाउचर पासिंगमधून संबंधित व्हाउचर अन-पास (Unpass) करा." });
            }

            if (hasSubsequentTxns || hasSubsequentPaidSchedules)
            {
                return BadRequest(new { message = "हे खाते डिलीट करता येणार नाही कारण या खात्यावर नंतरचे आर्थिक व्यवहार (Transactions / हप्ते) झालेले आहेत." });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                if (transactions.Any())
                {
                    _context.RdTransactions.RemoveRange(transactions);
                }

                var accruals = await _context.RdInterestAccruals.Where(a => a.RdAccountID == id).ToListAsync();
                if (accruals.Any())
                {
                    _context.RdInterestAccruals.RemoveRange(accruals);
                }

                var schedules = await _context.RDInstallmentSchedules.Where(s => s.RdAccountID == id).ToListAsync();
                if (schedules.Any())
                {
                    _context.RDInstallmentSchedules.RemoveRange(schedules);
                }

                // Check and rollback sequence to the highest sequence among remaining accounts
                var remainingAccounts = await _context.RdAccounts
                    .Where(a => a.BranchID == account.BranchID && a.RdAccountID != id)
                    .Select(a => a.AccountNo)
                    .ToListAsync();

                int remainingMaxSeq = 0;
                foreach (var accNo in remainingAccounts)
                {
                    string digits = new string(accNo.Where(char.IsDigit).ToArray());
                    if (digits.Length == 14)
                    {
                        if (int.TryParse(digits.Substring(6, 7), out int parsedSeq) && parsedSeq > remainingMaxSeq)
                        {
                            remainingMaxSeq = parsedSeq;
                        }
                    }
                }

                var seq = await _context.RdAccountSequences
                    .FirstOrDefaultAsync(s => s.BranchID == account.BranchID && (s.SchemeCodeNumeric == 501 || s.ProductType == "RD"));
                if (seq != null)
                {
                    seq.CurrentValue = remainingMaxSeq;
                    seq.LastSequenceNumber = remainingMaxSeq;
                    seq.UpdatedOn = DateTime.UtcNow;
                    _context.RdAccountSequences.Update(seq);
                }

                _context.RdAccounts.Remove(account);
                await _context.SaveChangesAsync();

                if (!account.IsLegacyAccount)
                {
                    var linkedVchNos = linkedOpeningVouchers
                        .Where(v => !string.IsNullOrWhiteSpace(v.VoucherNo))
                        .Select(v => v.VoucherNo)
                        .Distinct()
                        .ToList();

                    if (account.SavingAccountID.HasValue && account.SavingAccountID.Value > 0)
                    {
                        var sbAcc = await _context.SavingAccountMasters.FindAsync(account.SavingAccountID.Value);
                        if (sbAcc != null)
                        {
                            SavingTransaction? sbTx = null;
                            if (linkedVchNos.Any())
                            {
                                sbTx = await _context.SavingTransactions
                                    .FirstOrDefaultAsync(st => st.SavingAccountID == sbAcc.SavingAccountID &&
                                                               st.VoucherNo != null &&
                                                               linkedVchNos.Contains(st.VoucherNo));
                            }
                            if (sbTx == null && !string.IsNullOrEmpty(account.AccountNo))
                            {
                                sbTx = await _context.SavingTransactions
                                    .FirstOrDefaultAsync(st => st.SavingAccountID == sbAcc.SavingAccountID &&
                                                               st.TransactionType == "Withdrawal" &&
                                                               st.Narration != null &&
                                                               st.Narration.Contains(account.AccountNo));
                            }

                            if (sbTx != null)
                            {
                                sbAcc.CurrentBalance += sbTx.Amount;
                                _context.Entry(sbAcc).State = EntityState.Modified;

                                var sbPassbooks = await _context.SavingPassbooks
                                    .Where(p => p.TransactionID == sbTx.TransactionID)
                                    .ToListAsync();
                                if (sbPassbooks.Any())
                                {
                                    _context.SavingPassbooks.RemoveRange(sbPassbooks);
                                }
                                _context.SavingTransactions.Remove(sbTx);
                            }
                        }
                    }

                    if (linkedOpeningVouchers.Any())
                    {
                        var vouchersToHardDelete = new List<Voucher>();
                        foreach (var lv in linkedOpeningVouchers)
                        {
                            bool usedElsewhere = await _context.RdTransactions.AnyAsync(t => t.VoucherID == lv.VoucherID) ||
                                                 await _context.RDInstallmentSchedules.AnyAsync(s => s.VoucherID == lv.VoucherID) ||
                                                 await _context.RdInterestAccruals.AnyAsync(a => a.VoucherID == lv.VoucherID);
                            if (!usedElsewhere)
                            {
                                vouchersToHardDelete.Add(lv);
                            }
                        }

                        if (vouchersToHardDelete.Any())
                        {
                            var delIds = vouchersToHardDelete.Select(v => v.VoucherID).ToList();
                            var revRefs = await _context.Vouchers
                                .Where(v => v.RelatedVoucherID.HasValue && delIds.Contains(v.RelatedVoucherID.Value))
                                .ToListAsync();
                            foreach (var rv in revRefs) rv.RelatedVoucherID = null;
                            foreach (var dv in vouchersToHardDelete) dv.RelatedVoucherID = null;
                            await _context.SaveChangesAsync();

                            foreach (var dv in vouchersToHardDelete)
                            {
                                if (dv.VoucherDetails != null && dv.VoucherDetails.Any())
                                {
                                    _context.VoucherDetails.RemoveRange(dv.VoucherDetails);
                                }
                                _context.Vouchers.Remove(dv);
                            }
                        }
                    }

                    await _context.SaveChangesAsync();
                }
                await _context.SaveChangesAsync();

                // If the deleted record was the highest/only RdAccountID, automatically decrement/reseed identity counter
                try
                {
                    var maxRemainingId = await _context.RdAccounts.MaxAsync(r => (int?)r.RdAccountID) ?? 0;
                    if (id >= maxRemainingId)
                    {
                        int reseedVal = maxRemainingId;
                        await _context.Database.ExecuteSqlInterpolatedAsync($"DBCC CHECKIDENT ('RdAccounts', RESEED, {reseedVal});");
                    }
                }
                catch (Exception reseedEx)
                {
                    Console.WriteLine($"[WARNING] RdAccount reseed error: {reseedEx.Message}");
                }

                await transaction.CommitAsync();

                if (account.IsLegacyAccount)
                {
                    try
                    {
                        await SyncRdOpeningBalancesInternalAsync();
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error syncing RD opening balance on delete: {ex.Message}");
                    }
                }

                return Ok(new { message = "आरडी खाते यशस्वीरीत्या डिलीट केले." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = $"खाते डिलीट करताना त्रुटी आली: {ex.Message}" });
            }
        }

        // POST: api/RdAccounts/5/CollectInstallment
        [HttpPost("{id}/CollectInstallment")]
        public async Task<IActionResult> CollectInstallment(
            int id, 
            [FromQuery] int count = 1, 
            [FromQuery] decimal penaltyAmount = 0, 
            [FromQuery] string payMode = "Cash", 
            [FromQuery] int? branchId = null, 
            [FromQuery] DateTime? collectionDate = null,
            [FromQuery] int? bankLedgerId = null,
            [FromQuery] int? sourceSavingAccountId = null,
            [FromQuery] int? sourcePigmyAccountId = null,
            [FromQuery] string? chequeNo = null,
            [FromQuery] decimal? depositAmount = null,
            [FromQuery] bool allowPostMaturity = false)
        {
            var account = await _context.RdAccounts
                .Include(a => a.RdScheme)
                .FirstOrDefaultAsync(a => a.RdAccountID == id);

            if (account == null || account.Status == "Closed")
            {
                return BadRequest("Account is closed or invalid.");
            }

            int totalDuration = account.DurationMonths > 0 ? account.DurationMonths : 12;
            DateTime effDate = collectionDate?.Date ?? DateTime.Today;

            decimal totalContractTarget = totalDuration * account.InstallmentAmount;
            decimal totalMaxRemaining = Math.Max(0m, totalContractTarget - account.TotalDepositedAmount);
            decimal totalInstallmentPrincipal = (depositAmount.HasValue && depositAmount.Value > 0)
                ? Math.Round(depositAmount.Value, 2, MidpointRounding.AwayFromZero)
                : Math.Round(account.InstallmentAmount * (count > 0 ? count : 1), 2, MidpointRounding.AwayFromZero);

            if (totalInstallmentPrincipal <= 0)
            {
                return BadRequest("हप्ता मुद्दल रक्कम शून्य किंवा उणे असू शकत नाही.");
            }

            bool isTenureCompleted = string.Equals(account.Status, "Matured", StringComparison.OrdinalIgnoreCase)
                || account.TotalPaidInstallments >= totalDuration
                || account.TotalDepositedAmount >= totalContractTarget - 0.01m
                || (account.MaturityDate != default && effDate.Date >= account.MaturityDate.Date);
            bool exceedsContractLimit = totalInstallmentPrincipal > totalMaxRemaining + 0.01m;

            if ((isTenureCompleted || exceedsContractLimit) && !allowPostMaturity)
            {
                return BadRequest(new
                {
                    code = "POST_MATURITY_CONFIRMATION_REQUIRED",
                    message = "ठेव कालावधी पूर्ण झाला आहे, तरीही पुढील हप्ता घ्यायचा आहे का?"
                });
            }

            // Core Banking Date Safeguards: Prevent future dating and transactions in closed financial years
            if (effDate.Date > DateTime.Today)
            {
                return BadRequest("आरडी हप्ता भरण्याची दिनांक भविष्यातील (Future Date) असू शकत नाही.");
            }

            var closedFy = await _context.FinancialYears
                .FirstOrDefaultAsync(fy => fy.IsClosed && effDate.Date >= fy.StartDate.Date && effDate.Date <= fy.EndDate.Date);
            if (closedFy != null)
            {
                return BadRequest($"निवडलेली तारीख बंद झालेल्या आर्थिक वर्षात ({closedFy.YearCode}) मोडत असल्याने या तारखेवर हप्ता भरता येत नाही.");
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    decimal totalReceived = Math.Round(totalInstallmentPrincipal + penaltyAmount, 2, MidpointRounding.AwayFromZero);

                    // Pre-sync / self-heal existing schedule rows against pre-transaction TotalDepositedAmount
                    // (ensures legacy migrated accounts e.g. 30/24 installments or partial balances are aligned before new waterfall allocation)
                    await Helpers.RdInstallmentCollectionRollbackHelper.ReconcileRdSchedulesWithDepositedAmountAsync(
                        _context,
                        account);

                    int currentPaid = account.TotalPaidInstallments;

                    var currentUser = HttpContext.User;
                    int makerUserId = currentUser.GetUserId();
                    if (makerUserId <= 0) makerUserId = 1;
                    int userBranchId = currentUser.GetOperatingBranchId();
                    bool isHO = currentUser.IsHeadOfficeAdmin();

                    int collectingBranchId = (isHO && branchId.HasValue && branchId.Value > 0)
                        ? branchId.Value
                        : (userBranchId > 0 ? userBranchId : (account.BranchID > 0 ? account.BranchID : 1));

                    // Accounting Vouchers & Payment Mode Resolution
                    var rdLiabilityLedger = await GetLiabilityLedgerAsync(account.RdScheme);
                    int branchCashId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, collectingBranchId, "RD");
                    var cashLedger = await _context.Ledgers.FindAsync(branchCashId);
                    var penaltyLedger = await GetPenaltyLedgerAsync(account.RdScheme);

                    int debitLedgerId = branchCashId;
                    string finalVoucherType = "Receipt";
                    string modeNarration = "रोख";

                    SavingAccountMaster? sourceSavingAcc = null;
                    PigmyAccount? sourcePigmyAcc = null;

                    string normalizedMode = (payMode ?? "Cash").Trim();

                    if (BankLedgerHelper.IsBankPaymentMode(normalizedMode))
                    {
                        finalVoucherType = "Journal";
                        var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(_context, bankLedgerId);
                        if (bankCheck.IsValid)
                        {
                            var bLedger = bankCheck.Ledger;
                            if (bLedger != null)
                            {
                                debitLedgerId = bLedger.LedgerID;
                                finalVoucherType = "Receipt"; modeNarration = $"बँक ट्रान्सफर ({bLedger.LedgerName})";
                                if (!string.IsNullOrWhiteSpace(chequeNo)) modeNarration += $", Ref/Cheque: {chequeNo.Trim()}";
                            }
                            else
                            {
                                await transaction.RollbackAsync();
                                return BadRequest(bankCheck.ErrorMessage ?? "निवडलेले बँक खाते/लेजर सापडले नाही.");
                            }
                        }
                        else
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(bankCheck.ErrorMessage ?? "बँक ट्रान्सफरसाठी कृपया बँक खाते निवडा.");
                        }
                    }
                    else if (normalizedMode.Equals("Saving", StringComparison.OrdinalIgnoreCase) || normalizedMode.Equals("Saving Transfer", StringComparison.OrdinalIgnoreCase))
                    {
                        finalVoucherType = "Journal";
                        if (sourceSavingAccountId.HasValue && sourceSavingAccountId.Value > 0)
                        {
                            sourceSavingAcc = await _context.SavingAccountMasters
                                .Include(s => s.SavingScheme)
                                .Include(s => s.JointHolders)
                                .FirstOrDefaultAsync(s => s.SavingAccountID == sourceSavingAccountId.Value);
                        }
                        else
                        {
                            sourceSavingAcc = await _context.SavingAccountMasters
                                .Include(s => s.SavingScheme)
                                .Include(s => s.JointHolders)
                                .FirstOrDefaultAsync(s => (s.CustomerID == account.CustomerID || s.JointHolders.Any(jh => jh.CustomerID == account.CustomerID)) &&
                                                          s.BranchID == collectingBranchId &&
                                                          s.Status == "Active");
                        }

                        if (sourceSavingAcc == null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest("वर्ग करण्यासाठी सभासदाचे बचत खाते सापडले नाही.");
                        }
                        if (string.Equals(sourceSavingAcc.Status, "Closed", StringComparison.OrdinalIgnoreCase))
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"बचत खाते (#{sourceSavingAcc.AccountNo}) बंद झालेले आहे.");
                        }

                        bool isSameOrJointOwner = sourceSavingAcc.CustomerID == account.CustomerID ||
                                                  (sourceSavingAcc.JointHolders != null && sourceSavingAcc.JointHolders.Any(jh => jh.CustomerID == account.CustomerID));
                        if (!isSameOrJointOwner)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"निवडलेले बचत खाते (#{sourceSavingAcc.AccountNo}) या आरडी खातेदाराशी संलग्न नाही.");
                        }

                        if (sourceSavingAcc.BranchID > 0 && sourceSavingAcc.BranchID != collectingBranchId)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"निवडलेले बचत खाते (#{sourceSavingAcc.AccountNo}) वेगळ्या शाखेचे आहे. कृपया सध्याच्या शाखेतील बचत खाते निवडा.");
                        }

                        var (availableSavingBal, effectiveSavingMinBal) = await Helpers.SavingLedgerHelper.ResolveAvailableBalanceAsync(_context, sourceSavingAcc);
                        if (totalReceived > availableSavingBal + 0.01m)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"बचत खात्यात अपुरी शिल्लक आहे! आवश्यक: ₹{totalReceived:N2}, किमान शिल्लक (₹{effectiveSavingMinBal:N2}) व तारण वगळता उपलब्ध: ₹{availableSavingBal:N2}");
                        }

                        int savingLedgerId = await Helpers.SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(_context, sourceSavingAcc);
                        if (savingLedgerId <= 0)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(Helpers.SavingLedgerHelper.GetMissingMappingErrorMessage(sourceSavingAcc.AccountNo));
                        }

                        debitLedgerId = savingLedgerId;
                        modeNarration = $"बचत खात्यातून वर्ग ({sourceSavingAcc.AccountNo})";
                        normalizedMode = "Saving";
                    }
                    else if (normalizedMode.Equals("Pigmy", StringComparison.OrdinalIgnoreCase) || normalizedMode.Equals("Pigmy Transfer", StringComparison.OrdinalIgnoreCase))
                    {
                        finalVoucherType = "Journal";
                        if (sourcePigmyAccountId.HasValue && sourcePigmyAccountId.Value > 0)
                        {
                            sourcePigmyAcc = await _context.PigmyAccounts
                                .Include(p => p.PigmyScheme)
                                .FirstOrDefaultAsync(p => p.PigmyAccountID == sourcePigmyAccountId.Value);
                        }
                        else
                        {
                            sourcePigmyAcc = await _context.PigmyAccounts
                                .Include(p => p.PigmyScheme)
                                .FirstOrDefaultAsync(p => p.CustomerID == account.CustomerID && p.Status == "Active");
                        }

                        if (sourcePigmyAcc == null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest("वर्ग करण्यासाठी सभासदाचे पिग्मी खाते सापडले नाही.");
                        }
                        if (string.Equals(sourcePigmyAcc.Status, "Closed", StringComparison.OrdinalIgnoreCase))
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"पिग्मी खाते (#{sourcePigmyAcc.AccountNo}) बंद झालेले आहे.");
                        }

                        decimal pigmyBal = Math.Max(0, sourcePigmyAcc.TotalDepositedAmount - sourcePigmyAcc.TotalWithdrawnAmount);
                        decimal availablePigmyBal = Math.Max(0, pigmyBal - (sourcePigmyAcc.LienAmount ?? 0m));
                        if (totalReceived > availablePigmyBal + 0.01m)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"पिग्मी खात्यात अपुरी शिल्लक आहे! आवश्यक: ₹{totalReceived:N2}, उपलब्ध: ₹{availablePigmyBal:N2}");
                        }

                        int pigmyLedgerId = sourcePigmyAcc.PigmyScheme?.PigmyLiabilityLedgerID ?? 0;
                        if (pigmyLedgerId == 0)
                        {
                            var pigmyLedger = await _context.Ledgers.FirstOrDefaultAsync(l => 
                                l.LedgerName.Contains("पिग्मी ठेवा") || 
                                l.LedgerName.Contains("पिग्मी ठेव") || 
                                l.LedgerName.Contains("दैनिक ठेव") || 
                                l.LedgerName.Contains("Pigmy Deposit") || 
                                l.LedgerName.Contains("Pigmy Account")
                            ) ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("पिग्मी") || l.LedgerName.Contains("Pigmy"));
                            if (pigmyLedger != null) pigmyLedgerId = pigmyLedger.LedgerID;
                        }

                        if (pigmyLedgerId <= 0)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest("पिग्मी ठेव योजनेसाठी Liability GL खाते मॅप केलेले नाही. कृपया पिग्मी योजना सेटिंग तपासा.");
                        }
                        debitLedgerId = pigmyLedgerId;
                        modeNarration = $"पिग्मी खात्यातून वर्ग ({sourcePigmyAcc.AccountNo})";
                        normalizedMode = "Pigmy";
                    }
                    else if (!string.Equals(normalizedMode, "Cash", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(normalizedMode))
                    {
                        await transaction.RollbackAsync();
                        return BadRequest($"आरडी हप्ता भरण्यासाठी अवैध पेमेंट पद्धत '{payMode}'. कृपया रोख, बँक, बचत किंवा पिग्मी निवडा.");
                    }
                    else
                    {
                        finalVoucherType = "Receipt";
                        debitLedgerId = branchCashId;
                        modeNarration = "रोख";
                        normalizedMode = "Cash";
                    }

                    // Update account principal after all mode validations succeed
                    account.TotalDepositedAmount = Math.Round(account.TotalDepositedAmount + totalInstallmentPrincipal, 2, MidpointRounding.AwayFromZero);
                    await _context.SaveChangesAsync();

                    string narration = $"आरडी हप्ता भरणा ({modeNarration}) - रक्कम: ₹{totalInstallmentPrincipal:N2}, दंड: ₹{penaltyAmount}";
                    if (account.BranchID > 0 && account.BranchID != collectingBranchId)
                    {
                        narration += $" [आंतर-शाखा / Cross-Branch: खाते मूळ शाखा #{account.BranchID}]";
                    }

                    int homeBranchId = account.BranchID > 0 ? account.BranchID : 1;
                    bool isCrossBranchTxn = (collectingBranchId != homeBranchId);

                    int finalVoucherId;
                    string primaryDebitVoucherNo;

                    if (!isCrossBranchTxn)
                    {
                        primaryDebitVoucherNo = await Helpers.RdInstallmentCollectionRollbackHelper.GenerateUniqueRdCollVoucherNoAsync(
                            _context,
                            $"JV-RD-COLL-{account.AccountNo}-{currentPaid + 1}");

                        var (vStatusColl, appByColl, appOnColl) = await Helpers.ApprovalPolicyHelper.DetermineVoucherStatusAsync(_context, totalReceived, makerUserId);
                        var voucher = new Voucher
                        {
                            BranchID = collectingBranchId,
                            VoucherNo = primaryDebitVoucherNo,
                            VoucherDate = effDate,
                            VoucherType = finalVoucherType,
                            Status = vStatusColl,
                            ApprovedBy = appByColl,
                            ApprovedOn = appOnColl,
                            TotalAmount = totalReceived,
                            Narration = narration,
                            CreatedBy = makerUserId,
                            CreatedOn = DateTime.Now
                        };
                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();

                        var linkedMember = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == account.CustomerID);
                        int? linkedMemberId = linkedMember?.MemberID;

                        // Dr Cash / Bank / Saving / Pigmy
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = debitLedgerId, DrCr = "Dr", Amount = totalReceived, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                        // Cr RD Liability
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = rdLiabilityLedger.LedgerID, DrCr = "Cr", Amount = totalInstallmentPrincipal, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                        // Cr Penalty Income
                        if (penaltyAmount > 0 && penaltyLedger != null)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = penaltyLedger.LedgerID, DrCr = "Cr", Amount = penaltyAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        }
                        await _context.SaveChangesAsync();
                        finalVoucherId = voucher.VoucherID;
                    }
                    else
                    {
                        // CBS Dual-Voucher IBT Engine for Cross-Branch RD Collection
                        int ibtLedgerId = await Helpers.IbtLedgerHelper.GetIbtLedgerIdAsync(_context, collectingBranchId, homeBranchId);
                        var (vStatusColl, appByColl, appOnColl) = await Helpers.ApprovalPolicyHelper.DetermineVoucherStatusAsync(_context, totalReceived, makerUserId);

                        var linkedMember = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == account.CustomerID);
                        int? linkedMemberId = linkedMember?.MemberID;

                        primaryDebitVoucherNo = await Helpers.RdInstallmentCollectionRollbackHelper.GenerateUniqueRdCollVoucherNoAsync(
                            _context,
                            $"RV-{collectingBranchId}-{effDate:yyMMdd}-RD-COLL-{account.AccountNo}-{currentPaid + 1}");

                        string homeVoucherNo = await Helpers.RdInstallmentCollectionRollbackHelper.GenerateUniqueRdCollVoucherNoAsync(
                            _context,
                            $"JV-RD-COLL-{account.AccountNo}-{currentPaid + 1}");

                        // 1. Counter Voucher (Branch A): Dr Cash/Bank/Saving/Pigmy, Cr IBT
                        var counterVoucher = new Voucher
                        {
                            BranchID = collectingBranchId,
                            VoucherNo = primaryDebitVoucherNo,
                            VoucherDate = effDate,
                            VoucherType = finalVoucherType,
                            Status = vStatusColl,
                            ApprovedBy = appByColl,
                            ApprovedOn = appOnColl,
                            TotalAmount = totalReceived,
                            Narration = $"[आंतर-शाखा आरडी हप्ता भरणा] खाते: {account.AccountNo} (मूळ शाखा #{homeBranchId}) - रक्कम: ₹{totalInstallmentPrincipal:N2}, दंड: ₹{penaltyAmount} ({modeNarration})",
                            CreatedBy = makerUserId,
                            CreatedOn = DateTime.Now,
                            IsIbtVoucher = true,
                            TargetBranchID = homeBranchId
                        };
                        _context.Vouchers.Add(counterVoucher);
                        await _context.SaveChangesAsync();

                        // Dr Cash/Bank/Saving/Pigmy
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = counterVoucher.VoucherID, LedgerID = debitLedgerId, DrCr = "Dr", Amount = totalReceived, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        // Cr IBT
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = counterVoucher.VoucherID, LedgerID = ibtLedgerId, DrCr = "Cr", Amount = totalReceived, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                        // 2. Home Branch Voucher (Branch B, Journal): Dr IBT, Cr RD Liability, Cr Penalty Income
                        var homeVoucher = new Voucher
                        {
                            BranchID = homeBranchId,
                            VoucherNo = homeVoucherNo,
                            VoucherDate = effDate,
                            VoucherType = "Journal",
                            Status = vStatusColl,
                            ApprovedBy = appByColl,
                            ApprovedOn = appOnColl,
                            TotalAmount = totalReceived,
                            Narration = $"[आंतर-शाखा आरडी हप्ता जमा] काऊंटर शाखा #{collectingBranchId} वरून हप्ता भरणा प्राप्त (खाते: {account.AccountNo}, रक्कम: ₹{totalInstallmentPrincipal:N2}, दंड: ₹{penaltyAmount}, {modeNarration})",
                            CreatedBy = makerUserId,
                            CreatedOn = DateTime.Now,
                            IsIbtVoucher = true,
                            TargetBranchID = collectingBranchId,
                            RelatedVoucherID = counterVoucher.VoucherID
                        };
                        _context.Vouchers.Add(homeVoucher);
                        await _context.SaveChangesAsync();

                        counterVoucher.RelatedVoucherID = homeVoucher.VoucherID;

                        // Dr IBT
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = ibtLedgerId, DrCr = "Dr", Amount = totalReceived, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        // Cr RD Liability
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = rdLiabilityLedger.LedgerID, DrCr = "Cr", Amount = totalInstallmentPrincipal, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        // Cr Penalty Income
                        if (penaltyAmount > 0 && penaltyLedger != null)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = penaltyLedger.LedgerID, DrCr = "Cr", Amount = penaltyAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        }
                        await _context.SaveChangesAsync();

                        finalVoucherId = counterVoucher.VoucherID;
                    }

                    // Auto-debit member's Saving Account if Saving Transfer (maintains chronological BalanceAfterTxn & exact VoucherNo link)
                    if (sourceSavingAcc != null)
                    {
                        string savingNarration = $"आरडी हप्ता भरणा वर्ग (RD A/C: {account.AccountNo}, रक्कम: ₹{totalInstallmentPrincipal:N2}{(penaltyAmount > 0 ? $", दंड: ₹{penaltyAmount:N2}" : "")})";
                        await Helpers.RdInstallmentCollectionRollbackHelper.InsertSavingTransferDebitWithPassbookSyncAsync(
                            _context,
                            sourceSavingAcc,
                            collectingBranchId,
                            effDate,
                            totalReceived,
                            primaryDebitVoucherNo,
                            savingNarration,
                            makerUserId);
                    }

                    // Auto-debit member's Pigmy Account if Pigmy Transfer
                    if (sourcePigmyAcc != null)
                    {
                        sourcePigmyAcc.TotalWithdrawnAmount += totalReceived;
                        sourcePigmyAcc.LastWithdrawalDate = effDate;
                        _context.Entry(sourcePigmyAcc).State = EntityState.Modified;

                        decimal remainingPigmyBal = Math.Max(0, sourcePigmyAcc.TotalDepositedAmount - sourcePigmyAcc.TotalWithdrawnAmount);
                        var pigmyTxn = new PigmyTransaction
                        {
                            PigmyAccountID = sourcePigmyAcc.PigmyAccountID,
                            TransactionDate = effDate,
                            ValueDate = effDate,
                            TransactionType = "RD_TRANSFER",
                            DrAmount = totalReceived,
                            CrAmount = 0,
                            BalanceAmount = remainingPigmyBal,
                            Narration = $"आरडी हप्ता भरणा वर्ग ₹{totalReceived:N2} (RD A/C: {account.AccountNo})",
                            ReferenceId = primaryDebitVoucherNo,
                            MakerId = makerUserId,
                            PostedOn = DateTime.Now
                        };
                        _context.PigmyTransactions.Add(pigmyTxn);
                    }

                    // Update RD Amortization Installment Schedules with FIFO Waterfall Allocation
                    // Priority rule: Settle previous unpaid / partial installments first, then allocate to subsequent ones (and dynamically extend beyond DurationMonths when allowPostMaturity == true)
                    var pendingSchedules = await _context.RDInstallmentSchedules
                        .Where(s => s.RdAccountID == id && s.Status != "Paid")
                        .OrderBy(s => s.InstallmentNo)
                        .ToListAsync();

                    decimal remainingToAllocate = totalInstallmentPrincipal;
                    int coveredScheduleCount = 0;
                    var impactedScheduleDetails = new List<string>();

                    for (int idx = 0; idx < pendingSchedules.Count; idx++)
                    {
                        if (remainingToAllocate <= 0.009m) break;

                        var s = pendingSchedules[idx];
                        decimal needed = Math.Round(Math.Max(0m, s.ExpectedAmount - s.PaidAmount), 2, MidpointRounding.AwayFromZero);
                        if (needed <= 0.009m) continue;

                        coveredScheduleCount++;
                        s.PaidDate = effDate;
                        s.PaymentMode = normalizedMode;
                        s.VoucherID = finalVoucherId;
                        s.OverdueDays = (effDate > s.GraceDate) 
                            ? (int)(effDate - s.DueDate).TotalDays 
                            : 0;

                        if (remainingToAllocate >= needed - 0.01m)
                        {
                            s.PaidAmount = s.ExpectedAmount;
                            s.Status = "Paid";
                            remainingToAllocate = Math.Round(Math.Max(0m, remainingToAllocate - needed), 2, MidpointRounding.AwayFromZero);
                            impactedScheduleDetails.Add($"हप्ता क्र. {s.InstallmentNo} (पूर्ण ₹{s.ExpectedAmount:N2})");
                        }
                        else
                        {
                            s.PaidAmount = Math.Round(s.PaidAmount + remainingToAllocate, 2, MidpointRounding.AwayFromZero);
                            s.Status = "Partial";
                            decimal remainingPending = Math.Round(Math.Max(0m, s.ExpectedAmount - s.PaidAmount), 2, MidpointRounding.AwayFromZero);
                            impactedScheduleDetails.Add($"हप्ता क्र. {s.InstallmentNo} (अंशतः जमा: ₹{s.PaidAmount:N2}/{s.ExpectedAmount:N2}, बाकी: ₹{remainingPending:N2})");
                            remainingToAllocate = 0m;
                        }
                    }

                    // Dynamically append post-maturity / over-duration installment rows (#25, #26...) if remainingToAllocate > 0
                    if (remainingToAllocate > 0.009m && account.InstallmentAmount > 0)
                    {
                        int maxInstNo = await _context.RDInstallmentSchedules
                            .Where(s => s.RdAccountID == id)
                            .Select(s => (int?)s.InstallmentNo)
                            .MaxAsync() ?? 0;

                        if (pendingSchedules.Any())
                        {
                            maxInstNo = Math.Max(maxInstNo, pendingSchedules.Max(s => s.InstallmentNo));
                        }

                        int graceDays = account.RdScheme?.GracePeriodDays ?? 5;

                        while (remainingToAllocate > 0.009m)
                        {
                            maxInstNo++;
                            DateTime dueDate = account.OpeningDate.AddMonths(maxInstNo - 1);
                            DateTime graceDate = dueDate.AddDays(graceDays);
                            decimal exp = account.InstallmentAmount;
                            decimal alloc = Math.Round(Math.Min(exp, remainingToAllocate), 2, MidpointRounding.AwayFromZero);
                            remainingToAllocate = Math.Round(Math.Max(0m, remainingToAllocate - alloc), 2, MidpointRounding.AwayFromZero);
                            bool isFull = alloc >= exp - 0.01m;

                            var extendedSched = new RdInstallmentSchedule
                            {
                                RdAccountID = id,
                                InstallmentNo = maxInstNo,
                                DueDate = dueDate,
                                GraceDate = graceDate,
                                ExpectedAmount = exp,
                                PaidDate = effDate,
                                PaidAmount = isFull ? exp : alloc,
                                Status = isFull ? "Paid" : "Partial",
                                PaymentMode = normalizedMode,
                                VoucherID = finalVoucherId,
                                OverdueDays = (effDate > graceDate) ? (int)(effDate - dueDate).TotalDays : 0,
                                PenaltyCharged = 0m,
                                PenaltyWaived = 0m
                            };

                            _context.RDInstallmentSchedules.Add(extendedSched);
                            pendingSchedules.Add(extendedSched);
                            coveredScheduleCount++;

                            if (isFull)
                            {
                                impactedScheduleDetails.Add($"हप्ता क्र. {maxInstNo} (वाढीव हप्ता पूर्ण ₹{exp:N2})");
                            }
                            else
                            {
                                decimal remPending = Math.Round(Math.Max(0m, exp - alloc), 2, MidpointRounding.AwayFromZero);
                                impactedScheduleDetails.Add($"हप्ता क्र. {maxInstNo} (वाढीव हप्ता अंशतः: ₹{alloc:N2}/₹{exp:N2}, बाकी: ₹{remPending:N2})");
                            }
                        }
                    }

                    // Attach penalty to the last touched schedule or first unpaid
                    if (penaltyAmount > 0 && pendingSchedules.Any())
                    {
                        var targetPenaltySchedule = pendingSchedules.Take(coveredScheduleCount).LastOrDefault() ?? pendingSchedules.First();
                        targetPenaltySchedule.PenaltyCharged += penaltyAmount;
                    }

                    await _context.SaveChangesAsync();

                    // Update fully paid installment count and account maturity
                    int fullyPaidCount = await _context.RDInstallmentSchedules
                        .CountAsync(s => s.RdAccountID == id && s.Status == "Paid");

                    account.TotalPaidInstallments = fullyPaidCount;
                    if (account.TotalPaidInstallments >= totalDuration && !account.IsLegacyAccount)
                    {
                        account.Status = "Matured";
                    }

                    // Log transactions
                    decimal runningBal = account.TotalDepositedAmount;
                    var tx = new RdTransaction
                    {
                        BranchID = collectingBranchId,
                        RdAccountID = account.RdAccountID,
                        VoucherID = finalVoucherId,
                        TransactionDate = effDate,
                        TransactionType = "Installment",
                        InstallmentNo = account.TotalPaidInstallments,
                        DebitCredit = "Cr",
                        PrincipalAmount = totalInstallmentPrincipal,
                        PenaltyAmount = penaltyAmount,
                        InterestAmount = 0,
                        BalanceAfterTxn = runningBal,
                        Narration = $"आरडी हप्ता भरणा ({modeNarration}) - जमा ₹{totalInstallmentPrincipal:N2} [{string.Join(", ", impactedScheduleDetails)}]: {account.AccountNo}",
                        CreatedBy = makerUserId
                    };
                    _context.RdTransactions.Add(tx);

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok(new { 
                        Message = "हप्ते यशस्वीरित्या जमा झाले!", 
                        NewTotalPaid = account.TotalPaidInstallments, 
                        TotalDeposited = account.TotalDepositedAmount,
                        Status = account.Status,
                        VoucherNo = primaryDebitVoucherNo,
                        Allocation = impactedScheduleDetails
                    });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("हप्ते भरताना त्रुटी आली: " + ex.Message);
                }
            }
        }

        // GET: api/RdAccounts/5/schedule
        [HttpGet("{id}/schedule")]
        public async Task<ActionResult<IEnumerable<object>>> GetRdSchedule(int id)
        {
            var account = await _context.RdAccounts
                .Include(r => r.RdScheme)
                .FirstOrDefaultAsync(r => r.RdAccountID == id);

            List<RdInstallmentSchedule> schedules;
            if (account != null)
            {
                schedules = await Helpers.RdInstallmentCollectionRollbackHelper.ReconcileRdSchedulesWithDepositedAmountAsync(
                    _context,
                    account);
            }
            else
            {
                schedules = await _context.RDInstallmentSchedules
                    .Include(s => s.Voucher)
                    .Where(s => s.RdAccountID == id)
                    .OrderBy(s => s.InstallmentNo)
                    .ToListAsync();
            }

            int baseDuration = account?.DurationMonths ?? 0;
            var result = (schedules ?? new List<RdInstallmentSchedule>()).Select(s => new
            {
                s.ScheduleID,
                s.RdAccountID,
                s.InstallmentNo,
                s.DueDate,
                s.GraceDate,
                s.ExpectedAmount,
                PendingAmount = Math.Max(0, s.ExpectedAmount - s.PaidAmount),
                IsExtended = baseDuration > 0 && s.InstallmentNo > baseDuration,
                s.Status,
                s.PaidDate,
                s.PaidAmount,
                s.OverdueDays,
                s.PenaltyCharged,
                s.PenaltyWaived,
                s.PaymentMode,
                s.VoucherID,
                VoucherNo = s.Voucher != null ? s.Voucher.VoucherNo : ""
            });

            return Ok(result);
        }

        // POST: api/RdAccounts/AccrueInterest
        [HttpPost("AccrueInterest")]
        public async Task<IActionResult> AccrueInterest([FromQuery] int branchId, [FromQuery] DateTime accrualDate)
        {
            var activeAccounts = await _context.RdAccounts
                .Include(r => r.RdScheme)
                .Where(r => r.BranchID == branchId && (r.Status == "Active" || r.Status == "Matured"))
                .ToListAsync();

            if (!activeAccounts.Any())
            {
                return Ok("No active RD accounts found for interest provision.");
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    decimal totalProvisionAmount = 0;
                    var defaultScheme = activeAccounts.FirstOrDefault()?.RdScheme;
                    var expenseLedger = await GetExpenseLedgerAsync(defaultScheme);
                    var payableLedger = await GetPayableLedgerAsync(defaultScheme);

                    if (expenseLedger == null || payableLedger == null)
                    {
                        return BadRequest("Required ledgers not found.");
                    }

                    var voucher = new Voucher
                    {
                        BranchID = branchId,
                        VoucherNo = $"JV-RD-PROV-{accrualDate:yyyyMMdd}",
                        VoucherDate = accrualDate,
                        VoucherType = "Journal",
                        TotalAmount = 0,
                        Narration = $"आरडी व्याज तरतूद (RD Interest Provision): {accrualDate:dd/MM/yyyy}",
                        CreatedBy = 1,
                        CreatedOn = DateTime.Now
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    foreach (var acc in activeAccounts)
                    {
                        // Standard calculation: monthly interest on cumulative balance
                        // Interest = (Deposited Principal * Rate * 90) / 36500 (Quarterly approximation)
                        var lastAccrual = await _context.RdInterestAccruals
                            .Where(a => a.RdAccountID == acc.RdAccountID)
                            .OrderByDescending(a => a.AccrualDate)
                            .FirstOrDefaultAsync();

                        DateTime fromDate = lastAccrual?.AccrualDate ?? acc.OpeningDate;
                        int days = (accrualDate - fromDate).Days;
                        if (days <= 0) continue;

                        decimal quarterlyInt = Math.Round((acc.TotalDepositedAmount * acc.InterestRate * days) / 36500.0m, 0, MidpointRounding.AwayFromZero);

                        if (quarterlyInt > 0)
                        {
                            totalProvisionAmount += quarterlyInt;

                            _context.RdInterestAccruals.Add(new RdInterestAccrual
                            {
                                BranchID = branchId,
                                RdAccountID = acc.RdAccountID,
                                VoucherID = voucher.VoucherID,
                                AccrualDate = accrualDate,
                                InterestAmount = quarterlyInt,
                                IsPosted = true
                            });

                            _context.RdTransactions.Add(new RdTransaction
                            {
                                BranchID = branchId,
                                RdAccountID = acc.RdAccountID,
                                VoucherID = voucher.VoucherID,
                                TransactionDate = accrualDate,
                                TransactionType = "Accrual",
                                DebitCredit = "Cr",
                                PrincipalAmount = 0,
                                PenaltyAmount = 0,
                                InterestAmount = quarterlyInt
                            });
                        }
                    }

                    if (totalProvisionAmount > 0)
                    {
                        voucher.TotalAmount = totalProvisionAmount;
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = expenseLedger.LedgerID, DrCr = "Dr", Amount = totalProvisionAmount });
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Cr", Amount = totalProvisionAmount });
                        
                        await _context.SaveChangesAsync();
                        await transaction.CommitAsync();
                        return Ok($"Successfully provisioned RD interest: ₹{totalProvisionAmount:F2}");
                    }
                    else
                    {
                        await transaction.RollbackAsync();
                        return Ok("No interest to provision.");
                    }
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("Failed to process provision: " + ex.Message);
                }
            }
        }

        private async Task<(bool IsValid, string? ErrorMessage, Ledger? PayoutLedger, string VoucherType, string ModeLabel, SavingAccountMaster? TargetSavingAccount)> ResolveRdClosurePayoutAsync(
            RdAccount account,
            int operatingBranchId,
            string? paymentMode,
            int? bankLedgerId,
            int? savingAccountId)
        {
            string mode = (paymentMode ?? "Cash").Trim();
            if (BankLedgerHelper.IsBankPaymentMode(mode))
            {
                var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(_context, bankLedgerId);
                if (!bankCheck.IsValid)
                {
                    return (false, bankCheck.ErrorMessage, null, "Payment", "बँक", null);
                }
                var bLedger = await _context.Ledgers.FindAsync(bankCheck.LedgerId);
                if (bLedger == null)
                {
                    return (false, "निवडलेले बँक जी.एल. खाते प्रणालीत आढळले नाही.", null, "Payment", "बँक", null);
                }
                return (true, null, bLedger, "Payment", $"बँक ({bLedger.LedgerName})", null);
            }

            if (mode.Equals("Transfer", StringComparison.OrdinalIgnoreCase) ||
                mode.Equals("Saving", StringComparison.OrdinalIgnoreCase) ||
                mode.Equals("SavingTransfer", StringComparison.OrdinalIgnoreCase))
            {
                if (!savingAccountId.HasValue || savingAccountId.Value <= 0)
                {
                    return (false, "बचत खात्यात वर्ग करण्यासाठी कृपया खातेदाराचे सक्रिय बचत खाते निवडा.", null, "Journal", "बचत वर्ग", null);
                }
                var sbAcc = await _context.SavingAccountMasters
                    .Include(s => s.SavingScheme)
                    .FirstOrDefaultAsync(s => s.SavingAccountID == savingAccountId.Value);
                if (sbAcc == null || sbAcc.Status == "Closed" || sbAcc.Status == "Frozen")
                {
                    return (false, "निवडलेले बचत खाते सापडले नाही किंवा सक्रिय (Active) नाही.", null, "Journal", "बचत वर्ग", null);
                }
                int sbLedgerId = await Helpers.SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(_context, sbAcc);
                if (sbLedgerId <= 0)
                {
                    return (false, Helpers.SavingLedgerHelper.GetMissingMappingErrorMessage(sbAcc.AccountNo), null, "Journal", "बचत वर्ग", null);
                }
                var sbLedger = await _context.Ledgers.FindAsync(sbLedgerId);
                if (sbLedger == null)
                {
                    return (false, Helpers.SavingLedgerHelper.GetMissingMappingErrorMessage(sbAcc.AccountNo), null, "Journal", "बचत वर्ग", null);
                }
                return (true, null, sbLedger, "Journal", $"बचत खात्यात वर्ग ({sbAcc.AccountNo})", sbAcc);
            }

            int branchCashId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, operatingBranchId, "RD");
            var cLedger = await _context.Ledgers.FindAsync(branchCashId);
            if (cLedger == null)
            {
                return (false, "शाखेचे रोख जी.एल. खाते (Cash Ledger) सापडले नाही.", null, "Payment", "रोख", null);
            }
            return (true, null, cLedger, "Payment", "रोख", null);
        }

        private void ApplyRdClosureSavingCredit(
            SavingAccountMaster? targetSavingAcc,
            decimal payoutAmount,
            DateTime txnDate,
            int fallbackBranchId,
            string voucherNo,
            string narration)
        {
            if (targetSavingAcc == null || payoutAmount <= 0) return;
            targetSavingAcc.CurrentBalance += payoutAmount;
            _context.Entry(targetSavingAcc).State = EntityState.Modified;
            _context.SavingTransactions.Add(new SavingTransaction
            {
                SavingAccountID = targetSavingAcc.SavingAccountID,
                CustomerID = targetSavingAcc.CustomerID,
                BranchID = targetSavingAcc.BranchID > 0 ? targetSavingAcc.BranchID : fallbackBranchId,
                TransactionDate = txnDate,
                TransactionType = "Deposit",
                PaymentMode = "Transfer",
                Amount = payoutAmount,
                BalanceAfterTxn = targetSavingAcc.CurrentBalance,
                VoucherNo = voucherNo,
                Narration = narration,
                CreatedBy = 1
            });
        }

        // POST: api/RdAccounts/5/MaturedClose
        [HttpPost("{id}/MaturedClose")]
        public Task<IActionResult> MaturedClose(
            int id,
            [FromQuery] DateTime? closureDate = null,
            [FromQuery] string paymentMode = "Cash",
            [FromQuery] int? bankLedgerId = null,
            [FromQuery] int? savingAccountId = null,
            [FromQuery] decimal? customPayoutAmount = null,
            [FromQuery] string? remarks = null)
            => Helpers.RdClosureSettlementHelper.ExecuteMaturedCloseAsync(_context, HttpContext.User, id, closureDate, paymentMode, bankLedgerId, savingAccountId, customPayoutAmount, remarks);

        private async Task<IActionResult> MaturedCloseLegacyUnused(
            int id,
            [FromQuery] DateTime? closureDate = null,
            [FromQuery] string paymentMode = "Cash",
            [FromQuery] int? bankLedgerId = null,
            [FromQuery] int? savingAccountId = null)
        {
            var account = await _context.RdAccounts
                .Include(a => a.RdScheme)
                .FirstOrDefaultAsync(a => a.RdAccountID == id);

            if (account == null || account.Status == "Closed")
            {
                return BadRequest("Account is closed or invalid.");
            }

            DateTime effClosureDate = closureDate?.Date ?? DateTime.Today;

            // Sum accrued interest
            var accruedInt = await _context.RdTransactions
                .Where(t => t.RdAccountID == id && t.TransactionType == "Accrual")
                .SumAsync(t => t.InterestAmount) + account.LegacyAccruedInt;

            decimal totalPayout = account.TotalDepositedAmount + accruedInt;

            int preCheckUserBranchId = HttpContext.User.GetOperatingBranchId();
            int preCheckOperatingBranchId = preCheckUserBranchId > 0 ? preCheckUserBranchId : (account.BranchID > 0 ? account.BranchID : 1);
            var payoutCheck = await ResolveRdClosurePayoutAsync(account, preCheckOperatingBranchId, paymentMode, bankLedgerId, savingAccountId);
            if (!payoutCheck.IsValid || payoutCheck.PayoutLedger == null)
            {
                return BadRequest(payoutCheck.ErrorMessage ?? "पेमेंट लेजर सापडले नाही.");
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    account.Status = "Closed";
                    await _context.SaveChangesAsync();

                    var currentUser = HttpContext.User;
                    int userBranchId = currentUser.GetOperatingBranchId();
                    int operatingBranchId = userBranchId > 0 ? userBranchId : (account.BranchID > 0 ? account.BranchID : 1);
                    int homeBranchId = account.BranchID > 0 ? account.BranchID : 1;
                    bool isCrossBranchTxn = (operatingBranchId != homeBranchId);

                    var rdLiabilityLedger = await GetLiabilityLedgerAsync(account.RdScheme);
                    var payableLedger = await GetPayableLedgerAsync(account.RdScheme);
                    int branchCashId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, operatingBranchId, "RD");
                    var cashLedger = await _context.Ledgers.FindAsync(branchCashId);

                    if (rdLiabilityLedger == null || payoutCheck.PayoutLedger == null)
                    {
                        return BadRequest("Required ledgers not found.");
                    }

                    var linkedMember = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == account.CustomerID);
                    int? linkedMemberId = linkedMember?.MemberID;
                    int finalVoucherId;

                    if (!isCrossBranchTxn)
                    {
                        // Standard Single-Branch Voucher
                        var voucher = new Voucher
                        {
                            BranchID = homeBranchId,
                            VoucherNo = $"JV-RD-CLOSE-{account.AccountNo}",
                            VoucherDate = effClosureDate,
                            VoucherType = "Payment",
                            TotalAmount = totalPayout,
                            Narration = $"आरडी मुदतपूर्ती पेआउट ({payoutCheck.ModeLabel}): {account.AccountNo}",
                            CreatedBy = 1,
                            CreatedOn = DateTime.Now
                        };
                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();

                        // Dr RD Liability
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = rdLiabilityLedger.LedgerID, DrCr = "Dr", Amount = account.TotalDepositedAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        
                        // Dr Interest Payable
                        if (payableLedger != null && accruedInt > 0)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = accruedInt, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        }

                        // Cr Cash
                        voucher.VoucherType = payoutCheck.VoucherType;
                        ApplyRdClosureSavingCredit(payoutCheck.TargetSavingAccount, totalPayout, effClosureDate, homeBranchId, $"JV-RD-CLOSE-{account.AccountNo}", $"आरडी मुदतपूर्ती परतावा जमा (RD A/C: {account.AccountNo})");
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payoutCheck.PayoutLedger.LedgerID, DrCr = "Cr", Amount = totalPayout, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        await _context.SaveChangesAsync();
                        finalVoucherId = voucher.VoucherID;
                    }
                    else
                    {
                        // CBS Dual-Voucher IBT Engine for Cross-Branch RD Maturity Payout
                        int ibtLedgerId = await Helpers.IbtLedgerHelper.GetIbtLedgerIdAsync(_context, operatingBranchId, homeBranchId);

                        // 1. Counter Voucher (Branch A, Payment): Dr IBT, Cr Cash
                        var counterVoucher = new Voucher
                        {
                            BranchID = operatingBranchId,
                            VoucherNo = $"PV-{operatingBranchId}-{effClosureDate:yyyyMMdd}-RD-CLOSE-{account.AccountNo}",
                            VoucherDate = effClosureDate,
                            VoucherType = "Payment",
                            TotalAmount = totalPayout,
                            Narration = $"[आंतर-शाखा आरडी मुदतपूर्ती परतावा] खाते: {account.AccountNo} (मूळ शाखा #{homeBranchId}) साठी परतावा अदा ({payoutCheck.ModeLabel})",
                            CreatedBy = 1,
                            CreatedOn = DateTime.Now,
                            IsIbtVoucher = true,
                            TargetBranchID = homeBranchId
                        };
                        _context.Vouchers.Add(counterVoucher);
                        await _context.SaveChangesAsync();

                        // Dr IBT
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = counterVoucher.VoucherID, LedgerID = ibtLedgerId, DrCr = "Dr", Amount = totalPayout, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        // Cr Cash
                        counterVoucher.VoucherType = payoutCheck.VoucherType;
                        ApplyRdClosureSavingCredit(payoutCheck.TargetSavingAccount, totalPayout, effClosureDate, operatingBranchId, $"JV-RD-CLOSE-{account.AccountNo}", $"आरडी मुदतपूर्ती परतावा जमा (RD A/C: {account.AccountNo})");
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = counterVoucher.VoucherID, LedgerID = payoutCheck.PayoutLedger.LedgerID, DrCr = "Cr", Amount = totalPayout, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                        // 2. Home Branch Voucher (Branch B, Journal): Dr RD Liability, Dr Interest Payable, Cr IBT
                        var homeVoucher = new Voucher
                        {
                            BranchID = homeBranchId,
                            VoucherNo = $"JV-RD-CLOSE-{account.AccountNo}",
                            VoucherDate = effClosureDate,
                            VoucherType = "Journal",
                            TotalAmount = totalPayout,
                            Narration = $"[आंतर-शाखा आरडी मुदतपूर्ती क्लोजर] काऊंटर शाखा #{operatingBranchId} वरून परतावा अदा (खाते: {account.AccountNo})",
                            CreatedBy = 1,
                            CreatedOn = DateTime.Now,
                            IsIbtVoucher = true,
                            TargetBranchID = operatingBranchId,
                            RelatedVoucherID = counterVoucher.VoucherID
                        };
                        _context.Vouchers.Add(homeVoucher);
                        await _context.SaveChangesAsync();

                        counterVoucher.RelatedVoucherID = homeVoucher.VoucherID;

                        // Dr RD Liability
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = rdLiabilityLedger.LedgerID, DrCr = "Dr", Amount = account.TotalDepositedAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                        // Dr Interest Payable
                        if (payableLedger != null && accruedInt > 0)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = accruedInt, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        }

                        // Cr IBT
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = ibtLedgerId, DrCr = "Cr", Amount = totalPayout, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                        await _context.SaveChangesAsync();
                        finalVoucherId = counterVoucher.VoucherID;
                    }

                    // Log closed transaction details
                    _context.RdTransactions.Add(new RdTransaction
                    {
                        BranchID = isCrossBranchTxn ? operatingBranchId : account.BranchID,
                        RdAccountID = account.RdAccountID,
                        VoucherID = finalVoucherId,
                        TransactionDate = effClosureDate,
                        TransactionType = "Payout",
                        DebitCredit = "Dr",
                        PrincipalAmount = account.TotalDepositedAmount,
                        PenaltyAmount = 0,
                        InterestAmount = accruedInt
                    });

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok($"Maturity process completed. Total payout: ₹{totalPayout:F2}");
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("Failed to mature close: " + ex.Message);
                }
            }
        }

        // POST: api/RdAccounts/5/PrematureClose
        [HttpPost("{id}/PrematureClose")]
        public Task<IActionResult> PrematureClose(
            int id,
            [FromQuery] DateTime closureDate,
            [FromQuery] decimal? customPrematureRate = null,
            [FromQuery] string paymentMode = "Cash",
            [FromQuery] int? bankLedgerId = null,
            [FromQuery] int? savingAccountId = null,
            [FromQuery] decimal? customPayoutAmount = null,
            [FromQuery] string? remarks = null)
            => Helpers.RdClosureSettlementHelper.ExecutePrematureCloseAsync(_context, HttpContext.User, id, closureDate, customPrematureRate, paymentMode, bankLedgerId, savingAccountId, customPayoutAmount, remarks);

        private async Task<IActionResult> PrematureCloseLegacyUnused(
            int id,
            [FromQuery] DateTime closureDate,
            [FromQuery] decimal? customPrematureRate = null,
            [FromQuery] string paymentMode = "Cash",
            [FromQuery] int? bankLedgerId = null,
            [FromQuery] int? savingAccountId = null)
        {
            var account = await _context.RdAccounts
                .Include(a => a.RdScheme)
                .FirstOrDefaultAsync(a => a.RdAccountID == id);

            if (account == null || account.Status == "Closed")
            {
                return BadRequest("Account is closed or invalid.");
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    // 1. Calculate actual months held
                    int actualMonths = ((closureDate.Year - account.OpeningDate.Year) * 12) + closureDate.Month - account.OpeningDate.Month;
                    if (actualMonths <= 0) actualMonths = 1;

                    // 2. Revised Interest Rate (Scheme Premature Penalty Rate or Custom Rate override)
                    decimal penaltyRate = account.RdScheme?.PrematurePenaltyRate ?? 1.00m;
                    decimal prematureRate = customPrematureRate ?? (account.InterestRate - penaltyRate);
                    if (prematureRate < 0) prematureRate = 0;

                    // 3. Recalculate interest
                    double r = (double)prematureRate;
                    double p = (double)account.InstallmentAmount;
                    int n = actualMonths;
                    double totalPrematureMat = 0;
                    for (int k = 1; k <= n; k++)
                    {
                        int monthsInBank = n - k + 1;
                        double factor = Math.Pow(1.0 + (r / 400.0), monthsInBank / 3.0);
                        totalPrematureMat += p * factor;
                    }
                    decimal totalDepositSoFar = account.InstallmentAmount * actualMonths;
                    decimal recalculatedInterest = Math.Max(0, Math.Round((decimal)totalPrematureMat - totalDepositSoFar));

                        var alreadyAccruedInt = await _context.RdTransactions
                            .Where(t => t.RdAccountID == id && t.TransactionType == "Accrual")
                            .SumAsync(t => t.InterestAmount) + account.LegacyAccruedInt;

                    // 5. Final payout & Accounting calculation
                    decimal extraInterest = 0;
                    decimal clawbackAmount = 0;
                    decimal netPayout = account.TotalDepositedAmount + recalculatedInterest;

                    int preCheckUserBranchId = HttpContext.User.GetOperatingBranchId();
                    int preCheckOperatingBranchId = preCheckUserBranchId > 0 ? preCheckUserBranchId : (account.BranchID > 0 ? account.BranchID : 1);
                    var payoutCheck = await ResolveRdClosurePayoutAsync(account, preCheckOperatingBranchId, paymentMode, bankLedgerId, savingAccountId);
                    if (!payoutCheck.IsValid || payoutCheck.PayoutLedger == null)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(payoutCheck.ErrorMessage ?? "पेमेंट लेजर सापडले नाही.");
                    }

                    if (alreadyAccruedInt > recalculatedInterest)
                    {
                        clawbackAmount = alreadyAccruedInt - recalculatedInterest;
                    }
                    else
                    {
                        extraInterest = recalculatedInterest - alreadyAccruedInt;
                    }

                    account.Status = "Closed";
                    await _context.SaveChangesAsync();

                    var currentUser = HttpContext.User;
                    int userBranchId = currentUser.GetOperatingBranchId();
                    int operatingBranchId = userBranchId > 0 ? userBranchId : (account.BranchID > 0 ? account.BranchID : 1);
                    int homeBranchId = account.BranchID > 0 ? account.BranchID : 1;
                    bool isCrossBranchTxn = (operatingBranchId != homeBranchId);

                    var rdLiabilityLedger = await GetLiabilityLedgerAsync(account.RdScheme);
                    var payableLedger = await GetPayableLedgerAsync(account.RdScheme);
                    int branchCashId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, operatingBranchId, "RD");
                    var cashLedger = await _context.Ledgers.FindAsync(branchCashId)
                        ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.AccountType == "Cash In Hand")
                        ?? await GetOrCreateLedgerAsync("५१ हातातील रोख शिल्लक", "रोख व बँक शिल्लक", "Dr");

                    if (rdLiabilityLedger == null || payoutCheck.PayoutLedger == null)
                    {
                        return BadRequest("Required ledgers not found.");
                    }

                    var linkedMember = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == account.CustomerID);
                    int? linkedMemberId = linkedMember?.MemberID;
                    int finalVoucherId;

                    if (!isCrossBranchTxn)
                    {
                        // Standard Single-Branch Voucher
                        var voucher = new Voucher
                        {
                            BranchID = homeBranchId,
                            VoucherNo = $"JV-RD-PRECLOSE-{account.AccountNo}",
                            VoucherDate = closureDate,
                            VoucherType = "Payment",
                            TotalAmount = netPayout,
                            Narration = $"आरडी मुदतपूर्व बंद ({payoutCheck.ModeLabel}) - Rate: {prematureRate}%, Recalc Int: ₹{recalculatedInterest}, Clawback: ₹{clawbackAmount}",
                            CreatedBy = 1,
                            CreatedOn = DateTime.Now
                        };
                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();

                        // Dr RD Liability
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = rdLiabilityLedger.LedgerID, DrCr = "Dr", Amount = account.TotalDepositedAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                        // Dr Interest Payable (Clearing previously accrued interest)
                        if (payableLedger != null && alreadyAccruedInt > 0)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = alreadyAccruedInt, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        }

                        // Dr Interest Expense (For any new unaccrued interest paid out)
                        if (extraInterest > 0)
                        {
                            var expenseLedger = await GetExpenseLedgerAsync(account.RdScheme);
                            if (expenseLedger != null)
                            {
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = expenseLedger.LedgerID, DrCr = "Dr", Amount = extraInterest, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            }
                        }

                        // Cr Cash
                        voucher.VoucherType = payoutCheck.VoucherType;
                        ApplyRdClosureSavingCredit(payoutCheck.TargetSavingAccount, netPayout, closureDate, homeBranchId, $"JV-RD-PRECLOSE-{account.AccountNo}", $"आरडी मुदतपूर्व बंद परतावा जमा (RD A/C: {account.AccountNo})");
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payoutCheck.PayoutLedger.LedgerID, DrCr = "Cr", Amount = netPayout, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                        // Cr Interest Expense / Clawback Income (If accrued was higher than recalculated)
                        if (clawbackAmount > 0)
                        {
                            var clawbackLedger = await GetExpenseLedgerAsync(account.RdScheme);
                            if (clawbackLedger != null)
                            {
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = clawbackLedger.LedgerID, DrCr = "Cr", Amount = clawbackAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            }
                        }
                        await _context.SaveChangesAsync();
                        finalVoucherId = voucher.VoucherID;
                    }
                    else
                    {
                        // CBS Dual-Voucher IBT Engine for Cross-Branch RD Premature Payout
                        int ibtLedgerId = await Helpers.IbtLedgerHelper.GetIbtLedgerIdAsync(_context, operatingBranchId, homeBranchId);

                        // 1. Counter Voucher (Branch A, Payment): Dr IBT, Cr Cash
                        var counterVoucher = new Voucher
                        {
                            BranchID = operatingBranchId,
                            VoucherNo = $"PV-{operatingBranchId}-{DateTime.Today:yyyyMMdd}-RD-PRECLOSE-{account.AccountNo}",
                            VoucherDate = closureDate,
                            VoucherType = "Payment",
                            TotalAmount = netPayout,
                            Narration = $"[आंतर-शाखा आरडी मुदतपूर्व परतावा] खाते: {account.AccountNo} (मूळ शाखा #{homeBranchId}) साठी परतावा अदा ({payoutCheck.ModeLabel}) - Rate: {prematureRate}%, Recalc Int: ₹{recalculatedInterest}, Clawback: ₹{clawbackAmount}",
                            CreatedBy = 1,
                            CreatedOn = DateTime.Now,
                            IsIbtVoucher = true,
                            TargetBranchID = homeBranchId
                        };
                        _context.Vouchers.Add(counterVoucher);
                        await _context.SaveChangesAsync();

                        // Dr IBT
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = counterVoucher.VoucherID, LedgerID = ibtLedgerId, DrCr = "Dr", Amount = netPayout, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        // Cr Cash
                        counterVoucher.VoucherType = payoutCheck.VoucherType;
                        ApplyRdClosureSavingCredit(payoutCheck.TargetSavingAccount, netPayout, closureDate, operatingBranchId, $"JV-RD-PRECLOSE-{account.AccountNo}", $"आरडी मुदतपूर्व बंद परतावा जमा (RD A/C: {account.AccountNo})");
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = counterVoucher.VoucherID, LedgerID = payoutCheck.PayoutLedger.LedgerID, DrCr = "Cr", Amount = netPayout, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                        // 2. Home Branch Voucher (Branch B, Journal): Dr RD Liability, Dr Interest Payable, Dr Interest Expense, Cr Clawback, Cr IBT
                        var homeVoucher = new Voucher
                        {
                            BranchID = homeBranchId,
                            VoucherNo = $"JV-RD-PRECLOSE-{account.AccountNo}",
                            VoucherDate = closureDate,
                            VoucherType = "Journal",
                            TotalAmount = account.TotalDepositedAmount + alreadyAccruedInt + extraInterest,
                            Narration = $"[आंतर-शाखा आरडी मुदतपूर्व क्लोजर] काऊंटर शाखा #{operatingBranchId} वरून परतावा अदा (खाते: {account.AccountNo}) - Rate: {prematureRate}%, Recalc Int: ₹{recalculatedInterest}, Clawback: ₹{clawbackAmount}",
                            CreatedBy = 1,
                            CreatedOn = DateTime.Now,
                            IsIbtVoucher = true,
                            TargetBranchID = operatingBranchId,
                            RelatedVoucherID = counterVoucher.VoucherID
                        };
                        _context.Vouchers.Add(homeVoucher);
                        await _context.SaveChangesAsync();

                        counterVoucher.RelatedVoucherID = homeVoucher.VoucherID;

                        // Dr RD Liability
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = rdLiabilityLedger.LedgerID, DrCr = "Dr", Amount = account.TotalDepositedAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                        // Dr Interest Payable (Clearing previously accrued interest)
                        if (payableLedger != null && alreadyAccruedInt > 0)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = alreadyAccruedInt, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        }

                        // Dr Interest Expense (For any new unaccrued interest paid out)
                        if (extraInterest > 0)
                        {
                            var expenseLedger = await GetExpenseLedgerAsync(account.RdScheme);
                            if (expenseLedger != null)
                            {
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = expenseLedger.LedgerID, DrCr = "Dr", Amount = extraInterest, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            }
                        }

                        // Cr Clawback Income (If accrued was higher than recalculated)
                        if (clawbackAmount > 0)
                        {
                            var clawbackLedger = await GetExpenseLedgerAsync(account.RdScheme);
                            if (clawbackLedger != null)
                            {
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = clawbackLedger.LedgerID, DrCr = "Cr", Amount = clawbackAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            }
                        }

                        // Cr IBT
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = ibtLedgerId, DrCr = "Cr", Amount = netPayout, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                        await _context.SaveChangesAsync();
                        finalVoucherId = counterVoucher.VoucherID;
                    }

                    // Log closed transaction details
                    _context.RdTransactions.Add(new RdTransaction
                    {
                        BranchID = isCrossBranchTxn ? operatingBranchId : account.BranchID,
                        RdAccountID = account.RdAccountID,
                        VoucherID = finalVoucherId,
                        TransactionDate = closureDate,
                        TransactionType = "Premature_Close",
                        DebitCredit = "Dr",
                        PrincipalAmount = account.TotalDepositedAmount,
                        PenaltyAmount = 0,
                        InterestAmount = recalculatedInterest
                    });

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok(new { Message = "RD Prematurely Closed", RecalcInt = recalculatedInterest, Clawback = clawbackAmount, NetPayout = netPayout });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("Failed to premature close: " + ex.Message);
                }
            }
        }

        // POST: api/RdAccounts/5/Renew
        [HttpPost("{id}/Renew")]
        public Task<IActionResult> Renew(
            int id,
            [FromQuery] int targetSchemeId,
            [FromQuery] DateTime? closureDate = null,
            [FromQuery] decimal? customPayoutAmount = null,
            [FromQuery] string? remarks = null)
            => Helpers.RdClosureSettlementHelper.ExecuteRenewAsync(_context, HttpContext.User, id, targetSchemeId, closureDate, customPayoutAmount, remarks);

        private async Task<IActionResult> RenewLegacyUnused(int id, int targetSchemeId, DateTime? closureDate = null)
        {
            var oldAccount = await _context.RdAccounts
                .Include(a => a.RdScheme)
                .FirstOrDefaultAsync(a => a.RdAccountID == id);

            if (oldAccount == null || oldAccount.Status == "Closed")
            {
                return BadRequest("Legacy account is closed or invalid.");
            }

            var fdScheme = await _context.FdSchemes.FindAsync(targetSchemeId);
            if (fdScheme == null)
            {
                return BadRequest("Invalid target FD scheme.");
            }

            decimal accruedInt = await _context.RdTransactions
                .Where(t => t.RdAccountID == id && t.TransactionType == "Accrual")
                .SumAsync(t => t.InterestAmount) + oldAccount.LegacyAccruedInt;

            decimal totalMaturityAmount = oldAccount.TotalDepositedAmount + accruedInt;
            DateTime effClosureDate = closureDate?.Date ?? DateTime.Today;

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    int resolvedCustId = oldAccount.CustomerID;
                    if (resolvedCustId <= 0)
                    {
                        return BadRequest("आरडी खातेदाराचा वैध ग्राहक (Customer / CIF) सापडला नाही.");
                    }

                    var linkedMember = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == resolvedCustId);
                    int? linkedMemberId = linkedMember?.MemberID;

                    // 1. Close old account
                    oldAccount.Status = "Matured";
                    await _context.SaveChangesAsync();

                    var rdLiabilityLedger = await GetLiabilityLedgerAsync(oldAccount.RdScheme);
                    Ledger? fdLiabilityLedger = null;
                    if (fdScheme.FdLiabilityLedgerID.HasValue)
                    {
                        fdLiabilityLedger = await _context.Ledgers.FindAsync(fdScheme.FdLiabilityLedgerID.Value);
                    }
                    if (fdLiabilityLedger == null)
                    {
                        fdLiabilityLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("मुदत ठेव") || l.LedgerName.ToLower().Contains("fixed deposit"))
                            ?? await GetOrCreateLedgerAsync("१२ मुदत ठेव", "ठेवी", "Cr");
                    }
                    var payableLedger = await GetPayableLedgerAsync(oldAccount.RdScheme);

                    if (rdLiabilityLedger == null || fdLiabilityLedger == null)
                    {
                        return BadRequest("Required ledgers not found.");
                    }

                    // 2. Generate new FD account sequence
                    var branch = await _context.Branches.FindAsync(oldAccount.BranchID);
                    string branchPrefix = branch != null ? branch.BranchCode : "BR";

                    var seq = await _context.FdAccountSequences
                        .FirstOrDefaultAsync(s => s.BranchID == oldAccount.BranchID && s.ProductType == "FD");
                    
                    if (seq == null)
                    {
                        seq = new FdAccountSequence { BranchID = oldAccount.BranchID, ProductType = "FD", CurrentValue = 0 };
                        _context.FdAccountSequences.Add(seq);
                    }
                    seq.CurrentValue += 1;
                    await _context.SaveChangesAsync();

                    DateTime newOpeningDate = effClosureDate;
                    var matchingFy = await _context.FinancialYears
                        .FirstOrDefaultAsync(fy => newOpeningDate >= fy.StartDate.Date && newOpeningDate <= fy.EndDate.Date);

                    int targetFinancialYearId = matchingFy?.FinancialYearID 
                        ?? (await _context.FinancialYears.FirstOrDefaultAsync(fy => fy.IsActive))?.FinancialYearID 
                        ?? (oldAccount.FinancialYearID > 0 ? oldAccount.FinancialYearID : 1);

                    var newFd = new FdAccount
                    {
                        InstitutionID = oldAccount.InstitutionID,
                        BranchID = oldAccount.BranchID,
                        FinancialYearID = targetFinancialYearId,
                        CustomerID = resolvedCustId,
                        FdSchemeID = targetSchemeId,
                        AccountNo = $"{branchPrefix}-{oldAccount.BranchID:D3}-FD-{seq.CurrentValue:D6}",
                        OpeningDate = newOpeningDate,
                        DepositAmount = totalMaturityAmount,
                        InterestRate = fdScheme.InterestRate,
                        MaturityDate = DateTime.Today.AddMonths(fdScheme.DurationMonths),
                        Status = "Active",
                        NomineeName = oldAccount.NomineeName,
                        NomineeRelation = oldAccount.NomineeRelation,
                        Remarks = $"आरडी नूतनीकरण (Renewed from RD): {oldAccount.AccountNo}"
                    };

                    // Maturity Calculations
                    decimal p = totalMaturityAmount;
                    decimal r = fdScheme.InterestRate;
                    decimal t = (decimal)fdScheme.DurationMonths / 12.0m;

                    if (fdScheme.InterestType == "Cumulative")
                    {
                        newFd.MaturityAmount = Math.Round(p * (decimal)Math.Pow((double)(1 + (r / 400m)), (double)(t * 4)), 2);
                    }
                    else
                    {
                        newFd.MaturityAmount = Math.Round(p + (p * r * t / 100m), 2);
                    }

                    _context.FdAccounts.Add(newFd);
                    await _context.SaveChangesAsync();

                    // Voucher
                    var voucher = new Voucher
                    {
                        BranchID = oldAccount.BranchID,
                        VoucherNo = $"JV-RD-REN-{newFd.AccountNo}",
                        VoucherDate = effClosureDate,
                        VoucherType = "Journal",
                        TotalAmount = totalMaturityAmount,
                        Narration = $"आरडी मुदतपूर्ती रक्कम एफडी खात्यावर नूतनीकरण केली: {oldAccount.AccountNo} -> {newFd.AccountNo}",
                        CreatedBy = 1,
                        CreatedOn = DateTime.Now
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    // Dr RD Liability
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = rdLiabilityLedger.LedgerID, DrCr = "Dr", Amount = oldAccount.TotalDepositedAmount, CustomerID = resolvedCustId, MemberID = linkedMemberId });
                    
                    // Dr Interest Payable
                    if (payableLedger != null && accruedInt > 0)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = accruedInt, CustomerID = resolvedCustId, MemberID = linkedMemberId });
                    }

                    // Cr FD Liability
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = fdLiabilityLedger.LedgerID, DrCr = "Cr", Amount = totalMaturityAmount, CustomerID = resolvedCustId, MemberID = linkedMemberId });

                    // Log transactions
                    _context.RdTransactions.Add(new RdTransaction
                    {
                        BranchID = oldAccount.BranchID,
                        RdAccountID = oldAccount.RdAccountID,
                        VoucherID = voucher.VoucherID,
                        TransactionDate = effClosureDate,
                        TransactionType = "Renewal",
                        DebitCredit = "Dr",
                        PrincipalAmount = oldAccount.TotalDepositedAmount,
                        PenaltyAmount = 0,
                        InterestAmount = accruedInt
                    });

                    _context.FdTransactions.Add(new FdTransaction
                    {
                        BranchID = newFd.BranchID,
                        FdAccountID = newFd.FdAccountID,
                        VoucherID = voucher.VoucherID,
                        TransactionDate = DateTime.Now,
                        TransactionType = "Opening",
                        DebitCredit = "Cr",
                        Amount = totalMaturityAmount
                    });

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok(new { Message = "RD renewed to FD successfully", FdAccountNo = newFd.AccountNo });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("Failed to process renewal: " + ex.Message);
                }
            }
        }

        private async Task<object> SyncRdOpeningBalancesInternalAsync()
        {
            // 1. Fetch all active legacy RD accounts
            var legacyAccounts = await _context.RdAccounts
                .Include(a => a.RdScheme)
                .Where(a => a.IsLegacyAccount && a.Status == "Active")
                .ToListAsync();

            var schemes = await _context.RdSchemes.ToListAsync();
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
                // Resolve Liability Ledger (आवर्ती ठेव मुख्य खाते)
                Ledger? liabilityLedger = null;
                if (scheme.RdLiabilityLedgerID.HasValue && scheme.RdLiabilityLedgerID.Value > 0)
                {
                    liabilityLedger = allLedgers.FirstOrDefault(l => l.LedgerID == scheme.RdLiabilityLedgerID.Value);
                }
                if (liabilityLedger == null)
                {
                    liabilityLedger = allLedgers.FirstOrDefault(l =>
                        (l.LedgerName != null && l.LedgerName.Trim() == scheme.SchemeName.Trim()) ||
                        (l.LedgerName != null && (l.LedgerName.Contains("आवर्ती ठेव") || l.LedgerName.Contains("रिकरींग ठेव") || l.LedgerName.Contains("रिकारींग ठेव") || l.LedgerName.Contains("Recurring"))) ||
                        (l.AccountType == "RD" || l.AccountType == "RecurringDeposit"));

                    if (liabilityLedger != null && (!scheme.RdLiabilityLedgerID.HasValue || scheme.RdLiabilityLedgerID == 0))
                    {
                        scheme.RdLiabilityLedgerID = liabilityLedger.LedgerID;
                        _context.Entry(scheme).State = EntityState.Modified;
                    }
                }
                if (liabilityLedger != null)
                {
                    schemeLiabilityMap[scheme.RdSchemeID] = liabilityLedger;
                    affectedLedgerIds.Add(liabilityLedger.LedgerID);
                }

                // Resolve Payable Ledger (आवर्ती ठेव देणे व्याज खाते)
                Ledger? payableLedger = null;
                if (scheme.InterestPayableLedgerID.HasValue && scheme.InterestPayableLedgerID.Value > 0)
                {
                    payableLedger = allLedgers.FirstOrDefault(l => l.LedgerID == scheme.InterestPayableLedgerID.Value);
                }
                if (payableLedger == null)
                {
                    payableLedger = allLedgers.FirstOrDefault(l =>
                        l.LedgerName != null && (
                            l.LedgerName.Contains("देणे आवर्ती") ||
                            l.LedgerName.Contains("देणे रिकरींग") ||
                            (l.LedgerName.Contains("देणे") && (l.LedgerName.Contains("आवर्ती") || l.LedgerName.Contains("रिकरींग")) && l.LedgerName.Contains("व्याज")) ||
                            l.LedgerName.Contains("देय व्याज") ||
                            l.LedgerName.ToLower().Contains("rd interest payable")));

                    if (payableLedger != null && (!scheme.InterestPayableLedgerID.HasValue || scheme.InterestPayableLedgerID == 0))
                    {
                        scheme.InterestPayableLedgerID = payableLedger.LedgerID;
                        _context.Entry(scheme).State = EntityState.Modified;
                    }
                }
                if (payableLedger != null)
                {
                    schemePayableMap[scheme.RdSchemeID] = payableLedger;
                    affectedLedgerIds.Add(payableLedger.LedgerID);
                }
            }

            // Group legacy accounts by resolved Liability Ledger and Customer
            var accountsWithLiabilityLedger = legacyAccounts
                .Where(a => schemeLiabilityMap.ContainsKey(a.RdSchemeID))
                .Select(a => new { Account = a, Ledger = schemeLiabilityMap[a.RdSchemeID] })
                .ToList();

            var liabilityLedgerGroups = accountsWithLiabilityLedger
                .GroupBy(x => x.Ledger.LedgerID)
                .ToList();

            foreach (var lGrp in liabilityLedgerGroups)
            {
                int ledgerId = lGrp.Key;
                var custGroups = lGrp.GroupBy(x => x.Account.CustomerID).ToList();
                var activeCustIds = custGroups.Select(g => g.Key).ToHashSet();

                // 1. Purge orphan CustomerOpeningBalances for this Liability Ledger
                var orphanCustObs = allCustObs.Where(c => c.LedgerID == ledgerId && c.SourceModule == "RD" && !activeCustIds.Contains(c.CustomerID)).ToList();
                if (orphanCustObs.Any())
                {
                    _context.CustomerOpeningBalances.RemoveRange(orphanCustObs);
                    foreach (var o in orphanCustObs) allCustObs.Remove(o);
                }

                // 2. Purge orphan MemberOpeningBalances for this Liability Ledger
                var orphanMemObs = allMemObs.Where(m => m.LedgerID == ledgerId && (m.CustomerID == null || !activeCustIds.Contains(m.CustomerID.Value))).ToList();
                if (orphanMemObs.Any())
                {
                    _context.MemberOpeningBalances.RemoveRange(orphanMemObs);
                    foreach (var o in orphanMemObs) allMemObs.Remove(o);
                }

                foreach (var cGrp in custGroups)
                {
                    int custId = cGrp.Key;
                    decimal custDepositTotal = cGrp.Sum(x => x.Account.TotalDepositedAmount);
                    totalDepositsSynced += custDepositTotal;

                    // Sync CustomerOpeningBalances
                    var custOb = allCustObs.FirstOrDefault(c => c.CustomerID == custId && c.LedgerID == ledgerId);
                    if (custOb != null)
                    {
                        custOb.Amount = custDepositTotal;
                        custOb.BalanceType = "Cr";
                        custOb.SourceModule = "RD";
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
                            SourceModule = "RD",
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
                .Where(a => a.LegacyAccruedInt > 0 && schemePayableMap.ContainsKey(a.RdSchemeID))
                .Select(a => new { Account = a, Ledger = schemePayableMap[a.RdSchemeID] })
                .ToList();

            var payableLedgerGroups = accountsWithPayableLedger
                .GroupBy(x => x.Ledger.LedgerID)
                .ToList();

            foreach (var pGrp in payableLedgerGroups)
            {
                int ledgerId = pGrp.Key;
                var custGroups = pGrp.GroupBy(x => x.Account.CustomerID).ToList();
                var activeCustIds = custGroups.Select(g => g.Key).ToHashSet();

                var orphanCustObs = allCustObs.Where(c => c.LedgerID == ledgerId && c.SourceModule == "RD" && !activeCustIds.Contains(c.CustomerID)).ToList();
                if (orphanCustObs.Any())
                {
                    _context.CustomerOpeningBalances.RemoveRange(orphanCustObs);
                    foreach (var o in orphanCustObs) allCustObs.Remove(o);
                }

                foreach (var cGrp in custGroups)
                {
                    int custId = cGrp.Key;
                    decimal custAccruedTotal = cGrp.Sum(x => x.Account.LegacyAccruedInt);
                    totalAccruedSynced += custAccruedTotal;

                    var custOb = allCustObs.FirstOrDefault(c => c.CustomerID == custId && c.LedgerID == ledgerId);
                    if (custOb != null)
                    {
                        custOb.Amount = custAccruedTotal;
                        custOb.BalanceType = "Cr";
                        custOb.SourceModule = "RD";
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
                            SourceModule = "RD",
                            CreatedBy = 1,
                            CreatedOn = DateTime.Now
                        };
                        _context.CustomerOpeningBalances.Add(newOb);
                        allCustObs.Add(newOb);
                    }
                }
            }

            // Save Customer/Member Opening Balances changes
            await _context.SaveChangesAsync();

            // Update Ledgers Opening Balance
            foreach (var lId in affectedLedgerIds)
            {
                var ledger = allLedgers.FirstOrDefault(l => l.LedgerID == lId);
                if (ledger == null) continue;
                decimal sumObs = allCustObs.Where(c => c.LedgerID == lId).Sum(c => c.Amount);
                ledger.OpeningBalance = sumObs;
                ledger.OpeningBalanceType = "Cr";
                _context.Entry(ledger).State = EntityState.Modified;
            }

            await _context.SaveChangesAsync();
            return new { TotalDepositsSynced = totalDepositsSynced, TotalAccruedSynced = totalAccruedSynced };
        }

        // GET: api/RdAccounts/by-voucher/{voucherId}
        [HttpGet("by-voucher/{voucherId}")]
        public async Task<IActionResult> GetRdAccountByVoucher(int voucherId)
        {
            var voucher = await _context.Vouchers
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Ledger)
                .FirstOrDefaultAsync(v => v.VoucherID == voucherId);

            if (voucher == null)
            {
                return NotFound(new { message = $"व्हाउचर क्र. {voucherId} सिस्टीममध्ये सापडले नाही." });
            }

            RdAccount? account = null;
            string vNo = voucher.VoucherNo ?? "";

            // 1. Try parsing AccountNo from VoucherNo (e.g. JV-RD-OP-00150100000001)
            string? matchedRdOpenPfx = new[] { "REC-RD-OPEN-", "JV-RD-OPEN-", "REC-RD-OP-", "JV-RD-OP-" }.FirstOrDefault(p => vNo.StartsWith(p, StringComparison.OrdinalIgnoreCase)); if (matchedRdOpenPfx != null)
            {
                string accNoCandidate = vNo.Substring(matchedRdOpenPfx.Length).Trim();
                account = await _context.RdAccounts
                    .Include(a => a.Customer)
                    .Include(a => a.RdScheme)
                    .Include(a => a.Branch)
                    .FirstOrDefaultAsync(a => a.AccountNo == accNoCandidate);
            }

            // 2. Try CustomerID in VoucherDetails
            if (account == null)
            {
                var custId = voucher.VoucherDetails.FirstOrDefault(vd => vd.CustomerID.HasValue && vd.CustomerID.Value > 0)?.CustomerID;
                if (custId.HasValue)
                {
                    account = await _context.RdAccounts
                        .Include(a => a.Customer)
                        .Include(a => a.RdScheme)
                        .Include(a => a.Branch)
                        .Where(a => a.CustomerID == custId.Value)
                        .OrderByDescending(a => a.RdAccountID)
                        .FirstOrDefaultAsync();
                }
            }

            if (account == null)
            {
                return NotFound(new { message = $"सदर व्हाउचरशी (ID: {voucherId}) संबंधित आरडी खाते सापडले नाही." });
            }

            // Determine payment mode
            string paymentMode = "Cash";
            int? bankLedgerId = null;
            int? savingAccountId = null;

            var debitDetail = voucher.VoucherDetails.FirstOrDefault(vd => vd.DrCr == "Dr");
            if (debitDetail?.Ledger != null)
            {
                if (BankLedgerHelper.IsBankAccountType(debitDetail.Ledger.AccountType) || BankLedgerHelper.IsBankLedger(debitDetail.Ledger))
                {
                    paymentMode = "Bank";
                    bankLedgerId = debitDetail.LedgerID;
                }
                else if (await Helpers.SavingLedgerHelper.IsConfiguredSavingLiabilityLedgerAsync(_context, debitDetail.LedgerID))
                {
                    paymentMode = account.PaymentMode == "AutoDebit_Saving" ? "AutoDebit_Saving" : "Transfer";
                    var sb = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.CustomerID == account.CustomerID);
                    savingAccountId = sb?.SavingAccountID;
                }
            }

            var seniorCutoffDate = DateTime.Today.AddYears(-60);
            var isSenior = account.Customer != null && account.Customer.BirthDate.HasValue && (account.Customer.BirthDate.Value.Date <= seniorCutoffDate);

            return Ok(new
            {
                rdAccount = new
                {
                    account.RdAccountID,
                    account.BranchID,
                    BranchName = account.Branch?.BranchName ?? "",
                    account.CustomerID,
                    CustomerName = account.Customer != null ? $"{account.Customer.FirstName} {account.Customer.MiddleName} {account.Customer.LastName}".Replace("  ", " ").Trim() : "",
                    CIFNo = account.Customer?.CIFNo ?? "",
                    account.RdSchemeID,
                    SchemeName = account.RdScheme?.SchemeName ?? "",
                    account.AccountNo,
                    account.OpeningDate,
                    account.InstallmentAmount,
                    account.DurationMonths,
                    account.InterestRate,
                    account.MaturityDate,
                    account.MaturityAmount,
                    account.Status,
                    account.NomineeName,
                    account.NomineeRelation,
                    account.Remarks,
                    PaymentMode = paymentMode,
                    BankAccountLedgerID = bankLedgerId,
                    BankLedgerID = bankLedgerId,
                    SavingAccountID = savingAccountId,
                    IsSeniorCitizen = isSenior
                },
                voucher = new
                {
                    voucher.VoucherID,
                    voucher.VoucherNo,
                    voucher.VoucherDate,
                    voucher.VoucherType,
                    voucher.TotalAmount,
                    voucher.Status,
                    voucher.Narration,
                    voucher.ApprovedBy,
                    voucher.ApprovedOn,
                    CanPass = voucher.Status == "Unapproved" || voucher.Status == "Draft" || voucher.Status == "Pending"
                }
            });
        }

        // GET: api/RdAccounts/installment-by-voucher/{voucherId}
        [HttpGet("installment-by-voucher/{voucherId}")]
        public async Task<IActionResult> GetRdInstallmentByVoucher(int voucherId)
        {
            var voucher = await _context.Vouchers
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Ledger)
                .FirstOrDefaultAsync(v => v.VoucherID == voucherId);

            if (voucher == null)
            {
                return NotFound(new { message = $"व्हाउचर क्र. {voucherId} सिस्टीममध्ये सापडले नाही." });
            }

            // 1. Try finding RdTransaction with this VoucherID (or cross-branch sibling RelatedVoucherID)
            var tx = await _context.RdTransactions
                .Include(t => t.RdAccount)
                    .ThenInclude(a => a!.Customer)
                .Include(t => t.RdAccount)
                    .ThenInclude(a => a!.RdScheme)
                .Include(t => t.RdAccount)
                    .ThenInclude(a => a!.Branch)
                .FirstOrDefaultAsync(t => (t.VoucherID == voucherId || (voucher.RelatedVoucherID.HasValue && t.VoucherID == voucher.RelatedVoucherID.Value)) &&
                                          t.TransactionType == "Installment");

            RdAccount? account = tx?.RdAccount;

            // 2. Try parsing AccountNo from VoucherNo (supports formatted 14-digit CBS e.g. JV-RD-COLL-001-502-0000003-5-31 or -P2)
            if (account == null)
            {
                string vNo = voucher.VoucherNo ?? "";
                int markerIdx = vNo.IndexOf("RD-COLL-", StringComparison.OrdinalIgnoreCase);
                if (markerIdx >= 0)
                {
                    string afterMarker = vNo.Substring(markerIdx + "RD-COLL-".Length).Trim();
                    // Strip optional -P2 suffix and trailing -installmentSeq
                    afterMarker = System.Text.RegularExpressions.Regex.Replace(afterMarker, @"-P\d+$", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    int lastDash = afterMarker.LastIndexOf('-');
                    if (lastDash > 0)
                    {
                        string accNo = afterMarker.Substring(0, lastDash).Trim();
                        account = await _context.RdAccounts
                            .Include(a => a.Customer)
                            .Include(a => a.RdScheme)
                            .Include(a => a.Branch)
                            .FirstOrDefaultAsync(a => a.AccountNo == accNo);
                    }
                }
            }

            // 3. Fallback: Search by Customer
            if (account == null)
            {
                var custId = voucher.VoucherDetails.FirstOrDefault(vd => vd.CustomerID.HasValue && vd.CustomerID.Value > 0)?.CustomerID;
                if (custId.HasValue)
                {
                    account = await _context.RdAccounts
                        .Include(a => a.Customer)
                        .Include(a => a.RdScheme)
                        .Include(a => a.Branch)
                        .Where(a => a.CustomerID == custId.Value)
                        .OrderByDescending(a => a.RdAccountID)
                        .FirstOrDefaultAsync();
                }
            }

            if (account == null)
            {
                return NotFound(new { message = $"सदर आरडी हप्ता भरणा व्हाउचरशी (ID: {voucherId}) संबंधित खाते सापडले नाही." });
            }

            var lookupVoucherIds = new List<int> { voucherId };
            if (voucher.RelatedVoucherID.HasValue && voucher.RelatedVoucherID.Value > 0)
            {
                lookupVoucherIds.Add(voucher.RelatedVoucherID.Value);
            }

            var schedules = await _context.RDInstallmentSchedules
                .Where(s => s.VoucherID.HasValue && lookupVoucherIds.Contains(s.VoucherID.Value))
                .OrderBy(s => s.InstallmentNo)
                .ToListAsync();

            int installmentCount = schedules.Count > 0 ? schedules.Count : 1;
            decimal penalty = tx != null ? tx.PenaltyAmount : schedules.Sum(s => s.PenaltyCharged);
            decimal principalDeposit = tx != null && tx.PrincipalAmount > 0
                ? tx.PrincipalAmount
                : Math.Max(0m, voucher.TotalAmount - penalty);

            var lookupVoucherNos = new List<string>();
            if (!string.IsNullOrWhiteSpace(voucher.VoucherNo)) lookupVoucherNos.Add(voucher.VoucherNo);
            if (voucher.RelatedVoucherID.HasValue)
            {
                string? sibNo = await _context.Vouchers
                    .Where(v => v.VoucherID == voucher.RelatedVoucherID.Value)
                    .Select(v => v.VoucherNo)
                    .FirstOrDefaultAsync();
                if (!string.IsNullOrWhiteSpace(sibNo)) lookupVoucherNos.Add(sibNo);
            }

            var linkedSavingTx = lookupVoucherNos.Any()
                ? await _context.SavingTransactions
                    .AsNoTracking()
                    .Include(st => st.SavingAccount)
                    .FirstOrDefaultAsync(st => st.VoucherNo != null && lookupVoucherNos.Contains(st.VoucherNo))
                : null;

            string instPayMode = "Cash";
            int? instBankLedgerId = null;
            int? sourceSavingAccountId = linkedSavingTx?.SavingAccountID;
            string? sourceSavingAccountNo = linkedSavingTx?.SavingAccount?.AccountNo;
            int? sourcePigmyAccountId = null;

            var instDebitDetail = voucher.VoucherDetails.FirstOrDefault(vd => vd.DrCr == "Dr");
            if (linkedSavingTx != null)
            {
                instPayMode = "Saving";
            }
            else if (instDebitDetail?.Ledger != null && BankLedgerHelper.IsBankAccountType(instDebitDetail.Ledger.AccountType))
            {
                instPayMode = "Bank";
                instBankLedgerId = instDebitDetail.LedgerID;
            }
            else if (instDebitDetail != null && await Helpers.SavingLedgerHelper.IsConfiguredSavingLiabilityLedgerAsync(_context, instDebitDetail.LedgerID))
            {
                instPayMode = "Saving";
            }
            else if ((voucher.Narration != null && (voucher.Narration.Contains("पिग्मी") || voucher.Narration.Contains("Pigmy"))) ||
                     (instDebitDetail?.Ledger?.LedgerName != null && (instDebitDetail.Ledger.LedgerName.Contains("पिग्मी") || instDebitDetail.Ledger.LedgerName.Contains("Pigmy"))))
            {
                instPayMode = "Pigmy";
                var pigmyRefCandidates = lookupVoucherNos
                    .SelectMany(n => new[] { n, n.StartsWith("JV-") ? n.Substring(3) : n })
                    .Distinct()
                    .ToList();
                var linkedPigmyTx = await _context.PigmyTransactions
                    .AsNoTracking()
                    .FirstOrDefaultAsync(pt => pt.TransactionType == "RD_TRANSFER" && pt.ReferenceId != null && pigmyRefCandidates.Contains(pt.ReferenceId));
                sourcePigmyAccountId = linkedPigmyTx?.PigmyAccountID;
            }

            return Ok(new
            {
                rdAccount = new
                {
                    account.RdAccountID,
                    account.BranchID,
                    BranchName = account.Branch?.BranchName ?? "",
                    account.CustomerID,
                    CustomerName = account.Customer != null ? $"{account.Customer.FirstName} {account.Customer.MiddleName} {account.Customer.LastName}".Replace("  ", " ").Trim() : "",
                    CIFNo = account.Customer?.CIFNo ?? "",
                    account.RdSchemeID,
                    SchemeName = account.RdScheme?.SchemeName ?? "",
                    account.AccountNo,
                    account.LegacyAccountNumber,
                    account.InstallmentAmount,
                    account.DurationMonths,
                    account.TotalPaidInstallments,
                    account.TotalDepositedAmount,
                    account.InterestRate,
                    account.Status
                },
                installmentDetails = new
                {
                    InstallmentCount = installmentCount,
                    DepositAmount = principalDeposit,
                    PenaltyAmount = penalty,
                    TotalAmount = voucher.TotalAmount,
                    CollectionDate = voucher.VoucherDate,
                    PaymentMode = instPayMode,
                    BankLedgerID = instBankLedgerId,
                    SourceSavingAccountID = sourceSavingAccountId,
                    SourceSavingAccountNo = sourceSavingAccountNo,
                    SourcePigmyAccountID = sourcePigmyAccountId,
                    Narration = voucher.Narration
                },
                voucher = new
                {
                    voucher.VoucherID,
                    voucher.VoucherNo,
                    voucher.VoucherDate,
                    voucher.VoucherType,
                    voucher.TotalAmount,
                    voucher.Status,
                    voucher.Narration,
                    voucher.ApprovedBy,
                    voucher.ApprovedOn,
                    CanPass = voucher.Status == "Unapproved" || voucher.Status == "Draft" || voucher.Status == "Pending"
                }
            });
        }

        // GET: api/RdAccounts/closure-by-voucher/{voucherId}
        [HttpGet("closure-by-voucher/{voucherId}")]
        public Task<IActionResult> GetRdClosureByVoucher(int voucherId)
            => Helpers.RdClosureSettlementHelper.GetClosureByVoucherAsync(_context, voucherId);

        private async Task<IActionResult> GetRdClosureByVoucherLegacyUnused(int voucherId)
        {
            var voucher = await _context.Vouchers
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Ledger)
                .FirstOrDefaultAsync(v => v.VoucherID == voucherId);

            if (voucher == null)
            {
                return NotFound(new { message = $"व्हाउचर क्र. {voucherId} सिस्टीममध्ये सापडले नाही." });
            }

            // 1. Try finding RdTransaction
            var tx = await _context.RdTransactions
                .Include(t => t.RdAccount)
                    .ThenInclude(a => a!.Customer)
                .Include(t => t.RdAccount)
                    .ThenInclude(a => a!.RdScheme)
                .Include(t => t.RdAccount)
                    .ThenInclude(a => a!.Branch)
                .FirstOrDefaultAsync(t => t.VoucherID == voucherId && (t.TransactionType == "Payout" || t.TransactionType == "Premature_Close" || t.TransactionType == "Renewal"));

            RdAccount? account = tx?.RdAccount;

            // 2. Parse from VoucherNo (e.g. JV-RD-CLOSE-..., JV-RD-PRECLOSE-...)
            if (account == null)
            {
                string vNo = voucher.VoucherNo ?? "";
                string accNoCandidate = "";
                if (vNo.StartsWith("JV-RD-CLOSE-")) accNoCandidate = vNo.Substring("JV-RD-CLOSE-".Length).Trim();
                else if (vNo.StartsWith("JV-RD-PRECLOSE-")) accNoCandidate = vNo.Substring("JV-RD-PRECLOSE-".Length).Trim();

                if (!string.IsNullOrEmpty(accNoCandidate))
                {
                    account = await _context.RdAccounts
                        .Include(a => a.Customer)
                        .Include(a => a.RdScheme)
                        .Include(a => a.Branch)
                        .FirstOrDefaultAsync(a => a.AccountNo == accNoCandidate);
                }
            }

            // 3. Fallback: Search by Customer
            if (account == null)
            {
                var custId = voucher.VoucherDetails.FirstOrDefault(vd => vd.CustomerID.HasValue && vd.CustomerID.Value > 0)?.CustomerID;
                if (custId.HasValue)
                {
                    account = await _context.RdAccounts
                        .Include(a => a.Customer)
                        .Include(a => a.RdScheme)
                        .Include(a => a.Branch)
                        .Where(a => a.CustomerID == custId.Value)
                        .OrderByDescending(a => a.RdAccountID)
                        .FirstOrDefaultAsync();
                }
            }

            if (account == null)
            {
                return NotFound(new { message = $"सदर आरडी क्लोजरशी (ID: {voucherId}) संबंधित खाते सापडले नाही." });
            }

            string closureType = (voucher.VoucherNo?.Contains("PRECLOSE") == true) ? "PrematureClose" : "MaturityClose";
            string closurePaymentMode = "Cash";
            int? closureBankLedgerId = null;
            int? closureSavingAccountId = null;
            var closureCreditDetail = voucher.VoucherDetails.FirstOrDefault(vd => vd.DrCr == "Cr" && vd.Ledger != null && BankLedgerHelper.IsBankAccountType(vd.Ledger.AccountType));
            if (closureCreditDetail != null)
            {
                closurePaymentMode = "Bank";
                closureBankLedgerId = closureCreditDetail.LedgerID;
            }
            else
            {
                foreach (var crLine in voucher.VoucherDetails.Where(vd => vd.DrCr == "Cr"))
                {
                    if (await Helpers.SavingLedgerHelper.IsConfiguredSavingLiabilityLedgerAsync(_context, crLine.LedgerID))
                    {
                        closurePaymentMode = "Transfer";
                        var sb = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.CustomerID == account.CustomerID && s.Status == "Active");
                        closureSavingAccountId = sb?.SavingAccountID;
                        break;
                    }
                }
            }

            return Ok(new
            {
                rdAccount = new
                {
                    account.RdAccountID,
                    account.BranchID,
                    BranchName = account.Branch?.BranchName ?? "",
                    account.CustomerID,
                    CustomerName = account.Customer != null ? $"{account.Customer.FirstName} {account.Customer.MiddleName} {account.Customer.LastName}".Replace("  ", " ").Trim() : "",
                    CIFNo = account.Customer?.CIFNo ?? "",
                    account.RdSchemeID,
                    SchemeName = account.RdScheme?.SchemeName ?? "",
                    account.AccountNo,
                    account.LegacyAccountNumber,
                    account.InstallmentAmount,
                    account.DurationMonths,
                    account.TotalPaidInstallments,
                    account.TotalDepositedAmount,
                    account.OpeningDate,
                    account.MaturityDate,
                    account.MaturityAmount,
                    account.Status
                },
                closureDetails = new
                {
                    ClosureDate = tx?.TransactionDate ?? voucher.VoucherDate,
                    ClosureType = closureType,
                    TotalPayoutAmount = voucher.TotalAmount,
                    PaymentMode = closurePaymentMode,
                    BankLedgerID = closureBankLedgerId,
                    SavingAccountID = closureSavingAccountId,
                    Narration = voucher.Narration
                },
                voucher = new
                {
                    voucher.VoucherID,
                    voucher.VoucherNo,
                    voucher.VoucherDate,
                    voucher.VoucherType,
                    voucher.TotalAmount,
                    voucher.Status,
                    voucher.Narration,
                    voucher.ApprovedBy,
                    voucher.ApprovedOn,
                    CanPass = voucher.Status == "Unapproved" || voucher.Status == "Draft" || voucher.Status == "Pending"
                }
            });
        }
    }
}
