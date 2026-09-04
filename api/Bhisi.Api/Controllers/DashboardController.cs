using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [AllowAnonymous]
    public class DashboardController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DashboardController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/Dashboard
        // GET: api/Dashboard/summary
        // GET: api/Dashboard/stats
        [HttpGet]
        [HttpGet("summary")]
        [HttpGet("DashboardSummary")]
        [HttpGet("stats")]
        public async Task<ActionResult> GetDashboard([FromQuery] int? branchId)
        {
            try
            {
                // Members
                var membersQuery = _context.Members.AsNoTracking();
                if (branchId.HasValue && branchId.Value > 0) membersQuery = membersQuery.Where(m => m.BranchID == branchId.Value);
                var totalMembers = await membersQuery.CountAsync();

                // Loan Module
                var loanAccountsQuery = _context.LoanAccounts.AsNoTracking();
                if (branchId.HasValue && branchId.Value > 0) loanAccountsQuery = loanAccountsQuery.Where(l => l.BranchID == branchId.Value);

                var totalLoanAccounts = await loanAccountsQuery.CountAsync();
                var activeLoanAccounts = await loanAccountsQuery.Where(l => l.Status == "Active").CountAsync();
                var totalLoanDisbursed = await loanAccountsQuery.SumAsync(l => (decimal?)l.SanctionedAmount) ?? 0m;
                var totalLoanPrincipalBalance = await loanAccountsQuery.Where(l => l.Status == "Active").SumAsync(l => (decimal?)l.PrincipalBalance) ?? 0m;
                var totalLoanInterestBalance = await loanAccountsQuery.Where(l => l.Status == "Active").SumAsync(l => (decimal?)l.InterestBalance) ?? 0m;
                var totalLoanOverdueBalance = await loanAccountsQuery.Where(l => l.Status == "Active").SumAsync(l => (decimal?)l.OverdueInterestBalance) ?? 0m;

                var loanCollectionsQuery = _context.LoanCollections.AsNoTracking();
                if (branchId.HasValue && branchId.Value > 0) loanCollectionsQuery = loanCollectionsQuery.Where(c => c.LoanAccount != null && c.LoanAccount.BranchID == branchId.Value);
                var totalLoanCollected = await loanCollectionsQuery.SumAsync(c => (decimal?)c.TotalAmountReceived) ?? 0m;

                // Saving Module
                var savingAccountsQuery = _context.SavingAccountMasters.AsNoTracking();
                if (branchId.HasValue && branchId.Value > 0) savingAccountsQuery = savingAccountsQuery.Where(s => s.BranchID == branchId.Value);

                var totalSavingAccounts = await savingAccountsQuery.CountAsync();
                var activeSavingAccounts = await savingAccountsQuery.Where(s => s.Status == "Active").CountAsync();
                var totalSavingBalance = await savingAccountsQuery.Where(s => s.Status == "Active").SumAsync(s => (decimal?)s.CurrentBalance) ?? 0m;

                var savingTxnsQuery = _context.SavingTransactions.AsNoTracking();
                if (branchId.HasValue && branchId.Value > 0) savingTxnsQuery = savingTxnsQuery.Where(t => t.SavingAccount != null && t.SavingAccount.BranchID == branchId.Value);
                var totalSavingDeposits = await savingTxnsQuery
                    .Where(t => t.TransactionType == "Deposit" && t.Narration != "Opening Balance")
                    .SumAsync(t => (decimal?)t.Amount) ?? 0m;
                var totalSavingWithdrawals = await savingTxnsQuery
                    .Where(t => t.TransactionType == "Withdrawal")
                    .SumAsync(t => (decimal?)t.Amount) ?? 0m;

                // Fixed Deposit Module
                var fdAccountsQuery = _context.FdAccounts.AsNoTracking();
                if (branchId.HasValue && branchId.Value > 0) fdAccountsQuery = fdAccountsQuery.Where(f => f.BranchID == branchId.Value);
                var totalFdAccounts = await fdAccountsQuery.CountAsync();
                var activeFdAccounts = await fdAccountsQuery.Where(f => f.Status == "Active").CountAsync();
                var totalFdBalance = await fdAccountsQuery.Where(f => f.Status == "Active").SumAsync(f => (decimal?)f.DepositAmount) ?? 0m;

                // Share Module
                var shareAccountsQuery = _context.ShareAccounts.AsNoTracking();
                var totalShareAccounts = await shareAccountsQuery.CountAsync();
                var activeShareAccounts = await shareAccountsQuery.Where(s => s.Status == "Active").CountAsync();
                var totalShareBalance = await shareAccountsQuery.Where(s => s.Status == "Active").SumAsync(s => (decimal?)s.TotalShareAmount) ?? 0m;

                // Member OB
                var memberOBsQuery = _context.MemberOpeningBalances.AsNoTracking();
                if (branchId.HasValue && branchId.Value > 0) memberOBsQuery = memberOBsQuery.Where(o => o.Member != null && o.Member.BranchID == branchId.Value);
                var totalMemberOBDr = await memberOBsQuery.Where(o => o.BalanceType == "Dr").SumAsync(o => (decimal?)o.Amount) ?? 0m;
                var totalMemberOBCr = await memberOBsQuery.Where(o => o.BalanceType == "Cr").SumAsync(o => (decimal?)o.Amount) ?? 0m;

                // Voucher / Accounting
                var vouchersQuery = _context.Vouchers.AsNoTracking();
                if (branchId.HasValue && branchId.Value > 0) vouchersQuery = vouchersQuery.Where(v => v.BranchID == branchId.Value);
                var totalVouchers = await vouchersQuery.CountAsync();
                var totalLedgers = await _context.Ledgers.AsNoTracking().CountAsync();

                return Ok(new
                {
                    members = new { totalMembers },
                    loan = new
                    {
                        totalAccounts = totalLoanAccounts,
                        activeAccounts = activeLoanAccounts,
                        totalDisbursed = totalLoanDisbursed,
                        disbursedBalance = totalLoanPrincipalBalance,
                        principalBalance = totalLoanPrincipalBalance,
                        interestBalance = totalLoanInterestBalance,
                        overdueBalance = totalLoanOverdueBalance,
                        totalCollected = totalLoanCollected,
                        accountCount = activeLoanAccounts
                    },
                    saving = new
                    {
                        totalAccounts = totalSavingAccounts,
                        activeAccounts = activeSavingAccounts,
                        totalBalance = totalSavingBalance,
                        totalDeposits = totalSavingDeposits,
                        totalWithdrawals = totalSavingWithdrawals,
                        accountCount = activeSavingAccounts
                    },
                    fixedDeposit = new
                    {
                        totalAccounts = totalFdAccounts,
                        activeAccounts = activeFdAccounts,
                        totalBalance = totalFdBalance,
                        accountCount = activeFdAccounts
                    },
                    shares = new
                    {
                        totalAccounts = totalShareAccounts,
                        activeAccounts = activeShareAccounts,
                        totalBalance = totalShareBalance,
                        memberCount = totalMembers
                    },
                    memberOB = new
                    {
                        totalDr = totalMemberOBDr,
                        totalCr = totalMemberOBCr
                    },
                    accounting = new
                    {
                        totalVouchers,
                        totalLedgers
                    }
                });
            }
            catch (Exception ex)
            {
                return Ok(new
                {
                    members = new { totalMembers = 0 },
                    loan = new
                    {
                        totalAccounts = 0,
                        activeAccounts = 0,
                        totalDisbursed = 0m,
                        principalBalance = 0m,
                        interestBalance = 0m,
                        overdueBalance = 0m,
                        totalCollected = 0m
                    },
                    saving = new
                    {
                        totalAccounts = 0,
                        activeAccounts = 0,
                        totalBalance = 0m,
                        totalDeposits = 0m,
                        totalWithdrawals = 0m
                    },
                    memberOB = new
                    {
                        totalDr = 0m,
                        totalCr = 0m
                    },
                    accounting = new
                    {
                        totalVouchers = 0,
                        totalLedgers = 0
                    },
                    error = ex.Message
                });
            }
        }
    }
}
