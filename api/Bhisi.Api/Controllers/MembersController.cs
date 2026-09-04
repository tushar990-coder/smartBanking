using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MembersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public MembersController(AppDbContext context)
        {
            _context = context;
        }

        private (int userId, string username, int branchId, string role, bool isHeadOfficeAdmin) GetCurrentUserContext()
        {
            int userId = 1;
            string username = "System";
            int branchId = 1;
            string role = "Admin";

            var userClaim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("UserID") ?? User.FindFirst("sub");
            if (userClaim != null && int.TryParse(userClaim.Value, out int uid)) userId = uid;

            var nameClaim = User.FindFirst(ClaimTypes.Name) ?? User.FindFirst("Username");
            if (nameClaim != null && !string.IsNullOrWhiteSpace(nameClaim.Value)) username = nameClaim.Value;

            var branchClaim = User.FindFirst("BranchID") ?? User.FindFirst("branchID");
            if (branchClaim != null && int.TryParse(branchClaim.Value, out int bid)) branchId = bid;

            var roleClaim = User.FindFirst(ClaimTypes.Role) ?? User.FindFirst("Role") ?? User.FindFirst("role");
            if (roleClaim != null && !string.IsNullOrWhiteSpace(roleClaim.Value)) role = roleClaim.Value;

            bool isHeadOfficeAdmin = role.Equals("Admin", StringComparison.OrdinalIgnoreCase) ||
                                     role.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase) ||
                                     role.Equals("Super Admin", StringComparison.OrdinalIgnoreCase) ||
                                     role.Equals("HeadOffice", StringComparison.OrdinalIgnoreCase) ||
                                     role.Equals("Auditor", StringComparison.OrdinalIgnoreCase);

            return (userId, username, branchId, role, isHeadOfficeAdmin);
        }

        private async Task LogAuditAsync(string action, string entityId, string details, string status = "Success")
        {
            try
            {
                var (userId, username, _, _, _) = GetCurrentUserContext();
                var log = new AuditLog
                {
                    UserID = userId,
                    Username = username,
                    Action = action,
                    EntityName = "Member",
                    EntityID = entityId,
                    Timestamp = DateTime.Now,
                    IPAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                    Details = details,
                    Status = status
                };
                _context.AuditLogs.Add(log);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WARNING] Audit logging failed: {ex.Message}");
            }
        }

        // GET: api/Members
        [AllowAnonymous]
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Member>>> GetMembers(
            [FromQuery] int? branchId = null,
            [FromQuery] string? status = null,
            [FromQuery] bool? hasSharesOnly = null,
            [FromQuery] bool? membersOnly = null,
            [FromQuery] int? page = null,
            [FromQuery] int? pageSize = null)
        {
            try
            {
                var (_, _, userBranchId, _, isHeadOfficeAdmin) = GetCurrentUserContext();
                var query = _context.Members.AsNoTracking().Include(m => m.Branch).OrderBy(m => m.MemberID).AsQueryable();

                // Multi-Branch Isolation Barrier: Non-admin users are strictly forced to their assigned branch
                if (!isHeadOfficeAdmin)
                {
                    query = query.Where(m => m.BranchID == userBranchId);
                }
                else if (branchId.HasValue && branchId.Value > 0)
                {
                    query = query.Where(m => m.BranchID == branchId.Value);
                }

                if (!string.IsNullOrWhiteSpace(status) && status != "सर्व" && status != "All")
                {
                    query = query.Where(m => m.Status == status);
                }

                if (hasSharesOnly == true)
                {
                    query = query.Where(m => _context.ShareAccounts.Any(s => s.MemberId == m.MemberID && s.TotalShareCount > 0));
                }

                if (membersOnly == true)
                {
                    query = query.Where(m => !string.IsNullOrEmpty(m.MemberCode) && !m.MemberCode.StartsWith("TEMP"));
                }

                if (page.HasValue || pageSize.HasValue)
                {
                    int p = page ?? 1;
                    int ps = pageSize ?? 50;
                    if (p < 1) p = 1;
                    if (ps < 1 || ps > 500) ps = 50;
                    query = query.Skip((p - 1) * ps).Take(ps);
                }

                var members = await query.ToListAsync();

                // Defensive null-handling: ensure no string field is null in the response
                foreach (var member in members)
                {
                    member.FirstName = member.FirstName ?? string.Empty;
                    member.LastName = member.LastName ?? string.Empty;
                    member.NickName = member.NickName ?? string.Empty;
                    member.MobileNo = member.MobileNo ?? string.Empty;
                    member.AadhaarNo = member.AadhaarNo ?? string.Empty;
                    member.Status = member.Status ?? "Active";
                    member.MemberCode = member.MemberCode ?? string.Empty;
                    member.MiddleName = member.MiddleName ?? string.Empty;
                    member.Address = member.Address ?? string.Empty;
                    member.Village = member.Village ?? string.Empty;
                    member.Taluka = member.Taluka ?? string.Empty;
                    member.District = member.District ?? string.Empty;
                    member.Email = member.Email ?? string.Empty;
                    member.PANNo = member.PANNo ?? string.Empty;
                    member.NomineeName = member.NomineeName ?? string.Empty;
                    member.NomineeNameEng = member.NomineeNameEng ?? string.Empty;
                    member.NomineeRelation = member.NomineeRelation ?? string.Empty;
                    member.NomineeAddress = member.NomineeAddress ?? string.Empty;
                    member.NomineeGuardianName = member.NomineeGuardianName ?? string.Empty;
                    member.PhotoPath = member.PhotoPath ?? string.Empty;
                    member.SignaturePath = member.SignaturePath ?? string.Empty;
                    member.AadhaarDocPath = member.AadhaarDocPath ?? string.Empty;
                    member.PanDocPath = member.PanDocPath ?? string.Empty;
                    member.Gender = member.Gender ?? string.Empty;
                    member.Occupation = member.Occupation ?? string.Empty;
                    member.CasteCategory = member.CasteCategory ?? string.Empty;
                    member.Caste = member.Caste ?? string.Empty;
                    member.OldMemberCode = member.OldMemberCode ?? string.Empty;
                    member.FirstNameEng = member.FirstNameEng ?? string.Empty;
                    member.MiddleNameEng = member.MiddleNameEng ?? string.Empty;
                    member.LastNameEng = member.LastNameEng ?? string.Empty;
                    member.AddressEng = member.AddressEng ?? string.Empty;
                    member.GuardianName = member.GuardianName ?? string.Empty;
                    member.GuardianNameEng = member.GuardianNameEng ?? string.Empty;
                    member.GuardianRelation = member.GuardianRelation ?? string.Empty;
                    member.GuardianAadhaarNo = member.GuardianAadhaarNo ?? string.Empty;
                    member.GuardianMobileNo = member.GuardianMobileNo ?? string.Empty;
                    member.GuardianAddress = member.GuardianAddress ?? string.Empty;
                    member.LegacyMemberNo = member.LegacyMemberNo ?? string.Empty;

                    if (string.IsNullOrWhiteSpace(member.CIFNo))
                    {
                        member.CIFNo = GenerateCifNo(member);
                    }

                    if (member.Branch != null)
                    {
                        member.Branch.BranchCode = member.Branch.BranchCode ?? string.Empty;
                        member.Branch.BranchName = member.Branch.BranchName ?? string.Empty;
                        member.Branch.Address = member.Branch.Address ?? string.Empty;
                        member.Branch.BranchType = member.Branch.BranchType ?? "Branch";
                        member.Branch.IFSCCode = member.Branch.IFSCCode ?? string.Empty;
                        member.Branch.MobileNo = member.Branch.MobileNo ?? string.Empty;
                        member.Branch.Email = member.Branch.Email ?? string.Empty;
                    }
                }

                return members;
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "सभासद माहिती लोड करताना त्रुटी आली (Error loading members)",
                    detail = ex.Message,
                    innerDetail = ex.InnerException?.Message
                });
            }
        }

        public static string GenerateCifNo(Member member)
        {
            if (!string.IsNullOrWhiteSpace(member.CIFNo))
            {
                return member.CIFNo;
            }

            if (!string.IsNullOrWhiteSpace(member.LegacyMemberNo) && int.TryParse(member.LegacyMemberNo.Trim(), out int legacyNum))
            {
                return "CIF" + legacyNum.ToString("D6");
            }

            if (member.LegacyMemberId.HasValue && member.LegacyMemberId.Value > 0)
            {
                return "CIF" + member.LegacyMemberId.Value.ToString("D6");
            }

            if (!string.IsNullOrWhiteSpace(member.MemberCode))
            {
                var digits = new string(member.MemberCode.Where(char.IsDigit).ToArray());
                if (!string.IsNullOrEmpty(digits) && int.TryParse(digits, out int codeNum))
                {
                    return "CIF" + codeNum.ToString("D6");
                }
            }

            return "CIF" + member.MemberID.ToString("D6");
        }

        [HttpPost("fix-cifs")]
        public async Task<IActionResult> FixCifNumbers()
        {
            var members = await _context.Members.ToListAsync();
            int updatedCount = 0;
            foreach (var member in members)
            {
                var correctCif = GenerateCifNo(member);
                if (member.CIFNo != correctCif)
                {
                    member.CIFNo = correctCif;
                    updatedCount++;
                }
            }
            if (updatedCount > 0)
            {
                await _context.SaveChangesAsync();
                await LogAuditAsync("FIX_CIFS", "BULK", $"{updatedCount} सभासदांचे CIF क्रमांक सिंक केले.");
            }
            return Ok(new { message = $"Updated CIF numbers for {updatedCount} members out of {members.Count}." });
        }

        // GET: api/Members/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Member>> GetMember(int id)
        {
            var (_, _, userBranchId, _, isHeadOfficeAdmin) = GetCurrentUserContext();
            var member = await _context.Members.Include(m => m.Branch).FirstOrDefaultAsync(m => m.MemberID == id);

            if (member == null)
            {
                return NotFound();
            }

            if (!isHeadOfficeAdmin && member.BranchID != userBranchId)
            {
                return StatusCode(403, new { message = "आपल्याला इतर शाखेतील सभासदांची माहिती पाहण्याची परवानगी नाही (Access Denied: Cross-Branch Isolation Barrier Violation)." });
            }

            return member;
        }

        // GET: api/Members/next-code
        [AllowAnonymous]
        [HttpGet("next-code")]
        public async Task<ActionResult<string>> GetNextMemberCode()
        {
            try
            {
                var shareholderCodes = await _context.Members
                    .AsNoTracking()
                    .Where(m => !string.IsNullOrEmpty(m.MemberCode) &&
                                _context.ShareAccounts.Any(sa => sa.MemberId == m.MemberID))
                    .Select(m => m.MemberCode)
                    .ToListAsync();

                int maxNum = 0;
                foreach (var code in shareholderCodes)
                {
                    if (!string.IsNullOrWhiteSpace(code))
                    {
                        var trimmed = code.Trim();
                        if (trimmed.StartsWith("MEM", StringComparison.OrdinalIgnoreCase))
                        {
                            var digits = new string(trimmed.Substring(3).Where(char.IsDigit).ToArray());
                            if (int.TryParse(digits, out int num) && num > maxNum)
                            {
                                maxNum = num;
                            }
                        }
                    }
                }

                if (maxNum == 0)
                {
                    maxNum = await _context.ShareAccounts.CountAsync();
                }

                int nextNum = maxNum + 1;
                string candidate = $"MEM{nextNum:D4}";

                var allMemberCodes = await _context.Members
                    .AsNoTracking()
                    .Where(m => !string.IsNullOrEmpty(m.MemberCode))
                    .Select(m => m.MemberCode)
                    .ToListAsync();

                // Ensure candidate is truly unique across all active records in database
                var codeSet = new HashSet<string>(allMemberCodes.Where(c => !string.IsNullOrWhiteSpace(c))!, StringComparer.OrdinalIgnoreCase);
                while (codeSet.Contains(candidate))
                {
                    nextNum++;
                    candidate = $"MEM{nextNum:D4}";
                }

                return Content(candidate, "text/plain");
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Error generating next member code: " + ex.Message);
            }
        }

        [NonAction]
        public async Task<string> GenerateUniqueCifAsync()
        {
            try
            {
                var maxMemberId = await _context.Members
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .MaxAsync(m => (int?)m.MemberID) ?? 0;

                var maxCustomerId = await _context.Customers
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .MaxAsync(c => (int?)c.CustomerID) ?? 0;

                int candidateNum = Math.Max(maxMemberId, maxCustomerId) + 1;
                string candidateCif = $"CIF{candidateNum:D6}";

                var allCifsInDb = await _context.Members
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .Where(m => m.CIFNo != null && m.CIFNo != "")
                    .Select(m => m.CIFNo!)
                    .ToListAsync();

                var cifSet = new HashSet<string>(allCifsInDb, StringComparer.OrdinalIgnoreCase);
                while (cifSet.Contains(candidateCif))
                {
                    candidateNum++;
                    candidateCif = $"CIF{candidateNum:D6}";
                }

                return candidateCif;
            }
            catch
            {
                return $"CIF{DateTime.Now.Ticks % 1000000:D6}";
            }
        }

        // GET: api/Members/next-cif
        [AllowAnonymous]
        [HttpGet("next-cif")]
        public async Task<ActionResult<string>> GetNextCifNo()
        {
            string candidateCif = await GenerateUniqueCifAsync();
            return Content(candidateCif, "text/plain");
        }

        // POST: api/Members/clean-unallotted-codes
        [HttpPost("clean-unallotted-codes")]
        public async Task<IActionResult> CleanUnallottedMemberCodes()
        {
            try
            {
                int rowsUpdated = await _context.Database.ExecuteSqlRawAsync(@"
                    UPDATE [Members]
                    SET [MemberCode] = NULL
                    WHERE [MemberID] NOT IN (
                        SELECT DISTINCT [MemberId] FROM [ShareAccounts] WHERE [TotalShareCount] > 0
                    );
                ");

                await LogAuditAsync("CLEAN_MEMBER_CODES", "BULK", $"{rowsUpdated} सभासदांचे न दिलेले आयडी (MemberCode) रिसेट केले.");

                return Ok(new
                {
                    message = $"{rowsUpdated} सभासदांचे न दिलेले आयडी (MemberCode) यशस्वीरित्या रिसेट केले.",
                    resetCount = rowsUpdated
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        private List<string> ValidateMemberLengths(Member member)
        {
            var errors = new List<string>();

            if (member.FirstName != null && member.FirstName.Length > 50)
                errors.Add("पहिले नाव (FirstName) ५० अक्षरांपेक्षा जास्त नसावे.");
            if (member.LastName != null && member.LastName.Length > 50)
                errors.Add("आडनाव (LastName) ५० अक्षरांपेक्षा जास्त नसावे.");
            if (member.MiddleName != null && member.MiddleName.Length > 50)
                errors.Add("वडिलांचे/पतीचे नाव (MiddleName) ५० अक्षरांपेक्षा जास्त नसावे.");
            if (member.FirstNameEng != null && member.FirstNameEng.Length > 50)
                errors.Add("First Name Eng ५० अक्षरांपेक्षा जास्त नसावे.");
            if (member.LastNameEng != null && member.LastNameEng.Length > 50)
                errors.Add("Last Name Eng ५० अक्षरांपेक्षा जास्त नसावे.");
            if (member.MiddleNameEng != null && member.MiddleNameEng.Length > 50)
                errors.Add("Middle Name Eng ५० अक्षरांपेक्षा जास्त नसावे.");
            if (member.NickName != null && member.NickName.Length > 100)
                errors.Add("उर्फ नाव (NickName) १०० अक्षरांपेक्षा जास्त नसावे.");
            if (member.Address != null && member.Address.Length > 500)
                errors.Add("पत्ता (Address) ५०० अक्षरांपेक्षा जास्त नसावा.");
            if (member.AddressEng != null && member.AddressEng.Length > 500)
                errors.Add("Address Eng ५०० अक्षरांपेक्षा जास्त नसावा.");
            if (member.Village != null && member.Village.Length > 100)
                errors.Add("गाव (Village) १०० अक्षरांपेक्षा जास्त नसावे.");
            if (member.Taluka != null && member.Taluka.Length > 100)
                errors.Add("तालुका (Taluka) १०० अक्षरांपेक्षा जास्त नसावा.");
            if (member.District != null && member.District.Length > 100)
                errors.Add("जिल्हा (District) १०० अक्षरांपेक्षा जास्त नसावा.");
            if (member.MobileNo != null && member.MobileNo.Length > 15)
                errors.Add("मोबाईल नंबर (MobileNo) १५ अक्षरांपेक्षा जास्त नसावा.");
            if (member.AadhaarNo != null && member.AadhaarNo.Length > 12)
                errors.Add("आधार नंबर (AadhaarNo) १२ अंकांपेक्षा जास्त नसावा.");
            if (member.PANNo != null && member.PANNo.Length > 10)
                errors.Add("पॅन नंबर (PANNo) १० अक्षरांपेक्षा जास्त नसावा.");
            if (member.NomineeName != null && member.NomineeName.Length > 150)
                errors.Add("वारसदाराचे नाव (NomineeName) १५० अक्षरांपेक्षा जास्त नसावे.");
            if (member.NomineeNameEng != null && member.NomineeNameEng.Length > 150)
                errors.Add("Nominee Name Eng १५० अक्षरांपेक्षा जास्त नसावे.");
            if (member.NomineeRelation != null && member.NomineeRelation.Length > 50)
                errors.Add("वारसदाराचे नाते (NomineeRelation) ५० अक्षरांपेक्षा जास्त नसावे.");
            if (member.NomineeAddress != null && member.NomineeAddress.Length > 500)
                errors.Add("वारसदाराचा पत्ता (NomineeAddress) ५०० अक्षरांपेक्षा जास्त नसावा.");
            if (member.NomineeGuardianName != null && member.NomineeGuardianName.Length > 150)
                errors.Add("वारसदाराच्या पालकाचे नाव १५० अक्षरांपेक्षा जास्त नसावे.");
            if (member.Occupation != null && member.Occupation.Length > 100)
                errors.Add("व्यवसाय (Occupation) १०० अक्षरांपेक्षा जास्त नसावा.");
            if (member.CasteCategory != null && member.CasteCategory.Length > 50)
                errors.Add("प्रवर्ग (CasteCategory) ५० अक्षरांपेक्षा जास्त नसावा.");
            if (member.Caste != null && member.Caste.Length > 100)
                errors.Add("जात (Caste) १०० अक्षरांपेक्षा जास्त नसावी.");
            if (member.Email != null && member.Email.Length > 150)
                errors.Add("ईमेल (Email) १५० अक्षरांपेक्षा जास्त नसावा.");
            if (member.GuardianName != null && member.GuardianName.Length > 150)
                errors.Add("पालकाचे नाव (GuardianName) १५० अक्षरांपेक्षा जास्त नसावे.");
            if (member.GuardianNameEng != null && member.GuardianNameEng.Length > 150)
                errors.Add("Guardian Name Eng १५० अक्षरांपेक्षा जास्त नसावे.");
            if (member.GuardianRelation != null && member.GuardianRelation.Length > 50)
                errors.Add("पालकाचे नाते (GuardianRelation) ५० अक्षरांपेक्षा जास्त नसावे.");
            if (member.GuardianAadhaarNo != null && member.GuardianAadhaarNo.Length > 12)
                errors.Add("पालकांचा आधार (GuardianAadhaarNo) १२ अंकांपेक्षा जास्त नसावा.");
            if (member.GuardianMobileNo != null && member.GuardianMobileNo.Length > 15)
                errors.Add("पालकांचा मोबाईल (GuardianMobileNo) १५ अक्षरांपेक्षा जास्त नसावा.");
            if (member.GuardianAddress != null && member.GuardianAddress.Length > 500)
                errors.Add("पालकांचा पत्ता (GuardianAddress) ५०० अक्षरांपेक्षा जास्त नसावा.");

            return errors;
        }

        // PUT: api/Members/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutMember(int id, Member member)
        {
            if (member.MemberID > 0 && id != member.MemberID)
            {
                return BadRequest(new { message = "Member ID mismatch." });
            }
            member.MemberID = id;

            var (userId, username, userBranchId, _, isHeadOfficeAdmin) = GetCurrentUserContext();

            // Validate required fields before saving
            var validationErrors = new List<string>();
            if (string.IsNullOrWhiteSpace(member.FirstName))
                validationErrors.Add("पहिले नाव (FirstName) आवश्यक आहे.");
            if (string.IsNullOrWhiteSpace(member.LastName))
                validationErrors.Add("आडनाव (LastName) आवश्यक आहे.");

            // Sanitize optional fields to null if empty
            member.MobileNo = string.IsNullOrWhiteSpace(member.MobileNo) ? null : member.MobileNo.Trim();
            member.AadhaarNo = string.IsNullOrWhiteSpace(member.AadhaarNo) ? null : member.AadhaarNo.Trim();
            member.PANNo = string.IsNullOrWhiteSpace(member.PANNo) ? null : member.PANNo.Trim().ToUpper();
            member.MemberCode = string.IsNullOrWhiteSpace(member.MemberCode) ? null : member.MemberCode.Trim();

            if (validationErrors.Count > 0)
                return BadRequest(new { message = "आवश्यक माहिती भरा (Required fields missing)", errors = validationErrors });

            var lengthErrors = ValidateMemberLengths(member);
            if (lengthErrors.Count > 0)
                return BadRequest(new { message = "माहितीची लांबी डेटाबेसच्या मर्यादेपेक्षा जास्त आहे (Field length limit exceeded)", errors = lengthErrors });

            // Duplicate checks for other members
            member.LegacyMemberNo = string.IsNullOrWhiteSpace(member.LegacyMemberNo) ? null : member.LegacyMemberNo.Trim();
            member.OldMemberCode = string.IsNullOrWhiteSpace(member.OldMemberCode) ? null : member.OldMemberCode.Trim();

            var checkLegacyNo = member.LegacyMemberNo ?? member.OldMemberCode;
            if (!string.IsNullOrWhiteSpace(checkLegacyNo))
            {
                var existingLegacyMember = await _context.Members
                    .AsNoTracking()
                    .FirstOrDefaultAsync(m => m.MemberID != id && !m.IsDeleted && 
                        (m.LegacyMemberNo == checkLegacyNo || m.OldMemberCode == checkLegacyNo));
                if (existingLegacyMember != null)
                {
                    return BadRequest(new { message = $"हा जुना सभासद आयडी ({checkLegacyNo}) आधीच सभासद '{existingLegacyMember.FirstName} {existingLegacyMember.LastName}' (कोड: {existingLegacyMember.MemberCode ?? existingLegacyMember.MemberID.ToString()}) साठी नोंदवला आहे." });
                }
            }

            if (!string.IsNullOrWhiteSpace(member.AadhaarNo))
            {
                bool aadhaarExists = await _context.Members.AnyAsync(m => m.MemberID != id && m.AadhaarNo == member.AadhaarNo);
                if (aadhaarExists)
                {
                    return BadRequest(new { message = $"हा आधार नंबर ({member.AadhaarNo}) आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
            }

            if (!string.IsNullOrWhiteSpace(member.PANNo))
            {
                bool panExists = await _context.Members.AnyAsync(m => m.MemberID != id && m.PANNo == member.PANNo);
                if (panExists)
                {
                    return BadRequest(new { message = $"हा पॅन नंबर ({member.PANNo}) आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
            }

            if (!string.IsNullOrWhiteSpace(member.MobileNo))
            {
                bool mobileExists = await _context.Members.AnyAsync(m => m.MemberID != id && m.MobileNo == member.MobileNo);
                if (mobileExists)
                {
                    return BadRequest(new { message = $"हा मोबाईल नंबर ({member.MobileNo}) आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
            }

            // Minor Age Validation on Backend
            if (member.BirthDate.HasValue)
            {
                var today = DateTime.Today;
                int age = today.Year - member.BirthDate.Value.Year;
                if (member.BirthDate.Value.Date > today.AddYears(-age)) age--;

                if (age < 18)
                {
                    member.IsMinor = true;
                    if (string.IsNullOrWhiteSpace(member.GuardianName))
                    {
                        return BadRequest(new { message = "सभासदाचे वय १८ वर्षांपेक्षा कमी (अज्ञान) असल्याने पालकाचे नाव (Guardian Name) आवश्यक आहे." });
                    }
                    if (string.IsNullOrWhiteSpace(member.GuardianRelation))
                    {
                        return BadRequest(new { message = "अज्ञान सभासदासाठी पालकाचे नाते (Guardian Relation) निवडणे आवश्यक आहे." });
                    }
                }
                else
                {
                    member.IsMinor = false;
                }
            }

            var existingMember = await _context.Members.FindAsync(id);
            if (existingMember == null)
            {
                return NotFound();
            }

            if (!isHeadOfficeAdmin)
            {
                if (existingMember.BranchID != userBranchId || member.BranchID != userBranchId)
                {
                    return StatusCode(403, new { message = "आपण केवळ आपल्या शाखेतील सभासदांची माहिती अद्ययावत करू शकता (Cross-Branch Edit Denied)." });
                }
                member.BranchID = userBranchId;
            }

            existingMember.BranchID = member.BranchID;
            existingMember.OldMemberCode = member.OldMemberCode ?? member.LegacyMemberNo;
            existingMember.LegacyMemberNo = member.LegacyMemberNo ?? member.OldMemberCode;
            existingMember.FirstName = member.FirstName;
            existingMember.MiddleName = member.MiddleName;
            existingMember.LastName = member.LastName;
            existingMember.NickName = member.NickName;
            existingMember.FirstNameEng = member.FirstNameEng;
            existingMember.MiddleNameEng = member.MiddleNameEng;
            existingMember.LastNameEng = member.LastNameEng;
            existingMember.Address = member.Address;
            existingMember.AddressEng = member.AddressEng;
            existingMember.Village = member.Village;
            existingMember.Taluka = member.Taluka;
            existingMember.District = member.District;
            existingMember.MobileNo = member.MobileNo;
            existingMember.AadhaarNo = member.AadhaarNo;
            existingMember.PANNo = member.PANNo;
            existingMember.JoiningDate = member.JoiningDate;
            existingMember.NomineeName = member.NomineeName;
            existingMember.NomineeNameEng = member.NomineeNameEng;
            existingMember.NomineeRelation = member.NomineeRelation;
            existingMember.NomineeAddress = member.NomineeAddress;
            existingMember.NomineeBirthDate = member.NomineeBirthDate;
            existingMember.NomineeIsMinor = member.NomineeIsMinor;
            existingMember.NomineeGuardianName = member.NomineeGuardianName;
            existingMember.PhotoPath = member.PhotoPath;
            existingMember.SignaturePath = member.SignaturePath;
            if (!string.IsNullOrWhiteSpace(member.CIFNo) && member.CIFNo != existingMember.CIFNo)
            {
                bool cifExists = await _context.Members.IgnoreQueryFilters().AnyAsync(m => m.MemberID != id && m.CIFNo == member.CIFNo);
                if (cifExists)
                {
                    return BadRequest(new { message = $"हा CIF क्रमांक ({member.CIFNo}) आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
                existingMember.CIFNo = member.CIFNo.Trim();
            }

            existingMember.AadhaarDocPath = member.AadhaarDocPath;
            existingMember.PanDocPath = member.PanDocPath;
            existingMember.Gender = member.Gender;
            existingMember.BirthDate = member.BirthDate;
            existingMember.Occupation = member.Occupation;
            existingMember.CasteCategory = member.CasteCategory;
            existingMember.Caste = member.Caste;
            existingMember.Email = member.Email;
            existingMember.IsMinor = member.IsMinor;
            existingMember.GuardianName = member.GuardianName;
            existingMember.GuardianNameEng = member.GuardianNameEng;
            existingMember.GuardianRelation = member.GuardianRelation;
            existingMember.GuardianAadhaarNo = member.GuardianAadhaarNo;
            existingMember.GuardianMobileNo = member.GuardianMobileNo;
            existingMember.GuardianAddress = member.GuardianAddress;
            existingMember.EmployerId = member.EmployerId;
            existingMember.LegacyMemberNo = member.LegacyMemberNo;
            existingMember.Status = member.Status;
            existingMember.MembershipType = string.IsNullOrWhiteSpace(member.MembershipType) ? "Regular" : member.MembershipType.Trim();
            existingMember.UpdatedBy = userId;
            existingMember.UpdatedOn = DateTime.Now;

            try
            {
                await _context.SaveChangesAsync();
                await LogAuditAsync("MEMBER_UPDATE", id.ToString(), $"सभासद माहिती अद्ययावत केली: {existingMember.FirstName} {existingMember.LastName}, CIF: {existingMember.CIFNo}");
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!MemberExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }
            catch (DbUpdateException ex)
            {
                string detailedError = ex.InnerException?.Message ?? ex.Message;
                if (detailedError.Contains("IX_Members_AadhaarNo") || detailedError.Contains("AadhaarNo"))
                {
                    return BadRequest(new { message = "हा आधार नंबर आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
                if (detailedError.Contains("IX_Members_PANNo") || detailedError.Contains("PANNo"))
                {
                    return BadRequest(new { message = "हा पॅन नंबर आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
                if (detailedError.Contains("IX_Members_CIFNo") || detailedError.Contains("CIFNo"))
                {
                    return BadRequest(new { message = "हा CIF क्रमांक आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
                if (detailedError.Contains("truncated") || detailedError.Contains("String or binary data"))
                {
                    return BadRequest(new { message = "माहितीची लांबी डेटाबेसच्या मर्यादेपेक्षा जास्त आहे (Data truncation error).", error = "कृपया प्रविष्ट केलेल्या मजकुराची लांबी तपासा." });
                }
                return BadRequest(new { message = "खातेदार अपडेट करताना त्रुटी आली: " + detailedError });
            }

            return Ok(existingMember);
        }

        // POST: api/Members
        [HttpPost]
        public async Task<ActionResult<Member>> PostMember(Member member)
        {
            var (userId, username, userBranchId, _, isHeadOfficeAdmin) = GetCurrentUserContext();

            if (!isHeadOfficeAdmin)
            {
                member.BranchID = userBranchId;
            }

            // Validate required fields before saving
            var validationErrors = new List<string>();
            if (string.IsNullOrWhiteSpace(member.FirstName))
                validationErrors.Add("पहिले नाव (FirstName) आवश्यक आहे.");
            if (string.IsNullOrWhiteSpace(member.LastName))
                validationErrors.Add("आडनाव (LastName) आवश्यक आहे.");

            // Sanitize optional fields to null if empty
            member.MobileNo = string.IsNullOrWhiteSpace(member.MobileNo) ? null : member.MobileNo.Trim();
            member.AadhaarNo = string.IsNullOrWhiteSpace(member.AadhaarNo) ? null : member.AadhaarNo.Trim();
            member.PANNo = string.IsNullOrWhiteSpace(member.PANNo) ? null : member.PANNo.Trim().ToUpper();
            member.MemberCode = string.IsNullOrWhiteSpace(member.MemberCode) ? null : member.MemberCode.Trim();

            if (validationErrors.Count > 0)
                return BadRequest(new { message = "आवश्यक माहिती भरा (Required fields missing)", errors = validationErrors });

            var lengthErrors = ValidateMemberLengths(member);
            if (lengthErrors.Count > 0)
                return BadRequest(new { message = "माहितीची लांबी डेटाबेसच्या मर्यादेपेक्षा जास्त आहे (Field length limit exceeded)", errors = lengthErrors });

            // Duplicate checks for Member
            member.LegacyMemberNo = string.IsNullOrWhiteSpace(member.LegacyMemberNo) ? null : member.LegacyMemberNo.Trim();
            member.OldMemberCode = string.IsNullOrWhiteSpace(member.OldMemberCode) ? null : member.OldMemberCode.Trim();

            var checkLegacyNo = member.LegacyMemberNo ?? member.OldMemberCode;
            if (!string.IsNullOrWhiteSpace(checkLegacyNo))
            {
                var existingLegacyMember = await _context.Members
                    .AsNoTracking()
                    .FirstOrDefaultAsync(m => !m.IsDeleted && 
                        (m.LegacyMemberNo == checkLegacyNo || m.OldMemberCode == checkLegacyNo));
                if (existingLegacyMember != null)
                {
                    return BadRequest(new { message = $"हा जुना सभासद आयडी ({checkLegacyNo}) आधीच सभासद '{existingLegacyMember.FirstName} {existingLegacyMember.LastName}' (कोड: {existingLegacyMember.MemberCode ?? existingLegacyMember.MemberID.ToString()}) साठी नोंदवला आहे." });
                }
            }

            if (!string.IsNullOrWhiteSpace(member.AadhaarNo))
            {
                bool aadhaarExists = await _context.Members.AnyAsync(m => m.AadhaarNo == member.AadhaarNo);
                if (aadhaarExists)
                {
                    return BadRequest(new { message = $"हा आधार नंबर ({member.AadhaarNo}) आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
            }

            if (!string.IsNullOrWhiteSpace(member.PANNo))
            {
                bool panExists = await _context.Members.AnyAsync(m => m.PANNo == member.PANNo);
                if (panExists)
                {
                    return BadRequest(new { message = $"हा पॅन नंबर ({member.PANNo}) आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
            }

            if (!string.IsNullOrWhiteSpace(member.MobileNo))
            {
                bool mobileExists = await _context.Members.AnyAsync(m => m.MobileNo == member.MobileNo);
                if (mobileExists)
                {
                    return BadRequest(new { message = $"हा मोबाईल नंबर ({member.MobileNo}) आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
            }

            // Minor Age Validation on Backend
            if (member.BirthDate.HasValue)
            {
                var today = DateTime.Today;
                int age = today.Year - member.BirthDate.Value.Year;
                if (member.BirthDate.Value.Date > today.AddYears(-age)) age--;

                if (age < 18)
                {
                    member.IsMinor = true;
                    if (string.IsNullOrWhiteSpace(member.GuardianName))
                    {
                        return BadRequest(new { message = "सभासदाचे वय १८ वर्षांपेक्षा कमी (अज्ञान) असल्याने पालकाचे नाव (Guardian Name) आवश्यक आहे." });
                    }
                    if (string.IsNullOrWhiteSpace(member.GuardianRelation))
                    {
                        return BadRequest(new { message = "अज्ञान सभासदासाठी पालकाचे नाते (Guardian Relation) निवडणे आवश्यक आहे." });
                    }
                }
                else
                {
                    member.IsMinor = false;
                }
            }

            // Disconnect navigation entities to prevent EF Core from attempting cascading insertions
            member.Branch = null;
            member.Employer = null;
            member.BranchID = member.BranchID > 0 ? member.BranchID : (userBranchId > 0 ? userBranchId : 1);

            // Check CIF Uniqueness across entire database & Auto-Resolve Collisions
            if (string.IsNullOrWhiteSpace(member.CIFNo) || await _context.Members.IgnoreQueryFilters().AnyAsync(m => m.CIFNo == member.CIFNo))
            {
                member.CIFNo = await GenerateUniqueCifAsync();
            }

            if (string.IsNullOrWhiteSpace(member.MemberCode))
            {
                member.MemberCode = null;
            }
            else
            {
                member.MemberCode = member.MemberCode.Trim();
            }

            member.CreatedBy = userId;
            member.CreatedOn = DateTime.Now;
            member.IsDeleted = false;
            member.MembershipType = string.IsNullOrWhiteSpace(member.MembershipType) 
                ? (string.IsNullOrWhiteSpace(member.MemberCode) ? "Nominal" : "Regular") 
                : member.MembershipType.Trim();

            _context.Members.Add(member);
            try
            {
                await _context.SaveChangesAsync();
                await LogAuditAsync("MEMBER_CREATE", member.MemberID.ToString(), $"नवीन सभासद नोंदणी: {member.FirstName} {member.LastName}, CIF: {member.CIFNo}");
            }
            catch (DbUpdateException ex)
            {
                string detailedError = ex.InnerException?.Message ?? ex.Message;
                if (detailedError.Contains("IX_Members_CIFNo"))
                {
                    try
                    {
                        _context.Entry(member).State = EntityState.Detached;
                        member.CIFNo = await GenerateUniqueCifAsync();
                        _context.Members.Add(member);
                        await _context.SaveChangesAsync();
                        await LogAuditAsync("MEMBER_CREATE", member.MemberID.ToString(), $"नवीन सभासद नोंदणी: {member.FirstName} {member.LastName}, CIF: {member.CIFNo}");
                        return CreatedAtAction("GetMember", new { id = member.MemberID }, member);
                    }
                    catch (Exception retryEx)
                    {
                        return BadRequest(new { message = "खातेदार सेव्ह करताना डेटाबेस त्रुटी आली: " + (retryEx.InnerException?.Message ?? retryEx.Message) });
                    }
                }
                if (detailedError.Contains("IX_Members_MemberCode"))
                {
                    return BadRequest(new { message = "हा सभासद नंबर (MemberCode) आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
                if (detailedError.Contains("IX_Members_AadhaarNo"))
                {
                    return BadRequest(new { message = "हा आधार नंबर आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
                if (detailedError.Contains("IX_Members_PANNo"))
                {
                    return BadRequest(new { message = "हा पॅन नंबर आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
                if (detailedError.Contains("truncated") || detailedError.Contains("String or binary data"))
                {
                    return BadRequest(new { message = "माहितीची लांबी डेटाबेसच्या मर्यादेपेक्षा जास्त आहे (Data truncation error).", error = detailedError });
                }
                return BadRequest(new { message = "खातेदार सेव्ह करताना त्रुटी आली: " + detailedError });
            }

            return CreatedAtAction("GetMember", new { id = member.MemberID }, member);
        }

        // DELETE: api/Members/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteMember(int id)
        {
            var (userId, username, userBranchId, _, isHeadOfficeAdmin) = GetCurrentUserContext();
            var member = await _context.Members.FindAsync(id);
            if (member == null)
            {
                return NotFound();
            }

            if (!isHeadOfficeAdmin && member.BranchID != userBranchId)
            {
                return StatusCode(403, new { message = "आपण केवळ आपल्या शाखेतील सभासद बंद किंवा डिलीट करू शकता (Cross-Branch Deletion Denied)." });
            }

            // Comprehensive active accounts & dependency check
            bool hasActiveLoans = await _context.LoanAccounts.AnyAsync(l => (l.MemberID == id || l.CoMemberID == id || l.CoMember2ID == id || l.Guarantor1MemberID == id || l.Guarantor2MemberID == id) && l.Status != "Closed");
            bool hasActiveSavings = await _context.SavingAccountMasters.AnyAsync(s => s.MemberID == id && s.Status != "Closed");
            bool hasActiveFds = await _context.FdAccounts.AnyAsync(f => f.MemberID == id && f.Status == "Active");
            bool hasActiveRds = await _context.RdAccounts.AnyAsync(r => r.MemberID == id && r.Status == "Active");
            bool hasActivePigmies = await _context.PigmyAccounts.AnyAsync(p => p.MemberID == id && p.Status == "Active");
            bool hasActiveShares = await _context.ShareAccounts.AnyAsync(s => s.MemberId == id && s.TotalShareCount > 0);
            bool hasActiveLockers = await _context.LockerAllotments.AnyAsync(l => l.MemberID == id && l.Status == "Allotted");
            bool isCommitteeMember = await _context.CommitteeMembers.AnyAsync(c => c.MemberID == id && c.Status == "Active");
            bool hasActiveLegalCases = await _context.Sec101CaseMasters.AnyAsync(c => c.MemberId == id && c.Status != "CLOSED_RECOVERED" && c.Status != "DISMISSED");
            bool hasPendingLoanApps = await _context.LoanApplications.AnyAsync(a => (a.MemberID == id || a.Guarantor1MemberID == id || a.Guarantor2MemberID == id) && !_context.LoanAccounts.Any(l => l.LoanAccountNo == a.LoanAccountNo));
            bool hasActiveJointMembers = await _context.JointMembers.AnyAsync(j => j.PrimaryMemberID == id && j.Status == "Active");

            if (hasActiveLoans || hasActiveSavings || hasActiveFds || hasActiveRds || hasActivePigmies || hasActiveShares || hasActiveLockers || isCommitteeMember || hasActiveLegalCases || hasPendingLoanApps || hasActiveJointMembers)
            {
                return BadRequest(new
                {
                    message = "या सभासदाची चालू खाती, ठेवी, शेअर्स, जामीनकी, प्रलंबित कर्ज अर्ज, सह-सभासद, लॉकर किंवा कायदेशीर प्रकरणे जोडलेली असल्याने सभासद डिलीट करता येत नाही."
                });
            }

            try
            {
                // Remove zero-share account record if exists
                var emptyShares = await _context.ShareAccounts.Where(s => s.MemberId == id).ToListAsync();
                if (emptyShares.Any())
                {
                    _context.ShareAccounts.RemoveRange(emptyShares);
                }

                _context.Members.Remove(member);
                await _context.SaveChangesAsync();

                await LogAuditAsync("MEMBER_DELETE", id.ToString(), $"सभासद कायमचा डिलीट केला: {member.FirstName} {member.LastName}, CIF: {member.CIFNo}, Code: {member.MemberCode}");

                return Ok(new { message = "सभासद यशस्वीरित्या डिलीट केला." });
            }
            catch (Exception ex)
            {
                string detailedError = ex.InnerException?.Message ?? ex.Message;
                return BadRequest(new { message = "सभासद डिलीट करताना त्रुटी आली: " + detailedError });
            }
        }

        private bool MemberExists(int id)
        {
            return _context.Members.Any(e => e.MemberID == id);
        }

        // POST: api/Members/upload
        [HttpPost("upload")]
        public async Task<IActionResult> UploadFile(IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest("कोणतीही फाईल अपलोड केलेली नाही.");
            }

            // File size validation (Max 10 MB)
            if (file.Length > 10 * 1024 * 1024)
            {
                return BadRequest("फाईलची साईझ १० MB पेक्षा जास्त नसावी.");
            }

            // Extension Whitelist validation
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp", ".pdf" };
            var fileExt = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(fileExt))
            {
                return BadRequest("केवळ .jpg, .jpeg, .png, .webp किंवा .pdf फाईल्स अपलोड करता येतील.");
            }

            var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }

            var uniqueFileName = Guid.NewGuid().ToString("N") + fileExt;
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var fileStream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(fileStream);
            }

            var fileUrl = $"/uploads/{uniqueFileName}";
            return Ok(new { url = fileUrl });
        }

        // GET: api/Members/{id}/ClosureInfo
        [HttpGet("{id}/ClosureInfo")]
        public async Task<IActionResult> GetClosureInfo(int id)
        {
            var member = await _context.Members.FindAsync(id);
            if (member == null) return NotFound("Member not found.");

            var loanBalance = await _context.LoanAccounts
                .Where(l => l.MemberID == id && l.Status != "Closed")
                .SumAsync(l => l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance);

            var savingBalance = await _context.SavingAccountMasters
                .Where(s => s.MemberID == id && s.Status != "Closed")
                .SumAsync(s => s.CurrentBalance);

            var fdBalance = await _context.FdAccounts
                .Where(f => f.MemberID == id && f.Status == "Active")
                .SumAsync(f => f.DepositAmount);

            var rdBalance = await _context.RdAccounts
                .Where(r => r.MemberID == id && r.Status == "Active")
                .SumAsync(r => r.TotalDepositedAmount);

            var pigmyBalance = await _context.PigmyAccounts
                .Where(p => p.MemberID == id && p.Status == "Active")
                .SumAsync(p => p.TotalDepositedAmount);

            var shareAccount = await _context.ShareAccounts.FirstOrDefaultAsync(s => s.MemberId == id);
            var shareBalance = shareAccount?.TotalShareAmount ?? 0;
            var shareCount = shareAccount?.TotalShareCount ?? 0;

            // Check if member is a Guarantor on any active loans
            var guarantorLoansRaw = await _context.LoanAccounts
                .Include(l => l.Member)
                .Where(l => (l.Guarantor1MemberID == id || l.Guarantor2MemberID == id) && l.Status != "Closed")
                .ToListAsync();

            var guaranteedLoans = guarantorLoansRaw.Select(l => new
            {
                LoanAccountID = l.LoanAccountID,
                LoanAccountNo = l.LoanAccountNo,
                BorrowerName = l.Member != null ? $"{l.Member.FirstName} {(string.IsNullOrWhiteSpace(l.Member.MiddleName) ? "" : l.Member.MiddleName + " ")}{l.Member.LastName}".Trim() : "Unknown",
                BorrowerCode = l.Member != null ? l.Member.MemberCode : "",
                BorrowerCif = l.Member != null ? l.Member.CIFNo : "",
                SanctionedAmount = l.SanctionedAmount,
                PrincipalBalance = l.PrincipalBalance,
                InterestBalance = l.InterestBalance,
                TotalOutstanding = l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance,
                GuarantorType = l.Guarantor1MemberID == id ? "जामीनदार १ (Guarantor 1)" : "जामीनदार २ (Guarantor 2)",
                Status = l.Status
            }).ToList();

            var activeGuarantorLoans = guaranteedLoans.Where(l => l.TotalOutstanding > 0).ToList();
            bool hasGuarantorLiability = activeGuarantorLoans.Count > 0;
            decimal totalGuaranteedOutstanding = activeGuarantorLoans.Sum(l => l.TotalOutstanding);

            bool canClose = loanBalance <= 0 && savingBalance <= 0 && fdBalance <= 0 && rdBalance <= 0 && pigmyBalance <= 0 && !hasGuarantorLiability;

            return Ok(new
            {
                MemberId = id,
                MemberName = $"{member.FirstName} {member.LastName}",
                Status = member.Status,
                LoanBalance = loanBalance,
                SavingBalance = savingBalance,
                FdBalance = fdBalance,
                RdBalance = rdBalance,
                PigmyBalance = pigmyBalance,
                ShareBalance = shareBalance,
                ShareCount = shareCount,
                GuaranteedLoans = guaranteedLoans,
                HasGuarantorLiability = hasGuarantorLiability,
                TotalGuaranteedOutstanding = totalGuaranteedOutstanding,
                CanClose = canClose
            });
        }

        public class CloseMemberRequest
        {
            public int BranchId { get; set; } = 1;
            public string Narration { get; set; } = "Member Closure";
        }

        // POST: api/Members/{id}/Close
        [HttpPost("{id}/Close")]
        public async Task<IActionResult> CloseMember(int id, [FromBody] CloseMemberRequest request)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var (userId, username, userBranchId, _, isHeadOfficeAdmin) = GetCurrentUserContext();
                var member = await _context.Members.FindAsync(id);
                if (member == null) return NotFound("Member not found.");
                if (member.Status == "Closed") return BadRequest("Member is already closed.");

                if (!isHeadOfficeAdmin && member.BranchID != userBranchId)
                {
                    return StatusCode(403, new { message = "आपण केवळ आपल्या शाखेतील सभासदाचे खाते बंद करू शकता (Cross-Branch Closure Denied)." });
                }

                // Re-verify balances
                var hasActiveLoans = await _context.LoanAccounts.AnyAsync(l => l.MemberID == id && l.Status != "Closed" && (l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance) > 0);
                var hasActiveSavings = await _context.SavingAccountMasters.AnyAsync(s => s.MemberID == id && s.Status != "Closed" && s.CurrentBalance > 0);
                var hasActiveFds = await _context.FdAccounts.AnyAsync(f => f.MemberID == id && f.Status == "Active");
                var hasActiveRds = await _context.RdAccounts.AnyAsync(r => r.MemberID == id && r.Status == "Active");
                var hasActivePigmies = await _context.PigmyAccounts.AnyAsync(p => p.MemberID == id && p.Status == "Active");

                // Check Guarantor Liability
                var hasGuarantorLiability = await _context.LoanAccounts
                    .AnyAsync(l => (l.Guarantor1MemberID == id || l.Guarantor2MemberID == id)
                                && l.Status != "Closed"
                                && (l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance) > 0);

                if (hasGuarantorLiability)
                {
                    return BadRequest("हा सभासद इतर चालू कर्जासाठी जामीनदार (Guarantor) असल्याने सभासदत्व रद्द करता येणार नाही. प्रथम संबंधित कर्जाची परतफेड किंवा जामीनदार बदल करणे आवश्यक आहे.");
                }

                if (hasActiveLoans || hasActiveSavings || hasActiveFds || hasActiveRds || hasActivePigmies)
                {
                    return BadRequest("Cannot close member. Active accounts or outstanding balances exist.");
                }

                // Handle Share Closure if any
                var shareAccount = await _context.ShareAccounts.FirstOrDefaultAsync(s => s.MemberId == id);
                if (shareAccount != null && shareAccount.TotalShareCount > 0)
                {
                    decimal totalShareAmount = shareAccount.TotalShareAmount;

                    var shareCapitalLedger = await Helpers.ShareLedgerHelper.GetShareCapitalLedgerAsync(_context);
                    int branchCashId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, request.BranchId, "SHARE");
                    var cashLedger = await _context.Ledgers.FindAsync(branchCashId) ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.AccountType == "Assets") ?? await _context.Ledgers.FirstAsync();

                    int vchCount = await _context.Vouchers.CountAsync() + 1;
                    var voucher = new Voucher
                    {
                        BranchID = request.BranchId,
                        VoucherNo = $"VCH-SHR-WD-{DateTime.Today:yyyyMMdd}-{vchCount:D4}",
                        VoucherDate = DateTime.Today,
                        VoucherType = "Payment",
                        TotalAmount = totalShareAmount,
                        Narration = $"Share Withdrawal on Member Closure for {member.FirstName} {member.LastName}. {request.Narration}",
                        CreatedBy = userId,
                        VoucherDetails = new List<VoucherDetail>
                        {
                            new VoucherDetail { LedgerID = shareCapitalLedger.LedgerID, DrCr = "Dr", Amount = totalShareAmount, MemberID = member.MemberID },
                            new VoucherDetail { LedgerID = cashLedger.LedgerID, DrCr = "Cr", Amount = totalShareAmount, MemberID = member.MemberID }
                        }
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    var shareTxn = new ShareTransaction
                    {
                        ShareAccountId = shareAccount.ShareAccountId,
                        CustomerID = member.CustomerID ?? member.MemberID,
                        TransactionType = "Withdrawal",
                        NumberOfShares = shareAccount.TotalShareCount,
                        Amount = totalShareAmount,
                        Narration = "Member Closure",
                        VoucherId = voucher.VoucherID
                    };
                    _context.ShareTransactions.Add(shareTxn);

                    shareAccount.TotalShareCount = 0;
                    shareAccount.TotalShareAmount = 0;
                }

                member.Status = "Closed";
                member.UpdatedBy = userId;
                member.UpdatedOn = DateTime.Now;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                await LogAuditAsync("MEMBER_CLOSE", id.ToString(), $"सभासदत्व यशस्वीरित्या रद्द केले: {member.FirstName} {member.LastName}, CIF: {member.CIFNo}");

                return Ok(new { message = "Member successfully closed." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        // GET: api/Members/5/DeceasedClaimInfo
        [HttpGet("{id}/DeceasedClaimInfo")]
        public async Task<IActionResult> GetDeceasedClaimInfo(int id)
        {
            var (_, _, userBranchId, _, isHeadOfficeAdmin) = GetCurrentUserContext();
            var member = await _context.Members.FindAsync(id);
            if (member == null) return NotFound("Member not found.");

            if (!isHeadOfficeAdmin && member.BranchID != userBranchId)
            {
                return StatusCode(403, new { message = "आपल्याला इतर शाखेतील मयत सभासदाची माहिती पाहण्याची परवानगी नाही." });
            }

            var savingsBalance = await _context.SavingAccountMasters
                .Where(s => s.MemberID == id && s.Status != "Closed")
                .SumAsync(s => s.CurrentBalance);

            var fdBalance = await _context.FdAccounts
                .Where(f => f.MemberID == id && f.Status == "Active")
                .SumAsync(f => f.DepositAmount);

            var rdBalance = await _context.RdAccounts
                .Where(r => r.MemberID == id && r.Status == "Active")
                .SumAsync(r => r.TotalDepositedAmount);

            var pigmyBalance = await _context.PigmyAccounts
                .Where(p => p.MemberID == id && p.Status == "Active")
                .SumAsync(p => p.TotalDepositedAmount);

            var shareAccount = await _context.ShareAccounts.FirstOrDefaultAsync(s => s.MemberId == id);
            var shareAmount = shareAccount?.TotalShareAmount ?? 0;
            var shareCount = shareAccount?.TotalShareCount ?? 0;

            var totalGrossAssets = savingsBalance + fdBalance + rdBalance + pigmyBalance + shareAmount;

            var loanLiability = await _context.LoanAccounts
                .Where(l => l.MemberID == id && l.Status != "Closed")
                .SumAsync(l => l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance);

            var guarantorLoansRaw = await _context.LoanAccounts
                .Include(l => l.Member)
                .Where(l => (l.Guarantor1MemberID == id || l.Guarantor2MemberID == id) && l.Status != "Closed")
                .ToListAsync();

            decimal totalGuarantorLiability = guarantorLoansRaw.Sum(l => l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance);

            decimal netPayable = totalGrossAssets - loanLiability;

            return Ok(new
            {
                memberID = id,
                memberName = $"{member.FirstName} {member.MiddleName} {member.LastName}".Trim(),
                memberCode = member.MemberCode,
                cifNo = member.CIFNo,
                status = member.Status,
                nomineeName = member.NomineeName ?? "-",
                nomineeRelation = member.NomineeRelation ?? "-",
                nomineeAddress = member.NomineeAddress ?? "-",
                savingsBalance,
                fdBalance,
                rdBalance,
                pigmyBalance,
                shareAmount,
                shareCount,
                totalGrossAssets,
                loanLiability,
                totalGuarantorLiability,
                hasGuarantorLiability = totalGuarantorLiability > 0,
                netPayable = netPayable > 0 ? netPayable : 0,
                netRecoverable = netPayable < 0 ? Math.Abs(netPayable) : 0
            });
        }

        public class DeceasedClaimRequest
        {
            public int BranchId { get; set; } = 1;
            public DateTime DeathDate { get; set; } = DateTime.Today;
            public string? DeathCertificateNo { get; set; }
            public string NomineeName { get; set; } = string.Empty;
            public string? NomineeRelation { get; set; }
            public string? NomineeAadhaarNo { get; set; }
            public string? NomineeMobileNo { get; set; }
            public string? NomineeBankAccount { get; set; }
            public string? ResolutionNo { get; set; }
            public DateTime? ResolutionDate { get; set; }
            public string? Remarks { get; set; }
        }

        // POST: api/Members/5/DeceasedClaimSettlement
        [HttpPost("{id}/DeceasedClaimSettlement")]
        public async Task<IActionResult> SettleDeceasedClaim(int id, [FromBody] DeceasedClaimRequest req)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var (userId, username, userBranchId, _, isHeadOfficeAdmin) = GetCurrentUserContext();
                var member = await _context.Members.FindAsync(id);
                if (member == null) return NotFound("Member not found.");

                if (!isHeadOfficeAdmin && member.BranchID != userBranchId)
                {
                    return StatusCode(403, new { message = "आपण केवळ आपल्या शाखेतील मयत सभासदाचा क्लेम सेटल करू शकता (Cross-Branch Claim Settlement Denied)." });
                }

                // Check active loan balance
                var loanBalance = await _context.LoanAccounts
                    .Where(l => l.MemberID == id && l.Status != "Closed")
                    .SumAsync(l => l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance);

                var savingsBalance = await _context.SavingAccountMasters
                    .Where(s => s.MemberID == id && s.Status != "Closed")
                    .SumAsync(s => s.CurrentBalance);

                var fdBalance = await _context.FdAccounts
                    .Where(f => f.MemberID == id && f.Status == "Active")
                    .SumAsync(f => f.DepositAmount);

                var rdBalance = await _context.RdAccounts
                    .Where(r => r.MemberID == id && r.Status == "Active")
                    .SumAsync(r => r.TotalDepositedAmount);

                var pigmyBalance = await _context.PigmyAccounts
                    .Where(p => p.MemberID == id && p.Status == "Active")
                    .SumAsync(p => p.TotalDepositedAmount);

                var shareAccount = await _context.ShareAccounts.FirstOrDefaultAsync(s => s.MemberId == id);
                decimal shareAmount = shareAccount?.TotalShareAmount ?? 0;

                decimal grossAmount = savingsBalance + fdBalance + rdBalance + pigmyBalance + shareAmount;
                decimal netAmount = grossAmount - loanBalance;

                // Close deposit accounts
                var savings = await _context.SavingAccountMasters.Where(s => s.MemberID == id && s.Status != "Closed").ToListAsync();
                foreach (var s in savings)
                {
                    s.Status = "Closed";
                    s.CurrentBalance = 0;
                }

                var fds = await _context.FdAccounts.Where(f => f.MemberID == id && f.Status == "Active").ToListAsync();
                foreach (var f in fds) f.Status = "Closed";

                var rds = await _context.RdAccounts.Where(r => r.MemberID == id && r.Status == "Active").ToListAsync();
                foreach (var r in rds) r.Status = "Closed";

                var pigmies = await _context.PigmyAccounts.Where(p => p.MemberID == id && p.Status == "Active").ToListAsync();
                foreach (var p in pigmies) p.Status = "Closed";

                // Close Share account
                if (shareAccount != null)
                {
                    shareAccount.TotalShareCount = 0;
                    shareAccount.TotalShareAmount = 0;
                }

                // Generate Settlement Voucher if netAmount > 0
                int? voucherId = null;
                if (netAmount > 0)
                {
                    int branchCashId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, req.BranchId, "CLAIM");
                    var cashLedger = await _context.Ledgers.FindAsync(branchCashId) ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.AccountType == "Assets") ?? await _context.Ledgers.FirstAsync();
                    var claimLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("दावा") || l.LedgerName.Contains("Claim") || l.LedgerName.Contains("वारस")) ?? cashLedger;

                    int vchCount = await _context.Vouchers.CountAsync() + 1;
                    var voucher = new Voucher
                    {
                        BranchID = req.BranchId,
                        VoucherNo = $"VCH-CLM-{DateTime.Today:yyyyMMdd}-{vchCount:D4}",
                        VoucherDate = DateTime.Today,
                        VoucherType = "Payment",
                        TotalAmount = netAmount,
                        Narration = $"मयत सभासद वारसदार क्लेम सेटलमेंट: {member.FirstName} {member.LastName} (वारसदार: {req.NomineeName}, मयत दाखला: {req.DeathCertificateNo}, ठराव: {req.ResolutionNo})",
                        CreatedBy = userId,
                        VoucherDetails = new List<VoucherDetail>
                        {
                            new VoucherDetail { LedgerID = claimLedger.LedgerID, DrCr = "Dr", Amount = netAmount, MemberID = member.MemberID },
                            new VoucherDetail { LedgerID = cashLedger.LedgerID, DrCr = "Cr", Amount = netAmount, MemberID = member.MemberID }
                        }
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();
                    voucherId = voucher.VoucherID;
                }

                // Create DeceasedClaimSettlement Record
                var settlement = new DeceasedClaimSettlement
                {
                    MemberID = id,
                    BranchID = req.BranchId,
                    DeathDate = req.DeathDate,
                    DeathCertificateNo = req.DeathCertificateNo,
                    NomineeName = string.IsNullOrWhiteSpace(req.NomineeName) ? (member.NomineeName ?? "Legal Heir") : req.NomineeName,
                    NomineeRelation = req.NomineeRelation ?? member.NomineeRelation,
                    NomineeAadhaarNo = req.NomineeAadhaarNo,
                    NomineeMobileNo = req.NomineeMobileNo,
                    NomineeBankAccount = req.NomineeBankAccount,
                    TotalSavingsBalance = savingsBalance,
                    TotalFdBalance = fdBalance,
                    TotalRdBalance = rdBalance,
                    TotalPigmyBalance = pigmyBalance,
                    TotalShareAmount = shareAmount,
                    TotalLoanLiability = loanBalance,
                    NetPayableAmount = netAmount,
                    ResolutionNo = req.ResolutionNo,
                    ResolutionDate = req.ResolutionDate,
                    VoucherID = voucherId,
                    Status = "Settled",
                    SettlementDate = DateTime.Today,
                    Remarks = req.Remarks,
                    CreatedBy = userId,
                    CreatedOn = DateTime.Now
                };
                _context.DeceasedClaimSettlements.Add(settlement);

                // Update Member Status
                member.Status = "Mayat";
                member.UpdatedBy = userId;
                member.UpdatedOn = DateTime.Now;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                await LogAuditAsync("DECEASED_CLAIM_SETTLED", settlement.ClaimID.ToString(), $"मयत खातेदार क्लेम सेटलमेंट पूर्ण: {member.FirstName} {member.LastName}, वारसदार: {settlement.NomineeName}, निव्वळ रक्कम: ₹{netAmount}");

                return Ok(new
                {
                    message = "मयत सभासद क्लेम सेटलमेंट यशस्वीरित्या पूर्ण झाले.",
                    claimID = settlement.ClaimID,
                    voucherID = voucherId,
                    netPayableAmount = netAmount
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        // GET: api/Members/5/guarantor-summary
        [HttpGet("{id}/guarantor-summary")]
        public async Task<IActionResult> GetGuarantorSummary(int id)
        {
            var member = await _context.Members.FindAsync(id);
            if (member == null)
            {
                return NotFound();
            }

            var unlinkedAccounts = await _context.LoanAccounts
                .Include(l => l.LoanApplication)
                .Where(l => l.LoanApplication != null && (!l.Guarantor1MemberID.HasValue || !l.Guarantor2MemberID.HasValue))
                .ToListAsync();

            bool updatedUnlinked = false;
            foreach (var acc in unlinkedAccounts)
            {
                if (acc.LoanApplication != null)
                {
                    if (!acc.Guarantor1MemberID.HasValue && acc.LoanApplication.Guarantor1MemberID.HasValue)
                    {
                        acc.Guarantor1MemberID = acc.LoanApplication.Guarantor1MemberID;
                        updatedUnlinked = true;
                    }
                    if (!acc.Guarantor2MemberID.HasValue && acc.LoanApplication.Guarantor2MemberID.HasValue)
                    {
                        acc.Guarantor2MemberID = acc.LoanApplication.Guarantor2MemberID;
                        updatedUnlinked = true;
                    }
                }
            }
            if (updatedUnlinked)
            {
                await _context.SaveChangesAsync();
            }

            var sharesCount = await _context.ShareAccounts.Where(s => s.MemberId == id).SumAsync(s => (int?)s.TotalShareCount) ?? 0;
            var sharesBalance = await _context.ShareAccounts.Where(s => s.MemberId == id).SumAsync(s => (decimal?)s.TotalShareAmount) ?? 0;
            var savingsBalance = await _context.SavingAccountMasters.Where(s => s.MemberID == id && s.Status == "Active").SumAsync(s => (decimal?)s.CurrentBalance) ?? 0;

            var ownActiveLoans = await _context.LoanAccounts
                .Include(l => l.Member)
                .Include(l => l.LoanRate)
                .Where(l => (l.MemberID == id || l.CoMemberID == id || l.CoMember2ID == id) && l.Status == "Active")
                .ToListAsync();

            var activeGuaranteedLoans = await _context.LoanAccounts
                .Include(l => l.Member)
                .Include(l => l.LoanRate)
                .Include(l => l.LoanApplication)
                .Where(l => l.Status == "Active" && (
                    l.Guarantor1MemberID == id ||
                    l.Guarantor2MemberID == id ||
                    (l.LoanApplication != null && (l.LoanApplication.Guarantor1MemberID == id || l.LoanApplication.Guarantor2MemberID == id))
                ))
                .ToListAsync();

            var disbursedLoanAppIds = await _context.LoanAccounts
                .Where(l => l.LoanApplicationID.HasValue)
                .Select(l => l.LoanApplicationID!.Value)
                .ToListAsync();

            var ownPendingApps = await _context.LoanApplications
                .Include(a => a.Member)
                .Include(a => a.LoanRate)
                .Where(a => (a.MemberID == id || a.CoMemberID == id || a.CoMember2ID == id) && !disbursedLoanAppIds.Contains(a.LoanApplicationID))
                .ToListAsync();

            var pendingGuaranteedApps = await _context.LoanApplications
                .Include(a => a.Member)
                .Include(a => a.LoanRate)
                .Where(a => (a.Guarantor1MemberID == id || a.Guarantor2MemberID == id) && !disbursedLoanAppIds.Contains(a.LoanApplicationID))
                .ToListAsync();

            var ownLoansList = ownActiveLoans.Select(l => new
            {
                loanAccountID = l.LoanAccountID,
                loanAccountNo = l.LoanAccountNo,
                borrowerName = $"{l.Member?.FirstName} {l.Member?.MiddleName} {l.Member?.LastName}".Trim(),
                borrowerCode = l.Member?.MemberCode,
                loanType = l.LoanRate?.ShortName ?? l.LoanRate?.LoanType ?? "",
                sanctionedAmount = l.SanctionedAmount,
                currentBalance = l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance,
                status = l.Status
            }).ToList();

            var ownAppsList = ownPendingApps.Select(a => new
            {
                loanApplicationID = a.LoanApplicationID,
                applicationNo = a.ApplicationNo,
                borrowerName = $"{a.Member?.FirstName} {a.Member?.MiddleName} {a.Member?.LastName}".Trim(),
                borrowerCode = a.Member?.MemberCode,
                loanType = a.LoanRate?.ShortName ?? a.LoanRate?.LoanType ?? "",
                requestedAmount = a.RequestedAmount,
                status = "Pending"
            }).ToList();

            var guaranteedLoansList = activeGuaranteedLoans.Select(l => new
            {
                loanAccountID = l.LoanAccountID,
                loanAccountNo = l.LoanAccountNo,
                borrowerName = $"{l.Member?.FirstName} {l.Member?.MiddleName} {l.Member?.LastName}".Trim(),
                borrowerCode = l.Member?.MemberCode,
                loanType = l.LoanRate?.ShortName ?? l.LoanRate?.LoanType ?? "",
                sanctionedAmount = l.SanctionedAmount,
                currentBalance = l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance,
                status = l.Status
            }).ToList();

            var guaranteedAppsList = pendingGuaranteedApps.Select(a => new
            {
                loanApplicationID = a.LoanApplicationID,
                applicationNo = a.ApplicationNo,
                borrowerName = $"{a.Member?.FirstName} {a.Member?.MiddleName} {a.Member?.LastName}".Trim(),
                borrowerCode = a.Member?.MemberCode,
                loanType = a.LoanRate?.ShortName ?? a.LoanRate?.LoanType ?? "",
                requestedAmount = a.RequestedAmount,
                status = "Pending"
            }).ToList();

            var summary = new
            {
                memberID = id,
                memberName = $"{member.FirstName} {member.MiddleName} {member.LastName}".Trim(),
                memberCode = member.MemberCode,
                cifNo = member.CIFNo ?? GenerateCifNo(member),
                mobileNo = string.IsNullOrWhiteSpace(member.MobileNo) || member.MobileNo == "0000000000" ? "-" : member.MobileNo,
                address = member.Address,
                village = member.Village,
                occupation = member.Occupation,
                sharesCount = sharesCount,
                sharesBalance = sharesBalance,
                savingsBalance = savingsBalance,

                ownActiveLoansCount = ownActiveLoans.Count,
                ownPendingAppsCount = ownPendingApps.Count,
                ownTotalBalance = ownActiveLoans.Sum(l => l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance),
                ownLoans = ownLoansList,
                ownApplications = ownAppsList,

                activeGuaranteedLoansCount = activeGuaranteedLoans.Count,
                pendingGuaranteedAppsCount = pendingGuaranteedApps.Count,
                totalGuaranteedAmount = activeGuaranteedLoans.Sum(l => l.SanctionedAmount) + pendingGuaranteedApps.Sum(a => a.RequestedAmount),
                totalCurrentBalance = activeGuaranteedLoans.Sum(l => l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance),
                guaranteedLoans = guaranteedLoansList,
                guaranteedApplications = guaranteedAppsList
            };

            return Ok(summary);
        }

        // GET: api/Members/5/director-recommendation-summary
        [HttpGet("{id}/director-recommendation-summary")]
        public async Task<IActionResult> GetDirectorRecommendationSummary(int id)
        {
            var director = await _context.Members.FindAsync(id);
            if (director == null)
            {
                return NotFound();
            }

            var unlinkedAccounts = await _context.LoanAccounts
                .Include(l => l.LoanApplication)
                .Where(l => l.LoanApplication != null && !l.RecommendedByDirectorID.HasValue && l.LoanApplication.RecommendedByDirectorID.HasValue)
                .ToListAsync();

            bool updatedUnlinked = false;
            foreach (var acc in unlinkedAccounts)
            {
                if (acc.LoanApplication != null && acc.LoanApplication.RecommendedByDirectorID.HasValue)
                {
                    acc.RecommendedByDirectorID = acc.LoanApplication.RecommendedByDirectorID;
                    updatedUnlinked = true;
                }
            }
            if (updatedUnlinked)
            {
                await _context.SaveChangesAsync();
            }

            var activeRecommendedLoans = await _context.LoanAccounts
                .Include(l => l.Member)
                .Include(l => l.LoanRate)
                .Include(l => l.LoanApplication)
                .Where(l => l.Status == "Active" && (
                    l.RecommendedByDirectorID == id ||
                    (l.LoanApplication != null && l.LoanApplication.RecommendedByDirectorID == id)
                ))
                .ToListAsync();

            var disbursedLoanAppIds = await _context.LoanAccounts
                .Where(l => l.LoanApplicationID.HasValue)
                .Select(l => l.LoanApplicationID!.Value)
                .ToListAsync();

            var pendingRecommendedApps = await _context.LoanApplications
                .Include(a => a.Member)
                .Include(a => a.LoanRate)
                .Where(a => a.RecommendedByDirectorID == id && !disbursedLoanAppIds.Contains(a.LoanApplicationID))
                .ToListAsync();

            var recommendedLoansList = activeRecommendedLoans.Select(l => new
            {
                loanAccountID = l.LoanAccountID,
                loanAccountNo = l.LoanAccountNo,
                borrowerName = $"{l.Member?.FirstName} {l.Member?.MiddleName} {l.Member?.LastName}".Trim(),
                borrowerCode = l.Member?.MemberCode,
                loanType = l.LoanRate?.ShortName ?? l.LoanRate?.LoanType ?? "",
                sanctionedAmount = l.SanctionedAmount,
                currentBalance = l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance,
                status = l.Status
            }).ToList();

            var recommendedAppsList = pendingRecommendedApps.Select(a => new
            {
                loanApplicationID = a.LoanApplicationID,
                applicationNo = a.ApplicationNo,
                borrowerName = $"{a.Member?.FirstName} {a.Member?.MiddleName} {a.Member?.LastName}".Trim(),
                borrowerCode = a.Member?.MemberCode,
                loanType = a.LoanRate?.ShortName ?? a.LoanRate?.LoanType ?? "",
                requestedAmount = a.RequestedAmount,
                status = "Pending"
            }).ToList();

            var summary = new
            {
                memberID = id,
                directorName = $"{director.FirstName} {director.MiddleName} {director.LastName}".Trim(),
                directorCode = director.MemberCode,
                cifNo = director.CIFNo ?? GenerateCifNo(director),
                mobileNo = string.IsNullOrWhiteSpace(director.MobileNo) || director.MobileNo == "0000000000" ? "-" : director.MobileNo,
                activeRecommendedLoansCount = activeRecommendedLoans.Count,
                pendingRecommendedAppsCount = pendingRecommendedApps.Count,
                totalRecommendedSanctionedAmount = activeRecommendedLoans.Sum(l => l.SanctionedAmount) + pendingRecommendedApps.Sum(a => a.RequestedAmount),
                totalRecommendedCurrentBalance = activeRecommendedLoans.Sum(l => l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance),
                recommendedLoans = recommendedLoansList,
                recommendedApplications = recommendedAppsList
            };

            return Ok(summary);
        }
    }
}
