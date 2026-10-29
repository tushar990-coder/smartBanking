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
using Bhisi.Api.Helpers;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [Route("api/SavingAccountMasters")]
    [ApiController]
    [EnforceBranchScope]
    public class SavingAccountsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SavingAccountsController(AppDbContext context)
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
        private async Task<string> GenerateNextSavingAccountNo(int branchId, int? schemeId = null, bool incrementSequence = false)
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

            // 2. Scheme Code: 3 numeric digits (e.g. 101, 102)
            int schemeCodeNum = 101;
            if (schemeId.HasValue && schemeId.Value > 0)
            {
                var scheme = await _context.SavingInterestSettings.FindAsync(schemeId.Value);
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

            // 3. Sequence: Scan all existing saving accounts to find the maximum existing sequence number
            var existingAccNos = await _context.SavingAccountMasters
                .Where(s => s.BranchID == branchId && !string.IsNullOrWhiteSpace(s.AccountNo))
                .Select(s => s.AccountNo)
                .ToListAsync();

            int maxExistingSeq = 0;
            foreach (var accNo in existingAccNos)
            {
                var digits = new string(accNo.Where(char.IsDigit).ToArray());
                if (digits.Length == 14)
                {
                    // Format: [3-digit Branch][3-digit Scheme][7-digit Seq][1-digit Luhn]
                    if (int.TryParse(digits.Substring(6, 7), out int parsedSeq) && parsedSeq > maxExistingSeq)
                    {
                        maxExistingSeq = parsedSeq;
                    }
                }
            }

            var seq = await _context.SavingAccountSequences
                .FirstOrDefaultAsync(s => s.BranchID == branchId && s.SchemeCodeNumeric == schemeCodeNum);

            if (seq == null)
            {
                int initialVal = Math.Max(existingAccNos.Count, maxExistingSeq);
                seq = new SavingAccountSequence
                {
                    BranchID = branchId,
                    SchemeCodeNumeric = schemeCodeNum,
                    LastSequenceNumber = initialVal,
                    UpdatedOn = DateTime.UtcNow
                };
                _context.SavingAccountSequences.Add(seq);
                await _context.SaveChangesAsync();
            }
            else
            {
                if (maxExistingSeq > seq.LastSequenceNumber)
                {
                    seq.LastSequenceNumber = maxExistingSeq;
                    seq.UpdatedOn = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }
            }

            int currentVal = Math.Max(seq.LastSequenceNumber, maxExistingSeq);
            int nextSeqNumber = currentVal + 1;

            string thirteenDigits = $"{branchCode3}{schemeCode3}{nextSeqNumber:D7}";
            int checkDigit = LuhnHelper.CalculateCheckDigit(thirteenDigits);
            string candidate = $"{thirteenDigits}{checkDigit}";

            while (existingAccNos.Contains(candidate) || await _context.SavingAccountMasters.AnyAsync(s => s.BranchID == branchId && s.AccountNo == candidate))
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

        // GET: api/SavingAccounts/next-account-no?branchId=1&schemeId=1
        [HttpGet("next-account-no")]
        [HttpGet("next-account-no/{branchId:int?}")]
        public async Task<ActionResult<object>> GetNextAccountNo(
            int? branchId = null, 
            [FromQuery(Name = "branchId")] int? queryBranchId = null,
            [FromQuery(Name = "schemeId")] int? schemeId = null,
            [FromQuery(Name = "settingId")] int? settingId = null)
        {
            int targetBranchId = branchId ?? queryBranchId ?? 1;
            int? targetSchemeId = schemeId ?? settingId;
            string nextNo = await GenerateNextSavingAccountNo(targetBranchId, targetSchemeId, incrementSequence: false);
            string formattedNo = LuhnHelper.Format14Digit(nextNo);
            return Ok(new { 
                nextAccountNo = nextNo, 
                accountNo = nextNo,
                formattedAccountNo = formattedNo,
                displayAccountNo = formattedNo
            });
        }

        // GET: api/SavingAccounts
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetSavingAccountMasters(
            [FromQuery] int? branchId = null, 
            [FromQuery] int? customerId = null,
            [FromQuery] string? search = null)
        {
            branchId = User.ResolveOptionalBranchId(branchId);
            var query = _context.SavingAccountMasters.AsNoTracking().AsQueryable();
            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(s => s.BranchID == branchId.Value);
            }
            if (customerId.HasValue && customerId.Value > 0)
            {
                query = query.Where(s => s.CustomerID == customerId.Value || s.JointHolders.Any(jh => jh.CustomerID == customerId.Value));
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                string sTerm = search.Trim();
                // Clean formatted number digits if searching with dashes
                string digitsOnly = new string(sTerm.Where(char.IsDigit).ToArray());

                query = query.Where(s => 
                    s.AccountNo.Contains(sTerm) ||
                    (digitsOnly.Length >= 4 && s.AccountNo.Contains(digitsOnly)) ||
                    (s.OldAccountNo != null && s.OldAccountNo.Contains(sTerm)) ||
                    (s.LegacyAccountNumber != null && s.LegacyAccountNumber.Contains(sTerm)) ||
                    (s.Customer != null && (
                        s.Customer.FirstName.Contains(sTerm) || 
                        s.Customer.LastName.Contains(sTerm) || 
                        (s.Customer.MobileNo != null && s.Customer.MobileNo.Contains(sTerm)) || 
                        (s.Customer.CIFNo != null && s.Customer.CIFNo.Contains(sTerm))
                    ))
                );
            }

            query = query.OrderBy(s => s.AccountNo);

            var today = DateTime.Today;
            var allSchemes = await _context.SavingInterestSettings
                .AsNoTracking()
                .OrderByDescending(s => s.EffectiveDate <= today)
                .ThenByDescending(s => s.EffectiveDate)
                .ThenByDescending(s => s.SettingID)
                .ToListAsync();

            var rawAccounts = await query
                .Include(s => s.Customer)
                .Include(s => s.Branch)
                .Include(s => s.Ledger)
                .Include(s => s.SavingScheme)
                .Include(s => s.JointHolders)
                    .ThenInclude(jh => jh.Customer)
                .ToListAsync();

            var accounts = rawAccounts.Select(s => {
                var matchedScheme = s.SavingScheme
                    ?? (s.SavingSchemeID.HasValue && s.SavingSchemeID.Value > 0
                        ? allSchemes.FirstOrDefault(x => x.SettingID == s.SavingSchemeID.Value)
                        : null)
                    ?? (s.LedgerID > 0
                        ? allSchemes.FirstOrDefault(x => x.SavingLiabilityLedgerID == s.LedgerID || x.LedgerID == s.LedgerID)
                        : null)
                    ?? (allSchemes.Count == 1 ? allSchemes[0] : null);

                decimal effectiveMinBal = Helpers.SavingLedgerHelper.ResolveEffectiveMinimumBalance(s, matchedScheme);
                decimal availableBal = Math.Max(0m, s.CurrentBalance - s.LienAmount - effectiveMinBal);

                return new {
                    s.SavingAccountID,
                    s.BranchID,
                    BranchName = s.Branch != null ? s.Branch.BranchName : "",
                    BranchCode = s.Branch != null ? s.Branch.BranchCode : "",
                    s.AccountNo,
                    FormattedAccountNo = LuhnHelper.Format14Digit(s.AccountNo),
                    PreviousAccountNo = s.OldAccountNo,
                    SavingSchemeID = matchedScheme != null ? (int?)matchedScheme.SettingID : s.SavingSchemeID,
                    SchemeName = matchedScheme != null && !string.IsNullOrWhiteSpace(matchedScheme.SchemeName)
                        ? matchedScheme.SchemeName
                        : "सर्वसाधारण बचत ठेव",
                    s.CustomerID,
                    CIFNo = s.Customer != null ? s.Customer.CIFNo : "",
                    CustomerName = s.Customer != null 
                        ? (s.Customer.FirstName + (string.IsNullOrWhiteSpace(s.Customer.MiddleName) ? "" : " " + s.Customer.MiddleName) + " " + s.Customer.LastName).Trim()
                        : "",
                    CustomerNameEng = s.Customer != null 
                        ? (s.Customer.FirstNameEng + (string.IsNullOrWhiteSpace(s.Customer.MiddleNameEng) ? "" : " " + s.Customer.MiddleNameEng) + " " + s.Customer.LastNameEng).Trim()
                        : "",
                    MobileNo = s.Customer != null ? (s.Customer.MobileNo ?? "") : "",
                    AadhaarNo = s.Customer != null ? (s.Customer.AadhaarNo ?? "") : "",
                    PANNo = s.Customer != null ? (s.Customer.PANNo ?? "") : "",
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
                    MinimumBalance = effectiveMinBal,
                    AvailableBalance = availableBal,
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
                        jh.CustomerID,
                        CIFNo = jh.Customer != null ? (jh.Customer.CIFNo ?? "") : "",
                        CustomerName = jh.Customer != null 
                            ? (jh.Customer.FirstName + (string.IsNullOrWhiteSpace(jh.Customer.MiddleName) ? "" : " " + jh.Customer.MiddleName) + " " + jh.Customer.LastName).Trim()
                            : "",
                        MobileNo = jh.Customer != null ? (jh.Customer.MobileNo ?? "") : ""
                    }).ToList()
                };
            }).ToList();

            return Ok(accounts);
        }

        // GET: api/SavingAccounts/ByCustomer/5
        [HttpGet("ByCustomer/{customerId}")]
        public async Task<ActionResult<IEnumerable<object>>> GetSavingAccountsByCustomer(int customerId)
        {
            return await GetSavingAccountMasters(branchId: null, customerId: customerId);
        }

        // GET: api/SavingAccounts/5
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetSavingAccountMaster(int id)
        {
            var s = await _context.SavingAccountMasters
                .Include(sa => sa.Customer)
                .Include(sa => sa.Branch)
                .Include(sa => sa.Ledger)
                .Include(sa => sa.SavingScheme)
                .Include(sa => sa.JointHolders)
                    .ThenInclude(jh => jh.Customer)
                .FirstOrDefaultAsync(m => m.SavingAccountID == id);

            if (s == null)
            {
                return NotFound();
            }

            var matchedScheme = await Helpers.SavingLedgerHelper.ResolveSavingSchemeAsync(_context, s);
            decimal effectiveMinBal = Helpers.SavingLedgerHelper.ResolveEffectiveMinimumBalance(s, matchedScheme);
            decimal availableBal = Math.Max(0m, s.CurrentBalance - s.LienAmount - effectiveMinBal);

            return new {
                s.SavingAccountID,
                s.BranchID,
                BranchName = s.Branch != null ? s.Branch.BranchName : "",
                BranchCode = s.Branch != null ? s.Branch.BranchCode : "",
                s.AccountNo,
                FormattedAccountNo = LuhnHelper.Format14Digit(s.AccountNo),
                PreviousAccountNo = s.OldAccountNo,
                SavingSchemeID = matchedScheme != null ? (int?)matchedScheme.SettingID : s.SavingSchemeID,
                SchemeName = matchedScheme != null && !string.IsNullOrWhiteSpace(matchedScheme.SchemeName)
                    ? matchedScheme.SchemeName
                    : "सर्वसाधारण बचत ठेव",
                s.CustomerID,
                CIFNo = s.Customer != null ? s.Customer.CIFNo : "",
                CustomerName = s.Customer != null 
                    ? $"{s.Customer.FirstName} {s.Customer.LastName}".Trim()
                    : "",
                CustomerNameEng = s.Customer != null 
                    ? $"{s.Customer.FirstNameEng} {s.Customer.LastNameEng}".Trim()
                    : "",
                MobileNo = s.Customer != null ? (s.Customer.MobileNo ?? "") : "",
                AadhaarNo = s.Customer != null ? (s.Customer.AadhaarNo ?? "") : "",
                PANNo = s.Customer != null ? (s.Customer.PANNo ?? "") : "",
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
                MinimumBalance = effectiveMinBal,
                AvailableBalance = availableBal,
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
                    jh.CustomerID,
                    CIFNo = jh.Customer != null ? (jh.Customer.CIFNo ?? "") : "",
                    CustomerName = jh.Customer != null 
                        ? $"{jh.Customer.FirstName} {jh.Customer.LastName}".Trim() 
                        : "",
                    MobileNo = jh.Customer != null ? (jh.Customer.MobileNo ?? "") : ""
                }).ToList()
            };
        }

        // DTO for creating saving account with joint holders
        public class CreateSavingAccountDto
        {
            public int BranchID { get; set; } = 1;
            public string? AccountNo { get; set; }
            public int? CustomerID { get; set; }
            public string AccountType { get; set; } = "Personal";
            public DateTime OpeningDate { get; set; } = DateTime.Today;
            public bool IsLegacyAccount { get; set; } = false;
            public string? PreviousAccountNo { get; set; }
            public string? OldAccountNo { get; set; }
            public string? LegacyAccountNumber { get; set; }
            public int LedgerID { get; set; }
            public decimal OpeningBalance { get; set; } = 0;
            public string? InitialPaymentMode { get; set; } = "Cash";
            public int? BankLedgerID { get; set; }
            public decimal InterestRate { get; set; } = 0;
            public decimal? MinimumBalance { get; set; }
            public decimal LienAmount { get; set; } = 0;
            public string? LienReason { get; set; }
            public string Status { get; set; } = "Active";
            public string? NomineeName { get; set; }
            public string? NomineeRelation { get; set; }
            public string? NomineeAddress { get; set; }
            public int? SettingID { get; set; }
            public int? SavingSchemeID { get; set; }
            public DateTime? LastInterestPostingDate { get; set; }
            public decimal? LastInterestAmount { get; set; }
            public List<int>? JointHolderCustomerIDs { get; set; }
        }

        private async Task<(Customer? customer, string? errorMessage)> ResolveEntityAsync(int? customerId, int branchId)
        {
            if (!customerId.HasValue || customerId.Value <= 0)
            {
                return (null, "कृपया खातेदाराची (Customer) निवड करा.");
            }

            var customer = await _context.Customers.FindAsync(customerId.Value);
            if (customer == null)
            {
                return (null, "निवडलेला ग्राहक अस्तित्वात नाही.");
            }

            return (customer, null);
        }

        // POST: api/SavingAccounts
        [HttpPost]
        public async Task<ActionResult<object>> PostSavingAccountMaster([FromBody] CreateSavingAccountDto dto)
        {
            // Multi-branch Security: Enforce branch lock for non-HO users
            int userBranchId = User.GetOperatingBranchId();
            bool isHO = User.IsHeadOfficeAdmin();

            if (!isHO && userBranchId > 0)
            {
                dto.BranchID = userBranchId;
            }

            var branch = await _context.Branches.FindAsync(dto.BranchID);
            if (branch == null) return BadRequest("निवडलेली शाखा सापडली नाही.");

            int? targetSchemeId = dto.SavingSchemeID ?? dto.SettingID;
            int targetLedgerId = await Helpers.SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(
                _context,
                explicitLedgerId: dto.LedgerID > 0 ? dto.LedgerID : null,
                explicitSchemeId: targetSchemeId);
            if (targetLedgerId <= 0)
            {
                return BadRequest(Helpers.SavingLedgerHelper.GetMissingMappingErrorMessage());
            }

            var matchedScheme = await Helpers.SavingLedgerHelper.ResolveSavingSchemeAsync(
                _context,
                explicitSchemeId: targetSchemeId,
                explicitLedgerId: targetLedgerId);

            if ((!targetSchemeId.HasValue || targetSchemeId.Value <= 0) && matchedScheme != null)
            {
                targetSchemeId = matchedScheme.SettingID;
            }

            // Auto-sync interest rate from active SavingInterestSetting if interest rate is not provided
            if (dto.InterestRate <= 0)
            {
                if (matchedScheme != null && matchedScheme.InterestRate > 0)
                {
                    dto.InterestRate = matchedScheme.InterestRate;
                }
                else
                {
                    dto.InterestRate = 4.0m;
                }
            }

            decimal resolvedMinBalance = dto.MinimumBalance.HasValue
                ? Math.Max(0m, dto.MinimumBalance.Value)
                : Math.Max(0m, matchedScheme?.MinimumBalance ?? 0m);

            var (customer, errorMsg) = await ResolveEntityAsync(dto.CustomerID, dto.BranchID);
            if (!string.IsNullOrEmpty(errorMsg) || customer == null)
            {
                return BadRequest(errorMsg ?? "कृपया खातेदाराची (Customer) निवड करा.");
            }

            if (customer.Status != "Active")
            {
                return BadRequest($"या खातेदाराचे स्टेटस '{customer.Status}' असल्यामुळे नवीन बचत खाते उघडता येत नाही. केवळ सक्रिय (Active) खातेदारांचेच खाते उघडता येते.");
            }

            int schemeCodeNum = 101;
            if (targetSchemeId.HasValue && targetSchemeId.Value > 0)
            {
                var scheme = await _context.SavingInterestSettings.FindAsync(targetSchemeId.Value);
                if (scheme != null && !string.IsNullOrWhiteSpace(scheme.SchemeCode))
                {
                    var sDigits = new string(scheme.SchemeCode.Where(char.IsDigit).ToArray());
                    if (!string.IsNullOrEmpty(sDigits) && int.TryParse(sDigits, out int parsedScheme) && parsedScheme > 0)
                    {
                        schemeCodeNum = parsedScheme;
                    }
                }
            }

            string? previewLegacyNo = !string.IsNullOrWhiteSpace(dto.LegacyAccountNumber)
                ? dto.LegacyAccountNumber.Trim()
                : (!string.IsNullOrWhiteSpace(dto.OldAccountNo) ? dto.OldAccountNo.Trim() : dto.PreviousAccountNo?.Trim());
            bool willBeLegacyAccount = dto.IsLegacyAccount || !string.IsNullOrWhiteSpace(previewLegacyNo);

            int validatedInitialBankLedgerId = 0;
            if (dto.OpeningBalance > 0 && !willBeLegacyAccount && BankLedgerHelper.IsBankPaymentMode(dto.InitialPaymentMode))
            {
                var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(_context, dto.BankLedgerID);
                if (!bankCheck.IsValid)
                {
                    return BadRequest(bankCheck.ErrorMessage);
                }
                validatedInitialBankLedgerId = bankCheck.LedgerId;
            }

            // Determine account number: Custom (editable) or auto-generated CBS
            string finalAccountNo;
            if (!string.IsNullOrWhiteSpace(dto.AccountNo) && dto.AccountNo != "AUTO")
            {
                finalAccountNo = dto.AccountNo.Trim();
                bool exists = await _context.SavingAccountMasters.AnyAsync(s => s.AccountNo == finalAccountNo);
                if (exists)
                {
                    return BadRequest($"बचत खाते क्रमांक '{finalAccountNo}' आधीच अस्तित्वात आहे. कृपया दुसरा खाते क्रमांक निवडा.");
                }

                // Sync sequence tracking if 14-digit CBS format
                var digitsOnly = new string(finalAccountNo.Where(char.IsDigit).ToArray());
                if (digitsOnly.Length == 14)
                {
                    string seqPart = digitsOnly.Substring(6, 7);
                    if (int.TryParse(seqPart, out int sVal) && sVal > 0)
                    {
                        var seq = await _context.SavingAccountSequences
                            .FirstOrDefaultAsync(s => s.BranchID == dto.BranchID && s.SchemeCodeNumeric == schemeCodeNum);
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
                            _context.SavingAccountSequences.Add(new SavingAccountSequence
                            {
                                BranchID = dto.BranchID,
                                SchemeCodeNumeric = schemeCodeNum,
                                LastSequenceNumber = sVal,
                                UpdatedOn = DateTime.UtcNow
                            });
                            await _context.SaveChangesAsync();
                        }
                    }
                }
            }
            else
            {
                finalAccountNo = await GenerateNextSavingAccountNo(dto.BranchID, targetSchemeId, incrementSequence: true);
            }

            string? legacyNo = !string.IsNullOrWhiteSpace(dto.LegacyAccountNumber) 
                ? dto.LegacyAccountNumber.Trim() 
                : (!string.IsNullOrWhiteSpace(dto.OldAccountNo) ? dto.OldAccountNo.Trim() : dto.PreviousAccountNo?.Trim());

            if (!string.IsNullOrWhiteSpace(legacyNo))
            {
                bool legacyExists = await _context.SavingAccountMasters.AnyAsync(s => 
                    s.BranchID == dto.BranchID && 
                    ((s.LegacyAccountNumber != null && s.LegacyAccountNumber.Trim() == legacyNo) || 
                     (s.OldAccountNo != null && s.OldAccountNo.Trim() == legacyNo)));
                if (legacyExists)
                {
                    return BadRequest($"जुना बचत खाते क्रमांक '{legacyNo}' या शाखेत आधीच अस्तित्वात आहे.");
                }
            }

            var savingAccount = new SavingAccountMaster
            {
                BranchID = dto.BranchID,
                AccountNo = finalAccountNo,
                SavingSchemeID = matchedScheme?.SettingID ?? targetSchemeId,
                CustomerID = customer.CustomerID,
                AccountType = dto.AccountType,
                OpeningDate = dto.OpeningDate,
                IsLegacyAccount = dto.IsLegacyAccount || !string.IsNullOrWhiteSpace(legacyNo),
                OldAccountNo = legacyNo,
                LegacyAccountNumber = legacyNo,
                LedgerID = targetLedgerId,
                OpeningBalance = dto.OpeningBalance,
                CurrentBalance = dto.OpeningBalance,
                InterestRate = dto.InterestRate,
                MinimumBalance = resolvedMinBalance,
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

            // Add Joint Holders with Customer
            if (dto.AccountType == "Joint" && dto.JointHolderCustomerIDs != null && dto.JointHolderCustomerIDs.Count > 0)
            {
                var rawIds = dto.JointHolderCustomerIDs
                    .Where(id => id > 0 && id != customer.CustomerID)
                    .Distinct()
                    .ToList();

                if (rawIds.Count > 0)
                {
                    foreach (var id in rawIds)
                    {
                        var jhCust = await _context.Customers.FindAsync(id);
                        if (jhCust != null)
                        {
                            var jointHolder = new SavingAccountJointHolder
                            {
                                SavingAccountID = savingAccount.SavingAccountID,
                                CustomerID = jhCust.CustomerID,
                                CreatedOn = DateTime.Now
                            };
                            _context.SavingAccountJointHolders.Add(jointHolder);
                        }
                    }
                    await _context.SaveChangesAsync();
                }
            }

            // Generate Cash Receipt Voucher and Transaction for standard new Account opening
            if (savingAccount.OpeningBalance > 0 && !savingAccount.IsLegacyAccount)
            {
                // 1. Resolve Branch-Specific Cash Ledger
                bool isBankInitialDeposit = BankLedgerHelper.IsBankPaymentMode(dto.InitialPaymentMode);
                int cashLedgerId = isBankInitialDeposit
                    ? validatedInitialBankLedgerId
                    : await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, savingAccount.BranchID, "SAVINGS");

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
                    Narration = $"नवीन बचत खाते उघडणे - आरंभिक {(isBankInitialDeposit ? "बँक ट्रान्सफर" : "रोख")} ठेव जमा (खाते क्र.: {savingAccount.AccountNo})",
                    CreatedBy = savingAccount.CreatedBy,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        new VoucherDetail { LedgerID = cashLedgerId, DrCr = "Dr", Amount = savingAccount.OpeningBalance, CustomerID = savingAccount.CustomerID },
                        new VoucherDetail { LedgerID = savingAccount.LedgerID, DrCr = "Cr", Amount = savingAccount.OpeningBalance, CustomerID = savingAccount.CustomerID }
                    }
                };
                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();

                // 3. Add Saving Transaction linked to Voucher
                var txn = new SavingTransaction
                {
                    SavingAccountID = savingAccount.SavingAccountID,
                    CustomerID = savingAccount.CustomerID,
                    BranchID = savingAccount.BranchID,
                    TransactionDate = savingAccount.OpeningDate,
                    TransactionType = "Deposit",
                    PaymentMode = (!savingAccount.IsLegacyAccount && BankLedgerHelper.IsBankPaymentMode(dto.InitialPaymentMode)) ? "Bank" : "Cash",
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
            if (branch == null) return BadRequest(new { message = "निवडलेली शाखा सापडली नाही." });

            var (customer, errorMsg) = await ResolveEntityAsync(dto.CustomerID, dto.BranchID);
            if (!string.IsNullOrEmpty(errorMsg) || customer == null)
            {
                return BadRequest(new { message = errorMsg ?? "कृपया वैध खातेदाराची निवड करा." });
            }

            int? targetSchemeId = dto.SavingSchemeID ?? dto.SettingID;
            int targetLedgerId = await Helpers.SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(
                _context,
                explicitLedgerId: dto.LedgerID > 0 ? dto.LedgerID : null,
                explicitSchemeId: targetSchemeId);
            if (targetLedgerId <= 0)
            {
                return BadRequest(new { message = Helpers.SavingLedgerHelper.GetMissingMappingErrorMessage() });
            }

            var matchedMigrateScheme = await Helpers.SavingLedgerHelper.ResolveSavingSchemeAsync(
                _context,
                explicitSchemeId: targetSchemeId,
                explicitLedgerId: targetLedgerId);

            if ((!targetSchemeId.HasValue || targetSchemeId.Value <= 0) && matchedMigrateScheme != null)
            {
                targetSchemeId = matchedMigrateScheme.SettingID;
            }

            if (dto.InterestRate <= 0 && matchedMigrateScheme != null && matchedMigrateScheme.InterestRate > 0)
            {
                dto.InterestRate = matchedMigrateScheme.InterestRate;
            }

            decimal resolvedMigrateMinBal = dto.MinimumBalance.HasValue
                ? Math.Max(0m, dto.MinimumBalance.Value)
                : Math.Max(0m, matchedMigrateScheme?.MinimumBalance ?? 0m);

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                string generatedAccountNo = await GenerateNextSavingAccountNo(dto.BranchID, targetSchemeId, incrementSequence: true);

                var savingAccount = new SavingAccountMaster
                {
                    BranchID = dto.BranchID,
                    AccountNo = generatedAccountNo,
                    SavingSchemeID = matchedMigrateScheme?.SettingID ?? targetSchemeId,
                    CustomerID = customer.CustomerID,
                    AccountType = string.IsNullOrWhiteSpace(dto.AccountType) ? "Personal" : dto.AccountType,
                    OpeningDate = dto.OpeningDate != default ? dto.OpeningDate : DateTime.Today,
                    IsLegacyAccount = true,
                    OldAccountNo = dto.OldAccountNo ?? dto.PreviousAccountNo ?? dto.LegacyAccountNumber,
                    LegacyAccountNumber = dto.OldAccountNo ?? dto.PreviousAccountNo ?? dto.LegacyAccountNumber,
                    LedgerID = targetLedgerId,
                    OpeningBalance = dto.OpeningBalance,
                    CurrentBalance = dto.OpeningBalance,
                    InterestRate = dto.InterestRate,
                    MinimumBalance = resolvedMigrateMinBal,
                    LienAmount = dto.LienAmount,
                    LienReason = dto.LienReason,
                    Status = string.IsNullOrWhiteSpace(dto.Status) ? "Active" : dto.Status,
                    NomineeName = dto.NomineeName,
                    NomineeRelation = dto.NomineeRelation,
                    NomineeAddress = dto.NomineeAddress,
                    LastInterestPostingDate = dto.LastInterestPostingDate,
                    LastInterestAmount = dto.LastInterestAmount,
                    CreatedOn = DateTime.Now
                };

                _context.SavingAccountMasters.Add(savingAccount);
                await _context.SaveChangesAsync();

                // Add Joint Holders for Migrated Joint Saving Account
                if (dto.AccountType == "Joint" && dto.JointHolderCustomerIDs != null && dto.JointHolderCustomerIDs.Count > 0)
                {
                    var rawIds = dto.JointHolderCustomerIDs
                        .Where(id => id > 0 && id != customer.CustomerID)
                        .Distinct()
                        .ToList();

                    if (rawIds.Count > 0)
                    {
                        foreach (var id in rawIds)
                        {
                            var jhCust = await _context.Customers.FindAsync(id);
                            if (jhCust != null)
                            {
                                var jointHolder = new SavingAccountJointHolder
                                {
                                    SavingAccountID = savingAccount.SavingAccountID,
                                    CustomerID = jhCust.CustomerID,
                                    CreatedOn = DateTime.Now
                                };
                                _context.SavingAccountJointHolders.Add(jointHolder);
                            }
                        }
                        await _context.SaveChangesAsync();
                    }
                }

                // Update Ledger Opening Balance
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
                    await _context.SaveChangesAsync();
                }

                // Audit in CustomerOpeningBalances
                var custOb = new CustomerOpeningBalance
                {
                    CustomerID = customer.CustomerID,
                    LedgerID = savingAccount.LedgerID,
                    Amount = savingAccount.OpeningBalance,
                    BalanceType = "Cr",
                    SourceModule = "Saving",
                    CreatedBy = savingAccount.CreatedBy,
                    CreatedOn = DateTime.Now
                };
                _context.CustomerOpeningBalances.Add(custOb);

                // Initial Saving Transaction (Deposit)
                var txn = new SavingTransaction
                {
                    SavingAccountID = savingAccount.SavingAccountID,
                    CustomerID = customer.CustomerID,
                    BranchID = savingAccount.BranchID,
                    TransactionDate = savingAccount.OpeningDate,
                    TransactionType = "Deposit",
                    PaymentMode = (!savingAccount.IsLegacyAccount && BankLedgerHelper.IsBankPaymentMode(dto.InitialPaymentMode)) ? "Bank" : "Cash",
                    Amount = savingAccount.OpeningBalance,
                    BalanceAfterTxn = savingAccount.OpeningBalance,
                    Narration = "Opening Balance",
                    CreatedBy = savingAccount.CreatedBy,
                    CreatedOn = DateTime.Now
                };
                _context.SavingTransactions.Add(txn);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                return Ok(new 
                { 
                    savingAccountID = savingAccount.SavingAccountID, 
                    accountNo = savingAccount.AccountNo,
                    customerID = savingAccount.CustomerID,
                    message = "बचत खाते स्थलांतर यशस्वी झाले!" 
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new 
                { 
                    message = "बचत खाते सुरुवातीची शिल्लक सेव्ह करताना तांत्रिक त्रुटी आली.",
                    detail = ex.Message,
                    innerDetail = ex.InnerException?.Message
                });
            }
        }

        // DTO for updating saving account
        public class UpdateSavingAccountDto
        {
            public int SavingAccountID { get; set; }
            public int BranchID { get; set; } = 1;
            public int CustomerID { get; set; }
            public string AccountType { get; set; } = "Personal";
            public DateTime OpeningDate { get; set; } = DateTime.Today;
            public decimal OpeningBalance { get; set; } = 0;
            public string? InitialPaymentMode { get; set; } = "Cash";
            public int? BankLedgerID { get; set; }
            public string? OldAccountNo { get; set; }
            public string? LegacyAccountNumber { get; set; }
            public int LedgerID { get; set; }
            public decimal InterestRate { get; set; } = 0;
            public decimal? MinimumBalance { get; set; }
            public decimal LienAmount { get; set; } = 0;
            public string? LienReason { get; set; }
            public string Status { get; set; } = "Active";
            public string? NomineeName { get; set; }
            public string? NomineeRelation { get; set; }
            public string? NomineeAddress { get; set; }
            public int? SettingID { get; set; }
            public int? SavingSchemeID { get; set; }
            public DateTime? LastInterestPostingDate { get; set; }
            public decimal? LastInterestAmount { get; set; }
            public List<int>? JointHolderCustomerIDs { get; set; }
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

            // Multi-branch Security: Non-HO users can only update accounts belonging to their branch
            int userBranchId = User.GetOperatingBranchId();
            bool isHO = User.IsHeadOfficeAdmin();

            if (!isHO && userBranchId > 0 && existing.BranchID != userBranchId)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "तुम्हाला फक्त तुमच्या स्वतःच्या शाखेच्या खात्यात बदल करण्याची परवानगी आहे." });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // 1. Resolve Customer if provided
                int oldCustomerId = existing.CustomerID;
                int resolvedCustomerId = oldCustomerId;

                if (dto.CustomerID > 0)
                {
                    var (customer, errorMsg) = await ResolveEntityAsync(dto.CustomerID, existing.BranchID);
                    if (!string.IsNullOrEmpty(errorMsg) || customer == null)
                    {
                        return BadRequest(new { message = errorMsg ?? "कृपया वैध खातेदाराची निवड करा." });
                    }
                    resolvedCustomerId = customer.CustomerID;
                }

                // 2. Handle Opening Balance & Ledger changes for Legacy Accounts
                if (existing.IsLegacyAccount && dto.OpeningBalance >= 0)
                {
                    decimal oldBalance = existing.OpeningBalance;
                    decimal newBalance = dto.OpeningBalance;
                    int oldLedgerId = existing.LedgerID;
                    int newLedgerId = await Helpers.SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(
                        _context,
                        existing,
                        explicitLedgerId: dto.LedgerID > 0 ? dto.LedgerID : null,
                        explicitSchemeId: dto.SettingID);
                    if (newLedgerId <= 0)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = Helpers.SavingLedgerHelper.GetMissingMappingErrorMessage(existing.AccountNo) });
                    }

                    // Adjust General Ledgers
                    if (oldLedgerId == newLedgerId)
                    {
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
                        // Reverse from old ledger
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

                        // Add to new ledger
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
                    }

                    // Adjust CustomerOpeningBalances
                    if (oldCustomerId == resolvedCustomerId && oldLedgerId == newLedgerId)
                    {
                        var custOb = await _context.CustomerOpeningBalances.FirstOrDefaultAsync(c => 
                            c.CustomerID == resolvedCustomerId && c.LedgerID == newLedgerId);
                        if (custOb != null)
                        {
                            var otherCustAccounts = await _context.SavingAccountMasters
                                .Where(a => a.SavingAccountID != id && a.CustomerID == resolvedCustomerId && a.LedgerID == newLedgerId && a.IsLegacyAccount)
                                .ToListAsync();
                            custOb.Amount = otherCustAccounts.Sum(a => a.OpeningBalance) + newBalance;
                            _context.Entry(custOb).State = EntityState.Modified;
                        }
                        else if (newBalance > 0)
                        {
                            _context.CustomerOpeningBalances.Add(new CustomerOpeningBalance
                            {
                                CustomerID = resolvedCustomerId,
                                LedgerID = newLedgerId,
                                Amount = newBalance,
                                BalanceType = "Cr",
                                SourceModule = "Saving",
                                CreatedBy = existing.CreatedBy,
                                CreatedOn = DateTime.Now
                            });
                        }
                    }
                    else
                    {
                        // Reconcile old customer/ledger
                        var oldCustAccounts = await _context.SavingAccountMasters
                            .Where(a => a.SavingAccountID != id && a.CustomerID == oldCustomerId && a.LedgerID == oldLedgerId && a.IsLegacyAccount)
                            .ToListAsync();
                        decimal remOldCustAmount = oldCustAccounts.Sum(a => a.OpeningBalance);
                        var oldCustObs = await _context.CustomerOpeningBalances
                            .Where(c => c.CustomerID == oldCustomerId && c.LedgerID == oldLedgerId)
                            .ToListAsync();

                        if (remOldCustAmount <= 0)
                        {
                            _context.CustomerOpeningBalances.RemoveRange(oldCustObs);
                        }
                        else if (oldCustObs.Any())
                        {
                            var firstOld = oldCustObs.First();
                            firstOld.Amount = remOldCustAmount;
                            _context.Entry(firstOld).State = EntityState.Modified;
                            if (oldCustObs.Count > 1) _context.CustomerOpeningBalances.RemoveRange(oldCustObs.Skip(1));
                        }

                        // Add or update new customer/ledger
                        if (newBalance > 0)
                        {
                            var newCustAccounts = await _context.SavingAccountMasters
                                .Where(a => a.SavingAccountID != id && a.CustomerID == resolvedCustomerId && a.LedgerID == newLedgerId && a.IsLegacyAccount)
                                .ToListAsync();
                            decimal totalNewCustAmount = newCustAccounts.Sum(a => a.OpeningBalance) + newBalance;
                            var newCustObs = await _context.CustomerOpeningBalances
                                .Where(c => c.CustomerID == resolvedCustomerId && c.LedgerID == newLedgerId)
                                .ToListAsync();

                            if (newCustObs.Any())
                            {
                                var firstNew = newCustObs.First();
                                firstNew.Amount = totalNewCustAmount;
                                _context.Entry(firstNew).State = EntityState.Modified;
                                if (newCustObs.Count > 1) _context.CustomerOpeningBalances.RemoveRange(newCustObs.Skip(1));
                            }
                            else
                            {
                                _context.CustomerOpeningBalances.Add(new CustomerOpeningBalance
                                {
                                    CustomerID = resolvedCustomerId,
                                    LedgerID = newLedgerId,
                                    Amount = totalNewCustAmount,
                                    BalanceType = "Cr",
                                    SourceModule = "Saving",
                                    CreatedBy = existing.CreatedBy,
                                    CreatedOn = DateTime.Now
                                });
                            }
                        }
                    }

                    // Update opening balance baseline transaction
                    var obTxn = await _context.SavingTransactions.FirstOrDefaultAsync(t => t.SavingAccountID == id && t.Narration == "Opening Balance");
                    if (obTxn != null)
                    {
                        obTxn.CustomerID = resolvedCustomerId;
                        obTxn.Amount = newBalance;
                        obTxn.BalanceAfterTxn = newBalance;
                        obTxn.TransactionDate = dto.OpeningDate != default ? dto.OpeningDate : existing.OpeningDate;
                        _context.Entry(obTxn).State = EntityState.Modified;
                    }

                    existing.LedgerID = newLedgerId;
                    existing.OpeningBalance = newBalance;
                    existing.CurrentBalance = (existing.CurrentBalance - oldBalance) + newBalance;
                    existing.OpeningDate = dto.OpeningDate != default ? dto.OpeningDate : existing.OpeningDate;
                }

                int? requestedSchemeId = dto.SavingSchemeID ?? dto.SettingID;
                if (!existing.IsLegacyAccount && (dto.LedgerID > 0 || requestedSchemeId.HasValue))
                {
                    int resolvedLedgerId = await Helpers.SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(
                        _context,
                        existing,
                        explicitLedgerId: dto.LedgerID > 0 ? dto.LedgerID : null,
                        explicitSchemeId: requestedSchemeId);
                    if (resolvedLedgerId > 0)
                    {
                        existing.LedgerID = resolvedLedgerId;
                    }
                }

                var updatedScheme = await Helpers.SavingLedgerHelper.ResolveSavingSchemeAsync(
                    _context,
                    existing,
                    explicitSchemeId: requestedSchemeId,
                    explicitLedgerId: existing.LedgerID);
                if (updatedScheme != null)
                {
                    existing.SavingSchemeID = updatedScheme.SettingID;
                }
                else if (requestedSchemeId.HasValue && requestedSchemeId.Value > 0)
                {
                    existing.SavingSchemeID = requestedSchemeId.Value;
                }

                existing.CustomerID = resolvedCustomerId;
                existing.MinimumBalance = dto.MinimumBalance.HasValue
                    ? Math.Max(0m, dto.MinimumBalance.Value)
                    : existing.MinimumBalance;
                existing.InterestRate = dto.InterestRate;
                existing.LienAmount = dto.LienAmount;
                existing.LienReason = dto.LienReason;
                existing.Status = string.IsNullOrWhiteSpace(dto.Status) ? existing.Status : dto.Status;
                existing.NomineeName = dto.NomineeName;
                existing.NomineeRelation = dto.NomineeRelation;
                existing.NomineeAddress = dto.NomineeAddress;
                existing.OldAccountNo = dto.OldAccountNo ?? dto.LegacyAccountNumber ?? existing.OldAccountNo;
                existing.LegacyAccountNumber = dto.OldAccountNo ?? dto.LegacyAccountNumber ?? existing.LegacyAccountNumber;
                existing.LastInterestPostingDate = dto.LastInterestPostingDate;
                existing.LastInterestAmount = dto.LastInterestAmount;
                existing.UpdatedOn = DateTime.Now;

                // Joint Holders update
                if (dto.AccountType == "Joint" && dto.JointHolderCustomerIDs != null)
                {
                    existing.AccountType = "Joint";
                    existing.JointHolders ??= new List<SavingAccountJointHolder>();
                    if (existing.JointHolders.Any())
                    {
                        _context.SavingAccountJointHolders.RemoveRange(existing.JointHolders);
                    }
                    foreach (var jhCustId in dto.JointHolderCustomerIDs)
                    {
                        if (jhCustId > 0 && jhCustId != existing.CustomerID)
                        {
                            var jhCust = await _context.Customers.FindAsync(jhCustId);
                            if (jhCust != null)
                            {
                                existing.JointHolders.Add(new SavingAccountJointHolder
                                {
                                    SavingAccountID = id,
                                    CustomerID = jhCust.CustomerID,
                                    CreatedOn = DateTime.Now
                                });
                            }
                        }
                    }
                }
                else
                {
                    existing.AccountType = "Personal";
                    if (existing.JointHolders != null && existing.JointHolders.Any())
                    {
                        _context.SavingAccountJointHolders.RemoveRange(existing.JointHolders);
                    }
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { message = "बचत खाते यशस्वीरित्या अपडेट केले!" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new 
                { 
                    message = "बचत खाते अपडेट करताना तांत्रिक त्रुटी आली.",
                    detail = ex.Message,
                    innerDetail = ex.InnerException?.Message
                });
            }
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

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // If it's a legacy account, reverse the Ledger and reconcile CustomerOpeningBalances safely
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

                    // 2. Safe CustomerOpeningBalances Reconciliation
                    var otherCustomerLegacyAccounts = await _context.SavingAccountMasters
                        .Where(a => a.SavingAccountID != id && a.CustomerID == savingAccount.CustomerID && a.LedgerID == savingAccount.LedgerID && a.IsLegacyAccount)
                        .ToListAsync();

                    decimal requiredRemainingCustomerAmount = otherCustomerLegacyAccounts.Sum(a => a.OpeningBalance);

                    var custObs = await _context.CustomerOpeningBalances
                        .Where(c => c.CustomerID == savingAccount.CustomerID && c.LedgerID == savingAccount.LedgerID)
                        .ToListAsync();

                    if (requiredRemainingCustomerAmount <= 0)
                    {
                        if (custObs.Any())
                        {
                            _context.CustomerOpeningBalances.RemoveRange(custObs);
                        }
                    }
                    else
                    {
                        if (custObs.Any())
                        {
                            var primaryCob = custObs.First();
                            primaryCob.Amount = requiredRemainingCustomerAmount;
                            _context.Entry(primaryCob).State = EntityState.Modified;

                            if (custObs.Count > 1)
                            {
                                _context.CustomerOpeningBalances.RemoveRange(custObs.Skip(1));
                            }
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
                _context.SavingAccountMasters.Remove(savingAccount);
                await _context.SaveChangesAsync();

                // If the deleted record was the highest/only SavingAccountID, automatically decrement/reseed identity counter
                try
                {
                    var maxRemainingId = await _context.SavingAccountMasters.MaxAsync(s => (int?)s.SavingAccountID) ?? 0;
                    if (id >= maxRemainingId)
                    {
                        int reseedVal = maxRemainingId;
                        await _context.Database.ExecuteSqlInterpolatedAsync($"DBCC CHECKIDENT ('SavingAccountMasters', RESEED, {reseedVal});");
                    }
                }
                catch (Exception reseedEx)
                {
                    Console.WriteLine($"[WARNING] SavingAccount reseed error: {reseedEx.Message}");
                }

                await transaction.CommitAsync();

                return Ok(new { message = "खाते यशस्वीरित्या डिलीट केले." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new 
                { 
                    message = "खाते डिलीट करताना तांत्रिक त्रुटी आली.", 
                    detail = ex.Message,
                    innerDetail = ex.InnerException?.Message
                });
            }
        }

        private bool SavingAccountMasterExists(int id)
        {
            return _context.SavingAccountMasters.Any(e => e.SavingAccountID == id);
        }
    }
}
