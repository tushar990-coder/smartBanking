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
                        ActiveAccounts = g.Count(f => f.Status == "Active" || f.Status == "Matured" || string.IsNullOrEmpty(f.Status)),
                        TotalBalance = g.Sum(f => (f.Status == "Active" || f.Status == "Matured" || string.IsNullOrEmpty(f.Status)) ? (decimal?)f.DepositAmount : 0m) ?? 0m,
                        MaturedUnclosedAccounts = g.Count(f => f.Status == "Matured"),
                        MaturedUnclosedBalance = g.Sum(f => f.Status == "Matured" ? (decimal?)f.DepositAmount : 0m) ?? 0m
                    })
                    .FirstOrDefaultAsync();

                int totalFdAccounts = fdStats?.TotalAccounts ?? 0;
                int activeFdAccounts = fdStats?.ActiveAccounts ?? 0;
                decimal totalFdBalance = fdStats?.TotalBalance ?? 0m;
                int maturedUnclosedFdAccounts = fdStats?.MaturedUnclosedAccounts ?? 0;
                decimal maturedUnclosedFdBalance = fdStats?.MaturedUnclosedBalance ?? 0m;

                // Recurring Deposit Module (Consolidated into 1 single SQL query)
                var rdAccountsQuery = _context.RdAccounts.AsNoTracking();
                if (branchId.HasValue && branchId.Value > 0) rdAccountsQuery = rdAccountsQuery.Where(r => r.BranchID == branchId.Value);

                var rdStats = await rdAccountsQuery
                    .GroupBy(r => 1)
                    .Select(g => new
                    {
                        TotalAccounts = g.Count(),
                        ActiveAccounts = g.Count(r => r.Status == "Active" || r.Status == "Matured" || string.IsNullOrEmpty(r.Status)),
                        TotalBalance = g.Sum(r => (r.Status == "Active" || r.Status == "Matured" || string.IsNullOrEmpty(r.Status)) ? (decimal?)r.TotalDepositedAmount : 0m) ?? 0m
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
                        ActiveAccounts = g.Count(p => p.Status == "Active" || p.Status == "Matured" || string.IsNullOrEmpty(p.Status)),
                        TotalBalance = g.Sum(p => (p.Status == "Active" || p.Status == "Matured" || string.IsNullOrEmpty(p.Status)) ? (decimal?)p.TotalDepositedAmount : 0m) ?? 0m
                    })
                    .FirstOrDefaultAsync();

                int totalPigmyAccounts = pigmyStats?.TotalAccounts ?? 0;
                int activePigmyAccounts = pigmyStats?.ActiveAccounts ?? 0;
                decimal totalPigmyBalance = pigmyStats?.TotalBalance ?? 0m;

                // Share Module (Consolidated into 1 single SQL query)
                var shareAccountsQuery = _context.ShareAccounts.AsNoTracking();
                if (branchId.HasValue && branchId.Value > 0) shareAccountsQuery = shareAccountsQuery.Where(s => s.Member != null && s.Member.BranchID == branchId.Value);

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
                        accountCount = activeFdAccounts,
                        maturedUnclosedAccounts = maturedUnclosedFdAccounts,
                        maturedUnclosedBalance = maturedUnclosedFdBalance
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

        // GET: api/Dashboard/mobile-admin-summary
        [HttpGet("mobile-admin-summary")]
        [Authorize(Roles = "Admin,SuperAdmin,HeadOffice,HO_Manager,Manager,BranchManager")]
        public async Task<ActionResult> GetMobileAdminSummary([FromQuery] int? branchId = null)
        {
            branchId = User.ResolveOptionalBranchId(branchId);
            var dateGuard = new Services.BusinessDateGuardService(_context);
            DateTime today;
            if (branchId.HasValue && branchId.Value > 0)
            {
                var (activeBizDate, _) = await dateGuard.GetBranchBusinessDateAsync(branchId.Value);
                today = activeBizDate.Date;
            }
            else
            {
                today = dateGuard.GetIstToday();
            }
            var tomorrow = today.AddDays(1);

            var accountsQuery = _context.PigmyAccounts.AsNoTracking().Where(a => a.Status == "Active");
            var agentsQuery = _context.PigmyAgents.AsNoTracking().Include(a => a.Customer).Where(a => a.Status == "Active");
            var collectionsQuery = _context.PigmyCollections.AsNoTracking()
                .Include(c => c.PigmyAccount).ThenInclude(a => a!.Customer)
                .Include(c => c.Agent)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                accountsQuery = accountsQuery.Where(a => a.BranchID == branchId.Value);
                agentsQuery = agentsQuery.Where(a => a.BranchID == branchId.Value);
                collectionsQuery = collectionsQuery.Where(c => c.PigmyAccount != null && c.PigmyAccount.BranchID == branchId.Value);
            }

            // Single batched projection eliminates N+1 agent loop queries
            var activeAccountRows = await accountsQuery
                .Select(a => new { a.PigmyAgentID, a.TotalDepositedAmount, a.DailyDepositAmount })
                .ToListAsync();

            decimal totalPigmyBalance = activeAccountRows.Sum(a => a.TotalDepositedAmount);
            int activeAccountsCount = activeAccountRows.Count;
            var accountsByAgent = activeAccountRows
                .GroupBy(a => a.PigmyAgentID)
                .ToDictionary(
                    g => g.Key,
                    g => new
                    {
                        Count = g.Count(),
                        Target = g.Sum(x => x.DailyDepositAmount > 0 ? x.DailyDepositAmount : 100m)
                    });

            var todaysCollections = await collectionsQuery
                .Where(c => c.CollectionDate >= today && c.CollectionDate < tomorrow)
                .ToListAsync();

            decimal todaysTotalCollected = todaysCollections.Sum(c => c.CollectionAmount);
            int todaysReceiptsCount = todaysCollections.Count;

            var activeAgents = await agentsQuery.ToListAsync();
            var agentStats = new List<object>();
            foreach (var agt in activeAgents)
            {
                var agtInfo = accountsByAgent.TryGetValue(agt.PigmyAgentID, out var info)
                    ? info
                    : new { Count = 0, Target = 0m };
                var agtTodayCols = todaysCollections.Where(c => c.AgentId == agt.PigmyAgentID).ToList();
                decimal agtTodaySum = agtTodayCols.Sum(c => c.CollectionAmount);
                int collectedAccCount = agtTodayCols.Select(c => c.PigmyAccountId).Distinct().Count();

                agentStats.Add(new
                {
                    id = $"agt_{agt.PigmyAgentID}",
                    agentId = agt.PigmyAgentID,
                    name = agt.AgentName,
                    phone = agt.Customer?.MobileNo ?? string.Empty,
                    assignedCustomersCount = agtInfo.Count,
                    todayTargetAmount = agtInfo.Target,
                    todayCollectedAmount = agtTodaySum,
                    pendingCustomersCount = Math.Max(0, agtInfo.Count - collectedAccCount),
                    status = agt.Status == "Active" ? "ACTIVE" : "INACTIVE"
                });
            }

            var recentCollections = todaysCollections
                .OrderByDescending(c => c.CollectionId)
                .Take(20)
                .Select(c => new
                {
                    id = $"srv_{c.CollectionId}",
                    transactionId = c.TransactionId ?? $"srv_txn_{c.CollectionId}",
                    receiptNo = c.ReceiptNo,
                    accountId = $"acc_{c.PigmyAccountId}",
                    accountNumber = c.PigmyAccount?.AccountNo ?? "",
                    customerName = c.PigmyAccount?.Customer != null
                        ? $"{c.PigmyAccount.Customer.FirstName} {c.PigmyAccount.Customer.LastName}".Trim()
                        : "",
                    agentId = $"agt_{c.AgentId}",
                    agentName = c.Agent?.AgentName ?? "",
                    amount = c.CollectionAmount,
                    paymentMode = string.IsNullOrWhiteSpace(c.PaymentMode) ? "CASH" : c.PaymentMode,
                    timestamp = c.CollectionDate.ToString("yyyy-MM-dd HH:mm"),
                    status = "VERIFIED",
                    syncStatus = "SYNCED"
                })
                .ToList();

            return Ok(new
            {
                totalBalance = totalPigmyBalance,
                todaysCollection = todaysTotalCollected,
                todaysReceiptsCount,
                activeAccountsCount,
                activeAgentsCount = activeAgents.Count,
                agents = agentStats,
                recentCollections
            });
        }
    }
}
