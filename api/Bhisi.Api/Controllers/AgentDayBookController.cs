using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
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
            public List<DayBreakupDto> DayBreakup { get; set; } = new List<DayBreakupDto>();
            public List<RemittanceItemDto> RecentRemittances { get; set; } = new List<RemittanceItemDto>();
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
            var dailyCollections = await _context.PigmyCollections
                .Where(c => c.AgentId == agentId && c.CollectionAmount > 0)
                .GroupBy(c => c.CollectionDate.Date)
                .Select(g => new
                {
                    Date = g.Key,
                    Count = g.Count(),
                    Amount = g.Sum(x => x.CollectionAmount)
                })
                .OrderBy(x => x.Date)
                .ToListAsync();

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
            var agentExists = await _context.PigmyAgents.AnyAsync(a => a.PigmyAgentID == agentId);
            if (!agentExists) return NotFound("Agent not found.");

            var effectiveDepositDate = (depositDate ?? date ?? DateTime.Today).Date;
            var effectiveFromDate = (fromDate ?? date ?? DateTime.Today).Date;
            var effectiveToDate = (toDate ?? date ?? DateTime.Today).Date;

            // Total Historical Collections (Before deposit date)
            var historicalCollections = await _context.PigmyCollections
                .Where(c => c.AgentId == agentId && c.CollectionDate.Date < effectiveDepositDate)
                .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;

            // Total Historical Deposits (Before deposit date)
            var historicalDeposits = await _context.PigmyAgentCashDeposits
                .Where(d => d.AgentId == agentId && d.DepositDate.Date < effectiveDepositDate)
                .SumAsync(d => (decimal?)d.Amount) ?? 0m;

            // Today's Collection on deposit date
            var todaysCollection = await _context.PigmyCollections
                .Where(c => c.AgentId == agentId && c.CollectionDate.Date == effectiveDepositDate)
                .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;

            // Today's Cash Deposited on deposit date
            var todaysDeposit = await _context.PigmyAgentCashDeposits
                .Where(d => d.AgentId == agentId && d.DepositDate.Date == effectiveDepositDate)
                .SumAsync(d => (decimal?)d.Amount) ?? 0m;

            var openingBalance = historicalCollections - historicalDeposits;
            var closingBalance = openingBalance + todaysCollection - todaysDeposit;

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

            // Total Pending Cash up to deposit date across all time
            var allCollectionsUpToDeposit = await _context.PigmyCollections
                .Where(c => c.AgentId == agentId && c.CollectionDate.Date <= effectiveDepositDate)
                .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;

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
            public string? Narration { get; set; }
            public int BranchId { get; set; } = 1;
            public int? CashierId { get; set; }

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

            // Calculate current holding for validation
            var historicalCollections = await _context.PigmyCollections
                .Where(c => c.AgentId == request.AgentId && c.CollectionDate.Date <= request.DepositDate.Date)
                .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;

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

                // Voucher Auto Generation Logic
                var debitLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("कॅश") || l.LedgerName.Contains("Cash"));
                var creditLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("पिग्मी") || l.LedgerName.Contains("Pigmy") || l.LedgerName.Contains("Suspense"));
                
                if (debitLedger == null) debitLedger = await _context.Ledgers.FirstAsync();
                if (creditLedger == null) creditLedger = await _context.Ledgers.FirstAsync();

                var voucher = new Voucher
                {
                    BranchID = request.BranchId,
                    VoucherNo = $"VCH-{todayStr}-{nextSeq:D4}",
                    VoucherDate = request.DepositDate,
                    VoucherType = "Receipt",
                    Status = "Pending",
                    TotalAmount = request.Amount,
                    Narration = $"Pigmy Cash Remittance by Agent ID {request.AgentId}. Ref: {receiptNo} {combinedNarration}".Trim(),
                    CreatedBy = 1,
                    CreatedOn = DateTime.Now,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        new VoucherDetail { LedgerID = debitLedger.LedgerID, DrCr = "Dr", Amount = request.Amount },
                        new VoucherDetail { LedgerID = creditLedger.LedgerID, DrCr = "Cr", Amount = request.Amount }
                    }
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
                    voucherNo = voucher.VoucherNo
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
            var targetDate = date.Date;
            var nextDate = targetDate.AddDays(1);
            var collections = await _context.PigmyCollections
                .AsNoTracking()
                .Include(c => c.PigmyAccount)
                    .ThenInclude(a => a.Customer)
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
