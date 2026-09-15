using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
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
            public decimal Amount { get; set; }
            public string PaymentMode { get; set; } = "CASH";
            public string Narration { get; set; } = string.Empty;
            public int? VoucherId { get; set; }
            public string? VoucherNo { get; set; }
        }

        public class DayBookSummary
        {
            public decimal OpeningBalance { get; set; }
            public decimal TodaysCollection { get; set; }
            public decimal CashDeposited { get; set; }
            public decimal ClosingBalance { get; set; }
            public List<RemittanceItemDto> RecentRemittances { get; set; } = new List<RemittanceItemDto>();
        }

        // GET: api/AgentDayBook/Summary/5/2024-03-20
        [HttpGet("Summary/{agentId}/{date}")]
        public async Task<ActionResult<DayBookSummary>> GetSummary(int agentId, DateTime date)
        {
            var agentExists = await _context.PigmyAgents.AnyAsync(a => a.PigmyAgentID == agentId);
            if (!agentExists) return NotFound("Agent not found.");

            // Total Historical Collections (Before date)
            var historicalCollections = await _context.PigmyCollections
                .Where(c => c.AgentId == agentId && c.CollectionDate.Date < date.Date)
                .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;

            // Total Historical Deposits (Before date)
            var historicalDeposits = await _context.PigmyAgentCashDeposits
                .Where(d => d.AgentId == agentId && d.DepositDate.Date < date.Date)
                .SumAsync(d => (decimal?)d.Amount) ?? 0m;

            // Today's Collection
            var todaysCollection = await _context.PigmyCollections
                .Where(c => c.AgentId == agentId && c.CollectionDate.Date == date.Date)
                .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;

            // Today's Cash Deposited
            var todaysDeposit = await _context.PigmyAgentCashDeposits
                .Where(d => d.AgentId == agentId && d.DepositDate.Date == date.Date)
                .SumAsync(d => (decimal?)d.Amount) ?? 0m;

            var openingBalance = historicalCollections - historicalDeposits;
            var closingBalance = openingBalance + todaysCollection - todaysDeposit;

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

            var historyItems = deposits.Select(d => new RemittanceItemDto
            {
                DepositId = d.DepositId,
                ReceiptNo = d.ReceiptNo,
                DepositDate = d.DepositDate,
                Amount = d.Amount,
                PaymentMode = d.PaymentMode ?? "CASH",
                Narration = d.Narration ?? "",
                VoucherId = d.VoucherId,
                VoucherNo = (d.VoucherId.HasValue && vouchersMap.ContainsKey(d.VoucherId.Value)) ? vouchersMap[d.VoucherId.Value] : null
            }).ToList();

            return Ok(new DayBookSummary
            {
                OpeningBalance = openingBalance,
                TodaysCollection = todaysCollection,
                CashDeposited = todaysDeposit,
                ClosingBalance = closingBalance,
                RecentRemittances = historyItems
            });
        }

        public class CashDepositDto
        {
            public int AgentId { get; set; }
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
                    Narration = $"Pigmy Cash Remittance by Agent ID {request.AgentId}. Ref: {receiptNo} " + request.Narration,
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
                    Amount = request.Amount,
                    PaymentMode = string.IsNullOrEmpty(request.PaymentMode) ? "CASH" : request.PaymentMode,
                    ReceiptNo = receiptNo,
                    Narration = request.Narration,
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
    }
}
