using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Bhisi.Api.Helpers;
using Bhisi.Api.Models;
using Bhisi.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bhisi.Api.Controllers
{
    [Route("api/mobile-manager")]
    [ApiController]
    [Authorize(Roles = "Admin,SuperAdmin,HeadOffice,HO_Manager,Manager,BranchManager")]
    public class MobileManagerController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IAgentLockService _agentLockService;
        private readonly IBusinessDateGuardService? _businessDateGuard;

        public MobileManagerController(
            AppDbContext context,
            IAgentLockService agentLockService,
            IBusinessDateGuardService? businessDateGuard = null)
        {
            _context = context;
            _agentLockService = agentLockService;
            _businessDateGuard = businessDateGuard;
        }

        private DateTime GetIstToday()
        {
            return _businessDateGuard?.GetIstToday()
                ?? DateTime.UtcNow.AddHours(5.5).Date;
        }

        private int ResolveUserId()
        {
            var raw = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("UserID")?.Value;
            return int.TryParse(raw, out int uid) && uid > 0 ? uid : 1;
        }

        private static string FormatDisplayDate(DateTime dt) => dt.ToString("dd/MM/yyyy");

        // GET /api/mobile-manager/command-center?branchId=...
        [HttpGet("command-center")]
        public async Task<IActionResult> GetCommandCenter([FromQuery] int? branchId = null)
        {
            bool isHo = User.IsHeadOfficeAdmin();
            int? effectiveBranchId = User.ResolveOptionalBranchId(branchId);
            DateTime today = GetIstToday();
            DateTime tomorrow = today.AddDays(1);
            DateTime maturityCutoff = today.AddDays(30);

            // 1. Branches & EOD Status
            var branchesQuery = _context.Branches.AsNoTracking().Where(b => b.IsActive);
            if (!isHo && effectiveBranchId.HasValue)
            {
                branchesQuery = branchesQuery.Where(b => b.BranchID == effectiveBranchId.Value);
            }
            var activeBranches = await branchesQuery.OrderBy(b => b.BranchID).ToListAsync();
            var branchLookup = activeBranches.ToDictionary(b => b.BranchID, b => b.BranchName);

            var eodRows = await _context.BranchDayEndStatuses.AsNoTracking()
                .Where(e => e.BusinessDate >= today.AddDays(-7))
                .OrderByDescending(e => e.BusinessDate)
                .ToListAsync();

            var branchOptions = new List<object>();
            if (isHo)
            {
                bool allClosedToday = activeBranches.Count > 0 && activeBranches.All(b =>
                    eodRows.Any(e => e.BranchID == b.BranchID && e.BusinessDate.Date == today && e.IsDayClosed));
                branchOptions.Add(new
                {
                    id = (object)"ALL",
                    name = "सर्व शाखा एकत्रित (All Branches)",
                    shortName = "सर्व शाखा",
                    code = "ALL",
                    eodStatus = allClosedToday ? "CLOSED" : "OPEN",
                    businessDate = FormatDisplayDate(today)
                });
            }

            foreach (var b in activeBranches)
            {
                var todayEod = eodRows.FirstOrDefault(e => e.BranchID == b.BranchID && e.BusinessDate.Date == today);
                string eodState = todayEod?.IsDayClosed == true ? "CLOSED" : "OPEN";
                string shortName = b.BranchName.Length > 14 ? b.BranchName[..14] : b.BranchName;
                branchOptions.Add(new
                {
                    id = (object)b.BranchID,
                    name = b.BranchName,
                    shortName,
                    code = string.IsNullOrWhiteSpace(b.BranchCode) ? $"BR{b.BranchID:00}" : b.BranchCode,
                    eodStatus = eodState,
                    businessDate = FormatDisplayDate(today)
                });
            }

            string selectedBranchName = effectiveBranchId.HasValue && branchLookup.TryGetValue(effectiveBranchId.Value, out var bn)
                ? bn
                : "सर्व शाखा एकत्रित (All Branches)";

            // 2. 6-Product Portfolio Aggregates
            var fdQ = _context.FdAccounts.AsNoTracking().Where(f => f.Status != "Closed");
            var savQ = _context.SavingAccountMasters.AsNoTracking().Where(s => s.Status != "Closed");
            var pigQ = _context.PigmyAccounts.AsNoTracking().Where(p => p.Status != "Closed");
            var rdQ = _context.RdAccounts.AsNoTracking().Where(r => r.Status != "Closed");
            var loanQ = _context.LoanAccounts.AsNoTracking().Where(l => l.Status == "Active" || l.Status == "Disbursed");
            var shareQ = _context.ShareAccounts.AsNoTracking().Include(s => s.Customer).Where(s => s.Status != "Closed");
            var memQ = _context.Members.AsNoTracking().Where(m => !m.IsDeleted && m.Status == "Active");

            if (effectiveBranchId.HasValue)
            {
                int bid = effectiveBranchId.Value;
                fdQ = fdQ.Where(f => f.BranchID == bid);
                savQ = savQ.Where(s => s.BranchID == bid);
                pigQ = pigQ.Where(p => p.BranchID == bid);
                rdQ = rdQ.Where(r => r.BranchID == bid);
                loanQ = loanQ.Where(l => l.BranchID == bid);
                shareQ = shareQ.Where(s => s.Customer != null && s.Customer.BranchID == bid);
                memQ = memQ.Where(m => m.BranchID == bid);
            }

            int fdActive = await fdQ.CountAsync();
            decimal fdBalance = await fdQ.SumAsync(f => (decimal?)f.DepositAmount) ?? 0m;
            int fdMaturedUnclosed = await fdQ.CountAsync(f => f.Status == "Matured" || f.MaturityDate < today);

            int savingActive = await savQ.CountAsync();
            decimal savingBalance = await savQ.SumAsync(s => (decimal?)s.CurrentBalance) ?? 0m;

            int pigmyActive = await pigQ.CountAsync();
            decimal pigmyBalance = await pigQ.SumAsync(p => (decimal?)p.TotalDepositedAmount) ?? 0m;

            int rdActive = await rdQ.CountAsync();
            decimal rdBalance = await rdQ.SumAsync(r => (decimal?)r.TotalDepositedAmount) ?? 0m;

            int loanActive = await loanQ.CountAsync();
            decimal loanOutstanding = await loanQ.SumAsync(l => (decimal?)l.PrincipalBalance) ?? 0m;

            int shareActive = await shareQ.CountAsync();
            decimal shareBalance = await shareQ.SumAsync(s => (decimal?)s.TotalShareAmount) ?? 0m;
            int totalMembers = await memQ.CountAsync();

            decimal totalDeposits = fdBalance + savingBalance + pigmyBalance + rdBalance;
            decimal cdRatioPercent = totalDeposits > 0 ? Math.Round((loanOutstanding / totalDeposits) * 100m, 1) : 0m;

            // 3. Overdue Loans & NPA Buckets
            var overdueSchedulesQuery = _context.LoanInstallmentSchedules.AsNoTracking()
                .Include(s => s.LoanAccount!)
                    .ThenInclude(l => l.Customer)
                .Include(s => s.LoanAccount!)
                    .ThenInclude(l => l.LoanRate)
                .Where(s => s.DueDate < today && s.Status != "Paid"
                    && s.LoanAccount != null
                    && (s.LoanAccount.Status == "Active" || s.LoanAccount.Status == "Disbursed"));

            if (effectiveBranchId.HasValue)
            {
                int bid = effectiveBranchId.Value;
                overdueSchedulesQuery = overdueSchedulesQuery.Where(s => s.LoanAccount!.BranchID == bid);
            }

            var overdueRows = await overdueSchedulesQuery.ToListAsync();
            var overdueLoans = overdueRows
                .GroupBy(s => s.LoanAccountID)
                .Select(g =>
                {
                    var loan = g.First().LoanAccount!;
                    var earliestDue = g.Min(x => x.DueDate).Date;
                    int overdueDays = Math.Max(0, (today - earliestDue).Days);
                    string bucket = overdueDays >= 90 ? "NPA_90" : overdueDays >= 60 ? "60D" : "30D";
                    decimal overdueAmt = g.Sum(x => x.BalanceAmount > 0 ? x.BalanceAmount : x.TotalAmount);
                    return new
                    {
                        id = $"ovd_{loan.LoanAccountID}",
                        accountNo = loan.LoanAccountNo ?? $"LN-{loan.LoanAccountID}",
                        customerName = loan.Customer?.FullName ?? "ग्राहक",
                        phone = loan.Customer?.MobileNo ?? string.Empty,
                        loanScheme = loan.LoanRate?.LoanType ?? "कर्ज खाते",
                        overdueInstallments = g.Count(),
                        overdueAmount = overdueAmt,
                        outstandingPrincipal = loan.PrincipalBalance,
                        bucket,
                        branchId = loan.BranchID,
                        lastPaidDate = loan.LastInstallmentPaidDate.HasValue
                            ? FormatDisplayDate(loan.LastInstallmentPaidDate.Value)
                            : "-"
                    };
                })
                .OrderByDescending(o => o.overdueAmount)
                .Take(50)
                .ToList();

            decimal totalLoanOverdue = overdueLoans.Sum(o => o.overdueAmount);
            if (totalLoanOverdue == 0m)
            {
                totalLoanOverdue = await loanQ.SumAsync(l => (decimal?)l.OverdueInterestBalance) ?? 0m;
            }
            decimal npaPrincipal = overdueLoans.Where(o => o.bucket == "NPA_90").Sum(o => o.outstandingPrincipal);
            decimal npaPercent = loanOutstanding > 0 ? Math.Round((npaPrincipal / loanOutstanding) * 100m, 2) : 0m;

            // 4. Upcoming & Matured Unclosed FD / RD Maturities
            var fdMatList = await fdQ
                .Include(f => f.Customer)
                .Include(f => f.FdScheme)
                .Where(f => f.Status == "Matured" || f.MaturityDate <= maturityCutoff)
                .OrderBy(f => f.MaturityDate)
                .Take(30)
                .ToListAsync();

            var rdMatList = await rdQ
                .Include(r => r.Customer)
                .Include(r => r.RdScheme)
                .Where(r => r.Status == "Matured" || r.MaturityDate <= maturityCutoff)
                .OrderBy(r => r.MaturityDate)
                .Take(30)
                .ToListAsync();

            var maturityItems = new List<object>();
            int maturedUnclosedTotal = 0;

            foreach (var f in fdMatList)
            {
                int daysRem = (f.MaturityDate.Date - today).Days;
                string bucket = (f.Status == "Matured" || daysRem < 0)
                    ? "MATURED_UNCLOSED"
                    : daysRem <= 7 ? "UPCOMING_7" : "UPCOMING_30";
                if (bucket == "MATURED_UNCLOSED") maturedUnclosedTotal++;

                maturityItems.Add(new
                {
                    id = $"mat_fd_{f.FdAccountID}",
                    productType = "FD",
                    accountNo = f.AccountNo,
                    customerName = f.Customer?.FullName ?? "ग्राहक",
                    phone = f.Customer?.MobileNo ?? string.Empty,
                    schemeName = f.FdScheme?.SchemeName ?? "मुदत ठेव (FD)",
                    principalAmount = f.DepositAmount,
                    maturityAmount = f.MaturityAmount,
                    maturityDate = FormatDisplayDate(f.MaturityDate),
                    daysRemaining = daysRem,
                    interestRate = f.InterestRate,
                    bucket,
                    branchId = f.BranchID
                });
            }

            foreach (var r in rdMatList)
            {
                int daysRem = (r.MaturityDate.Date - today).Days;
                string bucket = (r.Status == "Matured" || daysRem < 0)
                    ? "MATURED_UNCLOSED"
                    : daysRem <= 7 ? "UPCOMING_7" : "UPCOMING_30";
                if (bucket == "MATURED_UNCLOSED") maturedUnclosedTotal++;

                maturityItems.Add(new
                {
                    id = $"mat_rd_{r.RdAccountID}",
                    productType = "RD",
                    accountNo = r.AccountNo,
                    customerName = r.Customer?.FullName ?? "ग्राहक",
                    phone = r.Customer?.MobileNo ?? string.Empty,
                    schemeName = r.RdScheme?.SchemeName ?? "आवर्ती ठेव (RD)",
                    principalAmount = r.TotalDepositedAmount,
                    maturityAmount = r.MaturityAmount,
                    maturityDate = FormatDisplayDate(r.MaturityDate),
                    daysRemaining = daysRem,
                    interestRate = r.InterestRate,
                    bucket,
                    branchId = r.BranchID
                });
            }

            // 5. Field Agents Control & Today's 4-Product Collections
            var agentsQuery = _context.PigmyAgents.AsNoTracking()
                .Include(a => a.Branch)
                .Include(a => a.Customer)
                .AsQueryable();
            if (effectiveBranchId.HasValue)
            {
                int bid = effectiveBranchId.Value;
                agentsQuery = agentsQuery.Where(a => a.BranchID == bid);
            }
            var activeAgents = await agentsQuery.OrderBy(a => a.AgentName).ToListAsync();
            var agentIds = activeAgents.Select(a => a.PigmyAgentID).ToList();

            var agentPigmyAccounts = await _context.PigmyAccounts.AsNoTracking()
                .Where(p => p.Status != "Closed" && agentIds.Contains(p.PigmyAgentID))
                .Select(p => new { p.PigmyAgentID, p.PigmyAccountID, p.DailyDepositAmount })
                .ToListAsync();

            var todayPigmyCols = await _context.PigmyCollections.AsNoTracking()
                .Include(c => c.PigmyAccount!).ThenInclude(a => a.Customer)
                .Include(c => c.Agent)
                .Where(c => c.CollectionDate >= today && c.CollectionDate < tomorrow && agentIds.Contains(c.AgentId))
                .OrderByDescending(c => c.CollectionId)
                .ToListAsync();

            var todayLoanCols = await _context.LoanCollections.AsNoTracking()
                .Include(c => c.LoanAccount!).ThenInclude(a => a.Customer)
                .Include(c => c.Agent)
                .Where(c => c.CollectionDate >= today && c.CollectionDate < tomorrow && c.AgentID.HasValue && agentIds.Contains(c.AgentID.Value))
                .OrderByDescending(c => c.LoanCollectionID)
                .ToListAsync();

            var todaySavingCols = await _context.SavingTransactions.AsNoTracking()
                .Include(t => t.SavingAccount)
                .Include(t => t.Customer)
                .Include(t => t.Agent)
                .Where(t => t.TransactionDate >= today && t.TransactionDate < tomorrow && t.AgentID.HasValue && agentIds.Contains(t.AgentID.Value) && t.TransactionType == "Deposit")
                .OrderByDescending(t => t.TransactionID)
                .ToListAsync();

            var todayRdCols = await _context.RdTransactions.AsNoTracking()
                .Include(t => t.RdAccount!).ThenInclude(a => a.Customer)
                .Include(t => t.Agent)
                .Where(t => t.TransactionDate >= today && t.TransactionDate < tomorrow && t.AgentID.HasValue && agentIds.Contains(t.AgentID.Value) && t.DebitCredit == "Cr")
                .OrderByDescending(t => t.RdTransactionID)
                .ToListAsync();

            var lastRemittances = await _context.PigmyAgentCashDeposits.AsNoTracking()
                .Where(d => agentIds.Contains(d.AgentId))
                .GroupBy(d => d.AgentId)
                .Select(g => new { AgentId = g.Key, LastDate = g.Max(x => x.DepositDate) })
                .ToDictionaryAsync(x => x.AgentId, x => x.LastDate);

            var agentControlList = new List<object>();
            decimal totalPendingFieldCash = 0m;
            int lockedAgentsCount = 0;
            decimal todayCashCollection = 0m;
            decimal todayUpiCollection = 0m;

            static bool IsCashMode(string? mode) =>
                string.IsNullOrWhiteSpace(mode) || mode.Trim().Equals("CASH", StringComparison.OrdinalIgnoreCase);

            foreach (var agt in activeAgents)
            {
                int aid = agt.PigmyAgentID;
                var agtAccs = agentPigmyAccounts.Where(p => p.PigmyAgentID == aid).ToList();
                var agtPig = todayPigmyCols.Where(c => c.AgentId == aid).ToList();
                var agtLn = todayLoanCols.Where(c => c.AgentID == aid).ToList();
                var agtSav = todaySavingCols.Where(t => t.AgentID == aid).ToList();
                var agtRd = todayRdCols.Where(t => t.AgentID == aid).ToList();

                decimal agtCash = agtPig.Where(c => IsCashMode(c.PaymentMode)).Sum(c => c.CollectionAmount)
                    + agtLn.Where(c => IsCashMode(c.PaymentMode)).Sum(c => c.TotalAmountReceived)
                    + agtSav.Where(t => IsCashMode(t.PaymentMode)).Sum(t => t.Amount)
                    + agtRd.Sum(t => t.PrincipalAmount);

                decimal agtUpi = agtPig.Where(c => !IsCashMode(c.PaymentMode)).Sum(c => c.CollectionAmount)
                    + agtLn.Where(c => !IsCashMode(c.PaymentMode)).Sum(c => c.TotalAmountReceived)
                    + agtSav.Where(t => !IsCashMode(t.PaymentMode)).Sum(t => t.Amount);

                decimal agtTodayTotal = agtCash + agtUpi;
                todayCashCollection += agtCash;
                todayUpiCollection += agtUpi;

                var lockResult = await _agentLockService.GetLockStatusAsync(aid);
                bool isLocked = agt.IsLocked
                    || string.Equals(agt.Status, "Locked", StringComparison.OrdinalIgnoreCase)
                    || lockResult.IsLocked;

                decimal cashInHand = Math.Max(0m, lockResult.PendingCash);
                totalPendingFieldCash += cashInHand;
                if (isLocked) lockedAgentsCount++;

                int collectedUniquePigmy = agtPig.Select(c => c.PigmyAccountId).Distinct().Count();
                int pendingCusts = Math.Max(0, agtAccs.Count - collectedUniquePigmy);
                decimal todayTarget = agtAccs.Sum(a => a.DailyDepositAmount);
                string lastRemit = lastRemittances.TryGetValue(aid, out var lrd)
                    ? FormatDisplayDate(lrd)
                    : "-";

                agentControlList.Add(new
                {
                    id = $"agt_{aid}",
                    agentId = aid,
                    name = agt.AgentName,
                    phone = agt.Customer?.MobileNo ?? string.Empty,
                    assignedCustomersCount = agtAccs.Count,
                    todayTargetAmount = todayTarget,
                    todayCollectedAmount = agtTodayTotal,
                    pendingCustomersCount = pendingCusts,
                    status = isLocked ? "OFFLINE" : (agtTodayTotal > 0 ? "ACTIVE" : "ON_FIELD"),
                    branchId = agt.BranchID ?? 1,
                    branchName = agt.Branch?.BranchName ?? (agt.BranchID.HasValue && branchLookup.TryGetValue(agt.BranchID.Value, out var abn) ? abn : "मुख्य शाखा"),
                    cashInHand,
                    cashLimit = agt.MaxCashLimit > 0 ? agt.MaxCashLimit : 20000m,
                    todayCashAmount = agtCash,
                    todayUpiAmount = agtUpi,
                    isLocked,
                    lastRemittanceDate = lastRemit
                });
            }

            // Recent collections combined across all 4 products
            var recentCollectionsRaw = new List<(DateTime SortTime, object Item)>();
            foreach (var c in todayPigmyCols.Take(30))
            {
                recentCollectionsRaw.Add((c.CreatedOn, new
                {
                    id = $"pg_{c.CollectionId}",
                    receiptNo = c.ReceiptNo,
                    accountNumber = c.PigmyAccount?.AccountNo ?? string.Empty,
                    customerName = c.PigmyAccount?.Customer?.FullName ?? "ग्राहक",
                    agentId = $"agt_{c.AgentId}",
                    agentName = c.Agent?.AgentName ?? string.Empty,
                    amount = c.CollectionAmount,
                    productType = "PIGMY",
                    paymentMode = IsCashMode(c.PaymentMode) ? "CASH" : "UPI",
                    timestamp = c.CollectionDate.ToString("o")
                }));
            }
            foreach (var c in todayLoanCols.Take(20))
            {
                recentCollectionsRaw.Add((c.CollectionDate, new
                {
                    id = $"ln_{c.LoanCollectionID}",
                    receiptNo = c.ReceiptNo ?? $"LN-{c.LoanCollectionID}",
                    accountNumber = c.LoanAccount?.LoanAccountNo ?? string.Empty,
                    customerName = c.LoanAccount?.Customer?.FullName ?? "ग्राहक",
                    agentId = $"agt_{c.AgentID ?? 0}",
                    agentName = c.Agent?.AgentName ?? string.Empty,
                    amount = c.TotalAmountReceived,
                    productType = "LOAN",
                    paymentMode = IsCashMode(c.PaymentMode) ? "CASH" : "UPI",
                    timestamp = c.CollectionDate.ToString("o")
                }));
            }
            foreach (var t in todaySavingCols.Take(20))
            {
                recentCollectionsRaw.Add((t.CreatedOn, new
                {
                    id = $"sb_{t.TransactionID}",
                    receiptNo = t.VoucherNo ?? $"SB-{t.TransactionID}",
                    accountNumber = t.SavingAccount?.AccountNo ?? string.Empty,
                    customerName = t.Customer?.FullName ?? "ग्राहक",
                    agentId = $"agt_{t.AgentID ?? 0}",
                    agentName = t.Agent?.AgentName ?? string.Empty,
                    amount = t.Amount,
                    productType = "SAVING",
                    paymentMode = IsCashMode(t.PaymentMode) ? "CASH" : "UPI",
                    timestamp = t.TransactionDate.ToString("o")
                }));
            }
            foreach (var t in todayRdCols.Take(20))
            {
                recentCollectionsRaw.Add((t.CreatedDate, new
                {
                    id = $"rd_{t.RdTransactionID}",
                    receiptNo = t.InstallmentNo.HasValue ? $"RD-#{t.InstallmentNo.Value}" : $"RD-{t.RdTransactionID}",
                    accountNumber = t.RdAccount?.AccountNo ?? string.Empty,
                    customerName = t.RdAccount?.Customer?.FullName ?? "ग्राहक",
                    agentId = $"agt_{t.AgentID ?? 0}",
                    agentName = t.Agent?.AgentName ?? string.Empty,
                    amount = t.PrincipalAmount,
                    productType = "RD",
                    paymentMode = "CASH",
                    timestamp = t.TransactionDate.ToString("o")
                }));
            }

            var recentCollections = recentCollectionsRaw
                .OrderByDescending(x => x.SortTime)
                .Take(40)
                .Select(x => x.Item)
                .ToList();

            int todaysReceiptsCount = todayPigmyCols.Count + todayLoanCols.Count + todaySavingCols.Count + todayRdCols.Count;

            // 6. Branch Daybook & Cashier Cash
            var cashierQ = _context.CashierBalances.AsNoTracking()
                .Where(cb => cb.BalanceDate >= today && cb.BalanceDate < tomorrow);
            var voucherTodayQ = _context.Vouchers.AsNoTracking()
                .Where(v => v.VoucherDate >= today && v.VoucherDate < tomorrow && v.Status == "Approved");
            if (effectiveBranchId.HasValue)
            {
                int bid = effectiveBranchId.Value;
                cashierQ = cashierQ.Where(cb => cb.BranchId == bid);
                voucherTodayQ = voucherTodayQ.Where(v => v.BranchID == bid);
            }

            decimal openingCash = await cashierQ.SumAsync(cb => (decimal?)cb.OpeningBalance) ?? 0m;
            decimal cashierReceipts = await cashierQ.SumAsync(cb => (decimal?)cb.TotalReceipts) ?? 0m;
            decimal cashierPayments = await cashierQ.SumAsync(cb => (decimal?)cb.TotalPayments) ?? 0m;
            decimal cashierClosing = await cashierQ.SumAsync(cb => (decimal?)cb.ClosingBalance) ?? 0m;

            decimal voucherReceipts = await voucherTodayQ
                .Where(v => v.VoucherType == "Receipt")
                .SumAsync(v => (decimal?)v.TotalAmount) ?? 0m;
            decimal voucherPayments = await voucherTodayQ
                .Where(v => v.VoucherType == "Payment")
                .SumAsync(v => (decimal?)v.TotalAmount) ?? 0m;

            decimal todayReceipts = Math.Max(cashierReceipts, voucherReceipts + todayCashCollection + todayUpiCollection);
            decimal todayPayments = Math.Max(cashierPayments, voucherPayments);
            decimal branchCashInHand = cashierClosing > 0m
                ? cashierClosing
                : Math.Max(0m, openingCash + todayReceipts - todayPayments);

            // 7. Unified Approvals Hub (KYC + Vouchers + Customer Service Requests)
            var approvals = new List<object>();
            int pendingVouchersCount = 0;

            var kycQ = _context.AgentCustomerRequests.AsNoTracking()
                .Include(r => r.Branch)
                .Where(r => r.Status == "Pending" || (r.ApprovalDate.HasValue && r.ApprovalDate.Value >= today));
            var vchQ = _context.Vouchers.AsNoTracking()
                .Include(v => v.Branch)
                .Where(v => v.TotalAmount > 0 && (v.Status == "Pending" || (v.ApprovedOn.HasValue && v.ApprovedOn.Value >= today)));
            var custReqQ = _context.CustomerServiceRequests.AsNoTracking()
                .Include(c => c.Customer)
                .Include(c => c.Branch)
                .Where(c => c.Status == "PENDING" || (c.ReviewedOn.HasValue && c.ReviewedOn.Value >= today));

            if (effectiveBranchId.HasValue)
            {
                int bid = effectiveBranchId.Value;
                kycQ = kycQ.Where(r => r.BranchID == bid);
                vchQ = vchQ.Where(v => v.BranchID == bid);
                custReqQ = custReqQ.Where(c => c.BranchID == bid);
            }

            var kycItems = await kycQ.OrderByDescending(r => r.RequestID).Take(30).ToListAsync();
            foreach (var r in kycItems)
            {
                string normStatus = NormalizeApprovalStatus(r.Status);
                string fullName = string.Join(" ", new[] { r.FirstName, r.MiddleName, r.LastName }.Where(s => !string.IsNullOrWhiteSpace(s))).Trim();
                approvals.Add(new
                {
                    id = $"KYC:{r.RequestID}",
                    category = "CUSTOMER_KYC",
                    title = string.IsNullOrWhiteSpace(fullName) ? $"ग्राहक अर्ज #{r.RequestID}" : fullName,
                    subtitle = "एजंटकडून नवीन ग्राहक KYC व पिग्मी खाते अर्ज",
                    amount = r.DailyDepositAmount > 0 ? r.DailyDepositAmount : r.InitialDepositAmount,
                    requestedBy = string.IsNullOrWhiteSpace(r.AgentName) ? "पिग्मी एजंट" : $"{r.AgentName} (एजंट)",
                    requestedAt = FormatDisplayDate(r.RequestDate),
                    branchId = r.BranchID,
                    branchName = r.Branch?.BranchName ?? (branchLookup.TryGetValue(r.BranchID, out var kb) ? kb : "मुख्य शाखा"),
                    status = normStatus,
                    remarks = r.RejectionReason ?? r.Remarks,
                    details = new object[]
                    {
                        new { label = "मोबाईल क्र.", value = r.MobileNo ?? "-" },
                        new { label = "दैनिक ठेव", value = $"₹{r.DailyDepositAmount:N0}" },
                        new { label = "गाव / पत्ता", value = r.Village ?? r.Address ?? "-" },
                        new { label = "आधार", value = MaskTail(r.AadhaarNo, 4) }
                    }
                });
            }

            var vchItems = await vchQ.OrderByDescending(v => v.VoucherID).Take(30).ToListAsync();
            foreach (var v in vchItems)
            {
                string normStatus = NormalizeApprovalStatus(v.Status);
                if (normStatus == "PENDING") pendingVouchersCount++;
                approvals.Add(new
                {
                    id = $"VOUCHER:{v.VoucherID}",
                    category = "VOUCHER",
                    title = $"{v.VoucherType} व्हाउचर #{v.VoucherNo}",
                    subtitle = string.IsNullOrWhiteSpace(v.Narration) ? "मेकर-चेकर व्हाउचर मंजुरी" : v.Narration,
                    amount = v.TotalAmount,
                    requestedBy = $"स्टाफ युजर #{v.CreatedBy}",
                    requestedAt = FormatDisplayDate(v.VoucherDate),
                    branchId = v.BranchID,
                    branchName = v.Branch?.BranchName ?? (branchLookup.TryGetValue(v.BranchID, out var vb) ? vb : "मुख्य शाखा"),
                    status = normStatus,
                    remarks = v.RejectionReason,
                    details = new object[]
                    {
                        new { label = "व्हाउचर क्र.", value = v.VoucherNo },
                        new { label = "प्रकार", value = v.VoucherType },
                        new { label = "दिनांक", value = FormatDisplayDate(v.VoucherDate) },
                        new { label = "रक्कम", value = $"₹{v.TotalAmount:N0}" }
                    }
                });
            }

            var custReqItems = await custReqQ.OrderByDescending(c => c.RequestID).Take(30).ToListAsync();
            foreach (var c in custReqItems)
            {
                string normStatus = NormalizeApprovalStatus(c.Status);
                string category = string.Equals(c.RequestType, "LOAN_APPLY", StringComparison.OrdinalIgnoreCase)
                    ? "LOAN_APP"
                    : "CUSTOMER_KYC";
                string custName = c.Customer?.FullName ?? $"खातेदार #{c.CustomerID}";
                approvals.Add(new
                {
                    id = $"CUST_REQ:{c.RequestID}",
                    category,
                    title = $"{custName} — {c.Title}",
                    subtitle = string.IsNullOrWhiteSpace(c.Subtitle) ? "खातेदार अ‍ॅपवरून सेवा विनंती" : c.Subtitle,
                    amount = c.Amount ?? 0m,
                    requestedBy = $"{custName} (खातेदार)",
                    requestedAt = FormatDisplayDate(c.CreatedOn),
                    branchId = c.BranchID,
                    branchName = c.Branch?.BranchName ?? (branchLookup.TryGetValue(c.BranchID, out var cb) ? cb : "मुख्य शाखा"),
                    status = normStatus,
                    remarks = c.Remarks,
                    details = new object[]
                    {
                        new { label = "संदर्भ क्र.", value = c.ReferenceNo },
                        new { label = "CIF क्र.", value = c.Customer?.CIFNo ?? "-" },
                        new { label = "मोबाईल क्र.", value = c.Customer?.MobileNo ?? "-" },
                        new { label = "विनंती प्रकार", value = c.RequestType }
                    }
                });
            }

            // 8. EOD Readiness Checklist
            var eodChecklist = new object[]
            {
                new
                {
                    id = "eod_vouchers",
                    label = "व्हाउचर पोस्टिंग (Maker-Checker)",
                    status = pendingVouchersCount == 0 ? "OK" : "WARNING",
                    detail = pendingVouchersCount == 0
                        ? "सर्व व्हाउचर्स तपासले व मंजूर केले आहेत"
                        : $"{pendingVouchersCount} व्हाउचर मंजुरीच्या प्रतीक्षेत"
                },
                new
                {
                    id = "eod_agent_cash",
                    label = "एजंट रोख जमा (Remittance)",
                    status = totalPendingFieldCash == 0m && lockedAgentsCount == 0 ? "OK" : "WARNING",
                    detail = totalPendingFieldCash == 0m
                        ? "सर्व एजंटकडील रोख शाखेत जमा झाली आहे"
                        : $"₹{totalPendingFieldCash:N0} रोख फिल्डवर प्रलंबित" + (lockedAgentsCount > 0 ? $" ({lockedAgentsCount} लॉक)" : string.Empty)
                },
                new
                {
                    id = "eod_cash_tally",
                    label = "शाखा रोख ताळेबंद (Cash Tally)",
                    status = "OK",
                    detail = $"शाखा रोख शिल्लक ₹{branchCashInHand:N0} (Live CBS)"
                },
                new
                {
                    id = "eod_fd_matured",
                    label = "मॅच्युअर अनक्लोज्ड FD/RD खाती",
                    status = maturedUnclosedTotal == 0 ? "OK" : "WARNING",
                    detail = maturedUnclosedTotal == 0
                        ? "कोणतीही मुदतबाह्य FD/RD प्रलंबित नाही"
                        : $"{maturedUnclosedTotal} खाती मुदत पूर्ण होऊनही नूतनीकरण/बंद बाकी"
                }
            };

            string effectiveEodStatus = "OPEN";
            if (effectiveBranchId.HasValue)
            {
                var curEod = eodRows.FirstOrDefault(e => e.BranchID == effectiveBranchId.Value && e.BusinessDate.Date == today);
                if (curEod?.IsDayClosed == true) effectiveEodStatus = "CLOSED";
                else if (pendingVouchersCount > 0 || totalPendingFieldCash > 0m) effectiveEodStatus = "PENDING";
            }
            else if (pendingVouchersCount > 0 || totalPendingFieldCash > 0m)
            {
                effectiveEodStatus = "PENDING";
            }

            return Ok(new
            {
                branches = branchOptions,
                portfolio = new
                {
                    branchId = effectiveBranchId.HasValue ? (object)effectiveBranchId.Value : "ALL",
                    branchName = selectedBranchName,
                    businessDate = FormatDisplayDate(today),
                    eodStatus = effectiveEodStatus,
                    totalDeposits,
                    totalLoanOutstanding = loanOutstanding,
                    totalLoanOverdue,
                    npaPercent,
                    cdRatioPercent,
                    branchCashInHand,
                    openingCash,
                    todayReceipts,
                    todayPayments,
                    todayCashCollection,
                    todayUpiCollection,
                    todaysReceiptsCount,
                    totalMembers,
                    fd = new
                    {
                        activeAccounts = fdActive,
                        totalBalance = fdBalance,
                        extraLabel = "मॅच्युअर बाकी",
                        extraValue = $"{fdMaturedUnclosed} खाती"
                    },
                    saving = new
                    {
                        activeAccounts = savingActive,
                        totalBalance = savingBalance
                    },
                    pigmy = new
                    {
                        activeAccounts = pigmyActive,
                        totalBalance = pigmyBalance,
                        extraLabel = "आज संकलन",
                        extraValue = $"₹{(todayCashCollection + todayUpiCollection):N0}"
                    },
                    rd = new
                    {
                        activeAccounts = rdActive,
                        totalBalance = rdBalance
                    },
                    loan = new
                    {
                        activeAccounts = loanActive,
                        totalBalance = loanOutstanding,
                        extraLabel = "थकबाकी",
                        extraValue = $"₹{totalLoanOverdue:N0}"
                    },
                    shares = new
                    {
                        activeAccounts = shareActive,
                        totalBalance = shareBalance,
                        extraLabel = "सभासद",
                        extraValue = totalMembers.ToString()
                    }
                },
                approvals,
                agents = agentControlList,
                overdueLoans,
                maturityItems,
                eodChecklist,
                recentCollections
            });
        }

        // POST /api/mobile-manager/approvals/{source}/{id}/decision
        [HttpPost("approvals/{source}/{id:int}/decision")]
        public async Task<IActionResult> DecideApproval(string source, int id, [FromBody] ManagerApprovalDecisionDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Status))
            {
                return BadRequest(new { message = "कृपया वैध निर्णय (APPROVED / REJECTED / HOLD) निवडा." });
            }

            string normalized = dto.Status.Trim().ToUpperInvariant();
            if (normalized != "APPROVED" && normalized != "REJECTED" && normalized != "HOLD")
            {
                return BadRequest(new { message = "अवैध निर्णय स्टेटस. केवळ APPROVED, REJECTED किंवा HOLD अनुमत आहे." });
            }

            string src = (source ?? string.Empty).Trim().ToUpperInvariant();
            int userId = ResolveUserId();
            bool isHo = User.IsHeadOfficeAdmin();
            int userBranchId = User.GetOperatingBranchId();
            DateTime now = DateTime.UtcNow;

            if (src == "KYC")
            {
                var req = await _context.AgentCustomerRequests.FirstOrDefaultAsync(r => r.RequestID == id);
                if (req == null) return NotFound(new { message = "ग्राहक KYC अर्ज आढळला नाही." });
                if (!isHo && req.BranchID != userBranchId) return Forbid();

                req.Status = normalized == "APPROVED" ? "Approved" : normalized == "REJECTED" ? "Rejected" : "Pending";
                req.ApprovedByUserID = userId;
                req.ApprovalDate = now;
                if (!string.IsNullOrWhiteSpace(dto.Remarks))
                {
                    req.RejectionReason = dto.Remarks.Trim();
                }
                await _context.SaveChangesAsync();
                return Ok(new { success = true, id = $"KYC:{req.RequestID}", status = normalized, message = "ग्राहक KYC अर्जाचा निर्णय जतन झाला!" });
            }

            if (src == "VOUCHER")
            {
                var vch = await _context.Vouchers.FirstOrDefaultAsync(v => v.VoucherID == id);
                if (vch == null) return NotFound(new { message = "व्हाउचर आढळले नाही." });
                if (!isHo && vch.BranchID != userBranchId) return Forbid();

                vch.Status = normalized == "APPROVED" ? "Approved" : normalized == "REJECTED" ? "Rejected" : "Pending";
                vch.ApprovedBy = userId;
                vch.ApprovedOn = now;
                if (!string.IsNullOrWhiteSpace(dto.Remarks))
                {
                    vch.RejectionReason = dto.Remarks.Trim();
                }
                await _context.SaveChangesAsync();
                return Ok(new { success = true, id = $"VOUCHER:{vch.VoucherID}", status = normalized, message = "व्हाउचर मंजुरी निर्णय जतन झाला!" });
            }

            if (src == "CUST_REQ")
            {
                var creq = await _context.CustomerServiceRequests.FirstOrDefaultAsync(c => c.RequestID == id);
                if (creq == null) return NotFound(new { message = "खातेदार सेवा विनंती आढळली नाही." });
                if (!isHo && creq.BranchID != userBranchId) return Forbid();

                creq.Status = normalized == "APPROVED" ? "APPROVED" : normalized == "REJECTED" ? "REJECTED" : "PENDING";
                creq.ReviewedByUserID = userId;
                creq.ReviewedOn = now;
                if (!string.IsNullOrWhiteSpace(dto.Remarks))
                {
                    creq.Remarks = dto.Remarks.Trim();
                }
                await _context.SaveChangesAsync();
                return Ok(new { success = true, id = $"CUST_REQ:{creq.RequestID}", status = creq.Status, message = "खातेदार विनंतीचा निर्णय जतन झाला!" });
            }

            return BadRequest(new { message = "अवैध मंजुरी स्रोत (KYC / VOUCHER / CUST_REQ)." });
        }

        // POST /api/mobile-manager/agents/{agentId}/toggle-lock
        [HttpPost("agents/{agentId:int}/toggle-lock")]
        public async Task<IActionResult> ToggleAgentLock(int agentId)
        {
            var agent = await _context.PigmyAgents.FirstOrDefaultAsync(a => a.PigmyAgentID == agentId);
            if (agent == null) return NotFound(new { message = "पिग्मी एजंट आढळला नाही." });

            bool isHo = User.IsHeadOfficeAdmin();
            if (!isHo && agent.BranchID.HasValue && agent.BranchID.Value != User.GetOperatingBranchId())
            {
                return Forbid();
            }

            bool currentlyLocked = agent.IsLocked || string.Equals(agent.Status, "Locked", StringComparison.OrdinalIgnoreCase);
            agent.IsLocked = !currentlyLocked;
            agent.Status = agent.IsLocked ? "Locked" : "Active";
            if (!agent.IsLocked)
            {
                agent.FailedLoginAttempts = 0;
            }
            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                agentId = agent.PigmyAgentID,
                isLocked = agent.IsLocked,
                status = agent.Status,
                message = agent.IsLocked
                    ? $"{agent.AgentName} यांची वसुली तात्पुरती लॉक केली आहे."
                    : $"{agent.AgentName} यांना वसुलीसाठी अनलॉक केले आहे."
            });
        }

        // POST /api/mobile-manager/agents/{agentId}/remit-cash
        [HttpPost("agents/{agentId:int}/remit-cash")]
        public async Task<IActionResult> RemitAgentCash(int agentId, [FromBody] ManagerAgentRemitDto dto)
        {
            if (dto == null || dto.Amount <= 0m)
            {
                return BadRequest(new { message = "कृपया शून्यापेक्षा जास्त वैध रोख रक्कम प्रविष्ट करा." });
            }

            var agent = await _context.PigmyAgents.FirstOrDefaultAsync(a => a.PigmyAgentID == agentId);
            if (agent == null) return NotFound(new { message = "पिग्मी एजंट आढळला नाही." });

            bool isHo = User.IsHeadOfficeAdmin();
            if (!isHo && agent.BranchID.HasValue && agent.BranchID.Value != User.GetOperatingBranchId())
            {
                return Forbid();
            }

            DateTime today = GetIstToday();
            string receiptNo = $"REM-{agentId}-{DateTime.UtcNow:yyyyMMddHHmmss}";

            var deposit = new PigmyAgentCashDeposit
            {
                AgentId = agentId,
                DepositDate = today,
                Amount = dto.Amount,
                ReceiptNo = receiptNo,
                Narration = string.IsNullOrWhiteSpace(dto.Narration)
                    ? $"मॅनेजर मोबाईल अ‍ॅपद्वारे रोख जमा ({agent.AgentName})"
                    : dto.Narration.Trim(),
                PaymentMode = string.IsNullOrWhiteSpace(dto.PaymentMode) ? "CASH" : dto.PaymentMode.Trim().ToUpperInvariant(),
                CreatedBy = ResolveUserId(),
                CreatedOn = DateTime.UtcNow
            };

            _context.PigmyAgentCashDeposits.Add(deposit);
            await _context.SaveChangesAsync();

            var updatedLock = await _agentLockService.GetLockStatusAsync(agentId);
            if (updatedLock.PendingCash <= (agent.MaxCashLimit > 0 ? agent.MaxCashLimit : 20000m) && agent.IsLocked)
            {
                agent.IsLocked = false;
                agent.Status = "Active";
                await _context.SaveChangesAsync();
                updatedLock = await _agentLockService.GetLockStatusAsync(agentId);
            }

            return Ok(new
            {
                success = true,
                depositId = deposit.DepositId,
                receiptNo = deposit.ReceiptNo,
                amount = deposit.Amount,
                remainingCash = Math.Max(0m, updatedLock.PendingCash),
                isLocked = agent.IsLocked || updatedLock.IsLocked,
                message = $"{agent.AgentName} कडून ₹{dto.Amount:N0} रोख जमा यशस्वीरीत्या नोंदवली!"
            });
        }

        private static string NormalizeApprovalStatus(string? raw)
        {
            string s = (raw ?? "PENDING").Trim().ToUpperInvariant();
            return s switch
            {
                "APPROVED" or "COMPLETED" => "APPROVED",
                "REJECTED" => "REJECTED",
                "HOLD" => "HOLD",
                _ => "PENDING"
            };
        }

        private static string MaskTail(string? value, int visibleDigits)
        {
            if (string.IsNullOrWhiteSpace(value)) return "-";
            string clean = value.Trim();
            if (clean.Length <= visibleDigits) return clean;
            return new string('X', clean.Length - visibleDigits) + clean[^visibleDigits..];
        }
    }

    public class ManagerApprovalDecisionDto
    {
        public string Status { get; set; } = string.Empty;
        public string? Remarks { get; set; }
    }

    public class ManagerAgentRemitDto
    {
        public decimal Amount { get; set; }
        public string? Narration { get; set; }
        public string? PaymentMode { get; set; }
    }
}
