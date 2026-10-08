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
    public class LoanCollateralsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LoanCollateralsController(AppDbContext context)
        {
            _context = context;
        }

        private (int userId, string username) GetCurrentUserContext()
        {
            int userId = 1;
            string username = "System";
            var userClaim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("UserID") ?? User.FindFirst("sub");
            if (userClaim != null && int.TryParse(userClaim.Value, out int uid)) userId = uid;

            var nameClaim = User.FindFirst(ClaimTypes.Name) ?? User.FindFirst("Username");
            if (nameClaim != null && !string.IsNullOrWhiteSpace(nameClaim.Value)) username = nameClaim.Value;

            return (userId, username);
        }

        public class EligibleDepositDto
        {
            public string DepositType { get; set; } = string.Empty; // FixedDeposit, PigmyDeposit, RecurringDeposit, SavingDeposit
            public int DepositAccountID { get; set; }
            public string AccountNo { get; set; } = string.Empty;
            public decimal DepositAmount { get; set; }
            public decimal CurrentBalance { get; set; }
            public decimal InterestRate { get; set; }
            public DateTime OpeningDate { get; set; }
            public DateTime? MaturityDate { get; set; }
            public bool IsLienMarked { get; set; }
            public string? LienLoanAccountNo { get; set; }
            public decimal? LienAmount { get; set; }
            public decimal MaxEligibleLoan { get; set; }
            public string SchemeName { get; set; } = string.Empty;
        }

        // GET: api/LoanCollaterals/EligibleDeposits?customerId=5&collateralCategory=FixedDeposit&maxLtv=85
        [HttpGet("EligibleDeposits")]
        public async Task<ActionResult<IEnumerable<EligibleDepositDto>>> GetEligibleDeposits(
            [FromQuery] int customerId, 
            [FromQuery] string? collateralCategory = "FixedDeposit",
            [FromQuery] decimal maxLtv = 85.00m)
        {
            if (customerId <= 0) return BadRequest("अवैध ग्राहक आयडी (Invalid Customer ID).");

            var results = new List<EligibleDepositDto>();
            decimal ltvFactor = maxLtv > 0 ? (maxLtv / 100m) : 0.85m;

            var category = collateralCategory?.Trim() ?? "";

            // 1. Fixed Deposit (FD)
            if (category.Equals("FixedDeposit", StringComparison.OrdinalIgnoreCase) || category.Contains("FD") || category.Contains("मुदत"))
            {
                var fds = await _context.FdAccounts
                    .Include(f => f.FdScheme)
                    .Where(f => f.CustomerID == customerId && f.Status == "Active")
                    .OrderByDescending(f => f.OpeningDate)
                    .ToListAsync();

                foreach (var fd in fds)
                {
                    results.Add(new EligibleDepositDto
                    {
                        DepositType = "FixedDeposit",
                        DepositAccountID = fd.FdAccountID,
                        AccountNo = fd.AccountNo,
                        DepositAmount = fd.DepositAmount,
                        CurrentBalance = fd.DepositAmount,
                        InterestRate = fd.InterestRate,
                        OpeningDate = fd.OpeningDate,
                        MaturityDate = fd.MaturityDate,
                        IsLienMarked = fd.IsLienMarked,
                        LienLoanAccountNo = fd.LienLoanAccountNo,
                        LienAmount = fd.LienAmount,
                        MaxEligibleLoan = Math.Round(fd.DepositAmount * ltvFactor, 2),
                        SchemeName = fd.FdScheme?.SchemeName ?? "मुदत ठेव योजना"
                    });
                }
            }
            // 2. Pigmy / Daily Deposit
            else if (category.Equals("PigmyDeposit", StringComparison.OrdinalIgnoreCase) || category.Contains("Pigmy") || category.Contains("पिग्मी"))
            {
                var pigmies = await _context.PigmyAccounts
                    .Include(p => p.PigmyScheme)
                    .Where(p => p.CustomerID == customerId && p.Status == "Active")
                    .OrderByDescending(p => p.OpeningDate)
                    .ToListAsync();

                foreach (var pg in pigmies)
                {
                    decimal netBalance = Math.Max(0, pg.TotalDepositedAmount - pg.TotalWithdrawnAmount);
                    results.Add(new EligibleDepositDto
                    {
                        DepositType = "PigmyDeposit",
                        DepositAccountID = pg.PigmyAccountID,
                        AccountNo = pg.AccountNo,
                        DepositAmount = pg.TotalDepositedAmount,
                        CurrentBalance = netBalance,
                        InterestRate = pg.InterestRate,
                        OpeningDate = pg.OpeningDate,
                        MaturityDate = pg.MaturityDate,
                        IsLienMarked = pg.IsLienMarked,
                        LienLoanAccountNo = pg.LienLoanAccountNo,
                        LienAmount = pg.LienAmount,
                        MaxEligibleLoan = Math.Round(netBalance * ltvFactor, 2),
                        SchemeName = pg.PigmyScheme?.SchemeName ?? "दैनिक पिग्मी ठेव योजना"
                    });
                }
            }
            // 3. Recurring Deposit (RD)
            else if (category.Equals("RecurringDeposit", StringComparison.OrdinalIgnoreCase) || category.Contains("RD") || category.Contains("आवर्ती"))
            {
                var rds = await _context.RdAccounts
                    .Include(r => r.RdScheme)
                    .Where(r => r.CustomerID == customerId && r.Status == "Active")
                    .OrderByDescending(r => r.OpeningDate)
                    .ToListAsync();

                foreach (var rd in rds)
                {
                    results.Add(new EligibleDepositDto
                    {
                        DepositType = "RecurringDeposit",
                        DepositAccountID = rd.RdAccountID,
                        AccountNo = rd.AccountNo,
                        DepositAmount = rd.TotalDepositedAmount,
                        CurrentBalance = rd.TotalDepositedAmount,
                        InterestRate = rd.InterestRate,
                        OpeningDate = rd.OpeningDate,
                        MaturityDate = rd.MaturityDate,
                        IsLienMarked = rd.IsLienMarked,
                        LienLoanAccountNo = rd.LienLoanAccountNo,
                        LienAmount = rd.LienAmount,
                        MaxEligibleLoan = Math.Round(rd.TotalDepositedAmount * ltvFactor, 2),
                        SchemeName = rd.RdScheme?.SchemeName ?? "आवर्ती ठेव योजना"
                    });
                }
            }
            // 4. Saving Deposit
            else if (category.Equals("SavingDeposit", StringComparison.OrdinalIgnoreCase) || category.Contains("Saving") || category.Contains("बचत"))
            {
                var savings = await _context.SavingAccountMasters
                    .Where(s => s.CustomerID == customerId && s.Status == "Active")
                    .OrderByDescending(s => s.OpeningDate)
                    .ToListAsync();

                foreach (var s in savings)
                {
                    results.Add(new EligibleDepositDto
                    {
                        DepositType = "SavingDeposit",
                        DepositAccountID = s.SavingAccountID,
                        AccountNo = s.AccountNo,
                        DepositAmount = s.CurrentBalance,
                        CurrentBalance = s.CurrentBalance,
                        InterestRate = s.InterestRate,
                        OpeningDate = s.OpeningDate,
                        MaturityDate = null,
                        IsLienMarked = s.LienAmount > 0,
                        LienLoanAccountNo = s.LienReason,
                        LienAmount = s.LienAmount,
                        MaxEligibleLoan = Math.Round(s.CurrentBalance * ltvFactor, 2),
                        SchemeName = "बचत ठेव खाते"
                    });
                }
            }

            return Ok(results);
        }

        // GET: api/LoanCollaterals/ByApplication/5
        [HttpGet("ByApplication/{applicationId}")]
        public async Task<ActionResult<IEnumerable<LoanDepositCollateral>>> GetByApplication(int applicationId)
        {
            return await _context.LoanDepositCollaterals
                .Where(c => c.LoanApplicationID == applicationId)
                .OrderBy(c => c.CollateralID)
                .ToListAsync();
        }

        // GET: api/LoanCollaterals/ByAccount/5
        [HttpGet("ByAccount/{accountId}")]
        public async Task<ActionResult<IEnumerable<LoanDepositCollateral>>> GetByAccount(int accountId)
        {
            return await _context.LoanDepositCollaterals
                .Where(c => c.LoanAccountID == accountId)
                .OrderBy(c => c.CollateralID)
                .ToListAsync();
        }

        // POST: api/LoanCollaterals/SaveApplicationCollaterals/5
        [HttpPost("SaveApplicationCollaterals/{applicationId}")]
        public async Task<IActionResult> SaveApplicationCollaterals(int applicationId, [FromBody] List<LoanDepositCollateralDto> collaterals)
        {
            var app = await _context.LoanApplications.FindAsync(applicationId);
            if (app == null) return NotFound("कर्ज अर्ज सापडला नाही.");

            var existing = await _context.LoanDepositCollaterals
                .Where(c => c.LoanApplicationID == applicationId)
                .ToListAsync();

            if (existing.Any())
            {
                _context.LoanDepositCollaterals.RemoveRange(existing);
            }

            if (collaterals != null && collaterals.Any())
            {
                var (userId, _) = GetCurrentUserContext();
                foreach (var c in collaterals)
                {
                    _context.LoanDepositCollaterals.Add(new LoanDepositCollateral
                    {
                        LoanApplicationID = applicationId,
                        CustomerID = app.CustomerID ?? c.CustomerID,
                        CollateralType = c.CollateralType,
                        DepositAccountID = c.DepositAccountID,
                        DepositAccountNo = c.DepositAccountNo,
                        DepositAmount = c.DepositAmount,
                        CurrentDepositBalance = c.CurrentDepositBalance,
                        MaturityDate = c.MaturityDate,
                        LienAmount = c.LienAmount > 0 ? c.LienAmount : c.DepositAmount,
                        LienStatus = "Pledged",
                        Remarks = c.Remarks,
                        CreatedBy = userId,
                        CreatedDate = DateTime.Now
                    });
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "तारण तपशील यशस्वीरित्या सेव्ह झाला." });
        }

        // POST: api/LoanCollaterals/ReleaseLien/5
        [HttpPost("ReleaseLien/{collateralId}")]
        public async Task<IActionResult> ReleaseLien(int collateralId)
        {
            var collateral = await _context.LoanDepositCollaterals.FindAsync(collateralId);
            if (collateral == null) return NotFound("तारण नोंद सापडली नाही.");

            var (userId, username) = GetCurrentUserContext();

            collateral.LienStatus = "Released";
            collateral.LienReleasedDate = DateTime.Now;

            // Release lien on the underlying account
            if (collateral.CollateralType == "FixedDeposit")
            {
                var fd = await _context.FdAccounts.FindAsync(collateral.DepositAccountID);
                if (fd != null)
                {
                    fd.IsLienMarked = false;
                    fd.LienLoanAccountNo = null;
                    fd.LienAmount = 0;
                }
            }
            else if (collateral.CollateralType == "PigmyDeposit")
            {
                var pg = await _context.PigmyAccounts.FindAsync(collateral.DepositAccountID);
                if (pg != null)
                {
                    pg.IsLienMarked = false;
                    pg.LienLoanAccountNo = null;
                    pg.LienAmount = 0;
                }
            }
            else if (collateral.CollateralType == "RecurringDeposit")
            {
                var rd = await _context.RdAccounts.FindAsync(collateral.DepositAccountID);
                if (rd != null)
                {
                    rd.IsLienMarked = false;
                    rd.LienLoanAccountNo = null;
                    rd.LienAmount = 0;
                }
            }
            else if (collateral.CollateralType == "SavingDeposit")
            {
                var sav = await _context.SavingAccountMasters.FindAsync(collateral.DepositAccountID);
                if (sav != null)
                {
                    sav.LienAmount = 0;
                    sav.LienReason = null;
                }
            }

            // Log Audit
            _context.AuditLogs.Add(new AuditLog
            {
                UserID = userId,
                Username = username,
                Action = "LIEN_RELEASED",
                EntityName = "LoanDepositCollateral",
                EntityID = collateralId.ToString(),
                Timestamp = DateTime.Now,
                Details = $"तारण बोजा मोकळा केला: ठेव खाते {collateral.DepositAccountNo} (प्रकार: {collateral.CollateralType})",
                Status = "Success"
            });

            await _context.SaveChangesAsync();
            return Ok(new { message = $"ठेव खाते {collateral.DepositAccountNo} वरील तारण बोजा यशस्वीरित्या काढण्यात आला." });
        }

        // POST: api/LoanCollaterals/ReleaseAllByLoan/5
        [HttpPost("ReleaseAllByLoan/{loanAccountId}")]
        public async Task<IActionResult> ReleaseAllByLoan(int loanAccountId)
        {
            var loanAcc = await _context.LoanAccounts.FindAsync(loanAccountId);
            if (loanAcc == null) return NotFound("कर्ज खाते सापडले नाही.");

            var activeCollaterals = await _context.LoanDepositCollaterals
                .Where(c => c.LoanAccountID == loanAccountId && c.LienStatus == "LienMarked")
                .ToListAsync();

            if (!activeCollaterals.Any())
            {
                return Ok(new { message = "सदर कर्ज खात्याशी कोणतीही सक्रिय तारण ठेव जोडलेली नाही किंवा बोजा आधीच मोकळा झाला आहे.", releasedCount = 0 });
            }

            var (userId, username) = GetCurrentUserContext();
            var releasedAccounts = new List<string>();

            foreach (var col in activeCollaterals)
            {
                col.LienStatus = "Released";
                col.LienReleasedDate = DateTime.Now;

                if (col.CollateralType == "FixedDeposit")
                {
                    var fd = await _context.FdAccounts.FindAsync(col.DepositAccountID);
                    if (fd != null)
                    {
                        fd.IsLienMarked = false;
                        fd.LienLoanAccountNo = null;
                        fd.LienAmount = 0;
                        _context.Entry(fd).State = EntityState.Modified;
                    }
                }
                else if (col.CollateralType == "PigmyDeposit")
                {
                    var pg = await _context.PigmyAccounts.FindAsync(col.DepositAccountID);
                    if (pg != null)
                    {
                        pg.IsLienMarked = false;
                        pg.LienLoanAccountNo = null;
                        pg.LienAmount = 0;
                        _context.Entry(pg).State = EntityState.Modified;
                    }
                }
                else if (col.CollateralType == "RecurringDeposit")
                {
                    var rd = await _context.RdAccounts.FindAsync(col.DepositAccountID);
                    if (rd != null)
                    {
                        rd.IsLienMarked = false;
                        rd.LienLoanAccountNo = null;
                        rd.LienAmount = 0;
                        _context.Entry(rd).State = EntityState.Modified;
                    }
                }
                else if (col.CollateralType == "SavingDeposit")
                {
                    var sav = await _context.SavingAccountMasters.FindAsync(col.DepositAccountID);
                    if (sav != null)
                    {
                        sav.LienAmount = 0;
                        sav.LienReason = null;
                        _context.Entry(sav).State = EntityState.Modified;
                    }
                }

                _context.AuditLogs.Add(new AuditLog
                {
                    UserID = userId,
                    Username = username,
                    Action = "LOAN_SETTLEMENT_LIEN_RELEASED",
                    EntityName = "LoanDepositCollateral",
                    EntityID = col.CollateralID.ToString(),
                    Timestamp = DateTime.Now,
                    Details = $"कर्ज खाते क्र. {loanAcc.LoanAccountNo} पूर्ण नील झाल्यामुळे {col.CollateralType} ठेव खाते क्र. {col.DepositAccountNo} वरील ₹{col.LienAmount} चा तारण बोजा मोकळा केला.",
                    Status = "Success"
                });

                releasedAccounts.Add($"{col.CollateralType} - {col.DepositAccountNo}");
            }

            await _context.SaveChangesAsync();

            return Ok(new {
                message = $"कर्ज खाते क्र. {loanAcc.LoanAccountNo} मधील एकूण {activeCollaterals.Count} तारण ठेवींवरील बोजा यशस्वीरित्या काढण्यात आला!",
                releasedCount = activeCollaterals.Count,
                releasedAccounts = releasedAccounts
            });
        }
    }
}
