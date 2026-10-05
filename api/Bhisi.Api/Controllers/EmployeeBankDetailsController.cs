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
        }

        // GET: api/EmployeeBankDetails
        [HttpGet]
        public async Task<ActionResult<IEnumerable<EmployeeBankDetailDto>>> GetEmployeeBankDetails([FromQuery] int? branchId = null)
        {
            var query = _context.Customers.AsNoTracking().AsQueryable();
            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(c => c.BranchID == branchId.Value);
            }
            var customers = await query.OrderBy(c => c.CustomerID).ToListAsync();

            var bankDetails = await _context.EmployeeBankDetails.AsNoTracking().ToListAsync();

            var bankDict = bankDetails
                .Where(b => !string.IsNullOrEmpty(b.CIFNo))
                .GroupBy(b => b.CIFNo, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

            var result = customers.Select(c => {
                bankDict.TryGetValue(c.CIFNo, out var detail);

                string fullName = $"{c.FirstName} {c.MiddleName} {c.LastName}".Replace("  ", " ").Trim();

                return new EmployeeBankDetailDto
                {
                    EmployeeBankDetailID = detail?.EmployeeBankDetailID,
                    CustomerID = c.CustomerID,
                    CIFNo = c.CIFNo,
                    CustomerName = fullName,
                    EmployeeID = detail?.EmployeeID ?? "",
                    DepartmentID = detail?.DepartmentID,
                    JoiningDate = detail?.JoiningDate,
                    EmployeeStatus = detail?.EmployeeStatus ?? "Active",
                    MobileNumber = detail?.MobileNumber ?? c.MobileNo,
                    BankName = detail?.BankName ?? "",
                    IFSCCode = detail?.IFSCCode ?? "",
                    AccountNumber = detail?.AccountNumber ?? "",
                    AccountType = detail?.AccountType ?? "Savings",
                    BranchID = detail?.BranchID ?? c.BranchID
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
                // Ensure default BranchMaster and DepartmentMaster exist to satisfy FK constraints
                if (!await _context.BranchMasters.AnyAsync())
                {
                    var mainBranch = await _context.Branches.FirstOrDefaultAsync();
                    _context.BranchMasters.Add(new BranchMaster
                    {
                        BranchName = mainBranch?.BranchName ?? "मुख्य शाखा",
                        BranchCode = mainBranch?.BranchCode ?? "MAIN",
                        BranchType = "HeadOffice",
                        Address = mainBranch?.Address ?? "Head Office",
                        Status = true
                    });
                    await _context.SaveChangesAsync();
                }

                if (!await _context.DepartmentMasters.AnyAsync())
                {
                    _context.DepartmentMasters.Add(new DepartmentMaster
                    {
                        DepartmentName = "सामान्य प्रशासन",
                        DepartmentCode = "ADMIN",
                        Status = true
                    });
                    await _context.SaveChangesAsync();
                }

                // Fetch valid department and branch IDs to ensure FK constraint safety
                var validDeptIds = await _context.DepartmentMasters.Select(d => d.DepartmentID).ToListAsync();
                var validBranchIds = await _context.BranchMasters.Select(b => b.BranchID).ToListAsync();

                int defaultDeptId = validDeptIds.FirstOrDefault();
                int defaultBranchId = validBranchIds.FirstOrDefault();

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
                        var cust = await _context.Customers.FirstOrDefaultAsync(c => c.CustomerID == item.CustomerID);
                        if (cust != null && !string.IsNullOrEmpty(cust.CIFNo))
                        {
                            item.CIFNo = cust.CIFNo;
                        }
                        else
                        {
                            item.CIFNo = $"CIF{item.CustomerID:D6}";
                        }
                    }

                    // EmployeeID is UNIQUE in DB schema. Auto-generate if blank to avoid SQL index collision.
                    string empId = string.IsNullOrWhiteSpace(item.EmployeeID)
                        ? $"EMP{item.CustomerID:D6}"
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
                        // Check if another customer holds this EmployeeID
                        var isEmpIdTaken = await _context.EmployeeBankDetails
                            .AnyAsync(e => e.EmployeeID == empId && e.EmployeeBankDetailID != existing.EmployeeBankDetailID);
                        if (isEmpIdTaken)
                        {
                            empId = $"EMP{item.CustomerID:D6}";
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
                        // Check if another customer holds this EmployeeID
                        var isEmpIdTaken = await _context.EmployeeBankDetails.AnyAsync(e => e.EmployeeID == empId);
                        if (isEmpIdTaken)
                        {
                            empId = $"EMP{item.CustomerID:D6}";
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
                    Details = $"Bulk updated bank & department details for {savedCount} customers/employees (खातेदार/कर्मचारी बँक तपशील)."
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
