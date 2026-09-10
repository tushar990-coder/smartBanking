using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SavingInterestPostingsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SavingInterestPostingsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/SavingInterestPostings
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetSavingInterestPostings()
        {
            var postings = await _context.SavingInterestPostings
                .Include(p => p.FinancialYear)
                .OrderByDescending(p => p.PostedOn)
                .Select(p => new {
                    p.PostingID,
                    FinancialYearCode = p.FinancialYear != null ? p.FinancialYear.YearCode : "",
                    p.PeriodStart,
                    p.PeriodEnd,
                    p.TotalInterest,
                    p.VoucherNo,
                    p.PostedOn
                })
                .ToListAsync();

            return Ok(postings);
        }

        // POST: api/SavingInterestPostings/calculate
        [HttpPost("calculate")]
        public async Task<ActionResult<IEnumerable<InterestCalculationResult>>> CalculateInterest([FromBody] InterestCalculationRequest request)
        {
            if (request.PeriodStart >= request.PeriodEnd)
            {
                return BadRequest("Start date must be before end date.");
            }

            var activeAccounts = await _context.SavingAccountMasters
                .Where(a => a.Status == "Active")
                .Include(a => a.Customer)
                .ToListAsync();

            var results = new List<InterestCalculationResult>();

            foreach (var account in activeAccounts)
            {
                decimal interest = CalculateAccountInterest(account, request.PeriodStart, request.PeriodEnd);
                if (interest > 0)
                {
                    string custName = account.Customer != null 
                        ? $"{account.Customer.FirstName} {account.Customer.LastName}".Trim() 
                        : "";
                    results.Add(new InterestCalculationResult
                    {
                        SavingAccountID = account.SavingAccountID,
                        AccountNo = account.AccountNo,
                        CustomerName = custName,
                        MemberName = custName,
                        CurrentBalance = account.CurrentBalance,
                        InterestRate = account.InterestRate,
                        CalculatedInterest = Math.Round(interest, 2)
                    });
                }
            }

            return Ok(results);
        }

        // POST: api/SavingInterestPostings/post
        [HttpPost("post")]
        public async Task<ActionResult> PostInterest([FromBody] InterestPostingRequest request)
        {
            if (request.PeriodStart >= request.PeriodEnd)
            {
                return BadRequest("Start date must be before end date.");
            }

            // 1. Idempotency Check: Prevent duplicate interest posting for overlapping periods
            bool isAlreadyPosted = await _context.SavingInterestPostings
                .AnyAsync(p => (request.PeriodStart <= p.PeriodEnd && request.PeriodEnd >= p.PeriodStart));

            if (isAlreadyPosted)
            {
                return BadRequest($"या कालावधीसाठी ({request.PeriodStart:dd/MM/yyyy} ते {request.PeriodEnd:dd/MM/yyyy}) बचत व्याज आधीच पोस्ट केलेले आहे. दुहेरी व्याज पोस्टिंग करता येणार नाही.");
            }

            var activeYear = await _context.FinancialYears.FirstOrDefaultAsync(y => y.IsActive);
            if (activeYear == null)
            {
                return BadRequest("No active financial year found.");
            }

            // 2. Fetch and validate GL ledgers up-front
            var currentSetting = await _context.SavingInterestSettings
                .Where(s => s.EffectiveDate <= DateTime.Today)
                .OrderByDescending(s => s.EffectiveDate)
                .FirstOrDefaultAsync();

            int expLedgerId = currentSetting?.InterestExpenseLedgerID ?? currentSetting?.LedgerID ?? 0;
            int liabLedgerId = currentSetting?.SavingLiabilityLedgerID ?? 0;

            if (expLedgerId <= 0)
            {
                var foundExp = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("Interest on Savings") || l.LedgerName.Contains("बचत व्या"));
                expLedgerId = foundExp?.LedgerID ?? 0;
            }

            if (liabLedgerId <= 0)
            {
                var foundLiab = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("Saving") || l.LedgerName.Contains("बचत ठेव"));
                liabLedgerId = foundLiab?.LedgerID ?? 0;
            }

            if (expLedgerId <= 0 || liabLedgerId <= 0)
            {
                return BadRequest("बचत व्याज पोस्टिंगसाठी बचत ठेव देयता लेजर (Saving Liability Ledger) किंवा व्याज खर्च लेजर (Interest Expense Ledger) मॅप केलेले नाही. कृपया 'बचत ठेव व्याजदर सेटिंग' मध्ये लेजर मॅपिंग पूर्ण करा.");
            }

            var liabLedger = await _context.Ledgers.FindAsync(liabLedgerId);
            var expLedger = await _context.Ledgers.FindAsync(expLedgerId);
            if (liabLedger == null || expLedger == null)
            {
                return BadRequest("बचत व्याज पोस्टिंगसाठी निवडलेले लेजर खाती अस्तित्वात नाहीत. कृपया लेजर मास्टर तपासा.");
            }

            using var dbTransaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var activeAccounts = await _context.SavingAccountMasters
                    .Where(a => a.Status == "Active")
                    .ToListAsync();

                var branchGroups = activeAccounts.GroupBy(a => a.BranchID).ToList();
                decimal grandTotalInterest = 0;
                var generatedVoucherNos = new List<string>();
                var now = DateTime.Now;
                var todayStr = DateTime.Now.ToString("yyyyMMdd");

                var lastVoucher = await _context.Vouchers.OrderByDescending(v => v.VoucherID).FirstOrDefaultAsync();
                int nextVchSeq = (lastVoucher?.VoucherID ?? 0) + 1;

                foreach (var branchGroup in branchGroups)
                {
                    int branchId = branchGroup.Key;
                    var branchObj = await _context.Branches.FindAsync(branchId);
                    string branchCode = branchObj?.BranchCode ?? "01";

                    decimal branchTotalInterest = 0;
                    var branchTxns = new List<SavingTransaction>();

                    foreach (var account in branchGroup)
                    {
                        decimal interest = CalculateAccountInterest(account, request.PeriodStart, request.PeriodEnd);
                        interest = Math.Round(interest, 2);

                        if (interest > 0)
                        {
                            account.CurrentBalance += interest;
                            account.LastInterestPostingDate = request.PeriodEnd;
                            account.LastInterestAmount = interest;
                            account.UpdatedOn = now;
                            _context.Entry(account).State = EntityState.Modified;

                            var txn = new SavingTransaction
                            {
                                SavingAccountID = account.SavingAccountID,
                                CustomerID = account.CustomerID,
                                TransactionDate = request.PeriodEnd,
                                TransactionType = "Interest",
                                PaymentMode = "Transfer",
                                Amount = interest,
                                BalanceAfterTxn = account.CurrentBalance,
                                Narration = $"बचत व्याज जमा ({request.PeriodStart:dd/MM/yyyy} ते {request.PeriodEnd:dd/MM/yyyy})",
                                CreatedBy = request.PostedBy,
                                CreatedOn = now
                            };
                            branchTxns.Add(txn);
                            branchTotalInterest += interest;
                        }
                    }

                    if (branchTotalInterest > 0)
                    {
                        // Generate Branch-Specific Voucher for this branch
                        string voucherNo = $"VCH-SAV-INT-{branchCode}-{todayStr}-{nextVchSeq:D4}";
                        nextVchSeq++;

                        var voucher = new Voucher
                        {
                            BranchID = branchId,
                            VoucherNo = voucherNo,
                            VoucherDate = DateTime.Today,
                            VoucherType = "Journal",
                            TotalAmount = branchTotalInterest,
                            Narration = $"Savings Interest Posting for branch {branchCode} ({request.PeriodStart:dd/MM/yyyy} to {request.PeriodEnd:dd/MM/yyyy})",
                            CreatedBy = request.PostedBy,
                            VoucherDetails = new List<VoucherDetail>
                            {
                                new VoucherDetail { LedgerID = expLedgerId, DrCr = "Dr", Amount = branchTotalInterest },
                                new VoucherDetail { LedgerID = liabLedgerId, DrCr = "Cr", Amount = branchTotalInterest }
                            }
                        };
                        _context.Vouchers.Add(voucher);

                        foreach (var txn in branchTxns)
                        {
                            txn.VoucherNo = voucherNo;
                            _context.SavingTransactions.Add(txn);
                        }

                        generatedVoucherNos.Add(voucherNo);
                        grandTotalInterest += branchTotalInterest;
                    }
                }

                if (grandTotalInterest > 0)
                {
                    var posting = new SavingInterestPosting
                    {
                        FinancialYearID = activeYear.FinancialYearID,
                        PeriodStart = request.PeriodStart,
                        PeriodEnd = request.PeriodEnd,
                        TotalInterest = grandTotalInterest,
                        VoucherNo = string.Join(", ", generatedVoucherNos),
                        PostedOn = DateTime.Now,
                        PostedBy = request.PostedBy
                    };
                    _context.SavingInterestPostings.Add(posting);
                    await _context.SaveChangesAsync();
                    await dbTransaction.CommitAsync();

                    return Ok(new { 
                        Message = "Interest posted successfully across branches.", 
                        TotalInterest = grandTotalInterest, 
                        Vouchers = generatedVoucherNos,
                        VoucherNo = string.Join(", ", generatedVoucherNos)
                    });
                }
                else
                {
                    return Ok(new { Message = "No interest to post for this period.", TotalInterest = 0 });
                }
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        private decimal CalculateAccountInterest(SavingAccountMaster account, DateTime start, DateTime end)
        {
            // Determine effective start date for this account based on LastInterestPostingDate (+1 day) or OpeningDate
            DateTime accountStartDate = account.LastInterestPostingDate.HasValue
                ? account.LastInterestPostingDate.Value.AddDays(1)
                : account.OpeningDate;

            DateTime effectiveStart = accountStartDate > start ? accountStartDate : start;
            if (effectiveStart > end) return 0;

            // Fetch scheme setting mapped to this account or latest effective setting
            var schemeSetting = _context.SavingInterestSettings
                .Where(s => s.EffectiveDate <= end)
                .OrderByDescending(s => s.EffectiveDate)
                .FirstOrDefault();

            string calcMethod = schemeSetting?.CalculationMethod ?? "Daily Product";
            decimal rate = account.InterestRate / 100;
            decimal totalInterest = 0;

            // Get all transactions for this account ordered by date
            var txns = _context.SavingTransactions
                .Where(t => t.SavingAccountID == account.SavingAccountID && t.TransactionDate <= end)
                .OrderBy(t => t.TransactionDate)
                .ThenBy(t => t.TransactionID)
                .ToList();

            if (calcMethod.Contains("Monthly", StringComparison.OrdinalIgnoreCase) || calcMethod.Contains("Min", StringComparison.OrdinalIgnoreCase))
            {
                // Monthly Minimum Balance Method
                DateTime cur = new DateTime(effectiveStart.Year, effectiveStart.Month, 1);
                DateTime periodEndMonth = new DateTime(end.Year, end.Month, 1);

                while (cur <= periodEndMonth)
                {
                    DateTime monthStart = cur;
                    DateTime monthEnd = cur.AddMonths(1).AddDays(-1);

                    if (monthStart < effectiveStart) monthStart = effectiveStart;
                    if (monthEnd > end) monthEnd = end;

                    decimal minBal = decimal.MaxValue;
                    for (DateTime date = monthStart.Date; date <= monthEnd.Date; date = date.AddDays(1))
                    {
                        var lastTxn = txns.LastOrDefault(t => t.TransactionDate.Date <= date);
                        decimal balance = lastTxn != null ? lastTxn.BalanceAfterTxn : account.OpeningBalance;
                        if (balance < minBal) minBal = balance;
                    }

                    if (minBal != decimal.MaxValue && minBal > 0)
                    {
                        // Monthly interest = minBal * rate / 12
                        totalInterest += minBal * rate / 12m;
                    }

                    cur = cur.AddMonths(1);
                }
            }
            else
            {
                // Daily Product Method (Default)
                for (DateTime date = effectiveStart.Date; date <= end.Date; date = date.AddDays(1))
                {
                    var lastTxn = txns.LastOrDefault(t => t.TransactionDate.Date <= date);
                    decimal balance = lastTxn != null ? lastTxn.BalanceAfterTxn : account.OpeningBalance;
                    decimal daysInYear = DateTime.IsLeapYear(date.Year) ? 366m : 365m;
                    totalInterest += balance * rate / daysInYear;
                }
            }

            return totalInterest;
        }
    }

    public class InterestCalculationRequest
    {
        public DateTime PeriodStart { get; set; }
        public DateTime PeriodEnd { get; set; }
    }

    public class InterestPostingRequest
    {
        public DateTime PeriodStart { get; set; }
        public DateTime PeriodEnd { get; set; }
        public int PostedBy { get; set; } = 1;
    }

    public class InterestCalculationResult
    {
        public int SavingAccountID { get; set; }
        public string AccountNo { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public string MemberName { get; set; } = string.Empty;
        public decimal CurrentBalance { get; set; }
        public decimal InterestRate { get; set; }
        public decimal CalculatedInterest { get; set; }
    }
}
