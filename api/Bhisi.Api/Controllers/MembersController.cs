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
using Bhisi.Api.Helpers;

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
        public async Task<ActionResult<IEnumerable<MemberResponseDto>>> GetMembers(
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
                var query = _context.Members.AsNoTracking().Include(m => m.Customer).Include(m => m.Branch).OrderBy(m => m.MemberID).AsQueryable();

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
                var result = members
                    .OrderBy(m => {
                        if (!string.IsNullOrWhiteSpace(m.MemberCode))
                        {
                            var digits = new string(m.MemberCode.Where(char.IsDigit).ToArray());
                            if (int.TryParse(digits, out int num) && num > 0) return num;
                        }
                        return m.MemberID;
                    })
                    .ThenBy(m => m.MemberID)
                    .Select(MemberResponseDto.FromMember)
                    .ToList();
                return Ok(result);
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
            if (member.Customer != null && !string.IsNullOrWhiteSpace(member.Customer.CIFNo))
            {
                return member.Customer.CIFNo;
            }

            if (!string.IsNullOrWhiteSpace(member.LegacyMemberNo) && int.TryParse(member.LegacyMemberNo.Trim(), out int legacyNum))
            {
                return "CIF" + legacyNum.ToString("D6");
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
            var members = await _context.Members.Include(m => m.Customer).ToListAsync();
            int updatedCount = 0;
            foreach (var member in members)
            {
                if (member.Customer != null)
                {
                    var correctCif = GenerateCifNo(member);
                    if (member.Customer.CIFNo != correctCif)
                    {
                        member.Customer.CIFNo = correctCif;
                        updatedCount++;
                    }
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
        [HttpGet("{id:int}")]
        public async Task<ActionResult<MemberResponseDto>> GetMember(int id)
        {
            var (_, _, userBranchId, _, isHeadOfficeAdmin) = GetCurrentUserContext();
            var member = await _context.Members.Include(m => m.Customer).Include(m => m.Branch).FirstOrDefaultAsync(m => m.MemberID == id);

            if (member == null)
            {
                return NotFound();
            }

            if (!isHeadOfficeAdmin && member.BranchID != userBranchId)
            {
                return StatusCode(403, new { message = "आपल्याला इतर शाखेतील सभासदांची माहिती पाहण्याची परवानगी नाही (Access Denied: Cross-Branch Isolation Barrier Violation)." });
            }

            return Ok(MemberResponseDto.FromMember(member));
        }

        // GET: api/Members/next-code
        [AllowAnonymous]
        [HttpGet("next-code")]
        public async Task<ActionResult<string>> GetNextMemberCode()
        {
            try
            {
                var allMemberCodes = await _context.Members
                    .AsNoTracking()
                    .Where(m => !string.IsNullOrEmpty(m.MemberCode))
                    .Select(m => m.MemberCode)
                    .ToListAsync();

                int maxNum = 0;
                foreach (var code in allMemberCodes)
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
                    maxNum = await _context.Members.CountAsync();
                }

                int nextNum = maxNum + 1;
                string candidate = $"MEM{nextNum:D4}";

                while (allMemberCodes.Any(c => string.Equals(c, candidate, StringComparison.OrdinalIgnoreCase)))
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

                var allCifsInDb = await _context.Customers
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .Where(c => c.CIFNo != null && c.CIFNo != "")
                    .Select(c => c.CIFNo!)
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

        // GET: api/Members/pending-allotment
        [AllowAnonymous]
        [HttpGet("pending-allotment")]
        public async Task<IActionResult> GetPendingAllotmentMembers([FromQuery] int? branchId = null)
        {
            try
            {
                var query = _context.Members
                    .AsNoTracking()
                    .Include(m => m.Customer)
                    .Include(m => m.Branch)
                    .Where(m => !m.IsDeleted &&
                                !_context.ShareAccounts.Any(s => s.MemberId == m.MemberID && s.TotalShareCount > 0));

                if (branchId.HasValue && branchId.Value > 0)
                {
                    query = query.Where(m => m.BranchID == branchId.Value);
                }

                var list = await query
                    .OrderByDescending(m => m.MemberID)
                    .Select(m => new
                    {
                        m.MemberID,
                        m.MemberCode,
                        m.CustomerID,
                        CIFNo = m.Customer != null ? m.Customer.CIFNo : "",
                        FullName = m.Customer != null
                            ? $"{m.Customer.FirstName} {m.Customer.MiddleName} {m.Customer.LastName}".Replace("  ", " ").Trim()
                            : "",
                        FirstName = m.Customer != null ? m.Customer.FirstName : "",
                        MiddleName = m.Customer != null ? m.Customer.MiddleName : "",
                        LastName = m.Customer != null ? m.Customer.LastName : "",
                        MobileNo = m.Customer != null ? m.Customer.MobileNo : "",
                        Village = m.Customer != null ? m.Customer.Village : "",
                        m.JoiningDate,
                        m.MembershipType,
                        m.LegacyMemberNo,
                        BranchName = m.Branch != null ? m.Branch.BranchName : ""
                    })
                    .ToListAsync();

                return Ok(list);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "प्रलंबित अर्ज आणताना एरर आली.", error = ex.Message });
            }
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

        private List<string> ValidateCustomerLengths(MemberRequestDto member)
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
        public async Task<IActionResult> PutMember(int id, [FromBody] MemberRequestDto req)
        {
            if (req.MemberID > 0 && id != req.MemberID)
            {
                return BadRequest(new { message = "Member ID mismatch." });
            }
            req.MemberID = id;

            var (userId, username, userBranchId, _, isHeadOfficeAdmin) = GetCurrentUserContext();

            var existingMember = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == id);
            if (existingMember == null)
            {
                return NotFound();
            }

            if (existingMember.Customer == null)
            {
                if (existingMember.CustomerID.HasValue && existingMember.CustomerID.Value > 0)
                {
                    existingMember.Customer = await _context.Customers.FirstOrDefaultAsync(c => c.CustomerID == existingMember.CustomerID.Value);
                }
                if (existingMember.Customer == null)
                {
                    return BadRequest(new { message = "या सभासदासाठी लिंक केलेला खातेदार (Customer) सिस्टीममध्ये आढळला नाही. कृपया प्रथम ग्राहक नोंदणी करा." });
                }
            }

            var customer = existingMember.Customer;

            if (!isHeadOfficeAdmin)
            {
                if (existingMember.BranchID != userBranchId || req.BranchID != userBranchId)
                {
                    return StatusCode(403, new { message = "आपण केवळ आपल्या शाखेतील सभासदांची माहिती अद्ययावत करू शकता (Cross-Branch Edit Denied)." });
                }
                req.BranchID = userBranchId;
            }

            // Fill any missing KYC fields from existing customer
            if (string.IsNullOrWhiteSpace(req.FirstName)) req.FirstName = customer.FirstName;
            if (string.IsNullOrWhiteSpace(req.LastName)) req.LastName = customer.LastName;
            if (string.IsNullOrWhiteSpace(req.MobileNo)) req.MobileNo = customer.MobileNo;
            if (string.IsNullOrWhiteSpace(req.AadhaarNo)) req.AadhaarNo = customer.AadhaarNo;
            if (string.IsNullOrWhiteSpace(req.PANNo)) req.PANNo = customer.PANNo;
            if (string.IsNullOrWhiteSpace(req.CIFNo)) req.CIFNo = customer.CIFNo;

            // Validate required fields before saving
            var validationErrors = new List<string>();
            if (string.IsNullOrWhiteSpace(req.FirstName))
                validationErrors.Add("पहिले नाव (FirstName) आवश्यक आहे.");
            if (string.IsNullOrWhiteSpace(req.LastName))
                validationErrors.Add("आडनाव (LastName) आवश्यक आहे.");

            // Sanitize optional fields to null if empty
            req.MobileNo = string.IsNullOrWhiteSpace(req.MobileNo) ? null : req.MobileNo.Trim();
            req.AadhaarNo = string.IsNullOrWhiteSpace(req.AadhaarNo) ? null : req.AadhaarNo.Trim();
            req.PANNo = string.IsNullOrWhiteSpace(req.PANNo) ? null : req.PANNo.Trim().ToUpper();
            req.MemberCode = string.IsNullOrWhiteSpace(req.MemberCode) ? null : req.MemberCode.Trim();

            if (validationErrors.Count > 0)
                return BadRequest(new { message = "आवश्यक माहिती भरा (Required fields missing)", errors = validationErrors });

            var lengthErrors = ValidateCustomerLengths(req);
            if (lengthErrors.Count > 0)
                return BadRequest(new { message = "माहितीची लांबी डेटाबेसच्या मर्यादेपेक्षा जास्त आहे (Field length limit exceeded)", errors = lengthErrors });

            // Duplicate checks for other members
            req.LegacyMemberNo = string.IsNullOrWhiteSpace(req.LegacyMemberNo) ? null : req.LegacyMemberNo.Trim();

            if (!string.IsNullOrWhiteSpace(req.MemberCode))
            {
                bool codeExists = await _context.Members
                    .AnyAsync(m => m.MemberID != id && !m.IsDeleted && m.MemberCode == req.MemberCode);
                if (codeExists)
                {
                    return BadRequest(new { message = $"हा सभासद क्रमांक ({req.MemberCode}) आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
            }

            if (!string.IsNullOrWhiteSpace(req.LegacyMemberNo))
            {
                var existingLegacyMember = await _context.Members
                    .AsNoTracking()
                    .Include(m => m.Customer)
                    .FirstOrDefaultAsync(m => m.MemberID != id && !m.IsDeleted && m.LegacyMemberNo == req.LegacyMemberNo);
                if (existingLegacyMember != null)
                {
                    string legacyName = existingLegacyMember.Customer != null ? $"{existingLegacyMember.Customer.FirstName} {existingLegacyMember.Customer.LastName}".Trim() : "Member";
                    return BadRequest(new { message = $"हा जुना सभासद आयडी ({req.LegacyMemberNo}) आधीच सभासद '{legacyName}' (कोड: {existingLegacyMember.MemberCode ?? existingLegacyMember.MemberID.ToString()}) साठी नोंदवला आहे." });
                }
            }

            // Exclude current customer from duplicate checks
            int curCustId = customer.CustomerID;

            if (!string.IsNullOrWhiteSpace(req.AadhaarNo))
            {
                bool aadhaarExists = await _context.Customers.AnyAsync(c => c.CustomerID != curCustId && c.AadhaarNo == req.AadhaarNo);
                if (aadhaarExists)
                {
                    return BadRequest(new { message = $"हा आधार नंबर ({req.AadhaarNo}) आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
            }

            if (!string.IsNullOrWhiteSpace(req.PANNo))
            {
                bool panExists = await _context.Customers.AnyAsync(c => c.CustomerID != curCustId && c.PANNo == req.PANNo);
                if (panExists)
                {
                    return BadRequest(new { message = $"हा पॅन नंबर ({req.PANNo}) आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
            }

            if (!string.IsNullOrWhiteSpace(req.MobileNo))
            {
                bool mobileExists = await _context.Customers.AnyAsync(c => c.CustomerID != curCustId && c.MobileNo == req.MobileNo);
                if (mobileExists)
                {
                    return BadRequest(new { message = $"हा मोबाईल नंबर ({req.MobileNo}) आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
            }

            // Minor Age Validation
            if (req.BirthDate.HasValue)
            {
                var today = DateTime.Today;
                int age = today.Year - req.BirthDate.Value.Year;
                if (req.BirthDate.Value.Date > today.AddYears(-age)) age--;

                if (age < 18)
                {
                    req.IsMinor = true;
                    if (string.IsNullOrWhiteSpace(req.GuardianName))
                    {
                        return BadRequest(new { message = "सभासदाचे वय १८ वर्षांपेक्षा कमी (अज्ञान) असल्याने पालकाचे नाव (Guardian Name) आवश्यक आहे." });
                    }
                    if (string.IsNullOrWhiteSpace(req.GuardianRelation))
                    {
                        return BadRequest(new { message = "अज्ञान सभासदासाठी पालकाचे नाते (Guardian Relation) निवडणे आवश्यक आहे." });
                    }
                }
                else
                {
                    req.IsMinor = false;
                }
            }

            // Update linked Customer entity
            customer.FirstName = req.FirstName ?? customer.FirstName;
            customer.MiddleName = req.MiddleName ?? customer.MiddleName;
            customer.LastName = req.LastName ?? customer.LastName;
            customer.NickName = req.NickName ?? customer.NickName;
            customer.FirstNameEng = req.FirstNameEng ?? customer.FirstNameEng;
            customer.MiddleNameEng = req.MiddleNameEng ?? customer.MiddleNameEng;
            customer.LastNameEng = req.LastNameEng ?? customer.LastNameEng;
            customer.Address = req.Address ?? customer.Address;
            customer.AddressEng = req.AddressEng ?? customer.AddressEng;
            customer.Village = req.Village ?? customer.Village;
            customer.Taluka = req.Taluka ?? customer.Taluka;
            customer.District = req.District ?? customer.District;
            customer.MobileNo = req.MobileNo;
            customer.AadhaarNo = req.AadhaarNo;
            customer.PANNo = req.PANNo;
            customer.NomineeName = req.NomineeName ?? customer.NomineeName;
            customer.NomineeNameEng = req.NomineeNameEng ?? customer.NomineeNameEng;
            customer.NomineeRelation = req.NomineeRelation ?? customer.NomineeRelation;
            customer.NomineeAddress = req.NomineeAddress ?? customer.NomineeAddress;
            customer.NomineeBirthDate = req.NomineeBirthDate ?? customer.NomineeBirthDate;
            customer.NomineeIsMinor = req.NomineeIsMinor;
            customer.NomineeGuardianName = req.NomineeGuardianName ?? customer.NomineeGuardianName;
            customer.PhotoPath = req.PhotoPath ?? customer.PhotoPath;
            customer.SignaturePath = req.SignaturePath ?? customer.SignaturePath;
            customer.AadhaarDocPath = req.AadhaarDocPath ?? customer.AadhaarDocPath;
            customer.PanDocPath = req.PanDocPath ?? customer.PanDocPath;
            customer.Gender = req.Gender ?? customer.Gender;
            customer.BirthDate = req.BirthDate ?? customer.BirthDate;
            customer.Occupation = req.Occupation ?? customer.Occupation;
            customer.CasteCategory = req.CasteCategory ?? customer.CasteCategory;
            customer.Caste = req.Caste ?? customer.Caste;
            customer.Email = req.Email ?? customer.Email;
            customer.IsMinor = req.IsMinor;
            customer.GuardianName = req.GuardianName ?? customer.GuardianName;
            customer.GuardianNameEng = req.GuardianNameEng ?? customer.GuardianNameEng;
            customer.GuardianRelation = req.GuardianRelation ?? customer.GuardianRelation;
            customer.GuardianAadhaarNo = req.GuardianAadhaarNo ?? customer.GuardianAadhaarNo;
            customer.GuardianMobileNo = req.GuardianMobileNo ?? customer.GuardianMobileNo;
            customer.GuardianAddress = req.GuardianAddress ?? customer.GuardianAddress;
            customer.EmployerId = req.EmployerId ?? customer.EmployerId;
            customer.UpdatedBy = userId;
            customer.UpdatedOn = DateTime.Now;

            if (!string.IsNullOrWhiteSpace(req.CIFNo) && req.CIFNo != customer.CIFNo)
            {
                bool cifExists = await _context.Customers.IgnoreQueryFilters().AnyAsync(c => c.CustomerID != curCustId && c.CIFNo == req.CIFNo);
                if (cifExists)
                {
                    return BadRequest(new { message = $"हा CIF क्रमांक ({req.CIFNo}) आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
                customer.CIFNo = req.CIFNo.Trim();
            }

            // Update Member database entity
            existingMember.BranchID = req.BranchID;
            existingMember.LegacyMemberNo = req.LegacyMemberNo;
            existingMember.JoiningDate = req.JoiningDate;
            existingMember.Status = req.Status;
            existingMember.MembershipType = string.IsNullOrWhiteSpace(req.MembershipType) ? "Regular" : req.MembershipType.Trim();
            existingMember.UpdatedBy = userId;
            existingMember.UpdatedOn = DateTime.Now;

            try
            {
                await _context.SaveChangesAsync();
                await LogAuditAsync("MEMBER_UPDATE", id.ToString(), $"सभासद माहिती अद्ययावत केली: {customer.FirstName} {customer.LastName}, CIF: {customer.CIFNo}");
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
                if (detailedError.Contains("IX_Customers_AadhaarNo") || detailedError.Contains("AadhaarNo"))
                {
                    return BadRequest(new { message = "हा आधार नंबर आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
                if (detailedError.Contains("IX_Customers_PANNo") || detailedError.Contains("PANNo"))
                {
                    return BadRequest(new { message = "हा पॅन नंबर आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
                if (detailedError.Contains("IX_Customers_CIFNo") || detailedError.Contains("CIFNo"))
                {
                    return BadRequest(new { message = "हा CIF क्रमांक आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
                if (detailedError.Contains("truncated") || detailedError.Contains("String or binary data"))
                {
                    return BadRequest(new { message = "माहितीची लांबी डेटाबेसच्या मर्यादेपेक्षा जास्त आहे (Data truncation error).", error = "कृपया प्रविष्ट केलेल्या मजकुराची लांबी तपासा." });
                }
                return BadRequest(new { message = "खातेदार अपडेट करताना त्रुटी आली: " + detailedError });
            }

            return Ok(MemberResponseDto.FromMember(existingMember));
        }

        // POST: api/Members
        [HttpPost]
        public async Task<ActionResult<MemberResponseDto>> PostMember([FromBody] MemberRequestDto req)
        {
            var (userId, username, userBranchId, _, isHeadOfficeAdmin) = GetCurrentUserContext();

            if (!isHeadOfficeAdmin)
            {
                req.BranchID = userBranchId;
            }

            req.BranchID = req.BranchID > 0 ? req.BranchID : (userBranchId > 0 ? userBranchId : 1);

            Customer? customer = null;
            if (req.CustomerID.HasValue && req.CustomerID.Value > 0)
            {
                customer = await _context.Customers.FirstOrDefaultAsync(c => c.CustomerID == req.CustomerID.Value);
                if (customer == null)
                {
                    return BadRequest(new { message = $"दिलेला खातेदार आयडी ({req.CustomerID}) आढळला नाही." });
                }

                var existingMemberForCust = await _context.Members
                    .AsNoTracking()
                    .FirstOrDefaultAsync(m => !m.IsDeleted && m.CustomerID == customer.CustomerID);
                if (existingMemberForCust != null)
                {
                    return BadRequest(new { message = $"हा खातेदार ({customer.FirstName} {customer.LastName}) आधीच सभासद कोड '{existingMemberForCust.MemberCode ?? existingMemberForCust.MemberID.ToString()}' ला जोडलेला आहे." });
                }

                // Auto-fill KYC fields from customer if omitted in member payload
                if (string.IsNullOrWhiteSpace(req.FirstName)) req.FirstName = customer.FirstName;
                if (string.IsNullOrWhiteSpace(req.LastName)) req.LastName = customer.LastName;
                if (string.IsNullOrWhiteSpace(req.MiddleName)) req.MiddleName = customer.MiddleName;
                if (string.IsNullOrWhiteSpace(req.MobileNo)) req.MobileNo = customer.MobileNo;
                if (string.IsNullOrWhiteSpace(req.AadhaarNo)) req.AadhaarNo = customer.AadhaarNo;
                if (string.IsNullOrWhiteSpace(req.PANNo)) req.PANNo = customer.PANNo;
                if (string.IsNullOrWhiteSpace(req.CIFNo)) req.CIFNo = customer.CIFNo;
                if (string.IsNullOrWhiteSpace(req.Address)) req.Address = customer.Address;
                if (string.IsNullOrWhiteSpace(req.Village)) req.Village = customer.Village;
            }

            // Validate required fields before saving
            var validationErrors = new List<string>();
            if (string.IsNullOrWhiteSpace(req.FirstName))
                validationErrors.Add("पहिले नाव (FirstName) आवश्यक आहे.");
            if (string.IsNullOrWhiteSpace(req.LastName))
                validationErrors.Add("आडनाव (LastName) आवश्यक आहे.");

            // Sanitize optional fields to null if empty
            req.MobileNo = string.IsNullOrWhiteSpace(req.MobileNo) ? null : req.MobileNo.Trim();
            req.AadhaarNo = string.IsNullOrWhiteSpace(req.AadhaarNo) ? null : req.AadhaarNo.Trim();
            req.PANNo = string.IsNullOrWhiteSpace(req.PANNo) ? null : req.PANNo.Trim().ToUpper();
            req.MemberCode = string.IsNullOrWhiteSpace(req.MemberCode) ? null : req.MemberCode.Trim();

            if (validationErrors.Count > 0)
                return BadRequest(new { message = "आवश्यक माहिती भरा (Required fields missing)", errors = validationErrors });

            var lengthErrors = ValidateCustomerLengths(req);
            if (lengthErrors.Count > 0)
                return BadRequest(new { message = "माहितीची लांबी डेटाबेसच्या मर्यादेपेक्षा जास्त आहे (Field length limit exceeded)", errors = lengthErrors });

            // Duplicate checks for Member
            req.LegacyMemberNo = string.IsNullOrWhiteSpace(req.LegacyMemberNo) ? null : req.LegacyMemberNo.Trim();

            if (!string.IsNullOrWhiteSpace(req.MemberCode))
            {
                bool codeExists = await _context.Members
                    .AnyAsync(m => !m.IsDeleted && m.MemberCode == req.MemberCode);
                if (codeExists)
                {
                    return BadRequest(new { message = $"हा सभासद क्रमांक ({req.MemberCode}) आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
            }

            if (!string.IsNullOrWhiteSpace(req.LegacyMemberNo))
            {
                var existingLegacyMember = await _context.Members
                    .AsNoTracking()
                    .Include(m => m.Customer)
                    .FirstOrDefaultAsync(m => !m.IsDeleted && m.LegacyMemberNo == req.LegacyMemberNo);
                if (existingLegacyMember != null)
                {
                    string legacyName = existingLegacyMember.Customer != null ? $"{existingLegacyMember.Customer.FirstName} {existingLegacyMember.Customer.LastName}".Trim() : "Member";
                    return BadRequest(new { message = $"हा जुना सभासद आयडी ({req.LegacyMemberNo}) आधीच सभासद '{legacyName}' (कोड: {existingLegacyMember.MemberCode ?? existingLegacyMember.MemberID.ToString()}) साठी नोंदवला आहे." });
                }
            }

            int currentCustId = customer?.CustomerID ?? 0;

            if (!string.IsNullOrWhiteSpace(req.AadhaarNo))
            {
                bool aadhaarExists = await _context.Customers.AnyAsync(c => c.CustomerID != currentCustId && c.AadhaarNo == req.AadhaarNo);
                if (aadhaarExists)
                {
                    return BadRequest(new { message = $"हा आधार नंबर ({req.AadhaarNo}) आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
            }

            if (!string.IsNullOrWhiteSpace(req.PANNo))
            {
                bool panExists = await _context.Customers.AnyAsync(c => c.CustomerID != currentCustId && c.PANNo == req.PANNo);
                if (panExists)
                {
                    return BadRequest(new { message = $"हा पॅन नंबर ({req.PANNo}) आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
            }

            if (!string.IsNullOrWhiteSpace(req.MobileNo))
            {
                bool mobileExists = await _context.Customers.AnyAsync(c => c.CustomerID != currentCustId && c.MobileNo == req.MobileNo);
                if (mobileExists)
                {
                    return BadRequest(new { message = $"हा मोबाईल नंबर ({req.MobileNo}) आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
            }

            // Minor Age Validation
            if (req.BirthDate.HasValue)
            {
                var today = DateTime.Today;
                int age = today.Year - req.BirthDate.Value.Year;
                if (req.BirthDate.Value.Date > today.AddYears(-age)) age--;

                if (age < 18)
                {
                    req.IsMinor = true;
                    if (string.IsNullOrWhiteSpace(req.GuardianName))
                    {
                        return BadRequest(new { message = "सभासदाचे वय १८ वर्षांपेक्षा कमी (अज्ञान) असल्याने पालकाचे नाव (Guardian Name) आवश्यक आहे." });
                    }
                    if (string.IsNullOrWhiteSpace(req.GuardianRelation))
                    {
                        return BadRequest(new { message = "अज्ञान सभासदासाठी पालकाचे नाते (Guardian Relation) निवडणे आवश्यक आहे." });
                    }
                }
                else
                {
                    req.IsMinor = false;
                }
            }

            if (customer == null)
            {
                return BadRequest(new { message = "सभासद नोंदणीसाठी प्रथम खातेदार निवडणे बंधनकारक आहे. नवीन खातेदार फक्त 'ग्राहक / खातेदार नोंदणी मास्टर' फॉर्ममधूनच नोंदवता येतो." });
            }

            var member = new Member
            {
                CustomerID = customer.CustomerID,
                BranchID = req.BranchID,
                MemberCode = string.IsNullOrWhiteSpace(req.MemberCode) ? null : req.MemberCode.Trim(),
                JoiningDate = req.JoiningDate == default ? DateTime.Today : req.JoiningDate,
                Status = string.IsNullOrWhiteSpace(req.Status) ? "Active" : req.Status.Trim(),
                MembershipType = string.IsNullOrWhiteSpace(req.MembershipType) 
                    ? (string.IsNullOrWhiteSpace(req.MemberCode) ? "Nominal" : "Regular") 
                    : req.MembershipType.Trim(),
                LegacyMemberNo = req.LegacyMemberNo,
                CreatedBy = userId,
                CreatedOn = DateTime.Now,
                IsDeleted = false
            };

            using var dbTransaction = await _context.Database.BeginTransactionAsync();
            try
            {
                _context.Members.Add(member);
                await _context.SaveChangesAsync();

                // --- Integrated Share Allotment + Fee Posting ---
                int numShares = req.NumberOfShares.HasValue && req.NumberOfShares.Value > 0 ? req.NumberOfShares.Value : 0;
                decimal faceVal = req.ShareFaceValue.HasValue && req.ShareFaceValue.Value > 0 ? req.ShareFaceValue.Value : 100M;
                decimal shareCapitalAmount = numShares * faceVal;
                decimal admissionFee = req.AdmissionFee.HasValue && req.AdmissionFee.Value > 0 ? req.AdmissionFee.Value : 0;
                decimal buildingFund = req.BuildingFund.HasValue && req.BuildingFund.Value > 0 ? req.BuildingFund.Value : 0;
                decimal totalAmount = shareCapitalAmount + admissionFee + buildingFund;

                DateTime allotDate = req.AllotmentDate?.Date ?? member.JoiningDate.Date;
                if (allotDate == default) allotDate = DateTime.Today;

                ShareAccount? shareAccount = null;
                ShareCertificate? shareCert = null;
                ShareTransaction? shareTxn = null;

                if (numShares > 0)
                {
                    // 1. Create ShareAccount
                    int nextSeq = await _context.ShareAccounts.CountAsync() + 1;
                    shareAccount = new ShareAccount
                    {
                        MemberId = member.MemberID,
                        CustomerID = member.CustomerID ?? customer.CustomerID,
                        AccountNo = $"SH-{nextSeq:D4}",
                        TotalShareCount = numShares,
                        TotalShareAmount = shareCapitalAmount,
                        Status = "Active"
                    };
                    _context.ShareAccounts.Add(shareAccount);
                    await _context.SaveChangesAsync();

                    // 2. Create ShareCertificate
                    int maxShareNo = await _context.ShareCertificates.MaxAsync(c => (int?)c.ToShareNo) ?? 0;
                    long startShareNo = maxShareNo + 1;
                    long endShareNo = startShareNo + numShares - 1;
                    int certCount = await _context.ShareCertificates.CountAsync() + 1;
                    string certNo = $"CERT-{DateTime.Today.Year}-{certCount:D5}";

                    shareCert = new ShareCertificate
                    {
                        ShareAccountId = shareAccount.ShareAccountId,
                        CustomerID = member.CustomerID ?? customer.CustomerID,
                        CertificateNo = certNo,
                        FromShareNo = startShareNo,
                        ToShareNo = endShareNo,
                        NumberOfShares = numShares,
                        FaceValue = faceVal,
                        Status = "Active",
                        IssueDate = allotDate,
                        CreatedDate = DateTime.Now
                    };
                    _context.ShareCertificates.Add(shareCert);
                    await _context.SaveChangesAsync();

                    // 3. Create ShareTransaction
                    shareTxn = new ShareTransaction
                    {
                        ShareAccountId = shareAccount.ShareAccountId,
                        TransactionDate = allotDate,
                        TransactionType = "Allotment",
                        NumberOfShares = numShares,
                        Amount = shareCapitalAmount,
                        Narration = $"भाग भांडवल वाटप : {numShares} शेअर्स. {member.MemberCode}",
                        CustomerID = member.CustomerID ?? customer.CustomerID
                    };
                    _context.ShareTransactions.Add(shareTxn);
                    await _context.SaveChangesAsync();
                }

                string? generatedVoucherNo = null;

                if (totalAmount > 0)
                {
                    int debitLedgerId;
                    string pMode = string.IsNullOrWhiteSpace(req.PaymentMode) ? "Cash" : req.PaymentMode.Trim();

                    if (pMode.Equals("Transfer", StringComparison.OrdinalIgnoreCase))
                    {
                        if (!req.SavingAccountId.HasValue || req.SavingAccountId.Value <= 0)
                        {
                            await dbTransaction.RollbackAsync();
                            return BadRequest(new { message = "बचत खात्यातून वर्ग करण्यासाठी बचत खाते निवडणे आवश्यक आहे." });
                        }

                        var savingAcc = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.SavingAccountID == req.SavingAccountId.Value);
                        if (savingAcc == null || savingAcc.CustomerID != customer.CustomerID)
                        {
                            await dbTransaction.RollbackAsync();
                            return BadRequest(new { message = "निवडलेले बचत खाते अमान्य आहे किंवा या खातेदाराचे नाही." });
                        }

                        if (savingAcc.Status == "Closed" || savingAcc.Status == "Frozen")
                        {
                            await dbTransaction.RollbackAsync();
                            return BadRequest(new { message = $"बचत खाते {savingAcc.Status} असल्याने यातून हस्तांतरण करता येणार नाही." });
                        }

                        decimal availBal = savingAcc.CurrentBalance - savingAcc.LienAmount - savingAcc.MinimumBalance;
                        if (availBal < totalAmount)
                        {
                            await dbTransaction.RollbackAsync();
                            return BadRequest(new { message = $"बचत खात्यामध्ये अपुरी शिल्लक आहे. (उपलब्ध: ₹{availBal:N2}, आवश्यक: ₹{totalAmount:N2})" });
                        }

                        // Deduct from saving account
                        savingAcc.CurrentBalance -= totalAmount;
                        _context.Entry(savingAcc).State = EntityState.Modified;

                        // Add SavingTransaction
                        string savingNarr = numShares > 0
                            ? $"सभासद नोंदणी व भाग वाटप ({numShares} शेअर्स) - {member.MemberCode ?? ("M-" + member.MemberID)}"
                            : $"सभासद प्रवेश शुल्क (Admission Fee) - {member.MemberCode ?? ("M-" + member.MemberID)}";

                        var savingTxn = new SavingTransaction
                        {
                            SavingAccountID = savingAcc.SavingAccountID,
                            CustomerID = savingAcc.CustomerID,
                            TransactionDate = allotDate,
                            TransactionType = "Withdrawal",
                            PaymentMode = "Transfer",
                            Amount = totalAmount,
                            BalanceAfterTxn = savingAcc.CurrentBalance,
                            Narration = savingNarr,
                            CreatedBy = userId,
                            CreatedOn = DateTime.Now
                        };
                        _context.SavingTransactions.Add(savingTxn);

                        debitLedgerId = savingAcc.LedgerID;
                    }
                    else
                    {
                        // Cash
                        debitLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, member.BranchID, "SHARE");
                    }

                    int custId = customer.CustomerID;
                    var voucherDetailsList = new List<VoucherDetail>
                    {
                        new VoucherDetail
                        {
                            LedgerID = debitLedgerId,
                            DrCr = "Dr",
                            Amount = totalAmount,
                            MemberID = member.MemberID,
                            CustomerID = custId
                        }
                    };

                    if (shareCapitalAmount > 0)
                    {
                        var shareCapitalLedger = await Helpers.ShareLedgerHelper.GetShareCapitalLedgerAsync(_context);
                        voucherDetailsList.Add(new VoucherDetail
                        {
                            LedgerID = shareCapitalLedger.LedgerID,
                            DrCr = "Cr",
                            Amount = shareCapitalAmount,
                            MemberID = member.MemberID,
                            CustomerID = custId
                        });
                    }

                    if (admissionFee > 0)
                    {
                        var entranceFeeLedger = await Helpers.ShareLedgerHelper.GetEntranceFeeLedgerAsync(_context);
                        voucherDetailsList.Add(new VoucherDetail
                        {
                            LedgerID = entranceFeeLedger.LedgerID,
                            DrCr = "Cr",
                            Amount = admissionFee,
                            MemberID = member.MemberID,
                            CustomerID = custId
                        });
                    }

                    if (buildingFund > 0)
                    {
                        var buildingFundLedger = await Helpers.ShareLedgerHelper.GetBuildingFundLedgerAsync(_context);
                        voucherDetailsList.Add(new VoucherDetail
                        {
                            LedgerID = buildingFundLedger.LedgerID,
                            DrCr = "Cr",
                            Amount = buildingFund,
                            MemberID = member.MemberID,
                            CustomerID = custId
                        });
                    }

                    int vchCount = await _context.Vouchers.CountAsync() + 1;
                    int maxScroll = await _context.Vouchers
                        .Where(v => v.BranchID == member.BranchID && v.VoucherDate.Date == allotDate.Date && v.ScrollNo != null)
                        .Select(v => (int?)v.ScrollNo)
                        .MaxAsync() ?? 0;

                    string vchPrefix = numShares > 0 ? "VCH-SHR" : "VCH-ADM";
                    string vchNarration = numShares > 0
                        ? $"सभासद नोंदणी व भाग वाटप ({numShares} शेअर्स) - {customer.FirstName} {customer.LastName} ({member.MemberCode ?? ("M-" + member.MemberID)}). {pMode}"
                        : $"सभासद प्रवेश शुल्क पावती (Admission Fee) - {customer.FirstName} {customer.LastName} ({member.MemberCode ?? ("M-" + member.MemberID)}). {pMode}";

                    var voucher = new Voucher
                    {
                        BranchID = member.BranchID,
                        VoucherNo = $"{vchPrefix}-{allotDate:yyyyMMdd}-{vchCount:D4}",
                        VoucherDate = allotDate,
                        ScrollNo = maxScroll + 1,
                        VoucherType = pMode.Equals("Transfer", StringComparison.OrdinalIgnoreCase) ? "Journal" : "Receipt",
                        TotalAmount = totalAmount,
                        Narration = vchNarration,
                        Status = "Approved",
                        CreatedBy = userId,
                        VoucherDetails = voucherDetailsList
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    if (shareTxn != null)
                    {
                        shareTxn.VoucherId = voucher.VoucherID;
                    }

                    generatedVoucherNo = voucher.VoucherNo;
                }

                await dbTransaction.CommitAsync();

                member.Customer = customer;
                await LogAuditAsync("MEMBER_CREATE", member.MemberID.ToString(), $"नवीन सभासद नोंदणी: {customer.FirstName} {customer.LastName}, CIF: {customer.CIFNo}" + (!string.IsNullOrEmpty(generatedVoucherNo) ? $", पावती व्हाऊचर: {generatedVoucherNo}" : ""));
            }
            catch (DbUpdateException ex)
            {
                await dbTransaction.RollbackAsync();
                string detailedError = ex.InnerException?.Message ?? ex.Message;
                if (detailedError.Contains("IX_Members_MemberCode"))
                {
                    return BadRequest(new { message = "हा सभासद नंबर (MemberCode) आधीच दुसऱ्या सभासदाकडे नोंदवला आहे." });
                }
                if (detailedError.Contains("truncated") || detailedError.Contains("String or binary data"))
                {
                    return BadRequest(new { message = "माहितीची लांबी डेटाबेसच्या मर्यादेपेक्षा जास्त आहे (Data truncation error).", error = detailedError });
                }
                return BadRequest(new { message = "सभासद सेव्ह करताना त्रुटी आली: " + detailedError });
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                return StatusCode(500, new { message = "सभासद नोंदणी करताना अनपेक्षित त्रुटी आली: " + (ex.InnerException?.Message ?? ex.Message) });
            }

            return CreatedAtAction("GetMember", new { id = member.MemberID }, MemberResponseDto.FromMember(member));
        }

        // DELETE: api/Members/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteMember(int id)
        {
            var (userId, username, userBranchId, _, isHeadOfficeAdmin) = GetCurrentUserContext();
            var member = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == id);
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
            bool hasActiveSavings = await _context.SavingAccountMasters.AnyAsync(s => member.CustomerID != null && s.CustomerID == member.CustomerID && s.Status != "Closed");
            bool hasActiveFds = member.CustomerID != null && await _context.FdAccounts.AnyAsync(f => f.CustomerID == member.CustomerID && f.Status == "Active");
            bool hasActiveRds = member.CustomerID != null && await _context.RdAccounts.AnyAsync(r => r.CustomerID == member.CustomerID && r.Status == "Active");
            bool hasActivePigmies = member.CustomerID != null && await _context.PigmyAccounts.AnyAsync(p => p.CustomerID == member.CustomerID && p.Status == "Active");
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

                // If the deleted record was the highest/only MemberID, automatically decrement/reseed identity counter
                try
                {
                    var maxRemainingId = await _context.Members.MaxAsync(m => (int?)m.MemberID) ?? 0;
                    if (id >= maxRemainingId)
                    {
                        int reseedVal = maxRemainingId;
                        await _context.Database.ExecuteSqlInterpolatedAsync($"DBCC CHECKIDENT ('Members', RESEED, {reseedVal});");
                    }
                }
                catch (Exception reseedEx)
                {
                    Console.WriteLine($"[WARNING] Member reseed error: {reseedEx.Message}");
                }

                string memberName = member.Customer != null ? $"{member.Customer.FirstName} {member.Customer.LastName}".Trim() : "Member";
                string cifNo = member.Customer?.CIFNo ?? "";
                await LogAuditAsync("MEMBER_DELETE", id.ToString(), $"सभासद कायमचा डिलीट केला: {memberName}, CIF: {cifNo}, Code: {member.MemberCode}");

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
            var member = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == id);
            if (member == null) return NotFound("Member not found.");

            var loanBalance = await _context.LoanAccounts
                .Where(l => l.MemberID == id && l.Status != "Closed")
                .SumAsync(l => l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance);

            var savingBalance = member.CustomerID != null
                ? await _context.SavingAccountMasters.Where(s => s.CustomerID == member.CustomerID && s.Status != "Closed").SumAsync(s => (decimal?)s.CurrentBalance) ?? 0
                : 0;

            var fdBalance = member.CustomerID != null
                ? await _context.FdAccounts.Where(f => f.CustomerID == member.CustomerID && f.Status == "Active").SumAsync(f => f.DepositAmount)
                : 0m;

            var rdBalance = member.CustomerID != null
                ? await _context.RdAccounts.Where(r => r.CustomerID == member.CustomerID && r.Status == "Active").SumAsync(r => r.TotalDepositedAmount)
                : 0m;

            var pigmyBalance = member.CustomerID != null
                ? await _context.PigmyAccounts
                    .Where(p => p.CustomerID == member.CustomerID && p.Status == "Active")
                    .SumAsync(p => p.TotalDepositedAmount)
                : 0m;

            var shareAccount = await _context.ShareAccounts.FirstOrDefaultAsync(s => s.MemberId == id);
            var shareBalance = shareAccount?.TotalShareAmount ?? 0;
            var shareCount = shareAccount?.TotalShareCount ?? 0;

            // Check if member is a Guarantor on any active loans
            var guarantorLoansRaw = await _context.LoanAccounts
                .Include(l => l.Member).ThenInclude(m => m!.Customer)
                .Where(l => (l.Guarantor1MemberID == id || l.Guarantor2MemberID == id) && l.Status != "Closed")
                .ToListAsync();

            var guaranteedLoans = guarantorLoansRaw.Select(l => new
            {
                LoanAccountID = l.LoanAccountID,
                LoanAccountNo = l.LoanAccountNo,
                BorrowerName = l.Member?.Customer != null ? $"{l.Member.Customer.FirstName} {(string.IsNullOrWhiteSpace(l.Member.Customer.MiddleName) ? "" : l.Member.Customer.MiddleName + " ")}{l.Member.Customer.LastName}".Trim() : "Unknown",
                BorrowerCode = l.Member != null ? l.Member.MemberCode : "",
                BorrowerCif = l.Member?.Customer != null ? l.Member.Customer.CIFNo : "",
                SanctionedAmount = l.SanctionedAmount,
                PrincipalBalance = l.PrincipalBalance,
                InterestBalance = l.InterestBalance,
                TotalOutstanding = l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance,
                GuarantorType = l.Guarantor1MemberID == id ? "जामीनदार १ (Guarantor 1)" : "जामीनदार २ (Guarantor 2)",
                Status = l.Status
            }).ToList();

            var activeGuaranteedLoans = guaranteedLoans.Where(l => l.TotalOutstanding > 0).ToList();
            bool hasGuarantorLiability = activeGuaranteedLoans.Count > 0;
            decimal totalGuaranteedOutstanding = activeGuaranteedLoans.Sum(l => l.TotalOutstanding);

            bool canClose = loanBalance <= 0 && savingBalance <= 0 && fdBalance <= 0 && rdBalance <= 0 && pigmyBalance <= 0 && !hasGuarantorLiability;

            string memberName = member.Customer != null ? $"{member.Customer.FirstName} {member.Customer.LastName}".Trim() : "Member";

            return Ok(new
            {
                MemberId = id,
                MemberName = memberName,
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
                var member = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == id);
                if (member == null) return NotFound("Member not found.");
                if (member.Status == "Closed") return BadRequest("Member is already closed.");

                if (!isHeadOfficeAdmin && member.BranchID != userBranchId)
                {
                    return StatusCode(403, new { message = "आपण केवळ आपल्या शाखेतील सभासदाचे खाते बंद करू शकता (Cross-Branch Closure Denied)." });
                }

                // Re-verify balances
                var hasActiveLoans = await _context.LoanAccounts.AnyAsync(l => l.MemberID == id && l.Status != "Closed" && (l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance) > 0);
                var hasActiveSavings = await _context.SavingAccountMasters.AnyAsync(s => member.CustomerID != null && s.CustomerID == member.CustomerID && s.Status != "Closed" && s.CurrentBalance > 0);
                var hasActiveFds = member.CustomerID != null && await _context.FdAccounts.AnyAsync(f => f.CustomerID == member.CustomerID && f.Status == "Active");
                var hasActiveRds = member.CustomerID != null && await _context.RdAccounts.AnyAsync(r => r.CustomerID == member.CustomerID && r.Status == "Active");
                var hasActivePigmies = member.CustomerID != null && await _context.PigmyAccounts.AnyAsync(p => p.CustomerID == member.CustomerID && p.Status == "Active");

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

                string memberName = member.Customer != null ? $"{member.Customer.FirstName} {member.Customer.LastName}".Trim() : "Member";
                string cifNo = member.Customer?.CIFNo ?? "";

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
                        Narration = $"Share Withdrawal on Member Closure for {memberName}. {request.Narration}",
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
                        CustomerID = member.CustomerID ?? (member.Customer?.CustomerID ?? 1),
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

                await LogAuditAsync("MEMBER_CLOSE", id.ToString(), $"सभासदत्व यशस्वीरित्या रद्द केले: {memberName}, CIF: {cifNo}");

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
            var member = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == id);
            if (member == null) return NotFound("Member not found.");

            if (!isHeadOfficeAdmin && member.BranchID != userBranchId)
            {
                return StatusCode(403, new { message = "आपल्याला इतर शाखेतील मयत सभासदाची माहिती पाहण्याची परवानगी नाही." });
            }

            var savingsBalance = member.CustomerID != null
                ? await _context.SavingAccountMasters.Where(s => s.CustomerID == member.CustomerID && s.Status != "Closed").SumAsync(s => (decimal?)s.CurrentBalance) ?? 0
                : 0;

            var fdBalance = member.CustomerID != null
                ? await _context.FdAccounts.Where(f => f.CustomerID == member.CustomerID && f.Status == "Active").SumAsync(f => f.DepositAmount)
                : 0m;

            var rdBalance = member.CustomerID != null
                ? await _context.RdAccounts.Where(r => r.CustomerID == member.CustomerID && r.Status == "Active").SumAsync(r => r.TotalDepositedAmount)
                : 0m;

            var pigmyBalance = member.CustomerID != null
                ? await _context.PigmyAccounts
                    .Where(p => p.CustomerID == member.CustomerID && p.Status == "Active")
                    .SumAsync(p => p.TotalDepositedAmount)
                : 0m;

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

            var cust = member.Customer;
            string memberName = cust != null ? $"{cust.FirstName} {cust.MiddleName} {cust.LastName}".Replace("  ", " ").Trim() : "Member";

            return Ok(new
            {
                memberID = id,
                memberName = memberName,
                memberCode = member.MemberCode,
                cifNo = cust?.CIFNo ?? "",
                status = member.Status,
                nomineeName = cust?.NomineeName ?? "-",
                nomineeRelation = cust?.NomineeRelation ?? "-",
                nomineeAddress = cust?.NomineeAddress ?? "-",
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
                var member = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == id);
                if (member == null) return NotFound("Member not found.");

                if (!isHeadOfficeAdmin && member.BranchID != userBranchId)
                {
                    return StatusCode(403, new { message = "आपण केवळ आपल्या शाखेतील मयत सभासदाचा क्लेम सेटल करू शकता (Cross-Branch Claim Settlement Denied)." });
                }

                // Check active loan balance
                var loanBalance = await _context.LoanAccounts
                    .Where(l => l.MemberID == id && l.Status != "Closed")
                    .SumAsync(l => l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance);

                var savingsBalance = member.CustomerID != null
                    ? await _context.SavingAccountMasters.Where(s => s.CustomerID == member.CustomerID && s.Status != "Closed").SumAsync(s => (decimal?)s.CurrentBalance) ?? 0
                    : 0;

                var fdBalance = member.CustomerID != null
                    ? await _context.FdAccounts.Where(f => f.CustomerID == member.CustomerID && f.Status == "Active").SumAsync(f => f.DepositAmount)
                    : 0m;

                var rdBalance = member.CustomerID != null
                    ? await _context.RdAccounts.Where(r => r.CustomerID == member.CustomerID && r.Status == "Active").SumAsync(r => r.TotalDepositedAmount)
                    : 0m;

                var pigmyBalance = member.CustomerID != null
                    ? await _context.PigmyAccounts
                        .Where(p => p.CustomerID == member.CustomerID && p.Status == "Active")
                        .SumAsync(p => p.TotalDepositedAmount)
                    : 0m;

                var shareAccount = await _context.ShareAccounts.FirstOrDefaultAsync(s => s.MemberId == id);
                decimal shareAmount = shareAccount?.TotalShareAmount ?? 0;

                decimal grossAmount = savingsBalance + fdBalance + rdBalance + pigmyBalance + shareAmount;
                decimal netAmount = grossAmount - loanBalance;

                // Close deposit accounts
                var savings = member.CustomerID != null 
                    ? await _context.SavingAccountMasters.Where(s => s.CustomerID == member.CustomerID && s.Status != "Closed").ToListAsync()
                    : new List<SavingAccountMaster>();
                foreach (var s in savings)
                {
                    s.Status = "Closed";
                    s.CurrentBalance = 0;
                }

                var fds = member.CustomerID != null
                    ? await _context.FdAccounts.Where(f => f.CustomerID == member.CustomerID && f.Status == "Active").ToListAsync()
                    : new List<FdAccount>();
                foreach (var f in fds) f.Status = "Closed";

                var rds = member.CustomerID != null
                    ? await _context.RdAccounts.Where(r => r.CustomerID == member.CustomerID && r.Status == "Active").ToListAsync()
                    : new List<RdAccount>();
                foreach (var r in rds) r.Status = "Closed";

                var pigmies = member.CustomerID != null
                    ? await _context.PigmyAccounts.Where(p => p.CustomerID == member.CustomerID && p.Status == "Active").ToListAsync()
                    : new List<PigmyAccount>();
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
                    string memberCustName = member.Customer != null ? $"{member.Customer.FirstName} {member.Customer.LastName}".Trim() : "Member";

                    var voucher = new Voucher
                    {
                        BranchID = req.BranchId,
                        VoucherNo = $"VCH-CLM-{DateTime.Today:yyyyMMdd}-{vchCount:D4}",
                        VoucherDate = DateTime.Today,
                        VoucherType = "Payment",
                        TotalAmount = netAmount,
                        Narration = $"मयत सभासद वारसदार क्लेम सेटलमेंट: {memberCustName} (वारसदार: {req.NomineeName}, मयत दाखला: {req.DeathCertificateNo}, ठराव: {req.ResolutionNo})",
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
                    NomineeName = string.IsNullOrWhiteSpace(req.NomineeName) ? (member.Customer?.NomineeName ?? "Legal Heir") : req.NomineeName,
                    NomineeRelation = req.NomineeRelation ?? member.Customer?.NomineeRelation,
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

                string memberFullName = member.Customer != null ? $"{member.Customer.FirstName} {member.Customer.LastName}".Trim() : "Member";
                await LogAuditAsync("DECEASED_CLAIM_SETTLED", settlement.ClaimID.ToString(), $"मयत खातेदार क्लेम सेटलमेंट पूर्ण: {memberFullName}, वारसदार: {settlement.NomineeName}, निव्वळ रक्कम: ₹{netAmount}");

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
        [HttpGet("{id}/summary")]
        public async Task<IActionResult> GetGuarantorSummary(int id)
        {
            var member = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == id);
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
            var savingsBalance = member.CustomerID != null
                ? await _context.SavingAccountMasters.Where(s => s.CustomerID == member.CustomerID && s.Status == "Active").SumAsync(s => (decimal?)s.CurrentBalance) ?? 0
                : 0;

            var ownActiveLoans = await _context.LoanAccounts
                .Include(l => l.Member).ThenInclude(m => m!.Customer)
                .Include(l => l.LoanRate)
                .Where(l => (l.MemberID == id || l.CoMemberID == id || l.CoMember2ID == id) && l.Status == "Active")
                .ToListAsync();

            var activeGuaranteedLoans = await _context.LoanAccounts
                .Include(l => l.Member).ThenInclude(m => m!.Customer)
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
                .Include(a => a.Member).ThenInclude(m => m!.Customer)
                .Include(a => a.LoanRate)
                .Where(a => (a.MemberID == id || a.CoMemberID == id || a.CoMember2ID == id) && !disbursedLoanAppIds.Contains(a.LoanApplicationID))
                .ToListAsync();

            var pendingGuaranteedApps = await _context.LoanApplications
                .Include(a => a.Member).ThenInclude(m => m!.Customer)
                .Include(a => a.LoanRate)
                .Where(a => (a.Guarantor1MemberID == id || a.Guarantor2MemberID == id) && !disbursedLoanAppIds.Contains(a.LoanApplicationID))
                .ToListAsync();

            var ownLoansList = ownActiveLoans.Select(l => new
            {
                loanAccountID = l.LoanAccountID,
                loanAccountNo = l.LoanAccountNo,
                borrowerName = l.Member?.Customer != null ? $"{l.Member.Customer.FirstName} {l.Member.Customer.MiddleName} {l.Member.Customer.LastName}".Replace("  ", " ").Trim() : "",
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
                borrowerName = a.Member?.Customer != null ? $"{a.Member.Customer.FirstName} {a.Member.Customer.MiddleName} {a.Member.Customer.LastName}".Replace("  ", " ").Trim() : "",
                borrowerCode = a.Member?.MemberCode,
                loanType = a.LoanRate?.ShortName ?? a.LoanRate?.LoanType ?? "",
                requestedAmount = a.RequestedAmount,
                status = "Pending"
            }).ToList();

            var guaranteedLoansList = activeGuaranteedLoans.Select(l => new
            {
                loanAccountID = l.LoanAccountID,
                loanAccountNo = l.LoanAccountNo,
                borrowerName = l.Member?.Customer != null ? $"{l.Member.Customer.FirstName} {l.Member.Customer.MiddleName} {l.Member.Customer.LastName}".Replace("  ", " ").Trim() : "",
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
                borrowerName = a.Member?.Customer != null ? $"{a.Member.Customer.FirstName} {a.Member.Customer.MiddleName} {a.Member.Customer.LastName}".Replace("  ", " ").Trim() : "",
                borrowerCode = a.Member?.MemberCode,
                loanType = a.LoanRate?.ShortName ?? a.LoanRate?.LoanType ?? "",
                requestedAmount = a.RequestedAmount,
                status = "Pending"
            }).ToList();

            var cust = member.Customer;
            string memberName = cust != null ? $"{cust.FirstName} {cust.MiddleName} {cust.LastName}".Replace("  ", " ").Trim() : "Member";

            var summary = new
            {
                memberID = id,
                memberName = memberName,
                memberCode = member.MemberCode,
                cifNo = cust?.CIFNo ?? GenerateCifNo(member),
                mobileNo = string.IsNullOrWhiteSpace(cust?.MobileNo) || cust.MobileNo == "0000000000" ? "-" : cust.MobileNo,
                address = cust?.Address ?? "",
                village = cust?.Village ?? "",
                occupation = cust?.Occupation ?? "",
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
            var director = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == id);
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
                .Include(l => l.Member).ThenInclude(m => m!.Customer)
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
                .Include(a => a.Member).ThenInclude(m => m!.Customer)
                .Include(a => a.LoanRate)
                .Where(a => a.RecommendedByDirectorID == id && !disbursedLoanAppIds.Contains(a.LoanApplicationID))
                .ToListAsync();

            var recommendedLoansList = activeRecommendedLoans.Select(l => new
            {
                loanAccountID = l.LoanAccountID,
                loanAccountNo = l.LoanAccountNo,
                borrowerName = l.Member?.Customer != null ? $"{l.Member.Customer.FirstName} {l.Member.Customer.MiddleName} {l.Member.Customer.LastName}".Replace("  ", " ").Trim() : "",
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
                borrowerName = a.Member?.Customer != null ? $"{a.Member.Customer.FirstName} {a.Member.Customer.MiddleName} {a.Member.Customer.LastName}".Replace("  ", " ").Trim() : "",
                borrowerCode = a.Member?.MemberCode,
                loanType = a.LoanRate?.ShortName ?? a.LoanRate?.LoanType ?? "",
                requestedAmount = a.RequestedAmount,
                status = "Pending"
            }).ToList();

            var dCust = director.Customer;
            string directorName = dCust != null ? $"{dCust.FirstName} {dCust.MiddleName} {dCust.LastName}".Replace("  ", " ").Trim() : "Director";

            var summary = new
            {
                memberID = id,
                directorName = directorName,
                directorCode = director.MemberCode,
                cifNo = dCust?.CIFNo ?? GenerateCifNo(director),
                mobileNo = string.IsNullOrWhiteSpace(dCust?.MobileNo) || dCust.MobileNo == "0000000000" ? "-" : dCust.MobileNo,
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
