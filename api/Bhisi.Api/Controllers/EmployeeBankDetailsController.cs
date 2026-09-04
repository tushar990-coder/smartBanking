using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class EmployeeBankDetailsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public EmployeeBankDetailsController(AppDbContext context)
        {
            _context = context;
        }

        public class EmployeeBankDetailDto
        {
            public int? EmployeeBankDetailID { get; set; }
            public int MemberID { get; set; }
            public string CIFNo { get; set; } = string.Empty;
            public string MemberName { get; set; } = string.Empty;
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
        }

        // GET: api/EmployeeBankDetails
        [HttpGet]
        public async Task<ActionResult<IEnumerable<EmployeeBankDetailDto>>> GetEmployeeBankDetails()
        {
            var members = await _context.Members.Where(m => m.Status == "Active").OrderBy(m => m.MemberID).ToListAsync();
            var bankDetails = await _context.EmployeeBankDetails.ToListAsync();

            // Find current max valid CIF number <= 600 (last valid ID before 678 jump was 107)
            int maxCif = 107;
            foreach (var m in members)
            {
                if (!string.IsNullOrWhiteSpace(m.CIFNo))
                {
                    var digits = new string(m.CIFNo.Where(char.IsDigit).ToArray());
                    if (int.TryParse(digits, out int num) && num <= 600 && num > maxCif)
                    {
                        maxCif = num;
                    }
                }
            }

            bool hasChanges = false;
            foreach (var m in members)
            {
                bool isInvalid = string.IsNullOrWhiteSpace(m.CIFNo) || 
                                 (int.TryParse(new string(m.CIFNo.Where(char.IsDigit).ToArray()), out int n) && n > 600);

                if (isInvalid)
                {
                    maxCif++;
                    m.CIFNo = $"CIF{maxCif:D6}";
                    _context.Members.Update(m);
                    hasChanges = true;
                }
            }

            if (hasChanges)
            {
                await _context.SaveChangesAsync();
            }

            var result = members.Select(m => {
                var detail = bankDetails.FirstOrDefault(b => b.CIFNo == m.CIFNo);
                return new EmployeeBankDetailDto
                {
                    EmployeeBankDetailID = detail?.EmployeeBankDetailID,
                    MemberID = m.MemberID,
                    CIFNo = m.CIFNo ?? $"CIF{m.MemberID:D6}",
                    MemberName = $"{m.FirstName} {m.MiddleName} {m.LastName}".Replace("  ", " ").Trim(),
                    EmployeeID = detail?.EmployeeID ?? "",
                    DepartmentID = detail?.DepartmentID,
                    JoiningDate = detail?.JoiningDate,
                    EmployeeStatus = detail?.EmployeeStatus ?? "Active",
                    MobileNumber = detail?.MobileNumber ?? m.MobileNo,
                    BankName = detail?.BankName ?? "",
                    IFSCCode = detail?.IFSCCode ?? "",
                    AccountNumber = detail?.AccountNumber ?? "",
                    AccountType = detail?.AccountType ?? "Savings",
                    BranchID = detail?.BranchID
                };
            }).ToList();

            return Ok(result);
        }

        // POST: api/EmployeeBankDetails/bulk-upsert
        [HttpPost("bulk-upsert")]
        public async Task<IActionResult> BulkUpsert([FromBody] List<EmployeeBankDetailDto> data)
        {
            if (data == null || !data.Any())
            {
                return BadRequest(new { message = "सेव्ह करण्यासाठी कोणताही डेटा प्राप्त झाला नाही." });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Fetch valid department and branch IDs to ensure FK constraint safety
                var validDeptIds = await _context.DepartmentMasters.Select(d => d.DepartmentID).ToListAsync();
                var validBranchIds = await _context.BranchMasters.Select(b => b.BranchID).ToListAsync();

                int defaultDeptId = validDeptIds.FirstOrDefault(1);
                int defaultBranchId = validBranchIds.FirstOrDefault(1);

                // Validate duplicate non-empty Employee IDs in incoming request
                var nonBlankEmpIds = data
                    .Where(d => !string.IsNullOrWhiteSpace(d.EmployeeID))
                    .Select(d => d.EmployeeID.Trim())
                    .ToList();

                if (nonBlankEmpIds.Count != nonBlankEmpIds.Distinct(StringComparer.OrdinalIgnoreCase).Count())
                {
                    return BadRequest(new { message = "ड्युप्लिकेट कर्मचारी आयडी (Duplicate Employee ID) आढळला आहे! कृपया प्रत्येक कर्मचाऱ्यासाठी एकमेव आयडी टाका." });
                }

                int savedCount = 0;
                foreach (var item in data)
                {
                    // Skip completely empty rows where no employee or bank info is provided
                    bool hasInfo = !string.IsNullOrWhiteSpace(item.EmployeeID) ||
                                   !string.IsNullOrWhiteSpace(item.BankName) ||
                                   !string.IsNullOrWhiteSpace(item.AccountNumber) ||
                                   item.DepartmentID.HasValue ||
                                   item.BranchID.HasValue;

                    if (!hasInfo)
                        continue;

                    // Ensure CIFNo is assigned
                    if (string.IsNullOrEmpty(item.CIFNo))
                    {
                        var member = await _context.Members.FindAsync(item.MemberID);
                        if (member != null)
                        {
                            item.CIFNo = MembersController.GenerateCifNo(member);
                            member.CIFNo = item.CIFNo;
                            _context.Members.Update(member);
                        }
                        else
                        {
                            item.CIFNo = $"CIF{item.MemberID:D6}";
                        }
                    }

                    // EmployeeID is UNIQUE in DB schema. Auto-generate if blank to avoid SQL index collision.
                    string empId = string.IsNullOrWhiteSpace(item.EmployeeID)
                        ? $"EMP{item.MemberID:D6}"
                        : item.EmployeeID.Trim();

                    // Ensure valid Foreign Keys
                    int deptId = (item.DepartmentID.HasValue && validDeptIds.Contains(item.DepartmentID.Value))
                        ? item.DepartmentID.Value
                        : defaultDeptId;

                    int branchId = (item.BranchID.HasValue && validBranchIds.Contains(item.BranchID.Value))
                        ? item.BranchID.Value
                        : defaultBranchId;

                    var existing = await _context.EmployeeBankDetails.FirstOrDefaultAsync(e => e.CIFNo == item.CIFNo);

                    if (existing != null)
                    {
                        // Check if another member holds this EmployeeID
                        var isEmpIdTaken = await _context.EmployeeBankDetails
                            .AnyAsync(e => e.EmployeeID == empId && e.EmployeeBankDetailID != existing.EmployeeBankDetailID);
                        if (isEmpIdTaken)
                        {
                            empId = $"EMP{item.MemberID:D6}";
                        }

                        // Update
                        existing.EmployeeID = empId;
                        existing.DepartmentID = deptId;
                        existing.JoiningDate = item.JoiningDate ?? DateTime.Today;
                        existing.EmployeeStatus = item.EmployeeStatus ?? "Active";
                        existing.MobileNumber = item.MobileNumber;
                        existing.BankName = item.BankName ?? "";
                        existing.IFSCCode = item.IFSCCode?.Trim().ToUpper() ?? "";
                        existing.AccountNumber = item.AccountNumber?.Trim() ?? "";
                        existing.AccountType = item.AccountType ?? "Savings";
                        existing.BranchID = branchId;
                        existing.ModifiedDate = DateTime.Now;
                        _context.EmployeeBankDetails.Update(existing);
                    }
                    else
                    {
                        // Check if another member holds this EmployeeID
                        var isEmpIdTaken = await _context.EmployeeBankDetails.AnyAsync(e => e.EmployeeID == empId);
                        if (isEmpIdTaken)
                        {
                            empId = $"EMP{item.MemberID:D6}";
                        }

                        // Insert
                        var newDetail = new EmployeeBankDetail
                        {
                            CIFNo = item.CIFNo,
                            EmployeeID = empId,
                            DepartmentID = deptId,
                            JoiningDate = item.JoiningDate ?? DateTime.Today,
                            EmployeeStatus = item.EmployeeStatus ?? "Active",
                            MobileNumber = item.MobileNumber,
                            BankName = item.BankName ?? "",
                            IFSCCode = item.IFSCCode?.Trim().ToUpper() ?? "",
                            AccountNumber = item.AccountNumber?.Trim() ?? "",
                            AccountType = item.AccountType ?? "Savings",
                            BranchID = branchId,
                            CreatedDate = DateTime.Now
                        };
                        _context.EmployeeBankDetails.Add(newDetail);
                    }

                    savedCount++;
                }

                await _context.SaveChangesAsync();

                // Core Banking Audit Log Entry
                var auditLog = new AuditLog
                {
                    Username = User?.Identity?.Name ?? "SystemAdmin",
                    Action = "UPDATE_EMPLOYEE_BANK_DETAILS",
                    EntityName = "EmployeeBankDetail",
                    EntityID = "BULK_UPSERT",
                    Status = "SUCCESS",
                    Timestamp = DateTime.Now,
                    Details = $"Bulk updated bank & department details for {savedCount} member-employees (सभासद कर्मचारी)."
                };
                _context.AuditLogs.Add(auditLog);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                return Ok(new { message = "कर्मचारी बँक व विभाग माहिती यशस्वीरित्या सेव्ह झाली!", savedCount });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "माहिती सेव्ह करताना त्रुटी आली. कृपया सर्व्हर कनेक्शन तपासा.", error = ex.Message });
            }
        }
    }
}
