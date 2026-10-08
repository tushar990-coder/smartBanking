using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using System.Security.Claims;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class LoanAccountsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LoanAccountsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/LoanAccounts/next-account-no?branchId=1&loanRateId=1
        [HttpGet("next-account-no")]
        public async Task<ActionResult<object>> GetNextAccountNo([FromQuery] int? branchId = null, [FromQuery] int? loanRateId = null)
        {
            int targetBranchId = branchId ?? 1;
            int schemeCodeNum = 201;
            if (loanRateId.HasValue && loanRateId.Value > 0)
            {
                var lr = await _context.LoanRates.FindAsync(loanRateId.Value);
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
                .Where(a => a.BranchID == targetBranchId && a.LoanAccountNo != null)
                .Select(l => l.LoanAccountNo!)
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

            int nextSeq = maxSeq + 1;
            string nextAccNo = Helpers.AccountNumberHelper.Generate14DigitAccountNo(targetBranchId, schemeCodeNum, nextSeq);
            while (existingLoanAccs.Contains(nextAccNo))
            {
                nextSeq++;
                nextAccNo = Helpers.AccountNumberHelper.Generate14DigitAccountNo(targetBranchId, schemeCodeNum, nextSeq);
            }

            string formattedNo = Helpers.AccountNumberHelper.Format14Digit(nextAccNo);
            return Ok(new {
                nextAccountNo = nextAccNo,
                accountNo = nextAccNo,
                formattedAccountNo = formattedNo,
                displayAccountNo = formattedNo
            });
        }

        // GET: api/LoanAccounts
        [HttpGet]
        public async Task<ActionResult<IEnumerable<LoanAccount>>> GetLoanAccounts([FromQuery] int? branchId = null, [FromQuery] int? customerId = null, [FromQuery] int? memberId = null)
        {
            var query = _context.LoanAccounts
                .Include(l => l.Customer)
                .Include(l => l.Member)
                .Include(l => l.CoCustomer)
                .Include(l => l.CoCustomer2)
                .Include(l => l.LoanRate)
                .Include(l => l.Guarantor1Customer)
                .Include(l => l.Guarantor2Customer)
                .Include(l => l.Branch)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(l => l.BranchID == branchId.Value);
            }
            if (customerId.HasValue && customerId.Value > 0)
            {
                query = query.Where(l => l.CustomerID == customerId.Value);
            }
            else if (memberId.HasValue && memberId.Value > 0)
            {
                query = query.Where(l => l.MemberID == memberId.Value);
            }

            return await query
                .OrderByDescending(l => l.OpeningDate)
                .ToListAsync();
        }

        // GET: api/LoanAccounts/Customer/5
        [HttpGet("Customer/{customerId}")]
        public async Task<ActionResult<IEnumerable<LoanAccount>>> GetLoanAccountsByCustomer(int customerId)
        {
            return await _context.LoanAccounts
                .Include(l => l.Customer)
                .Include(l => l.Member)
                .Include(l => l.LoanRate)
                .Include(l => l.Branch)
                .Where(l => l.CustomerID == customerId && l.Status == "Active")
                .OrderByDescending(l => l.OpeningDate)
                .ToListAsync();
        }

        // GET: api/LoanAccounts/Member/5
        [HttpGet("Member/{memberId}")]
        public async Task<ActionResult<IEnumerable<LoanAccount>>> GetLoanAccountsByMember(int memberId)
        {
            return await _context.LoanAccounts
                .Include(l => l.Customer)
                .Include(l => l.Member)
                .Include(l => l.LoanRate)
                .Include(l => l.Branch)
                .Where(l => l.MemberID == memberId && l.Status == "Active")
                .OrderByDescending(l => l.OpeningDate)
                .ToListAsync();
        }

        // GET: api/LoanAccounts/5
        [HttpGet("{id:int}")]
        public async Task<ActionResult<LoanAccount>> GetLoanAccount(int id)
        {
            var loanAccount = await _context.LoanAccounts
                .Include(l => l.Customer)
                .Include(l => l.Member)
                .Include(l => l.CoCustomer)
                .Include(l => l.CoCustomer2)
                .Include(l => l.LoanRate)
                .Include(l => l.Guarantor1Customer)
                .Include(l => l.Guarantor2Customer)
                .Include(l => l.Branch)
                .FirstOrDefaultAsync(l => l.LoanAccountID == id);

            if (loanAccount == null)
            {
                return NotFound();
            }

            return loanAccount;
        }

        // GET: api/LoanAccounts/5/AccountDetailsAndSchedule
        [HttpGet("{id:int}/AccountDetailsAndSchedule")]
        public async Task<ActionResult<AccountDetailsAndScheduleDto>> GetAccountDetailsAndSchedule(int id)
        {
            var account = await _context.LoanAccounts
                .Include(a => a.LoanRate)
                .FirstOrDefaultAsync(a => a.LoanAccountID == id);

            if (account == null)
            {
                return NotFound();
            }

            var scheduleRecords = await _context.LoanInstallmentSchedules
                .Where(s => s.LoanAccountID == id)
                .OrderBy(s => s.InstallmentNo)
                .ToListAsync();

            if (!scheduleRecords.Any())
            {
                scheduleRecords = Services.LoanScheduleGenerator.GenerateSchedules(account, account.LoanRate);
            }

            // Calculate 31/3 Balance
            var today = DateTime.Today;
            var march31Year = today.Month >= 4 ? today.Year : today.Year - 1;
            var march31Date = new DateTime(march31Year, 3, 31);

            var allDisbursements = await _context.LoanDisbursements
                .Where(d => d.LoanAccountID == id)
                .OrderBy(d => d.DisbursementDate)
                .ThenBy(d => d.LoanDisbursementID)
                .ToListAsync();

            var totalDisbursed = allDisbursements.Sum(d => d.DisbursementAmount);
            var pendingLimit = Math.Max(0, account.SanctionedAmount - totalDisbursed);

            var disbursementsAfterMarch31 = allDisbursements
                .Where(d => d.DisbursementDate > march31Date)
                .Sum(d => d.DisbursementAmount);

            var principalCollectedAfterMarch31 = await _context.LoanCollections
                .Where(c => c.LoanAccountID == id && c.CollectionDate > march31Date)
                .SumAsync(c => c.PrincipalCollected);

            var march31Balance = account.PrincipalBalance - disbursementsAfterMarch31 + principalCollectedAfterMarch31;

            // Retrieve all collections for this loan account for live schedule tracking
            var collections = await _context.LoanCollections
                .Where(c => c.LoanAccountID == id)
                .OrderBy(c => c.CollectionDate)
                .ThenBy(c => c.LoanCollectionID)
                .ToListAsync();

            // Self-healing: Ensure LastInstallmentPaidDate matches actual collections in DB
            if (!collections.Any() && account.LastInstallmentPaidDate.HasValue)
            {
                account.LastInstallmentPaidDate = null;
                await _context.SaveChangesAsync();
            }
            else if (collections.Any() && account.LastInstallmentPaidDate != collections.Last().CollectionDate)
            {
                account.LastInstallmentPaidDate = collections.Last().CollectionDate;
                await _context.SaveChangesAsync();
            }

            decimal totalPrincipalCollected = collections.Sum(c => c.PrincipalCollected);
            decimal totalInterestCollected = collections.Sum(c => c.InterestCollected);

            decimal totalDisbursedOrSanctioned = totalDisbursed > 0 ? totalDisbursed : account.SanctionedAmount;
            decimal principalPaidFromBalance = Math.Max(0, totalDisbursedOrSanctioned - account.PrincipalBalance);
            decimal availablePrincipal = Math.Max(totalPrincipalCollected, principalPaidFromBalance);
            if (account.PrincipalBalance <= 0)
            {
                // Account fully closed / Nil
                availablePrincipal = decimal.MaxValue;
            }

            decimal availableInterest = totalInterestCollected;

            var scheduleDtos = new List<LoanInstallmentScheduleDto>();
            decimal runningPrincipalCovered = 0;

            foreach (var s in scheduleRecords)
            {
                decimal instPrincipal = s.PrincipalAmount;
                decimal instInterest = s.InterestAmount;

                decimal paidP = 0;
                decimal paidI = 0;
                decimal remainingP = instPrincipal;
                string status = "Pending";
                DateTime? paidDate = s.PaidDate;
                string? receiptNo = null;
                int overdueDays = 0;

                if (availablePrincipal >= instPrincipal)
                {
                    paidP = instPrincipal;
                    remainingP = 0;
                    availablePrincipal -= instPrincipal;
                    paidI = Math.Min(availableInterest, instInterest);
                    availableInterest = Math.Max(0, availableInterest - paidI);
                    status = "Paid"; // Nil / पूर्ण भरला

                    runningPrincipalCovered += instPrincipal;
                    decimal colAcc = 0;
                    foreach (var col in collections)
                    {
                        colAcc += col.PrincipalCollected;
                        if (colAcc >= runningPrincipalCovered)
                        {
                            paidDate = col.CollectionDate;
                            receiptNo = col.ReceiptNo;
                            break;
                        }
                    }
                    if (!paidDate.HasValue && collections.Any())
                    {
                        paidDate = collections.Last().CollectionDate;
                        receiptNo = collections.Last().ReceiptNo;
                    }
                }
                else if (availablePrincipal > 0)
                {
                    paidP = availablePrincipal;
                    remainingP = instPrincipal - availablePrincipal;
                    availablePrincipal = 0;
                    paidI = Math.Min(availableInterest, instInterest);
                    availableInterest = Math.Max(0, availableInterest - paidI);
                    status = "Partially Paid"; // अंशतः भरला

                    if (collections.Any())
                    {
                        paidDate = collections.Last().CollectionDate;
                        receiptNo = collections.Last().ReceiptNo;
                    }
                }
                else
                {
                    paidP = 0;
                    remainingP = instPrincipal;
                    paidI = 0;
                    if (s.DueDate.Date < today.Date)
                    {
                        status = "Overdue"; // थकीत
                        overdueDays = (today.Date - s.DueDate.Date).Days;
                    }
                    else
                    {
                        status = "Pending"; // आगामी देय
                    }
                }

                scheduleDtos.Add(new LoanInstallmentScheduleDto
                {
                    InstallmentNo = s.InstallmentNo,
                    DueDate = s.DueDate,
                    PrincipalAmount = s.PrincipalAmount,
                    InterestAmount = s.InterestAmount,
                    TotalAmount = s.TotalAmount,
                    Status = status,
                    PaidDate = paidDate,
                    OpeningBalance = s.OpeningBalance,
                    ClosingBalance = s.ClosingBalance,
                    Days = s.Days,
                    InterestRate = s.InterestRate,
                    PaidPrincipal = paidP,
                    PaidInterest = paidI,
                    RemainingPrincipal = remainingP,
                    OverdueDays = overdueDays,
                    ReceiptNo = receiptNo
                });
            }

            var dto = new AccountDetailsAndScheduleDto
            {
                SanctionedAmount = account.SanctionedAmount,
                DisbursementDate = account.LoanDisbursementDate ?? account.OpeningDate,
                March31Balance = march31Balance,
                IsOpeningBalance = account.IsOpeningBalance,
                CurrentPrincipalBalance = account.PrincipalBalance,
                CurrentInterestBalance = account.InterestBalance,
                CurrentOverdueInterestBalance = account.OverdueInterestBalance,
                TotalDisbursedAmount = totalDisbursed > 0 ? totalDisbursed : account.PrincipalBalance,
                DisbursementCount = allDisbursements.Count,
                PendingSanctionedAmount = pendingLimit,
                LastInstallmentPaidDate = account.LastInstallmentPaidDate,
                LastInterestPostingDate = account.LastInterestPostingDate,
                Tranches = allDisbursements.Select(d => new LoanTrancheDetailDto
                {
                    DisbursementID = d.LoanDisbursementID,
                    DisbursementDate = d.DisbursementDate,
                    DisbursementAmount = d.DisbursementAmount,
                    PaymentMode = d.PaymentMode,
                    NetAmountPaid = d.NetAmountPaid
                }).ToList(),
                Schedule = scheduleDtos
            };

            return dto;
        }

        // POST: api/LoanAccounts
        [HttpPost]
        public async Task<ActionResult<LoanAccount>> PostLoanAccount(LoanAccount loanAccount)
        {
            // Sanitize 0 values for nullable FKs
            if (loanAccount.CoCustomerID.HasValue && loanAccount.CoCustomerID.Value <= 0) loanAccount.CoCustomerID = null;
            if (loanAccount.CoCustomer2ID.HasValue && loanAccount.CoCustomer2ID.Value <= 0) loanAccount.CoCustomer2ID = null;
            if (loanAccount.Guarantor1CustomerID.HasValue && loanAccount.Guarantor1CustomerID.Value <= 0) loanAccount.Guarantor1CustomerID = null;
            if (loanAccount.Guarantor2CustomerID.HasValue && loanAccount.Guarantor2CustomerID.Value <= 0) loanAccount.Guarantor2CustomerID = null;

            // Resolve Customer & Member
            Customer? customer = null;
            Member? borrower = null;

            if (loanAccount.CustomerID.HasValue && loanAccount.CustomerID.Value > 0)
            {
                customer = await _context.Customers.FindAsync(loanAccount.CustomerID.Value);
                if (customer != null && customer.CustomerID > 0)
                {
                    borrower = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == customer.CustomerID);
                }
            }
            else if (loanAccount.MemberID.HasValue && loanAccount.MemberID.Value > 0)
            {
                borrower = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == loanAccount.MemberID.Value);
                if (borrower != null && borrower.CustomerID > 0)
                {
                    customer = await _context.Customers.FindAsync(borrower.CustomerID);
                }
            }

            loanAccount.CustomerID = customer?.CustomerID ?? (borrower?.CustomerID > 0 ? borrower.CustomerID : null);
            loanAccount.MemberID = borrower?.MemberID;

            // Auto-generate LoanAccountNo if empty
            if (string.IsNullOrWhiteSpace(loanAccount.LoanAccountNo))
            {
                int targetBranchId = loanAccount.BranchID > 0 ? loanAccount.BranchID : 1;
                int schemeCodeNum = 201;
                if (loanAccount.LoanRateID > 0)
                {
                    var lr = await _context.LoanRates.FindAsync(loanAccount.LoanRateID);
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
                    .Where(a => a.BranchID == targetBranchId && a.LoanAccountNo != null)
                    .Select(l => l.LoanAccountNo!)
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

                int nextSeq = maxSeq + 1;
                string nextAccNo = Helpers.AccountNumberHelper.Generate14DigitAccountNo(targetBranchId, schemeCodeNum, nextSeq);
                while (existingLoanAccs.Contains(nextAccNo) || await _context.LoanAccounts.AnyAsync(l => l.BranchID == targetBranchId && l.LoanAccountNo == nextAccNo))
                {
                    nextSeq++;
                    nextAccNo = Helpers.AccountNumberHelper.Generate14DigitAccountNo(targetBranchId, schemeCodeNum, nextSeq);
                }

                loanAccount.LoanAccountNo = nextAccNo;
            }
            else
            {
                if (await IsLoanAccountNoDuplicateAsync(loanAccount.BranchID, loanAccount.LoanAccountNo))
                {
                    return BadRequest(new { message = $"कर्ज खाते क्रमांक '{loanAccount.LoanAccountNo}' आधीपासून शाखा क्र. {loanAccount.BranchID} मध्ये अस्तित्वात आहे." });
                }
            }

            try
            {
                _context.LoanAccounts.Add(loanAccount);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (ex.InnerException is Microsoft.Data.SqlClient.SqlException sqlEx && (sqlEx.Number == 2601 || sqlEx.Number == 2627))
            {
                return Conflict(new { message = $"कर्ज खाते क्रमांक '{loanAccount.LoanAccountNo}' आधीपासून अस्तित्वात आहे. कृपया नवीन खाते क्रमांक वापरा." });
            }

            return CreatedAtAction("GetLoanAccount", new { id = loanAccount.LoanAccountID }, loanAccount);
        }

        // POST: api/LoanAccounts/OpeningBalance
        [HttpPost("OpeningBalance")]
        public async Task<ActionResult<LoanAccount>> PostOpeningBalance(LoanOpeningBalanceDto dto)
        {
            // Server-Side Guard Clause: Validate negative values, date cut-offs, and financial sanity
            var validationError = await ValidateOpeningBalanceDtoAsync(dto);
            if (!string.IsNullOrEmpty(validationError))
            {
                var (vUserId, vUsername, vIp) = GetAuditContext();
                _context.AuditLogs.Add(new AuditLog
                {
                    UserID = vUserId,
                    Username = vUsername,
                    Action = "LOAN_OPENING_VALIDATION_FAILED",
                    EntityName = "LoanAccount",
                    Status = "Failed",
                    Timestamp = DateTime.Now,
                    IPAddress = vIp,
                    Details = $"Validation failed in PostOpeningBalance: {validationError}. Sanctioned: ₹{dto.SanctionedAmount:N2}, Principal: ₹{dto.PrincipalBalance:N2}, Date: {dto.OpeningDate:yyyy-MM-dd}"
                });
                await _context.SaveChangesAsync();
                return BadRequest(new { message = validationError });
            }

            if (dto.LoanOpeningBalanceID > 0)
            {
                var existingAccount = await _context.LoanAccounts.FindAsync(dto.LoanOpeningBalanceID);
                if (existingAccount != null)
                {
                    // Defensive guard: Redirect to PutOpeningBalance to prevent duplicate account creation
                    var putResult = await PutOpeningBalance(dto.LoanOpeningBalanceID, dto);
                    if (putResult is NoContentResult || putResult is OkResult || putResult is OkObjectResult)
                    {
                        var reloaded = await _context.LoanAccounts.FindAsync(dto.LoanOpeningBalanceID);
                        return Ok(reloaded ?? existingAccount);
                    }
                    return StatusCode(500, "Failed to update existing opening balance");
                }
            }

            string resolvedAccountNo = dto.LoanAccountNo ?? "";
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var loanRate = await _context.LoanRates.FindAsync(dto.LoanRateID);

                // Resolve Customer & Member
                Customer? customer = null;
                Member? borrower = null;

                if (dto.CustomerID.HasValue && dto.CustomerID.Value > 0)
                {
                    customer = await _context.Customers.FindAsync(dto.CustomerID.Value);
                    if (customer != null) borrower = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == customer.CustomerID);
                }
                else if (dto.MemberID.HasValue && dto.MemberID.Value > 0)
                {
                    borrower = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == dto.MemberID.Value);
                    if (borrower != null && borrower.CustomerID > 0) customer = await _context.Customers.FindAsync(borrower.CustomerID);
                }

                resolvedAccountNo = await ResolveValidLoanAccountNo(dto.BranchID, dto.LoanRateID, dto.LoanAccountNo);

                var loanAccount = new LoanAccount
                {
                    BranchID = dto.BranchID,
                    CustomerID = customer?.CustomerID ?? (borrower?.CustomerID > 0 ? borrower.CustomerID : null),
                    MemberID = borrower?.MemberID,
                    LoanRateID = dto.LoanRateID,
                    LoanAccountNo = resolvedAccountNo,
                    LegacyAccountNumber = dto.LegacyAccountNumber,
                    PrincipalBalance = (dto.PurePrincipalBalance > 0 || dto.CapitalizedInterestAmount > 0)
                        ? (dto.PurePrincipalBalance + dto.CapitalizedInterestAmount)
                        : dto.PrincipalBalance,
                    PurePrincipalBalance = dto.PurePrincipalBalance > 0 ? dto.PurePrincipalBalance : dto.PrincipalBalance,
                    CapitalizedInterestAmount = dto.CapitalizedInterestAmount,
                    InterestBalance = dto.InterestBalance,
                    OverdueInterestBalance = dto.OverdueInterestBalance,
                    InterestProvisionBalance = dto.InterestProvisionBalance,
                    InitialNpaClassification = string.IsNullOrWhiteSpace(dto.InitialNpaClassification) ? "Standard" : dto.InitialNpaClassification,
                    ChargeInterestOnCapitalizedAmount = dto.ChargeInterestOnCapitalizedAmount,
                    OpeningDate = dto.OpeningDate,
                    LoanDisbursementDate = dto.LoanDisbursementDate ?? dto.OpeningDate,
                    SanctionedAmount = dto.SanctionedAmount,
                    InterestRate = dto.InterestRate,
                    DurationMonths = dto.DurationMonths,
                    InstallmentAmount = dto.InstallmentAmount,
                    FirstInstallmentDate = dto.FirstInstallmentDate,
                    MaturityDate = dto.MaturityDate,
                    InstallmentFrequency = dto.InstallmentFrequency,
                    LastInstallmentPaidDate = dto.LastInstallmentPaidDate,
                    Guarantor1CustomerID = dto.Guarantor1CustomerID > 0 ? dto.Guarantor1CustomerID : null,
                    Guarantor2CustomerID = dto.Guarantor2CustomerID > 0 ? dto.Guarantor2CustomerID : null,
                    CoCustomerID = dto.CoCustomerID > 0 ? dto.CoCustomerID : null,
                    CoCustomer2ID = dto.CoCustomer2ID > 0 ? dto.CoCustomer2ID : null,
                    SecurityDetails = dto.SecurityDetails,
                    SecurityValue = dto.SecurityValue,
                    NoOfInstallments = dto.NoOfInstallments,
                    IsOpeningBalance = true,
                    Status = "Active"
                };

                _context.LoanAccounts.Add(loanAccount);
                await _context.SaveChangesAsync();

                var disbursement = new LoanDisbursement
                {
                    LoanAccountID = loanAccount.LoanAccountID,
                    DisbursementDate = dto.LoanDisbursementDate ?? dto.OpeningDate,
                    SanctionedAmount = dto.SanctionedAmount,
                    DisbursementAmount = dto.SanctionedAmount,
                    ProcessingFee = 0,
                    ShareDeduction = 0,
                    InsuranceDeduction = 0,
                    StationeryCharges = 0,
                    OtherDeductions = 0,
                    NetAmountPaid = dto.SanctionedAmount,
                    PaymentMode = "Opening Balance",
                    Remarks = "Opening Balance (मागील येणे कर्ज)",
                    LoanInstallmentType = loanRate?.LoanInstallmentType
                };
                _context.LoanDisbursements.Add(disbursement);
                await _context.SaveChangesAsync();

                if (dto.Schedule != null && dto.Schedule.Any())
                {
                    decimal pureBal = dto.PurePrincipalBalance > 0 
                        ? dto.PurePrincipalBalance 
                        : (dto.CapitalizedInterestAmount > 0 ? (dto.PrincipalBalance - dto.CapitalizedInterestAmount) : dto.PrincipalBalance);
                    decimal totalPrincipalPaid = Math.Max(0, dto.SanctionedAmount - pureBal);
                    foreach (var s in dto.Schedule)
                    {
                        string status = "Pending";
                        DateTime? paidDate = null;
                        
                        if (totalPrincipalPaid >= s.Principal)
                        {
                            status = "Paid";
                            paidDate = loanAccount.OpeningDate;
                            totalPrincipalPaid -= s.Principal;
                        }
                        else if (s.Date < DateTime.Today)
                        {
                            status = "Overdue";
                            totalPrincipalPaid = 0;
                        }
                        
                        var schedule = new LoanInstallmentSchedule
                        {
                            LoanAccountID = loanAccount.LoanAccountID,
                            InstallmentNo = s.No,
                            DueDate = s.Date,
                            PrincipalAmount = s.Principal,
                            InterestAmount = s.Interest,
                            TotalAmount = s.Total,
                            BalanceAmount = s.Balance,
                            Status = status,
                            PaidDate = paidDate,
                            OpeningBalance = s.OpeningBalance,
                            ClosingBalance = s.ClosingBalance,
                            Days = s.Days,
                            InterestRate = s.InterestRate
                        };
                        _context.LoanInstallmentSchedules.Add(schedule);
                    }
                    await _context.SaveChangesAsync();
                }

                // NPA Integration: Add initial CollateralComplianceLog for secured loans
                if (loanAccount.SecurityValue > 0)
                {
                    var collateralLog = new CollateralComplianceLog
                    {
                        LoanAccountID = loanAccount.LoanAccountID,
                        ValuationDate = loanAccount.LoanDisbursementDate ?? loanAccount.OpeningDate,
                        CollateralValue = loanAccount.SecurityValue,
                        CollateralDescription = loanAccount.SecurityDetails,
                        MarginPercent = 0, // Default or fetch from config
                        IsMarginMaintained = true,
                        InspectorName = "System (Opening Balance)",
                        Remarks = "Initial valuation from Opening Balance"
                    };
                    _context.CollateralComplianceLogs.Add(collateralLog);
                    await _context.SaveChangesAsync();
                }

                // Save Gold Loan Collateral Details if provided
                if (dto.GoldItems != null && dto.GoldItems.Any())
                {
                    foreach (var item in dto.GoldItems)
                    {
                        var goldDetail = new GoldLoanDetail
                        {
                            LoanAccountID = loanAccount.LoanAccountID,
                            OrnamentName = string.IsNullOrWhiteSpace(item.OrnamentName) ? "दागिने" : item.OrnamentName.Trim(),
                            Quantity = item.Quantity > 0 ? item.Quantity : 1,
                            GrossWeight = item.GrossWeight,
                            NetWeight = item.NetWeight,
                            Purity = item.Purity,
                            GoldRatePerGram = item.GoldRatePerGram,
                            EstimatedValue = item.EstimatedValue > 0 ? item.EstimatedValue : (item.NetWeight * item.GoldRatePerGram),
                            ImagePath = item.Remarks
                        };
                        _context.GoldLoanDetails.Add(goldDetail);
                    }
                    await _context.SaveChangesAsync();
                }

                // Save Deposit Collaterals & Mark Lien for Opening Balance
                if (dto.DepositCollaterals != null && dto.DepositCollaterals.Any())
                {
                    var (auditUid, _, _) = GetAuditContext();
                    foreach (var c in dto.DepositCollaterals)
                    {
                        var colRecord = new LoanDepositCollateral
                        {
                            LoanAccountID = loanAccount.LoanAccountID,
                            CustomerID = loanAccount.CustomerID ?? (loanAccount.Member?.CustomerID ?? 0),
                            CollateralType = c.CollateralType,
                            DepositAccountID = c.DepositAccountID,
                            DepositAccountNo = c.DepositAccountNo,
                            DepositAmount = c.DepositAmount,
                            CurrentDepositBalance = c.CurrentDepositBalance,
                            MaturityDate = c.MaturityDate,
                            LienAmount = c.LienAmount > 0 ? c.LienAmount : c.DepositAmount,
                            LienStatus = "LienMarked",
                            LienMarkedDate = DateTime.Now,
                            Remarks = c.Remarks,
                            CreatedBy = auditUid,
                            CreatedDate = DateTime.Now
                        };
                        _context.LoanDepositCollaterals.Add(colRecord);

                        if (c.CollateralType == "FixedDeposit")
                        {
                            var fd = await _context.FdAccounts.FindAsync(c.DepositAccountID);
                            if (fd != null)
                            {
                                fd.IsLienMarked = true;
                                fd.LienLoanAccountNo = loanAccount.LoanAccountNo;
                                fd.LienAmount = colRecord.LienAmount;
                            }
                        }
                        else if (c.CollateralType == "PigmyDeposit")
                        {
                            var pg = await _context.PigmyAccounts.FindAsync(c.DepositAccountID);
                            if (pg != null)
                            {
                                pg.IsLienMarked = true;
                                pg.LienLoanAccountNo = loanAccount.LoanAccountNo;
                                pg.LienAmount = colRecord.LienAmount;
                            }
                        }
                        else if (c.CollateralType == "RecurringDeposit")
                        {
                            var rd = await _context.RdAccounts.FindAsync(c.DepositAccountID);
                            if (rd != null)
                            {
                                rd.IsLienMarked = true;
                                rd.LienLoanAccountNo = loanAccount.LoanAccountNo;
                                rd.LienAmount = colRecord.LienAmount;
                            }
                        }
                        else if (c.CollateralType == "SavingDeposit")
                        {
                            var sav = await _context.SavingAccountMasters.FindAsync(c.DepositAccountID);
                            if (sav != null)
                            {
                                sav.LienAmount = colRecord.LienAmount;
                                sav.LienReason = $"Loan A/c: {loanAccount.LoanAccountNo}";
                            }
                        }
                    }
                    await _context.SaveChangesAsync();
                }

                // Forensic Audit Log for Opening Balance Creation
                var (auditUserId, auditUsername, auditIp) = GetAuditContext();
                string borrowerTitle = customer != null 
                    ? $"{customer.FirstName} {customer.LastName}".Trim() 
                    : (borrower?.Customer != null ? $"{borrower.Customer.FirstName} {borrower.Customer.LastName}".Trim() : "Borrower");

                var postAuditDetails = new
                {
                    Event = "LOAN_OPENING_BALANCE_CREATED",
                    LoanAccountID = loanAccount.LoanAccountID,
                    LoanAccountNo = loanAccount.LoanAccountNo,
                    Borrower = borrowerTitle,
                    BranchID = loanAccount.BranchID,
                    SanctionedAmount = loanAccount.SanctionedAmount,
                    PrincipalBalance = loanAccount.PrincipalBalance,
                    PurePrincipalBalance = loanAccount.PurePrincipalBalance,
                    CapitalizedInterestAmount = loanAccount.CapitalizedInterestAmount,
                    InterestBalance = loanAccount.InterestBalance,
                    OverdueInterestBalance = loanAccount.OverdueInterestBalance,
                    InterestProvisionBalance = loanAccount.InterestProvisionBalance,
                    InitialNpaClassification = loanAccount.InitialNpaClassification,
                    OpeningDate = loanAccount.OpeningDate.ToString("yyyy-MM-dd"),
                    Operator = auditUsername,
                    IPAddress = auditIp,
                    Timestamp = DateTime.Now
                };

                _context.AuditLogs.Add(new AuditLog
                {
                    UserID = auditUserId,
                    Username = auditUsername,
                    Action = "LOAN_OPENING_BALANCE_CREATED",
                    EntityName = "LoanAccount",
                    EntityID = loanAccount.LoanAccountID.ToString(),
                    Timestamp = DateTime.Now,
                    IPAddress = auditIp,
                    Details = $"Loan Opening Balance Created: A/C {loanAccount.LoanAccountNo} ({borrowerTitle}). Principal: ₹{loanAccount.PrincipalBalance:N2} (Pure: ₹{loanAccount.PurePrincipalBalance:N2}, CapInt: ₹{loanAccount.CapitalizedInterestAmount:N2}), Int: ₹{loanAccount.InterestBalance:N2}, Prov: ₹{loanAccount.InterestProvisionBalance:N2}, NPA: {loanAccount.InitialNpaClassification}. Operator: {auditUsername} (IP: {auditIp}) | Payload: {System.Text.Json.JsonSerializer.Serialize(postAuditDetails)}"
                });
                await _context.SaveChangesAsync();

                // Synchronize Initial NPA Classification with LoanAccountNpaStatuses
                await EnsureInitialNpaStatusAsync(loanAccount, dto);

                await transaction.CommitAsync();
                return Ok(loanAccount);
            }
            catch (DbUpdateException ex) when (ex.InnerException is Microsoft.Data.SqlClient.SqlException sqlEx && (sqlEx.Number == 2601 || sqlEx.Number == 2627))
            {
                await transaction.RollbackAsync();
                var (vUserId, vUsername, vIp) = GetAuditContext();
                _context.AuditLogs.Add(new AuditLog
                {
                    UserID = vUserId,
                    Username = vUsername,
                    Action = "LOAN_ACCOUNT_DUPLICATE_COLLISION",
                    EntityName = "LoanAccount",
                    Status = "Conflict",
                    Timestamp = DateTime.Now,
                    IPAddress = vIp,
                    Details = $"Concurrency collision in PostOpeningBalance: LoanAccountNo '{resolvedAccountNo}' already exists in Branch {dto.BranchID}."
                });
                await _context.SaveChangesAsync();
                return Conflict(new { message = $"कर्ज खाते क्रमांक '{resolvedAccountNo}' आधीपासून शाखा क्र. {dto.BranchID} मध्ये अस्तित्वात आहे. कृपया नवीन खाते क्रमांक जनरेट करा." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "Internal server error: " + ex.Message);
            }
        }

        // PUT: api/LoanAccounts/OpeningBalance/5
        [HttpPut("OpeningBalance/{id}")]
        public async Task<IActionResult> PutOpeningBalance(int id, LoanOpeningBalanceDto dto)
        {
            // Server-Side Guard Clause: Validate negative values, date cut-offs, and financial sanity
            var validationError = await ValidateOpeningBalanceDtoAsync(dto);
            if (!string.IsNullOrEmpty(validationError))
            {
                var (vUserId, vUsername, vIp) = GetAuditContext();
                _context.AuditLogs.Add(new AuditLog
                {
                    UserID = vUserId,
                    Username = vUsername,
                    Action = "LOAN_OPENING_VALIDATION_FAILED",
                    EntityName = "LoanAccount",
                    EntityID = id.ToString(),
                    Status = "Failed",
                    Timestamp = DateTime.Now,
                    IPAddress = vIp,
                    Details = $"Validation failed in PutOpeningBalance (A/C ID {id}): {validationError}. Sanctioned: ₹{dto.SanctionedAmount:N2}, Principal: ₹{dto.PrincipalBalance:N2}, Date: {dto.OpeningDate:yyyy-MM-dd}"
                });
                await _context.SaveChangesAsync();
                return BadRequest(new { message = validationError });
            }

            string resolvedAccountNo = dto.LoanAccountNo ?? "";
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var loanAccount = await _context.LoanAccounts.FindAsync(id);
                if (loanAccount == null)
                {
                    return NotFound();
                }

                // Capture Forensic Old Snapshot before mutating loanAccount
                var oldSnapshot = new
                {
                    LoanAccountNo = loanAccount.LoanAccountNo,
                    BranchID = loanAccount.BranchID,
                    CustomerID = loanAccount.CustomerID,
                    MemberID = loanAccount.MemberID,
                    LoanRateID = loanAccount.LoanRateID,
                    PrincipalBalance = loanAccount.PrincipalBalance,
                    PurePrincipalBalance = loanAccount.PurePrincipalBalance,
                    CapitalizedInterestAmount = loanAccount.CapitalizedInterestAmount,
                    InterestBalance = loanAccount.InterestBalance,
                    OverdueInterestBalance = loanAccount.OverdueInterestBalance,
                    InterestProvisionBalance = loanAccount.InterestProvisionBalance,
                    InitialNpaClassification = loanAccount.InitialNpaClassification,
                    OpeningDate = loanAccount.OpeningDate,
                    SanctionedAmount = loanAccount.SanctionedAmount,
                    InterestRate = loanAccount.InterestRate,
                    InstallmentAmount = loanAccount.InstallmentAmount,
                    DurationMonths = loanAccount.DurationMonths,
                    SecurityValue = loanAccount.SecurityValue
                };

                // Resolve Customer & Member
                Customer? customer = null;
                Member? borrower = null;

                if (dto.CustomerID.HasValue && dto.CustomerID.Value > 0)
                {
                    customer = await _context.Customers.FindAsync(dto.CustomerID.Value);
                    if (customer != null) borrower = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == customer.CustomerID);
                }
                else if (dto.MemberID.HasValue && dto.MemberID.Value > 0)
                {
                    borrower = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == dto.MemberID.Value);
                    if (borrower != null && borrower.CustomerID > 0) customer = await _context.Customers.FindAsync(borrower.CustomerID);
                }

                loanAccount.BranchID = dto.BranchID;
                loanAccount.CustomerID = customer?.CustomerID ?? (borrower?.CustomerID > 0 ? borrower.CustomerID : loanAccount.CustomerID);
                loanAccount.MemberID = borrower?.MemberID ?? dto.MemberID;
                loanAccount.LoanRateID = dto.LoanRateID;
                resolvedAccountNo = await ResolveValidLoanAccountNo(dto.BranchID, dto.LoanRateID, dto.LoanAccountNo);
                loanAccount.LoanAccountNo = resolvedAccountNo;
                loanAccount.LegacyAccountNumber = dto.LegacyAccountNumber;
                loanAccount.PrincipalBalance = (dto.PurePrincipalBalance > 0 || dto.CapitalizedInterestAmount > 0)
                    ? (dto.PurePrincipalBalance + dto.CapitalizedInterestAmount)
                    : dto.PrincipalBalance;
                loanAccount.PurePrincipalBalance = dto.PurePrincipalBalance > 0 ? dto.PurePrincipalBalance : dto.PrincipalBalance;
                loanAccount.CapitalizedInterestAmount = dto.CapitalizedInterestAmount;
                loanAccount.InterestBalance = dto.InterestBalance;
                loanAccount.OverdueInterestBalance = dto.OverdueInterestBalance;
                loanAccount.InterestProvisionBalance = dto.InterestProvisionBalance;
                loanAccount.InitialNpaClassification = string.IsNullOrWhiteSpace(dto.InitialNpaClassification) ? "Standard" : dto.InitialNpaClassification;
                loanAccount.ChargeInterestOnCapitalizedAmount = dto.ChargeInterestOnCapitalizedAmount;
                loanAccount.OpeningDate = dto.OpeningDate;
                loanAccount.LoanDisbursementDate = dto.LoanDisbursementDate ?? dto.OpeningDate;
                loanAccount.SanctionedAmount = dto.SanctionedAmount;
                loanAccount.InterestRate = dto.InterestRate;
                loanAccount.DurationMonths = dto.DurationMonths;
                loanAccount.InstallmentAmount = dto.InstallmentAmount;
                loanAccount.FirstInstallmentDate = dto.FirstInstallmentDate;
                loanAccount.MaturityDate = dto.MaturityDate;
                loanAccount.InstallmentFrequency = dto.InstallmentFrequency;
                loanAccount.LastInstallmentPaidDate = dto.LastInstallmentPaidDate;
                loanAccount.Guarantor1CustomerID = dto.Guarantor1CustomerID;
                loanAccount.Guarantor2CustomerID = dto.Guarantor2CustomerID;
                loanAccount.SecurityDetails = dto.SecurityDetails;
                loanAccount.SecurityValue = dto.SecurityValue;
                loanAccount.NoOfInstallments = dto.NoOfInstallments;

                var loanRate = await _context.LoanRates.FindAsync(dto.LoanRateID);

                _context.Entry(loanAccount).State = EntityState.Modified;
                await _context.SaveChangesAsync();

                var disbursement = await _context.LoanDisbursements
                    .FirstOrDefaultAsync(d => d.LoanAccountID == id && (d.PaymentMode == "Opening Balance" || (d.Remarks != null && d.Remarks.Contains("Opening Balance"))));
                if (disbursement == null)
                {
                    disbursement = new LoanDisbursement { LoanAccountID = id };
                    _context.LoanDisbursements.Add(disbursement);
                }
                disbursement.DisbursementDate = dto.LoanDisbursementDate ?? dto.OpeningDate;
                disbursement.SanctionedAmount = dto.SanctionedAmount;
                disbursement.DisbursementAmount = dto.SanctionedAmount;
                disbursement.NetAmountPaid = dto.SanctionedAmount;
                disbursement.PaymentMode = "Opening Balance";
                disbursement.Remarks = "Opening Balance (मागील येणे कर्ज)";
                disbursement.LoanInstallmentType = loanRate?.LoanInstallmentType;
                await _context.SaveChangesAsync();

                // Delete existing schedule
                var existingSchedule = _context.LoanInstallmentSchedules.Where(s => s.LoanAccountID == id);
                _context.LoanInstallmentSchedules.RemoveRange(existingSchedule);
                await _context.SaveChangesAsync();

                // Add new schedule
                if (dto.Schedule != null && dto.Schedule.Any())
                {
                    decimal pureBal = dto.PurePrincipalBalance > 0 
                        ? dto.PurePrincipalBalance 
                        : (dto.CapitalizedInterestAmount > 0 ? (dto.PrincipalBalance - dto.CapitalizedInterestAmount) : dto.PrincipalBalance);
                    decimal totalPrincipalPaid = Math.Max(0, dto.SanctionedAmount - pureBal);
                    foreach (var s in dto.Schedule)
                    {
                        string status = "Pending";
                        DateTime? paidDate = null;
                        
                        if (totalPrincipalPaid >= s.Principal)
                        {
                            status = "Paid";
                            paidDate = loanAccount.OpeningDate;
                            totalPrincipalPaid -= s.Principal;
                        }
                        else if (s.Date < DateTime.Today)
                        {
                            status = "Overdue";
                            totalPrincipalPaid = 0;
                        }

                        var schedule = new LoanInstallmentSchedule
                        {
                            LoanAccountID = loanAccount.LoanAccountID,
                            InstallmentNo = s.No,
                            DueDate = s.Date,
                            PrincipalAmount = s.Principal,
                            InterestAmount = s.Interest,
                            TotalAmount = s.Total,
                            BalanceAmount = s.Balance,
                            Status = status,
                            PaidDate = paidDate,
                            OpeningBalance = s.OpeningBalance,
                            ClosingBalance = s.ClosingBalance,
                            Days = s.Days,
                            InterestRate = s.InterestRate
                        };
                        _context.LoanInstallmentSchedules.Add(schedule);
                    }
                    await _context.SaveChangesAsync();
                }

                // Sync Gold Loan Collateral Details if provided
                if (dto.GoldItems != null)
                {
                    var existingGold = await _context.GoldLoanDetails.Where(g => g.LoanAccountID == id).ToListAsync();
                    if (existingGold.Any())
                    {
                        _context.GoldLoanDetails.RemoveRange(existingGold);
                    }

                    if (dto.GoldItems.Any())
                    {
                        foreach (var item in dto.GoldItems)
                        {
                            var goldDetail = new GoldLoanDetail
                            {
                                LoanAccountID = id,
                                OrnamentName = string.IsNullOrWhiteSpace(item.OrnamentName) ? "दागिने" : item.OrnamentName.Trim(),
                                Quantity = item.Quantity > 0 ? item.Quantity : 1,
                                GrossWeight = item.GrossWeight,
                                NetWeight = item.NetWeight,
                                Purity = item.Purity,
                                GoldRatePerGram = item.GoldRatePerGram,
                                EstimatedValue = item.EstimatedValue > 0 ? item.EstimatedValue : (item.NetWeight * item.GoldRatePerGram),
                                ImagePath = item.Remarks
                            };
                            _context.GoldLoanDetails.Add(goldDetail);
                        }
                    }
                    await _context.SaveChangesAsync();
                }

                // Sync Deposit Collaterals & Liens for Opening Balance Update
                if (dto.DepositCollaterals != null)
                {
                    var existingCols = await _context.LoanDepositCollaterals
                        .Where(c => c.LoanAccountID == id)
                        .ToListAsync();

                    // Release liens on existing collaterals
                    foreach (var oldCol in existingCols)
                    {
                        if (oldCol.CollateralType == "FixedDeposit")
                        {
                            var fd = await _context.FdAccounts.FindAsync(oldCol.DepositAccountID);
                            if (fd != null && fd.LienLoanAccountNo == loanAccount.LoanAccountNo)
                            {
                                fd.IsLienMarked = false;
                                fd.LienLoanAccountNo = null;
                                fd.LienAmount = 0;
                            }
                        }
                        else if (oldCol.CollateralType == "PigmyDeposit")
                        {
                            var pg = await _context.PigmyAccounts.FindAsync(oldCol.DepositAccountID);
                            if (pg != null && pg.LienLoanAccountNo == loanAccount.LoanAccountNo)
                            {
                                pg.IsLienMarked = false;
                                pg.LienLoanAccountNo = null;
                                pg.LienAmount = 0;
                            }
                        }
                        else if (oldCol.CollateralType == "RecurringDeposit")
                        {
                            var rd = await _context.RdAccounts.FindAsync(oldCol.DepositAccountID);
                            if (rd != null && rd.LienLoanAccountNo == loanAccount.LoanAccountNo)
                            {
                                rd.IsLienMarked = false;
                                rd.LienLoanAccountNo = null;
                                rd.LienAmount = 0;
                            }
                        }
                        else if (oldCol.CollateralType == "SavingDeposit")
                        {
                            var sav = await _context.SavingAccountMasters.FindAsync(oldCol.DepositAccountID);
                            if (sav != null && sav.LienReason != null && sav.LienReason.Contains(loanAccount.LoanAccountNo ?? ""))
                            {
                                sav.LienAmount = 0;
                                sav.LienReason = null;
                            }
                        }
                    }

                    if (existingCols.Any())
                    {
                        _context.LoanDepositCollaterals.RemoveRange(existingCols);
                        await _context.SaveChangesAsync();
                    }

                    if (dto.DepositCollaterals.Any())
                    {
                        var (auditUid, _, _) = GetAuditContext();
                        foreach (var c in dto.DepositCollaterals)
                        {
                            var colRecord = new LoanDepositCollateral
                            {
                                LoanAccountID = id,
                                CustomerID = loanAccount.CustomerID ?? (loanAccount.Member?.CustomerID ?? 0),
                                CollateralType = c.CollateralType,
                                DepositAccountID = c.DepositAccountID,
                                DepositAccountNo = c.DepositAccountNo,
                                DepositAmount = c.DepositAmount,
                                CurrentDepositBalance = c.CurrentDepositBalance,
                                MaturityDate = c.MaturityDate,
                                LienAmount = c.LienAmount > 0 ? c.LienAmount : c.DepositAmount,
                                LienStatus = "LienMarked",
                                LienMarkedDate = DateTime.Now,
                                Remarks = c.Remarks,
                                CreatedBy = auditUid,
                                CreatedDate = DateTime.Now
                            };
                            _context.LoanDepositCollaterals.Add(colRecord);

                            if (c.CollateralType == "FixedDeposit")
                            {
                                var fd = await _context.FdAccounts.FindAsync(c.DepositAccountID);
                                if (fd != null)
                                {
                                    fd.IsLienMarked = true;
                                    fd.LienLoanAccountNo = loanAccount.LoanAccountNo;
                                    fd.LienAmount = colRecord.LienAmount;
                                }
                            }
                            else if (c.CollateralType == "PigmyDeposit")
                            {
                                var pg = await _context.PigmyAccounts.FindAsync(c.DepositAccountID);
                                if (pg != null)
                                {
                                    pg.IsLienMarked = true;
                                    pg.LienLoanAccountNo = loanAccount.LoanAccountNo;
                                    pg.LienAmount = colRecord.LienAmount;
                                }
                            }
                            else if (c.CollateralType == "RecurringDeposit")
                            {
                                var rd = await _context.RdAccounts.FindAsync(c.DepositAccountID);
                                if (rd != null)
                                {
                                    rd.IsLienMarked = true;
                                    rd.LienLoanAccountNo = loanAccount.LoanAccountNo;
                                    rd.LienAmount = colRecord.LienAmount;
                                }
                            }
                            else if (c.CollateralType == "SavingDeposit")
                            {
                                var sav = await _context.SavingAccountMasters.FindAsync(c.DepositAccountID);
                                if (sav != null)
                                {
                                    sav.LienAmount = colRecord.LienAmount;
                                    sav.LienReason = $"Loan A/c: {loanAccount.LoanAccountNo}";
                                }
                            }
                        }
                        await _context.SaveChangesAsync();
                    }
                }

                // Forensic Audit Log for Opening Balance Update (Before vs After Diff)
                var (auditUserId, auditUsername, auditIp) = GetAuditContext();

                var newSnapshot = new
                {
                    LoanAccountNo = loanAccount.LoanAccountNo,
                    BranchID = loanAccount.BranchID,
                    CustomerID = loanAccount.CustomerID,
                    MemberID = loanAccount.MemberID,
                    LoanRateID = loanAccount.LoanRateID,
                    PrincipalBalance = loanAccount.PrincipalBalance,
                    PurePrincipalBalance = loanAccount.PurePrincipalBalance,
                    CapitalizedInterestAmount = loanAccount.CapitalizedInterestAmount,
                    InterestBalance = loanAccount.InterestBalance,
                    OverdueInterestBalance = loanAccount.OverdueInterestBalance,
                    InterestProvisionBalance = loanAccount.InterestProvisionBalance,
                    InitialNpaClassification = loanAccount.InitialNpaClassification,
                    OpeningDate = loanAccount.OpeningDate,
                    SanctionedAmount = loanAccount.SanctionedAmount,
                    InterestRate = loanAccount.InterestRate,
                    InstallmentAmount = loanAccount.InstallmentAmount,
                    DurationMonths = loanAccount.DurationMonths,
                    SecurityValue = loanAccount.SecurityValue
                };

                var differences = new List<string>();
                if (oldSnapshot.PrincipalBalance != newSnapshot.PrincipalBalance)
                    differences.Add($"PrincipalBalance: ₹{oldSnapshot.PrincipalBalance:N2} -> ₹{newSnapshot.PrincipalBalance:N2}");
                if (oldSnapshot.PurePrincipalBalance != newSnapshot.PurePrincipalBalance)
                    differences.Add($"PurePrincipal: ₹{oldSnapshot.PurePrincipalBalance:N2} -> ₹{newSnapshot.PurePrincipalBalance:N2}");
                if (oldSnapshot.CapitalizedInterestAmount != newSnapshot.CapitalizedInterestAmount)
                    differences.Add($"CapInt: ₹{oldSnapshot.CapitalizedInterestAmount:N2} -> ₹{newSnapshot.CapitalizedInterestAmount:N2}");
                if (oldSnapshot.InterestBalance != newSnapshot.InterestBalance)
                    differences.Add($"InterestBalance: ₹{oldSnapshot.InterestBalance:N2} -> ₹{newSnapshot.InterestBalance:N2}");
                if (oldSnapshot.OverdueInterestBalance != newSnapshot.OverdueInterestBalance)
                    differences.Add($"OverdueInterest: ₹{oldSnapshot.OverdueInterestBalance:N2} -> ₹{newSnapshot.OverdueInterestBalance:N2}");
                if (oldSnapshot.InterestProvisionBalance != newSnapshot.InterestProvisionBalance)
                    differences.Add($"Provision: ₹{oldSnapshot.InterestProvisionBalance:N2} -> ₹{newSnapshot.InterestProvisionBalance:N2}");
                if (oldSnapshot.InitialNpaClassification != newSnapshot.InitialNpaClassification)
                    differences.Add($"NPA: '{oldSnapshot.InitialNpaClassification}' -> '{newSnapshot.InitialNpaClassification}'");
                if (oldSnapshot.OpeningDate != newSnapshot.OpeningDate)
                    differences.Add($"OpeningDate: {oldSnapshot.OpeningDate:yyyy-MM-dd} -> {newSnapshot.OpeningDate:yyyy-MM-dd}");
                if (oldSnapshot.SanctionedAmount != newSnapshot.SanctionedAmount)
                    differences.Add($"SanctionedAmount: ₹{oldSnapshot.SanctionedAmount:N2} -> ₹{newSnapshot.SanctionedAmount:N2}");
                if (oldSnapshot.InstallmentAmount != newSnapshot.InstallmentAmount)
                    differences.Add($"InstallmentAmount: ₹{oldSnapshot.InstallmentAmount:N2} -> ₹{newSnapshot.InstallmentAmount:N2}");

                string diffSummary = differences.Any() ? string.Join(", ", differences) : "No financial values changed (Re-saved)";

                var putAuditPayload = new
                {
                    Event = "LOAN_OPENING_BALANCE_UPDATED",
                    LoanAccountID = id,
                    LoanAccountNo = loanAccount.LoanAccountNo,
                    Operator = auditUsername,
                    IPAddress = auditIp,
                    Timestamp = DateTime.Now,
                    Changes = differences,
                    OldValues = oldSnapshot,
                    NewValues = newSnapshot
                };

                _context.AuditLogs.Add(new AuditLog
                {
                    UserID = auditUserId,
                    Username = auditUsername,
                    Action = "LOAN_OPENING_BALANCE_UPDATED",
                    EntityName = "LoanAccount",
                    EntityID = id.ToString(),
                    Timestamp = DateTime.Now,
                    IPAddress = auditIp,
                    Details = $"Loan Opening Balance Updated: A/C {loanAccount.LoanAccountNo}. Changes: [{diffSummary}]. Operator: {auditUsername} (IP: {auditIp}) | Payload: {System.Text.Json.JsonSerializer.Serialize(putAuditPayload)}"
                });
                await _context.SaveChangesAsync();

                // Synchronize Initial NPA Classification with LoanAccountNpaStatuses
                await EnsureInitialNpaStatusAsync(loanAccount, dto);

                await transaction.CommitAsync();
                return NoContent();
            }
            catch (DbUpdateException ex) when (ex.InnerException is Microsoft.Data.SqlClient.SqlException sqlEx && (sqlEx.Number == 2601 || sqlEx.Number == 2627))
            {
                await transaction.RollbackAsync();
                var (vUserId, vUsername, vIp) = GetAuditContext();
                _context.AuditLogs.Add(new AuditLog
                {
                    UserID = vUserId,
                    Username = vUsername,
                    Action = "LOAN_ACCOUNT_DUPLICATE_COLLISION",
                    EntityName = "LoanAccount",
                    Status = "Conflict",
                    Timestamp = DateTime.Now,
                    IPAddress = vIp,
                    Details = $"Concurrency collision in PutOpeningBalance: LoanAccountNo '{resolvedAccountNo}' already exists in Branch {dto.BranchID} for another account."
                });
                await _context.SaveChangesAsync();
                return Conflict(new { message = $"कर्ज खाते क्रमांक '{resolvedAccountNo}' आधीपासून अस्तित्वात आहे. कृपया वेगळा खाते क्रमांक प्रविष्ट करा." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "Internal server error: " + ex.Message + (ex.InnerException != null ? " | " + ex.InnerException.Message : ""));
            }
        }

        private async Task EnsureInitialNpaStatusAsync(LoanAccount loanAccount, LoanOpeningBalanceDto dto)
        {
            string rawCategory = (dto.InitialNpaClassification ?? "Standard").Trim();

            // 1. Normalize Category to standard IRAC values
            string category = rawCategory switch
            {
                "SubStandard" or "Sub-Standard" => "Sub-Standard",
                "Doubtful1" or "Doubtful-1" => "Doubtful-1",
                "Doubtful2" or "Doubtful-2" => "Doubtful-2",
                "Doubtful3" or "Doubtful-3" => "Doubtful-3",
                "Loss" => "Loss",
                _ => "Standard"
            };

            var existingStatus = await _context.LoanAccountNpaStatuses
                .FirstOrDefaultAsync(s => s.LoanAccountID == loanAccount.LoanAccountID);

            // If Category is Standard
            if (category == "Standard")
            {
                if (existingStatus != null)
                {
                    // If previously marked as NPA, revert to Standard Asset on edit
                    existingStatus.Category = "Standard";
                    existingStatus.OverdueDate = null;
                    existingStatus.OutOfOrderDate = null;
                    existingStatus.OutstandingBalance = loanAccount.PrincipalBalance + loanAccount.InterestBalance + loanAccount.OverdueInterestBalance;
                    existingStatus.ProvisionRequired = 0;
                    existingStatus.ProvisionHeld = loanAccount.InterestProvisionBalance;
                    existingStatus.AuditorRemarks = "Reverted to Standard Asset in Opening Balance Edit";
                    _context.Entry(existingStatus).State = EntityState.Modified;
                    await _context.SaveChangesAsync();

                    var (npaRevertUserId, npaRevertUsername, npaRevertIp) = GetAuditContext();
                    _context.AuditLogs.Add(new AuditLog
                    {
                        UserID = npaRevertUserId,
                        Username = npaRevertUsername,
                        Action = "NPA_STATUS_REVERTED_STANDARD",
                        EntityName = "LoanAccountNpaStatus",
                        EntityID = loanAccount.LoanAccountID.ToString(),
                        Timestamp = DateTime.Now,
                        IPAddress = npaRevertIp,
                        Details = $"Loan A/C {loanAccount.LoanAccountNo} status updated to 'Standard' in Opening Balance edit. Operator: {npaRevertUsername} (IP: {npaRevertIp})"
                    });
                    await _context.SaveChangesAsync();
                }
                return;
            }

            // 2. Ensure baseline NpaClassificationRun exists (Satisfies Foreign Key constraint FK_LoanAccountNpaStatuses_NpaClassificationRuns_LastClassificationRunId)
            var baselineRun = await _context.NpaClassificationRuns
                .FirstOrDefaultAsync(r => r.TriggeredBy == "System (Opening Balance)");

            if (baselineRun == null)
            {
                baselineRun = new NpaClassificationRun
                {
                    RunDate = dto.OpeningDate,
                    TriggeredBy = "System (Opening Balance)",
                    RecordsProcessed = 1,
                    Status = "Success",
                    Remarks = "Baseline run for Opening Balance initial asset classifications"
                };
                _context.NpaClassificationRuns.Add(baselineRun);
                await _context.SaveChangesAsync();
            }

            // 3. Compute statutory OverdueDate so computed OverdueDays conforms to IRAC norms
            DateTime asOfDate = dto.OpeningDate;
            DateTime overdueDate = category switch
            {
                "Sub-Standard" => asOfDate.AddDays(-91),     // > 90 days overdue
                "Doubtful-1"   => asOfDate.AddDays(-456),    // > 15 months overdue
                "Doubtful-2"   => asOfDate.AddDays(-821),    // > 27 months overdue
                "Doubtful-3"   => asOfDate.AddDays(-1186),   // > 39 months overdue
                "Loss"         => asOfDate.AddDays(-1186),   // Certified Loss Asset
                _              => asOfDate
            };

            // 4. Outstanding balance and collateral security assessment
            decimal totalOutstanding = loanAccount.PrincipalBalance + loanAccount.InterestBalance + loanAccount.OverdueInterestBalance;
            decimal compliantCollateral = loanAccount.SecurityValue;
            decimal securedAmount = Math.Min(totalOutstanding, compliantCollateral);
            decimal unsecuredAmount = Math.Max(0, totalOutstanding - securedAmount);

            string securityType = "Unsecured";
            if (securedAmount > 0 && unsecuredAmount > 0) securityType = "Mixed";
            else if (securedAmount > 0) securityType = "Secured";

            // 5. Statutory Provision Calculation (IRAC Norms)
            decimal securedPercent = category switch
            {
                "Sub-Standard" => 10.0m,
                "Doubtful-1"   => 25.0m,
                "Doubtful-2"   => 40.0m,
                "Doubtful-3"   => 100.0m,
                "Loss"         => 100.0m,
                _              => 0.25m
            };

            decimal unsecuredPercent = category switch
            {
                "Sub-Standard" => 15.0m,
                "Doubtful-1"   => 100.0m,
                "Doubtful-2"   => 100.0m,
                "Doubtful-3"   => 100.0m,
                "Loss"         => 100.0m,
                _              => 0.25m
            };

            decimal provisionRequired = Math.Round((securedAmount * securedPercent / 100m) + (unsecuredAmount * unsecuredPercent / 100m), 2);
            decimal provisionHeld = loanAccount.InterestProvisionBalance;

            // 6. Insert or update LoanAccountNpaStatus record
            if (existingStatus != null)
            {
                existingStatus.AsOfDate = asOfDate;
                existingStatus.OverdueDate = overdueDate;
                existingStatus.Category = category;
                existingStatus.SecurityType = securityType;
                existingStatus.OutstandingBalance = totalOutstanding;
                existingStatus.CompliantCollateralValue = compliantCollateral;
                existingStatus.ProvisionRequired = provisionRequired;
                existingStatus.ProvisionHeld = provisionHeld;
                existingStatus.IsAutoClassified = false;
                existingStatus.LastClassificationRunId = baselineRun.NpaClassificationRunID;
                existingStatus.AuditorRemarks = $"Initial Opening Balance Classification: {category}";
                _context.Entry(existingStatus).State = EntityState.Modified;
            }
            else
            {
                var npaStatus = new LoanAccountNpaStatus
                {
                    LoanAccountID = loanAccount.LoanAccountID,
                    AsOfDate = asOfDate,
                    OverdueDate = overdueDate,
                    Category = category,
                    SecurityType = securityType,
                    OutstandingBalance = totalOutstanding,
                    CompliantCollateralValue = compliantCollateral,
                    ProvisionRequired = provisionRequired,
                    ProvisionHeld = provisionHeld,
                    IsAutoClassified = false,
                    LastClassificationRunId = baselineRun.NpaClassificationRunID,
                    AuditorRemarks = $"Initial Opening Balance Classification: {category}"
                };
                _context.LoanAccountNpaStatuses.Add(npaStatus);
            }

            await _context.SaveChangesAsync();

            // 7. Forensic Audit Logging for NPA Classification
            var (npaAuditUserId, npaAuditUsername, npaAuditIp) = GetAuditContext();
            _context.AuditLogs.Add(new AuditLog
            {
                UserID = npaAuditUserId,
                Username = npaAuditUsername,
                Action = "NPA_INITIAL_STATUS_RECORDED",
                EntityName = "LoanAccountNpaStatus",
                EntityID = loanAccount.LoanAccountID.ToString(),
                Timestamp = DateTime.Now,
                IPAddress = npaAuditIp,
                Details = $"Initial NPA Status Synchronized: A/C {loanAccount.LoanAccountNo} classified as '{category}'. OverdueDays: {(asOfDate - overdueDate).Days}, Outstanding: ₹{totalOutstanding:N2}, ProvReq: ₹{provisionRequired:N2}, ProvHeld: ₹{provisionHeld:N2}. Operator: {npaAuditUsername} (IP: {npaAuditIp})"
            });
            await _context.SaveChangesAsync();
        }

        private (int UserId, string Username, string IpAddress) GetAuditContext()
        {
            int userId = 1;
            string username = "System";

            var userClaim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("UserID") ?? User.FindFirst("sub");
            if (userClaim != null && int.TryParse(userClaim.Value, out int uid)) userId = uid;

            var nameClaim = User.FindFirst(ClaimTypes.Name) ?? User.FindFirst("Username");
            if (nameClaim != null && !string.IsNullOrWhiteSpace(nameClaim.Value)) username = nameClaim.Value;
            else if (!string.IsNullOrWhiteSpace(User.Identity?.Name)) username = User.Identity.Name;

            string ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            if (HttpContext.Request.Headers.TryGetValue("X-Forwarded-For", out var forwardedFor) && !string.IsNullOrWhiteSpace(forwardedFor))
            {
                ipAddress = forwardedFor.ToString().Split(',')[0].Trim();
            }

            return (userId, username, ipAddress);
        }

        private async Task<string?> ValidateOpeningBalanceDtoAsync(LoanOpeningBalanceDto dto)
        {
            // 1. Basic entity references
            if (dto.BranchID <= 0)
                return "अवैध शाखा (Invalid Branch ID).";

            if ((!dto.CustomerID.HasValue || dto.CustomerID.Value <= 0) && (!dto.MemberID.HasValue || dto.MemberID.Value <= 0))
                return "कर्जदार ग्राहक (Customer) किंवा सभासद (Member) निवडणे अनिवार्य आहे.";

            if (dto.LoanRateID <= 0)
                return "कर्ज योजना (Loan Scheme / Rate ID) निवडणे अनिवार्य आहे.";

            // 2. Numerical non-negative & strictly positive checks
            if (dto.SanctionedAmount <= 0)
                return "कर्ज मंजूर रक्कम (Sanctioned Amount) ₹ ० पेक्षा जास्त असणे बंधनकारक आहे.";

            if (dto.PrincipalBalance < 0)
                return "मुद्दल बाकी (Principal Balance) उणे (Negative) असू शकत नाही.";

            if (dto.PurePrincipalBalance < 0)
                return "शुद्ध मुद्दल बाकी (Pure Principal Balance) उणे (Negative) असू शकत नाही.";

            if (dto.CapitalizedInterestAmount < 0)
                return "मुद्दलात समाविष्ट व्याज (Capitalized Interest Amount) उणे (Negative) असू शकत नाही.";

            // CBS Prudential Rule: Pure principal disbursed cannot exceed sanctioned limit
            decimal effectivePurePrincipal = dto.PurePrincipalBalance > 0 
                ? dto.PurePrincipalBalance 
                : (dto.CapitalizedInterestAmount > 0 ? (dto.PrincipalBalance - dto.CapitalizedInterestAmount) : dto.PrincipalBalance);

            if (effectivePurePrincipal > dto.SanctionedAmount)
            {
                return $"शुद्ध मुद्दल बाकी (₹ {effectivePurePrincipal:N2}) मंजूर रकमेपेक्षा (₹ {dto.SanctionedAmount:N2}) जास्त असू शकत नाही.";
            }

            // If no capitalized interest is reported, total principal balance cannot exceed sanctioned limit
            if (dto.CapitalizedInterestAmount <= 0 && dto.PrincipalBalance > dto.SanctionedAmount)
            {
                return $"मुद्दल बाकी (₹ {dto.PrincipalBalance:N2}) मंजूर रकमेपेक्षा (₹ {dto.SanctionedAmount:N2}) जास्त असू शकत नाही. जर मुद्दलात व्याज समाविष्ट असेल तर कृपया 'मुद्दलात समाविष्ट व्याज' रकान्यात नोंद करा.";
            }

            if (dto.InterestBalance < 0)
                return "चालू येणे व्याज शिल्लक (Interest Balance) उणे (Negative) असू शकत नाही.";

            if (dto.OverdueInterestBalance < 0)
                return "थकीत व्याज शिल्लक (Overdue Interest Balance) उणे (Negative) असू शकत नाही.";

            if (dto.InterestProvisionBalance < 0)
                return "व्याज तरतूद शिल्लक (Interest Provision Balance) उणे (Negative) असू शकत नाही.";

            if (dto.InterestRate < 0 || dto.InterestRate > 100)
                return "व्याज दर (Interest Rate) ०% ते १००% दरम्यान असणे आवश्यक आहे.";

            if (dto.DurationMonths <= 0)
                return "कर्ज कालावधी (Duration Months) ० पेक्षा जास्त असणे आवश्यक आहे.";

            if (dto.InstallmentAmount < 0)
                return "हप्ता रक्कम (Installment Amount) उणे (Negative) असू शकत नाही.";

            if (dto.SecurityValue < 0)
                return "तारण मूल्य (Security Value) उणे (Negative) असू शकत नाही.";

            // 3. Cut-off Date boundary enforcement
            var firstFy = await _context.FinancialYears.OrderBy(f => f.StartDate).FirstOrDefaultAsync();
            DateTime cutoffDate = firstFy != null ? firstFy.StartDate.AddDays(-1).Date : DateTime.Today;

            if (dto.OpeningDate.Date > cutoffDate.Date)
                return $"आरंभिक शिल्लक दिनांक ({dto.OpeningDate:dd/MM/yyyy}) कट-ऑफ दिनांकाच्या ({cutoffDate:dd/MM/yyyy}) नंतरचा असू शकत नाही.";

            if (dto.LoanDisbursementDate.HasValue && dto.LoanDisbursementDate.Value.Date > cutoffDate.Date)
                return $"कर्ज वाटप दिनांक ({dto.LoanDisbursementDate.Value:dd/MM/yyyy}) कट-ऑफ दिनांकाच्या ({cutoffDate:dd/MM/yyyy}) नंतरचा असू शकत नाही.";

            if (dto.LastInstallmentPaidDate.HasValue && dto.LastInstallmentPaidDate.Value.Date > cutoffDate.Date)
                return $"शेवटचा हप्ता भरल्याचा दिनांक ({dto.LastInstallmentPaidDate.Value:dd/MM/yyyy}) कट-ऑफ दिनांकाच्या ({cutoffDate:dd/MM/yyyy}) नंतरचा असू शकत नाही.";

            if (dto.LoanDisbursementDate.HasValue && dto.LoanDisbursementDate.Value.Date > dto.OpeningDate.Date)
                return $"कर्ज वाटप दिनांक ({dto.LoanDisbursementDate.Value:dd/MM/yyyy}) आरंभिक शिल्लक दिनांकाच्या ({dto.OpeningDate:dd/MM/yyyy}) नंतरचा असू शकत नाही.";

            // 4. LoanAccountNo uniqueness enforcement
            string cleanAccountNo = (dto.LoanAccountNo ?? "").Trim();
            if (cleanAccountNo.StartsWith("{") && cleanAccountNo.Contains("AccountNo"))
            {
                try
                {
                    using var doc = System.Text.Json.JsonDocument.Parse(cleanAccountNo);
                    if (doc.RootElement.TryGetProperty("accountNo", out var pAcc) && !string.IsNullOrWhiteSpace(pAcc.GetString()))
                        cleanAccountNo = pAcc.GetString()!.Trim();
                    else if (doc.RootElement.TryGetProperty("nextAccountNo", out var pNext) && !string.IsNullOrWhiteSpace(pNext.GetString()))
                        cleanAccountNo = pNext.GetString()!.Trim();
                    else if (doc.RootElement.TryGetProperty("formattedAccountNo", out var pForm) && !string.IsNullOrWhiteSpace(pForm.GetString()))
                        cleanAccountNo = pForm.GetString()!.Trim();
                }
                catch { }
            }
            cleanAccountNo = cleanAccountNo.Replace("\"", "").Replace("{", "").Replace("}", "").Trim();

            if (!string.IsNullOrWhiteSpace(cleanAccountNo))
            {
                int? excludeId = dto.LoanOpeningBalanceID > 0 ? dto.LoanOpeningBalanceID : null;
                if (await IsLoanAccountNoDuplicateAsync(dto.BranchID, cleanAccountNo, excludeId))
                {
                    return $"कर्ज खाते क्रमांक '{cleanAccountNo}' आधीपासून शाखा क्र. {dto.BranchID} मध्ये अस्तित्वात आहे. कृपया वेगळा खाते क्रमांक प्रविष्ट करा.";
                }
            }

            return null; // सर्व अटी वैध आहेत
        }

        private async Task<bool> IsLoanAccountNoDuplicateAsync(int branchId, string? accountNo, int? excludeLoanAccountId = null)
        {
            if (string.IsNullOrWhiteSpace(accountNo)) return false;
            string clean = accountNo.Trim();

            var query = _context.LoanAccounts.AsNoTracking().Where(l => l.BranchID == branchId && l.LoanAccountNo == clean);
            if (excludeLoanAccountId.HasValue && excludeLoanAccountId.Value > 0)
            {
                query = query.Where(l => l.LoanAccountID != excludeLoanAccountId.Value);
            }

            return await query.AnyAsync();
        }

        private async Task<string> ResolveValidLoanAccountNo(int branchId, int loanRateId, string? inputAccountNo)
        {
            string clean = (inputAccountNo ?? "").Trim();
            if (clean.StartsWith("{") && clean.Contains("AccountNo"))
            {
                try
                {
                    using var doc = System.Text.Json.JsonDocument.Parse(clean);
                    if (doc.RootElement.TryGetProperty("accountNo", out var pAcc) && !string.IsNullOrWhiteSpace(pAcc.GetString()))
                        clean = pAcc.GetString()!.Trim();
                    else if (doc.RootElement.TryGetProperty("nextAccountNo", out var pNext) && !string.IsNullOrWhiteSpace(pNext.GetString()))
                        clean = pNext.GetString()!.Trim();
                    else if (doc.RootElement.TryGetProperty("formattedAccountNo", out var pForm) && !string.IsNullOrWhiteSpace(pForm.GetString()))
                        clean = pForm.GetString()!.Trim();
                }
                catch { }
            }

            clean = clean.Replace("\"", "").Replace("{", "").Replace("}", "").Trim();

            if (string.IsNullOrWhiteSpace(clean))
            {
                int schemeCodeNum = 201;
                if (loanRateId > 0)
                {
                    var lr = await _context.LoanRates.FindAsync(loanRateId);
                    if (lr != null && !string.IsNullOrWhiteSpace(lr.LoanCode))
                    {
                        var sDigits = new string(lr.LoanCode.Where(char.IsDigit).ToArray());
                        if (int.TryParse(sDigits, out int parsed) && parsed > 0)
                            schemeCodeNum = parsed < 100 ? 200 + parsed : parsed;
                        else
                            schemeCodeNum = 200 + lr.LoanRateID;
                    }
                    else if (lr != null)
                    {
                        schemeCodeNum = 200 + lr.LoanRateID;
                    }
                }

                var existingLoanAccs = await _context.LoanAccounts
                    .Where(a => a.BranchID == branchId && a.LoanAccountNo != null)
                    .Select(l => l.LoanAccountNo!)
                    .ToListAsync();
                int nextSeq = existingLoanAccs.Count + 1;
                clean = Helpers.AccountNumberHelper.Generate14DigitAccountNo(branchId, schemeCodeNum, nextSeq);
                while (existingLoanAccs.Contains(clean) || await _context.LoanAccounts.AnyAsync(l => l.BranchID == branchId && l.LoanAccountNo == clean))
                {
                    nextSeq++;
                    clean = Helpers.AccountNumberHelper.Generate14DigitAccountNo(branchId, schemeCodeNum, nextSeq);
                }
            }

            return clean;
        }

        // GET: api/LoanAccounts/GlReconciliationSummary?branchId=1&loanRateId=0
        [HttpGet("GlReconciliationSummary")]
        public async Task<ActionResult<LoanGlReconciliationResponseDto>> GetGlReconciliationSummary([FromQuery] int branchId = 1, [FromQuery] int? loanRateId = 0)
        {
            try
            {
                int targetLoanRateId = loanRateId ?? 0;
                var allRates = await _context.LoanRates.AsNoTracking().ToListAsync();

                // Get all opening balance accounts for this branch
                var allOpeningAccounts = await _context.LoanAccounts.AsNoTracking()
                    .Where(l => l.BranchID == branchId && l.IsOpeningBalance)
                    .ToListAsync();

                // Collect all ledger IDs needed
                var ledgerIds = allRates.Select(r => r.LoanLedgerID).Where(id => id.HasValue).Select(id => id!.Value)
                    .Union(allRates.Select(r => r.ReceivableInterestLedgerID).Where(id => id.HasValue).Select(id => id!.Value))
                    .Distinct()
                    .ToList();

                var ledgers = await _context.Ledgers.AsNoTracking()
                    .Where(l => ledgerIds.Contains(l.LedgerID))
                    .ToDictionaryAsync(l => l.LedgerID, l => l);

                var schemeSummaries = new List<LoanGlReconciliationDto>();

                foreach (var rate in allRates)
                {
                    var rateAccounts = allOpeningAccounts.Where(a => a.LoanRateID == rate.LoanRateID).ToList();

                    Ledger? loanLedger = rate.LoanLedgerID.HasValue && ledgers.TryGetValue(rate.LoanLedgerID.Value, out var ll) ? ll : null;
                    Ledger? intLedger = rate.ReceivableInterestLedgerID.HasValue && ledgers.TryGetValue(rate.ReceivableInterestLedgerID.Value, out var il) ? il : null;

                    decimal glOpening = loanLedger?.OpeningBalance ?? 0m;
                    string glBalanceType = loanLedger?.OpeningBalanceType ?? "Dr";
                    decimal slPrincipal = rateAccounts.Sum(a => a.PrincipalBalance);
                    decimal slPure = rateAccounts.Sum(a => a.PurePrincipalBalance > 0 ? a.PurePrincipalBalance : a.PrincipalBalance);
                    decimal slCap = rateAccounts.Sum(a => a.CapitalizedInterestAmount);
                    int count = rateAccounts.Count;

                    decimal diff = glOpening - slPrincipal;
                    string status;
                    string msg;

                    if (loanLedger == null)
                    {
                        status = "NoLedger";
                        msg = "या कर्ज योजनेला खतावणी (GL) लेजर जोडलेले नाही!";
                    }
                    else if (Math.Abs(diff) < 0.01m)
                    {
                        status = "Reconciled";
                        msg = "खतावणी व उप-खाती तंतोतंत जुळली आहेत (100% Reconciled). तेरीज पत्रक संतुलित राहील.";
                    }
                    else if (diff > 0)
                    {
                        status = "Pending";
                        msg = $"खतावणीत शिल्लक जास्त आहे. अजून ₹ {diff:N2} मुद्दलाची उप-खाती नोंदवणे बाकी आहे.";
                    }
                    else
                    {
                        status = "Excess";
                        msg = $"अति-नोंदणी! नोंदवलेली उप-खाती बेरीज खतावणीपेक्षा ₹ {Math.Abs(diff):N2} ने जास्त झाली आहे.";
                    }

                    // Interest
                    decimal glIntOpening = intLedger?.OpeningBalance ?? 0m;
                    decimal slIntTotal = rateAccounts.Sum(a => a.InterestBalance + a.OverdueInterestBalance);
                    decimal intDiff = glIntOpening - slIntTotal;
                    string intStatus = intLedger == null ? "NoLedger" : (Math.Abs(intDiff) < 0.01m ? "Reconciled" : (intDiff > 0 ? "Pending" : "Excess"));

                    schemeSummaries.Add(new LoanGlReconciliationDto
                    {
                        BranchID = branchId,
                        LoanRateID = rate.LoanRateID,
                        SchemeName = rate.LoanType,
                        LoanCode = rate.LoanCode,
                        LoanLedgerID = rate.LoanLedgerID,
                        LoanLedgerName = loanLedger?.LedgerName ?? "लेजर जोडलेले नाही",
                        GlPrincipalOpeningBalance = glOpening,
                        GlOpeningBalanceType = glBalanceType,
                        SlTotalPrincipalBalance = slPrincipal,
                        SlTotalPurePrincipal = slPure,
                        SlTotalCapitalizedInterest = slCap,
                        TotalAccountsCount = count,
                        PrincipalDifference = diff,
                        PrincipalStatus = status,
                        StatusMessage = msg,
                        ReceivableInterestLedgerID = rate.ReceivableInterestLedgerID,
                        ReceivableInterestLedgerName = intLedger?.LedgerName ?? "लेजर जोडलेले नाही",
                        GlInterestOpeningBalance = glIntOpening,
                        SlTotalInterestBalance = slIntTotal,
                        InterestDifference = intDiff,
                        InterestStatus = intStatus
                    });
                }

                // If specific loanRateId requested
                LoanGlReconciliationDto currentSummary;
                if (targetLoanRateId > 0)
                {
                    currentSummary = schemeSummaries.FirstOrDefault(s => s.LoanRateID == targetLoanRateId)
                        ?? new LoanGlReconciliationDto
                        {
                            BranchID = branchId,
                            LoanRateID = targetLoanRateId,
                            SchemeName = "निवडलेली योजना सापडली नाही",
                            StatusMessage = "योजना उपलब्ध नाही",
                            PrincipalStatus = "NoLedger"
                        };
                }
                else
                {
                    // Overall branch aggregate across all distinct ledgers and accounts
                    decimal totalGl = ledgers.Values
                        .Where(l => allRates.Any(r => r.LoanLedgerID == l.LedgerID))
                        .Sum(l => l.OpeningBalance);
                    decimal totalSl = schemeSummaries.Sum(s => s.SlTotalPrincipalBalance);
                    decimal totalPure = schemeSummaries.Sum(s => s.SlTotalPurePrincipal);
                    decimal totalCap = schemeSummaries.Sum(s => s.SlTotalCapitalizedInterest);
                    int totalCount = schemeSummaries.Sum(s => s.TotalAccountsCount);
                    decimal totalDiff = totalGl - totalSl;

                    string overallStatus = Math.Abs(totalDiff) < 0.01m ? "Reconciled" : (totalDiff > 0 ? "Pending" : "Excess");
                    string overallMsg = Math.Abs(totalDiff) < 0.01m
                        ? "संस्थेच्या सर्व कर्ज योजनांचा खतावणी व उप-खाती मेळ तंतोतंत जुळला आहे (100% Reconciled)."
                        : (totalDiff > 0
                            ? $"संस्थेच्या खतावणीनुसार एकूण ₹ {totalDiff:N2} शिल्लक अजून नोंदवणे बाकी आहे."
                            : $"संस्थेच्या उप-खात्यांची बेरीज खतावणीपेक्षा ₹ {Math.Abs(totalDiff):N2} ने जास्त झाली आहे!");

                    decimal totalGlInt = ledgers.Values
                        .Where(l => allRates.Any(r => r.ReceivableInterestLedgerID == l.LedgerID))
                        .Sum(l => l.OpeningBalance);
                    decimal totalSlInt = schemeSummaries.Sum(s => s.SlTotalInterestBalance);
                    decimal totalIntDiff = totalGlInt - totalSlInt;

                    currentSummary = new LoanGlReconciliationDto
                    {
                        BranchID = branchId,
                        LoanRateID = 0,
                        SchemeName = "सर्व कर्ज योजना (All Loan Schemes)",
                        LoanLedgerName = "सर्व कर्ज लेजर्स एकत्र",
                        GlPrincipalOpeningBalance = totalGl,
                        SlTotalPrincipalBalance = totalSl,
                        SlTotalPurePrincipal = totalPure,
                        SlTotalCapitalizedInterest = totalCap,
                        TotalAccountsCount = totalCount,
                        PrincipalDifference = totalDiff,
                        PrincipalStatus = overallStatus,
                        StatusMessage = overallMsg,
                        GlInterestOpeningBalance = totalGlInt,
                        SlTotalInterestBalance = totalSlInt,
                        InterestDifference = totalIntDiff,
                        InterestStatus = Math.Abs(totalIntDiff) < 0.01m ? "Reconciled" : (totalIntDiff > 0 ? "Pending" : "Excess")
                    };
                }

                return Ok(new LoanGlReconciliationResponseDto
                {
                    Summary = currentSummary,
                    Schemes = schemeSummaries.OrderBy(s => s.LoanCode).ToList()
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, "खतावणी जुळवणी माहिती मिळवताना त्रुटी आली: " + ex.Message);
            }
        }

        // PUT: api/LoanAccounts/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutLoanAccount(int id, LoanAccount loanAccount)
        {
            if (id != loanAccount.LoanAccountID)
            {
                return BadRequest();
            }

            _context.Entry(loanAccount).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!LoanAccountExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        private async Task PerformLoanAccountCascadeDeleteAsync(LoanAccount loanAccount)
        {
            int id = loanAccount.LoanAccountID;

            // 1. Delete Collateral Compliance Logs
            var collateralLogs = _context.CollateralComplianceLogs.Where(c => c.LoanAccountID == id);
            _context.CollateralComplianceLogs.RemoveRange(collateralLogs);

            // 2. Delete NPA Statuses
            var npaStatuses = _context.LoanAccountNpaStatuses.Where(s => s.LoanAccountID == id);
            _context.LoanAccountNpaStatuses.RemoveRange(npaStatuses);

            // 3. Delete Overdue Ledgers
            var overdueInterest = _context.OverdueInterestLedgers.Where(o => o.LoanAccountID == id);
            _context.OverdueInterestLedgers.RemoveRange(overdueInterest);

            var overdueRecovery = _context.OverdueRecoveryLedgers.Where(o => o.LoanAccountID == id);
            _context.OverdueRecoveryLedgers.RemoveRange(overdueRecovery);

            // 4. Delete Loan Documents
            var loanDocs = _context.LoanDocuments.Where(d => d.LoanAccountID == id);
            _context.LoanDocuments.RemoveRange(loanDocs);

            // 5. Delete Gold Loan Details
            var goldLoanDetails = _context.GoldLoanDetails.Where(g => g.LoanAccountID == id);
            _context.GoldLoanDetails.RemoveRange(goldLoanDetails);

            // 6. Delete Collections & Collection Fees
            var collectionIds = await _context.LoanCollections
                .Where(c => c.LoanAccountID == id)
                .Select(c => c.LoanCollectionID)
                .ToListAsync();

            if (collectionIds.Any())
            {
                var collectionFees = _context.LoanCollectionFees
                    .Where(f => collectionIds.Contains(f.LoanCollectionID));
                _context.LoanCollectionFees.RemoveRange(collectionFees);
            }

            var collections = _context.LoanCollections.Where(c => c.LoanAccountID == id);
            _context.LoanCollections.RemoveRange(collections);

            // 8. Delete Schedules
            var schedules = _context.LoanInstallmentSchedules.Where(s => s.LoanAccountID == id);
            _context.LoanInstallmentSchedules.RemoveRange(schedules);

            // 9. Delete Disbursement Deductions & Disbursements
            var disbursementIds = await _context.LoanDisbursements
                .Where(d => d.LoanAccountID == id)
                .Select(d => d.LoanDisbursementID)
                .ToListAsync();

            if (disbursementIds.Any())
            {
                var deductions = _context.LoanDisbursementDeductions
                    .Where(dd => disbursementIds.Contains(dd.LoanDisbursementID));
                _context.LoanDisbursementDeductions.RemoveRange(deductions);
            }

            var disbursements = _context.LoanDisbursements.Where(d => d.LoanAccountID == id);
            _context.LoanDisbursements.RemoveRange(disbursements);

            // 9b. Delete associated GoldLoanDetails
            var goldDetails = await _context.GoldLoanDetails.Where(g => g.LoanAccountID == id).ToListAsync();
            if (goldDetails.Any())
            {
                _context.GoldLoanDetails.RemoveRange(goldDetails);
            }

            // 9c. Release Liens on Deposit Collaterals & Clean Up
            var linkedCollaterals = await _context.LoanDepositCollaterals
                .Where(c => c.LoanAccountID == id)
                .ToListAsync();

            if (linkedCollaterals.Any())
            {
                var (delAuditId, delAuditName, _) = GetAuditContext();
                foreach (var col in linkedCollaterals)
                {
                    if (col.CollateralType == "FixedDeposit")
                    {
                        var fd = await _context.FdAccounts.FindAsync(col.DepositAccountID);
                        if (fd != null && (fd.LienLoanAccountNo == loanAccount.LoanAccountNo || fd.IsLienMarked))
                        {
                            fd.IsLienMarked = false;
                            fd.LienLoanAccountNo = null;
                            fd.LienAmount = 0;
                            _context.Entry(fd).State = EntityState.Modified;
                        }
                    }
                    else if (col.CollateralType == "PigmyDeposit")
                    {
                        var pg = await _context.PigmyAccounts.FindAsync(col.DepositAccountID);
                        if (pg != null && (pg.LienLoanAccountNo == loanAccount.LoanAccountNo || pg.IsLienMarked))
                        {
                            pg.IsLienMarked = false;
                            pg.LienLoanAccountNo = null;
                            pg.LienAmount = 0;
                            _context.Entry(pg).State = EntityState.Modified;
                        }
                    }
                    else if (col.CollateralType == "RecurringDeposit")
                    {
                        var rd = await _context.RdAccounts.FindAsync(col.DepositAccountID);
                        if (rd != null && (rd.LienLoanAccountNo == loanAccount.LoanAccountNo || rd.IsLienMarked))
                        {
                            rd.IsLienMarked = false;
                            rd.LienLoanAccountNo = null;
                            rd.LienAmount = 0;
                            _context.Entry(rd).State = EntityState.Modified;
                        }
                    }
                    else if (col.CollateralType == "SavingDeposit")
                    {
                        var sav = await _context.SavingAccountMasters.FindAsync(col.DepositAccountID);
                        if (sav != null && sav.LienReason != null && sav.LienReason.Contains(loanAccount.LoanAccountNo ?? ""))
                        {
                            sav.LienAmount = 0;
                            sav.LienReason = null;
                            _context.Entry(sav).State = EntityState.Modified;
                        }
                    }

                    _context.AuditLogs.Add(new AuditLog
                    {
                        UserID = delAuditId,
                        Username = delAuditName,
                        Action = "COLLATERAL_LIEN_RELEASED_ON_LOAN_DELETE",
                        EntityName = "LoanDepositCollateral",
                        EntityID = col.CollateralID.ToString(),
                        Timestamp = DateTime.Now,
                        Details = $"कर्ज खाते क्र. {loanAccount.LoanAccountNo} डिलीट केल्यामुळे {col.CollateralType} ठेव खाते क्र. {col.DepositAccountNo} वरील ₹{col.LienAmount} चा तारण बोजा आपोआप मोकळा केला.",
                        Status = "Success"
                    });

                    if (col.LoanApplicationID.HasValue)
                    {
                        col.LoanAccountID = null;
                        col.LienStatus = "Pledged";
                        col.LienMarkedDate = null;
                        _context.Entry(col).State = EntityState.Modified;
                    }
                    else
                    {
                        _context.LoanDepositCollaterals.Remove(col);
                    }
                }
            }

            // 10. De-link any Loan Application
            if (!string.IsNullOrEmpty(loanAccount.LoanAccountNo))
            {
                var linkedApps = await _context.LoanApplications
                    .Where(a => a.LoanAccountNo == loanAccount.LoanAccountNo)
                    .ToListAsync();
                foreach (var app in linkedApps)
                {
                    app.LoanAccountNo = null;
                }
            }

            // Forensic Audit Log for Loan Account Deletion
            var (deleteUserId, deleteUsername, deleteIp) = GetAuditContext();
            _context.AuditLogs.Add(new AuditLog
            {
                UserID = deleteUserId,
                Username = deleteUsername,
                Action = loanAccount.IsOpeningBalance ? "LOAN_OPENING_BALANCE_DELETED" : "LOAN_ACCOUNT_DELETED",
                EntityName = "LoanAccount",
                EntityID = loanAccount.LoanAccountID.ToString(),
                Timestamp = DateTime.Now,
                IPAddress = deleteIp,
                Details = $"Loan Account DELETED: A/C {loanAccount.LoanAccountNo} (ID: {loanAccount.LoanAccountID}). Principal: ₹{loanAccount.PrincipalBalance:N2}, PurePrincipal: ₹{loanAccount.PurePrincipalBalance:N2}, Int: ₹{loanAccount.InterestBalance:N2}, NPA: {loanAccount.InitialNpaClassification}, OpeningDate: {loanAccount.OpeningDate:yyyy-MM-dd}. Operator: {deleteUsername} (IP: {deleteIp})"
            });
            await _context.SaveChangesAsync();

            // 11. Delete the Loan Account itself
            _context.LoanAccounts.Remove(loanAccount);
            await _context.SaveChangesAsync();

            // If the deleted record was the highest/only LoanAccountID, automatically decrement/reseed identity counter
            try
            {
                var maxRemainingId = await _context.LoanAccounts.MaxAsync(l => (int?)l.LoanAccountID) ?? 0;
                if (id >= maxRemainingId)
                {
                    int reseedVal = maxRemainingId;
                    await _context.Database.ExecuteSqlInterpolatedAsync($"DBCC CHECKIDENT ('LoanAccounts', RESEED, {reseedVal});");
                }
            }
            catch (Exception reseedEx)
            {
                Console.WriteLine($"[WARNING] LoanAccount reseed error: {reseedEx.Message}");
            }
        }

        // DELETE: api/LoanAccounts/by-no/HQ0200004
        [HttpDelete("by-no/{accountNo}")]
        public async Task<IActionResult> DeleteLoanAccountByNo(string accountNo)
        {
            var loanAccount = await _context.LoanAccounts.FirstOrDefaultAsync(l => l.LoanAccountNo == accountNo);
            if (loanAccount == null)
            {
                return NotFound($"खाते क्रमांक {accountNo} सापडले नाही.");
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                await PerformLoanAccountCascadeDeleteAsync(loanAccount);
                await transaction.CommitAsync();
                return Ok(new { message = $"खाते क्रमांक {accountNo} यशस्वीरित्या डिलीट करण्यात आले आहे." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "Internal server error: " + ex.Message);
            }
        }

        // DELETE: api/LoanAccounts/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteLoanAccount(int id)
        {
            var loanAccount = await _context.LoanAccounts.FindAsync(id);
            if (loanAccount == null)
            {
                return NotFound();
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                await PerformLoanAccountCascadeDeleteAsync(loanAccount);
                await transaction.CommitAsync();
                return NoContent();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "Internal server error: " + ex.Message);
            }
        }

        [HttpPost("PreviewSchedule")]
        public async Task<ActionResult<List<OpeningBalanceScheduleDto>>> PreviewSchedule(LoanSchedulePreviewRequest request)
        {
            var loanRate = await _context.LoanRates.FindAsync(request.LoanRateID);
            if (loanRate == null)
            {
                return BadRequest("Invalid LoanRateID");
            }

            var scheduleList = Services.LoanScheduleGenerator.GeneratePreviewSchedule(request, loanRate);
            return Ok(scheduleList);
        }

        private bool LoanAccountExists(int id)
        {
            return _context.LoanAccounts.Any(e => e.LoanAccountID == id);
        }

        // POST: api/LoanAccounts/Import
        [HttpPost("Import")]
        public async Task<IActionResult> ImportLoans([FromBody] List<LoanImportRowDto> rows)
        {
            if (rows == null || !rows.Any())
                return BadRequest("No rows provided for import.");

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                int successCount = 0;
                var errors = new List<string>();

                foreach (var row in rows)
                {
                    // 1. Map Member by CIFNo
                    var customer = await _context.Customers.FirstOrDefaultAsync(c => c.CIFNo == row.CIFNo);
                    var member = customer != null ? await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.CustomerID == customer.CustomerID) : null;
                    if (member == null)
                    {
                        errors.Add($"Row with Loan {row.LoanAccountNo}: Member not found for CIFNo '{row.CIFNo}'.");
                        continue;
                    }

                    // 2. Map LoanRate by SchemeName
                    var loanRate = await _context.LoanRates.FirstOrDefaultAsync(r => r.LoanType == row.SchemeName);
                    if (loanRate == null)
                    {
                        errors.Add($"Row with Loan {row.LoanAccountNo}: Scheme '{row.SchemeName}' not found.");
                        continue;
                    }

                    // 3. Check if LoanAccountNo already exists
                    if (await _context.LoanAccounts.AnyAsync(l => l.LoanAccountNo == row.LoanAccountNo))
                    {
                        errors.Add($"Row with Loan {row.LoanAccountNo}: Account number already exists.");
                        continue;
                    }

                    // 4. Create LoanAccount
                    var loanAccount = new LoanAccount
                    {
                        BranchID = 1, // Default branch
                        MemberID = member.MemberID,
                        LoanRateID = loanRate.LoanRateID,
                        LoanAccountNo = row.LoanAccountNo,
                        OpeningDate = row.OpeningDate,
                        LoanDisbursementDate = row.OpeningDate,
                        FirstInstallmentDate = row.FirstInstallmentDate,
                        SanctionedAmount = row.SanctionedAmount,
                        PrincipalBalance = row.PrincipalBalance,
                        InterestBalance = row.InterestBalance,
                        OverdueInterestBalance = row.OverdueInterestBalance,
                        DurationMonths = row.DurationMonths,
                        InterestRate = row.InterestRate,
                        InstallmentAmount = row.InstallmentAmount,
                        InstallmentFrequency = row.InstallmentFrequency,
                        NoOfInstallments = row.NoOfInstallments,
                        IsOpeningBalance = true,
                        Status = "Active"
                    };

                    _context.LoanAccounts.Add(loanAccount);
                    await _context.SaveChangesAsync(); // To get the ID

                    // 5. Create Dummy Disbursement (No voucher)
                    var disbursement = new LoanDisbursement
                    {
                        LoanAccountID = loanAccount.LoanAccountID,
                        DisbursementDate = loanAccount.OpeningDate,
                        SanctionedAmount = loanAccount.SanctionedAmount,
                        DisbursementAmount = loanAccount.SanctionedAmount,
                        NetAmountPaid = loanAccount.SanctionedAmount,
                        PaymentMode = "Opening Balance",
                        Remarks = "Imported Opening Balance",
                        LoanInstallmentType = loanRate.LoanInstallmentType
                    };
                    _context.LoanDisbursements.Add(disbursement);
                    await _context.SaveChangesAsync();

                    // 6. Generate Schedule
                    var schedules = Services.LoanScheduleGenerator.GenerateSchedules(loanAccount, loanRate);
                    if (schedules.Any())
                    {
                        _context.LoanInstallmentSchedules.AddRange(schedules);
                        await _context.SaveChangesAsync();
                    }

                    successCount++;
                }

                if (errors.Any() && successCount == 0)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(new { message = "Import failed. No valid rows found.", errors });
                }

                await transaction.CommitAsync();
                return Ok(new { message = $"Successfully imported {successCount} loans.", errors });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        public static decimal GetEffectiveInterestBearingPrincipal(LoanAccount acc)
        {
            if (!acc.ChargeInterestOnCapitalizedAmount && acc.PurePrincipalBalance > 0)
            {
                return Math.Max(0m, Math.Min(acc.PurePrincipalBalance, acc.PrincipalBalance));
            }
            return Math.Max(0m, acc.PrincipalBalance);
        }

        // POST: api/LoanAccounts/PreviewInterestPosting
        [HttpPost("PreviewInterestPosting")]
        public async Task<IActionResult> PreviewInterestPosting([FromBody] LoanInterestPostingRequestDto request)
        {
            var query = _context.LoanAccounts
                .Include(l => l.Customer)
                .Include(l => l.Member)
                .Include(l => l.LoanRate)
                .Where(l => l.BranchID == request.BranchID && l.Status == "Active" && l.PrincipalBalance > 0)
                .Where(l => (l.LoanDisbursementDate.HasValue ? l.LoanDisbursementDate.Value.Date <= request.PostingDate.Date : l.OpeningDate.Date <= request.PostingDate.Date));

            if (request.LoanRateID.HasValue && request.LoanRateID.Value > 0)
            {
                query = query.Where(l => l.LoanRateID == request.LoanRateID.Value);
            }

            var activeAccounts = await query.ToListAsync();
            var items = new List<LoanInterestPostingItemDto>();

            var schemeRateIds = activeAccounts.Where(a => a.LoanRateID > 0).Select(a => a.LoanRateID).Distinct().ToList();
            var schemeRates = await _context.LoanRates
                .Where(r => schemeRateIds.Contains(r.LoanRateID))
                .ToDictionaryAsync(r => r.LoanRateID);

            var ledgerIdsToFetch = new HashSet<int>();
            foreach (var r in schemeRates.Values)
            {
                if (r.LoanLedgerID.HasValue && r.LoanLedgerID.Value > 0) ledgerIdsToFetch.Add(r.LoanLedgerID.Value);
                if (r.ReceivableInterestLedgerID.HasValue && r.ReceivableInterestLedgerID.Value > 0) ledgerIdsToFetch.Add(r.ReceivableInterestLedgerID.Value);
            }
            var ledgerDict = await _context.Ledgers
                .Where(l => ledgerIdsToFetch.Contains(l.LedgerID))
                .ToDictionaryAsync(l => l.LedgerID, l => l.LedgerName);

            foreach (var acc in activeAccounts)
            {
                DateTime lastDate = acc.LastInstallmentPaidDate ?? acc.LoanDisbursementDate ?? acc.OpeningDate;
                int daysAccrued = Math.Max(0, (request.PostingDate.Date - lastDate.Date).Days);
                decimal rate = acc.LoanRate?.InterestRate ?? acc.InterestRate;
                decimal effectivePrincipal = GetEffectiveInterestBearingPrincipal(acc);

                // Daily simple interest calculation based on accrued days
                decimal calculatedInterest = daysAccrued > 0
                    ? Math.Round((effectivePrincipal * rate * daysAccrued) / 36500m, 2, MidpointRounding.AwayFromZero)
                    : 0m;

                var currentRate = acc.LoanRate ?? (schemeRates.TryGetValue(acc.LoanRateID, out var sr) ? sr : null);
                bool isSchemeCapitalize = currentRate?.InterestPostingType == "कर्जावर" || currentRate?.InterestPostingType?.Contains("कर्ज") == true;
                bool shouldCapitalize = request.PostingMode == "ForceCapitalize" 
                    ? true 
                    : (request.PostingMode == "ForceSeparate" 
                        ? false 
                        : (request.CapitalizeToPrincipal ? true : isSchemeCapitalize));

                decimal newPrincipal = shouldCapitalize ? acc.PrincipalBalance + calculatedInterest : acc.PrincipalBalance;
                decimal newInterest = shouldCapitalize ? acc.InterestBalance : acc.InterestBalance + calculatedInterest;

                int impactedLedgerId = shouldCapitalize 
                    ? (currentRate?.LoanLedgerID ?? 0) 
                    : (currentRate?.ReceivableInterestLedgerID ?? currentRate?.LoanLedgerID ?? 0);
                string impactedLedgerName = impactedLedgerId > 0 && ledgerDict.TryGetValue(impactedLedgerId, out var lName)
                    ? lName
                    : (shouldCapitalize ? "कर्ज मुद्दल खाते" : "येणे व्याज खाते");

                string borrowerName = acc.Customer != null 
                    ? $"{acc.Customer.FirstName} {acc.Customer.LastName}".Trim() 
                    : (acc.Member?.Customer != null ? $"{acc.Member.Customer.FirstName} {acc.Member.Customer.LastName}".Trim() : "N/A");

                items.Add(new LoanInterestPostingItemDto
                {
                    LoanAccountID = acc.LoanAccountID,
                    LoanAccountNo = acc.LoanAccountNo,
                    MemberName = borrowerName,
                    LoanSchemeName = currentRate?.LoanType ?? "कर्ज",
                    PostingType = shouldCapitalize ? "कर्जावर (मुद्दल)" : "येणे व्याजावर (व्याज)",
                    ImpactedLedgerName = impactedLedgerName,
                    CurrentPrincipal = acc.PrincipalBalance,
                    InterestBearingPrincipal = effectivePrincipal,
                    CapitalizedInterestAmount = acc.CapitalizedInterestAmount,
                    ChargeInterestOnCapitalizedAmount = acc.ChargeInterestOnCapitalizedAmount,
                    CurrentInterest = acc.InterestBalance,
                    InterestRate = rate,
                    LastDate = lastDate,
                    DaysAccrued = daysAccrued,
                    CalculatedInterest = calculatedInterest,
                    NewPrincipal = newPrincipal,
                    NewInterest = newInterest
                });
            }

            return Ok(new
            {
                postingDate = request.PostingDate,
                totalAccounts = items.Count,
                totalCalculatedInterest = items.Sum(i => i.CalculatedInterest),
                items
            });
        }

        // POST: api/LoanAccounts/PostInterestBatch
        [HttpPost("PostInterestBatch")]
        public async Task<IActionResult> PostInterestBatch([FromBody] LoanInterestPostingRequestDto request)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var query = _context.LoanAccounts
                    .Include(l => l.Member)
                    .Include(l => l.LoanRate)
                    .Where(l => l.BranchID == request.BranchID && l.Status == "Active" && l.PrincipalBalance > 0)
                    .Where(l => (l.LoanDisbursementDate.HasValue ? l.LoanDisbursementDate.Value.Date <= request.PostingDate.Date : l.OpeningDate.Date <= request.PostingDate.Date));

                if (request.LoanRateID.HasValue && request.LoanRateID.Value > 0)
                {
                    query = query.Where(l => l.LoanRateID == request.LoanRateID.Value);
                }

                var activeAccounts = await query.ToListAsync();
                if (!activeAccounts.Any())
                {
                    return BadRequest("व्याजासाठी कोणतीही सक्रिय कर्ज खाती सापडली नाहीत.");
                }

                var schemeRateIds = activeAccounts.Where(a => a.LoanRateID > 0).Select(a => a.LoanRateID).Distinct().ToList();
                var schemeRates = await _context.LoanRates
                    .Where(r => schemeRateIds.Contains(r.LoanRateID))
                    .ToDictionaryAsync(r => r.LoanRateID);

                // Pre-validate all active schemes have required dynamic ledgers configured
                foreach (var rate in schemeRates.Values)
                {
                    bool isSchemeCapitalize = rate.InterestPostingType == "कर्जावर" || rate.InterestPostingType?.Contains("कर्ज") == true;
                    bool shouldCapitalize = request.PostingMode == "ForceCapitalize" ? true : (request.PostingMode == "ForceSeparate" ? false : (request.CapitalizeToPrincipal ? true : isSchemeCapitalize));

                    int debitLedgerId = shouldCapitalize ? (rate.LoanLedgerID ?? 0) : (rate.ReceivableInterestLedgerID ?? rate.LoanLedgerID ?? 0);
                    int creditLedgerId = rate.InterestLedgerID ?? 0;

                    if (debitLedgerId <= 0)
                    {
                        string missingName = shouldCapitalize ? "कर्ज मुद्दल खाते (Loan Ledger)" : "येणे व्याज खाते (Receivable Interest Ledger)";
                        return BadRequest($"कर्ज योजना '{rate.LoanType}' ला {missingName} जोडलेले नाही. कृपया कर्ज दर पत्रकात लेजर जोडा.");
                    }
                    if (creditLedgerId <= 0)
                    {
                        return BadRequest($"कर्ज योजना '{rate.LoanType}' ला कर्ज व्याज उत्पन्न खाते (Interest Ledger) जोडलेले नाही. कृपया कर्ज दर पत्रकात लेजर जोडा.");
                    }
                }

                decimal totalBatchInterest = 0;
                int processedCount = 0;

                foreach (var acc in activeAccounts)
                {
                    DateTime lastDate = acc.LastInstallmentPaidDate ?? acc.LoanDisbursementDate ?? acc.OpeningDate;
                    int daysAccrued = Math.Max(0, (request.PostingDate.Date - lastDate.Date).Days);
                    if (daysAccrued <= 0) continue;

                    var currentRate = acc.LoanRate ?? (schemeRates.TryGetValue(acc.LoanRateID, out var sr) ? sr : null);
                    decimal rate = currentRate?.InterestRate ?? acc.InterestRate;
                    decimal effectivePrincipal = GetEffectiveInterestBearingPrincipal(acc);
                    decimal calculatedInterest = Math.Round((effectivePrincipal * rate * daysAccrued) / 36500m, 2, MidpointRounding.AwayFromZero);

                    if (calculatedInterest <= 0) continue;

                    bool isSchemeCapitalize = currentRate?.InterestPostingType == "कर्जावर" || currentRate?.InterestPostingType?.Contains("कर्ज") == true;
                    bool shouldCapitalize = request.PostingMode == "ForceCapitalize" ? true : (request.PostingMode == "ForceSeparate" ? false : (request.CapitalizeToPrincipal ? true : isSchemeCapitalize));

                    if (shouldCapitalize)
                    {
                        acc.PrincipalBalance += calculatedInterest;
                    }
                    else
                    {
                        acc.InterestBalance += calculatedInterest;
                    }

                    acc.LastInstallmentPaidDate = request.PostingDate;
                    _context.Entry(acc).State = EntityState.Modified;

                    totalBatchInterest += calculatedInterest;
                    processedCount++;
                }

                if (totalBatchInterest <= 0)
                {
                    return Ok(new { message = "नमुद केलेल्या तारखेपर्यंत नवीन व्याज आकारणी झाली नाही.", processedCount = 0, totalInterest = 0 });
                }

                await _context.SaveChangesAsync();

                // Accounting Voucher Posting (100% Dynamic Scheme-Wise Multi-Line Voucher)
                var branch = await _context.Branches.FindAsync(request.BranchID);
                string branchCode = branch?.BranchCode ?? "HQ";

                var activeYear = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
                string fy = "26-27";
                if (activeYear != null && !string.IsNullOrWhiteSpace(activeYear.YearCode))
                {
                    fy = activeYear.YearCode;
                }

                int count = await _context.Vouchers.CountAsync(v => v.BranchID == request.BranchID && v.VoucherType == "Journal") + 1;
                string voucherNo = $"{branchCode}-JV-{fy}-{count:D5}";

                var voucher = new Voucher
                {
                    BranchID = request.BranchID,
                    VoucherNo = voucherNo,
                    VoucherDate = request.PostingDate,
                    VoucherType = "Journal",
                    Narration = $"बॅच कर्ज व्याज आकारणी (Loan Interest Run): {request.PostingDate:dd/MM/yyyy} - एकूण खाती: {processedCount} {(request.PostingMode == "ForceCapitalize" ? "[सर्व मुद्दलात]" : (request.PostingMode == "ForceSeparate" ? "[सर्व स्वतंत्र येणे व्याजात]" : "[योजनेनुसार स्वयंचलित]"))}",
                    TotalAmount = totalBatchInterest,
                    Status = "Approved",
                    ApprovedBy = 1,
                    ApprovedOn = DateTime.Now
                };
                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();

                // Group by scheme to create exact dynamic debit and credit lines
                var accountsByScheme = activeAccounts
                    .Where(a => a.LoanRateID > 0)
                    .GroupBy(a => a.LoanRateID)
                    .ToList();

                foreach (var group in accountsByScheme)
                {
                    if (!schemeRates.TryGetValue(group.Key, out var rate)) continue;

                    decimal schemeTotal = 0;
                    foreach (var acc in group)
                    {
                        DateTime lastDate = acc.LastInstallmentPaidDate ?? acc.LoanDisbursementDate ?? acc.OpeningDate;
                        int daysAccrued = Math.Max(0, (request.PostingDate.Date - lastDate.Date).Days);
                        if (daysAccrued <= 0) continue;
                        decimal r = rate.InterestRate;
                        decimal effP = GetEffectiveInterestBearingPrincipal(acc);
                        decimal cInt = Math.Round((effP * r * daysAccrued) / 36500m, 2, MidpointRounding.AwayFromZero);
                        schemeTotal += cInt;
                    }

                    if (schemeTotal <= 0) continue;

                    bool isSchemeCapitalize = rate.InterestPostingType == "कर्जावर" || rate.InterestPostingType?.Contains("कर्ज") == true;
                    bool shouldCapitalize = request.PostingMode == "ForceCapitalize" ? true : (request.PostingMode == "ForceSeparate" ? false : (request.CapitalizeToPrincipal ? true : isSchemeCapitalize));

                    int debitLedgerId = shouldCapitalize 
                        ? (rate.LoanLedgerID ?? 0) 
                        : (rate.ReceivableInterestLedgerID ?? rate.LoanLedgerID ?? 0);
                    int creditLedgerId = rate.InterestLedgerID ?? 0;

                    // Debit Scheme Dynamic Ledger (Principal or Receivable Interest)
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = debitLedgerId, DrCr = "Dr", Amount = schemeTotal });
                    // Credit Scheme Dynamic Interest Income Ledger
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = creditLedgerId, DrCr = "Cr", Amount = schemeTotal });
                }

                await _context.SaveChangesAsync();

                // Audit Log
                _context.AuditLogs.Add(new AuditLog
                {
                    UserID = 1,
                    Username = "Manager",
                    Action = "LOAN_INTEREST_POSTING_BATCH",
                    EntityName = "LoanAccount",
                    Timestamp = DateTime.Now,
                    Details = $"Batch Loan Interest Posted: ₹{totalBatchInterest:N2} across {processedCount} accounts on {request.PostingDate:dd/MM/yyyy}. Mode: {request.PostingMode}"
                });

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    message = $"एकूण {processedCount} कर्ज खात्यांवर ₹{totalBatchInterest:N2} व्याज आकारणी यशस्वीरित्या पोस्ट झाली!",
                    processedCount,
                    totalBatchInterest,
                    voucherNo = voucherNo
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest("व्याज आकारणी पोस्ट करताना त्रुटी आली: " + ex.Message);
            }
        }
    }

    public class LoanInterestPostingRequestDto
    {
        public int BranchID { get; set; } = 1;
        public int? LoanRateID { get; set; }
        public DateTime PostingDate { get; set; } = DateTime.Today;
        public bool CapitalizeToPrincipal { get; set; } = false;
        public string PostingMode { get; set; } = "SchemeDefault"; // SchemeDefault, ForceCapitalize, ForceSeparate
        public string? Remarks { get; set; }
    }

    public class LoanInterestPostingItemDto
    {
        public int LoanAccountID { get; set; }
        public string LoanAccountNo { get; set; } = string.Empty;
        public string MemberName { get; set; } = string.Empty;
        public string LoanSchemeName { get; set; } = string.Empty;
        public string PostingType { get; set; } = string.Empty; // कर्जावर (मुद्दल) किंवा येणे व्याजावर (व्याज)
        public string ImpactedLedgerName { get; set; } = string.Empty; // e.g. सोने तारण कर्ज खाते
        public decimal CurrentPrincipal { get; set; }
        public decimal InterestBearingPrincipal { get; set; }
        public decimal CapitalizedInterestAmount { get; set; }
        public bool ChargeInterestOnCapitalizedAmount { get; set; } = true;
        public decimal CurrentInterest { get; set; }
        public decimal InterestRate { get; set; }
        public DateTime LastDate { get; set; }
        public int DaysAccrued { get; set; }
        public decimal CalculatedInterest { get; set; }
        public decimal NewPrincipal { get; set; }
        public decimal NewInterest { get; set; }
    }

    public class LoanImportRowDto
    {
        public string CIFNo { get; set; } = string.Empty;
        public string SchemeName { get; set; } = string.Empty;
        public string LoanAccountNo { get; set; } = string.Empty;
        public DateTime OpeningDate { get; set; }
        public DateTime? FirstInstallmentDate { get; set; }
        public decimal SanctionedAmount { get; set; }
        public decimal PrincipalBalance { get; set; }
        public decimal InterestBalance { get; set; }
        public decimal OverdueInterestBalance { get; set; }
        public int DurationMonths { get; set; }
        public decimal InterestRate { get; set; }
        public decimal InstallmentAmount { get; set; }
        public string InstallmentFrequency { get; set; } = "मासिक (Monthly)";
        public int NoOfInstallments { get; set; }
    }

    public class LoanGlReconciliationDto
    {
        public int BranchID { get; set; } = 1;
        public int LoanRateID { get; set; }
        public string SchemeName { get; set; } = string.Empty;
        public string LoanCode { get; set; } = string.Empty;
        public int? LoanLedgerID { get; set; }
        public string LoanLedgerName { get; set; } = string.Empty;
        public decimal GlPrincipalOpeningBalance { get; set; }
        public string GlOpeningBalanceType { get; set; } = "Dr";
        public decimal SlTotalPrincipalBalance { get; set; }
        public decimal SlTotalPurePrincipal { get; set; }
        public decimal SlTotalCapitalizedInterest { get; set; }
        public int TotalAccountsCount { get; set; }
        public decimal PrincipalDifference { get; set; } // GL - SL
        public string PrincipalStatus { get; set; } = "Pending"; // "Reconciled", "Pending", "Excess", "NoLedger"
        public string StatusMessage { get; set; } = string.Empty;

        // Interest Breakdown
        public int? ReceivableInterestLedgerID { get; set; }
        public string ReceivableInterestLedgerName { get; set; } = string.Empty;
        public decimal GlInterestOpeningBalance { get; set; }
        public decimal SlTotalInterestBalance { get; set; }
        public decimal InterestDifference { get; set; }
        public string InterestStatus { get; set; } = "Pending";
    }

    public class LoanGlReconciliationResponseDto
    {
        public LoanGlReconciliationDto Summary { get; set; } = new();
        public List<LoanGlReconciliationDto> Schemes { get; set; } = new();
    }
}
