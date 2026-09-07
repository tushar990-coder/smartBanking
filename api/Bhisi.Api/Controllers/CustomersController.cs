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
    public class CustomersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CustomersController(AppDbContext context)
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
                    EntityName = "Customer",
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

        // GET: api/Customers
        [AllowAnonymous]
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Customer>>> GetCustomers(
            [FromQuery] int? branchId = null,
            [FromQuery] string? status = null,
            [FromQuery] string? search = null,
            [FromQuery] int? page = null,
            [FromQuery] int? pageSize = null)
        {
            try
            {
                // Self-healing check: automatically fix any legacy or errant CustomerID = 0 records
                if (await _context.Customers.AnyAsync(c => c.CustomerID == 0))
                {
                    await HarmonizeCifs();
                }

                var (_, _, userBranchId, _, isHeadOfficeAdmin) = GetCurrentUserContext();
                var query = _context.Customers
                    .AsNoTracking()
                    .Include(c => c.Branch)
                    .OrderBy(c => c.CustomerID)
                    .AsQueryable();

                if (!isHeadOfficeAdmin)
                {
                    query = query.Where(c => c.BranchID == userBranchId);
                }
                else if (branchId.HasValue && branchId.Value > 0)
                {
                    query = query.Where(c => c.BranchID == branchId.Value);
                }

                if (!string.IsNullOrWhiteSpace(status) && status != "सर्व" && status != "All")
                {
                    query = query.Where(c => c.Status == status);
                }

                if (!string.IsNullOrWhiteSpace(search))
                {
                    string s = search.Trim().ToLower();
                    query = query.Where(c => c.FirstName.ToLower().Contains(s) || 
                                             c.LastName.ToLower().Contains(s) || 
                                             (c.CIFNo != null && c.CIFNo.ToLower().Contains(s)) ||
                                             (c.MobileNo != null && c.MobileNo.Contains(s)) ||
                                             (c.AadhaarNo != null && c.AadhaarNo.Contains(s)));
                }

                if (page.HasValue || pageSize.HasValue)
                {
                    int p = page ?? 1;
                    int ps = pageSize ?? 50;
                    if (p < 1) p = 1;
                    if (ps < 1 || ps > 500) ps = 50;
                    query = query.Skip((p - 1) * ps).Take(ps);
                }

                var customers = await query
                    .Select(c => new Customer
                    {
                        CustomerID = c.CustomerID,
                        BranchID = c.BranchID,
                        Branch = c.Branch != null ? new Branch
                        {
                            BranchID = c.Branch.BranchID,
                            BranchCode = c.Branch.BranchCode,
                            BranchName = c.Branch.BranchName,
                            BranchType = c.Branch.BranchType,
                            Address = c.Branch.Address,
                            MobileNo = c.Branch.MobileNo,
                            Email = c.Branch.Email,
                            IsActive = c.Branch.IsActive
                        } : null,
                        CIFNo = c.CIFNo ?? string.Empty,
                        FirstName = c.FirstName ?? string.Empty,
                        MiddleName = c.MiddleName ?? string.Empty,
                        LastName = c.LastName ?? string.Empty,
                        NickName = c.NickName ?? string.Empty,
                        FirstNameEng = c.FirstNameEng ?? string.Empty,
                        MiddleNameEng = c.MiddleNameEng ?? string.Empty,
                        LastNameEng = c.LastNameEng ?? string.Empty,
                        Address = c.Address ?? string.Empty,
                        AddressEng = c.AddressEng ?? string.Empty,
                        Village = c.Village ?? string.Empty,
                        Taluka = c.Taluka ?? string.Empty,
                        District = c.District ?? string.Empty,
                        MobileNo = c.MobileNo ?? string.Empty,
                        AadhaarNo = c.AadhaarNo ?? string.Empty,
                        PANNo = c.PANNo ?? string.Empty,
                        RegistrationDate = c.RegistrationDate,
                        NomineeName = c.NomineeName ?? string.Empty,
                        NomineeNameEng = c.NomineeNameEng ?? string.Empty,
                        NomineeRelation = c.NomineeRelation ?? string.Empty,
                        NomineeAddress = c.NomineeAddress ?? string.Empty,
                        NomineeBirthDate = c.NomineeBirthDate,
                        NomineeIsMinor = c.NomineeIsMinor,
                        NomineeGuardianName = c.NomineeGuardianName ?? string.Empty,
                        Status = c.Status ?? "Active",
                        Gender = c.Gender ?? string.Empty,
                        BirthDate = c.BirthDate,
                        Occupation = c.Occupation ?? string.Empty,
                        CasteCategory = c.CasteCategory ?? string.Empty,
                        Caste = c.Caste ?? string.Empty,
                        Email = c.Email ?? string.Empty,
                        IsMinor = c.IsMinor,
                        GuardianName = c.GuardianName ?? string.Empty,
                        GuardianNameEng = c.GuardianNameEng ?? string.Empty,
                        GuardianRelation = c.GuardianRelation ?? string.Empty,
                        GuardianAadhaarNo = c.GuardianAadhaarNo ?? string.Empty,
                        GuardianMobileNo = c.GuardianMobileNo ?? string.Empty,
                        GuardianAddress = c.GuardianAddress ?? string.Empty,
                        LegacyCustomerNo = c.LegacyCustomerNo ?? string.Empty,
                        EmployerId = c.EmployerId,
                        IsDeleted = c.IsDeleted,
                        CreatedBy = c.CreatedBy,
                        CreatedOn = c.CreatedOn,
                        UpdatedBy = c.UpdatedBy,
                        UpdatedOn = c.UpdatedOn,
                        MemberProfile = c.MemberProfile != null ? new Member
                        {
                            MemberID = c.MemberProfile.MemberID,
                            MemberCode = c.MemberProfile.MemberCode,
                            LegacyMemberNo = c.MemberProfile.LegacyMemberNo,
                            MembershipType = c.MemberProfile.MembershipType
                        } : null
                    })
                    .ToListAsync();

                return customers;
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "ग्राहक माहिती लोड करताना त्रुटी आली (Error loading customers)",
                    detail = ex.Message
                });
            }
        }

        // GET: api/Customers/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Customer>> GetCustomer(int id)
        {
            var (_, _, userBranchId, _, isHeadOfficeAdmin) = GetCurrentUserContext();
            var customer = await _context.Customers.Include(c => c.Branch).Include(c => c.MemberProfile).FirstOrDefaultAsync(c => c.CustomerID == id);

            if (customer == null)
            {
                return NotFound();
            }

            if (!isHeadOfficeAdmin && customer.BranchID != userBranchId)
            {
                return StatusCode(403, new { message = "आपल्याला इतर शाखेतील ग्राहकांची माहिती पाहण्याची परवानगी नाही." });
            }

            return customer;
        }

        [NonAction]
        public async Task<string> GenerateUniqueCifAsync()
        {
            try
            {
                var maxCustomerId = await _context.Customers
                    .AsNoTracking()
                    .MaxAsync(c => (int?)c.CustomerID) ?? 0;

                var allCifsInDb = await _context.Customers
                    .AsNoTracking()
                    .Where(c => c.CIFNo != null && c.CIFNo != "")
                    .Select(c => c.CIFNo!)
                    .ToListAsync();

                int maxNumericCif = 0;
                foreach (var cif in allCifsInDb)
                {
                    if (cif.StartsWith("CIF", StringComparison.OrdinalIgnoreCase) &&
                        int.TryParse(cif.Substring(3), out int parsed) && parsed > maxNumericCif)
                    {
                        maxNumericCif = parsed;
                    }
                }

                int candidateNum = Math.Max(maxCustomerId, maxNumericCif) + 1;
                if (candidateNum < 1) candidateNum = 1;
                string candidateCif = $"CIF{candidateNum:D6}";

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

        // GET: api/Customers/next-cif
        [AllowAnonymous]
        [HttpGet("next-cif")]
        public async Task<IActionResult> GetNextCifNo()
        {
            var totalActive = await _context.Customers.CountAsync();
            string candidateCif = await GenerateUniqueCifAsync();
            return Ok(new { 
                nextCifNo = candidateCif, 
                cifNo = candidateCif,
                totalActiveCustomers = totalActive
            });
        }

        // POST: api/Customers/harmonize-cifs
        [HttpPost("harmonize-cifs")]
        public async Task<IActionResult> HarmonizeCifs()
        {
            try
            {
                // Execute direct atomic SQL update for high performance and zero timeout
                string sql = @"
                    IF EXISTS (SELECT 1 FROM [Customers] WHERE [CustomerID] = 0)
                    BEGIN
                        DECLARE @TargetCustId INT = 1;
                        IF EXISTS (SELECT 1 FROM [Customers] WHERE [CustomerID] = 1)
                            SET @TargetCustId = (SELECT ISNULL(MAX([CustomerID]), 1) + 1 FROM [Customers]);

                        DECLARE @CorrectedCif NVARCHAR(20) = 'CIF' + RIGHT('000000' + CAST(@TargetCustId AS VARCHAR(10)), 6);

                        SET IDENTITY_INSERT [Customers] ON;
                        INSERT INTO [Customers] (
                            [CustomerID], [BranchID], [CIFNo], [LegacyCustomerNo], [FirstName], [MiddleName], [LastName],
                            [NickName], [FirstNameEng], [MiddleNameEng], [LastNameEng], [Address], [AddressEng], [Village],
                            [Taluka], [District], [MobileNo], [AadhaarNo], [PANNo], [RegistrationDate], [NomineeName],
                            [NomineeNameEng], [NomineeRelation], [NomineeAddress], [NomineeBirthDate], [NomineeIsMinor],
                            [NomineeGuardianName], [PhotoPath], [SignaturePath], [AadhaarDocPath], [PanDocPath], [Gender],
                            [BirthDate], [Occupation], [CasteCategory], [Caste], [Email], [IsMinor], [GuardianName],
                            [GuardianNameEng], [GuardianRelation], [GuardianAadhaarNo], [GuardianMobileNo], [GuardianAddress],
                            [Status], [EmployerId], [IsDeleted], [CreatedBy], [CreatedOn], [UpdatedBy], [UpdatedOn]
                        )
                        SELECT 
                            @TargetCustId, [BranchID], @CorrectedCif, [LegacyCustomerNo],
                            [FirstName], [MiddleName], [LastName], [NickName], [FirstNameEng], [MiddleNameEng], [LastNameEng],
                            [Address], [AddressEng], [Village], [Taluka], [District], [MobileNo], [AadhaarNo], [PANNo],
                            [RegistrationDate], [NomineeName], [NomineeNameEng], [NomineeRelation], [NomineeAddress],
                            [NomineeBirthDate], [NomineeIsMinor], [NomineeGuardianName], [PhotoPath], [SignaturePath],
                            [AadhaarDocPath], [PanDocPath], [Gender], [BirthDate], [Occupation], [CasteCategory], [Caste],
                            [Email], [IsMinor], [GuardianName], [GuardianNameEng], [GuardianRelation], [GuardianAadhaarNo],
                            [GuardianMobileNo], [GuardianAddress], [Status], [EmployerId], [IsDeleted], [CreatedBy],
                            [CreatedOn], [UpdatedBy], [UpdatedOn]
                        FROM [Customers]
                        WHERE [CustomerID] = 0;
                        SET IDENTITY_INSERT [Customers] OFF;

                        IF OBJECT_ID(N'[Members]', N'U') IS NOT NULL
                            UPDATE [Members] SET [CustomerID] = @TargetCustId, [CIFNo] = @CorrectedCif WHERE [CustomerID] = 0 OR [CIFNo] = 'CIF000000';
                        IF OBJECT_ID(N'[SavingAccountMasters]', N'U') IS NOT NULL
                            UPDATE [SavingAccountMasters] SET [CustomerID] = @TargetCustId WHERE [CustomerID] = 0;
                        IF OBJECT_ID(N'[LoanAccounts]', N'U') IS NOT NULL
                            UPDATE [LoanAccounts] SET [CustomerID] = @TargetCustId WHERE [CustomerID] = 0;
                        IF OBJECT_ID(N'[FdAccounts]', N'U') IS NOT NULL
                            UPDATE [FdAccounts] SET [CustomerID] = @TargetCustId WHERE [CustomerID] = 0;
                        IF OBJECT_ID(N'[RdAccounts]', N'U') IS NOT NULL
                            UPDATE [RdAccounts] SET [CustomerID] = @TargetCustId WHERE [CustomerID] = 0;
                        IF OBJECT_ID(N'[PigmyAccounts]', N'U') IS NOT NULL
                            UPDATE [PigmyAccounts] SET [CustomerID] = @TargetCustId WHERE [CustomerID] = 0;
                        IF OBJECT_ID(N'[CustomerOpeningBalances]', N'U') IS NOT NULL
                            UPDATE [CustomerOpeningBalances] SET [CustomerID] = @TargetCustId WHERE [CustomerID] = 0;
                        IF OBJECT_ID(N'[LockerAllotments]', N'U') IS NOT NULL
                            UPDATE [LockerAllotments] SET [CustomerID] = @TargetCustId WHERE [CustomerID] = 0;
                        IF OBJECT_ID(N'[ShareAccounts]', N'U') IS NOT NULL
                            UPDATE [ShareAccounts] SET [CustomerID] = @TargetCustId WHERE [CustomerID] = 0;

                        DELETE FROM [Customers] WHERE [CustomerID] = 0;

                        DECLARE @MaxIdNow INT = (SELECT ISNULL(MAX([CustomerID]), 1) FROM [Customers]);
                        DBCC CHECKIDENT ('Customers', RESEED, @MaxIdNow);
                    END;

                    UPDATE c
                    SET c.[CIFNo] = 'CIF' + RIGHT('000000' + CAST(c.[CustomerID] AS VARCHAR(10)), 6)
                    FROM [Customers] c;

                    IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Members')
                    BEGIN
                        UPDATE m
                        SET m.[CIFNo] = ISNULL(c.[CIFNo], 'CIF' + RIGHT('000000' + CAST(m.[MemberID] AS VARCHAR(10)), 6))
                        FROM [Members] m
                        LEFT JOIN [Customers] c ON (m.[CustomerID] = c.[CustomerID] OR m.[MemberID] = c.[CustomerID]);
                    END
                ";

                await _context.Database.ExecuteSqlRawAsync(sql);

                var totalCount = await _context.Customers.CountAsync();
                string nextCif = await GenerateUniqueCifAsync();
                await LogAuditAsync("HARMONIZE_CIFS", "ALL", $"Harmonized {totalCount} customer CIF numbers 1-to-1 with CustomerID.");

                return Ok(new
                {
                    message = "सर्व खातेदारांचे CIF क्रमांक आणि CustomerID यशस्वीरित्या 1-to-1 जुळवण्यात आले.",
                    totalCustomers = totalCount,
                    nextCifNo = nextCif
                });
            }
            catch (Exception ex)
            {
                string detailed = ex.InnerException?.Message ?? ex.Message;
                return StatusCode(500, new { message = "CIF सिंक्रोनायझेशन करताना त्रुटी आली: " + detailed });
            }
        }

        // POST: api/Customers
        [HttpPost]
        public async Task<ActionResult<Customer>> PostCustomer(Customer customer)
        {
            var (userId, username, userBranchId, _, isHeadOfficeAdmin) = GetCurrentUserContext();

            if (!isHeadOfficeAdmin)
            {
                customer.BranchID = userBranchId;
            }

            if (string.IsNullOrWhiteSpace(customer.FirstName) || string.IsNullOrWhiteSpace(customer.LastName))
            {
                return BadRequest(new { message = "पहिले नाव आणि आडनाव आवश्यक आहे." });
            }

            // Sanitize optional fields
            customer.MobileNo = string.IsNullOrWhiteSpace(customer.MobileNo) ? null : customer.MobileNo.Trim();
            customer.AadhaarNo = string.IsNullOrWhiteSpace(customer.AadhaarNo) ? null : customer.AadhaarNo.Trim();
            customer.PANNo = string.IsNullOrWhiteSpace(customer.PANNo) ? null : customer.PANNo.Trim().ToUpper();
            customer.LegacyCustomerNo = string.IsNullOrWhiteSpace(customer.LegacyCustomerNo) ? null : customer.LegacyCustomerNo.Trim();

            // Duplicate checks
            if (!string.IsNullOrWhiteSpace(customer.LegacyCustomerNo))
            {
                var existingLegacyCust = await _context.Customers
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => !c.IsDeleted && c.LegacyCustomerNo != null && c.LegacyCustomerNo == customer.LegacyCustomerNo);
                if (existingLegacyCust != null)
                {
                    return BadRequest(new { message = $"हा जुना ग्राहक आयडी ({customer.LegacyCustomerNo}) आधीच ग्राहक '{existingLegacyCust.FirstName} {existingLegacyCust.LastName}' (CIF: {existingLegacyCust.CIFNo}) साठी नोंदवला आहे." });
                }
            }

            if (!string.IsNullOrWhiteSpace(customer.AadhaarNo))
            {
                bool aadhaarExists = await _context.Customers.AnyAsync(c => c.AadhaarNo == customer.AadhaarNo);
                if (aadhaarExists)
                {
                    return BadRequest(new { message = $"हा आधार नंबर ({customer.AadhaarNo}) आधीच दुसऱ्या ग्राहकाकडे नोंदवला आहे." });
                }
            }

            if (!string.IsNullOrWhiteSpace(customer.PANNo))
            {
                bool panExists = await _context.Customers.AnyAsync(c => c.PANNo == customer.PANNo);
                if (panExists)
                {
                    return BadRequest(new { message = $"हा पॅन नंबर ({customer.PANNo}) आधीच दुसऱ्या ग्राहकाकडे नोंदवला आहे." });
                }
            }

            if (!string.IsNullOrWhiteSpace(customer.MobileNo))
            {
                bool mobileExists = await _context.Customers.AnyAsync(c => c.MobileNo == customer.MobileNo);
                if (mobileExists)
                {
                    return BadRequest(new { message = $"हा मोबाईल नंबर ({customer.MobileNo}) आधीच दुसऱ्या ग्राहकाकडे नोंदवला आहे." });
                }
            }

            if (string.IsNullOrWhiteSpace(customer.CIFNo) || await _context.Customers.AnyAsync(c => c.CIFNo == customer.CIFNo))
            {
                customer.CIFNo = await GenerateUniqueCifAsync();
            }

            customer.Branch = null;
            customer.Employer = null;
            customer.MemberProfile = null;
            customer.BranchID = customer.BranchID > 0 ? customer.BranchID : (userBranchId > 0 ? userBranchId : 1);
            customer.CreatedBy = userId;
            customer.CreatedOn = DateTime.Now;
            customer.IsDeleted = false;

            _context.Customers.Add(customer);
            try
            {
                await _context.SaveChangesAsync();

                // 100% strict 1-to-1 sync: CustomerID and CIFNo always match (e.g. ID: 15 -> CIF000015)
                string standardCif = $"CIF{customer.CustomerID:D6}";
                if (customer.CIFNo != standardCif && !await _context.Customers.AnyAsync(c => c.CustomerID != customer.CustomerID && c.CIFNo == standardCif))
                {
                    customer.CIFNo = standardCif;
                    await _context.SaveChangesAsync();
                }

                await LogAuditAsync("CUSTOMER_CREATE", customer.CustomerID.ToString(), $"नवीन ग्राहक नोंदणी: {customer.FirstName} {customer.LastName}, CIF: {customer.CIFNo}");
            }
            catch (DbUpdateException ex)
            {
                string detailedError = ex.InnerException?.Message ?? ex.Message;
                return BadRequest(new { message = "ग्राहक सेव्ह करताना डेटाबेस त्रुटी आली: " + detailedError });
            }

            return CreatedAtAction("GetCustomer", new { id = customer.CustomerID }, customer);
        }

        // PUT: api/Customers/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutCustomer(int id, Customer customer)
        {
            if (customer.CustomerID > 0 && id != customer.CustomerID)
            {
                return BadRequest(new { message = "Customer ID mismatch." });
            }
            customer.CustomerID = id;

            var (userId, username, userBranchId, _, isHeadOfficeAdmin) = GetCurrentUserContext();

            var existingCustomer = await _context.Customers.FindAsync(id);
            if (existingCustomer == null)
            {
                return NotFound(new { message = "खातेदार (Customer) सापडला नाही." });
            }

            if (!isHeadOfficeAdmin && existingCustomer.BranchID != userBranchId)
            {
                return StatusCode(403, new { message = "आपण केवळ आपल्या शाखेतील ग्राहकांची माहिती अद्ययावत करू शकता." });
            }

            // Duplicate checks for update
            customer.LegacyCustomerNo = string.IsNullOrWhiteSpace(customer.LegacyCustomerNo) ? null : customer.LegacyCustomerNo.Trim();
            if (!string.IsNullOrWhiteSpace(customer.LegacyCustomerNo))
            {
                var existingLegacyCust = await _context.Customers
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.CustomerID != id && !c.IsDeleted && c.LegacyCustomerNo != null && c.LegacyCustomerNo == customer.LegacyCustomerNo);
                if (existingLegacyCust != null)
                {
                    return BadRequest(new { message = $"हा जुना ग्राहक आयडी ({customer.LegacyCustomerNo}) आधीच ग्राहक '{existingLegacyCust.FirstName} {existingLegacyCust.LastName}' (CIF: {existingLegacyCust.CIFNo}) साठी नोंदवला आहे." });
                }
            }

            existingCustomer.LegacyCustomerNo = customer.LegacyCustomerNo;
            existingCustomer.RegistrationDate = customer.RegistrationDate;
            existingCustomer.FirstName = customer.FirstName;
            existingCustomer.MiddleName = customer.MiddleName;
            existingCustomer.LastName = customer.LastName;
            existingCustomer.NickName = customer.NickName;
            existingCustomer.FirstNameEng = customer.FirstNameEng;
            existingCustomer.MiddleNameEng = customer.MiddleNameEng;
            existingCustomer.LastNameEng = customer.LastNameEng;
            existingCustomer.Address = customer.Address;
            existingCustomer.AddressEng = customer.AddressEng;
            existingCustomer.Village = customer.Village;
            existingCustomer.Taluka = customer.Taluka;
            existingCustomer.District = customer.District;
            existingCustomer.MobileNo = string.IsNullOrWhiteSpace(customer.MobileNo) ? null : customer.MobileNo.Trim();
            existingCustomer.AadhaarNo = string.IsNullOrWhiteSpace(customer.AadhaarNo) ? null : customer.AadhaarNo.Trim();
            existingCustomer.PANNo = string.IsNullOrWhiteSpace(customer.PANNo) ? null : customer.PANNo.Trim().ToUpper();
            existingCustomer.PhotoPath = customer.PhotoPath;
            existingCustomer.SignaturePath = customer.SignaturePath;
            existingCustomer.AadhaarDocPath = customer.AadhaarDocPath;
            existingCustomer.PanDocPath = customer.PanDocPath;
            existingCustomer.Gender = customer.Gender;
            existingCustomer.BirthDate = customer.BirthDate;
            existingCustomer.Occupation = customer.Occupation;
            existingCustomer.CasteCategory = customer.CasteCategory;
            existingCustomer.Caste = customer.Caste;
            existingCustomer.Email = customer.Email;
            existingCustomer.IsMinor = customer.IsMinor;
            existingCustomer.GuardianName = customer.GuardianName;
            existingCustomer.GuardianNameEng = customer.GuardianNameEng;
            existingCustomer.GuardianRelation = customer.GuardianRelation;
            existingCustomer.GuardianAadhaarNo = customer.GuardianAadhaarNo;
            existingCustomer.GuardianMobileNo = customer.GuardianMobileNo;
            existingCustomer.GuardianAddress = customer.GuardianAddress;
            existingCustomer.NomineeName = customer.NomineeName;
            existingCustomer.NomineeNameEng = customer.NomineeNameEng;
            existingCustomer.NomineeRelation = customer.NomineeRelation;
            existingCustomer.NomineeAddress = customer.NomineeAddress;
            existingCustomer.NomineeBirthDate = customer.NomineeBirthDate;
            existingCustomer.NomineeIsMinor = customer.NomineeIsMinor;
            existingCustomer.NomineeGuardianName = customer.NomineeGuardianName;
            existingCustomer.Status = customer.Status;
            existingCustomer.EmployerId = customer.EmployerId;
            existingCustomer.UpdatedBy = userId;
            existingCustomer.UpdatedOn = DateTime.Now;

            // Sync with linked Member record if exists — only membership-specific fields need updating
            // since demographic data now lives exclusively on the Customer record
            var linkedMember = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == id);
            if (linkedMember != null)
            {
                if (linkedMember.CustomerID != id) linkedMember.CustomerID = id;
                linkedMember.Status = customer.Status;
                linkedMember.UpdatedBy = userId;
                linkedMember.UpdatedOn = DateTime.Now;
            }

            try
            {
                await _context.SaveChangesAsync();
                await LogAuditAsync("CUSTOMER_UPDATE", id.ToString(), $"ग्राहक माहिती अद्ययावत केली: {existingCustomer.FirstName} {existingCustomer.LastName}, CIF: {existingCustomer.CIFNo}");
            }
            catch (DbUpdateException ex)
            {
                string detailedError = ex.InnerException?.Message ?? ex.Message;
                return BadRequest(new { message = "ग्राहक अपडेट करताना डेटाबेस त्रुटी आली: " + detailedError });
            }

            return Ok(existingCustomer);
        }

        // DELETE: api/Customers/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCustomer(int id)
        {
            var (userId, username, userBranchId, _, isHeadOfficeAdmin) = GetCurrentUserContext();

            var customer = await _context.Customers.FindAsync(id);
            if (customer == null)
            {
                return NotFound(new { message = "खातेदार (Customer) सापडला नाही." });
            }

            if (!isHeadOfficeAdmin && customer.BranchID != userBranchId)
            {
                return StatusCode(403, new { message = "आपण केवळ आपल्या शाखेतील खातेदारांची माहिती डिलीट करू शकता." });
            }

            // Find linked member record if any
            var linkedMember = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == id);
            int linkedMemberId = linkedMember?.MemberID ?? 0;

            // Check if there are active loans, savings, FDs, RDs, Pigmies, Shares, Lockers, Opening Balances
            bool hasSavings = await _context.SavingAccountMasters.AnyAsync(s => s.CustomerID == id);
            bool hasLoans = await _context.LoanAccounts.AnyAsync(l => (l.CustomerID == id || (linkedMemberId > 0 && (l.MemberID == linkedMemberId || l.CoMemberID == linkedMemberId || l.CoMember2ID == linkedMemberId || l.Guarantor1MemberID == linkedMemberId || l.Guarantor2MemberID == linkedMemberId))));
            bool hasFds = await _context.FdAccounts.AnyAsync(f => f.CustomerID == id);
            bool hasRds = await _context.RdAccounts.AnyAsync(r => r.CustomerID == id);
            bool hasPigmies = await _context.PigmyAccounts.AnyAsync(p => p.CustomerID == id);
            bool hasShares = linkedMemberId > 0 && await _context.ShareAccounts.AnyAsync(s => s.MemberId == linkedMemberId && s.TotalShareCount > 0);
            bool hasLockers = await _context.LockerAllotments.AnyAsync(l => (l.CustomerID == id || (linkedMemberId > 0 && l.MemberID == linkedMemberId)));
            bool hasCustomerOpeningBalances = await _context.CustomerOpeningBalances.AnyAsync(o => o.CustomerID == id);
            bool hasMemberOpeningBalances = linkedMemberId > 0 && await _context.MemberOpeningBalances.AnyAsync(o => o.MemberID == linkedMemberId);

            if (hasSavings || hasLoans || hasFds || hasRds || hasPigmies || hasShares || hasLockers || hasCustomerOpeningBalances || hasMemberOpeningBalances)
            {
                return BadRequest(new
                {
                    message = "या खातेदारावर खाती, ठेवी, शेअर्स किंवा व्यवहार नोंद असल्यामुळे खातेदार डिलीट करता येत नाही."
                });
            }

            try
            {
                // If an empty share account exists with 0 shares, remove it
                if (linkedMemberId > 0)
                {
                    var emptyShares = await _context.ShareAccounts.Where(s => s.MemberId == linkedMemberId).ToListAsync();
                    if (emptyShares.Any())
                    {
                        _context.ShareAccounts.RemoveRange(emptyShares);
                    }

                    _context.Members.Remove(linkedMember!);
                }

                _context.Customers.Remove(customer);
                await _context.SaveChangesAsync();

                // If the deleted record was the highest CustomerID, automatically decrement/reseed identity counter
                try
                {
                    var maxRemainingId = await _context.Customers.MaxAsync(c => (int?)c.CustomerID) ?? 0;
                    if (id > maxRemainingId)
                    {
                        int reseedVal = maxRemainingId > 0 ? maxRemainingId : 1;
                        await _context.Database.ExecuteSqlInterpolatedAsync($"DBCC CHECKIDENT ('Customers', RESEED, {reseedVal});");
                    }
                }
                catch (Exception reseedEx)
                {
                    Console.WriteLine($"[WARNING] Customer reseed error: {reseedEx.Message}");
                }

                await LogAuditAsync("CUSTOMER_DELETE", id.ToString(), $"खातेदार कायमचा डिलीट केला: {customer.FirstName} {customer.LastName}, CIF: {customer.CIFNo}");

                return Ok(new { message = "खातेदार यशस्वीरित्या डिलीट केला." });
            }
            catch (Exception ex)
            {
                string detailedError = ex.InnerException?.Message ?? ex.Message;
                return BadRequest(new { message = "खातेदार डिलीट करताना त्रुटी आली: " + detailedError });
            }
        }

        // GET: api/Customers/5/360
        [HttpGet("{id}/360")]
        public async Task<IActionResult> GetCustomer360(int id)
        {
            var customer = await _context.Customers
                .Include(c => c.Branch)
                .Include(c => c.MemberProfile)
                .FirstOrDefaultAsync(c => c.CustomerID == id);

            if (customer == null) return NotFound("ग्राहक सापडला नाही.");

            int? linkedMemberId = customer.MemberProfile?.MemberID;

            var savings = await _context.SavingAccountMasters
                .Where(s => s.CustomerID == id)
                .Select(s => new { s.SavingAccountID, s.AccountNo, s.CurrentBalance, s.Status, s.OpeningDate })
                .ToListAsync();

            var pigmy = await _context.PigmyAccounts
                .Where(p => p.CustomerID == id)
                .Select(p => new { p.PigmyAccountID, p.AccountNo, p.TotalDepositedAmount, p.Status, p.OpeningDate })
                .ToListAsync();

            var fds = await _context.FdAccounts
                .Where(f => f.CustomerID == id)
                .Select(f => new { f.FdAccountID, f.AccountNo, f.DepositAmount, f.MaturityAmount, f.MaturityDate, f.Status })
                .ToListAsync();

            var rds = await _context.RdAccounts
                .Where(r => r.CustomerID == id)
                .Select(r => new { r.RdAccountID, r.AccountNo, r.InstallmentAmount, r.TotalDepositedAmount, r.Status })
                .ToListAsync();

            var loans = await _context.LoanAccounts
                .Where(l => l.CustomerID == id || (linkedMemberId != null && (l.MemberID == linkedMemberId || l.CoMemberID == linkedMemberId || l.CoMember2ID == linkedMemberId)))
                .Select(l => new { l.LoanAccountID, l.LoanAccountNo, l.SanctionedAmount, l.PrincipalBalance, l.InterestBalance, l.Status })
                .ToListAsync();

            var shares = linkedMemberId != null ? await _context.ShareAccounts
                .Where(s => s.MemberId == linkedMemberId)
                .Select(s => new { s.ShareAccountId, s.AccountNo, s.TotalShareCount, s.TotalShareAmount, s.Status })
                .FirstOrDefaultAsync() : null;

            return Ok(new
            {
                Customer = customer,
                Member = customer.MemberProfile,
                Savings = savings,
                Pigmy = pigmy,
                FixedDeposits = fds,
                RecurringDeposits = rds,
                Loans = loans,
                Shares = shares
            });
        }

        // POST: api/Customers/upload
        [HttpPost("upload")]
        public async Task<IActionResult> UploadFile(IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest("कोणतीही फाईल अपलोड केलेली नाही.");
            }

            if (file.Length > 10 * 1024 * 1024)
            {
                return BadRequest("फाईलची साईझ १० MB पेक्षा जास्त नसावी.");
            }

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
    }
}
