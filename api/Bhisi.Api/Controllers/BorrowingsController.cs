using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Bhisi.Api.Helpers;
using Bhisi.Api.Models;
using Bhisi.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class BorrowingsController : ControllerBase
    {
        private readonly AppDbContext _context;

        private static readonly HashSet<string> AllowedBorrowingTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "GOLD_REPLEDGE",
            "TERM_LOAN",
            "CASH_CREDIT_OD",
            "FD_AGAINST_LOAN"
        };

        public BorrowingsController(AppDbContext context)
        {
            _context = context;
        }

        private int ResolveUserId()
        {
            var val = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User?.FindFirst("UserID")?.Value;
            return int.TryParse(val, out int id) && id > 0 ? id : 1;
        }

        private async Task<DateTime> ResolveBranchBusinessDateAsync(int branchId, DateTime? explicitDate = null)
        {
            if (explicitDate.HasValue && explicitDate.Value != default)
                return explicitDate.Value.Date;

            var claimDate = User?.FindFirst("BusinessDate")?.Value;
            if (!string.IsNullOrWhiteSpace(claimDate) && DateTime.TryParse(claimDate, out var parsedClaim))
                return parsedClaim.Date;

            var openDay = await _context.BranchDayEndStatuses
                .AsNoTracking()
                .Where(b => b.BranchID == (branchId > 0 ? branchId : 1) && !b.IsDayClosed)
                .OrderByDescending(b => b.BusinessDate)
                .FirstOrDefaultAsync();
            if (openDay != null)
                return openDay.BusinessDate.Date;

            return DateTime.Today;
        }

        private async Task<string?> ValidateDateGuardsAsync(int branchId, DateTime txDate)
        {
            DateTime d = txDate.Date;
            var closedFy = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.IsClosed && d >= f.StartDate.Date && d <= f.EndDate.Date);
            if (closedFy != null)
            {
                return $"दिनांक {d:dd/MM/yyyy} बंद केलेल्या आर्थिक वर्षात ({closedFy.YearCode}) येत असल्याने व्यवहार करता येत नाही.";
            }

            var dayStatus = await _context.BranchDayEndStatuses
                .AsNoTracking()
                .FirstOrDefaultAsync(b => b.BranchID == (branchId > 0 ? branchId : 1) && b.BusinessDate.Date == d);
            if (dayStatus != null && dayStatus.IsDayClosed)
            {
                return $"दिनांक {d:dd/MM/yyyy} ची दिवसअखेर (Day-End) पूर्ण झाली असल्याने या तारखेला व्यवहार करता येत नाही.";
            }

            return null;
        }

        private async Task<string> GenerateBorrowingNoAsync(int branchId, int year)
        {
            int seq = await _context.SansthaBorrowings.CountAsync(b => b.BranchID == branchId && b.SanctionDate.Year == year) + 1;
            string candidate = $"BRW-{branchId}-{year}-{seq:D4}";
            while (await _context.SansthaBorrowings.AnyAsync(b => b.BorrowingNo == candidate))
            {
                seq++;
                candidate = $"BRW-{branchId}-{year}-{seq:D4}";
            }
            return candidate;
        }

        // GET: api/Borrowings/masters
        [HttpGet("masters")]
        public async Task<ActionResult<object>> GetBorrowingMasters([FromQuery] int? branchId = null)
        {
            int? resolvedBranch = User.ResolveOptionalBranchId(branchId);
            int effBranch = resolvedBranch.HasValue && resolvedBranch.Value > 0 ? resolvedBranch.Value : 1;
            DateTime businessDate = await ResolveBranchBusinessDateAsync(effBranch);

            var institutions = await _context.InvestmentInstitutions
                .AsNoTracking()
                .Where(i => i.IsActive)
                .OrderBy(i => i.InstitutionName)
                .Select(i => new
                {
                    i.InstitutionID,
                    i.InstitutionName,
                    i.InstitutionType,
                    i.InstitutionBranchName,
                    i.ContactPerson,
                    i.MobileNumber
                })
                .ToListAsync();

            var ledgers = await _context.Ledgers
                .AsNoTracking()
                .Include(l => l.AccountGroup)
                .Where(l => l.IsActive)
                .OrderBy(l => l.LedgerName)
                .Select(l => new
                {
                    l.LedgerID,
                    l.LedgerCode,
                    l.LedgerName,
                    l.AccountType,
                    GroupName = l.AccountGroup != null ? l.AccountGroup.GroupName : "",
                    NatureOfGroup = l.AccountGroup != null ? l.AccountGroup.NatureOfGroup : ""
                })
                .ToListAsync();

            var invQuery = _context.InvestmentAccounts
                .AsNoTracking()
                .Include(a => a.InvestmentInstitution)
                .Where(a => a.Status == "Active");

            var ownLockersQuery = _context.Lockers.AsNoTracking().Where(l => l.IsActive);
            var extLockersQuery = _context.SansthaExternalLockers.AsNoTracking().Where(e => e.IsActive);

            if (resolvedBranch.HasValue && resolvedBranch.Value > 0)
            {
                invQuery = invQuery.Where(a => a.BranchID == resolvedBranch.Value);
                ownLockersQuery = ownLockersQuery.Where(l => l.BranchID == resolvedBranch.Value);
                extLockersQuery = extLockersQuery.Where(e => e.BranchID == resolvedBranch.Value);
            }

            var investmentAccounts = await invQuery
                .OrderByDescending(a => a.InvestmentAccountID)
                .Select(a => new
                {
                    a.InvestmentAccountID,
                    a.InvestmentNo,
                    a.DepositReceiptNo,
                    InstitutionName = a.InvestmentInstitution != null ? a.InvestmentInstitution.InstitutionName : "",
                    a.PrincipalAmount,
                    a.InterestRate,
                    a.MaturityDate
                })
                .ToListAsync();

            var ownLockers = await ownLockersQuery
                .Select(l => new { l.LockerID, l.CabinetNo, l.LockerNo, l.KeyNo })
                .ToListAsync();

            var externalLockers = await extLockersQuery
                .Select(e => new { e.ExternalLockerID, e.BankOrSocietyName, e.BankBranchName, e.LockerNo })
                .ToListAsync();

            return Ok(new
            {
                businessDate,
                institutions,
                ledgers,
                investmentAccounts,
                ownLockers,
                externalLockers
            });
        }

        // POST: api/Borrowings/lender-institutions
        [HttpPost("lender-institutions")]
        public async Task<ActionResult<object>> CreateLenderInstitution([FromBody] CreateLenderInstitutionDto req)
        {
            if (req == null || string.IsNullOrWhiteSpace(req.InstitutionName))
                return BadRequest("कृपया बँक किंवा पतसंस्थेचे नाव प्रविष्ट करा.");

            int branchId = User.ResolveBranchId(req.BranchID > 0 ? req.BranchID : 1);
            var inst = new InvestmentInstitution
            {
                BranchID = branchId,
                InstitutionName = req.InstitutionName.Trim(),
                InstitutionType = string.IsNullOrWhiteSpace(req.InstitutionType) ? "Bank" : req.InstitutionType.Trim(),
                InstitutionBranchName = (req.InstitutionBranchName ?? string.Empty).Trim(),
                Address = req.Address?.Trim(),
                ContactPerson = req.ContactPerson?.Trim(),
                MobileNumber = req.MobileNumber?.Trim(),
                IsActive = true,
                CreatedBy = ResolveUserId(),
                CreatedDate = DateTime.UtcNow
            };

            _context.InvestmentInstitutions.Add(inst);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"'{inst.InstitutionName}' संस्था यशस्वीरीत्या जोडली!",
                institution = new
                {
                    inst.InstitutionID,
                    inst.InstitutionName,
                    inst.InstitutionType,
                    inst.InstitutionBranchName,
                    inst.ContactPerson,
                    inst.MobileNumber
                }
            });
        }

        // POST: api/Borrowings/preview-schedule
        [HttpPost("preview-schedule")]
        public ActionResult<object> PreviewSchedule([FromBody] BorrowingScheduleInput req)
        {
            if (req == null || req.PrincipalAmount <= 0m)
                return BadRequest("हप्ता वेळापत्रकासाठी वैध कर्ज रक्कम (Principal > 0) प्रविष्ट करा.");

            var rows = BorrowingScheduleService.GenerateSchedule(req);
            decimal totalPrincipal = Math.Round(rows.Sum(r => r.PrincipalDue), 2);
            decimal totalInterest = Math.Round(rows.Sum(r => r.InterestDue), 2);
            decimal totalPayable = Math.Round(rows.Sum(r => r.TotalInstallmentAmount), 2);

            return Ok(new
            {
                installmentsCount = rows.Count,
                firstInstallmentAmount = rows.FirstOrDefault()?.TotalInstallmentAmount ?? 0m,
                lastDueDate = rows.LastOrDefault()?.DueDate,
                totalPrincipal,
                totalInterest,
                totalPayable,
                schedules = rows.Select(s => new
                {
                    s.InstallmentNo,
                    s.DueDate,
                    s.OpeningPrincipal,
                    s.PrincipalDue,
                    s.InterestDue,
                    s.TotalInstallmentAmount,
                    s.ClosingPrincipal,
                    s.Status
                })
            });
        }

        // GET: api/Borrowings/eligible-gold-packets
        [HttpGet("eligible-gold-packets")]
        public async Task<ActionResult<IEnumerable<object>>> GetEligibleGoldPackets([FromQuery] int? branchId = null)
        {
            int? resolvedBranch = User.ResolveOptionalBranchId(branchId);

            var loansQuery = _context.LoanAccounts
                .Include(l => l.Customer)
                .Include(l => l.Member)
                    .ThenInclude(m => m!.Customer)
                .Include(l => l.LoanRate)
                .Include(l => l.LoanApplication)
                .Where(l => l.Status == "Active" && l.PrincipalBalance > 0m);

            if (resolvedBranch.HasValue && resolvedBranch.Value > 0)
            {
                loansQuery = loansQuery.Where(l => l.BranchID == resolvedBranch.Value);
            }

            var activeLoans = await loansQuery.OrderByDescending(l => l.LoanAccountID).ToListAsync();
            var loanIds = activeLoans.Select(l => l.LoanAccountID).ToList();

            var goldRowsByLoan = (await _context.GoldLoanDetails
                .AsNoTracking()
                .Where(g => g.LoanAccountID.HasValue && loanIds.Contains(g.LoanAccountID.Value))
                .ToListAsync())
                .GroupBy(g => g.LoanAccountID!.Value)
                .ToDictionary(x => x.Key, x => x.ToList());

            var custodies = await _context.GoldLoanCustodies
                .Include(c => c.OwnLocker)
                .Include(c => c.ExternalLocker)
                .Where(c => loanIds.Contains(c.LoanAccountID))
                .ToDictionaryAsync(c => c.LoanAccountID);

            var eligible = new List<object>();
            int userId = ResolveUserId();

            foreach (var l in activeLoans)
            {
                bool hasGoldRows = goldRowsByLoan.ContainsKey(l.LoanAccountID);
                if (!GoldCustodyAndBorrowingHelper.IsGoldLoanAccount(l, l.LoanRate, l.LoanApplication, hasGoldRows))
                    continue;

                if (!custodies.TryGetValue(l.LoanAccountID, out var cust))
                {
                    cust = await GoldCustodyAndBorrowingHelper.EnsureOrSyncGoldCustodyAsync(_context, l, userId);
                    custodies[l.LoanAccountID] = cust;
                }

                if (string.Equals(cust.CustodyStatus, "REPLEDGED_BORROWING", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(cust.CustodyStatus, "RELEASED_TO_CUSTOMER", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var c = l.Customer ?? l.Member?.Customer;
                string borrowerName = c != null
                    ? $"{c.FirstName} {c.MiddleName} {c.LastName}".Replace("  ", " ").Trim()
                    : (l.Member?.MemberCode ?? $"खाते #{l.LoanAccountNo}");

                eligible.Add(new
                {
                    l.LoanAccountID,
                    LoanAccountNo = l.LoanAccountNo ?? "",
                    BorrowerName = borrowerName,
                    CifNo = c?.CIFNo ?? "",
                    SchemeName = l.LoanRate?.ShortName ?? l.LoanRate?.LoanType ?? "सोने तारण कर्ज",
                    CustomerInterestRate = l.InterestRate,
                    CustomerPrincipalBalance = l.PrincipalBalance,
                    cust.GoldCustodyID,
                    cust.PacketNumber,
                    cust.SealNumber,
                    cust.TotalOrnamentsCount,
                    cust.TotalGrossWeight,
                    cust.TotalNetWeight,
                    cust.TotalValuationAmount,
                    cust.CustodyStatus,
                    CurrentLocationDisplay = GoldCustodyAndBorrowingHelper.FormatCustodyLocationSummary(cust)
                });
            }

            return Ok(eligible);
        }

        // GET: api/Borrowings
        [HttpGet]
        public async Task<ActionResult<object>> GetBorrowings(
            [FromQuery] int? branchId = null,
            [FromQuery] string? status = null)
        {
            int? resolvedBranch = User.ResolveOptionalBranchId(branchId);
            int effBranch = resolvedBranch.HasValue && resolvedBranch.Value > 0 ? resolvedBranch.Value : 1;
            DateTime businessDate = await ResolveBranchBusinessDateAsync(effBranch);

            var query = _context.SansthaBorrowings
                .AsNoTracking()
                .Include(b => b.Branch)
                .Include(b => b.BorrowingLiabilityLedger)
                .Include(b => b.InterestExpenseLedger)
                .Include(b => b.ProcessingChargesLedger)
                .Include(b => b.DisbursementVoucher)
                .Include(b => b.Disbursements)
                    .ThenInclude(d => d.Voucher)
                .Include(b => b.InstallmentSchedules)
                .Include(b => b.GoldPledges)
                    .ThenInclude(p => p.LoanAccount)
                        .ThenInclude(l => l!.Customer)
                .Include(b => b.GoldPledges)
                    .ThenInclude(p => p.GoldCustody)
                .Include(b => b.Repayments)
                    .ThenInclude(r => r.Voucher)
                .AsQueryable();

            if (resolvedBranch.HasValue && resolvedBranch.Value > 0)
            {
                query = query.Where(b => b.BranchID == resolvedBranch.Value);
            }

            if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(b => b.Status == status.Trim());
            }

            var list = await query
                .OrderByDescending(b => b.BorrowingID)
                .ToListAsync();

            var activeList = list.Where(b => string.Equals(b.Status, "Active", StringComparison.OrdinalIgnoreCase)).ToList();
            var sanctionedList = list.Where(b => string.Equals(b.Status, "Sanctioned", StringComparison.OrdinalIgnoreCase)).ToList();
            var activePledges = activeList
                .SelectMany(b => b.GoldPledges.Where(p => p.PledgeStatus == "Pledged"))
                .ToList();

            decimal totalSanctioned = Math.Round(list.Where(b => b.Status != "Closed").Sum(b => b.SanctionedAmount), 2);
            decimal totalOutstanding = Math.Round(activeList.Sum(b => b.OutstandingPrincipal), 2);
            decimal weightedBorrowRate = totalOutstanding > 0m
                ? Math.Round(activeList.Sum(b => b.OutstandingPrincipal * b.BorrowingInterestRate) / totalOutstanding, 2)
                : (activeList.Any() ? Math.Round(activeList.Average(b => b.BorrowingInterestRate), 2) : 0m);

            decimal avgCustomerRate = activePledges.Any()
                ? Math.Round(activePledges.Average(p => p.CustomerLoanInterestRate), 2)
                : 0m;

            int totalOverdueEmis = 0;
            decimal totalOverdueEmiAmount = 0m;
            int upcoming15DaysCount = 0;
            decimal upcoming15DaysAmount = 0m;
            int closedMemberLoanAlertCount = 0;

            var items = list.Select(b =>
            {
                var schedulesList = b.InstallmentSchedules.OrderBy(s => s.InstallmentNo).ToList();
                if (schedulesList.Any() && b.Status == "Active")
                {
                    BorrowingScheduleService.SynchronizeSchedules(b, schedulesList, b.Repayments, businessDate);
                }

                var overdueSchedules = b.Status == "Active"
                    ? schedulesList.Where(s => s.Status == "Overdue").ToList()
                    : new List<SansthaBorrowingInstallmentSchedule>();

                var upcoming15 = b.Status == "Active"
                    ? schedulesList.Where(s => s.Status != "Paid" && s.DueDate.Date >= businessDate && s.DueDate.Date <= businessDate.AddDays(15)).ToList()
                    : new List<SansthaBorrowingInstallmentSchedule>();

                totalOverdueEmis += overdueSchedules.Count;
                totalOverdueEmiAmount += overdueSchedules.Sum(s => Math.Max(0m, s.TotalInstallmentAmount - s.PrincipalPaid - s.InterestPaid));
                upcoming15DaysCount += upcoming15.Count;
                upcoming15DaysAmount += upcoming15.Sum(s => Math.Max(0m, s.TotalInstallmentAmount - s.PrincipalPaid - s.InterestPaid));

                var nextDueSchedule = b.Status == "Active"
                    ? schedulesList.FirstOrDefault(s => s.Status != "Paid")
                    : null;

                var pledges = b.GoldPledges
                    .OrderBy(p => p.BorrowingGoldPledgeID)
                    .Select(p =>
                    {
                        var cust = p.LoanAccount?.Customer;
                        string bName = cust != null
                            ? $"{cust.FirstName} {cust.MiddleName} {cust.LastName}".Replace("  ", " ").Trim()
                            : $"खाते #{p.LoanAccount?.LoanAccountNo}";

                        if (p.PledgeStatus == "Pledged" && (p.LoanAccount?.Status == "Closed" || (p.LoanAccount?.PrincipalBalance ?? 0m) <= 0m))
                        {
                            closedMemberLoanAlertCount++;
                        }

                        return new
                        {
                            p.BorrowingGoldPledgeID,
                            p.BorrowingDisbursementID,
                            p.LoanAccountID,
                            LoanAccountNo = p.LoanAccount?.LoanAccountNo ?? "",
                            LoanStatus = p.LoanAccount?.Status ?? "",
                            LoanPrincipalBalance = p.LoanAccount?.PrincipalBalance ?? 0m,
                            BorrowerName = bName,
                            p.GoldCustodyID,
                            PacketNumber = p.GoldCustody?.PacketNumber ?? "",
                            NetWeight = p.GoldCustody?.TotalNetWeight ?? 0m,
                            ValuationAmount = p.GoldCustody?.TotalValuationAmount ?? 0m,
                            p.CustomerLoanInterestRate,
                            p.InterestSpreadPercent,
                            p.AllocatedBorrowedAmount,
                            p.LenderPledgeReceiptNo,
                            p.PledgedDate,
                            p.PledgeStatus,
                            p.ReleasedDate,
                            p.ReleaseRemarks
                        };
                    })
                    .ToList();

                var disbursements = b.Disbursements
                    .OrderBy(d => d.DisbursementDate)
                    .ThenBy(d => d.BorrowingDisbursementID)
                    .Select(d => new
                    {
                        d.BorrowingDisbursementID,
                        d.DisbursementNo,
                        d.DisbursementDate,
                        d.GrossDisbursedAmount,
                        d.ProcessingFeeDeducted,
                        d.OtherDeductionsAmount,
                        d.NetReceivedAmount,
                        d.PaymentMode,
                        d.ReferenceNo,
                        d.VoucherID,
                        VoucherNo = d.Voucher?.VoucherNo ?? "",
                        VoucherStatus = d.Voucher?.Status ?? "",
                        d.Remarks
                    })
                    .ToList();

                var repayments = b.Repayments
                    .OrderByDescending(r => r.RepaymentDate)
                    .ThenByDescending(r => r.BorrowingRepaymentID)
                    .Select(r => new
                    {
                        r.BorrowingRepaymentID,
                        r.RepaymentNo,
                        r.RepaymentType,
                        r.InstallmentsCovered,
                        r.RepaymentDate,
                        r.PrincipalPaid,
                        r.InterestPaid,
                        r.PenalOrChargesPaid,
                        r.TotalPaid,
                        r.BalanceBeforeRepayment,
                        r.BalanceAfterRepayment,
                        r.PaymentMode,
                        r.ReferenceNo,
                        r.VoucherID,
                        VoucherNo = r.Voucher?.VoucherNo ?? "",
                        VoucherStatus = r.Voucher?.Status ?? "",
                        r.Remarks
                    })
                    .ToList();

                var schedulesDto = schedulesList.Select(s => new
                {
                    s.ScheduleID,
                    s.InstallmentNo,
                    s.DueDate,
                    s.OpeningPrincipal,
                    s.PrincipalDue,
                    s.InterestDue,
                    s.TotalInstallmentAmount,
                    s.ClosingPrincipal,
                    s.PrincipalPaid,
                    s.InterestPaid,
                    s.PenaltyPaid,
                    s.PaidDate,
                    s.Status,
                    RemainingInstallmentDue = Math.Max(0m, Math.Round(s.TotalInstallmentAmount - s.PrincipalPaid - s.InterestPaid, 2))
                }).ToList();

                decimal remainingLimit = b.BorrowingType == "CASH_CREDIT_OD"
                    ? Math.Max(0m, Math.Round(b.SanctionedAmount - b.OutstandingPrincipal, 2))
                    : Math.Max(0m, Math.Round(b.SanctionedAmount - b.DisbursedAmount, 2));

                var (accruedInt, accruedDays, _) = BorrowingScheduleService.CalculateAccruedInterest(b, businessDate);

                return new
                {
                    b.BorrowingID,
                    b.BranchID,
                    BranchName = b.Branch?.BranchName ?? "मुख्य शाखा",
                    b.BorrowingNo,
                    b.LenderInstitutionID,
                    b.LenderName,
                    b.LenderBranchName,
                    b.ExternalLoanAccountNo,
                    b.SanctionLetterNo,
                    b.BorrowingType,
                    b.PledgedInvestmentAccountID,
                    b.SanctionDate,
                    b.DisbursementDate,
                    b.MaturityDate,
                    b.SanctionedAmount,
                    b.DisbursedAmount,
                    RemainingSanctionLimit = remainingLimit,
                    b.OutstandingPrincipal,
                    b.TotalInterestPaid,
                    AccruedInterestToday = accruedInt,
                    AccruedDays = accruedDays,
                    b.BorrowingInterestRate,
                    b.PenalInterestRate,
                    b.InterestCalculationMethod,
                    b.InstallmentType,
                    b.InstallmentFrequency,
                    b.TenureMonths,
                    b.TotalInstallments,
                    b.MoratoriumMonths,
                    b.FirstInstallmentDueDate,
                    b.LastInterestPaidDate,
                    b.InstallmentAmount,
                    b.IsOpeningBalance,
                    b.BorrowingLiabilityLedgerID,
                    LiabilityLedgerName = b.BorrowingLiabilityLedger?.LedgerName ?? "",
                    b.InterestExpenseLedgerID,
                    InterestExpenseLedgerName = b.InterestExpenseLedger?.LedgerName ?? "",
                    b.ProcessingChargesLedgerID,
                    ProcessingChargesLedgerName = b.ProcessingChargesLedger?.LedgerName ?? "",
                    b.PaymentMode,
                    b.ReferenceNo,
                    b.DisbursementVoucherID,
                    DisbursementVoucherNo = b.DisbursementVoucher?.VoucherNo ?? "",
                    DisbursementVoucherStatus = b.DisbursementVoucher?.Status ?? "",
                    b.PurposeOrLinkedLoansNote,
                    b.Remarks,
                    b.Status,
                    b.ClosedDate,
                    NextDueDate = nextDueSchedule?.DueDate,
                    NextEmiAmount = nextDueSchedule != null
                        ? Math.Max(0m, nextDueSchedule.TotalInstallmentAmount - nextDueSchedule.PrincipalPaid - nextDueSchedule.InterestPaid)
                        : 0m,
                    PaidInstallmentsCount = schedulesList.Count(s => s.Status == "Paid"),
                    TotalScheduleCount = schedulesList.Count,
                    OverdueEmiCount = overdueSchedules.Count,
                    OverdueEmiAmount = Math.Round(overdueSchedules.Sum(s => Math.Max(0m, s.TotalInstallmentAmount - s.PrincipalPaid - s.InterestPaid)), 2),
                    ActivePledgedCount = pledges.Count(p => p.PledgeStatus == "Pledged"),
                    TotalPledgedNetWeight = pledges.Where(p => p.PledgeStatus == "Pledged").Sum(p => p.NetWeight),
                    AvgCustomerRate = pledges.Any() ? Math.Round(pledges.Average(p => p.CustomerLoanInterestRate), 2) : 0m,
                    AvgSpreadPercent = pledges.Any() ? Math.Round(pledges.Average(p => p.InterestSpreadPercent), 2) : 0m,
                    Disbursements = disbursements,
                    InstallmentSchedules = schedulesDto,
                    GoldPledges = pledges,
                    Repayments = repayments
                };
            }).ToList();

            return Ok(new
            {
                businessDate,
                kpis = new
                {
                    sanctionedAccountsCount = sanctionedList.Count,
                    activeBorrowingsCount = activeList.Count,
                    totalSanctionedAmount = totalSanctioned,
                    totalOutstandingPrincipal = totalOutstanding,
                    overdueInstallmentsCount = totalOverdueEmis,
                    overdueInstallmentsAmount = Math.Round(totalOverdueEmiAmount, 2),
                    upcoming15DaysEmisCount = upcoming15DaysCount,
                    upcoming15DaysEmisAmount = Math.Round(upcoming15DaysAmount, 2),
                    closedMemberLoanAlertCount,
                    activeRepledgedPacketsCount = activePledges.Count,
                    totalRepledgedNetWeight = Math.Round(activePledges.Sum(p => p.GoldCustody?.TotalNetWeight ?? 0m), 3),
                    weightedBorrowingRate = weightedBorrowRate,
                    avgCustomerLendingRate = avgCustomerRate,
                    netInterestSpreadPercent = avgCustomerRate > 0m ? Math.Round(avgCustomerRate - weightedBorrowRate, 2) : 0m
                },
                items
            });
        }

        // =====================================================================
        // STEP 1 OF LIFECYCLE: BORROWING ACCOUNT OPENING (SANCTION MASTER)
        // =====================================================================
        [HttpPost("accounts")]
        [Authorize(Roles = "Admin,SuperAdmin,Super Admin,SystemAdmin,HeadOffice,HO_Manager,HO Manager,GeneralManager,CEO,Chairman,Manager,BranchManager,Branch_Manager")]
        public async Task<ActionResult<object>> CreateBorrowingAccount([FromBody] CreateBorrowingAccountDto req)
        {
            if (req == null) return BadRequest("कृपया बाह्य कर्ज खात्याची माहिती भरा.");

            string bType = (req.BorrowingType ?? string.Empty).Trim().ToUpperInvariant();
            if (!AllowedBorrowingTypes.Contains(bType))
                return BadRequest($"अवैध बाह्य कर्ज प्रकार: '{req.BorrowingType}'.");

            if (req.SanctionedAmount <= 0m)
                return BadRequest("मंजूर कर्ज मर्यादा (Sanctioned Amount) ₹0 पेक्षा जास्त असणे आवश्यक आहे.");

            if (req.BorrowingInterestRate < 0m || req.BorrowingInterestRate > 50m)
                return BadRequest("कृपया वैध वार्षिक व्याजदर (%) प्रविष्ट करा.");

            int branchId = User.ResolveBranchId(req.BranchID > 0 ? req.BranchID : 1);
            DateTime sanctionDate = (req.SanctionDate ?? await ResolveBranchBusinessDateAsync(branchId)).Date;

            if (!req.IsOpeningBalance)
            {
                string? dateErr = await ValidateDateGuardsAsync(branchId, sanctionDate);
                if (dateErr != null) return BadRequest(dateErr);
            }

            string lenderName = (req.LenderName ?? string.Empty).Trim();
            string? lenderBranch = req.LenderBranchName?.Trim();
            if (req.LenderInstitutionID.HasValue && req.LenderInstitutionID.Value > 0)
            {
                var inst = await _context.InvestmentInstitutions.AsNoTracking().FirstOrDefaultAsync(i => i.InstitutionID == req.LenderInstitutionID.Value);
                if (inst != null)
                {
                    if (string.IsNullOrWhiteSpace(lenderName)) lenderName = inst.InstitutionName;
                    if (string.IsNullOrWhiteSpace(lenderBranch)) lenderBranch = inst.InstitutionBranchName;
                }
            }
            if (string.IsNullOrWhiteSpace(lenderName))
                return BadRequest("कृपया कर्ज देणाऱ्या बँक किंवा पतसंस्थेचे नाव निवडा.");

            var liabCheck = await GoldCustodyAndBorrowingHelper.ValidateBorrowingLiabilityLedgerAsync(_context, req.BorrowingLiabilityLedgerID);
            if (!liabCheck.IsValid) return BadRequest(liabCheck.ErrorMessage);

            var expCheck = await GoldCustodyAndBorrowingHelper.ValidateBorrowingInterestExpenseLedgerAsync(_context, req.InterestExpenseLedgerID);
            if (!expCheck.IsValid) return BadRequest(expCheck.ErrorMessage);

            if (req.ProcessingChargesLedgerID.HasValue && req.ProcessingChargesLedgerID.Value > 0)
            {
                var chgCheck = await GoldCustodyAndBorrowingHelper.ValidateBorrowingDeductionOrChargesLedgerAsync(_context, req.ProcessingChargesLedgerID);
                if (!chgCheck.IsValid) return BadRequest(chgCheck.ErrorMessage);
            }

            var activeFy = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(f => !f.IsClosed && sanctionDate >= f.StartDate.Date && sanctionDate <= f.EndDate.Date)
                ?? await _context.FinancialYears.AsNoTracking().OrderByDescending(f => f.FinancialYearID).FirstOrDefaultAsync();

            int tenureMonths = req.TenureMonths > 0 ? req.TenureMonths : 12;
            string freq = string.IsNullOrWhiteSpace(req.InstallmentFrequency) ? "Monthly" : req.InstallmentFrequency.Trim();
            string instType = string.IsNullOrWhiteSpace(req.InstallmentType) ? "EMI" : req.InstallmentType.Trim();
            int stepMonths = BorrowingScheduleService.ResolveStepMonths(freq, tenureMonths);
            int totalInst = req.TotalInstallments > 0
                ? req.TotalInstallments
                : (freq.Equals("Bullet", StringComparison.OrdinalIgnoreCase) ? 1 : Math.Max(1, (tenureMonths - Math.Max(0, req.MoratoriumMonths)) / Math.Max(1, stepMonths)));

            DateTime effMaturity = req.MaturityDate?.Date ?? sanctionDate.AddMonths(tenureMonths);
            string borrowingNo = await GenerateBorrowingNoAsync(branchId, sanctionDate.Year);
            int userId = ResolveUserId();

            var borrowing = new SansthaBorrowing
            {
                BranchID = branchId,
                FinancialYearID = activeFy?.FinancialYearID ?? 1,
                BorrowingNo = borrowingNo,
                LenderInstitutionID = req.LenderInstitutionID > 0 ? req.LenderInstitutionID : null,
                LenderName = lenderName,
                LenderBranchName = lenderBranch,
                ExternalLoanAccountNo = req.ExternalLoanAccountNo?.Trim(),
                SanctionLetterNo = req.SanctionLetterNo?.Trim(),
                BorrowingType = bType,
                PledgedInvestmentAccountID = bType == "FD_AGAINST_LOAN" && req.PledgedInvestmentAccountID > 0 ? req.PledgedInvestmentAccountID : null,
                SanctionDate = sanctionDate,
                DisbursementDate = req.OpeningDisbursementDate?.Date ?? sanctionDate,
                MaturityDate = effMaturity,
                SanctionedAmount = Math.Round(req.SanctionedAmount, 2, MidpointRounding.AwayFromZero),
                DisbursedAmount = req.IsOpeningBalance ? Math.Round(req.OpeningDisbursedAmount > 0 ? req.OpeningDisbursedAmount : req.SanctionedAmount, 2) : 0m,
                OutstandingPrincipal = req.IsOpeningBalance ? Math.Round(req.OpeningOutstandingPrincipal, 2) : 0m,
                TotalInterestPaid = 0m,
                BorrowingInterestRate = Math.Round(req.BorrowingInterestRate, 2, MidpointRounding.AwayFromZero),
                PenalInterestRate = Math.Max(0m, Math.Round(req.PenalInterestRate, 2, MidpointRounding.AwayFromZero)),
                InterestCalculationMethod = string.IsNullOrWhiteSpace(req.InterestCalculationMethod) ? "Reducing" : req.InterestCalculationMethod.Trim(),
                InstallmentType = instType,
                InstallmentFrequency = freq,
                TenureMonths = tenureMonths,
                TotalInstallments = totalInst,
                MoratoriumMonths = Math.Max(0, req.MoratoriumMonths),
                FirstInstallmentDueDate = req.FirstInstallmentDueDate?.Date,
                LastInterestPaidDate = req.IsOpeningBalance ? req.LastInterestPaidDate?.Date : null,
                InstallmentAmount = Math.Max(0m, Math.Round(req.InstallmentAmount, 2, MidpointRounding.AwayFromZero)),
                IsOpeningBalance = req.IsOpeningBalance,
                BorrowingLiabilityLedgerID = req.BorrowingLiabilityLedgerID,
                InterestExpenseLedgerID = req.InterestExpenseLedgerID,
                ProcessingChargesLedgerID = req.ProcessingChargesLedgerID > 0 ? req.ProcessingChargesLedgerID : null,
                PurposeOrLinkedLoansNote = req.PurposeOrLinkedLoansNote?.Trim(),
                Remarks = req.Remarks?.Trim(),
                Status = req.IsOpeningBalance && req.OpeningOutstandingPrincipal > 0m ? "Active" : "Sanctioned",
                CreatedBy = userId,
                CreatedAt = DateTime.UtcNow
            };

            _context.SansthaBorrowings.Add(borrowing);
            await _context.SaveChangesAsync();

            if (req.IsOpeningBalance && borrowing.OutstandingPrincipal > 0m && bType != "CASH_CREDIT_OD")
            {
                var obSchedules = BorrowingScheduleService.GenerateSchedule(new BorrowingScheduleInput
                {
                    PrincipalAmount = borrowing.OutstandingPrincipal,
                    AnnualInterestRate = borrowing.BorrowingInterestRate,
                    InstallmentType = borrowing.InstallmentType,
                    InstallmentFrequency = borrowing.InstallmentFrequency,
                    TenureMonths = borrowing.TenureMonths,
                    TotalInstallments = borrowing.TotalInstallments,
                    MoratoriumMonths = 0,
                    DisbursementDate = borrowing.LastInterestPaidDate ?? borrowing.SanctionDate,
                    FirstInstallmentDueDate = borrowing.FirstInstallmentDueDate,
                    CustomInstallmentAmount = borrowing.InstallmentAmount > 0 ? borrowing.InstallmentAmount : null
                });
                foreach (var s in obSchedules)
                {
                    s.BorrowingID = borrowing.BorrowingID;
                    _context.SansthaBorrowingInstallmentSchedules.Add(s);
                }
                if (borrowing.InstallmentAmount <= 0m && obSchedules.Any())
                {
                    borrowing.InstallmentAmount = obSchedules.First().TotalInstallmentAmount;
                }
                await _context.SaveChangesAsync();
            }

            return Ok(new
            {
                message = req.IsOpeningBalance
                    ? $"आरंभिक बाह्य कर्ज खाते '{borrowing.BorrowingNo}' सक्रिय (Active) म्हणून जतन झाले!"
                    : $"बाह्य कर्ज खाते क्र. '{borrowing.BorrowingNo}' मंजूर (Sanctioned) स्थितीत यशस्वीरीत्या उघडले! आता 'कर्ज रक्कम उचल (Disbursement)' स्क्रीनवरून निधी प्राप्ती नोंदवा.",
                borrowing.BorrowingID,
                borrowing.BorrowingNo,
                borrowing.Status
            });
        }

        [HttpPut("accounts/{id}")]
        [Authorize(Roles = "Admin,SuperAdmin,Super Admin,SystemAdmin,HeadOffice,HO_Manager,HO Manager,GeneralManager,CEO,Chairman,Manager,BranchManager,Branch_Manager")]
        public async Task<ActionResult<object>> UpdateBorrowingAccount(int id, [FromBody] CreateBorrowingAccountDto req)
        {
            var borrowing = await _context.SansthaBorrowings.FirstOrDefaultAsync(b => b.BorrowingID == id);
            if (borrowing == null) return NotFound("बाह्य कर्ज खाते सापडले नाही.");

            var liabCheck = await GoldCustodyAndBorrowingHelper.ValidateBorrowingLiabilityLedgerAsync(_context, req.BorrowingLiabilityLedgerID);
            if (!liabCheck.IsValid) return BadRequest(liabCheck.ErrorMessage);

            var expCheck = await GoldCustodyAndBorrowingHelper.ValidateBorrowingInterestExpenseLedgerAsync(_context, req.InterestExpenseLedgerID);
            if (!expCheck.IsValid) return BadRequest(expCheck.ErrorMessage);

            borrowing.ExternalLoanAccountNo = req.ExternalLoanAccountNo?.Trim();
            borrowing.SanctionLetterNo = req.SanctionLetterNo?.Trim();
            borrowing.LenderBranchName = req.LenderBranchName?.Trim();
            borrowing.PurposeOrLinkedLoansNote = req.PurposeOrLinkedLoansNote?.Trim();
            borrowing.Remarks = req.Remarks?.Trim();
            borrowing.ProcessingChargesLedgerID = req.ProcessingChargesLedgerID > 0 ? req.ProcessingChargesLedgerID : null;

            if (string.Equals(borrowing.Status, "Sanctioned", StringComparison.OrdinalIgnoreCase))
            {
                if (req.SanctionedAmount > 0m) borrowing.SanctionedAmount = Math.Round(req.SanctionedAmount, 2);
                borrowing.BorrowingInterestRate = Math.Round(req.BorrowingInterestRate, 2);
                borrowing.PenalInterestRate = Math.Max(0m, Math.Round(req.PenalInterestRate, 2));
                if (!string.IsNullOrWhiteSpace(req.InstallmentType)) borrowing.InstallmentType = req.InstallmentType.Trim();
                if (!string.IsNullOrWhiteSpace(req.InstallmentFrequency)) borrowing.InstallmentFrequency = req.InstallmentFrequency.Trim();
                if (req.TenureMonths > 0) borrowing.TenureMonths = req.TenureMonths;
                if (req.TotalInstallments > 0) borrowing.TotalInstallments = req.TotalInstallments;
                borrowing.MoratoriumMonths = Math.Max(0, req.MoratoriumMonths);
                borrowing.FirstInstallmentDueDate = req.FirstInstallmentDueDate?.Date;
                borrowing.MaturityDate = req.MaturityDate?.Date ?? borrowing.SanctionDate.AddMonths(borrowing.TenureMonths);
                borrowing.InstallmentAmount = Math.Max(0m, Math.Round(req.InstallmentAmount, 2));
                borrowing.BorrowingLiabilityLedgerID = req.BorrowingLiabilityLedgerID;
                borrowing.InterestExpenseLedgerID = req.InterestExpenseLedgerID;
            }

            borrowing.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = $"बाह्य कर्ज खाते '{borrowing.BorrowingNo}' अद्ययावत झाले!", borrowing.BorrowingID });
        }

        [HttpDelete("accounts/{id}")]
        [Authorize(Roles = "Admin,SuperAdmin,Super Admin,SystemAdmin,HeadOffice,HO_Manager,HO Manager,GeneralManager,CEO,Chairman,Manager,BranchManager,Branch_Manager")]
        public async Task<ActionResult<object>> DeleteSanctionedBorrowingAccount(int id)
        {
            var borrowing = await _context.SansthaBorrowings
                .Include(b => b.Disbursements)
                .Include(b => b.Repayments)
                .FirstOrDefaultAsync(b => b.BorrowingID == id);

            if (borrowing == null) return NotFound("बाह्य कर्ज खाते सापडले नाही.");
            if (!string.Equals(borrowing.Status, "Sanctioned", StringComparison.OrdinalIgnoreCase) ||
                borrowing.Disbursements.Any() ||
                borrowing.Repayments.Any() ||
                borrowing.DisbursedAmount > 0m)
            {
                return BadRequest("फक्त अद्याप रक्कम उचल न झालेली (Sanctioned) बाह्य कर्ज खातीच डिलीट करता येतात.");
            }

            _context.SansthaBorrowings.Remove(borrowing);
            await _context.SaveChangesAsync();
            return Ok(new { message = $"मंजूर खाते '{borrowing.BorrowingNo}' हटवण्यात आले." });
        }

        // =====================================================================
        // STEP 2 OF LIFECYCLE: LOAN DISBURSEMENT / DRAWDOWN + GOLD REPLEDGE
        // =====================================================================
        [HttpPost("{id}/disburse")]
        [Authorize(Roles = "Admin,SuperAdmin,Super Admin,SystemAdmin,HeadOffice,HO_Manager,HO Manager,GeneralManager,CEO,Chairman,Manager,BranchManager,Branch_Manager")]
        public async Task<ActionResult<object>> DisburseBorrowing(int id, [FromBody] BorrowingDisbursementRequestDto req)
        {
            if (req == null || req.GrossDisbursedAmount <= 0m)
                return BadRequest("उचललेली कर्ज रक्कम (Gross Disbursed Amount) ₹0 पेक्षा जास्त असणे आवश्यक आहे.");

            var borrowing = await _context.SansthaBorrowings
                .Include(b => b.Disbursements)
                    .ThenInclude(d => d.Voucher)
                .Include(b => b.InstallmentSchedules)
                .Include(b => b.Repayments)
                .Include(b => b.GoldPledges)
                .FirstOrDefaultAsync(b => b.BorrowingID == id);

            if (borrowing == null) return NotFound("बाह्य कर्ज खाते सापडले नाही.");
            if (string.Equals(borrowing.Status, "Closed", StringComparison.OrdinalIgnoreCase))
                return BadRequest("हे बाह्य कर्ज खाते बंद (Closed) झालेले आहे.");

            bool hasPendingDisb = borrowing.Disbursements.Any(d =>
                d.Voucher != null && string.Equals(d.Voucher.Status, "Pending", StringComparison.OrdinalIgnoreCase));
            if (hasPendingDisb)
                return BadRequest("या खात्याचे मागील कर्ज वाटप व्हाउचर अद्याप चेकर मंजुरीसाठी प्रलंबित (Pending) आहे.");

            DateTime disbDate = req.DisbursementDate.Date;
            string? dateErr = await ValidateDateGuardsAsync(borrowing.BranchID, disbDate);
            if (dateErr != null) return BadRequest(dateErr);

            decimal grossAmt = Math.Round(req.GrossDisbursedAmount, 2, MidpointRounding.AwayFromZero);
            decimal procFee = Math.Max(0m, Math.Round(req.ProcessingFeeDeducted, 2, MidpointRounding.AwayFromZero));
            decimal otherDed = Math.Max(0m, Math.Round(req.OtherDeductionsAmount, 2, MidpointRounding.AwayFromZero));
            decimal totalDed = Math.Round(procFee + otherDed, 2, MidpointRounding.AwayFromZero);

            if (totalDed >= grossAmt)
                return BadRequest("प्रोसेसिंग फी व कपातीची रक्कम एकूण उचल रकमेपेक्षा कमी असणे आवश्यक आहे.");

            decimal netReceived = Math.Round(grossAmt - totalDed, 2, MidpointRounding.AwayFromZero);

            decimal availableLimit = borrowing.BorrowingType == "CASH_CREDIT_OD"
                ? Math.Max(0m, borrowing.SanctionedAmount - borrowing.OutstandingPrincipal)
                : Math.Max(0m, borrowing.SanctionedAmount - borrowing.DisbursedAmount);

            if (grossAmt > availableLimit + 0.01m)
            {
                return BadRequest($"उचल रक्कम ₹{grossAmt:N2} ही उपलब्ध मंजूर मर्यादेपेक्षा (₹{availableLimit:N2}) जास्त आहे.");
            }

            int? effectiveDeductionLedgerId = req.DeductionLedgerID > 0 ? req.DeductionLedgerID : borrowing.ProcessingChargesLedgerID;
            if (totalDed > 0m)
            {
                var dedCheck = await GoldCustodyAndBorrowingHelper.ValidateBorrowingDeductionOrChargesLedgerAsync(_context, effectiveDeductionLedgerId);
                if (!dedCheck.IsValid) return BadRequest(dedCheck.ErrorMessage);
            }

            var settlement = await GoldCustodyAndBorrowingHelper.ResolveSettlementLedgerAsync(_context, borrowing.BranchID, req.PaymentMode, req.BankLedgerID);
            if (!settlement.IsValid) return BadRequest(settlement.ErrorMessage);

            var pledgeInputs = req.GoldPledges ?? new List<BorrowingGoldPledgeInputDto>();
            if (borrowing.BorrowingType == "GOLD_REPLEDGE" && !borrowing.GoldPledges.Any(p => p.PledgeStatus == "Pledged") && !pledgeInputs.Any())
            {
                return BadRequest("सोने पुनर्गहाण बाह्य कर्जासाठी किमान एक ग्राहक सोने तारण पाकीट निवडणे आवश्यक आहे.");
            }

            int userId = ResolveUserId();
            var validatedGoldPairs = new List<(LoanAccount Loan, GoldLoanCustody Custody, BorrowingGoldPledgeInputDto Input)>();
            if (pledgeInputs.Any())
            {
                var distinctLoanIds = pledgeInputs.Select(p => p.LoanAccountID).Distinct().ToList();
                if (distinctLoanIds.Count != pledgeInputs.Count)
                    return BadRequest("एकाच कर्ज खात्याचे पाकीट एकापेक्षा जास्त वेळा निवडता येत नाही.");

                foreach (var pIn in pledgeInputs)
                {
                    var loan = await _context.LoanAccounts
                        .Include(l => l.LoanRate)
                        .Include(l => l.LoanApplication)
                        .FirstOrDefaultAsync(l => l.LoanAccountID == pIn.LoanAccountID);

                    if (loan == null || loan.Status != "Active" || loan.PrincipalBalance <= 0m)
                        return BadRequest($"कर्ज खाते ID #{pIn.LoanAccountID} सक्रिय नाही किंवा त्याची बाकी शून्य आहे.");

                    var custody = await GoldCustodyAndBorrowingHelper.EnsureOrSyncGoldCustodyAsync(_context, loan, userId, disbDate);
                    if (string.Equals(custody.CustodyStatus, "REPLEDGED_BORROWING", StringComparison.OrdinalIgnoreCase))
                        return BadRequest($"पाकीट क्र. '{custody.PacketNumber}' (कर्ज क्र. {loan.LoanAccountNo}) आधीच दुसऱ्या बाह्य कर्जात पुनर्गहाण आहे!");
                    if (string.Equals(custody.CustodyStatus, "RELEASED_TO_CUSTOMER", StringComparison.OrdinalIgnoreCase))
                        return BadRequest($"पाकीट क्र. '{custody.PacketNumber}' आधीच खातेदारास परत केलेले आहे.");

                    validatedGoldPairs.Add((loan, custody, pIn));
                }
            }

            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                int seq = borrowing.Disbursements.Count + 1;
                string disbNo = $"DSB-{borrowing.BorrowingNo}-{seq:D2}";
                string vchNo = seq == 1 && !await _context.Vouchers.AnyAsync(v => v.VoucherNo == $"REC-BRW-{borrowing.BorrowingNo}")
                    ? $"REC-BRW-{borrowing.BorrowingNo}"
                    : $"REC-BRW-{borrowing.BorrowingNo}-{seq:D2}";

                while (await _context.Vouchers.AnyAsync(v => v.VoucherNo == vchNo))
                {
                    seq++;
                    vchNo = $"REC-BRW-{borrowing.BorrowingNo}-{seq:D2}";
                }

                var voucher = new Voucher
                {
                    BranchID = borrowing.BranchID,
                    VoucherNo = vchNo,
                    VoucherDate = disbDate,
                    VoucherType = totalDed > 0m ? "Journal" : "Receipt",
                    Narration = $"बाह्य कर्ज उचल ({borrowing.BorrowingType}) — {borrowing.LenderName}, खाते {borrowing.BorrowingNo}{(totalDed > 0m ? $" [कपात: ₹{totalDed:N2}, निव्वळ: ₹{netReceived:N2}]" : "")}",
                    TotalAmount = grossAmt,
                    Status = "Pending",
                    CreatedBy = userId,
                    CreatedOn = DateTime.UtcNow
                };
                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();

                _context.VoucherDetails.Add(new VoucherDetail
                {
                    VoucherID = voucher.VoucherID,
                    LedgerID = settlement.LedgerId,
                    DrCr = "Dr",
                    Amount = netReceived
                });

                if (totalDed > 0m && effectiveDeductionLedgerId.HasValue)
                {
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = effectiveDeductionLedgerId.Value,
                        DrCr = "Dr",
                        Amount = totalDed
                    });
                }

                _context.VoucherDetails.Add(new VoucherDetail
                {
                    VoucherID = voucher.VoucherID,
                    LedgerID = borrowing.BorrowingLiabilityLedgerID,
                    DrCr = "Cr",
                    Amount = grossAmt
                });

                await _context.SaveChangesAsync();
                await VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, voucher.VoucherID, voucher.VoucherNo);

                string effRemarks = req.IsOneStepCreate
                    ? $"[ONE_STEP_CREATE] {req.Remarks}".Trim()
                    : (req.Remarks?.Trim() ?? "");

                var disbRow = new SansthaBorrowingDisbursement
                {
                    BorrowingID = borrowing.BorrowingID,
                    BranchID = borrowing.BranchID,
                    DisbursementNo = disbNo,
                    DisbursementDate = disbDate,
                    GrossDisbursedAmount = grossAmt,
                    ProcessingFeeDeducted = procFee,
                    OtherDeductionsAmount = otherDed,
                    DeductionLedgerID = totalDed > 0m ? effectiveDeductionLedgerId : null,
                    NetReceivedAmount = netReceived,
                    PaymentMode = settlement.NormalizedMode,
                    BankLedgerID = settlement.NormalizedMode == "Cash" ? null : settlement.LedgerId,
                    ReferenceNo = req.ReferenceNo?.Trim(),
                    VoucherID = voucher.VoucherID,
                    Remarks = effRemarks,
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow
                };
                _context.SansthaBorrowingDisbursements.Add(disbRow);
                await _context.SaveChangesAsync();

                bool wasSanctioned = string.Equals(borrowing.Status, "Sanctioned", StringComparison.OrdinalIgnoreCase);
                if (wasSanctioned)
                {
                    borrowing.DisbursementDate = disbDate;
                    borrowing.DisbursementVoucherID = voucher.VoucherID;
                    borrowing.PaymentMode = settlement.NormalizedMode;
                    borrowing.BankLedgerID = settlement.NormalizedMode == "Cash" ? null : settlement.LedgerId;
                    borrowing.ReferenceNo = req.ReferenceNo?.Trim();
                }

                if (req.FirstInstallmentDueDate.HasValue)
                    borrowing.FirstInstallmentDueDate = req.FirstInstallmentDueDate.Value.Date;
                if (req.CustomInstallmentAmount.HasValue && req.CustomInstallmentAmount.Value > 0m)
                    borrowing.InstallmentAmount = Math.Round(req.CustomInstallmentAmount.Value, 2);

                borrowing.DisbursedAmount = Math.Round(borrowing.DisbursedAmount + grossAmt, 2, MidpointRounding.AwayFromZero);
                borrowing.OutstandingPrincipal = Math.Round(borrowing.OutstandingPrincipal + grossAmt, 2, MidpointRounding.AwayFromZero);
                borrowing.Status = "Active";
                borrowing.ClosedDate = null;
                borrowing.UpdatedAt = DateTime.UtcNow;

                // Attach Gold Pledges if any
                if (validatedGoldPairs.Any())
                {
                    decimal defaultSplit = Math.Round(grossAmt / validatedGoldPairs.Count, 2, MidpointRounding.AwayFromZero);
                    foreach (var (loan, custody, pIn) in validatedGoldPairs)
                    {
                        await _context.Entry(custody).Reference(c => c.OwnLocker).LoadAsync();
                        await _context.Entry(custody).Reference(c => c.ExternalLocker).LoadAsync();

                        string prevStatus = custody.CustodyStatus;
                        string prevLocation = GoldCustodyAndBorrowingHelper.FormatCustodyLocationSummary(custody);
                        decimal custRate = loan.InterestRate;
                        decimal spread = Math.Round(custRate - borrowing.BorrowingInterestRate, 2, MidpointRounding.AwayFromZero);

                        _context.SansthaBorrowingGoldPledges.Add(new SansthaBorrowingGoldPledge
                        {
                            BorrowingID = borrowing.BorrowingID,
                            BorrowingDisbursementID = disbRow.BorrowingDisbursementID,
                            LoanAccountID = loan.LoanAccountID,
                            GoldCustodyID = custody.GoldCustodyID,
                            CustomerLoanInterestRate = custRate,
                            InterestSpreadPercent = spread,
                            AllocatedBorrowedAmount = pIn.AllocatedBorrowedAmount > 0m ? pIn.AllocatedBorrowedAmount : defaultSplit,
                            LenderPledgeReceiptNo = pIn.LenderPledgeReceiptNo?.Trim(),
                            PledgedDate = disbDate,
                            PreviousCustodyStatus = prevStatus,
                            PreviousOwnLockerID = custody.OwnLockerID,
                            PreviousExternalLockerID = custody.ExternalLockerID,
                            PreviousVaultRackNo = custody.VaultRackOrTrayNo,
                            PledgeStatus = "Pledged"
                        });

                        custody.CustodyStatus = "REPLEDGED_BORROWING";
                        custody.ActiveBorrowingID = borrowing.BorrowingID;
                        custody.OwnLockerID = null;
                        custody.ExternalLockerID = null;
                        custody.VaultRackOrTrayNo = null;
                        custody.LastLocationUpdatedDate = disbDate;
                        custody.UpdatedAt = DateTime.UtcNow;

                        string newLocation = GoldCustodyAndBorrowingHelper.FormatCustodyLocationSummary(custody, null, null, borrowing);
                        _context.GoldCustodyMovementLogs.Add(new GoldCustodyMovementLog
                        {
                            GoldCustodyID = custody.GoldCustodyID,
                            LoanAccountID = loan.LoanAccountID,
                            FromStatus = prevStatus,
                            ToStatus = "REPLEDGED_BORROWING",
                            FromLocationSummary = prevLocation,
                            ToLocationSummary = newLocation,
                            ReferenceBorrowingID = borrowing.BorrowingID,
                            MovementDate = disbDate,
                            MovedByUserID = userId,
                            Remarks = $"बाह्य कर्ज पुनर्गहाण ({borrowing.LenderName}, कर्ज क्र. {borrowing.BorrowingNo})"
                        });
                    }
                }

                // Generate / Regenerate EMI Installment Schedule (except pure revolving CC/OD)
                int generatedSchedulesCount = 0;
                if (!string.Equals(borrowing.BorrowingType, "CASH_CREDIT_OD", StringComparison.OrdinalIgnoreCase))
                {
                    if (borrowing.InstallmentSchedules.Any())
                    {
                        _context.SansthaBorrowingInstallmentSchedules.RemoveRange(borrowing.InstallmentSchedules);
                        await _context.SaveChangesAsync();
                    }

                    var newSchedules = BorrowingScheduleService.GenerateSchedule(new BorrowingScheduleInput
                    {
                        PrincipalAmount = borrowing.DisbursedAmount,
                        AnnualInterestRate = borrowing.BorrowingInterestRate,
                        InstallmentType = borrowing.InstallmentType,
                        InstallmentFrequency = borrowing.InstallmentFrequency,
                        TenureMonths = borrowing.TenureMonths > 0 ? borrowing.TenureMonths : 12,
                        TotalInstallments = borrowing.TotalInstallments,
                        MoratoriumMonths = borrowing.MoratoriumMonths,
                        DisbursementDate = borrowing.DisbursementDate,
                        FirstInstallmentDueDate = borrowing.FirstInstallmentDueDate,
                        CustomInstallmentAmount = borrowing.InstallmentAmount > 0m ? borrowing.InstallmentAmount : null
                    });

                    if (borrowing.Repayments.Any())
                    {
                        BorrowingScheduleService.SynchronizeSchedules(borrowing, newSchedules, borrowing.Repayments, disbDate);
                    }

                    foreach (var s in newSchedules)
                    {
                        s.BorrowingID = borrowing.BorrowingID;
                        _context.SansthaBorrowingInstallmentSchedules.Add(s);
                    }

                    if (borrowing.InstallmentAmount <= 0m && newSchedules.Any())
                    {
                        borrowing.InstallmentAmount = newSchedules.First().TotalInstallmentAmount;
                    }
                    if (!borrowing.MaturityDate.HasValue && newSchedules.Any())
                    {
                        borrowing.MaturityDate = newSchedules.Last().DueDate;
                    }
                    generatedSchedulesCount = newSchedules.Count;
                }

                await _context.SaveChangesAsync();
                await tx.CommitAsync();

                return Ok(new
                {
                    message = $"बाह्य कर्ज उचल ₹{grossAmt:N2} यशस्वीरीत्या जतन झाली! व्हाउचर क्र. {voucher.VoucherNo} आणि {generatedSchedulesCount} हप्त्यांचे वेळापत्रक तयार झाले.",
                    borrowing.BorrowingID,
                    borrowing.BorrowingNo,
                    disbursementId = disbRow.BorrowingDisbursementID,
                    disbursementNo = disbRow.DisbursementNo,
                    voucherId = voucher.VoucherID,
                    voucherNo = voucher.VoucherNo,
                    generatedSchedulesCount
                });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                return BadRequest($"बाह्य कर्ज उचल नोंदवताना त्रुटी: {ex.Message}");
            }
        }

        // POST: api/Borrowings (Backward-compatible 1-step Create + Disbursement)
        [HttpPost]
        [Authorize(Roles = "Admin,SuperAdmin,Super Admin,SystemAdmin,HeadOffice,HO_Manager,HO Manager,GeneralManager,CEO,Chairman,Manager,BranchManager,Branch_Manager")]
        public async Task<ActionResult<object>> CreateBorrowing([FromBody] CreateBorrowingRequestDto req)
        {
            if (req == null) return BadRequest("कृपया बाह्य कर्जाची माहिती भरा.");
            if (req.DisbursedAmount <= 0m)
                return BadRequest("घेतलेली कर्ज रक्कम (Disbursed Amount) ₹0 पेक्षा जास्त असणे आवश्यक आहे.");

            decimal sanctioned = req.SanctionedAmount >= req.DisbursedAmount ? req.SanctionedAmount : req.DisbursedAmount;
            var accRes = await CreateBorrowingAccount(new CreateBorrowingAccountDto
            {
                BranchID = req.BranchID,
                LenderInstitutionID = req.LenderInstitutionID,
                LenderName = req.LenderName,
                LenderBranchName = req.LenderBranchName,
                ExternalLoanAccountNo = req.ExternalLoanAccountNo,
                SanctionLetterNo = req.SanctionLetterNo,
                BorrowingType = req.BorrowingType,
                PledgedInvestmentAccountID = req.PledgedInvestmentAccountID,
                SanctionDate = req.SanctionDate ?? req.DisbursementDate,
                MaturityDate = req.MaturityDate,
                SanctionedAmount = sanctioned,
                BorrowingInterestRate = req.BorrowingInterestRate,
                InterestCalculationMethod = req.InterestCalculationMethod,
                InstallmentType = req.InstallmentType ?? "EMI",
                InstallmentFrequency = req.InstallmentFrequency ?? "Monthly",
                TenureMonths = req.TenureMonths > 0 ? req.TenureMonths : 12,
                TotalInstallments = req.TotalInstallments,
                FirstInstallmentDueDate = req.FirstInstallmentDueDate,
                InstallmentAmount = req.InstallmentAmount,
                BorrowingLiabilityLedgerID = req.BorrowingLiabilityLedgerID,
                InterestExpenseLedgerID = req.InterestExpenseLedgerID,
                ProcessingChargesLedgerID = req.ProcessingChargesLedgerID,
                PurposeOrLinkedLoansNote = req.PurposeOrLinkedLoansNote,
                Remarks = req.Remarks
            });

            if (accRes.Result is not OkObjectResult okAcc)
                return accRes.Result!;

            var createdIdProp = okAcc.Value?.GetType().GetProperty("BorrowingID")?.GetValue(okAcc.Value);
            int createdBorrowingId = Convert.ToInt32(createdIdProp ?? 0);

            var disbRes = await DisburseBorrowing(createdBorrowingId, new BorrowingDisbursementRequestDto
            {
                DisbursementDate = req.DisbursementDate,
                GrossDisbursedAmount = req.DisbursedAmount,
                ProcessingFeeDeducted = req.ProcessingFeeDeducted,
                OtherDeductionsAmount = req.OtherDeductionsAmount,
                DeductionLedgerID = req.ProcessingChargesLedgerID,
                PaymentMode = req.PaymentMode,
                BankLedgerID = req.BankLedgerID,
                ReferenceNo = req.ReferenceNo,
                Remarks = req.Remarks,
                GoldPledges = req.GoldPledges,
                IsOneStepCreate = true
            });

            if (disbRes.Result is not OkObjectResult)
            {
                var orphan = await _context.SansthaBorrowings.FindAsync(createdBorrowingId);
                if (orphan != null && orphan.DisbursedAmount == 0m)
                {
                    _context.SansthaBorrowings.Remove(orphan);
                    await _context.SaveChangesAsync();
                }
            }

            return disbRes;
        }

        // =====================================================================
        // STEP 3 OF LIFECYCLE: LOAN REPAID & EMI SCHEDULE TRACKER
        // =====================================================================
        [HttpGet("{id}/repayment-preview")]
        public async Task<ActionResult<object>> GetRepaymentPreview(int id, [FromQuery] DateTime? asOfDate = null)
        {
            var borrowing = await _context.SansthaBorrowings
                .AsNoTracking()
                .Include(b => b.InstallmentSchedules)
                .Include(b => b.Repayments)
                .Include(b => b.GoldPledges)
                    .ThenInclude(p => p.GoldCustody)
                .Include(b => b.GoldPledges)
                    .ThenInclude(p => p.LoanAccount)
                        .ThenInclude(l => l!.Customer)
                .FirstOrDefaultAsync(b => b.BorrowingID == id);

            if (borrowing == null) return NotFound("बाह्य कर्ज खाते सापडले नाही.");

            DateTime calcDate = await ResolveBranchBusinessDateAsync(borrowing.BranchID, asOfDate);
            var schedules = borrowing.InstallmentSchedules.OrderBy(s => s.InstallmentNo).ToList();
            if (schedules.Any() && borrowing.Status == "Active")
            {
                BorrowingScheduleService.SynchronizeSchedules(borrowing, schedules, borrowing.Repayments, calcDate);
            }

            var (accruedInterest, accruedDays, intFromDate) = BorrowingScheduleService.CalculateAccruedInterest(borrowing, calcDate);
            var overdueRows = schedules.Where(s => s.Status == "Overdue").ToList();
            var nextUnpaid = schedules.FirstOrDefault(s => s.Status != "Paid");

            decimal overduePrin = Math.Round(overdueRows.Sum(s => Math.Max(0m, s.PrincipalDue - s.PrincipalPaid)), 2);
            decimal overdueInt = Math.Round(overdueRows.Sum(s => Math.Max(0m, s.InterestDue - s.InterestPaid)), 2);

            decimal suggestedPrin = overdueRows.Any()
                ? overduePrin
                : (nextUnpaid != null ? Math.Max(0m, nextUnpaid.PrincipalDue - nextUnpaid.PrincipalPaid) : borrowing.OutstandingPrincipal);
            if (suggestedPrin > borrowing.OutstandingPrincipal) suggestedPrin = borrowing.OutstandingPrincipal;

            decimal suggestedInt = overdueRows.Any()
                ? Math.Max(overdueInt, accruedInterest)
                : (nextUnpaid != null ? Math.Max(0m, nextUnpaid.InterestDue - nextUnpaid.InterestPaid) : accruedInterest);

            return Ok(new
            {
                borrowing.BorrowingID,
                borrowing.BorrowingNo,
                borrowing.LenderName,
                borrowing.ExternalLoanAccountNo,
                borrowing.BorrowingType,
                borrowing.SanctionedAmount,
                borrowing.DisbursedAmount,
                borrowing.OutstandingPrincipal,
                borrowing.BorrowingInterestRate,
                borrowing.Status,
                asOfDate = calcDate,
                interestFromDate = intFromDate,
                accruedDays,
                accruedInterest,
                overdueCount = overdueRows.Count,
                overduePrincipal = overduePrin,
                overdueInterest = overdueInt,
                suggestedRegularPrincipal = Math.Round(suggestedPrin, 2),
                suggestedRegularInterest = Math.Round(suggestedInt, 2),
                foreclosurePrincipal = borrowing.OutstandingPrincipal,
                foreclosureInterest = accruedInterest,
                schedules = schedules.Select(s => new
                {
                    s.ScheduleID,
                    s.InstallmentNo,
                    s.DueDate,
                    s.OpeningPrincipal,
                    s.PrincipalDue,
                    s.InterestDue,
                    s.TotalInstallmentAmount,
                    s.ClosingPrincipal,
                    s.PrincipalPaid,
                    s.InterestPaid,
                    s.PenaltyPaid,
                    s.PaidDate,
                    s.Status,
                    RemainingDue = Math.Max(0m, Math.Round(s.TotalInstallmentAmount - s.PrincipalPaid - s.InterestPaid, 2))
                })
            });
        }

        // POST: api/Borrowings/{id}/repay
        [HttpPost("{id}/repay")]
        [Authorize(Roles = "Admin,SuperAdmin,Super Admin,SystemAdmin,HeadOffice,HO_Manager,HO Manager,GeneralManager,CEO,Chairman,Manager,BranchManager,Branch_Manager,Cashier")]
        public async Task<ActionResult<object>> RepayBorrowing(int id, [FromBody] BorrowingRepaymentRequestDto req)
        {
            if (req == null) return BadRequest("कृपया परतफेडीची माहिती भरा.");

            var borrowing = await _context.SansthaBorrowings
                .Include(b => b.DisbursementVoucher)
                .Include(b => b.InstallmentSchedules)
                .Include(b => b.GoldPledges)
                    .ThenInclude(p => p.GoldCustody)
                .Include(b => b.Repayments)
                    .ThenInclude(r => r.Voucher)
                .FirstOrDefaultAsync(b => b.BorrowingID == id);

            if (borrowing == null) return NotFound("बाह्य कर्ज खाते सापडले नाही.");
            if (!string.Equals(borrowing.Status, "Active", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest($"बाह्य कर्ज '{borrowing.BorrowingNo}' सक्रिय (Active) स्थितीत नाही (सध्या: {borrowing.Status}).");
            }

            if (borrowing.DisbursementVoucher != null &&
                string.Equals(borrowing.DisbursementVoucher.Status, "Rejected", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest("या बाह्य कर्जाचे मूळ वाटप व्हाउचर नाकारलेले (Rejected) आहे.");
            }

            bool hasPendingRepayment = borrowing.Repayments.Any(r =>
                r.Voucher != null && string.Equals(r.Voucher.Status, "Pending", StringComparison.OrdinalIgnoreCase));
            if (hasPendingRepayment)
            {
                return BadRequest("या बाह्य कर्जाचे मागील परतफेड व्हाउचर अद्याप प्रलंबित (Pending Passing) आहे. आधी ते पास करा.");
            }

            DateTime repayDate = req.RepaymentDate.Date;
            string? dateErr = await ValidateDateGuardsAsync(borrowing.BranchID, repayDate);
            if (dateErr != null) return BadRequest(dateErr);

            decimal prinPaid = Math.Max(0m, Math.Round(req.PrincipalPaid, 2, MidpointRounding.AwayFromZero));
            decimal intPaid = Math.Max(0m, Math.Round(req.InterestPaid, 2, MidpointRounding.AwayFromZero));
            decimal penPaid = Math.Max(0m, Math.Round(req.PenalOrChargesPaid, 2, MidpointRounding.AwayFromZero));
            decimal totalPaid = Math.Round(prinPaid + intPaid + penPaid, 2, MidpointRounding.AwayFromZero);

            if (totalPaid <= 0m)
                return BadRequest("परतफेडीची एकूण रक्कम ₹0 पेक्षा जास्त असणे आवश्यक आहे.");

            if (prinPaid > borrowing.OutstandingPrincipal + 0.01m)
                return BadRequest($"मुद्दल परतफेड (₹{prinPaid:N2}) ही येणे मुद्दल बाकीपेक्षा (₹{borrowing.OutstandingPrincipal:N2}) जास्त असू शकत नाही.");

            int? effectiveChargesLedgerId = req.ChargesLedgerID > 0
                ? req.ChargesLedgerID
                : (borrowing.ProcessingChargesLedgerID ?? borrowing.InterestExpenseLedgerID);

            if (penPaid > 0m && req.ChargesLedgerID > 0)
            {
                var chgCheck = await GoldCustodyAndBorrowingHelper.ValidateBorrowingDeductionOrChargesLedgerAsync(_context, req.ChargesLedgerID);
                if (!chgCheck.IsValid) return BadRequest(chgCheck.ErrorMessage);
            }

            int branchId = borrowing.BranchID;
            var settlement = await GoldCustodyAndBorrowingHelper.ResolveSettlementLedgerAsync(_context, branchId, req.PaymentMode, req.BankLedgerID);
            if (!settlement.IsValid) return BadRequest(settlement.ErrorMessage);

            int userId = ResolveUserId();

            var previouslyPaidNos = borrowing.InstallmentSchedules
                .Where(s => s.Status == "Paid")
                .Select(s => s.InstallmentNo)
                .ToHashSet();

            decimal balBefore = borrowing.OutstandingPrincipal;
            DateTime? prevIntPaidDate = borrowing.LastInterestPaidDate;

            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                int nextRepaySeq = borrowing.Repayments.Count + 1;
                string repayNo = $"RPY-{borrowing.BorrowingNo}-{nextRepaySeq:D2}";
                string vchNo = $"PAY-BRW-{borrowing.BorrowingNo}-{nextRepaySeq:D2}";
                while (await _context.Vouchers.AnyAsync(v => v.VoucherNo == vchNo))
                {
                    nextRepaySeq++;
                    repayNo = $"RPY-{borrowing.BorrowingNo}-{nextRepaySeq:D2}";
                    vchNo = $"PAY-BRW-{borrowing.BorrowingNo}-{nextRepaySeq:D2}";
                }

                var voucher = new Voucher
                {
                    BranchID = branchId,
                    VoucherNo = vchNo,
                    VoucherDate = repayDate,
                    VoucherType = "Payment",
                    Narration = $"बाह्य कर्ज परतफेड — {borrowing.LenderName} ({borrowing.BorrowingNo}) [मुद्दल: ₹{prinPaid:N2}, व्याज: ₹{intPaid:N2}{(penPaid > 0 ? $", दंड/शुल्क: ₹{penPaid:N2}" : "")}]",
                    TotalAmount = totalPaid,
                    Status = "Pending",
                    CreatedBy = userId,
                    CreatedOn = DateTime.UtcNow
                };
                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();

                if (prinPaid > 0m)
                {
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = borrowing.BorrowingLiabilityLedgerID,
                        DrCr = "Dr",
                        Amount = prinPaid
                    });
                }

                if (penPaid > 0m && effectiveChargesLedgerId.HasValue && effectiveChargesLedgerId.Value != borrowing.InterestExpenseLedgerID)
                {
                    if (intPaid > 0m)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = borrowing.InterestExpenseLedgerID,
                            DrCr = "Dr",
                            Amount = intPaid
                        });
                    }
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = effectiveChargesLedgerId.Value,
                        DrCr = "Dr",
                        Amount = penPaid
                    });
                }
                else if (intPaid + penPaid > 0m)
                {
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = borrowing.InterestExpenseLedgerID,
                        DrCr = "Dr",
                        Amount = Math.Round(intPaid + penPaid, 2, MidpointRounding.AwayFromZero)
                    });
                }

                _context.VoucherDetails.Add(new VoucherDetail
                {
                    VoucherID = voucher.VoucherID,
                    LedgerID = settlement.LedgerId,
                    DrCr = "Cr",
                    Amount = totalPaid
                });
                await _context.SaveChangesAsync();
                await VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, voucher.VoucherID, voucher.VoucherNo);

                decimal balAfter = Math.Max(0m, Math.Round(borrowing.OutstandingPrincipal - prinPaid, 2, MidpointRounding.AwayFromZero));
                bool isFullyClosed = balAfter <= 0.009m &&
                                     (!string.Equals(borrowing.BorrowingType, "CASH_CREDIT_OD", StringComparison.OrdinalIgnoreCase) || req.CloseAccount);

                string effRepayType = !string.IsNullOrWhiteSpace(req.RepaymentType)
                    ? req.RepaymentType.Trim()
                    : (isFullyClosed ? "Foreclosure" : (prinPaid <= 0m ? "InterestOnly" : "RegularEMI"));

                var repayment = new SansthaBorrowingRepayment
                {
                    BorrowingID = borrowing.BorrowingID,
                    BranchID = branchId,
                    RepaymentNo = repayNo,
                    RepaymentType = effRepayType,
                    RepaymentDate = repayDate,
                    PrincipalPaid = prinPaid,
                    InterestPaid = intPaid,
                    PenalOrChargesPaid = penPaid,
                    ChargesLedgerID = penPaid > 0m ? effectiveChargesLedgerId : null,
                    TotalPaid = totalPaid,
                    BalanceBeforeRepayment = balBefore,
                    BalanceAfterRepayment = balAfter,
                    PreviousLastInterestPaidDate = prevIntPaidDate,
                    PaymentMode = settlement.NormalizedMode,
                    BankLedgerID = settlement.NormalizedMode == "Cash" ? null : settlement.LedgerId,
                    ReferenceNo = req.ReferenceNo?.Trim(),
                    VoucherID = voucher.VoucherID,
                    Remarks = req.Remarks?.Trim(),
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow
                };
                _context.SansthaBorrowingRepayments.Add(repayment);
                await _context.SaveChangesAsync();

                borrowing.OutstandingPrincipal = isFullyClosed ? 0m : balAfter;
                borrowing.TotalInterestPaid = Math.Round(borrowing.TotalInterestPaid + intPaid + penPaid, 2, MidpointRounding.AwayFromZero);
                if (intPaid > 0m || isFullyClosed)
                {
                    borrowing.LastInterestPaidDate = repayDate;
                }
                borrowing.UpdatedAt = DateTime.UtcNow;

                if (isFullyClosed)
                {
                    borrowing.Status = "Closed";
                    borrowing.ClosedDate = repayDate;
                }

                // Synchronize EMI Installment Schedule
                var schedulesList = borrowing.InstallmentSchedules.OrderBy(s => s.InstallmentNo).ToList();
                if (schedulesList.Any())
                {
                    var allRepayments = borrowing.Repayments.ToList();
                    if (!allRepayments.Any(r => r.BorrowingRepaymentID == repayment.BorrowingRepaymentID))
                    {
                        allRepayments.Add(repayment);
                    }
                    BorrowingScheduleService.SynchronizeSchedules(borrowing, schedulesList, allRepayments, repayDate);

                    var newlyPaidNos = schedulesList
                        .Where(s => s.Status == "Paid" && !previouslyPaidNos.Contains(s.InstallmentNo))
                        .Select(s => s.InstallmentNo)
                        .ToList();

                    if (newlyPaidNos.Any())
                    {
                        repayment.InstallmentsCovered = $"हप्ता क्र. {string.Join(", ", newlyPaidNos)}";
                    }

                    foreach (var sch in schedulesList)
                    {
                        _context.Entry(sch).State = EntityState.Modified;
                    }
                }

                var releaseIdsSet = (req.ReleaseGoldCustodyIds ?? new List<int>()).ToHashSet();
                var pledgesToRelease = borrowing.GoldPledges
                    .Where(p => p.PledgeStatus == "Pledged" && (isFullyClosed || releaseIdsSet.Contains(p.GoldCustodyID)))
                    .ToList();

                foreach (var pledge in pledgesToRelease)
                {
                    await ReleaseSingleGoldPledgeAsync(
                        pledge,
                        borrowing,
                        repayDate,
                        userId,
                        repayment.BorrowingRepaymentID,
                        req.ReturnCustodyStatus,
                        req.ReturnOwnLockerID,
                        req.ReturnExternalLockerID,
                        isFullyClosed ? "बाह्य कर्ज पूर्ण परतफेड — पुनर्गहाण मुक्त" : "हप्ता परतफेडीत पाकीट सोडवले");
                }

                await _context.SaveChangesAsync();
                await tx.CommitAsync();

                return Ok(new
                {
                    message = isFullyClosed
                        ? $"बाह्य कर्ज '{borrowing.BorrowingNo}' पूर्णपणे फेडले गेले व {pledgesToRelease.Count} सोने पाकिटे संस्थेच्या कस्टडीत परत आली!"
                        : $"बाह्य कर्ज परतफेड ₹{totalPaid:N2} यशस्वीरीत्या नोंदवली (व्हाउचर: {voucher.VoucherNo}{(string.IsNullOrEmpty(repayment.InstallmentsCovered) ? "" : $", {repayment.InstallmentsCovered} पूर्ण")}).",
                    repayment.BorrowingRepaymentID,
                    repayment.RepaymentNo,
                    repayment.InstallmentsCovered,
                    voucherId = voucher.VoucherID,
                    voucherNo = voucher.VoucherNo,
                    isClosed = isFullyClosed,
                    releasedPacketsCount = pledgesToRelease.Count,
                    remainingPrincipal = borrowing.OutstandingPrincipal
                });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                return BadRequest($"बाह्य कर्ज परतफेड नोंदवताना त्रुटी: {ex.Message}");
            }
        }

        // GET: api/Borrowings/upcoming-emis?days=30
        [HttpGet("upcoming-emis")]
        public async Task<ActionResult<object>> GetUpcomingAndOverdueEmis(
            [FromQuery] int? branchId = null,
            [FromQuery] int days = 30)
        {
            int? resolvedBranch = User.ResolveOptionalBranchId(branchId);
            int effBranch = resolvedBranch.HasValue && resolvedBranch.Value > 0 ? resolvedBranch.Value : 1;
            DateTime businessDate = await ResolveBranchBusinessDateAsync(effBranch);
            DateTime horizonDate = businessDate.AddDays(Math.Max(0, days));

            var query = _context.SansthaBorrowings
                .AsNoTracking()
                .Include(b => b.InstallmentSchedules)
                .Include(b => b.Repayments)
                .Where(b => b.Status == "Active");

            if (resolvedBranch.HasValue && resolvedBranch.Value > 0)
            {
                query = query.Where(b => b.BranchID == resolvedBranch.Value);
            }

            var activeBorrowings = await query.ToListAsync();
            var dueRows = new List<object>();

            foreach (var b in activeBorrowings)
            {
                var schedules = b.InstallmentSchedules.OrderBy(s => s.InstallmentNo).ToList();
                if (!schedules.Any()) continue;

                BorrowingScheduleService.SynchronizeSchedules(b, schedules, b.Repayments, businessDate);

                foreach (var s in schedules.Where(x => x.Status != "Paid" && x.DueDate.Date <= horizonDate))
                {
                    int daysDiff = (s.DueDate.Date - businessDate).Days;
                    decimal remPrin = Math.Max(0m, Math.Round(s.PrincipalDue - s.PrincipalPaid, 2));
                    decimal remInt = Math.Max(0m, Math.Round(s.InterestDue - s.InterestPaid, 2));
                    decimal remTotal = Math.Max(0m, Math.Round(s.TotalInstallmentAmount - s.PrincipalPaid - s.InterestPaid, 2));

                    dueRows.Add(new
                    {
                        b.BorrowingID,
                        b.BorrowingNo,
                        b.LenderName,
                        b.LenderBranchName,
                        b.ExternalLoanAccountNo,
                        b.BorrowingType,
                        b.BorrowingInterestRate,
                        b.OutstandingPrincipal,
                        s.ScheduleID,
                        s.InstallmentNo,
                        s.DueDate,
                        PrincipalDue = remPrin,
                        InterestDue = remInt,
                        TotalDue = remTotal,
                        s.Status,
                        DaysRemaining = daysDiff,
                        IsOverdue = daysDiff < 0,
                        OverdueDays = daysDiff < 0 ? Math.Abs(daysDiff) : 0
                    });
                }
            }

            var sorted = dueRows
                .OrderBy(r => (DateTime)r.GetType().GetProperty("DueDate")!.GetValue(r)!)
                .ToList();

            return Ok(new
            {
                businessDate,
                horizonDate,
                count = sorted.Count,
                items = sorted
            });
        }

        // GET: api/Borrowings/{id}/ledger (Account Khatavani & Passbook Statement)
        [HttpGet("{id}/ledger")]
        public async Task<ActionResult<object>> GetBorrowingLedgerStatement(int id)
        {
            var b = await _context.SansthaBorrowings
                .AsNoTracking()
                .Include(x => x.Branch)
                .Include(x => x.BorrowingLiabilityLedger)
                .Include(x => x.InterestExpenseLedger)
                .Include(x => x.Disbursements)
                    .ThenInclude(d => d.Voucher)
                .Include(x => x.Repayments)
                    .ThenInclude(r => r.Voucher)
                .Include(x => x.InstallmentSchedules)
                .Include(x => x.GoldPledges)
                    .ThenInclude(p => p.GoldCustody)
                .Include(x => x.GoldPledges)
                    .ThenInclude(p => p.LoanAccount)
                        .ThenInclude(l => l!.Customer)
                .FirstOrDefaultAsync(x => x.BorrowingID == id);

            if (b == null) return NotFound("बाह्य कर्ज खाते सापडले नाही.");

            DateTime bizDate = await ResolveBranchBusinessDateAsync(b.BranchID);
            var schedules = b.InstallmentSchedules.OrderBy(s => s.InstallmentNo).ToList();
            if (schedules.Any() && b.Status == "Active")
            {
                BorrowingScheduleService.SynchronizeSchedules(b, schedules, b.Repayments, bizDate);
            }

            var rawEvents = new List<(DateTime Date, int OrderKey, string TxType, string RefNo, string Particulars, decimal CreditBorrowed, decimal DebitPrincipalPaid, decimal InterestAndCharges, string VoucherNo, string VoucherStatus)>();

            if (b.IsOpeningBalance && !b.Disbursements.Any())
            {
                rawEvents.Add((
                    b.DisbursementDate,
                    0,
                    "OPENING",
                    b.BorrowingNo,
                    "आरंभिक येणे बाह्य कर्ज शिल्लक (Opening Balance)",
                    b.DisbursedAmount,
                    0m,
                    0m,
                    "OB",
                    "Approved"));
            }

            foreach (var d in b.Disbursements.OrderBy(x => x.DisbursementDate).ThenBy(x => x.BorrowingDisbursementID))
            {
                rawEvents.Add((
                    d.DisbursementDate,
                    1,
                    "DISBURSEMENT",
                    d.DisbursementNo,
                    $"बाह्य कर्ज उचल ({d.PaymentMode}){(d.ProcessingFeeDeducted + d.OtherDeductionsAmount > 0 ? $" [कपात: ₹{d.ProcessingFeeDeducted + d.OtherDeductionsAmount:N2}]" : "")}",
                    d.GrossDisbursedAmount,
                    0m,
                    0m,
                    d.Voucher?.VoucherNo ?? "",
                    d.Voucher?.Status ?? "Approved"));
            }

            foreach (var r in b.Repayments.OrderBy(x => x.RepaymentDate).ThenBy(x => x.BorrowingRepaymentID))
            {
                rawEvents.Add((
                    r.RepaymentDate,
                    2,
                    "REPAYMENT",
                    r.RepaymentNo ?? $"RPY-{r.BorrowingRepaymentID}",
                    $"हप्ता परतफेड ({r.RepaymentType}){(string.IsNullOrEmpty(r.InstallmentsCovered) ? "" : $" — {r.InstallmentsCovered}")}",
                    0m,
                    r.PrincipalPaid,
                    r.InterestPaid + r.PenalOrChargesPaid,
                    r.Voucher?.VoucherNo ?? "",
                    r.Voucher?.Status ?? "Approved"));
            }

            decimal runningPrincipal = 0m;
            var entries = rawEvents
                .OrderBy(e => e.Date)
                .ThenBy(e => e.OrderKey)
                .Select((e, idx) =>
                {
                    runningPrincipal = Math.Max(0m, Math.Round(runningPrincipal + e.CreditBorrowed - e.DebitPrincipalPaid, 2));
                    return new
                    {
                        srNo = idx + 1,
                        date = e.Date,
                        txType = e.TxType,
                        refNo = e.RefNo,
                        particulars = e.Particulars,
                        creditBorrowed = e.CreditBorrowed,
                        debitPrincipalPaid = e.DebitPrincipalPaid,
                        interestAndChargesPaid = e.InterestAndCharges,
                        runningPrincipalBalance = runningPrincipal,
                        voucherNo = e.VoucherNo,
                        voucherStatus = e.VoucherStatus
                    };
                })
                .ToList();

            return Ok(new
            {
                account = new
                {
                    b.BorrowingID,
                    b.BorrowingNo,
                    BranchName = b.Branch?.BranchName ?? "मुख्य शाखा",
                    b.LenderName,
                    b.LenderBranchName,
                    b.ExternalLoanAccountNo,
                    b.SanctionLetterNo,
                    b.BorrowingType,
                    b.SanctionDate,
                    b.DisbursementDate,
                    b.MaturityDate,
                    b.SanctionedAmount,
                    b.DisbursedAmount,
                    b.OutstandingPrincipal,
                    b.TotalInterestPaid,
                    b.BorrowingInterestRate,
                    b.InstallmentType,
                    b.InstallmentFrequency,
                    b.TenureMonths,
                    b.InstallmentAmount,
                    LiabilityLedgerName = b.BorrowingLiabilityLedger?.LedgerName ?? "",
                    InterestExpenseLedgerName = b.InterestExpenseLedger?.LedgerName ?? "",
                    b.Status,
                    b.ClosedDate
                },
                entries,
                schedules = schedules.Select(s => new
                {
                    s.InstallmentNo,
                    s.DueDate,
                    s.OpeningPrincipal,
                    s.PrincipalDue,
                    s.InterestDue,
                    s.TotalInstallmentAmount,
                    s.ClosingPrincipal,
                    s.PrincipalPaid,
                    s.InterestPaid,
                    s.PaidDate,
                    s.Status
                })
            });
        }

        // GET: api/Borrowings/by-voucher/{voucherId} (Checker Passing Inspection)
        [HttpGet("by-voucher/{voucherId}")]
        public async Task<ActionResult<object>> GetBorrowingByVoucher(int voucherId)
        {
            var voucher = await _context.Vouchers
                .AsNoTracking()
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Ledger)
                .FirstOrDefaultAsync(v => v.VoucherID == voucherId);

            if (voucher == null) return NotFound("व्हाउचर सापडले नाही.");

            var disb = await _context.SansthaBorrowingDisbursements
                .AsNoTracking()
                .Include(d => d.Borrowing)
                .FirstOrDefaultAsync(d => d.VoucherID == voucherId);

            if (disb?.Borrowing != null)
            {
                return Ok(new
                {
                    transactionType = "Disbursement",
                    borrowing = new
                    {
                        disb.Borrowing.BorrowingID,
                        disb.Borrowing.BorrowingNo,
                        disb.Borrowing.LenderName,
                        disb.Borrowing.ExternalLoanAccountNo,
                        disb.Borrowing.BorrowingType,
                        disb.Borrowing.BorrowingInterestRate,
                        disb.Borrowing.OutstandingPrincipal
                    },
                    details = new
                    {
                        disb.DisbursementNo,
                        Date = disb.DisbursementDate,
                        Amount = disb.GrossDisbursedAmount,
                        Deductions = disb.ProcessingFeeDeducted + disb.OtherDeductionsAmount,
                        NetAmount = disb.NetReceivedAmount,
                        disb.PaymentMode,
                        disb.ReferenceNo,
                        disb.Remarks
                    },
                    voucher = new
                    {
                        voucher.VoucherID,
                        voucher.VoucherNo,
                        voucher.VoucherDate,
                        voucher.VoucherType,
                        voucher.TotalAmount,
                        voucher.Status,
                        voucher.Narration,
                        CanPass = voucher.Status == "Pending" || voucher.Status == "Unapproved",
                        VoucherDetails = voucher.VoucherDetails.Select(vd => new
                        {
                            vd.VoucherDetailID,
                            LedgerName = vd.Ledger?.LedgerName ?? $"Ledger #{vd.LedgerID}",
                            vd.DrCr,
                            vd.Amount
                        })
                    }
                });
            }

            var repay = await _context.SansthaBorrowingRepayments
                .AsNoTracking()
                .Include(r => r.Borrowing)
                .FirstOrDefaultAsync(r => r.VoucherID == voucherId);

            if (repay?.Borrowing != null)
            {
                return Ok(new
                {
                    transactionType = "Repayment",
                    borrowing = new
                    {
                        repay.Borrowing.BorrowingID,
                        repay.Borrowing.BorrowingNo,
                        repay.Borrowing.LenderName,
                        repay.Borrowing.ExternalLoanAccountNo,
                        repay.Borrowing.BorrowingType,
                        repay.Borrowing.BorrowingInterestRate,
                        repay.Borrowing.OutstandingPrincipal
                    },
                    details = new
                    {
                        repay.RepaymentNo,
                        repay.RepaymentType,
                        repay.InstallmentsCovered,
                        Date = repay.RepaymentDate,
                        repay.PrincipalPaid,
                        repay.InterestPaid,
                        repay.PenalOrChargesPaid,
                        Amount = repay.TotalPaid,
                        repay.PaymentMode,
                        repay.ReferenceNo,
                        repay.Remarks
                    },
                    voucher = new
                    {
                        voucher.VoucherID,
                        voucher.VoucherNo,
                        voucher.VoucherDate,
                        voucher.VoucherType,
                        voucher.TotalAmount,
                        voucher.Status,
                        voucher.Narration,
                        CanPass = voucher.Status == "Pending" || voucher.Status == "Unapproved",
                        VoucherDetails = voucher.VoucherDetails.Select(vd => new
                        {
                            vd.VoucherDetailID,
                            LedgerName = vd.Ledger?.LedgerName ?? $"Ledger #{vd.LedgerID}",
                            vd.DrCr,
                            vd.Amount
                        })
                    }
                });
            }

            return NotFound("या व्हाउचरशी संलग्न बाह्य कर्ज व्यवहार सापडला नाही.");
        }

        // POST: api/Borrowings/{id}/unpledge-packets
        [HttpPost("{id}/unpledge-packets")]
        [Authorize(Roles = "Admin,SuperAdmin,Super Admin,SystemAdmin,HeadOffice,HO_Manager,HO Manager,GeneralManager,CEO,Chairman,Manager,BranchManager,Branch_Manager")]
        public async Task<ActionResult<object>> UnpledgeGoldPackets(int id, [FromBody] UnpledgeGoldPacketsRequestDto req)
        {
            if (req == null || req.GoldCustodyIds == null || !req.GoldCustodyIds.Any())
                return BadRequest("सोडवण्यासाठी किमान एक सोने पाकीट निवडा.");

            var borrowing = await _context.SansthaBorrowings
                .Include(b => b.GoldPledges)
                    .ThenInclude(p => p.GoldCustody)
                .FirstOrDefaultAsync(b => b.BorrowingID == id);

            if (borrowing == null) return NotFound("बाह्य कर्ज खाते सापडले नाही.");

            var targetSet = req.GoldCustodyIds.ToHashSet();
            var matchingPledges = borrowing.GoldPledges
                .Where(p => p.PledgeStatus == "Pledged" && targetSet.Contains(p.GoldCustodyID))
                .ToList();

            if (!matchingPledges.Any())
                return BadRequest("निवडलेली सोने पाकिटे या कर्जाखाली सध्या पुनर्गहाण नाहीत.");

            DateTime relDate = (req.ReleaseDate ?? await ResolveBranchBusinessDateAsync(borrowing.BranchID)).Date;
            int userId = ResolveUserId();

            foreach (var pledge in matchingPledges)
            {
                await ReleaseSingleGoldPledgeAsync(
                    pledge,
                    borrowing,
                    relDate,
                    userId,
                    null,
                    req.ReturnCustodyStatus,
                    req.ReturnOwnLockerID,
                    req.ReturnExternalLockerID,
                    req.Remarks ?? "बाह्य संस्थेकडून सोने पाकीट सोडवून घेतले (Unpledged)");
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"{matchingPledges.Count} सोने पाकीट(टे) बाह्य कर्जातून सोडवून संस्थेच्या तिजोरीत/लॉकरमध्ये परत घेतली!",
                releasedCount = matchingPledges.Count
            });
        }

        private async Task ReleaseSingleGoldPledgeAsync(
            SansthaBorrowingGoldPledge pledge,
            SansthaBorrowing borrowing,
            DateTime releaseDate,
            int userId,
            int? repaymentId,
            string? overrideReturnStatus,
            int? overrideOwnLockerId,
            int? overrideExternalLockerId,
            string reason)
        {
            var custody = pledge.GoldCustody
                ?? await _context.GoldLoanCustodies.FirstOrDefaultAsync(c => c.GoldCustodyID == pledge.GoldCustodyID);

            string prevSummary = GoldCustodyAndBorrowingHelper.FormatCustodyLocationSummary(custody, null, null, borrowing);

            string restoreStatus = !string.IsNullOrWhiteSpace(overrideReturnStatus)
                ? overrideReturnStatus.Trim().ToUpperInvariant()
                : (string.IsNullOrWhiteSpace(pledge.PreviousCustodyStatus) ? "BRANCH_SAFE" : pledge.PreviousCustodyStatus);

            if (restoreStatus != "OWN_LOCKER" && restoreStatus != "EXTERNAL_LOCKER")
            {
                restoreStatus = "BRANCH_SAFE";
            }

            int? restoreOwnLockerId = restoreStatus == "OWN_LOCKER"
                ? (overrideOwnLockerId ?? pledge.PreviousOwnLockerID)
                : null;
            int? restoreExtLockerId = restoreStatus == "EXTERNAL_LOCKER"
                ? (overrideExternalLockerId ?? pledge.PreviousExternalLockerID)
                : null;

            if (restoreStatus == "OWN_LOCKER" && !restoreOwnLockerId.HasValue) restoreStatus = "BRANCH_SAFE";
            if (restoreStatus == "EXTERNAL_LOCKER" && !restoreExtLockerId.HasValue) restoreStatus = "BRANCH_SAFE";

            pledge.PledgeStatus = "Released";
            pledge.ReleasedDate = releaseDate;
            pledge.ReleasedOnRepaymentID = repaymentId;
            pledge.ReleaseRemarks = reason;

            if (custody != null && !string.Equals(custody.CustodyStatus, "RELEASED_TO_CUSTOMER", StringComparison.OrdinalIgnoreCase))
            {
                custody.CustodyStatus = restoreStatus;
                custody.ActiveBorrowingID = null;
                custody.OwnLockerID = restoreOwnLockerId;
                custody.ExternalLockerID = restoreExtLockerId;
                custody.VaultRackOrTrayNo = restoreStatus == "BRANCH_SAFE" ? (pledge.PreviousVaultRackNo ?? "मुख्य तिजोरी") : null;
                custody.LastLocationUpdatedDate = releaseDate;
                custody.UpdatedAt = DateTime.UtcNow;

                Locker? ownLkr = restoreOwnLockerId.HasValue ? await _context.Lockers.AsNoTracking().FirstOrDefaultAsync(l => l.LockerID == restoreOwnLockerId.Value) : null;
                SansthaExternalLocker? extLkr = restoreExtLockerId.HasValue ? await _context.SansthaExternalLockers.AsNoTracking().FirstOrDefaultAsync(e => e.ExternalLockerID == restoreExtLockerId.Value) : null;
                string newSummary = GoldCustodyAndBorrowingHelper.FormatCustodyLocationSummary(custody, ownLkr, extLkr, null);

                _context.GoldCustodyMovementLogs.Add(new GoldCustodyMovementLog
                {
                    GoldCustodyID = custody.GoldCustodyID,
                    LoanAccountID = custody.LoanAccountID,
                    FromStatus = "REPLEDGED_BORROWING",
                    ToStatus = restoreStatus,
                    FromLocationSummary = prevSummary,
                    ToLocationSummary = newSummary,
                    ReferenceBorrowingID = borrowing.BorrowingID,
                    MovementDate = releaseDate,
                    MovedByUserID = userId,
                    Remarks = reason
                });
            }
        }
    }

    public class CreateLenderInstitutionDto
    {
        public int BranchID { get; set; } = 1;
        public string InstitutionName { get; set; } = string.Empty;
        public string InstitutionType { get; set; } = "Bank";
        public string? InstitutionBranchName { get; set; }
        public string? Address { get; set; }
        public string? ContactPerson { get; set; }
        public string? MobileNumber { get; set; }
    }

    public class CreateBorrowingAccountDto
    {
        public int BranchID { get; set; } = 1;
        public int? LenderInstitutionID { get; set; }
        public string LenderName { get; set; } = string.Empty;
        public string? LenderBranchName { get; set; }
        public string? ExternalLoanAccountNo { get; set; }
        public string? SanctionLetterNo { get; set; }
        public string BorrowingType { get; set; } = "GOLD_REPLEDGE";
        public int? PledgedInvestmentAccountID { get; set; }
        public DateTime? SanctionDate { get; set; }
        public DateTime? MaturityDate { get; set; }
        public decimal SanctionedAmount { get; set; }
        public decimal BorrowingInterestRate { get; set; }
        public decimal PenalInterestRate { get; set; } = 0m;
        public string? InterestCalculationMethod { get; set; } = "Reducing";
        public string? InstallmentType { get; set; } = "EMI";
        public string? InstallmentFrequency { get; set; } = "Monthly";
        public int TenureMonths { get; set; } = 12;
        public int TotalInstallments { get; set; } = 12;
        public int MoratoriumMonths { get; set; } = 0;
        public DateTime? FirstInstallmentDueDate { get; set; }
        public decimal InstallmentAmount { get; set; }
        public int BorrowingLiabilityLedgerID { get; set; }
        public int InterestExpenseLedgerID { get; set; }
        public int? ProcessingChargesLedgerID { get; set; }
        public string? PurposeOrLinkedLoansNote { get; set; }
        public string? Remarks { get; set; }

        // Optional Go-Live Opening Balance Migration fields
        public bool IsOpeningBalance { get; set; } = false;
        public DateTime? OpeningDisbursementDate { get; set; }
        public decimal OpeningDisbursedAmount { get; set; }
        public decimal OpeningOutstandingPrincipal { get; set; }
        public DateTime? LastInterestPaidDate { get; set; }
    }

    public class BorrowingDisbursementRequestDto
    {
        public DateTime DisbursementDate { get; set; } = DateTime.Today;
        public decimal GrossDisbursedAmount { get; set; }
        public decimal ProcessingFeeDeducted { get; set; } = 0m;
        public decimal OtherDeductionsAmount { get; set; } = 0m;
        public int? DeductionLedgerID { get; set; }
        public string PaymentMode { get; set; } = "Bank";
        public int? BankLedgerID { get; set; }
        public string? ReferenceNo { get; set; }
        public DateTime? FirstInstallmentDueDate { get; set; }
        public decimal? CustomInstallmentAmount { get; set; }
        public string? Remarks { get; set; }
        public List<BorrowingGoldPledgeInputDto> GoldPledges { get; set; } = new();
        public bool IsOneStepCreate { get; set; } = false;
    }

    public class CreateBorrowingRequestDto
    {
        public int BranchID { get; set; } = 1;
        public int? LenderInstitutionID { get; set; }
        public string LenderName { get; set; } = string.Empty;
        public string? LenderBranchName { get; set; }
        public string? ExternalLoanAccountNo { get; set; }
        public string? SanctionLetterNo { get; set; }
        public string BorrowingType { get; set; } = "GOLD_REPLEDGE";
        public int? PledgedInvestmentAccountID { get; set; }
        public DateTime? SanctionDate { get; set; }
        public DateTime DisbursementDate { get; set; } = DateTime.Today;
        public DateTime? MaturityDate { get; set; }
        public decimal SanctionedAmount { get; set; }
        public decimal DisbursedAmount { get; set; }
        public decimal ProcessingFeeDeducted { get; set; } = 0m;
        public decimal OtherDeductionsAmount { get; set; } = 0m;
        public decimal BorrowingInterestRate { get; set; }
        public string? InterestCalculationMethod { get; set; }
        public string? InstallmentType { get; set; } = "EMI";
        public string? InstallmentFrequency { get; set; } = "Monthly";
        public int TenureMonths { get; set; } = 12;
        public int TotalInstallments { get; set; } = 12;
        public DateTime? FirstInstallmentDueDate { get; set; }
        public decimal InstallmentAmount { get; set; }
        public int BorrowingLiabilityLedgerID { get; set; }
        public int InterestExpenseLedgerID { get; set; }
        public int? ProcessingChargesLedgerID { get; set; }
        public string PaymentMode { get; set; } = "Bank";
        public int? BankLedgerID { get; set; }
        public string? ReferenceNo { get; set; }
        public string? PurposeOrLinkedLoansNote { get; set; }
        public string? Remarks { get; set; }
        public List<BorrowingGoldPledgeInputDto> GoldPledges { get; set; } = new();
    }

    public class BorrowingGoldPledgeInputDto
    {
        public int LoanAccountID { get; set; }
        public decimal AllocatedBorrowedAmount { get; set; }
        public string? LenderPledgeReceiptNo { get; set; }
    }

    public class BorrowingRepaymentRequestDto
    {
        public DateTime RepaymentDate { get; set; } = DateTime.Today;
        public string? RepaymentType { get; set; } = "RegularEMI";
        public decimal PrincipalPaid { get; set; }
        public decimal InterestPaid { get; set; }
        public decimal PenalOrChargesPaid { get; set; }
        public int? ChargesLedgerID { get; set; }
        public string PaymentMode { get; set; } = "Bank";
        public int? BankLedgerID { get; set; }
        public string? ReferenceNo { get; set; }
        public string? Remarks { get; set; }
        public bool CloseAccount { get; set; } = false;
        public List<int> ReleaseGoldCustodyIds { get; set; } = new();
        public string? ReturnCustodyStatus { get; set; }
        public int? ReturnOwnLockerID { get; set; }
        public int? ReturnExternalLockerID { get; set; }
    }

    public class UnpledgeGoldPacketsRequestDto
    {
        public List<int> GoldCustodyIds { get; set; } = new();
        public DateTime? ReleaseDate { get; set; }
        public string? ReturnCustodyStatus { get; set; }
        public int? ReturnOwnLockerID { get; set; }
        public int? ReturnExternalLockerID { get; set; }
        public string? Remarks { get; set; }
    }
}
