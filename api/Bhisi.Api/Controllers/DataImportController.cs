using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Linq;
using System;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [AllowAnonymous]
    public class DataImportController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DataImportController(AppDbContext context)
        {
            _context = context;
        }

        public class MemberImportDto
        {
            public string? MemberCode { get; set; }
            public string? LegacyMemberNo { get; set; }
            public string? CIFNo { get; set; }
            public string FirstName { get; set; } = string.Empty;
            public string? MiddleName { get; set; }
            public string LastName { get; set; } = string.Empty;
            public string? FirstNameEng { get; set; }
            public string? MiddleNameEng { get; set; }
            public string? LastNameEng { get; set; }
            public string MobileNo { get; set; } = string.Empty;
            public string AadhaarNo { get; set; } = string.Empty;
            public string? PANNo { get; set; }
            public string? Address { get; set; }
            public string? AddressEng { get; set; }
            public string? Village { get; set; }
            public string? Taluka { get; set; }
            public string? District { get; set; }
            public string? Gender { get; set; }
            public DateTime? BirthDate { get; set; }
            public DateTime? JoiningDate { get; set; }
            public string? Occupation { get; set; }
            public string? NomineeName { get; set; }
            public string? NomineeNameEng { get; set; }
            public string? NomineeRelation { get; set; }
            public string? Status { get; set; }
            public string? EmployerName { get; set; }
            public int? EmployerId { get; set; }
            public string? CasteCategory { get; set; }
            public string? Caste { get; set; }
            public string? Email { get; set; }
            public bool IsMinor { get; set; } = false;
            public string? GuardianName { get; set; }
            public string? GuardianNameEng { get; set; }
            public string? GuardianRelation { get; set; }
            public string? GuardianAadhaarNo { get; set; }
            public string? GuardianMobileNo { get; set; }
            public string? GuardianAddress { get; set; }
        }

        [HttpPost("Members")]
        public async Task<IActionResult> ImportMembers([FromBody] List<MemberImportDto> data, [FromQuery] int branchId = 1)
        {
            if (data == null || data.Count == 0)
            {
                return BadRequest(new { message = "No data provided." });
            }

            var errors = new List<string>();
            var newMembers = new List<Member>();

            var maxId = await _context.Members.MaxAsync(m => (int?)m.MemberID) ?? 0;
            var employers = await _context.EmployerMasters.Select(e => new { e.Id, e.Name }).ToListAsync();

            // Load existing codes from database for fast duplicate check
            var existingCodes = new HashSet<string>(
                await _context.Members
                    .Where(m => m.OldMemberCode != null || m.MemberCode != null)
                    .Select(m => (m.OldMemberCode ?? m.MemberCode)!)
                    .ToListAsync(), 
                StringComparer.OrdinalIgnoreCase
            );

            for (int i = 0; i < data.Count; i++)
            {
                var row = data[i];
                var rowNum = i + 2; // Assuming row 1 is header in Excel

                var inputCode = row.MemberCode?.Trim() ?? string.Empty;
                var firstName = row.FirstName?.Trim() ?? string.Empty;
                var lastName = row.LastName?.Trim() ?? string.Empty;

                if (string.IsNullOrWhiteSpace(firstName))
                {
                    errors.Add($"Row {rowNum}: FirstName is required.");
                    continue;
                }
                if (string.IsNullOrWhiteSpace(lastName))
                {
                    errors.Add($"Row {rowNum}: LastName is required.");
                    continue;
                }
                
                // Check duplicate in DB or current import batch ONLY if an old code is provided
                if (!string.IsNullOrWhiteSpace(inputCode))
                {
                    if (existingCodes.Contains(inputCode))
                    {
                        errors.Add($"Row {rowNum}: Member with Code '{inputCode}' already exists in system or earlier row.");
                        continue;
                    }
                    existingCodes.Add(inputCode);
                }

                // Sanitize MobileNo
                var mobileNo = System.Text.RegularExpressions.Regex.Replace(row.MobileNo ?? "", @"[^\d]", "");
                if (string.IsNullOrWhiteSpace(mobileNo))
                {
                    mobileNo = "0000000000";
                }
                else if (mobileNo.Length > 15)
                {
                    mobileNo = mobileNo.Substring(0, 15);
                }

                // Sanitize AadhaarNo
                string aadhaarNo;
                var cleanAadhaar = System.Text.RegularExpressions.Regex.Replace(row.AadhaarNo ?? "", @"[^\d]", "");
                if (string.IsNullOrWhiteSpace(cleanAadhaar))
                {
                    aadhaarNo = $"NA-{Guid.NewGuid().ToString().Substring(0, 8)}";
                }
                else
                {
                    aadhaarNo = cleanAadhaar.Length > 12 ? cleanAadhaar.Substring(0, 12) : cleanAadhaar;
                }

                // Sanitize PANNo
                var panNo = (row.PANNo ?? "").Trim().ToUpper();
                if (panNo.Length > 10) panNo = panNo.Substring(0, 10);

                // Determine employer
                int? empId = row.EmployerId;
                if (!empId.HasValue && !string.IsNullOrWhiteSpace(row.EmployerName))
                {
                    var emp = employers.FirstOrDefault(e => e.Name.Equals(row.EmployerName.Trim(), StringComparison.OrdinalIgnoreCase));
                    if (emp != null)
                    {
                        empId = emp.Id;
                    }
                }

                // Status mapping
                string status = "Active";
                if (!string.IsNullOrWhiteSpace(row.Status))
                {
                    var s = row.Status.Trim();
                    if (s.Equals("Deactive", StringComparison.OrdinalIgnoreCase) || s.Contains("निष्क्रिय"))
                        status = "Deactive";
                    else if (s.Equals("Mayat", StringComparison.OrdinalIgnoreCase) || s.Contains("मयत") || s.Equals("Deceased", StringComparison.OrdinalIgnoreCase))
                        status = "Mayat";
                }

                string? oldMemberCode = string.IsNullOrWhiteSpace(inputCode) ? null : (inputCode.Length > 20 ? inputCode.Substring(0, 20) : inputCode);
                string autoMemberCode = $"MEM{(maxId + newMembers.Count + 1).ToString("D4")}";
                string? legacyMemberNo = !string.IsNullOrWhiteSpace(row.LegacyMemberNo) 
                    ? (row.LegacyMemberNo.Length > 50 ? row.LegacyMemberNo.Substring(0, 50) : row.LegacyMemberNo)
                    : oldMemberCode;

                var member = new Member
                {
                    OldMemberCode = oldMemberCode,
                    MemberCode = autoMemberCode,
                    LegacyMemberNo = legacyMemberNo,
                    CIFNo = string.IsNullOrWhiteSpace(row.CIFNo) ? null : (row.CIFNo.Length > 20 ? row.CIFNo.Substring(0, 20) : row.CIFNo),
                    FirstName = firstName.Length > 50 ? firstName.Substring(0, 50) : firstName,
                    MiddleName = string.IsNullOrWhiteSpace(row.MiddleName) ? null : (row.MiddleName.Trim().Length > 50 ? row.MiddleName.Trim().Substring(0, 50) : row.MiddleName.Trim()),
                    LastName = lastName.Length > 50 ? lastName.Substring(0, 50) : lastName,
                    FirstNameEng = string.IsNullOrWhiteSpace(row.FirstNameEng) ? null : (row.FirstNameEng.Trim().Length > 50 ? row.FirstNameEng.Trim().Substring(0, 50) : row.FirstNameEng.Trim()),
                    MiddleNameEng = string.IsNullOrWhiteSpace(row.MiddleNameEng) ? null : (row.MiddleNameEng.Trim().Length > 50 ? row.MiddleNameEng.Trim().Substring(0, 50) : row.MiddleNameEng.Trim()),
                    LastNameEng = string.IsNullOrWhiteSpace(row.LastNameEng) ? null : (row.LastNameEng.Trim().Length > 50 ? row.LastNameEng.Trim().Substring(0, 50) : row.LastNameEng.Trim()),
                    MobileNo = mobileNo,
                    AadhaarNo = aadhaarNo,
                    PANNo = panNo,
                    Address = string.IsNullOrWhiteSpace(row.Address) ? null : (row.Address.Trim().Length > 500 ? row.Address.Trim().Substring(0, 500) : row.Address.Trim()),
                    AddressEng = string.IsNullOrWhiteSpace(row.AddressEng) ? null : (row.AddressEng.Trim().Length > 500 ? row.AddressEng.Trim().Substring(0, 500) : row.AddressEng.Trim()),
                    Village = string.IsNullOrWhiteSpace(row.Village) ? null : (row.Village.Trim().Length > 100 ? row.Village.Trim().Substring(0, 100) : row.Village.Trim()),
                    Taluka = string.IsNullOrWhiteSpace(row.Taluka) ? null : (row.Taluka.Trim().Length > 100 ? row.Taluka.Trim().Substring(0, 100) : row.Taluka.Trim()),
                    District = string.IsNullOrWhiteSpace(row.District) ? null : (row.District.Trim().Length > 100 ? row.District.Trim().Substring(0, 100) : row.District.Trim()),
                    Gender = string.IsNullOrWhiteSpace(row.Gender) ? null : (row.Gender.Trim().Length > 10 ? row.Gender.Trim().Substring(0, 10) : row.Gender.Trim()),
                    BirthDate = row.BirthDate,
                    JoiningDate = row.JoiningDate ?? DateTime.Today,
                    Occupation = string.IsNullOrWhiteSpace(row.Occupation) ? null : (row.Occupation.Trim().Length > 100 ? row.Occupation.Trim().Substring(0, 100) : row.Occupation.Trim()),
                    NomineeName = string.IsNullOrWhiteSpace(row.NomineeName) ? null : (row.NomineeName.Trim().Length > 150 ? row.NomineeName.Trim().Substring(0, 150) : row.NomineeName.Trim()),
                    NomineeNameEng = string.IsNullOrWhiteSpace(row.NomineeNameEng) ? null : (row.NomineeNameEng.Trim().Length > 150 ? row.NomineeNameEng.Trim().Substring(0, 150) : row.NomineeNameEng.Trim()),
                    NomineeRelation = string.IsNullOrWhiteSpace(row.NomineeRelation) ? null : (row.NomineeRelation.Trim().Length > 50 ? row.NomineeRelation.Trim().Substring(0, 50) : row.NomineeRelation.Trim()),
                    CasteCategory = string.IsNullOrWhiteSpace(row.CasteCategory) ? null : (row.CasteCategory.Trim().Length > 50 ? row.CasteCategory.Trim().Substring(0, 50) : row.CasteCategory.Trim()),
                    Caste = string.IsNullOrWhiteSpace(row.Caste) ? null : (row.Caste.Trim().Length > 100 ? row.Caste.Trim().Substring(0, 100) : row.Caste.Trim()),
                    Email = string.IsNullOrWhiteSpace(row.Email) ? null : (row.Email.Trim().Length > 150 ? row.Email.Trim().Substring(0, 150) : row.Email.Trim()),
                    IsMinor = row.IsMinor || (row.BirthDate.HasValue && row.BirthDate.Value > DateTime.Today.AddYears(-18)),
                    GuardianName = string.IsNullOrWhiteSpace(row.GuardianName) ? null : (row.GuardianName.Trim().Length > 150 ? row.GuardianName.Trim().Substring(0, 150) : row.GuardianName.Trim()),
                    GuardianNameEng = string.IsNullOrWhiteSpace(row.GuardianNameEng) ? null : (row.GuardianNameEng.Trim().Length > 150 ? row.GuardianNameEng.Trim().Substring(0, 150) : row.GuardianNameEng.Trim()),
                    GuardianRelation = string.IsNullOrWhiteSpace(row.GuardianRelation) ? null : (row.GuardianRelation.Trim().Length > 50 ? row.GuardianRelation.Trim().Substring(0, 50) : row.GuardianRelation.Trim()),
                    GuardianAadhaarNo = string.IsNullOrWhiteSpace(row.GuardianAadhaarNo) ? null : (row.GuardianAadhaarNo.Trim().Length > 12 ? row.GuardianAadhaarNo.Trim().Substring(0, 12) : row.GuardianAadhaarNo.Trim()),
                    GuardianMobileNo = string.IsNullOrWhiteSpace(row.GuardianMobileNo) ? null : (row.GuardianMobileNo.Trim().Length > 15 ? row.GuardianMobileNo.Trim().Substring(0, 15) : row.GuardianMobileNo.Trim()),
                    GuardianAddress = string.IsNullOrWhiteSpace(row.GuardianAddress) ? null : (row.GuardianAddress.Trim().Length > 500 ? row.GuardianAddress.Trim().Substring(0, 500) : row.GuardianAddress.Trim()),
                    Status = status,
                    EmployerId = empId,
                    BranchID = branchId // Selected branch
                };

                newMembers.Add(member);
            }

            if (errors.Count > 0)
            {
                return BadRequest(new { message = "इम्पोर्ट अयशस्वी! खालील चुका दुरुस्त करा.", errors = errors });
            }

            try
            {
                _context.Members.AddRange(newMembers);
                await _context.SaveChangesAsync();
                return Ok(new { successCount = newMembers.Count });
            }
            catch (DbUpdateException dbEx)
            {
                var innerMsg = dbEx.InnerException?.Message ?? dbEx.Message;
                string userMsg = "डेटाबेसमधील डुप्लिकेट माहिती किंवा कन्स्ट्रेंट त्रुटी (Duplicate Member Code or Aadhaar No): " + innerMsg;
                return BadRequest(new { message = userMsg, errors = new List<string> { userMsg } });
            }
            catch (Exception ex)
            {
                string userMsg = "सभासद माहिती जतन करताना त्रुटी आली: " + ex.Message;
                return BadRequest(new { message = userMsg, errors = new List<string> { userMsg } });
            }
        }


        public class SavingAccountImportDto
        {
            public string SchemeName { get; set; } = string.Empty;
            public string MemberCode { get; set; } = string.Empty;
            public string? MemberName { get; set; }
            public string AccountNo { get; set; } = string.Empty;
            public DateTime? OpeningDate { get; set; }
            public string AccountType { get; set; } = "Personal";
            public decimal OpeningBalance { get; set; }
            public decimal InterestRate { get; set; } = 4.0m;
            public decimal MinimumBalance { get; set; } = 500m;
        }

        [HttpPost("SavingAccounts")]
        public async Task<IActionResult> ImportSavingAccounts([FromBody] List<SavingAccountImportDto> data, [FromQuery] int branchId = 1, [FromQuery] int? ledgerId = null)
        {
            if (data == null || data.Count == 0)
            {
                return BadRequest(new { message = "No data provided." });
            }

            var activeSetting = await _context.SavingInterestSettings
                .Where(s => s.EffectiveDate <= DateTime.Today)
                .OrderByDescending(s => s.EffectiveDate)
                .FirstOrDefaultAsync();

            int defaultLedgerId = ledgerId ?? activeSetting?.LedgerID ?? 0;
            if (defaultLedgerId == 0)
            {
                return BadRequest(new { message = "कृपया प्रथम 'बचत ठेव व्याजदर सेटिंग' मध्ये जाऊन लेजर मॅप करा किंवा ड्रॉपडाऊन मधून लेजर निवडा." });
            }

            var errors = new List<string>();
            var newAccounts = new List<SavingAccountMaster>();

            for (int i = 0; i < data.Count; i++)
            {
                var row = data[i];
                var rowNum = i + 2;

                if (string.IsNullOrWhiteSpace(row.MemberCode))
                {
                    errors.Add($"Row {rowNum}: MemberCode is required.");
                    continue;
                }
                
                // For existing account no logic or auto-gen
                var accountNo = row.AccountNo;
                if (string.IsNullOrWhiteSpace(accountNo))
                {
                    accountNo = "AUTO"; // Or handle your custom auto-generation here later
                }

                var member = await _context.Members.FirstOrDefaultAsync(m => m.OldMemberCode == row.MemberCode || m.MemberCode == row.MemberCode);
                if (member == null)
                {
                    errors.Add($"Row {rowNum}: Member with Code or Old Code '{row.MemberCode}' not found.");
                    continue;
                }

                if (accountNo != "AUTO" && await _context.SavingAccountMasters.AnyAsync(a => a.AccountNo == accountNo))
                {
                    errors.Add($"Row {rowNum}: AccountNo '{accountNo}' already exists.");
                    continue;
                }

                int rowLedgerId = defaultLedgerId;
                if (!string.IsNullOrWhiteSpace(row.SchemeName))
                {
                    var schemeLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.ToLower() == row.SchemeName.ToLower());
                    if (schemeLedger != null) rowLedgerId = schemeLedger.LedgerID;
                    else { errors.Add($"Row {rowNum}: Scheme '{row.SchemeName}' not found."); continue; }
                }
                
                var newAccount = new SavingAccountMaster
                {
                    CustomerID = member.CustomerID ?? 1,
                    MemberID = member.MemberID,
                    AccountNo = accountNo,
                    AccountType = row.AccountType,
                    OpeningDate = row.OpeningDate ?? DateTime.Today,
                    OpeningBalance = row.OpeningBalance,
                    CurrentBalance = row.OpeningBalance,
                    InterestRate = row.InterestRate,
                    MinimumBalance = row.MinimumBalance,
                    LedgerID = rowLedgerId,
                    BranchID = branchId, // Selected branch
                    Status = "Active"
                };

                newAccounts.Add(newAccount);
            }

            if (errors.Count > 0)
            {
                return BadRequest(new { message = "Import failed due to errors.", errors = errors });
            }

            // If some account nos are auto, generate them (similar to your existing logic)
            // For simplicity, we assume the user provides AccountNo in Excel for legacy accounts
            foreach(var acc in newAccounts)
            {
                if(acc.AccountNo == "AUTO")
                {
                    acc.AccountNo = $"SA{DateTime.Now.Ticks.ToString().Substring(8, 6)}";
                }
            }

            _context.SavingAccountMasters.AddRange(newAccounts);

            decimal totalOpeningBalance = 0;
            var memberObs = new List<MemberOpeningBalance>();

            foreach(var acc in newAccounts)
            {
                totalOpeningBalance += acc.OpeningBalance;
                memberObs.Add(new MemberOpeningBalance
                {
                    MemberID = acc.MemberID ?? acc.CustomerID,
                    LedgerID = acc.LedgerID,
                    Amount = acc.OpeningBalance,
                    BalanceType = "Cr", // Savings deposits are usually Cr
                    CreatedBy = 1,
                    CreatedOn = DateTime.Now
                });
            }

            _context.MemberOpeningBalances.AddRange(memberObs);

            var ledger = await _context.Ledgers.FindAsync(defaultLedgerId);
            if (ledger != null && totalOpeningBalance > 0)
            {
                if (ledger.OpeningBalanceType == "Cr")
                {
                    ledger.OpeningBalance += totalOpeningBalance;
                }
                else
                {
                    ledger.OpeningBalance -= totalOpeningBalance;
                    if (ledger.OpeningBalance < 0)
                    {
                        ledger.OpeningBalance = Math.Abs(ledger.OpeningBalance);
                        ledger.OpeningBalanceType = "Cr";
                    }
                }
                _context.Ledgers.Update(ledger);
            }

            await _context.SaveChangesAsync();

            return Ok(new { successCount = newAccounts.Count });
        }

        public class ShareAccountImportDto
        {
            public string MemberCode { get; set; } = string.Empty;
            public string? MemberName { get; set; }
            public string AccountNo { get; set; } = string.Empty;
            public DateTime OpeningDate { get; set; }
            public int TotalShareCount { get; set; }
            public decimal TotalShareAmount { get; set; }
            public decimal DividendPayableBalance { get; set; }
        }

        [HttpPost("ShareAccounts")]
        public async Task<IActionResult> ImportShareAccounts([FromBody] List<ShareAccountImportDto> data, [FromQuery] int branchId = 1, [FromQuery] int? ledgerId = null)
        {
            if (data == null || data.Count == 0)
            {
                return BadRequest(new { message = "No data provided." });
            }

            var errors = new List<string>();
            var newAccounts = new List<ShareAccount>();

            for (int i = 0; i < data.Count; i++)
            {
                var row = data[i];
                var rowNum = i + 2; // Assuming row 1 is header in Excel

                if (string.IsNullOrWhiteSpace(row.MemberCode))
                {
                    errors.Add($"Row {rowNum}: MemberCode is required.");
                    continue;
                }
                
                if (row.TotalShareCount <= 0)
                {
                    errors.Add($"Row {rowNum}: TotalShareCount must be greater than 0.");
                }

                if (row.TotalShareAmount <= 0)
                {
                    errors.Add($"Row {rowNum}: TotalShareAmount must be greater than 0.");
                }

                var accountNo = row.AccountNo;
                if (string.IsNullOrWhiteSpace(accountNo))
                {
                    accountNo = "AUTO"; 
                }

                var member = await _context.Members.FirstOrDefaultAsync(m => m.OldMemberCode == row.MemberCode || m.MemberCode == row.MemberCode);
                if (member == null)
                {
                    errors.Add($"Row {rowNum}: Member with Code or Old Code '{row.MemberCode}' not found.");
                    continue;
                }

                if (accountNo != "AUTO" && await _context.ShareAccounts.AnyAsync(a => a.AccountNo == accountNo))
                {
                    errors.Add($"Row {rowNum}: AccountNo '{accountNo}' already exists.");
                    continue;
                }

                // Check if member already has a share account (usually one per member)
                if (await _context.ShareAccounts.AnyAsync(a => a.MemberId == member.MemberID))
                {
                    errors.Add($"Row {rowNum}: Member '{row.MemberCode}' already has a Share Account.");
                    continue;
                }

                if (errors.Any(e => e.StartsWith($"Row {rowNum}:")))
                {
                    continue;
                }

                var newAccount = new ShareAccount
                {
                    MemberId = member.MemberID,
                    CustomerID = member.CustomerID ?? member.MemberID,
                    AccountNo = accountNo,
                    TotalShareCount = row.TotalShareCount,
                    TotalShareAmount = row.TotalShareAmount,
                    DividendPayableBalance = row.DividendPayableBalance,
                    OpeningDate = row.OpeningDate == default ? DateTime.Today : row.OpeningDate,
                    Status = "Active"
                };

                newAccounts.Add(newAccount);
            }

            if (errors.Count > 0)
            {
                return BadRequest(new { message = "Import failed due to errors.", errors = errors });
            }

            foreach(var acc in newAccounts)
            {
                if(acc.AccountNo == "AUTO")
                {
                    acc.AccountNo = $"SHR{DateTime.Now.Ticks.ToString().Substring(8, 6)}";
                }
            }

            _context.ShareAccounts.AddRange(newAccounts);

            if (ledgerId.HasValue && ledgerId.Value > 0)
            {
                decimal totalOpeningBalance = 0;
                var memberObs = new List<MemberOpeningBalance>();

                foreach(var acc in newAccounts)
                {
                    totalOpeningBalance += acc.TotalShareAmount;
                    memberObs.Add(new MemberOpeningBalance
                    {
                        MemberID = acc.MemberId,
                        LedgerID = ledgerId.Value,
                        Amount = acc.TotalShareAmount,
                        BalanceType = "Cr",
                        CreatedBy = 1,
                        CreatedOn = DateTime.Now
                    });
                }

                _context.MemberOpeningBalances.AddRange(memberObs);

                var ledger = await _context.Ledgers.FindAsync(ledgerId.Value);
                if (ledger != null && totalOpeningBalance > 0)
                {
                    if (ledger.OpeningBalanceType == "Cr")
                    {
                        ledger.OpeningBalance += totalOpeningBalance;
                    }
                    else
                    {
                        ledger.OpeningBalance -= totalOpeningBalance;
                        if (ledger.OpeningBalance < 0)
                        {
                            ledger.OpeningBalance = Math.Abs(ledger.OpeningBalance);
                            ledger.OpeningBalanceType = "Cr";
                        }
                    }
                    _context.Ledgers.Update(ledger);
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { successCount = newAccounts.Count });
        }
    }
}
