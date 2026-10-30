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
        public async Task<ActionResult<IEnumerable<LoanDisbursement>>> GetLoanDisbursements([FromQuery] int? branchId = null)
        {
            var (userId, username, userBranchId) = GetCurrentUserContext();
            bool isHO = User.IsHeadOfficeAdmin();

            int? effectiveBranchId = null;
            if (!isHO)
            {
                effectiveBranchId = userBranchId;
            }
            else if (branchId.HasValue && branchId.Value > 0)
            {
                effectiveBranchId = branchId.Value;
            }

            var query = _context.LoanDisbursements
                .Include(d => d.Branch)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.Branch)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.Customer)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.Member!).ThenInclude(m => m.Customer)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.CoCustomer)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.CoCustomer2)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.Guarantor1Customer)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.Guarantor2Customer)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.LoanRate)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.LoanApplication!).ThenInclude(a => a.Customer)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.LoanApplication!).ThenInclude(a => a.CoCustomer)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.LoanApplication!).ThenInclude(a => a.CoCustomer2)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.LoanApplication!).ThenInclude(a => a.Guarantor1Customer)
                .Include(d => d.LoanAccount!).ThenInclude(l => l.LoanApplication!).ThenInclude(a => a.Guarantor2Customer)
                .Include(d => d.Deductions).ThenInclude(d => d.Ledger)
                .Include(d => d.BankAccountLedger)
                .AsQueryable();

            if (effectiveBranchId.HasValue && effectiveBranchId.Value > 0)
            {
                query = query.Where(d => d.BranchID == effectiveBranchId.Value || 
                                        (d.BranchID == 0 && d.LoanAccount != null && d.LoanAccount.BranchID == effectiveBranchId.Value));
            }

            return await query
                .OrderByDescending(d => d.DisbursementDate)
                .ThenByDescending(d => d.LoanDisbursementID)
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
                var ledgers = await _context.Ledgers.Include(l => l.AccountGroup).ToListAsync();
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

                // Resolve Target Branch for disbursement
                int targetBranchId = 1;
                if (existingLoanAcc != null && existingLoanAcc.BranchID > 0)
                {
                    targetBranchId = existingLoanAcc.BranchID;
                }
                else if (app != null && app.BranchID > 0)
                {
                    targetBranchId = app.BranchID;
                }
                else if (disbursement.LoanAccount != null && disbursement.LoanAccount.BranchID > 0)
                {
                    targetBranchId = disbursement.LoanAccount.BranchID;
                }
                else if (disbursement.BranchID > 0)
                {
                    targetBranchId = disbursement.BranchID;
                }

                // Multi-Branch Cross-Branch Security Guard
                var (postUserId, postUsername, userBranchId) = GetCurrentUserContext();
                bool isHOUser = User.IsHeadOfficeAdmin();

                if (!isHOUser && targetBranchId != userBranchId)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(new { message = $"सुरक्षा उल्लंघन: तुम्ही शाखा क्र. {userBranchId} चे ऑपरेटर आहात. तुम्हाला शाखा क्र. {targetBranchId} च्या खात्यावर/अर्जावर कर्ज वाटप करण्याचा अधिकार नाही." });
                }

                disbursement.BranchID = targetBranchId;

                // Core Banking Date Safeguards: Prevent future dating and transactions in closed financial years
                if (disbursement.DisbursementDate.Date > DateTime.Today)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(new { message = "कर्ज वाटपाची दिनांक भविष्यातील (Future Date) असू शकत नाही." });
                }

                var closedFy = await _context.FinancialYears
                    .FirstOrDefaultAsync(fy => fy.IsClosed && disbursement.DisbursementDate.Date >= fy.StartDate.Date && disbursement.DisbursementDate.Date <= fy.EndDate.Date);
                if (closedFy != null)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(new { message = $"निवडलेली तारीख बंद झालेल्या आर्थिक वर्षात ({closedFy.YearCode}) मोडत असल्याने या तारखेवर कर्ज वाटप करता येत नाही." });
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

                // Fail-Fast: Early Loan Ledger Validation before touching database
                int rateIdToCheck = existingLoanAcc != null && existingLoanAcc.LoanRateID > 0
                    ? existingLoanAcc.LoanRateID 
                    : (disbursement.LoanAccount?.LoanRateID ?? 0);
                if (rateIdToCheck > 0)
                {
                    var rateToCheck = await _context.LoanRates.FindAsync(rateIdToCheck);
                    int earlyLedgerId = rateToCheck?.LoanLedgerID ?? 0;
                    if (earlyLedgerId == 0 || !validLedgerDict.ContainsKey(earlyLedgerId))
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = $"कर्ज योजना '{rateToCheck?.LoanType ?? "अज्ञात"}' ला वैध कर्ज मुद्दल खाते (Loan Ledger) जोडलेले नाही. कृपया कर्ज दर पत्रक (Loan Rate Master) तपासा." });
                    }
                }

                // Multi-Tranche Strict Validation: Disbursement amount cannot exceed pending sanctioned limit
                if (disbursement.DisbursementAmount > pendingLimit)
                {
                    await transaction.RollbackAsync();
                    return BadRequest($"वाटप रक्कम (₹{disbursement.DisbursementAmount:N2}) ही शिल्लक मंजूर मर्यादेपेक्षा (₹{pendingLimit:N2}) जास्त असू शकत नाही! एकूण मंजूर मर्यादा: ₹{sanctionedLimit:N2}, यापूर्वीचे वाटप: ₹{alreadyDisbursed:N2}.");
                }

                // Fail-Fast: Validate Saving Transfer target account (Same-Branch, Active, Liability Ledger) or Bank Ledger upfront
                bool isSavingTransfer = Helpers.LoanDisbursementReversalHelper.IsSavingTransferMode(disbursement.PaymentMode);
                bool isBankMode = !isSavingTransfer && Helpers.BankLedgerHelper.IsBankPaymentMode(disbursement.PaymentMode);
                Helpers.SavingTransferTargetResult? savingTransferTarget = null;
                int validatedBankLedgerId = 0;
                if (isSavingTransfer)
                {
                    disbursement.BankAccountLedgerID = null;
                    try
                    {
                        savingTransferTarget = await Helpers.LoanDisbursementReversalHelper.ResolveSavingTransferTargetAsync(
                            _context,
                            disbursement.TransferToSavingAccountNo,
                            targetBranchId,
                            validLedgerDict,
                            ledgers);
                        disbursement.TransferToSavingAccountNo = savingTransferTarget.SavingAccount.AccountNo;
                    }
                    catch (InvalidOperationException valEx)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = valEx.Message });
                    }
                }
                else if (isBankMode)
                {
                    var bankCheck = await Helpers.BankLedgerHelper.ValidateBankLedgerAsync(_context, disbursement.BankAccountLedgerID);
                    if (!bankCheck.IsValid)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = bankCheck.ErrorMessage });
                    }
                    validatedBankLedgerId = bankCheck.LedgerId;
                    disbursement.BankAccountLedgerID = validatedBankLedgerId;
                }
                else
                {
                    disbursement.BankAccountLedgerID = null;
                }

                if (existingLoanAcc != null)
                {
                    // Reuse existing LoanAccount for subsequent tranche
                    disbursement.LoanAccountID = existingLoanAcc.LoanAccountID;
                    if (app != null && !existingLoanAcc.LoanApplicationID.HasValue)
                    {
                        existingLoanAcc.LoanApplicationID = app.LoanApplicationID;
                    }
                    if (app != null)
                    {
                        var unlinkedGold = await _context.GoldLoanDetails
                            .Where(g => g.LoanApplicationID == app.LoanApplicationID && g.LoanAccountID == null)
                            .ToListAsync();
                        foreach (var gold in unlinkedGold)
                        {
                            gold.LoanAccountID = existingLoanAcc.LoanAccountID;
                        }
                    }
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
                    disbursement.LoanAccount.BranchID = targetBranchId;

                    var branch = await _context.Branches.FindAsync(disbursement.LoanAccount.BranchID);
                    if (branch == null)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest("निवडलेली शाखा सापडली नाही.");
                    }

                    if (app != null)
                    {
                        disbursement.LoanAccount.LoanApplicationID = app.LoanApplicationID;

                        if (!disbursement.LoanAccount.CustomerID.HasValue && app.CustomerID.HasValue)
                            disbursement.LoanAccount.CustomerID = app.CustomerID;

                        // Auto-link MemberID if Customer is a member (or has share capital)
                        if (!disbursement.LoanAccount.MemberID.HasValue && disbursement.LoanAccount.CustomerID.HasValue)
                        {
                            var linkedMem = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == disbursement.LoanAccount.CustomerID.Value);
                            if (linkedMem != null)
                            {
                                disbursement.LoanAccount.MemberID = linkedMem.MemberID;
                            }
                        }

                        if (!disbursement.LoanAccount.CoCustomerID.HasValue && app.CoCustomerID.HasValue)
                            disbursement.LoanAccount.CoCustomerID = app.CoCustomerID;

                        if (!disbursement.LoanAccount.CoCustomer2ID.HasValue && app.CoCustomer2ID.HasValue)
                            disbursement.LoanAccount.CoCustomer2ID = app.CoCustomer2ID;

                        if (!disbursement.LoanAccount.Guarantor1CustomerID.HasValue && app.Guarantor1CustomerID.HasValue)
                            disbursement.LoanAccount.Guarantor1CustomerID = app.Guarantor1CustomerID;

                        if (!disbursement.LoanAccount.Guarantor2CustomerID.HasValue && app.Guarantor2CustomerID.HasValue)
                            disbursement.LoanAccount.Guarantor2CustomerID = app.Guarantor2CustomerID;

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
                    if (disbursement.LoanAccount.Guarantor1CustomerID.HasValue && disbursement.LoanAccount.Guarantor1CustomerID.Value <= 0) disbursement.LoanAccount.Guarantor1CustomerID = null;
                    if (disbursement.LoanAccount.Guarantor2CustomerID.HasValue && disbursement.LoanAccount.Guarantor2CustomerID.Value <= 0) disbursement.LoanAccount.Guarantor2CustomerID = null;

                    // Generate 14-Digit Standard CBS Account Number: [3-digit Branch] + [3-digit Scheme] + [7-digit Sequence] + [1-digit Luhn Checksum]
                    int branchIdForAcc = (disbursement.LoanAccount.BranchID > 0) ? disbursement.LoanAccount.BranchID : branch.BranchID;
                    int schemeCodeNum = 201;
                    if (disbursement.LoanAccount.LoanRateID > 0)
                    {
                        var lr = await _context.LoanRates.FindAsync(disbursement.LoanAccount.LoanRateID);
                        if (lr != null && !string.IsNullOrWhiteSpace(lr.LoanCode))
                        {
                            var sDigits = new string(lr.LoanCode.Where(char.IsDigit).ToArray());
                            if (!string.IsNullOrEmpty(sDigits) && int.TryParse(sDigits, out int parsed) && parsed > 0)
                            {
                                schemeCodeNum = parsed < 100 ? 200 + parsed : parsed;
                            }
                            else
                            {
                                schemeCodeNum = 200 + lr.LoanRateID;
                            }
                        }
                        else if (lr != null)
                        {
                            schemeCodeNum = 200 + lr.LoanRateID;
                        }
                    }

                    var existingLoanAccs = await _context.LoanAccounts
                        .Where(a => a.BranchID == branchIdForAcc && a.LoanAccountNo != null)
                        .Select(a => a.LoanAccountNo!)
                        .ToListAsync();

                    int maxSeq = 0;
                    foreach (var accNo in existingLoanAccs)
                    {
                        var digitsOnly = new string(accNo.Where(char.IsDigit).ToArray());
                        if (digitsOnly.Length == 14)
                        {
                            string seqPart = digitsOnly.Substring(6, 7);
                            if (int.TryParse(seqPart, out int sVal) && sVal > maxSeq)
                            {
                                maxSeq = sVal;
                            }
                        }
                        else
                        {
                            maxSeq = Math.Max(maxSeq, existingLoanAccs.Count);
                        }
                    }

                    // Determine Loan Account Number: Custom or auto-generated
                    if (string.IsNullOrWhiteSpace(disbursement.LoanAccount.LoanAccountNo) || disbursement.LoanAccount.LoanAccountNo == "AUTO")
                    {
                        int nextSeq = maxSeq + 1;
                        string nextAccNo = Helpers.AccountNumberHelper.Generate14DigitAccountNo(branchIdForAcc, schemeCodeNum, nextSeq);
                        while (existingLoanAccs.Contains(nextAccNo))
                        {
                            nextSeq++;
                            nextAccNo = Helpers.AccountNumberHelper.Generate14DigitAccountNo(branchIdForAcc, schemeCodeNum, nextSeq);
                        }
                        disbursement.LoanAccount.LoanAccountNo = nextAccNo;
                    }
                    else
                    {
                        disbursement.LoanAccount.LoanAccountNo = disbursement.LoanAccount.LoanAccountNo.Trim();
                        bool exists = await _context.LoanAccounts.AnyAsync(l => l.BranchID == branchIdForAcc && l.LoanAccountNo == disbursement.LoanAccount.LoanAccountNo);
                        if (exists)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(new { message = $"कर्ज खाते क्रमांक '{disbursement.LoanAccount.LoanAccountNo}' आधीपासून शाखा क्र. {branchIdForAcc} मध्ये अस्तित्वात आहे." });
                        }
                    }

                    // Validate LegacyAccountNumber duplicate
                    if (!string.IsNullOrWhiteSpace(disbursement.LoanAccount.LegacyAccountNumber))
                    {
                        string cleanLegacy = disbursement.LoanAccount.LegacyAccountNumber.Trim();
                        var dup = await _context.LoanAccounts.AsNoTracking().FirstOrDefaultAsync(l => 
                            l.LoanRateID == disbursement.LoanAccount.LoanRateID && 
                            l.LegacyAccountNumber != null && 
                            l.LegacyAccountNumber.Trim() == cleanLegacy);
                        if (dup != null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(new { message = $"जुना कर्ज खाते क्रमांक '{cleanLegacy}' हा आधीच कर्ज खाते क्र. '{dup.LoanAccountNo}' ला नोंदवला गेला आहे!" });
                        }
                        disbursement.LoanAccount.LegacyAccountNumber = cleanLegacy;
                    }

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

                        // Mark Lien on Pledged Collaterals
                        var pledgedCollaterals = await _context.LoanDepositCollaterals
                            .Where(c => c.LoanApplicationID == app.LoanApplicationID)
                            .ToListAsync();

                        foreach (var col in pledgedCollaterals)
                        {
                            col.LoanAccountID = loanAcc.LoanAccountID;
                            col.LienStatus = "LienMarked";
                            col.LienMarkedDate = DateTime.Now;

                            if (col.CollateralType == "FixedDeposit")
                            {
                                var fd = await _context.FdAccounts.FindAsync(col.DepositAccountID);
                                if (fd != null)
                                {
                                    fd.IsLienMarked = true;
                                    fd.LienLoanAccountNo = loanAcc.LoanAccountNo;
                                    fd.LienAmount = col.LienAmount > 0 ? col.LienAmount : col.DepositAmount;
                                }
                            }
                            else if (col.CollateralType == "PigmyDeposit")
                            {
                                var pg = await _context.PigmyAccounts.FindAsync(col.DepositAccountID);
                                if (pg != null)
                                {
                                    pg.IsLienMarked = true;
                                    pg.LienLoanAccountNo = loanAcc.LoanAccountNo;
                                    pg.LienAmount = col.LienAmount > 0 ? col.LienAmount : col.DepositAmount;
                                }
                            }
                            else if (col.CollateralType == "RecurringDeposit")
                            {
                                var rd = await _context.RdAccounts.FindAsync(col.DepositAccountID);
                                if (rd != null)
                                {
                                    rd.IsLienMarked = true;
                                    rd.LienLoanAccountNo = loanAcc.LoanAccountNo;
                                    rd.LienAmount = col.LienAmount > 0 ? col.LienAmount : col.DepositAmount;
                                }
                            }
                            else if (col.CollateralType == "SavingDeposit")
                            {
                                var sav = await _context.SavingAccountMasters.FindAsync(col.DepositAccountID);
                                if (sav != null)
                                {
                                    sav.LienAmount = col.LienAmount > 0 ? col.LienAmount : col.DepositAmount;
                                    sav.LienReason = $"Loan A/c: {loanAcc.LoanAccountNo}";
                                }
                            }
                        }

                        // Link Pledged Gold Loan Details to the newly created Loan Account
                        var pledgedGold = await _context.GoldLoanDetails
                            .Where(g => g.LoanApplicationID == app.LoanApplicationID)
                            .ToListAsync();

                        foreach (var gold in pledgedGold)
                        {
                            gold.LoanAccountID = loanAcc.LoanAccountID;
                        }
                    }
                }

                var loanAccountForRate = await _context.LoanAccounts.FindAsync(disbursement.LoanAccountID);
                var rateForDisb = loanAccountForRate != null ? await _context.LoanRates.FindAsync(loanAccountForRate.LoanRateID) : null;
                disbursement.LoanInstallmentType = rateForDisb?.LoanInstallmentType;

                disbursement.BranchID = targetBranchId;
                disbursement.BankAccountLedger = null; // Prevent EF tracking issues
                _context.LoanDisbursements.Add(disbursement);
                await _context.SaveChangesAsync();

                // Get LoanRate to fetch Ledger IDs
                var loanAccFetched = await _context.LoanAccounts
                    .Include(l => l.Customer)
                    .Include(l => l.Member)
                        .ThenInclude(m => m!.Customer)
                    .FirstOrDefaultAsync(l => l.LoanAccountID == disbursement.LoanAccountID);
                var loanRate = await _context.LoanRates.FindAsync(loanAccFetched?.LoanRateID ?? 0);
                if (loanAccFetched != null && loanAccFetched.BranchID > 0)
                {
                    targetBranchId = loanAccFetched.BranchID;
                }

                // CustomerID-First Party Resolution for Borrower
                int? borrowerCustomerId = loanAccFetched?.CustomerID
                    ?? loanAccFetched?.Customer?.CustomerID
                    ?? app?.CustomerID
                    ?? loanAccFetched?.Member?.CustomerID;
                if (borrowerCustomerId.HasValue && borrowerCustomerId.Value <= 0)
                {
                    borrowerCustomerId = null;
                }
                if (loanAccFetched != null && (!loanAccFetched.CustomerID.HasValue || loanAccFetched.CustomerID.Value <= 0) && borrowerCustomerId.HasValue)
                {
                    loanAccFetched.CustomerID = borrowerCustomerId;
                    _context.Entry(loanAccFetched).State = EntityState.Modified;
                }

                int? borrowerMemberId = loanAccFetched?.MemberID;
                if (borrowerMemberId.HasValue && borrowerMemberId.Value <= 0)
                {
                    borrowerMemberId = null;
                }
                if (!borrowerMemberId.HasValue && borrowerCustomerId.HasValue)
                {
                    borrowerMemberId = await _context.Members
                        .AsNoTracking()
                        .Where(m => m.CustomerID == borrowerCustomerId.Value)
                        .Select(m => (int?)m.MemberID)
                        .FirstOrDefaultAsync();
                    if (borrowerMemberId.HasValue && loanAccFetched != null)
                    {
                        loanAccFetched.MemberID = borrowerMemberId;
                        _context.Entry(loanAccFetched).State = EntityState.Modified;
                    }
                }

                int loanLedgerId = loanRate?.LoanLedgerID ?? 0;
                if (loanLedgerId == 0 || !validLedgerDict.ContainsKey(loanLedgerId))
                {
                    await transaction.RollbackAsync();
                    return BadRequest(new { message = $"कर्ज योजना '{loanRate?.LoanType ?? "अज्ञात"}' ला वैध कर्ज मुद्दल खाते (Loan Ledger) जोडलेले नाही. कृपया कर्ज दर पत्रक (Loan Rate Master) तपासा." });
                }

                int cashLedgerId = 0;
                if (isSavingTransfer && savingTransferTarget != null)
                {
                    cashLedgerId = savingTransferTarget.SavingLiabilityLedgerId;
                }
                else if (isBankMode)
                {
                    cashLedgerId = validatedBankLedgerId;
                }
                else
                {
                    cashLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, targetBranchId, "LOAN");
                }

                // Create Voucher
                var vBranch = await _context.Branches.FindAsync(targetBranchId);
                string branchCode = vBranch?.BranchCode ?? "HQ";
                string voucherType = isSavingTransfer ? "Journal" : "Payment";
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

                int count = await Helpers.VoucherNumberHelper.NextSequenceAsync(_context, $"{branchCode}-{typeCode}-{fy}-", 5);
                string voucherNo = $"{branchCode}-{typeCode}-{fy}-{count:D5}";
                while (await _context.Vouchers.AnyAsync(v => v.VoucherNo == voucherNo))
                {
                    count++;
                    voucherNo = $"{branchCode}-{typeCode}-{fy}-{count:D5}";
                }

                var (vStatus, approvedBy, approvedOn) = await Helpers.ApprovalPolicyHelper.DetermineVoucherStatusAsync(
                    _context,
                    disbursement.DisbursementAmount,
                    postUserId > 0 ? postUserId : 1);

                string borrowerName = loanAccFetched?.Customer != null
                    ? string.Join(" ", new[] { loanAccFetched.Customer.FirstName, loanAccFetched.Customer.MiddleName, loanAccFetched.Customer.LastName }.Where(p => !string.IsNullOrWhiteSpace(p))).Trim()
                    : (loanAccFetched?.Member?.Customer != null
                        ? string.Join(" ", new[] { loanAccFetched.Member.Customer.FirstName, loanAccFetched.Member.Customer.MiddleName, loanAccFetched.Member.Customer.LastName }.Where(p => !string.IsNullOrWhiteSpace(p))).Trim()
                        : "N/A");

                string voucherNarration = (isSavingTransfer && savingTransferTarget != null)
                    ? $"Loan Disbursed to {borrowerName} (Loan A/C: {loanAccFetched?.LoanAccountNo}) | Saving Transfer to A/C: {savingTransferTarget.SavingAccount.AccountNo} ({savingTransferTarget.SavingHolderFullName})"
                    : $"Loan Disbursed to {borrowerName} (Loan A/C: {loanAccFetched?.LoanAccountNo})";

                var voucher = new Voucher
                {
                    BranchID = targetBranchId,
                    VoucherNo = voucherNo,
                    VoucherDate = disbursement.DisbursementDate,
                    VoucherType = voucherType,
                    Narration = voucherNarration,
                    TotalAmount = disbursement.DisbursementAmount,
                    CreatedBy = postUserId > 0 ? postUserId : 1,
                    CreatedOn = DateTime.Now,
                    Status = vStatus,
                    ApprovedBy = approvedBy,
                    ApprovedOn = approvedOn
                };
                
                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();

                // Add Voucher Details (Strictly CustomerID-First per Line Item)
                int? memberId = borrowerMemberId;

                if (loanLedgerId > 0 && disbursement.DisbursementAmount > 0)
                {
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = loanLedgerId,
                        DrCr = "Dr",
                        Amount = disbursement.DisbursementAmount,
                        CustomerID = borrowerCustomerId,
                        MemberID = borrowerMemberId
                    });
                }

                if (cashLedgerId > 0 && disbursement.NetAmountPaid > 0)
                {
                    int? payoutCustomerId = (isSavingTransfer && savingTransferTarget != null)
                        ? savingTransferTarget.SavingHolderCustomerId
                        : borrowerCustomerId;
                    int? payoutMemberId = (isSavingTransfer && savingTransferTarget != null)
                        ? savingTransferTarget.SavingHolderMemberId
                        : borrowerMemberId;

                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = cashLedgerId,
                        DrCr = "Cr",
                        Amount = disbursement.NetAmountPaid,
                        CustomerID = payoutCustomerId,
                        MemberID = payoutMemberId
                    });
                }

                if (disbursement.Deductions != null && disbursement.Deductions.Any())
                {
                    foreach (var ded in disbursement.Deductions)
                    {
                        if (ded.Amount > 0)
                        {
                            int targetDedLedgerId = validLedgerDict.ContainsKey(ded.LedgerID) ? ded.LedgerID : shareCapitalLedger.LedgerID;
                            _context.VoucherDetails.Add(new VoucherDetail
                            {
                                VoucherID = voucher.VoucherID,
                                LedgerID = targetDedLedgerId,
                                DrCr = "Cr",
                                Amount = ded.Amount,
                                CustomerID = borrowerCustomerId,
                                MemberID = borrowerMemberId
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
                                    MembershipType = "Regular", // Strictly Regular Member (Class A) when purchasing shares
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
                        // 1. Auto-upgrade to Regular (Class A) if existing member was Nominal
                        if (targetMember.MembershipType != "Regular")
                        {
                            targetMember.MembershipType = "Regular";
                            _context.Entry(targetMember).State = EntityState.Modified;
                        }

                        // 2. Assign official Member Code (MEM0001 format) upon Loan Share Deduction if missing or temporary
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
                            _context.Entry(targetMember).State = EntityState.Modified;
                        }

                        // 3. Ensure borrower's voucher details reflect newly created MemberID (never overwrite third-party Saving Transfer holder!)
                        var detailsToUpdate = await _context.VoucherDetails
                            .Where(vd => vd.VoucherID == voucher.VoucherID &&
                                         vd.MemberID == null &&
                                         (!isSavingTransfer || vd.CustomerID == borrowerCustomerId))
                            .ToListAsync();
                        if (detailsToUpdate.Any())
                        {
                            foreach (var d in detailsToUpdate)
                            {
                                d.MemberID = memberId.Value;
                            }
                            await _context.SaveChangesAsync();
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
                            int certCustomerId = borrowerCustomerId ?? targetMember?.CustomerID ?? memberId.Value;

                            var cert = new ShareCertificate
                            {
                                ShareAccountId = shAcc.ShareAccountId,
                                CustomerID = certCustomerId,
                                CertificateNo = certNo,
                                FromShareNo = nextFromShareNo,
                                ToShareNo = nextToShareNo,
                                NumberOfShares = numShares,
                                FaceValue = 100m,
                                IssueDate = cleanDate,
                                Status = vStatus == "Approved" ? "Active" : "PendingApproval"
                            };
                            _context.ShareCertificates.Add(cert);

                            var shareTx = new ShareTransaction
                            {
                                ShareAccountId = shAcc.ShareAccountId,
                                CustomerID = certCustomerId,
                                TransactionDate = cleanDate,
                                TransactionType = "Allotment",
                                NumberOfShares = numShares,
                                Amount = numShares * 100m,
                                Narration = $"Loan Disbursement Share Deduction (Cert: {certNo})",
                                VoucherId = voucher.VoucherID
                            };
                            _context.ShareTransactions.Add(shareTx);
                            await _context.SaveChangesAsync();
                        }
                    }

                // Maker-Checker Rule: Credit Saving Account ONLY if Voucher is auto-approved (Status == "Approved").
                // When Pending, Saving credit is deferred until Checker passes the voucher in VoucherPostingController.
                if (isSavingTransfer && vStatus == "Approved" && savingTransferTarget != null)
                {
                    await Helpers.LoanDisbursementReversalHelper.ApplyApprovedSavingTransferCreditAsync(
                        _context,
                        disbursement,
                        voucher,
                        savingTransferTarget.SavingAccount,
                        loanAccFetched?.LoanAccountNo,
                        borrowerName);
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

                return Ok(new
                {
                    message = "Success",
                    id = disbursement.LoanDisbursementID,
                    voucherId = voucher.VoucherID,
                    voucherNo = voucher.VoucherNo,
                    voucherStatus = vStatus
                });
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
            var disbursement = await _context.LoanDisbursements
                .Include(d => d.Branch)
                .Include(d => d.LoanAccount)
                .Include(d => d.Deductions).ThenInclude(d => d.Ledger)
                .FirstOrDefaultAsync(d => d.LoanDisbursementID == id);

            if (disbursement == null) return NotFound();

            var (userId, username, userBranchId) = GetCurrentUserContext();
            bool isHO = User.IsHeadOfficeAdmin();

            int disbBranchId = disbursement.BranchID > 0 ? disbursement.BranchID : (disbursement.LoanAccount?.BranchID ?? 1);
            if (!isHO && disbBranchId != userBranchId)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "सुरक्षा मर्यादा: तुम्हाला इतर शाखेचे कर्ज वितरण पाहण्याचा अधिकार नाही." });
            }

            return disbursement;
        }

        // GET: api/LoanDisbursements/by-voucher/5
        [HttpGet("by-voucher/{voucherId}")]
        public async Task<ActionResult<LoanDisbursement>> GetLoanDisbursementByVoucher(int voucherId)
        {
            var disbursement = await _context.LoanDisbursements
                .Include(d => d.Branch)
                .Include(d => d.LoanAccount)
                    .ThenInclude(l => l!.Customer)
                .Include(d => d.LoanAccount)
                    .ThenInclude(l => l!.Member)
                .Include(d => d.LoanAccount)
                    .ThenInclude(l => l!.LoanRate)
                .Include(d => d.LoanAccount)
                    .ThenInclude(l => l!.LoanApplication)
                .Include(d => d.Deductions)
                    .ThenInclude(ded => ded.Ledger)
                .Include(d => d.Voucher)
                .FirstOrDefaultAsync(d => d.VoucherID == voucherId);

            if (disbursement == null)
            {
                return NotFound("या व्हाउचरशी जोडलेली कोणतीही कर्ज वितरण नोंद सापडली नाही.");
            }

            var (vUserId, vUsername, userBranchId) = GetCurrentUserContext();
            bool isHO = User.IsHeadOfficeAdmin();

            int disbBranchId = disbursement.BranchID > 0 ? disbursement.BranchID : (disbursement.LoanAccount?.BranchID ?? 1);
            if (!isHO && disbBranchId != userBranchId)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "सुरक्षा मर्यादा: तुम्हाला इतर शाखेचे कर्ज वितरण पाहण्याचा अधिकार नाही." });
            }

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

                var (putUserId, putUsername, userBranchId) = GetCurrentUserContext();
                bool isHOUser = User.IsHeadOfficeAdmin();

                int currentDisbBranchId = existingDisbursement.BranchID > 0 ? existingDisbursement.BranchID : 1;
                if (!isHOUser && currentDisbBranchId != userBranchId)
                {
                    await transaction.RollbackAsync();
                    return StatusCode(StatusCodes.Status403Forbidden, new { message = "सुरक्षा मर्यादा: तुम्हाला इतर शाखेचे कर्ज वितरण सुधारित करण्याचा अधिकार नाही." });
                }

                if (existingDisbursement.BranchID <= 0)
                {
                    existingDisbursement.BranchID = currentDisbBranchId;
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
                var ledgers = await _context.Ledgers.Include(l => l.AccountGroup).ToListAsync();
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

                var loanAccFetched = await _context.LoanAccounts
                    .Include(l => l.Customer)
                    .Include(l => l.Member)
                        .ThenInclude(m => m!.Customer)
                    .FirstOrDefaultAsync(l => l.LoanAccountID == existingDisbursement.LoanAccountID);

                int targetBranchId = (loanAccFetched != null && loanAccFetched.BranchID > 0)
                    ? loanAccFetched.BranchID
                    : currentDisbBranchId;

                bool isSavingTransfer = Helpers.LoanDisbursementReversalHelper.IsSavingTransferMode(disbursement.PaymentMode);
                bool isBankMode = !isSavingTransfer && Helpers.BankLedgerHelper.IsBankPaymentMode(disbursement.PaymentMode);
                Helpers.SavingTransferTargetResult? savingTransferTarget = null;
                int validatedBankLedgerId = 0;
                if (isSavingTransfer)
                {
                    disbursement.BankAccountLedgerID = null;
                    existingDisbursement.BankAccountLedgerID = null;
                    savingTransferTarget = await Helpers.LoanDisbursementReversalHelper.ResolveSavingTransferTargetAsync(
                        _context,
                        disbursement.TransferToSavingAccountNo,
                        targetBranchId,
                        validLedgerDict,
                        ledgers);
                    existingDisbursement.TransferToSavingAccountNo = savingTransferTarget.SavingAccount.AccountNo;
                }
                else if (isBankMode)
                {
                    var bankCheck = await Helpers.BankLedgerHelper.ValidateBankLedgerAsync(_context, disbursement.BankAccountLedgerID);
                    if (!bankCheck.IsValid)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = bankCheck.ErrorMessage });
                    }
                    validatedBankLedgerId = bankCheck.LedgerId;
                    disbursement.BankAccountLedgerID = validatedBankLedgerId;
                    existingDisbursement.BankAccountLedgerID = validatedBankLedgerId;
                }
                else
                {
                    disbursement.BankAccountLedgerID = null;
                    existingDisbursement.BankAccountLedgerID = null;
                }

                if (loanAccFetched != null)
                {
                    loanAccFetched.OpeningDate = cleanDate;
                    loanAccFetched.LoanDisbursementDate = cleanDate;
                    loanAccFetched.PrincipalBalance += amountDifference;
                    loanAccFetched.SanctionedAmount = sanctionedLimit;

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

                // CustomerID-First Party Resolution for Borrower
                int? borrowerCustomerId = loanAccFetched?.CustomerID
                    ?? loanAccFetched?.Customer?.CustomerID
                    ?? loanAccFetched?.Member?.CustomerID;
                if (borrowerCustomerId.HasValue && borrowerCustomerId.Value <= 0)
                {
                    borrowerCustomerId = null;
                }

                int? borrowerMemberId = loanAccFetched?.MemberID;
                if (borrowerMemberId.HasValue && borrowerMemberId.Value <= 0)
                {
                    borrowerMemberId = null;
                }
                if (!borrowerMemberId.HasValue && borrowerCustomerId.HasValue)
                {
                    borrowerMemberId = await _context.Members
                        .AsNoTracking()
                        .Where(m => m.CustomerID == borrowerCustomerId.Value)
                        .Select(m => (int?)m.MemberID)
                        .FirstOrDefaultAsync();
                }

                string borrowerName = loanAccFetched?.Customer != null
                    ? string.Join(" ", new[] { loanAccFetched.Customer.FirstName, loanAccFetched.Customer.MiddleName, loanAccFetched.Customer.LastName }.Where(p => !string.IsNullOrWhiteSpace(p))).Trim()
                    : (loanAccFetched?.Member?.Customer != null
                        ? string.Join(" ", new[] { loanAccFetched.Member.Customer.FirstName, loanAccFetched.Member.Customer.MiddleName, loanAccFetched.Member.Customer.LastName }.Where(p => !string.IsNullOrWhiteSpace(p))).Trim()
                        : "N/A");

                // Update Voucher
                if (existingDisbursement.Voucher != null)
                {
                    var (vStatus, approvedBy, approvedOn) = await Helpers.ApprovalPolicyHelper.DetermineVoucherStatusAsync(
                        _context,
                        disbursement.DisbursementAmount,
                        putUserId > 0 ? putUserId : 1);

                    existingDisbursement.Voucher.VoucherDate = cleanDate;
                    existingDisbursement.Voucher.TotalAmount = disbursement.DisbursementAmount;
                    existingDisbursement.Voucher.Status = vStatus;
                    if (vStatus == "Pending")
                    {
                        existingDisbursement.Voucher.ScrollNo = null;
                        existingDisbursement.Voucher.ApprovedBy = null;
                        existingDisbursement.Voucher.ApprovedOn = null;
                    }
                    else
                    {
                        existingDisbursement.Voucher.ApprovedBy ??= approvedBy;
                        existingDisbursement.Voucher.ApprovedOn ??= approvedOn;
                    }

                    var voucherType = isSavingTransfer ? "Journal" : "Payment";
                    existingDisbursement.Voucher.VoucherType = voucherType;
                    existingDisbursement.Voucher.Narration = (isSavingTransfer && savingTransferTarget != null)
                        ? $"Loan Disbursed to {borrowerName} (Loan A/C: {loanAccFetched?.LoanAccountNo}) | Saving Transfer to A/C: {savingTransferTarget.SavingAccount.AccountNo} ({savingTransferTarget.SavingHolderFullName})"
                        : $"Loan Disbursed to {borrowerName} (Loan A/C: {loanAccFetched?.LoanAccountNo})";

                    var loanRate = await _context.LoanRates.FindAsync(loanAccFetched?.LoanRateID ?? 0);
                    int loanLedgerId = loanRate?.LoanLedgerID ?? 0;
                    if (loanLedgerId == 0 || !validLedgerDict.ContainsKey(loanLedgerId))
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = $"कर्ज योजना '{loanRate?.LoanType ?? "अज्ञात"}' ला वैध कर्ज मुद्दल खाते (Loan Ledger) जोडलेले नाही. कृपया कर्ज दर पत्रक (Loan Rate Master) तपासा." });
                    }

                    int cashLedgerId = 0;
                    if (isSavingTransfer && savingTransferTarget != null)
                    {
                        cashLedgerId = savingTransferTarget.SavingLiabilityLedgerId;
                    }
                    else if (isBankMode)
                    {
                        cashLedgerId = validatedBankLedgerId;
                    }
                    else
                    {
                        cashLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, targetBranchId, "LOAN");
                    }

                    if (existingDisbursement.Voucher.VoucherDetails != null && existingDisbursement.Voucher.VoucherDetails.Any())
                    {
                        _context.VoucherDetails.RemoveRange(existingDisbursement.Voucher.VoucherDetails);
                    }
                    existingDisbursement.Voucher.VoucherDetails = new List<VoucherDetail>();

                    if (loanLedgerId > 0 && disbursement.DisbursementAmount > 0)
                    {
                        existingDisbursement.Voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = loanLedgerId,
                            DrCr = "Dr",
                            Amount = disbursement.DisbursementAmount,
                            CustomerID = borrowerCustomerId,
                            MemberID = borrowerMemberId
                        });
                    }

                    if (cashLedgerId > 0 && disbursement.NetAmountPaid > 0)
                    {
                        int? payoutCustomerId = (isSavingTransfer && savingTransferTarget != null)
                            ? savingTransferTarget.SavingHolderCustomerId
                            : borrowerCustomerId;
                        int? payoutMemberId = (isSavingTransfer && savingTransferTarget != null)
                            ? savingTransferTarget.SavingHolderMemberId
                            : borrowerMemberId;

                        existingDisbursement.Voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = cashLedgerId,
                            DrCr = "Cr",
                            Amount = disbursement.NetAmountPaid,
                            CustomerID = payoutCustomerId,
                            MemberID = payoutMemberId
                        });
                    }

                    if (disbursement.Deductions != null && disbursement.Deductions.Any())
                    {
                        foreach (var ded in disbursement.Deductions)
                        {
                            if (ded.Amount > 0)
                            {
                                int validDedLedgerId = validLedgerDict.ContainsKey(ded.LedgerID) ? ded.LedgerID : shareCapitalLedger.LedgerID;
                                existingDisbursement.Voucher.VoucherDetails.Add(new VoucherDetail
                                {
                                    LedgerID = validDedLedgerId,
                                    DrCr = "Cr",
                                    Amount = ded.Amount,
                                    CustomerID = borrowerCustomerId,
                                    MemberID = borrowerMemberId
                                });
                            }
                        }
                    }

                    // Reverse any previously posted SavingTransaction for this VoucherNo, then re-apply ONLY if Approved
                    await Helpers.LoanDisbursementReversalHelper.ReverseSavingTransferCreditForVoucherAsync(
                        _context,
                        existingDisbursement.Voucher.VoucherNo);

                    await _context.SaveChangesAsync();

                    if (isSavingTransfer && vStatus == "Approved" && savingTransferTarget != null)
                    {
                        await Helpers.LoanDisbursementReversalHelper.ApplyApprovedSavingTransferCreditAsync(
                            _context,
                            existingDisbursement,
                            existingDisbursement.Voucher,
                            savingTransferTarget.SavingAccount,
                            loanAccFetched?.LoanAccountNo,
                            borrowerName);
                    }
                }
                else
                {
                    await _context.SaveChangesAsync();
                }

                await transaction.CommitAsync();
            }
            catch (InvalidOperationException valEx)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { message = valEx.Message });
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

                var (delUserId, delUsername, userBranchId) = GetCurrentUserContext();
                bool isHOUser = User.IsHeadOfficeAdmin();

                int currentDisbBranchId = disbursement.BranchID > 0 ? disbursement.BranchID : 1;
                if (!isHOUser && currentDisbBranchId != userBranchId)
                {
                    await transaction.RollbackAsync();
                    return StatusCode(StatusCodes.Status403Forbidden, new { message = "सुरक्षा उल्लंघन: तुम्हाला इतर शाखेचे कर्ज वितरण डिलीट करण्याचा अधिकार नाही." });
                }

                await Helpers.LoanDisbursementReversalHelper.ReverseAndDeleteDisbursementAsync(
                    _context,
                    disbursement,
                    disbursement.Voucher,
                    deleteVoucherRecord: true);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return NoContent();
            }
            catch (InvalidOperationException valEx)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { message = valEx.Message });
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
