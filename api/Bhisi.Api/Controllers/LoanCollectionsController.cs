using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class LoanCollectionsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LoanCollectionsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<LoanCollection>>> GetLoanCollections([FromQuery] int? page = null, [FromQuery] int? pageSize = null)
        {
            var query = _context.LoanCollections
                .Include(c => c.LoanAccount)
                    .ThenInclude(l => l!.Member)
                .Include(c => c.LoanAccount)
                    .ThenInclude(l => l!.LoanRate)
                .Include(c => c.Fees)
                    .ThenInclude(f => f.Ledger)
                .OrderByDescending(c => c.CollectionDate);

            if (page.HasValue || pageSize.HasValue)
            {
                int p = page ?? 1;
                int ps = pageSize ?? 50;
                if (p < 1) p = 1;
                if (ps < 1 || ps > 500) ps = 50;
                return await query.Skip((p - 1) * ps).Take(ps).ToListAsync();
            }

            return await query.ToListAsync();
        }

        // GET: api/LoanCollections/next-receipt-no
        [HttpGet("next-receipt-no")]
        public async Task<ActionResult<object>> GetNextReceiptNo([FromQuery] int? branchId = null, [FromQuery] int? loanAccountId = null)
        {
            int targetBranchId = branchId ?? 1;
            if (!branchId.HasValue && loanAccountId.HasValue)
            {
                var acc = await _context.LoanAccounts.FindAsync(loanAccountId.Value);
                if (acc != null) targetBranchId = acc.BranchID;
            }

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

            var branchAccountIds = await _context.LoanAccounts
                .Where(a => a.BranchID == targetBranchId)
                .Select(a => a.LoanAccountID)
                .ToListAsync();

            int collectionCount = await _context.LoanCollections
                .CountAsync(c => branchAccountIds.Contains(c.LoanAccountID)) + 1;

            return $"{branchCode}-REC-{fy}-{collectionCount:D5}";
        }

        [HttpPost]
        public async Task<ActionResult<LoanCollection>> PostLoanCollection(LoanCollection collection)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var loanAccount = await _context.LoanAccounts.Include(l => l.LoanRate).FirstOrDefaultAsync(l => l.LoanAccountID == collection.LoanAccountID);
                if (loanAccount == null) return BadRequest("Loan account not found");

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
                    collection.ReceiptNo = await GenerateNextReceiptNoAsync(loanAccount.BranchID);
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
                    collection.InterestCollected = regularInterestPaid;
                    collection.PrincipalCollected = principalPaid;
                    collection.SurchargeCollected = 0;

                    // Fully settle account to zero for OTS
                    loanAccount.PrincipalBalance = 0;
                    loanAccount.InterestBalance = 0;
                    loanAccount.OverdueInterestBalance = 0;
                    loanAccount.Status = "Closed_OTS";
                    loanAccount.LastInstallmentPaidDate = collection.CollectionDate;
                }
                else
                {
                    // STANDARD COLLECTION WATERFALL LOGIC
                    bool isDailyReducing = loanRate != null && 
                        ((loanRate.InterestCalculationMethod?.Contains("Daily Reducing") == true) || (loanRate.InterestCalculationMethod?.Contains("Reducing") == true));

                    if (isDailyReducing)
                    {
                        var fromDateStr = loanAccount.LastInstallmentPaidDate ?? loanAccount.LoanDisbursementDate ?? loanAccount.OpeningDate;
                        var rate = loanRate?.InterestRate ?? loanAccount.InterestRate;
                        var diffTime = collection.CollectionDate - fromDateStr;
                        var diffDays = Math.Max(0, diffTime.Days);
                        decimal newInterest = diffDays > 0 ? Math.Round((loanAccount.PrincipalBalance * rate * diffDays) / 36500m) : 0;
                        loanAccount.InterestBalance += newInterest;
                    }
                    else if (loanAccount.IsOpeningBalance)
                    {
                        var dbSchedules = await _context.LoanInstallmentSchedules
                            .Where(s => s.LoanAccountID == loanAccount.LoanAccountID)
                            .ToListAsync();

                        var lastDate = loanAccount.LastInstallmentPaidDate ?? loanAccount.OpeningDate;
                        var newlyDueSchedules = dbSchedules.Where(s => s.DueDate > lastDate && s.DueDate <= collection.CollectionDate).ToList();
                        decimal newInterest = newlyDueSchedules.Sum(s => s.InterestAmount);
                        loanAccount.InterestBalance += newInterest;
                    }
                    else
                    {
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

                        loanAccount.InterestBalance = unpaidScheduledInterest;
                    }

                    decimal remaining = collection.TotalAmountReceived;

                    // A. Overdue Expenses
                    expensesPaid = Math.Min(remaining, overdueExpenses);
                    remaining -= expensesPaid;

                    // B. Overdue Interest
                    decimal interestDue = loanAccount.OverdueInterestBalance + loanAccount.InterestBalance;
                    interestPaid = Math.Min(remaining, interestDue);
                    remaining -= interestPaid;

                    penaltyPaid = Math.Min(interestPaid, loanAccount.OverdueInterestBalance);
                    regularInterestPaid = interestPaid - penaltyPaid;

                    loanAccount.OverdueInterestBalance -= penaltyPaid;
                    loanAccount.InterestBalance -= regularInterestPaid;

                    // C. Principal
                    principalPaid = Math.Min(remaining, loanAccount.PrincipalBalance);
                    remaining -= principalPaid;
                    loanAccount.PrincipalBalance -= principalPaid;

                    // Surcharge / Extra Principal
                    decimal surchargeCollected = 0;
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

                    collection.PenaltyInterestCollected = penaltyPaid;
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
                bool isNpa = lastStatus != null && lastStatus.Category != "Standard";

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

                // Update LoanInstallmentSchedules using FIFO allocation of the total principal paid
                var allSchedules = await _context.LoanInstallmentSchedules
                    .Where(s => s.LoanAccountID == collection.LoanAccountID)
                    .OrderBy(s => s.InstallmentNo)
                    .ToListAsync();

                decimal totalPrincipalPaid = loanAccount.SanctionedAmount - loanAccount.PrincipalBalance;

                foreach (var schedule in allSchedules)
                {
                    if (totalPrincipalPaid >= schedule.PrincipalAmount)
                    {
                        schedule.Status = "Paid";
                        schedule.PaidDate = schedule.PaidDate ?? collection.CollectionDate;
                        totalPrincipalPaid -= schedule.PrincipalAmount;
                    }
                    else
                    {
                        schedule.Status = "Pending";
                        schedule.PaidDate = null;
                        totalPrincipalPaid = 0;
                    }
                    _context.Entry(schedule).State = EntityState.Modified;
                }
                await _context.SaveChangesAsync();

                // Get LoanRate to fetch Ledger IDs
                var loanAccFetched = await _context.LoanAccounts.Include(l => l.Member).FirstOrDefaultAsync(l => l.LoanAccountID == collection.LoanAccountID);
                loanRate = await _context.LoanRates.FindAsync(loanAccFetched?.LoanRateID ?? 0);

                int loanLedgerId = loanRate?.LoanLedgerID ?? 0;
                if (loanLedgerId == 0)
                {
                    return BadRequest(new { message = $"कर्ज योजना '{loanRate?.LoanType ?? "अज्ञात"}' ला कर्ज मुद्दल खाते (Loan Ledger) जोडलेले नाही. कृपया कर्ज दर पत्रक (Loan Rate Master) तपासा." });
                }

                int interestLedgerId = loanRate?.InterestLedgerID ?? 0;
                if (interestLedgerId == 0)
                {
                    return BadRequest(new { message = $"कर्ज योजना '{loanRate?.LoanType ?? "अज्ञात"}' ला कर्ज व्याज खाते (Interest Ledger) जोडलेले नाही. कृपया कर्ज दर पत्रक (Loan Rate Master) तपासा." });
                }

                int overdueInterestLedgerId = (loanRate?.OverdueInterestLedgerID ?? 0) > 0 
                    ? loanRate!.OverdueInterestLedgerID!.Value 
                    : interestLedgerId;

                int targetBranchId = loanAccFetched?.BranchID ?? 1;
                int surchargeLedgerId = loanRate?.SurchargeLedgerID ?? 0;
                int cashLedgerId = collection.BankAccountLedgerID ?? await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, targetBranchId, "LOAN");

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

                // Create Voucher
                var branch = await _context.Branches.FindAsync(targetBranchId);
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

                int count = await _context.Vouchers.CountAsync(v => v.BranchID == targetBranchId && v.VoucherType == voucherType) + 1;
                string voucherNo = $"{branchCode}-{typeCode}-{fy}-{count:D5}";

                var sanstha = await _context.SansthaDetails.FirstOrDefaultAsync();
                bool autoPost = sanstha?.AutoPostVouchers ?? true;
                decimal autoPostLimit = sanstha?.AutoPostVoucherLimit ?? 50000m;
                decimal totalVoucherAmt = totalReceiptAmount + totalWaiverAmount;
                string vStatus = (autoPost && totalVoucherAmt <= autoPostLimit) ? "Approved" : "Pending";

                var voucher = new Voucher
                {
                    BranchID = targetBranchId,
                    VoucherNo = voucherNo,
                    VoucherDate = collection.CollectionDate,
                    VoucherType = voucherType,
                    Narration = $"Loan Collection (Rect No: {collection.ReceiptNo}) from {loanAccFetched?.Member?.FirstName} {loanAccFetched?.Member?.LastName} (A/C: {loanAccFetched?.LoanAccountNo}){(collection.IsOTS ? " [OTS / One Time Settlement]" : "")}",
                    TotalAmount = totalVoucherAmt,
                    Status = vStatus,
                    ApprovedBy = vStatus == "Approved" ? (collection.ApprovedByUserID ?? 1) : null,
                    ApprovedOn = vStatus == "Approved" ? DateTime.Now : null
                };
                
                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();


                // Add Voucher Details
                // Debit Cash/Bank
                if (cashLedgerId > 0 && totalReceiptAmount > 0)
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = cashLedgerId, DrCr = "Dr", Amount = totalReceiptAmount });

                // Debit Interest Waiver Expense if any
                if (waiverLedger != null && totalWaiverAmount > 0)
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = waiverLedger.LedgerID, DrCr = "Dr", Amount = totalWaiverAmount });

                // Credit Principal
                if (loanLedgerId > 0 && collection.PrincipalCollected > 0)
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = loanLedgerId, DrCr = "Cr", Amount = collection.PrincipalCollected });

                // Credit Interest (realized to P&L)
                if (interestLedgerId > 0 && collection.InterestCollected > 0)
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = interestLedgerId, DrCr = "Cr", Amount = collection.InterestCollected });

                // Credit Penalty
                if (overdueInterestLedgerId > 0 && collection.PenaltyInterestCollected > 0)
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = overdueInterestLedgerId, DrCr = "Cr", Amount = collection.PenaltyInterestCollected });

                // Credit Surcharge
                if (surchargeLedgerId > 0 && collection.SurchargeCollected > 0)
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = surchargeLedgerId, DrCr = "Cr", Amount = collection.SurchargeCollected });

                // Credit Fees
                if (collection.Fees != null)
                {
                    foreach(var fee in collection.Fees)
                    {
                        if (fee.Amount > 0 && fee.LedgerID > 0)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = fee.LedgerID, DrCr = "Cr", Amount = fee.Amount });
                        }
                    }
                }

                // Reverse Contra Entries for NPA accounts
                if (isNpa)
                {
                    if (interestPaid > 0 && ledgerOverdueIntProv != null && ledgerOverdueIntRec != null)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = ledgerOverdueIntProv.LedgerID, DrCr = "Dr", Amount = interestPaid });
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = ledgerOverdueIntRec.LedgerID, DrCr = "Cr", Amount = interestPaid });
                    }
                    if (expensesPaid > 0 && ledgerOverdueRecProv != null && ledgerOverdueRecRec != null)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = ledgerOverdueRecProv.LedgerID, DrCr = "Dr", Amount = expensesPaid });
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = ledgerOverdueRecRec.LedgerID, DrCr = "Cr", Amount = expensesPaid });
                    }
                }

                await _context.SaveChangesAsync();

                collection.VoucherID = voucher.VoucherID;
                _context.Entry(collection).State = EntityState.Modified;
                await _context.SaveChangesAsync();

                // If PaymentMode is Saving Transfer, auto-debit member's Saving Account
                if (collection.PaymentMode == "Saving Transfer" || collection.PaymentMode == "Saving")
                {
                    SavingAccountMaster? savingAccount = null;
                    if (!string.IsNullOrEmpty(collection.TransferFromSavingAccountNo))
                    {
                        savingAccount = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.AccountNo == collection.TransferFromSavingAccountNo);
                    }
                    int? memberId = loanAccFetched?.MemberID;
                    if (savingAccount == null && memberId != null)
                    {
                        savingAccount = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.MemberID == memberId.Value && s.Status == "Active");
                    }

                    if (savingAccount != null && totalReceiptAmount > 0)
                    {
                        savingAccount.CurrentBalance -= totalReceiptAmount;
                        _context.Entry(savingAccount).State = EntityState.Modified;

                        var savingTxn = new SavingTransaction
                        {
                            SavingAccountID = savingAccount.SavingAccountID,
                            CustomerID = savingAccount.CustomerID,
                            TransactionDate = collection.CollectionDate,
                            TransactionType = "Withdrawal",
                            Amount = totalReceiptAmount,
                            BalanceAfterTxn = savingAccount.CurrentBalance,
                            PaymentMode = "Transfer",
                            VoucherNo = voucher.VoucherNo,
                            Narration = $"Loan Collection Debit for Loan A/C: {loanAccFetched?.LoanAccountNo} (Receipt No: {collection.ReceiptNo})"
                        };
                        _context.SavingTransactions.Add(savingTxn);
                        await _context.SaveChangesAsync();
                    }
                }

                await transaction.CommitAsync();

                return CreatedAtAction("GetLoanCollection", new { id = collection.LoanCollectionID }, collection);
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<LoanCollection>> GetLoanCollection(int id)
        {
            var collection = await _context.LoanCollections
                .Include(c => c.LoanAccount)
                .Include(c => c.Fees)
                .ThenInclude(f => f.Ledger)
                .FirstOrDefaultAsync(c => c.LoanCollectionID == id);

            if (collection == null) return NotFound();
            return collection;
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateLoanCollectionMinor(int id, LoanCollection updatedData)
        {
            if (id != updatedData.LoanCollectionID) return BadRequest();

            var existingCollection = await _context.LoanCollections.FindAsync(id);
            if (existingCollection == null) return NotFound();

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
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var collection = await _context.LoanCollections
                    .Include(c => c.Fees)
                    .FirstOrDefaultAsync(c => c.LoanCollectionID == id);

                if (collection == null) return NotFound("Receipt not found.");

                // Revert LoanAccount PrincipalBalance
                var loanAccount = await _context.LoanAccounts.FindAsync(collection.LoanAccountID);
                if (loanAccount != null)
                {
                    loanAccount.PrincipalBalance += collection.PrincipalCollected;
                    if (loanAccount.Status == "Closed" && loanAccount.PrincipalBalance > 0)
                    {
                        loanAccount.Status = "Active";
                    }
                    _context.Entry(loanAccount).State = EntityState.Modified;
                }

                // Delete associated Fees records
                if (collection.Fees != null && collection.Fees.Any())
                {
                    _context.LoanCollectionFees.RemoveRange(collection.Fees);
                }

                // Delete associated Voucher & Details if present
                if (collection.VoucherID.HasValue)
                {
                    int vId = collection.VoucherID.Value;
                    collection.VoucherID = null; // Clear FK first
                    await _context.SaveChangesAsync();

                    var voucher = await _context.Vouchers
                        .Include(v => v.VoucherDetails)
                        .FirstOrDefaultAsync(v => v.VoucherID == vId);
                    if (voucher != null)
                    {
                        if (voucher.VoucherDetails != null && voucher.VoucherDetails.Any())
                        {
                            _context.VoucherDetails.RemoveRange(voucher.VoucherDetails);
                        }
                        _context.Vouchers.Remove(voucher);
                    }
                }

                // Remove collection record
                _context.LoanCollections.Remove(collection);
                await _context.SaveChangesAsync();

                // Recalculate LoanInstallmentSchedules for this account
                if (loanAccount != null)
                {
                    var allSchedules = await _context.LoanInstallmentSchedules
                        .Where(s => s.LoanAccountID == loanAccount.LoanAccountID)
                        .OrderBy(s => s.InstallmentNo)
                        .ToListAsync();

                    decimal totalPrincipalPaid = loanAccount.SanctionedAmount - loanAccount.PrincipalBalance;

                    foreach (var schedule in allSchedules)
                    {
                        if (totalPrincipalPaid >= schedule.PrincipalAmount)
                        {
                            schedule.Status = "Paid";
                            totalPrincipalPaid -= schedule.PrincipalAmount;
                        }
                        else
                        {
                            schedule.Status = "Pending";
                            schedule.PaidDate = null;
                            totalPrincipalPaid = 0;
                        }
                        _context.Entry(schedule).State = EntityState.Modified;
                    }
                    await _context.SaveChangesAsync();
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
