using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Filters;
using Bhisi.Api.Helpers;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    public class GenerateNoticeDto
    {
        public int BranchId { get; set; }
        public int LoanAccountId { get; set; }
        public string CaseType { get; set; } = "SEC_101"; // SEC_101, SEC_91
        public string NoticeType { get; set; } = "NOTICE_1"; // NOTICE_1, NOTICE_2, FINAL_NOTICE, SRO_DEMAND
        public DateTime? NoticeDate { get; set; }
        public DateTime? DueDate { get; set; }
        public decimal PrincipalDue { get; set; }
        public decimal InterestDue { get; set; }
        public decimal PenalInterestDue { get; set; }
        public decimal NoticeFee { get; set; } = 0;
        public string? PostalTrackingNo { get; set; }
        public string? PaymentMode { get; set; } = "CASH"; // CASH, BANK_TRANSFER, JOURNAL
        public int? BankLedgerId { get; set; }
        public string? ReferenceNo { get; set; }
        public List<string>? GuarantorNoticeRecipients { get; set; } // e.g., ["GUARANTOR_1", "GUARANTOR_2"]
        public string? Remarks { get; set; }
    }

    public class UpdateNoticePostalDto
    {
        public string? PostalTrackingNo { get; set; }
        public string? PostalStatus { get; set; }
        public DateTime? DeliveredDate { get; set; }
        public string? Remarks { get; set; }
    }

    public class FileCaseDto
    {
        public int BranchId { get; set; }
        public int LoanAccountId { get; set; }
        public string CaseType { get; set; } = "SEC_101"; // SEC_101, SEC_91
        public string CaseNumber { get; set; } = string.Empty;
        public string CourtName { get; set; } = "मा. सहाय्यक निबंधक, सहकारी संस्था";
        public string? AdvocateName { get; set; }
        public DateTime? FilingDate { get; set; }
        public decimal PrincipalClaim { get; set; }
        public decimal InterestClaim { get; set; }
        public decimal PenalInterestClaim { get; set; }
        public decimal OtherChargesClaim { get; set; }
        public decimal CourtFeeAmount { get; set; }
        public string? CourtFeeChallanNo { get; set; }
        public string? PaymentMode { get; set; } = "CASH";
        public int? BankLedgerId { get; set; }
        public string? ReferenceNo { get; set; }
        public bool BypassNoticeWaitCheck { get; set; } = false;
        public string? Remarks { get; set; }
    }

    public class GrantCertificateDto
    {
        public int CaseId { get; set; }
        public string CertificateNo { get; set; } = string.Empty;
        public string? CertificateNumber { get; set; }
        public DateTime? CertificateDate { get; set; }
        public decimal SanctionedAmount { get; set; }
        public decimal? GrantedAmount { get; set; }
        public decimal? FutureInterestRate { get; set; }
        public decimal? GrantedInterestRate { get; set; }
        public string? AwardNumber { get; set; }
        public DateTime? AwardDate { get; set; }
        public string? TransferCertificateNo { get; set; }
        public string? Remarks { get; set; }
    }

    public class UpdateCaseStatusDto
    {
        public string Status { get; set; } = string.Empty; // STAYED, DISMISSED, WITHDRAWN, CLOSED_RECOVERED, HEARING
        public string? StayOrderNo { get; set; }
        public DateTime? StayOrderDate { get; set; }
        public string? ClosedReason { get; set; }
        public DateTime? ClosedDate { get; set; }
    }

    public class AddHearingDto
    {
        public int CaseId { get; set; }
        public DateTime? HearingDate { get; set; }
        public string? Stage { get; set; }
        public string? HearingStage { get; set; }
        public string? PresenceType { get; set; }
        public string? BorrowerPresence { get; set; }
        public string? GuarantorPresence { get; set; }
        public string? CourtOrderSummary { get; set; }
        public DateTime? NextHearingDate { get; set; }
        public string? NextHearingPurpose { get; set; }
        public string? AdvocateNotes { get; set; }
    }

    public class CreateExecutionDto
    {
        public int CaseId { get; set; }
        public string ExecutionType { get; set; } = "IMMOVABLE_PROPERTY";
        // SALARY_ATTACHMENT_SEC49, MOVABLE_PROPERTY, IMMOVABLE_PROPERTY, BANK_ACCOUNT_FREEZE
        public string? ExecutionOrderNo { get; set; }
        public string? SroName { get; set; }
        public string? EmployerName { get; set; }
        public string? EmployerAddress { get; set; }
        public decimal? MonthlyDeductionAmount { get; set; }
        public string? PropertyDetails { get; set; }
        public decimal? ValuationAmount { get; set; }
        public decimal? EstimatedValue { get; set; }
        public DateTime? WarrantIssueDate { get; set; }
        public DateTime? OrderDate { get; set; }
        public DateTime? PanchanamaDate { get; set; }
        public DateTime? AuctionNoticeDate { get; set; }
        public DateTime? AuctionDate { get; set; }
        public decimal? ReservePrice { get; set; }
        public string? Remarks { get; set; }
    }

    public class UpdateExecutionStageDto
    {
        public string Status { get; set; } = string.Empty; // ATTACHED, AUCTION_SCHEDULED, AUCTION_COMPLETED, CANCELLED
        public DateTime? PanchanamaDate { get; set; }
        public DateTime? AuctionNoticeDate { get; set; }
        public DateTime? AuctionDate { get; set; }
        public decimal? ReservePrice { get; set; }
        public decimal? HighestBidAmount { get; set; }
        public decimal? SpotDepositAmount { get; set; }
        public DateTime? BalancePaymentDueDate { get; set; }
        public string? BuyerName { get; set; }
        public string? BuyerContact { get; set; }
        public string? SaleCertificateNo { get; set; }
        public DateTime? SaleCertificateDate { get; set; }
        public bool BypassThirtyDayNoticeCheck { get; set; } = false;
        public string? Remarks { get; set; }
    }

    public class SettleExecutionDto
    {
        public decimal RecoveredAmount { get; set; }
        public DateTime? SettlementDate { get; set; }
        public string PaymentMode { get; set; } = "CASH"; // CASH, BANK_TRANSFER
        public int? BankLedgerId { get; set; }
        public string? ReferenceNo { get; set; }
        public string? Remarks { get; set; }
    }

    public class AddLegalExpenseDto
    {
        public int BranchId { get; set; }
        public int? CaseId { get; set; }
        public int LoanAccountId { get; set; }
        public string ExpenseType { get; set; } = "COURT_FEE";
        public decimal Amount { get; set; }
        public DateTime ExpenseDate { get; set; } = DateTime.Today;
        public string? PaidTo { get; set; }
        public string? PayeeName { get; set; }
        public string? PaymentMode { get; set; } = "CASH";
        public int? BankLedgerId { get; set; }
        public string? ReferenceNo { get; set; }
        public bool PostVoucher { get; set; } = true;
        public bool IsDebitedToBorrower { get; set; } = true;
        public bool CapitalizeToLoanPrincipal { get; set; } = false;
        public int? DebitLedgerId { get; set; }
        public int? CreditLedgerId { get; set; }
        public string? Remarks { get; set; }
    }

    public class BulkLoanChargeItemDto
    {
        public int LoanAccountId { get; set; }
        public decimal Amount { get; set; }
    }

    public class BulkAddLoanChargeDto
    {
        public int BranchId { get; set; }
        public DateTime ExpenseDate { get; set; } = DateTime.Today;
        public int CreditLedgerId { get; set; }
        public string? ExpenseType { get; set; }
        public string? Remarks { get; set; }
        public List<BulkLoanChargeItemDto> Items { get; set; } = new();
    }

    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [EnforceBranchScope]
    public class LegalRecoveryController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LegalRecoveryController(AppDbContext context)
        {
            _context = context;
        }

        private (int? ScopedBranchId, bool IsHoAdmin, int OperatingBranchId) GetBranchScope(int? requestedBranchId)
        {
            bool isHo = User.IsHeadOfficeAdmin();
            int opBranch = User.GetOperatingBranchId();
            if (isHo)
            {
                int? scoped = requestedBranchId.HasValue && requestedBranchId.Value > 0 ? requestedBranchId.Value : null;
                return (scoped, true, opBranch > 0 ? opBranch : (scoped ?? 1));
            }
            int lockedBranch = opBranch > 0 ? opBranch : 1;
            return (lockedBranch, false, lockedBranch);
        }

        private bool IsBranchForbidden(int entityBranchId)
        {
            if (User.IsHeadOfficeAdmin()) return false;
            return entityBranchId > 0 && !User.CanAccessBranch(entityBranchId);
        }

        // GET: api/LegalRecovery/dashboard-stats?branchId=1
        [HttpGet("dashboard-stats")]
        public async Task<IActionResult> GetDashboardStats([FromQuery] int? branchId = null)
        {
            var (scopedBranch, _, opBranch) = GetBranchScope(branchId);
            if (branchId.HasValue && branchId.Value > 0 && IsBranchForbidden(branchId.Value))
                return StatusCode(403, new { message = "इतर शाखेची आकडेवारी पाहण्याची परवानगी नाही." });

            var caseQuery = _context.Sec101CaseMasters.AsNoTracking().AsQueryable();
            var noticeQuery = _context.Sec101NoticeHistories.AsNoTracking().AsQueryable();
            var expQuery = _context.Sec101LegalExpenses.AsNoTracking().AsQueryable();

            if (scopedBranch.HasValue && scopedBranch.Value > 0)
            {
                caseQuery = caseQuery.Where(c => c.BranchId == scopedBranch.Value);
                noticeQuery = noticeQuery.Where(n => n.BranchId == scopedBranch.Value);
                expQuery = expQuery.Where(x => x.BranchId == scopedBranch.Value);
            }

            var caseSummary = await caseQuery
                .GroupBy(_ => 1)
                .Select(g => new
                {
                    TotalCases = g.Count(),
                    FiledCases = g.Count(c => c.Status == "FILED"),
                    HearingCases = g.Count(c => c.Status == "HEARING"),
                    CertificatesIssued = g.Count(c => c.Status == "CERTIFICATE_ISSUED"),
                    ExecutionCases = g.Count(c => c.Status == "EXECUTION_RULE107"),
                    StayedCases = g.Count(c => c.Status == "STAYED"),
                    ClosedCases = g.Count(c => c.Status == "CLOSED_RECOVERED"),
                    Sec101Count = g.Count(c => c.CaseType == "SEC_101"),
                    Sec91Count = g.Count(c => c.CaseType == "SEC_91"),
                    TotalClaimAmount = g.Sum(c => (decimal?)c.TotalClaimAmount) ?? 0m,
                    TotalCourtFees = g.Sum(c => (decimal?)c.CourtFeeAmount) ?? 0m
                })
                .FirstOrDefaultAsync();

            var totalExpenses = await expQuery.SumAsync(x => (decimal?)x.Amount) ?? 0m;
            var totalNotices = await noticeQuery.CountAsync();

            DateTime activeBizDate = await LegalRecoveryTrackerHelper.ResolveActiveBusinessDateAsync(_context, scopedBranch ?? opBranch);
            DateTime upcomingHearingLimit = activeBizDate.AddDays(15);
            var upcomingHearingsCount = await _context.Sec101HearingLogs
                .AsNoTracking()
                .Where(h => (!scopedBranch.HasValue || (h.Case != null && h.Case.BranchId == scopedBranch.Value)) &&
                            h.NextHearingDate.HasValue &&
                            h.NextHearingDate.Value.Date >= activeBizDate &&
                            h.NextHearingDate.Value.Date <= upcomingHearingLimit)
                .CountAsync();

            return Ok(new
            {
                TotalCases = caseSummary?.TotalCases ?? 0,
                FiledCases = caseSummary?.FiledCases ?? 0,
                HearingCases = caseSummary?.HearingCases ?? 0,
                CertificatesIssued = caseSummary?.CertificatesIssued ?? 0,
                ExecutionCases = caseSummary?.ExecutionCases ?? 0,
                StayedCases = caseSummary?.StayedCases ?? 0,
                ClosedCases = caseSummary?.ClosedCases ?? 0,
                Sec101Count = caseSummary?.Sec101Count ?? 0,
                Sec91Count = caseSummary?.Sec91Count ?? 0,
                TotalClaimAmount = caseSummary?.TotalClaimAmount ?? 0m,
                TotalCourtFees = caseSummary?.TotalCourtFees ?? 0m,
                TotalExpenses = totalExpenses,
                TotalNoticesIssued = totalNotices,
                UpcomingHearingsNext15Days = upcomingHearingsCount
            });
        }

        // GET: api/LegalRecovery/eligible-loans?branchId=1&includeAllActive=false&asOnDate=2026-06-30
        [HttpGet("eligible-loans")]
        public async Task<IActionResult> GetEligibleOverdueLoans(
            [FromQuery] int? branchId = null,
            [FromQuery] bool includeAllActive = false,
            [FromQuery] DateTime? asOnDate = null)
        {
            var (scopedBranch, _, opBranch) = GetBranchScope(branchId);
            if (branchId.HasValue && branchId.Value > 0 && IsBranchForbidden(branchId.Value))
                return StatusCode(403, new { message = "इतर शाखेची कर्ज खाती पाहण्याची परवानगी नाही." });

            DateTime activeBizDate = await LegalRecoveryTrackerHelper.ResolveActiveBusinessDateAsync(_context, scopedBranch ?? opBranch);
            DateTime targetDate = asOnDate?.Date ?? activeBizDate;

            var query = _context.LoanAccounts
                .AsNoTracking()
                .AsSplitQuery()
                .Include(l => l.Customer)
                .Include(l => l.Member).ThenInclude(m => m!.Customer)
                .Include(l => l.CoCustomer)
                .Include(l => l.CoCustomer2)
                .Include(l => l.Guarantor1Customer)
                .Include(l => l.Guarantor2Customer)
                .Include(l => l.LoanRate)
                .Include(l => l.LoanApplication)
                .Include(l => l.LoanDisbursements)
                .Include(l => l.Branch)
                .Where(l => l.PrincipalBalance > 0 || l.InterestBalance > 0 || l.OverdueInterestBalance > 0)
                .AsQueryable();

            if (scopedBranch.HasValue && scopedBranch.Value > 0)
            {
                query = query.Where(l => l.BranchID == scopedBranch.Value);
            }

            if (!includeAllActive)
            {
                query = query.Where(l =>
                    l.OverdueInterestBalance > 0 ||
                    l.InterestBalance > 0 ||
                    (l.MaturityDate.HasValue && l.MaturityDate.Value < targetDate) ||
                    _context.LoanAccountNpaStatuses.Any(n => n.LoanAccountID == l.LoanAccountID && n.Category != "Standard") ||
                    _context.LoanInstallmentSchedules.Any(s => s.LoanAccountID == l.LoanAccountID && s.Status != "Paid" && s.DueDate < targetDate) ||
                    _context.Sec101NoticeHistories.Any(n => n.LoanAccountId == l.LoanAccountID) ||
                    _context.Sec101CaseMasters.Any(c => c.LoanAccountId == l.LoanAccountID));
            }

            var rawLoans = await query
                .OrderByDescending(l => l.OverdueInterestBalance)
                .ThenByDescending(l => l.PrincipalBalance)
                .ToListAsync();

            var loanIds = rawLoans.Select(l => l.LoanAccountID).ToList();
            var overdueExpenseByLoan = loanIds.Any()
                ? await _context.OverdueRecoveryLedgers
                    .AsNoTracking()
                    .Where(o => loanIds.Contains(o.LoanAccountID))
                    .GroupBy(o => o.LoanAccountID)
                    .Select(g => new { LoanAccountID = g.Key, Net = g.Sum(x => x.DebitAmount - x.CreditAmount) })
                    .ToDictionaryAsync(x => x.LoanAccountID, x => Math.Max(0m, x.Net))
                : new Dictionary<int, decimal>();

            var schedulesByLoan = loanIds.Any()
                ? (await _context.LoanInstallmentSchedules
                    .AsNoTracking()
                    .Where(s => loanIds.Contains(s.LoanAccountID))
                    .OrderBy(s => s.InstallmentNo)
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

            var npaByLoan = loanIds.Any()
                ? (await _context.LoanAccountNpaStatuses
                    .AsNoTracking()
                    .Where(n => loanIds.Contains(n.LoanAccountID))
                    .ToListAsync())
                    .GroupBy(n => n.LoanAccountID)
                    .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.AsOfDate).ThenByDescending(x => x.LoanAccountNpaStatusID).First())
                : new Dictionary<int, LoanAccountNpaStatus>();

            var activeCasesByLoan = loanIds.Any()
                ? await _context.Sec101CaseMasters
                    .AsNoTracking()
                    .Where(c => loanIds.Contains(c.LoanAccountId) && c.Status != "DISMISSED" && c.Status != "WITHDRAWN")
                    .GroupBy(c => c.LoanAccountId)
                    .Select(g => new { LoanAccountID = g.Key, Case = g.OrderByDescending(x => x.FilingDate).Select(x => new { x.CaseId, x.CaseNumber, x.CaseType, x.Status }).FirstOrDefault() })
                    .ToDictionaryAsync(x => x.LoanAccountID, x => x.Case)
                : null;

            var noticesByLoan = loanIds.Any()
                ? (await _context.Sec101NoticeHistories
                    .AsNoTracking()
                    .Where(n => loanIds.Contains(n.LoanAccountId))
                    .ToListAsync())
                    .GroupBy(n => n.LoanAccountId)
                    .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.NoticeDate).ThenByDescending(x => x.NoticeId).ToList())
                : new Dictionary<int, List<Sec101NoticeHistory>>();

            var loans = rawLoans.Select(l =>
            {
                var cust = l.Customer ?? l.Member?.Customer;
                var g1 = l.Guarantor1Customer ?? l.CoCustomer;
                var g2 = l.Guarantor2Customer ?? l.CoCustomer2;
                decimal unpaidLegal = overdueExpenseByLoan.TryGetValue(l.LoanAccountID, out var uExp) ? uExp : 0m;
                var activeCase = activeCasesByLoan != null && activeCasesByLoan.TryGetValue(l.LoanAccountID, out var ac) ? ac : null;
                var lNotices = noticesByLoan.TryGetValue(l.LoanAccountID, out var nList) ? nList : new List<Sec101NoticeHistory>();
                var lSched = schedulesByLoan.TryGetValue(l.LoanAccountID, out var sList) ? sList : new List<LoanInstallmentSchedule>();
                var lColls = collectionsByLoan.TryGetValue(l.LoanAccountID, out var cList) ? cList : new List<LoanCollection>();
                npaByLoan.TryGetValue(l.LoanAccountID, out var npaInfo);

                var meta = LegalRecoveryTrackerHelper.ResolveLoanMetadata(l, lSched);
                var dues = LegalRecoveryTrackerHelper.ComputeLoanDuesSnapshot(l, lSched, lColls, targetDate);
                string npaCategory = npaInfo?.Category ?? l.InitialNpaClassification ?? "Standard";
                bool isNpa = !string.Equals(npaCategory, "Standard", StringComparison.OrdinalIgnoreCase);
                decimal totalOutstandingWithAccrued = l.PrincipalBalance + dues.TotalRegularInterestDue + dues.TotalPenalInterestDue + unpaidLegal;

                return new
                {
                    l.LoanAccountID,
                    l.BranchID,
                    BranchName = l.Branch?.BranchName ?? "",
                    l.LoanAccountNo,
                    LegacyLoanNo = l.LegacyAccountNumber,
                    CustomerID = LegalRecoveryTrackerHelper.ResolveLoanCustomerId(l),
                    CIFNo = cust?.CIFNo ?? "",
                    LegacyCustomerNo = cust?.LegacyCustomerNo,
                    CustomerName = LegalRecoveryTrackerHelper.FormatCustomerName(cust),
                    MemberName = LegalRecoveryTrackerHelper.FormatCustomerName(cust),
                    MemberCode = cust?.CIFNo ?? "",
                    MobileNo = cust?.MobileNo ?? "",
                    Address = LegalRecoveryTrackerHelper.FormatCustomerAddress(cust),
                    Guarantor1Name = LegalRecoveryTrackerHelper.FormatCustomerName(g1),
                    Guarantor1Mobile = g1?.MobileNo ?? "",
                    Guarantor2Name = LegalRecoveryTrackerHelper.FormatCustomerName(g2),
                    Guarantor2Mobile = g2?.MobileNo ?? "",
                    CoMemberName = LegalRecoveryTrackerHelper.FormatCustomerName(g1),
                    CoMember2Name = LegalRecoveryTrackerHelper.FormatCustomerName(g2),
                    LoanScheme = l.LoanRate?.LoanType ?? "",
                    SecurityType = l.LoanRate?.SecurityType ?? "",
                    l.SecurityDetails,
                    l.SecurityValue,
                    SanctionedAmount = meta.SanctionedAmount,
                    DurationMonths = meta.DurationMonths,
                    l.InstallmentFrequency,
                    InstallmentAmount = meta.InstallmentAmount,
                    NoOfInstallments = dues.TotalInstallments,
                    InterestRate = dues.EffectiveRate,
                    PenalRate = dues.PenalRate,
                    InterestCalculationMethod = l.LoanRate?.InterestCalculationMethod ?? "Flat",
                    l.Status,
                    OpeningDate = l.OpeningDate.ToString("yyyy-MM-dd"),
                    LoanDisbursementDate = meta.DisbursementDate.ToString("yyyy-MM-dd"),
                    MaturityDate = meta.MaturityDate?.ToString("yyyy-MM-dd"),
                    LastInstallmentPaidDate = l.LastInstallmentPaidDate?.ToString("yyyy-MM-dd"),
                    LastInterestPostingDate = l.LastInterestPostingDate?.ToString("yyyy-MM-dd"),
                    l.PrincipalBalance,
                    dues.PurePrincipalBalance,
                    dues.CapitalizedInterestAmount,
                    dues.OverduePrincipal,
                    PostedInterestBalance = dues.PostedInterestBalance,
                    AccruedRegularInterest = dues.AccruedRegularInterest,
                    TotalRegularInterestDue = dues.TotalRegularInterestDue,
                    InterestBalance = dues.TotalRegularInterestDue,
                    InterestStartDate = dues.InterestStartDate.ToString("yyyy-MM-dd"),
                    dues.InterestDays,
                    PostedPenalInterestBalance = dues.PostedPenalInterestBalance,
                    EstimatedPenalInterest = dues.EstimatedAccruedPenalInterest,
                    OverdueInterestBalance = dues.PostedPenalInterestBalance,
                    TotalPenalInterestDue = dues.TotalPenalInterestDue,
                    dues.OverdueInstallmentsCount,
                    TotalInstallments = dues.TotalInstallments,
                    OverdueSinceDate = dues.OverdueSinceDate?.ToString("yyyy-MM-dd"),
                    dues.OverdueDays,
                    NpaCategory = npaCategory,
                    IsNpa = isNpa,
                    NetUnpaidLegalExpenses = unpaidLegal,
                    TotalOutstanding = totalOutstandingWithAccrued,
                    TotalOutstandingWithAccrued = totalOutstandingWithAccrued,
                    NoticesCount = lNotices.Count,
                    LastNoticeDate = lNotices.FirstOrDefault()?.NoticeDate.ToString("yyyy-MM-dd"),
                    LastNoticeType = lNotices.FirstOrDefault()?.NoticeType,
                    HasActiveCase = activeCase != null,
                    ActiveCaseId = activeCase?.CaseId,
                    ActiveCaseNumber = activeCase?.CaseNumber,
                    ActiveCaseType = activeCase?.CaseType,
                    ActiveCaseStatus = activeCase?.Status,
                    DueDate = meta.MaturityDate?.ToString("yyyy-MM-dd")
                };
            }).ToList();

            return Ok(loans);
        }

        // GET: api/LegalRecovery/loan-dues-preview/{loanAccountId}?asOnDate=2026-06-30
        [HttpGet("loan-dues-preview/{loanAccountId}")]
        public async Task<IActionResult> GetLoanDuesPreview(int loanAccountId, [FromQuery] DateTime? asOnDate = null)
        {
            var loan = await _context.LoanAccounts
                .AsNoTracking()
                .AsSplitQuery()
                .Include(l => l.LoanRate)
                .Include(l => l.LoanApplication)
                .Include(l => l.LoanDisbursements)
                .FirstOrDefaultAsync(l => l.LoanAccountID == loanAccountId);

            if (loan == null) return NotFound(new { message = "कर्ज खाते सापडले नाही." });
            if (IsBranchForbidden(loan.BranchID))
                return StatusCode(403, new { message = "इतर शाखेच्या कर्ज खात्याची माहिती पाहण्याची परवानगी नाही." });

            DateTime activeBizDate = await LegalRecoveryTrackerHelper.ResolveActiveBusinessDateAsync(_context, loan.BranchID);
            DateTime targetDate = asOnDate?.Date ?? activeBizDate;

            var schedules = await _context.LoanInstallmentSchedules
                .AsNoTracking()
                .Where(s => s.LoanAccountID == loanAccountId)
                .OrderBy(s => s.InstallmentNo)
                .ToListAsync();

            var collections = await _context.LoanCollections
                .AsNoTracking()
                .Where(c => c.LoanAccountID == loanAccountId)
                .ToListAsync();

            var overdueRows = await _context.OverdueRecoveryLedgers
                .AsNoTracking()
                .Where(o => o.LoanAccountID == loanAccountId && o.TransactionDate <= targetDate)
                .ToListAsync();

            decimal unpaidLegal = Math.Max(0m, overdueRows.Sum(o => o.DebitAmount - o.CreditAmount));
            var meta = LegalRecoveryTrackerHelper.ResolveLoanMetadata(loan, schedules);
            var dues = LegalRecoveryTrackerHelper.ComputeLoanDuesSnapshot(loan, schedules, collections, targetDate);

            return Ok(new
            {
                LoanAccountID = loanAccountId,
                AsOnDate = targetDate.ToString("yyyy-MM-dd"),
                SanctionedAmount = meta.SanctionedAmount,
                DurationMonths = meta.DurationMonths,
                InstallmentAmount = meta.InstallmentAmount,
                LoanDisbursementDate = meta.DisbursementDate.ToString("yyyy-MM-dd"),
                MaturityDate = meta.MaturityDate?.ToString("yyyy-MM-dd"),
                dues.PrincipalBalance,
                dues.OverduePrincipal,
                dues.PostedInterestBalance,
                dues.AccruedRegularInterest,
                dues.TotalRegularInterestDue,
                InterestStartDate = dues.InterestStartDate.ToString("yyyy-MM-dd"),
                dues.InterestDays,
                InterestRate = dues.EffectiveRate,
                dues.PenalRate,
                dues.IsFlatMethod,
                dues.PostedPenalInterestBalance,
                EstimatedPenalInterest = dues.EstimatedAccruedPenalInterest,
                dues.TotalPenalInterestDue,
                dues.OverdueInstallmentsCount,
                dues.TotalInstallments,
                OverdueSinceDate = dues.OverdueSinceDate?.ToString("yyyy-MM-dd"),
                dues.OverdueDays,
                NetUnpaidLegalExpenses = unpaidLegal,
                TotalOutstandingWithAccrued = loan.PrincipalBalance + dues.TotalRegularInterestDue + dues.TotalPenalInterestDue + unpaidLegal
            });
        }

        // GET: api/LegalRecovery/customer-tracker?customerId=123&branchId=1&loanAccountId=456
        [HttpGet("customer-tracker")]
        public async Task<IActionResult> GetCustomerLegalTracker(
            [FromQuery] int? customerId = null,
            [FromQuery] int? branchId = null,
            [FromQuery] int? loanAccountId = null)
        {
            var (scopedBranch, _, opBranch) = GetBranchScope(branchId);
            if (branchId.HasValue && branchId.Value > 0 && IsBranchForbidden(branchId.Value))
                return StatusCode(403, new { message = "इतर शाखेच्या ग्राहकाचा कायदेशीर तपशील पाहण्याची परवानगी नाही." });

            if ((!customerId.HasValue || customerId.Value <= 0) && (!loanAccountId.HasValue || loanAccountId.Value <= 0))
            {
                return BadRequest(new { message = "कृपया ग्राहक (CustomerID) किंवा कर्ज खाते क्रमांक निवडा." });
            }

            if (loanAccountId.HasValue && loanAccountId.Value > 0)
            {
                var targetLoan = await _context.LoanAccounts.AsNoTracking().FirstOrDefaultAsync(l => l.LoanAccountID == loanAccountId.Value);
                if (targetLoan == null) return NotFound(new { message = "कर्ज खाते सापडले नाही." });
                if (IsBranchForbidden(targetLoan.BranchID))
                    return StatusCode(403, new { message = "इतर शाखेच्या कर्ज खात्याचा तपशील पाहण्याची परवानगी नाही." });
            }

            DateTime activeBizDate = await LegalRecoveryTrackerHelper.ResolveActiveBusinessDateAsync(_context, scopedBranch ?? opBranch);
            var tracker = await LegalRecoveryTrackerHelper.BuildCustomerLegalTrackerAsync(_context, customerId, scopedBranch, loanAccountId, activeBizDate);
            if (tracker == null) return NotFound(new { message = "ग्राहकाचा कायदेशीर डेटा सापडला नाही." });

            return Ok(tracker);
        }

        // GET: api/LegalRecovery/form-m/{loanAccountId}
        [HttpGet("form-m/{loanAccountId}")]
        public async Task<IActionResult> GetFormMData(int loanAccountId, [FromQuery] DateTime? asOnDate = null)
        {
            var loan = await _context.LoanAccounts
                .AsNoTracking()
                .AsSplitQuery()
                .Include(l => l.Customer)
                .Include(l => l.Member).ThenInclude(m => m!.Customer)
                .Include(l => l.CoCustomer)
                .Include(l => l.CoCustomer2)
                .Include(l => l.Guarantor1Customer)
                .Include(l => l.Guarantor2Customer)
                .Include(l => l.LoanRate)
                .Include(l => l.LoanApplication)
                .Include(l => l.LoanDisbursements)
                .Include(l => l.Branch)
                .FirstOrDefaultAsync(l => l.LoanAccountID == loanAccountId);

            if (loan == null) return NotFound(new { message = "कर्ज खाते सापडले नाही." });
            if (IsBranchForbidden(loan.BranchID))
                return StatusCode(403, new { message = "इतर शाखेच्या कर्ज खात्याचा फॉर्म-एम तपशील पाहण्याची परवानगी नाही." });

            DateTime activeBizDate = await LegalRecoveryTrackerHelper.ResolveActiveBusinessDateAsync(_context, loan.BranchID);
            var targetDate = asOnDate?.Date ?? activeBizDate;

            var sanstha = await _context.SansthaDetails.AsNoTracking().FirstOrDefaultAsync();

            // Recoverable net unpaid approved legal expenses from OverdueRecoveryLedgers
            var overdueRows = await _context.OverdueRecoveryLedgers
                .AsNoTracking()
                .Where(o => o.LoanAccountID == loanAccountId && o.TransactionDate <= targetDate)
                .ToListAsync();
            decimal grossDebitedExpenses = overdueRows.Sum(o => o.DebitAmount);
            decimal recoveredExpenses = overdueRows.Sum(o => o.CreditAmount);
            decimal netUnpaidLegalExpenses = Math.Max(0m, grossDebitedExpenses - recoveredExpenses);

            var notices = await _context.Sec101NoticeHistories
                .AsNoTracking()
                .Where(n => n.LoanAccountId == loanAccountId)
                .OrderByDescending(n => n.NoticeDate)
                .ToListAsync();

            var finalNotice = notices
                .Where(n => n.NoticeType == "FINAL_NOTICE" || n.NoticeType == "SRO_DEMAND")
                .OrderByDescending(n => n.NoticeDate)
                .FirstOrDefault() ?? notices.FirstOrDefault();

            int daysSinceFinalNotice = finalNotice != null ? Math.Max(0, (targetDate - finalNotice.NoticeDate.Date).Days) : 0;

            var borrowerCust = loan.Customer ?? loan.Member?.Customer;
            var g1Cust = loan.Guarantor1Customer ?? loan.CoCustomer;
            var g2Cust = loan.Guarantor2Customer ?? loan.CoCustomer2;

            var schedules = await _context.LoanInstallmentSchedules
                .AsNoTracking()
                .Where(s => s.LoanAccountID == loanAccountId)
                .OrderBy(s => s.InstallmentNo)
                .ToListAsync();
            var collections = await _context.LoanCollections
                .AsNoTracking()
                .Where(c => c.LoanAccountID == loanAccountId)
                .ToListAsync();
            var meta = LegalRecoveryTrackerHelper.ResolveLoanMetadata(loan, schedules);
            var dues = LegalRecoveryTrackerHelper.ComputeLoanDuesSnapshot(loan, schedules, collections, targetDate);

            var formM = new
            {
                Sanstha = sanstha,
                LoanAccountID = loan.LoanAccountID,
                LoanAccountNo = loan.LoanAccountNo,
                LegacyLoanNo = loan.LegacyAccountNumber,
                BranchID = loan.BranchID,
                BranchName = loan.Branch?.BranchName ?? "मुख्य शाखा",
                AsOnDate = targetDate.ToString("yyyy-MM-dd"),
                Borrower = new
                {
                    CustomerID = LegalRecoveryTrackerHelper.ResolveLoanCustomerId(loan),
                    FullName = LegalRecoveryTrackerHelper.FormatCustomerName(borrowerCust),
                    CIFNo = borrowerCust?.CIFNo ?? "",
                    LegacyCustomerNo = borrowerCust?.LegacyCustomerNo,
                    MemberCode = borrowerCust?.CIFNo ?? "",
                    Address = LegalRecoveryTrackerHelper.FormatCustomerAddress(borrowerCust),
                    MobileNo = borrowerCust?.MobileNo,
                    AadhaarNo = borrowerCust?.AadhaarNo,
                    PanNo = borrowerCust?.PANNo
                },
                Guarantor1 = g1Cust != null ? new
                {
                    CustomerID = g1Cust.CustomerID,
                    CIFNo = g1Cust.CIFNo,
                    LegacyCustomerNo = g1Cust.LegacyCustomerNo,
                    FullName = LegalRecoveryTrackerHelper.FormatCustomerName(g1Cust),
                    MemberCode = g1Cust.CIFNo,
                    Address = LegalRecoveryTrackerHelper.FormatCustomerAddress(g1Cust),
                    MobileNo = g1Cust.MobileNo
                } : null,
                Guarantor2 = g2Cust != null ? new
                {
                    CustomerID = g2Cust.CustomerID,
                    CIFNo = g2Cust.CIFNo,
                    LegacyCustomerNo = g2Cust.LegacyCustomerNo,
                    FullName = LegalRecoveryTrackerHelper.FormatCustomerName(g2Cust),
                    MemberCode = g2Cust.CIFNo,
                    Address = LegalRecoveryTrackerHelper.FormatCustomerAddress(g2Cust),
                    MobileNo = g2Cust.MobileNo
                } : null,
                LoanDetails = new
                {
                    SanctionDate = meta.DisbursementDate.ToString("yyyy-MM-dd"),
                    MaturityDate = meta.MaturityDate?.ToString("yyyy-MM-dd"),
                    SanctionAmount = meta.SanctionedAmount,
                    InstallmentAmount = meta.InstallmentAmount,
                    DurationMonths = meta.DurationMonths,
                    InterestRate = dues.EffectiveRate,
                    PenalRate = dues.PenalRate,
                    SchemeName = loan.LoanRate?.LoanType ?? "कर्ज योजना",
                    PrincipalBalance = loan.PrincipalBalance,
                    OverduePrincipal = dues.OverduePrincipal,
                    PostedInterestBalance = dues.PostedInterestBalance,
                    AccruedRegularInterest = dues.AccruedRegularInterest,
                    InterestBalance = dues.TotalRegularInterestDue,
                    TotalRegularInterestDue = dues.TotalRegularInterestDue,
                    InterestStartDate = dues.InterestStartDate.ToString("yyyy-MM-dd"),
                    dues.InterestDays,
                    PostedPenalInterestBalance = dues.PostedPenalInterestBalance,
                    EstimatedPenalInterest = dues.EstimatedAccruedPenalInterest,
                    PenalInterestBalance = dues.TotalPenalInterestDue,
                    dues.OverdueInstallmentsCount,
                    dues.TotalInstallments,
                    dues.OverdueDays,
                    GrossLegalExpenses = grossDebitedExpenses,
                    RecoveredLegalExpenses = recoveredExpenses,
                    LegalExpenses = netUnpaidLegalExpenses,
                    TotalDues = loan.PrincipalBalance + dues.TotalRegularInterestDue + dues.TotalPenalInterestDue + netUnpaidLegalExpenses
                },
                NoticesCount = notices.Count,
                HasFinalNotice15DaysElapsed = finalNotice != null && daysSinceFinalNotice >= 15,
                DaysSinceLastNotice = daysSinceFinalNotice,
                Notices = notices.Select(n => new
                {
                    n.NoticeId,
                    n.CaseType,
                    n.RecipientType,
                    n.NoticeType,
                    n.NoticeNumber,
                    NoticeDate = n.NoticeDate.ToString("yyyy-MM-dd"),
                    n.TotalDemandAmount,
                    n.PostalTrackingNo,
                    n.PostalStatus
                })
            };

            return Ok(formM);
        }

        // POST: api/LegalRecovery/notice/generate
        [HttpPost("notice/generate")]
        public async Task<IActionResult> GenerateNotice([FromBody] GenerateNoticeDto dto)
        {
            if (dto == null || dto.LoanAccountId <= 0)
                return BadRequest(new { message = "कृपया वैध कर्ज खाते निवडा." });

            if (dto.PrincipalDue < 0 || dto.InterestDue < 0 || dto.PenalInterestDue < 0 || dto.NoticeFee < 0)
                return BadRequest(new { message = "रकमा शून्य किंवा त्यापेक्षा जास्त असणे आवश्यक आहे." });

            var loan = await _context.LoanAccounts
                .Include(l => l.Customer)
                .Include(l => l.Member).ThenInclude(m => m!.Customer)
                .Include(l => l.Guarantor1Customer)
                .Include(l => l.Guarantor2Customer)
                .Include(l => l.CoCustomer)
                .Include(l => l.CoCustomer2)
                .FirstOrDefaultAsync(l => l.LoanAccountID == dto.LoanAccountId);

            if (loan == null) return NotFound(new { message = "कर्ज खाते सापडले नाही." });

            int effectiveBranchId = User.IsHeadOfficeAdmin()
                ? (dto.BranchId > 0 ? dto.BranchId : loan.BranchID)
                : User.GetOperatingBranchId();

            if (IsBranchForbidden(loan.BranchID) || loan.BranchID != effectiveBranchId)
                return StatusCode(403, new { message = "इतर शाखेच्या कर्ज खात्यावर नोटीस जारी करण्याची परवानगी नाही." });

            DateTime activeBizDate = await LegalRecoveryTrackerHelper.ResolveActiveBusinessDateAsync(_context, loan.BranchID);
            DateTime noticeDate = dto.NoticeDate?.Date ?? activeBizDate;
            DateTime dueDate = dto.DueDate?.Date ?? noticeDate.AddDays(15);
            if (dueDate < noticeDate)
                return BadRequest(new { message = "मुदत दिनांक (Due Date) नोटीस तारखेपेक्षा आधीची असू शकत नाही." });

            string? dateError = await LegalRecoveryTrackerHelper.ValidateOperationalDateAsync(_context, loan.BranchID, noticeDate);
            if (!string.IsNullOrEmpty(dateError)) return BadRequest(new { message = dateError });

            if (dto.NoticeFee > 0 && BankLedgerHelper.IsBankPaymentMode(dto.PaymentMode))
            {
                var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(_context, dto.BankLedgerId);
                if (!bankCheck.IsValid) return BadRequest(new { message = bankCheck.ErrorMessage });
            }

            int? customerId = LegalRecoveryTrackerHelper.ResolveLoanCustomerId(loan);
            if (!customerId.HasValue || customerId.Value <= 0)
                return BadRequest(new { message = "कर्ज खात्याशी वैध ग्राहक (CustomerID) जोडलेला नाही." });

            var borrowerCust = loan.Customer ?? loan.Member?.Customer;
            int userId = User.GetUserId();
            string caseType = LegalRecoveryTrackerHelper.NormalizeCaseType(dto.CaseType);
            string prefix = dto.NoticeType switch
            {
                "NOTICE_1" => "N1",
                "NOTICE_2" => "N2",
                "FINAL_NOTICE" => caseType == "SEC_91" ? "FN91" : "FN101",
                "SRO_DEMAND" => "SRO",
                _ => "NOT"
            };

            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                string noticeNo = await LegalRecoveryTrackerHelper.BuildNextNoticeNoAsync(_context, loan.BranchID, prefix, noticeDate);
                decimal totalDemand = dto.PrincipalDue + dto.InterestDue + dto.PenalInterestDue + dto.NoticeFee;
                int? legacyMemId = loan.MemberID.HasValue && loan.MemberID.Value > 0 ? loan.MemberID.Value : null;

                var primaryNotice = new Sec101NoticeHistory
                {
                    BranchId = loan.BranchID,
                    LoanAccountId = dto.LoanAccountId,
                    CustomerId = customerId.Value,
                    MemberId = legacyMemId,
                    CaseType = caseType,
                    RecipientType = "BORROWER",
                    RecipientCustomerId = customerId.Value,
                    RecipientName = LegalRecoveryTrackerHelper.FormatCustomerName(borrowerCust),
                    RecipientAddress = LegalRecoveryTrackerHelper.FormatCustomerAddress(borrowerCust),
                    NoticeType = dto.NoticeType,
                    NoticeNumber = noticeNo,
                    NoticeDate = noticeDate,
                    DueDate = dueDate,
                    PrincipalDue = dto.PrincipalDue,
                    InterestDue = dto.InterestDue,
                    PenalInterestDue = dto.PenalInterestDue,
                    NoticeFee = dto.NoticeFee,
                    TotalDemandAmount = totalDemand,
                    PostalTrackingNo = dto.PostalTrackingNo,
                    PostalStatus = !string.IsNullOrWhiteSpace(dto.PostalTrackingNo) ? "DISPATCHED" : "PENDING",
                    Remarks = dto.Remarks,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = userId
                };

                _context.Sec101NoticeHistories.Add(primaryNotice);
                await _context.SaveChangesAsync();

                // Optional Guarantor Copy Notice Tracking
                if (dto.GuarantorNoticeRecipients != null && dto.GuarantorNoticeRecipients.Any())
                {
                    var g1 = loan.Guarantor1Customer ?? loan.CoCustomer;
                    var g2 = loan.Guarantor2Customer ?? loan.CoCustomer2;
                    foreach (string recType in dto.GuarantorNoticeRecipients.Select(r => r.Trim().ToUpperInvariant()).Distinct())
                    {
                        Customer? gCust = recType == "GUARANTOR_1" ? g1 : (recType == "GUARANTOR_2" ? g2 : null);
                        if (gCust == null) continue;
                        string suffix = recType == "GUARANTOR_1" ? "-G1" : "-G2";
                        _context.Sec101NoticeHistories.Add(new Sec101NoticeHistory
                        {
                            BranchId = loan.BranchID,
                            LoanAccountId = dto.LoanAccountId,
                            CustomerId = customerId.Value,
                            MemberId = legacyMemId,
                            CaseType = caseType,
                            RecipientType = recType,
                            RecipientCustomerId = gCust.CustomerID,
                            RecipientName = LegalRecoveryTrackerHelper.FormatCustomerName(gCust),
                            RecipientAddress = LegalRecoveryTrackerHelper.FormatCustomerAddress(gCust),
                            NoticeType = dto.NoticeType,
                            NoticeNumber = $"{noticeNo}{suffix}",
                            NoticeDate = noticeDate,
                            DueDate = dueDate,
                            PrincipalDue = dto.PrincipalDue,
                            InterestDue = dto.InterestDue,
                            PenalInterestDue = dto.PenalInterestDue,
                            NoticeFee = 0m,
                            TotalDemandAmount = dto.PrincipalDue + dto.InterestDue + dto.PenalInterestDue,
                            PostalStatus = !string.IsNullOrWhiteSpace(dto.PostalTrackingNo) ? "DISPATCHED" : "PENDING",
                            Remarks = $"जामीनदार प्रत ({recType}) - मूळ नोटीस {noticeNo}",
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = userId
                        });
                    }
                    await _context.SaveChangesAsync();
                }

                Voucher? voucher = null;
                if (dto.NoticeFee > 0)
                {
                    var feeDto = new AddLegalExpenseDto
                    {
                        BranchId = loan.BranchID,
                        CaseId = null,
                        LoanAccountId = dto.LoanAccountId,
                        ExpenseType = "NOTICE_FEE",
                        Amount = dto.NoticeFee,
                        ExpenseDate = noticeDate,
                        PaidTo = "टपाल व कायदेशीर नोटीस खर्च",
                        PaymentMode = dto.PaymentMode,
                        BankLedgerId = dto.BankLedgerId,
                        ReferenceNo = dto.ReferenceNo ?? noticeNo,
                        IsDebitedToBorrower = true,
                        Remarks = $"नोटीस टपाल व प्रशासकीय फी ({noticeNo})"
                    };
                    voucher = await Step4AccountingHelper.ExecuteLegalExpenseAtomicAsync(
                        _context, feeDto, loan.BranchID, dto.LoanAccountId, userId, primaryNotice.NoticeId);
                }

                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = "नोटीस यशस्वीरीत्या तयार झाली. (Notice generated successfully)",
                    NoticeId = primaryNotice.NoticeId,
                    NoticeNumber = primaryNotice.NoticeNumber,
                    TotalDemandAmount = primaryNotice.TotalDemandAmount,
                    VoucherNo = voucher?.VoucherNo
                });
            }
            catch (InvalidOperationException valEx)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { message = valEx.Message });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "नोटीस तयार करताना त्रुटी: " + ex.Message });
            }
        }

        // GET: api/LegalRecovery/notices?branchId=1&loanAccountId=...&customerId=...
        [HttpGet("notices")]
        public async Task<IActionResult> GetNotices(
            [FromQuery] int? branchId = null,
            [FromQuery] int? loanAccountId = null,
            [FromQuery] int? customerId = null)
        {
            var (scopedBranch, _, _) = GetBranchScope(branchId);
            if (branchId.HasValue && branchId.Value > 0 && IsBranchForbidden(branchId.Value))
                return StatusCode(403, new { message = "इतर शाखेच्या नोटिसा पाहण्याची परवानगी नाही." });

            var query = _context.Sec101NoticeHistories
                .AsNoTracking()
                .Include(n => n.LoanAccount).ThenInclude(l => l!.Customer)
                .Include(n => n.Customer)
                .Include(n => n.Member).ThenInclude(m => m!.Customer)
                .Include(n => n.Branch)
                .AsQueryable();

            if (scopedBranch.HasValue && scopedBranch.Value > 0) query = query.Where(n => n.BranchId == scopedBranch.Value);
            if (loanAccountId.HasValue && loanAccountId.Value > 0) query = query.Where(n => n.LoanAccountId == loanAccountId.Value);
            if (customerId.HasValue && customerId.Value > 0) query = query.Where(n => n.CustomerId == customerId.Value || (n.LoanAccount != null && n.LoanAccount.CustomerID == customerId.Value));

            var rows = await query.OrderByDescending(n => n.NoticeDate).ThenByDescending(n => n.NoticeId).ToListAsync();
            var list = rows.Select(n =>
            {
                var cust = n.Customer ?? n.LoanAccount?.Customer ?? n.Member?.Customer;
                return new
                {
                    n.NoticeId,
                    n.BranchId,
                    BranchName = n.Branch?.BranchName ?? "",
                    n.LoanAccountId,
                    LoanAccountNo = n.LoanAccount?.LoanAccountNo ?? "",
                    LegacyLoanNo = n.LoanAccount?.LegacyAccountNumber,
                    CustomerID = n.CustomerId ?? n.LoanAccount?.CustomerID,
                    CIFNo = cust?.CIFNo ?? "",
                    LegacyCustomerNo = cust?.LegacyCustomerNo,
                    CustomerName = !string.IsNullOrWhiteSpace(n.RecipientName) ? n.RecipientName! : LegalRecoveryTrackerHelper.FormatCustomerName(cust),
                    MemberName = LegalRecoveryTrackerHelper.FormatCustomerName(cust),
                    MemberCode = cust?.CIFNo ?? "",
                    Address = !string.IsNullOrWhiteSpace(n.RecipientAddress) ? n.RecipientAddress! : LegalRecoveryTrackerHelper.FormatCustomerAddress(cust),
                    MobileNo = cust?.MobileNo ?? "",
                    n.CaseType,
                    n.RecipientType,
                    n.NoticeType,
                    n.NoticeNumber,
                    NoticeDate = n.NoticeDate.ToString("yyyy-MM-dd"),
                    DueDate = n.DueDate.ToString("yyyy-MM-dd"),
                    n.PrincipalDue,
                    n.InterestDue,
                    n.PenalInterestDue,
                    n.NoticeFee,
                    n.TotalDemandAmount,
                    n.PostalTrackingNo,
                    n.PostalStatus,
                    DeliveredDate = n.DeliveredDate?.ToString("yyyy-MM-dd"),
                    n.Remarks
                };
            }).ToList();

            return Ok(list);
        }

        // PUT: api/LegalRecovery/notice/postal-status/{noticeId}
        [HttpPut("notice/postal-status/{noticeId}")]
        public async Task<IActionResult> UpdatePostalStatus(int noticeId, [FromBody] UpdateNoticePostalDto dto)
        {
            if (dto == null) return BadRequest(new { message = "अवैध विनंती." });

            var notice = await _context.Sec101NoticeHistories.FindAsync(noticeId);
            if (notice == null) return NotFound(new { message = "नोटीस सापडली नाही." });
            if (IsBranchForbidden(notice.BranchId))
                return StatusCode(403, new { message = "इतर शाखेची टपाल स्थिती बदलण्याची परवानगी नाही." });

            if (!string.IsNullOrWhiteSpace(dto.PostalTrackingNo)) notice.PostalTrackingNo = dto.PostalTrackingNo.Trim();
            if (!string.IsNullOrWhiteSpace(dto.PostalStatus)) notice.PostalStatus = dto.PostalStatus.Trim().ToUpperInvariant();
            if (dto.DeliveredDate.HasValue)
            {
                if (dto.DeliveredDate.Value.Date < notice.NoticeDate.Date)
                    return BadRequest(new { message = "टपाल पोहोच दिनांक नोटीस तारखेपेक्षा आधीचा असू शकत नाही." });
                notice.DeliveredDate = dto.DeliveredDate.Value.Date;
            }
            if (dto.Remarks != null) notice.Remarks = dto.Remarks;

            await _context.SaveChangesAsync();
            return Ok(new { Message = "टपाल स्थिती यशस्वीरीत्या अद्ययावत केली. (Postal status updated)" });
        }

        // POST: api/LegalRecovery/case/file
        [HttpPost("case/file")]
        public async Task<IActionResult> FileCase([FromBody] FileCaseDto dto)
        {
            if (dto == null || dto.LoanAccountId <= 0)
                return BadRequest(new { message = "कृपया वैध कर्ज खाते निवडा." });

            if (string.IsNullOrWhiteSpace(dto.CaseNumber))
                return BadRequest(new { message = "कृपया दावा क्रमांक (Case Number) प्रविष्ट करा." });

            if (dto.PrincipalClaim < 0 || dto.InterestClaim < 0 || dto.PenalInterestClaim < 0 || dto.OtherChargesClaim < 0 || dto.CourtFeeAmount < 0)
                return BadRequest(new { message = "दावा रकमा व कोर्ट फी नकारात्मक असू शकत नाही." });

            var loan = await _context.LoanAccounts
                .Include(l => l.Member)
                .FirstOrDefaultAsync(l => l.LoanAccountID == dto.LoanAccountId);
            if (loan == null) return NotFound(new { message = "कर्ज खाते सापडले नाही." });

            int effectiveBranchId = User.IsHeadOfficeAdmin()
                ? (dto.BranchId > 0 ? dto.BranchId : loan.BranchID)
                : User.GetOperatingBranchId();

            if (IsBranchForbidden(loan.BranchID) || loan.BranchID != effectiveBranchId)
                return StatusCode(403, new { message = "इतर शाखेच्या कर्ज खात्यावर दावा दाखल करण्याची परवानगी नाही." });

            DateTime activeBizDate = await LegalRecoveryTrackerHelper.ResolveActiveBusinessDateAsync(_context, loan.BranchID);
            DateTime filingDate = dto.FilingDate?.Date ?? activeBizDate;

            string? dateError = await LegalRecoveryTrackerHelper.ValidateOperationalDateAsync(_context, loan.BranchID, filingDate);
            if (!string.IsNullOrEmpty(dateError)) return BadRequest(new { message = dateError });

            string caseType = LegalRecoveryTrackerHelper.NormalizeCaseType(dto.CaseType);
            string cleanCaseNumber = dto.CaseNumber.Trim();

            bool duplicateCaseNumber = await _context.Sec101CaseMasters
                .AnyAsync(c => c.BranchId == loan.BranchID && c.CaseNumber == cleanCaseNumber);
            if (duplicateCaseNumber)
                return BadRequest(new { message = $"दावा क्रमांक '{cleanCaseNumber}' या शाखेत आधीच नोंदवलेला आहे." });

            bool hasActiveOpenCase = await _context.Sec101CaseMasters
                .AnyAsync(c => c.LoanAccountId == dto.LoanAccountId && c.Status != "CLOSED_RECOVERED" && c.Status != "DISMISSED" && c.Status != "WITHDRAWN");
            if (hasActiveOpenCase)
                return BadRequest(new { message = "या कर्ज खात्यावर आधीच एक सक्रिय कलम १०१/९१ प्रकरण सुरू आहे. डुप्लिकेट दावा दाखल करता येत नाही." });

            if (caseType == "SEC_101" && !dto.BypassNoticeWaitCheck)
            {
                var finalNotice = await _context.Sec101NoticeHistories
                    .Where(n => n.LoanAccountId == dto.LoanAccountId && (n.NoticeType == "FINAL_NOTICE" || n.NoticeType == "SRO_DEMAND"))
                    .OrderByDescending(n => n.NoticeDate)
                    .FirstOrDefaultAsync();
                if (finalNotice == null || (filingDate - finalNotice.NoticeDate.Date).Days < 15)
                {
                    int days = finalNotice != null ? (filingDate - finalNotice.NoticeDate.Date).Days : 0;
                    return BadRequest(new
                    {
                        message = finalNotice == null
                            ? "कलम १०१ दावा दाखल करण्यापूर्वी अंतिम कायदेशीर नोटीस जारी करून १५ दिवस पूर्ण असणे आवश्यक आहे (अथवा आवश्यक असल्यास अपवाद मंजुरीसह दाखल करा)."
                            : $"अंतिम नोटीस दिनांक {finalNotice.NoticeDate:dd/MM/yyyy} पासून अद्याप {days}/१५ दिवस झाले आहेत. १५ दिवसांची मुदत पूर्ण झाल्यावरच दावा दाखल करा.",
                        requiresNoticeBypass = true
                    });
                }
            }

            if (dto.CourtFeeAmount > 0 && BankLedgerHelper.IsBankPaymentMode(dto.PaymentMode))
            {
                var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(_context, dto.BankLedgerId);
                if (!bankCheck.IsValid) return BadRequest(new { message = bankCheck.ErrorMessage });
            }

            int? customerId = LegalRecoveryTrackerHelper.ResolveLoanCustomerId(loan);
            if (!customerId.HasValue || customerId.Value <= 0)
                return BadRequest(new { message = "कर्ज खात्याशी वैध ग्राहक (CustomerID) जोडलेला नाही." });

            int userId = User.GetUserId();
            decimal totalClaim = dto.PrincipalClaim + dto.InterestClaim + dto.PenalInterestClaim + dto.OtherChargesClaim;
            string defaultCourt = caseType == "SEC_91"
                ? "मा. सहकारी न्यायालय (Co-operative Court)"
                : "मा. सहाय्यक निबंधक, सहकारी संस्था";

            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var legalCase = new Sec101CaseMaster
                {
                    BranchId = loan.BranchID,
                    LoanAccountId = dto.LoanAccountId,
                    CustomerId = customerId.Value,
                    MemberId = loan.MemberID.HasValue && loan.MemberID.Value > 0 ? loan.MemberID.Value : null,
                    CaseType = caseType,
                    CaseNumber = cleanCaseNumber,
                    CourtName = string.IsNullOrWhiteSpace(dto.CourtName) ? defaultCourt : dto.CourtName.Trim(),
                    AdvocateName = dto.AdvocateName?.Trim(),
                    FilingDate = filingDate,
                    PrincipalClaim = dto.PrincipalClaim,
                    InterestClaim = dto.InterestClaim,
                    PenalInterestClaim = dto.PenalInterestClaim,
                    OtherChargesClaim = dto.OtherChargesClaim,
                    TotalClaimAmount = totalClaim,
                    CourtFeeAmount = dto.CourtFeeAmount,
                    CourtFeeChallanNo = dto.CourtFeeChallanNo?.Trim(),
                    Status = "FILED",
                    Remarks = dto.Remarks?.Trim(),
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = userId
                };

                _context.Sec101CaseMasters.Add(legalCase);
                await _context.SaveChangesAsync();

                Voucher? voucher = null;
                if (dto.CourtFeeAmount > 0)
                {
                    var feeDto = new AddLegalExpenseDto
                    {
                        BranchId = loan.BranchID,
                        CaseId = legalCase.CaseId,
                        LoanAccountId = dto.LoanAccountId,
                        ExpenseType = "COURT_FEE",
                        Amount = dto.CourtFeeAmount,
                        ExpenseDate = filingDate,
                        PaidTo = string.IsNullOrWhiteSpace(dto.AdvocateName) ? "न्यायालय / निबंधक कोर्ट फी" : dto.AdvocateName.Trim(),
                        PaymentMode = dto.PaymentMode,
                        BankLedgerId = dto.BankLedgerId,
                        ReferenceNo = dto.ReferenceNo ?? dto.CourtFeeChallanNo,
                        IsDebitedToBorrower = true,
                        Remarks = $"{(caseType == "SEC_91" ? "कलम ९१" : "कलम १०१")} कोर्ट फी - चलन क्र. {dto.CourtFeeChallanNo}"
                    };
                    voucher = await Step4AccountingHelper.ExecuteLegalExpenseAtomicAsync(
                        _context, feeDto, loan.BranchID, dto.LoanAccountId, userId);
                }

                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = $"{(caseType == "SEC_91" ? "कलम ९१" : "कलम १०१")} दावा अर्ज यशस्वीरीत्या दाखल झाला.",
                    CaseId = legalCase.CaseId,
                    CaseNumber = legalCase.CaseNumber,
                    CaseType = legalCase.CaseType,
                    VoucherNo = voucher?.VoucherNo
                });
            }
            catch (InvalidOperationException valEx)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { message = valEx.Message });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "दावा दाखल करताना सिस्टीम त्रुटी: " + ex.Message });
            }
        }

        // GET: api/LegalRecovery/cases?branchId=1&status=...&caseType=...&customerId=...
        [HttpGet("cases")]
        public async Task<IActionResult> GetCases(
            [FromQuery] int? branchId = null,
            [FromQuery] string? status = null,
            [FromQuery] string? caseType = null,
            [FromQuery] int? customerId = null)
        {
            var (scopedBranch, _, _) = GetBranchScope(branchId);
            if (branchId.HasValue && branchId.Value > 0 && IsBranchForbidden(branchId.Value))
                return StatusCode(403, new { message = "इतर शाखेचे खटले पाहण्याची परवानगी नाही." });

            var query = _context.Sec101CaseMasters
                .AsNoTracking()
                .AsSplitQuery()
                .Include(c => c.LoanAccount).ThenInclude(l => l!.Customer)
                .Include(c => c.Customer)
                .Include(c => c.Member).ThenInclude(m => m!.Customer)
                .Include(c => c.Branch)
                .Include(c => c.HearingLogs)
                .Include(c => c.Executions)
                .Include(c => c.LegalExpenses).ThenInclude(e => e.Voucher)
                .AsQueryable();

            if (scopedBranch.HasValue && scopedBranch.Value > 0) query = query.Where(c => c.BranchId == scopedBranch.Value);
            if (!string.IsNullOrEmpty(status) && status != "ALL") query = query.Where(c => c.Status == status);
            if (!string.IsNullOrEmpty(caseType) && caseType != "ALL") query = query.Where(c => c.CaseType == caseType);
            if (customerId.HasValue && customerId.Value > 0)
                query = query.Where(c => c.CustomerId == customerId.Value || (c.LoanAccount != null && c.LoanAccount.CustomerID == customerId.Value));

            var rawCases = await query.OrderByDescending(c => c.FilingDate).ThenByDescending(c => c.CaseId).ToListAsync();
            var list = rawCases.Select(c =>
            {
                var cust = c.Customer ?? c.LoanAccount?.Customer ?? c.Member?.Customer;
                var latestH = c.HearingLogs.OrderByDescending(h => h.HearingDate).ThenByDescending(h => h.HearingId).FirstOrDefault();
                return new
                {
                    c.CaseId,
                    c.BranchId,
                    BranchName = c.Branch?.BranchName ?? "",
                    c.LoanAccountId,
                    LoanAccountNo = c.LoanAccount?.LoanAccountNo ?? "",
                    LegacyLoanNo = c.LoanAccount?.LegacyAccountNumber,
                    CustomerID = c.CustomerId ?? c.LoanAccount?.CustomerID,
                    CIFNo = cust?.CIFNo ?? "",
                    LegacyCustomerNo = cust?.LegacyCustomerNo,
                    CustomerName = LegalRecoveryTrackerHelper.FormatCustomerName(cust),
                    MemberName = LegalRecoveryTrackerHelper.FormatCustomerName(cust),
                    MemberCode = cust?.CIFNo ?? "",
                    MobileNo = cust?.MobileNo ?? "",
                    Address = LegalRecoveryTrackerHelper.FormatCustomerAddress(cust),
                    c.CaseType,
                    c.CaseNumber,
                    c.CourtName,
                    c.AdvocateName,
                    FilingDate = c.FilingDate.ToString("yyyy-MM-dd"),
                    c.PrincipalClaim,
                    c.InterestClaim,
                    c.PenalInterestClaim,
                    c.OtherChargesClaim,
                    c.TotalClaimAmount,
                    c.CourtFeeAmount,
                    c.CourtFeeChallanNo,
                    c.CertificateNo,
                    CertificateNumber = c.CertificateNo,
                    CertificateDate = c.CertificateDate?.ToString("yyyy-MM-dd"),
                    c.SanctionedAmount,
                    GrantedAmount = c.SanctionedAmount,
                    c.FutureInterestRate,
                    GrantedInterestRate = c.FutureInterestRate,
                    c.AwardNumber,
                    AwardDate = c.AwardDate?.ToString("yyyy-MM-dd"),
                    c.TransferCertificateNo,
                    c.StayOrderNo,
                    StayOrderDate = c.StayOrderDate?.ToString("yyyy-MM-dd"),
                    c.ClosedReason,
                    ClosedDate = c.ClosedDate?.ToString("yyyy-MM-dd"),
                    c.Status,
                    CaseStatus = c.Status,
                    c.Remarks,
                    HearingsCount = c.HearingLogs.Count,
                    LatestHearing = latestH != null ? new
                    {
                        HearingDate = latestH.HearingDate.ToString("yyyy-MM-dd"),
                        NextHearingDate = latestH.NextHearingDate?.ToString("yyyy-MM-dd"),
                        latestH.NextHearingPurpose,
                        latestH.Stage,
                        HearingStage = LegalRecoveryTrackerHelper.ResolveHearingStageLabel(latestH.Stage),
                        latestH.CourtOrderSummary
                    } : null,
                    ExecutionsCount = c.Executions.Count,
                    TotalExpenses = c.LegalExpenses.Sum(x => x.Amount),
                    TotalLegalExpenses = c.LegalExpenses.Sum(x => x.Amount)
                };
            }).ToList();

            return Ok(list);
        }

        // GET: api/LegalRecovery/case/{caseId}
        [HttpGet("case/{caseId}")]
        public async Task<IActionResult> GetCaseById(int caseId)
        {
            var c = await _context.Sec101CaseMasters
                .AsNoTracking()
                .AsSplitQuery()
                .Include(x => x.LoanAccount).ThenInclude(l => l!.Customer)
                .Include(x => x.Customer)
                .Include(x => x.Member).ThenInclude(m => m!.Customer)
                .Include(x => x.Branch)
                .Include(x => x.HearingLogs)
                .Include(x => x.Executions)
                .Include(x => x.LegalExpenses).ThenInclude(e => e.Voucher)
                .FirstOrDefaultAsync(x => x.CaseId == caseId);

            if (c == null) return NotFound(new { message = "प्रकरण सापडले नाही." });
            if (IsBranchForbidden(c.BranchId))
                return StatusCode(403, new { message = "इतर शाखेचे प्रकरण पाहण्याची परवानगी नाही." });

            var cust = c.Customer ?? c.LoanAccount?.Customer ?? c.Member?.Customer;
            return Ok(new
            {
                c.CaseId,
                c.BranchId,
                BranchName = c.Branch?.BranchName ?? "",
                c.LoanAccountId,
                LoanAccountNo = c.LoanAccount?.LoanAccountNo ?? "",
                CustomerID = c.CustomerId ?? c.LoanAccount?.CustomerID,
                CIFNo = cust?.CIFNo ?? "",
                LegacyCustomerNo = cust?.LegacyCustomerNo,
                CustomerName = LegalRecoveryTrackerHelper.FormatCustomerName(cust),
                c.CaseType,
                c.CaseNumber,
                c.CourtName,
                c.AdvocateName,
                FilingDate = c.FilingDate.ToString("yyyy-MM-dd"),
                c.PrincipalClaim,
                c.InterestClaim,
                c.PenalInterestClaim,
                c.OtherChargesClaim,
                c.TotalClaimAmount,
                c.CourtFeeAmount,
                c.CourtFeeChallanNo,
                c.CertificateNo,
                CertificateDate = c.CertificateDate?.ToString("yyyy-MM-dd"),
                c.SanctionedAmount,
                c.FutureInterestRate,
                c.AwardNumber,
                AwardDate = c.AwardDate?.ToString("yyyy-MM-dd"),
                c.TransferCertificateNo,
                c.StayOrderNo,
                StayOrderDate = c.StayOrderDate?.ToString("yyyy-MM-dd"),
                c.ClosedReason,
                ClosedDate = c.ClosedDate?.ToString("yyyy-MM-dd"),
                c.Status,
                c.Remarks,
                HearingLogs = c.HearingLogs.OrderByDescending(h => h.HearingDate).ToList(),
                Executions = c.Executions.OrderByDescending(e => e.CreatedAt).ToList(),
                LegalExpenses = c.LegalExpenses.OrderByDescending(e => e.ExpenseDate).ToList()
            });
        }

        // POST: api/LegalRecovery/case/grant-certificate
        [HttpPost("case/grant-certificate")]
        public async Task<IActionResult> GrantCertificate([FromBody] GrantCertificateDto dto)
        {
            if (dto == null || dto.CaseId <= 0)
                return BadRequest(new { message = "अवैध विनंती." });

            var legalCase = await _context.Sec101CaseMasters.FindAsync(dto.CaseId);
            if (legalCase == null) return NotFound(new { message = "प्रकरण सापडले नाही." });
            if (IsBranchForbidden(legalCase.BranchId))
                return StatusCode(403, new { message = "इतर शाखेच्या प्रकरणावर दाखला नोंदवण्याची परवानगी नाही." });

            if (legalCase.Status == "CLOSED_RECOVERED" || legalCase.Status == "DISMISSED" || legalCase.Status == "WITHDRAWN")
                return BadRequest(new { message = $"बंद किंवा निकाली निघालेल्या ('{legalCase.Status}') प्रकरणावर पुन्हा दाखला नोंदवता येत नाही." });

            string certNo = !string.IsNullOrWhiteSpace(dto.CertificateNo) ? dto.CertificateNo.Trim() : (dto.CertificateNumber?.Trim() ?? "");
            string awardNo = dto.AwardNumber?.Trim() ?? "";
            if (string.IsNullOrWhiteSpace(certNo) && string.IsNullOrWhiteSpace(awardNo))
                return BadRequest(new { message = "वसुली दाखला क्रमांक किंवा निवाडा क्रमांक देणे बंधनकारक आहे." });

            decimal sanctioned = dto.SanctionedAmount > 0 ? dto.SanctionedAmount : (dto.GrantedAmount ?? 0m);
            if (sanctioned <= 0)
                return BadRequest(new { message = "मंजूर वसुली रक्कम शून्यापेक्षा जास्त असणे आवश्यक आहे." });

            DateTime activeBizDate = await LegalRecoveryTrackerHelper.ResolveActiveBusinessDateAsync(_context, legalCase.BranchId);
            DateTime certDate = (dto.CertificateDate ?? dto.AwardDate)?.Date ?? activeBizDate;
            if (certDate < legalCase.FilingDate.Date)
                return BadRequest(new { message = $"दाखला / निवाडा दिनांक ({certDate:dd/MM/yyyy}) दावा दाखल तारखेपेक्षा ({legalCase.FilingDate:dd/MM/yyyy}) आधीचा असू शकत नाही." });

            string? dateErr = await LegalRecoveryTrackerHelper.ValidateOperationalDateAsync(_context, legalCase.BranchId, certDate);
            if (!string.IsNullOrEmpty(dateErr)) return BadRequest(new { message = dateErr });

            legalCase.CertificateNo = !string.IsNullOrWhiteSpace(certNo) ? certNo : awardNo;
            legalCase.CertificateDate = certDate;
            legalCase.SanctionedAmount = sanctioned;
            legalCase.FutureInterestRate = dto.FutureInterestRate ?? dto.GrantedInterestRate;
            if (!string.IsNullOrWhiteSpace(awardNo)) legalCase.AwardNumber = awardNo;
            if (dto.AwardDate.HasValue) legalCase.AwardDate = dto.AwardDate.Value.Date;
            if (!string.IsNullOrWhiteSpace(dto.TransferCertificateNo)) legalCase.TransferCertificateNo = dto.TransferCertificateNo.Trim();
            if (legalCase.Status != "EXECUTION_RULE107" && legalCase.Status != "EXECUTION")
            {
                legalCase.Status = string.Equals(legalCase.CaseType, "SEC_91", StringComparison.OrdinalIgnoreCase)
                    ? "AWARDED"
                    : "CERTIFICATE_ISSUED";
            }
            if (!string.IsNullOrWhiteSpace(dto.Remarks))
            {
                legalCase.Remarks = string.IsNullOrWhiteSpace(legalCase.Remarks) ? dto.Remarks.Trim() : $"{legalCase.Remarks} | {dto.Remarks.Trim()}";
            }

            await _context.SaveChangesAsync();
            return Ok(new { Message = $"{(legalCase.CaseType == "SEC_91" ? "कलम ९१ निवाडा" : "कलम १०१ वसुली दाखला")} यशस्वीरीत्या नोंदवला." });
        }

        // PUT: api/LegalRecovery/case/status/{caseId}
        [HttpPut("case/status/{caseId}")]
        public async Task<IActionResult> UpdateCaseStatus(int caseId, [FromBody] UpdateCaseStatusDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Status))
                return BadRequest(new { message = "अवैध स्थिती विनंती." });

            var legalCase = await _context.Sec101CaseMasters.FindAsync(caseId);
            if (legalCase == null) return NotFound(new { message = "प्रकरण सापडले नाही." });
            if (IsBranchForbidden(legalCase.BranchId))
                return StatusCode(403, new { message = "इतर शाखेच्या प्रकरणाची स्थिती बदलण्याची परवानगी नाही." });

            string nextStatus = dto.Status.Trim().ToUpperInvariant();
            string[] allowed = { "FILED", "HEARING", "CERTIFICATE_ISSUED", "EXECUTION_RULE107", "STAYED", "DISMISSED", "WITHDRAWN", "CLOSED_RECOVERED" };
            if (!allowed.Contains(nextStatus))
                return BadRequest(new { message = $"अवैध प्रकरण स्थिती: '{nextStatus}'." });

            DateTime activeBizDate = await LegalRecoveryTrackerHelper.ResolveActiveBusinessDateAsync(_context, legalCase.BranchId);
            if (nextStatus == "STAYED")
            {
                if (string.IsNullOrWhiteSpace(dto.StayOrderNo))
                    return BadRequest(new { message = "स्थगिती आदेश (Stay Sec 154) नोंदवताना आदेश क्रमांक आवश्यक आहे." });
                legalCase.StayOrderNo = dto.StayOrderNo.Trim();
                legalCase.StayOrderDate = dto.StayOrderDate?.Date ?? activeBizDate;
            }
            else if (nextStatus == "CLOSED_RECOVERED" || nextStatus == "DISMISSED" || nextStatus == "WITHDRAWN")
            {
                legalCase.ClosedReason = !string.IsNullOrWhiteSpace(dto.ClosedReason) ? dto.ClosedReason.Trim() : nextStatus;
                legalCase.ClosedDate = dto.ClosedDate?.Date ?? activeBizDate;
            }

            legalCase.Status = nextStatus;
            await _context.SaveChangesAsync();
            return Ok(new { Message = "प्रकरणाची स्थिती यशस्वीरीत्या अद्ययावत केली." });
        }

        // POST: api/LegalRecovery/hearing/add
        [HttpPost("hearing/add")]
        public async Task<IActionResult> AddHearing([FromBody] AddHearingDto dto)
        {
            if (dto == null || dto.CaseId <= 0) return BadRequest(new { message = "अवैध सुनावणी विनंती." });

            var legalCase = await _context.Sec101CaseMasters.FindAsync(dto.CaseId);
            if (legalCase == null) return NotFound(new { message = "प्रकरण सापडले नाही." });
            if (IsBranchForbidden(legalCase.BranchId))
                return StatusCode(403, new { message = "इतर शाखेच्या प्रकरणात सुनावणी नोंदवण्याची परवानगी नाही." });

            if (legalCase.Status == "CLOSED_RECOVERED" || legalCase.Status == "DISMISSED" || legalCase.Status == "WITHDRAWN")
                return BadRequest(new { message = "बंद किंवा निकाली निघालेल्या प्रकरणात सुनावणी नोंदवता येत नाही." });

            DateTime activeBizDate = await LegalRecoveryTrackerHelper.ResolveActiveBusinessDateAsync(_context, legalCase.BranchId);
            DateTime hearingDate = dto.HearingDate?.Date ?? activeBizDate;
            if (hearingDate < legalCase.FilingDate.Date)
                return BadRequest(new { message = $"सुनावणी दिनांक ({hearingDate:dd/MM/yyyy}) दावा दाखल तारखेपेक्षा ({legalCase.FilingDate:dd/MM/yyyy}) आधीचा असू शकत नाही." });

            string? dateErr = await LegalRecoveryTrackerHelper.ValidateOperationalDateAsync(_context, legalCase.BranchId, hearingDate);
            if (!string.IsNullOrEmpty(dateErr)) return BadRequest(new { message = dateErr });

            if (dto.NextHearingDate.HasValue && dto.NextHearingDate.Value.Date <= hearingDate)
                return BadRequest(new { message = "पुढील सुनावणी दिनांक चालू सुनावणी तारखेनंतरचा असणे आवश्यक आहे." });

            var log = new Sec101HearingLog
            {
                CaseId = dto.CaseId,
                HearingDate = hearingDate,
                NextHearingDate = dto.NextHearingDate?.Date,
                NextHearingPurpose = dto.NextHearingPurpose?.Trim(),
                Stage = !string.IsNullOrWhiteSpace(dto.Stage) ? dto.Stage!.Trim() : (dto.HearingStage?.Trim() ?? "SUMMONS"),
                BorrowerPresence = !string.IsNullOrWhiteSpace(dto.BorrowerPresence) ? dto.BorrowerPresence!.Trim() : (dto.PresenceType?.Trim() ?? "ABSENT"),
                GuarantorPresence = dto.GuarantorPresence?.Trim() ?? "ABSENT",
                CourtOrderSummary = dto.CourtOrderSummary?.Trim(),
                AdvocateNotes = dto.AdvocateNotes?.Trim(),
                CreatedAt = DateTime.UtcNow,
                CreatedBy = User.GetUserId()
            };

            _context.Sec101HearingLogs.Add(log);

            // Prevent status regression if Certificate Issued / Execution Rule 107 / Stayed already active
            if (legalCase.Status == "FILED" || legalCase.Status == "NOTICE_STAGE")
            {
                legalCase.Status = "HEARING";
            }
            if (string.Equals(log.Stage, "STAYED", StringComparison.OrdinalIgnoreCase))
            {
                legalCase.Status = "STAYED";
            }

            await _context.SaveChangesAsync();
            return Ok(new { Message = "सुनावणी नोंद यशस्वीरीत्या सेव्ह झाली.", HearingId = log.HearingId, HearingLogId = log.HearingId });
        }

        // GET: api/LegalRecovery/hearings?branchId=1&caseId=...
        [HttpGet("hearings")]
        public async Task<IActionResult> GetHearings([FromQuery] int? branchId = null, [FromQuery] int? caseId = null)
        {
            var (scopedBranch, _, _) = GetBranchScope(branchId);
            if (branchId.HasValue && branchId.Value > 0 && IsBranchForbidden(branchId.Value))
                return StatusCode(403, new { message = "इतर शाखेच्या सुनावण्या पाहण्याची परवानगी नाही." });

            var query = _context.Sec101HearingLogs
                .AsNoTracking()
                .Include(h => h.Case).ThenInclude(c => c!.Customer)
                .Include(h => h.Case).ThenInclude(c => c!.LoanAccount).ThenInclude(l => l!.Customer)
                .Include(h => h.Case).ThenInclude(c => c!.Member).ThenInclude(m => m!.Customer)
                .Include(h => h.Case).ThenInclude(c => c!.Branch)
                .AsQueryable();

            if (scopedBranch.HasValue && scopedBranch.Value > 0) query = query.Where(h => h.Case != null && h.Case.BranchId == scopedBranch.Value);
            if (caseId.HasValue && caseId.Value > 0) query = query.Where(h => h.CaseId == caseId.Value);

            var rawList = await query.OrderByDescending(h => h.HearingDate).ThenByDescending(h => h.HearingId).ToListAsync();
            var list = rawList.Select(h =>
            {
                var cust = h.Case?.Customer ?? h.Case?.LoanAccount?.Customer ?? h.Case?.Member?.Customer;
                return new
                {
                    h.HearingId,
                    HearingLogId = h.HearingId,
                    h.CaseId,
                    CaseType = h.Case?.CaseType ?? "SEC_101",
                    CaseNumber = h.Case?.CaseNumber ?? "",
                    CourtName = h.Case?.CourtName ?? "",
                    AdvocateName = h.Case?.AdvocateName ?? "",
                    CustomerID = h.Case?.CustomerId ?? h.Case?.LoanAccount?.CustomerID,
                    CIFNo = cust?.CIFNo ?? "",
                    LegacyCustomerNo = cust?.LegacyCustomerNo,
                    CustomerName = LegalRecoveryTrackerHelper.FormatCustomerName(cust),
                    MemberName = LegalRecoveryTrackerHelper.FormatCustomerName(cust),
                    LoanAccountNo = h.Case?.LoanAccount?.LoanAccountNo ?? "",
                    BranchName = h.Case?.Branch?.BranchName ?? "",
                    HearingDate = h.HearingDate.ToString("yyyy-MM-dd"),
                    NextHearingDate = h.NextHearingDate?.ToString("yyyy-MM-dd"),
                    h.NextHearingPurpose,
                    h.Stage,
                    HearingStage = h.Stage,
                    StageLabel = LegalRecoveryTrackerHelper.ResolveHearingStageLabel(h.Stage),
                    PresenceType = h.BorrowerPresence,
                    h.BorrowerPresence,
                    h.GuarantorPresence,
                    h.AdvocateNotes,
                    h.CourtOrderSummary
                };
            }).ToList();

            return Ok(list);
        }

        // GET: api/LegalRecovery/hearings/upcoming?branchId=1&days=30
        [HttpGet("hearings/upcoming")]
        public async Task<IActionResult> GetUpcomingHearings([FromQuery] int? branchId = null, [FromQuery] int days = 30)
        {
            var (scopedBranch, _, opBranch) = GetBranchScope(branchId);
            if (branchId.HasValue && branchId.Value > 0 && IsBranchForbidden(branchId.Value))
                return StatusCode(403, new { message = "इतर शाखेच्या आगामी सुनावण्या पाहण्याची परवानगी नाही." });

            DateTime activeBizDate = await LegalRecoveryTrackerHelper.ResolveActiveBusinessDateAsync(_context, scopedBranch ?? opBranch);
            DateTime upperDate = activeBizDate.AddDays(Math.Clamp(days, 1, 365));

            var query = _context.Sec101HearingLogs
                .AsNoTracking()
                .Include(h => h.Case).ThenInclude(c => c!.Customer)
                .Include(h => h.Case).ThenInclude(c => c!.LoanAccount).ThenInclude(l => l!.Customer)
                .Include(h => h.Case).ThenInclude(c => c!.Member).ThenInclude(m => m!.Customer)
                .Include(h => h.Case).ThenInclude(c => c!.Branch)
                .Where(h => h.NextHearingDate.HasValue && h.NextHearingDate.Value.Date >= activeBizDate && h.NextHearingDate.Value.Date <= upperDate)
                .AsQueryable();

            if (scopedBranch.HasValue && scopedBranch.Value > 0) query = query.Where(h => h.Case != null && h.Case.BranchId == scopedBranch.Value);

            var rawList = await query.OrderBy(h => h.NextHearingDate).ToListAsync();
            var list = rawList.Select(h =>
            {
                var cust = h.Case?.Customer ?? h.Case?.LoanAccount?.Customer ?? h.Case?.Member?.Customer;
                return new
                {
                    h.HearingId,
                    HearingLogId = h.HearingId,
                    h.CaseId,
                    CaseType = h.Case?.CaseType ?? "SEC_101",
                    CaseNumber = h.Case?.CaseNumber ?? "",
                    CourtName = h.Case?.CourtName ?? "",
                    AdvocateName = h.Case?.AdvocateName ?? "",
                    CustomerID = h.Case?.CustomerId ?? h.Case?.LoanAccount?.CustomerID,
                    CIFNo = cust?.CIFNo ?? "",
                    CustomerName = LegalRecoveryTrackerHelper.FormatCustomerName(cust),
                    MemberName = LegalRecoveryTrackerHelper.FormatCustomerName(cust),
                    LoanAccountNo = h.Case?.LoanAccount?.LoanAccountNo ?? "",
                    BranchName = h.Case?.Branch?.BranchName ?? "",
                    HearingDate = h.HearingDate.ToString("yyyy-MM-dd"),
                    NextHearingDate = h.NextHearingDate!.Value.ToString("yyyy-MM-dd"),
                    h.NextHearingPurpose,
                    h.Stage,
                    StageLabel = LegalRecoveryTrackerHelper.ResolveHearingStageLabel(h.Stage),
                    h.AdvocateNotes,
                    h.CourtOrderSummary
                };
            }).ToList();

            return Ok(list);
        }

        // POST: api/LegalRecovery/execution/create
        [HttpPost("execution/create")]
        public async Task<IActionResult> CreateExecution([FromBody] CreateExecutionDto dto)
        {
            if (dto == null || dto.CaseId <= 0) return BadRequest(new { message = "अवैध जप्ती/अंमलबजावणी विनंती." });

            var legalCase = await _context.Sec101CaseMasters.FindAsync(dto.CaseId);
            if (legalCase == null) return NotFound(new { message = "प्रकरण सापडले नाही." });
            if (IsBranchForbidden(legalCase.BranchId))
                return StatusCode(403, new { message = "इतर शाखेच्या प्रकरणावर जप्ती कारवाई करण्याची परवानगी नाही." });

            bool hasCertificateOrAward =
                legalCase.Status == "CERTIFICATE_ISSUED" ||
                legalCase.Status == "CERTIFIED" ||
                legalCase.Status == "AWARDED" ||
                legalCase.Status == "EXECUTION" ||
                legalCase.Status == "EXECUTION_RULE107" ||
                !string.IsNullOrWhiteSpace(legalCase.CertificateNo) ||
                !string.IsNullOrWhiteSpace(legalCase.AwardNumber);

            if (!hasCertificateOrAward)
                return BadRequest(new { message = "नियम १०७ अंतर्गत जप्ती किंवा पगार कपात कारवाईपूर्वी कलम १०१ वसुली दाखला (किंवा कलम ९१ निवाडा) नोंदवणे बंधनकारक आहे." });

            if (legalCase.Status == "CLOSED_RECOVERED" || legalCase.Status == "DISMISSED" || legalCase.Status == "WITHDRAWN" || legalCase.Status == "STAYED")
                return BadRequest(new { message = $"प्रकरण '{legalCase.Status}' स्थितीत असल्याने जप्ती वॉरंट काढता येत नाही." });

            DateTime activeBizDate = await LegalRecoveryTrackerHelper.ResolveActiveBusinessDateAsync(_context, legalCase.BranchId);
            DateTime orderDate = (dto.WarrantIssueDate ?? dto.OrderDate)?.Date ?? activeBizDate;

            string? dateErr = await LegalRecoveryTrackerHelper.ValidateOperationalDateAsync(_context, legalCase.BranchId, orderDate);
            if (!string.IsNullOrEmpty(dateErr)) return BadRequest(new { message = dateErr });

            string normalizedType = (dto.ExecutionType ?? "IMMOVABLE_PROPERTY").Trim().ToUpperInvariant();
            if (normalizedType == "SEC_49_SALARY") normalizedType = "SALARY_ATTACHMENT_SEC49";
            if (normalizedType == "RULE_107_IMMOVABLE") normalizedType = "IMMOVABLE_PROPERTY";

            if (normalizedType == "SALARY_ATTACHMENT_SEC49" && string.IsNullOrWhiteSpace(dto.EmployerName))
                return BadRequest(new { message = "कलम ४९ पगार कपातीसाठी कंपनी / कार्यालयाचे नाव देणे बंधनकारक आहे." });

            var exec = new Sec101AttachmentAuction
            {
                CaseId = dto.CaseId,
                SroName = string.IsNullOrWhiteSpace(dto.SroName) ? "विशेष वसुली अधिकारी (SRO)" : dto.SroName.Trim(),
                ExecutionType = normalizedType,
                PropertyDetails = dto.PropertyDetails?.Trim(),
                EmployerName = dto.EmployerName?.Trim(),
                EmployerAddress = dto.EmployerAddress?.Trim(),
                MonthlyDeductionAmount = dto.MonthlyDeductionAmount,
                ValuationAmount = dto.ValuationAmount ?? dto.EstimatedValue ?? 0m,
                WarrantIssueDate = orderDate,
                PanchanamaDate = dto.PanchanamaDate?.Date,
                AuctionNoticeDate = dto.AuctionNoticeDate?.Date,
                AuctionDate = dto.AuctionDate?.Date,
                ReservePrice = dto.ReservePrice ?? 0m,
                SaleCertificateNo = string.IsNullOrWhiteSpace(dto.ExecutionOrderNo) ? null : dto.ExecutionOrderNo.Trim(),
                Status = "WARRANT_ISSUED",
                Remarks = dto.Remarks?.Trim(),
                CreatedAt = DateTime.UtcNow,
                CreatedBy = User.GetUserId()
            };

            _context.Sec101AttachmentAuctions.Add(exec);
            legalCase.Status = "EXECUTION_RULE107";
            await _context.SaveChangesAsync();

            return Ok(new
            {
                Message = "नियम १०७ जप्ती/पगार कपात/लिलाव नोंद यशस्वीरीत्या तयार झाली.",
                ExecutionId = exec.ExecutionId,
                ExecutionOrderNo = !string.IsNullOrWhiteSpace(exec.SaleCertificateNo) ? exec.SaleCertificateNo : $"EXEC-{exec.ExecutionId}"
            });
        }

        // PUT: api/LegalRecovery/execution/update-stage/{executionId}
        [HttpPut("execution/update-stage/{executionId}")]
        public async Task<IActionResult> UpdateExecutionStage(int executionId, [FromBody] UpdateExecutionStageDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Status))
                return BadRequest(new { message = "अवैध विनंती." });

            var exec = await _context.Sec101AttachmentAuctions
                .Include(e => e.Case)
                .FirstOrDefaultAsync(e => e.ExecutionId == executionId);
            if (exec == null || exec.Case == null) return NotFound(new { message = "अंमलबजावणी नोंद सापडली नाही." });
            if (IsBranchForbidden(exec.Case.BranchId))
                return StatusCode(403, new { message = "इतर शाखेची जप्ती स्थिती बदलण्याची परवानगी नाही." });

            if (exec.Status == "SETTLED")
                return BadRequest(new { message = "ही लिलाव/जप्ती नोंद आधीच पूर्ण सेटल झालेली आहे." });

            string nextStatus = dto.Status.Trim().ToUpperInvariant();
            if (nextStatus == "ATTACHED")
            {
                if (!dto.PanchanamaDate.HasValue && !exec.PanchanamaDate.HasValue)
                    return BadRequest(new { message = "जप्ती पंचनामा दिनांक देणे बंधनकारक आहे." });
                exec.PanchanamaDate = dto.PanchanamaDate?.Date ?? exec.PanchanamaDate;
            }
            else if (nextStatus == "AUCTION_SCHEDULED")
            {
                DateTime? noticeDt = dto.AuctionNoticeDate?.Date ?? exec.AuctionNoticeDate;
                DateTime? auctionDt = dto.AuctionDate?.Date ?? exec.AuctionDate;
                if (!noticeDt.HasValue || !auctionDt.HasValue)
                    return BadRequest(new { message = "लिलाव जाहीरनामा दिनांक आणि प्रत्यक्ष लिलाव दिनांक आवश्यक आहेत." });
                if (!dto.BypassThirtyDayNoticeCheck && (auctionDt.Value - noticeDt.Value).Days < 30)
                    return BadRequest(new { message = $"सहकार नियम १०७(११)(e) नुसार लिलाव जाहीरनाम्यापासून किमान ३० दिवसांचा कालावधी आवश्यक आहे (सध्या: {(auctionDt.Value - noticeDt.Value).Days} दिवस)." });
                exec.AuctionNoticeDate = noticeDt;
                exec.AuctionDate = auctionDt;
                if (dto.ReservePrice.HasValue) exec.ReservePrice = dto.ReservePrice.Value;
            }
            else if (nextStatus == "AUCTION_COMPLETED")
            {
                decimal bid = dto.HighestBidAmount ?? exec.HighestBidAmount;
                if (bid <= 0 || string.IsNullOrWhiteSpace(dto.BuyerName ?? exec.BuyerName))
                    return BadRequest(new { message = "लिलावाची सर्वोच्च बोली रक्कम व खरेदीदाराचे नाव आवश्यक आहे." });
                if (exec.ReservePrice > 0 && bid < exec.ReservePrice)
                    return BadRequest(new { message = $"सर्वोच्च बोली (₹{bid:N2}) आरक्षित किमतीपेक्षा (₹{exec.ReservePrice:N2}) कमी आहे." });
                exec.HighestBidAmount = bid;
                exec.BuyerName = (dto.BuyerName ?? exec.BuyerName)?.Trim();
                exec.BuyerContact = (dto.BuyerContact ?? exec.BuyerContact)?.Trim();
                if (dto.SpotDepositAmount.HasValue) exec.SpotDepositAmount = dto.SpotDepositAmount.Value;
                if (dto.BalancePaymentDueDate.HasValue) exec.BalancePaymentDueDate = dto.BalancePaymentDueDate.Value.Date;
                if (!string.IsNullOrWhiteSpace(dto.SaleCertificateNo)) exec.SaleCertificateNo = dto.SaleCertificateNo.Trim();
                if (dto.SaleCertificateDate.HasValue) exec.SaleCertificateDate = dto.SaleCertificateDate.Value.Date;
            }

            exec.Status = nextStatus;
            if (!string.IsNullOrWhiteSpace(dto.Remarks))
            {
                exec.Remarks = string.IsNullOrWhiteSpace(exec.Remarks) ? dto.Remarks.Trim() : $"{exec.Remarks} | {dto.Remarks.Trim()}";
            }

            await _context.SaveChangesAsync();
            return Ok(new { Message = "नियम १०७ कारवाई टप्पा यशस्वीरीत्या अद्ययावत झाला.", Status = exec.Status });
        }

        // POST: api/LegalRecovery/execution/settle/{executionId}
        [HttpPost("execution/settle/{executionId}")]
        public async Task<IActionResult> SettleExecution(int executionId, [FromBody] SettleExecutionDto dto)
        {
            if (dto == null || dto.RecoveredAmount <= 0)
                return BadRequest(new { message = "वसुली रक्कम शून्यापेक्षा जास्त असणे आवश्यक आहे." });

            var exec = await _context.Sec101AttachmentAuctions
                .Include(e => e.Case)
                .FirstOrDefaultAsync(e => e.ExecutionId == executionId);
            if (exec == null || exec.Case == null) return NotFound(new { message = "अंमलबजावणी नोंद सापडली नाही." });
            if (IsBranchForbidden(exec.Case.BranchId))
                return StatusCode(403, new { message = "इतर शाखेची लिलाव वसुली नोंदवण्याची परवानगी नाही." });
            if (exec.SettlementVoucherId.HasValue || exec.Status == "SETTLED")
                return BadRequest(new { message = "या नियम १०७ कारवाईचे वसुली व्हाउचर आधीच तयार झालेले आहे." });

            var loan = await _context.LoanAccounts.FirstOrDefaultAsync(l => l.LoanAccountID == exec.Case.LoanAccountId);
            if (loan == null) return NotFound(new { message = "संबंधित कर्ज खाते सापडले नाही." });

            DateTime activeBizDate = await LegalRecoveryTrackerHelper.ResolveActiveBusinessDateAsync(_context, exec.Case.BranchId);
            DateTime settlementDate = dto.SettlementDate?.Date ?? activeBizDate;
            string? dateErr = await LegalRecoveryTrackerHelper.ValidateOperationalDateAsync(_context, exec.Case.BranchId, settlementDate);
            if (!string.IsNullOrEmpty(dateErr)) return BadRequest(new { message = dateErr });

            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var result = await LegalRecoveryTrackerHelper.SettleExecutionRule107Async(
                    _context,
                    exec,
                    exec.Case,
                    loan,
                    dto.RecoveredAmount,
                    dto.PaymentMode,
                    dto.BankLedgerId,
                    dto.ReferenceNo,
                    settlementDate,
                    User.GetUserId(),
                    dto.Remarks);

                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = "नियम १०७ लिलाव/जप्ती वसुली व्हाउचर यशस्वीरीत्या तयार झाले (व्हाउचर पासिंगसाठी प्रलंबित).",
                    VoucherNo = result.Voucher.VoucherNo,
                    VoucherId = result.Voucher.VoucherID,
                    LoanAppliedAmount = result.LoanAppliedAmount,
                    SurplusAmount = result.SurplusAmount
                });
            }
            catch (InvalidOperationException valEx)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { message = valEx.Message });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "लिलाव वसुली सेव्ह करताना त्रुटी: " + ex.Message });
            }
        }

        // GET: api/LegalRecovery/executions?branchId=1&caseId=...
        [HttpGet("executions")]
        public async Task<IActionResult> GetExecutions([FromQuery] int? branchId = null, [FromQuery] int? caseId = null)
        {
            var (scopedBranch, _, _) = GetBranchScope(branchId);
            if (branchId.HasValue && branchId.Value > 0 && IsBranchForbidden(branchId.Value))
                return StatusCode(403, new { message = "इतर शाखेच्या जप्ती नोंदी पाहण्याची परवानगी नाही." });

            var query = _context.Sec101AttachmentAuctions
                .AsNoTracking()
                .Include(e => e.Case).ThenInclude(c => c!.Customer)
                .Include(e => e.Case).ThenInclude(c => c!.LoanAccount).ThenInclude(l => l!.Customer)
                .Include(e => e.Case).ThenInclude(c => c!.Member).ThenInclude(m => m!.Customer)
                .Include(e => e.Case).ThenInclude(c => c!.Branch)
                .AsQueryable();

            if (scopedBranch.HasValue && scopedBranch.Value > 0) query = query.Where(e => e.Case != null && e.Case.BranchId == scopedBranch.Value);
            if (caseId.HasValue && caseId.Value > 0) query = query.Where(e => e.CaseId == caseId.Value);

            var rawList = await query.OrderByDescending(e => e.CreatedAt).ToListAsync();
            var settlementIds = rawList.Where(e => e.SettlementVoucherId.HasValue).Select(e => e.SettlementVoucherId!.Value).Distinct().ToList();
            var settlementVouchers = settlementIds.Any()
                ? await _context.Vouchers.AsNoTracking().Where(v => settlementIds.Contains(v.VoucherID)).ToDictionaryAsync(v => v.VoucherID)
                : new Dictionary<int, Voucher>();

            var list = rawList.Select(e =>
            {
                var cust = e.Case?.Customer ?? e.Case?.LoanAccount?.Customer ?? e.Case?.Member?.Customer;
                settlementVouchers.TryGetValue(e.SettlementVoucherId ?? 0, out var sv);
                return new
                {
                    e.ExecutionId,
                    e.CaseId,
                    CaseType = e.Case?.CaseType ?? "SEC_101",
                    CaseNumber = e.Case?.CaseNumber ?? "",
                    CertificateNo = e.Case?.CertificateNo ?? "",
                    CertificateNumber = e.Case?.CertificateNo ?? "",
                    SanctionedAmount = e.Case?.SanctionedAmount ?? 0m,
                    GrantedAmount = e.Case?.SanctionedAmount ?? 0m,
                    CustomerID = e.Case?.CustomerId ?? e.Case?.LoanAccount?.CustomerID,
                    CIFNo = cust?.CIFNo ?? "",
                    LegacyCustomerNo = cust?.LegacyCustomerNo,
                    CustomerName = LegalRecoveryTrackerHelper.FormatCustomerName(cust),
                    MemberName = LegalRecoveryTrackerHelper.FormatCustomerName(cust),
                    MemberCode = cust?.CIFNo ?? "",
                    LoanAccountNo = e.Case?.LoanAccount?.LoanAccountNo ?? "",
                    BranchName = e.Case?.Branch?.BranchName ?? "",
                    e.SroName,
                    e.ExecutionType,
                    ExecutionOrderNo = !string.IsNullOrWhiteSpace(e.SaleCertificateNo) ? e.SaleCertificateNo : $"EXEC-{e.ExecutionId}",
                    OrderDate = (e.WarrantIssueDate ?? e.CreatedAt).ToString("yyyy-MM-dd"),
                    e.PropertyDetails,
                    EmployerName = !string.IsNullOrWhiteSpace(e.EmployerName) ? e.EmployerName : (e.PropertyDetails != null && e.PropertyDetails.Contains("कंपनी:") ? e.PropertyDetails : ""),
                    e.EmployerAddress,
                    MonthlyDeductionAmount = e.MonthlyDeductionAmount ?? (e.ExecutionType.Contains("SALARY") ? e.ReservePrice : (decimal?)null),
                    e.ValuationAmount,
                    EstimatedValue = e.ValuationAmount,
                    WarrantIssueDate = e.WarrantIssueDate?.ToString("yyyy-MM-dd"),
                    PanchanamaDate = e.PanchanamaDate?.ToString("yyyy-MM-dd"),
                    AuctionNoticeDate = e.AuctionNoticeDate?.ToString("yyyy-MM-dd"),
                    AuctionDate = e.AuctionDate?.ToString("yyyy-MM-dd"),
                    e.ReservePrice,
                    e.HighestBidAmount,
                    e.SpotDepositAmount,
                    BalancePaymentDueDate = e.BalancePaymentDueDate?.ToString("yyyy-MM-dd"),
                    e.SurplusAmount,
                    e.SettlementVoucherId,
                    SettlementVoucherNo = sv?.VoucherNo,
                    SettlementVoucherStatus = sv?.Status,
                    e.BuyerName,
                    e.BuyerContact,
                    e.SaleCertificateNo,
                    SaleCertificateDate = e.SaleCertificateDate?.ToString("yyyy-MM-dd"),
                    e.Status,
                    ExecutionStatus = e.Status,
                    e.Remarks,
                    RecoveredAmount = e.HighestBidAmount
                };
            }).ToList();

            return Ok(list);
        }

        // POST: api/LegalRecovery/expense/add
        [HttpPost("expense/add")]
        public async Task<IActionResult> AddLegalExpense([FromBody] AddLegalExpenseDto dto)
        {
            if (dto == null || dto.Amount <= 0)
                return BadRequest(new { message = "अवैध खर्च रक्कम." });

            int effectiveLoanAccountId = dto.LoanAccountId;
            int? caseBranchId = null;
            if (dto.CaseId.HasValue && dto.CaseId.Value > 0)
            {
                var caseRef = await _context.Sec101CaseMasters
                    .AsNoTracking()
                    .Where(c => c.CaseId == dto.CaseId.Value)
                    .Select(c => new { c.LoanAccountId, c.BranchId })
                    .FirstOrDefaultAsync();
                if (caseRef == null) return NotFound(new { message = "संबंधित प्रकरण सापडले नाही." });
                if (effectiveLoanAccountId <= 0) effectiveLoanAccountId = caseRef.LoanAccountId;
                caseBranchId = caseRef.BranchId;
            }

            if (effectiveLoanAccountId <= 0)
                return BadRequest(new { message = "कायदेशीर खर्च नोंदवण्यासाठी वैध कर्ज खाते निवडणे बंधनकारक आहे." });

            var loan = await _context.LoanAccounts
                .Include(l => l.Member)
                .FirstOrDefaultAsync(l => l.LoanAccountID == effectiveLoanAccountId);
            if (loan == null) return NotFound(new { message = "कर्ज खाते सापडले नाही." });

            int targetBranchId = User.IsHeadOfficeAdmin()
                ? (dto.BranchId > 0 ? dto.BranchId : (caseBranchId ?? loan.BranchID))
                : User.GetOperatingBranchId();

            if (IsBranchForbidden(loan.BranchID) || loan.BranchID != targetBranchId)
                return StatusCode(403, new { message = "इतर शाखेच्या कर्ज खात्यावर कायदेशीर खर्च नोंदवण्याची परवानगी नाही." });

            DateTime activeBizDate = await LegalRecoveryTrackerHelper.ResolveActiveBusinessDateAsync(_context, loan.BranchID);
            DateTime expDate = dto.ExpenseDate == default ? activeBizDate : dto.ExpenseDate.Date;
            string? dateErr = await LegalRecoveryTrackerHelper.ValidateOperationalDateAsync(_context, loan.BranchID, expDate);
            if (!string.IsNullOrEmpty(dateErr)) return BadRequest(new { message = dateErr });

            dto.ExpenseDate = expDate;
            string payee = string.IsNullOrWhiteSpace(dto.PaidTo) ? (dto.PayeeName ?? "कायदेशीर सल्लागार / अधिकारी") : dto.PaidTo!.Trim();
            dto.PayeeName = payee;
            int userId = User.GetUserId();

            if (!dto.PostVoucher)
            {
                var infoExp = new Sec101LegalExpense
                {
                    BranchId = loan.BranchID,
                    CaseId = dto.CaseId,
                    LoanAccountId = effectiveLoanAccountId,
                    CustomerId = LegalRecoveryTrackerHelper.ResolveLoanCustomerId(loan),
                    ExpenseType = dto.ExpenseType,
                    Amount = dto.Amount,
                    ExpenseDate = expDate,
                    PaidTo = payee,
                    VoucherId = null,
                    IsDebitedToLoan = false,
                    Remarks = dto.Remarks?.Trim(),
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = userId
                };
                _context.Sec101LegalExpenses.Add(infoExp);
                await _context.SaveChangesAsync();
                return Ok(new { Message = "कायदेशीर खर्च नोंद (व्हाउचरविरहित) सेव्ह झाली." });
            }

            if (BankLedgerHelper.IsBankPaymentMode(dto.PaymentMode))
            {
                var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(_context, dto.BankLedgerId);
                if (!bankCheck.IsValid) return BadRequest(new { message = bankCheck.ErrorMessage });
            }

            try
            {
                var voucher = await Step4AccountingHelper.ExecuteLegalExpenseAtomicAsync(
                    _context, dto, loan.BranchID, effectiveLoanAccountId, userId);

                return Ok(new
                {
                    Message = dto.CapitalizeToLoanPrincipal
                        ? "कर्जाच्या मुद्दलात (Principal Balance) खर्च अ‍ॅड करण्यासाठी व्हाउचर यशस्वीरीत्या तयार केले (मंजुरीसाठी प्रलंबित)."
                        : "खर्च नोंदवला व व्हाउचर मंजुरीसाठी तयार केले (Pending).",
                    VoucherNo = voucher.VoucherNo,
                    VoucherNumber = voucher.VoucherNo,
                    VoucherId = voucher.VoucherID,
                    CapitalizeToLoanPrincipal = dto.CapitalizeToLoanPrincipal
                });
            }
            catch (InvalidOperationException valEx)
            {
                return BadRequest(new { message = valEx.Message });
            }
        }

        // GET: api/LegalRecovery/expenses?caseId=...&loanAccountId=...&branchId=...&customerId=...
        [HttpGet("expenses")]
        public async Task<IActionResult> GetLegalExpenses(
            [FromQuery] int? caseId = null,
            [FromQuery] int? loanAccountId = null,
            [FromQuery] int? branchId = null,
            [FromQuery] int? customerId = null)
        {
            var (scopedBranch, _, _) = GetBranchScope(branchId);
            if (branchId.HasValue && branchId.Value > 0 && IsBranchForbidden(branchId.Value))
                return StatusCode(403, new { message = "इतर शाखेचे कायदेशीर खर्च पाहण्याची परवानगी नाही." });

            var query = _context.Sec101LegalExpenses
                .AsNoTracking()
                .Include(x => x.Customer)
                .Include(x => x.LoanAccount).ThenInclude(l => l!.Customer)
                .Include(x => x.Case).ThenInclude(c => c!.Customer)
                .Include(x => x.Case).ThenInclude(c => c!.Member).ThenInclude(m => m!.Customer)
                .Include(x => x.Voucher).ThenInclude(v => v!.VoucherDetails).ThenInclude(d => d.Ledger)
                .AsQueryable();

            if (scopedBranch.HasValue && scopedBranch.Value > 0) query = query.Where(x => x.BranchId == scopedBranch.Value);
            if (caseId.HasValue && caseId.Value > 0) query = query.Where(x => x.CaseId == caseId.Value);
            if (loanAccountId.HasValue && loanAccountId.Value > 0) query = query.Where(x => x.LoanAccountId == loanAccountId.Value);
            if (customerId.HasValue && customerId.Value > 0)
                query = query.Where(x => x.CustomerId == customerId.Value || (x.LoanAccount != null && x.LoanAccount.CustomerID == customerId.Value));

            var rawList = await query.OrderByDescending(x => x.ExpenseDate).ThenByDescending(x => x.ExpenseId).ToListAsync();
            var list = rawList.Select(x =>
            {
                var cust = x.Customer ?? x.LoanAccount?.Customer ?? x.Case?.Customer ?? x.Case?.Member?.Customer;
                bool isBankCr = x.Voucher?.VoucherDetails.Any(d => d.DrCr == "Cr" && d.Ledger != null && BankLedgerHelper.IsBankLedger(d.Ledger)) ?? false;
                int bankLedgerId = x.Voucher?.VoucherDetails
                    .Where(d => d.DrCr == "Cr" && d.Ledger != null && BankLedgerHelper.IsBankLedger(d.Ledger))
                    .Select(d => d.LedgerID)
                    .FirstOrDefault() ?? 0;
                string modeLabel = string.Equals(x.Voucher?.VoucherType, "Journal", StringComparison.OrdinalIgnoreCase)
                    ? "JOURNAL"
                    : (isBankCr ? "BANK_TRANSFER" : "CASH");

                return new
                {
                    x.ExpenseId,
                    LegalExpenseId = x.ExpenseId,
                    x.BranchId,
                    x.CaseId,
                    x.NoticeId,
                    CaseNumber = x.Case?.CaseNumber ?? "",
                    CaseType = x.Case?.CaseType ?? "SEC_101",
                    x.LoanAccountId,
                    LoanAccountNo = x.LoanAccount?.LoanAccountNo ?? "",
                    CustomerID = x.CustomerId ?? x.LoanAccount?.CustomerID,
                    CIFNo = cust?.CIFNo ?? "",
                    LegacyCustomerNo = cust?.LegacyCustomerNo,
                    CustomerName = LegalRecoveryTrackerHelper.FormatCustomerName(cust),
                    MemberName = LegalRecoveryTrackerHelper.FormatCustomerName(cust),
                    x.ExpenseType,
                    x.Amount,
                    ExpenseDate = x.ExpenseDate.ToString("yyyy-MM-dd"),
                    x.PaidTo,
                    PayeeName = x.PaidTo,
                    x.VoucherId,
                    VoucherNo = x.Voucher?.VoucherNo ?? "",
                    VoucherNumber = x.Voucher?.VoucherNo ?? "",
                    VoucherStatus = x.Voucher?.Status ?? "None",
                    PaymentMode = modeLabel,
                    BankLedgerId = bankLedgerId,
                    IsDebitedToBorrower = x.IsDebitedToLoan,
                    x.IsDebitedToLoan,
                    x.CapitalizeToLoanPrincipal,
                    x.IsPrincipalApplied,
                    x.DebitLedgerId,
                    x.CreditLedgerId,
                    x.Remarks
                };
            }).ToList();

            return Ok(list);
        }

        // GET: api/LegalRecovery/overdue-charge-candidates?branchId=1&asOnDate=2026-11-26&loanRateId=2&creditLedgerId=405&overdueMode=ALL_OVERDUE
        [HttpGet("overdue-charge-candidates")]
        public async Task<IActionResult> GetOverdueChargeCandidates(
            [FromQuery] int? branchId = null,
            [FromQuery] DateTime? asOnDate = null,
            [FromQuery] int? loanRateId = null,
            [FromQuery] int? creditLedgerId = null,
            [FromQuery] string overdueMode = "ALL_OVERDUE")
        {
            var (scopedBranch, _, opBranch) = GetBranchScope(branchId);
            if (branchId.HasValue && branchId.Value > 0 && IsBranchForbidden(branchId.Value))
            {
                return StatusCode(403, new { message = "इतर शाखेची थकबाकीदार कर्ज खाती पाहण्याची परवानगी नाही." });
            }

            int targetBranchId = scopedBranch ?? (opBranch > 0 ? opBranch : 1);
            DateTime activeBizDate = await LegalRecoveryTrackerHelper.ResolveActiveBusinessDateAsync(_context, targetBranchId);
            DateTime targetDate = asOnDate?.Date ?? activeBizDate;
            bool wantMaturityOnly = string.Equals((overdueMode ?? string.Empty).Trim(), "MATURITY_ONLY", StringComparison.OrdinalIgnoreCase);

            var query = _context.LoanAccounts
                .AsNoTracking()
                .AsSplitQuery()
                .Include(la => la.Customer)
                .Include(la => la.Member).ThenInclude(m => m!.Customer)
                .Include(la => la.LoanRate)
                .Where(la => la.BranchID == targetBranchId &&
                             la.OpeningDate <= targetDate &&
                             la.Status == "Active" &&
                             (la.PrincipalBalance > 0m || la.InterestBalance > 0m || la.OverdueInterestBalance > 0m));

            if (loanRateId.HasValue && loanRateId.Value > 0)
            {
                query = query.Where(la => la.LoanRateID == loanRateId.Value);
            }

            var loanAccounts = await query.ToListAsync();
            if (!loanAccounts.Any())
            {
                return Ok(Array.Empty<object>());
            }

            var loanIds = loanAccounts.Select(l => l.LoanAccountID).ToList();

            var schedulesByLoan = (await _context.LoanInstallmentSchedules
                .AsNoTracking()
                .Where(s => loanIds.Contains(s.LoanAccountID))
                .ToListAsync())
                .GroupBy(s => s.LoanAccountID)
                .ToDictionary(g => g.Key, g => g.ToList());

            var collectionsByLoan = (await _context.LoanCollections
                .AsNoTracking()
                .Where(c => loanIds.Contains(c.LoanAccountID) && c.CollectionDate <= targetDate)
                .ToListAsync())
                .GroupBy(c => c.LoanAccountID)
                .ToDictionary(g => g.Key, g => g.ToList());

            var recoveryDueByLoan = await _context.OverdueRecoveryLedgers
                .AsNoTracking()
                .Where(o => loanIds.Contains(o.LoanAccountID) && o.TransactionDate <= targetDate)
                .GroupBy(o => o.LoanAccountID)
                .Select(g => new { LoanAccountID = g.Key, NetDue = g.Sum(x => x.DebitAmount - x.CreditAmount) })
                .ToDictionaryAsync(x => x.LoanAccountID, x => Math.Max(0m, x.NetDue));

            var sameDayExpQuery = _context.Sec101LegalExpenses
                .AsNoTracking()
                .Include(e => e.Voucher)
                .Where(e => loanIds.Contains(e.LoanAccountId) &&
                            e.CapitalizeToLoanPrincipal &&
                            e.ExpenseDate.Date == targetDate &&
                            (e.Voucher == null || (e.Voucher.Status != "Rejected" && e.Voucher.Status != "Cancelled")));

            if (creditLedgerId.HasValue && creditLedgerId.Value > 0)
            {
                sameDayExpQuery = sameDayExpQuery.Where(e => e.CreditLedgerId == creditLedgerId.Value);
            }

            var sameDayByLoan = (await sameDayExpQuery.ToListAsync())
                .GroupBy(e => e.LoanAccountId)
                .ToDictionary(
                    g => g.Key,
                    g => new
                    {
                        TotalAmount = g.Sum(x => x.Amount),
                        VoucherNo = g.OrderByDescending(x => x.ExpenseId).Select(x => x.Voucher != null ? x.Voucher.VoucherNo : "").FirstOrDefault() ?? ""
                    });

            var resultRows = new List<object>();
            var sortable = new List<(string LoanType, int HasNumericLegacy, long NumericLegacy, string RawLegacy, string LoanAccountNo, object Payload)>();

            foreach (var la in loanAccounts)
            {
                schedulesByLoan.TryGetValue(la.LoanAccountID, out var accSchedules);
                collectionsByLoan.TryGetValue(la.LoanAccountID, out var accCollections);
                recoveryDueByLoan.TryGetValue(la.LoanAccountID, out var unpaidRec);

                var snap = VoucherLoanChargeHelper.ComputeOverdueCandidateSnapshot(
                    la,
                    accSchedules,
                    targetDate,
                    unpaidRec,
                    accCollections);

                if (wantMaturityOnly ? !snap.IsMaturityOverdue : !snap.IsAnyOverdue)
                {
                    continue;
                }

                // CustomerID-First resolution: Customer primary, Member strictly secondary/nullable
                var cust = la.Customer ?? la.Member?.Customer;
                int? resolvedCustomerId = LegalRecoveryTrackerHelper.ResolveLoanCustomerId(la);
                string customerName = LegalRecoveryTrackerHelper.FormatCustomerName(cust);
                string loanType = !string.IsNullOrWhiteSpace(la.LoanRate?.ShortName)
                    ? la.LoanRate!.ShortName!.Trim()
                    : (la.LoanRate?.LoanType ?? "");
                sameDayByLoan.TryGetValue(la.LoanAccountID, out var sameDay);

                string rawLeg = (la.LegacyAccountNumber ?? string.Empty).Trim();
                bool isNumLeg = long.TryParse(rawLeg, out long parsedLeg);

                var payload = new
                {
                    la.LoanAccountID,
                    la.BranchID,
                    LoanAccountNo = la.LoanAccountNo ?? "",
                    LegacyAccountNumber = string.IsNullOrWhiteSpace(rawLeg) ? null : rawLeg,
                    CustomerID = resolvedCustomerId,
                    CifNo = cust?.CIFNo ?? "",
                    LegacyCustomerNo = cust?.LegacyCustomerNo,
                    CustomerName = customerName,
                    MobileNo = cust?.MobileNo ?? "",
                    MemberID = la.MemberID,
                    la.LoanRateID,
                    LoanType = loanType,
                    LoanLedgerID = la.LoanRate?.LoanLedgerID,
                    LoanDate = (la.LoanDisbursementDate ?? la.OpeningDate).ToString("yyyy-MM-dd"),
                    OverdueDate = snap.OverdueDate?.ToString("yyyy-MM-dd"),
                    MaturityDate = la.MaturityDate?.ToString("yyyy-MM-dd"),
                    la.PrincipalBalance,
                    la.InterestBalance,
                    la.OverdueInterestBalance,
                    OverdueAmount = snap.OverdueAmount,
                    OverdueCategory = snap.OverdueCategory,
                    IsMaturityOverdue = snap.IsMaturityOverdue,
                    IsInstallmentOverdue = snap.IsInstallmentOverdue,
                    HasReceivableDues = snap.HasReceivableDues,
                    OverdueInstallmentsCount = snap.OverdueInstallmentsCount,
                    la.CapitalizedRecoveryCharges,
                    AlreadyChargedToday = sameDay != null && sameDay.TotalAmount > 0m,
                    AlreadyChargedAmount = sameDay?.TotalAmount ?? 0m,
                    AlreadyChargedVoucherNo = sameDay?.VoucherNo ?? ""
                };

                sortable.Add((loanType, isNumLeg ? 0 : 1, isNumLeg ? parsedLeg : long.MaxValue, rawLeg, la.LoanAccountNo ?? "", payload));
            }

            resultRows = sortable
                .OrderBy(x => x.LoanType)
                .ThenBy(x => x.HasNumericLegacy)
                .ThenBy(x => x.NumericLegacy)
                .ThenBy(x => x.RawLegacy)
                .ThenBy(x => x.LoanAccountNo)
                .Select(x => x.Payload)
                .ToList();

            return Ok(resultRows);
        }

        // POST: api/LegalRecovery/expense/bulk-add
        [HttpPost("expense/bulk-add")]
        public async Task<IActionResult> BulkAddLoanCharges([FromBody] BulkAddLoanChargeDto dto)
        {
            if (dto == null)
            {
                return BadRequest(new { message = "विनंती डेटा रिक्त आहे." });
            }

            int targetBranchId = User.IsHeadOfficeAdmin()
                ? (dto.BranchId > 0 ? dto.BranchId : User.GetOperatingBranchId())
                : User.GetOperatingBranchId();
            if (targetBranchId <= 0) targetBranchId = 1;

            if (IsBranchForbidden(targetBranchId) || (dto.BranchId > 0 && !User.IsHeadOfficeAdmin() && dto.BranchId != targetBranchId))
            {
                return StatusCode(403, new { message = "इतर शाखेच्या कर्ज खात्यांवर बल्क खर्च नोंदवण्याची परवानगी नाही." });
            }

            DateTime activeBizDate = await LegalRecoveryTrackerHelper.ResolveActiveBusinessDateAsync(_context, targetBranchId);
            DateTime expDate = dto.ExpenseDate == default ? activeBizDate : dto.ExpenseDate.Date;
            string? dateErr = await LegalRecoveryTrackerHelper.ValidateOperationalDateAsync(_context, targetBranchId, expDate);
            if (!string.IsNullOrEmpty(dateErr))
            {
                return BadRequest(new { message = dateErr });
            }

            int userId = User.GetUserId();
            var items = (dto.Items ?? new List<BulkLoanChargeItemDto>())
                .Select(i => new VoucherLoanChargeHelper.BulkLoanChargeItemInput
                {
                    LoanAccountId = i.LoanAccountId,
                    Amount = i.Amount
                })
                .ToList();

            try
            {
                var res = await VoucherLoanChargeHelper.ExecuteBulkLoanChargesAtomicAsync(
                    _context,
                    targetBranchId,
                    expDate,
                    dto.CreditLedgerId,
                    items,
                    userId,
                    dto.ExpenseType,
                    dto.Remarks);

                return Ok(new
                {
                    Message = $"एकूण {res.ProcessedCount} थकबाकीदार खात्यांवर ₹{res.TotalAmount:N2} रक्कम '{res.IncomeLedgerName}' लेजरवर जमा करून कर्जात नावे टाकण्याचे व्हाउचर तयार झाले (मंजुरीसाठी प्रलंबित).",
                    VoucherNo = res.Voucher.VoucherNo,
                    VoucherNumber = res.Voucher.VoucherNo,
                    VoucherId = res.Voucher.VoucherID,
                    ProcessedCount = res.ProcessedCount,
                    TotalAmount = res.TotalAmount,
                    IncomeLedgerName = res.IncomeLedgerName,
                    Status = res.Voucher.Status
                });
            }
            catch (InvalidOperationException valEx)
            {
                return BadRequest(new { message = valEx.Message });
            }
        }

        // GET: api/LegalRecovery/bulk-charge-batches?branchId=1&fromDate=2026-04-01&toDate=2026-11-26&creditLedgerId=405
        [HttpGet("bulk-charge-batches")]
        public async Task<IActionResult> GetBulkChargeBatches(
            [FromQuery] int? branchId = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] int? creditLedgerId = null)
        {
            var (scopedBranch, _, _) = GetBranchScope(branchId);
            if (branchId.HasValue && branchId.Value > 0 && IsBranchForbidden(branchId.Value))
            {
                return StatusCode(403, new { message = "इतर शाखेची वसुली खर्च यादी पाहण्याची परवानगी नाही." });
            }

            var query = _context.Sec101LegalExpenses
                .AsNoTracking()
                .AsSplitQuery()
                .Include(e => e.Customer)
                .Include(e => e.LoanAccount).ThenInclude(l => l!.Customer)
                .Include(e => e.LoanAccount).ThenInclude(l => l!.Member).ThenInclude(m => m!.Customer)
                .Include(e => e.LoanAccount).ThenInclude(l => l!.LoanRate)
                .Include(e => e.Voucher)
                .Where(e => e.CapitalizeToLoanPrincipal &&
                            e.VoucherId.HasValue &&
                            (e.Voucher == null || (e.Voucher.Status != "Rejected" && e.Voucher.Status != "Cancelled")));

            if (scopedBranch.HasValue && scopedBranch.Value > 0)
            {
                query = query.Where(e => e.BranchId == scopedBranch.Value);
            }
            if (fromDate.HasValue)
            {
                query = query.Where(e => e.ExpenseDate.Date >= fromDate.Value.Date);
            }
            if (toDate.HasValue)
            {
                query = query.Where(e => e.ExpenseDate.Date <= toDate.Value.Date);
            }
            if (creditLedgerId.HasValue && creditLedgerId.Value > 0)
            {
                query = query.Where(e => e.CreditLedgerId == creditLedgerId.Value);
            }

            var rawExpenses = await query
                .OrderByDescending(e => e.ExpenseDate)
                .ThenByDescending(e => e.VoucherId)
                .ThenBy(e => e.ExpenseId)
                .ToListAsync();

            var crLedgerIds = rawExpenses
                .Where(e => e.CreditLedgerId.HasValue && e.CreditLedgerId.Value > 0)
                .Select(e => e.CreditLedgerId!.Value)
                .Distinct()
                .ToList();

            var ledgerNames = crLedgerIds.Any()
                ? await _context.Ledgers
                    .AsNoTracking()
                    .Where(l => crLedgerIds.Contains(l.LedgerID))
                    .ToDictionaryAsync(l => l.LedgerID, l => l.LedgerName)
                : new Dictionary<int, string>();

            var batches = rawExpenses
                .GroupBy(e => e.VoucherId!.Value)
                .Select(g =>
                {
                    var first = g.First();
                    int crId = first.CreditLedgerId ?? 0;
                    string incName = (crId > 0 && ledgerNames.TryGetValue(crId, out var lName) && !string.IsNullOrWhiteSpace(lName))
                        ? lName
                        : (first.PaidTo ?? "");

                    var items = g.Select(x =>
                    {
                        var cust = x.Customer ?? x.LoanAccount?.Customer ?? x.LoanAccount?.Member?.Customer;
                        return new
                        {
                            x.ExpenseId,
                            x.LoanAccountId,
                            LoanAccountNo = x.LoanAccount?.LoanAccountNo ?? "",
                            LegacyAccountNumber = x.LoanAccount?.LegacyAccountNumber,
                            CustomerID = x.CustomerId ?? LegalRecoveryTrackerHelper.ResolveLoanCustomerId(x.LoanAccount),
                            CifNo = cust?.CIFNo ?? "",
                            LegacyCustomerNo = cust?.LegacyCustomerNo,
                            CustomerName = LegalRecoveryTrackerHelper.FormatCustomerName(cust),
                            LoanType = !string.IsNullOrWhiteSpace(x.LoanAccount?.LoanRate?.ShortName)
                                ? x.LoanAccount!.LoanRate!.ShortName!.Trim()
                                : (x.LoanAccount?.LoanRate?.LoanType ?? ""),
                            x.Amount,
                            x.IsPrincipalApplied
                        };
                    }).ToList();

                    return new
                    {
                        VoucherId = g.Key,
                        VoucherNo = first.Voucher?.VoucherNo ?? "",
                        ExpenseDate = first.ExpenseDate.ToString("yyyy-MM-dd"),
                        VoucherStatus = first.Voucher?.Status ?? "Pending",
                        IsPrincipalApplied = g.All(x => x.IsPrincipalApplied),
                        CreditLedgerId = first.CreditLedgerId,
                        IncomeLedgerName = incName,
                        AccountCount = items.Count,
                        TotalAmount = g.Sum(x => x.Amount),
                        Narration = first.Voucher?.Narration ?? first.Remarks ?? "",
                        Items = items
                    };
                })
                .ToList();

            return Ok(batches);
        }
    }
}
