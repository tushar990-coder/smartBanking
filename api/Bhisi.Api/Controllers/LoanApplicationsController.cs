using System;
using System.Collections.Generic;
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
    public class LoanApplicationsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LoanApplicationsController(AppDbContext context)
        {
            _context = context;
        }

        private (int userId, string username, int branchId, string role) GetCurrentUserContext()
        {
            int userId = 1;
            string username = "System";
            int branchId = 1;
            string role = "User";

            var userClaim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("UserID") ?? User.FindFirst("sub");
            if (userClaim != null && int.TryParse(userClaim.Value, out int uid)) userId = uid;

            var nameClaim = User.FindFirst(ClaimTypes.Name) ?? User.FindFirst("Username");
            if (nameClaim != null && !string.IsNullOrWhiteSpace(nameClaim.Value)) username = nameClaim.Value;

            var branchClaim = User.FindFirst("BranchID") ?? User.FindFirst("branchID");
            if (branchClaim != null && int.TryParse(branchClaim.Value, out int bid)) branchId = bid;

            var roleClaim = User.FindFirst(ClaimTypes.Role) ?? User.FindFirst("role") ?? User.FindFirst("Role");
            if (roleClaim != null && !string.IsNullOrWhiteSpace(roleClaim.Value)) role = roleClaim.Value;

            return (userId, username, branchId, role);
        }

        // GET: api/LoanApplications/next-number?branchId=1
        [HttpGet("next-number")]
        public async Task<ActionResult<string>> GetNextApplicationNo([FromQuery] int? branchId = null)
        {
            var userContext = GetCurrentUserContext();
            int targetBranchId = branchId.HasValue && branchId.Value > 0 ? branchId.Value : userContext.branchId;

            var branch = await _context.Branches.FindAsync(targetBranchId);
            string branchCode = !string.IsNullOrWhiteSpace(branch?.BranchCode) ? branch.BranchCode.Trim().ToUpper() : "HQ";

            var today = DateTime.Today;
            var year = today.Year.ToString().Substring(2, 2);
            var month = today.Month.ToString("D2");
            var branchPrefix = $"APP-{branchCode}-{year}{month}-";
            var legacyPrefix = $"APP-{year}{month}-";
            
            var lastBranchApp = await _context.LoanApplications
                .Where(a => a.BranchID == targetBranchId && a.ApplicationNo != null && a.ApplicationNo.StartsWith(branchPrefix))
                .OrderByDescending(a => a.ApplicationNo)
                .FirstOrDefaultAsync();

            int nextNo = 1;
            if (lastBranchApp?.ApplicationNo != null)
            {
                var parts = lastBranchApp.ApplicationNo.Split('-');
                if (parts.Length >= 4 && int.TryParse(parts[3], out int lastNo))
                {
                    nextNo = lastNo + 1;
                }
            }
            else if (targetBranchId == 1)
            {
                // Fallback for Main / HQ branch if legacy un-prefixed applications exist
                var lastLegacyApp = await _context.LoanApplications
                    .Where(a => a.ApplicationNo != null && a.ApplicationNo.StartsWith(legacyPrefix))
                    .OrderByDescending(a => a.ApplicationNo)
                    .FirstOrDefaultAsync();

                if (lastLegacyApp?.ApplicationNo != null)
                {
                    var parts = lastLegacyApp.ApplicationNo.Split('-');
                    if (parts.Length == 3 && int.TryParse(parts[2], out int lastNo))
                    {
                        nextNo = lastNo + 1;
                    }
                }
            }

            return Content($"{branchPrefix}{nextNo:D3}", "text/plain");
        }

        // GET: api/LoanApplications?branchId=1
        [HttpGet]
        public async Task<ActionResult<IEnumerable<LoanApplication>>> GetLoanApplications([FromQuery] int? branchId = null)
        {
            try
            {
                var userContext = GetCurrentUserContext();
                bool isHoOrAdmin = userContext.role.Equals("Admin", StringComparison.OrdinalIgnoreCase) ||
                                   userContext.role.Equals("HO_Manager", StringComparison.OrdinalIgnoreCase) ||
                                   userContext.role.Equals("HO Manager", StringComparison.OrdinalIgnoreCase) ||
                                   userContext.role.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase);

                var query = _context.LoanApplications
                    .Include(a => a.Branch)
                    .Include(a => a.Customer)
                    .Include(a => a.CoCustomer)
                    .Include(a => a.CoCustomer2)
                    .Include(a => a.LoanRate)
                    .Include(a => a.Guarantor1Customer)
                    .Include(a => a.Guarantor2Customer)
                    .Include(a => a.RecommendedByDirector)
                    .AsQueryable();

                int? effectiveBranchId = User.ResolveOptionalBranchId(branchId);
                if (effectiveBranchId.HasValue && effectiveBranchId.Value > 0)
                {
                    query = query.Where(a => a.BranchID == effectiveBranchId.Value);
                }

                var list = await query
                    .OrderByDescending(a => a.ApplicationDate)
                    .ThenByDescending(a => a.LoanApplicationID)
                    .ToListAsync();

                await EnrichApplicationDisbursementStatus(list);

                return Ok(list);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // GET: api/LoanApplications/pending-disbursements?branchId=1
        [HttpGet("pending-disbursements")]
        public async Task<ActionResult<IEnumerable<LoanApplication>>> GetPendingDisbursements([FromQuery] int? branchId = null)
        {
            try
            {
                int? effectiveBranchId = User.ResolveOptionalBranchId(branchId);

                // Subquery 1: Applications already fully disbursed via linked LoanAccount (by LoanApplicationID)
                var completedAppIdsQuery = _context.LoanAccounts
                    .AsNoTracking()
                    .Where(l => l.LoanApplicationID.HasValue &&
                        (l.Status == "Closed" ||
                         (l.SanctionedAmount > 0 && 
                          _context.LoanDisbursements.Where(d => d.LoanAccountID == l.LoanAccountID).Sum(d => (decimal?)d.DisbursementAmount ?? 0) >= l.SanctionedAmount)))
                    .Select(l => l.LoanApplicationID!.Value);

                // Subquery 2: Applications already fully disbursed via LoanAccountNo match
                var completedAccNosQuery = _context.LoanAccounts
                    .AsNoTracking()
                    .Where(l => !string.IsNullOrEmpty(l.LoanAccountNo) &&
                        (l.Status == "Closed" ||
                         (l.SanctionedAmount > 0 &&
                          _context.LoanDisbursements.Where(d => d.LoanAccountID == l.LoanAccountID).Sum(d => (decimal?)d.DisbursementAmount ?? 0) >= l.SanctionedAmount)))
                    .Select(l => l.LoanAccountNo!);

                var query = _context.LoanApplications
                    .AsNoTracking()
                    .Include(a => a.Branch)
                    .Include(a => a.Customer)
                    .Include(a => a.CoCustomer)
                    .Include(a => a.CoCustomer2)
                    .Include(a => a.LoanRate)
                    .Include(a => a.Guarantor1Customer)
                    .Include(a => a.Guarantor2Customer)
                    .Include(a => a.RecommendedByDirector)
                    .Where(a => !completedAppIdsQuery.Contains(a.LoanApplicationID) &&
                                (string.IsNullOrEmpty(a.LoanAccountNo) || !completedAccNosQuery.Contains(a.LoanAccountNo)))
                    .AsQueryable();

                if (effectiveBranchId.HasValue && effectiveBranchId.Value > 0)
                {
                    query = query.Where(a => a.BranchID == effectiveBranchId.Value);
                }

                var list = await query
                    .OrderByDescending(a => a.ApplicationDate)
                    .ThenByDescending(a => a.LoanApplicationID)
                    .ToListAsync();

                await EnrichApplicationDisbursementStatus(list);

                var pendingList = list.Where(a => a.PendingSanctionedAmount > 0).ToList();
                return Ok(pendingList);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // GET: api/LoanApplications/5
        [HttpGet("{id}")]
        public async Task<ActionResult<LoanApplication>> GetLoanApplication(int id)
        {
            var loanApplication = await _context.LoanApplications
                .Include(a => a.Branch)
                .Include(a => a.Customer)
                .Include(a => a.CoCustomer)
                .Include(a => a.CoCustomer2)
                .Include(a => a.LoanRate)
                .Include(a => a.Guarantor1Customer)
                .Include(a => a.Guarantor2Customer)
                .Include(a => a.RecommendedByDirector)
                .FirstOrDefaultAsync(m => m.LoanApplicationID == id);

            if (loanApplication == null)
            {
                return NotFound();
            }

            var singleList = new List<LoanApplication> { loanApplication };
            await EnrichApplicationDisbursementStatus(singleList);

            return loanApplication;
        }

        private async Task EnrichApplicationDisbursementStatus(List<LoanApplication> applications)
        {
            if (applications == null || !applications.Any()) return;

            var appIds = applications.Select(a => a.LoanApplicationID).ToList();
            var appAccountNos = applications
                .Where(a => !string.IsNullOrWhiteSpace(a.LoanAccountNo))
                .Select(a => a.LoanAccountNo!.Trim())
                .ToList();

            // Find all linked loan accounts (both by LoanApplicationID AND by LoanAccountNo)
            var linkedAccounts = await _context.LoanAccounts
                .AsNoTracking()
                .Where(l => (l.LoanApplicationID.HasValue && appIds.Contains(l.LoanApplicationID.Value))
                         || (!string.IsNullOrEmpty(l.LoanAccountNo) && appAccountNos.Contains(l.LoanAccountNo)))
                .ToListAsync();

            var accountIds = linkedAccounts.Select(l => l.LoanAccountID).ToList();

            // Find all disbursements for these accounts
            var disbursements = await _context.LoanDisbursements
                .AsNoTracking()
                .Where(d => accountIds.Contains(d.LoanAccountID))
                .ToListAsync();

            foreach (var app in applications)
            {
                var linkedAcc = linkedAccounts.FirstOrDefault(l => 
                    (l.LoanApplicationID.HasValue && l.LoanApplicationID.Value == app.LoanApplicationID)
                    || (!string.IsNullOrEmpty(app.LoanAccountNo) && !string.IsNullOrEmpty(l.LoanAccountNo) && l.LoanAccountNo.Trim() == app.LoanAccountNo.Trim()));

                if (linkedAcc != null)
                {
                    app.LinkedLoanAccountID = linkedAcc.LoanAccountID;
                    app.LoanAccountNo = linkedAcc.LoanAccountNo;

                    var appDisbursements = disbursements.Where(d => d.LoanAccountID == linkedAcc.LoanAccountID).ToList();
                    app.TotalDisbursedAmount = appDisbursements.Sum(d => d.DisbursementAmount);
                    app.DisbursementCount = appDisbursements.Count;
                }
                else
                {
                    app.TotalDisbursedAmount = 0;
                    app.DisbursementCount = 0;
                }

                var totalDisb = app.TotalDisbursedAmount;
                var sancAmt = app.RequestedAmount;

                if (totalDisb <= 0)
                {
                    app.PendingSanctionedAmount = sancAmt;
                    app.DisbursementStatus = "Pending";
                }
                else if (totalDisb < sancAmt)
                {
                    app.PendingSanctionedAmount = sancAmt - totalDisb;
                    app.DisbursementStatus = "Partially Disbursed";
                }
                else
                {
                    app.PendingSanctionedAmount = 0;
                    app.DisbursementStatus = "Fully Disbursed";
                }

                if (linkedAcc != null && linkedAcc.Status == "Closed")
                {
                    app.PendingSanctionedAmount = 0;
                    app.DisbursementStatus = "Closed";
                }
            }
        }

        // POST: api/LoanApplications
        [HttpPost]
        public async Task<ActionResult<LoanApplication>> PostLoanApplication(LoanApplication loanApplication)
        {
            try
            {
                // Sanitize 0 values to null for nullable foreign keys
                if (loanApplication.CoCustomerID.HasValue && loanApplication.CoCustomerID.Value <= 0) loanApplication.CoCustomerID = null;
                if (loanApplication.CoCustomer2ID.HasValue && loanApplication.CoCustomer2ID.Value <= 0) loanApplication.CoCustomer2ID = null;
                if (loanApplication.RecommendedByDirectorID.HasValue && loanApplication.RecommendedByDirectorID.Value <= 0) loanApplication.RecommendedByDirectorID = null;
                if (loanApplication.Guarantor1CustomerID.HasValue && loanApplication.Guarantor1CustomerID.Value <= 0) loanApplication.Guarantor1CustomerID = null;
                if (loanApplication.Guarantor2CustomerID.HasValue && loanApplication.Guarantor2CustomerID.Value <= 0) loanApplication.Guarantor2CustomerID = null;

                // 1. Verify Primary Borrower Customer Status
                if (!loanApplication.CustomerID.HasValue || loanApplication.CustomerID.Value <= 0)
                {
                    return BadRequest(new { message = "कृपया कर्जदाराची (Customer / CIF) निवड करा." });
                }

                var customer = await _context.Customers.FindAsync(loanApplication.CustomerID.Value);
                if (customer == null) return BadRequest(new { message = "निवडलेला कर्जदार ग्राहक सिस्टीममध्ये अस्तित्वात नाही." });
                if (customer.Status != "Active") return BadRequest(new { message = $"कर्जदार ग्राहकाचे स्टेटस '{customer.Status}' असल्यामुळे नवीन कर्ज अर्ज करता येत नाही. केवळ सक्रिय (Active) ग्राहकांनाच कर्ज अर्ज करता येतो." });

                int targetBorrowerCustId = customer.CustomerID;

                // 2. Validate Co-Borrowers
                if (loanApplication.CoCustomerID.HasValue && loanApplication.CoCustomerID.Value > 0)
                {
                    if (loanApplication.CoCustomerID.Value == targetBorrowerCustId)
                    {
                        return BadRequest(new { message = "कर्जदार स्वतःच स्वतःचा सह-कर्जदार (Co-Borrower 1) असू शकत नाही." });
                    }
                    var coCust1 = await _context.Customers.FindAsync(loanApplication.CoCustomerID.Value);
                    if (coCust1 == null || coCust1.Status != "Active")
                    {
                        return BadRequest(new { message = "सह-कर्जदार १ हा सक्रिय ग्राहक असणे आवश्यक आहे." });
                    }
                }

                if (loanApplication.CoCustomer2ID.HasValue && loanApplication.CoCustomer2ID.Value > 0)
                {
                    if (loanApplication.CoCustomer2ID.Value == targetBorrowerCustId)
                    {
                        return BadRequest(new { message = "कर्जदार स्वतःच स्वतःचा सह-कर्जदार २ असू शकत नाही." });
                    }
                    if (loanApplication.CoCustomerID.HasValue && loanApplication.CoCustomer2ID.Value == loanApplication.CoCustomerID.Value)
                    {
                        return BadRequest(new { message = "सह-कर्जदार १ आणि सह-कर्जदार २ एकच व्यक्ती असू शकत नाहीत." });
                    }
                    var coCust2 = await _context.Customers.FindAsync(loanApplication.CoCustomer2ID.Value);
                    if (coCust2 == null || coCust2.Status != "Active")
                    {
                        return BadRequest(new { message = "सह-कर्जदार २ हा सक्रिय ग्राहक असणे आवश्यक आहे." });
                    }
                }

                // 3. Prevent Self-Guarantee & Duplicate Guarantors
                // Check Guarantor 1
                if (loanApplication.Guarantor1CustomerID.HasValue && loanApplication.Guarantor1CustomerID.Value > 0)
                {
                    if (loanApplication.Guarantor1CustomerID.Value == targetBorrowerCustId)
                    {
                        return BadRequest(new { message = "कर्जदार स्वतःच स्वतःचा जामीनदार (Guarantor 1) असू शकत नाही." });
                    }
                    var gCust1 = await _context.Customers.FindAsync(loanApplication.Guarantor1CustomerID.Value);
                    if (gCust1 == null || gCust1.Status != "Active")
                    {
                        return BadRequest(new { message = "जामीनदार १ हा सक्रिय ग्राहक असणे आवश्यक आहे." });
                    }
                }

                // Check Guarantor 2
                if (loanApplication.Guarantor2CustomerID.HasValue && loanApplication.Guarantor2CustomerID.Value > 0)
                {
                    if (loanApplication.Guarantor2CustomerID.Value == targetBorrowerCustId)
                    {
                        return BadRequest(new { message = "कर्जदार स्वतःच स्वतःचा जामीनदार (Guarantor 2) असू शकत नाही." });
                    }
                    if (loanApplication.Guarantor1CustomerID.HasValue && loanApplication.Guarantor2CustomerID.Value == loanApplication.Guarantor1CustomerID.Value)
                    {
                        return BadRequest(new { message = "जामीनदार १ आणि जामीनदार २ एकच व्यक्ती असू शकत नाहीत." });
                    }
                    var gCust2 = await _context.Customers.FindAsync(loanApplication.Guarantor2CustomerID.Value);
                    if (gCust2 == null || gCust2.Status != "Active")
                    {
                        return BadRequest(new { message = "जामीनदार २ हा सक्रिय ग्राहक असणे आवश्यक आहे." });
                    }
                }

                // 4. Validate Recommended Director if provided
                if (loanApplication.RecommendedByDirectorID.HasValue && loanApplication.RecommendedByDirectorID.Value > 0)
                {
                    var dirCust = await _context.Customers.FindAsync(loanApplication.RecommendedByDirectorID.Value);
                    if (dirCust == null)
                    {
                        return BadRequest(new { message = "शिफारस केलेले संचालक ग्राहक सिस्टीममध्ये अस्तित्वात नाहीत." });
                    }
                }

                // Branch resolution and branch code with multi-branch security check
                var userContext = GetCurrentUserContext();
                bool isHoOrAdmin = userContext.role.Equals("Admin", StringComparison.OrdinalIgnoreCase) ||
                                   userContext.role.Equals("HO_Manager", StringComparison.OrdinalIgnoreCase) ||
                                   userContext.role.Equals("HO Manager", StringComparison.OrdinalIgnoreCase) ||
                                   userContext.role.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase);

                if (!isHoOrAdmin)
                {
                    // Non-HO branch operators are strictly locked to their own branch
                    loanApplication.BranchID = userContext.branchId;
                }
                else if (loanApplication.BranchID <= 0)
                {
                    loanApplication.BranchID = userContext.branchId;
                }

                var branch = await _context.Branches.FindAsync(loanApplication.BranchID);
                string branchCode = !string.IsNullOrWhiteSpace(branch?.BranchCode) ? branch.BranchCode.Trim().ToUpper() : "HQ";

                // Auto-generate ApplicationNo
                var today = DateTime.Today;
                var year = today.Year.ToString().Substring(2, 2);
                var month = today.Month.ToString("D2");
                var branchPrefix = $"APP-{branchCode}-{year}{month}-";
                var legacyPrefix = $"APP-{year}{month}-";
                
                var lastBranchApp = await _context.LoanApplications
                    .Where(a => a.BranchID == loanApplication.BranchID && a.ApplicationNo != null && a.ApplicationNo.StartsWith(branchPrefix))
                    .OrderByDescending(a => a.ApplicationNo)
                    .FirstOrDefaultAsync();

                int nextNo = 1;
                if (lastBranchApp?.ApplicationNo != null)
                {
                    var parts = lastBranchApp.ApplicationNo.Split('-');
                    if (parts.Length >= 4 && int.TryParse(parts[3], out int lastNo))
                    {
                        nextNo = lastNo + 1;
                    }
                }
                else if (loanApplication.BranchID == 1)
                {
                    var lastLegacyApp = await _context.LoanApplications
                        .Where(a => a.ApplicationNo != null && a.ApplicationNo.StartsWith(legacyPrefix))
                        .OrderByDescending(a => a.ApplicationNo)
                        .FirstOrDefaultAsync();

                    if (lastLegacyApp?.ApplicationNo != null)
                    {
                        var parts = lastLegacyApp.ApplicationNo.Split('-');
                        if (parts.Length == 3 && int.TryParse(parts[2], out int lastNo))
                        {
                            nextNo = lastNo + 1;
                        }
                    }
                }

                loanApplication.ApplicationNo = $"{branchPrefix}{nextNo:D3}";

                _context.LoanApplications.Add(loanApplication);
                await _context.SaveChangesAsync();

                // Reload branch navigation for return
                await _context.Entry(loanApplication).Reference(a => a.Branch).LoadAsync();

                return Ok(loanApplication);
            }
            catch (Exception ex)
            {
                var msg = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return BadRequest(new { message = $"कर्ज अर्ज जतन करताना त्रुटी आली: {msg}" });
            }
        }

        // PUT: api/LoanApplications/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutLoanApplication(int id, LoanApplication loanApplication)
        {
            if (id != loanApplication.LoanApplicationID)
            {
                return BadRequest(new { message = "अवैध कर्ज अर्ज आयडी (Invalid Application ID)." });
            }

            try
            {
                var userContext = GetCurrentUserContext();
                bool isHoOrAdmin = userContext.role.Equals("Admin", StringComparison.OrdinalIgnoreCase) ||
                                   userContext.role.Equals("HO_Manager", StringComparison.OrdinalIgnoreCase) ||
                                   userContext.role.Equals("HO Manager", StringComparison.OrdinalIgnoreCase) ||
                                   userContext.role.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase);

                var existing = await _context.LoanApplications.AsNoTracking().FirstOrDefaultAsync(a => a.LoanApplicationID == id);
                if (existing != null)
                {
                    if (!isHoOrAdmin && existing.BranchID != userContext.branchId)
                    {
                        return BadRequest(new { message = $"सुरक्षा उल्लंघन: तुम्ही शाखा क्र. {userContext.branchId} चे ऑपरेटर आहात. तुम्हाला शाखा क्र. {existing.BranchID} च्या अर्जात बदल करण्याचा अधिकार नाही." });
                    }

                    if (loanApplication.BranchID <= 0 || !isHoOrAdmin)
                    {
                        loanApplication.BranchID = existing.BranchID;
                    }
                }

                // Sanitize 0 values to null for nullable foreign keys
                if (loanApplication.CoCustomerID.HasValue && loanApplication.CoCustomerID.Value <= 0) loanApplication.CoCustomerID = null;
                if (loanApplication.CoCustomer2ID.HasValue && loanApplication.CoCustomer2ID.Value <= 0) loanApplication.CoCustomer2ID = null;
                if (loanApplication.RecommendedByDirectorID.HasValue && loanApplication.RecommendedByDirectorID.Value <= 0) loanApplication.RecommendedByDirectorID = null;
                if (loanApplication.Guarantor1CustomerID.HasValue && loanApplication.Guarantor1CustomerID.Value <= 0) loanApplication.Guarantor1CustomerID = null;
                if (loanApplication.Guarantor2CustomerID.HasValue && loanApplication.Guarantor2CustomerID.Value <= 0) loanApplication.Guarantor2CustomerID = null;

                _context.Entry(loanApplication).State = EntityState.Modified;
                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!LoanApplicationExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }
            catch (Exception ex)
            {
                var msg = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return BadRequest(new { message = $"कर्ज अर्ज अद्यतनित करताना त्रुटी आली: {msg}" });
            }
        }

        // DELETE: api/LoanApplications/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteLoanApplication(int id)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var loanApplication = await _context.LoanApplications.FindAsync(id);
                if (loanApplication == null)
                {
                    return NotFound(new { message = "कर्ज अर्ज सापडला नाही." });
                }

                // Find linked LoanAccounts
                var linkedLoanAccounts = await _context.LoanAccounts.Where(l => l.LoanApplicationID == id).ToListAsync();

                // 1. Verify if any loan collections (EMIs) exist on these accounts
                foreach (var loanAcc in linkedLoanAccounts)
                {
                    bool hasCollections = await _context.LoanCollections.AnyAsync(c => c.LoanAccountID == loanAcc.LoanAccountID);
                    if (hasCollections)
                    {
                        return BadRequest(new { message = "या कर्ज अर्जाच्या खात्यावर कर्ज वसुली (Loan Collection / EMI) झालेली असल्यामुळे हा अर्ज डिलीट करता येत नाही. आधी कर्ज वसुली डिलीट करा." });
                    }
                }

                // 2. Cascade delete all linked Disbursements, Vouchers, Shares, and Savings
                foreach (var loanAcc in linkedLoanAccounts)
                {
                    var linkedDisbursements = await _context.LoanDisbursements
                        .Include(d => d.Deductions)
                        .Include(d => d.Voucher)
                        .ThenInclude(v => v!.VoucherDetails)
                        .Where(d => d.LoanAccountID == loanAcc.LoanAccountID)
                        .ToListAsync();

                    foreach (var disb in linkedDisbursements)
                    {
                        // Remove linked Deductions
                        if (disb.Deductions != null && disb.Deductions.Any())
                        {
                            _context.LoanDisbursementDeductions.RemoveRange(disb.Deductions);
                        }

                        // Reverse and remove Voucher, Shares, and Savings
                        if (disb.VoucherID.HasValue || disb.Voucher != null)
                        {
                            int vId = disb.VoucherID ?? disb.Voucher?.VoucherID ?? 0;
                            string? voucherNo = disb.Voucher?.VoucherNo;

                            if (vId > 0)
                            {
                                var linkedShareTxns = await _context.ShareTransactions.Where(st => st.VoucherId == vId).ToListAsync();
                                foreach (var st in linkedShareTxns)
                                {
                                    var shAcc = await _context.ShareAccounts.FindAsync(st.ShareAccountId);
                                    if (shAcc != null)
                                    {
                                        shAcc.TotalShareCount = Math.Max(0, shAcc.TotalShareCount - st.NumberOfShares);
                                        shAcc.TotalShareAmount = Math.Max(0, shAcc.TotalShareAmount - st.Amount);
                                        _context.Entry(shAcc).State = EntityState.Modified;
                                    }
                                    _context.ShareTransactions.Remove(st);
                                }

                                if (!string.IsNullOrEmpty(voucherNo))
                                {
                                    var linkedSavingTxns = await _context.SavingTransactions.Where(st => st.VoucherNo == voucherNo).ToListAsync();
                                    foreach (var st in linkedSavingTxns)
                                    {
                                        var savAcc = await _context.SavingAccountMasters.FindAsync(st.SavingAccountID);
                                        if (savAcc != null)
                                        {
                                            savAcc.CurrentBalance = Math.Max(0, savAcc.CurrentBalance - st.Amount);
                                            _context.Entry(savAcc).State = EntityState.Modified;
                                        }
                                        _context.SavingTransactions.Remove(st);
                                    }
                                }

                                if (disb.Voucher?.VoucherDetails != null && disb.Voucher.VoucherDetails.Any())
                                {
                                    _context.VoucherDetails.RemoveRange(disb.Voucher.VoucherDetails);
                                }
                                else
                                {
                                    var details = await _context.VoucherDetails.Where(vd => vd.VoucherID == vId).ToListAsync();
                                    if (details.Any()) _context.VoucherDetails.RemoveRange(details);
                                }

                                var vObj = disb.Voucher ?? await _context.Vouchers.FindAsync(vId);
                                if (vObj != null) _context.Vouchers.Remove(vObj);
                            }
                        }

                        _context.LoanDisbursements.Remove(disb);
                    }

                    // Clean up Gold Loan Details
                    var goldDetails = await _context.GoldLoanDetails.Where(g => g.LoanAccountID == loanAcc.LoanAccountID).ToListAsync();
                    if (goldDetails.Any()) _context.GoldLoanDetails.RemoveRange(goldDetails);

                    // Clean up Installment Schedules
                    var schedules = await _context.LoanInstallmentSchedules.Where(s => s.LoanAccountID == loanAcc.LoanAccountID).ToListAsync();
                    if (schedules.Any()) _context.LoanInstallmentSchedules.RemoveRange(schedules);

                    // Clean up Collateral Compliance Logs
                    var collateralLogs = await _context.CollateralComplianceLogs.Where(c => c.LoanAccountID == loanAcc.LoanAccountID).ToListAsync();
                    if (collateralLogs.Any()) _context.CollateralComplianceLogs.RemoveRange(collateralLogs);
                }

                // Clean up Application-level GoldLoanDetails
                var appGold = await _context.GoldLoanDetails.Where(g => g.LoanApplicationID == id).ToListAsync();
                if (appGold.Any()) _context.GoldLoanDetails.RemoveRange(appGold);

                // 3. Remove Loan Accounts and Application
                if (linkedLoanAccounts.Any())
                {
                    _context.LoanAccounts.RemoveRange(linkedLoanAccounts);
                }

                _context.LoanApplications.Remove(loanApplication);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                var msg = ex.Message + (ex.InnerException != null ? " | " + ex.InnerException.Message : "");
                return BadRequest(new { message = $"कर्ज अर्ज डिलीट करताना त्रुटी आली: {msg}" });
            }
        }

        private bool LoanApplicationExists(int id)
        {
            return _context.LoanApplications.Any(e => e.LoanApplicationID == id);
        }
    }
}
