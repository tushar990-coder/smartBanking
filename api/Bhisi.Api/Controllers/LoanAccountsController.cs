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
    public class LoanAccountsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LoanAccountsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/LoanAccounts/next-account-no?branchId=1
        [HttpGet("next-account-no")]
        public async Task<ActionResult<string>> GetNextAccountNo([FromQuery] int? branchId = null)
        {
            int targetBranchId = branchId ?? 1;
            var branch = await _context.Branches.FindAsync(targetBranchId);
            string branchCode = branch?.BranchCode ?? "01";
            string prefix = $"{branchCode}02";

            var existingAccNos = await _context.LoanAccounts
                .Where(a => a.BranchID == targetBranchId && a.LoanAccountNo != null && a.LoanAccountNo.StartsWith(prefix))
                .Select(l => l.LoanAccountNo!)
                .ToListAsync();

            int maxSeq = 0;
            foreach (var accNo in existingAccNos)
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

            if (maxSeq == 0 && existingAccNos.Any())
            {
                maxSeq = existingAccNos.Count;
            }

            int nextSeq = maxSeq + 1;
            string nextAccNo = $"{prefix}{nextSeq:D5}";

            while (existingAccNos.Contains(nextAccNo))
            {
                nextSeq++;
                nextAccNo = $"{prefix}{nextSeq:D5}";
            }

            return Content(nextAccNo, "text/plain");
        }

        // GET: api/LoanAccounts
        [HttpGet]
        public async Task<ActionResult<IEnumerable<LoanAccount>>> GetLoanAccounts([FromQuery] int? branchId = null, [FromQuery] int? customerId = null, [FromQuery] int? memberId = null)
        {
            var query = _context.LoanAccounts
                .Include(l => l.Customer)
                .Include(l => l.Member)
                .Include(l => l.CoMember)
                .Include(l => l.CoMember2)
                .Include(l => l.CoCustomer)
                .Include(l => l.CoCustomer2)
                .Include(l => l.LoanRate)
                .Include(l => l.Guarantor1Member)
                .Include(l => l.Guarantor2Member)
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
        [HttpGet("{id}")]
        public async Task<ActionResult<LoanAccount>> GetLoanAccount(int id)
        {
            var loanAccount = await _context.LoanAccounts
                .Include(l => l.Customer)
                .Include(l => l.Member)
                .Include(l => l.CoMember)
                .Include(l => l.CoMember2)
                .Include(l => l.CoCustomer)
                .Include(l => l.CoCustomer2)
                .Include(l => l.LoanRate)
                .Include(l => l.Guarantor1Member)
                .Include(l => l.Guarantor2Member)
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
        [HttpGet("{id}/AccountDetailsAndSchedule")]
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
            if (loanAccount.CoMemberID.HasValue && loanAccount.CoMemberID.Value <= 0) loanAccount.CoMemberID = null;
            if (loanAccount.CoMember2ID.HasValue && loanAccount.CoMember2ID.Value <= 0) loanAccount.CoMember2ID = null;
            if (loanAccount.CoCustomerID.HasValue && loanAccount.CoCustomerID.Value <= 0) loanAccount.CoCustomerID = null;
            if (loanAccount.CoCustomer2ID.HasValue && loanAccount.CoCustomer2ID.Value <= 0) loanAccount.CoCustomer2ID = null;
            if (loanAccount.Guarantor1MemberID.HasValue && loanAccount.Guarantor1MemberID.Value <= 0) loanAccount.Guarantor1MemberID = null;
            if (loanAccount.Guarantor2MemberID.HasValue && loanAccount.Guarantor2MemberID.Value <= 0) loanAccount.Guarantor2MemberID = null;
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
                var branch = await _context.Branches.FindAsync(targetBranchId);
                string branchCode = branch?.BranchCode ?? "01";
                string prefix = $"{branchCode}02";

                var existingAccNos = await _context.LoanAccounts
                    .Where(a => a.BranchID == targetBranchId && a.LoanAccountNo != null && a.LoanAccountNo.StartsWith(prefix))
                    .Select(l => l.LoanAccountNo!)
                    .ToListAsync();

                int maxSeq = 0;
                foreach (var accNo in existingAccNos)
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
                if (maxSeq == 0 && existingAccNos.Any()) maxSeq = existingAccNos.Count;
                int nextSeq = maxSeq + 1;
                string nextAccNo = $"{prefix}{nextSeq:D5}";
                while (existingAccNos.Contains(nextAccNo))
                {
                    nextSeq++;
                    nextAccNo = $"{prefix}{nextSeq:D5}";
                }
                loanAccount.LoanAccountNo = nextAccNo;
            }

            _context.LoanAccounts.Add(loanAccount);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetLoanAccount", new { id = loanAccount.LoanAccountID }, loanAccount);
        }

        // POST: api/LoanAccounts/OpeningBalance
        [HttpPost("OpeningBalance")]
        public async Task<ActionResult<LoanAccount>> PostOpeningBalance(LoanOpeningBalanceDto dto)
        {
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

                var loanAccount = new LoanAccount
                {
                    BranchID = dto.BranchID,
                    CustomerID = customer?.CustomerID ?? (borrower?.CustomerID > 0 ? borrower.CustomerID : null),
                    MemberID = borrower?.MemberID,
                    LoanRateID = dto.LoanRateID,
                    LoanAccountNo = dto.LoanAccountNo,
                    PrincipalBalance = dto.PrincipalBalance,
                    InterestBalance = dto.InterestBalance,
                    OverdueInterestBalance = dto.OverdueInterestBalance,
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
                    Guarantor1MemberID = dto.Guarantor1MemberID > 0 ? dto.Guarantor1MemberID : null,
                    Guarantor2MemberID = dto.Guarantor2MemberID > 0 ? dto.Guarantor2MemberID : null,
                    Guarantor1CustomerID = dto.Guarantor1CustomerID > 0 ? dto.Guarantor1CustomerID : null,
                    Guarantor2CustomerID = dto.Guarantor2CustomerID > 0 ? dto.Guarantor2CustomerID : null,
                    CoCustomerID = dto.CoCustomerID > 0 ? dto.CoCustomerID : null,
                    CoCustomer2ID = dto.CoCustomer2ID > 0 ? dto.CoCustomer2ID : null,
                    CoMemberID = dto.CoMemberID > 0 ? dto.CoMemberID : null,
                    CoMember2ID = dto.CoMember2ID > 0 ? dto.CoMember2ID : null,
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
                    DisbursementAmount = dto.PrincipalBalance,
                    ProcessingFee = 0,
                    ShareDeduction = 0,
                    InsuranceDeduction = 0,
                    StationeryCharges = 0,
                    OtherDeductions = 0,
                    NetAmountPaid = dto.PrincipalBalance,
                    PaymentMode = "Opening Balance",
                    Remarks = "Opening Balance (मागील येणे कर्ज)",
                    LoanInstallmentType = loanRate?.LoanInstallmentType
                };
                _context.LoanDisbursements.Add(disbursement);
                await _context.SaveChangesAsync();

                if (dto.Schedule != null && dto.Schedule.Any())
                {
                    decimal totalPrincipalPaid = dto.SanctionedAmount - dto.PrincipalBalance;
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

                await transaction.CommitAsync();
                return Ok(loanAccount);
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
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var loanAccount = await _context.LoanAccounts.FindAsync(id);
                if (loanAccount == null)
                {
                    return NotFound();
                }

                loanAccount.BranchID = dto.BranchID;
                loanAccount.MemberID = dto.MemberID;
                loanAccount.LoanRateID = dto.LoanRateID;
                loanAccount.LoanAccountNo = dto.LoanAccountNo;
                loanAccount.LegacyAccountNumber = dto.LegacyAccountNumber;
                loanAccount.PrincipalBalance = dto.PrincipalBalance;
                loanAccount.InterestBalance = dto.InterestBalance;
                loanAccount.OverdueInterestBalance = dto.OverdueInterestBalance;
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
                loanAccount.Guarantor1MemberID = dto.Guarantor1MemberID;
                loanAccount.Guarantor2MemberID = dto.Guarantor2MemberID;
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
                disbursement.DisbursementAmount = dto.PrincipalBalance;
                disbursement.NetAmountPaid = dto.PrincipalBalance;
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
                    decimal totalPrincipalPaid = dto.SanctionedAmount - dto.PrincipalBalance;
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

                await transaction.CommitAsync();
                return NoContent();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "Internal server error: " + ex.Message);
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

            foreach (var acc in activeAccounts)
            {
                DateTime lastDate = acc.LastInstallmentPaidDate ?? acc.LoanDisbursementDate ?? acc.OpeningDate;
                int daysAccrued = Math.Max(0, (request.PostingDate.Date - lastDate.Date).Days);
                decimal rate = acc.LoanRate?.InterestRate ?? acc.InterestRate;

                // Daily simple interest calculation based on accrued days
                decimal calculatedInterest = daysAccrued > 0
                    ? Math.Round((acc.PrincipalBalance * rate * daysAccrued) / 36500m, 2, MidpointRounding.AwayFromZero)
                    : 0m;

                decimal newPrincipal = request.CapitalizeToPrincipal ? acc.PrincipalBalance + calculatedInterest : acc.PrincipalBalance;
                decimal newInterest = request.CapitalizeToPrincipal ? acc.InterestBalance : acc.InterestBalance + calculatedInterest;

                string borrowerName = acc.Customer != null 
                    ? $"{acc.Customer.FirstName} {acc.Customer.LastName}".Trim() 
                    : (acc.Member != null ? $"{acc.Member.FirstName} {acc.Member.LastName}".Trim() : "N/A");

                items.Add(new LoanInterestPostingItemDto
                {
                    LoanAccountID = acc.LoanAccountID,
                    LoanAccountNo = acc.LoanAccountNo,
                    MemberName = borrowerName,
                    LoanSchemeName = acc.LoanRate?.LoanType ?? "कर्ज",
                    CurrentPrincipal = acc.PrincipalBalance,
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

                decimal totalBatchInterest = 0;
                int processedCount = 0;

                foreach (var acc in activeAccounts)
                {
                    DateTime lastDate = acc.LastInstallmentPaidDate ?? acc.LoanDisbursementDate ?? acc.OpeningDate;
                    int daysAccrued = Math.Max(0, (request.PostingDate.Date - lastDate.Date).Days);
                    if (daysAccrued <= 0) continue;

                    decimal rate = acc.LoanRate?.InterestRate ?? acc.InterestRate;
                    decimal calculatedInterest = Math.Round((acc.PrincipalBalance * rate * daysAccrued) / 36500m, 2, MidpointRounding.AwayFromZero);

                    if (calculatedInterest <= 0) continue;

                    if (request.CapitalizeToPrincipal)
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

                // Accounting Voucher Posting
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

                // Ledgers
                Ledger? interestIncomeLedger = null;
                Ledger? loanAssetLedger = null;

                if (request.LoanRateID.HasValue && request.LoanRateID.Value > 0)
                {
                    var specificRate = await _context.LoanRates.FindAsync(request.LoanRateID.Value);
                    if (specificRate != null)
                    {
                        if (specificRate.InterestLedgerID.HasValue && specificRate.InterestLedgerID.Value > 0)
                            interestIncomeLedger = await _context.Ledgers.FindAsync(specificRate.InterestLedgerID.Value);
                        if (specificRate.LoanLedgerID.HasValue && specificRate.LoanLedgerID.Value > 0)
                            loanAssetLedger = await _context.Ledgers.FindAsync(specificRate.LoanLedgerID.Value);
                    }
                }

                if (interestIncomeLedger == null)
                {
                    interestIncomeLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("१३० कर्जावरील व्याज") || l.LedgerName.Contains("व्याज उत्पन्न") || l.LedgerName.ToLower().Contains("interest income"))
                        ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("व्याज"));
                }
                
                if (loanAssetLedger == null)
                {
                    loanAssetLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("१२ मुदत कर्ज") || l.LedgerName.Contains("कर्ज") || l.LedgerName.ToLower().Contains("loan receivable"))
                        ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("कर्ज"));
                }

                if (interestIncomeLedger != null && loanAssetLedger != null)
                {
                    var voucher = new Voucher
                    {
                        BranchID = request.BranchID,
                        VoucherNo = voucherNo,
                        VoucherDate = request.PostingDate,
                        VoucherType = "Journal",
                        Narration = $"बॅच कर्ज व्याज आकारणी (Loan Interest Run): {request.PostingDate:dd/MM/yyyy} - एकूण खाती: {processedCount} {(request.CapitalizeToPrincipal ? "[मुद्दलात प्लस]" : "[येणे व्याजात नोंद]")}",
                        TotalAmount = totalBatchInterest
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    // Debit Loan Asset / Receivable
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = loanAssetLedger.LedgerID, DrCr = "Dr", Amount = totalBatchInterest });
                    // Credit Interest Income
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = interestIncomeLedger.LedgerID, DrCr = "Cr", Amount = totalBatchInterest });

                    await _context.SaveChangesAsync();
                }

                // Audit Log
                _context.AuditLogs.Add(new AuditLog
                {
                    UserID = 1,
                    Username = "Manager",
                    Action = "LOAN_INTEREST_POSTING_BATCH",
                    EntityName = "LoanAccount",
                    Timestamp = DateTime.Now,
                    Details = $"Batch Loan Interest Posted: ₹{totalBatchInterest:N2} across {processedCount} accounts on {request.PostingDate:dd/MM/yyyy}. CapitalizeToPrincipal: {request.CapitalizeToPrincipal}"
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
        public string? Remarks { get; set; }
    }

    public class LoanInterestPostingItemDto
    {
        public int LoanAccountID { get; set; }
        public string LoanAccountNo { get; set; } = string.Empty;
        public string MemberName { get; set; } = string.Empty;
        public string LoanSchemeName { get; set; } = string.Empty;
        public decimal CurrentPrincipal { get; set; }
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
}
