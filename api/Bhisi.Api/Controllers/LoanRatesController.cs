using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
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
    [Authorize]
    public class LoanRatesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LoanRatesController(AppDbContext context)
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
                    EntityName = "LoanRate",
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
                Console.WriteLine($"[WARNING] Audit logging failed for LoanRates: {ex.Message}");
            }
        }

        // GET: api/LoanRates
        [HttpGet]
        public async Task<ActionResult<IEnumerable<LoanRate>>> GetLoanRates()
        {
            return await _context.LoanRates
                .OrderBy(r => r.LoanCode)
                .ToListAsync();
        }

        // GET: api/LoanRates/5
        [HttpGet("{id}")]
        public async Task<ActionResult<LoanRate>> GetLoanRate(int id)
        {
            var loanRate = await _context.LoanRates.FindAsync(id);

            if (loanRate == null)
            {
                return NotFound(new { message = "कर्ज योजना सापडली नाही." });
            }

            return loanRate;
        }

        // GET: api/LoanRates/NextCode
        [HttpGet("NextCode")]
        public async Task<ActionResult<object>> GetNextLoanCode([FromQuery] string? loanType)
        {
            var rates = await _context.LoanRates.AsNoTracking().ToListAsync();
            var existingNumbers = new HashSet<int>();
            foreach (var r in rates)
            {
                if (!string.IsNullOrWhiteSpace(r.LoanCode))
                {
                    var digits = new string(r.LoanCode.Where(char.IsDigit).ToArray());
                    if (int.TryParse(digits, out int num) && num > 0)
                    {
                        existingNumbers.Add(num);
                    }
                }
            }

            int nextNum = 1;
            while (existingNumbers.Contains(nextNum))
            {
                nextNum++;
            }

            string nextCode = $"LN{nextNum:D2}";
            return Ok(new { nextCode });
        }

        // POST: api/LoanRates
        [HttpPost]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<ActionResult<LoanRate>> PostLoanRate(LoanRate loanRate)
        {
            if (loanRate == null)
            {
                return BadRequest(new { message = "अवैध कर्ज योजना डेटा." });
            }

            if (string.IsNullOrWhiteSpace(loanRate.LoanType))
            {
                return BadRequest(new { message = "कर्ज प्रकार निवडणे अनिवार्य आहे." });
            }

            if (loanRate.InterestRate < 0)
            {
                return BadRequest(new { message = "व्याजदर ऋण (Negative) असू शकत नाही." });
            }

            if (loanRate.OverdueInterestRate < 0)
            {
                return BadRequest(new { message = "दंड व्याजदर ऋण (Negative) असू शकत नाही." });
            }

            if (loanRate.DurationMonths < 0)
            {
                return BadRequest(new { message = "कर्ज मुदत (महिने) अवैध आहे." });
            }

            if (!loanRate.LoanLedgerID.HasValue || loanRate.LoanLedgerID.Value <= 0)
            {
                return BadRequest(new { message = "कर्ज मुद्दल खाते (Loan Ledger) निवडणे अनिवार्य आहे." });
            }

            if (!loanRate.InterestLedgerID.HasValue || loanRate.InterestLedgerID.Value <= 0)
            {
                return BadRequest(new { message = "कर्ज व्याज खाते (Interest Ledger) निवडणे अनिवार्य आहे." });
            }

            bool loanLedgerExists = await _context.Ledgers.AnyAsync(l => l.LedgerID == loanRate.LoanLedgerID.Value);
            if (!loanLedgerExists)
            {
                return BadRequest(new { message = "निवडलेले कर्ज मुद्दल खाते (Loan Ledger) अस्तित्वात नाही." });
            }

            bool interestLedgerExists = await _context.Ledgers.AnyAsync(l => l.LedgerID == loanRate.InterestLedgerID.Value);
            if (!interestLedgerExists)
            {
                return BadRequest(new { message = "निवडलेले कर्ज व्याज खाते (Interest Ledger) अस्तित्वात नाही." });
            }

            if (string.IsNullOrWhiteSpace(loanRate.LoanCode))
            {
                var rates = await _context.LoanRates.AsNoTracking().ToListAsync();
                var existingNumbers = new HashSet<int>();
                foreach (var r in rates)
                {
                    if (!string.IsNullOrWhiteSpace(r.LoanCode))
                    {
                        var digits = new string(r.LoanCode.Where(char.IsDigit).ToArray());
                        if (int.TryParse(digits, out int num) && num > 0)
                        {
                            existingNumbers.Add(num);
                        }
                    }
                }

                int nextNum = 1;
                while (existingNumbers.Contains(nextNum))
                {
                    nextNum++;
                }
                loanRate.LoanCode = $"LN{nextNum:D2}";
            }
            else
            {
                loanRate.LoanCode = loanRate.LoanCode.Trim();
            }

            _context.LoanRates.Add(loanRate);
            await _context.SaveChangesAsync();

            // Audit Trail for Loan Scheme Creation
            await LogAuditAsync(
                "CREATE_LOAN_SCHEME",
                loanRate.LoanRateID.ToString(),
                $"नवीन कर्ज योजना तयार केली: {loanRate.LoanType} (Code: {loanRate.LoanCode}), व्याजदर: {loanRate.InterestRate}%, दंड व्याजदर: {loanRate.OverdueInterestRate}%, मुदत: {loanRate.DurationMonths} महिने, हप्ता प्रकार: {loanRate.InstallmentType}, गणना: {loanRate.InterestCalculationMethod}"
            );

            return CreatedAtAction(nameof(GetLoanRate), new { id = loanRate.LoanRateID }, loanRate);
        }

        // PUT: api/LoanRates/5
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<IActionResult> PutLoanRate(int id, LoanRate loanRate)
        {
            if (id != loanRate.LoanRateID)
            {
                return BadRequest(new { message = "अवैध कर्ज योजना आयडी." });
            }

            if (string.IsNullOrWhiteSpace(loanRate.LoanType))
            {
                return BadRequest(new { message = "कर्ज प्रकार निवडणे अनिवार्य आहे." });
            }

            if (loanRate.InterestRate < 0)
            {
                return BadRequest(new { message = "व्याजदर ऋण (Negative) असू शकत नाही." });
            }

            if (loanRate.OverdueInterestRate < 0)
            {
                return BadRequest(new { message = "दंड व्याजदर ऋण (Negative) असू शकत नाही." });
            }

            if (loanRate.DurationMonths < 0)
            {
                return BadRequest(new { message = "कर्ज मुदत (महिने) अवैध आहे." });
            }

            if (!loanRate.LoanLedgerID.HasValue || loanRate.LoanLedgerID.Value <= 0)
            {
                return BadRequest(new { message = "कर्ज मुद्दल खाते (Loan Ledger) निवडणे अनिवार्य आहे." });
            }

            if (!loanRate.InterestLedgerID.HasValue || loanRate.InterestLedgerID.Value <= 0)
            {
                return BadRequest(new { message = "कर्ज व्याज खाते (Interest Ledger) निवडणे अनिवार्य आहे." });
            }

            bool loanLedgerExists = await _context.Ledgers.AnyAsync(l => l.LedgerID == loanRate.LoanLedgerID.Value);
            if (!loanLedgerExists)
            {
                return BadRequest(new { message = "निवडलेले कर्ज मुद्दल खाते (Loan Ledger) अस्तित्वात नाही." });
            }

            bool interestLedgerExists = await _context.Ledgers.AnyAsync(l => l.LedgerID == loanRate.InterestLedgerID.Value);
            if (!interestLedgerExists)
            {
                return BadRequest(new { message = "निवडलेले कर्ज व्याज खाते (Interest Ledger) अस्तित्वात नाही." });
            }

            // Fetch existing to compute change audit diff
            var existing = await _context.LoanRates.AsNoTracking().FirstOrDefaultAsync(r => r.LoanRateID == id);
            if (existing == null)
            {
                return NotFound(new { message = "कर्ज योजना सापडली नाही." });
            }

            var changes = new List<string>();
            if (existing.LoanType != loanRate.LoanType) changes.Add($"प्रकार: '{existing.LoanType}' -> '{loanRate.LoanType}'");
            if (existing.LoanCode != loanRate.LoanCode) changes.Add($"कोड: '{existing.LoanCode}' -> '{loanRate.LoanCode}'");
            if (existing.InterestRate != loanRate.InterestRate) changes.Add($"व्याजदर: {existing.InterestRate}% -> {loanRate.InterestRate}%");
            if (existing.OverdueInterestRate != loanRate.OverdueInterestRate) changes.Add($"दंड व्याज: {existing.OverdueInterestRate}% -> {loanRate.OverdueInterestRate}%");
            if (existing.DurationMonths != loanRate.DurationMonths) changes.Add($"मुदत: {existing.DurationMonths} -> {loanRate.DurationMonths} महिने");
            if (existing.InstallmentType != loanRate.InstallmentType) changes.Add($"हप्ता प्रकार: '{existing.InstallmentType}' -> '{loanRate.InstallmentType}'");
            if (existing.InterestCalculationMethod != loanRate.InterestCalculationMethod) changes.Add($"गणना: '{existing.InterestCalculationMethod}' -> '{loanRate.InterestCalculationMethod}'");
            if (existing.LoanLedgerID != loanRate.LoanLedgerID) changes.Add($"मुद्दल खाते ID: {existing.LoanLedgerID} -> {loanRate.LoanLedgerID}");
            if (existing.InterestLedgerID != loanRate.InterestLedgerID) changes.Add($"व्याज खाते ID: {existing.InterestLedgerID} -> {loanRate.InterestLedgerID}");
            if (existing.IsActive != loanRate.IsActive) changes.Add($"स्थिती (Active): {existing.IsActive} -> {loanRate.IsActive}");

            if (!string.IsNullOrWhiteSpace(loanRate.LoanCode))
            {
                loanRate.LoanCode = loanRate.LoanCode.Trim();
            }

            _context.Entry(loanRate).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!LoanRateExists(id))
                {
                    return NotFound(new { message = "कर्ज योजना सापडली नाही." });
                }
                else
                {
                    throw;
                }
            }

            // Audit Trail for Loan Scheme Update
            string changeSummary = changes.Count > 0 ? string.Join("; ", changes) : "कोणतेही महत्त्वपूर्ण बदल नाहीत";
            await LogAuditAsync(
                "UPDATE_LOAN_SCHEME",
                loanRate.LoanRateID.ToString(),
                $"कर्ज योजना अद्ययावत केली: {loanRate.LoanType} (Code: {loanRate.LoanCode}). बदल: {changeSummary}"
            );

            return NoContent();
        }

        // DELETE: api/LoanRates/5
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Manager,SuperAdmin,HeadOffice")]
        public async Task<IActionResult> DeleteLoanRate(int id)
        {
            var loanRate = await _context.LoanRates.FindAsync(id);
            if (loanRate == null)
            {
                return NotFound(new { message = "कर्ज योजना सापडली नाही." });
            }

            // Dependency check: If any loan accounts exist for this loan rate, prevent deletion
            var hasAccounts = await _context.LoanAccounts.AnyAsync(a => a.LoanRateID == id);
            if (hasAccounts)
            {
                return BadRequest(new { message = "या कर्ज योजनेवर खाती उपलब्ध आहेत. त्यामुळे ही योजना डिलीट करता येणार नाही." });
            }

            // Also check if any pending loan applications exist for this loan rate
            var hasApplications = await _context.LoanApplications.AnyAsync(a => a.LoanRateID == id);
            if (hasApplications)
            {
                return BadRequest(new { message = "या कर्ज योजनेवर कर्ज अर्ज उपलब्ध आहेत. त्यामुळे ही योजना डिलीट करता येणार नाही." });
            }

            string deletedInfo = $"कर्ज योजना डिलीट केली: {loanRate.LoanType} (Code: {loanRate.LoanCode}), व्याजदर: {loanRate.InterestRate}%, मुदत: {loanRate.DurationMonths} महिने";

            _context.LoanRates.Remove(loanRate);
            await _context.SaveChangesAsync();

            // Audit Trail for Loan Scheme Deletion
            await LogAuditAsync(
                "DELETE_LOAN_SCHEME",
                id.ToString(),
                deletedInfo
            );

            return NoContent();
        }

        private bool LoanRateExists(int id)
        {
            return _context.LoanRates.Any(e => e.LoanRateID == id);
        }
    }
}
