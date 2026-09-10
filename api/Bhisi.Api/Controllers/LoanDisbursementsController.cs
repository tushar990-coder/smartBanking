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

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class LoanDisbursementsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LoanDisbursementsController(AppDbContext context)
        {
            _context = context;
        }

        private (int userId, string username, int branchId) GetCurrentUserContext()
        {
            int userId = 1;
            string username = "System";
            int branchId = 1;

            var userClaim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("UserID") ?? User.FindFirst("sub");
            if (userClaim != null && int.TryParse(userClaim.Value, out int uid)) userId = uid;

            var nameClaim = User.FindFirst(ClaimTypes.Name) ?? User.FindFirst("Username");
            if (nameClaim != null && !string.IsNullOrWhiteSpace(nameClaim.Value)) username = nameClaim.Value;

            var branchClaim = User.FindFirst("BranchID") ?? User.FindFirst("branchID");
            if (branchClaim != null && int.TryParse(branchClaim.Value, out int bid)) branchId = bid;

            return (userId, username, branchId);
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<LoanDisbursement>>> GetLoanDisbursements()
        {
            return await _context.LoanDisbursements
                .Include(d => d.LoanAccount!).ThenInclude(l => l.Customer)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.Member)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.Guarantor1Member)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.Guarantor2Member)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.Guarantor1Customer)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.Guarantor2Customer)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.LoanRate)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.LoanApplication!).ThenInclude(a => a.Customer)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.LoanApplication!).ThenInclude(a => a.Member)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.LoanApplication!).ThenInclude(a => a.Guarantor1Member)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.LoanApplication!).ThenInclude(a => a.Guarantor2Member)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.LoanApplication!).ThenInclude(a => a.Guarantor1Customer)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.LoanApplication!).ThenInclude(a => a.Guarantor2Customer)
                .Include(d => d.Deductions).ThenInclude(d => d.Ledger)
                .Include(d => d.BankAccountLedger)
                .OrderByDescending(d => d.DisbursementDate)
                .ToListAsync();
        }

        [HttpPost]
        public async Task<ActionResult<LoanDisbursement>> PostLoanDisbursement(LoanDisbursement disbursement)
        {
            // Begin a transaction because we need to update the LoanAccount and generate a Voucher
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var cleanDate = DateTime.SpecifyKind(disbursement.DisbursementDate.Date, DateTimeKind.Unspecified);
                disbursement.DisbursementDate = cleanDate;

                // Ensure all ledgers are loaded and validated
                var ledgers = await _context.Ledgers.ToListAsync();
                var validLedgerDict = ledgers.ToDictionary(l => l.LedgerID);
                var shareCapitalLedger = await Helpers.ShareLedgerHelper.GetShareCapitalLedgerAsync(_context);

                decimal shareDed = 0, procFee = 0, insDed = 0, statCharges = 0, otherDed = 0;
                if (disbursement.Deductions != null)
                {
                    foreach(var ded in disbursement.Deductions)
                    {
                        if (!validLedgerDict.ContainsKey(ded.LedgerID))
                        {
                            ded.LedgerID = shareCapitalLedger.LedgerID;
                        }

                        if (validLedgerDict.TryGetValue(ded.LedgerID, out var l))
                        {
                            var name = (l.LedgerName ?? "").ToLower();
                            if(name.Contains("share") || name.Contains("भाग")) shareDed += ded.Amount;
                            else if(name.Contains("processing") || name.Contains("fee") || name.Contains("प्रोसेसिंग")) procFee += ded.Amount;
                            else if(name.Contains("insurance") || name.Contains("विमा")) insDed += ded.Amount;
                            else if(name.Contains("stationery") || name.Contains("form") || name.Contains("स्टेशनरी") || name.Contains("फॉर्म")) statCharges += ded.Amount;
                            else if(!name.Contains("deposit") && !name.Contains("ठेव")) otherDed += ded.Amount;
                        }
                    }
                }

                disbursement.ShareDeduction = shareDed;
                disbursement.ProcessingFee = procFee;
                disbursement.InsuranceDeduction = insDed;
                disbursement.StationeryCharges = statCharges;
                disbursement.OtherDeductions = otherDed;
                
                var app = await _context.LoanApplications.FindAsync(disbursement.LoanAccount?.LoanApplicationID ?? 0);
                
                int appId = disbursement.LoanAccount?.LoanApplicationID ?? (app?.LoanApplicationID ?? 0);
                LoanAccount? existingLoanAcc = null;

                if (disbursement.LoanAccountID > 0)
                {
                    existingLoanAcc = await _context.LoanAccounts.FindAsync(disbursement.LoanAccountID);
                }
                else if (appId > 0)
                {
                    existingLoanAcc = await _context.LoanAccounts.FirstOrDefaultAsync(l => l.LoanApplicationID == appId);
                }

                decimal sanctionedLimit = 0;
                if (existingLoanAcc != null && existingLoanAcc.SanctionedAmount > 0)
                {
                    sanctionedLimit = existingLoanAcc.SanctionedAmount;
                }
                else if (app != null && app.RequestedAmount > 0)
                {
                    sanctionedLimit = app.RequestedAmount;
                }
                else if (disbursement.SanctionedAmount > 0)
                {
                    sanctionedLimit = disbursement.SanctionedAmount;
                }
                else
                {
                    sanctionedLimit = disbursement.DisbursementAmount;
                }
                disbursement.SanctionedAmount = sanctionedLimit;

                // Check already disbursed amount
                decimal alreadyDisbursed = 0;
                if (existingLoanAcc != null)
                {
                    alreadyDisbursed = await _context.LoanDisbursements
                        .Where(d => d.LoanAccountID == existingLoanAcc.LoanAccountID)
                        .SumAsync(d => d.DisbursementAmount);
                }

                decimal pendingLimit = Math.Max(0, sanctionedLimit - alreadyDisbursed);

                // Multi-Tranche Strict Validation: Disbursement amount cannot exceed pending sanctioned limit
                if (disbursement.DisbursementAmount > pendingLimit)
                {
                    return BadRequest($"वाटप रक्कम (₹{disbursement.DisbursementAmount:N2}) ही शिल्लक मंजूर मर्यादेपेक्षा (₹{pendingLimit:N2}) जास्त असू शकत नाही! एकूण मंजूर मर्यादा: ₹{sanctionedLimit:N2}, यापूर्वीचे वाटप: ₹{alreadyDisbursed:N2}.");
                }

                if (existingLoanAcc != null)
                {
                    // Reuse existing LoanAccount for subsequent tranche
                    disbursement.LoanAccountID = existingLoanAcc.LoanAccountID;
                    existingLoanAcc.PrincipalBalance += disbursement.DisbursementAmount;
                    existingLoanAcc.OpeningDate = cleanDate; // Update last active disbursement date
                    existingLoanAcc.LoanDisbursementDate = cleanDate;
                    
                    if (existingLoanAcc.SanctionedAmount <= 0)
                    {
                        existingLoanAcc.SanctionedAmount = sanctionedLimit;
                    }

                    _context.Entry(existingLoanAcc).State = EntityState.Modified;
                    disbursement.LoanAccount = null; // Prevent EF tracking conflicts

                    // Update / Regenerate installment schedules for the updated principal balance
                    var oldPendingSchedules = await _context.LoanInstallmentSchedules
                        .Where(s => s.LoanAccountID == existingLoanAcc.LoanAccountID && s.Status != "Paid")
                        .ToListAsync();
                    if (oldPendingSchedules.Any())
                    {
                        _context.LoanInstallmentSchedules.RemoveRange(oldPendingSchedules);
                    }

                    var loanRateForCalc = await _context.LoanRates.FindAsync(existingLoanAcc.LoanRateID);
                    var scheduleRecords = Services.LoanScheduleGenerator.GenerateSchedules(existingLoanAcc, loanRateForCalc);
                    foreach (var s in scheduleRecords)
                    {
                        s.LoanAccountID = existingLoanAcc.LoanAccountID;
                        _context.LoanInstallmentSchedules.Add(s);
                    }
                    await _context.SaveChangesAsync();
                }
                else if (disbursement.LoanAccountID == 0 && disbursement.LoanAccount != null)
                {
                    // First Tranche: Create new LoanAccount
                    var branch = await _context.Branches.FindAsync(disbursement.LoanAccount.BranchID);
                    if (branch == null) return BadRequest("निवडलेली शाखा सापडली नाही.");

                    if (app != null)
                    {
                        if (!disbursement.LoanAccount.CustomerID.HasValue && app.CustomerID.HasValue)
                            disbursement.LoanAccount.CustomerID = app.CustomerID;

                        if (!disbursement.LoanAccount.MemberID.HasValue && app.MemberID.HasValue)
                            disbursement.LoanAccount.MemberID = app.MemberID;

                        if (!disbursement.LoanAccount.CoCustomerID.HasValue && app.CoCustomerID.HasValue)
                            disbursement.LoanAccount.CoCustomerID = app.CoCustomerID;

                        if (!disbursement.LoanAccount.CoCustomer2ID.HasValue && app.CoCustomer2ID.HasValue)
                            disbursement.LoanAccount.CoCustomer2ID = app.CoCustomer2ID;

                        if (!disbursement.LoanAccount.CoMemberID.HasValue && app.CoMemberID.HasValue)
                            disbursement.LoanAccount.CoMemberID = app.CoMemberID;

                        if (!disbursement.LoanAccount.CoMember2ID.HasValue && app.CoMember2ID.HasValue)
                            disbursement.LoanAccount.CoMember2ID = app.CoMember2ID;

                        if (!disbursement.LoanAccount.Guarantor1CustomerID.HasValue && app.Guarantor1CustomerID.HasValue)
                            disbursement.LoanAccount.Guarantor1CustomerID = app.Guarantor1CustomerID;

                        if (!disbursement.LoanAccount.Guarantor2CustomerID.HasValue && app.Guarantor2CustomerID.HasValue)
                            disbursement.LoanAccount.Guarantor2CustomerID = app.Guarantor2CustomerID;

                        if (!disbursement.LoanAccount.Guarantor1MemberID.HasValue && app.Guarantor1MemberID.HasValue)
                            disbursement.LoanAccount.Guarantor1MemberID = app.Guarantor1MemberID;

                        if (!disbursement.LoanAccount.Guarantor2MemberID.HasValue && app.Guarantor2MemberID.HasValue)
                            disbursement.LoanAccount.Guarantor2MemberID = app.Guarantor2MemberID;

                        if (string.IsNullOrWhiteSpace(disbursement.LoanAccount.SecurityDetails) && !string.IsNullOrWhiteSpace(app.SecurityDetails))
                            disbursement.LoanAccount.SecurityDetails = app.SecurityDetails;

                        if (disbursement.LoanAccount.SecurityValue == 0 && app.SecurityValue > 0)
                            disbursement.LoanAccount.SecurityValue = app.SecurityValue;
                    }

                    // Sanitize 0 values to null for nullable foreign keys
                    if (disbursement.LoanAccount.CustomerID.HasValue && disbursement.LoanAccount.CustomerID.Value <= 0) disbursement.LoanAccount.CustomerID = null;
                    if (disbursement.LoanAccount.MemberID.HasValue && disbursement.LoanAccount.MemberID.Value <= 0) disbursement.LoanAccount.MemberID = null;
                    if (disbursement.LoanAccount.CoCustomerID.HasValue && disbursement.LoanAccount.CoCustomerID.Value <= 0) disbursement.LoanAccount.CoCustomerID = null;
                    if (disbursement.LoanAccount.CoCustomer2ID.HasValue && disbursement.LoanAccount.CoCustomer2ID.Value <= 0) disbursement.LoanAccount.CoCustomer2ID = null;
                    if (disbursement.LoanAccount.CoMemberID.HasValue && disbursement.LoanAccount.CoMemberID.Value <= 0) disbursement.LoanAccount.CoMemberID = null;
                    if (disbursement.LoanAccount.CoMember2ID.HasValue && disbursement.LoanAccount.CoMember2ID.Value <= 0) disbursement.LoanAccount.CoMember2ID = null;
                    if (disbursement.LoanAccount.Guarantor1CustomerID.HasValue && disbursement.LoanAccount.Guarantor1CustomerID.Value <= 0) disbursement.LoanAccount.Guarantor1CustomerID = null;
                    if (disbursement.LoanAccount.Guarantor2CustomerID.HasValue && disbursement.LoanAccount.Guarantor2CustomerID.Value <= 0) disbursement.LoanAccount.Guarantor2CustomerID = null;
                    if (disbursement.LoanAccount.Guarantor1MemberID.HasValue && disbursement.LoanAccount.Guarantor1MemberID.Value <= 0) disbursement.LoanAccount.Guarantor1MemberID = null;
                    if (disbursement.LoanAccount.Guarantor2MemberID.HasValue && disbursement.LoanAccount.Guarantor2MemberID.Value <= 0) disbursement.LoanAccount.Guarantor2MemberID = null;

                    // Generate Account number: [BranchCode]02[5-digit sequence]
                    string prefix = $"{branch.BranchCode}02";
                    var existingNos = await _context.LoanAccounts
                        .Where(a => a.BranchID == disbursement.LoanAccount.BranchID && a.LoanAccountNo != null && a.LoanAccountNo.StartsWith(prefix))
                        .Select(a => a.LoanAccountNo!)
                        .ToListAsync();

                    int maxSeq = 0;
                    foreach (var accNo in existingNos)
                    {
                        if (accNo.Length > prefix.Length)
                        {
                            var suffix = accNo.Substring(prefix.Length);
                            if (int.TryParse(suffix, out int val) && val > maxSeq)
                            {
                                maxSeq = val;
                            }
                        }
                    }
                    if (maxSeq == 0 && existingNos.Any()) maxSeq = existingNos.Count;

                    int nextSeq = maxSeq + 1;
                    string nextAccNo = $"{prefix}{nextSeq:D5}";
                    while (existingNos.Contains(nextAccNo))
                    {
                        nextSeq++;
                        nextAccNo = $"{prefix}{nextSeq:D5}";
                    }
                    disbursement.LoanAccount.LoanAccountNo = nextAccNo;
                    disbursement.LoanAccount.SanctionedAmount = sanctionedLimit;
                    disbursement.LoanAccount.PrincipalBalance = disbursement.DisbursementAmount;

                    _context.LoanAccounts.Add(disbursement.LoanAccount);
                    await _context.SaveChangesAsync();
                    
                    var loanAcc = disbursement.LoanAccount;
                    disbursement.LoanAccountID = loanAcc.LoanAccountID;
                    disbursement.LoanAccount = null; // Prevent EF tracking issues
                    
                    // Get calculation method from LoanRate
                    var loanRateForCalc = await _context.LoanRates.FindAsync(loanAcc.LoanRateID);

                    // Generate Installment Schedule using centralized generator
                    var scheduleRecords = Services.LoanScheduleGenerator.GenerateSchedules(loanAcc, loanRateForCalc);
                    foreach (var s in scheduleRecords)
                    {
                        s.LoanAccountID = loanAcc.LoanAccountID;
                        _context.LoanInstallmentSchedules.Add(s);
                    }
                    await _context.SaveChangesAsync();
                    
                    if (app != null)
                    {
                        app.LoanAccountNo = loanAcc.LoanAccountNo; 
                        _context.Entry(app).State = EntityState.Modified;
                    }
                }

                var loanAccountForRate = await _context.LoanAccounts.FindAsync(disbursement.LoanAccountID);
                var rateForDisb = loanAccountForRate != null ? await _context.LoanRates.FindAsync(loanAccountForRate.LoanRateID) : null;
                disbursement.LoanInstallmentType = rateForDisb?.LoanInstallmentType;

                disbursement.BankAccountLedger = null; // Prevent EF tracking issues
                _context.LoanDisbursements.Add(disbursement);
                await _context.SaveChangesAsync();

                // Get LoanRate to fetch Ledger IDs
                var loanAccFetched = await _context.LoanAccounts
                    .Include(l => l.Customer)
                    .Include(l => l.Member)
                    .FirstOrDefaultAsync(l => l.LoanAccountID == disbursement.LoanAccountID);
                var loanRate = await _context.LoanRates.FindAsync(loanAccFetched?.LoanRateID ?? 0);
                int targetBranchId = loanAccFetched?.BranchID ?? 1;

                int loanLedgerId = loanRate?.LoanLedgerID ?? 0;
                if (loanLedgerId == 0 || !validLedgerDict.ContainsKey(loanLedgerId))
                {
                    return BadRequest(new { message = $"कर्ज योजना '{loanRate?.LoanType ?? "अज्ञात"}' ला वैध कर्ज मुद्दल खाते (Loan Ledger) जोडलेले नाही. कृपया कर्ज दर पत्रक (Loan Rate Master) तपासा." });
                }

                int cashLedgerId = 0;
                if (disbursement.PaymentMode == "Saving Transfer" || disbursement.PaymentMode == "Saving") {
                    var savingLedger = ledgers.FirstOrDefault(l => 
                        (l.LedgerName ?? "").Contains("बचत ठेवा") || 
                        (l.LedgerName ?? "").Contains("बचत ठेव") || 
                        (l.LedgerName ?? "").Contains("बचत खाते") || 
                        (l.LedgerName ?? "").Contains("Saving Deposit") || 
                        (l.LedgerName ?? "").Contains("Saving Account")
                    ) ?? ledgers.FirstOrDefault(l => (l.LedgerName ?? "").Contains("बचत") || (l.LedgerName ?? "").Contains("Saving"));
                    if (savingLedger != null) cashLedgerId = savingLedger.LedgerID;
                }
                else if (disbursement.PaymentMode == "Bank" || disbursement.PaymentMode == "Cheque" || disbursement.PaymentMode == "RTGS")
                {
                    if (disbursement.BankAccountLedgerID.HasValue && disbursement.BankAccountLedgerID.Value > 0 && validLedgerDict.ContainsKey(disbursement.BankAccountLedgerID.Value))
                    {
                        cashLedgerId = disbursement.BankAccountLedgerID.Value;
                    }
                }

                if (cashLedgerId == 0 || !validLedgerDict.ContainsKey(cashLedgerId))
                {
                    cashLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, targetBranchId, "LOAN");
                }

                // Create Voucher
                var vBranch = await _context.Branches.FindAsync(targetBranchId);
                string branchCode = vBranch?.BranchCode ?? "HQ";
                string voucherType = disbursement.PaymentMode == "Cash" ? "Payment" : "Journal";
                string typeCode = voucherType == "Payment" ? "PAY" : "JV";

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
                string vStatus = (autoPost && disbursement.DisbursementAmount <= autoPostLimit) ? "Approved" : "Pending";

                string borrowerName = loanAccFetched?.Customer != null 
                    ? $"{loanAccFetched.Customer.FirstName} {loanAccFetched.Customer.LastName}".Trim() 
                    : (loanAccFetched?.Member != null ? $"{loanAccFetched.Member.FirstName} {loanAccFetched.Member.LastName}".Trim() : "N/A");

                var voucher = new Voucher
                {
                    BranchID = targetBranchId,
                    VoucherNo = voucherNo,
                    VoucherDate = disbursement.DisbursementDate,
                    VoucherType = voucherType,
                    Narration = $"Loan Disbursed to {borrowerName} (A/C: {loanAccFetched?.LoanAccountNo})",
                    TotalAmount = disbursement.DisbursementAmount,
                    Status = vStatus,
                    ApprovedBy = vStatus == "Approved" ? GetCurrentUserContext().userId : null,
                    ApprovedOn = vStatus == "Approved" ? DateTime.Now : null
                };
                
                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();

                // Add Voucher Details
                int? memberId = loanAccFetched?.MemberID;

                if (loanLedgerId > 0 && disbursement.DisbursementAmount > 0)
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = loanLedgerId, DrCr = "Dr", Amount = disbursement.DisbursementAmount, MemberID = memberId });

                if (cashLedgerId > 0 && disbursement.NetAmountPaid > 0)
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = cashLedgerId, DrCr = "Cr", Amount = disbursement.NetAmountPaid, MemberID = memberId });

                if (disbursement.Deductions != null && disbursement.Deductions.Any())
                {
                    foreach(var ded in disbursement.Deductions)
                    {
                        if (ded.Amount > 0)
                        {
                            int targetDedLedgerId = validLedgerDict.ContainsKey(ded.LedgerID) ? ded.LedgerID : shareCapitalLedger.LedgerID;
                            _context.VoucherDetails.Add(new VoucherDetail { 
                                VoucherID = voucher.VoucherID, 
                                LedgerID = targetDedLedgerId, 
                                DrCr = "Cr", 
                                Amount = ded.Amount, 
                                MemberID = memberId 
                            });
                        }
                    }
                }

                await _context.SaveChangesAsync();

                // Auto-allocate shares in Share Module if Share Deduction is present
                if (disbursement.ShareDeduction > 0)
                {
                    Member? targetMember = null;
                    if (memberId.HasValue && memberId.Value > 0)
                    {
                        targetMember = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == memberId.Value);
                    }
                    else if (loanAccFetched?.CustomerID.HasValue == true && loanAccFetched.CustomerID.Value > 0)
                    {
                        targetMember = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.CustomerID == loanAccFetched.CustomerID.Value);
                        if (targetMember == null)
                        {
                            var cust = await _context.Customers.FindAsync(loanAccFetched.CustomerID.Value);
                            if (cust != null)
                            {
                                int maxMemId = await _context.Members.MaxAsync(m => (int?)m.MemberID) ?? 0;
                                int nextNum = maxMemId + 1;
                                targetMember = new Member
                                {
                                    CustomerID = cust.CustomerID,
                                    BranchID = loanAccFetched.BranchID,
                                    MemberCode = $"MEM{nextNum:D4}",
                                    MembershipType = "Nominal",
                                    JoiningDate = DateTime.Today,
                                    Status = "Active"
                                };
                                _context.Members.Add(targetMember);
                                await _context.SaveChangesAsync();

                                loanAccFetched.MemberID = targetMember.MemberID;
                                memberId = targetMember.MemberID;
                                _context.Entry(loanAccFetched).State = EntityState.Modified;
                                await _context.SaveChangesAsync();
                            }
                        }
                        else
                        {
                            loanAccFetched.MemberID = targetMember.MemberID;
                            memberId = targetMember.MemberID;
                            _context.Entry(loanAccFetched).State = EntityState.Modified;
                            await _context.SaveChangesAsync();
                        }
                    }

                    decimal shareDeductionAmt = disbursement.ShareDeduction;
                    int numShares = (int)Math.Floor(shareDeductionAmt / 100m);
                    if (numShares > 0 && targetMember != null && memberId.HasValue && memberId.Value > 0)
                    {
                            // Assign official Member Code (MEM0001 format) upon Loan Share Deduction if missing
                            if (string.IsNullOrWhiteSpace(targetMember.MemberCode) || targetMember.MemberCode.StartsWith("TEMP"))
                            {
                                var existingCodes = await _context.Members
                                    .Where(m => !string.IsNullOrEmpty(m.MemberCode))
                                    .Select(m => m.MemberCode)
                                    .ToListAsync();
                                var existingLegacy = await _context.Members
                                    .Where(m => !string.IsNullOrEmpty(m.LegacyMemberNo))
                                    .Select(m => m.LegacyMemberNo)
                                    .ToListAsync();

                                int maxCodeNum = await _context.Members.MaxAsync(m => (int?)m.MemberID) ?? 0;
                                foreach (var code in existingCodes)
                                {
                                    if (string.IsNullOrEmpty(code)) continue;
                                    var digits = new string(code.Where(char.IsDigit).ToArray());
                                    if (int.TryParse(digits, out int num) && num > maxCodeNum) maxCodeNum = num;
                                }
                                foreach (var code in existingLegacy)
                                {
                                    if (string.IsNullOrEmpty(code)) continue;
                                    var digits = new string(code.Where(char.IsDigit).ToArray());
                                    if (int.TryParse(digits, out int num) && num > maxCodeNum) maxCodeNum = num;
                                }

                                int nextMemberNum = maxCodeNum + 1;
                                targetMember.MemberCode = $"MEM{nextMemberNum:D4}";
                                targetMember.MembershipType = "Regular";
                                _context.Entry(targetMember).State = EntityState.Modified;
                            }

                            var shAcc = await _context.ShareAccounts.FirstOrDefaultAsync(s => s.MemberId == memberId.Value);
                            if (shAcc == null)
                            {
                                int nextShSeq = await _context.ShareAccounts.CountAsync() + 1;
                                shAcc = new ShareAccount
                                {
                                    MemberId = memberId.Value,
                                    AccountNo = $"SH-{nextShSeq:D4}",
                                    OpeningDate = cleanDate,
                                    TotalShareCount = 0,
                                    TotalShareAmount = 0m,
                                    DividendPayableBalance = 0m,
                                    Status = "Active"
                                };
                                _context.ShareAccounts.Add(shAcc);
                                await _context.SaveChangesAsync();
                            }

                            shAcc.TotalShareCount += numShares;
                            shAcc.TotalShareAmount += numShares * 100m;
                            _context.Entry(shAcc).State = EntityState.Modified;

                            int nextCertCount = await _context.ShareCertificates.CountAsync() + 1;
                            int maxToShareNo = await _context.ShareCertificates.MaxAsync(c => (int?)c.ToShareNo) ?? 0;
                            int nextFromShareNo = maxToShareNo + 1;
                            int nextToShareNo = nextFromShareNo + numShares - 1;
                            string certNo = $"CERT-{cleanDate.Year}-{nextCertCount:D5}";

                            var cert = new ShareCertificate
                            {
                                ShareAccountId = shAcc.ShareAccountId,
                                CustomerID = targetMember?.CustomerID ?? memberId.Value,
                                CertificateNo = certNo,
                                FromShareNo = nextFromShareNo,
                                ToShareNo = nextToShareNo,
                                NumberOfShares = numShares,
                                FaceValue = 100m,
                                IssueDate = cleanDate,
                                Status = "Issued"
                            };
                            _context.ShareCertificates.Add(cert);

                            var shareTx = new ShareTransaction
                            {
                                ShareAccountId = shAcc.ShareAccountId,
                                CustomerID = targetMember?.CustomerID ?? memberId.Value,
                                TransactionDate = cleanDate,
                                TransactionType = "Allotment",
                                NumberOfShares = numShares,
                                Amount = numShares * 100m,
                                Narration = $"Loan Disbursement Share Deduction",
                                VoucherId = voucher.VoucherID
                            };
                            _context.ShareTransactions.Add(shareTx);
                            await _context.SaveChangesAsync();
                        }
                    }

                // If PaymentMode is Saving Transfer, auto-credit member's Saving Account
                if (disbursement.PaymentMode == "Saving Transfer" || disbursement.PaymentMode == "Saving")
                {
                    SavingAccountMaster? savingAccount = null;
                    if (!string.IsNullOrEmpty(disbursement.TransferToSavingAccountNo))
                    {
                        savingAccount = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.AccountNo == disbursement.TransferToSavingAccountNo);
                    }
                    int? custId = loanAccFetched?.CustomerID ?? loanAccFetched?.Customer?.CustomerID ?? loanAccFetched?.Member?.CustomerID;
                    if (savingAccount == null && custId != null)
                    {
                        savingAccount = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.CustomerID == custId.Value && s.Status == "Active");
                    }

                    if (savingAccount != null && disbursement.NetAmountPaid > 0)
                    {
                        savingAccount.CurrentBalance += disbursement.NetAmountPaid;
                        _context.Entry(savingAccount).State = EntityState.Modified;

                        var savingTxn = new SavingTransaction
                        {
                            SavingAccountID = savingAccount.SavingAccountID,
                            CustomerID = savingAccount.CustomerID,
                            TransactionDate = disbursement.DisbursementDate,
                            TransactionType = "Deposit",
                            Amount = disbursement.NetAmountPaid,
                            BalanceAfterTxn = savingAccount.CurrentBalance,
                            PaymentMode = "Transfer",
                            VoucherNo = voucher.VoucherNo,
                            Narration = $"Loan Disbursement Credit from Loan A/C: {loanAccFetched?.LoanAccountNo}"
                        };
                        _context.SavingTransactions.Add(savingTxn);
                        await _context.SaveChangesAsync();
                    }
                }

                disbursement.VoucherID = voucher.VoucherID;
                _context.Entry(disbursement).State = EntityState.Modified;
                await _context.SaveChangesAsync();

                // NPA Integration: Add initial CollateralComplianceLog for secured loans
                if (disbursement.CollateralValue.HasValue && disbursement.CollateralValue.Value > 0)
                {
                    var collateralLog = new CollateralComplianceLog
                    {
                        LoanAccountID = disbursement.LoanAccountID,
                        ValuationDate = disbursement.DisbursementDate,
                        CollateralValue = disbursement.CollateralValue.Value,
                        CollateralDescription = disbursement.CollateralDescription,
                        MarginPercent = 0, // Default or fetch from config
                        IsMarginMaintained = true,
                        InspectorName = "System (Disbursement)",
                        Remarks = "Initial valuation from Disbursement"
                    };
                    _context.CollateralComplianceLogs.Add(collateralLog);
                    
                    // Also update the LoanAccount to cache this
                    var la = await _context.LoanAccounts.FindAsync(disbursement.LoanAccountID);
                    if (la != null)
                    {
                        la.SecurityValue = disbursement.CollateralValue.Value;
                        la.SecurityDetails = disbursement.CollateralDescription;
                    }
                    
                    await _context.SaveChangesAsync();
                }

                await transaction.CommitAsync();

                return Ok(new { message = "Success", id = disbursement.LoanDisbursementID });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest(ex.Message + (ex.InnerException != null ? " | " + ex.InnerException.Message : ""));
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<LoanDisbursement>> GetLoanDisbursement(int id)
        {
            var disbursement = await _context.LoanDisbursements.Include(d => d.LoanAccount).Include(d => d.Deductions).ThenInclude(d => d.Ledger).FirstOrDefaultAsync(d => d.LoanDisbursementID == id);

            if (disbursement == null) return NotFound();
            return disbursement;
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutLoanDisbursement(int id, LoanDisbursement disbursement)
        {
            if (id != disbursement.LoanDisbursementID)
            {
                return BadRequest("ID mismatch");
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var existingDisbursement = await _context.LoanDisbursements
                    .Include(d => d.Voucher!)
                    .ThenInclude(v => v.VoucherDetails)
                    .Include(d => d.Deductions)
                    .FirstOrDefaultAsync(d => d.LoanDisbursementID == id);

                if (existingDisbursement == null)
                {
                    return NotFound();
                }

                // Ensure Date uses Unspecified Kind so SQLite saves it exactly as YYYY-MM-DD 00:00:00
                var cleanDate = DateTime.SpecifyKind(disbursement.DisbursementDate.Date, DateTimeKind.Unspecified);
                
                // Validate total limit on update
                var otherDisbursementsSum = await _context.LoanDisbursements
                    .Where(d => d.LoanAccountID == existingDisbursement.LoanAccountID && d.LoanDisbursementID != id)
                    .SumAsync(d => d.DisbursementAmount);

                decimal sanctionedLimit = existingDisbursement.SanctionedAmount > 0 ? existingDisbursement.SanctionedAmount : disbursement.SanctionedAmount;
                decimal maxAllowedForThis = Math.Max(0, sanctionedLimit - otherDisbursementsSum);

                if (disbursement.DisbursementAmount > maxAllowedForThis)
                {
                    return BadRequest($"सुधारित वाटप रक्कम (₹{disbursement.DisbursementAmount:N2}) ही शिल्लक मंजूर मर्यादेपेक्षा (₹{maxAllowedForThis:N2}) जास्त असू शकत नाही! एकूण मंजूर मर्यादा: ₹{sanctionedLimit:N2}, इतर वाटप: ₹{otherDisbursementsSum:N2}.");
                }

                // Update scalar properties
                decimal amountDifference = disbursement.DisbursementAmount - existingDisbursement.DisbursementAmount;
                
                existingDisbursement.DisbursementDate = cleanDate;
                existingDisbursement.SanctionedAmount = sanctionedLimit;
                existingDisbursement.DisbursementAmount = disbursement.DisbursementAmount;
                
                // Categorize deductions into scalar properties
                var ledgers = await _context.Ledgers.ToListAsync();
                var validLedgerDict = ledgers.ToDictionary(l => l.LedgerID);
                var shareCapitalLedger = await Helpers.ShareLedgerHelper.GetShareCapitalLedgerAsync(_context);

                decimal shareDed = 0, procFee = 0, insDed = 0, statCharges = 0, otherDed = 0;
                if (disbursement.Deductions != null)
                {
                    foreach(var ded in disbursement.Deductions)
                    {
                        if (!validLedgerDict.ContainsKey(ded.LedgerID))
                        {
                            ded.LedgerID = shareCapitalLedger.LedgerID;
                        }

                        if (validLedgerDict.TryGetValue(ded.LedgerID, out var l))
                        {
                            var name = (l.LedgerName ?? "").ToLower();
                            if(name.Contains("share") || name.Contains("भाग")) shareDed += ded.Amount;
                            else if(name.Contains("processing") || name.Contains("fee") || name.Contains("प्रोसेसिंग")) procFee += ded.Amount;
                            else if(name.Contains("insurance") || name.Contains("विमा")) insDed += ded.Amount;
                            else if(name.Contains("stationery") || name.Contains("form") || name.Contains("स्टेशनरी") || name.Contains("फॉर्म")) statCharges += ded.Amount;
                            else if(!name.Contains("deposit") && !name.Contains("ठेव")) otherDed += ded.Amount;
                        }
                    }
                }

                existingDisbursement.ProcessingFee = procFee;
                existingDisbursement.ShareDeduction = shareDed;
                existingDisbursement.InsuranceDeduction = insDed;
                existingDisbursement.StationeryCharges = statCharges;
                existingDisbursement.OtherDeductions = otherDed;
                existingDisbursement.NetAmountPaid = disbursement.NetAmountPaid;

                // Update Deductions
                _context.LoanDisbursementDeductions.RemoveRange(existingDisbursement.Deductions);
                if (disbursement.Deductions != null)
                {
                    foreach (var d in disbursement.Deductions)
                    {
                        int validDedLedgerId = validLedgerDict.ContainsKey(d.LedgerID) ? d.LedgerID : shareCapitalLedger.LedgerID;
                        d.LoanDisbursementDeductionID = 0;
                        d.LoanDisbursementID = id;
                        d.LedgerID = validDedLedgerId;
                        d.LoanDisbursement = null;
                        d.Ledger = null;
                        _context.LoanDisbursementDeductions.Add(d);
                    }
                }
                existingDisbursement.PaymentMode = disbursement.PaymentMode;
                existingDisbursement.BankName = disbursement.BankName;
                existingDisbursement.ChequeNo = disbursement.ChequeNo;
                existingDisbursement.BankAccountLedgerID = disbursement.BankAccountLedgerID;
                existingDisbursement.TransferToSavingAccountNo = disbursement.TransferToSavingAccountNo;
                existingDisbursement.Remarks = disbursement.Remarks;

                // Update Voucher
                if (existingDisbursement.Voucher != null)
                {
                    existingDisbursement.Voucher.VoucherDate = cleanDate;
                    existingDisbursement.Voucher.TotalAmount = disbursement.DisbursementAmount;
                    existingDisbursement.Voucher.Status = "Approved";
                    
                    var voucherType = disbursement.PaymentMode == "Cash" ? "Payment" : "Journal";
                    existingDisbursement.Voucher.VoucherType = voucherType;
                    
                    var loanAccFetched = await _context.LoanAccounts.Include(l => l.Member).FirstOrDefaultAsync(l => l.LoanAccountID == existingDisbursement.LoanAccountID);
                    if (loanAccFetched != null)
                    {
                        loanAccFetched.OpeningDate = disbursement.DisbursementDate;
                        loanAccFetched.LoanDisbursementDate = disbursement.DisbursementDate;
                        loanAccFetched.PrincipalBalance += amountDifference;
                        loanAccFetched.SanctionedAmount = disbursement.SanctionedAmount;
                        
                        if (disbursement.LoanAccount != null && disbursement.LoanAccount.InterestRate > 0)
                        {
                            loanAccFetched.InterestRate = disbursement.LoanAccount.InterestRate;
                            loanAccFetched.DurationMonths = disbursement.LoanAccount.DurationMonths;
                            loanAccFetched.InstallmentAmount = disbursement.LoanAccount.InstallmentAmount;
                            loanAccFetched.NoOfInstallments = disbursement.LoanAccount.NoOfInstallments;
                            loanAccFetched.InstallmentFrequency = disbursement.LoanAccount.InstallmentFrequency;
                            loanAccFetched.FirstInstallmentDate = disbursement.LoanAccount.FirstInstallmentDate;
                            loanAccFetched.MaturityDate = disbursement.LoanAccount.MaturityDate;
                        }
                    }
                    var loanRate = await _context.LoanRates.FindAsync(loanAccFetched?.LoanRateID ?? 0);
                    int targetBranchId = loanAccFetched?.BranchID ?? 1;
                    
                    int loanLedgerId = loanRate?.LoanLedgerID ?? 0;
                    if (loanLedgerId == 0 || !validLedgerDict.ContainsKey(loanLedgerId))
                    {
                        return BadRequest(new { message = $"कर्ज योजना '{loanRate?.LoanType ?? "अज्ञात"}' ला वैध कर्ज मुद्दल खाते (Loan Ledger) जोडलेले नाही. कृपया कर्ज दर पत्रक (Loan Rate Master) तपासा." });
                    }
                    
                    int cashLedgerId = 0;
                    if (disbursement.PaymentMode == "Saving Transfer" || disbursement.PaymentMode == "Saving") {
                        var savingLedger = ledgers.FirstOrDefault(l => 
                            (l.LedgerName ?? "").Contains("बचत ठेवा") || 
                            (l.LedgerName ?? "").Contains("बचत ठेव") || 
                            (l.LedgerName ?? "").Contains("बचत खाते") || 
                            (l.LedgerName ?? "").Contains("Saving Deposit") || 
                            (l.LedgerName ?? "").Contains("Saving Account")
                        ) ?? ledgers.FirstOrDefault(l => (l.LedgerName ?? "").Contains("बचत") || (l.LedgerName ?? "").Contains("Saving"));
                        if (savingLedger != null) cashLedgerId = savingLedger.LedgerID;
                    }
                    else if (disbursement.PaymentMode == "Bank" || disbursement.PaymentMode == "Cheque" || disbursement.PaymentMode == "RTGS")
                    {
                        if (disbursement.BankAccountLedgerID.HasValue && disbursement.BankAccountLedgerID.Value > 0 && validLedgerDict.ContainsKey(disbursement.BankAccountLedgerID.Value))
                        {
                            cashLedgerId = disbursement.BankAccountLedgerID.Value;
                        }
                    }

                    if (cashLedgerId == 0 || !validLedgerDict.ContainsKey(cashLedgerId))
                    {
                        cashLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, targetBranchId, "LOAN");
                    }

                    if (existingDisbursement.Voucher.VoucherDetails != null && existingDisbursement.Voucher.VoucherDetails.Any())
                    {
                        _context.VoucherDetails.RemoveRange(existingDisbursement.Voucher.VoucherDetails);
                    }
                    existingDisbursement.Voucher.VoucherDetails = new List<VoucherDetail>();
                    
                    // Assign MemberID if available
                    int? memberId = loanAccFetched?.MemberID;
                    
                    if (loanLedgerId > 0 && disbursement.DisbursementAmount > 0)
                        existingDisbursement.Voucher.VoucherDetails.Add(new VoucherDetail { LedgerID = loanLedgerId, DrCr = "Dr", Amount = disbursement.DisbursementAmount, MemberID = memberId });

                    if (cashLedgerId > 0 && disbursement.NetAmountPaid > 0)
                        existingDisbursement.Voucher.VoucherDetails.Add(new VoucherDetail { LedgerID = cashLedgerId, DrCr = "Cr", Amount = disbursement.NetAmountPaid, MemberID = memberId });

                    if (disbursement.Deductions != null && disbursement.Deductions.Any())
                    {
                        foreach(var ded in disbursement.Deductions)
                        {
                            if (ded.Amount > 0)
                            {
                                int validDedLedgerId = validLedgerDict.ContainsKey(ded.LedgerID) ? ded.LedgerID : shareCapitalLedger.LedgerID;
                                existingDisbursement.Voucher.VoucherDetails.Add(new VoucherDetail { 
                                    LedgerID = validDedLedgerId, 
                                    DrCr = "Cr", 
                                    Amount = ded.Amount, 
                                    MemberID = memberId 
                                });
                            }
                        }
                    }
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                throw;
            }

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteLoanDisbursement(int id)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var disbursement = await _context.LoanDisbursements
                    .Include(d => d.Deductions)
                    .Include(d => d.Voucher)
                    .ThenInclude(v => v!.VoucherDetails)
                    .FirstOrDefaultAsync(d => d.LoanDisbursementID == id);

                if (disbursement == null)
                {
                    return NotFound(new { message = "कर्ज वाटप नोंद सापडली नाही." });
                }

                // 1. Remove linked Deductions
                if (disbursement.Deductions != null && disbursement.Deductions.Any())
                {
                    _context.LoanDisbursementDeductions.RemoveRange(disbursement.Deductions);
                }

                // 2. Handle linked Voucher and related transactions
                if (disbursement.VoucherID.HasValue || disbursement.Voucher != null)
                {
                    int vId = disbursement.VoucherID ?? disbursement.Voucher?.VoucherID ?? 0;
                    string? voucherNo = disbursement.Voucher?.VoucherNo;

                    if (vId > 0)
                    {
                        // Clean up linked ShareTransactions and reverse ShareAccount totals
                        var linkedShareTxns = await _context.ShareTransactions.Where(st => st.VoucherId == vId).ToListAsync();
                        foreach (var st in linkedShareTxns)
                        {
                            var shAcc = await _context.ShareAccounts.FindAsync(st.ShareAccountId);
                            if (shAcc != null)
                            {
                                shAcc.TotalShareCount = Math.Max(0, shAcc.TotalShareCount - st.NumberOfShares);
                                shAcc.TotalShareAmount = Math.Max(0, shAcc.TotalShareAmount - st.Amount);
                                _context.Entry(shAcc).State = EntityState.Modified;
                            }
                            _context.ShareTransactions.Remove(st);
                        }

                        // Clean up linked SavingTransactions and reverse SavingAccount balance
                        if (!string.IsNullOrEmpty(voucherNo))
                        {
                            var linkedSavingTxns = await _context.SavingTransactions
                                .Where(st => st.VoucherNo == voucherNo)
                                .ToListAsync();
                            foreach (var st in linkedSavingTxns)
                            {
                                var savAcc = await _context.SavingAccountMasters.FindAsync(st.SavingAccountID);
                                if (savAcc != null)
                                {
                                    savAcc.CurrentBalance = Math.Max(0, savAcc.CurrentBalance - st.Amount);
                                    _context.Entry(savAcc).State = EntityState.Modified;
                                }
                                _context.SavingTransactions.Remove(st);
                            }
                        }

                        // Clean up VoucherDetails
                        if (disbursement.Voucher?.VoucherDetails != null && disbursement.Voucher.VoucherDetails.Any())
                        {
                            _context.VoucherDetails.RemoveRange(disbursement.Voucher.VoucherDetails);
                        }
                        else
                        {
                            var details = await _context.VoucherDetails.Where(vd => vd.VoucherID == vId).ToListAsync();
                            if (details.Any())
                            {
                                _context.VoucherDetails.RemoveRange(details);
                            }
                        }

                        // Remove Voucher
                        var vObj = disbursement.Voucher ?? await _context.Vouchers.FindAsync(vId);
                        if (vObj != null)
                        {
                            _context.Vouchers.Remove(vObj);
                        }
                    }
                }

                // 3. Update LoanAccount and recalculate schedules
                var loanAcc = await _context.LoanAccounts.FindAsync(disbursement.LoanAccountID);
                if (loanAcc != null)
                {
                    loanAcc.PrincipalBalance = Math.Max(0, loanAcc.PrincipalBalance - disbursement.DisbursementAmount);

                    // Check remaining disbursements for this account
                    var remainingDisbursements = await _context.LoanDisbursements
                        .Where(d => d.LoanAccountID == loanAcc.LoanAccountID && d.LoanDisbursementID != id)
                        .ToListAsync();

                    if (!remainingDisbursements.Any())
                    {
                        // No disbursements remain: remove all schedules for this loan account
                        var allPendingSchedules = await _context.LoanInstallmentSchedules
                            .Where(s => s.LoanAccountID == loanAcc.LoanAccountID)
                            .ToListAsync();
                        if (allPendingSchedules.Any())
                        {
                            _context.LoanInstallmentSchedules.RemoveRange(allPendingSchedules);
                        }

                        if (loanAcc.LoanApplicationID.HasValue)
                        {
                            var app = await _context.LoanApplications.FindAsync(loanAcc.LoanApplicationID.Value);
                            if (app != null)
                            {
                                app.LoanAccountNo = null;
                                _context.Entry(app).State = EntityState.Modified;
                            }
                        }
                    }
                    else
                    {
                        // Recalculate schedules for remaining balance if principal > 0
                        var oldPendingSchedules = await _context.LoanInstallmentSchedules
                            .Where(s => s.LoanAccountID == loanAcc.LoanAccountID && s.Status != "Paid")
                            .ToListAsync();
                        if (oldPendingSchedules.Any())
                        {
                            _context.LoanInstallmentSchedules.RemoveRange(oldPendingSchedules);
                        }

                        if (loanAcc.PrincipalBalance > 0 && loanAcc.LoanRateID > 0)
                        {
                            var loanRateForCalc = await _context.LoanRates.FindAsync(loanAcc.LoanRateID);
                            if (loanRateForCalc != null)
                            {
                                var scheduleRecords = Services.LoanScheduleGenerator.GenerateSchedules(loanAcc, loanRateForCalc);
                                foreach (var s in scheduleRecords)
                                {
                                    s.LoanAccountID = loanAcc.LoanAccountID;
                                    _context.LoanInstallmentSchedules.Add(s);
                                }
                            }
                        }
                    }
                    _context.Entry(loanAcc).State = EntityState.Modified;
                }

                // 4. Remove Disbursement record
                _context.LoanDisbursements.Remove(disbursement);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                var msg = ex.Message + (ex.InnerException != null ? " | " + ex.InnerException.Message : "");
                return BadRequest(new { message = "कर्ज वाटप डिलीट करताना त्रुटी आली: " + msg });
            }
        }
    }
}
