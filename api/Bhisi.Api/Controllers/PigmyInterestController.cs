using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PigmyInterestController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PigmyInterestController(AppDbContext context)
        {
            _context = context;
        }

        public class InterestPreviewResult
        {
            public int PigmyAccountId { get; set; }
            public string AccountNo { get; set; } = string.Empty;
            public string MemberName { get; set; } = string.Empty;
            public decimal CurrentBalance { get; set; }
            public decimal CalculatedInterest { get; set; }
        }

        [HttpGet("CalculatePreview")]
        public async Task<ActionResult<IEnumerable<InterestPreviewResult>>> CalculatePreview(DateTime startDate, DateTime endDate)
        {
            var activeAccounts = await _context.PigmyAccounts
                .Include(a => a.Member)
                .Include(a => a.PigmyScheme)
                .Where(a => a.Status == "Active")
                .ToListAsync();

            var results = new List<InterestPreviewResult>();

            foreach (var account in activeAccounts)
            {
                if (account.PigmyScheme == null) continue;

                decimal totalInterest = 0;
                var rate = account.InterestRate > 0 ? account.InterestRate : account.PigmyScheme.InterestRate;

                // Loop through each month in the period
                var currentMonth = new DateTime(startDate.Year, startDate.Month, 1);
                var endMonth = new DateTime(endDate.Year, endDate.Month, 1);

                while (currentMonth <= endMonth)
                {
                    var tenthOfMonth = new DateTime(currentMonth.Year, currentMonth.Month, 10, 23, 59, 59);

                    // Get opening balance migrated for this account if any
                    var obAmount = await _context.PigmyOpeningBalances
                        .Where(o => o.PigmyAccountID == account.PigmyAccountID && o.AsOfDate.Date <= tenthOfMonth.Date)
                        .SumAsync(o => (decimal?)o.MigratedBalanceAmount) ?? 0m;

                    // Get total deposited collections up to the 10th
                    var collectionsAmount = await _context.PigmyCollections
                        .Where(c => c.PigmyAccountId == account.PigmyAccountID && c.CollectionDate.Date <= tenthOfMonth.Date)
                        .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;

                    // Get total withdrawals up to the 10th
                    var withdrawalsAmount = await _context.PigmyTransactions
                        .Where(t => t.PigmyAccountID == account.PigmyAccountID 
                            && t.TransactionType == "WITHDRAWAL" 
                            && t.TransactionDate.Date <= tenthOfMonth.Date)
                        .SumAsync(t => (decimal?)t.DrAmount) ?? 0m;

                    var minBalance = obAmount + collectionsAmount - withdrawalsAmount;
                    if (minBalance < 0) minBalance = 0;

                    var monthlyInterest = (minBalance * rate) / (100m * 12m);
                    totalInterest += monthlyInterest;

                    currentMonth = currentMonth.AddMonths(1);
                }

                if (totalInterest > 0)
                {
                    results.Add(new InterestPreviewResult
                    {
                        PigmyAccountId = account.PigmyAccountID,
                        AccountNo = account.AccountNo,
                        MemberName = account.Member != null ? (account.Member.FirstName + " " + (account.Member.LastName ?? "")).Trim() : "",
                        CurrentBalance = account.TotalDepositedAmount,
                        CalculatedInterest = Math.Round(totalInterest, 2)
                    });
                }
            }

            return Ok(results);
        }

        public class PostInterestRequest
        {
            public DateTime StartDate { get; set; }
            public DateTime EndDate { get; set; }
            public int BranchId { get; set; } = 1;
        }

        [HttpPost("PostInterest")]
        public async Task<IActionResult> PostInterest([FromBody] PostInterestRequest request)
        {
            // Idempotency check: Prevent duplicate interest posting for the exact period
            var duplicateExists = await _context.PigmyInterestLogs
                .AnyAsync(l => l.PeriodStartDate.Date == request.StartDate.Date && l.PeriodEndDate.Date == request.EndDate.Date);

            if (duplicateExists)
            {
                return BadRequest(new { message = $"दिनांक {request.StartDate:dd/MM/yyyy} ते {request.EndDate:dd/MM/yyyy} या कालावधीचे पिग्मी व्याज आधीच खात्यावर जमा (Post) केलेले आहे." });
            }

            var previewsResp = await CalculatePreview(request.StartDate, request.EndDate);
            if (previewsResp.Result is not OkObjectResult okResult) return BadRequest(new { message = "व्याज गणना करण्यात त्रुटी आली." });

            var previews = okResult.Value as List<InterestPreviewResult>;
            if (previews == null || !previews.Any()) return Ok(new { message = "या कालावधीत जमा करण्यासाठी कोणतेही व्याज शिल्लक नाही." });

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var defaultExpenseLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("Interest on Pigmy") || l.LedgerName.Contains("Interest") || l.LedgerName.Contains("व्याज"));
                var defaultLiabilityLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("Pigmy Deposit") || l.LedgerName.Contains("पिग्मी"));

                if (defaultExpenseLedger == null) defaultExpenseLedger = await _context.Ledgers.FirstAsync();
                if (defaultLiabilityLedger == null) defaultLiabilityLedger = await _context.Ledgers.FirstAsync();

                var todayStr = DateTime.Now.ToString("yyyyMMdd");
                var lastVoucher = await _context.Vouchers.OrderByDescending(v => v.VoucherID).FirstOrDefaultAsync();
                int nextSeq = (lastVoucher?.VoucherID ?? 0) + 1;

                decimal totalInterestToPost = previews.Sum(p => p.CalculatedInterest);

                // Group preview results by account to get scheme specific ledgers
                var voucherDetails = new List<VoucherDetail>();
                var accountsList = await _context.PigmyAccounts
                    .Include(a => a.PigmyScheme)
                    .Where(a => previews.Select(p => p.PigmyAccountId).Contains(a.PigmyAccountID))
                    .ToListAsync();

                var groupedByScheme = previews.GroupBy(p => {
                    var acc = accountsList.FirstOrDefault(a => a.PigmyAccountID == p.PigmyAccountId);
                    return acc?.PigmyScheme;
                });

                foreach (var group in groupedByScheme)
                {
                    var scheme = group.Key;
                    decimal schemeInterest = group.Sum(x => x.CalculatedInterest);
                    if (schemeInterest <= 0) continue;

                    int expLedgerId = (scheme != null && scheme.InterestExpenseLedgerID.HasValue) 
                        ? scheme.InterestExpenseLedgerID.Value 
                        : defaultExpenseLedger.LedgerID;

                    int liabLedgerId = (scheme != null && scheme.PigmyLiabilityLedgerID.HasValue) 
                        ? scheme.PigmyLiabilityLedgerID.Value 
                        : defaultLiabilityLedger.LedgerID;

                    voucherDetails.Add(new VoucherDetail { LedgerID = expLedgerId, DrCr = "Dr", Amount = schemeInterest });
                    voucherDetails.Add(new VoucherDetail { LedgerID = liabLedgerId, DrCr = "Cr", Amount = schemeInterest });
                }

                if (!voucherDetails.Any())
                {
                    voucherDetails.Add(new VoucherDetail { LedgerID = defaultExpenseLedger.LedgerID, DrCr = "Dr", Amount = totalInterestToPost });
                    voucherDetails.Add(new VoucherDetail { LedgerID = defaultLiabilityLedger.LedgerID, DrCr = "Cr", Amount = totalInterestToPost });
                }

                var voucher = new Voucher
                {
                    BranchID = request.BranchId,
                    VoucherNo = $"VCH-INT-{todayStr}-{nextSeq:D4}",
                    VoucherDate = DateTime.Today,
                    VoucherType = "Journal",
                    TotalAmount = totalInterestToPost,
                    Narration = $"Consolidated Pigmy Interest Posting for period {request.StartDate:dd/MM/yyyy} to {request.EndDate:dd/MM/yyyy}",
                    CreatedBy = 1,
                    VoucherDetails = voucherDetails
                };

                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();

                foreach (var p in previews)
                {
                    var account = await _context.PigmyAccounts.FindAsync(p.PigmyAccountId);
                    if (account != null)
                    {
                        account.TotalDepositedAmount += p.CalculatedInterest;
                        
                        _context.PigmyInterestLogs.Add(new PigmyInterestLog
                        {
                            PigmyAccountId = p.PigmyAccountId,
                            CalculationDate = DateTime.Today,
                            PeriodStartDate = request.StartDate,
                            PeriodEndDate = request.EndDate,
                            InterestAmount = p.CalculatedInterest,
                            VoucherId = voucher.VoucherID
                        });
                    }
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { message = $"Successfully posted total interest of ₹{totalInterestToPost} to {previews.Count} accounts.", voucherNo = voucher.VoucherNo });
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "Internal Server Error during interest posting.");
            }
        }
    }
}
