using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Services;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class NpaController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly NpaEngineService _npaService;

        public NpaController(AppDbContext context)
        {
            _context = context;
            _npaService = new NpaEngineService(context);
        }

        // POST: api/npa/run
        [HttpPost("run")]
        public async Task<IActionResult> RunClassification([FromBody] NpaRunRequest request)
        {
            try
            {
                var runDate = request.AsOfDate ?? DateTime.Today;
                var run = await _npaService.RunClassificationAsync(runDate, request.TriggeredBy ?? "Auditor");
                return Ok(run);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        // GET: api/npa/runs
        [HttpGet("runs")]
        public async Task<ActionResult<IEnumerable<NpaClassificationRun>>> GetRuns()
        {
            return await _context.NpaClassificationRuns
                .OrderByDescending(r => r.RunDate)
                .Take(50)
                .ToListAsync();
        }

        // GET: api/npa/status/{loanAccountId}
        [HttpGet("status/{loanAccountId}")]
        public async Task<IActionResult> GetAccountNpaStatus(int loanAccountId)
        {
            var status = await _context.LoanAccountNpaStatuses
                .Where(s => s.LoanAccountID == loanAccountId)
                .OrderByDescending(s => s.AsOfDate)
                .FirstOrDefaultAsync();

            if (status == null)
            {
                return NotFound();
            }

            return Ok(new
            {
                status.Category,
                status.OverdueDays,
                CategoryMarathi = GetCategoryMarathi(status.Category)
            });
        }

        // GET: api/npa/statement
        [HttpGet("statement")]
        public async Task<IActionResult> GetNpaStatement([FromQuery] DateTime? asOfDate, [FromQuery] int? branchId = null)
        {
            var date = asOfDate ?? DateTime.Today;
            
            // Find the latest classification run before or on this date
            var latestRun = await _context.NpaClassificationRuns
                .Where(r => r.RunDate.Date <= date.Date && r.Status == "Success")
                .OrderByDescending(r => r.RunDate)
                .FirstOrDefaultAsync();

            if (latestRun == null)
            {
                // If no run exists, trigger one automatically for this date
                latestRun = await _npaService.RunClassificationAsync(date, "Auto-Triggered");
            }

            var statuses = await _context.LoanAccountNpaStatuses
                .Include(s => s.LoanAccount)
                .ThenInclude(l => l.Member)
                .Where(s => s.AsOfDate.Date == date.Date)
                .ToListAsync();

            if (!statuses.Any())
            {
                // Fallback to latest available run
                var lastAvailableDate = await _context.LoanAccountNpaStatuses
                    .OrderByDescending(s => s.AsOfDate)
                    .Select(s => s.AsOfDate)
                    .FirstOrDefaultAsync();

                if (lastAvailableDate != default)
                {
                    statuses = await _context.LoanAccountNpaStatuses
                        .Include(s => s.LoanAccount)
                        .ThenInclude(l => l.Member)
                        .Where(s => s.AsOfDate.Date == lastAvailableDate.Date)
                        .ToListAsync();
                    date = lastAvailableDate;
                }
            }

            if (branchId.HasValue && branchId.Value > 0)
            {
                statuses = statuses.Where(s => s.LoanAccount != null && s.LoanAccount.BranchID == branchId.Value).ToList();
            }

            decimal grossAdvances = statuses.Sum(s => s.OutstandingBalance);
            decimal grossNpa = statuses.Where(s => s.Category != "Standard").Sum(s => s.OutstandingBalance);
            decimal grossNpaPercent = grossAdvances > 0 ? (grossNpa / grossAdvances) * 100m : 0;

            // Deductions: (a) Overdue Interest Reserve, (b) Lump-sum Repayment scheme deposits
            // Fetch Overdue Interest Reserve ledger credit balance
            var ledgerOverdueIntProv = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName == "थकीत व्याज तरतूद खाते");
            decimal overdueInterestReserve = 0;
            if (ledgerOverdueIntProv != null)
            {
                // In our implementation, we sum the balance of the contra log
                overdueInterestReserve = await _context.OverdueInterestLedgers.SumAsync(l => l.CreditAmount - l.DebitAmount);
                if (overdueInterestReserve < 0) overdueInterestReserve = 0;
                
                // Fallback: if ledger transactions are empty, sum interest balance from all active NPA accounts
                if (overdueInterestReserve == 0)
                {
                    overdueInterestReserve = statuses.Where(s => s.Category != "Standard")
                        .Sum(s => (s.LoanAccount?.InterestBalance ?? 0) + (s.LoanAccount?.OverdueInterestBalance ?? 0));
                }
            }

            // (b) Amount held in lump-sum-repayment-scheme/recovery deposit accounts
            // Sum saving transactions in recovery deposit accounts or default to 0
            decimal recoveryDeposits = 0;

            decimal totalDeductions = overdueInterestReserve + recoveryDeposits;
            decimal totalProvision = statuses.Sum(s => s.ProvisionRequired);

            decimal netAdvances = grossAdvances - totalProvision;
            decimal netNpa = grossNpa - totalDeductions - totalProvision;
            if (netNpa < 0) netNpa = 0;
            decimal netNpaPercent = netAdvances > 0 ? (netNpa / netAdvances) * 100m : 0;

            var sanstha = await _context.SansthaDetails.FirstOrDefaultAsync() ?? new SansthaDetail
            {
                SansthaName = "सहकारी पतसंस्था मर्यादित",
                Address = "महाराष्ट्र"
            };

            var statement = new NpaStatementDto
            {
                SansthaName = sanstha.SansthaName,
                Address = sanstha.Address,
                AsOfDate = date,
                GrossAdvances = Math.Round(grossAdvances / 100000m, 2), // in Lakhs
                GrossNpa = Math.Round(grossNpa / 100000m, 2),
                GrossNpaPercent = Math.Round(grossNpaPercent, 2),
                OverdueInterestReserve = Math.Round(overdueInterestReserve / 100000m, 2),
                RecoveryDeposits = Math.Round(recoveryDeposits / 100000m, 2),
                TotalDeductions = Math.Round(totalDeductions / 100000m, 2),
                TotalProvision = Math.Round(totalProvision / 100000m, 2),
                NetAdvances = Math.Round(netAdvances / 100000m, 2),
                NetNpa = Math.Round(netNpa / 100000m, 2),
                NetNpaPercent = Math.Round(netNpaPercent, 2)
            };

            return Ok(statement);
        }

        // GET: api/npa/breakup
        [HttpGet("breakup")]
        public async Task<IActionResult> GetCategoryBreakup([FromQuery] DateTime? asOfDate, [FromQuery] int? branchId = null)
        {
            var date = asOfDate ?? DateTime.Today;

            var statuses = await _context.LoanAccountNpaStatuses
                .Include(s => s.LoanAccount)
                .Where(s => s.AsOfDate.Date == date.Date)
                .ToListAsync();

            if (!statuses.Any())
            {
                var lastAvailableDate = await _context.LoanAccountNpaStatuses
                    .OrderByDescending(s => s.AsOfDate)
                    .Select(s => s.AsOfDate)
                    .FirstOrDefaultAsync();

                if (lastAvailableDate != default)
                {
                    statuses = await _context.LoanAccountNpaStatuses
                        .Include(s => s.LoanAccount)
                        .Where(s => s.AsOfDate.Date == lastAvailableDate.Date)
                        .ToListAsync();
                }
            }

            if (branchId.HasValue && branchId.Value > 0)
            {
                statuses = statuses.Where(s => s.LoanAccount != null && s.LoanAccount.BranchID == branchId.Value).ToList();
            }

            var categories = new[] { "Standard", "Sub-Standard", "Doubtful-1", "Doubtful-2", "Doubtful-3", "Loss" };
            var breakup = new List<CategoryBreakupDto>();

            foreach (var cat in categories)
            {
                var catStatuses = statuses.Where(s => s.Category == cat).ToList();
                decimal outstanding = catStatuses.Sum(s => s.OutstandingBalance);
                decimal secured = catStatuses.Sum(s => Math.Min(s.OutstandingBalance, s.CompliantCollateralValue));
                decimal unsecured = outstanding - secured;

                breakup.Add(new CategoryBreakupDto
                {
                    Category = cat,
                    CategoryMarathi = GetCategoryMarathi(cat),
                    AccountCount = catStatuses.Count,
                    GrossOutstanding = Math.Round(outstanding / 100000m, 2),
                    SecuredOutstanding = Math.Round(secured / 100000m, 2),
                    UnsecuredOutstanding = Math.Round(unsecured / 100000m, 2),
                    ProvisionRequired = Math.Round(catStatuses.Sum(s => s.ProvisionRequired) / 100000m, 2),
                    ProvisionHeld = Math.Round(catStatuses.Sum(s => s.ProvisionHeld) / 100000m, 2)
                });
            }

            return Ok(breakup);
        }

        // GET: api/npa/defaulters
        [HttpGet("defaulters")]
        public async Task<IActionResult> GetDefaultersAndLargeBorrowers([FromQuery] DateTime? asOfDate, [FromQuery] int? branchId = null)
        {
            var date = asOfDate ?? DateTime.Today;

            var statuses = await _context.LoanAccountNpaStatuses
                .Include(s => s.LoanAccount)
                .ThenInclude(l => l!.Member)
                .Where(s => s.AsOfDate.Date == date.Date)
                .ToListAsync();

            if (!statuses.Any())
            {
                var lastAvailableDate = await _context.LoanAccountNpaStatuses
                    .OrderByDescending(s => s.AsOfDate)
                    .Select(s => s.AsOfDate)
                    .FirstOrDefaultAsync();

                if (lastAvailableDate != default)
                {
                    statuses = await _context.LoanAccountNpaStatuses
                        .Include(s => s.LoanAccount)
                        .ThenInclude(l => l!.Member)
                        .Where(s => s.AsOfDate.Date == lastAvailableDate.Date)
                        .ToListAsync();
                }
            }

            if (branchId.HasValue && branchId.Value > 0)
            {
                statuses = statuses.Where(s => s.LoanAccount != null && s.LoanAccount.BranchID == branchId.Value).ToList();
            }

            var topDefaulters = statuses
                .Where(s => s.Category != "Standard")
                .OrderByDescending(s => s.OutstandingBalance)
                .Take(20)
                .Select(s => new DefaulterRowDto
                {
                    LoanAccountID = s.LoanAccountID,
                    LoanAccountNo = s.LoanAccount?.LoanAccountNo ?? "",
                    BorrowerName = s.LoanAccount?.Member != null ? $"{s.LoanAccount.Member.FirstName} {s.LoanAccount.Member.LastName}" : "",
                    Category = s.Category,
                    CategoryMarathi = GetCategoryMarathi(s.Category),
                    OutstandingBalance = Math.Round(s.OutstandingBalance / 100000m, 2),
                    OverdueDate = s.OverdueDate ?? s.OutOfOrderDate,
                    OverdueDays = s.OverdueDate.HasValue ? (date - s.OverdueDate.Value).Days : (s.OutOfOrderDate.HasValue ? (date - s.OutOfOrderDate.Value).Days : 0)
                })
                .ToList();

            var topLargeStandard = statuses
                .Where(s => s.Category == "Standard")
                .OrderByDescending(s => s.OutstandingBalance)
                .Take(20)
                .Select(s => new DefaulterRowDto
                {
                    LoanAccountID = s.LoanAccountID,
                    LoanAccountNo = s.LoanAccount?.LoanAccountNo ?? "",
                    BorrowerName = s.LoanAccount?.Member != null ? $"{s.LoanAccount.Member.FirstName} {s.LoanAccount.Member.LastName}" : "",
                    Category = s.Category,
                    CategoryMarathi = GetCategoryMarathi(s.Category),
                    OutstandingBalance = Math.Round(s.OutstandingBalance / 100000m, 2),
                    OverdueDate = null,
                    OverdueDays = 0
                })
                .ToList();

            return Ok(new
            {
                Defaulters = topDefaulters,
                LargeStandardBorrowers = topLargeStandard
            });
        }

        // GET: api/npa/register
        [HttpGet("register")]
        public async Task<IActionResult> GetNpaRegister([FromQuery] DateTime? asOfDate, [FromQuery] int? branchId = null)
        {
            var date = asOfDate ?? DateTime.Today;

            var statuses = await _context.LoanAccountNpaStatuses
                .AsNoTracking()
                .Include(s => s.LoanAccount)
                    .ThenInclude(l => l!.Member)
                .Include(s => s.LoanAccount)
                    .ThenInclude(l => l!.LoanRate)
                .Include(s => s.LoanAccount!.LoanInstallmentSchedules)
                .Where(s => s.AsOfDate.Date == date.Date)
                .ToListAsync();

            if (!statuses.Any())
            {
                var lastAvailableDate = await _context.LoanAccountNpaStatuses
                    .AsNoTracking()
                    .OrderByDescending(s => s.AsOfDate)
                    .Select(s => s.AsOfDate)
                    .FirstOrDefaultAsync();

                if (lastAvailableDate != default)
                {
                    statuses = await _context.LoanAccountNpaStatuses
                        .AsNoTracking()
                        .Include(s => s.LoanAccount)
                            .ThenInclude(l => l!.Member)
                        .Include(s => s.LoanAccount)
                            .ThenInclude(l => l!.LoanRate)
                        .Include(s => s.LoanAccount!.LoanInstallmentSchedules)
                        .Where(s => s.AsOfDate.Date == lastAvailableDate.Date)
                        .ToListAsync();
                    date = lastAvailableDate;
                }
            }

            if (branchId.HasValue && branchId.Value > 0)
            {
                statuses = statuses.Where(s => s.LoanAccount != null && s.LoanAccount.BranchID == branchId.Value).ToList();
            }

            var config = await _context.NpaConfigs.OrderByDescending(c => c.FinancialYear).FirstOrDefaultAsync();
            int concessionDays = config?.ConcessionPeriodDays ?? 90;

            var register = statuses.Select(s => {
                var loan = s.LoanAccount!;
                
                // Unpaid schedules for principal and interest overdue calculation
                var unpaidSchedules = loan.LoanInstallmentSchedules
                    .Where(sch => sch.DueDate <= date.Date && sch.Status != "Paid")
                    .ToList();
                
                int overdueInstallments = unpaidSchedules.Count;
                decimal overduePrincipal = unpaidSchedules.Sum(sch => sch.PrincipalAmount);
                decimal scheduleInterestDue = unpaidSchedules.Sum(sch => sch.InterestAmount);

                decimal dbInterest = loan.InterestBalance + loan.OverdueInterestBalance;
                decimal receivableInterest = Math.Max(dbInterest, scheduleInterestDue);

                // Calculate exact expected interest based on elapsed days from disbursement/opening date
                DateTime startDate = loan.LoanDisbursementDate ?? loan.LastInstallmentPaidDate ?? loan.OpeningDate;
                double elapsedDays = (date.Date - startDate.Date).TotalDays;
                if (elapsedDays < 1) elapsedDays = 1;

                decimal expectedInterest = 0;
                if (loan.InterestRate > 0 && loan.PrincipalBalance > 0)
                {
                    expectedInterest = Math.Round(loan.PrincipalBalance * (loan.InterestRate / 100m) * ((decimal)elapsedDays / 365m), 2);
                }

                // 1. Fallback if stored interest is 0
                if (receivableInterest == 0 && expectedInterest > 0)
                {
                    receivableInterest = expectedInterest;
                }
                // 2. Detect & fix legacy paise storage multiplier error (e.g. 13149.37 stored as 1314937)
                else if (expectedInterest > 0 && receivableInterest > (expectedInterest * 5m))
                {
                    if (Math.Abs((receivableInterest / 100m) - expectedInterest) < (expectedInterest * 0.5m))
                    {
                        receivableInterest = Math.Round(receivableInterest / 100m, 2);
                    }
                    else
                    {
                        receivableInterest = expectedInterest;
                    }
                }

                decimal totalOutstanding = loan.PrincipalBalance + receivableInterest;
                decimal overdueAmount = overduePrincipal > 0 ? (overduePrincipal + receivableInterest) : (loan.PrincipalBalance + receivableInterest);
                
                int overdueMonths = 0;
                DateTime? npaDate = null;
                
                if (s.OverdueDate.HasValue || s.OutOfOrderDate.HasValue)
                {
                    var oDate = s.OverdueDate ?? s.OutOfOrderDate!.Value;
                    overdueMonths = (int)Math.Floor((date.Date - oDate).TotalDays / 30.0);
                    npaDate = oDate.AddDays(concessionDays);
                }

                decimal balanceForProvisioning = loan.PrincipalBalance > 0 ? loan.PrincipalBalance : Math.Max(0, totalOutstanding - receivableInterest);
                
                decimal npaPercentage = 0;
                if (balanceForProvisioning > 0)
                {
                    npaPercentage = Math.Round((s.ProvisionRequired / balanceForProvisioning) * 100m, 2);
                    if (npaPercentage > 100) npaPercentage = 100;
                }
                else if (s.Category == "Loss")
                {
                    npaPercentage = 100;
                }

                decimal collateralVal = s.CompliantCollateralValue > 0 ? s.CompliantCollateralValue : loan.SecurityValue;
                decimal securedAmount = Math.Min(totalOutstanding, collateralVal);
                decimal unsecuredAmount = Math.Max(0, totalOutstanding - securedAmount);

                return new NpaRegisterDto
                {
                    LoanAccountID = s.LoanAccountID,
                    AccountNo = loan.LoanAccountNo,
                    MemberCode = loan.Member?.MemberCode ?? loan.Member?.OldMemberCode ?? (loan.MemberID > 0 ? loan.MemberID.ToString() : "-"),
                    Name = loan.Member != null ? $"{loan.Member.FirstName} {loan.Member.LastName}".Trim() : "Unknown",
                    LoanType = loan.LoanRate?.ShortName ?? loan.LoanRate?.LoanType ?? "सामान्य कर्ज",
                    SanctionedAmount = Math.Round(loan.SanctionedAmount, 2),
                    DisbursementDate = loan.LoanDisbursementDate,
                    PrincipalBalance = Math.Round(loan.PrincipalBalance, 2),
                    OutstandingBalance = Math.Round(totalOutstanding, 2),
                    OverdueDate = s.OverdueDate ?? s.OutOfOrderDate,
                    OverdueAmount = Math.Round(overdueAmount, 2),
                    OverdueInstallments = overdueInstallments,
                    InstallmentAmount = Math.Round(loan.InstallmentAmount, 2),
                    OverdueMonths = overdueMonths,
                    NpaDate = npaDate,
                    ReceivableInterest = Math.Round(receivableInterest, 2),
                    BalanceForProvisioning = Math.Round(balanceForProvisioning, 2),
                    SecurityType = string.IsNullOrWhiteSpace(loan.SecurityDetails) ? s.SecurityType : loan.SecurityDetails,
                    CollateralValue = Math.Round(collateralVal, 2),
                    SecuredAmount = Math.Round(securedAmount, 2),
                    UnsecuredAmount = Math.Round(unsecuredAmount, 2),
                    NpaPercentage = npaPercentage,
                    ProvisionAmount = Math.Round(s.ProvisionRequired, 2),
                    Category = s.Category,
                    CategoryMarathi = GetCategoryMarathi(s.Category)
                };
            }).OrderBy(x => x.AccountNo).ToList();

            return Ok(register);
        }

        // POST: api/npa/certify-loss
        [HttpPost("certify-loss")]
        public async Task<IActionResult> CertifyLossAsset([FromBody] CertifyLossRequest request)
        {
            var loan = await _context.LoanAccounts.FindAsync(request.LoanAccountID);
            if (loan == null) return NotFound("Loan account not found");

            // Look up latest run
            var latestRun = await _context.NpaClassificationRuns
                .OrderByDescending(r => r.RunDate)
                .FirstOrDefaultAsync();

            int runId = latestRun?.NpaClassificationRunID ?? 0;

            var asOfDate = request.AsOfDate ?? DateTime.Today;

            var existingStatus = await _context.LoanAccountNpaStatuses
                .FirstOrDefaultAsync(s => s.LoanAccountID == request.LoanAccountID && s.AsOfDate.Date == asOfDate.Date);

            decimal outstanding = loan.PrincipalBalance + loan.InterestBalance + loan.OverdueInterestBalance;

            if (existingStatus != null)
            {
                existingStatus.Category = "Loss";
                existingStatus.IsAutoClassified = false;
                existingStatus.AuditorRemarks = request.Remarks;
                existingStatus.ProvisionRequired = outstanding; // 100% provision
                _context.Entry(existingStatus).State = EntityState.Modified;
            }
            else
            {
                var newStatus = new LoanAccountNpaStatus
                {
                    LoanAccountID = request.LoanAccountID,
                    AsOfDate = asOfDate.Date,
                    Category = "Loss",
                    SecurityType = "Unsecured",
                    OutstandingBalance = outstanding,
                    CompliantCollateralValue = 0,
                    ProvisionRequired = outstanding,
                    ProvisionHeld = 0,
                    IsAutoClassified = false,
                    LastClassificationRunId = runId,
                    AuditorRemarks = request.Remarks
                };
                _context.LoanAccountNpaStatuses.Add(newStatus);
            }

            await _context.SaveChangesAsync();
            return Ok("Account certified as Loss Asset successfully.");
        }

        // GET: api/npa/compliance-logs
        [HttpGet("compliance-logs")]
        public async Task<ActionResult<IEnumerable<CollateralComplianceLog>>> GetComplianceLogs()
        {
            return await _context.CollateralComplianceLogs
                .Include(c => c.LoanAccount)
                .ThenInclude(l => l!.Member)
                .OrderByDescending(c => c.ValuationDate)
                .ToListAsync();
        }

        // GET: api/npa/config
        [HttpGet("config")]
        public async Task<IActionResult> GetNpaConfig([FromQuery] string? financialYear)
        {
            var fy = financialYear;
            if (string.IsNullOrEmpty(fy))
            {
                var activeFy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
                fy = activeFy?.YearCode.Trim() ?? "2026-27";
            }

            var config = await _context.NpaConfigs.FirstOrDefaultAsync(c => c.FinancialYear == fy);
            if (config == null)
            {
                config = new NpaConfig { FinancialYear = fy, ConcessionPeriodDays = 180 };
                _context.NpaConfigs.Add(config);
                await _context.SaveChangesAsync();
            }

            return Ok(config);
        }

        // POST: api/npa/config
        [HttpPost("config")]
        public async Task<IActionResult> SaveNpaConfig([FromBody] NpaConfig config)
        {
            if (config == null || string.IsNullOrWhiteSpace(config.FinancialYear))
                return BadRequest("Invalid NPA config data.");

            var existing = await _context.NpaConfigs.FirstOrDefaultAsync(c => c.FinancialYear == config.FinancialYear);
            if (existing != null)
            {
                existing.ConcessionPeriodDays = config.ConcessionPeriodDays;
                _context.Entry(existing).State = EntityState.Modified;
            }
            else
            {
                _context.NpaConfigs.Add(config);
            }

            await _context.SaveChangesAsync();
            return Ok(config);
        }

        // GET: api/npa/slabs
        [HttpGet("slabs")]
        public async Task<ActionResult<IEnumerable<NpaProvisionSlab>>> GetNpaSlabs([FromQuery] string? financialYear)
        {
            var fy = financialYear;
            if (string.IsNullOrEmpty(fy))
            {
                var activeFy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
                fy = activeFy?.YearCode.Trim() ?? "2026-27";
            }

            var slabs = await _context.NpaProvisionSlabs
                .Where(s => s.FinancialYear == fy)
                .OrderBy(s => s.NpaProvisionSlabID)
                .ToListAsync();

            if (!slabs.Any())
            {
                // Seed default RBI / Co-op Bank Slabs
                slabs = new List<NpaProvisionSlab>
                {
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Standard", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 0, OverdueOrOutOfOrderMonthsTo = 6, MinProvisionPercent = 0.40m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Sub-Standard", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 6, OverdueOrOutOfOrderMonthsTo = 18, NpaMonthsFrom = 0, NpaMonthsTo = 12, MinProvisionPercent = 15.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-1", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 18, OverdueOrOutOfOrderMonthsTo = 42, NpaMonthsFrom = 12, NpaMonthsTo = 36, MinProvisionPercent = 25.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-1", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 18, OverdueOrOutOfOrderMonthsTo = 42, NpaMonthsFrom = 12, NpaMonthsTo = 36, MinProvisionPercent = 80.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-2", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 42, OverdueOrOutOfOrderMonthsTo = 54, NpaMonthsFrom = 36, NpaMonthsTo = 48, MinProvisionPercent = 40.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-2", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 42, OverdueOrOutOfOrderMonthsTo = 54, NpaMonthsFrom = 36, NpaMonthsTo = 48, MinProvisionPercent = 90.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-3", SecurityType = "Secured", OverdueOrOutOfOrderMonthsFrom = 54, OverdueOrOutOfOrderMonthsTo = 999, NpaMonthsFrom = 48, NpaMonthsTo = 999, MinProvisionPercent = 100.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Doubtful-3", SecurityType = "Unsecured", OverdueOrOutOfOrderMonthsFrom = 54, OverdueOrOutOfOrderMonthsTo = 999, NpaMonthsFrom = 48, NpaMonthsTo = 999, MinProvisionPercent = 100.00m },
                    new NpaProvisionSlab { FinancialYear = fy, Category = "Loss", SecurityType = "Both", OverdueOrOutOfOrderMonthsFrom = 0, OverdueOrOutOfOrderMonthsTo = 999, MinProvisionPercent = 100.00m }
                };
                _context.NpaProvisionSlabs.AddRange(slabs);
                await _context.SaveChangesAsync();
            }

            return Ok(slabs);
        }

        // POST: api/npa/slabs
        [HttpPost("slabs")]
        public async Task<IActionResult> SaveNpaSlabs([FromBody] List<NpaProvisionSlab> slabs)
        {
            if (slabs == null || !slabs.Any())
                return BadRequest("No slabs provided.");

            foreach (var slab in slabs)
            {
                if (slab.NpaProvisionSlabID > 0)
                {
                    _context.Entry(slab).State = EntityState.Modified;
                }
                else
                {
                    _context.NpaProvisionSlabs.Add(slab);
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { Message = "NPA Provisioning Slabs saved successfully.", Count = slabs.Count });
        }

        private string GetCategoryMarathi(string cat)
        {
            return cat switch
            {
                "Standard" => "नियमित (Standard)",
                "Sub-Standard" => "दुय्यम (Sub-Standard)",
                "Doubtful-1" => "संशयास्पद-१ (Doubtful-1)",
                "Doubtful-2" => "संशयास्पद-२ (Doubtful-2)",
                "Doubtful-3" => "संशयास्पद-३ (Doubtful-3)",
                "Loss" => "तोटा (Loss)",
                _ => cat
            };
        }
    }

    public class NpaRunRequest
    {
        public DateTime? AsOfDate { get; set; }
        public string? TriggeredBy { get; set; }
    }

    public class CertifyLossRequest
    {
        public int LoanAccountID { get; set; }
        public string Remarks { get; set; } = string.Empty;
        public DateTime? AsOfDate { get; set; }
    }

    public class NpaStatementDto
    {
        public string SansthaName { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public DateTime AsOfDate { get; set; }
        public decimal GrossAdvances { get; set; }
        public decimal GrossNpa { get; set; }
        public decimal GrossNpaPercent { get; set; }
        public decimal OverdueInterestReserve { get; set; }
        public decimal RecoveryDeposits { get; set; }
        public decimal TotalDeductions { get; set; }
        public decimal TotalProvision { get; set; }
        public decimal NetAdvances { get; set; }
        public decimal NetNpa { get; set; }
        public decimal NetNpaPercent { get; set; }
    }

    public class CategoryBreakupDto
    {
        public string Category { get; set; } = string.Empty;
        public string CategoryMarathi { get; set; } = string.Empty;
        public int AccountCount { get; set; }
        public decimal GrossOutstanding { get; set; }
        public decimal SecuredOutstanding { get; set; }
        public decimal UnsecuredOutstanding { get; set; }
        public decimal ProvisionRequired { get; set; }
        public decimal ProvisionHeld { get; set; }
    }

    public class DefaulterRowDto
    {
        public int LoanAccountID { get; set; }
        public string LoanAccountNo { get; set; } = string.Empty;
        public string BorrowerName { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string CategoryMarathi { get; set; } = string.Empty;
        public decimal OutstandingBalance { get; set; }
        public DateTime? OverdueDate { get; set; }
        public int OverdueDays { get; set; }
    }

    public class NpaRegisterDto
    {
        public int LoanAccountID { get; set; }
        public string AccountNo { get; set; } = string.Empty;
        public string MemberCode { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string LoanType { get; set; } = string.Empty;
        public decimal SanctionedAmount { get; set; }
        public DateTime? DisbursementDate { get; set; }
        public decimal PrincipalBalance { get; set; }
        public decimal OutstandingBalance { get; set; }
        public DateTime? OverdueDate { get; set; }
        public decimal OverdueAmount { get; set; }
        public int OverdueInstallments { get; set; }
        public decimal InstallmentAmount { get; set; }
        public int OverdueMonths { get; set; }
        public DateTime? NpaDate { get; set; }
        public decimal ReceivableInterest { get; set; }
        public decimal BalanceForProvisioning { get; set; }
        public string SecurityType { get; set; } = string.Empty;
        public decimal CollateralValue { get; set; }
        public decimal SecuredAmount { get; set; }
        public decimal UnsecuredAmount { get; set; }
        public decimal NpaPercentage { get; set; }
        public decimal ProvisionAmount { get; set; }
        public string Category { get; set; } = string.Empty;
        public string CategoryMarathi { get; set; } = string.Empty;
    }

    public static class NpaLedgerExtensions
    {
        public static string DrCr(this OverdueInterestLedger l)
        {
            if (l.DebitAmount > 0) return "Dr";
            return "Cr";
        }
    }
}
