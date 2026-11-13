using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net.Mail;
using System.Security.Claims;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Helpers;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Admin,SuperAdmin,HeadOffice,HO_Manager,BranchManager")]
    public class CustomerBulkController : ControllerBase
    {
        private readonly AppDbContext _context;

        private static readonly int[][] VerhoeffD =
        {
            new[] {0, 1, 2, 3, 4, 5, 6, 7, 8, 9},
            new[] {1, 2, 3, 4, 0, 6, 7, 8, 9, 5},
            new[] {2, 3, 4, 0, 1, 7, 8, 9, 5, 6},
            new[] {3, 4, 0, 1, 2, 8, 9, 5, 6, 7},
            new[] {4, 0, 1, 2, 3, 9, 5, 6, 7, 8},
            new[] {5, 9, 8, 7, 6, 0, 4, 3, 2, 1},
            new[] {6, 5, 9, 8, 7, 1, 0, 4, 3, 2},
            new[] {7, 6, 5, 9, 8, 2, 1, 0, 4, 3},
            new[] {8, 7, 6, 5, 9, 3, 2, 1, 0, 4},
            new[] {9, 8, 7, 6, 5, 4, 3, 2, 1, 0}
        };

        private static readonly int[][] VerhoeffP =
        {
            new[] {0, 1, 2, 3, 4, 5, 6, 7, 8, 9},
            new[] {1, 5, 7, 6, 2, 8, 3, 0, 9, 4},
            new[] {5, 8, 0, 3, 7, 9, 6, 1, 4, 2},
            new[] {8, 9, 1, 6, 0, 4, 3, 5, 2, 7},
            new[] {9, 4, 5, 3, 1, 2, 6, 8, 7, 0},
            new[] {4, 2, 8, 6, 5, 7, 3, 9, 0, 1},
            new[] {2, 7, 9, 3, 8, 0, 6, 4, 1, 5},
            new[] {7, 0, 4, 6, 9, 1, 3, 2, 5, 8}
        };

        private static readonly HashSet<string> AllowedCustomerTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "Individual", "Proprietorship", "Partnership", "PvtLtd", "PublicLtd", "Trust", "Society", "SHG", "HUF"
        };

        private static readonly HashSet<string> AllowedKycStatuses = new(StringComparer.OrdinalIgnoreCase)
        {
            "Verified", "Pending", "ReKYCDue", "Simplified", "Exempted"
        };

        private static readonly HashSet<string> AllowedRiskCategories = new(StringComparer.OrdinalIgnoreCase)
        {
            "Low", "Medium", "High"
        };

        public CustomerBulkController(AppDbContext context)
        {
            _context = context;
        }

        private (int userId, string username, int branchId, string role) GetCurrentUserContext()
        {
            if (User?.Identity == null || !User.Identity.IsAuthenticated)
            {
                throw new UnauthorizedAccessException("अनाधिकृत विनंती: कृपया प्रथम सिस्टीममध्ये लॉगिन करा (User is not authenticated).");
            }

            int userId = User.GetUserId();
            string username = User.GetUsername();
            int branchId = User.GetOperatingBranchId();
            string role = User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("Role")?.Value ?? "Staff";

            return (userId, username, branchId, role);
        }

        private static bool IsValidVerhoeff(string digits)
        {
            if (string.IsNullOrEmpty(digits) || digits.Length != 12) return false;
            int c = 0;
            for (int i = 0; i < digits.Length; i++)
            {
                int digit = digits[digits.Length - 1 - i] - '0';
                if (digit < 0 || digit > 9) return false;
                c = VerhoeffD[c][VerhoeffP[i % 8][digit]];
            }
            return c == 0;
        }

        private static string NormalizeGender(string? raw)
        {
            var g = (raw ?? string.Empty).Trim();
            if (string.IsNullOrEmpty(g)) return "Male";
            if (g.Equals("Female", StringComparison.OrdinalIgnoreCase) || g.Equals("F", StringComparison.OrdinalIgnoreCase) || g.Contains("स्त्री"))
                return "Female";
            if (g.Equals("Other", StringComparison.OrdinalIgnoreCase) || g.Equals("O", StringComparison.OrdinalIgnoreCase) || g.Contains("इतर"))
                return "Other";
            if (g.Equals("Male", StringComparison.OrdinalIgnoreCase) || g.Equals("M", StringComparison.OrdinalIgnoreCase) || g.Contains("पुरुष"))
                return "Male";
            return g;
        }

        private static void CheckMaxLength(string? val, int maxLen, string fieldLabel, List<string> errors)
        {
            if (!string.IsNullOrEmpty(val) && val.Trim().Length > maxLen)
            {
                errors.Add($"{fieldLabel} कमाल {maxLen} अक्षरांपर्यंत असावा (सध्या {val.Trim().Length}).");
            }
        }

        public class BulkCustomerRowDto
        {
            public int RowIndex { get; set; }
            public string? ClientRowId { get; set; }
            public int CustomerID { get; set; } = 0; // 0 = New Insert, > 0 = Existing Update
            public string? CIFNo { get; set; }
            public string FirstName { get; set; } = string.Empty;
            public string? MiddleName { get; set; }
            public string LastName { get; set; } = string.Empty;
            public string? FirstNameEng { get; set; }
            public string? MiddleNameEng { get; set; }
            public string? LastNameEng { get; set; }
            public string? MobileNo { get; set; }
            public string? AadhaarNo { get; set; }
            public string? PANNo { get; set; }
            public string? Gender { get; set; } = "Male";
            public DateTime? BirthDate { get; set; }
            public string? Address { get; set; }
            public string? Village { get; set; }
            public string? Taluka { get; set; }
            public string? District { get; set; }
            public string? Occupation { get; set; }
            public string? CustomerType { get; set; } = "Individual";
            public string? KYCStatus { get; set; } = "Verified";
            public string? CKYCNo { get; set; }
            public string? RiskCategory { get; set; } = "Low";
            public string? Email { get; set; }
            public string? NomineeName { get; set; }
            public string? NomineeRelation { get; set; }
            public string? LegacyCustomerNo { get; set; }
            public int? BranchID { get; set; }
        }

        public class RowValidationItem
        {
            public int RowIndex { get; set; }
            public string? ClientRowId { get; set; }
            public bool IsValid { get; set; }
            public List<string> Errors { get; set; } = new List<string>();
            public List<string> Warnings { get; set; } = new List<string>();
        }

        public class BulkValidationResult
        {
            public int TotalRows { get; set; }
            public int ValidCount { get; set; }
            public int InvalidCount { get; set; }
            public List<RowValidationItem> Results { get; set; } = new List<RowValidationItem>();
        }

        public class BulkSaveRequest
        {
            public string BatchName { get; set; } = "DirectGridEntry";
            public int? BranchID { get; set; }
            public bool SaveValidOnly { get; set; } = true;
            public List<BulkCustomerRowDto> Customers { get; set; } = new List<BulkCustomerRowDto>();
        }

        // GET: api/CustomerBulk/meta
        [HttpGet("meta")]
        public async Task<IActionResult> GetMetadata()
        {
            bool isHoAdmin = User.IsHeadOfficeAdmin();
            int operatingBranchId = User.GetOperatingBranchId();

            var branchQuery = _context.Branches.AsNoTracking().Where(b => b.IsActive);
            if (!isHoAdmin)
            {
                branchQuery = branchQuery.Where(b => b.BranchID == operatingBranchId);
            }

            var branches = await branchQuery
                .Select(b => new { b.BranchID, b.BranchCode, b.BranchName })
                .ToListAsync();

            var nextCifSeq = await GetNextCifPreviewAsync();

            var sanstha = await _context.SansthaDetails.AsNoTracking().FirstOrDefaultAsync();
            var sansthaDefaults = new
            {
                address = sanstha?.Address ?? "",
                village = sanstha?.Village ?? "",
                taluka = sanstha?.Taluka ?? "",
                district = sanstha?.District ?? "",
                state = sanstha?.State ?? "Maharashtra",
                pinCode = sanstha?.PinCode ?? ""
            };

            return Ok(new
            {
                branches,
                isHoAdmin,
                operatingBranchId,
                nextCif = nextCifSeq,
                sansthaDefaults,
                defaultBirthDate = "1990-01-01",
                customerTypes = new[] { "Individual", "Proprietorship", "Partnership", "PvtLtd", "PublicLtd", "Trust", "Society", "SHG", "HUF" },
                kycStatuses = new[] { "Verified", "Pending", "ReKYCDue", "Simplified", "Exempted" },
                riskCategories = new[] { "Low", "Medium", "High" },
                genders = new[] { "Male", "Female", "Other" }
            });
        }

        private async Task<long> GetMaxCifNumberAsync(string prefix)
        {
            var cifs = await _context.Customers
                .AsNoTracking()
                .Where(c => c.CIFNo != null && c.CIFNo.StartsWith(prefix))
                .Select(c => c.CIFNo!)
                .ToListAsync();

            long maxNum = 0;
            foreach (var cif in cifs)
            {
                if (cif.Length > prefix.Length && long.TryParse(cif.Substring(prefix.Length), out long parsed) && parsed > maxNum)
                {
                    maxNum = parsed;
                }
            }
            return maxNum;
        }

        private async Task<string> GetNextCifPreviewAsync()
        {
            try
            {
                var seq = await _context.CifSequences
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.SequenceCode == "CORE_CIF_SEQ");

                string prefix = string.IsNullOrWhiteSpace(seq?.Prefix) ? "CIF" : seq!.Prefix;
                long maxNum = Math.Max(seq?.CurrentValue ?? 0, await GetMaxCifNumberAsync(prefix));

                long nextNum = maxNum + 1;
                return $"{prefix}{nextNum.ToString().PadLeft(seq?.PaddingLength ?? 6, '0')}";
            }
            catch
            {
                return "CIF000001";
            }
        }

        // GET: api/CustomerBulk/existing-customers
        [HttpGet("existing-customers")]
        public async Task<IActionResult> GetExistingCustomers(
            [FromQuery] string? search = null,
            [FromQuery] int? branchId = null,
            [FromQuery] bool onlyIncomplete = false,
            [FromQuery] int limit = 100)
        {
            int? effectiveBranchId = User.ResolveOptionalBranchId(branchId);

            var query = _context.Customers
                .AsNoTracking()
                .Where(c => !c.IsDeleted)
                .AsQueryable();

            if (effectiveBranchId.HasValue && effectiveBranchId.Value > 0)
            {
                query = query.Where(c => c.BranchID == effectiveBranchId.Value);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                string s = search.Trim().ToLower();
                query = query.Where(c =>
                    c.FirstName.ToLower().Contains(s) ||
                    (c.MiddleName != null && c.MiddleName.ToLower().Contains(s)) ||
                    c.LastName.ToLower().Contains(s) ||
                    (c.CIFNo != null && c.CIFNo.ToLower().Contains(s)) ||
                    (c.LegacyCustomerNo != null && c.LegacyCustomerNo.ToLower().Contains(s)) ||
                    (c.MobileNo != null && c.MobileNo.Contains(s)) ||
                    (c.AadhaarNo != null && c.AadhaarNo.Contains(s)) ||
                    (c.PANNo != null && c.PANNo.ToLower().Contains(s))
                );
            }

            if (onlyIncomplete)
            {
                query = query.Where(c =>
                    string.IsNullOrEmpty(c.MobileNo) ||
                    string.IsNullOrEmpty(c.AadhaarNo) ||
                    string.IsNullOrEmpty(c.PANNo) ||
                    string.IsNullOrEmpty(c.Address) ||
                    string.IsNullOrEmpty(c.Village) ||
                    c.BirthDate == null
                );
            }

            var list = await query
                .OrderBy(c => c.CustomerID)
                .Take(limit > 0 && limit <= 500 ? limit : 100)
                .Select(c => new BulkCustomerRowDto
                {
                    CustomerID = c.CustomerID,
                    CIFNo = c.CIFNo ?? string.Empty,
                    BranchID = c.BranchID,
                    FirstName = c.FirstName,
                    MiddleName = c.MiddleName,
                    LastName = c.LastName,
                    FirstNameEng = c.FirstNameEng,
                    MiddleNameEng = c.MiddleNameEng,
                    LastNameEng = c.LastNameEng,
                    MobileNo = c.MobileNo,
                    AadhaarNo = c.AadhaarNo,
                    PANNo = c.PANNo,
                    Gender = c.Gender ?? "Male",
                    BirthDate = c.BirthDate,
                    Address = c.Address,
                    Village = c.Village,
                    Taluka = c.Taluka,
                    District = c.District,
                    Occupation = c.Occupation,
                    CustomerType = c.CustomerType ?? "Individual",
                    KYCStatus = c.KYCStatus ?? "Verified",
                    CKYCNo = c.CKYCNo,
                    RiskCategory = c.RiskCategory ?? "Low",
                    Email = c.Email,
                    NomineeName = c.NomineeName,
                    NomineeRelation = c.NomineeRelation,
                    LegacyCustomerNo = c.LegacyCustomerNo
                })
                .ToListAsync();

            return Ok(new
            {
                totalLoaded = list.Count,
                customers = list
            });
        }

        // POST: api/CustomerBulk/validate-live
        [HttpPost("validate-live")]
        public async Task<IActionResult> ValidateLive([FromBody] List<BulkCustomerRowDto> rows)
        {
            var valResult = await RunInternalValidationAsync(rows ?? new List<BulkCustomerRowDto>());
            return Ok(new
            {
                totalRows = valResult.TotalRows,
                validCount = valResult.ValidCount,
                invalidCount = valResult.InvalidCount,
                results = valResult.Results
            });
        }

        private async Task<BulkValidationResult> RunInternalValidationAsync(List<BulkCustomerRowDto> rows)
        {
            if (rows == null || rows.Count == 0)
            {
                return new BulkValidationResult
                {
                    TotalRows = 0,
                    ValidCount = 0,
                    InvalidCount = 0,
                    Results = new List<RowValidationItem>()
                };
            }

            var results = new List<RowValidationItem>(rows.Count);

            var inputMobiles = rows
                .Where(r => !string.IsNullOrWhiteSpace(r.MobileNo))
                .Select(r => r.MobileNo!.Trim())
                .Distinct()
                .ToList();

            var inputAadhaars = rows
                .Where(r => !string.IsNullOrWhiteSpace(r.AadhaarNo))
                .Select(r => r.AadhaarNo!.Trim())
                .Distinct()
                .ToList();

            var inputPans = rows
                .Where(r => !string.IsNullOrWhiteSpace(r.PANNo))
                .Select(r => r.PANNo!.Trim().ToUpperInvariant())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var inputCkycs = rows
                .Where(r => !string.IsNullOrWhiteSpace(r.CKYCNo))
                .Select(r => r.CKYCNo!.Trim())
                .Distinct()
                .ToList();

            var inputLegacys = rows
                .Where(r => !string.IsNullOrWhiteSpace(r.LegacyCustomerNo))
                .Select(r => r.LegacyCustomerNo!.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            // 1. In-Grid duplicate frequency maps
            var existingCustIdFreq = rows
                .Where(r => r.CustomerID > 0)
                .GroupBy(r => r.CustomerID)
                .ToDictionary(g => g.Key, g => g.Count());

            var mobileFreq = rows.Where(r => !string.IsNullOrWhiteSpace(r.MobileNo))
                .GroupBy(r => r.MobileNo!.Trim()).ToDictionary(g => g.Key, g => g.Count());
            var aadhaarFreq = rows.Where(r => !string.IsNullOrWhiteSpace(r.AadhaarNo))
                .GroupBy(r => r.AadhaarNo!.Trim()).ToDictionary(g => g.Key, g => g.Count());
            var panFreq = rows.Where(r => !string.IsNullOrWhiteSpace(r.PANNo))
                .GroupBy(r => r.PANNo!.Trim().ToUpperInvariant(), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.Count(), StringComparer.OrdinalIgnoreCase);
            var ckycFreq = rows.Where(r => !string.IsNullOrWhiteSpace(r.CKYCNo))
                .GroupBy(r => r.CKYCNo!.Trim()).ToDictionary(g => g.Key, g => g.Count());
            var legacyFreq = rows.Where(r => !string.IsNullOrWhiteSpace(r.LegacyCustomerNo))
                .GroupBy(r => r.LegacyCustomerNo!.Trim(), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.Count(), StringComparer.OrdinalIgnoreCase);

            // 2. Fetch existing DB records. Unique SQL indexes (Aadhaar/PAN/CKYC) apply even to soft-deleted rows!
            var dbMobileRecords = inputMobiles.Count == 0 ? new() : await _context.Customers
                .AsNoTracking()
                .Where(c => !c.IsDeleted && c.MobileNo != null && inputMobiles.Contains(c.MobileNo))
                .Select(c => new { c.CustomerID, c.MobileNo })
                .ToListAsync();

            var dbAadhaarRecords = inputAadhaars.Count == 0 ? new() : await _context.Customers
                .AsNoTracking()
                .Where(c => c.AadhaarNo != null && inputAadhaars.Contains(c.AadhaarNo))
                .Select(c => new { c.CustomerID, c.AadhaarNo, c.IsDeleted })
                .ToListAsync();

            var dbPanRecords = inputPans.Count == 0 ? new() : await _context.Customers
                .AsNoTracking()
                .Where(c => c.PANNo != null && inputPans.Contains(c.PANNo))
                .Select(c => new { c.CustomerID, c.PANNo, c.IsDeleted })
                .ToListAsync();

            var dbCkycRecords = inputCkycs.Count == 0 ? new() : await _context.Customers
                .AsNoTracking()
                .Where(c => c.CKYCNo != null && inputCkycs.Contains(c.CKYCNo))
                .Select(c => new { c.CustomerID, c.CKYCNo, c.IsDeleted })
                .ToListAsync();

            var dbLegacyRecords = inputLegacys.Count == 0 ? new() : await _context.Customers
                .AsNoTracking()
                .Where(c => !c.IsDeleted && c.LegacyCustomerNo != null && inputLegacys.Contains(c.LegacyCustomerNo))
                .Select(c => new { c.CustomerID, c.LegacyCustomerNo })
                .ToListAsync();

            var mobileRegex = new Regex(@"^[6-9]\d{9}$", RegexOptions.Compiled);
            var aadhaarRegex = new Regex(@"^[2-9]\d{11}$", RegexOptions.Compiled);
            var repeatAadhaarRegex = new Regex(@"^(\d)\1{11}$", RegexOptions.Compiled);
            var panRegex = new Regex(@"^[A-Z]{5}\d{4}[A-Z]$", RegexOptions.Compiled);
            var ckycRegex = new Regex(@"^\d{14}$", RegexOptions.Compiled);

            for (int i = 0; i < rows.Count; i++)
            {
                var r = rows[i];
                var item = new RowValidationItem
                {
                    RowIndex = r.RowIndex > 0 ? r.RowIndex : (i + 1),
                    ClientRowId = r.ClientRowId,
                    IsValid = true
                };

                if (r.CustomerID > 0 && existingCustIdFreq.TryGetValue(r.CustomerID, out int custFreq) && custFreq > 1)
                {
                    item.Errors.Add("हा विद्यमान खातेदार ग्रिडमध्ये एकापेक्षा जास्त वेळा लोड झाला आहे.");
                }

                // Mandatory fields
                if (string.IsNullOrWhiteSpace(r.FirstName))
                    item.Errors.Add("पहिले नाव आवश्यक आहे (First name is required).");
                if (string.IsNullOrWhiteSpace(r.LastName))
                    item.Errors.Add("आडनाव आवश्यक आहे (Last name is required).");

                // MaxLength parity checks with Customer model
                CheckMaxLength(r.FirstName, 50, "पहिले नाव", item.Errors);
                CheckMaxLength(r.MiddleName, 50, "मधले नाव", item.Errors);
                CheckMaxLength(r.LastName, 50, "आडनाव", item.Errors);
                CheckMaxLength(r.FirstNameEng, 50, "First Name (Eng)", item.Errors);
                CheckMaxLength(r.MiddleNameEng, 50, "Middle Name (Eng)", item.Errors);
                CheckMaxLength(r.LastNameEng, 50, "Last Name (Eng)", item.Errors);
                CheckMaxLength(r.LegacyCustomerNo, 50, "जुना खातेदार क्र.", item.Errors);
                CheckMaxLength(r.Village, 100, "गाव / शहर", item.Errors);
                CheckMaxLength(r.Taluka, 100, "तालुका", item.Errors);
                CheckMaxLength(r.District, 100, "जिल्हा", item.Errors);
                CheckMaxLength(r.Address, 500, "पत्ता", item.Errors);
                CheckMaxLength(r.Occupation, 100, "व्यवसाय", item.Errors);
                CheckMaxLength(r.NomineeName, 150, "वारसदार नाव", item.Errors);
                CheckMaxLength(r.NomineeRelation, 50, "वारसदार नाते", item.Errors);
                CheckMaxLength(r.Email, 150, "ईमेल", item.Errors);

                string normGender = NormalizeGender(r.Gender);
                if (normGender.Length > 10 || (normGender != "Male" && normGender != "Female" && normGender != "Other"))
                {
                    item.Errors.Add("लिंग मूल्य अवैध आहे (Male / Female / Other असावे).");
                }

                if (!string.IsNullOrWhiteSpace(r.CustomerType) && !AllowedCustomerTypes.Contains(r.CustomerType.Trim()))
                    item.Errors.Add($"खातेदार प्रकार '{r.CustomerType}' अवैध आहे.");

                if (!string.IsNullOrWhiteSpace(r.KYCStatus) && !AllowedKycStatuses.Contains(r.KYCStatus.Trim()))
                    item.Errors.Add($"केवायसी स्थिती '{r.KYCStatus}' अवैध आहे.");

                if (!string.IsNullOrWhiteSpace(r.RiskCategory) && !AllowedRiskCategories.Contains(r.RiskCategory.Trim()))
                    item.Errors.Add($"जोखीम वर्ग '{r.RiskCategory}' अवैध आहे.");

                if (!string.IsNullOrWhiteSpace(r.Email))
                {
                    try
                    {
                        var mail = new MailAddress(r.Email.Trim());
                        if (!mail.Address.Contains('.'))
                            item.Errors.Add("ईमेल फॉरमॅट अवैध आहे.");
                    }
                    catch
                    {
                        item.Errors.Add("ईमेल फॉरमॅट अवैध आहे.");
                    }
                }

                // Mobile validation
                if (!string.IsNullOrWhiteSpace(r.MobileNo))
                {
                    var mob = r.MobileNo.Trim();
                    if (!mobileRegex.IsMatch(mob))
                    {
                        item.Errors.Add("मोबाईल नंबर १० अंकी वैध असावा (१० अंक, ६-९ ने सुरू).");
                    }
                    else if (mobileFreq.TryGetValue(mob, out int mCount) && mCount > 1)
                    {
                        item.Errors.Add($"या ग्रिडमध्ये मोबाईल नंबर '{mob}' एकापेक्षा जास्त वेळा आला आहे.");
                    }
                    else if (dbMobileRecords.Any(c => c.MobileNo == mob && c.CustomerID != r.CustomerID))
                    {
                        item.Errors.Add($"हा मोबाईल नंबर '{mob}' बँकेत आधीच दुसऱ्या ग्राहकाकडे नोंदवला आहे.");
                    }
                }

                // Aadhaar validation (Format + Repeating Digits + Verhoeff Checksum)
                if (!string.IsNullOrWhiteSpace(r.AadhaarNo))
                {
                    var aadh = r.AadhaarNo.Trim();
                    if (!aadhaarRegex.IsMatch(aadh))
                    {
                        item.Errors.Add("आधार क्रमांक १२ अंकी वैध असावा (२-९ ने सुरू).");
                    }
                    else if (repeatAadhaarRegex.IsMatch(aadh) || !IsValidVerhoeff(aadh))
                    {
                        item.Errors.Add("आधार क्रमांक अमान्य आहे (Verhoeff चेकसम जुळत नाही).");
                    }
                    else if (aadhaarFreq.TryGetValue(aadh, out int aCount) && aCount > 1)
                    {
                        item.Errors.Add($"या ग्रिडमध्ये आधार क्रमांक '{aadh}' एकापेक्षा जास्त वेळा आला आहे.");
                    }
                    else
                    {
                        var match = dbAadhaarRecords.FirstOrDefault(c => c.AadhaarNo == aadh && c.CustomerID != r.CustomerID);
                        if (match != null)
                        {
                            item.Errors.Add(match.IsDeleted
                                ? $"हा आधार क्रमांक '{aadh}' पूर्वी डिलीट केलेल्या ग्राहक नोंदीत आधीच वापरलेला आहे."
                                : $"हा आधार क्रमांक '{aadh}' बँकेत आधीच दुसऱ्या ग्राहकाकडे नोंदवला आहे.");
                        }
                    }
                }

                // PAN validation
                if (!string.IsNullOrWhiteSpace(r.PANNo))
                {
                    var pan = r.PANNo.Trim().ToUpperInvariant();
                    if (!panRegex.IsMatch(pan))
                    {
                        item.Errors.Add("पॅन नंबर वैध स्वरूपात असावा (उदा. ABCDE1234F).");
                    }
                    else if (panFreq.TryGetValue(pan, out int pCount) && pCount > 1)
                    {
                        item.Errors.Add($"या ग्रिडमध्ये पॅन नंबर '{pan}' एकापेक्षा जास्त वेळा आला आहे.");
                    }
                    else
                    {
                        var match = dbPanRecords.FirstOrDefault(c => c.PANNo != null && c.PANNo.Equals(pan, StringComparison.OrdinalIgnoreCase) && c.CustomerID != r.CustomerID);
                        if (match != null)
                        {
                            item.Errors.Add(match.IsDeleted
                                ? $"हा पॅन नंबर '{pan}' पूर्वी डिलीट केलेल्या ग्राहक नोंदीत आधीच वापरलेला आहे."
                                : $"हा पॅन नंबर '{pan}' बँकेत आधीच दुसऱ्या ग्राहकाकडे नोंदवला आहे.");
                        }
                    }
                }

                // CKYC validation
                if (!string.IsNullOrWhiteSpace(r.CKYCNo))
                {
                    var ckyc = r.CKYCNo.Trim();
                    if (!ckycRegex.IsMatch(ckyc))
                    {
                        item.Errors.Add("सी-केवायसी (CKYC) क्रमांक १४ अंकी असावा.");
                    }
                    else if (ckycFreq.TryGetValue(ckyc, out int cCount) && cCount > 1)
                    {
                        item.Errors.Add($"या ग्रिडमध्ये CKYC क्रमांक '{ckyc}' पुनरावृत्ती झाला आहे.");
                    }
                    else
                    {
                        var match = dbCkycRecords.FirstOrDefault(c => c.CKYCNo == ckyc && c.CustomerID != r.CustomerID);
                        if (match != null)
                        {
                            item.Errors.Add(match.IsDeleted
                                ? $"हा CKYC क्रमांक '{ckyc}' पूर्वी डिलीट केलेल्या ग्राहक नोंदीत आधीच वापरलेला आहे."
                                : $"हा CKYC क्रमांक '{ckyc}' बँकेत आधीच नोंदवला आहे.");
                        }
                    }
                }

                // LegacyCustomerNo validation
                if (!string.IsNullOrWhiteSpace(r.LegacyCustomerNo))
                {
                    var leg = r.LegacyCustomerNo.Trim();
                    if (legacyFreq.TryGetValue(leg, out int lCount) && lCount > 1)
                    {
                        item.Errors.Add($"या ग्रिडमध्ये जुना ग्राहक क्र. '{leg}' एकापेक्षा जास्त वेळा आला आहे.");
                    }
                    else if (dbLegacyRecords.Any(c => c.LegacyCustomerNo != null && c.LegacyCustomerNo.Equals(leg, StringComparison.OrdinalIgnoreCase) && c.CustomerID != r.CustomerID))
                    {
                        item.Errors.Add($"हा जुना ग्राहक क्र. '{leg}' बँकेत आधीच नोंदवला आहे.");
                    }
                }

                // Birth Date check & Minor warning
                if (r.BirthDate.HasValue)
                {
                    if (r.BirthDate.Value.Date > DateTime.Today)
                    {
                        item.Errors.Add("जन्मतारीख भविष्यातील असू शकत नाही.");
                    }
                    else if (r.BirthDate.Value.Date > DateTime.Today.AddYears(-18))
                    {
                        item.Warnings.Add("ग्राहक अल्पवयीन (वय १८ पेक्षा कमी - Minor) आहे.");
                    }
                }

                if (!string.IsNullOrWhiteSpace(r.NomineeName) && string.IsNullOrWhiteSpace(r.NomineeRelation))
                {
                    item.Warnings.Add("वारसदाराचे नाव भरले आहे, नाते (Relation) देखील भरणे उचित ठरेल.");
                }

                item.IsValid = item.Errors.Count == 0;
                results.Add(item);
            }

            int validCount = results.Count(x => x.IsValid);
            int invalidCount = results.Count(x => !x.IsValid);

            return new BulkValidationResult
            {
                TotalRows = rows.Count,
                ValidCount = validCount,
                InvalidCount = invalidCount,
                Results = results
            };
        }

        // POST: api/CustomerBulk/save
        [HttpPost("save")]
        public async Task<IActionResult> BulkSaveCustomers([FromBody] BulkSaveRequest request)
        {
            if (request == null || request.Customers == null || request.Customers.Count == 0)
            {
                return BadRequest(new { message = "कोणतीही ग्राहक माहिती मिळालेली नाही (No data provided)." });
            }

            var sw = Stopwatch.StartNew();
            var (userId, username, _, _) = GetCurrentUserContext();
            bool isHoAdmin = User.IsHeadOfficeAdmin();
            int targetBranchId = User.ResolveBranchId(request.BranchID);

            var valResult = await RunInternalValidationAsync(request.Customers);

            var validCandidates = new List<BulkCustomerRowDto>();
            var skippedCandidates = new List<BulkCustomerRowDto>();
            var validationErrors = new List<RowValidationItem>();

            for (int i = 0; i < request.Customers.Count; i++)
            {
                var row = request.Customers[i];
                var vItem = valResult.Results[i];

                if (vItem.IsValid)
                {
                    validCandidates.Add(row);
                }
                else
                {
                    validationErrors.Add(vItem);
                    if (!request.SaveValidOnly)
                    {
                        return BadRequest(new
                        {
                            message = $"ओळ क्र. {vItem.RowIndex} मध्ये त्रुटी आहेत. कृपया त्रुटी दुरुस्त करा किंवा 'केवळ वैध नोंदी जतन करा' निवडा.",
                            errorRow = vItem.RowIndex,
                            errors = vItem.Errors,
                            validationErrors
                        });
                    }
                    skippedCandidates.Add(row);
                }
            }

            if (validCandidates.Count == 0)
            {
                return BadRequest(new
                {
                    message = "जतन करण्यासाठी एकही वैध ग्राहक सापडला नाही. कृपया सर्व त्रुटी तपासा.",
                    validationErrors
                });
            }

            var toInsert = validCandidates.Where(c => c.CustomerID <= 0).ToList();
            var toUpdate = validCandidates.Where(c => c.CustomerID > 0).ToList();

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                int actualUpdatedCount = 0;

                // Validate existing customers & branch isolation before making writes
                Dictionary<int, Customer> existingMap = new();
                if (toUpdate.Count > 0)
                {
                    var updateIds = toUpdate.Select(u => u.CustomerID).Distinct().ToList();
                    var existingCustomers = await _context.Customers
                        .Where(c => updateIds.Contains(c.CustomerID) && !c.IsDeleted)
                        .ToListAsync();

                    existingMap = existingCustomers.ToDictionary(c => c.CustomerID);

                    foreach (var dto in toUpdate)
                    {
                        if (!existingMap.TryGetValue(dto.CustomerID, out var existing))
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(new { message = $"खातेदार क्रमांक {dto.CustomerID} सक्रिय स्थितीत सापडला नाही (किंवा डिलीट झाला आहे)." });
                        }

                        if (!isHoAdmin && existing.BranchID != targetBranchId)
                        {
                            await transaction.RollbackAsync();
                            return StatusCode(403, new { message = $"खातेदार '{existing.FirstName} {existing.LastName}' आपल्या शाखेतील नसल्यामुळे अद्यतनित करण्याची परवानगी नाही." });
                        }
                    }
                }

                // 1. Reserve CIF block ONLY for NEW customers
                string startCif = string.Empty;
                string endCif = string.Empty;
                var newCifList = new List<string>();

                if (toInsert.Count > 0)
                {
                    var cifRes = await ReserveCifBlockAsync(toInsert.Count);
                    startCif = cifRes.startCif;
                    endCif = cifRes.endCif;
                    newCifList = cifRes.cifList;
                }

                // 2. Generate Unique Batch Reference
                string batchNumber = $"CUST-BLK-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";

                var batchRecord = new CustomerImportBatch
                {
                    BatchNumber = batchNumber,
                    FileName = string.IsNullOrWhiteSpace(request.BatchName) ? "DirectGridEntry" : request.BatchName,
                    InputMode = "DirectGrid",
                    InstitutionID = 1,
                    HomeBranchID = targetBranchId,
                    TotalRecords = request.Customers.Count,
                    ValidRecords = validCandidates.Count,
                    InvalidRecords = skippedCandidates.Count,
                    ImportedRecords = toInsert.Count,
                    MergedRecords = 0,
                    SkippedRecords = skippedCandidates.Count,
                    Status = "Completed",
                    MakerUserID = userId,
                    MakerUsername = username,
                    SubmittedOn = DateTime.UtcNow,
                    CheckerUserID = userId,
                    CheckerUsername = username,
                    ApprovedOn = DateTime.UtcNow,
                    StartCif = startCif,
                    EndCif = endCif,
                    CreatedOn = DateTime.UtcNow
                };

                _context.CustomerImportBatches.Add(batchRecord);
                await _context.SaveChangesAsync();

                // 3. INSERT New Customers
                for (int i = 0; i < toInsert.Count; i++)
                {
                    var dto = toInsert[i];
                    string assignedCif = newCifList[i];
                    int rowBranchId = isHoAdmin && dto.BranchID.HasValue && dto.BranchID.Value > 0
                        ? dto.BranchID.Value
                        : targetBranchId;

                    var cust = new Customer
                    {
                        BranchID = rowBranchId,
                        CIFNo = assignedCif,
                        FirstName = dto.FirstName.Trim(),
                        MiddleName = string.IsNullOrWhiteSpace(dto.MiddleName) ? null : dto.MiddleName.Trim(),
                        LastName = dto.LastName.Trim(),
                        FirstNameEng = string.IsNullOrWhiteSpace(dto.FirstNameEng) ? null : dto.FirstNameEng.Trim(),
                        MiddleNameEng = string.IsNullOrWhiteSpace(dto.MiddleNameEng) ? null : dto.MiddleNameEng.Trim(),
                        LastNameEng = string.IsNullOrWhiteSpace(dto.LastNameEng) ? null : dto.LastNameEng.Trim(),
                        MobileNo = string.IsNullOrWhiteSpace(dto.MobileNo) ? null : dto.MobileNo.Trim(),
                        AadhaarNo = string.IsNullOrWhiteSpace(dto.AadhaarNo) ? null : dto.AadhaarNo.Trim(),
                        PANNo = string.IsNullOrWhiteSpace(dto.PANNo) ? null : dto.PANNo.Trim().ToUpperInvariant(),
                        Gender = NormalizeGender(dto.Gender),
                        BirthDate = dto.BirthDate,
                        Address = string.IsNullOrWhiteSpace(dto.Address) ? null : dto.Address.Trim(),
                        Village = string.IsNullOrWhiteSpace(dto.Village) ? null : dto.Village.Trim(),
                        Taluka = string.IsNullOrWhiteSpace(dto.Taluka) ? null : dto.Taluka.Trim(),
                        District = string.IsNullOrWhiteSpace(dto.District) ? null : dto.District.Trim(),
                        Occupation = string.IsNullOrWhiteSpace(dto.Occupation) ? "शेती" : dto.Occupation.Trim(),
                        CustomerType = string.IsNullOrWhiteSpace(dto.CustomerType) ? "Individual" : dto.CustomerType.Trim(),
                        KYCStatus = string.IsNullOrWhiteSpace(dto.KYCStatus) ? "Verified" : dto.KYCStatus.Trim(),
                        CKYCNo = string.IsNullOrWhiteSpace(dto.CKYCNo) ? null : dto.CKYCNo.Trim(),
                        RiskCategory = string.IsNullOrWhiteSpace(dto.RiskCategory) ? "Low" : dto.RiskCategory.Trim(),
                        Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim(),
                        NomineeName = string.IsNullOrWhiteSpace(dto.NomineeName) ? null : dto.NomineeName.Trim(),
                        NomineeRelation = string.IsNullOrWhiteSpace(dto.NomineeRelation) ? null : dto.NomineeRelation.Trim(),
                        LegacyCustomerNo = string.IsNullOrWhiteSpace(dto.LegacyCustomerNo) ? null : dto.LegacyCustomerNo.Trim(),
                        HomeBranchID = rowBranchId,
                        ImportBatchID = batchRecord.BatchID,
                        Status = "Active",
                        IsDeleted = false,
                        IsMinor = dto.BirthDate.HasValue && dto.BirthDate.Value.Date > DateTime.Today.AddYears(-18),
                        CreatedBy = userId,
                        CreatedOn = DateTime.UtcNow,
                        RegistrationDate = DateTime.Today
                    };

                    _context.Customers.Add(cust);
                }

                // 4. UPDATE Existing Customers ONLY if any value actually changed
                foreach (var dto in toUpdate)
                {
                    if (!existingMap.TryGetValue(dto.CustomerID, out var existing))
                        continue;

                    string nextFirstName = dto.FirstName.Trim();
                    string? nextMiddleName = string.IsNullOrWhiteSpace(dto.MiddleName) ? null : dto.MiddleName.Trim();
                    string nextLastName = dto.LastName.Trim();
                    string? nextFirstEng = string.IsNullOrWhiteSpace(dto.FirstNameEng) ? null : dto.FirstNameEng.Trim();
                    string? nextMidEng = string.IsNullOrWhiteSpace(dto.MiddleNameEng) ? null : dto.MiddleNameEng.Trim();
                    string? nextLastEng = string.IsNullOrWhiteSpace(dto.LastNameEng) ? null : dto.LastNameEng.Trim();
                    string? nextMobile = string.IsNullOrWhiteSpace(dto.MobileNo) ? null : dto.MobileNo.Trim();
                    string? nextAadhaar = string.IsNullOrWhiteSpace(dto.AadhaarNo) ? null : dto.AadhaarNo.Trim();
                    string? nextPan = string.IsNullOrWhiteSpace(dto.PANNo) ? null : dto.PANNo.Trim().ToUpperInvariant();
                    string nextGender = NormalizeGender(dto.Gender);
                    DateTime? nextBirthDate = dto.BirthDate;
                    string? nextAddress = string.IsNullOrWhiteSpace(dto.Address) ? null : dto.Address.Trim();
                    string? nextVillage = string.IsNullOrWhiteSpace(dto.Village) ? null : dto.Village.Trim();
                    string? nextTaluka = string.IsNullOrWhiteSpace(dto.Taluka) ? null : dto.Taluka.Trim();
                    string? nextDistrict = string.IsNullOrWhiteSpace(dto.District) ? null : dto.District.Trim();
                    string? nextOccupation = string.IsNullOrWhiteSpace(dto.Occupation) ? null : dto.Occupation.Trim();
                    string nextCustType = string.IsNullOrWhiteSpace(dto.CustomerType) ? "Individual" : dto.CustomerType.Trim();
                    string nextKyc = string.IsNullOrWhiteSpace(dto.KYCStatus) ? "Verified" : dto.KYCStatus.Trim();
                    string? nextCkyc = string.IsNullOrWhiteSpace(dto.CKYCNo) ? null : dto.CKYCNo.Trim();
                    string nextRisk = string.IsNullOrWhiteSpace(dto.RiskCategory) ? "Low" : dto.RiskCategory.Trim();
                    string? nextEmail = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim();
                    string? nextNomName = string.IsNullOrWhiteSpace(dto.NomineeName) ? null : dto.NomineeName.Trim();
                    string? nextNomRel = string.IsNullOrWhiteSpace(dto.NomineeRelation) ? null : dto.NomineeRelation.Trim();
                    string? nextLegacy = string.IsNullOrWhiteSpace(dto.LegacyCustomerNo) ? null : dto.LegacyCustomerNo.Trim();

                    bool changed =
                        !string.Equals(existing.FirstName, nextFirstName, StringComparison.Ordinal) ||
                        !string.Equals(existing.MiddleName, nextMiddleName, StringComparison.Ordinal) ||
                        !string.Equals(existing.LastName, nextLastName, StringComparison.Ordinal) ||
                        !string.Equals(existing.FirstNameEng, nextFirstEng, StringComparison.Ordinal) ||
                        !string.Equals(existing.MiddleNameEng, nextMidEng, StringComparison.Ordinal) ||
                        !string.Equals(existing.LastNameEng, nextLastEng, StringComparison.Ordinal) ||
                        !string.Equals(existing.MobileNo, nextMobile, StringComparison.Ordinal) ||
                        !string.Equals(existing.AadhaarNo, nextAadhaar, StringComparison.Ordinal) ||
                        !string.Equals(existing.PANNo, nextPan, StringComparison.Ordinal) ||
                        !string.Equals(existing.Gender ?? "Male", nextGender, StringComparison.Ordinal) ||
                        existing.BirthDate?.Date != nextBirthDate?.Date ||
                        !string.Equals(existing.Address, nextAddress, StringComparison.Ordinal) ||
                        !string.Equals(existing.Village, nextVillage, StringComparison.Ordinal) ||
                        !string.Equals(existing.Taluka, nextTaluka, StringComparison.Ordinal) ||
                        !string.Equals(existing.District, nextDistrict, StringComparison.Ordinal) ||
                        !string.Equals(existing.Occupation, nextOccupation, StringComparison.Ordinal) ||
                        !string.Equals(existing.CustomerType, nextCustType, StringComparison.Ordinal) ||
                        !string.Equals(existing.KYCStatus, nextKyc, StringComparison.Ordinal) ||
                        !string.Equals(existing.CKYCNo, nextCkyc, StringComparison.Ordinal) ||
                        !string.Equals(existing.RiskCategory, nextRisk, StringComparison.Ordinal) ||
                        !string.Equals(existing.Email, nextEmail, StringComparison.Ordinal) ||
                        !string.Equals(existing.NomineeName, nextNomName, StringComparison.Ordinal) ||
                        !string.Equals(existing.NomineeRelation, nextNomRel, StringComparison.Ordinal) ||
                        !string.Equals(existing.LegacyCustomerNo, nextLegacy, StringComparison.Ordinal);

                    if (!changed)
                    {
                        continue;
                    }

                    existing.FirstName = nextFirstName;
                    existing.MiddleName = nextMiddleName;
                    existing.LastName = nextLastName;
                    existing.FirstNameEng = nextFirstEng;
                    existing.MiddleNameEng = nextMidEng;
                    existing.LastNameEng = nextLastEng;
                    existing.MobileNo = nextMobile;
                    existing.AadhaarNo = nextAadhaar;
                    existing.PANNo = nextPan;
                    existing.Gender = nextGender;
                    existing.BirthDate = nextBirthDate;
                    existing.IsMinor = nextBirthDate.HasValue && nextBirthDate.Value.Date > DateTime.Today.AddYears(-18);
                    existing.Address = nextAddress;
                    existing.Village = nextVillage;
                    existing.Taluka = nextTaluka;
                    existing.District = nextDistrict;
                    existing.Occupation = nextOccupation;
                    existing.CustomerType = nextCustType;
                    existing.KYCStatus = nextKyc;
                    existing.CKYCNo = nextCkyc;
                    existing.RiskCategory = nextRisk;
                    existing.Email = nextEmail;
                    existing.NomineeName = nextNomName;
                    existing.NomineeRelation = nextNomRel;
                    existing.LegacyCustomerNo = nextLegacy;
                    existing.UpdatedBy = userId;
                    existing.UpdatedOn = DateTime.UtcNow;

                    actualUpdatedCount++;
                }

                batchRecord.MergedRecords = actualUpdatedCount;
                await _context.SaveChangesAsync();

                sw.Stop();
                batchRecord.ExecutionTimeMs = sw.ElapsedMilliseconds;
                await _context.SaveChangesAsync();

                _context.AuditLogs.Add(new AuditLog
                {
                    UserID = userId,
                    Username = username,
                    Action = "BULK_CUSTOMER_UPSERT",
                    EntityName = "Customer",
                    EntityID = batchRecord.BatchNumber,
                    Timestamp = DateTime.Now,
                    IPAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                    Details = $"बल्क ग्राहक: नवीन नोंदवले: {toInsert.Count}, अद्ययावत केले: {actualUpdatedCount}. CIF Range: {startCif} ते {endCif}",
                    Status = "SUCCESS"
                });
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                string msg;
                if (toInsert.Count > 0 && actualUpdatedCount > 0)
                {
                    msg = $"{toInsert.Count} नवीन ग्राहक नोंदवले व {actualUpdatedCount} ग्राहक अद्ययावत केले (नवीन CIF: {startCif} ते {endCif}).";
                }
                else if (toInsert.Count > 0)
                {
                    msg = $"{toInsert.Count} नवीन ग्राहक यशस्वीरित्या जतन झाले (नवीन CIF: {startCif} ते {endCif}).";
                }
                else if (actualUpdatedCount > 0)
                {
                    msg = $"{actualUpdatedCount} ग्राहक यशस्वीरित्या अद्ययावत (Update) झाले.";
                }
                else
                {
                    msg = "विद्यमान खातेदारांच्या माहितीत कोणताही नवीन बदल आढळला नाही.";
                }

                return Ok(new
                {
                    success = true,
                    batchNumber = batchRecord.BatchNumber,
                    totalProcessed = request.Customers.Count,
                    insertedCount = toInsert.Count,
                    updatedCount = actualUpdatedCount,
                    importedCount = toInsert.Count + actualUpdatedCount,
                    skippedCount = skippedCandidates.Count,
                    startCif,
                    endCif,
                    executionTimeMs = sw.ElapsedMilliseconds,
                    message = msg
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                string details = ex.InnerException?.Message ?? ex.Message;
                return StatusCode(500, new
                {
                    success = false,
                    message = "बल्क ग्राहक जतन करताना त्रुटी आली: " + details
                });
            }
        }

        private async Task<(string startCif, string endCif, List<string> cifList)> ReserveCifBlockAsync(int count)
        {
            if (count <= 0) return (string.Empty, string.Empty, new List<string>());

            CifSequence? seq = null;
            try
            {
                seq = await _context.CifSequences
                    .FromSqlInterpolated($"SELECT * FROM CifSequences WITH (UPDLOCK, ROWLOCK) WHERE SequenceCode = 'CORE_CIF_SEQ'")
                    .FirstOrDefaultAsync();
            }
            catch
            {
                seq = await _context.CifSequences.FirstOrDefaultAsync(s => s.SequenceCode == "CORE_CIF_SEQ");
            }

            string prefix = string.IsNullOrWhiteSpace(seq?.Prefix) ? "CIF" : seq!.Prefix;
            long maxExisting = await GetMaxCifNumberAsync(prefix);

            if (seq == null)
            {
                seq = new CifSequence
                {
                    SequenceCode = "CORE_CIF_SEQ",
                    Prefix = "CIF",
                    CurrentValue = maxExisting,
                    PaddingLength = 6,
                    LastUpdated = DateTime.UtcNow
                };
                _context.CifSequences.Add(seq);
                await _context.SaveChangesAsync();
            }
            else if (seq.CurrentValue < maxExisting)
            {
                seq.CurrentValue = maxExisting;
                seq.LastUpdated = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            long startNum = seq.CurrentValue + 1;
            long endNum = seq.CurrentValue + count;
            seq.CurrentValue = endNum;
            seq.LastUpdated = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var list = new List<string>(count);
            for (long n = startNum; n <= endNum; n++)
            {
                list.Add($"{seq.Prefix}{n.ToString().PadLeft(seq.PaddingLength, '0')}");
            }

            return (list.First(), list.Last(), list);
        }

        // GET: api/CustomerBulk/batches
        [HttpGet("batches")]
        public async Task<IActionResult> GetBatches([FromQuery] int limit = 20)
        {
            int? effectiveBranchId = User.ResolveOptionalBranchId(null);

            var query = _context.CustomerImportBatches.AsNoTracking().AsQueryable();
            if (effectiveBranchId.HasValue && effectiveBranchId.Value > 0)
            {
                query = query.Where(b => b.HomeBranchID == effectiveBranchId.Value);
            }

            var batches = await query
                .OrderByDescending(b => b.BatchID)
                .Take(limit > 0 && limit <= 100 ? limit : 20)
                .ToListAsync();

            return Ok(batches);
        }
    }
}
