using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Helpers;
using Bhisi.Api.Models;
using Bhisi.Api.Services;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class NpaController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly NpaEngineService _npaService;

        public NpaController(AppDbContext context)
        {
            _context = context;
            _npaService = new NpaEngineService(context);
        }

        private async Task<List<LoanAccountNpaStatus>> EnsureAndLoadSnapshotAsync(DateTime targetDate, int? branchId, bool includeSchedules = false)
        {
            DateTime cleanDate = targetDate.Date;

            bool hasSnapshotForDate = await _context.LoanAccountNpaStatuses
                .AsNoTracking()
                .AnyAsync(s => s.AsOfDate.Date == cleanDate);

            if (!hasSnapshotForDate)
            {
                await _npaService.RunClassificationAsync(cleanDate, "Auto-Snapshot");
            }

            IQueryable<LoanAccountNpaStatus> query = _context.LoanAccountNpaStatuses
                .AsNoTracking()
                .Include(s => s.LoanAccount)
                    .ThenInclude(l => l!.Customer)
                .Include(s => s.LoanAccount)
                    .ThenInclude(l => l!.Member)
                        .ThenInclude(m => m!.Customer)
                .Include(s => s.LoanAccount)
                    .ThenInclude(l => l!.LoanRate);

            if (includeSchedules)
            {
                query = query.Include(s => s.LoanAccount!.LoanInstallmentSchedules);
            }

            var statuses = await query
                .Where(s => s.AsOfDate.Date == cleanDate)
                .ToListAsync();

            if (branchId.HasValue && branchId.Value > 0)
            {
                statuses = statuses
                    .Where(s => s.LoanAccount != null && s.LoanAccount.BranchID == branchId.Value)
                    .ToList();
            }

            return statuses;
        }

        private async Task<Dictionary<int, (decimal Principal, decimal ReceivableInterest, decimal OverdueInterest)>> ReconstructSnapshotBalancesMapAsync(
            List<LoanAccountNpaStatus> statuses,
            DateTime asOfDate)
        {
            DateTime cleanDate = asOfDate.Date;
            var loanIds = statuses.Select(s => s.LoanAccountID).Distinct().ToHashSet();

            var postColsByLoan = (await _context.LoanCollections
                .AsNoTracking()
                .Where(c => loanIds.Contains(c.LoanAccountID) && c.CollectionDate.Date > cleanDate)
                .ToListAsync())
                .GroupBy(c => c.LoanAccountID)
                .ToDictionary(g => g.Key, g => (IReadOnlyList<LoanCollection>)g.ToList());

            var postDisbsByLoan = (await _context.LoanDisbursements
                .AsNoTracking()
                .Where(d => loanIds.Contains(d.LoanAccountID) && d.DisbursementDate.Date > cleanDate)
                .ToListAsync())
                .GroupBy(d => d.LoanAccountID)
                .ToDictionary(g => g.Key, g => (IReadOnlyList<LoanDisbursement>)g.ToList());

            var result = new Dictionary<int, (decimal Principal, decimal ReceivableInterest, decimal OverdueInterest)>();
            foreach (var s in statuses)
            {
                if (s.LoanAccount == null)
                {
                    result[s.LoanAccountID] = (s.OutstandingBalance, 0m, 0m);
                    continue;
                }

                postColsByLoan.TryGetValue(s.LoanAccountID, out var pCols);
                postDisbsByLoan.TryGetValue(s.LoanAccountID, out var pDisbs);
                var bal = NpaEngineService.ReconstructLoanBalancesAsOfDate(s.LoanAccount, cleanDate, pCols, pDisbs);

                // Reconcile against stored snapshot OutstandingBalance so Principal + TotalInterest == s.OutstandingBalance
                decimal principal = Math.Min(bal.Principal, s.OutstandingBalance);
                decimal totalInt = Math.Max(0m, s.OutstandingBalance - principal);
                decimal ovdInt = Math.Min(bal.OverdueInterest, totalInt);
                decimal recInt = Math.Max(0m, totalInt - ovdInt);

                result[s.LoanAccountID] = (principal, recInt, ovdInt);
            }

            return result;
        }

        private async Task<decimal> ResolveGlBddrProvisionBalanceAsync(DateTime asOfDate, int? branchId)
        {
            DateTime cleanDate = asOfDate.Date;

            var mappedLedgerIds = await _context.AuditLedgerMappings
                .AsNoTracking()
                .Where(m => m.CategoryCode == "BAD_DEBT_RESERVE" && m.LedgerID > 0)
                .Select(m => m.LedgerID)
                .ToListAsync();

            if (!mappedLedgerIds.Any())
            {
                mappedLedgerIds = await _context.Ledgers
                    .AsNoTracking()
                    .Where(l => l.IsActive &&
                                (l.LedgerName.Contains("बुडीत कर्ज") ||
                                 l.LedgerName.Contains("संशयित कर्ज") ||
                                 l.LedgerName.Contains("BDDR") ||
                                 l.LedgerName.Contains("NPA तरतूद")))
                    .Select(l => l.LedgerID)
                    .ToListAsync();
            }

            if (!mappedLedgerIds.Any()) return 0m;

            var bddrLedgers = await _context.Ledgers
                .AsNoTracking()
                .Where(l => mappedLedgerIds.Contains(l.LedgerID))
                .ToListAsync();

            var fyBaseline = await FinancialYearBaselineHelper.ResolveBaselineAsync(_context, cleanDate, branchId: branchId);
            int baselineFyId = fyBaseline.BaselineFinancialYearId;

            decimal baseObCredit = 0m;
            if (branchId.HasValue && branchId.Value > 0)
            {
                var branchObs = await _context.BranchLedgerOpeningBalances
                    .AsNoTracking()
                    .Where(b => b.BranchID == branchId.Value &&
                                mappedLedgerIds.Contains(b.LedgerID) &&
                                (baselineFyId == 0 || b.FinancialYearID == baselineFyId))
                    .ToListAsync();

                foreach (var ob in branchObs)
                {
                    baseObCredit += ob.OpeningBalanceType == "Cr" ? ob.OpeningBalance : -ob.OpeningBalance;
                }
            }
            else
            {
                foreach (var l in bddrLedgers)
                {
                    baseObCredit += (l.OpeningBalanceType ?? "Cr") == "Cr" ? l.OpeningBalance : -l.OpeningBalance;
                }
            }

            var vdQuery = _context.VoucherDetails
                .AsNoTracking()
                .Where(vd => mappedLedgerIds.Contains(vd.LedgerID) &&
                             vd.Voucher != null &&
                             vd.Voucher.Status == "Approved" &&
                             vd.Voucher.VoucherDate.Date <= cleanDate);

            if (branchId.HasValue && branchId.Value > 0)
            {
                int bId = branchId.Value;
                vdQuery = vdQuery.Where(vd => vd.Voucher != null && vd.Voucher.BranchID == bId);
            }

            if (fyBaseline.BaselineStartDate.HasValue)
            {
                DateTime bStart = fyBaseline.BaselineStartDate.Value.Date;
                vdQuery = vdQuery.Where(vd => vd.Voucher != null && vd.Voucher.VoucherDate.Date >= bStart);
            }

            decimal totalCr = await vdQuery.Where(vd => vd.DrCr == "Cr").SumAsync(vd => (decimal?)vd.Amount) ?? 0m;
            decimal totalDr = await vdQuery.Where(vd => vd.DrCr == "Dr").SumAsync(vd => (decimal?)vd.Amount) ?? 0m;

            return Math.Max(0m, baseObCredit + totalCr - totalDr);
        }

        // POST: api/npa/run
        [HttpPost("run")]
        public async Task<IActionResult> RunClassification([FromBody] NpaRunRequest request)
        {
            try
            {
                var runDate = (request?.AsOfDate ?? DateTime.Today).Date;
                var run = await _npaService.RunClassificationAsync(runDate, request?.TriggeredBy ?? "Auditor");
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
                .AsNoTracking()
                .OrderByDescending(r => r.RunDate)
                .Take(50)
                .ToListAsync();
        }

        // GET: api/npa/status/{loanAccountId}
        [HttpGet("status/{loanAccountId}")]
        public async Task<IActionResult> GetAccountNpaStatus(int loanAccountId)
        {
            var status = await _context.LoanAccountNpaStatuses
                .AsNoTracking()
                .Where(s => s.LoanAccountID == loanAccountId)
                .OrderByDescending(s => s.AsOfDate)
                .FirstOrDefaultAsync();

            if (status == null)
            {
                var accountExists = await _context.LoanAccounts
                    .AnyAsync(l => l.LoanAccountID == loanAccountId);

                if (!accountExists)
                {
                    return NotFound(new { message = "Loan account not found" });
                }

                return Ok(new
                {
                    Category = "Standard",
                    OverdueDays = 0,
                    CategoryMarathi = "नियमित (Standard)",
                    IsNpa = false
                });
            }

            return Ok(new
            {
                status.Category,
                status.OverdueDays,
                CategoryMarathi = GetCategoryMarathi(status.Category),
                IsNpa = status.Category != "Standard"
            });
        }

        // GET: api/npa/statement
        [HttpGet("statement")]
        public async Task<IActionResult> GetNpaStatement([FromQuery] DateTime? asOfDate, [FromQuery] int? branchId = null)
        {
            branchId = User?.Identity != null ? User.ResolveOptionalBranchId(branchId > 0 ? branchId : null) : branchId;
            var date = (asOfDate ?? DateTime.Today).Date;

            var statuses = await EnsureAndLoadSnapshotAsync(date, branchId, includeSchedules: false);
            var balMap = await ReconstructSnapshotBalancesMapAsync(statuses, date);

            decimal grossAdvances = statuses.Sum(s => s.OutstandingBalance);
            decimal grossPrincipalAdvances = statuses.Sum(s => balMap[s.LoanAccountID].Principal);

            var npaStatuses = statuses.Where(s => s.Category != "Standard").ToList();
            decimal grossNpa = npaStatuses.Sum(s => s.OutstandingBalance);
            decimal npaPrincipal = npaStatuses.Sum(s => balMap[s.LoanAccountID].Principal);
            decimal npaUnrealizedInterest = npaStatuses.Sum(s =>
                balMap[s.LoanAccountID].ReceivableInterest + balMap[s.LoanAccountID].OverdueInterest);

            decimal grossNpaPercent = grossAdvances > 0m ? (grossNpa / grossAdvances) * 100m : 0m;

            // Statutory Policy: 100% Overdue Interest Reserve (OIR - थकीत व्याज तरतूद) on all NPA receivable interest
            decimal overdueInterestReserve = npaUnrealizedInterest;
            decimal recoveryDeposits = 0m;
            decimal totalDeductions = overdueInterestReserve + recoveryDeposits;

            decimal totalProvisionRequired = statuses.Sum(s => s.ProvisionRequired);
            decimal npaProvisionRequired = npaStatuses.Sum(s => s.ProvisionRequired);
            decimal standardProvisionRequired = statuses.Where(s => s.Category == "Standard").Sum(s => s.ProvisionRequired);

            decimal accountProvisionHeld = statuses.Sum(s => s.ProvisionHeld);
            decimal glBddrBalance = await ResolveGlBddrProvisionBalanceAsync(date, branchId);
            decimal provisionHeld = Math.Max(accountProvisionHeld, glBddrBalance);

            // Effective BDDR deduction for Net NPA: uses actual ProvisionHeld if booked in GL/OB, else shows shortfall transparently
            decimal effectiveProvisionForNet = provisionHeld > 0m ? provisionHeld : npaProvisionRequired;
            decimal provisionShortfall = Math.Max(0m, npaProvisionRequired - provisionHeld);

            decimal netAdvances = Math.Max(0m, grossAdvances - totalDeductions - effectiveProvisionForNet);
            decimal netNpa = Math.Max(0m, grossNpa - totalDeductions - effectiveProvisionForNet);
            decimal netNpaPercent = netAdvances > 0m ? (netNpa / netAdvances) * 100m : 0m;

            var sanstha = await _context.SansthaDetails.AsNoTracking().FirstOrDefaultAsync() ?? new SansthaDetail
            {
                SansthaName = "सहकारी पतसंस्था मर्यादित",
                Address = "महाराष्ट्र"
            };

            var statement = new NpaStatementDto
            {
                SansthaName = sanstha.SansthaName,
                Address = sanstha.Address,
                AsOfDate = date,
                GrossAdvances = Math.Round(grossAdvances / 100000m, 2),
                GrossPrincipalAdvances = Math.Round(grossPrincipalAdvances / 100000m, 2),
                GrossNpa = Math.Round(grossNpa / 100000m, 2),
                NpaPrincipal = Math.Round(npaPrincipal / 100000m, 2),
                GrossNpaPercent = Math.Round(grossNpaPercent, 2),
                OverdueInterestReserve = Math.Round(overdueInterestReserve / 100000m, 2),
                RecoveryDeposits = Math.Round(recoveryDeposits / 100000m, 2),
                TotalDeductions = Math.Round(totalDeductions / 100000m, 2),
                TotalProvision = Math.Round(npaProvisionRequired / 100000m, 2),
                TotalProvisionIncludingStandard = Math.Round(totalProvisionRequired / 100000m, 2),
                StandardProvisionRequired = Math.Round(standardProvisionRequired / 100000m, 2),
                ProvisionHeld = Math.Round(provisionHeld / 100000m, 2),
                ProvisionShortfall = Math.Round(provisionShortfall / 100000m, 2),
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
            branchId = User?.Identity != null ? User.ResolveOptionalBranchId(branchId > 0 ? branchId : null) : branchId;
            var date = (asOfDate ?? DateTime.Today).Date;

            var statuses = await EnsureAndLoadSnapshotAsync(date, branchId, includeSchedules: false);
            var balMap = await ReconstructSnapshotBalancesMapAsync(statuses, date);

            var categories = new[] { "Standard", "Sub-Standard", "Doubtful-1", "Doubtful-2", "Doubtful-3", "Loss" };
            var breakup = new List<CategoryBreakupDto>();

            foreach (var cat in categories)
            {
                var catStatuses = statuses.Where(s => s.Category == cat).ToList();
                decimal grossOut = catStatuses.Sum(s => s.OutstandingBalance);
                decimal principalOut = catStatuses.Sum(s => balMap[s.LoanAccountID].Principal);
                decimal intOut = catStatuses.Sum(s => balMap[s.LoanAccountID].ReceivableInterest + balMap[s.LoanAccountID].OverdueInterest);
                decimal oirReq = cat != "Standard" ? intOut : 0m;
                decimal securedPrin = catStatuses.Sum(s => Math.Min(balMap[s.LoanAccountID].Principal, s.CompliantCollateralValue));
                decimal unsecuredPrin = Math.Max(0m, principalOut - securedPrin);

                breakup.Add(new CategoryBreakupDto
                {
                    Category = cat,
                    CategoryMarathi = GetCategoryMarathi(cat),
                    AccountCount = catStatuses.Count,
                    GrossOutstanding = Math.Round(grossOut / 100000m, 2),
                    PrincipalOutstanding = Math.Round(principalOut / 100000m, 2),
                    OverdueInterestReserve = Math.Round(oirReq / 100000m, 2),
                    SecuredOutstanding = Math.Round(securedPrin / 100000m, 2),
                    UnsecuredOutstanding = Math.Round(unsecuredPrin / 100000m, 2),
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
            branchId = User?.Identity != null ? User.ResolveOptionalBranchId(branchId > 0 ? branchId : null) : branchId;
            var date = (asOfDate ?? DateTime.Today).Date;

            var statuses = await EnsureAndLoadSnapshotAsync(date, branchId, includeSchedules: false);

            var topDefaulters = statuses
                .Where(s => s.Category != "Standard")
                .OrderByDescending(s => s.OutstandingBalance)
                .Take(20)
                .Select(s => new DefaulterRowDto
                {
                    LoanAccountID = s.LoanAccountID,
                    LoanAccountNo = s.LoanAccount?.LoanAccountNo ?? "",
                    BorrowerName = ResolveBorrowerFullName(s.LoanAccount),
                    Category = s.Category,
                    CategoryMarathi = GetCategoryMarathi(s.Category),
                    OutstandingBalance = Math.Round(s.OutstandingBalance / 100000m, 2),
                    OverdueDate = s.OverdueDate ?? s.OutOfOrderDate,
                    OverdueDays = s.OverdueDate.HasValue
                        ? Math.Max(0, (date - s.OverdueDate.Value.Date).Days)
                        : (s.OutOfOrderDate.HasValue ? Math.Max(0, (date - s.OutOfOrderDate.Value.Date).Days) : 0)
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
                    BorrowerName = ResolveBorrowerFullName(s.LoanAccount),
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
            branchId = User?.Identity != null ? User.ResolveOptionalBranchId(branchId > 0 ? branchId : null) : branchId;
            var date = (asOfDate ?? DateTime.Today).Date;

            var statuses = await EnsureAndLoadSnapshotAsync(date, branchId, includeSchedules: true);
            var balMap = await ReconstructSnapshotBalancesMapAsync(statuses, date);

            string fy = NpaEngineService.GetFinancialYearStatic(date);
            var config = await _context.NpaConfigs.AsNoTracking().FirstOrDefaultAsync(c => c.FinancialYear == fy);
            int concessionDays = config?.ConcessionPeriodDays > 0 ? config.ConcessionPeriodDays : 180;

            var slabs = await _context.NpaProvisionSlabs.AsNoTracking().Where(s => s.FinancialYear == fy).ToListAsync();
            if (!slabs.Any())
            {
                slabs = NpaEngineService.BuildDefaultSlabsForFy(fy);
            }

            var register = statuses.Select(s =>
            {
                var loan = s.LoanAccount!;
                var bal = balMap[s.LoanAccountID];

                decimal principalBalance = bal.Principal;
                decimal receivableInterest = bal.ReceivableInterest + bal.OverdueInterest;
                decimal totalOutstanding = s.OutstandingBalance;

                var unpaidSchedules = (loan.LoanInstallmentSchedules ?? new List<LoanInstallmentSchedule>())
                    .Where(sch => sch.DueDate.Date <= date && sch.Status != "Paid")
                    .ToList();

                int overdueInstallments = unpaidSchedules.Count;
                decimal overduePrincipal = unpaidSchedules.Sum(sch => sch.PrincipalAmount);
                decimal overdueAmount = overduePrincipal > 0m
                    ? Math.Min(totalOutstanding, overduePrincipal + receivableInterest)
                    : (s.Category != "Standard" ? totalOutstanding : receivableInterest);

                int overdueMonths = 0;
                DateTime? npaDate = null;

                if (s.OverdueDate.HasValue || s.OutOfOrderDate.HasValue)
                {
                    var oDate = (s.OverdueDate ?? s.OutOfOrderDate!.Value).Date;
                    overdueMonths = Math.Max(0, (int)Math.Floor((date - oDate).TotalDays / 30.0));
                    if ((date - oDate).TotalDays >= concessionDays || s.Category != "Standard")
                    {
                        npaDate = oDate.AddDays(concessionDays);
                    }
                }

                // Provision base is strictly PrincipalBalance; 100% of ReceivableInterest on NPA accounts is OIR
                decimal balanceForProvisioning = principalBalance;
                decimal collateralVal = s.CompliantCollateralValue;
                decimal securedPrincipal = Math.Min(balanceForProvisioning, collateralVal);
                decimal unsecuredPrincipal = Math.Max(0m, balanceForProvisioning - securedPrincipal);

                var (secPct, unsecPct) = NpaEngineService.ResolveSlabPercentages(s.Category, slabs);
                decimal npaPercentage;
                if (balanceForProvisioning > 0m)
                {
                    npaPercentage = Math.Round((s.ProvisionRequired / balanceForProvisioning) * 100m, 2);
                }
                else
                {
                    npaPercentage = s.SecurityType == "Secured" ? secPct : unsecPct;
                }

                decimal oirAmount = s.Category != "Standard" ? receivableInterest : 0m;

                return new NpaRegisterDto
                {
                    LoanAccountID = s.LoanAccountID,
                    AccountNo = loan.LoanAccountNo ?? "",
                    LegacyAccountNumber = loan.LegacyAccountNumber ?? "",
                    MemberCode = loan.Member?.MemberCode ?? loan.Member?.LegacyMemberNo ?? (loan.MemberID > 0 ? loan.MemberID.ToString()! : "-"),
                    Name = ResolveBorrowerFullName(loan),
                    LoanType = loan.LoanRate?.ShortName ?? loan.LoanRate?.LoanType ?? "सामान्य कर्ज",
                    SanctionedAmount = Math.Round(loan.SanctionedAmount, 2),
                    DisbursementDate = loan.LoanDisbursementDate ?? loan.OpeningDate,
                    PrincipalBalance = Math.Round(principalBalance, 2),
                    OutstandingBalance = Math.Round(totalOutstanding, 2),
                    OverdueDate = s.OverdueDate ?? s.OutOfOrderDate,
                    OverdueAmount = Math.Round(overdueAmount, 2),
                    OverdueInstallments = overdueInstallments,
                    InstallmentAmount = Math.Round(loan.InstallmentAmount, 2),
                    OverdueMonths = overdueMonths,
                    NpaDate = npaDate,
                    ReceivableInterest = Math.Round(receivableInterest, 2),
                    OirAmount = Math.Round(oirAmount, 2),
                    BalanceForProvisioning = Math.Round(balanceForProvisioning, 2),
                    SecurityType = !string.IsNullOrWhiteSpace(loan.SecurityDetails)
                        ? loan.SecurityDetails
                        : (!string.IsNullOrWhiteSpace(loan.LoanRate?.SecurityType) ? loan.LoanRate.SecurityType : s.SecurityType),
                    CollateralValue = Math.Round(collateralVal, 2),
                    SecuredAmount = Math.Round(securedPrincipal, 2),
                    UnsecuredAmount = Math.Round(unsecuredPrincipal, 2),
                    NpaPercentage = npaPercentage,
                    ProvisionAmount = Math.Round(s.ProvisionRequired, 2),
                    TotalProvisionWithOir = Math.Round(s.ProvisionRequired + oirAmount, 2),
                    ConcessionPeriodDays = concessionDays,
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

            var latestRun = await _context.NpaClassificationRuns
                .OrderByDescending(r => r.RunDate)
                .FirstOrDefaultAsync();

            if (latestRun == null)
            {
                latestRun = new NpaClassificationRun
                {
                    RunDate = DateTime.Now,
                    TriggeredBy = "Auditor Loss Certification",
                    RecordsProcessed = 1,
                    Status = "Success",
                    Remarks = "Created for Loss Asset Certification"
                };
                _context.NpaClassificationRuns.Add(latestRun);
                await _context.SaveChangesAsync();
            }

            var asOfDate = (request.AsOfDate ?? DateTime.Today).Date;

            var existingStatus = await _context.LoanAccountNpaStatuses
                .FirstOrDefaultAsync(s => s.LoanAccountID == request.LoanAccountID && s.AsOfDate.Date == asOfDate);

            decimal outstanding = loan.PrincipalBalance + loan.InterestBalance + loan.OverdueInterestBalance;
            decimal principalProvision = Math.Max(0m, loan.PrincipalBalance); // 100% BDDR on Principal + 100% OIR on Interest

            if (existingStatus != null)
            {
                existingStatus.Category = "Loss";
                existingStatus.IsAutoClassified = false;
                existingStatus.AuditorRemarks = request.Remarks;
                existingStatus.OutstandingBalance = outstanding;
                existingStatus.ProvisionRequired = principalProvision;
                _context.Entry(existingStatus).State = EntityState.Modified;
            }
            else
            {
                var newStatus = new LoanAccountNpaStatus
                {
                    LoanAccountID = request.LoanAccountID,
                    AsOfDate = asOfDate,
                    OverdueDate = NpaEngineService.DeriveStatutoryOverdueDate(asOfDate, "Loss"),
                    Category = "Loss",
                    SecurityType = "Unsecured",
                    OutstandingBalance = outstanding,
                    CompliantCollateralValue = 0m,
                    ProvisionRequired = principalProvision,
                    ProvisionHeld = loan.InterestProvisionBalance,
                    IsAutoClassified = false,
                    LastClassificationRunId = latestRun.NpaClassificationRunID,
                    AuditorRemarks = request.Remarks
                };
                _context.LoanAccountNpaStatuses.Add(newStatus);
            }

            await _context.SaveChangesAsync();
            return Ok("Account certified as Loss Asset successfully.");
        }

        // GET: api/npa/compliance-logs
        [HttpGet("compliance-logs")]
        public async Task<ActionResult<IEnumerable<object>>> GetComplianceLogs([FromQuery] int? branchId = null)
        {
            branchId = User?.Identity != null ? User.ResolveOptionalBranchId(branchId > 0 ? branchId : null) : branchId;

            var query = _context.CollateralComplianceLogs
                .AsNoTracking()
                .Include(c => c.LoanAccount)
                    .ThenInclude(l => l!.Customer)
                .Include(c => c.LoanAccount)
                    .ThenInclude(l => l!.Member)
                        .ThenInclude(m => m!.Customer)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                int bId = branchId.Value;
                query = query.Where(c => c.LoanAccount != null && c.LoanAccount.BranchID == bId);
            }

            var logs = await query
                .OrderByDescending(c => c.ValuationDate)
                .ThenByDescending(c => c.CollateralComplianceLogID)
                .ToListAsync();

            var shaped = logs.Select(c => new
            {
                c.CollateralComplianceLogID,
                c.LoanAccountID,
                c.CollateralType,
                c.ValuationDate,
                c.ValuationValue,
                c.ValuersCount,
                c.LastInspectionDate,
                c.InsuranceExpiryDate,
                c.LastStockStatementDate,
                c.IsAuditorVerified,
                c.IsMarginMaintained,
                c.Remarks,
                c.CreatedOn,
                BorrowerName = ResolveBorrowerFullName(c.LoanAccount),
                LoanAccount = c.LoanAccount == null ? null : new
                {
                    c.LoanAccount.LoanAccountID,
                    c.LoanAccount.LoanAccountNo,
                    c.LoanAccount.LegacyAccountNumber,
                    c.LoanAccount.BranchID,
                    BorrowerName = ResolveBorrowerFullName(c.LoanAccount)
                }
            });

            return Ok(shaped);
        }

        // POST: api/npa/collateral-compliance
        [HttpPost("collateral-compliance")]
        public async Task<IActionResult> SaveCollateralComplianceLog([FromBody] CollateralComplianceLogRequest dto)
        {
            if (dto == null || dto.LoanAccountID <= 0)
            {
                return BadRequest(new { message = "कृपया वैध कर्ज खाते निवडा." });
            }

            var loan = await _context.LoanAccounts.AsNoTracking().FirstOrDefaultAsync(l => l.LoanAccountID == dto.LoanAccountID);
            if (loan == null)
            {
                return NotFound(new { message = "कर्ज खाते सापडले नाही." });
            }

            var log = new CollateralComplianceLog
            {
                LoanAccountID = dto.LoanAccountID,
                CollateralType = string.IsNullOrWhiteSpace(dto.CollateralType) ? "Immovable Property" : dto.CollateralType.Trim(),
                ValuationDate = dto.ValuationDate.Date,
                ValuationValue = dto.ValuationValue,
                ValuersCount = dto.ValuersCount > 0 ? dto.ValuersCount : 1,
                LastInspectionDate = dto.LastInspectionDate.Date,
                InsuranceExpiryDate = dto.InsuranceExpiryDate.Date,
                LastStockStatementDate = dto.LastStockStatementDate?.Date,
                IsAuditorVerified = dto.IsAuditorVerified,
                IsMarginMaintained = dto.IsMarginMaintained,
                Remarks = dto.Remarks,
                CreatedOn = DateTime.UtcNow
            };

            _context.CollateralComplianceLogs.Add(log);
            await _context.SaveChangesAsync();

            return Ok(log);
        }

        // GET: api/npa/config
        [HttpGet("config")]
        public async Task<IActionResult> GetNpaConfig([FromQuery] string? financialYear)
        {
            var fy = financialYear;
            if (string.IsNullOrWhiteSpace(fy))
            {
                var activeFy = await _context.FinancialYears.AsNoTracking().FirstOrDefaultAsync(f => f.IsActive);
                fy = FormatShortFyCode(activeFy?.YearCode) ?? NpaEngineService.GetFinancialYearStatic(DateTime.Today);
            }

            var config = await _context.NpaConfigs.FirstOrDefaultAsync(c => c.FinancialYear == fy);
            if (config == null)
            {
                config = new NpaConfig { FinancialYear = fy!, ConcessionPeriodDays = 180 };
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
            if (string.IsNullOrWhiteSpace(fy))
            {
                var activeFy = await _context.FinancialYears.AsNoTracking().FirstOrDefaultAsync(f => f.IsActive);
                fy = FormatShortFyCode(activeFy?.YearCode) ?? NpaEngineService.GetFinancialYearStatic(DateTime.Today);
            }

            var slabs = await _context.NpaProvisionSlabs
                .Where(s => s.FinancialYear == fy)
                .OrderBy(s => s.NpaProvisionSlabID)
                .ToListAsync();

            if (!slabs.Any())
            {
                slabs = NpaEngineService.BuildDefaultSlabsForFy(fy!);
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

        private static string? FormatShortFyCode(string? rawFy)
        {
            if (string.IsNullOrWhiteSpace(rawFy)) return null;
            var clean = rawFy.Trim();
            var parts = clean.Split('-');
            if (parts.Length == 2 && parts[0].Length == 4 && parts[1].Length == 4)
            {
                return $"{parts[0]}-{parts[1].Substring(2, 2)}";
            }
            return clean;
        }

        private static string ResolveBorrowerFullName(LoanAccount? loan)
        {
            if (loan == null) return "-";
            var cust = loan.Customer ?? loan.Member?.Customer;
            if (cust != null)
            {
                var full = $"{cust.FirstName} {cust.MiddleName} {cust.LastName}".Replace("  ", " ").Trim();
                if (!string.IsNullOrWhiteSpace(full)) return full;
            }
            return "Unknown";
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

    public class CollateralComplianceLogRequest
    {
        public int LoanAccountID { get; set; }
        public string CollateralType { get; set; } = "Immovable Property";
        public DateTime ValuationDate { get; set; }
        public decimal ValuationValue { get; set; }
        public int ValuersCount { get; set; } = 1;
        public DateTime LastInspectionDate { get; set; }
        public DateTime InsuranceExpiryDate { get; set; }
        public DateTime? LastStockStatementDate { get; set; }
        public bool IsAuditorVerified { get; set; }
        public bool IsMarginMaintained { get; set; } = true;
        public string? Remarks { get; set; }
    }

    public class NpaStatementDto
    {
        public string SansthaName { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public DateTime AsOfDate { get; set; }
        public decimal GrossAdvances { get; set; }
        public decimal GrossPrincipalAdvances { get; set; }
        public decimal GrossNpa { get; set; }
        public decimal NpaPrincipal { get; set; }
        public decimal GrossNpaPercent { get; set; }
        public decimal OverdueInterestReserve { get; set; }
        public decimal RecoveryDeposits { get; set; }
        public decimal TotalDeductions { get; set; }
        public decimal TotalProvision { get; set; }
        public decimal TotalProvisionIncludingStandard { get; set; }
        public decimal StandardProvisionRequired { get; set; }
        public decimal ProvisionHeld { get; set; }
        public decimal ProvisionShortfall { get; set; }
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
        public decimal PrincipalOutstanding { get; set; }
        public decimal OverdueInterestReserve { get; set; }
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
        public string LegacyAccountNumber { get; set; } = string.Empty;
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
        public decimal OirAmount { get; set; }
        public decimal BalanceForProvisioning { get; set; }
        public string SecurityType { get; set; } = string.Empty;
        public decimal CollateralValue { get; set; }
        public decimal SecuredAmount { get; set; }
        public decimal UnsecuredAmount { get; set; }
        public decimal NpaPercentage { get; set; }
        public decimal ProvisionAmount { get; set; }
        public decimal TotalProvisionWithOir { get; set; }
        public int ConcessionPeriodDays { get; set; }
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
