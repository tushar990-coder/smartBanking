using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Bhisi.Api.Data;
using Bhisi.Api.Helpers;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DashboardController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IMemoryCache _cache;

        public DashboardController(AppDbContext context, IMemoryCache cache)
        {
            _context = context;
            _cache = cache;
        }

        // GET: api/Dashboard
        // GET: api/Dashboard/summary
        // GET: api/Dashboard/stats
        [HttpGet]
        [HttpGet("summary")]
        [HttpGet("DashboardSummary")]
        [HttpGet("stats")]
        public async Task<ActionResult> GetDashboard([FromQuery] int? branchId, [FromQuery] bool refresh = false)
        {
            try
            {
                branchId = User.ResolveBranchId(branchId);
                int targetBranch = branchId ?? 0;
                string cacheKey = $"dashboard_summary_branch_{targetBranch}";

                // 1. High-Speed Cache Hit (Sub-5ms Response)
                if (!refresh && _cache.TryGetValue(cacheKey, out object? cachedResult) && cachedResult != null)
                {
                    return Ok(cachedResult);
                }

                // 2. High-Performance Consolidated Aggregations (Single Grouped SQL Queries)

                // Members
                var membersQuery = _context.Members.AsNoTracking();
                if (branchId.HasValue && branchId.Value > 0) membersQuery = membersQuery.Where(m => m.BranchID == branchId.Value);
                var totalMembers = await membersQuery.CountAsync();

                // Loan Module (Consolidated from 6 queries into 1 single SQL query)
                var loanAccountsQuery = _context.LoanAccounts.AsNoTracking();
                if (branchId.HasValue && branchId.Value > 0) loanAccountsQuery = loanAccountsQuery.Where(l => l.BranchID == branchId.Value);

                var loanStats = await loanAccountsQuery
                    .GroupBy(l => 1)
                    .Select(g => new
                    {
                        TotalAccounts = g.Count(),
                        ActiveAccounts = g.Count(l => l.Status == "Active"),
                        TotalDisbursed = g.Sum(l => (decimal?)l.SanctionedAmount) ?? 0m,
                        PrincipalBalance = g.Sum(l => l.Status == "Active" ? (decimal?)l.PrincipalBalance : 0m) ?? 0m,
                        InterestBalance = g.Sum(l => l.Status == "Active" ? (decimal?)l.InterestBalance : 0m) ?? 0m,
                        OverdueBalance = g.Sum(l => l.Status == "Active" ? (decimal?)l.OverdueInterestBalance : 0m) ?? 0m
                    })
                    .FirstOrDefaultAsync();

                int totalLoanAccounts = loanStats?.TotalAccounts ?? 0;
                int activeLoanAccounts = loanStats?.ActiveAccounts ?? 0;
                decimal totalLoanDisbursed = loanStats?.TotalDisbursed ?? 0m;
                decimal totalLoanPrincipalBalance = loanStats?.PrincipalBalance ?? 0m;
                decimal totalLoanInterestBalance = loanStats?.InterestBalance ?? 0m;
                decimal totalLoanOverdueBalance = loanStats?.OverdueBalance ?? 0m;

                // Saving Module (Consolidated from 5 queries into 1 single SQL query, zero transaction table scans)
                var savingAccountsQuery = _context.SavingAccountMasters.AsNoTracking();
                if (branchId.HasValue && branchId.Value > 0) savingAccountsQuery = savingAccountsQuery.Where(s => s.BranchID == branchId.Value);

                var savingStats = await savingAccountsQuery
                    .GroupBy(s => 1)
                    .Select(g => new
                    {
                        TotalAccounts = g.Count(),
                        ActiveAccounts = g.Count(s => s.Status == "Active"),
                        TotalBalance = g.Sum(s => s.Status == "Active" ? (decimal?)s.CurrentBalance : 0m) ?? 0m
                    })
                    .FirstOrDefaultAsync();

                int totalSavingAccounts = savingStats?.TotalAccounts ?? 0;
                int activeSavingAccounts = savingStats?.ActiveAccounts ?? 0;
                decimal totalSavingBalance = savingStats?.TotalBalance ?? 0m;

                // Fixed Deposit Module (Consolidated into 1 single SQL query)
                var fdAccountsQuery = _context.FdAccounts.AsNoTracking();
                if (branchId.HasValue && branchId.Value > 0) fdAccountsQuery = fdAccountsQuery.Where(f => f.BranchID == branchId.Value);

                var fdStats = await fdAccountsQuery
                    .GroupBy(f => 1)
                    .Select(g => new
                    {
                        TotalAccounts = g.Count(),
                        ActiveAccounts = g.Count(f => f.Status == "Active"),
                        TotalBalance = g.Sum(f => f.Status == "Active" ? (decimal?)f.DepositAmount : 0m) ?? 0m
                    })
                    .FirstOrDefaultAsync();

                int totalFdAccounts = fdStats?.TotalAccounts ?? 0;
                int activeFdAccounts = fdStats?.ActiveAccounts ?? 0;
                decimal totalFdBalance = fdStats?.TotalBalance ?? 0m;

                // Recurring Deposit Module (Consolidated into 1 single SQL query)
                var rdAccountsQuery = _context.RdAccounts.AsNoTracking();
                if (branchId.HasValue && branchId.Value > 0) rdAccountsQuery = rdAccountsQuery.Where(r => r.BranchID == branchId.Value);

                var rdStats = await rdAccountsQuery
                    .GroupBy(r => 1)
                    .Select(g => new
                    {
                        TotalAccounts = g.Count(),
                        ActiveAccounts = g.Count(r => r.Status == "Active"),
                        TotalBalance = g.Sum(r => r.Status == "Active" ? (decimal?)r.TotalDepositedAmount : 0m) ?? 0m
                    })
                    .FirstOrDefaultAsync();

                int totalRdAccounts = rdStats?.TotalAccounts ?? 0;
                int activeRdAccounts = rdStats?.ActiveAccounts ?? 0;
                decimal totalRdBalance = rdStats?.TotalBalance ?? 0m;

                // Pigmy Module (Consolidated into 1 single SQL query)
                var pigmyAccountsQuery = _context.PigmyAccounts.AsNoTracking();
                if (branchId.HasValue && branchId.Value > 0) pigmyAccountsQuery = pigmyAccountsQuery.Where(p => p.BranchID == branchId.Value);

                var pigmyStats = await pigmyAccountsQuery
                    .GroupBy(p => 1)
                    .Select(g => new
                    {
                        TotalAccounts = g.Count(),
                        ActiveAccounts = g.Count(p => p.Status == "Active"),
                        TotalBalance = g.Sum(p => p.Status == "Active" ? (decimal?)p.TotalDepositedAmount : 0m) ?? 0m
                    })
                    .FirstOrDefaultAsync();

                int totalPigmyAccounts = pigmyStats?.TotalAccounts ?? 0;
                int activePigmyAccounts = pigmyStats?.ActiveAccounts ?? 0;
                decimal totalPigmyBalance = pigmyStats?.TotalBalance ?? 0m;

                // Share Module (Consolidated into 1 single SQL query)
                var shareAccountsQuery = _context.ShareAccounts.AsNoTracking();

                var shareStats = await shareAccountsQuery
                    .GroupBy(s => 1)
                    .Select(g => new
                    {
                        TotalAccounts = g.Count(),
                        ActiveAccounts = g.Count(s => s.Status == "Active"),
                        TotalBalance = g.Sum(s => s.Status == "Active" ? (decimal?)s.TotalShareAmount : 0m) ?? 0m
                    })
                    .FirstOrDefaultAsync();

                int totalShareAccounts = shareStats?.TotalAccounts ?? 0;
                int activeShareAccounts = shareStats?.ActiveAccounts ?? 0;
                decimal totalShareBalance = shareStats?.TotalBalance ?? 0m;

                // Voucher / Accounting (Single scalar counts)
                var vouchersQuery = _context.Vouchers.AsNoTracking();
                if (branchId.HasValue && branchId.Value > 0) vouchersQuery = vouchersQuery.Where(v => v.BranchID == branchId.Value);
                var totalVouchers = await vouchersQuery.CountAsync();
                var totalLedgers = await _context.Ledgers.AsNoTracking().CountAsync();

                var responseData = new
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
                        totalCollected = 0m,
                        accountCount = activeLoanAccounts
                    },
                    saving = new
                    {
                        totalAccounts = totalSavingAccounts,
                        activeAccounts = activeSavingAccounts,
                        totalBalance = totalSavingBalance,
                        totalDeposits = 0m,
                        totalWithdrawals = 0m,
                        accountCount = activeSavingAccounts
                    },
                    fixedDeposit = new
                    {
                        totalAccounts = totalFdAccounts,
                        activeAccounts = activeFdAccounts,
                        totalBalance = totalFdBalance,
                        accountCount = activeFdAccounts
                    },
                    recurringDeposit = new
                    {
                        totalAccounts = totalRdAccounts,
                        activeAccounts = activeRdAccounts,
                        totalBalance = totalRdBalance,
                        accountCount = activeRdAccounts
                    },
                    pigmy = new
                    {
                        totalAccounts = totalPigmyAccounts,
                        activeAccounts = activePigmyAccounts,
                        totalBalance = totalPigmyBalance,
                        accountCount = activePigmyAccounts
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
                        totalDr = 0m,
                        totalCr = 0m
                    },
                    accounting = new
                    {
                        totalVouchers,
                        totalLedgers
                    }
                };

                // 3. Cache the computed result in memory for 60 seconds (1 Minute TTL)
                _cache.Set(cacheKey, responseData, TimeSpan.FromSeconds(60));

                return Ok(responseData);
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
