using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Helpers;
using Bhisi.Api.Models;
using Bhisi.Api.Services;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [EnforceBranchScope]
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
            public string CustomerName { get; set; } = string.Empty;
            public string MemberName { get; set; } = string.Empty;
            public string SchemeName { get; set; } = string.Empty;
            public decimal AppliedInterestRate { get; set; }
            public string CalculationMethod { get; set; } = string.Empty;
            public decimal CurrentBalance { get; set; }
            public decimal CalculatedInterest { get; set; }
        }

        [HttpGet("CalculatePreview")]
        public async Task<ActionResult<IEnumerable<InterestPreviewResult>>> CalculatePreview(
            DateTime startDate,
            DateTime endDate,
            [FromQuery] int? branchId = null)
        {
            if (endDate.Date < startDate.Date)
            {
                return BadRequest(new { message = "अखेरची तारीख सुरुवातीच्या तारखेपेक्षा मोठी असणे आवश्यक आहे." });
            }

            int? scopedBranch = User?.Identity?.IsAuthenticated == true
                ? User.ResolveOptionalBranchId(branchId > 0 ? branchId : null)
                : (branchId > 0 ? branchId : null);

            var query = _context.PigmyAccounts
                .AsNoTracking()
                .Include(a => a.Customer)
                .Include(a => a.PigmyScheme)
                    .ThenInclude(s => s!.Slabs)
                .Where(a => a.Status == "Active");

            if (scopedBranch.HasValue && scopedBranch.Value > 0)
            {
                query = query.Where(a => a.BranchID == scopedBranch.Value);
            }

            var activeAccounts = await query.ToListAsync();
            var results = new List<InterestPreviewResult>();

            foreach (var account in activeAccounts)
            {
                if (account.PigmyScheme == null) continue;

                DateTime cycleStart = (account.EffectiveStartDate ?? account.OpeningDate).Date;
                if (endDate.Date <= cycleStart) continue;

                DateTime effectiveMaturity = PigmyInterestCalculationService.ResolveEffectiveMaturityDate(account);
                bool isPremature = endDate.Date < effectiveMaturity;
                int elapsedDays = Math.Max(0, (int)(endDate.Date - cycleStart).TotalDays);

                var slabRes = PigmyInterestCalculationService.ResolveApplicableSlab(account.PigmyScheme, elapsedDays, isPremature);
                if (slabRes.InterestRate <= 0m) continue;

                decimal alreadyCapitalized = await _context.PigmyInterestLogs
                    .AsNoTracking()
                    .Where(l => l.PigmyAccountId == account.PigmyAccountID && l.Status != "CANCELLED")
                    .SumAsync(l => (decimal?)l.InterestAmount) ?? 0m;

                decimal principalBase = Math.Max(0m, account.TotalDepositedAmount - alreadyCapitalized);
                DateTime calcStart = startDate.Date > cycleStart ? startDate.Date : cycleStart;

                decimal periodInterest;
                if (slabRes.NormalizedMethod == "FLAT")
                {
                    int daysInWindow = Math.Max(0, (int)(endDate.Date - calcStart).TotalDays);
                    periodInterest = Math.Round(
                        (principalBase * slabRes.InterestRate * daysInWindow) / (slabRes.InterestDaysInYear * 100m),
                        2,
                        MidpointRounding.AwayFromZero);
                }
                else
                {
                    periodInterest = await PigmyInterestCalculationService.CalculateClosureOrPeriodInterestAsync(
                        _context,
                        account,
                        principalBase,
                        slabRes,
                        calcStart,
                        endDate.Date);
                }

                if (periodInterest > 0m)
                {
                    string custName = account.Customer != null
                        ? string.Join(" ", new[] { account.Customer.FirstName, account.Customer.MiddleName, account.Customer.LastName }
                            .Where(s => !string.IsNullOrWhiteSpace(s))).Trim()
                        : string.Empty;

                    results.Add(new InterestPreviewResult
                    {
                        PigmyAccountId = account.PigmyAccountID,
                        AccountNo = account.AccountNo,
                        CustomerName = custName,
                        MemberName = custName,
                        SchemeName = account.PigmyScheme.SchemeName,
                        AppliedInterestRate = slabRes.InterestRate,
                        CalculationMethod = slabRes.MethodDisplayLabel,
                        CurrentBalance = account.TotalDepositedAmount,
                        CalculatedInterest = periodInterest
                    });
                }
            }

            return Ok(results);
        }

        public class PostInterestRequest
        {
            public DateTime StartDate { get; set; }
            public DateTime EndDate { get; set; }
            public DateTime? PostingDate { get; set; }
            public int BranchId { get; set; } = 1;
        }

        [HttpPost("PostInterest")]
        public async Task<IActionResult> PostInterest([FromBody] PostInterestRequest request)
        {
            int targetBranchId = User?.Identity?.IsAuthenticated == true
                ? User.ResolveBranchId(request.BranchId > 0 ? request.BranchId : 1)
                : (request.BranchId > 0 ? request.BranchId : 1);

            var duplicateExists = await _context.PigmyInterestLogs
                .Include(l => l.PigmyAccount)
                .AnyAsync(l =>
                    l.Status != "CANCELLED" &&
                    l.PeriodStartDate.Date == request.StartDate.Date &&
                    l.PeriodEndDate.Date == request.EndDate.Date &&
                    (l.PigmyAccount == null || l.PigmyAccount.BranchID == targetBranchId));

            if (duplicateExists)
            {
                return BadRequest(new { message = $"दिनांक {request.StartDate:dd/MM/yyyy} ते {request.EndDate:dd/MM/yyyy} या कालावधीचे पिग्मी व्याज आधीच खात्यावर जमा (Post) केलेले आहे." });
            }

            var previewsResp = await CalculatePreview(request.StartDate, request.EndDate, targetBranchId);
            if (previewsResp.Result is not OkObjectResult okResult)
                return BadRequest(new { message = "व्याज गणना करण्यात त्रुटी आली." });

            var previews = okResult.Value as List<InterestPreviewResult>;
            if (previews == null || !previews.Any())
                return Ok(new { message = "या कालावधीत जमा करण्यासाठी कोणतेही व्याज शिल्लक नाही." });

            var accountsList = await _context.PigmyAccounts
                .Include(a => a.PigmyScheme)
                .Where(a => previews.Select(p => p.PigmyAccountId).Contains(a.PigmyAccountID))
                .ToListAsync();

            // Validate ALL Scheme GL Mappings dynamically upfront (ZERO hardcoded ledger lookups!)
            foreach (var acc in accountsList)
            {
                if (acc.PigmyScheme == null ||
                    !acc.PigmyScheme.PigmyLiabilityLedgerID.HasValue || acc.PigmyScheme.PigmyLiabilityLedgerID.Value <= 0 ||
                    !acc.PigmyScheme.InterestExpenseLedgerID.HasValue || acc.PigmyScheme.InterestExpenseLedgerID.Value <= 0)
                {
                    return BadRequest(new
                    {
                        message = $"पिग्मी योजना '{acc.PigmyScheme?.SchemeName ?? "अज्ञात"}' साठी 'पिग्मी ठेव देयता लेजर' किंवा 'पिग्मी व्याज खर्च लेजर' मॅप केलेले नाही. कृपया प्रथम 'पिग्मी योजना मास्टर' मध्ये लेजर मॅपिंग पूर्ण करा."
                    });
                }
            }

            int userId = User?.Identity?.IsAuthenticated == true && User.GetUserId() > 0 ? User.GetUserId() : 1;

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                DateTime effPostDate = request.PostingDate?.Date ?? request.EndDate.Date;
                var todayStr = effPostDate.ToString("yyyyMMdd");
                var lastVoucher = await _context.Vouchers.OrderByDescending(v => v.VoucherID).FirstOrDefaultAsync();
                int nextSeq = (lastVoucher?.VoucherID ?? 0) + 1;

                decimal totalInterestToPost = previews.Sum(p => p.CalculatedInterest);
                var voucherDetails = new List<VoucherDetail>();

                var groupedByScheme = previews.GroupBy(p =>
                {
                    var acc = accountsList.First(a => a.PigmyAccountID == p.PigmyAccountId);
                    return acc.PigmyScheme!;
                });

                foreach (var group in groupedByScheme)
                {
                    var scheme = group.Key;
                    decimal schemeInterest = group.Sum(x => x.CalculatedInterest);
                    if (schemeInterest <= 0m) continue;

                    voucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = scheme.InterestExpenseLedgerID!.Value,
                        DrCr = "Dr",
                        Amount = schemeInterest
                    });
                    voucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = scheme.PigmyLiabilityLedgerID!.Value,
                        DrCr = "Cr",
                        Amount = schemeInterest
                    });
                }

                var voucher = new Voucher
                {
                    BranchID = targetBranchId,
                    VoucherNo = $"VCH-INT-{todayStr}-{nextSeq:D4}",
                    VoucherDate = effPostDate,
                    VoucherType = "Journal",
                    Status = "Pending",
                    TotalAmount = totalInterestToPost,
                    Narration = $"पिग्मी व्याज पोस्टिंग ({request.StartDate:dd/MM/yyyy} ते {request.EndDate:dd/MM/yyyy})",
                    CreatedBy = userId,
                    CreatedOn = DateTime.Now,
                    VoucherDetails = voucherDetails
                };

                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();
                await VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, voucher.VoucherID, voucher.VoucherNo);

                foreach (var p in previews)
                {
                    var account = accountsList.First(a => a.PigmyAccountID == p.PigmyAccountId);
                    account.TotalDepositedAmount = Math.Round(account.TotalDepositedAmount + p.CalculatedInterest, 2, MidpointRounding.AwayFromZero);

                    _context.PigmyInterestLogs.Add(new PigmyInterestLog
                    {
                        PigmyAccountId = p.PigmyAccountId,
                        CalculationDate = effPostDate,
                        PeriodStartDate = request.StartDate,
                        PeriodEndDate = request.EndDate,
                        InterestAmount = p.CalculatedInterest,
                        VoucherId = voucher.VoucherID
                    });

                    _context.PigmyTransactions.Add(new PigmyTransaction
                    {
                        PigmyAccountID = account.PigmyAccountID,
                        TransactionDate = effPostDate,
                        ValueDate = effPostDate,
                        TransactionType = "INTEREST",
                        DrAmount = 0,
                        CrAmount = p.CalculatedInterest,
                        BalanceAmount = account.TotalDepositedAmount,
                        Narration = $"पिग्मी व्याज जमा ({request.StartDate:dd/MM/yyyy} ते {request.EndDate:dd/MM/yyyy}) - {voucher.VoucherNo}",
                        ReferenceId = voucher.VoucherNo,
                        MakerId = userId,
                        PostedOn = DateTime.Now
                    });
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    message = $"एकूण {previews.Count} पिग्मी खात्यांवर ₹{totalInterestToPost:N2} व्याज जमा करून व्हाउचर क्र. {voucher.VoucherNo} तयार केले.",
                    voucherNo = voucher.VoucherNo,
                    voucherId = voucher.VoucherID
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { message = "व्याज जमा करताना त्रुटी आली: " + ex.Message });
            }
        }
    }
}
