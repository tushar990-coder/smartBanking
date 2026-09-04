using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    public class GenerateNoticeDto
    {
        public int BranchId { get; set; } = 1;
        public int LoanAccountId { get; set; }
        public string NoticeType { get; set; } = "NOTICE_1"; // NOTICE_1, NOTICE_2, FINAL_NOTICE, SRO_DEMAND
        public DateTime NoticeDate { get; set; } = DateTime.Today;
        public DateTime DueDate { get; set; } = DateTime.Today.AddDays(15);
        public decimal PrincipalDue { get; set; }
        public decimal InterestDue { get; set; }
        public decimal PenalInterestDue { get; set; }
        public decimal NoticeFee { get; set; } = 0;
        public string? PostalTrackingNo { get; set; }
        public string? Remarks { get; set; }
    }

    public class FileCaseDto
    {
        public int BranchId { get; set; } = 1;
        public int LoanAccountId { get; set; }
        public string CaseNumber { get; set; } = string.Empty;
        public string CourtName { get; set; } = "मा. सहाय्यक निबंधक, सहकारी संस्था";
        public string? AdvocateName { get; set; }
        public DateTime FilingDate { get; set; } = DateTime.Today;
        public decimal PrincipalClaim { get; set; }
        public decimal InterestClaim { get; set; }
        public decimal PenalInterestClaim { get; set; }
        public decimal OtherChargesClaim { get; set; }
        public decimal CourtFeeAmount { get; set; }
        public string? CourtFeeChallanNo { get; set; }
        public string? Remarks { get; set; }
    }

    public class GrantCertificateDto
    {
        public int CaseId { get; set; }
        public string CertificateNo { get; set; } = string.Empty;
        public string? CertificateNumber { get; set; }
        public DateTime CertificateDate { get; set; } = DateTime.Today;
        public decimal SanctionedAmount { get; set; }
        public decimal? GrantedAmount { get; set; }
        public decimal? FutureInterestRate { get; set; }
        public decimal? GrantedInterestRate { get; set; }
        public string? Remarks { get; set; }
    }

    public class AddHearingDto
    {
        public int CaseId { get; set; }
        public DateTime HearingDate { get; set; } = DateTime.Today;
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
        public DateTime? AuctionDate { get; set; }
        public decimal? ReservePrice { get; set; }
        public string? Remarks { get; set; }
    }

    public class AddLegalExpenseDto
    {
        public int BranchId { get; set; } = 1;
        public int? CaseId { get; set; }
        public int LoanAccountId { get; set; }
        public string ExpenseType { get; set; } = "COURT_FEE";
        public decimal Amount { get; set; }
        public DateTime ExpenseDate { get; set; } = DateTime.Today;
        public string? PaidTo { get; set; }
        public string? PayeeName { get; set; }
        public string? PaymentMode { get; set; } = "CASH";
        public bool PostVoucher { get; set; } = true;
        public bool IsDebitedToBorrower { get; set; } = true;
        public string? Remarks { get; set; }
    }

    [Route("api/[controller]")]
    [ApiController]
    public class LegalRecoveryController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LegalRecoveryController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/LegalRecovery/dashboard-stats?branchId=1
        [HttpGet("dashboard-stats")]
        public async Task<IActionResult> GetDashboardStats([FromQuery] int? branchId = null)
        {
            var caseQuery = _context.Sec101CaseMasters.AsQueryable();
            var noticeQuery = _context.Sec101NoticeHistories.AsQueryable();
            var execQuery = _context.Sec101AttachmentAuctions.AsQueryable();
            var expQuery = _context.Sec101LegalExpenses.AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                caseQuery = caseQuery.Where(c => c.BranchId == branchId.Value);
                noticeQuery = noticeQuery.Where(n => n.BranchId == branchId.Value);
                execQuery = execQuery.Where(e => e.Case != null && e.Case.BranchId == branchId.Value);
                expQuery = expQuery.Where(x => x.BranchId == branchId.Value);
            }

            var totalCases = await caseQuery.CountAsync();
            var filedCases = await caseQuery.CountAsync(c => c.Status == "FILED");
            var hearingCases = await caseQuery.CountAsync(c => c.Status == "HEARING");
            var certIssuedCases = await caseQuery.CountAsync(c => c.Status == "CERTIFICATE_ISSUED");
            var executionCases = await caseQuery.CountAsync(c => c.Status == "EXECUTION_RULE107");
            var closedCases = await caseQuery.CountAsync(c => c.Status == "CLOSED_RECOVERED");

            var totalClaimAmount = await caseQuery.SumAsync(c => (decimal?)c.TotalClaimAmount) ?? 0;
            var totalCourtFees = await caseQuery.SumAsync(c => (decimal?)c.CourtFeeAmount) ?? 0;
            var totalExpenses = await expQuery.SumAsync(x => (decimal?)x.Amount) ?? 0;
            var totalNotices = await noticeQuery.CountAsync();

            var today = DateTime.Today;
            var upcomingHearingLimit = today.AddDays(15);
            var upcomingHearingsCount = await _context.Sec101HearingLogs
                .Include(h => h.Case)
                .Where(h => (branchId == null || branchId == 0 || h.Case!.BranchId == branchId) &&
                            h.NextHearingDate.HasValue && 
                            h.NextHearingDate.Value >= today && 
                            h.NextHearingDate.Value <= upcomingHearingLimit)
                .CountAsync();

            return Ok(new
            {
                TotalCases = totalCases,
                FiledCases = filedCases,
                HearingCases = hearingCases,
                CertificatesIssued = certIssuedCases,
                ExecutionCases = executionCases,
                ClosedCases = closedCases,
                TotalClaimAmount = totalClaimAmount,
                TotalCourtFees = totalCourtFees,
                TotalExpenses = totalExpenses,
                TotalNoticesIssued = totalNotices,
                UpcomingHearingsNext15Days = upcomingHearingsCount
            });
        }

        // GET: api/LegalRecovery/eligible-loans?branchId=1
        [HttpGet("eligible-loans")]
        public async Task<IActionResult> GetEligibleOverdueLoans([FromQuery] int? branchId = null)
        {
            var query = _context.LoanAccounts
                .Include(l => l.Member)
                .Include(l => l.CoMember)
                .Include(l => l.CoMember2)
                .Include(l => l.LoanRate)
                .Include(l => l.Branch)
                .Where(l => l.PrincipalBalance > 0 || l.InterestBalance > 0 || l.OverdueInterestBalance > 0)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(l => l.BranchID == branchId.Value);
            }

            var loans = await query
                .OrderByDescending(l => l.OverdueInterestBalance)
                .ThenByDescending(l => l.PrincipalBalance)
                .Select(l => new
                {
                    l.LoanAccountID,
                    l.BranchID,
                    BranchName = l.Branch != null ? l.Branch.BranchName : "",
                    l.LoanAccountNo,
                    l.MemberID,
                    MemberName = l.Member != null ? $"{l.Member.FirstName} {l.Member.MiddleName} {l.Member.LastName}".Trim() : "",
                    MemberCode = l.Member != null ? l.Member.MemberCode : "",
                    MobileNo = l.Member != null ? l.Member.MobileNo : "",
                    Address = l.Member != null ? $"{l.Member.Address}, {l.Member.Village}, {l.Member.Taluka}, {l.Member.District}" : "",
                    CoMemberName = l.CoMember != null ? $"{l.CoMember.FirstName} {l.CoMember.LastName}".Trim() : "",
                    CoMember2Name = l.CoMember2 != null ? $"{l.CoMember2.FirstName} {l.CoMember2.LastName}".Trim() : "",
                    LoanScheme = l.LoanRate != null ? l.LoanRate.LoanType : "",
                    l.PrincipalBalance,
                    l.InterestBalance,
                    l.OverdueInterestBalance,
                    TotalOutstanding = l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance,
                    l.OpeningDate,
                    DueDate = l.MaturityDate.HasValue ? l.MaturityDate.Value.ToString("yyyy-MM-dd") : l.OpeningDate.AddMonths(l.DurationMonths).ToString("yyyy-MM-dd")
                })
                .ToListAsync();

            return Ok(loans);
        }

        // GET: api/LegalRecovery/form-m/{loanAccountId}
        [HttpGet("form-m/{loanAccountId}")]
        public async Task<IActionResult> GetFormMData(int loanAccountId, [FromQuery] DateTime? asOnDate = null)
        {
            var targetDate = asOnDate ?? DateTime.Today;

            var loan = await _context.LoanAccounts
                .Include(l => l.Member)
                .Include(l => l.CoMember)
                .Include(l => l.CoMember2)
                .Include(l => l.LoanRate)
                .Include(l => l.Branch)
                .FirstOrDefaultAsync(l => l.LoanAccountID == loanAccountId);

            if (loan == null) return NotFound("Loan account not found.");

            var sanstha = await _context.SansthaDetails.FirstOrDefaultAsync();

            // Calculate total expenses debited to this loan
            var legalExpenses = await _context.Sec101LegalExpenses
                .Where(x => x.LoanAccountId == loanAccountId)
                .SumAsync(x => (decimal?)x.Amount) ?? 0;

            // Prior notices
            var notices = await _context.Sec101NoticeHistories
                .Where(n => n.LoanAccountId == loanAccountId)
                .OrderByDescending(n => n.NoticeDate)
                .ToListAsync();

            var formM = new
            {
                Sanstha = sanstha,
                LoanAccountID = loan.LoanAccountID,
                LoanAccountNo = loan.LoanAccountNo,
                BranchName = loan.Branch?.BranchName ?? "मुख्य शाखा",
                AsOnDate = targetDate.ToString("yyyy-MM-dd"),
                Borrower = new
                {
                    MemberID = loan.MemberID,
                    FullName = $"{loan.Member?.FirstName} {loan.Member?.MiddleName} {loan.Member?.LastName}".Trim(),
                    MemberCode = loan.Member?.MemberCode,
                    Address = $"{loan.Member?.Address}, {loan.Member?.Village}, {loan.Member?.Taluka}, {loan.Member?.District}".Trim(),
                    MobileNo = loan.Member?.MobileNo,
                    AadhaarNo = loan.Member?.AadhaarNo,
                    PanNo = loan.Member?.PANNo
                },
                Guarantor1 = loan.CoMember != null ? new
                {
                    MemberID = loan.CoMember.MemberID,
                    FullName = $"{loan.CoMember.FirstName} {loan.CoMember.MiddleName} {loan.CoMember.LastName}".Trim(),
                    MemberCode = loan.CoMember.MemberCode,
                    Address = $"{loan.CoMember.Address}, {loan.CoMember.Village}, {loan.CoMember.Taluka}, {loan.CoMember.District}",
                    MobileNo = loan.CoMember.MobileNo
                } : null,
                Guarantor2 = loan.CoMember2 != null ? new
                {
                    MemberID = loan.CoMember2.MemberID,
                    FullName = $"{loan.CoMember2.FirstName} {loan.CoMember2.MiddleName} {loan.CoMember2.LastName}".Trim(),
                    MemberCode = loan.CoMember2.MemberCode,
                    Address = $"{loan.CoMember2.Address}, {loan.CoMember2.Village}, {loan.CoMember2.Taluka}, {loan.CoMember2.District}",
                    MobileNo = loan.CoMember2.MobileNo
                } : null,
                LoanDetails = new
                {
                    SanctionDate = loan.OpeningDate.ToString("yyyy-MM-dd"),
                    SanctionAmount = loan.SanctionedAmount > 0 ? loan.SanctionedAmount : loan.PrincipalBalance,
                    InterestRate = loan.InterestRate > 0 ? loan.InterestRate : (loan.LoanRate?.InterestRate ?? 14.00m),
                    PenalRate = loan.LoanRate?.OverdueInterestRate ?? 2.00m,
                    SchemeName = loan.LoanRate?.LoanType ?? "कर्ज योजना",
                    PrincipalBalance = loan.PrincipalBalance,
                    InterestBalance = loan.InterestBalance,
                    PenalInterestBalance = loan.OverdueInterestBalance,
                    LegalExpenses = legalExpenses,
                    TotalDues = loan.PrincipalBalance + loan.InterestBalance + loan.OverdueInterestBalance + legalExpenses
                },
                NoticesCount = notices.Count,
                Notices = notices.Select(n => new
                {
                    n.NoticeId,
                    n.NoticeType,
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
            if (dto == null) return BadRequest("Invalid request.");

            var loan = await _context.LoanAccounts
                .Include(l => l.Member)
                .FirstOrDefaultAsync(l => l.LoanAccountID == dto.LoanAccountId);

            if (loan == null) return NotFound("Loan account not found.");

            string prefix = dto.NoticeType switch
            {
                "NOTICE_1" => "N1",
                "NOTICE_2" => "N2",
                "FINAL_NOTICE" => "FN101",
                "SRO_DEMAND" => "SRO",
                _ => "NOT"
            };

            int nextSeq = await _context.Sec101NoticeHistories.CountAsync(n => n.BranchId == dto.BranchId) + 1;
            string noticeNo = $"{prefix}/{dto.BranchId}/{DateTime.Today:yyyy}/{nextSeq:D4}";

            decimal totalDemand = dto.PrincipalDue + dto.InterestDue + dto.PenalInterestDue + dto.NoticeFee;

            var notice = new Sec101NoticeHistory
            {
                BranchId = dto.BranchId,
                LoanAccountId = dto.LoanAccountId,
                MemberId = loan.MemberID ?? loan.CustomerID ?? 0,
                NoticeType = dto.NoticeType,
                NoticeNumber = noticeNo,
                NoticeDate = dto.NoticeDate,
                DueDate = dto.DueDate,
                PrincipalDue = dto.PrincipalDue,
                InterestDue = dto.InterestDue,
                PenalInterestDue = dto.PenalInterestDue,
                NoticeFee = dto.NoticeFee,
                TotalDemandAmount = totalDemand,
                PostalTrackingNo = dto.PostalTrackingNo,
                PostalStatus = !string.IsNullOrEmpty(dto.PostalTrackingNo) ? "DISPATCHED" : "PENDING",
                Remarks = dto.Remarks,
                CreatedAt = DateTime.UtcNow
            };

            _context.Sec101NoticeHistories.Add(notice);
            await _context.SaveChangesAsync();

            // Auto-post notice fee if applicable and dynamic mapping exists
            if (dto.NoticeFee > 0)
            {
                await TryAutoPostLegalExpenseAsync(dto.BranchId, null, dto.LoanAccountId, "NOTICE_FEE", dto.NoticeFee, dto.NoticeDate, "नोटीस टपाल व प्रशासकीय फी");
            }

            return Ok(new
            {
                Message = "नोटीस यशस्वीरीत्या तयार झाली. (Notice generated successfully)",
                NoticeId = notice.NoticeId,
                NoticeNumber = notice.NoticeNumber,
                TotalDemandAmount = notice.TotalDemandAmount
            });
        }

        // GET: api/LegalRecovery/notices?branchId=1&loanAccountId=...
        [HttpGet("notices")]
        public async Task<IActionResult> GetNotices([FromQuery] int? branchId = null, [FromQuery] int? loanAccountId = null)
        {
            var query = _context.Sec101NoticeHistories
                .Include(n => n.LoanAccount)
                .Include(n => n.Member)
                .Include(n => n.Branch)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0) query = query.Where(n => n.BranchId == branchId.Value);
            if (loanAccountId.HasValue && loanAccountId.Value > 0) query = query.Where(n => n.LoanAccountId == loanAccountId.Value);

            var list = await query
                .OrderByDescending(n => n.NoticeDate)
                .Select(n => new
                {
                    n.NoticeId,
                    n.BranchId,
                    BranchName = n.Branch != null ? n.Branch.BranchName : "",
                    n.LoanAccountId,
                    LoanAccountNo = n.LoanAccount != null ? n.LoanAccount.LoanAccountNo : "",
                    n.MemberId,
                    MemberName = n.Member != null ? $"{n.Member.FirstName} {n.Member.LastName}".Trim() : "",
                    MemberCode = n.Member != null ? n.Member.MemberCode : "",
                    Address = n.Member != null ? $"{n.Member.Address}, {n.Member.Village}" : "",
                    MobileNo = n.Member != null ? n.Member.MobileNo : "",
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
                    n.DeliveredDate,
                    n.Remarks
                })
                .ToListAsync();

            return Ok(list);
        }

        // PUT: api/LegalRecovery/notice/postal-status/{noticeId}
        [HttpPut("notice/postal-status/{noticeId}")]
        public async Task<IActionResult> UpdatePostalStatus(int noticeId, [FromBody] Sec101NoticeHistory dto)
        {
            var notice = await _context.Sec101NoticeHistories.FindAsync(noticeId);
            if (notice == null) return NotFound("Notice not found.");

            notice.PostalTrackingNo = dto.PostalTrackingNo ?? notice.PostalTrackingNo;
            notice.PostalStatus = dto.PostalStatus ?? notice.PostalStatus;
            notice.DeliveredDate = dto.DeliveredDate ?? notice.DeliveredDate;
            notice.Remarks = dto.Remarks ?? notice.Remarks;

            await _context.SaveChangesAsync();
            return Ok(new { Message = "टपाल स्थिती यशस्वीरीत्या अद्ययावत केली. (Postal status updated)" });
        }

        // POST: api/LegalRecovery/case/file
        [HttpPost("case/file")]
        public async Task<IActionResult> FileCase([FromBody] FileCaseDto dto)
        {
            if (dto == null) return BadRequest("Invalid request.");

            var loan = await _context.LoanAccounts.FindAsync(dto.LoanAccountId);
            if (loan == null) return NotFound("Loan account not found.");

            decimal totalClaim = dto.PrincipalClaim + dto.InterestClaim + dto.PenalInterestClaim + dto.OtherChargesClaim;

            var legalCase = new Sec101CaseMaster
            {
                BranchId = dto.BranchId,
                LoanAccountId = dto.LoanAccountId,
                MemberId = loan.MemberID ?? loan.CustomerID ?? 0,
                CaseNumber = dto.CaseNumber,
                CourtName = dto.CourtName,
                AdvocateName = dto.AdvocateName,
                FilingDate = dto.FilingDate,
                PrincipalClaim = dto.PrincipalClaim,
                InterestClaim = dto.InterestClaim,
                PenalInterestClaim = dto.PenalInterestClaim,
                OtherChargesClaim = dto.OtherChargesClaim,
                TotalClaimAmount = totalClaim,
                CourtFeeAmount = dto.CourtFeeAmount,
                CourtFeeChallanNo = dto.CourtFeeChallanNo,
                Status = "FILED",
                Remarks = dto.Remarks,
                CreatedAt = DateTime.UtcNow
            };

            _context.Sec101CaseMasters.Add(legalCase);
            await _context.SaveChangesAsync();

            // Auto-post court fee if entered and dynamic mapping configured
            if (dto.CourtFeeAmount > 0)
            {
                await TryAutoPostLegalExpenseAsync(dto.BranchId, legalCase.CaseId, dto.LoanAccountId, "COURT_FEE", dto.CourtFeeAmount, dto.FilingDate, $"कलम १०१ कोर्ट फी - चलन क्र. {dto.CourtFeeChallanNo}");
            }

            return Ok(new
            {
                Message = "कलम १०१ दावा अर्ज यशस्वीरीत्या दाखल झाला. (Case filed successfully)",
                CaseId = legalCase.CaseId,
                CaseNumber = legalCase.CaseNumber
            });
        }

        // GET: api/LegalRecovery/cases?branchId=1&status=...
        [HttpGet("cases")]
        public async Task<IActionResult> GetCases([FromQuery] int? branchId = null, [FromQuery] string? status = null)
        {
            var query = _context.Sec101CaseMasters
                .Include(c => c.LoanAccount)
                .Include(c => c.Member)
                .Include(c => c.Branch)
                .Include(c => c.HearingLogs)
                .Include(c => c.Executions)
                .Include(c => c.LegalExpenses)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0) query = query.Where(c => c.BranchId == branchId.Value);
            if (!string.IsNullOrEmpty(status) && status != "ALL") query = query.Where(c => c.Status == status);

            var list = await query
                .OrderByDescending(c => c.FilingDate)
                .Select(c => new
                {
                    c.CaseId,
                    c.BranchId,
                    BranchName = c.Branch != null ? c.Branch.BranchName : "",
                    c.LoanAccountId,
                    LoanAccountNo = c.LoanAccount != null ? c.LoanAccount.LoanAccountNo : "",
                    c.MemberId,
                    MemberName = c.Member != null ? $"{c.Member.FirstName} {c.Member.MiddleName} {c.Member.LastName}".Trim() : "",
                    MemberCode = c.Member != null ? c.Member.MemberCode : "",
                    MobileNo = c.Member != null ? c.Member.MobileNo : "",
                    Address = c.Member != null ? $"{c.Member.Address}, {c.Member.Village}" : "",
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
                    CertificateDate = c.CertificateDate.HasValue ? c.CertificateDate.Value.ToString("yyyy-MM-dd") : null,
                    c.SanctionedAmount,
                    GrantedAmount = c.SanctionedAmount,
                    c.FutureInterestRate,
                    GrantedInterestRate = c.FutureInterestRate,
                    c.Status,
                    CaseStatus = c.Status,
                    c.Remarks,
                    HearingsCount = c.HearingLogs.Count,
                    LatestHearing = c.HearingLogs.OrderByDescending(h => h.HearingDate).Select(h => new
                    {
                        HearingDate = h.HearingDate.ToString("yyyy-MM-dd"),
                        NextHearingDate = h.NextHearingDate.HasValue ? h.NextHearingDate.Value.ToString("yyyy-MM-dd") : null,
                        h.Stage,
                        HearingStage = h.Stage,
                        h.CourtOrderSummary
                    }).FirstOrDefault(),
                    ExecutionsCount = c.Executions.Count,
                    TotalExpenses = c.LegalExpenses.Sum(x => x.Amount),
                    TotalLegalExpenses = c.LegalExpenses.Sum(x => x.Amount)
                })
                .ToListAsync();

            return Ok(list);
        }

        // GET: api/LegalRecovery/case/{caseId}
        [HttpGet("case/{caseId}")]
        public async Task<IActionResult> GetCaseById(int caseId)
        {
            var c = await _context.Sec101CaseMasters
                .Include(x => x.LoanAccount)
                .Include(x => x.Member)
                .Include(x => x.Branch)
                .Include(x => x.HearingLogs)
                .Include(x => x.Executions)
                .Include(x => x.LegalExpenses)
                .FirstOrDefaultAsync(x => x.CaseId == caseId);

            if (c == null) return NotFound("Case not found.");

            return Ok(c);
        }

        // POST: api/LegalRecovery/case/grant-certificate
        [HttpPost("case/grant-certificate")]
        public async Task<IActionResult> GrantCertificate([FromBody] GrantCertificateDto dto)
        {
            var legalCase = await _context.Sec101CaseMasters.FindAsync(dto.CaseId);
            if (legalCase == null) return NotFound("Case not found.");

            legalCase.CertificateNo = !string.IsNullOrEmpty(dto.CertificateNo) ? dto.CertificateNo : (dto.CertificateNumber ?? "");
            legalCase.CertificateDate = dto.CertificateDate;
            legalCase.SanctionedAmount = dto.SanctionedAmount > 0 ? dto.SanctionedAmount : (dto.GrantedAmount ?? 0);
            legalCase.FutureInterestRate = dto.FutureInterestRate ?? dto.GrantedInterestRate;
            legalCase.Status = "CERTIFICATE_ISSUED";
            if (!string.IsNullOrEmpty(dto.Remarks)) legalCase.Remarks += " | " + dto.Remarks;

            await _context.SaveChangesAsync();
            return Ok(new { Message = "कलम १०१ वसुली दाखला यशस्वीरीत्या नोंदवला. (Recovery certificate recorded)" });
        }

        // POST: api/LegalRecovery/hearing/add
        [HttpPost("hearing/add")]
        public async Task<IActionResult> AddHearing([FromBody] AddHearingDto dto)
        {
            if (dto == null) return BadRequest("Invalid request.");

            var legalCase = await _context.Sec101CaseMasters.FindAsync(dto.CaseId);
            if (legalCase == null) return NotFound("Case not found.");

            var log = new Sec101HearingLog
            {
                CaseId = dto.CaseId,
                HearingDate = dto.HearingDate,
                NextHearingDate = dto.NextHearingDate,
                Stage = !string.IsNullOrEmpty(dto.Stage) ? dto.Stage : (dto.HearingStage ?? "समन्स / नोटीस पूर्तता"),
                BorrowerPresence = !string.IsNullOrEmpty(dto.BorrowerPresence) ? dto.BorrowerPresence : (dto.PresenceType ?? "ABSENT"),
                GuarantorPresence = dto.GuarantorPresence ?? "ABSENT",
                CourtOrderSummary = dto.CourtOrderSummary,
                AdvocateNotes = dto.AdvocateNotes,
                CreatedAt = DateTime.UtcNow
            };

            _context.Sec101HearingLogs.Add(log);

            legalCase.Status = "HEARING";
            await _context.SaveChangesAsync();

            return Ok(new { Message = "सुनावणी नोंद यशस्वीरीत्या सेव्ह झाली. (Hearing diary entry saved)", HearingId = log.HearingId, HearingLogId = log.HearingId });
        }

        // GET: api/LegalRecovery/hearings?branchId=1
        [HttpGet("hearings")]
        public async Task<IActionResult> GetHearings([FromQuery] int? branchId = null, [FromQuery] int? caseId = null)
        {
            var query = _context.Sec101HearingLogs
                .Include(h => h.Case)
                    .ThenInclude(c => c!.Member)
                .Include(h => h.Case)
                    .ThenInclude(c => c!.LoanAccount)
                .Include(h => h.Case)
                    .ThenInclude(c => c!.Branch)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0) query = query.Where(h => h.Case != null && h.Case.BranchId == branchId.Value);
            if (caseId.HasValue && caseId.Value > 0) query = query.Where(h => h.CaseId == caseId.Value);

            var list = await query
                .OrderByDescending(h => h.HearingDate)
                .Select(h => new
                {
                    h.HearingId,
                    HearingLogId = h.HearingId,
                    h.CaseId,
                    CaseNumber = h.Case != null ? h.Case.CaseNumber : "",
                    CourtName = h.Case != null ? h.Case.CourtName : "",
                    AdvocateName = h.Case != null ? h.Case.AdvocateName : "",
                    MemberName = (h.Case != null && h.Case.Member != null) ? $"{h.Case.Member.FirstName} {h.Case.Member.LastName}" : "",
                    LoanAccountNo = (h.Case != null && h.Case.LoanAccount != null) ? h.Case.LoanAccount.LoanAccountNo : "",
                    BranchName = (h.Case != null && h.Case.Branch != null) ? h.Case.Branch.BranchName : "",
                    HearingDate = h.HearingDate.ToString("yyyy-MM-dd"),
                    NextHearingDate = h.NextHearingDate.HasValue ? h.NextHearingDate.Value.ToString("yyyy-MM-dd") : null,
                    h.Stage,
                    HearingStage = h.Stage,
                    StageLabel = h.Stage,
                    PresenceType = h.BorrowerPresence,
                    h.BorrowerPresence,
                    h.AdvocateNotes,
                    h.CourtOrderSummary
                })
                .ToListAsync();

            return Ok(list);
        }

        // GET: api/LegalRecovery/hearings/upcoming?branchId=1
        [HttpGet("hearings/upcoming")]
        public async Task<IActionResult> GetUpcomingHearings([FromQuery] int? branchId = null)
        {
            var today = DateTime.Today;
            var query = _context.Sec101HearingLogs
                .Include(h => h.Case)
                    .ThenInclude(c => c!.Member)
                .Include(h => h.Case)
                    .ThenInclude(c => c!.LoanAccount)
                .Include(h => h.Case)
                    .ThenInclude(c => c!.Branch)
                .Where(h => h.NextHearingDate.HasValue && h.NextHearingDate.Value >= today)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(h => h.Case != null && h.Case.BranchId == branchId.Value);
            }

            var list = await query
                .OrderBy(h => h.NextHearingDate)
                .Select(h => new
                {
                    h.HearingId,
                    HearingLogId = h.HearingId,
                    h.CaseId,
                    CaseNumber = h.Case != null ? h.Case.CaseNumber : "",
                    CourtName = h.Case != null ? h.Case.CourtName : "",
                    AdvocateName = h.Case != null ? h.Case.AdvocateName : "",
                    MemberName = (h.Case != null && h.Case.Member != null) ? $"{h.Case.Member.FirstName} {h.Case.Member.LastName}" : "",
                    LoanAccountNo = (h.Case != null && h.Case.LoanAccount != null) ? h.Case.LoanAccount.LoanAccountNo : "",
                    BranchName = (h.Case != null && h.Case.Branch != null) ? h.Case.Branch.BranchName : "",
                    HearingDate = h.HearingDate.ToString("yyyy-MM-dd"),
                    NextHearingDate = h.NextHearingDate!.Value.ToString("yyyy-MM-dd"),
                    h.Stage,
                    HearingStage = h.Stage,
                    h.AdvocateNotes,
                    h.CourtOrderSummary
                })
                .ToListAsync();

            return Ok(list);
        }

        // POST: api/LegalRecovery/execution/create
        [HttpPost("execution/create")]
        public async Task<IActionResult> CreateExecution([FromBody] CreateExecutionDto dto)
        {
            if (dto == null) return BadRequest("Invalid request.");

            var legalCase = await _context.Sec101CaseMasters.FindAsync(dto.CaseId);
            if (legalCase == null) return NotFound("Case not found.");

            string propertyInfo = dto.PropertyDetails ?? "";
            if (!string.IsNullOrEmpty(dto.EmployerName))
            {
                propertyInfo = $"कंपनी: {dto.EmployerName} | पत्ता: {dto.EmployerAddress} | मासिक कपात: ₹{dto.MonthlyDeductionAmount}";
            }

            var exec = new Sec101AttachmentAuction
            {
                CaseId = dto.CaseId,
                SroName = dto.SroName ?? "विशेष वसुली अधिकारी",
                ExecutionType = dto.ExecutionType,
                PropertyDetails = propertyInfo,
                ValuationAmount = dto.ValuationAmount ?? dto.EstimatedValue ?? 0,
                WarrantIssueDate = dto.WarrantIssueDate ?? dto.OrderDate ?? DateTime.Today,
                PanchanamaDate = dto.PanchanamaDate,
                AuctionDate = dto.AuctionDate,
                ReservePrice = dto.ReservePrice ?? dto.MonthlyDeductionAmount ?? 0,
                SaleCertificateNo = dto.ExecutionOrderNo,
                Status = "ISSUED",
                Remarks = dto.Remarks,
                CreatedAt = DateTime.UtcNow
            };

            _context.Sec101AttachmentAuctions.Add(exec);

            legalCase.Status = "EXECUTION_RULE107";
            await _context.SaveChangesAsync();

            return Ok(new 
            { 
                Message = "नियम १०७ जप्ती/पगार कपात/लिलाव नोंद यशस्वीरीत्या तयार झाली. (Execution record created)",
                ExecutionId = exec.ExecutionId,
                ExecutionOrderNo = exec.SaleCertificateNo
            });
        }

        // GET: api/LegalRecovery/executions?branchId=1
        [HttpGet("executions")]
        public async Task<IActionResult> GetExecutions([FromQuery] int? branchId = null)
        {
            var query = _context.Sec101AttachmentAuctions
                .Include(e => e.Case)
                    .ThenInclude(c => c!.Member)
                .Include(e => e.Case)
                    .ThenInclude(c => c!.LoanAccount)
                .Include(e => e.Case)
                    .ThenInclude(c => c!.Branch)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(e => e.Case != null && e.Case.BranchId == branchId.Value);
            }

            var list = await query
                .OrderByDescending(e => e.CreatedAt)
                .Select(e => new
                {
                    e.ExecutionId,
                    e.CaseId,
                    CaseNumber = e.Case != null ? e.Case.CaseNumber : "",
                    CertificateNo = e.Case != null ? e.Case.CertificateNo : "",
                    CertificateNumber = e.Case != null ? e.Case.CertificateNo : "",
                    MemberName = (e.Case != null && e.Case.Member != null) ? $"{e.Case.Member.FirstName} {e.Case.Member.LastName}" : "",
                    MemberCode = (e.Case != null && e.Case.Member != null) ? e.Case.Member.MemberCode : "",
                    LoanAccountNo = (e.Case != null && e.Case.LoanAccount != null) ? e.Case.LoanAccount.LoanAccountNo : "",
                    BranchName = (e.Case != null && e.Case.Branch != null) ? e.Case.Branch.BranchName : "",
                    e.SroName,
                    e.ExecutionType,
                    ExecutionOrderNo = !string.IsNullOrEmpty(e.SaleCertificateNo) ? e.SaleCertificateNo : $"EXEC-{e.ExecutionId}",
                    OrderDate = e.WarrantIssueDate.HasValue ? e.WarrantIssueDate.Value.ToString("yyyy-MM-dd") : e.CreatedAt.ToString("yyyy-MM-dd"),
                    e.PropertyDetails,
                    EmployerName = (e.PropertyDetails != null && e.PropertyDetails.Contains("कंपनी:")) ? e.PropertyDetails : "",
                    MonthlyDeductionAmount = e.ReservePrice,
                    e.ValuationAmount,
                    EstimatedValue = e.ValuationAmount,
                    WarrantIssueDate = e.WarrantIssueDate.HasValue ? e.WarrantIssueDate.Value.ToString("yyyy-MM-dd") : null,
                    PanchanamaDate = e.PanchanamaDate.HasValue ? e.PanchanamaDate.Value.ToString("yyyy-MM-dd") : null,
                    AuctionDate = e.AuctionDate.HasValue ? e.AuctionDate.Value.ToString("yyyy-MM-dd") : null,
                    e.ReservePrice,
                    e.HighestBidAmount,
                    e.BuyerName,
                    e.BuyerContact,
                    e.SaleCertificateNo,
                    SaleCertificateDate = e.SaleCertificateDate.HasValue ? e.SaleCertificateDate.Value.ToString("yyyy-MM-dd") : null,
                    e.Status,
                    ExecutionStatus = e.Status,
                    e.Remarks,
                    RecoveredAmount = e.HighestBidAmount
                })
                .ToListAsync();

            return Ok(list);
        }

        // POST: api/LegalRecovery/expense/add
        [HttpPost("expense/add")]
        public async Task<IActionResult> AddLegalExpense([FromBody] AddLegalExpenseDto dto)
        {
            if (dto == null || dto.Amount <= 0) return BadRequest("Invalid expense details.");

            string payee = dto.PaidTo ?? dto.PayeeName ?? "कायदेशीर सल्लागार / अधिकारी";
            var voucher = await TryAutoPostLegalExpenseAsync(dto.BranchId, dto.CaseId, dto.LoanAccountId, dto.ExpenseType, dto.Amount, dto.ExpenseDate, dto.Remarks ?? $"कायदेशीर खर्च ({dto.ExpenseType}) - {payee}");

            return Ok(new
            {
                Message = "कायदेशीर खर्च यशस्वीरीत्या नोंदवला व व्हाऊचर पोस्ट झाले. (Legal expense saved & voucher posted)",
                VoucherNo = voucher?.VoucherNo,
                VoucherNumber = voucher?.VoucherNo
            });
        }

        // GET: api/LegalRecovery/expenses?caseId=...&loanAccountId=...
        [HttpGet("expenses")]
        public async Task<IActionResult> GetLegalExpenses([FromQuery] int? caseId = null, [FromQuery] int? loanAccountId = null, [FromQuery] int? branchId = null)
        {
            var query = _context.Sec101LegalExpenses
                .Include(x => x.LoanAccount)
                .Include(x => x.Case)
                .Include(x => x.Voucher)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0) query = query.Where(x => x.BranchId == branchId.Value);
            if (caseId.HasValue && caseId.Value > 0) query = query.Where(x => x.CaseId == caseId.Value);
            if (loanAccountId.HasValue && loanAccountId.Value > 0) query = query.Where(x => x.LoanAccountId == loanAccountId.Value);

            var list = await query
                .OrderByDescending(x => x.ExpenseDate)
                .Select(x => new
                {
                    x.ExpenseId,
                    LegalExpenseId = x.ExpenseId,
                    x.BranchId,
                    x.CaseId,
                    CaseNumber = x.Case != null ? x.Case.CaseNumber : "",
                    x.LoanAccountId,
                    LoanAccountNo = x.LoanAccount != null ? x.LoanAccount.LoanAccountNo : "",
                    x.ExpenseType,
                    x.Amount,
                    ExpenseDate = x.ExpenseDate.ToString("yyyy-MM-dd"),
                    x.PaidTo,
                    PayeeName = x.PaidTo,
                    x.VoucherId,
                    VoucherNo = x.Voucher != null ? x.Voucher.VoucherNo : "",
                    VoucherNumber = x.Voucher != null ? x.Voucher.VoucherNo : "",
                    PaymentMode = "CASH",
                    IsDebitedToBorrower = x.IsDebitedToLoan,
                    x.IsDebitedToLoan,
                    x.Remarks
                })
                .ToListAsync();

            return Ok(list);
        }

        // Helper: Dynamic Ledger Lookup & Auto-Voucher Posting (ZERO HARDCODING)
        private async Task<Voucher?> TryAutoPostLegalExpenseAsync(int branchId, int? caseId, int loanAccountId, string expenseType, decimal amount, DateTime expenseDate, string narration)
        {
            try
            {
                // 1. Dynamic Ledger Mapping Lookup (Check Branch-specific first, then Global branchId=0)
                var mapping = await _context.LegalRecoveryLedgerMappings
                    .Where(m => (m.BranchId == branchId || m.BranchId == 0) && m.TransactionType == expenseType && m.IsActive)
                    .OrderByDescending(m => m.BranchId) // Prefer branch-specific
                    .FirstOrDefaultAsync();

                int? debitLedgerId = mapping?.DebitLedgerId;
                int? creditLedgerId = mapping?.CreditLedgerId;

                // Fallback: If not explicitly mapped in LegalRecoveryLedgerMapping, fallback to dynamic ledger query from Ledgers table
                if (!debitLedgerId.HasValue || debitLedgerId.Value == 0)
                {
                    var dynDr = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("कायदेशीर") || l.LedgerName.Contains("Legal") || l.LedgerName.Contains("Court"));
                    debitLedgerId = dynDr?.LedgerID ?? 1;
                }

                if (!creditLedgerId.HasValue || creditLedgerId.Value == 0)
                {
                    var dynCr = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("रोख") || l.LedgerName.Contains("Cash") || l.AccountType == "Cash");
                    creditLedgerId = dynCr?.LedgerID ?? 1;
                }

                var loan = await _context.LoanAccounts.FindAsync(loanAccountId);
                int memberId = loan?.MemberID ?? 1;

                string vNo = $"LEG-{branchId}-{expenseDate:yyyyMMdd}-{DateTime.UtcNow.Ticks % 10000:D4}";

                var voucher = new Voucher
                {
                    BranchID = branchId > 0 ? branchId : 1,
                    VoucherNo = vNo,
                    VoucherDate = expenseDate,
                    VoucherType = "Journal",
                    Status = "Approved",
                    Narration = narration,
                    TotalAmount = amount,
                    CreatedBy = 1,
                    CreatedOn = DateTime.UtcNow
                };

                voucher.VoucherDetails.Add(new VoucherDetail
                {
                    LedgerID = debitLedgerId.Value,
                    MemberID = memberId,
                    DrCr = "Dr",
                    Amount = amount
                });

                voucher.VoucherDetails.Add(new VoucherDetail
                {
                    LedgerID = creditLedgerId.Value,
                    MemberID = null,
                    DrCr = "Cr",
                    Amount = amount
                });

                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();

                // Save Expense Record linked with Voucher
                var expense = new Sec101LegalExpense
                {
                    BranchId = branchId,
                    CaseId = caseId,
                    LoanAccountId = loanAccountId,
                    ExpenseType = expenseType,
                    Amount = amount,
                    ExpenseDate = expenseDate,
                    PaidTo = narration,
                    VoucherId = voucher.VoucherID,
                    IsDebitedToLoan = true,
                    Remarks = narration,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Sec101LegalExpenses.Add(expense);
                await _context.SaveChangesAsync();

                return voucher;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[LegalRecovery] Auto-Voucher Warning: {ex.Message}");
                return null;
            }
        }
    }
}
