using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Bhisi.Api.Data;
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

        public CustomerPortalController(AppDbContext context)
        {
            _context = context;
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
    }
}
