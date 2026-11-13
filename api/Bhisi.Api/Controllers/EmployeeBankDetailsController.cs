using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Helpers;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class EmployeeBankDetailsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private static readonly Regex IfscRegex = new(@"^[A-Z]{4}0[A-Z0-9]{6}$", RegexOptions.Compiled);
        private static readonly Regex AccountNoRegex = new(@"^[A-Za-z0-9]{8,20}$", RegexOptions.Compiled);

        public EmployeeBankDetailsController(AppDbContext context)
        {
            _context = context;
        }

        public class EmployeeBankDetailDto
        {
            public int? EmployeeBankDetailID { get; set; }
            public int CustomerID { get; set; }
            public string CIFNo { get; set; } = string.Empty;
            public string CustomerName { get; set; } = string.Empty;
            public string EmployeeID { get; set; } = string.Empty;
            public int? DepartmentID { get; set; }
            public DateTime? JoiningDate { get; set; }
            public string EmployeeStatus { get; set; } = "Active";
            public string? MobileNumber { get; set; }
            public string BankName { get; set; } = string.Empty;
            public string IFSCCode { get; set; } = string.Empty;
            public string AccountNumber { get; set; } = string.Empty;
            public string AccountType { get; set; } = "Savings";
            public int? BranchID { get; set; }
            public int? CustomerBranchID { get; set; }
        }

        // GET: api/EmployeeBankDetails
        [HttpGet]
        public async Task<ActionResult<IEnumerable<EmployeeBankDetailDto>>> GetEmployeeBankDetails([FromQuery] int? branchId = null)
        {
            int? effectiveBranchId = User.ResolveOptionalBranchId(branchId);

            var query = _context.Customers.AsNoTracking().AsQueryable();
            if (effectiveBranchId.HasValue && effectiveBranchId.Value > 0)
            {
                query = query.Where(c => c.BranchID == effectiveBranchId.Value);
            }

            var customers = await query
                .OrderBy(c => c.CustomerID)
                .Select(c => new
                {
                    c.CustomerID,
                    c.CIFNo,
                    c.FirstName,
                    c.MiddleName,
                    c.LastName,
                    c.MobileNo,
                    c.BranchID
                })
                .ToListAsync();

            var bankDetails = await _context.EmployeeBankDetails.AsNoTracking().ToListAsync();

            var bankDict = bankDetails
                .Where(b => !string.IsNullOrWhiteSpace(b.CIFNo))
                .GroupBy(b => b.CIFNo.Trim(), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

            var result = customers.Select(c =>
            {
                string rawCif = c.CIFNo?.Trim() ?? string.Empty;
                string fallbackCif = $"CIF{c.CustomerID:D6}";
                string displayCif = string.IsNullOrEmpty(rawCif) ? fallbackCif : rawCif;

                EmployeeBankDetail? detail = null;
                if (!string.IsNullOrEmpty(rawCif))
                {
                    bankDict.TryGetValue(rawCif, out detail);
                }
                if (detail == null)
                {
                    bankDict.TryGetValue(fallbackCif, out detail);
                }

                string fullName = string.Join(" ",
                    new[] { c.FirstName, c.MiddleName, c.LastName }
                        .Where(s => !string.IsNullOrWhiteSpace(s))
                        .Select(s => s!.Trim()));

                return new EmployeeBankDetailDto
                {
                    EmployeeBankDetailID = detail?.EmployeeBankDetailID,
                    CustomerID = c.CustomerID,
                    CIFNo = displayCif,
                    CustomerName = fullName,
                    EmployeeID = detail?.EmployeeID ?? string.Empty,
                    DepartmentID = detail?.DepartmentID,
                    JoiningDate = detail?.JoiningDate,
                    EmployeeStatus = detail?.EmployeeStatus ?? "Active",
                    MobileNumber = detail?.MobileNumber ?? c.MobileNo,
                    BankName = detail?.BankName ?? string.Empty,
                    IFSCCode = detail?.IFSCCode ?? string.Empty,
                    AccountNumber = detail?.AccountNumber ?? string.Empty,
                    AccountType = detail?.AccountType ?? "Savings",
                    BranchID = detail?.BranchID,
                    CustomerBranchID = c.BranchID
                };
            }).ToList();

            return Ok(result);
        }

        // POST: api/EmployeeBankDetails/bulk-upsert
        [HttpPost("bulk-upsert")]
        public async Task<IActionResult> BulkUpsert([FromBody] List<EmployeeBankDetailDto> data)
        {
            if (data == null || data.Count == 0)
            {
                return BadRequest(new { message = "सेव्ह करण्यासाठी कोणताही डेटा प्राप्त झाला नाही." });
            }

            int currentUserId = User.GetUserId();
            string currentUsername = User?.Identity?.Name ?? "SystemAdmin";
            string? ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
            bool isHoAdmin = User.IsHeadOfficeAdmin();
            int operatingBranchId = User.GetOperatingBranchId();

            var customerIds = data.Select(d => d.CustomerID).Distinct().ToList();
            var customersById = await _context.Customers
                .Where(c => customerIds.Contains(c.CustomerID))
                .ToDictionaryAsync(c => c.CustomerID);

            foreach (var item in data)
            {
                if (!customersById.TryGetValue(item.CustomerID, out var cust))
                {
                    return BadRequest(new { message = $"खातेदार क्रमांक {item.CustomerID} सिस्टममध्ये आढळला नाही." });
                }

                if (!isHoAdmin && cust.BranchID != operatingBranchId)
                {
                    return StatusCode(403, new { message = $"खातेदार '{item.CustomerName}' आपल्या शाखेतील नसल्यामुळे माहिती अद्यतनित करण्याची परवानगी नाही." });
                }
            }

            var validDeptIds = await _context.DepartmentMasters.Select(d => d.DepartmentID).ToHashSetAsync();
            var validBranchIds = await _context.BranchMasters.Select(b => b.BranchID).ToHashSetAsync();

            // Validate duplicate non-empty Employee IDs within payload (trimmed, case-insensitive)
            var payloadEmpIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var payloadBankAccounts = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var item in data)
            {
                string empIdInput = item.EmployeeID?.Trim() ?? string.Empty;
                string bankName = item.BankName?.Trim() ?? string.Empty;
                string ifsc = item.IFSCCode?.Trim().ToUpperInvariant() ?? string.Empty;
                string accNo = item.AccountNumber?.Trim() ?? string.Empty;
                string mobile = item.MobileNumber?.Trim() ?? string.Empty;
                string custLabel = string.IsNullOrWhiteSpace(item.CustomerName) ? $"CIF {item.CIFNo}" : item.CustomerName;

                bool hasInfo = !string.IsNullOrEmpty(empIdInput) ||
                               !string.IsNullOrEmpty(bankName) ||
                               !string.IsNullOrEmpty(ifsc) ||
                               !string.IsNullOrEmpty(accNo) ||
                               item.DepartmentID.HasValue ||
                               item.BranchID.HasValue ||
                               item.JoiningDate.HasValue;

                if (!hasInfo)
                {
                    continue;
                }

                if (empIdInput.Length > 50)
                    return BadRequest(new { message = $"{custLabel}: कर्मचारी आयडी कमाल ५० अक्षरांपर्यंत असावा." });
                if (bankName.Length > 100)
                    return BadRequest(new { message = $"{custLabel}: बँकेचे नाव कमाल १०० अक्षरांपर्यंत असावे." });
                if (ifsc.Length > 20)
                    return BadRequest(new { message = $"{custLabel}: IFSC कोड कमाल २० अक्षरांपर्यंत असावा." });
                if (accNo.Length > 50)
                    return BadRequest(new { message = $"{custLabel}: खाते क्रमांक कमाल ५० अक्षरांपर्यंत असावा." });
                if (mobile.Length > 15)
                    return BadRequest(new { message = $"{custLabel}: मोबाईल क्रमांक कमाल १५ अंकांपर्यंत असावा." });

                if (!string.IsNullOrEmpty(empIdInput) && !payloadEmpIds.Add(empIdInput))
                {
                    return BadRequest(new { message = $"ड्युप्लिकेट कर्मचारी आयडी '{empIdInput}' आढळला आहे! कृपया प्रत्येक कर्मचाऱ्यासाठी एकमेव आयडी टाका." });
                }

                bool hasAnyBankField = !string.IsNullOrEmpty(bankName) || !string.IsNullOrEmpty(ifsc) || !string.IsNullOrEmpty(accNo);
                if (hasAnyBankField)
                {
                    if (string.IsNullOrEmpty(bankName) || string.IsNullOrEmpty(ifsc) || string.IsNullOrEmpty(accNo))
                    {
                        return BadRequest(new { message = $"{custLabel}: बँक तपशील अपूर्ण आहे. बँकेचे नाव, IFSC कोड आणि खाते क्रमांक हे तिन्ही अनिवार्य आहेत." });
                    }
                    if (!IfscRegex.IsMatch(ifsc))
                    {
                        return BadRequest(new { message = $"{custLabel}: IFSC कोड '{ifsc}' अवैध आहे. मानक ११-अक्षरी फॉरमॅट (उदा. SBIN0001234) वापरा." });
                    }
                    if (!AccountNoRegex.IsMatch(accNo))
                    {
                        return BadRequest(new { message = $"{custLabel}: खाते क्रमांक '{accNo}' अवैध आहे (८ ते २० अंक/अक्षरे असावीत, स्पेस नको)." });
                    }

                    string bankAccKey = $"{bankName.ToUpperInvariant()}::{accNo.ToUpperInvariant()}";
                    if (!payloadBankAccounts.Add(bankAccKey))
                    {
                        return BadRequest(new { message = $"बँक '{bankName}' चा खाते क्रमांक '{accNo}' एकापेक्षा जास्त खातेदारांसाठी वापरला गेला आहे." });
                    }
                }

                if (item.DepartmentID.HasValue && !validDeptIds.Contains(item.DepartmentID.Value))
                {
                    return BadRequest(new { message = $"{custLabel}: निवडलेला विभाग वैध नाही. कृपया पृष्ठ रीफ्रेश करून पुन्हा निवडा." });
                }

                if (item.BranchID.HasValue && !validBranchIds.Contains(item.BranchID.Value))
                {
                    return BadRequest(new { message = $"{custLabel}: निवडलेली कंपनी शाखा वैध नाही. कृपया पृष्ठ रीफ्रेश करून पुन्हा निवडा." });
                }
            }

            // Load existing rows once for fast, conflict-safe DB validation
            var allExistingDetails = await _context.EmployeeBankDetails.ToListAsync();

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                int savedCount = 0;
                foreach (var item in data)
                {
                    string bankName = item.BankName?.Trim() ?? string.Empty;
                    string ifsc = item.IFSCCode?.Trim().ToUpperInvariant() ?? string.Empty;
                    string accNo = item.AccountNumber?.Trim() ?? string.Empty;
                    string empIdInput = item.EmployeeID?.Trim() ?? string.Empty;

                    bool hasInfo = !string.IsNullOrEmpty(empIdInput) ||
                                   !string.IsNullOrEmpty(bankName) ||
                                   !string.IsNullOrEmpty(ifsc) ||
                                   !string.IsNullOrEmpty(accNo) ||
                                   item.DepartmentID.HasValue ||
                                   item.BranchID.HasValue ||
                                   item.JoiningDate.HasValue;

                    var cust = customersById[item.CustomerID];
                    string resolvedCif = !string.IsNullOrWhiteSpace(cust.CIFNo)
                        ? cust.CIFNo.Trim()
                        : (!string.IsNullOrWhiteSpace(item.CIFNo) ? item.CIFNo.Trim() : $"CIF{item.CustomerID:D6}");
                    string custLabel = string.IsNullOrWhiteSpace(item.CustomerName) ? resolvedCif : item.CustomerName;

                    var existing = allExistingDetails.FirstOrDefault(e =>
                        e.CIFNo.Equals(resolvedCif, StringComparison.OrdinalIgnoreCase) ||
                        (item.EmployeeBankDetailID.HasValue && e.EmployeeBankDetailID == item.EmployeeBankDetailID.Value));

                    if (!hasInfo)
                    {
                        // Do not auto-create rows for untouched/blank customers
                        continue;
                    }

                    // Determine final EmployeeID (UNIQUE in DB schema). Never silently overwrite a user-entered duplicate!
                    string empId;
                    if (!string.IsNullOrEmpty(empIdInput))
                    {
                        empId = empIdInput;
                    }
                    else if (existing != null && !string.IsNullOrWhiteSpace(existing.EmployeeID))
                    {
                        empId = existing.EmployeeID;
                    }
                    else
                    {
                        empId = $"EMP{item.CustomerID:D6}";
                    }

                    // Check EmployeeID uniqueness across DB (excluding self)
                    var empIdConflict = allExistingDetails.FirstOrDefault(e =>
                        e.EmployeeID.Equals(empId, StringComparison.OrdinalIgnoreCase) &&
                        (existing == null || e.EmployeeBankDetailID != existing.EmployeeBankDetailID));

                    if (empIdConflict != null)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new
                        {
                            message = $"{custLabel}: कर्मचारी आयडी '{empId}' आधीच दुसऱ्या खातेदारासाठी ({empIdConflict.CIFNo}) नोंदवलेला आहे. कृपया वेगळा आयडी द्या."
                        });
                    }

                    // Check Bank + AccountNumber uniqueness across DB (excluding self)
                    if (!string.IsNullOrEmpty(accNo))
                    {
                        var accConflict = allExistingDetails.FirstOrDefault(e =>
                            !string.IsNullOrWhiteSpace(e.AccountNumber) &&
                            e.AccountNumber.Trim().Equals(accNo, StringComparison.OrdinalIgnoreCase) &&
                            e.BankName.Trim().Equals(bankName, StringComparison.OrdinalIgnoreCase) &&
                            (existing == null || e.EmployeeBankDetailID != existing.EmployeeBankDetailID));

                        if (accConflict != null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(new
                            {
                                message = $"{custLabel}: बँक '{bankName}' चा खाते क्रमांक '{accNo}' आधीच दुसऱ्या खातेदाराकडे ({accConflict.CIFNo}) नोंदवलेला आहे."
                            });
                        }
                    }

                    string nextStatus = string.IsNullOrWhiteSpace(item.EmployeeStatus) ? "Active" : item.EmployeeStatus.Trim();
                    string nextAccountType = string.IsNullOrWhiteSpace(item.AccountType) ? "Savings" : item.AccountType.Trim();
                    string? nextMobile = string.IsNullOrWhiteSpace(item.MobileNumber) ? null : item.MobileNumber.Trim();

                    if (existing != null)
                    {
                        bool changed =
                            !string.Equals(existing.EmployeeID, empId, StringComparison.Ordinal) ||
                            existing.DepartmentID != item.DepartmentID ||
                            existing.JoiningDate != item.JoiningDate ||
                            !string.Equals(existing.EmployeeStatus, nextStatus, StringComparison.Ordinal) ||
                            !string.Equals(existing.MobileNumber ?? "", nextMobile ?? "", StringComparison.Ordinal) ||
                            !string.Equals(existing.BankName, bankName, StringComparison.Ordinal) ||
                            !string.Equals(existing.IFSCCode, ifsc, StringComparison.Ordinal) ||
                            !string.Equals(existing.AccountNumber, accNo, StringComparison.Ordinal) ||
                            !string.Equals(existing.AccountType, nextAccountType, StringComparison.Ordinal) ||
                            existing.BranchID != item.BranchID;

                        if (!changed)
                        {
                            continue;
                        }

                        existing.EmployeeID = empId;
                        existing.DepartmentID = item.DepartmentID;
                        existing.JoiningDate = item.JoiningDate;
                        existing.EmployeeStatus = nextStatus;
                        existing.MobileNumber = nextMobile;
                        existing.BankName = bankName;
                        existing.IFSCCode = ifsc;
                        existing.AccountNumber = accNo;
                        existing.AccountType = nextAccountType;
                        existing.BranchID = item.BranchID;
                        existing.ModifiedBy = currentUserId > 0 ? currentUserId : existing.ModifiedBy;
                        existing.ModifiedDate = DateTime.Now;
                        _context.EmployeeBankDetails.Update(existing);
                    }
                    else
                    {
                        var newDetail = new EmployeeBankDetail
                        {
                            CIFNo = resolvedCif,
                            EmployeeID = empId,
                            DepartmentID = item.DepartmentID,
                            JoiningDate = item.JoiningDate,
                            EmployeeStatus = nextStatus,
                            MobileNumber = nextMobile,
                            BankName = bankName,
                            IFSCCode = ifsc,
                            AccountNumber = accNo,
                            AccountType = nextAccountType,
                            BranchID = item.BranchID,
                            CreatedBy = currentUserId > 0 ? currentUserId : null,
                            CreatedDate = DateTime.Now
                        };
                        _context.EmployeeBankDetails.Add(newDetail);
                        allExistingDetails.Add(newDetail);
                    }

                    savedCount++;
                }

                if (savedCount == 0)
                {
                    await transaction.RollbackAsync();
                    return Ok(new { message = "कोणताही नवीन बदल आढळला नाही.", savedCount = 0 });
                }

                await _context.SaveChangesAsync();

                // Core Banking Audit Log Entry
                var auditLog = new AuditLog
                {
                    UserID = currentUserId > 0 ? currentUserId : null,
                    Username = currentUsername,
                    IPAddress = ipAddress,
                    Action = "UPDATE_EMPLOYEE_BANK_DETAILS",
                    EntityName = "EmployeeBankDetail",
                    EntityID = "BULK_UPSERT",
                    Status = "Success",
                    Timestamp = DateTime.Now,
                    Details = $"Updated bank & employee details for {savedCount} customers/employees (खातेदार/कर्मचारी बँक तपशील)."
                };
                _context.AuditLogs.Add(auditLog);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                return Ok(new { message = $"{savedCount} खातेदार/कर्मचाऱ्यांची बँक व विभाग माहिती यशस्वीरित्या सेव्ह झाली!", savedCount });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "माहिती सेव्ह करताना त्रुटी आली. कृपया सर्व्हर कनेक्शन तपासा.", error = ex.Message });
            }
        }
    }
}
