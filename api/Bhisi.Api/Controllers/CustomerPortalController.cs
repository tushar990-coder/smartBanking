using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bhisi.Api.Controllers
{
    [Route("api/customer")]
    [ApiController]
    [Authorize(Roles = "CUSTOMER")]
    public class CustomerPortalController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IBusinessDateGuardService? _businessDateGuard;

        public CustomerPortalController(AppDbContext context, IBusinessDateGuardService? businessDateGuard = null)
        {
            _context = context;
            _businessDateGuard = businessDateGuard;
        }

        private DateTime GetIstToday()
        {
            return _businessDateGuard?.GetIstToday()
                ?? DateTime.UtcNow.AddHours(5.5).Date;
        }

        private int ResolveJwtCustomerId()
        {
            var raw = User.FindFirst("CustomerId")?.Value
                ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(raw, out int cid) ? cid : 0;
        }

        // GET /api/customer/summary
        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary()
        {
            int customerId = ResolveJwtCustomerId();
            if (customerId <= 0) return Unauthorized(new { message = "वैध खातेदार टोकन आवश्यक आहे." });

            var customer = await _context.Customers
                .AsNoTracking()
                .Include(c => c.Branch)
                .FirstOrDefaultAsync(c => c.CustomerID == customerId && !c.IsDeleted && c.Status == "Active");

            if (customer == null) return NotFound(new { message = "खातेदार सापडला नाही." });

            decimal pigmyTotal = await _context.PigmyAccounts.AsNoTracking()
                .Where(p => p.CustomerID == customerId && p.Status != "Closed")
                .SumAsync(p => (decimal?)p.TotalDepositedAmount) ?? 0m;
            int pigmyCount = await _context.PigmyAccounts.AsNoTracking()
                .CountAsync(p => p.CustomerID == customerId && p.Status != "Closed");

            decimal savingTotal = await _context.SavingAccountMasters.AsNoTracking()
                .Where(s => s.CustomerID == customerId && s.Status != "Closed")
                .SumAsync(s => (decimal?)s.CurrentBalance) ?? 0m;
            int savingCount = await _context.SavingAccountMasters.AsNoTracking()
                .CountAsync(s => s.CustomerID == customerId && s.Status != "Closed");

            decimal rdTotal = await _context.RdAccounts.AsNoTracking()
                .Where(r => r.CustomerID == customerId && r.Status != "Closed")
                .SumAsync(r => (decimal?)r.TotalDepositedAmount) ?? 0m;
            int rdCount = await _context.RdAccounts.AsNoTracking()
                .CountAsync(r => r.CustomerID == customerId && r.Status != "Closed");

            decimal fdTotal = await _context.FdAccounts.AsNoTracking()
                .Where(f => f.CustomerID == customerId && f.Status != "Closed")
                .SumAsync(f => (decimal?)f.DepositAmount) ?? 0m;
            int fdCount = await _context.FdAccounts.AsNoTracking()
                .CountAsync(f => f.CustomerID == customerId && f.Status != "Closed");

            decimal loanOutstanding = await _context.LoanAccounts.AsNoTracking()
                .Where(l => l.CustomerID == customerId && (l.Status == "Active" || l.Status == "Disbursed"))
                .SumAsync(l => (decimal?)l.PrincipalBalance) ?? 0m;
            int loanCount = await _context.LoanAccounts.AsNoTracking()
                .CountAsync(l => l.CustomerID == customerId && (l.Status == "Active" || l.Status == "Disbursed"));

            return Ok(new
            {
                customerId = customer.CustomerID,
                cifNo = customer.CIFNo ?? string.Empty,
                customerName = customer.FullName,
                mobileNo = customer.MobileNo ?? string.Empty,
                branchName = customer.Branch?.BranchName ?? "Main Branch",
                totalSavingsAndDeposits = pigmyTotal + savingTotal + rdTotal + fdTotal,
                totalLoanOutstanding = loanOutstanding,
                counts = new
                {
                    pigmy = pigmyCount,
                    saving = savingCount,
                    rd = rdCount,
                    fd = fdCount,
                    loan = loanCount
                }
            });
        }

        // GET /api/customer/accounts
        [HttpGet("accounts")]
        public async Task<IActionResult> GetAccounts()
        {
            int customerId = ResolveJwtCustomerId();
            if (customerId <= 0) return Unauthorized(new { message = "वैध खातेदार टोकन आवश्यक आहे." });

            var pigmyAccounts = await _context.PigmyAccounts.AsNoTracking()
                .Include(p => p.PigmyScheme)
                .Include(p => p.PigmyAgent)
                .Where(p => p.CustomerID == customerId)
                .OrderByDescending(p => p.Status == "Active")
                .ThenBy(p => p.PigmyAccountID)
                .Select(p => new
                {
                    accountId = p.PigmyAccountID,
                    productType = "PIGMY",
                    accountNo = p.AccountNo,
                    oldAccountNo = p.OldAccountNo ?? p.LegacyAccountNumber ?? p.PreviousAccountNo ?? string.Empty,
                    schemeName = p.PigmyScheme != null ? p.PigmyScheme.SchemeName : "दैनिक पिग्मी योजना",
                    balance = p.TotalDepositedAmount,
                    targetAmount = p.DailyDepositAmount,
                    interestRate = p.InterestRate,
                    maturityDate = p.MaturityDate.ToString("yyyy-MM-dd"),
                    agentName = p.PigmyAgent != null ? p.PigmyAgent.AgentName : string.Empty,
                    status = p.Status
                })
                .ToListAsync();

            var savingAccounts = await _context.SavingAccountMasters.AsNoTracking()
                .Where(s => s.CustomerID == customerId)
                .OrderByDescending(s => s.Status == "Active")
                .ThenBy(s => s.SavingAccountID)
                .Select(s => new
                {
                    accountId = s.SavingAccountID,
                    productType = "SAVING",
                    accountNo = s.AccountNo,
                    oldAccountNo = s.OldAccountNo ?? s.LegacyAccountNumber ?? string.Empty,
                    schemeName = "बचत खाते (Saving)",
                    balance = s.CurrentBalance,
                    targetAmount = 0m,
                    interestRate = s.InterestRate,
                    maturityDate = (string?)null,
                    agentName = string.Empty,
                    status = s.Status
                })
                .ToListAsync();

            var rdAccounts = await _context.RdAccounts.AsNoTracking()
                .Include(r => r.RdScheme)
                .Where(r => r.CustomerID == customerId)
                .OrderByDescending(r => r.Status == "Active")
                .ThenBy(r => r.RdAccountID)
                .Select(r => new
                {
                    accountId = r.RdAccountID,
                    productType = "RD",
                    accountNo = r.AccountNo,
                    oldAccountNo = r.LegacyAccountNumber ?? string.Empty,
                    schemeName = r.RdScheme != null ? r.RdScheme.SchemeName : "आवर्ती ठेव (RD)",
                    balance = r.TotalDepositedAmount,
                    targetAmount = r.InstallmentAmount,
                    interestRate = r.InterestRate,
                    paidInstallments = r.TotalPaidInstallments,
                    durationMonths = r.DurationMonths,
                    maturityDate = r.MaturityDate.ToString("yyyy-MM-dd"),
                    status = r.Status
                })
                .ToListAsync();

            var fdAccounts = await _context.FdAccounts.AsNoTracking()
                .Include(f => f.FdScheme)
                .Where(f => f.CustomerID == customerId)
                .OrderByDescending(f => f.Status == "Active")
                .ThenBy(f => f.FdAccountID)
                .Select(f => new
                {
                    accountId = f.FdAccountID,
                    productType = "FD",
                    accountNo = f.AccountNo,
                    oldAccountNo = f.LegacyAccountNumber ?? string.Empty,
                    schemeName = f.FdScheme != null ? f.FdScheme.SchemeName : "मुदत ठेव (FD)",
                    balance = f.DepositAmount,
                    maturityAmount = f.MaturityAmount,
                    interestRate = f.InterestRate,
                    maturityDate = f.MaturityDate.ToString("yyyy-MM-dd"),
                    status = f.Status
                })
                .ToListAsync();

            var loanAccounts = await _context.LoanAccounts.AsNoTracking()
                .Include(l => l.LoanRate)
                .Where(l => l.CustomerID == customerId)
                .OrderByDescending(l => l.Status == "Active" || l.Status == "Disbursed")
                .ThenBy(l => l.LoanAccountID)
                .Select(l => new
                {
                    accountId = l.LoanAccountID,
                    productType = "LOAN",
                    accountNo = l.LoanAccountNo ?? $"LN-{l.LoanAccountID}",
                    oldAccountNo = string.Empty,
                    schemeName = l.LoanRate != null ? l.LoanRate.LoanType : "कर्ज खाते",
                    balance = l.PrincipalBalance,
                    targetAmount = l.InstallmentAmount,
                    interestRate = l.InterestRate,
                    maturityDate = l.MaturityDate.HasValue ? l.MaturityDate.Value.ToString("yyyy-MM-dd") : null,
                    status = l.Status
                })
                .ToListAsync();

            return Ok(new
            {
                pigmyAccounts,
                savingAccounts,
                rdAccounts,
                fdAccounts,
                loanAccounts
            });
        }

        // GET /api/customer/passbook/{productType}/{accountId}
        [HttpGet("passbook/{productType}/{accountId:int}")]
        public async Task<IActionResult> GetPassbook(string productType, int accountId)
        {
            int customerId = ResolveJwtCustomerId();
            if (customerId <= 0) return Unauthorized(new { message = "वैध खातेदार टोकन आवश्यक आहे." });

            string type = (productType ?? "").Trim().ToUpperInvariant();

            if (type == "PIGMY")
            {
                var acc = await _context.PigmyAccounts.AsNoTracking()
                    .FirstOrDefaultAsync(p => p.PigmyAccountID == accountId && p.CustomerID == customerId);
                if (acc == null) return NotFound(new { message = "पिग्मी खाते आढळले नाही." });

                var txs = await _context.PigmyTransactions.AsNoTracking()
                    .Where(t => t.PigmyAccountID == accountId)
                    .OrderByDescending(t => t.ValueDate)
                    .ThenByDescending(t => t.PigmyTransactionID)
                    .Take(50)
                    .Select(t => new
                    {
                        id = t.PigmyTransactionID,
                        date = t.ValueDate.ToString("dd-MM-yyyy"),
                        type = t.TransactionType,
                        crAmount = t.CrAmount,
                        drAmount = t.DrAmount,
                        balance = t.BalanceAmount,
                        narration = t.Narration,
                        reference = t.ReferenceId ?? string.Empty
                    })
                    .ToListAsync();

                return Ok(new { productType = "PIGMY", accountNo = acc.AccountNo, currentBalance = acc.TotalDepositedAmount, transactions = txs });
            }

            if (type == "SAVING")
            {
                var acc = await _context.SavingAccountMasters.AsNoTracking()
                    .FirstOrDefaultAsync(s => s.SavingAccountID == accountId && s.CustomerID == customerId);
                if (acc == null) return NotFound(new { message = "बचत खाते आढळले नाही." });

                var txs = await _context.SavingTransactions.AsNoTracking()
                    .Where(t => t.SavingAccountID == accountId)
                    .OrderByDescending(t => t.TransactionDate)
                    .ThenByDescending(t => t.TransactionID)
                    .Take(50)
                    .Select(t => new
                    {
                        id = t.TransactionID,
                        date = t.TransactionDate.ToString("dd-MM-yyyy"),
                        type = t.TransactionType,
                        crAmount = t.TransactionType == "Deposit" || t.TransactionType == "Interest" ? t.Amount : 0m,
                        drAmount = t.TransactionType == "Withdrawal" || t.TransactionType == "Charges" ? t.Amount : 0m,
                        balance = t.BalanceAfterTxn,
                        narration = t.Narration ?? t.TransactionType,
                        reference = t.VoucherNo ?? string.Empty
                    })
                    .ToListAsync();

                return Ok(new { productType = "SAVING", accountNo = acc.AccountNo, currentBalance = acc.CurrentBalance, transactions = txs });
            }

            if (type == "RD")
            {
                var acc = await _context.RdAccounts.AsNoTracking()
                    .FirstOrDefaultAsync(r => r.RdAccountID == accountId && r.CustomerID == customerId);
                if (acc == null) return NotFound(new { message = "आवर्ती ठेव (RD) खाते आढळले नाही." });

                var txs = await _context.RdTransactions.AsNoTracking()
                    .Where(t => t.RdAccountID == accountId)
                    .OrderByDescending(t => t.TransactionDate)
                    .ThenByDescending(t => t.RdTransactionID)
                    .Take(50)
                    .Select(t => new
                    {
                        id = t.RdTransactionID,
                        date = t.TransactionDate.ToString("dd-MM-yyyy"),
                        type = t.TransactionType,
                        crAmount = t.DebitCredit == "Cr" ? t.PrincipalAmount : 0m,
                        drAmount = t.DebitCredit == "Dr" ? t.PrincipalAmount : 0m,
                        balance = t.BalanceAfterTxn ?? 0m,
                        narration = t.Narration ?? t.TransactionType,
                        reference = t.InstallmentNo.HasValue ? $"हप्ता #{t.InstallmentNo.Value}" : string.Empty
                    })
                    .ToListAsync();

                return Ok(new { productType = "RD", accountNo = acc.AccountNo, currentBalance = acc.TotalDepositedAmount, transactions = txs });
            }

            if (type == "LOAN")
            {
                var acc = await _context.LoanAccounts.AsNoTracking()
                    .FirstOrDefaultAsync(l => l.LoanAccountID == accountId && l.CustomerID == customerId);
                if (acc == null) return NotFound(new { message = "कर्ज खाते आढळले नाही." });

                var rawTxs = await _context.LoanCollections.AsNoTracking()
                    .Include(t => t.Fees!)
                        .ThenInclude(f => f.Ledger)
                    .Where(t => t.LoanAccountID == accountId)
                    .OrderByDescending(t => t.CollectionDate)
                    .ThenByDescending(t => t.LoanCollectionID)
                    .Take(50)
                    .ToListAsync();

                var txs = rawTxs.Select(t =>
                {
                    decimal feesTotal = t.Fees?.Sum(f => f.Amount) ?? 0m;
                    return new
                    {
                        id = t.LoanCollectionID,
                        date = t.CollectionDate.ToString("dd-MM-yyyy"),
                        type = "EMI",
                        crAmount = t.TotalAmountReceived + feesTotal,
                        drAmount = 0m,
                        balance = 0m,
                        narration = feesTotal > 0
                            ? $"मुद्दल ₹{t.PrincipalCollected:N0} + व्याज ₹{t.InterestCollected:N0} + इतर फी ₹{feesTotal:N0}"
                            : $"मुद्दल ₹{t.PrincipalCollected:N0} + व्याज ₹{t.InterestCollected:N0}",
                        reference = t.ReceiptNo ?? string.Empty
                    };
                }).ToList();

                return Ok(new { productType = "LOAN", accountNo = acc.LoanAccountNo ?? $"LN-{acc.LoanAccountID}", currentBalance = acc.PrincipalBalance, transactions = txs });
            }

            return BadRequest(new { message = "अवैध खाते प्रकार (Unsupported product type)." });
        }

        // GET /api/customer/full-portal
        [HttpGet("full-portal")]
        public async Task<IActionResult> GetFullPortal()
        {
            int customerId = ResolveJwtCustomerId();
            if (customerId <= 0) return Unauthorized(new { message = "वैध खातेदार टोकन आवश्यक आहे." });

            var customer = await _context.Customers.AsNoTracking()
                .Include(c => c.Branch)
                .Include(c => c.MemberProfile)
                .FirstOrDefaultAsync(c => c.CustomerID == customerId && !c.IsDeleted && c.Status == "Active");

            if (customer == null) return NotFound(new { message = "खातेदार सापडला नाही." });

            DateTime today = GetIstToday();

            // 1. Enriched 5 Account Types
            var pigmyRaw = await _context.PigmyAccounts.AsNoTracking()
                .Include(p => p.PigmyScheme)
                .Include(p => p.PigmyAgent!).ThenInclude(a => a.Customer)
                .Where(p => p.CustomerID == customerId)
                .OrderByDescending(p => p.Status == "Active")
                .ThenBy(p => p.PigmyAccountID)
                .ToListAsync();

            var savingRaw = await _context.SavingAccountMasters.AsNoTracking()
                .Where(s => s.CustomerID == customerId)
                .OrderByDescending(s => s.Status == "Active")
                .ThenBy(s => s.SavingAccountID)
                .ToListAsync();

            var rdRaw = await _context.RdAccounts.AsNoTracking()
                .Include(r => r.RdScheme)
                .Where(r => r.CustomerID == customerId)
                .OrderByDescending(r => r.Status == "Active")
                .ThenBy(r => r.RdAccountID)
                .ToListAsync();

            var fdRaw = await _context.FdAccounts.AsNoTracking()
                .Include(f => f.FdScheme)
                .Where(f => f.CustomerID == customerId)
                .OrderByDescending(f => f.Status == "Active")
                .ThenBy(f => f.FdAccountID)
                .ToListAsync();

            var loanRaw = await _context.LoanAccounts.AsNoTracking()
                .Include(l => l.LoanRate)
                .Where(l => l.CustomerID == customerId)
                .OrderByDescending(l => l.Status == "Active" || l.Status == "Disbursed")
                .ThenBy(l => l.LoanAccountID)
                .ToListAsync();

            var loanIds = loanRaw.Select(l => l.LoanAccountID).ToList();
            var rdIds = rdRaw.Select(r => r.RdAccountID).ToList();
            var pigmyIds = pigmyRaw.Select(p => p.PigmyAccountID).ToList();
            var savingIds = savingRaw.Select(s => s.SavingAccountID).ToList();

            var pendingLoanScheds = loanIds.Count > 0
                ? await _context.LoanInstallmentSchedules.AsNoTracking()
                    .Where(s => loanIds.Contains(s.LoanAccountID) && s.Status != "Paid")
                    .OrderBy(s => s.DueDate)
                    .ToListAsync()
                : new List<LoanInstallmentSchedule>();

            var paidLoanCounts = loanIds.Count > 0
                ? await _context.LoanInstallmentSchedules.AsNoTracking()
                    .Where(s => loanIds.Contains(s.LoanAccountID) && s.Status == "Paid")
                    .GroupBy(s => s.LoanAccountID)
                    .Select(g => new { LoanAccountID = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.LoanAccountID, x => x.Count)
                : new Dictionary<int, int>();

            var pendingRdScheds = rdIds.Count > 0
                ? await _context.RDInstallmentSchedules.AsNoTracking()
                    .Where(s => rdIds.Contains(s.RdAccountID) && s.Status != "Paid")
                    .OrderBy(s => s.DueDate)
                    .ToListAsync()
                : new List<RdInstallmentSchedule>();

            var pigmyAccounts = pigmyRaw.Select(p => new
            {
                accountId = p.PigmyAccountID,
                productType = "PIGMY",
                accountNo = p.AccountNo,
                oldAccountNo = p.OldAccountNo ?? p.LegacyAccountNumber ?? p.PreviousAccountNo ?? string.Empty,
                schemeName = p.PigmyScheme != null ? p.PigmyScheme.SchemeName : "दैनिक पिग्मी योजना",
                balance = p.TotalDepositedAmount,
                targetAmount = p.DailyDepositAmount,
                interestRate = p.InterestRate,
                startDate = p.OpeningDate.ToString("dd/MM/yyyy"),
                maturityDate = p.MaturityDate.ToString("dd/MM/yyyy"),
                agentName = p.PigmyAgent?.AgentName ?? string.Empty,
                status = p.Status
            }).ToList();

            var savingAccounts = savingRaw.Select(s => new
            {
                accountId = s.SavingAccountID,
                productType = "SAVING",
                accountNo = s.AccountNo,
                oldAccountNo = s.OldAccountNo ?? s.LegacyAccountNumber ?? string.Empty,
                schemeName = "बचत खाते (Saving)",
                balance = s.CurrentBalance,
                targetAmount = 0m,
                interestRate = s.InterestRate,
                startDate = s.OpeningDate.ToString("dd/MM/yyyy"),
                nomineeName = s.NomineeName ?? customer.NomineeName ?? string.Empty,
                maturityDate = (string?)null,
                status = s.Status
            }).ToList();

            var rdAccounts = rdRaw.Select(r => new
            {
                accountId = r.RdAccountID,
                productType = "RD",
                accountNo = r.AccountNo,
                oldAccountNo = r.LegacyAccountNumber ?? string.Empty,
                schemeName = r.RdScheme != null ? r.RdScheme.SchemeName : "आवर्ती ठेव (RD)",
                balance = r.TotalDepositedAmount,
                targetAmount = r.InstallmentAmount,
                interestRate = r.InterestRate,
                maturityAmount = r.MaturityAmount,
                paidInstallments = r.TotalPaidInstallments,
                totalInstallments = r.DurationMonths,
                startDate = r.OpeningDate.ToString("dd/MM/yyyy"),
                maturityDate = r.MaturityDate.ToString("dd/MM/yyyy"),
                nomineeName = r.NomineeName ?? customer.NomineeName ?? string.Empty,
                status = r.Status
            }).ToList();

            var fdAccounts = fdRaw.Select(f => new
            {
                accountId = f.FdAccountID,
                productType = "FD",
                accountNo = f.AccountNo,
                oldAccountNo = f.LegacyAccountNumber ?? string.Empty,
                schemeName = f.FdScheme != null ? f.FdScheme.SchemeName : "मुदत ठेव (FD)",
                balance = f.DepositAmount,
                maturityAmount = f.MaturityAmount,
                interestRate = f.InterestRate,
                startDate = f.OpeningDate.ToString("dd/MM/yyyy"),
                maturityDate = f.MaturityDate.ToString("dd/MM/yyyy"),
                receiptNo = f.ReceiptNo ?? $"FDR-{f.FdAccountID}",
                nomineeName = f.NomineeName ?? customer.NomineeName ?? string.Empty,
                autoRenew = false,
                status = f.Status
            }).ToList();

            var loanAccounts = loanRaw.Select(l =>
            {
                var nextEmi = pendingLoanScheds.FirstOrDefault(s => s.LoanAccountID == l.LoanAccountID);
                return new
                {
                    accountId = l.LoanAccountID,
                    productType = "LOAN",
                    accountNo = l.LoanAccountNo ?? $"LN-{l.LoanAccountID}",
                    oldAccountNo = l.LegacyAccountNumber ?? string.Empty,
                    schemeName = l.LoanRate != null ? l.LoanRate.LoanType : "कर्ज खाते",
                    balance = l.PrincipalBalance,
                    targetAmount = l.InstallmentAmount,
                    interestRate = l.InterestRate,
                    sanctionedAmount = l.SanctionedAmount,
                    startDate = l.OpeningDate.ToString("dd/MM/yyyy"),
                    maturityDate = l.MaturityDate.HasValue ? l.MaturityDate.Value.ToString("dd/MM/yyyy") : null,
                    paidInstallments = paidLoanCounts.TryGetValue(l.LoanAccountID, out var pc) ? pc : 0,
                    totalInstallments = l.NoOfInstallments > 0 ? l.NoOfInstallments : l.DurationMonths,
                    nextEmiDate = nextEmi != null ? nextEmi.DueDate.ToString("dd/MM/yyyy") : null,
                    status = l.Status
                };
            }).ToList();

            // 2. Share Account + Certificate + Latest Dividend
            var shareAcc = await _context.ShareAccounts.AsNoTracking()
                .Include(s => s.Certificates)
                .Include(s => s.Dividends)
                .Where(s => s.CustomerID == customerId)
                .OrderByDescending(s => s.Status == "Active")
                .ThenBy(s => s.ShareAccountId)
                .FirstOrDefaultAsync();

            var latestCert = shareAcc?.Certificates?.OrderByDescending(c => c.IssueDate).FirstOrDefault();
            var latestDiv = shareAcc?.Dividends?.OrderByDescending(d => d.PayoutDate).FirstOrDefault();

            var shareAccountPayload = new
            {
                memberNo = customer.MemberProfile?.MemberCode ?? shareAcc?.AccountNo ?? customer.CIFNo ?? "-",
                certificateNo = latestCert?.CertificateNo ?? "-",
                totalShares = shareAcc?.TotalShareCount ?? 0,
                faceValue = latestCert?.FaceValue ?? 100m,
                totalShareAmount = shareAcc?.TotalShareAmount ?? 0m,
                lastDividendPercent = latestDiv?.DividendPercentage ?? 0m,
                lastDividendAmount = latestDiv?.DividendAmount ?? 0m,
                lastDividendYear = latestDiv?.FinancialYear ?? "-",
                status = shareAcc?.Status ?? "Active"
            };

            // 3. Upcoming / Overdue Reminders (Loan EMI + RD)
            var dueReminders = new List<object>();
            var reminderCutoff = today.AddDays(30);

            foreach (var l in loanRaw.Where(x => x.Status == "Active" || x.Status == "Disbursed"))
            {
                var next = pendingLoanScheds.FirstOrDefault(s => s.LoanAccountID == l.LoanAccountID && s.DueDate <= reminderCutoff);
                if (next != null)
                {
                    int daysLeft = (next.DueDate.Date - today).Days;
                    dueReminders.Add(new
                    {
                        id = $"rem_ln_{next.ScheduleID}",
                        productType = "LOAN",
                        title = $"{l.LoanRate?.LoanType ?? "कर्ज"} हप्ता #{next.InstallmentNo}",
                        accountNo = l.LoanAccountNo ?? $"LN-{l.LoanAccountID}",
                        dueDate = next.DueDate.ToString("dd/MM/yyyy"),
                        amount = next.BalanceAmount > 0 ? next.BalanceAmount : next.TotalAmount,
                        daysLeft,
                        status = daysLeft < 0 ? "OVERDUE" : "DUE_SOON"
                    });
                }
            }

            foreach (var r in rdRaw.Where(x => x.Status == "Active"))
            {
                var next = pendingRdScheds.FirstOrDefault(s => s.RdAccountID == r.RdAccountID && s.DueDate <= reminderCutoff);
                if (next != null)
                {
                    int daysLeft = (next.DueDate.Date - today).Days;
                    dueReminders.Add(new
                    {
                        id = $"rem_rd_{next.ScheduleID}",
                        productType = "RD",
                        title = $"आवर्ती ठेव (RD) हप्ता #{next.InstallmentNo}",
                        accountNo = r.AccountNo,
                        dueDate = next.DueDate.ToString("dd/MM/yyyy"),
                        amount = next.ExpectedAmount > 0 ? next.ExpectedAmount : r.InstallmentAmount,
                        daysLeft,
                        status = daysLeft < 0 ? "OVERDUE" : "DUE_SOON"
                    });
                }
            }

            // 4. Unified Recent Activity (Top 8 across Pigmy, Saving, RD, Loan)
            var activityBuffer = new List<(DateTime SortDate, object Item)>();

            if (pigmyIds.Count > 0)
            {
                var pMap = pigmyRaw.ToDictionary(p => p.PigmyAccountID, p => p.AccountNo);
                var pTxs = await _context.PigmyTransactions.AsNoTracking()
                    .Where(t => pigmyIds.Contains(t.PigmyAccountID))
                    .OrderByDescending(t => t.ValueDate).ThenByDescending(t => t.PigmyTransactionID)
                    .Take(8)
                    .ToListAsync();
                foreach (var t in pTxs)
                {
                    activityBuffer.Add((t.ValueDate, new
                    {
                        id = $"PIGMY_{t.PigmyTransactionID}",
                        accountId = t.PigmyAccountID,
                        productType = "PIGMY",
                        accountNo = pMap.TryGetValue(t.PigmyAccountID, out var an) ? an : string.Empty,
                        date = t.ValueDate.ToString("dd/MM/yyyy"),
                        narration = string.IsNullOrWhiteSpace(t.Narration) ? "दैनिक पिग्मी जमा" : t.Narration,
                        reference = t.ReferenceId ?? string.Empty,
                        crAmount = t.CrAmount,
                        drAmount = t.DrAmount,
                        balance = t.BalanceAmount
                    }));
                }
            }

            if (savingIds.Count > 0)
            {
                var sMap = savingRaw.ToDictionary(s => s.SavingAccountID, s => s.AccountNo);
                var sTxs = await _context.SavingTransactions.AsNoTracking()
                    .Where(t => savingIds.Contains(t.SavingAccountID))
                    .OrderByDescending(t => t.TransactionDate).ThenByDescending(t => t.TransactionID)
                    .Take(8)
                    .ToListAsync();
                foreach (var t in sTxs)
                {
                    bool isCredit = t.TransactionType == "Deposit" || t.TransactionType == "Interest";
                    activityBuffer.Add((t.TransactionDate, new
                    {
                        id = $"SAVING_{t.TransactionID}",
                        accountId = t.SavingAccountID,
                        productType = "SAVING",
                        accountNo = sMap.TryGetValue(t.SavingAccountID, out var an) ? an : string.Empty,
                        date = t.TransactionDate.ToString("dd/MM/yyyy"),
                        narration = string.IsNullOrWhiteSpace(t.Narration) ? t.TransactionType : t.Narration,
                        reference = t.VoucherNo ?? string.Empty,
                        crAmount = isCredit ? t.Amount : 0m,
                        drAmount = isCredit ? 0m : t.Amount,
                        balance = t.BalanceAfterTxn
                    }));
                }
            }

            if (rdIds.Count > 0)
            {
                var rMap = rdRaw.ToDictionary(r => r.RdAccountID, r => r.AccountNo);
                var rTxs = await _context.RdTransactions.AsNoTracking()
                    .Where(t => rdIds.Contains(t.RdAccountID))
                    .OrderByDescending(t => t.TransactionDate).ThenByDescending(t => t.RdTransactionID)
                    .Take(8)
                    .ToListAsync();
                foreach (var t in rTxs)
                {
                    activityBuffer.Add((t.TransactionDate, new
                    {
                        id = $"RD_{t.RdTransactionID}",
                        accountId = t.RdAccountID,
                        productType = "RD",
                        accountNo = rMap.TryGetValue(t.RdAccountID, out var an) ? an : string.Empty,
                        date = t.TransactionDate.ToString("dd/MM/yyyy"),
                        narration = string.IsNullOrWhiteSpace(t.Narration) ? "आरडी हप्ता जमा" : t.Narration,
                        reference = t.InstallmentNo.HasValue ? $"हप्ता #{t.InstallmentNo.Value}" : string.Empty,
                        crAmount = t.DebitCredit == "Cr" ? t.PrincipalAmount : 0m,
                        drAmount = t.DebitCredit == "Dr" ? t.PrincipalAmount : 0m,
                        balance = t.BalanceAfterTxn ?? 0m
                    }));
                }
            }

            if (loanIds.Count > 0)
            {
                var lMap = loanRaw.ToDictionary(l => l.LoanAccountID, l => l.LoanAccountNo ?? $"LN-{l.LoanAccountID}");
                var lTxs = await _context.LoanCollections.AsNoTracking()
                    .Where(t => loanIds.Contains(t.LoanAccountID))
                    .OrderByDescending(t => t.CollectionDate).ThenByDescending(t => t.LoanCollectionID)
                    .Take(8)
                    .ToListAsync();
                foreach (var t in lTxs)
                {
                    activityBuffer.Add((t.CollectionDate, new
                    {
                        id = $"LOAN_{t.LoanCollectionID}",
                        accountId = t.LoanAccountID,
                        productType = "LOAN",
                        accountNo = lMap.TryGetValue(t.LoanAccountID, out var an) ? an : string.Empty,
                        date = t.CollectionDate.ToString("dd/MM/yyyy"),
                        narration = $"कर्ज हप्ता (मुद्दल ₹{t.PrincipalCollected:N0} + व्याज ₹{t.InterestCollected:N0})",
                        reference = t.ReceiptNo ?? string.Empty,
                        crAmount = t.TotalAmountReceived,
                        drAmount = 0m,
                        balance = 0m
                    }));
                }
            }

            var recentActivity = activityBuffer
                .OrderByDescending(x => x.SortDate)
                .Take(8)
                .Select(x => x.Item)
                .ToList();

            // 5. Live Interest Rate Card from CBS Schemes
            var interestRates = new List<object>();
            var fdSchemes = await _context.FdSchemes.AsNoTracking().Where(s => s.IsActive).OrderBy(s => s.DurationMonths).Take(6).ToListAsync();
            foreach (var fs in fdSchemes)
            {
                interestRates.Add(new
                {
                    id = $"rate_fd_{fs.FdSchemeID}",
                    category = "FD",
                    tenureOrScheme = fs.SchemeName,
                    generalRate = $"{fs.InterestRate:0.##}%",
                    seniorRate = fs.SeniorCitizenInterestRate > 0 ? $"{fs.SeniorCitizenInterestRate:0.##}%" : null,
                    minAmount = $"₹{fs.MinimumAmount:N0}"
                });
            }
            var rdSchemes = await _context.RdSchemes.AsNoTracking().Where(s => s.IsActive).OrderBy(s => s.DurationMonths).Take(4).ToListAsync();
            foreach (var rs in rdSchemes)
            {
                interestRates.Add(new
                {
                    id = $"rate_rd_{rs.RdSchemeID}",
                    category = "RD",
                    tenureOrScheme = $"{rs.SchemeName} ({rs.DurationMonths} महिने)",
                    generalRate = $"{rs.InterestRate:0.##}%",
                    seniorRate = (string?)null,
                    minAmount = $"₹{rs.MinimumInstallment:N0} / महिना"
                });
            }
            var pigSchemes = await _context.PigmySchemes.AsNoTracking().Where(s => s.Status == "Active").OrderBy(s => s.DurationMonths).Take(4).ToListAsync();
            foreach (var ps in pigSchemes)
            {
                interestRates.Add(new
                {
                    id = $"rate_pg_{ps.PigmySchemeID}",
                    category = "PIGMY",
                    tenureOrScheme = ps.SchemeName,
                    generalRate = $"{ps.InterestRate:0.##}%",
                    seniorRate = (string?)null,
                    minAmount = "₹50 / दिवस"
                });
            }
            var loanRates = await _context.LoanRates.AsNoTracking().Where(l => l.IsActive).OrderBy(l => l.InterestRate).Take(6).ToListAsync();
            foreach (var lr in loanRates)
            {
                interestRates.Add(new
                {
                    id = $"rate_ln_{lr.LoanRateID}",
                    category = "LOAN",
                    tenureOrScheme = lr.LoanType,
                    generalRate = $"{lr.InterestRate:0.##}%",
                    seniorRate = (string?)null,
                    minAmount = lr.DurationMonths.HasValue ? $"{lr.DurationMonths.Value} महिने" : "नियमानुसार"
                });
            }

            // 6. Profile + Masked KYC + Assigned Agent
            var assignedAgent = pigmyRaw.FirstOrDefault(p => p.PigmyAgent != null)?.PigmyAgent;
            var profile = new
            {
                customerId = customer.CustomerID,
                cifNo = customer.CIFNo ?? string.Empty,
                memberNo = customer.MemberProfile?.MemberCode ?? shareAcc?.AccountNo ?? "-",
                customerName = customer.FullName,
                mobileNo = customer.MobileNo ?? string.Empty,
                email = customer.Email ?? "-",
                address = string.Join(", ", new[] { customer.Address, customer.Village, customer.Taluka, customer.District }.Where(x => !string.IsNullOrWhiteSpace(x))),
                branchName = customer.Branch?.BranchName ?? "मुख्य शाखा",
                branchPhone = customer.Branch?.MobileNo ?? string.Empty,
                branchAddress = customer.Branch?.Address ?? string.Empty,
                branchTimings = "सकाळी १०:०० ते सायं. ५:०० (सोम–शनि)",
                kycVerified = string.Equals(customer.KYCStatus, "Verified", StringComparison.OrdinalIgnoreCase),
                maskedAadhaar = MaskAadhaar(customer.AadhaarNo),
                maskedPan = MaskPan(customer.PANNo),
                nomineeName = customer.NomineeName ?? "-",
                nomineeRelation = customer.NomineeRelation ?? "-",
                assignedAgentName = assignedAgent?.AgentName ?? "शाखा संपर्क",
                assignedAgentPhone = assignedAgent?.Customer?.MobileNo ?? customer.Branch?.MobileNo ?? string.Empty
            };

            // 7. Customer Service Requests
            var serviceReqs = await _context.CustomerServiceRequests.AsNoTracking()
                .Where(r => r.CustomerID == customerId)
                .OrderByDescending(r => r.RequestID)
                .Take(30)
                .Select(r => new
                {
                    id = $"CUST_REQ:{r.RequestID}",
                    referenceNo = r.ReferenceNo,
                    type = r.RequestType,
                    title = r.Title,
                    subtitle = r.Subtitle ?? string.Empty,
                    amount = r.Amount,
                    preferredSlot = r.PreferredSlot,
                    createdAt = r.CreatedOn.ToString("dd/MM/yyyy"),
                    status = r.Status,
                    linkedApprovalId = $"CUST_REQ:{r.RequestID}"
                })
                .ToListAsync();

            decimal totalSavingsAndDeposits =
                pigmyRaw.Where(p => p.Status != "Closed").Sum(p => p.TotalDepositedAmount)
                + savingRaw.Where(s => s.Status != "Closed").Sum(s => s.CurrentBalance)
                + rdRaw.Where(r => r.Status != "Closed").Sum(r => r.TotalDepositedAmount)
                + fdRaw.Where(f => f.Status != "Closed").Sum(f => f.DepositAmount);

            decimal totalLoanOutstanding = loanRaw
                .Where(l => l.Status == "Active" || l.Status == "Disbursed")
                .Sum(l => l.PrincipalBalance);

            return Ok(new
            {
                summary = new
                {
                    customerId = customer.CustomerID,
                    cifNo = customer.CIFNo ?? string.Empty,
                    customerName = customer.FullName,
                    mobileNo = customer.MobileNo ?? string.Empty,
                    branchName = customer.Branch?.BranchName ?? "मुख्य शाखा",
                    totalSavingsAndDeposits,
                    totalLoanOutstanding,
                    totalShareAmount = shareAcc?.TotalShareAmount ?? 0m,
                    counts = new
                    {
                        pigmy = pigmyRaw.Count(p => p.Status != "Closed"),
                        saving = savingRaw.Count(s => s.Status != "Closed"),
                        rd = rdRaw.Count(r => r.Status != "Closed"),
                        fd = fdRaw.Count(f => f.Status != "Closed"),
                        loan = loanRaw.Count(l => l.Status == "Active" || l.Status == "Disbursed")
                    }
                },
                accounts = new
                {
                    pigmyAccounts,
                    savingAccounts,
                    rdAccounts,
                    fdAccounts,
                    loanAccounts
                },
                shareAccount = shareAccountPayload,
                dueReminders,
                recentActivity,
                interestRates,
                profile,
                serviceRequests = serviceReqs
            });
        }

        // GET /api/customer/loan-schedule/{loanAccountId}
        [HttpGet("loan-schedule/{loanAccountId:int}")]
        public async Task<IActionResult> GetLoanSchedule(int loanAccountId)
        {
            int customerId = ResolveJwtCustomerId();
            if (customerId <= 0) return Unauthorized(new { message = "वैध खातेदार टोकन आवश्यक आहे." });

            bool ownsLoan = await _context.LoanAccounts.AsNoTracking()
                .AnyAsync(l => l.LoanAccountID == loanAccountId && l.CustomerID == customerId);
            if (!ownsLoan)
            {
                return NotFound(new { message = "कर्ज खाते आढळले नाही." });
            }

            DateTime today = GetIstToday();
            var rows = await _context.LoanInstallmentSchedules.AsNoTracking()
                .Where(s => s.LoanAccountID == loanAccountId)
                .OrderBy(s => s.InstallmentNo)
                .ToListAsync();

            var schedule = rows.Select(s => new
            {
                installmentNo = s.InstallmentNo,
                dueDate = s.DueDate.ToString("dd/MM/yyyy"),
                emiAmount = s.TotalAmount,
                principalPart = s.PrincipalAmount,
                interestPart = s.InterestAmount,
                remainingBalance = s.ClosingBalance,
                status = string.Equals(s.Status, "Paid", StringComparison.OrdinalIgnoreCase)
                    ? "PAID"
                    : s.DueDate.Date < today ? "DUE" : "UPCOMING"
            }).ToList();

            return Ok(schedule);
        }

        // POST /api/customer/service-requests
        [HttpPost("service-requests")]
        public async Task<IActionResult> CreateServiceRequest([FromBody] CustomerCreateServiceRequestDto dto)
        {
            int customerId = ResolveJwtCustomerId();
            if (customerId <= 0) return Unauthorized(new { message = "वैध खातेदार टोकन आवश्यक आहे." });

            if (dto == null || string.IsNullOrWhiteSpace(dto.Title))
            {
                return BadRequest(new { message = "कृपया सेवा विनंतीचे शीर्षक प्रविष्ट करा." });
            }

            string reqType = (dto.Type ?? "SUPPORT_TICKET").Trim().ToUpperInvariant();
            var allowedTypes = new HashSet<string> { "DOORSTEP_PICKUP", "LOAN_APPLY", "DEPOSIT_OPEN", "CERTIFICATE", "SUPPORT_TICKET" };
            if (!allowedTypes.Contains(reqType))
            {
                return BadRequest(new { message = "अवैध सेवा विनंती प्रकार." });
            }

            var customer = await _context.Customers.AsNoTracking()
                .FirstOrDefaultAsync(c => c.CustomerID == customerId && !c.IsDeleted && c.Status == "Active");
            if (customer == null) return NotFound(new { message = "खातेदार सापडला नाही." });

            DateTime today = GetIstToday();
            string refNo = $"REQ-{today.Year}-{Random.Shared.Next(1000, 9999)}";

            var entity = new CustomerServiceRequest
            {
                CustomerID = customerId,
                BranchID = customer.BranchID,
                ReferenceNo = refNo,
                RequestType = reqType,
                Title = dto.Title.Trim(),
                Subtitle = string.IsNullOrWhiteSpace(dto.Subtitle) ? null : dto.Subtitle.Trim(),
                Amount = dto.Amount,
                PreferredSlot = string.IsNullOrWhiteSpace(dto.PreferredSlot) ? null : dto.PreferredSlot.Trim(),
                Status = "PENDING",
                CreatedOn = DateTime.UtcNow
            };

            _context.CustomerServiceRequests.Add(entity);
            await _context.SaveChangesAsync();

            _context.SystemNotifications.Add(new SystemNotification
            {
                BranchID = customer.BranchID,
                RoleName = "Manager",
                ModuleName = "CustomerPortal",
                NotificationType = reqType,
                Title = $"{customer.FullName} — {entity.Title}",
                Description = entity.Subtitle ?? $"संदर्भ क्र. {refNo}",
                Priority = (reqType == "LOAN_APPLY" || reqType == "DEPOSIT_OPEN") ? "HIGH" : "MEDIUM",
                TargetTab = "approvals",
                EntityName = "CustomerServiceRequest",
                EntityID = entity.RequestID.ToString(),
                Amount = entity.Amount,
                Status = "Active",
                CreatedOn = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();

            return Ok(new
            {
                id = $"CUST_REQ:{entity.RequestID}",
                referenceNo = entity.ReferenceNo,
                type = entity.RequestType,
                title = entity.Title,
                subtitle = entity.Subtitle ?? string.Empty,
                amount = entity.Amount,
                preferredSlot = entity.PreferredSlot,
                createdAt = today.ToString("dd/MM/yyyy"),
                status = entity.Status,
                linkedApprovalId = $"CUST_REQ:{entity.RequestID}"
            });
        }

        // POST /api/customer/change-mpin
        [HttpPost("change-mpin")]
        public async Task<IActionResult> ChangeMpin([FromBody] CustomerChangeMpinDto dto)
        {
            int customerId = ResolveJwtCustomerId();
            if (customerId <= 0) return Unauthorized(new { message = "वैध खातेदार टोकन आवश्यक आहे." });

            if (dto == null || string.IsNullOrWhiteSpace(dto.OldPin) || string.IsNullOrWhiteSpace(dto.NewPin))
            {
                return BadRequest(new { message = "कृपया जुना व नवीन mPIN दोन्ही प्रविष्ट करा." });
            }

            string newPin = dto.NewPin.Trim();
            if (!Regex.IsMatch(newPin, @"^\d{4,6}$"))
            {
                return BadRequest(new { message = "नवीन mPIN ४ ते ६ अंकी संख्या असणे आवश्यक आहे." });
            }

            var customer = await _context.Customers
                .FirstOrDefaultAsync(c => c.CustomerID == customerId && !c.IsDeleted && c.Status == "Active");
            if (customer == null) return NotFound(new { message = "खातेदार सापडला नाही." });

            if (string.IsNullOrWhiteSpace(customer.PortalPinHash)
                || !BCrypt.Net.BCrypt.Verify(dto.OldPin.Trim(), customer.PortalPinHash))
            {
                return BadRequest(new { message = "जुना mPIN चुकीचा आहे. कृपया अचूक mPIN प्रविष्ट करा." });
            }

            customer.PortalPinHash = BCrypt.Net.BCrypt.HashPassword(newPin);
            customer.PortalFailedAttempts = 0;
            customer.IsPortalLocked = false;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                message = "तुमचा नवीन mPIN यशस्वीरीत्या अपडेट झाला आहे!"
            });
        }

        private static string MaskAadhaar(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return "-";
            string digits = new string(raw.Where(char.IsDigit).ToArray());
            if (digits.Length < 4) return "XXXX-XXXX";
            return $"XXXX-XXXX-{digits[^4..]}";
        }

        private static string MaskPan(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return "-";
            string clean = raw.Trim().ToUpperInvariant();
            if (clean.Length < 6) return clean;
            return $"{clean[..5]}****{clean[^1]}";
        }
    }

    public class CustomerCreateServiceRequestDto
    {
        public string Type { get; set; } = "SUPPORT_TICKET";
        public string Title { get; set; } = string.Empty;
        public string? Subtitle { get; set; }
        public decimal? Amount { get; set; }
        public string? PreferredSlot { get; set; }
    }

    public class CustomerChangeMpinDto
    {
        public string OldPin { get; set; } = string.Empty;
        public string NewPin { get; set; } = string.Empty;
    }
}
