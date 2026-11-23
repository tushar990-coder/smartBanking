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

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DemandNoticesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DemandNoticesController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/DemandNotices
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetDemandNotices([FromQuery] int? branchId = null, [FromQuery] int? employerId = null)
        {
            var query = _context.DemandNotices
                .AsNoTracking()
                .Include(d => d.Employer)
                .Include(d => d.Branch)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(d => d.BranchId == branchId.Value);
            }
            if (employerId.HasValue && employerId.Value > 0)
            {
                query = query.Where(d => d.EmployerId == employerId.Value);
            }

            var notices = await query
                .OrderByDescending(d => d.DemandDate)
                .ThenByDescending(d => d.DemandNoticeId)
                .ToListAsync();

            var noticeIds = notices.Select(n => n.DemandNoticeId).ToList();

            var recoveryTotals = await _context.DemandRecoveries
                .AsNoTracking()
                .Include(r => r.Voucher)
                .Where(r => noticeIds.Contains(r.DemandNoticeId))
                .ToListAsync();

            var memberStats = await _context.DemandMemberDetails
                .AsNoTracking()
                .Where(m => noticeIds.Contains(m.DemandNoticeId))
                .GroupBy(m => m.DemandNoticeId)
                .Select(g => new
                {
                    DemandNoticeId = g.Key,
                    MemberCount = g.Count(),
                    RecoveredCount = g.Count(x => x.IsProcessed || x.RecoveryStatus == "Recovered")
                })
                .ToDictionaryAsync(x => x.DemandNoticeId);

            var result = notices.Select(n =>
            {
                var recs = recoveryTotals.Where(r => r.DemandNoticeId == n.DemandNoticeId).ToList();
                decimal recoveredAmt = Math.Round(recs.Sum(r => r.TotalReceivedAmount), 2, MidpointRounding.AwayFromZero);
                decimal pendingAmt = Math.Max(0m, Math.Round(n.TotalDemandAmount - recoveredAmt, 2, MidpointRounding.AwayFromZero));
                int pendingVouchers = recs.Count(r => r.Voucher != null && string.Equals(r.Voucher.Status, "Pending", StringComparison.OrdinalIgnoreCase));
                memberStats.TryGetValue(n.DemandNoticeId, out var ms);

                return new
                {
                    n.DemandNoticeId,
                    n.NoticeNumber,
                    n.Month,
                    n.Year,
                    n.DemandDate,
                    n.EmployerId,
                    EmployerName = n.Employer?.Name ?? string.Empty,
                    n.BranchId,
                    BranchName = n.Branch?.BranchName ?? string.Empty,
                    n.TotalDemandAmount,
                    TotalRecoveredAmount = recoveredAmt,
                    PendingAmount = pendingAmt,
                    PendingVoucherCount = pendingVouchers,
                    MemberCount = ms?.MemberCount ?? 0,
                    RecoveredMemberCount = ms?.RecoveredCount ?? 0,
                    n.OnlyBorrowers,
                    n.ContributionInputAmount,
                    n.Status,
                    n.Remarks,
                    n.CreatedDate
                };
            });

            return Ok(result);
        }

        // GET: api/DemandNotices/5
        [HttpGet("{id}")]
        public async Task<ActionResult<DemandNotice>> GetDemandNotice(int id)
        {
            var demandNotice = await _context.DemandNotices
                .Include(d => d.Employer)
                .Include(d => d.Branch)
                .Include(d => d.MemberDetails)
                    .ThenInclude(md => md.Member)
                        .ThenInclude(m => m!.Customer)
                .Include(d => d.MemberDetails)
                    .ThenInclude(md => md.ColumnItems.OrderBy(c => c.SequenceOrder).ThenBy(c => c.SubRowIndex))
                .FirstOrDefaultAsync(d => d.DemandNoticeId == id);

            if (demandNotice == null)
            {
                return NotFound("डिमान्ड नोटीस आढळली नाही.");
            }

            return demandNotice;
        }

        // GET: api/DemandNotices/5/grid
        [HttpGet("{id}/grid")]
        public async Task<ActionResult<object>> GetDemandNoticeGrid(int id)
        {
            var notice = await _context.DemandNotices
                .AsNoTracking()
                .Include(d => d.Employer)
                .Include(d => d.Branch)
                .Include(d => d.MemberDetails)
                    .ThenInclude(md => md.Member)
                        .ThenInclude(m => m!.Customer)
                .Include(d => d.MemberDetails)
                    .ThenInclude(md => md.ColumnItems)
                .FirstOrDefaultAsync(d => d.DemandNoticeId == id);

            if (notice == null)
            {
                return NotFound("डिमान्ड नोटीस आढळली नाही.");
            }

            var recoveries = await _context.DemandRecoveries
                .AsNoTracking()
                .Include(r => r.Voucher)
                .Where(r => r.DemandNoticeId == id)
                .OrderByDescending(r => r.RecoveryDate)
                .ThenByDescending(r => r.DemandRecoveryId)
                .Select(r => new
                {
                    r.DemandRecoveryId,
                    r.RecoveryDate,
                    r.TotalReceivedAmount,
                    r.PaymentMode,
                    r.ReferenceNo,
                    r.RecoveredMemberCount,
                    r.VoucherId,
                    VoucherNo = r.Voucher != null ? r.Voucher.VoucherNo : "",
                    VoucherStatus = r.Voucher != null ? r.Voucher.Status : ""
                })
                .ToListAsync();

            decimal totalRecovered = recoveries.Sum(r => r.TotalReceivedAmount);
            int pendingVoucherCount = recoveries.Count(r => string.Equals(r.VoucherStatus, "Pending", StringComparison.OrdinalIgnoreCase));

            var orderedDetails = notice.MemberDetails
                .OrderBy(d => int.TryParse(d.EmpCode, out int n) ? n : int.MaxValue)
                .ThenBy(d => d.EmpCode ?? string.Empty)
                .ThenBy(d => d.DemandMemberDetailId)
                .ToList();

            var allItems = orderedDetails.SelectMany(d => d.ColumnItems).ToList();
            var settingsMeta = allItems
                .Where(i => !string.Equals(i.ItemType, "RD", StringComparison.OrdinalIgnoreCase))
                .GroupBy(i => new { i.DemandColumnSettingId, i.SequenceOrder, i.ItemType, i.ColumnHeaderMr, i.SchemeId })
                .OrderBy(g => g.Key.SequenceOrder)
                .Select(g => new
                {
                    demandColumnSettingId = g.Key.DemandColumnSettingId ?? 0,
                    sequenceOrder = g.Key.SequenceOrder,
                    itemType = g.Key.ItemType,
                    columnHeaderMr = g.Key.ColumnHeaderMr,
                    schemeId = g.Key.SchemeId,
                    showBalanceColumn = g.Key.ItemType == "LOAN"
                })
                .ToList();

            bool hasAnyRd = allItems.Any(i => string.Equals(i.ItemType, "RD", StringComparison.OrdinalIgnoreCase));
            int minRdSeq = hasAnyRd
                ? allItems.Where(i => string.Equals(i.ItemType, "RD", StringComparison.OrdinalIgnoreCase)).Min(i => i.SequenceOrder)
                : int.MaxValue;

            var rows = orderedDetails.Select((md, idx) =>
            {
                var orderedItems = md.ColumnItems
                    .OrderBy(c => c.SequenceOrder)
                    .ThenBy(c => c.SubRowIndex)
                    .ToList();

                var nonRdCells = orderedItems
                    .Where(c => !string.Equals(c.ItemType, "RD", StringComparison.OrdinalIgnoreCase))
                    .Select(c => new
                    {
                        c.DemandMemberColumnItemId,
                        c.DemandColumnSettingId,
                        c.SequenceOrder,
                        c.ItemType,
                        c.ColumnHeaderMr,
                        c.SchemeId,
                        c.AccountId,
                        c.SourceAccountIdsCsv,
                        c.CurrentBalanceAmount,
                        c.DemandPrincipalOrDeposit,
                        c.DemandInterest,
                        c.DemandPenalInterest,
                        c.RecoveredPrincipalOrDeposit,
                        c.RecoveredInterest,
                        c.RecoveredPenalInterest,
                        PendingPrincipalOrDeposit = Math.Max(0m, Math.Round(c.DemandPrincipalOrDeposit - c.RecoveredPrincipalOrDeposit, 2, MidpointRounding.AwayFromZero)),
                        PendingInterest = Math.Max(0m, Math.Round((c.DemandInterest + c.DemandPenalInterest) - (c.RecoveredInterest + c.RecoveredPenalInterest), 2, MidpointRounding.AwayFromZero))
                    })
                    .ToList();

                var rdItems = orderedItems
                    .Where(c => string.Equals(c.ItemType, "RD", StringComparison.OrdinalIgnoreCase))
                    .OrderBy(c => c.SequenceOrder)
                    .ThenBy(c => c.SubRowIndex)
                    .Select((c, rIdx) => new
                    {
                        c.DemandMemberColumnItemId,
                        c.DemandColumnSettingId,
                        c.SequenceOrder,
                        SubRowIndex = rIdx,
                        c.ColumnHeaderMr,
                        c.DisplaySubLabel,
                        c.SchemeId,
                        c.AccountId,
                        c.CurrentBalanceAmount,
                        c.DemandPrincipalOrDeposit,
                        c.RecoveredPrincipalOrDeposit,
                        PendingAmount = Math.Max(0m, Math.Round(c.DemandPrincipalOrDeposit - c.RecoveredPrincipalOrDeposit, 2, MidpointRounding.AwayFromZero))
                    })
                    .ToList();

                decimal rowRecovered = orderedItems.Any()
                    ? Math.Round(orderedItems.Sum(c => c.RecoveredPrincipalOrDeposit + c.RecoveredInterest + c.RecoveredPenalInterest), 2, MidpointRounding.AwayFromZero)
                    : md.RecoveredAmount;

                decimal rowPending = Math.Max(0m, Math.Round(md.TotalDeduction - rowRecovered, 2, MidpointRounding.AwayFromZero));

                return new
                {
                    srNo = idx + 1,
                    md.DemandMemberDetailId,
                    md.MemberId,
                    CustomerId = md.CustomerId ?? md.Member?.CustomerID ?? 0,
                    EmpCode = md.EmpCode ?? string.Empty,
                    CIFNo = md.CIFNo ?? md.Member?.Customer?.CIFNo ?? string.Empty,
                    MemberName = md.MemberName ?? md.Member?.Customer?.FullName ?? $"Member #{md.MemberId}",
                    md.IsSelected,
                    md.TotalDeduction,
                    RecoveredAmount = rowRecovered,
                    PendingAmount = rowPending,
                    md.RecoveryStatus,
                    md.IsProcessed,
                    Cells = nonRdCells,
                    PrimaryRd = rdItems.FirstOrDefault(),
                    RdSubRows = rdItems.Skip(1).ToList(),
                    AllItemsBySequence = orderedItems.Select(c => new
                    {
                        c.DemandMemberColumnItemId,
                        c.SequenceOrder,
                        c.ItemType,
                        c.ColumnHeaderMr,
                        c.DisplaySubLabel,
                        c.SubRowIndex,
                        c.AccountId,
                        DemandAmount = Math.Round(c.DemandPrincipalOrDeposit + c.DemandInterest + c.DemandPenalInterest, 2, MidpointRounding.AwayFromZero),
                        RecoveredAmount = Math.Round(c.RecoveredPrincipalOrDeposit + c.RecoveredInterest + c.RecoveredPenalInterest, 2, MidpointRounding.AwayFromZero),
                        PendingAmount = Math.Max(0m, Math.Round((c.DemandPrincipalOrDeposit + c.DemandInterest + c.DemandPenalInterest) - (c.RecoveredPrincipalOrDeposit + c.RecoveredInterest + c.RecoveredPenalInterest), 2, MidpointRounding.AwayFromZero)),
                        DemandPrincipalOrDeposit = c.DemandPrincipalOrDeposit,
                        DemandInterest = c.DemandInterest,
                        DemandPenalInterest = c.DemandPenalInterest,
                        RecoveredPrincipalOrDeposit = c.RecoveredPrincipalOrDeposit,
                        RecoveredInterest = c.RecoveredInterest,
                        RecoveredPenalInterest = c.RecoveredPenalInterest
                    }).ToList()
                };
            }).ToList();

            return Ok(new
            {
                notice = new
                {
                    notice.DemandNoticeId,
                    notice.NoticeNumber,
                    notice.Month,
                    notice.Year,
                    notice.DemandDate,
                    notice.EmployerId,
                    EmployerName = notice.Employer?.Name ?? string.Empty,
                    notice.BranchId,
                    BranchName = notice.Branch?.BranchName ?? string.Empty,
                    notice.TotalDemandAmount,
                    TotalRecoveredAmount = totalRecovered,
                    PendingAmount = Math.Max(0m, Math.Round(notice.TotalDemandAmount - totalRecovered, 2, MidpointRounding.AwayFromZero)),
                    PendingVoucherCount = pendingVoucherCount,
                    notice.OnlyBorrowers,
                    notice.ContributionInputAmount,
                    notice.Status,
                    notice.Remarks,
                    notice.CreatedDate
                },
                columns = settingsMeta,
                hasRdZone = hasAnyRd,
                rdZoneSequence = minRdSeq,
                rows,
                recoveries
            });
        }

        // POST: api/DemandNotices/preview
        [HttpPost("preview")]
        public async Task<ActionResult<object>> PreviewDemandGrid([FromBody] DemandPreviewRequestDto request)
        {
            if (request == null || request.EmployerId <= 0)
            {
                return BadRequest("कृपया खाते प्रकार (नियोक्ता / Employer) निवडा.");
            }

            var employer = await _context.EmployerMasters.AsNoTracking().FirstOrDefaultAsync(e => e.Id == request.EmployerId);
            if (employer == null)
            {
                return NotFound("निवडलेला नियोक्ता (Employer) सिस्टममध्ये आढळला नाही.");
            }

            var settings = await _context.DemandColumnSettings
                .AsNoTracking()
                .Where(s => s.IsActive)
                .OrderBy(s => s.SequenceOrder)
                .ThenBy(s => s.DemandColumnSettingId)
                .ToListAsync();

            if (!settings.Any())
            {
                return Ok(new
                {
                    needsSettingsSetup = true,
                    message = "कृपया प्रथम 'डिमांड सेटिंग्ज' मध्ये कर्ज, संजीवनी ठेव आणि RD योजना व लेजर्स मॅप करून सेव्ह करा.",
                    columns = Array.Empty<object>(),
                    rdConfigs = Array.Empty<object>(),
                    hasRdZone = false,
                    rows = Array.Empty<object>()
                });
            }

            DateTime targetDate = request.DemandDate.Date;

            var memberQuery = _context.Members
                .AsNoTracking()
                .Include(m => m.Customer)
                .Where(m => m.Customer != null &&
                            m.Customer.EmployerId == request.EmployerId &&
                            !m.Customer.IsDeleted &&
                            m.Status == "Active");

            if (request.BranchId > 0)
            {
                memberQuery = memberQuery.Where(m => m.Customer!.BranchID == request.BranchId || m.BranchID == request.BranchId);
            }

            var members = await memberQuery.ToListAsync();
            var customerIds = members.Select(m => m.CustomerID).Distinct().ToList();
            var memberIds = members.Select(m => m.MemberID).Distinct().ToList();
            var cifNos = members.Where(m => m.Customer != null && !string.IsNullOrWhiteSpace(m.Customer.CIFNo))
                .Select(m => m.Customer!.CIFNo!.Trim())
                .Distinct()
                .ToList();

            var empBankMap = await _context.EmployeeBankDetails
                .AsNoTracking()
                .Where(e => cifNos.Contains(e.CIFNo))
                .ToDictionaryAsync(e => e.CIFNo.Trim(), e => e.EmployeeID);

            // Preload Loans + Schedules + Collections for these members/customers
            var configuredLoanRateIds = settings.Where(s => s.ItemType == "LOAN" && s.LoanRateID.HasValue)
                .Select(s => s.LoanRateID!.Value)
                .Distinct()
                .ToList();

            var loans = configuredLoanRateIds.Any()
                ? await _context.LoanAccounts
                    .AsNoTracking()
                    .Include(l => l.LoanRate)
                    .Where(l => configuredLoanRateIds.Contains(l.LoanRateID) &&
                                l.Status != "Closed" &&
                                l.Status != "Closed_OTS" &&
                                ((l.CustomerID.HasValue && customerIds.Contains(l.CustomerID.Value)) ||
                                 (l.MemberID.HasValue && memberIds.Contains(l.MemberID.Value))))
                    .ToListAsync()
                : new List<LoanAccount>();

            var loanIds = loans.Select(l => l.LoanAccountID).ToList();
            var schedulesByLoan = loanIds.Any()
                ? (await _context.LoanInstallmentSchedules
                    .AsNoTracking()
                    .Where(s => loanIds.Contains(s.LoanAccountID))
                    .ToListAsync())
                    .GroupBy(s => s.LoanAccountID)
                    .ToDictionary(g => g.Key, g => g.ToList())
                : new Dictionary<int, List<LoanInstallmentSchedule>>();

            var collectionsByLoan = loanIds.Any()
                ? (await _context.LoanCollections
                    .AsNoTracking()
                    .Where(c => loanIds.Contains(c.LoanAccountID))
                    .ToListAsync())
                    .GroupBy(c => c.LoanAccountID)
                    .ToDictionary(g => g.Key, g => g.ToList())
                : new Dictionary<int, List<LoanCollection>>();

            // Preload Saving accounts (for संजीवनी / वर्गणी ठेव)
            var savingAccounts = await _context.SavingAccountMasters
                .AsNoTracking()
                .Where(s => customerIds.Contains(s.CustomerID) && s.Status == "Active")
                .ToListAsync();

            // Preload RD accounts (only active RDs matching configured RD settings)
            var configuredRdSchemeIds = settings.Where(s => s.ItemType == "RD" && s.RdSchemeID.HasValue)
                .Select(s => s.RdSchemeID!.Value)
                .Distinct()
                .ToList();

            var rdAccounts = configuredRdSchemeIds.Any()
                ? await _context.RdAccounts
                    .AsNoTracking()
                    .Include(r => r.RdScheme)
                    .Where(r => customerIds.Contains(r.CustomerID) &&
                                r.Status == "Active" &&
                                configuredRdSchemeIds.Contains(r.RdSchemeID))
                    .OrderBy(r => r.OpeningDate)
                    .ThenBy(r => r.RdAccountID)
                    .ToListAsync()
                : new List<RdAccount>();

            var shareAccounts = await _context.ShareAccounts
                .AsNoTracking()
                .Where(s => (customerIds.Contains(s.CustomerID) || memberIds.Contains(s.MemberId)) && s.Status == "Active")
                .ToListAsync();

            var nonRdSettings = settings.Where(s => s.ItemType != "RD").OrderBy(s => s.SequenceOrder).ToList();
            var rdSettings = settings.Where(s => s.ItemType == "RD").OrderBy(s => s.SequenceOrder).ToList();
            int? firstRdSeq = rdSettings.Any() ? rdSettings.Min(s => s.SequenceOrder) : (int?)null;

            string searchNorm = (request.SearchQuery ?? string.Empty).Trim().ToLowerInvariant();
            decimal contributionInput = Math.Max(0m, Math.Round(request.ContributionAmount, 2, MidpointRounding.AwayFromZero));

            var previewRows = new List<PreviewMemberRowDto>();

            foreach (var m in members)
            {
                var c = m.Customer!;
                string empCode = DemandPayrollHelper.ResolveEmpCode(c, empBankMap);
                string cif = c.CIFNo ?? string.Empty;
                string fullName = c.FullName;

                if (!string.IsNullOrEmpty(searchNorm))
                {
                    bool matches = empCode.ToLowerInvariant().Contains(searchNorm) ||
                                   cif.ToLowerInvariant().Contains(searchNorm) ||
                                   fullName.ToLowerInvariant().Contains(searchNorm);
                    if (!matches) continue;
                }

                var mLoans = loans.Where(l => (l.CustomerID == c.CustomerID) || (l.MemberID == m.MemberID)).ToList();
                bool hasAnyActiveLoan = mLoans.Any(l => l.PrincipalBalance > 0m || l.InterestBalance > 0m || l.OverdueInterestBalance > 0m);

                if (request.OnlyBorrowers && !hasAnyActiveLoan)
                {
                    continue;
                }

                var cells = new List<PreviewCellDto>();

                foreach (var st in nonRdSettings)
                {
                    if (st.ItemType == "LOAN" && st.LoanRateID.HasValue)
                    {
                        var schemeLoans = mLoans
                            .Where(l => l.LoanRateID == st.LoanRateID.Value &&
                                        (l.PrincipalBalance > 0m || l.InterestBalance > 0m || l.OverdueInterestBalance > 0m))
                            .OrderBy(l => l.OpeningDate)
                            .ThenBy(l => l.LoanAccountID)
                            .ToList();

                        decimal sumBalance = 0m;
                        decimal sumOverduePrincipal = 0m;
                        decimal sumRegularInterest = 0m;
                        decimal sumPenalInterest = 0m;

                        foreach (var loan in schemeLoans)
                        {
                            schedulesByLoan.TryGetValue(loan.LoanAccountID, out var lSchedules);
                            collectionsByLoan.TryGetValue(loan.LoanAccountID, out var lCollections);
                            lSchedules ??= new List<LoanInstallmentSchedule>();
                            lCollections ??= new List<LoanCollection>();

                            var snap = LegalRecoveryTrackerHelper.ComputeLoanDuesSnapshot(loan, lSchedules, lCollections, targetDate);

                            decimal duePrin = snap.OverduePrincipal;
                            if (!lSchedules.Any() && duePrin <= 0m && loan.PrincipalBalance > 0m && loan.InstallmentAmount > 0m)
                            {
                                bool paidInDemandMonth = loan.LastInstallmentPaidDate.HasValue &&
                                    loan.LastInstallmentPaidDate.Value.Year == targetDate.Year &&
                                    loan.LastInstallmentPaidDate.Value.Month == targetDate.Month &&
                                    loan.LastInstallmentPaidDate.Value.Date <= targetDate.Date;

                                if (!paidInDemandMonth)
                                {
                                    duePrin = Math.Min(loan.PrincipalBalance, loan.InstallmentAmount);
                                }
                            }

                            sumBalance += snap.PrincipalBalance;
                            sumOverduePrincipal += duePrin;
                            sumRegularInterest += snap.TotalRegularInterestDue;
                            if (st.IncludeOverduePenalInterest)
                            {
                                sumPenalInterest += snap.TotalPenalInterestDue;
                            }
                        }

                        cells.Add(new PreviewCellDto
                        {
                            DemandColumnSettingId = st.DemandColumnSettingId,
                            SequenceOrder = st.SequenceOrder,
                            ItemType = st.ItemType,
                            ColumnHeaderMr = st.ColumnHeaderMr,
                            SchemeId = st.LoanRateID,
                            SourceAccountIdsCsv = string.Join(",", schemeLoans.Select(l => l.LoanAccountID)),
                            AccountCount = schemeLoans.Count,
                            HasSubLedgerAccount = schemeLoans.Any(),
                            CurrentBalanceAmount = Math.Round(sumBalance, 2, MidpointRounding.AwayFromZero),
                            DemandPrincipalOrDeposit = Math.Round(sumOverduePrincipal, 2, MidpointRounding.AwayFromZero),
                            DemandInterest = Math.Round(sumRegularInterest + sumPenalInterest, 2, MidpointRounding.AwayFromZero),
                            DemandPenalInterest = Math.Round(sumPenalInterest, 2, MidpointRounding.AwayFromZero),
                            PrincipalOrDepositLedgerID = st.PrincipalOrDepositLedgerID,
                            InterestLedgerID = st.InterestLedgerID,
                            ReceivableInterestLedgerID = st.ReceivableInterestLedgerID,
                            OverdueInterestLedgerID = st.OverdueInterestLedgerID,
                            LoanIntraAllocationOrder = st.LoanIntraAllocationOrder
                        });
                    }
                    else if (st.ItemType == "THRIFT_SAVING")
                    {
                        var thriftAcc = savingAccounts
                            .Where(s => s.CustomerID == c.CustomerID &&
                                        (!st.SavingSchemeID.HasValue || s.SavingSchemeID == st.SavingSchemeID.Value))
                            .OrderBy(s => s.SavingAccountID)
                            .FirstOrDefault();

                        decimal prefillAmt = st.IsContributionTarget && contributionInput > 0m
                            ? contributionInput
                            : st.DefaultAmount;

                        cells.Add(new PreviewCellDto
                        {
                            DemandColumnSettingId = st.DemandColumnSettingId,
                            SequenceOrder = st.SequenceOrder,
                            ItemType = st.ItemType,
                            ColumnHeaderMr = st.ColumnHeaderMr,
                            SchemeId = st.SavingSchemeID,
                            AccountId = thriftAcc?.SavingAccountID,
                            AccountCount = thriftAcc != null ? 1 : 0,
                            HasSubLedgerAccount = thriftAcc != null,
                            CurrentBalanceAmount = thriftAcc?.CurrentBalance ?? 0m,
                            DemandPrincipalOrDeposit = Math.Round(prefillAmt, 2, MidpointRounding.AwayFromZero),
                            DemandInterest = 0m,
                            PrincipalOrDepositLedgerID = st.PrincipalOrDepositLedgerID
                        });
                    }
                    else if (st.ItemType == "SHARE")
                    {
                        var shAcc = shareAccounts.FirstOrDefault(s => s.CustomerID == c.CustomerID || s.MemberId == m.MemberID);
                        cells.Add(new PreviewCellDto
                        {
                            DemandColumnSettingId = st.DemandColumnSettingId,
                            SequenceOrder = st.SequenceOrder,
                            ItemType = st.ItemType,
                            ColumnHeaderMr = st.ColumnHeaderMr,
                            SchemeId = st.ShareSchemeId,
                            AccountId = shAcc?.ShareAccountId,
                            AccountCount = shAcc != null ? 1 : 0,
                            HasSubLedgerAccount = shAcc != null,
                            CurrentBalanceAmount = shAcc?.TotalShareAmount ?? 0m,
                            DemandPrincipalOrDeposit = st.DefaultAmount,
                            PrincipalOrDepositLedgerID = st.PrincipalOrDepositLedgerID
                        });
                    }
                    else // LEDGER_OTHER
                    {
                        decimal prefillOther = st.IsContributionTarget && contributionInput > 0m
                            ? contributionInput
                            : st.DefaultAmount;

                        cells.Add(new PreviewCellDto
                        {
                            DemandColumnSettingId = st.DemandColumnSettingId,
                            SequenceOrder = st.SequenceOrder,
                            ItemType = st.ItemType,
                            ColumnHeaderMr = st.ColumnHeaderMr,
                            HasSubLedgerAccount = true,
                            CurrentBalanceAmount = 0m,
                            DemandPrincipalOrDeposit = Math.Round(prefillOther, 2, MidpointRounding.AwayFromZero),
                            PrincipalOrDepositLedgerID = st.PrincipalOrDepositLedgerID
                        });
                    }
                }

                // Multi-RD Sub-Row Assembly strictly ordered by DemandColumnSettings.SequenceOrder
                var memberRdItems = new List<PreviewRdItemDto>();
                if (rdSettings.Any())
                {
                    var empRdAccounts = rdAccounts.Where(r => r.CustomerID == c.CustomerID).ToList();
                    foreach (var rdSet in rdSettings)
                    {
                        var matchedAccounts = empRdAccounts
                            .Where(r => r.RdSchemeID == rdSet.RdSchemeID)
                            .OrderBy(r => r.OpeningDate)
                            .ThenBy(r => r.RdAccountID)
                            .ToList();

                        foreach (var acc in matchedAccounts)
                        {
                            decimal rdDue = acc.InstallmentAmount > 0m ? acc.InstallmentAmount : rdSet.DefaultAmount;
                            memberRdItems.Add(new PreviewRdItemDto
                            {
                                DemandColumnSettingId = rdSet.DemandColumnSettingId,
                                SequenceOrder = rdSet.SequenceOrder,
                                ColumnHeaderMr = rdSet.ColumnHeaderMr,
                                RdSchemeID = rdSet.RdSchemeID ?? acc.RdSchemeID,
                                AccountId = acc.RdAccountID,
                                AccountNo = acc.AccountNo,
                                DisplaySubLabel = $"{rdSet.ColumnHeaderMr} ({acc.AccountNo})",
                                CurrentBalanceAmount = acc.TotalDepositedAmount,
                                DemandPrincipalOrDeposit = Math.Round(rdDue, 2, MidpointRounding.AwayFromZero),
                                PrincipalOrDepositLedgerID = rdSet.PrincipalOrDepositLedgerID ?? rdSet.RdScheme?.RdLiabilityLedgerID
                            });
                        }
                    }

                    // Order all RDs strictly by DemandSettings.SequenceOrder, then AccountId
                    memberRdItems = memberRdItems
                        .OrderBy(r => r.SequenceOrder)
                        .ThenBy(r => r.AccountId)
                        .ToList();

                    for (int idx = 0; idx < memberRdItems.Count; idx++)
                    {
                        memberRdItems[idx].SubRowIndex = idx;
                    }
                }

                decimal rowTotal = cells.Sum(x => x.DemandPrincipalOrDeposit + x.DemandInterest)
                                 + memberRdItems.Sum(x => x.DemandPrincipalOrDeposit);

                previewRows.Add(new PreviewMemberRowDto
                {
                    MemberId = m.MemberID,
                    CustomerId = c.CustomerID,
                    EmpCode = empCode,
                    CIFNo = cif,
                    MemberName = fullName,
                    IsSelected = true,
                    Cells = cells,
                    PrimaryRd = memberRdItems.FirstOrDefault(),
                    RdSubRows = memberRdItems.Skip(1).ToList(),
                    TotalDeduction = Math.Round(rowTotal, 2, MidpointRounding.AwayFromZero)
                });
            }

            // Order by numeric EmpCode naturally (matching screenshot 7, 12, 21, 22...)
            var sortedRows = previewRows
                .OrderBy(r => int.TryParse(r.EmpCode, out int n) ? n : int.MaxValue)
                .ThenBy(r => r.EmpCode)
                .ThenBy(r => r.CIFNo)
                .ToList();

            for (int i = 0; i < sortedRows.Count; i++)
            {
                sortedRows[i].SrNo = i + 1;
            }

            return Ok(new
            {
                needsSettingsSetup = false,
                employerName = employer.Name,
                demandDate = targetDate,
                hasRdZone = rdSettings.Any(),
                rdZoneSequence = firstRdSeq,
                columns = nonRdSettings.Select(s => new
                {
                    s.DemandColumnSettingId,
                    s.SequenceOrder,
                    s.ItemType,
                    s.ColumnHeaderMr,
                    s.ShowBalanceColumn,
                    s.IsContributionTarget
                }),
                rdConfigs = rdSettings.Select(s => new
                {
                    s.DemandColumnSettingId,
                    s.SequenceOrder,
                    s.ColumnHeaderMr,
                    s.RdSchemeID
                }),
                rows = sortedRows
            });
        }

        // POST: api/DemandNotices/validate
        [HttpPost("validate")]
        public async Task<ActionResult<object>> ValidateDemandGrid([FromBody] SaveDemandGridRequestDto request)
        {
            var errors = new List<string>();
            var warnings = new List<string>();
            var rowIssues = new Dictionary<int, List<string>>();

            void AddRowIssue(int memberId, string msg, bool isError)
            {
                if (!rowIssues.TryGetValue(memberId, out var list))
                {
                    list = new List<string>();
                    rowIssues[memberId] = list;
                }
                list.Add(msg);
                if (isError) errors.Add(msg);
                else warnings.Add(msg);
            }

            if (request == null || request.EmployerId <= 0)
            {
                errors.Add("कृपया नियोक्ता (खाते प्रकार) निवडा.");
                return Ok(new { isValid = false, errors, warnings, rowIssues });
            }

            DateTime demandDate = request.DemandDate.Date;
            int month = demandDate.Month;
            int year = demandDate.Year;

            bool duplicateExists = await _context.DemandNotices
                .AsNoTracking()
                .AnyAsync(d => d.EmployerId == request.EmployerId &&
                               d.BranchId == (request.BranchId > 0 ? request.BranchId : 1) &&
                               d.Month == month &&
                               d.Year == year &&
                               d.Status != "Cancelled" &&
                               d.DemandNoticeId != (request.DemandNoticeId ?? 0));

            if (duplicateExists)
            {
                warnings.Add($"या नियोक्त्याची {month:D2}/{year} या महिन्याची एक डिमान्ड नोटीस आधीच जतन केलेली आहे.");
            }

            var selectedRows = (request.Rows ?? new List<SaveDemandMemberRowDto>())
                .Where(r => r.IsSelected)
                .ToList();

            if (!selectedRows.Any())
            {
                errors.Add("कृपया किमान एक खातेदार (Checkbox) निवडा.");
            }

            var allSettingsMap = await _context.DemandColumnSettings
                .AsNoTracking()
                .ToDictionaryAsync(s => s.DemandColumnSettingId);

            var rdSchemesMap = await _context.RdSchemes
                .AsNoTracking()
                .ToDictionaryAsync(r => r.RdSchemeID);

            var inactiveSettingWarningsAdded = new HashSet<int>();

            decimal grandTotal = 0m;

            foreach (var r in selectedRows)
            {
                decimal memberSum = 0m;
                foreach (var cell in r.Cells ?? new List<SaveDemandCellDto>())
                {
                    decimal p = Math.Round(cell.DemandPrincipalOrDeposit, 2, MidpointRounding.AwayFromZero);
                    decimal i = Math.Round(cell.DemandInterest, 2, MidpointRounding.AwayFromZero);
                    if (p < 0m || i < 0m)
                    {
                        AddRowIssue(r.MemberId, $"{r.MemberName} (Emp {r.EmpCode}): ऋण (Negative) रक्कम चालणार नाही.", true);
                    }

                    if (cell.ItemType == "LOAN" && p > cell.CurrentBalanceAmount + 0.01m)
                    {
                        AddRowIssue(r.MemberId, $"{r.MemberName} (Emp {r.EmpCode}): '{cell.ColumnHeaderMr}' हप्ता (₹{p:N2}) कर्ज बाकीपेक्षा (₹{cell.CurrentBalanceAmount:N2}) जास्त आहे.", true);
                    }

                    if ((p > 0m || i > 0m) && allSettingsMap.TryGetValue(cell.DemandColumnSettingId, out var setting))
                    {
                        if (!setting.IsActive && inactiveSettingWarningsAdded.Add(setting.DemandColumnSettingId))
                        {
                            warnings.Add($"'{setting.ColumnHeaderMr}' हा कॉलम सध्या डिमांड सेटिंग्जमध्ये निष्क्रिय (Inactive) आहे.");
                        }

                        if (!setting.PrincipalOrDepositLedgerID.HasValue || setting.PrincipalOrDepositLedgerID.Value <= 0)
                        {
                            AddRowIssue(r.MemberId, $"'{setting.ColumnHeaderMr}' साठी डिमांड सेटिंग्जमध्ये जमा लेजर मॅप केलेले नाही.", true);
                        }
                        if (cell.ItemType == "LOAN" && i > 0m && (!setting.InterestLedgerID.HasValue || setting.InterestLedgerID.Value <= 0))
                        {
                            AddRowIssue(r.MemberId, $"'{setting.ColumnHeaderMr}' साठी डिमांड सेटिंग्जमध्ये व्याज लेजर मॅप केलेले नाही.", true);
                        }
                        if (cell.ItemType == "THRIFT_SAVING" && p > 0m && (!cell.AccountId.HasValue || cell.AccountId.Value <= 0))
                        {
                            AddRowIssue(r.MemberId, $"{r.MemberName} (Emp {r.EmpCode}): '{setting.ColumnHeaderMr}' खाते अद्याप उघडलेले नाही — वसुलीवेळी नवीन खाते आपोआप तयार होईल.", false);
                        }
                    }

                    memberSum += p + i;
                }

                var allRds = new List<SaveDemandRdItemDto>();
                if (r.PrimaryRd != null) allRds.Add(r.PrimaryRd);
                if (r.RdSubRows != null) allRds.AddRange(r.RdSubRows);

                foreach (var rd in allRds)
                {
                    decimal rdAmt = Math.Round(rd.DemandPrincipalOrDeposit, 2, MidpointRounding.AwayFromZero);
                    if (rdAmt < 0m)
                    {
                        AddRowIssue(r.MemberId, $"{r.MemberName} (Emp {r.EmpCode}): RD रक्कम ऋण असू शकत नाही.", true);
                    }
                    if (rdAmt > 0m && (!rd.AccountId.HasValue || rd.AccountId.Value <= 0))
                    {
                        AddRowIssue(r.MemberId, $"{r.MemberName} (Emp {r.EmpCode}): '{rd.ColumnHeaderMr}' साठी सक्रिय RD खाते आढळले नाही.", true);
                    }

                    if (rdAmt > 0m)
                    {
                        allSettingsMap.TryGetValue(rd.DemandColumnSettingId, out var rdSetting);
                        if (rdSetting != null && !rdSetting.IsActive && inactiveSettingWarningsAdded.Add(rdSetting.DemandColumnSettingId))
                        {
                            warnings.Add($"'{rdSetting.ColumnHeaderMr}' हा RD कॉलम सध्या डिमांड सेटिंग्जमध्ये निष्क्रिय (Inactive) आहे.");
                        }

                        int? resolvedRdSchemeId = rd.RdSchemeID ?? rdSetting?.RdSchemeID;
                        int? schemeLiabilityLedgerId = null;
                        if (resolvedRdSchemeId.HasValue && rdSchemesMap.TryGetValue(resolvedRdSchemeId.Value, out var rdScheme))
                        {
                            schemeLiabilityLedgerId = rdScheme.RdLiabilityLedgerID;
                        }

                        int? rdLedgerId = rdSetting?.PrincipalOrDepositLedgerID
                            ?? rd.PrincipalOrDepositLedgerID
                            ?? schemeLiabilityLedgerId;

                        if (!rdLedgerId.HasValue || rdLedgerId.Value <= 0)
                        {
                            AddRowIssue(r.MemberId, $"'{rd.ColumnHeaderMr}' साठी डिमांड सेटिंग्ज किंवा RD स्कीममध्ये जमा लेजर मॅप केलेले नाही.", true);
                        }
                    }

                    memberSum += rdAmt;
                }

                grandTotal += memberSum;
            }

            if (selectedRows.Any() && grandTotal <= 0m)
            {
                errors.Add("निवडलेल्या सर्व कर्मचाऱ्यांची एकूण डिमान्ड रक्कम ₹0.00 आहे. कृपया किमान एक कपात रक्कम भरा.");
            }

            return Ok(new
            {
                isValid = !errors.Any(),
                errors = errors.Distinct().ToList(),
                warnings = warnings.Distinct().ToList(),
                rowIssues
            });
        }

        // POST: api/DemandNotices/save-grid
        [HttpPost("save-grid")]
        [Authorize(Roles = "Admin,SuperAdmin,Super Admin,SystemAdmin,HeadOffice,HO_Manager,HO Manager,GeneralManager,CEO,Chairman,Manager,BranchManager,Branch_Manager")]
        public async Task<ActionResult<object>> SaveDemandGrid([FromBody] SaveDemandGridRequestDto request)
        {
            if (request == null || request.EmployerId <= 0)
            {
                return BadRequest("कृपया वैध नियोक्ता निवडा.");
            }

            var employer = await _context.EmployerMasters.AsNoTracking().FirstOrDefaultAsync(e => e.Id == request.EmployerId);
            if (employer == null)
            {
                return NotFound("निवडलेला नियोक्ता आढळला नाही.");
            }

            var selectedRows = (request.Rows ?? new List<SaveDemandMemberRowDto>())
                .Where(r => r.IsSelected)
                .ToList();

            if (!selectedRows.Any())
            {
                return BadRequest("जतन करण्यासाठी किमान एक खातेदार निवडणे आवश्यक आहे.");
            }

            int branchId = request.BranchId > 0 ? request.BranchId : 1;
            DateTime demandDate = request.DemandDate.Date;
            int month = demandDate.Month;
            int year = demandDate.Year;

            var settingsMap = await _context.DemandColumnSettings
                .AsNoTracking()
                .ToDictionaryAsync(s => s.DemandColumnSettingId);

            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                DemandNotice notice;
                if (request.DemandNoticeId.HasValue && request.DemandNoticeId.Value > 0)
                {
                    notice = await _context.DemandNotices
                        .Include(n => n.MemberDetails)
                            .ThenInclude(m => m.ColumnItems)
                        .FirstOrDefaultAsync(n => n.DemandNoticeId == request.DemandNoticeId.Value)
                        ?? throw new InvalidOperationException("संपादनासाठी डिमान्ड नोटीस आढळली नाही.");

                    bool hasRecoveries = await _context.DemandRecoveries.AnyAsync(r => r.DemandNoticeId == notice.DemandNoticeId);
                    if (hasRecoveries)
                    {
                        await tx.RollbackAsync();
                        return BadRequest("या डिमान्ड नोटीसची वसुली आधीच सुरू झालेली असल्याने ती बदलता येत नाही.");
                    }

                    var oldItems = notice.MemberDetails.SelectMany(m => m.ColumnItems).ToList();
                    if (oldItems.Any()) _context.DemandMemberColumnItems.RemoveRange(oldItems);
                    if (notice.MemberDetails.Any()) _context.DemandMemberDetails.RemoveRange(notice.MemberDetails);
                    await _context.SaveChangesAsync();
                }
                else
                {
                    string prefix = $"DEM-{branchId}-{request.EmployerId}-{year}{month:D2}-";
                    int existingCount = await _context.DemandNotices
                        .CountAsync(d => d.EmployerId == request.EmployerId && d.BranchId == branchId && d.Month == month && d.Year == year);

                    notice = new DemandNotice
                    {
                        NoticeNumber = $"{prefix}{(existingCount + 1):D2}",
                        Month = month,
                        Year = year,
                        EmployerId = request.EmployerId,
                        BranchId = branchId,
                        Status = "Pending",
                        CreatedDate = DateTime.UtcNow,
                        CreatedBy = 1
                    };
                    _context.DemandNotices.Add(notice);
                }

                notice.DemandDate = demandDate;
                notice.OnlyBorrowers = request.OnlyBorrowers;
                notice.ContributionInputAmount = Math.Round(request.ContributionAmount, 2, MidpointRounding.AwayFromZero);
                notice.Remarks = request.Remarks;

                decimal totalDemand = 0m;
                var newMemberDetails = new List<DemandMemberDetail>();

                foreach (var row in selectedRows)
                {
                    decimal loanTotal = 0m;
                    decimal savingTotal = 0m;
                    decimal rdTotal = 0m;
                    decimal shareTotal = 0m;
                    var colItems = new List<DemandMemberColumnItem>();

                    foreach (var cell in row.Cells ?? new List<SaveDemandCellDto>())
                    {
                        settingsMap.TryGetValue(cell.DemandColumnSettingId, out var st);
                        int seq = st?.SequenceOrder ?? cell.SequenceOrder;
                        decimal pAmt = Math.Max(0m, Math.Round(cell.DemandPrincipalOrDeposit, 2, MidpointRounding.AwayFromZero));
                        decimal iAmt = Math.Max(0m, Math.Round(cell.DemandInterest, 2, MidpointRounding.AwayFromZero));
                        decimal penAmt = Math.Max(0m, Math.Round(cell.DemandPenalInterest, 2, MidpointRounding.AwayFromZero));

                        if (cell.ItemType == "LOAN") loanTotal += pAmt + iAmt;
                        else if (cell.ItemType == "THRIFT_SAVING" || cell.ItemType == "LEDGER_OTHER") savingTotal += pAmt;
                        else if (cell.ItemType == "SHARE") shareTotal += pAmt;

                        colItems.Add(new DemandMemberColumnItem
                        {
                            DemandColumnSettingId = cell.DemandColumnSettingId > 0 ? cell.DemandColumnSettingId : null,
                            SequenceOrder = seq,
                            ItemType = cell.ItemType,
                            ColumnHeaderMr = st?.ColumnHeaderMr ?? cell.ColumnHeaderMr,
                            SchemeId = cell.SchemeId ?? st?.LoanRateID ?? st?.SavingSchemeID ?? st?.ShareSchemeId,
                            AccountId = cell.AccountId,
                            SourceAccountIdsCsv = cell.SourceAccountIdsCsv,
                            SubRowIndex = 0,
                            PrincipalOrDepositLedgerID = st?.PrincipalOrDepositLedgerID ?? cell.PrincipalOrDepositLedgerID,
                            InterestLedgerID = st?.InterestLedgerID ?? cell.InterestLedgerID,
                            ReceivableInterestLedgerID = st?.ReceivableInterestLedgerID ?? cell.ReceivableInterestLedgerID,
                            OverdueInterestLedgerID = st?.OverdueInterestLedgerID ?? cell.OverdueInterestLedgerID,
                            LoanIntraAllocationOrder = st?.LoanIntraAllocationOrder ?? cell.LoanIntraAllocationOrder ?? "INTEREST_FIRST",
                            CurrentBalanceAmount = Math.Round(cell.CurrentBalanceAmount, 2, MidpointRounding.AwayFromZero),
                            DemandPrincipalOrDeposit = pAmt,
                            DemandInterest = iAmt,
                            DemandPenalInterest = penAmt
                        });
                    }

                    // Multi-RD items preserving exact SequenceOrder from DemandSettings and SubRowIndex
                    var rowRds = new List<SaveDemandRdItemDto>();
                    if (row.PrimaryRd != null) rowRds.Add(row.PrimaryRd);
                    if (row.RdSubRows != null) rowRds.AddRange(row.RdSubRows);

                    int rdSubIdx = 0;
                    foreach (var rd in rowRds.OrderBy(x => x.SequenceOrder).ThenBy(x => x.SubRowIndex))
                    {
                        settingsMap.TryGetValue(rd.DemandColumnSettingId, out var rdSt);
                        decimal rdAmt = Math.Max(0m, Math.Round(rd.DemandPrincipalOrDeposit, 2, MidpointRounding.AwayFromZero));
                        rdTotal += rdAmt;

                        colItems.Add(new DemandMemberColumnItem
                        {
                            DemandColumnSettingId = rd.DemandColumnSettingId > 0 ? rd.DemandColumnSettingId : null,
                            SequenceOrder = rdSt?.SequenceOrder ?? rd.SequenceOrder,
                            ItemType = "RD",
                            ColumnHeaderMr = rdSt?.ColumnHeaderMr ?? rd.ColumnHeaderMr,
                            SchemeId = rd.RdSchemeID ?? rdSt?.RdSchemeID,
                            AccountId = rd.AccountId,
                            SubRowIndex = rdSubIdx++,
                            DisplaySubLabel = rd.DisplaySubLabel,
                            PrincipalOrDepositLedgerID = rdSt?.PrincipalOrDepositLedgerID ?? rd.PrincipalOrDepositLedgerID,
                            CurrentBalanceAmount = Math.Round(rd.CurrentBalanceAmount, 2, MidpointRounding.AwayFromZero),
                            DemandPrincipalOrDeposit = rdAmt
                        });
                    }

                    decimal rowDeduction = Math.Round(loanTotal + savingTotal + rdTotal + shareTotal, 2, MidpointRounding.AwayFromZero);
                    if (rowDeduction <= 0m) continue;

                    totalDemand += rowDeduction;

                    newMemberDetails.Add(new DemandMemberDetail
                    {
                        MemberId = row.MemberId,
                        CustomerId = row.CustomerId,
                        EmpCode = row.EmpCode,
                        CIFNo = row.CIFNo,
                        MemberName = row.MemberName,
                        IsSelected = true,
                        LoanInstallment = loanTotal,
                        SavingDeposit = savingTotal,
                        ShareDeposit = shareTotal,
                        RdDeposit = rdTotal,
                        TotalDeduction = rowDeduction,
                        RecoveredAmount = 0m,
                        RecoveryStatus = "Pending",
                        IsProcessed = false,
                        ColumnItems = colItems
                    });
                }

                if (!newMemberDetails.Any() || totalDemand <= 0m)
                {
                    await tx.RollbackAsync();
                    return BadRequest("किमान एका निवडलेल्या कर्मचाऱ्याची डिमान्ड रक्कम ₹0 पेक्षा जास्त असणे आवश्यक आहे.");
                }

                notice.TotalDemandAmount = Math.Round(totalDemand, 2, MidpointRounding.AwayFromZero);
                notice.MemberDetails = newMemberDetails;

                await _context.SaveChangesAsync();
                await tx.CommitAsync();

                return Ok(new
                {
                    message = $"पगार डिमान्ड यादी ({notice.NoticeNumber}) यशस्वीरीत्या जतन झाली!",
                    notice.DemandNoticeId,
                    notice.NoticeNumber,
                    notice.TotalDemandAmount,
                    memberCount = newMemberDetails.Count
                });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                return BadRequest($"डिमान्ड जतन करताना त्रुटी: {ex.Message}");
            }
        }

        // Legacy compatibility endpoint kept intact
        [HttpPost("generate")]
        [Authorize(Roles = "Admin,SuperAdmin,Super Admin,SystemAdmin,HeadOffice,HO_Manager,HO Manager,GeneralManager,CEO,Chairman,Manager,BranchManager,Branch_Manager")]
        public async Task<ActionResult<DemandNotice>> GenerateDemand([FromBody] GenerateDemandDto request)
        {
            var existing = await _context.DemandNotices
                .FirstOrDefaultAsync(d => d.EmployerId == request.EmployerId && d.Month == request.Month && d.Year == request.Year && d.Status != "Cancelled");

            if (existing != null)
            {
                return BadRequest("Demand notice already exists for this employer for the specified month and year.");
            }

            var employer = await _context.EmployerMasters.FindAsync(request.EmployerId);
            if (employer == null) return NotFound("Employer not found.");

            var members = await _context.Members
                .Include(m => m.Customer)
                .Where(m => m.Customer != null && m.Customer.EmployerId == request.EmployerId && m.Status == "Active")
                .ToListAsync();

            var memberIds = members.Select(m => m.MemberID).ToList();
            var activeLoans = await _context.LoanAccounts
                .Where(l => l.MemberID.HasValue && memberIds.Contains(l.MemberID.Value) && l.Status == "Active")
                .ToListAsync();

            var demandNotice = new DemandNotice
            {
                NoticeNumber = $"DEM-{request.EmployerId}-{request.Month}-{request.Year}",
                Month = request.Month,
                Year = request.Year,
                DemandDate = new DateTime(request.Year, request.Month, DateTime.DaysInMonth(request.Year, request.Month)),
                EmployerId = request.EmployerId,
                Status = "Pending"
            };

            var details = new List<DemandMemberDetail>();
            foreach (var member in members)
            {
                var memberLoans = activeLoans.Where(l => l.MemberID == member.MemberID).ToList();
                decimal emiTotal = memberLoans.Sum(l => l.InstallmentAmount);
                decimal savingDeduction = 500;
                decimal shareDeduction = 100;

                var detail = new DemandMemberDetail
                {
                    MemberId = member.MemberID,
                    CustomerId = member.CustomerID,
                    CIFNo = member.Customer?.CIFNo,
                    MemberName = member.Customer?.FullName,
                    LoanInstallment = emiTotal,
                    SavingDeposit = savingDeduction,
                    ShareDeposit = shareDeduction,
                    TotalDeduction = emiTotal + savingDeduction + shareDeduction
                };

                if (detail.TotalDeduction > 0) details.Add(detail);
            }

            demandNotice.MemberDetails = details;
            demandNotice.TotalDemandAmount = details.Sum(d => d.TotalDeduction);
            _context.DemandNotices.Add(demandNotice);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetDemandNotice", new { id = demandNotice.DemandNoticeId }, demandNotice);
        }

        // DELETE: api/DemandNotices/5
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,SuperAdmin,Super Admin,SystemAdmin,HeadOffice,HO_Manager,HO Manager,GeneralManager,CEO,Chairman,Manager,BranchManager,Branch_Manager")]
        public async Task<IActionResult> DeleteDemandNotice(int id)
        {
            var notice = await _context.DemandNotices
                .Include(d => d.MemberDetails)
                    .ThenInclude(m => m.ColumnItems)
                .FirstOrDefaultAsync(d => d.DemandNoticeId == id);

            if (notice == null)
            {
                return NotFound("डिमान्ड नोटीस आढळली नाही.");
            }

            bool hasRecoveries = await _context.DemandRecoveries.AnyAsync(r => r.DemandNoticeId == id);
            if (hasRecoveries)
            {
                return BadRequest("या डिमान्ड नोटीसवर वसुली नोंद झालेली असल्यामुळे ती थेट डिलीट करता येत नाही.");
            }

            var items = notice.MemberDetails.SelectMany(m => m.ColumnItems).ToList();
            if (items.Any()) _context.DemandMemberColumnItems.RemoveRange(items);
            if (notice.MemberDetails.Any()) _context.DemandMemberDetails.RemoveRange(notice.MemberDetails);
            _context.DemandNotices.Remove(notice);
            await _context.SaveChangesAsync();

            return Ok(new { message = $"डिमान्ड नोटीस ({notice.NoticeNumber}) यशस्वीरीत्या डिलीट केली." });
        }
    }

    public class GenerateDemandDto
    {
        public int EmployerId { get; set; }
        public int Month { get; set; }
        public int Year { get; set; }
    }

    public class DemandPreviewRequestDto
    {
        public int BranchId { get; set; }
        public int EmployerId { get; set; }
        public DateTime DemandDate { get; set; } = DateTime.Today;
        public bool OnlyBorrowers { get; set; }
        public decimal ContributionAmount { get; set; }
        public string? SearchQuery { get; set; }
    }

    public class PreviewMemberRowDto
    {
        public int SrNo { get; set; }
        public int MemberId { get; set; }
        public int CustomerId { get; set; }
        public string EmpCode { get; set; } = string.Empty;
        public string CIFNo { get; set; } = string.Empty;
        public string MemberName { get; set; } = string.Empty;
        public bool IsSelected { get; set; } = true;
        public List<PreviewCellDto> Cells { get; set; } = new();
        public PreviewRdItemDto? PrimaryRd { get; set; }
        public List<PreviewRdItemDto> RdSubRows { get; set; } = new();
        public decimal TotalDeduction { get; set; }
    }

    public class PreviewCellDto
    {
        public int DemandColumnSettingId { get; set; }
        public int SequenceOrder { get; set; }
        public string ItemType { get; set; } = "LOAN";
        public string ColumnHeaderMr { get; set; } = string.Empty;
        public int? SchemeId { get; set; }
        public int? AccountId { get; set; }
        public string? SourceAccountIdsCsv { get; set; }
        public int AccountCount { get; set; }
        public bool HasSubLedgerAccount { get; set; }
        public decimal CurrentBalanceAmount { get; set; }
        public decimal DemandPrincipalOrDeposit { get; set; }
        public decimal DemandInterest { get; set; }
        public decimal DemandPenalInterest { get; set; }
        public int? PrincipalOrDepositLedgerID { get; set; }
        public int? InterestLedgerID { get; set; }
        public int? ReceivableInterestLedgerID { get; set; }
        public int? OverdueInterestLedgerID { get; set; }
        public string LoanIntraAllocationOrder { get; set; } = "INTEREST_FIRST";
    }

    public class PreviewRdItemDto
    {
        public int DemandColumnSettingId { get; set; }
        public int SequenceOrder { get; set; }
        public int SubRowIndex { get; set; }
        public string ColumnHeaderMr { get; set; } = string.Empty;
        public int? RdSchemeID { get; set; }
        public int? AccountId { get; set; }
        public string AccountNo { get; set; } = string.Empty;
        public string DisplaySubLabel { get; set; } = string.Empty;
        public decimal CurrentBalanceAmount { get; set; }
        public decimal DemandPrincipalOrDeposit { get; set; }
        public int? PrincipalOrDepositLedgerID { get; set; }
    }

    public class SaveDemandGridRequestDto
    {
        public int? DemandNoticeId { get; set; }
        public int BranchId { get; set; } = 1;
        public int EmployerId { get; set; }
        public DateTime DemandDate { get; set; } = DateTime.Today;
        public bool OnlyBorrowers { get; set; }
        public decimal ContributionAmount { get; set; }
        public string? Remarks { get; set; }
        public List<SaveDemandMemberRowDto> Rows { get; set; } = new();
    }

    public class SaveDemandMemberRowDto
    {
        public int MemberId { get; set; }
        public int? CustomerId { get; set; }
        public string? EmpCode { get; set; }
        public string? CIFNo { get; set; }
        public string? MemberName { get; set; }
        public bool IsSelected { get; set; } = true;
        public List<SaveDemandCellDto> Cells { get; set; } = new();
        public SaveDemandRdItemDto? PrimaryRd { get; set; }
        public List<SaveDemandRdItemDto> RdSubRows { get; set; } = new();
    }

    public class SaveDemandCellDto
    {
        public int DemandColumnSettingId { get; set; }
        public int SequenceOrder { get; set; }
        public string ItemType { get; set; } = "LOAN";
        public string ColumnHeaderMr { get; set; } = string.Empty;
        public int? SchemeId { get; set; }
        public int? AccountId { get; set; }
        public string? SourceAccountIdsCsv { get; set; }
        public decimal CurrentBalanceAmount { get; set; }
        public decimal DemandPrincipalOrDeposit { get; set; }
        public decimal DemandInterest { get; set; }
        public decimal DemandPenalInterest { get; set; }
        public int? PrincipalOrDepositLedgerID { get; set; }
        public int? InterestLedgerID { get; set; }
        public int? ReceivableInterestLedgerID { get; set; }
        public int? OverdueInterestLedgerID { get; set; }
        public string? LoanIntraAllocationOrder { get; set; }
    }

    public class SaveDemandRdItemDto
    {
        public int DemandColumnSettingId { get; set; }
        public int SequenceOrder { get; set; }
        public int SubRowIndex { get; set; }
        public string ColumnHeaderMr { get; set; } = string.Empty;
        public int? RdSchemeID { get; set; }
        public int? AccountId { get; set; }
        public string? DisplaySubLabel { get; set; }
        public decimal CurrentBalanceAmount { get; set; }
        public decimal DemandPrincipalOrDeposit { get; set; }
        public int? PrincipalOrDepositLedgerID { get; set; }
    }
}
