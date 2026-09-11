using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Security.Claims;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [AllowAnonymous]
    public class CustomerBulkController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CustomerBulkController(AppDbContext context)
        {
            _context = context;
        }

        private (int userId, string username, int branchId, string role) GetCurrentUserContext()
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

            return (userId, username, branchId, role);
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
            public DateTime? BirthDate { get; set; } = new DateTime(1990, 1, 1);
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
            var branches = await _context.Branches
                .Where(b => b.IsActive)
                .Select(b => new { b.BranchID, b.BranchCode, b.BranchName })
                .ToListAsync();

            var nextCifSeq = await GetNextCifPreviewAsync();

            // Load Sanstha Details for default address auto-fill
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
                nextCif = nextCifSeq,
                sansthaDefaults,
                defaultBirthDate = "1990-01-01",
                customerTypes = new[] { "Individual", "Proprietorship", "Partnership", "PvtLtd", "PublicLtd", "Trust", "Society", "SHG", "HUF" },
                kycStatuses = new[] { "Verified", "Pending", "ReKYCDue", "Simplified", "Exempted" },
                riskCategories = new[] { "Low", "Medium", "High" },
                genders = new[] { "Male", "Female", "Other", "पुरुष", "स्त्री" }
            });
        }

        private async Task<string> GetNextCifPreviewAsync()
        {
            try
            {
                var seq = await _context.CifSequences
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.SequenceCode == "CORE_CIF_SEQ");

                long maxNum = seq?.CurrentValue ?? 0;

                // Also check max existing CIF from Customers table so next preview is always strictly accurate
                var latestCifs = await _context.Customers
                    .AsNoTracking()
                    .Where(c => c.CIFNo != null && c.CIFNo.StartsWith("CIF"))
                    .OrderByDescending(c => c.CustomerID)
                    .Take(20)
                    .Select(c => c.CIFNo!)
                    .ToListAsync();

                foreach (var cif in latestCifs)
                {
                    if (cif.Length > 3 && long.TryParse(cif.Substring(3), out long parsed) && parsed > maxNum)
                    {
                        maxNum = parsed;
                    }
                }

                long nextNum = maxNum + 1;
                return $"CIF{nextNum.ToString().PadLeft(seq?.PaddingLength ?? 6, '0')}";
            }
            catch
            {
                return "CIF000001";
            }
        }

        // GET: api/CustomerBulk/existing-customers
        // Loads existing customers for bulk edit
        [HttpGet("existing-customers")]
        public async Task<IActionResult> GetExistingCustomers(
            [FromQuery] string? search = null,
            [FromQuery] int? branchId = null,
            [FromQuery] bool onlyIncomplete = false,
            [FromQuery] int limit = 100)
        {
            var query = _context.Customers
                .AsNoTracking()
                .Where(c => !c.IsDeleted)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(c => c.BranchID == branchId.Value);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                string s = search.Trim().ToLower();
                query = query.Where(c =>
                    c.FirstName.ToLower().Contains(s) ||
                    c.LastName.ToLower().Contains(s) ||
                    (c.CIFNo != null && c.CIFNo.ToLower().Contains(s)) ||
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

            var results = new List<RowValidationItem>();

            // Collect non-empty identifier lists from input
            var inputMobiles = rows
                .Where(r => !string.IsNullOrWhiteSpace(r.MobileNo))
                .Select(r => r.MobileNo!.Trim())
                .ToList();

            var inputAadhaars = rows
                .Where(r => !string.IsNullOrWhiteSpace(r.AadhaarNo))
                .Select(r => r.AadhaarNo!.Trim())
                .ToList();

            var inputPans = rows
                .Where(r => !string.IsNullOrWhiteSpace(r.PANNo))
                .Select(r => r.PANNo!.Trim().ToUpper())
                .ToList();

            var inputCkycs = rows
                .Where(r => !string.IsNullOrWhiteSpace(r.CKYCNo))
                .Select(r => r.CKYCNo!.Trim())
                .ToList();

            var inputLegacys = rows
                .Where(r => !string.IsNullOrWhiteSpace(r.LegacyCustomerNo))
                .Select(r => r.LegacyCustomerNo!.Trim())
                .ToList();

            // 1. In-Grid duplicate frequency maps
            var mobileFreq = inputMobiles.GroupBy(x => x).ToDictionary(g => g.Key, g => g.Count());
            var aadhaarFreq = inputAadhaars.GroupBy(x => x).ToDictionary(g => g.Key, g => g.Count());
            var panFreq = inputPans.GroupBy(x => x, StringComparer.OrdinalIgnoreCase).ToDictionary(g => g.Key, g => g.Count(), StringComparer.OrdinalIgnoreCase);
            var ckycFreq = inputCkycs.GroupBy(x => x).ToDictionary(g => g.Key, g => g.Count());
            var legacyFreq = inputLegacys.GroupBy(x => x, StringComparer.OrdinalIgnoreCase).ToDictionary(g => g.Key, g => g.Count(), StringComparer.OrdinalIgnoreCase);

            // 2. Fetch existing DB customers with IDs for self-duplicate exclusion
            var dbMobileRecords = await _context.Customers
                .AsNoTracking()
                .Where(c => !c.IsDeleted && c.MobileNo != null && inputMobiles.Contains(c.MobileNo))
                .Select(c => new { c.CustomerID, c.MobileNo })
                .ToListAsync();

            var dbAadhaarRecords = await _context.Customers
                .AsNoTracking()
                .Where(c => !c.IsDeleted && c.AadhaarNo != null && inputAadhaars.Contains(c.AadhaarNo))
                .Select(c => new { c.CustomerID, c.AadhaarNo })
                .ToListAsync();

            var dbPanRecords = await _context.Customers
                .AsNoTracking()
                .Where(c => !c.IsDeleted && c.PANNo != null && inputPans.Contains(c.PANNo))
                .Select(c => new { c.CustomerID, c.PANNo })
                .ToListAsync();

            var dbCkycRecords = await _context.Customers
                .AsNoTracking()
                .Where(c => !c.IsDeleted && c.CKYCNo != null && inputCkycs.Contains(c.CKYCNo))
                .Select(c => new { c.CustomerID, c.CKYCNo })
                .ToListAsync();

            var dbLegacyRecords = await _context.Customers
                .AsNoTracking()
                .Where(c => !c.IsDeleted && c.LegacyCustomerNo != null && inputLegacys.Contains(c.LegacyCustomerNo))
                .Select(c => new { c.CustomerID, c.LegacyCustomerNo })
                .ToListAsync();

            // Regex patterns
            var mobileRegex = new Regex(@"^[6-9]\d{9}$");
            var aadhaarRegex = new Regex(@"^[2-9]\d{11}$");
            var panRegex = new Regex(@"^[A-Z]{5}\d{4}[A-Z]$");
            var ckycRegex = new Regex(@"^\d{14}$");

            for (int i = 0; i < rows.Count; i++)
            {
                var r = rows[i];
                var item = new RowValidationItem
                {
                    RowIndex = r.RowIndex > 0 ? r.RowIndex : (i + 1),
                    ClientRowId = r.ClientRowId,
                    IsValid = true
                };

                // Mandatory fields
                if (string.IsNullOrWhiteSpace(r.FirstName))
                {
                    item.Errors.Add("पहिले नाव आवश्यक आहे (First name is required)");
                    item.IsValid = false;
                }

                if (string.IsNullOrWhiteSpace(r.LastName))
                {
                    item.Errors.Add("आडनाव आवश्यक आहे (Last name is required)");
                    item.IsValid = false;
                }

                // Mobile validation
                if (!string.IsNullOrWhiteSpace(r.MobileNo))
                {
                    var mob = r.MobileNo.Trim();
                    if (!mobileRegex.IsMatch(mob))
                    {
                        item.Errors.Add("मोबाईल नंबर १० अंकी वैध असावा (१० अंक, ६-९ ने सुरू)");
                        item.IsValid = false;
                    }
                    else
                    {
                        if (mobileFreq.TryGetValue(mob, out int mCount) && mCount > 1)
                        {
                            item.Errors.Add($"या ग्रिडमध्ये मोबाईल नंबर '{mob}' एकापेक्षा जास्त वेळा आला आहे.");
                            item.IsValid = false;
                        }
                        else
                        {
                            // Exclude self-match for existing customer update
                            bool existsOther = dbMobileRecords.Any(c => c.MobileNo == mob && c.CustomerID != r.CustomerID);
                            if (existsOther)
                            {
                                item.Errors.Add($"हा मोबाईल नंबर '{mob}' बँकेत आधीच दुसऱ्या ग्राहकाकडे नोंदवला आहे.");
                                item.IsValid = false;
                            }
                        }
                    }
                }

                // Aadhaar validation
                if (!string.IsNullOrWhiteSpace(r.AadhaarNo))
                {
                    var aadh = r.AadhaarNo.Trim();
                    if (!aadhaarRegex.IsMatch(aadh))
                    {
                        item.Errors.Add("आधार क्रमांक १२ अंकी वैध असावा.");
                        item.IsValid = false;
                    }
                    else
                    {
                        if (aadhaarFreq.TryGetValue(aadh, out int aCount) && aCount > 1)
                        {
                            item.Errors.Add($"या ग्रिडमध्ये आधार क्रमांक '{aadh}' एकापेक्षा जास्त वेळा आला आहे.");
                            item.IsValid = false;
                        }
                        else
                        {
                            // Exclude self-match
                            bool existsOther = dbAadhaarRecords.Any(c => c.AadhaarNo == aadh && c.CustomerID != r.CustomerID);
                            if (existsOther)
                            {
                                item.Errors.Add($"हा आधार क्रमांक '{aadh}' बँकेत आधीच दुसऱ्या ग्राहकाकडे नोंदवला आहे.");
                                item.IsValid = false;
                            }
                        }
                    }
                }

                // PAN validation
                if (!string.IsNullOrWhiteSpace(r.PANNo))
                {
                    var pan = r.PANNo.Trim().ToUpper();
                    if (!panRegex.IsMatch(pan))
                    {
                        item.Errors.Add("पॅन नंबर वैध स्वरूपात असावा (उदा. ABCDE1234F).");
                        item.IsValid = false;
                    }
                    else
                    {
                        if (panFreq.TryGetValue(pan, out int pCount) && pCount > 1)
                        {
                            item.Errors.Add($"या ग्रिडमध्ये पॅन नंबर '{pan}' एकापेक्षा जास्त वेळा आला आहे.");
                            item.IsValid = false;
                        }
                        else
                        {
                            // Exclude self-match
                            bool existsOther = dbPanRecords.Any(c => c.PANNo != null && c.PANNo.Equals(pan, StringComparison.OrdinalIgnoreCase) && c.CustomerID != r.CustomerID);
                            if (existsOther)
                            {
                                item.Errors.Add($"हा पॅन नंबर '{pan}' बँकेत आधीच दुसऱ्या ग्राहकाकडे नोंदवला आहे.");
                                item.IsValid = false;
                            }
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
                        item.IsValid = false;
                    }
                    else
                    {
                        if (ckycFreq.TryGetValue(ckyc, out int cCount) && cCount > 1)
                        {
                            item.Errors.Add($"या ग्रिडमध्ये CKYC क्रमांक '{ckyc}' पुनरावृत्ती झाला आहे.");
                            item.IsValid = false;
                        }
                        else
                        {
                            bool existsOther = dbCkycRecords.Any(c => c.CKYCNo == ckyc && c.CustomerID != r.CustomerID);
                            if (existsOther)
                            {
                                item.Errors.Add($"हा CKYC क्रमांक '{ckyc}' बँकेत आधीच नोंदवला आहे.");
                                item.IsValid = false;
                            }
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
                        item.IsValid = false;
                    }
                    else
                    {
                        bool existsOther = dbLegacyRecords.Any(c => c.LegacyCustomerNo != null && c.LegacyCustomerNo.Equals(leg, StringComparison.OrdinalIgnoreCase) && c.CustomerID != r.CustomerID);
                        if (existsOther)
                        {
                            item.Errors.Add($"हा जुना ग्राहक क्र. '{leg}' बँकेत आधीच नोंदवला आहे.");
                            item.IsValid = false;
                        }
                    }
                }

                // Birth Date check & Minor warning
                if (r.BirthDate.HasValue)
                {
                    if (r.BirthDate.Value > DateTime.Today)
                    {
                        item.Errors.Add("जन्मतारीख भविष्यातील असू शकत नाही.");
                        item.IsValid = false;
                    }
                    else if (r.BirthDate.Value > DateTime.Today.AddYears(-18))
                    {
                        item.Warnings.Add("ग्राहक अल्पवयीन (वय १८ पेक्षा कमी - Minor) आहे.");
                    }
                }

                // Nominee Name / Relation validation warning
                if (!string.IsNullOrWhiteSpace(r.NomineeName) && string.IsNullOrWhiteSpace(r.NomineeRelation))
                {
                    item.Warnings.Add("वारसदाराचे नाव भरले आहे, नाते (Relation) देखील भरणे उचित ठरेल.");
                }

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
        // Supports both INSERT (new customers) and UPDATE (existing customers)
        [HttpPost("save")]
        public async Task<IActionResult> BulkSaveCustomers([FromBody] BulkSaveRequest request)
        {
            if (request == null || request.Customers == null || request.Customers.Count == 0)
            {
                return BadRequest(new { message = "कोणतीही ग्राहक माहिती मिळालेली नाही (No data provided)." });
            }

            var sw = Stopwatch.StartNew();
            var (userId, username, userBranchId, _) = GetCurrentUserContext();
            int targetBranchId = request.BranchID.HasValue && request.BranchID.Value > 0 ? request.BranchID.Value : userBranchId;

            // Re-validate to ensure 100% integrity before commit (strongly typed, no dynamic reflection)
            var valResult = await RunInternalValidationAsync(request.Customers);
            var validationMap = valResult.Results.ToDictionary(v => v.RowIndex);

            var validCandidates = new List<BulkCustomerRowDto>();
            var skippedCandidates = new List<BulkCustomerRowDto>();

            for (int i = 0; i < request.Customers.Count; i++)
            {
                var row = request.Customers[i];
                int idx = row.RowIndex > 0 ? row.RowIndex : (i + 1);

                if (validationMap.TryGetValue(idx, out var vItem) && vItem.IsValid)
                {
                    validCandidates.Add(row);
                }
                else
                {
                    if (!request.SaveValidOnly)
                    {
                        return BadRequest(new
                        {
                            message = $"ओळ क्र. {idx} मध्ये त्रुटी आहेत. कृपया त्रुटी दुरुस्त करा किंवा 'केवळ वैध नोंदी जतन करा' निवडा.",
                            errorRow = idx,
                            errors = vItem?.Errors ?? new List<string> { "Invalid row" }
                        });
                    }
                    skippedCandidates.Add(row);
                }
            }

            if (validCandidates.Count == 0)
            {
                return BadRequest(new { message = "जतन करण्यासाठी एकही वैध ग्राहक सापडला नाही. कृपया आवश्यक फील्ड्स (पहिले नाव, आडनाव) तपासा." });
            }

            // Partition candidates into toInsert (new) and toUpdate (existing)
            var toInsert = validCandidates.Where(c => c.CustomerID <= 0).ToList();
            var toUpdate = validCandidates.Where(c => c.CustomerID > 0).ToList();

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // 1. Reserve CIF block for NEW customers
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

                // 2. Generate Batch Reference
                string batchNumber = $"CUST-BLK-{DateTime.UtcNow:yyyyMMdd}-{DateTime.UtcNow.Ticks % 10000:D4}";

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
                    MergedRecords = toUpdate.Count,
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

                    var cust = new Customer
                    {
                        BranchID = dto.BranchID.HasValue && dto.BranchID.Value > 0 ? dto.BranchID.Value : targetBranchId,
                        CIFNo = assignedCif,
                        FirstName = dto.FirstName.Trim(),
                        MiddleName = string.IsNullOrWhiteSpace(dto.MiddleName) ? null : dto.MiddleName.Trim(),
                        LastName = dto.LastName.Trim(),
                        FirstNameEng = string.IsNullOrWhiteSpace(dto.FirstNameEng) ? null : dto.FirstNameEng.Trim(),
                        MiddleNameEng = string.IsNullOrWhiteSpace(dto.MiddleNameEng) ? null : dto.MiddleNameEng.Trim(),
                        LastNameEng = string.IsNullOrWhiteSpace(dto.LastNameEng) ? null : dto.LastNameEng.Trim(),
                        MobileNo = string.IsNullOrWhiteSpace(dto.MobileNo) ? null : dto.MobileNo.Trim(),
                        AadhaarNo = string.IsNullOrWhiteSpace(dto.AadhaarNo) ? null : dto.AadhaarNo.Trim(),
                        PANNo = string.IsNullOrWhiteSpace(dto.PANNo) ? null : dto.PANNo.Trim().ToUpper(),
                        Gender = string.IsNullOrWhiteSpace(dto.Gender) ? "Male" : dto.Gender.Trim(),
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
                        HomeBranchID = targetBranchId,
                        ImportBatchID = batchRecord.BatchID,
                        Status = "Active",
                        IsDeleted = false,
                        IsMinor = dto.BirthDate.HasValue && dto.BirthDate.Value > DateTime.Today.AddYears(-18),
                        CreatedBy = userId,
                        CreatedOn = DateTime.UtcNow,
                        RegistrationDate = DateTime.Today
                    };

                    _context.Customers.Add(cust);
                }

                // 4. UPDATE Existing Customers
                if (toUpdate.Count > 0)
                {
                    var updateIds = toUpdate.Select(u => u.CustomerID).ToList();
                    var existingCustomers = await _context.Customers
                        .Where(c => updateIds.Contains(c.CustomerID))
                        .ToListAsync();

                    var existingMap = existingCustomers.ToDictionary(c => c.CustomerID);

                    foreach (var dto in toUpdate)
                    {
                        if (existingMap.TryGetValue(dto.CustomerID, out var existing))
                        {
                            existing.FirstName = dto.FirstName.Trim();
                            existing.MiddleName = string.IsNullOrWhiteSpace(dto.MiddleName) ? null : dto.MiddleName.Trim();
                            existing.LastName = dto.LastName.Trim();
                            existing.FirstNameEng = string.IsNullOrWhiteSpace(dto.FirstNameEng) ? null : dto.FirstNameEng.Trim();
                            existing.MiddleNameEng = string.IsNullOrWhiteSpace(dto.MiddleNameEng) ? null : dto.MiddleNameEng.Trim();
                            existing.LastNameEng = string.IsNullOrWhiteSpace(dto.LastNameEng) ? null : dto.LastNameEng.Trim();
                            existing.MobileNo = string.IsNullOrWhiteSpace(dto.MobileNo) ? null : dto.MobileNo.Trim();
                            existing.AadhaarNo = string.IsNullOrWhiteSpace(dto.AadhaarNo) ? null : dto.AadhaarNo.Trim();
                            existing.PANNo = string.IsNullOrWhiteSpace(dto.PANNo) ? null : dto.PANNo.Trim().ToUpper();
                            existing.Gender = string.IsNullOrWhiteSpace(dto.Gender) ? "Male" : dto.Gender.Trim();
                            existing.BirthDate = dto.BirthDate;
                            existing.IsMinor = dto.BirthDate.HasValue && dto.BirthDate.Value > DateTime.Today.AddYears(-18);
                            existing.Address = string.IsNullOrWhiteSpace(dto.Address) ? null : dto.Address.Trim();
                            existing.Village = string.IsNullOrWhiteSpace(dto.Village) ? null : dto.Village.Trim();
                            existing.Taluka = string.IsNullOrWhiteSpace(dto.Taluka) ? null : dto.Taluka.Trim();
                            existing.District = string.IsNullOrWhiteSpace(dto.District) ? null : dto.District.Trim();
                            existing.Occupation = string.IsNullOrWhiteSpace(dto.Occupation) ? null : dto.Occupation.Trim();
                            existing.CustomerType = string.IsNullOrWhiteSpace(dto.CustomerType) ? "Individual" : dto.CustomerType.Trim();
                            existing.KYCStatus = string.IsNullOrWhiteSpace(dto.KYCStatus) ? "Verified" : dto.KYCStatus.Trim();
                            existing.CKYCNo = string.IsNullOrWhiteSpace(dto.CKYCNo) ? null : dto.CKYCNo.Trim();
                            existing.RiskCategory = string.IsNullOrWhiteSpace(dto.RiskCategory) ? "Low" : dto.RiskCategory.Trim();
                            existing.Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim();
                            existing.NomineeName = string.IsNullOrWhiteSpace(dto.NomineeName) ? null : dto.NomineeName.Trim();
                            existing.NomineeRelation = string.IsNullOrWhiteSpace(dto.NomineeRelation) ? null : dto.NomineeRelation.Trim();
                            existing.LegacyCustomerNo = string.IsNullOrWhiteSpace(dto.LegacyCustomerNo) ? null : dto.LegacyCustomerNo.Trim();
                            existing.UpdatedBy = userId;
                            existing.UpdatedOn = DateTime.UtcNow;
                            // CIFNo, CustomerID, BranchID, MemberProfile, SavingAccounts remain strictly preserved
                        }
                    }
                }

                await _context.SaveChangesAsync();

                // Update batch timing
                sw.Stop();
                batchRecord.ExecutionTimeMs = sw.ElapsedMilliseconds;
                await _context.SaveChangesAsync();

                // General Audit Log
                _context.AuditLogs.Add(new AuditLog
                {
                    UserID = userId,
                    Username = username,
                    Action = "BULK_CUSTOMER_UPSERT",
                    EntityName = "Customer",
                    EntityID = batchRecord.BatchNumber,
                    Timestamp = DateTime.Now,
                    IPAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                    Details = $"बल्क ग्राहक: नवीन नोंदवले: {toInsert.Count}, अद्ययावत केले: {toUpdate.Count}. CIF Range: {startCif} ते {endCif}",
                    Status = "SUCCESS"
                });
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                string msg = "";
                if (toInsert.Count > 0 && toUpdate.Count > 0)
                {
                    msg = $"{toInsert.Count} नवीन ग्राहक नोंदवले व {toUpdate.Count} ग्राहक अद्ययावत केले (नवीन CIF: {startCif} ते {endCif}).";
                }
                else if (toInsert.Count > 0)
                {
                    msg = $"{toInsert.Count} नवीन ग्राहक यशस्वीरित्या जतन झाले (नवीन CIF: {startCif} ते {endCif}).";
                }
                else
                {
                    msg = $"{toUpdate.Count} ग्राहक यशस्वीरित्या अद्ययावत (Update) झाले.";
                }

                return Ok(new
                {
                    success = true,
                    batchNumber = batchRecord.BatchNumber,
                    totalProcessed = request.Customers.Count,
                    insertedCount = toInsert.Count,
                    updatedCount = toUpdate.Count,
                    importedCount = validCandidates.Count,
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
                // SQL Server atomic lock with UPDLOCK, ROWLOCK to guarantee zero duplicate CIF in concurrency
                seq = await _context.CifSequences
                    .FromSqlInterpolated($"SELECT * FROM CifSequences WITH (UPDLOCK, ROWLOCK) WHERE SequenceCode = 'CORE_CIF_SEQ'")
                    .FirstOrDefaultAsync();
            }
            catch
            {
                seq = await _context.CifSequences.FirstOrDefaultAsync(s => s.SequenceCode == "CORE_CIF_SEQ");
            }

            long maxExisting = 0;
            var latestCifs = await _context.Customers
                .AsNoTracking()
                .Where(c => c.CIFNo != null && c.CIFNo.StartsWith("CIF"))
                .OrderByDescending(c => c.CustomerID)
                .Take(50)
                .Select(c => c.CIFNo!)
                .ToListAsync();

            foreach (var c in latestCifs)
            {
                if (c.Length > 3 && long.TryParse(c.Substring(3), out long num) && num > maxExisting)
                {
                    maxExisting = num;
                }
            }

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
            var batches = await _context.CustomerImportBatches
                .AsNoTracking()
                .OrderByDescending(b => b.BatchID)
                .Take(limit)
                .ToListAsync();

            return Ok(batches);
        }
    }
}
