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

            var accountQuery = _context.SavingAccountMasters
                .Where(a => a.Status == "Active");

            if (request.SavingSchemeID.HasValue && request.SavingSchemeID.Value > 0)
            {
                accountQuery = accountQuery.Where(a => a.SavingSchemeID == request.SavingSchemeID.Value);
            }

            var activeAccounts = await accountQuery
                .Include(a => a.Customer)
                .ToListAsync();

            SavingInterestSetting? explicitScheme = (request.SavingSchemeID.HasValue && request.SavingSchemeID.Value > 0)
                ? await _context.SavingInterestSettings.AsNoTracking().FirstOrDefaultAsync(s => s.SettingID == request.SavingSchemeID.Value)
                : null;

            var results = new List<InterestCalculationResult>();

            foreach (var account in activeAccounts)
            {
                decimal? effectiveOverrideRate = (request.OverrideInterestRate.HasValue && request.OverrideInterestRate.Value > 0)
                    ? request.OverrideInterestRate.Value
                    : (explicitScheme != null && explicitScheme.InterestRate > 0 && account.InterestRate <= 0 ? explicitScheme.InterestRate : (decimal?)null);

                decimal interest = CalculateAccountInterest(account, request.PeriodStart, request.PeriodEnd, effectiveOverrideRate, explicitScheme);
                if (interest > 0)
                {
                    string custName = account.Customer != null
                        ? $"{account.Customer.FirstName} {account.Customer.LastName}".Trim()
                        : "";
                    results.Add(new InterestCalculationResult
                    {
                        SavingAccountID = account.SavingAccountID,
                        AccountNo = account.AccountNo,
                        CIFNo = account.Customer?.CIFNo ?? "",
                        CustomerName = custName,
                        CurrentBalance = account.CurrentBalance,
                        InterestRate = effectiveOverrideRate ?? account.InterestRate,
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

            // 1. Idempotency Check: Prevent duplicate interest posting for overlapping periods (scoped by scheme when SavingSchemeID is supplied)
            string schemeTag = (request.SavingSchemeID.HasValue && request.SavingSchemeID.Value > 0)
                ? $"[SCH-{request.SavingSchemeID.Value}]"
                : string.Empty;

            bool isAlreadyPosted = await _context.SavingInterestPostings
                .AnyAsync(p => (request.PeriodStart <= p.PeriodEnd && request.PeriodEnd >= p.PeriodStart) &&
                               (string.IsNullOrEmpty(schemeTag)
                                   ? (p.VoucherNo == null || !p.VoucherNo.Contains("[SCH-"))
                                   : (p.VoucherNo != null && p.VoucherNo.Contains(schemeTag))));

            if (isAlreadyPosted)
            {
                return BadRequest($"या कालावधीसाठी ({request.PeriodStart:dd/MM/yyyy} ते {request.PeriodEnd:dd/MM/yyyy}) बचत/ठेव व्याज आधीच पोस्ट केलेले आहे. दुहेरी व्याज पोस्टिंग करता येणार नाही.");
            }

            var activeYear = await _context.FinancialYears.FirstOrDefaultAsync(y => y.IsActive);
            if (activeYear == null)
            {
                return BadRequest("No active financial year found.");
            }

            // 2. Fetch and validate GL ledgers up-front
            SavingInterestSetting? currentSetting = null;
            if (request.SavingSchemeID.HasValue && request.SavingSchemeID.Value > 0)
            {
                currentSetting = await _context.SavingInterestSettings
                    .FirstOrDefaultAsync(s => s.SettingID == request.SavingSchemeID.Value);
                if (currentSetting == null)
                {
                    return BadRequest("निवडलेली बचत/ठेव योजना आढळली नाही.");
                }
            }
            else
            {
                currentSetting = await _context.SavingInterestSettings
                    .Where(s => s.EffectiveDate <= DateTime.Today)
                    .OrderByDescending(s => s.EffectiveDate)
                    .FirstOrDefaultAsync();
            }

            int expLedgerId = currentSetting?.InterestExpenseLedgerID ?? 0;
            int liabLedgerId = await Helpers.SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(
                _context,
                explicitSchemeId: currentSetting?.SettingID);

            if (expLedgerId <= 0)
            {
                var expMapping = await _context.SavingVoucherMappings
                    .AsNoTracking()
                    .FirstOrDefaultAsync(m => m.OperationType == "InterestExpense");
                expLedgerId = expMapping?.LedgerID ?? 0;
            }

            if (expLedgerId <= 0)
            {
                var foundExp = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("Interest on Savings") || l.LedgerName.Contains("बचत व्या"));
                expLedgerId = foundExp?.LedgerID ?? 0;
            }

            if (expLedgerId <= 0 || liabLedgerId <= 0)
            {
                return BadRequest("बचत/ठेव व्याज पोस्टिंगसाठी देयता लेजर (Saving Liability Ledger) किंवा व्याज खर्च लेजर (Interest Expense Ledger) मॅप केलेले नाही. कृपया 'बचत ठेव व्याजदर सेटिंग' मध्ये लेजर मॅपिंग पूर्ण करा.");
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
                var accQuery = _context.SavingAccountMasters.Where(a => a.Status == "Active");
                if (request.SavingSchemeID.HasValue && request.SavingSchemeID.Value > 0)
                {
                    accQuery = accQuery.Where(a => a.SavingSchemeID == request.SavingSchemeID.Value);
                }
                var activeAccounts = await accQuery.ToListAsync();

                var branchGroups = activeAccounts.GroupBy(a => a.BranchID).ToList();
                decimal grandTotalInterest = 0;
                var generatedVoucherNos = new List<string>();
                var now = DateTime.Now;
                DateTime effPostDate = request.PostingDate?.Date ?? request.PeriodEnd.Date;
                var todayStr = effPostDate.ToString("yyyyMMdd");

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
                        decimal? effectiveOverrideRate = (request.OverrideInterestRate.HasValue && request.OverrideInterestRate.Value > 0)
                            ? request.OverrideInterestRate.Value
                            : (request.SavingSchemeID.HasValue && currentSetting != null && currentSetting.InterestRate > 0 && account.InterestRate <= 0
                                ? currentSetting.InterestRate
                                : (decimal?)null);

                        decimal interest = CalculateAccountInterest(account, request.PeriodStart, request.PeriodEnd, effectiveOverrideRate, currentSetting);
                        interest = Math.Round(interest, 2);

                        if (interest > 0)
                        {
                            decimal usedRate = effectiveOverrideRate ?? account.InterestRate;
                            account.CurrentBalance += interest;
                            if (request.OverrideInterestRate.HasValue && request.OverrideInterestRate.Value > 0)
                            {
                                account.InterestRate = request.OverrideInterestRate.Value;
                            }
                            account.LastInterestPostingDate = request.PeriodEnd;
                            account.LastInterestAmount = interest;
                            account.UpdatedOn = now;
                            _context.Entry(account).State = EntityState.Modified;

                            string schemePrefix = currentSetting != null ? $"{currentSetting.SchemeName} " : "बचत ";
                            var txn = new SavingTransaction
                            {
                                SavingAccountID = account.SavingAccountID,
                                CustomerID = account.CustomerID,
                                BranchID = account.BranchID,
                                TransactionDate = effPostDate,
                                TransactionType = "Interest",
                                PaymentMode = "Transfer",
                                Amount = interest,
                                BalanceAfterTxn = account.CurrentBalance,
                                Narration = $"{schemePrefix}वार्षिक व्याज जमा ({usedRate:N2}% दराने, {request.PeriodStart:dd/MM/yyyy} ते {request.PeriodEnd:dd/MM/yyyy})",
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
                        string voucherNo = await Helpers.VoucherNumberHelper.NextVoucherNoAsync(_context, $"VCH-SAV-INT-{branchCode}-{todayStr}-", 4);
                        nextVchSeq++;

                        var voucher = new Voucher
                        {
                            BranchID = branchId,
                            VoucherNo = voucherNo,
                            VoucherDate = effPostDate,
                            VoucherType = "Journal",
                            TotalAmount = branchTotalInterest,
                            Narration = $"{(currentSetting?.SchemeName ?? "Savings")} Interest Posting for branch {branchCode} ({request.PeriodStart:dd/MM/yyyy} to {request.PeriodEnd:dd/MM/yyyy})",
                            CreatedBy = request.PostedBy,
                            VoucherDetails = new List<VoucherDetail>
                            {
                                new VoucherDetail { LedgerID = expLedgerId, DrCr = "Dr", Amount = branchTotalInterest },
                                new VoucherDetail { LedgerID = liabLedgerId, DrCr = "Cr", Amount = branchTotalInterest }
                            }
                        };
                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();

                        foreach (var txn in branchTxns)
                        {
                            txn.VoucherNo = voucherNo;
                            txn.VoucherID = voucher.VoucherID;
                            _context.SavingTransactions.Add(txn);
                        }

                        generatedVoucherNos.Add(voucherNo);
                        grandTotalInterest += branchTotalInterest;
                    }
                }

                if (grandTotalInterest > 0)
                {
                    string trackedVoucherNos = string.Join(", ", generatedVoucherNos);
                    if (!string.IsNullOrEmpty(schemeTag))
                    {
                        trackedVoucherNos = $"{schemeTag} {trackedVoucherNos}".Trim();
                    }

                    var posting = new SavingInterestPosting
                    {
                        FinancialYearID = activeYear.FinancialYearID,
                        PeriodStart = request.PeriodStart,
                        PeriodEnd = request.PeriodEnd,
                        TotalInterest = grandTotalInterest,
                        VoucherNo = trackedVoucherNos,
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

        private decimal CalculateAccountInterest(SavingAccountMaster account, DateTime start, DateTime end, decimal? overrideRate = null, SavingInterestSetting? explicitScheme = null)
        {
            // Determine effective start date for this account based on LastInterestPostingDate (+1 day) or OpeningDate
            DateTime accountStartDate = account.LastInterestPostingDate.HasValue
                ? account.LastInterestPostingDate.Value.AddDays(1)
                : account.OpeningDate;

            DateTime effectiveStart = accountStartDate > start ? accountStartDate : start;
            if (effectiveStart > end) return 0;

            // Fetch scheme setting mapped to this account or latest effective setting
            var schemeSetting = explicitScheme
                ?? (account.SavingSchemeID.HasValue
                    ? _context.SavingInterestSettings.FirstOrDefault(s => s.SettingID == account.SavingSchemeID.Value)
                    : null)
                ?? _context.SavingInterestSettings
                    .Where(s => s.EffectiveDate <= end)
                    .OrderByDescending(s => s.EffectiveDate)
                    .FirstOrDefault();

            string calcMethod = schemeSetting?.CalculationMethod ?? "Daily Product";
            decimal effectiveRatePct = (overrideRate.HasValue && overrideRate.Value > 0) ? overrideRate.Value : account.InterestRate;
            decimal rate = effectiveRatePct / 100m;
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
        public int? SavingSchemeID { get; set; }
        public decimal? OverrideInterestRate { get; set; }
    }

    public class InterestPostingRequest
    {
        public DateTime PeriodStart { get; set; }
        public DateTime PeriodEnd { get; set; }
        public DateTime? PostingDate { get; set; }
        public int PostedBy { get; set; } = 1;
        public int? SavingSchemeID { get; set; }
        public decimal? OverrideInterestRate { get; set; }
    }

    public class InterestCalculationResult
    {
        public int SavingAccountID { get; set; }
        public string AccountNo { get; set; } = string.Empty;
        public string CIFNo { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public decimal CurrentBalance { get; set; }
        public decimal InterestRate { get; set; }
        public decimal CalculatedInterest { get; set; }
    }
}
