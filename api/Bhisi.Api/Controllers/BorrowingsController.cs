using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Bhisi.Api.Helpers;
using Bhisi.Api.Models;
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

        // GET: api/Borrowings/masters
        [HttpGet("masters")]
        public async Task<ActionResult<object>> GetBorrowingMasters([FromQuery] int? branchId = null)
        {
            int? resolvedBranch = User.ResolveOptionalBranchId(branchId);

            var institutions = await _context.InvestmentInstitutions
                .AsNoTracking()
                .Where(i => i.IsActive)
                .OrderBy(i => i.InstitutionName)
                .Select(i => new
                {
                    i.InstitutionID,
                    i.InstitutionName,
                    i.InstitutionType,
                    i.InstitutionBranchName
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

            return Ok(new { institutions, ledgers, investmentAccounts, ownLockers, externalLockers });
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

            var query = _context.SansthaBorrowings
                .AsNoTracking()
                .Include(b => b.Branch)
                .Include(b => b.BorrowingLiabilityLedger)
                .Include(b => b.InterestExpenseLedger)
                .Include(b => b.DisbursementVoucher)
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
                .OrderByDescending(b => b.DisbursementDate)
                .ThenByDescending(b => b.BorrowingID)
                .ToListAsync();

            var activeList = list.Where(b => string.Equals(b.Status, "Active", StringComparison.OrdinalIgnoreCase)).ToList();
            var activePledges = activeList
                .SelectMany(b => b.GoldPledges.Where(p => p.PledgeStatus == "Pledged"))
                .ToList();

            decimal totalOutstanding = Math.Round(activeList.Sum(b => b.OutstandingPrincipal), 2);
            decimal weightedBorrowRate = totalOutstanding > 0m
                ? Math.Round(activeList.Sum(b => b.OutstandingPrincipal * b.BorrowingInterestRate) / totalOutstanding, 2)
                : (activeList.Any() ? Math.Round(activeList.Average(b => b.BorrowingInterestRate), 2) : 0m);

            decimal avgCustomerRate = activePledges.Any()
                ? Math.Round(activePledges.Average(p => p.CustomerLoanInterestRate), 2)
                : 0m;

            var items = list.Select(b =>
            {
                var pledges = b.GoldPledges
                    .OrderBy(p => p.BorrowingGoldPledgeID)
                    .Select(p =>
                    {
                        var cust = p.LoanAccount?.Customer;
                        string bName = cust != null
                            ? $"{cust.FirstName} {cust.MiddleName} {cust.LastName}".Replace("  ", " ").Trim()
                            : $"खाते #{p.LoanAccount?.LoanAccountNo}";

                        return new
                        {
                            p.BorrowingGoldPledgeID,
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

                var repayments = b.Repayments
                    .OrderByDescending(r => r.RepaymentDate)
                    .ThenByDescending(r => r.BorrowingRepaymentID)
                    .Select(r => new
                    {
                        r.BorrowingRepaymentID,
                        r.RepaymentDate,
                        r.PrincipalPaid,
                        r.InterestPaid,
                        r.PenalOrChargesPaid,
                        r.TotalPaid,
                        r.PaymentMode,
                        r.ReferenceNo,
                        r.VoucherID,
                        VoucherNo = r.Voucher?.VoucherNo ?? "",
                        VoucherStatus = r.Voucher?.Status ?? "",
                        r.Remarks
                    })
                    .ToList();

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
                    b.BorrowingType,
                    b.PledgedInvestmentAccountID,
                    b.SanctionDate,
                    b.DisbursementDate,
                    b.MaturityDate,
                    b.SanctionedAmount,
                    b.DisbursedAmount,
                    b.OutstandingPrincipal,
                    b.TotalInterestPaid,
                    b.BorrowingInterestRate,
                    b.InterestCalculationMethod,
                    b.InstallmentAmount,
                    b.BorrowingLiabilityLedgerID,
                    LiabilityLedgerName = b.BorrowingLiabilityLedger?.LedgerName ?? "",
                    b.InterestExpenseLedgerID,
                    InterestExpenseLedgerName = b.InterestExpenseLedger?.LedgerName ?? "",
                    b.PaymentMode,
                    b.ReferenceNo,
                    b.DisbursementVoucherID,
                    DisbursementVoucherNo = b.DisbursementVoucher?.VoucherNo ?? "",
                    DisbursementVoucherStatus = b.DisbursementVoucher?.Status ?? "",
                    b.PurposeOrLinkedLoansNote,
                    b.Remarks,
                    b.Status,
                    b.ClosedDate,
                    ActivePledgedCount = pledges.Count(p => p.PledgeStatus == "Pledged"),
                    TotalPledgedNetWeight = pledges.Where(p => p.PledgeStatus == "Pledged").Sum(p => p.NetWeight),
                    AvgCustomerRate = pledges.Any() ? Math.Round(pledges.Average(p => p.CustomerLoanInterestRate), 2) : 0m,
                    AvgSpreadPercent = pledges.Any() ? Math.Round(pledges.Average(p => p.InterestSpreadPercent), 2) : 0m,
                    GoldPledges = pledges,
                    Repayments = repayments
                };
            }).ToList();

            return Ok(new
            {
                kpis = new
                {
                    activeBorrowingsCount = activeList.Count,
                    totalOutstandingPrincipal = totalOutstanding,
                    activeRepledgedPacketsCount = activePledges.Count,
                    totalRepledgedNetWeight = Math.Round(activePledges.Sum(p => p.GoldCustody?.TotalNetWeight ?? 0m), 3),
                    weightedBorrowingRate = weightedBorrowRate,
                    avgCustomerLendingRate = avgCustomerRate,
                    netInterestSpreadPercent = avgCustomerRate > 0m ? Math.Round(avgCustomerRate - weightedBorrowRate, 2) : 0m
                },
                items
            });
        }

        // POST: api/Borrowings
        [HttpPost]
        [Authorize(Roles = "Admin,SuperAdmin,Super Admin,SystemAdmin,HeadOffice,HO_Manager,HO Manager,GeneralManager,CEO,Chairman,Manager,BranchManager,Branch_Manager")]
        public async Task<ActionResult<object>> CreateBorrowing([FromBody] CreateBorrowingRequestDto req)
        {
            if (req == null) return BadRequest("कृपया बाह्य कर्जाची माहिती भरा.");

            string bType = (req.BorrowingType ?? string.Empty).Trim().ToUpperInvariant();
            if (!AllowedBorrowingTypes.Contains(bType))
            {
                return BadRequest($"अवैध बाह्य कर्ज प्रकार: '{req.BorrowingType}'.");
            }

            if (req.DisbursedAmount <= 0m)
                return BadRequest("घेतलेली कर्ज रक्कम (Disbursed Amount) ₹0 पेक्षा जास्त असणे आवश्यक आहे.");

            decimal sanctioned = req.SanctionedAmount >= req.DisbursedAmount ? req.SanctionedAmount : req.DisbursedAmount;
            if (req.BorrowingInterestRate < 0m || req.BorrowingInterestRate > 50m)
                return BadRequest("कृपया वैध वार्षिक व्याजदर (%) भरा.");

            DateTime disbDate = req.DisbursementDate.Date;
            var closedFy = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.IsClosed && disbDate >= f.StartDate.Date && disbDate <= f.EndDate.Date);
            if (closedFy != null)
            {
                return BadRequest($"दिनांक {disbDate:dd/MM/yyyy} ही तारीख बंद केलेल्या आर्थिक वर्षात ({closedFy.YearCode}) येत असल्याने बाह्य कर्ज नोंदवता येत नाही.");
            }

            var activeFy = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(f => !f.IsClosed && disbDate >= f.StartDate.Date && disbDate <= f.EndDate.Date)
                ?? await _context.FinancialYears.AsNoTracking().OrderByDescending(f => f.FinancialYearID).FirstOrDefaultAsync();

            int branchId = User.ResolveBranchId(req.BranchID > 0 ? req.BranchID : 1);

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
                return BadRequest("कृपया कर्ज देणाऱ्या बँक / पतसंस्थेचे नाव निवडा किंवा भरा.");

            var liabCheck = await GoldCustodyAndBorrowingHelper.ValidateBorrowingLiabilityLedgerAsync(_context, req.BorrowingLiabilityLedgerID);
            if (!liabCheck.IsValid) return BadRequest(liabCheck.ErrorMessage);

            var expCheck = await GoldCustodyAndBorrowingHelper.ValidateBorrowingInterestExpenseLedgerAsync(_context, req.InterestExpenseLedgerID);
            if (!expCheck.IsValid) return BadRequest(expCheck.ErrorMessage);

            var settlement = await GoldCustodyAndBorrowingHelper.ResolveSettlementLedgerAsync(_context, branchId, req.PaymentMode, req.BankLedgerID);
            if (!settlement.IsValid) return BadRequest(settlement.ErrorMessage);

            var pledgeInputs = req.GoldPledges ?? new List<BorrowingGoldPledgeInputDto>();
            if (bType == "GOLD_REPLEDGE" && !pledgeInputs.Any())
            {
                return BadRequest("सोने पुनर्गहाण बाह्य कर्जासाठी किमान एक ग्राहक सोने तारण पाकीट निवडणे आवश्यक आहे.");
            }

            int userId = ResolveUserId();
            var validatedGoldPairs = new List<(LoanAccount Loan, GoldLoanCustody Custody, BorrowingGoldPledgeInputDto Input)>();

            if (bType == "GOLD_REPLEDGE")
            {
                var distinctLoanIds = pledgeInputs.Select(p => p.LoanAccountID).Distinct().ToList();
                if (distinctLoanIds.Count != pledgeInputs.Count)
                {
                    return BadRequest("एकाच कर्ज खात्याचे पाकीट एकापेक्षा जास्त वेळा निवडता येत नाही.");
                }

                foreach (var pIn in pledgeInputs)
                {
                    var loan = await _context.LoanAccounts
                        .Include(l => l.LoanRate)
                        .Include(l => l.LoanApplication)
                        .FirstOrDefaultAsync(l => l.LoanAccountID == pIn.LoanAccountID);

                    if (loan == null || loan.Status != "Active" || loan.PrincipalBalance <= 0m)
                    {
                        return BadRequest($"कर्ज खाते ID #{pIn.LoanAccountID} सक्रिय नाही किंवा त्याची बाकी शून्य आहे.");
                    }

                    var custody = await GoldCustodyAndBorrowingHelper.EnsureOrSyncGoldCustodyAsync(_context, loan, userId, disbDate);
                    if (string.Equals(custody.CustodyStatus, "REPLEDGED_BORROWING", StringComparison.OrdinalIgnoreCase))
                    {
                        return BadRequest($"पाकीट क्र. '{custody.PacketNumber}' (कर्ज क्र. {loan.LoanAccountNo}) आधीच दुसऱ्या बाह्य कर्जात पुनर्गहाण आहे!");
                    }
                    if (string.Equals(custody.CustodyStatus, "RELEASED_TO_CUSTOMER", StringComparison.OrdinalIgnoreCase))
                    {
                        return BadRequest($"पाकीट क्र. '{custody.PacketNumber}' आधीच खातेदारास परत केलेले आहे.");
                    }

                    validatedGoldPairs.Add((loan, custody, pIn));
                }
            }

            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                int countThisYear = await _context.SansthaBorrowings.CountAsync(b => b.BranchID == branchId && b.DisbursementDate.Year == disbDate.Year);
                string borrowingNo = $"BRW-{branchId}-{disbDate.Year}-{(countThisYear + 1):D4}";
                while (await _context.SansthaBorrowings.AnyAsync(b => b.BorrowingNo == borrowingNo))
                {
                    countThisYear++;
                    borrowingNo = $"BRW-{branchId}-{disbDate.Year}-{(countThisYear + 1):D4}";
                }

                decimal disbAmt = Math.Round(req.DisbursedAmount, 2, MidpointRounding.AwayFromZero);
                string vchNo = $"REC-BRW-{borrowingNo}";

                var voucher = new Voucher
                {
                    BranchID = branchId,
                    VoucherNo = vchNo,
                    VoucherDate = disbDate,
                    VoucherType = "Receipt",
                    Narration = $"बाह्य कर्ज प्राप्ती ({bType}) — {lenderName}, कर्ज क्र. {borrowingNo}{(string.IsNullOrWhiteSpace(req.ExternalLoanAccountNo) ? "" : $" (A/c: {req.ExternalLoanAccountNo})")}",
                    TotalAmount = disbAmt,
                    Status = "Pending",
                    CreatedBy = userId,
                    CreatedOn = DateTime.UtcNow
                };
                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();

                _context.VoucherDetails.AddRange(
                    new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = settlement.LedgerId,
                        DrCr = "Dr",
                        Amount = disbAmt
                    },
                    new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = req.BorrowingLiabilityLedgerID,
                        DrCr = "Cr",
                        Amount = disbAmt
                    }
                );
                await _context.SaveChangesAsync();
                await VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, voucher.VoucherID, voucher.VoucherNo);

                var borrowing = new SansthaBorrowing
                {
                    BranchID = branchId,
                    FinancialYearID = activeFy?.FinancialYearID ?? 1,
                    BorrowingNo = borrowingNo,
                    LenderInstitutionID = req.LenderInstitutionID > 0 ? req.LenderInstitutionID : null,
                    LenderName = lenderName,
                    LenderBranchName = lenderBranch,
                    ExternalLoanAccountNo = req.ExternalLoanAccountNo?.Trim(),
                    BorrowingType = bType,
                    PledgedInvestmentAccountID = bType == "FD_AGAINST_LOAN" && req.PledgedInvestmentAccountID > 0 ? req.PledgedInvestmentAccountID : null,
                    SanctionDate = (req.SanctionDate ?? disbDate).Date,
                    DisbursementDate = disbDate,
                    MaturityDate = req.MaturityDate?.Date,
                    SanctionedAmount = Math.Round(sanctioned, 2, MidpointRounding.AwayFromZero),
                    DisbursedAmount = disbAmt,
                    OutstandingPrincipal = disbAmt,
                    TotalInterestPaid = 0m,
                    BorrowingInterestRate = Math.Round(req.BorrowingInterestRate, 2, MidpointRounding.AwayFromZero),
                    InterestCalculationMethod = string.IsNullOrWhiteSpace(req.InterestCalculationMethod) ? "Reducing" : req.InterestCalculationMethod.Trim(),
                    InstallmentAmount = Math.Max(0m, Math.Round(req.InstallmentAmount, 2, MidpointRounding.AwayFromZero)),
                    BorrowingLiabilityLedgerID = req.BorrowingLiabilityLedgerID,
                    InterestExpenseLedgerID = req.InterestExpenseLedgerID,
                    PaymentMode = settlement.NormalizedMode,
                    BankLedgerID = settlement.NormalizedMode == "Cash" ? null : settlement.LedgerId,
                    ReferenceNo = req.ReferenceNo?.Trim(),
                    DisbursementVoucherID = voucher.VoucherID,
                    PurposeOrLinkedLoansNote = req.PurposeOrLinkedLoansNote?.Trim(),
                    Remarks = req.Remarks?.Trim(),
                    Status = "Active",
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow
                };

                _context.SansthaBorrowings.Add(borrowing);
                await _context.SaveChangesAsync();

                if (validatedGoldPairs.Any())
                {
                    decimal defaultSplit = Math.Round(disbAmt / validatedGoldPairs.Count, 2, MidpointRounding.AwayFromZero);

                    foreach (var (loan, custody, pIn) in validatedGoldPairs)
                    {
                        await _context.Entry(custody).Reference(c => c.OwnLocker).LoadAsync();
                        await _context.Entry(custody).Reference(c => c.ExternalLocker).LoadAsync();

                        string prevStatus = custody.CustodyStatus;
                        string prevLocation = GoldCustodyAndBorrowingHelper.FormatCustodyLocationSummary(custody);
                        decimal custRate = loan.InterestRate;
                        decimal spread = Math.Round(custRate - borrowing.BorrowingInterestRate, 2, MidpointRounding.AwayFromZero);

                        var pledgeRow = new SansthaBorrowingGoldPledge
                        {
                            BorrowingID = borrowing.BorrowingID,
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
                        };
                        _context.SansthaBorrowingGoldPledges.Add(pledgeRow);

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
                            Remarks = $"बाह्य कर्ज पुनर्गहाण ({lenderName}, कर्ज क्र. {borrowingNo})"
                        });
                    }

                    await _context.SaveChangesAsync();
                }

                await tx.CommitAsync();

                return Ok(new
                {
                    message = $"बाह्य कर्ज क्र. '{borrowing.BorrowingNo}' यशस्वीरीत्या जतन झाले! व्हाउचर क्र. {voucher.VoucherNo} (प्रलंबित मंजुरी).",
                    borrowing.BorrowingID,
                    borrowing.BorrowingNo,
                    voucherId = voucher.VoucherID,
                    voucherNo = voucher.VoucherNo
                });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                return BadRequest($"बाह्य कर्ज जतन करताना त्रुटी: {ex.Message}");
            }
        }

        // POST: api/Borrowings/{id}/repay
        [HttpPost("{id}/repay")]
        [Authorize(Roles = "Admin,SuperAdmin,Super Admin,SystemAdmin,HeadOffice,HO_Manager,HO Manager,GeneralManager,CEO,Chairman,Manager,BranchManager,Branch_Manager,Cashier")]
        public async Task<ActionResult<object>> RepayBorrowing(int id, [FromBody] BorrowingRepaymentRequestDto req)
        {
            if (req == null) return BadRequest("कृपया परतफेडीची माहिती भरा.");

            var borrowing = await _context.SansthaBorrowings
                .Include(b => b.DisbursementVoucher)
                .Include(b => b.GoldPledges)
                    .ThenInclude(p => p.GoldCustody)
                .Include(b => b.Repayments)
                    .ThenInclude(r => r.Voucher)
                .FirstOrDefaultAsync(b => b.BorrowingID == id);

            if (borrowing == null) return NotFound("बाह्य कर्ज खाते सापडले नाही.");
            if (!string.Equals(borrowing.Status, "Active", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest($"बाह्य कर्ज '{borrowing.BorrowingNo}' आधीच बंद (Closed) झालेले आहे.");
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
                return BadRequest("या बाह्य कर्जाची मागील परतफेड व्हाउचर अद्याप प्रलंबित (Pending Passing) आहे. आधी ते पास करा.");
            }

            DateTime repayDate = req.RepaymentDate.Date;
            var closedFy = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.IsClosed && repayDate >= f.StartDate.Date && repayDate <= f.EndDate.Date);
            if (closedFy != null)
            {
                return BadRequest($"दिनांक {repayDate:dd/MM/yyyy} बंद केलेल्या आर्थिक वर्षात ({closedFy.YearCode}) येत असल्याने परतफेड नोंदवता येत नाही.");
            }

            decimal prinPaid = Math.Max(0m, Math.Round(req.PrincipalPaid, 2, MidpointRounding.AwayFromZero));
            decimal intPaid = Math.Max(0m, Math.Round(req.InterestPaid, 2, MidpointRounding.AwayFromZero));
            decimal penPaid = Math.Max(0m, Math.Round(req.PenalOrChargesPaid, 2, MidpointRounding.AwayFromZero));
            decimal totalPaid = Math.Round(prinPaid + intPaid + penPaid, 2, MidpointRounding.AwayFromZero);

            if (totalPaid <= 0m)
                return BadRequest("परतफेडीची एकूण रक्कम ₹0 पेक्षा जास्त असणे आवश्यक आहे.");

            if (prinPaid > borrowing.OutstandingPrincipal + 0.01m)
                return BadRequest($"मुद्दल परतफेड (₹{prinPaid:N2}) ही येणे मुद्दल बाकीपेक्षा (₹{borrowing.OutstandingPrincipal:N2}) जास्त असू शकत नाही.");

            int branchId = borrowing.BranchID;
            var settlement = await GoldCustodyAndBorrowingHelper.ResolveSettlementLedgerAsync(_context, branchId, req.PaymentMode, req.BankLedgerID);
            if (!settlement.IsValid) return BadRequest(settlement.ErrorMessage);

            int userId = ResolveUserId();

            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                int nextRepaySeq = borrowing.Repayments.Count + 1;
                string vchNo = $"PAY-BRW-{borrowing.BorrowingNo}-{nextRepaySeq:D2}";
                while (await _context.Vouchers.AnyAsync(v => v.VoucherNo == vchNo))
                {
                    nextRepaySeq++;
                    vchNo = $"PAY-BRW-{borrowing.BorrowingNo}-{nextRepaySeq:D2}";
                }

                var voucher = new Voucher
                {
                    BranchID = branchId,
                    VoucherNo = vchNo,
                    VoucherDate = repayDate,
                    VoucherType = "Payment",
                    Narration = $"बाह्य कर्ज परतफेड — {borrowing.LenderName} ({borrowing.BorrowingNo}) [मुद्दल: ₹{prinPaid:N2}, व्याज: ₹{intPaid + penPaid:N2}]",
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

                if (intPaid + penPaid > 0m)
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

                var repayment = new SansthaBorrowingRepayment
                {
                    BorrowingID = borrowing.BorrowingID,
                    BranchID = branchId,
                    RepaymentDate = repayDate,
                    PrincipalPaid = prinPaid,
                    InterestPaid = intPaid,
                    PenalOrChargesPaid = penPaid,
                    TotalPaid = totalPaid,
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

                borrowing.OutstandingPrincipal = Math.Max(0m, Math.Round(borrowing.OutstandingPrincipal - prinPaid, 2, MidpointRounding.AwayFromZero));
                borrowing.TotalInterestPaid = Math.Round(borrowing.TotalInterestPaid + intPaid + penPaid, 2, MidpointRounding.AwayFromZero);
                borrowing.UpdatedAt = DateTime.UtcNow;

                bool isFullyClosed = borrowing.OutstandingPrincipal <= 0.009m;
                if (isFullyClosed)
                {
                    borrowing.OutstandingPrincipal = 0m;
                    borrowing.Status = "Closed";
                    borrowing.ClosedDate = repayDate;
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
                        isFullyClosed ? "बाह्य कर्ज पूर्ण परतफेड — पुनर्गहाण मुक्त" : "आंशिक परतफेडीत पाकीट सोडवले");
                }

                await _context.SaveChangesAsync();
                await tx.CommitAsync();

                return Ok(new
                {
                    message = isFullyClosed
                        ? $"बाह्य कर्ज '{borrowing.BorrowingNo}' पूर्णपणे फेडले गेले व {pledgesToRelease.Count} सोने पाकिटे संस्थेच्या कस्टडीत परत आली!"
                        : $"बाह्य कर्ज परतफेड ₹{totalPaid:N2} यशस्वीरीत्या नोंदवली (व्हाउचर: {voucher.VoucherNo}).",
                    repayment.BorrowingRepaymentID,
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

            DateTime relDate = (req.ReleaseDate ?? DateTime.Today).Date;
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

    public class CreateBorrowingRequestDto
    {
        public int BranchID { get; set; } = 1;
        public int? LenderInstitutionID { get; set; }
        public string LenderName { get; set; } = string.Empty;
        public string? LenderBranchName { get; set; }
        public string? ExternalLoanAccountNo { get; set; }
        public string BorrowingType { get; set; } = "GOLD_REPLEDGE";
        public int? PledgedInvestmentAccountID { get; set; }
        public DateTime? SanctionDate { get; set; }
        public DateTime DisbursementDate { get; set; } = DateTime.Today;
        public DateTime? MaturityDate { get; set; }
        public decimal SanctionedAmount { get; set; }
        public decimal DisbursedAmount { get; set; }
        public decimal BorrowingInterestRate { get; set; }
        public string? InterestCalculationMethod { get; set; }
        public decimal InstallmentAmount { get; set; }
        public int BorrowingLiabilityLedgerID { get; set; }
        public int InterestExpenseLedgerID { get; set; }
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
        public decimal PrincipalPaid { get; set; }
        public decimal InterestPaid { get; set; }
        public decimal PenalOrChargesPaid { get; set; }
        public string PaymentMode { get; set; } = "Bank";
        public int? BankLedgerID { get; set; }
        public string? ReferenceNo { get; set; }
        public string? Remarks { get; set; }
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
