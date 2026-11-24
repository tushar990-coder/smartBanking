using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class AgentDayBookController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AgentDayBookController(AppDbContext context)
        {
            _context = context;
        }

        public class RemittanceItemDto
        {
            public int DepositId { get; set; }
            public string ReceiptNo { get; set; } = string.Empty;
            public DateTime DepositDate { get; set; }
            public DateTime? CollectionDateFrom { get; set; }
            public DateTime? CollectionDateTo { get; set; }
            public decimal Amount { get; set; }
            public string PaymentMode { get; set; } = "CASH";
            public int? BankLedgerId { get; set; }
            public string Narration { get; set; } = string.Empty;
            public int? VoucherId { get; set; }
            public string? VoucherNo { get; set; }
        }

        public class DayBreakupDto
        {
            public DateTime Date { get; set; }
            public int Count { get; set; }
            public decimal Amount { get; set; }
            public decimal RemittedAmount { get; set; }
            public decimal PendingAmount { get; set; }
            public bool IsRemitted { get; set; }
        }

        public class PigmySchemeBreakupItem
        {
            public int PigmySchemeID { get; set; }
            public string SchemeCode { get; set; } = string.Empty;
            public string SchemeName { get; set; } = string.Empty;
            public int? LiabilityLedgerID { get; set; }
            public string LiabilityLedgerName { get; set; } = string.Empty;
            public int AccountsCount { get; set; }
            public int CollectionsCount { get; set; }
            public decimal CollectedAmount { get; set; }
            public decimal RemittedAmount { get; set; }
            public decimal PendingAmount { get; set; }
        }

        public class DayBookSummary
        {
            public decimal OpeningBalance { get; set; }
            public decimal TodaysCollection { get; set; }
            public decimal CashDeposited { get; set; }
            public decimal ClosingBalance { get; set; }
            public DateTime CollectionDateFrom { get; set; }
            public DateTime CollectionDateTo { get; set; }
            public DateTime DepositDate { get; set; }
            public decimal RangeCollectionAmount { get; set; } // Pending unremitted collection
            public int RangeCollectionCount { get; set; }
            public decimal RangeTotalCollected { get; set; }   // Total collected in this range
            public decimal RangeAlreadyRemitted { get; set; }  // Total already remitted for this range
            public bool IsFullyRemitted { get; set; }
            public decimal TotalPendingCash { get; set; }
            public decimal PigmyRangeAmount { get; set; }
            public decimal LoanRangeAmount { get; set; }
            public decimal SavingRangeAmount { get; set; }
            public decimal RdRangeAmount { get; set; }
            public int ActiveSchemesCount { get; set; }
            public List<PigmySchemeBreakupItem> SchemeBreakup { get; set; } = new List<PigmySchemeBreakupItem>();
            public List<DayBreakupDto> DayBreakup { get; set; } = new List<DayBreakupDto>();
            public List<RemittanceItemDto> RecentRemittances { get; set; } = new List<RemittanceItemDto>();
        }

        private bool IsAgentOnlyCaller(out int tokenAgentId)
        {
            var role = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role)?.Value ?? string.Empty;
            var claimVal = User.Claims.FirstOrDefault(c => c.Type == "agentId" || c.Type == "AgentId")?.Value
                ?? User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)?.Value;
            tokenAgentId = int.TryParse(claimVal, out int id) ? id : 0;
            return string.Equals(role, "AGENT", StringComparison.OrdinalIgnoreCase);
        }

        private static (DateTime? fromDate, DateTime? toDate) GetDepositCollectionRange(PigmyAgentCashDeposit d)
        {
            if (d.CollectionDateFrom.HasValue && d.CollectionDateTo.HasValue)
            {
                return (d.CollectionDateFrom.Value.Date, d.CollectionDateTo.Value.Date);
            }
            if (d.CollectionDateFrom.HasValue)
            {
                return (d.CollectionDateFrom.Value.Date, d.CollectionDateFrom.Value.Date);
            }

            // Extract from Narration if present: "[संकलन: 01/08/2026 ते 02/08/2026]" or "[संकलन: 01/08/2026]"
            if (!string.IsNullOrEmpty(d.Narration) && d.Narration.Contains("[संकलन:"))
            {
                try
                {
                    int startIdx = d.Narration.IndexOf("[संकलन:") + 7;
                    int endIdx = d.Narration.IndexOf("]", startIdx);
                    if (endIdx > startIdx)
                    {
                        string tag = d.Narration.Substring(startIdx, endIdx - startIdx).Trim();
                        if (tag.Contains("ते"))
                        {
                            var parts = tag.Split(new[] { "ते" }, StringSplitOptions.None);
                            if (parts.Length == 2)
                            {
                                bool fOk = DateTime.TryParseExact(parts[0].Trim(), "dd/MM/yyyy", null, System.Globalization.DateTimeStyles.None, out var pFrom)
                                           || DateTime.TryParse(parts[0].Trim(), out pFrom);
                                bool tOk = DateTime.TryParseExact(parts[1].Trim(), "dd/MM/yyyy", null, System.Globalization.DateTimeStyles.None, out var pTo)
                                           || DateTime.TryParse(parts[1].Trim(), out pTo);
                                if (fOk && tOk)
                                {
                                    return (pFrom.Date, pTo.Date);
                                }
                            }
                        }
                        else
                        {
                            if (DateTime.TryParseExact(tag.Trim(), "dd/MM/yyyy", null, System.Globalization.DateTimeStyles.None, out var singleDate)
                                || DateTime.TryParse(tag.Trim(), out singleDate))
                            {
                                return (singleDate.Date, singleDate.Date);
                            }
                        }
                    }
                }
                catch
                {
                    // ignore parse failures
                }
            }

            return (null, null);
        }

        private class DayAllocationItem
        {
            public DateTime Date { get; set; }
            public int Count { get; set; }
            public decimal TotalAmount { get; set; }
            public decimal RemittedAmount { get; set; }
            public decimal PendingAmount => Math.Max(0m, TotalAmount - RemittedAmount);
        }

        private async Task<List<DayAllocationItem>> ComputeAgentDayAllocations(int agentId)
        {
            var pigmyDaily = await _context.PigmyCollections
                .Where(c => c.AgentId == agentId && c.CollectionAmount > 0 &&
                            (c.PaymentMode == null || c.PaymentMode == "" || c.PaymentMode.ToUpper() == "CASH"))
                .GroupBy(c => c.CollectionDate.Date)
                .Select(g => new { Date = g.Key, Count = g.Count(), Amount = g.Sum(x => x.CollectionAmount) })
                .ToListAsync();

            var loanDaily = await _context.LoanCollections
                .Where(c => c.AgentID == agentId && c.CollectionSource == "AGENT_MOBILE" && c.TotalAmountReceived > 0 &&
                            (c.PaymentMode == null || c.PaymentMode == "" || c.PaymentMode.ToUpper() == "CASH"))
                .GroupBy(c => c.CollectionDate.Date)
                .Select(g => new { Date = g.Key, Count = g.Count(), Amount = g.Sum(x => x.TotalAmountReceived) })
                .ToListAsync();

            var savingDaily = await _context.SavingTransactions
                .Where(t => t.AgentID == agentId && t.CollectionSource == "AGENT_MOBILE" && t.TransactionType == "Deposit" && t.Amount > 0 &&
                            (t.PaymentMode == null || t.PaymentMode == "" || t.PaymentMode.ToUpper() == "CASH"))
                .GroupBy(t => t.TransactionDate.Date)
                .Select(g => new { Date = g.Key, Count = g.Count(), Amount = g.Sum(x => x.Amount) })
                .ToListAsync();

            var rdDaily = await _context.RdTransactions
                .Where(t => t.AgentID == agentId && t.CollectionSource == "AGENT_MOBILE" && t.TransactionType == "Installment" && t.PrincipalAmount > 0)
                .GroupBy(t => t.TransactionDate.Date)
                .Select(g => new { Date = g.Key, Count = g.Count(), Amount = g.Sum(x => x.PrincipalAmount) })
                .ToListAsync();

            var dailyCollections = pigmyDaily
                .Concat(loanDaily)
                .Concat(savingDaily)
                .Concat(rdDaily)
                .GroupBy(x => x.Date)
                .Select(g => new
                {
                    Date = g.Key,
                    Count = g.Sum(x => x.Count),
                    Amount = g.Sum(x => x.Amount)
                })
                .OrderBy(x => x.Date)
                .ToList();

            var allocations = dailyCollections.Select(d => new DayAllocationItem
            {
                Date = d.Date,
                Count = d.Count,
                TotalAmount = d.Amount,
                RemittedAmount = 0m
            }).ToList();

            var agentDeposits = await _context.PigmyAgentCashDeposits
                .Where(d => d.AgentId == agentId)
                .OrderBy(d => d.DepositDate)
                .ThenBy(d => d.DepositId)
                .ToListAsync();

            foreach (var d in agentDeposits)
            {
                var (dFrom, dTo) = GetDepositCollectionRange(d);
                decimal unallocatedDeposit = d.Amount;

                if (dFrom.HasValue && dTo.HasValue)
                {
                    // Strict date range: only allocate to dates between dFrom and dTo
                    var targetDays = allocations
                        .Where(a => a.Date >= dFrom.Value && a.Date <= dTo.Value)
                        .OrderBy(a => a.Date);

                    foreach (var target in targetDays)
                    {
                        if (unallocatedDeposit <= 0) break;
                        decimal needed = target.PendingAmount;
                        if (needed > 0)
                        {
                            decimal give = Math.Min(unallocatedDeposit, needed);
                            target.RemittedAmount += give;
                            unallocatedDeposit -= give;
                        }
                    }
                }
                else
                {
                    // Legacy deposit without range: allocate chronologically to unremitted days up to deposit date
                    var targetDays = allocations
                        .Where(a => a.Date <= d.DepositDate.Date)
                        .OrderBy(a => a.Date);

                    foreach (var target in targetDays)
                    {
                        if (unallocatedDeposit <= 0) break;
                        decimal needed = target.PendingAmount;
                        if (needed > 0)
                        {
                            decimal give = Math.Min(unallocatedDeposit, needed);
                            target.RemittedAmount += give;
                            unallocatedDeposit -= give;
                        }
                    }
                }
            }

            return allocations;
        }

        private async Task<(List<PigmySchemeBreakupItem> breakup, int activeSchemesCount)> ComputePigmySchemeBreakupAsync(
            int agentId,
            DateTime effectiveFromDate,
            DateTime effectiveToDate,
            List<DayAllocationItem> rangeAllocations)
        {
            var activeSchemes = await _context.PigmySchemes
                .AsNoTracking()
                .Include(s => s.PigmyLiabilityLedger)
                .Where(s => s.Status == "Active")
                .ToListAsync();

            var rangePigmyCols = await _context.PigmyCollections
                .AsNoTracking()
                .Include(c => c.PigmyAccount)
                    .ThenInclude(a => a!.PigmyScheme)
                        .ThenInclude(s => s!.PigmyLiabilityLedger)
                .Where(c => c.AgentId == agentId &&
                            c.CollectionDate.Date >= effectiveFromDate &&
                            c.CollectionDate.Date <= effectiveToDate &&
                            c.CollectionAmount > 0 &&
                            (c.PaymentMode == null || c.PaymentMode == "" || c.PaymentMode.ToUpper() == "CASH"))
                .ToListAsync();

            if (!rangePigmyCols.Any())
            {
                return (new List<PigmySchemeBreakupItem>(), activeSchemes.Count);
            }

            var depositVoucherIds = (await _context.PigmyAgentCashDeposits
                .AsNoTracking()
                .Where(d => d.AgentId == agentId && d.VoucherId.HasValue)
                .Select(d => d.VoucherId!.Value)
                .ToListAsync()).ToHashSet();

            var linkedLoanByDate = await _context.LoanCollections
                .AsNoTracking()
                .Where(l => l.AgentID == agentId && l.CollectionSource == "AGENT_MOBILE" && l.RemittanceDepositId != null &&
                            l.CollectionDate.Date >= effectiveFromDate && l.CollectionDate.Date <= effectiveToDate &&
                            (l.PaymentMode == null || l.PaymentMode == "" || l.PaymentMode.ToUpper() == "CASH"))
                .GroupBy(l => l.CollectionDate.Date)
                .Select(g => new { Date = g.Key, Amount = g.Sum(x => x.TotalAmountReceived) })
                .ToDictionaryAsync(x => x.Date, x => x.Amount);

            var linkedSavingByDate = await _context.SavingTransactions
                .AsNoTracking()
                .Where(s => s.AgentID == agentId && s.CollectionSource == "AGENT_MOBILE" && s.TransactionType == "Deposit" && s.RemittanceDepositId != null &&
                            s.TransactionDate.Date >= effectiveFromDate && s.TransactionDate.Date <= effectiveToDate &&
                            (s.PaymentMode == null || s.PaymentMode == "" || s.PaymentMode.ToUpper() == "CASH"))
                .GroupBy(s => s.TransactionDate.Date)
                .Select(g => new { Date = g.Key, Amount = g.Sum(x => x.Amount) })
                .ToDictionaryAsync(x => x.Date, x => x.Amount);

            var linkedRdByDate = await _context.RdTransactions
                .AsNoTracking()
                .Where(r => r.AgentID == agentId && r.CollectionSource == "AGENT_MOBILE" && r.TransactionType == "Installment" && r.RemittanceDepositId != null &&
                            r.TransactionDate.Date >= effectiveFromDate && r.TransactionDate.Date <= effectiveToDate)
                .GroupBy(r => r.TransactionDate.Date)
                .Select(g => new { Date = g.Key, Amount = g.Sum(x => x.PrincipalAmount) })
                .ToDictionaryAsync(x => x.Date, x => x.Amount);

            var allocByDate = rangeAllocations.ToDictionary(a => a.Date, a => a);

            var schemeAgg = new Dictionary<int, (PigmySchemeBreakupItem Item, HashSet<int> AccountIds)>();

            foreach (var dayGroup in rangePigmyCols.GroupBy(c => c.CollectionDate.Date))
            {
                DateTime dDate = dayGroup.Key;
                var dayCols = dayGroup.ToList();

                bool IsColExplicitlyRemitted(PigmyCollection c) =>
                    c.RemittanceDepositId.HasValue ||
                    (c.IsVoucherGenerated && c.VoucherId.HasValue && depositVoucherIds.Contains(c.VoucherId.Value));

                decimal explicitLinkedPigmy = dayCols.Where(IsColExplicitlyRemitted).Sum(c => c.CollectionAmount);
                decimal explicitLinkedNonPigmy =
                    (linkedLoanByDate.TryGetValue(dDate, out var lAmt) ? lAmt : 0m) +
                    (linkedSavingByDate.TryGetValue(dDate, out var sAmt) ? sAmt : 0m) +
                    (linkedRdByDate.TryGetValue(dDate, out var rAmt) ? rAmt : 0m);

                var unlinkedCols = dayCols.Where(c => !IsColExplicitlyRemitted(c)).ToList();
                decimal unlinkedPigmyTotal = unlinkedCols.Sum(c => c.CollectionAmount);

                decimal dayRemittedTotal = allocByDate.TryGetValue(dDate, out var da) ? da.RemittedAmount : 0m;
                decimal partialPigmyRemittedOnDay = Math.Max(0m, dayRemittedTotal - explicitLinkedPigmy - explicitLinkedNonPigmy);
                decimal unlinkedPendingRatio = unlinkedPigmyTotal > 0m
                    ? Math.Clamp((unlinkedPigmyTotal - partialPigmyRemittedOnDay) / unlinkedPigmyTotal, 0m, 1m)
                    : 0m;

                foreach (var col in dayCols)
                {
                    var scheme = col.PigmyAccount?.PigmyScheme;
                    int sId = scheme?.PigmySchemeID ?? col.PigmyAccount?.PigmySchemeID ?? 0;

                    if (!schemeAgg.TryGetValue(sId, out var bucket))
                    {
                        var item = new PigmySchemeBreakupItem
                        {
                            PigmySchemeID = sId,
                            SchemeCode = scheme?.SchemeCode ?? (sId > 0 ? sId.ToString("D3") : "-"),
                            SchemeName = scheme?.SchemeName ?? (sId > 0 ? $"पिग्मी योजना #{sId}" : "अनिर्दिष्ट योजना"),
                            LiabilityLedgerID = scheme?.PigmyLiabilityLedgerID,
                            LiabilityLedgerName = scheme?.PigmyLiabilityLedger?.LedgerName ?? (scheme?.PigmyLiabilityLedgerID.HasValue == true ? $"लेजर #{scheme.PigmyLiabilityLedgerID}" : "(लेजर मॅप नाही)")
                        };
                        bucket = (item, new HashSet<int>());
                        schemeAgg[sId] = bucket;
                    }

                    bucket.Item.CollectionsCount++;
                    bucket.AccountIds.Add(col.PigmyAccountId);
                    bucket.Item.CollectedAmount += col.CollectionAmount;

                    decimal pendingShare = IsColExplicitlyRemitted(col)
                        ? 0m
                        : Math.Round(col.CollectionAmount * unlinkedPendingRatio, 2, MidpointRounding.AwayFromZero);

                    bucket.Item.PendingAmount += pendingShare;
                    bucket.Item.RemittedAmount += (col.CollectionAmount - pendingShare);
                }
            }

            var breakup = schemeAgg.Values.Select(v =>
            {
                v.Item.AccountsCount = v.AccountIds.Count;
                v.Item.CollectedAmount = Math.Round(v.Item.CollectedAmount, 2, MidpointRounding.AwayFromZero);
                v.Item.RemittedAmount = Math.Round(v.Item.RemittedAmount, 2, MidpointRounding.AwayFromZero);
                v.Item.PendingAmount = Math.Max(0m, Math.Round(v.Item.CollectedAmount - v.Item.RemittedAmount, 2, MidpointRounding.AwayFromZero));
                return v.Item;
            }).OrderBy(x => x.PigmySchemeID).ToList();

            return (breakup, activeSchemes.Count);
        }

        // GET: api/AgentDayBook/Summary/5/2024-03-20
        // GET: api/AgentDayBook/Summary/5?fromDate=2024-03-01&toDate=2024-03-05&depositDate=2024-03-06
        [HttpGet("Summary/{agentId}/{date?}")]
        [HttpGet("Summary/{agentId}")]
        public async Task<ActionResult<DayBookSummary>> GetSummary(
            int agentId, 
            DateTime? date, 
            [FromQuery] DateTime? fromDate, 
            [FromQuery] DateTime? toDate, 
            [FromQuery] DateTime? depositDate)
        {
            if (IsAgentOnlyCaller(out int tokenAgentId) && tokenAgentId != agentId)
            {
                return StatusCode(403, "आपण फक्त स्वतःचे डे-बुक पाहू शकता.");
            }

            var agentExists = await _context.PigmyAgents.AnyAsync(a => a.PigmyAgentID == agentId);
            if (!agentExists) return NotFound("Agent not found.");

            var effectiveDepositDate = (depositDate ?? date ?? DateTime.Today).Date;
            var effectiveFromDate = (fromDate ?? date ?? DateTime.Today).Date;
            var effectiveToDate = (toDate ?? date ?? DateTime.Today).Date;

            // Total Historical Cash Collections across all products (Before deposit date)
            var historicalPigmy = await _context.PigmyCollections
                .Where(c => c.AgentId == agentId && c.CollectionDate.Date < effectiveDepositDate &&
                            (c.PaymentMode == null || c.PaymentMode == "" || c.PaymentMode.ToUpper() == "CASH"))
                .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;
            var historicalLoan = await _context.LoanCollections
                .Where(c => c.AgentID == agentId && c.CollectionSource == "AGENT_MOBILE" && c.CollectionDate.Date < effectiveDepositDate &&
                            (c.PaymentMode == null || c.PaymentMode == "" || c.PaymentMode.ToUpper() == "CASH"))
                .SumAsync(c => (decimal?)c.TotalAmountReceived) ?? 0m;
            var historicalSaving = await _context.SavingTransactions
                .Where(t => t.AgentID == agentId && t.CollectionSource == "AGENT_MOBILE" && t.TransactionType == "Deposit" &&
                            t.TransactionDate.Date < effectiveDepositDate && (t.PaymentMode == null || t.PaymentMode == "" || t.PaymentMode.ToUpper() == "CASH"))
                .SumAsync(t => (decimal?)t.Amount) ?? 0m;
            var historicalRd = await _context.RdTransactions
                .Where(t => t.AgentID == agentId && t.CollectionSource == "AGENT_MOBILE" && t.TransactionType == "Installment" &&
                            t.TransactionDate.Date < effectiveDepositDate)
                .SumAsync(t => (decimal?)t.PrincipalAmount) ?? 0m;
            var historicalCollections = historicalPigmy + historicalLoan + historicalSaving + historicalRd;

            // Total Historical Deposits (Before deposit date)
            var historicalDeposits = await _context.PigmyAgentCashDeposits
                .Where(d => d.AgentId == agentId && d.DepositDate.Date < effectiveDepositDate)
                .SumAsync(d => (decimal?)d.Amount) ?? 0m;

            // Today's Cash Collection on deposit date across all products
            var todaysPigmy = await _context.PigmyCollections
                .Where(c => c.AgentId == agentId && c.CollectionDate.Date == effectiveDepositDate &&
                            (c.PaymentMode == null || c.PaymentMode == "" || c.PaymentMode.ToUpper() == "CASH"))
                .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;
            var todaysLoan = await _context.LoanCollections
                .Where(c => c.AgentID == agentId && c.CollectionSource == "AGENT_MOBILE" && c.CollectionDate.Date == effectiveDepositDate &&
                            (c.PaymentMode == null || c.PaymentMode == "" || c.PaymentMode.ToUpper() == "CASH"))
                .SumAsync(c => (decimal?)c.TotalAmountReceived) ?? 0m;
            var todaysSaving = await _context.SavingTransactions
                .Where(t => t.AgentID == agentId && t.CollectionSource == "AGENT_MOBILE" && t.TransactionType == "Deposit" &&
                            t.TransactionDate.Date == effectiveDepositDate && (t.PaymentMode == null || t.PaymentMode == "" || t.PaymentMode.ToUpper() == "CASH"))
                .SumAsync(t => (decimal?)t.Amount) ?? 0m;
            var todaysRd = await _context.RdTransactions
                .Where(t => t.AgentID == agentId && t.CollectionSource == "AGENT_MOBILE" && t.TransactionType == "Installment" &&
                            t.TransactionDate.Date == effectiveDepositDate)
                .SumAsync(t => (decimal?)t.PrincipalAmount) ?? 0m;
            var todaysCollection = todaysPigmy + todaysLoan + todaysSaving + todaysRd;

            // Today's Cash Deposited on deposit date
            var todaysDeposit = await _context.PigmyAgentCashDeposits
                .Where(d => d.AgentId == agentId && d.DepositDate.Date == effectiveDepositDate)
                .SumAsync(d => (decimal?)d.Amount) ?? 0m;

            var openingBalance = historicalCollections - historicalDeposits;
            var closingBalance = openingBalance + todaysCollection - todaysDeposit;

            var pigmyRangeAmount = await _context.PigmyCollections
                .Where(c => c.AgentId == agentId && c.CollectionDate.Date >= effectiveFromDate && c.CollectionDate.Date <= effectiveToDate &&
                            (c.PaymentMode == null || c.PaymentMode == "" || c.PaymentMode.ToUpper() == "CASH"))
                .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;
            var loanRangeAmount = await _context.LoanCollections
                .Where(c => c.AgentID == agentId && c.CollectionSource == "AGENT_MOBILE" && c.CollectionDate.Date >= effectiveFromDate && c.CollectionDate.Date <= effectiveToDate &&
                            (c.PaymentMode == null || c.PaymentMode == "" || c.PaymentMode.ToUpper() == "CASH"))
                .SumAsync(c => (decimal?)c.TotalAmountReceived) ?? 0m;
            var savingRangeAmount = await _context.SavingTransactions
                .Where(t => t.AgentID == agentId && t.CollectionSource == "AGENT_MOBILE" && t.TransactionType == "Deposit" &&
                            t.TransactionDate.Date >= effectiveFromDate && t.TransactionDate.Date <= effectiveToDate &&
                            (t.PaymentMode == null || t.PaymentMode == "" || t.PaymentMode.ToUpper() == "CASH"))
                .SumAsync(t => (decimal?)t.Amount) ?? 0m;
            var rdRangeAmount = await _context.RdTransactions
                .Where(t => t.AgentID == agentId && t.CollectionSource == "AGENT_MOBILE" && t.TransactionType == "Installment" &&
                            t.TransactionDate.Date >= effectiveFromDate && t.TransactionDate.Date <= effectiveToDate)
                .SumAsync(t => (decimal?)t.PrincipalAmount) ?? 0m;

            // Compute strict date-bound allocations across all agent collections
            var allAllocations = await ComputeAgentDayAllocations(agentId);

            // Filter for the requested multi-day range [effectiveFromDate, effectiveToDate]
            var rangeAllocations = allAllocations
                .Where(a => a.Date >= effectiveFromDate && a.Date <= effectiveToDate)
                .OrderBy(a => a.Date)
                .ToList();

            var rangeTotalCollected = rangeAllocations.Sum(a => a.TotalAmount);
            var rangeAlreadyRemitted = rangeAllocations.Sum(a => a.RemittedAmount);
            var totalPendingRangeAmount = rangeAllocations.Sum(a => a.PendingAmount);
            var pendingCount = rangeAllocations.Where(a => a.PendingAmount > 0).Sum(a => a.Count);

            var dayBreakup = rangeAllocations.Select(a => new DayBreakupDto
            {
                Date = a.Date,
                Count = a.Count,
                Amount = a.TotalAmount,
                RemittedAmount = a.RemittedAmount,
                PendingAmount = a.PendingAmount,
                IsRemitted = (a.PendingAmount == 0)
            }).ToList();

            bool isFullyRemitted = (rangeTotalCollected > 0 && totalPendingRangeAmount == 0);

            // Total Pending Cash up to deposit date across all time (all products)
            var allPigmyUpToDeposit = await _context.PigmyCollections
                .Where(c => c.AgentId == agentId && c.CollectionDate.Date <= effectiveDepositDate &&
                            (c.PaymentMode == null || c.PaymentMode == "" || c.PaymentMode.ToUpper() == "CASH"))
                .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;
            var allLoanUpToDeposit = await _context.LoanCollections
                .Where(c => c.AgentID == agentId && c.CollectionSource == "AGENT_MOBILE" && c.CollectionDate.Date <= effectiveDepositDate &&
                            (c.PaymentMode == null || c.PaymentMode == "" || c.PaymentMode.ToUpper() == "CASH"))
                .SumAsync(c => (decimal?)c.TotalAmountReceived) ?? 0m;
            var allSavingUpToDeposit = await _context.SavingTransactions
                .Where(t => t.AgentID == agentId && t.CollectionSource == "AGENT_MOBILE" && t.TransactionType == "Deposit" &&
                            t.TransactionDate.Date <= effectiveDepositDate && (t.PaymentMode == null || t.PaymentMode == "" || t.PaymentMode.ToUpper() == "CASH"))
                .SumAsync(t => (decimal?)t.Amount) ?? 0m;
            var allRdUpToDeposit = await _context.RdTransactions
                .Where(t => t.AgentID == agentId && t.CollectionSource == "AGENT_MOBILE" && t.TransactionType == "Installment" &&
                            t.TransactionDate.Date <= effectiveDepositDate)
                .SumAsync(t => (decimal?)t.PrincipalAmount) ?? 0m;
            var allCollectionsUpToDeposit = allPigmyUpToDeposit + allLoanUpToDeposit + allSavingUpToDeposit + allRdUpToDeposit;

            var allDepositsUpToDeposit = await _context.PigmyAgentCashDeposits
                .Where(d => d.AgentId == agentId && d.DepositDate.Date <= effectiveDepositDate)
                .SumAsync(d => (decimal?)d.Amount) ?? 0m;

            var totalPendingCash = allCollectionsUpToDeposit - allDepositsUpToDeposit;
            if (totalPendingCash < 0) totalPendingCash = 0;

            // Recent Deposits for this Agent
            var deposits = await _context.PigmyAgentCashDeposits
                .Where(d => d.AgentId == agentId)
                .OrderByDescending(d => d.DepositDate)
                .ThenByDescending(d => d.DepositId)
                .Take(20)
                .ToListAsync();

            var voucherIds = deposits.Where(d => d.VoucherId.HasValue).Select(d => d.VoucherId!.Value).ToList();
            var vouchersMap = await _context.Vouchers
                .Where(v => voucherIds.Contains(v.VoucherID))
                .ToDictionaryAsync(v => v.VoucherID, v => v.VoucherNo);

            var historyItems = deposits.Select(d =>
            {
                var (cFrom, cTo) = GetDepositCollectionRange(d);
                return new RemittanceItemDto
                {
                    DepositId = d.DepositId,
                    ReceiptNo = d.ReceiptNo,
                    DepositDate = d.DepositDate,
                    CollectionDateFrom = cFrom,
                    CollectionDateTo = cTo,
                    Amount = d.Amount,
                    PaymentMode = d.PaymentMode ?? "CASH",
                    Narration = d.Narration ?? "",
                    VoucherId = d.VoucherId,
                    VoucherNo = (d.VoucherId.HasValue && vouchersMap.ContainsKey(d.VoucherId.Value)) ? vouchersMap[d.VoucherId.Value] : null
                };
            }).ToList();

            var (schemeBreakup, activeSchemesCount) = await ComputePigmySchemeBreakupAsync(
                agentId, effectiveFromDate, effectiveToDate, rangeAllocations);

            return Ok(new DayBookSummary
            {
                OpeningBalance = openingBalance,
                TodaysCollection = todaysCollection,
                CashDeposited = todaysDeposit,
                ClosingBalance = closingBalance,
                CollectionDateFrom = effectiveFromDate,
                CollectionDateTo = effectiveToDate,
                DepositDate = effectiveDepositDate,
                RangeCollectionAmount = totalPendingRangeAmount,
                RangeCollectionCount = pendingCount,
                RangeTotalCollected = rangeTotalCollected,
                RangeAlreadyRemitted = rangeAlreadyRemitted,
                IsFullyRemitted = isFullyRemitted,
                TotalPendingCash = totalPendingCash,
                PigmyRangeAmount = pigmyRangeAmount,
                LoanRangeAmount = loanRangeAmount,
                SavingRangeAmount = savingRangeAmount,
                RdRangeAmount = rdRangeAmount,
                ActiveSchemesCount = activeSchemesCount,
                SchemeBreakup = schemeBreakup,
                DayBreakup = dayBreakup,
                RecentRemittances = historyItems
            });
        }

        public class CashDepositDto
        {
            public int AgentId { get; set; }
            public DateTime? CollectionDateFrom { get; set; }
            public DateTime? CollectionDateTo { get; set; }
            public DateTime DepositDate { get; set; }
            public decimal Amount { get; set; }
            public string PaymentMode { get; set; } = "CASH";
            public int? BankLedgerId { get; set; }
            public string? Narration { get; set; }
            public int BranchId { get; set; } = 1;
            public int? CashierId { get; set; }
            public int? FallbackPigmySchemeId { get; set; }

            // Denominations
            public int? Count500 { get; set; }
            public int? Count200 { get; set; }
            public int? Count100 { get; set; }
            public int? Count50 { get; set; }
            public int? Count20 { get; set; }
            public int? Count10 { get; set; }
            public int? Count5 { get; set; }
            public int? CountCoins { get; set; }
        }

        // POST: api/AgentDayBook/DepositCash
        [HttpPost("DepositCash")]
        [Authorize(Roles = "Admin,SuperAdmin,HeadOffice,HO_Manager,Manager,BranchManager,Cashier,Clerk")]
        public async Task<IActionResult> DepositCash([FromBody] CashDepositDto request)
        {
            if (request.Amount <= 0) return BadRequest("जमा रक्कम शून्यपेक्षा जास्त असणे आवश्यक आहे.");

            if (request.CollectionDateFrom.HasValue && request.CollectionDateTo.HasValue)
            {
                var cFrom = request.CollectionDateFrom.Value.Date;
                var cTo = request.CollectionDateTo.Value.Date;
                if (cFrom > cTo)
                {
                    return BadRequest("संकलन सुरू दिनांक (From Date) ही संकलन शेवट दिनांक (To Date) पेक्षा मोठी असू शकत नाही.");
                }

                var allAllocations = await ComputeAgentDayAllocations(request.AgentId);
                var rangeAllocations = allAllocations
                    .Where(a => a.Date >= cFrom && a.Date <= cTo)
                    .ToList();

                var rangeCollSum = rangeAllocations.Sum(a => a.TotalAmount);
                var alreadyRemitted = rangeAllocations.Sum(a => a.RemittedAmount);
                var pendingInRange = rangeAllocations.Sum(a => a.PendingAmount);

                if (pendingInRange <= 0 && rangeCollSum > 0)
                {
                    return BadRequest($"या कालावधीतील ({cFrom:dd/MM/yyyy} ते {cTo:dd/MM/yyyy}) एकूण संकलन (₹{rangeCollSum:N2}) आधीच शाखेत पूर्ण जमा (Remitted) झालेले आहे. दुबार भरणा करता येणार नाही.");
                }

                if (request.Amount > pendingInRange && pendingInRange > 0)
                {
                    return BadRequest($"या कालावधीतील उर्वरित शिल्लक संकलन फक्त ₹{pendingInRange:N2} आहे. त्यापेक्षा जास्त रक्कम (₹{request.Amount:N2}) भरता येणार नाही.");
                }
            }

            // Calculate current holding for validation across ALL doorstep cash products (Pigmy + Loan + Saving + RD)
            var historicalPigmyHold = await _context.PigmyCollections
                .Where(c => c.AgentId == request.AgentId && c.CollectionDate.Date <= request.DepositDate.Date &&
                            (c.PaymentMode == null || c.PaymentMode == "" || c.PaymentMode.ToUpper() == "CASH"))
                .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;
            var historicalLoanHold = await _context.LoanCollections
                .Where(c => c.AgentID == request.AgentId && c.CollectionSource == "AGENT_MOBILE" && c.CollectionDate.Date <= request.DepositDate.Date &&
                            (c.PaymentMode == null || c.PaymentMode == "" || c.PaymentMode.ToUpper() == "CASH"))
                .SumAsync(c => (decimal?)c.TotalAmountReceived) ?? 0m;
            var historicalSavingHold = await _context.SavingTransactions
                .Where(t => t.AgentID == request.AgentId && t.CollectionSource == "AGENT_MOBILE" && t.TransactionType == "Deposit" &&
                            t.TransactionDate.Date <= request.DepositDate.Date && (t.PaymentMode == null || t.PaymentMode == "" || t.PaymentMode.ToUpper() == "CASH"))
                .SumAsync(t => (decimal?)t.Amount) ?? 0m;
            var historicalRdHold = await _context.RdTransactions
                .Where(t => t.AgentID == request.AgentId && t.CollectionSource == "AGENT_MOBILE" && t.TransactionType == "Installment" &&
                            t.TransactionDate.Date <= request.DepositDate.Date)
                .SumAsync(t => (decimal?)t.PrincipalAmount) ?? 0m;
            var historicalCollections = historicalPigmyHold + historicalLoanHold + historicalSavingHold + historicalRdHold;

            var historicalDeposits = await _context.PigmyAgentCashDeposits
                .Where(d => d.AgentId == request.AgentId && d.DepositDate.Date <= request.DepositDate.Date)
                .SumAsync(d => (decimal?)d.Amount) ?? 0m;

            var currentHolding = historicalCollections - historicalDeposits;

            if (request.Amount > currentHolding)
            {
                return BadRequest($"जमा रक्कम (₹{request.Amount:N2}) एजंटकडील शिल्लक रक्कमेपेक्षा (₹{currentHolding:N2}) जास्त असू शकत नाही.");
            }

            int count500 = request.Count500 ?? 0;
            int count200 = request.Count200 ?? 0;
            int count100 = request.Count100 ?? 0;
            int count50 = request.Count50 ?? 0;
            int count20 = request.Count20 ?? 0;
            int count10 = request.Count10 ?? 0;
            int count5 = request.Count5 ?? 0;
            int countCoins = request.CountCoins ?? 0;

            string effectivePaymentMode = string.IsNullOrWhiteSpace(request.PaymentMode) ? "CASH" : request.PaymentMode.Trim();
            bool isBankMode = !string.Equals(effectivePaymentMode, "CASH", StringComparison.OrdinalIgnoreCase);
            int resolvedBankLedgerId = 0;
            if (isBankMode)
            {
                var bankCheck = await Helpers.BankLedgerHelper.ValidateBankLedgerAsync(_context, request.BankLedgerId);
                if (!bankCheck.IsValid)
                {
                    return BadRequest(bankCheck.ErrorMessage);
                }
                resolvedBankLedgerId = bankCheck.LedgerId;
            }

            decimal denomTotal = (count500 * 500) + (count200 * 200) + (count100 * 100) + (count50 * 50) + (count20 * 20) + (count10 * 10) + (count5 * 5) + countCoins;

            if (denomTotal > 0 && denomTotal != request.Amount)
            {
                return BadRequest($"नोटांची एकूण मोजणी (₹{denomTotal:N2}) ही भरणा रक्कमेसह (₹{request.Amount:N2}) तंतोतंत जुळली पाहिजे.");
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Generate Receipt No
                var todayStr = DateTime.Now.ToString("yyyyMMdd");
                var lastDeposit = await _context.PigmyAgentCashDeposits
                    .Where(d => d.ReceiptNo.StartsWith($"REMD-{todayStr}"))
                    .OrderByDescending(d => d.ReceiptNo)
                    .FirstOrDefaultAsync();

                int nextSeq = 1;
                if (lastDeposit != null)
                {
                    var parts = lastDeposit.ReceiptNo.Split('-');
                    if (parts.Length == 3 && int.TryParse(parts[2], out int parsedSeq))
                        nextSeq = parsedSeq + 1;
                }
                var receiptNo = $"REMD-{todayStr}-{nextSeq:D4}";

                // Format Collection Range Tag in Narration
                string dateRangeTag = "";
                if (request.CollectionDateFrom.HasValue && request.CollectionDateTo.HasValue)
                {
                    if (request.CollectionDateFrom.Value.Date == request.CollectionDateTo.Value.Date)
                    {
                        dateRangeTag = $"[संकलन: {request.CollectionDateFrom.Value:dd/MM/yyyy}] ";
                    }
                    else
                    {
                        dateRangeTag = $"[संकलन: {request.CollectionDateFrom.Value:dd/MM/yyyy} ते {request.CollectionDateTo.Value:dd/MM/yyyy}] ";
                    }
                }
                else if (request.CollectionDateFrom.HasValue)
                {
                    dateRangeTag = $"[संकलन: {request.CollectionDateFrom.Value:dd/MM/yyyy}] ";
                }

                string combinedNarration = $"{dateRangeTag}{request.Narration}".Trim();

                // Voucher Auto Generation Logic (Consolidated Multi-Product Day Voucher for Cash Remittance)
                DateTime rangeFrom = (request.CollectionDateFrom ?? request.DepositDate).Date;
                DateTime rangeTo = (request.CollectionDateTo ?? request.DepositDate).Date;

                var unremittedLoans = await _context.LoanCollections
                    .Include(l => l.LoanAccount)
                        .ThenInclude(a => a!.LoanRate)
                    .Where(l => l.AgentID == request.AgentId &&
                                l.CollectionSource == "AGENT_MOBILE" &&
                                l.RemittanceDepositId == null &&
                                l.CollectionDate.Date >= rangeFrom &&
                                l.CollectionDate.Date <= rangeTo &&
                                (l.PaymentMode == null || l.PaymentMode == "" || l.PaymentMode.ToUpper() == "CASH"))
                    .OrderBy(l => l.CollectionDate)
                    .ThenBy(l => l.LoanCollectionID)
                    .ToListAsync();

                var unremittedSavings = await _context.SavingTransactions
                    .Include(s => s.SavingAccount)
                    .Where(s => s.AgentID == request.AgentId &&
                                s.CollectionSource == "AGENT_MOBILE" &&
                                s.TransactionType == "Deposit" &&
                                s.RemittanceDepositId == null &&
                                s.TransactionDate.Date >= rangeFrom &&
                                s.TransactionDate.Date <= rangeTo &&
                                (s.PaymentMode == null || s.PaymentMode == "" || s.PaymentMode.ToUpper() == "CASH"))
                    .OrderBy(s => s.TransactionDate)
                    .ThenBy(s => s.TransactionID)
                    .ToListAsync();

                var unremittedRds = await _context.RdTransactions
                    .Include(r => r.RdAccount)
                        .ThenInclude(a => a!.RdScheme)
                    .Where(r => r.AgentID == request.AgentId &&
                                r.CollectionSource == "AGENT_MOBILE" &&
                                r.TransactionType == "Installment" &&
                                r.RemittanceDepositId == null &&
                                r.TransactionDate.Date >= rangeFrom &&
                                r.TransactionDate.Date <= rangeTo)
                    .OrderBy(r => r.TransactionDate)
                    .ThenBy(r => r.RdTransactionID)
                    .ToListAsync();

                int branchCashId = isBankMode ? resolvedBankLedgerId : await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, request.BranchId, "PIGMY");
                var debitLedger = isBankMode
                    ? await _context.Ledgers.FindAsync(resolvedBankLedgerId)
                    : (await _context.Ledgers.FindAsync(branchCashId) ?? await _context.Ledgers.FirstOrDefaultAsync(l => l.AccountType == "Cash" || l.AccountType == "Cash In Hand"));

                if (debitLedger == null) debitLedger = await _context.Ledgers.FirstAsync();

                var branchFallbackMapping = await _context.PigmyVoucherMappings.FirstOrDefaultAsync(m => m.BranchId == request.BranchId && m.IsActive);
                async Task<int> ResolveNonPigmyFallbackLedgerIdAsync()
                {
                    if (branchFallbackMapping != null && branchFallbackMapping.CreditLedgerId > 0)
                    {
                        return branchFallbackMapping.CreditLedgerId;
                    }
                    var firstSchemeLedger = await _context.PigmySchemes
                        .Where(s => s.PigmyLiabilityLedgerID.HasValue && s.PigmyLiabilityLedgerID > 0)
                        .Select(s => s.PigmyLiabilityLedgerID)
                        .FirstOrDefaultAsync();
                    if (firstSchemeLedger.HasValue && firstSchemeLedger.Value > 0) return firstSchemeLedger.Value;
                    var anyPigmyLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("पिग्मी") || l.LedgerName.Contains("Pigmy") || l.LedgerName.Contains("Suspense"));
                    return anyPigmyLedger?.LedgerID ?? (await _context.Ledgers.FirstAsync()).LedgerID;
                }

                var creditTotalsByLedger = new Dictionary<int, decimal>();
                void AddCredit(int ledgerId, decimal amt)
                {
                    if (amt <= 0) return;
                    if (!creditTotalsByLedger.ContainsKey(ledgerId)) creditTotalsByLedger[ledgerId] = 0m;
                    creditTotalsByLedger[ledgerId] += amt;
                }

                var settledLoans = new List<LoanCollection>();
                var settledSavings = new List<SavingTransaction>();
                var settledRds = new List<RdTransaction>();
                decimal allocatedNonPigmy = 0m;

                foreach (var lc in unremittedLoans)
                {
                    if (allocatedNonPigmy + lc.TotalAmountReceived > request.Amount) continue;
                    int pLedger = (lc.LoanAccount?.LoanRate?.LoanLedgerID ?? 0) > 0
                        ? lc.LoanAccount!.LoanRate!.LoanLedgerID!.Value
                        : await ResolveNonPigmyFallbackLedgerIdAsync();
                    int iLedger = (lc.LoanAccount?.LoanRate?.InterestLedgerID ?? 0) > 0
                        ? lc.LoanAccount!.LoanRate!.InterestLedgerID!.Value
                        : pLedger;
                    int rIntLedger = (lc.LoanAccount?.LoanRate?.ReceivableInterestLedgerID ?? 0) > 0
                        ? lc.LoanAccount!.LoanRate!.ReceivableInterestLedgerID!.Value
                        : iLedger;
                    int oLedger = (lc.LoanAccount?.LoanRate?.OverdueInterestLedgerID ?? 0) > 0
                        ? lc.LoanAccount!.LoanRate!.OverdueInterestLedgerID!.Value
                        : iLedger;
                    AddCredit(pLedger, lc.PrincipalCollected);
                    AddCredit(rIntLedger, lc.ReceivableInterestCollected);
                    AddCredit(iLedger, lc.InterestCollected);
                    AddCredit(oLedger, lc.PenaltyInterestCollected);
                    decimal itemized = lc.PrincipalCollected + lc.ReceivableInterestCollected + lc.InterestCollected + lc.PenaltyInterestCollected;
                    if (lc.TotalAmountReceived > itemized)
                    {
                        AddCredit(pLedger, lc.TotalAmountReceived - itemized);
                    }
                    allocatedNonPigmy += lc.TotalAmountReceived;
                    settledLoans.Add(lc);
                }

                foreach (var st in unremittedSavings)
                {
                    if (allocatedNonPigmy + st.Amount > request.Amount) continue;
                    int sLedger = st.SavingAccount?.LedgerID ?? (await _context.SavingInterestSettings.Select(x => (int?)x.SavingLiabilityLedgerID).FirstOrDefaultAsync()) ?? await ResolveNonPigmyFallbackLedgerIdAsync();
                    AddCredit(sLedger, st.Amount);
                    allocatedNonPigmy += st.Amount;
                    settledSavings.Add(st);
                }

                foreach (var rt in unremittedRds)
                {
                    if (allocatedNonPigmy + rt.PrincipalAmount > request.Amount) continue;
                    int rLedger = rt.RdAccount?.RdScheme?.RdLiabilityLedgerID ?? await ResolveNonPigmyFallbackLedgerIdAsync();
                    AddCredit(rLedger, rt.PrincipalAmount);
                    allocatedNonPigmy += rt.PrincipalAmount;
                    settledRds.Add(rt);
                }

                var otherDepositVoucherIds = (await _context.PigmyAgentCashDeposits
                    .AsNoTracking()
                    .Where(d => d.AgentId == request.AgentId && d.VoucherId.HasValue)
                    .Select(d => d.VoucherId!.Value)
                    .ToListAsync()).ToHashSet();

                var settledFullPigmyCols = new List<PigmyCollection>();
                var postedSchemeSummary = new Dictionary<int, (int SchemeId, string SchemeName, string LedgerName, decimal Amount)>();
                decimal pigmyOrRemainder = request.Amount - allocatedNonPigmy;

                if (pigmyOrRemainder > 0)
                {
                    var ledgerCache = new Dictionary<int, Ledger>();
                    async Task<(bool Ok, Ledger? Ledger, string? Error)> ValidateLiabilityLedgerAsync(int? ledgerId, string schemeLabel)
                    {
                        if (!ledgerId.HasValue || ledgerId.Value <= 0)
                        {
                            return (false, null, $"पिग्मी योजना '{schemeLabel}' ला 'पिग्मी ठेव देयता लेजर (Liability Ledger)' मॅप केलेले नाही. कृपया पिग्मी योजना सेटिंगमध्ये लेजर निवडा.");
                        }
                        if (!ledgerCache.TryGetValue(ledgerId.Value, out var l))
                        {
                            l = await _context.Ledgers.FindAsync(ledgerId.Value);
                            if (l != null) ledgerCache[ledgerId.Value] = l;
                        }
                        if (l == null || !l.IsActive)
                        {
                            return (false, null, $"पिग्मी योजना '{schemeLabel}' चे देयता लेजर (#{ledgerId.Value}) सापडले नाही किंवा निष्क्रिय आहे.");
                        }
                        return (true, l, null);
                    }

                    var allPigmySchemes = await _context.PigmySchemes
                        .Include(s => s.PigmyLiabilityLedger)
                        .ToListAsync();
                    var schemeById = allPigmySchemes.ToDictionary(s => s.PigmySchemeID, s => s);

                    var allAgentPigmyColsUpToDeposit = await _context.PigmyCollections
                        .Include(c => c.PigmyAccount)
                            .ThenInclude(a => a!.PigmyScheme)
                                .ThenInclude(s => s!.PigmyLiabilityLedger)
                        .Where(c => c.AgentId == request.AgentId &&
                                    c.CollectionAmount > 0 &&
                                    c.CollectionDate.Date <= request.DepositDate.Date &&
                                    c.CollectionDate.Date > new DateTime(2026, 3, 31) &&
                                    c.CollectionSource != "OPENING_IMPORT" &&
                                    (c.PaymentMode == null || c.PaymentMode == "" || c.PaymentMode.ToUpper() == "CASH"))
                        .OrderBy(c => c.CollectionDate)
                        .ThenBy(c => c.CollectionId)
                        .ToListAsync();

                    bool IsColRemittedBeforeThisDeposit(PigmyCollection c) =>
                        c.RemittanceDepositId.HasValue ||
                        (c.IsVoucherGenerated && c.VoucherId.HasValue && otherDepositVoucherIds.Contains(c.VoucherId.Value));

                    var candidateUnremittedCols = allAgentPigmyColsUpToDeposit
                        .Where(c => !IsColRemittedBeforeThisDeposit(c))
                        .ToList();

                    var priorDayAllocations = (await ComputeAgentDayAllocations(request.AgentId))
                        .ToDictionary(a => a.Date, a => a);

                    var priorLinkedLoanByDate = await _context.LoanCollections
                        .AsNoTracking()
                        .Where(l => l.AgentID == request.AgentId && l.CollectionSource == "AGENT_MOBILE" && l.RemittanceDepositId != null &&
                                    l.CollectionDate.Date <= request.DepositDate.Date &&
                                    (l.PaymentMode == null || l.PaymentMode == "" || l.PaymentMode.ToUpper() == "CASH"))
                        .GroupBy(l => l.CollectionDate.Date)
                        .Select(g => new { Date = g.Key, Amount = g.Sum(x => x.TotalAmountReceived) })
                        .ToDictionaryAsync(x => x.Date, x => x.Amount);

                    var priorLinkedSavingByDate = await _context.SavingTransactions
                        .AsNoTracking()
                        .Where(s => s.AgentID == request.AgentId && s.CollectionSource == "AGENT_MOBILE" && s.TransactionType == "Deposit" && s.RemittanceDepositId != null &&
                                    s.TransactionDate.Date <= request.DepositDate.Date &&
                                    (s.PaymentMode == null || s.PaymentMode == "" || s.PaymentMode.ToUpper() == "CASH"))
                        .GroupBy(s => s.TransactionDate.Date)
                        .Select(g => new { Date = g.Key, Amount = g.Sum(x => x.Amount) })
                        .ToDictionaryAsync(x => x.Date, x => x.Amount);

                    var priorLinkedRdByDate = await _context.RdTransactions
                        .AsNoTracking()
                        .Where(r => r.AgentID == request.AgentId && r.CollectionSource == "AGENT_MOBILE" && r.TransactionType == "Installment" && r.RemittanceDepositId != null &&
                                    r.TransactionDate.Date <= request.DepositDate.Date)
                        .GroupBy(r => r.TransactionDate.Date)
                        .Select(g => new { Date = g.Key, Amount = g.Sum(x => x.PrincipalAmount) })
                        .ToDictionaryAsync(x => x.Date, x => x.Amount);

                    var explicitPigmyByDate = allAgentPigmyColsUpToDeposit
                        .Where(IsColRemittedBeforeThisDeposit)
                        .GroupBy(c => c.CollectionDate.Date)
                        .ToDictionary(g => g.Key, g => g.Sum(c => c.CollectionAmount));

                    var orderedDays = candidateUnremittedCols
                        .GroupBy(c => c.CollectionDate.Date)
                        .OrderBy(g => (g.Key >= rangeFrom && g.Key <= rangeTo) ? 0 : 1)
                        .ThenBy(g => g.Key)
                        .ToList();

                    decimal remainingPigmy = pigmyOrRemainder;

                    foreach (var dayGroup in orderedDays)
                    {
                        if (remainingPigmy <= 0m) break;

                        DateTime dDate = dayGroup.Key;
                        var dayCols = dayGroup.ToList();
                        decimal rawUnlinkedPigmyOnDay = dayCols.Sum(c => c.CollectionAmount);
                        if (rawUnlinkedPigmyOnDay <= 0m) continue;

                        decimal priorRemittedOnDay = priorDayAllocations.TryGetValue(dDate, out var da) ? da.RemittedAmount : 0m;
                        decimal priorExplicitOnDay =
                            (explicitPigmyByDate.TryGetValue(dDate, out var ep) ? ep : 0m) +
                            (priorLinkedLoanByDate.TryGetValue(dDate, out var el) ? el : 0m) +
                            (priorLinkedSavingByDate.TryGetValue(dDate, out var es) ? es : 0m) +
                            (priorLinkedRdByDate.TryGetValue(dDate, out var er) ? er : 0m);

                        decimal priorPartialPigmyOnDay = Math.Max(0m, priorRemittedOnDay - priorExplicitOnDay);
                        decimal availablePoolOnDay = Math.Max(0m, rawUnlinkedPigmyOnDay - priorPartialPigmyOnDay);
                        if (availablePoolOnDay <= 0m) continue;

                        decimal takeFromDay = Math.Min(remainingPigmy, availablePoolOnDay);
                        bool completesDay = takeFromDay >= availablePoolOnDay;

                        // Resolve exact PigmyScheme Liability Ledger for every collection row on this day
                        var colBuckets = new Dictionary<int, (int SchemeId, string SchemeName, Ledger Ledger, decimal RawAmount)>();
                        foreach (var col in dayCols)
                        {
                            PigmyScheme? scheme = col.PigmyAccount?.PigmyScheme;
                            if (scheme == null && col.PigmyAccount != null && schemeById.TryGetValue(col.PigmyAccount.PigmySchemeID, out var foundScheme))
                            {
                                scheme = foundScheme;
                            }

                            int resolvedLedgerId;
                            Ledger resolvedLedger;
                            int sId = scheme?.PigmySchemeID ?? col.PigmyAccount?.PigmySchemeID ?? 0;
                            string sName = scheme?.SchemeName ?? (sId > 0 ? $"पिग्मी योजना #{sId}" : "पिग्मी योजना");

                            if (col.PigmyAccount != null)
                            {
                                var vCheck = await ValidateLiabilityLedgerAsync(scheme?.PigmyLiabilityLedgerID, sName);
                                if (!vCheck.Ok || vCheck.Ledger == null)
                                {
                                    await transaction.RollbackAsync();
                                    return BadRequest(vCheck.Error);
                                }
                                resolvedLedgerId = vCheck.Ledger.LedgerID;
                                resolvedLedger = vCheck.Ledger;
                            }
                            else
                            {
                                // Orphan collection without PigmyAccount row (e.g., legacy test fixture mapped via PigmyVoucherMapping)
                                if (branchFallbackMapping != null && branchFallbackMapping.CreditLedgerId > 0)
                                {
                                    var vMapCheck = await ValidateLiabilityLedgerAsync(branchFallbackMapping.CreditLedgerId, "PigmyVoucherMapping");
                                    if (!vMapCheck.Ok || vMapCheck.Ledger == null)
                                    {
                                        await transaction.RollbackAsync();
                                        return BadRequest(vMapCheck.Error);
                                    }
                                    resolvedLedgerId = vMapCheck.Ledger.LedgerID;
                                    resolvedLedger = vMapCheck.Ledger;
                                    sName = vMapCheck.Ledger.LedgerName;
                                }
                                else if (allPigmySchemes.Count(s => s.Status == "Active") == 1)
                                {
                                    var singleScheme = allPigmySchemes.First(s => s.Status == "Active");
                                    var vSingle = await ValidateLiabilityLedgerAsync(singleScheme.PigmyLiabilityLedgerID, singleScheme.SchemeName);
                                    if (!vSingle.Ok || vSingle.Ledger == null)
                                    {
                                        await transaction.RollbackAsync();
                                        return BadRequest(vSingle.Error);
                                    }
                                    resolvedLedgerId = vSingle.Ledger.LedgerID;
                                    resolvedLedger = vSingle.Ledger;
                                    sId = singleScheme.PigmySchemeID;
                                    sName = singleScheme.SchemeName;
                                }
                                else
                                {
                                    await transaction.RollbackAsync();
                                    return BadRequest($"पिग्मी संकलन क्र. {col.CollectionId} साठी पिग्मी खाते किंवा योजना लेजर सापडले नाही.");
                                }
                            }

                            if (!colBuckets.TryGetValue(resolvedLedgerId, out var existingBucket))
                            {
                                colBuckets[resolvedLedgerId] = (sId, sName, resolvedLedger, col.CollectionAmount);
                            }
                            else
                            {
                                colBuckets[resolvedLedgerId] = (existingBucket.SchemeId, existingBucket.SchemeName, existingBucket.Ledger, existingBucket.RawAmount + col.CollectionAmount);
                            }
                        }

                        var orderedBuckets = colBuckets.OrderBy(k => k.Key).ToList();
                        if (Math.Abs(takeFromDay - rawUnlinkedPigmyOnDay) < 0.005m)
                        {
                            // Exact 100% day allocation: zero rounding adjustments needed
                            foreach (var kv in orderedBuckets)
                            {
                                var b = kv.Value;
                                AddCredit(kv.Key, b.RawAmount);
                                if (!postedSchemeSummary.TryGetValue(kv.Key, out var cur))
                                    postedSchemeSummary[kv.Key] = (b.SchemeId, b.SchemeName, b.Ledger.LedgerName, b.RawAmount);
                                else
                                    postedSchemeSummary[kv.Key] = (cur.SchemeId, cur.SchemeName, cur.LedgerName, cur.Amount + b.RawAmount);
                            }
                        }
                        else
                        {
                            // Pro-rata distribution across scheme buckets on partially/completed day
                            decimal distributed = 0m;
                            for (int bi = 0; bi < orderedBuckets.Count; bi++)
                            {
                                var kv = orderedBuckets[bi];
                                var b = kv.Value;
                                decimal allocAmt = (bi == orderedBuckets.Count - 1)
                                    ? Math.Max(0m, Math.Round(takeFromDay - distributed, 2, MidpointRounding.AwayFromZero))
                                    : Math.Round(takeFromDay * (b.RawAmount / rawUnlinkedPigmyOnDay), 2, MidpointRounding.AwayFromZero);

                                distributed += allocAmt;
                                AddCredit(kv.Key, allocAmt);
                                if (allocAmt > 0m)
                                {
                                    if (!postedSchemeSummary.TryGetValue(kv.Key, out var cur))
                                        postedSchemeSummary[kv.Key] = (b.SchemeId, b.SchemeName, b.Ledger.LedgerName, allocAmt);
                                    else
                                        postedSchemeSummary[kv.Key] = (cur.SchemeId, cur.SchemeName, cur.LedgerName, cur.Amount + allocAmt);
                                }
                            }
                        }

                        if (completesDay)
                        {
                            settledFullPigmyCols.AddRange(dayCols);
                        }

                        remainingPigmy -= takeFromDay;
                    }

                    // Any unbacked advance cash remainder beyond all unremitted Pigmy collections
                    if (remainingPigmy > 0m)
                    {
                        PigmyScheme? advScheme = null;
                        if (request.FallbackPigmySchemeId.HasValue && request.FallbackPigmySchemeId.Value > 0)
                        {
                            schemeById.TryGetValue(request.FallbackPigmySchemeId.Value, out advScheme);
                            if (advScheme == null)
                            {
                                await transaction.RollbackAsync();
                                return BadRequest("निवडलेली पिग्मी योजना सापडली नाही.");
                            }
                        }
                        else
                        {
                            var activeSchemes = allPigmySchemes.Where(s => s.Status == "Active").ToList();
                            if (activeSchemes.Count == 1)
                            {
                                advScheme = activeSchemes[0];
                            }
                            else if (activeSchemes.Count > 1)
                            {
                                var agentDistinctSchemeIds = await _context.PigmyAccounts
                                    .AsNoTracking()
                                    .Where(a => a.PigmyAgentID == request.AgentId && a.Status == "Active")
                                    .Select(a => a.PigmySchemeID)
                                    .Distinct()
                                    .ToListAsync();

                                if (agentDistinctSchemeIds.Count == 1 && schemeById.TryGetValue(agentDistinctSchemeIds[0], out var singleAgentScheme))
                                {
                                    advScheme = singleAgentScheme;
                                }
                                else
                                {
                                    await transaction.RollbackAsync();
                                    return BadRequest("या एजंटकडे एकापेक्षा जास्त पिग्मी योजनांची खाती आहेत आणि अतिरिक्त रकमेसाठी संकलन नोंदी सापडल्या नाहीत. कृपया भरणा करताना पिग्मी योजना निवडा.");
                                }
                            }
                        }

                        if (advScheme != null)
                        {
                            var vAdv = await ValidateLiabilityLedgerAsync(advScheme.PigmyLiabilityLedgerID, advScheme.SchemeName);
                            if (!vAdv.Ok || vAdv.Ledger == null)
                            {
                                await transaction.RollbackAsync();
                                return BadRequest(vAdv.Error);
                            }
                            AddCredit(vAdv.Ledger.LedgerID, remainingPigmy);
                            if (!postedSchemeSummary.TryGetValue(vAdv.Ledger.LedgerID, out var cur))
                                postedSchemeSummary[vAdv.Ledger.LedgerID] = (advScheme.PigmySchemeID, advScheme.SchemeName, vAdv.Ledger.LedgerName, remainingPigmy);
                            else
                                postedSchemeSummary[vAdv.Ledger.LedgerID] = (cur.SchemeId, cur.SchemeName, cur.LedgerName, cur.Amount + remainingPigmy);
                        }
                        else if (branchFallbackMapping != null && branchFallbackMapping.CreditLedgerId > 0)
                        {
                            var vMap = await ValidateLiabilityLedgerAsync(branchFallbackMapping.CreditLedgerId, "PigmyVoucherMapping");
                            if (!vMap.Ok || vMap.Ledger == null)
                            {
                                await transaction.RollbackAsync();
                                return BadRequest(vMap.Error);
                            }
                            AddCredit(vMap.Ledger.LedgerID, remainingPigmy);
                        }
                        else
                        {
                            await transaction.RollbackAsync();
                            return BadRequest("संस्थेमध्ये कोणतीही सक्रिय पिग्मी योजना व देयता लेजर मॅप केलेले नाही.");
                        }
                    }
                }

                var agent = await _context.PigmyAgents.FirstOrDefaultAsync(a => a.PigmyAgentID == request.AgentId);
                string agentName = agent?.AgentName ?? ("Agent-" + request.AgentId);

                string uniqueVoucherNo = $"PV-{request.BranchId}-{request.DepositDate:yyyyMMdd}-AGT-{request.AgentId}-{nextSeq:D3}";
                var existingVch = await _context.Vouchers.FirstOrDefaultAsync(v => v.BranchID == request.BranchId && v.VoucherNo == uniqueVoucherNo);
                if (existingVch != null)
                {
                    uniqueVoucherNo = $"PV-{request.BranchId}-{request.DepositDate:yyyyMMdd}-AGT-{request.AgentId}-{nextSeq:D3}-{Guid.NewGuid().ToString("N").Substring(0, 4)}";
                }

                var voucherDetailsList = new List<VoucherDetail>
                {
                    new VoucherDetail { LedgerID = debitLedger.LedgerID, DrCr = "Dr", Amount = request.Amount }
                };
                foreach (var kv in creditTotalsByLedger)
                {
                    voucherDetailsList.Add(new VoucherDetail { LedgerID = kv.Key, DrCr = "Cr", Amount = kv.Value });
                }

                string schemeNarrationSuffix = postedSchemeSummary.Count > 0
                    ? " [योजना: " + string.Join(", ", postedSchemeSummary.Values.Select(s => $"{s.SchemeName} ₹{s.Amount:N0}")) + "]"
                    : string.Empty;

                var voucher = new Voucher
                {
                    BranchID = request.BranchId,
                    VoucherNo = uniqueVoucherNo,
                    VoucherDate = request.DepositDate,
                    VoucherType = "Receipt",
                    Status = "Pending",
                    TotalAmount = request.Amount,
                    Narration = $"एजंट संकलन भरणा (एजंट: {agentName}). पावती: {receiptNo} {combinedNarration}{schemeNarrationSuffix}".Trim(),
                    CreatedBy = 1,
                    CreatedOn = DateTime.Now,
                    VoucherDetails = voucherDetailsList
                };

                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();

                var deposit = new PigmyAgentCashDeposit
                {
                    AgentId = request.AgentId,
                    DepositDate = request.DepositDate,
                    CollectionDateFrom = request.CollectionDateFrom,
                    CollectionDateTo = request.CollectionDateTo,
                    Amount = request.Amount,
                    PaymentMode = string.IsNullOrEmpty(request.PaymentMode) ? "CASH" : request.PaymentMode,
                    ReceiptNo = receiptNo,
                    Narration = combinedNarration,
                    VoucherId = voucher.VoucherID,
                    CreatedBy = 1,
                    CreatedOn = DateTime.Now
                };

                _context.PigmyAgentCashDeposits.Add(deposit);
                await _context.SaveChangesAsync();

                // Mark exact settled Loan, Saving, and RD mobile collections with this RemittanceDepositId & consolidated VoucherID
                foreach (var lc in settledLoans)
                {
                    lc.RemittanceDepositId = deposit.DepositId;
                    lc.VoucherID = voucher.VoucherID;
                }
                foreach (var st in settledSavings)
                {
                    st.RemittanceDepositId = deposit.DepositId;
                    st.VoucherID = voucher.VoucherID;
                }
                foreach (var rt in settledRds)
                {
                    rt.RemittanceDepositId = deposit.DepositId;
                    rt.VoucherID = voucher.VoucherID;
                }

                // Link exact settled full-day Pigmy collections with RemittanceDepositId & consolidated VoucherId,
                // and remove any superseded individual per-customer import/bulk vouchers so Daybook never double-counts.
                var supersededVoucherIds = new HashSet<int>();
                foreach (var col in settledFullPigmyCols)
                {
                    if (col.VoucherId.HasValue && col.VoucherId.Value != voucher.VoucherID && !otherDepositVoucherIds.Contains(col.VoucherId.Value))
                    {
                        supersededVoucherIds.Add(col.VoucherId.Value);
                    }
                    col.RemittanceDepositId = deposit.DepositId;
                    col.VoucherId = voucher.VoucherID;
                    col.IsVoucherGenerated = true;
                }
                if (settledFullPigmyCols.Any())
                {
                    // Update PigmyTransactions: Stamp TransactionDate = DepositDate (शाखेत भरणा दिनांक) and ReferenceId = VoucherNo
                    var rcpts = settledFullPigmyCols.Where(c => !string.IsNullOrEmpty(c.ReceiptNo)).Select(c => c.ReceiptNo).Distinct().ToList();
                    var accIds = settledFullPigmyCols.Select(c => c.PigmyAccountId).Distinct().ToList();

                    if (accIds.Any())
                    {
                        var matchingTxs = await _context.PigmyTransactions
                            .Where(pt => accIds.Contains(pt.PigmyAccountID) && pt.TransactionType == "DEPOSIT" && pt.ReferenceId == null)
                            .ToListAsync();

                        var rcptSet = new HashSet<string>(rcpts, StringComparer.OrdinalIgnoreCase);

                        foreach (var pt in matchingTxs)
                        {
                            bool isMatch = rcptSet.Any(r => !string.IsNullOrEmpty(r) && pt.Narration.Contains(r));
                            if (!isMatch)
                            {
                                // Fallback match by account, value date, and amount
                                isMatch = settledFullPigmyCols.Any(c => c.PigmyAccountId == pt.PigmyAccountID && c.CollectionDate.Date == pt.ValueDate.Date && c.CollectionAmount == pt.CrAmount);
                            }

                            if (isMatch)
                            {
                                pt.TransactionDate = request.DepositDate; // शाखेत भरणा दिनांक (Deposit Date)
                                pt.ReferenceId = voucher.VoucherNo;      // व्हाउचर क्र.
                                _context.Entry(pt).State = EntityState.Modified;
                            }
                        }
                    }

                    await _context.SaveChangesAsync();
                }
                else
                {
                    await _context.SaveChangesAsync();
                }

                if (supersededVoucherIds.Count > 0)
                {
                    var oldVouchers = await _context.Vouchers
                        .Include(v => v.VoucherDetails)
                        .Where(v => supersededVoucherIds.Contains(v.VoucherID) &&
                                    v.VoucherNo != null &&
                                    !v.VoucherNo.Contains("-AGT-") &&
                                    !v.VoucherNo.Contains("-OP-"))
                        .ToListAsync();
                    if (oldVouchers.Any())
                    {
                        foreach (var ov in oldVouchers)
                        {
                            if (ov.VoucherDetails != null && ov.VoucherDetails.Any())
                            {
                                _context.VoucherDetails.RemoveRange(ov.VoucherDetails);
                            }
                        }
                        _context.Vouchers.RemoveRange(oldVouchers);
                        await _context.SaveChangesAsync();
                    }
                }

                // Record Denomination Breakdown if provided
                if (denomTotal > 0)
                {
                    int cashierId = request.CashierId ?? 0;
                    if (cashierId <= 0)
                    {
                        var defaultCashier = await _context.Cashiers.FirstOrDefaultAsync(c => (c.BranchId == request.BranchId || c.BranchId == null) && c.IsActive);
                        cashierId = defaultCashier?.Id ?? 1;
                    }

                    var denominationEntry = new CashDenomination
                    {
                        BranchId = request.BranchId,
                        CashierId = cashierId,
                        DenominationDate = request.DepositDate,
                        EntryType = "PIGMY_REMITTANCE",
                        Count500 = count500,
                        Count200 = count200,
                        Count100 = count100,
                        Count50 = count50,
                        Count20 = count20,
                        Count10 = count10,
                        Count5 = count5,
                        CountCoins = countCoins,
                        TotalAmount = denomTotal,
                        ExpectedAmount = request.Amount,
                        DifferenceAmount = 0,
                        DifferenceType = "MATCHED",
                        Remarks = $"Pigmy Agent {request.AgentId} Remittance {receiptNo}",
                        VerifiedBy = "Cashier",
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.CashDenominations.Add(denominationEntry);
                    await _context.SaveChangesAsync();
                }

                await transaction.CommitAsync();

                return Ok(new { 
                    message = "एजंट रोख रक्कम यशस्वीरीत्या भरणा झाली व पेंडिंग व्हाउचर जनरेट झाले!", 
                    depositId = deposit.DepositId, 
                    receiptNo = deposit.ReceiptNo,
                    voucherNo = voucher.VoucherNo,
                    schemeBreakup = postedSchemeSummary.Select(kv => new {
                        ledgerId = kv.Key,
                        pigmySchemeId = kv.Value.SchemeId,
                        schemeName = kv.Value.SchemeName,
                        ledgerName = kv.Value.LedgerName,
                        amount = kv.Value.Amount
                    }).ToList()
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "रोख रक्कम भरणा करताना त्रुटी आली: " + ex.Message);
            }
        }

        // GET: api/AgentDayBook/by-voucher/{voucherId}
        [HttpGet("by-voucher/{voucherId}")]
        public async Task<IActionResult> GetDayBookByVoucher(int voucherId)
        {
            var voucher = await _context.Vouchers
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Ledger)
                .FirstOrDefaultAsync(v => v.VoucherID == voucherId);

            if (voucher == null)
            {
                return NotFound(new { message = $"व्हाउचर क्र. {voucherId} सिस्टीममध्ये सापडले नाही." });
            }

            // 1. Try finding deposit by VoucherId
            var deposit = await _context.PigmyAgentCashDeposits
                .Include(d => d.Agent)
                .FirstOrDefaultAsync(d => d.VoucherId == voucherId);

            // 2. Fallback: Parse ReceiptNo from Narration (e.g. Ref: REMD-...)
            if (deposit == null && !string.IsNullOrEmpty(voucher.Narration))
            {
                var match = System.Text.RegularExpressions.Regex.Match(
                    voucher.Narration,
                    @"REMD-[0-9\-]+",
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase
                );
                if (match.Success)
                {
                    string refNo = match.Value;
                    deposit = await _context.PigmyAgentCashDeposits
                        .Include(d => d.Agent)
                        .FirstOrDefaultAsync(d => d.ReceiptNo == refNo);
                }
            }

            PigmyAgent? agent = deposit?.Agent;

            // 3. Fallback: Parse Agent ID from Narration (e.g. "Agent ID 5")
            if (agent == null && !string.IsNullOrEmpty(voucher.Narration))
            {
                var matchAgent = System.Text.RegularExpressions.Regex.Match(
                    voucher.Narration,
                    @"Agent\s+(?:ID\s+)?(\d+)",
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase
                );
                if (matchAgent.Success && int.TryParse(matchAgent.Groups[1].Value, out int aId))
                {
                    agent = await _context.PigmyAgents.FirstOrDefaultAsync(a => a.PigmyAgentID == aId);
                }
            }

            // Also check cash denominations
            var denom = await _context.CashDenominations
                .Where(cd => cd.Remarks != null && cd.Remarks.Contains(deposit != null ? deposit.ReceiptNo : voucher.VoucherNo ?? ""))
                .FirstOrDefaultAsync();

            return Ok(new
            {
                agent = agent != null ? new
                {
                    agent.PigmyAgentID,
                    agent.AgentName,
                    AgentCode = agent.Username ?? ("AGT-" + agent.PigmyAgentID),
                    MobileNo = agent.Customer?.MobileNo ?? ""
                } : null,
                deposit = new
                {
                    DepositId = deposit?.DepositId ?? 0,
                    ReceiptNo = deposit?.ReceiptNo ?? "",
                    DepositDate = deposit?.DepositDate ?? voucher.VoucherDate,
                    Amount = deposit?.Amount ?? voucher.TotalAmount,
                    PaymentMode = deposit?.PaymentMode ?? "CASH",
                    BankLedgerId = (deposit?.PaymentMode != null && !string.Equals(deposit.PaymentMode, "CASH", StringComparison.OrdinalIgnoreCase)) ? voucher.VoucherDetails?.FirstOrDefault(vd => vd.DrCr == "Dr")?.LedgerID : null,
                    Narration = deposit?.Narration ?? voucher.Narration
                },
                denominations = denom != null ? new
                {
                    denom.Count500,
                    denom.Count200,
                    denom.Count100,
                    denom.Count50,
                    denom.Count20,
                    denom.Count10,
                    denom.Count5,
                    denom.CountCoins,
                    denom.TotalAmount
                } : null,
                voucher = new
                {
                    voucher.VoucherID,
                    voucher.VoucherNo,
                    voucher.VoucherDate,
                    voucher.VoucherType,
                    voucher.TotalAmount,
                    voucher.Status,
                    voucher.Narration,
                    voucher.ApprovedBy,
                    voucher.ApprovedOn,
                    CanPass = voucher.Status == "Unapproved" || voucher.Status == "Draft" || voucher.Status == "Pending"
                }
            });
        }

        // GET: api/AgentDayBook/DayCollections?agentId=1&date=2026-10-23
        [HttpGet("DayCollections")]
        public async Task<IActionResult> GetDayCollections([FromQuery] int agentId, [FromQuery] DateTime date)
        {
            if (IsAgentOnlyCaller(out int tokenAgentId) && tokenAgentId != agentId)
            {
                return StatusCode(403, "आपण फक्त स्वतःचे संकलन पाहू शकता.");
            }
            var targetDate = date.Date;
            var nextDate = targetDate.AddDays(1);
            var collections = await _context.PigmyCollections
                .AsNoTracking()
                .Include(c => c.PigmyAccount)
                    .ThenInclude(a => a!.Customer)
                .Include(c => c.PigmyAccount)
                    .ThenInclude(a => a!.PigmyScheme)
                .Where(c => c.AgentId == agentId && c.CollectionDate >= targetDate && c.CollectionDate < nextDate && c.CollectionAmount > 0)
                .OrderBy(c => c.CollectionDate)
                .ThenBy(c => c.CollectionId)
                .Select(c => new
                {
                    collectionId = c.CollectionId,
                    receiptNo = c.ReceiptNo,
                    collectionDate = c.CollectionDate,
                    collectionAmount = c.CollectionAmount,
                    collectionSource = c.CollectionSource ?? "MANUAL",
                    accountId = c.PigmyAccountId,
                    accountNo = c.PigmyAccount != null ? c.PigmyAccount.AccountNo : "",
                    legacyAccountNumber = c.PigmyAccount != null ? (c.PigmyAccount.LegacyAccountNumber ?? c.PigmyAccount.OldAccountNo) : null,
                    pigmySchemeID = c.PigmyAccount != null ? c.PigmyAccount.PigmySchemeID : 0,
                    schemeCode = c.PigmyAccount != null && c.PigmyAccount.PigmyScheme != null ? c.PigmyAccount.PigmyScheme.SchemeCode : null,
                    schemeName = c.PigmyAccount != null && c.PigmyAccount.PigmyScheme != null ? c.PigmyAccount.PigmyScheme.SchemeName : null,
                    customerName = c.PigmyAccount != null && c.PigmyAccount.Customer != null 
                        ? (c.PigmyAccount.Customer.FirstName + " " + (c.PigmyAccount.Customer.MiddleName != null ? c.PigmyAccount.Customer.MiddleName + " " : "") + c.PigmyAccount.Customer.LastName).Trim() 
                        : "खातेदार",
                    mobileNo = c.PigmyAccount != null && c.PigmyAccount.Customer != null ? c.PigmyAccount.Customer.MobileNo : "",
                    voucherId = c.VoucherId
                })
                .ToListAsync();

            return Ok(new
            {
                agentId,
                date = targetDate,
                totalCount = collections.Count,
                totalAmount = collections.Sum(c => c.collectionAmount),
                collections
            });
        }

        // DELETE: api/AgentDayBook/Deposit/{id}
        [HttpDelete("Deposit/{id}")]
        [Authorize(Roles = "Admin,SuperAdmin,HeadOffice,HO_Manager,Manager,BranchManager,Cashier")]
        public async Task<IActionResult> DeleteDeposit(int id)
        {
            var deposit = await _context.PigmyAgentCashDeposits.FindAsync(id);
            if (deposit == null)
            {
                return NotFound("भरणा नोंद (Deposit Record) सापडली नाही.");
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Check if linked to a voucher
                var linkedCols = await _context.PigmyCollections
                    .Where(c => c.RemittanceDepositId == deposit.DepositId ||
                                (deposit.VoucherId.HasValue && c.VoucherId == deposit.VoucherId.Value))
                    .ToListAsync();

                if (linkedCols.Any())
                {
                    var rcpts = linkedCols.Where(c => !string.IsNullOrEmpty(c.ReceiptNo)).Select(c => c.ReceiptNo).Distinct().ToList();
                    var accIds = linkedCols.Select(c => c.PigmyAccountId).Distinct().ToList();

                    foreach (var col in linkedCols)
                    {
                        col.RemittanceDepositId = null;
                        col.VoucherId = null;
                        col.IsVoucherGenerated = false;
                    }

                    if (accIds.Any())
                    {
                        var matchingTxs = await _context.PigmyTransactions
                            .Where(pt => accIds.Contains(pt.PigmyAccountID) && pt.TransactionType == "DEPOSIT")
                            .ToListAsync();

                        var rcptSet = new HashSet<string>(rcpts, StringComparer.OrdinalIgnoreCase);

                        foreach (var pt in matchingTxs)
                        {
                            bool isMatch = rcptSet.Any(r => !string.IsNullOrEmpty(r) && pt.Narration.Contains(r));
                            if (!isMatch && !string.IsNullOrEmpty(pt.ReferenceId))
                            {
                                isMatch = pt.ReferenceId == deposit.ReceiptNo || (deposit.VoucherId.HasValue && pt.ReferenceId.Contains(deposit.DepositDate.ToString("yyyyMMdd")));
                            }

                            if (isMatch)
                            {
                                pt.TransactionDate = pt.ValueDate; // revert to collection date
                                pt.ReferenceId = null;
                                _context.Entry(pt).State = EntityState.Modified;
                            }
                        }
                    }
                }

                if (deposit.VoucherId.HasValue)
                {
                    var voucher = await _context.Vouchers
                        .Include(v => v.VoucherDetails)
                        .FirstOrDefaultAsync(v => v.VoucherID == deposit.VoucherId.Value);

                    if (voucher != null)
                    {
                        if (voucher.Status == "Approved" || voucher.Status == "Passed")
                        {
                            return BadRequest("हे व्हाउचर पास (Approved) झालेले आहे. पास झालेले व्हाउचर थेट डिलीट करता येणार नाही.");
                        }

                        if (voucher.VoucherDetails != null && voucher.VoucherDetails.Any())
                        {
                            _context.VoucherDetails.RemoveRange(voucher.VoucherDetails);
                        }
                        _context.Vouchers.Remove(voucher);
                    }
                }

                // Unlink any Loan, Saving, or RD mobile collections tied to this deposit
                var linkedLoanCols = await _context.LoanCollections.Where(l => l.RemittanceDepositId == deposit.DepositId).ToListAsync();
                foreach (var lc in linkedLoanCols) { lc.RemittanceDepositId = null; lc.VoucherID = null; }

                var linkedSavingTxs = await _context.SavingTransactions.Where(s => s.RemittanceDepositId == deposit.DepositId).ToListAsync();
                foreach (var st in linkedSavingTxs) { st.RemittanceDepositId = null; st.VoucherID = null; }

                var linkedRdTxs = await _context.RdTransactions.Where(r => r.RemittanceDepositId == deposit.DepositId).ToListAsync();
                foreach (var rt in linkedRdTxs) { rt.RemittanceDepositId = null; rt.VoucherID = null; }

                // Remove linked cash denominations if any
                if (!string.IsNullOrEmpty(deposit.ReceiptNo))
                {
                    var denoms = await _context.CashDenominations
                        .Where(cd => cd.Remarks != null && cd.Remarks.Contains(deposit.ReceiptNo))
                        .ToListAsync();
                    if (denoms.Any())
                    {
                        _context.CashDenominations.RemoveRange(denoms);
                    }
                }

                _context.PigmyAgentCashDeposits.Remove(deposit);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { message = "भरणा पावती व संबंधित व्हाउचर यशस्वीरीत्या डिलीट करण्यात आले." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "भरणा पावती डिलीट करताना त्रुटी आली: " + ex.Message);
            }
        }
    }
}
