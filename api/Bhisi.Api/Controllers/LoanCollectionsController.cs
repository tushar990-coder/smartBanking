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
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class LoanCollectionsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LoanCollectionsController(AppDbContext context)
        {
            _context = context;
        }

        private (int? userId, string userRole, int userBranchId, bool isHOUser) GetCurrentUserInfo()
        {
            var user = HttpContext?.User;
            string? roleClaim = user?.FindFirst(ClaimTypes.Role)?.Value 
                ?? user?.FindFirst("role")?.Value;
            string? branchClaim = user?.FindFirst("BranchID")?.Value 
                ?? user?.FindFirst("branchId")?.Value 
                ?? user?.FindFirst("branch")?.Value;
            string? idClaim = user?.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? user?.FindFirst("id")?.Value 
                ?? user?.FindFirst("userId")?.Value;

            int.TryParse(idClaim, out int uid);
            int.TryParse(branchClaim, out int branchId);
            if (branchId <= 0) branchId = 1;

            string role = roleClaim ?? "User";
            bool isHO = user.IsHeadOfficeAdmin();

            return (uid > 0 ? uid : (int?)null, role, branchId, isHO);
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<LoanCollection>>> GetLoanCollections(
            [FromQuery] int? branchId = null,
            [FromQuery] int? page = null, 
            [FromQuery] int? pageSize = null)
        {
            var (_, _, userBranchId, isHOUser) = GetCurrentUserInfo();

            var query = _context.LoanCollections
                .AsNoTracking()
                .Include(c => c.Branch)
                .Include(c => c.LoanAccount)
                    .ThenInclude(l => l!.Member)
                .Include(c => c.LoanAccount)
                    .ThenInclude(l => l!.Customer)
                .Include(c => c.LoanAccount)
                    .ThenInclude(l => l!.LoanRate)
                .Include(c => c.LoanAccount)
                    .ThenInclude(l => l!.Branch)
                .Include(c => c.Fees)
                    .ThenInclude(f => f.Ledger)
                .AsQueryable();

            if (!isHOUser)
            {
                // Non-HO users can only view collections where BranchID is their branch
                query = query.Where(c => c.BranchID == userBranchId);
            }
            else if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(c => c.BranchID == branchId.Value);
            }

            query = query.OrderByDescending(c => c.CollectionDate).ThenByDescending(c => c.LoanCollectionID);

            int p = page ?? 1;
            int ps = pageSize ?? 50;
            if (p < 1) p = 1;
            if (ps < 1 || ps > 500) ps = 50;

            // Bounded pagination prevents unbounded DB scans (Pillar 2)
            return await query.Skip((p - 1) * ps).Take(ps).ToListAsync();
        }

        // GET: api/LoanCollections/next-receipt-no
        [HttpGet("next-receipt-no")]
        public async Task<ActionResult<object>> GetNextReceiptNo([FromQuery] int? branchId = null, [FromQuery] int? loanAccountId = null)
        {
            var (_, _, userBranchId, isHOUser) = GetCurrentUserInfo();
            int targetBranchId = (isHOUser && branchId.HasValue && branchId.Value > 0) ? branchId.Value : userBranchId;

            string nextNo = await GenerateNextReceiptNoAsync(targetBranchId);
            return Ok(new { receiptNo = nextNo });
        }

        private async Task<string> GenerateNextReceiptNoAsync(int targetBranchId)
        {
            var branch = await _context.Branches.FindAsync(targetBranchId);
            string branchCode = !string.IsNullOrWhiteSpace(branch?.BranchCode) ? branch.BranchCode.Trim() : "HQ";

            var activeYear = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
            string fy = "26-27";
            if (activeYear != null && !string.IsNullOrWhiteSpace(activeYear.YearCode))
            {
                var parts = activeYear.YearCode.Split('-');
                if (parts.Length == 2)
                {
                    string p1 = parts[0].Trim();
                    string p2 = parts[1].Trim();
                    string y1 = p1.Length >= 2 ? p1.Substring(p1.Length - 2) : p1.PadLeft(2, '0');
                    string y2 = p2.Length >= 2 ? p2.Substring(p2.Length - 2) : p2.PadLeft(2, '0');
                    fy = $"{y1}-{y2}";
                }
                else
                {
                    fy = activeYear.YearCode.Replace(" ", "");
                }
            }

            int collectionCount = await _context.LoanCollections
                .CountAsync(c => c.BranchID == targetBranchId) + 1;

            string receiptNo = $"{branchCode}-REC-{fy}-{collectionCount:D5}";
            while (await _context.LoanCollections.AnyAsync(c => c.ReceiptNo == receiptNo))
            {
                collectionCount++;
                receiptNo = $"{branchCode}-REC-{fy}-{collectionCount:D5}";
            }

            return receiptNo;
        }

        [HttpPost]
        public async Task<ActionResult<LoanCollection>> PostLoanCollection(LoanCollection collection)
        {
            var (userId, userRole, userBranchId, isHOUser) = GetCurrentUserInfo();

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var loanAccount = await _context.LoanAccounts.Include(l => l.LoanRate).FirstOrDefaultAsync(l => l.LoanAccountID == collection.LoanAccountID);
                if (loanAccount == null) return BadRequest("Loan account not found");

                // Determine collecting branch (where the money is received)
                int collectingBranchId = isHOUser
                    ? ((collection.BranchID > 0) ? collection.BranchID : (loanAccount.BranchID > 0 ? loanAccount.BranchID : userBranchId))
                    : userBranchId;

                collection.BranchID = collectingBranchId;
                collection.HomeBranchID = loanAccount.BranchID;
                collection.IsCrossBranch = (collectingBranchId != loanAccount.BranchID);
                collection.CollectingCashierID = userId;
                collection.CreatedByUserID = userId;

                // Core Banking Date Safeguards: Prevent future dating and transactions in closed financial years
                if (collection.CollectionDate.Date > DateTime.Today)
                {
                    return BadRequest("पावतीची दिनांक भविष्यातील (Future Date) असू शकत नाही.");
                }

                var closedFy = await _context.FinancialYears
                    .FirstOrDefaultAsync(fy => fy.IsClosed && collection.CollectionDate.Date >= fy.StartDate.Date && collection.CollectionDate.Date <= fy.EndDate.Date);
                if (closedFy != null)
                {
                    return BadRequest($"निवडलेली तारीख बंद झालेल्या आर्थिक वर्षात ({closedFy.YearCode}) मोडत असल्याने या तारखेवर पावती करता येत नाही.");
                }

                if (collection.PrincipalCollected > loanAccount.PrincipalBalance + 0.01m)
                {
                    return BadRequest($"जमा मुद्दल रक्कम (₹{collection.PrincipalCollected:N2}) ही शिल्लक मुद्दल रक्कमेपेक्षा (₹{loanAccount.PrincipalBalance:N2}) जास्त असू शकत नाही.");
                }

                if (collection.IsOTS && string.IsNullOrWhiteSpace(collection.ResolutionNo))
                {
                    return BadRequest("एकरकम तडजोड (OTS) साठी संचालक मंडळाचा ठराव क्रमांक (Resolution No.) प्रविष्ट करणे अनिवार्य आहे.");
                }

                if (string.IsNullOrWhiteSpace(collection.ReceiptNo) || collection.ReceiptNo.StartsWith("REC-"))
                {
                    collection.ReceiptNo = await GenerateNextReceiptNoAsync(collectingBranchId);
                }

                // 1. Fetch overdue expenses from OverdueRecoveryLedger
                decimal overdueExpenses = await _context.OverdueRecoveryLedgers
                    .Where(l => l.LoanAccountID == collection.LoanAccountID)
                    .SumAsync(l => l.DebitAmount - l.CreditAmount);
                if (overdueExpenses < 0) overdueExpenses = 0;

                decimal expensesPaid = 0;
                decimal interestPaid = 0;
                decimal penaltyPaid = 0;
                decimal regularInterestPaid = 0;
                decimal principalPaid = 0;
                LoanRate? loanRate = loanAccount.LoanRate;

                if (collection.IsOTS)
                {
                    // OTS SPECIAL ALLOCATION LOGIC (Avoids double interest accrual and ensures clean closure)
                    decimal totalOutstanding = loanAccount.PrincipalBalance + loanAccount.InterestBalance + loanAccount.OverdueInterestBalance;
                    decimal totalWaiverNeeded = Math.Max(0, totalOutstanding - collection.TotalAmountReceived);

                    if (collection.InterestWaived <= 0 && collection.PenaltyWaived <= 0 && totalWaiverNeeded > 0)
                    {
                        collection.InterestWaived = totalWaiverNeeded;
                    }

                    decimal remaining = collection.TotalAmountReceived;
                    expensesPaid = Math.Min(remaining, overdueExpenses);
                    remaining -= expensesPaid;

                    regularInterestPaid = Math.Min(remaining, loanAccount.InterestBalance);
                    remaining -= regularInterestPaid;

                    penaltyPaid = Math.Min(remaining, loanAccount.OverdueInterestBalance);
                    remaining -= penaltyPaid;

                    interestPaid = regularInterestPaid + penaltyPaid;
                    principalPaid = remaining;

                    collection.PenaltyInterestCollected = penaltyPaid;
                    collection.ReceivableInterestCollected = regularInterestPaid;
                    collection.InterestCollected = 0;
                    collection.PrincipalCollected = principalPaid;
                    collection.SurchargeCollected = 0;

                    // Fully settle account to zero for OTS
                    loanAccount.PrincipalBalance = 0;
                    loanAccount.PurePrincipalBalance = 0;
                    loanAccount.CapitalizedInterestAmount = 0;
                    loanAccount.InterestBalance = 0;
                    loanAccount.OverdueInterestBalance = 0;
                    loanAccount.InterestProvisionBalance = 0;
                    loanAccount.Status = "Closed_OTS";
                    loanAccount.LastInstallmentPaidDate = collection.CollectionDate;
                }
                else
                {
                    // STANDARD COLLECTION WATERFALL LOGIC
                    bool isDailyReducing = loanRate != null && 
                        ((loanRate.InterestCalculationMethod?.Contains("Daily Reducing") == true) || (loanRate.InterestCalculationMethod?.Contains("दैनिक घटती") == true));

                    decimal existingReceivableInterest = loanAccount.InterestBalance;
                    decimal currentPeriodInterest = 0;

                    if (isDailyReducing)
                    {
                        var fromDateStr = loanAccount.LastInterestPostingDate 
                            ?? loanAccount.LastInstallmentPaidDate 
                            ?? (loanAccount.IsOpeningBalance ? loanAccount.OpeningDate : (DateTime?)null)
                            ?? loanAccount.LoanDisbursementDate 
                            ?? loanAccount.OpeningDate;

                        if (loanAccount.LastInstallmentPaidDate.HasValue && loanAccount.LastInterestPostingDate.HasValue)
                        {
                            fromDateStr = loanAccount.LastInstallmentPaidDate.Value > loanAccount.LastInterestPostingDate.Value
                                ? loanAccount.LastInstallmentPaidDate.Value
                                : loanAccount.LastInterestPostingDate.Value;
                        }

                        // Core Banking Rule: For opening balance loans, interest begins from OpeningDate unless an installment/posting occurred after OpeningDate
                        if (loanAccount.IsOpeningBalance)
                        {
                            if (fromDateStr < loanAccount.OpeningDate)
                            {
                                fromDateStr = loanAccount.OpeningDate;
                            }
                        }

                        var rate = loanRate?.InterestRate ?? loanAccount.InterestRate;
                        var diffTime = collection.CollectionDate.Date - fromDateStr.Date;
                        // Standard core banking rule: (CollectionDate - FromDate) inherently counts elapsed days (e.g. 05/04/2026 to 30/06/2026 => 86 days)
                        var diffDays = Math.Max(0, diffTime.Days);
                        decimal effectivePrincipal = LoanAccountsController.GetEffectiveInterestBearingPrincipal(loanAccount);
                        currentPeriodInterest = diffDays > 0 ? Math.Round((effectivePrincipal * rate * diffDays) / 36500m) : 0;
                    }
                    else
                    {
                        // Scheduled Loan Policy: Flat, Reducing (समान हप्ता / EMI), or Reducing (समान मुद्दल)
                        var dbSchedules = await _context.LoanInstallmentSchedules
                            .Where(s => s.LoanAccountID == loanAccount.LoanAccountID)
                            .ToListAsync();
                        
                        var pastCollections = await _context.LoanCollections
                            .Where(c => c.LoanAccountID == loanAccount.LoanAccountID)
                            .ToListAsync();

                        decimal unpaidScheduledInterest = Services.LoanScheduleGenerator.GetUnpaidScheduledInterest(
                            loanAccount,
                            dbSchedules,
                            pastCollections,
                            collection.CollectionDate);

                        currentPeriodInterest = unpaidScheduledInterest;
                    }

                    decimal receivablePaid = 0;
                    decimal surchargeCollected = 0;
                    decimal remaining = collection.TotalAmountReceived;

                    // A. Overdue Expenses
                    expensesPaid = Math.Min(remaining, overdueExpenses);
                    remaining -= expensesPaid;

                    // Check if explicit split was passed from frontend
                    decimal declaredTotal = collection.PrincipalCollected + collection.ReceivableInterestCollected + collection.InterestCollected + collection.PenaltyInterestCollected + collection.SurchargeCollected;
                    bool hasExplicitSplit = declaredTotal > 0 && Math.Abs(declaredTotal - remaining) <= 0.05m;

                    if (hasExplicitSplit)
                    {
                        penaltyPaid = Math.Min(collection.PenaltyInterestCollected, loanAccount.OverdueInterestBalance);
                        receivablePaid = Math.Min(collection.ReceivableInterestCollected, existingReceivableInterest);
                        regularInterestPaid = collection.InterestCollected;
                        principalPaid = Math.Min(collection.PrincipalCollected, loanAccount.PrincipalBalance);
                        surchargeCollected = collection.SurchargeCollected;

                        loanAccount.OverdueInterestBalance = Math.Max(0, loanAccount.OverdueInterestBalance - penaltyPaid);
                        loanAccount.InterestBalance = Math.Max(0, (existingReceivableInterest - receivablePaid) + (currentPeriodInterest - regularInterestPaid));
                        loanAccount.PrincipalBalance = Math.Max(0, loanAccount.PrincipalBalance - principalPaid);
                    }
                    else
                    {
                        // B. Overdue / Penal Interest
                        penaltyPaid = Math.Min(remaining, loanAccount.OverdueInterestBalance);
                        remaining -= penaltyPaid;
                        loanAccount.OverdueInterestBalance = Math.Max(0, loanAccount.OverdueInterestBalance - penaltyPaid);

                        // C. Past Posted / Accrued Receivable Interest (येणे व्याज)
                        receivablePaid = Math.Min(remaining, existingReceivableInterest);
                        remaining -= receivablePaid;

                        // D. Current Period Accrued Interest (चालू व्याज)
                        regularInterestPaid = Math.Min(remaining, currentPeriodInterest);
                        remaining -= regularInterestPaid;

                        loanAccount.InterestBalance = Math.Max(0, (existingReceivableInterest - receivablePaid) + (currentPeriodInterest - regularInterestPaid));

                        // E. Principal
                        principalPaid = Math.Min(remaining, loanAccount.PrincipalBalance);
                        remaining -= principalPaid;
                        loanAccount.PrincipalBalance = Math.Max(0, loanAccount.PrincipalBalance - principalPaid);

                        // F. Extra Principal / Surcharge
                        if (remaining > 0)
                        {
                            if (loanAccount.PrincipalBalance > 0)
                            {
                                decimal extraPrincipal = Math.Min(remaining, loanAccount.PrincipalBalance);
                                loanAccount.PrincipalBalance -= extraPrincipal;
                                principalPaid += extraPrincipal;
                                remaining -= extraPrincipal;
                            }
                            surchargeCollected = remaining;
                        }
                    }

                    // CBS Waterfall: Settle Capitalized Interest first, then Pure Principal
                    if (principalPaid > 0)
                    {
                        if (loanAccount.CapitalizedInterestAmount > 0)
                        {
                            decimal capDeduction = Math.Min(principalPaid, loanAccount.CapitalizedInterestAmount);
                            loanAccount.CapitalizedInterestAmount -= capDeduction;
                            decimal pureDeduction = principalPaid - capDeduction;
                            loanAccount.PurePrincipalBalance = Math.Max(0, loanAccount.PurePrincipalBalance - pureDeduction);
                        }
                        else
                        {
                            loanAccount.PurePrincipalBalance = Math.Max(0, loanAccount.PurePrincipalBalance - principalPaid);
                        }
                    }

                    interestPaid = receivablePaid + regularInterestPaid;

                    // CBS Suspense: Release Interest Provision on actual cash interest recovery
                    if (interestPaid > 0 && loanAccount.InterestProvisionBalance > 0)
                    {
                        decimal provisionRelease = Math.Min(interestPaid, loanAccount.InterestProvisionBalance);
                        loanAccount.InterestProvisionBalance -= provisionRelease;
                    }

                    collection.PenaltyInterestCollected = penaltyPaid;
                    collection.ReceivableInterestCollected = receivablePaid;
                    collection.InterestCollected = regularInterestPaid;
                    collection.PrincipalCollected = principalPaid;
                    collection.SurchargeCollected = surchargeCollected;

                    loanAccount.LastInstallmentPaidDate = collection.CollectionDate;

                    // Deduct Waived Amounts if any
                    if (collection.InterestWaived > 0)
                    {
                        loanAccount.InterestBalance = Math.Max(0, loanAccount.InterestBalance - collection.InterestWaived);
                    }
                    if (collection.PenaltyWaived > 0)
                    {
                        loanAccount.OverdueInterestBalance = Math.Max(0, loanAccount.OverdueInterestBalance - collection.PenaltyWaived);
                    }

                    if (loanAccount.PrincipalBalance <= 0)
                    {
                        loanAccount.Status = "Closed";
                    }
                }

                _context.Entry(loanAccount).State = EntityState.Modified;

                // Audit Log entry for OTS / Interest Waiver
                if (collection.IsOTS || collection.InterestWaived > 0 || collection.PenaltyWaived > 0)
                {
                    decimal totalWaived = collection.InterestWaived + collection.PenaltyWaived;
                    _context.AuditLogs.Add(new AuditLog
                    {
                        UserID = collection.ApprovedByUserID ?? 1,
                        Username = "Manager",
                        Action = "LOAN_INTEREST_WAIVER_OTS",
                        EntityName = "LoanAccount",
                        EntityID = collection.LoanAccountID.ToString(),
                        Timestamp = DateTime.Now,
                        Details = $"OTS/Waiver Granted: ₹{totalWaived:N2} (Interest Waived: ₹{collection.InterestWaived:N2}, Penalty Waived: ₹{collection.PenaltyWaived:N2}). Resolution No: {collection.ResolutionNo ?? "N/A"}. Rect No: {collection.ReceiptNo}"
                    });
                }

                // Check if account is NPA
                var lastStatus = await _context.LoanAccountNpaStatuses
                    .Where(s => s.LoanAccountID == collection.LoanAccountID)
                    .OrderByDescending(s => s.AsOfDate)
                    .FirstOrDefaultAsync();
                bool isNpa = (lastStatus != null && lastStatus.Category != "Standard") || 
                             (!string.IsNullOrWhiteSpace(loanAccount.InitialNpaClassification) && loanAccount.InitialNpaClassification != "Standard");

                // Log in Overdue tracking ledgers
                if (expensesPaid > 0)
                {
                    _context.OverdueRecoveryLedgers.Add(new OverdueRecoveryLedger
                    {
                        LoanAccountID = collection.LoanAccountID,
                        TransactionDate = collection.CollectionDate,
                        DebitAmount = 0,
                        CreditAmount = expensesPaid,
                        Particulars = $"Recovery expenses paid via collection (Rect No: {collection.ReceiptNo})"
                    });
                }

                if (interestPaid > 0 && isNpa)
                {
                    _context.OverdueInterestLedgers.Add(new OverdueInterestLedger
                    {
                        LoanAccountID = collection.LoanAccountID,
                        TransactionDate = collection.CollectionDate,
                        DebitAmount = 0,
                        CreditAmount = interestPaid,
                        Particulars = $"Unrealized interest recovered on cash basis (Rect No: {collection.ReceiptNo})"
                    });
                }

                _context.LoanCollections.Add(collection);
                await _context.SaveChangesAsync();

                // Synchronize LoanInstallmentSchedules using CBS standard FIFO allocation
                var allSchedules = await _context.LoanInstallmentSchedules
                    .Where(s => s.LoanAccountID == collection.LoanAccountID)
                    .OrderBy(s => s.InstallmentNo)
                    .ToListAsync();

                if (allSchedules.Any())
                {
                    var allCollections = await _context.LoanCollections
                        .Where(c => c.LoanAccountID == collection.LoanAccountID)
                        .ToListAsync();

                    Services.LoanScheduleGenerator.SynchronizeSchedules(loanAccount, allSchedules, allCollections);
                    foreach (var schedule in allSchedules)
                    {
                        _context.Entry(schedule).State = EntityState.Modified;
                    }
                    // Scheduled changes are tracked in memory and saved together in the consolidated SaveChangesAsync
                }

                // Get LoanRate to fetch Ledger IDs
                var loanAccFetched = await _context.LoanAccounts.Include(l => l.Member).Include(l => l.Customer).FirstOrDefaultAsync(l => l.LoanAccountID == collection.LoanAccountID);
                loanRate = await _context.LoanRates.FindAsync(loanAccFetched?.LoanRateID ?? 0);

                int loanLedgerId = loanRate?.LoanLedgerID ?? 0;
                if (loanLedgerId == 0 && loanRate != null)
                {
                    string schemeName = (loanRate.ShortName ?? loanRate.LoanType ?? "").Trim();
                    var matchingLedger = await _context.Ledgers.FirstOrDefaultAsync(l => 
                        l.LedgerName == schemeName ||
                        l.LedgerName.Contains(schemeName) ||
                        (!string.IsNullOrWhiteSpace(loanRate.LoanType) && l.LedgerName.Contains(loanRate.LoanType.Trim())));
                    if (matchingLedger != null)
                    {
                        loanLedgerId = matchingLedger.LedgerID;
                        loanRate.LoanLedgerID = loanLedgerId;
                    }
                }
                if (loanLedgerId == 0)
                {
                    return BadRequest(new { message = $"कर्ज योजना '{loanRate?.LoanType ?? "अज्ञात"}' ला कर्ज मुद्दल खाते (Loan Ledger) जोडलेले नाही. कृपया कर्ज दर पत्रक (Loan Rate Master) तपासा." });
                }

                int interestLedgerId = loanRate?.InterestLedgerID ?? 0;
                if (interestLedgerId == 0 && loanRate != null)
                {
                    string schemeName = (loanRate.ShortName ?? loanRate.LoanType ?? "").Trim();
                    var matchingIntLedger = await _context.Ledgers.FirstOrDefaultAsync(l => 
                        (l.LedgerName.Contains(schemeName) && l.LedgerName.Contains("व्याज")) ||
                        (!string.IsNullOrWhiteSpace(loanRate.LoanType) && l.LedgerName.Contains(loanRate.LoanType.Trim()) && l.LedgerName.Contains("व्याज")));
                    if (matchingIntLedger == null)
                    {
                        matchingIntLedger = await _context.Ledgers.FirstOrDefaultAsync(l => 
                            l.LedgerName.Contains("कर्ज व्याज") || 
                            l.LedgerName.Contains("Loan Interest") ||
                            l.LedgerName.Contains("व्याज येणे") ||
                            l.LedgerName.Contains("व्याज खाते"));
                    }
                    if (matchingIntLedger != null)
                    {
                        interestLedgerId = matchingIntLedger.LedgerID;
                        loanRate.InterestLedgerID = interestLedgerId;
                    }
                }
                if (interestLedgerId == 0)
                {
                    return BadRequest(new { message = $"कर्ज योजना '{loanRate?.LoanType ?? "अज्ञात"}' ला कर्ज व्याज खाते (Interest Ledger) जोडलेले नाही. कृपया कर्ज दर पत्रक (Loan Rate Master) तपासा." });
                }

                int receivableInterestLedgerId = (loanRate?.ReceivableInterestLedgerID ?? 0) > 0 
                    ? loanRate!.ReceivableInterestLedgerID!.Value 
                    : interestLedgerId;

                int overdueInterestLedgerId = (loanRate?.OverdueInterestLedgerID ?? 0) > 0 
                    ? loanRate!.OverdueInterestLedgerID!.Value 
                    : interestLedgerId;

                int collectingBranch = collectingBranchId;
                collection.BranchID = collectingBranch;

                int surchargeLedgerId = loanRate?.SurchargeLedgerID ?? 0;
                int cashLedgerId = collection.BankAccountLedgerID ?? await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, collectingBranch, "LOAN");

                if (collection.PaymentMode == "Saving Transfer" || collection.PaymentMode == "Saving") {
                    var savingLedger = await _context.Ledgers.FirstOrDefaultAsync(l => 
                        l.LedgerName.Contains("बचत ठेवा") || 
                        l.LedgerName.Contains("बचत ठेव") || 
                        l.LedgerName.Contains("बचत खाते") || 
                        l.LedgerName.Contains("Saving Deposit") || 
                        l.LedgerName.Contains("Saving Account")
                    ) ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("बचत") || l.LedgerName.Contains("Saving"));
                    if (savingLedger != null) cashLedgerId = savingLedger.LedgerID;
                }

                // Find or create Interest Waiver Expense Ledger
                var waiverLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("१३३ कर्ज व्याज सूट") || l.LedgerName.Contains("व्याज सूट") || l.LedgerName.ToLower().Contains("interest waiver"));
                if (waiverLedger == null)
                {
                    var expGroup = await _context.AccountGroups.FirstOrDefaultAsync(g => g.GroupName.Contains("खर्च") || g.GroupName.Contains("Expense")) ?? await _context.AccountGroups.FirstOrDefaultAsync();
                    if (expGroup != null)
                    {
                        waiverLedger = new Ledger
                        {
                            GroupID = expGroup.GroupID,
                            LedgerName = "१३३ कर्ज व्याज सूट",
                            AccountType = "Expense",
                            OpeningBalance = 0,
                            OpeningBalanceType = "Dr",
                            IsActive = true
                        };
                        _context.Ledgers.Add(waiverLedger);
                        await _context.SaveChangesAsync();
                    }
                }

                // Load contra ledgers
                var ledgerOverdueIntRec = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName == "थकीत व्याज येणे खाते");
                var ledgerOverdueIntProv = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName == "थकीत व्याज तरतूद खाते");
                var ledgerOverdueRecRec = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName == "थकीत वसुली खर्च येणे खाते");
                var ledgerOverdueRecProv = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName == "थकीत वसुली खर्च तरतूद खाते");

                decimal totalFees = collection.Fees?.Sum(f => f.Amount) ?? 0;
                decimal totalReceiptAmount = collection.TotalAmountReceived + totalFees;
                decimal totalWaiverAmount = collection.InterestWaived + collection.PenaltyWaived;

                // Create Voucher under the Collecting Branch (where cash is physically received)
                var branch = await _context.Branches.FindAsync(collectingBranch);
                string branchCode = branch?.BranchCode ?? "HQ";
                string voucherType = collection.PaymentMode == "Cash" ? "Receipt" : "Journal";
                string typeCode = voucherType == "Receipt" ? "REC" : "JV";

                var activeYear = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
                string fy = "26-27";
                if (activeYear != null)
                {
                    var parts = activeYear.YearCode.Split('-');
                    if (parts.Length == 2)
                    {
                        string y1 = parts[0].Length >= 4 ? parts[0].Substring(parts[0].Length - 2) : parts[0];
                        string y2 = parts[1].Length >= 4 ? parts[1].Substring(parts[1].Length - 2) : parts[1];
                        fy = $"{y1}-{y2}";
                    }
                    else
                    {
                        fy = activeYear.YearCode;
                    }
                }

                int count = await _context.Vouchers.CountAsync(v => v.BranchID == collectingBranch && v.VoucherType == voucherType) + 1;
                string voucherNo = $"{branchCode}-{typeCode}-{fy}-{count:D5}";
                while (await _context.Vouchers.AnyAsync(v => v.VoucherNo == voucherNo))
                {
                    count++;
                    voucherNo = $"{branchCode}-{typeCode}-{fy}-{count:D5}";
                }

                var sanstha = await _context.SansthaDetails.FirstOrDefaultAsync();
                bool autoPost = sanstha?.AutoPostVouchers ?? true;
                decimal autoPostLimit = sanstha?.AutoPostVoucherLimit ?? 50000m;
                decimal totalVoucherAmt = totalReceiptAmount + totalWaiverAmount;
                string vStatus = (autoPost && totalVoucherAmt <= autoPostLimit) ? "Approved" : "Pending";

                string borrowerName = loanAccFetched?.Customer != null 
                    ? $"{loanAccFetched.Customer.FirstName} {loanAccFetched.Customer.LastName}".Trim() 
                    : (loanAccFetched?.Member?.Customer != null 
                        ? $"{loanAccFetched.Member.Customer.FirstName} {loanAccFetched.Member.Customer.LastName}".Trim() 
                        : "Borrower");

                int targetHomeBranchId = collection.HomeBranchID ?? loanAccFetched?.BranchID ?? collectingBranch;
                bool isCrossBranchTxn = (collectingBranch != targetHomeBranchId);
                int? custId = loanAccFetched?.CustomerID;
                int? memId = loanAccFetched?.MemberID;

                if (!isCrossBranchTxn)
                {
                    // STANDARD SINGLE-BRANCH VOUCHER
                    var voucher = new Voucher
                    {
                        BranchID = collectingBranch,
                        VoucherNo = voucherNo,
                        VoucherDate = collection.CollectionDate,
                        VoucherType = voucherType,
                        Narration = $"Loan Collection (Rect No: {collection.ReceiptNo}) from {borrowerName} (A/C: {loanAccFetched?.LoanAccountNo}){(collection.IsOTS ? " [OTS / One Time Settlement]" : "")}",
                        TotalAmount = totalVoucherAmt,
                        Status = vStatus,
                        ApprovedBy = vStatus == "Approved" ? (collection.ApprovedByUserID ?? userId ?? 1) : null,
                        ApprovedOn = vStatus == "Approved" ? DateTime.Now : null
                    };
                    
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    // Add Voucher Details
                    if (cashLedgerId > 0 && totalReceiptAmount > 0)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = cashLedgerId, DrCr = "Dr", Amount = totalReceiptAmount, CustomerID = custId, MemberID = memId });

                    if (waiverLedger != null && totalWaiverAmount > 0)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = waiverLedger.LedgerID, DrCr = "Dr", Amount = totalWaiverAmount, CustomerID = custId, MemberID = memId });

                    if (loanLedgerId > 0 && collection.PrincipalCollected > 0)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = loanLedgerId, DrCr = "Cr", Amount = collection.PrincipalCollected, CustomerID = custId, MemberID = memId });

                    if (receivableInterestLedgerId > 0 && collection.ReceivableInterestCollected > 0)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = receivableInterestLedgerId, DrCr = "Cr", Amount = collection.ReceivableInterestCollected, CustomerID = custId, MemberID = memId });

                    if (interestLedgerId > 0 && collection.InterestCollected > 0)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = interestLedgerId, DrCr = "Cr", Amount = collection.InterestCollected, CustomerID = custId, MemberID = memId });

                    if (overdueInterestLedgerId > 0 && collection.PenaltyInterestCollected > 0)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = overdueInterestLedgerId, DrCr = "Cr", Amount = collection.PenaltyInterestCollected, CustomerID = custId, MemberID = memId });

                    if (surchargeLedgerId > 0 && collection.SurchargeCollected > 0)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = surchargeLedgerId, DrCr = "Cr", Amount = collection.SurchargeCollected, CustomerID = custId, MemberID = memId });

                    if (collection.Fees != null)
                    {
                        foreach(var fee in collection.Fees)
                        {
                            if (fee.Amount > 0 && fee.LedgerID > 0)
                            {
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = fee.LedgerID, DrCr = "Cr", Amount = fee.Amount, CustomerID = custId, MemberID = memId });
                            }
                        }
                    }

                    if (isNpa)
                    {
                        if (interestPaid > 0 && ledgerOverdueIntProv != null && ledgerOverdueIntRec != null)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = ledgerOverdueIntProv.LedgerID, DrCr = "Dr", Amount = interestPaid, CustomerID = custId, MemberID = memId });
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = ledgerOverdueIntRec.LedgerID, DrCr = "Cr", Amount = interestPaid, CustomerID = custId, MemberID = memId });
                        }
                        if (expensesPaid > 0 && ledgerOverdueRecProv != null && ledgerOverdueRecRec != null)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = ledgerOverdueRecProv.LedgerID, DrCr = "Dr", Amount = expensesPaid, CustomerID = custId, MemberID = memId });
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = ledgerOverdueRecRec.LedgerID, DrCr = "Cr", Amount = expensesPaid, CustomerID = custId, MemberID = memId });
                        }
                    }

                    // Voucher details and collection link will be saved in the consolidated batch SaveChangesAsync
                    collection.VoucherID = voucher.VoucherID;
                    collection.HomeBranchVoucherID = null;
                }
                else
                {
                    // DUAL-VOUCHER IBT (INTER-BRANCH TRANSFER) ARCHITECTURE
                    int ibtLedgerId = await Helpers.IbtLedgerHelper.GetIbtLedgerIdAsync(_context, collectingBranch, targetHomeBranchId);

                    // 1. Voucher 1: Collecting / Counter Branch (Dr Cash, Cr IBT)
                    var counterVoucher = new Voucher
                    {
                        BranchID = collectingBranch,
                        VoucherNo = voucherNo,
                        VoucherDate = collection.CollectionDate,
                        VoucherType = voucherType,
                        Narration = $"[आंतर-शाखा वसुली] खातेदार: {borrowerName} (कर्ज खाते: {loanAccFetched?.LoanAccountNo}, मूळ शाखा #{targetHomeBranchId}) साठी काऊंटरवर रोख जमा (पावती क्र: {collection.ReceiptNo})",
                        TotalAmount = totalReceiptAmount,
                        Status = vStatus,
                        IsIbtVoucher = true,
                        TargetBranchID = targetHomeBranchId,
                        ApprovedBy = vStatus == "Approved" ? (collection.ApprovedByUserID ?? userId ?? 1) : null,
                        ApprovedOn = vStatus == "Approved" ? DateTime.Now : null
                    };
                    _context.Vouchers.Add(counterVoucher);

                    // 2. Voucher 2: Home Branch Settlement (Dr IBT, Cr Loan Principal, Cr Interest, Cr Penalty, Cr Surcharge, Cr Fees)
                    var homeBranch = await _context.Branches.FindAsync(targetHomeBranchId);
                    string hbCode = homeBranch?.BranchCode ?? "HB";
                    int countHb = await _context.Vouchers.CountAsync(v => v.BranchID == targetHomeBranchId && v.VoucherType == "Journal") + 1;
                    string voucherNoHb = $"{hbCode}-JV-{fy}-{countHb:D5}";
                    while (await _context.Vouchers.AnyAsync(v => v.VoucherNo == voucherNoHb))
                    {
                        countHb++;
                        voucherNoHb = $"{hbCode}-JV-{fy}-{countHb:D5}";
                    }

                    var homeVoucher = new Voucher
                    {
                        BranchID = targetHomeBranchId,
                        VoucherNo = voucherNoHb,
                        VoucherDate = collection.CollectionDate,
                        VoucherType = "Journal",
                        Narration = $"[आंतर-शाखा जमा] काऊंटर शाखा #{collectingBranch} कडून वसुली जमा (खातेदार: {borrowerName}, कर्ज खाते: {loanAccFetched?.LoanAccountNo}, पावती क्र: {collection.ReceiptNo}){(collection.IsOTS ? " [OTS / One Time Settlement]" : "")}",
                        TotalAmount = totalVoucherAmt,
                        Status = vStatus,
                        IsIbtVoucher = true,
                        TargetBranchID = collectingBranch,
                        ApprovedBy = vStatus == "Approved" ? (collection.ApprovedByUserID ?? userId ?? 1) : null,
                        ApprovedOn = vStatus == "Approved" ? DateTime.Now : null
                    };
                    _context.Vouchers.Add(homeVoucher);
                    await _context.SaveChangesAsync();

                    if (cashLedgerId > 0 && totalReceiptAmount > 0)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = counterVoucher.VoucherID, LedgerID = cashLedgerId, DrCr = "Dr", Amount = totalReceiptAmount, CustomerID = custId, MemberID = memId });

                    if (ibtLedgerId > 0 && totalReceiptAmount > 0)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = counterVoucher.VoucherID, LedgerID = ibtLedgerId, DrCr = "Cr", Amount = totalReceiptAmount, CustomerID = custId, MemberID = memId });

                    if (ibtLedgerId > 0 && totalReceiptAmount > 0)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = ibtLedgerId, DrCr = "Dr", Amount = totalReceiptAmount, CustomerID = custId, MemberID = memId });

                    if (waiverLedger != null && totalWaiverAmount > 0)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = waiverLedger.LedgerID, DrCr = "Dr", Amount = totalWaiverAmount, CustomerID = custId, MemberID = memId });

                    if (loanLedgerId > 0 && collection.PrincipalCollected > 0)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = loanLedgerId, DrCr = "Cr", Amount = collection.PrincipalCollected, CustomerID = custId, MemberID = memId });

                    if (receivableInterestLedgerId > 0 && collection.ReceivableInterestCollected > 0)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = receivableInterestLedgerId, DrCr = "Cr", Amount = collection.ReceivableInterestCollected, CustomerID = custId, MemberID = memId });

                    if (interestLedgerId > 0 && collection.InterestCollected > 0)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = interestLedgerId, DrCr = "Cr", Amount = collection.InterestCollected, CustomerID = custId, MemberID = memId });

                    if (overdueInterestLedgerId > 0 && collection.PenaltyInterestCollected > 0)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = overdueInterestLedgerId, DrCr = "Cr", Amount = collection.PenaltyInterestCollected, CustomerID = custId, MemberID = memId });

                    if (surchargeLedgerId > 0 && collection.SurchargeCollected > 0)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = surchargeLedgerId, DrCr = "Cr", Amount = collection.SurchargeCollected, CustomerID = custId, MemberID = memId });

                    if (collection.Fees != null)
                    {
                        foreach(var fee in collection.Fees)
                        {
                            if (fee.Amount > 0 && fee.LedgerID > 0)
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = fee.LedgerID, DrCr = "Cr", Amount = fee.Amount, CustomerID = custId, MemberID = memId });
                        }
                    }

                    if (isNpa)
                    {
                        if (interestPaid > 0 && ledgerOverdueIntProv != null && ledgerOverdueIntRec != null)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = ledgerOverdueIntProv.LedgerID, DrCr = "Dr", Amount = interestPaid, CustomerID = custId, MemberID = memId });
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = ledgerOverdueIntRec.LedgerID, DrCr = "Cr", Amount = interestPaid, CustomerID = custId, MemberID = memId });
                        }
                        if (expensesPaid > 0 && ledgerOverdueRecProv != null && ledgerOverdueRecRec != null)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = ledgerOverdueRecProv.LedgerID, DrCr = "Dr", Amount = expensesPaid, CustomerID = custId, MemberID = memId });
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = ledgerOverdueRecRec.LedgerID, DrCr = "Cr", Amount = expensesPaid, CustomerID = custId, MemberID = memId });
                        }
                    }

                    // Link the two paired vouchers
                    counterVoucher.RelatedVoucherID = homeVoucher.VoucherID;
                    homeVoucher.RelatedVoucherID = counterVoucher.VoucherID;

                    collection.VoucherID = counterVoucher.VoucherID;
                    collection.HomeBranchVoucherID = homeVoucher.VoucherID;
                }

                // If PaymentMode is Saving Transfer, auto-debit member's Saving Account
                if (collection.PaymentMode == "Saving Transfer" || collection.PaymentMode == "Saving")
                {
                    SavingAccountMaster? savingAccount = null;
                    if (!string.IsNullOrEmpty(collection.TransferFromSavingAccountNo))
                    {
                        savingAccount = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.AccountNo == collection.TransferFromSavingAccountNo);
                    }
                    if (custId == null)
                    {
                        custId = loanAccFetched?.Customer?.CustomerID ?? loanAccFetched?.Member?.CustomerID;
                    }
                    if (savingAccount == null && custId != null)
                    {
                        savingAccount = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.CustomerID == custId.Value && s.Status == "Active");
                    }

                    if (savingAccount != null && totalReceiptAmount > 0)
                    {
                        savingAccount.CurrentBalance -= totalReceiptAmount;
                        _context.Entry(savingAccount).State = EntityState.Modified;

                        var savingTxn = new SavingTransaction
                        {
                            SavingAccountID = savingAccount.SavingAccountID,
                            CustomerID = savingAccount.CustomerID,
                            BranchID = collection.BranchID > 0 ? collection.BranchID : savingAccount.BranchID,
                            TransactionDate = collection.CollectionDate,
                            TransactionType = "Withdrawal",
                            Amount = totalReceiptAmount,
                            BalanceAfterTxn = savingAccount.CurrentBalance,
                            PaymentMode = "Transfer",
                            VoucherNo = voucherNo,
                            Narration = $"Loan Collection Debit for Loan A/C: {loanAccFetched?.LoanAccountNo} (Receipt No: {collection.ReceiptNo})"
                        };
                        _context.SavingTransactions.Add(savingTxn);
                    }
                }

                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                bool isLoanFullySettled = (loanAccount.PrincipalBalance <= 0 || loanAccount.Status == "Closed" || loanAccount.Status == "Closed_OTS");
                if (isLoanFullySettled)
                {
                    var activeCollaterals = await _context.LoanDepositCollaterals
                        .Where(c => c.LoanAccountID == loanAccount.LoanAccountID && c.LienStatus == "LienMarked")
                        .Select(c => new
                        {
                            c.CollateralID,
                            c.DepositAccountNo,
                            c.CollateralType,
                            c.DepositAccountID,
                            c.LienAmount,
                            c.LienStatus
                        })
                        .ToListAsync();

                    return CreatedAtAction("GetLoanCollection", new { id = collection.LoanCollectionID }, new
                    {
                        collection.LoanCollectionID,
                        collection.LoanAccountID,
                        collection.ReceiptNo,
                        collection.CollectionDate,
                        collection.TotalAmountReceived,
                        collection.PrincipalCollected,
                        collection.ReceivableInterestCollected,
                        collection.InterestCollected,
                        collection.PenaltyInterestCollected,
                        collection.SurchargeCollected,
                        isLoanFullySettled = true,
                        settledLoanAccountNo = loanAccount.LoanAccountNo,
                        activeCollaterals = activeCollaterals
                    });
                }

                return CreatedAtAction("GetLoanCollection", new { id = collection.LoanCollectionID }, collection);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                string detailedError = ex.InnerException?.Message ?? ex.Message;
                return StatusCode(500, new { message = $"पावती जतन करताना सर्व्हर त्रुटी आली: {detailedError}" });
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<LoanCollection>> GetLoanCollection(int id)
        {
            var (_, _, userBranchId, isHOUser) = GetCurrentUserInfo();

            var collection = await _context.LoanCollections
                .AsNoTracking()
                .Include(c => c.Branch)
                .Include(c => c.LoanAccount)
                    .ThenInclude(l => l!.Member)
                .Include(c => c.LoanAccount)
                    .ThenInclude(l => l!.Customer)
                .Include(c => c.LoanAccount)
                    .ThenInclude(l => l!.LoanRate)
                .Include(c => c.LoanAccount)
                    .ThenInclude(l => l!.Branch)
                .Include(c => c.Fees)
                .ThenInclude(f => f.Ledger)
                .FirstOrDefaultAsync(c => c.LoanCollectionID == id);

            if (collection == null) return NotFound();

            if (!isHOUser && collection.BranchID != userBranchId)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "तुम्हाला फक्त तुमच्या शाखेच्या वसुली पावत्या पाहण्याची परवानगी आहे." });
            }

            return collection;
        }

        // GET: api/LoanCollections/by-voucher/5
        [HttpGet("by-voucher/{voucherId}")]
        public async Task<ActionResult<LoanCollection>> GetLoanCollectionByVoucher(int voucherId)
        {
            var (_, _, userBranchId, isHOUser) = GetCurrentUserInfo();

            var collection = await _context.LoanCollections
                .AsNoTracking()
                .Include(c => c.Branch)
                .Include(c => c.LoanAccount)
                    .ThenInclude(l => l!.Member)
                .Include(c => c.LoanAccount)
                    .ThenInclude(l => l!.Customer)
                .Include(c => c.LoanAccount)
                    .ThenInclude(l => l!.LoanRate)
                .Include(c => c.LoanAccount)
                    .ThenInclude(l => l!.Branch)
                .Include(c => c.Fees)
                    .ThenInclude(f => f.Ledger)
                .Include(c => c.Voucher)
                .Include(c => c.HomeBranchVoucher)
                .FirstOrDefaultAsync(c => c.VoucherID == voucherId || c.HomeBranchVoucherID == voucherId);

            if (collection == null) return NotFound("या व्हाउचरशी जोडलेली कोणतीही कर्ज वसुली पावती सापडली नाही.");

            if (!isHOUser && collection.BranchID != userBranchId && collection.HomeBranchID != userBranchId)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "तुम्हाला फक्त तुमच्या शाखेच्या वसुली पावत्या पाहण्याची परवानगी आहे." });
            }

            return collection;
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateLoanCollectionMinor(int id, LoanCollection updatedData)
        {
            if (id != updatedData.LoanCollectionID) return BadRequest();

            var (_, _, userBranchId, isHOUser) = GetCurrentUserInfo();

            var existingCollection = await _context.LoanCollections.FindAsync(id);
            if (existingCollection == null) return NotFound();

            if (!isHOUser && existingCollection.BranchID != userBranchId)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "तुम्हाला इतर शाखेची कर्ज वसुली पावती संपादित करण्याची परवानगी नाही." });
            }

            existingCollection.CollectionDate = updatedData.CollectionDate;
            existingCollection.PaymentMode = updatedData.PaymentMode;
            existingCollection.Remarks = updatedData.Remarks;

            // Also update the VoucherDate if a Voucher is associated
            if (existingCollection.VoucherID.HasValue)
            {
                var voucher = await _context.Vouchers.FindAsync(existingCollection.VoucherID.Value);
                if (voucher != null)
                {
                    voucher.VoucherDate = updatedData.CollectionDate;
                    voucher.Status = "Approved";
                    _context.Entry(voucher).State = EntityState.Modified;
                }
            }

            _context.Entry(existingCollection).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!LoanCollectionExists(id)) return NotFound();
                else throw;
            }

            return NoContent();
        }

        // DELETE: api/LoanCollections/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteLoanCollection(int id)
        {
            var (_, _, userBranchId, isHOUser) = GetCurrentUserInfo();

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var collection = await _context.LoanCollections
                    .Include(c => c.Fees)
                    .FirstOrDefaultAsync(c => c.LoanCollectionID == id);

                if (collection == null) return NotFound("Receipt not found.");

                if (!isHOUser && collection.BranchID != userBranchId)
                {
                    return StatusCode(StatusCodes.Status403Forbidden, new { message = "तुम्हाला इतर शाखेची कर्ज वसुली पावती डिलीट करण्याची परवानगी नाही." });
                }

                // Revert LoanAccount PrincipalBalance and LastInstallmentPaidDate
                var loanAccount = await _context.LoanAccounts.FindAsync(collection.LoanAccountID);
                if (loanAccount != null)
                {
                    loanAccount.PrincipalBalance += collection.PrincipalCollected;
                    loanAccount.PurePrincipalBalance = Math.Min(loanAccount.PrincipalBalance, loanAccount.PurePrincipalBalance + collection.PrincipalCollected);
                    if (collection.PenaltyInterestCollected > 0)
                    {
                        loanAccount.OverdueInterestBalance += collection.PenaltyInterestCollected;
                    }
                    if (collection.ReceivableInterestCollected > 0)
                    {
                        loanAccount.InterestBalance += collection.ReceivableInterestCollected;
                    }
                    if (loanAccount.Status == "Closed" && loanAccount.PrincipalBalance > 0)
                    {
                        loanAccount.Status = "Active";
                    }

                    // Revert LastInstallmentPaidDate to latest remaining collection or null
                    var remainingCollections = await _context.LoanCollections
                        .Where(c => c.LoanAccountID == loanAccount.LoanAccountID && c.LoanCollectionID != id)
                        .OrderByDescending(c => c.CollectionDate)
                        .ThenByDescending(c => c.LoanCollectionID)
                        .ToListAsync();

                    if (remainingCollections.Any())
                    {
                        loanAccount.LastInstallmentPaidDate = remainingCollections.First().CollectionDate;
                    }
                    else
                    {
                        loanAccount.LastInstallmentPaidDate = null;
                    }

                    _context.Entry(loanAccount).State = EntityState.Modified;
                }

                // Delete associated Fees records
                if (collection.Fees != null && collection.Fees.Any())
                {
                    _context.LoanCollectionFees.RemoveRange(collection.Fees);
                }

                // Delete associated Voucher & Details if present (including IBT Home Branch Voucher)
                var voucherIdsToDelete = new List<int>();
                if (collection.VoucherID.HasValue) voucherIdsToDelete.Add(collection.VoucherID.Value);
                if (collection.HomeBranchVoucherID.HasValue) voucherIdsToDelete.Add(collection.HomeBranchVoucherID.Value);

                collection.VoucherID = null;
                collection.HomeBranchVoucherID = null;
                await _context.SaveChangesAsync();

                var vouchersToDelete = new List<Voucher>();
                foreach (var vId in voucherIdsToDelete.Distinct())
                {
                    var v = await _context.Vouchers
                        .Include(x => x.VoucherDetails)
                        .FirstOrDefaultAsync(x => x.VoucherID == vId);
                    if (v != null)
                    {
                        v.RelatedVoucherID = null; // Break circular foreign key cycle before deletion
                        vouchersToDelete.Add(v);
                    }
                }
                await _context.SaveChangesAsync();

                foreach (var v in vouchersToDelete)
                {
                    if (v.VoucherDetails != null && v.VoucherDetails.Any())
                    {
                        _context.VoucherDetails.RemoveRange(v.VoucherDetails);
                    }
                    _context.Vouchers.Remove(v);
                }

                // Remove collection record
                _context.LoanCollections.Remove(collection);
                await _context.SaveChangesAsync();

                // Resynchronize LoanInstallmentSchedules for this account
                if (loanAccount != null)
                {
                    var allSchedules = await _context.LoanInstallmentSchedules
                        .Where(s => s.LoanAccountID == loanAccount.LoanAccountID)
                        .OrderBy(s => s.InstallmentNo)
                        .ToListAsync();

                    if (allSchedules.Any())
                    {
                        var remainingCollections = await _context.LoanCollections
                            .Where(c => c.LoanAccountID == loanAccount.LoanAccountID && c.LoanCollectionID != id)
                            .ToListAsync();

                        Services.LoanScheduleGenerator.SynchronizeSchedules(loanAccount, allSchedules, remainingCollections);
                        foreach (var schedule in allSchedules)
                        {
                            _context.Entry(schedule).State = EntityState.Modified;
                        }
                        await _context.SaveChangesAsync();
                    }
                }

                await transaction.CommitAsync();
                return Ok(new { message = "पावती यशस्वीरित्या डिलीट केली (Receipt deleted successfully)." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "पावती डिलीट करताना त्रुटी आली: " + ex.Message });
            }
        }

        private bool LoanCollectionExists(int id)
        {
            return _context.LoanCollections.Any(e => e.LoanCollectionID == id);
        }
    }
}
