using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Filters;

using Microsoft.AspNetCore.Authorization;
using System.ComponentModel.DataAnnotations;
using Bhisi.Api.Helpers;

namespace Bhisi.Api.Controllers
{
    public class BulkFdReceiptItemDto
    {
        public string? AccountNo { get; set; }
        public string? LegacyAccountNumber { get; set; }
        public decimal DepositAmount { get; set; }
        public string? DurationType { get; set; }
        public int? DurationValue { get; set; }
        public decimal? InterestRate { get; set; }
        public decimal? MaturityAmount { get; set; }
        public DateTime? MaturityDate { get; set; }
    }

    public class BulkFdAccountRequest
    {
        public int BranchID { get; set; } = 1;
        public int? CustomerID { get; set; }
        public int? MemberID { get; set; }
        public int FdSchemeID { get; set; }
        public DateTime OpeningDate { get; set; } = DateTime.Today;
        public decimal TotalAmount { get; set; }
        public int SplitCount { get; set; } = 1;
        public decimal AmountPerReceipt { get; set; }
        public string? DurationType { get; set; } = "Months";
        public int? DurationValue { get; set; }
        public string? NomineeName { get; set; }
        public string? NomineeRelation { get; set; }
        public string? Remarks { get; set; }
        public bool IsSeniorCitizen { get; set; }

        public string PaymentMode { get; set; } = "Cash"; // Cash, Bank, Transfer
        public int? BankAccountLedgerID { get; set; }
        public string? ChequeNo { get; set; }
        public DateTime? ChequeDate { get; set; }
        public int? SavingAccountID { get; set; }

        // CBS Auto-Renewal Configuration
        public bool IsAutoRenewable { get; set; } = false;
        public string AutoRenewalOption { get; set; } = "PrincipalPlusInterest"; // PrincipalPlusInterest, PrincipalOnly
        public int MaxAutoRenewalCycles { get; set; } = 3;

        // Dynamic individual receipt rows from grid
        public List<BulkFdReceiptItemDto>? Receipts { get; set; }
    }

    [Route("api/[controller]")]
    [ApiController]
    public class FdAccountsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public FdAccountsController(AppDbContext context)
        {
            _context = context;
        }

        private (bool isHO, int? userBranchId) GetUserBranchInfo() { int? userBranchId = User.GetOperatingBranchId(); bool isHO = User.IsHeadOfficeAdmin(); return (isHO, userBranchId); }

        private async Task<DateTime> ResolveActiveBusinessDateAsync(int branchId)
        {
            if (Request?.Headers != null &&
                Request.Headers.TryGetValue("X-Business-Date", out var headerVals))
            {
                var rawHeaderDate = headerVals.FirstOrDefault();
                if (!string.IsNullOrWhiteSpace(rawHeaderDate) &&
                    DateTime.TryParse(rawHeaderDate, out DateTime parsedHeaderDate) &&
                    parsedHeaderDate.Year >= 2000)
                {
                    return parsedHeaderDate.Date;
                }
            }

            var claimDate = User?.FindFirst("BusinessDate")?.Value;
            if (!string.IsNullOrWhiteSpace(claimDate) &&
                DateTime.TryParse(claimDate, out DateTime parsedClaimDate) &&
                parsedClaimDate.Year >= 2000)
            {
                return parsedClaimDate.Date;
            }

            int targetBranchId = branchId > 0 ? branchId : (User.GetOperatingBranchId() > 0 ? User.GetOperatingBranchId() : 1);
            var activeRecord = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == targetBranchId && b.BusinessDate.Year >= 2000)
                .OrderByDescending(b => b.BusinessDate)
                .FirstOrDefaultAsync();

            if (activeRecord != null)
            {
                return activeRecord.IsDayClosed
                    ? activeRecord.BusinessDate.Date.AddDays(1)
                    : activeRecord.BusinessDate.Date;
            }

            return DateTime.Today;
        }

        private static bool IsClosureOrRenewalVoucherNo(string? voucherNo)
            => Helpers.FdInterestSettlementHelper.IsClosureOrRenewalVoucherNo(voucherNo);

        /// <summary>
        /// Returns ONLY genuinely verified Interest Payable Provisions currently standing in
        /// the scheme's InterestPayableLedger (excludes orphaned deleted-voucher Accrual rows,
        /// Closure_Interest rows, Capitalized-to-Principal rows, and un-provisioned LegacyAccruedInt).
        /// </summary>
        private async Task<decimal> ResolveVerifiedProvisionedInterestAsync(int fdAccountId, int? interestPayableLedgerId = null)
        {
            var breakdown = await Helpers.FdInterestSettlementHelper.ResolveVerifiedPostingBreakdownAsync(
                _context, fdAccountId, interestPayableLedgerId ?? 0);
            return breakdown.VerifiedProvision;
        }

        private async Task<Dictionary<int, decimal>> ResolveVerifiedProvisionedInterestMapAsync(List<int> fdAccountIds)
        {
            var breakdownMap = await Helpers.FdInterestSettlementHelper.ResolveVerifiedPostingBreakdownMapAsync(_context, fdAccountIds);
            return breakdownMap
                .Where(kv => kv.Value.VerifiedProvision > 0m)
                .ToDictionary(kv => kv.Key, kv => kv.Value.VerifiedProvision);
        }

        private static string? TruncateMax(string? value, int maxLength)
        {
            if (value == null) return null;
            return value.Length <= maxLength ? value : value.Substring(0, maxLength);
        }

        private static string CleanStaleClosureRemarks(string? remarks)
        {
            if (string.IsNullOrWhiteSpace(remarks)) return string.Empty;
            return System.Text.RegularExpressions.Regex.Replace(
                remarks,
                @"\s*\|\s*(?:बंद दिनांक|मुदतपूर्व बंद|मुदतपूर्ती बंद|नूतनीकरण दिनांक|स्वयंचलित नूतनीकरण|खाते पूर्ववत)[^|]*",
                string.Empty).Trim();
        }

        private static string GetDeepestErrorMessage(Exception ex)
        {
            var cur = ex;
            while (cur.InnerException != null) cur = cur.InnerException;
            return cur.Message;
        }

        private async Task<int> ResolveMatchingFinancialYearIdAsync(DateTime targetDate)
        {
            var matchedFy = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(fy => targetDate.Date >= fy.StartDate.Date && targetDate.Date <= fy.EndDate.Date);
            if (matchedFy != null) return matchedFy.FinancialYearID;

            var openActiveFy = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(fy => fy.IsActive && !fy.IsClosed);
            if (openActiveFy != null) return openActiveFy.FinancialYearID;

            throw new InvalidOperationException(
                $"दिनांक {targetDate:dd/MM/yyyy} साठी वैध सक्रिय आर्थिक वर्ष (Financial Year) प्रणालीत उपलब्ध नाही.");
        }

        private async Task<Ledger?> ResolveStrictSchemeLedgerByIdAsync(int? ledgerId)
        {
            if (!ledgerId.HasValue || ledgerId.Value <= 0) return null;
            var ledger = await _context.Ledgers.FindAsync(ledgerId.Value);
            return (ledger != null && ledger.IsActive) ? ledger : null;
        }

        private async Task<(bool IsValid, Ledger? Ledger, string? ErrorMessage)> ResolveCustomOrDefaultLedgerAsync(
            int? customLedgerId,
            Func<Task<Ledger?>> defaultResolver,
            string ledgerTitle)
        {
            if (customLedgerId.HasValue && customLedgerId.Value > 0)
            {
                var customLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerID == customLedgerId.Value && l.IsActive);
                if (customLedger == null)
                {
                    return (false, null, $"निवडलेले {ledgerTitle} लेजर (ID: {customLedgerId.Value}) सापडले नाही किंवा ते निष्क्रिय आहे.");
                }
                return (true, customLedger, null);
            }

            return (true, await defaultResolver(), null);
        }

        private (bool isHO, int? userBranchId) GetUserBranchInfoLegacyUnused()
        {
            int? userBranchId = User.GetOperatingBranchId();
            bool isHO = User.IsHeadOfficeAdmin();
            return (isHO, userBranchId);
        }

        private async Task<(string AccountNo, string FormattedAccountNo, int NextSeq)> GenerateNextFdAccountNoAsync(int branchId, int? schemeId = null, bool incrementSequence = false)
        {
            var branch = await _context.Branches.FindAsync(branchId);
            if (branchId <= 0 || branch == null)
            {
                throw new InvalidOperationException($"अवैध शाखा क्र. ({branchId}) — मुदत ठेव खाते क्रमांक तयार करता येत नाही.");
            }
            int branchIdNum = branch.BranchID;

            int schemeCodeNum = 401;
            if (schemeId.HasValue && schemeId.Value > 0)
            {
                var scheme = await _context.FdSchemes.FindAsync(schemeId.Value);
                if (scheme == null)
                {
                    throw new InvalidOperationException($"मुदत ठेव योजना क्र. ({schemeId.Value}) सापडली नाही.");
                }
                var sDigits = new string((scheme.SchemeCode ?? "").Where(char.IsDigit).ToArray());
                if (!string.IsNullOrEmpty(sDigits) && int.TryParse(sDigits, out int parsed) && parsed > 0)
                {
                    schemeCodeNum = parsed < 100 ? 400 + parsed : parsed;
                }
                else
                {
                    schemeCodeNum = 400 + scheme.FdSchemeID;
                }
            }

            // Dynamically scan all existing accounts in this branch to determine max sequence
            var existingAccounts = await _context.FdAccounts
                .Where(f => f.BranchID == branchId && f.AccountNo != null)
                .Select(f => f.AccountNo!)
                .ToListAsync();

            int maxSeq = 0;
            foreach (var accStr in existingAccounts)
            {
                var digitsOnly = new string(accStr.Where(char.IsDigit).ToArray());
                if (digitsOnly.Length == 14)
                {
                    string seqPart = digitsOnly.Substring(6, 7);
                    if (int.TryParse(seqPart, out int sVal) && sVal > maxSeq)
                    {
                        maxSeq = sVal;
                    }
                }
                else if (accStr.Contains("-FD-", StringComparison.OrdinalIgnoreCase))
                {
                    var lastDash = accStr.LastIndexOf('-');
                    if (lastDash >= 0 && lastDash < accStr.Length - 1)
                    {
                        if (int.TryParse(accStr.Substring(lastDash + 1), out int parsedSeq) && parsedSeq > maxSeq)
                        {
                            maxSeq = parsedSeq;
                        }
                    }
                }
            }

            var seq = await _context.FdAccountSequences
                .FirstOrDefaultAsync(s => s.BranchID == branchId && s.ProductType == "FD");

            if (seq == null)
            {
                seq = new FdAccountSequence { BranchID = branchId, ProductType = "FD", CurrentValue = maxSeq };
                _context.FdAccountSequences.Add(seq);
                await _context.SaveChangesAsync();
            }
            else if (seq.CurrentValue != maxSeq)
            {
                seq.CurrentValue = maxSeq;
                await _context.SaveChangesAsync();
            }

            int nextSeq = seq.CurrentValue + 1;
            string candidate = Helpers.AccountNumberHelper.Generate14DigitAccountNo(branchIdNum, schemeCodeNum, nextSeq);

            // Avoid collisions against both raw 14-digit and formatted 14-digit CBS account numbers
            while (existingAccounts.Contains(candidate) || existingAccounts.Contains(Helpers.AccountNumberHelper.Format14Digit(candidate)))
            {
                nextSeq++;
                candidate = Helpers.AccountNumberHelper.Generate14DigitAccountNo(branchIdNum, schemeCodeNum, nextSeq);
            }

            if (incrementSequence)
            {
                seq.CurrentValue = nextSeq;
                await _context.SaveChangesAsync();
            }

            string formatted = Helpers.AccountNumberHelper.Format14Digit(candidate);
            return (candidate, formatted, nextSeq);
        }

        private async Task<string> CalculateNextFdLegacyAccountNoAsync(int branchId, int? schemeId)
        {
            return await Helpers.FdRenewalPolicyHelper.GenerateNextLegacyAccountNoAsync(_context, branchId, schemeId);
        }

        // GET: api/FdAccounts/next-account-no  (global fallback, 14-digit CBS)
        [HttpGet("next-account-no")]
        public async Task<ActionResult<object>> GetNextAccountNo([FromQuery] int? branchId = null, [FromQuery] int? schemeId = null)
        {
            int bId = branchId ?? (await _context.Branches.Select(b => (int?)b.BranchID).FirstOrDefaultAsync()) ?? 1;
            var (accountNo, formattedNo, nextSeq) = await GenerateNextFdAccountNoAsync(bId, schemeId, incrementSequence: false);
            string nextLegacyAccountNo = await CalculateNextFdLegacyAccountNoAsync(bId, schemeId);
            string lastLegacyAccountNo = (long.TryParse(nextLegacyAccountNo, out long nextL) && nextL > 1) ? (nextL - 1).ToString() : "0";
            return Ok(new {
                accountNo = accountNo,
                nextAccountNo = accountNo,
                formattedAccountNo = formattedNo,
                displayAccountNo = formattedNo,
                branchID = bId,
                schemeId = schemeId,
                nextSeq = nextSeq,
                lastLegacyAccountNo = lastLegacyAccountNo,
                nextLegacyAccountNo = nextLegacyAccountNo
            });
        }

        // GET: api/FdAccounts/next-account-no/{branchId}  (branch-specific, 14-digit CBS)
        [HttpGet("next-account-no/{branchId}")]
        public async Task<ActionResult<object>> GetNextAccountNoForBranch(int branchId, [FromQuery] int? schemeId = null)
        {
            var branch = await _context.Branches.FindAsync(branchId);
            if (branch == null) return NotFound("Branch not found.");

            var (accountNo, formattedNo, nextSeq) = await GenerateNextFdAccountNoAsync(branchId, schemeId, incrementSequence: false);
            string nextLegacyAccountNo = await CalculateNextFdLegacyAccountNoAsync(branchId, schemeId);
            string lastLegacyAccountNo = (long.TryParse(nextLegacyAccountNo, out long nextL) && nextL > 1) ? (nextL - 1).ToString() : "0";
            return Ok(new {
                accountNo = accountNo,
                nextAccountNo = accountNo,
                formattedAccountNo = formattedNo,
                displayAccountNo = formattedNo,
                branchID = branchId,
                schemeId = schemeId,
                nextSeq = nextSeq,
                lastLegacyAccountNo = lastLegacyAccountNo,
                nextLegacyAccountNo = nextLegacyAccountNo
            });
        }

        // GET: api/FdAccounts/check-legacy-receipt
        [HttpGet("check-legacy-receipt")]
        public async Task<ActionResult<object>> CheckLegacyReceipt([FromQuery] int branchId, [FromQuery] int schemeId, [FromQuery] string receiptNo, [FromQuery] int? excludeAccountId = null)
        {
            if (string.IsNullOrWhiteSpace(receiptNo) || schemeId <= 0)
            {
                return Ok(new { isDuplicate = false });
            }

            int effectiveBranchId = User.ResolveRequiredBranchId(branchId > 0 ? branchId : null);
            var trimmed = receiptNo.Trim();
            var query = _context.FdAccounts
                .Include(a => a.Customer)
                .Include(a => a.FdScheme)
                .Where(a => a.FdSchemeID == schemeId 
                    && a.BranchID == effectiveBranchId
                    && a.LegacyAccountNumber != null 
                    && a.LegacyAccountNumber.Trim() == trimmed);

            if (excludeAccountId.HasValue && excludeAccountId.Value > 0)
            {
                query = query.Where(a => a.FdAccountID != excludeAccountId.Value);
            }

            var existing = await query.FirstOrDefaultAsync();
            if (existing != null)
            {
                var sName = existing.FdScheme?.SchemeName ?? "सदर योजना";
                var cName = existing.Customer?.FullName ?? "खातेदार";
                return Ok(new
                {
                    isDuplicate = true,
                    accountNo = existing.AccountNo,
                    customerName = cName,
                    schemeName = sName,
                    message = $"या योजनेअंतर्गत ({sName}) जुना पावती क्र. '{trimmed}' आधीच खाते क्र. '{existing.AccountNo}' ({cName}) साठी नोंदवला आहे. एकाच योजनेमध्ये एक जुना पावती क्र. दोनदा सेव्ह करता येत नाही."
                });
            }

            return Ok(new { isDuplicate = false });
        }

        // 🛡️ Self-healing: Clean orphaned renewal vouchers, orphaned renewed accounts, and stuck Closed parent accounts (14-digit CBS & legacy safe)
        private async Task HealOrphanedRenewalsInternalAsync(int? targetFdAccountId = null)
        {
            await Helpers.FdRenewalRollbackHelper.HealOrphanedRenewalsAsync(_context, targetFdAccountId);
        }

        // GET: api/FdAccounts
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetFdAccounts([FromQuery] int? branchId, [FromQuery] int? customerId = null, [FromQuery] string? status = null, [FromQuery] bool excludeOpeningBalance = false)
        {
            await HealOrphanedRenewalsInternalAsync();

            var query = _context.FdAccounts
                .AsNoTracking()
                .AsSplitQuery()
                .Include(f => f.Customer)
                .Include(f => f.FdScheme)
                .Include(f => f.Branch)
                .AsQueryable();

            var (isHO, userBranchId) = GetUserBranchInfo();
            if (!isHO && userBranchId.HasValue && userBranchId.Value > 0)
            {
                query = query.Where(f => f.BranchID == userBranchId.Value);
            }
            else if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(f => f.BranchID == branchId.Value);
            }

            if (customerId.HasValue && customerId.Value > 0)
            {
                query = query.Where(f => f.CustomerID == customerId.Value);
            }

            if (!string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(f => f.Status == status);
            }

            var seniorCutoffDate = DateTime.Today.AddYears(-60);

            if (excludeOpeningBalance)
            {
                query = query.Where(f =>
                    !f.IsLegacyAccount &&
                    !_context.FdTransactions.Any(t =>
                        t.FdAccountID == f.FdAccountID &&
                        t.TransactionType == "Opening" &&
                        t.Voucher != null &&
                        t.Voucher.VoucherNo.StartsWith("JV-FD-OP-")));
            }

            var accountsList = await query
                .OrderBy(f => f.AccountNo)
                .ThenBy(f => f.FdAccountID)
                .Select(f => new {
                    f.FdAccountID,
                    f.BranchID,
                    BranchName = f.Branch != null ? f.Branch.BranchName : "",
                    f.CustomerID,
                    CustomerName = f.Customer != null ? (f.Customer.FirstName + " " + f.Customer.LastName).Trim() : "",
                    CIFNo = f.Customer != null ? f.Customer.CIFNo : "",
                    MemberID = (int?)null,
                    MemberName = f.Customer != null ? (f.Customer.FirstName + " " + f.Customer.LastName).Trim() : "",
                    MemberCode = f.Customer != null ? f.Customer.CIFNo : "",
                    f.FdSchemeID,
                    SchemeName = f.FdScheme != null ? f.FdScheme.SchemeName : "",
                    SchemeCode = f.FdScheme != null ? f.FdScheme.SchemeCode : "",
                    InterestType = f.FdScheme != null ? f.FdScheme.InterestType : "Simple",
                    InterestPostingMethod = f.FdScheme != null ? f.FdScheme.InterestPostingMethod : "On Principal",
                    InterestCompoundingFrequency = f.FdScheme != null ? f.FdScheme.InterestCompoundingFrequency : "Quarterly",
                    MonthlyInterestAmount = (f.FdScheme != null && (f.FdScheme.InterestType == "MIS" || f.FdScheme.InterestType == "Monthly Interest"))
                        ? Math.Round((f.DepositAmount * f.InterestRate) / 1200.0m, 0, MidpointRounding.AwayFromZero)
                        : 0m,
                    FdLiabilityLedgerID = f.FdScheme != null ? f.FdScheme.FdLiabilityLedgerID : null,
                    FdLiabilityLedgerName = f.FdScheme != null && f.FdScheme.FdLiabilityLedger != null ? f.FdScheme.FdLiabilityLedger.LedgerName : "",
                    InterestExpenseLedgerID = f.FdScheme != null ? f.FdScheme.InterestExpenseLedgerID : null,
                    InterestExpenseLedgerName = f.FdScheme != null && f.FdScheme.InterestExpenseLedger != null ? f.FdScheme.InterestExpenseLedger.LedgerName : "",
                    InterestPayableLedgerID = f.FdScheme != null ? f.FdScheme.InterestPayableLedgerID : null,
                    InterestPayableLedgerName = f.FdScheme != null && f.FdScheme.InterestPayableLedger != null ? f.FdScheme.InterestPayableLedger.LedgerName : "",
                    PrematurePenaltyLedgerID = f.FdScheme != null ? f.FdScheme.PrematurePenaltyLedgerID : null,
                    PrematurePenaltyLedgerName = f.FdScheme != null && f.FdScheme.PrematurePenaltyLedger != null ? f.FdScheme.PrematurePenaltyLedger.LedgerName : "",
                    f.AccountNo,
                    f.ReceiptNo,
                    f.LegacyAccountNumber,
                    f.ParentFdAccountID,
                    f.RootFdAccountID,
                    f.RenewalCycleNo,
                    f.OpeningDate,
                    f.DepositAmount,
                    f.DurationType,
                    f.DurationValue,
                    f.DurationInDays,
                    f.InterestRate,
                    f.MaturityDate,
                    f.MaturityAmount,
                    f.IsLegacyAccount,
                    f.LegacyAccruedInt,
                    f.LastInterestPostingDate,
                    f.Status,
                    f.IsLienMarked,
                    f.LienLoanAccountNo,
                    f.LienAmount,
                    f.NomineeName,
                    f.NomineeRelation,
                    f.Remarks,
                    BirthDate = f.Customer != null ? f.Customer.BirthDate : null,
                    f.PaymentMode,
                    IsSeniorCitizen = f.Customer != null && f.Customer.BirthDate.HasValue && f.Customer.BirthDate.Value <= seniorCutoffDate
                })
                .ToListAsync();

            var accIds = accountsList.Select(x => x.FdAccountID).ToList();
            var postingBreakdowns = await Helpers.FdInterestSettlementHelper.ResolveVerifiedPostingBreakdownMapAsync(_context, accIds);

            var accounts = accountsList.Select(f => {
                var breakdown = postingBreakdowns.TryGetValue(f.FdAccountID, out var bd)
                    ? bd
                    : new Helpers.FdPostingBreakdown();
                decimal posted = breakdown.VerifiedProvision;
                decimal capitalized = breakdown.VerifiedCapitalized;
                decimal backedLegacy = breakdown.BackedLegacyProvision;
                return new {
                    f.FdAccountID,
                    f.BranchID,
                    f.BranchName,
                    f.CustomerID,
                    f.CustomerName,
                    f.CIFNo,
                    f.MemberID,
                    f.MemberName,
                    f.MemberCode,
                    f.FdSchemeID,
                    f.SchemeName,
                    f.SchemeCode,
                    f.InterestType,
                    f.InterestPostingMethod,
                    f.InterestCompoundingFrequency,
                    f.MonthlyInterestAmount,
                    f.FdLiabilityLedgerID,
                    f.FdLiabilityLedgerName,
                    f.InterestExpenseLedgerID,
                    f.InterestExpenseLedgerName,
                    f.InterestPayableLedgerID,
                    f.InterestPayableLedgerName,
                    f.PrematurePenaltyLedgerID,
                    f.PrematurePenaltyLedgerName,
                    f.AccountNo,
                    ReceiptNo = !string.IsNullOrWhiteSpace(f.ReceiptNo)
                        ? f.ReceiptNo
                        : (!string.IsNullOrWhiteSpace(f.LegacyAccountNumber) ? f.LegacyAccountNumber : f.AccountNo),
                    f.LegacyAccountNumber,
                    f.ParentFdAccountID,
                    f.RootFdAccountID,
                    f.RenewalCycleNo,
                    f.OpeningDate,
                    f.DepositAmount,
                    f.DurationType,
                    f.DurationValue,
                    f.DurationInDays,
                    f.InterestRate,
                    f.MaturityDate,
                    f.MaturityAmount,
                    f.IsLegacyAccount,
                    f.LegacyAccruedInt,
                    AlreadyPostedInterest = posted,
                    BackedLegacyProvision = backedLegacy,
                    EffectiveProvisionInterest = posted + backedLegacy,
                    AlreadyCapitalizedInterest = capitalized,
                    TotalPostedInterest = posted + capitalized,
                    f.PaymentMode,
                    f.LastInterestPostingDate,
                    f.Status,
                    f.IsLienMarked,
                    f.LienLoanAccountNo,
                    f.LienAmount,
                    f.NomineeName,
                    f.NomineeRelation,
                    f.Remarks,
                    f.BirthDate,
                    f.IsSeniorCitizen
                };
            }).ToList();

            return Ok(accounts);
        }

        // GET: api/FdAccounts/5
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetFdAccount(int id)
        {
            await HealOrphanedRenewalsInternalAsync(id);

            var f = await _context.FdAccounts
                .AsNoTracking()
                .AsSplitQuery()
                .Include(x => x.Customer)
                .Include(x => x.FdScheme)
                .Include(x => x.Branch)
                .FirstOrDefaultAsync(x => x.FdAccountID == id);

            if (f == null)
            {
                return NotFound();
            }

            var postingBreakdown = await Helpers.FdInterestSettlementHelper.ResolveVerifiedPostingBreakdownAsync(
                _context, id, f.FdScheme?.InterestPayableLedgerID ?? 0);
            decimal alreadyPosted = postingBreakdown.VerifiedProvision;
            decimal alreadyCapitalized = postingBreakdown.VerifiedCapitalized;
            decimal backedLegacy = postingBreakdown.BackedLegacyProvision;

            return Ok(new {
                f.FdAccountID,
                f.BranchID,
                BranchName = f.Branch != null ? f.Branch.BranchName : "",
                f.CustomerID,
                CustomerName = f.Customer != null ? (f.Customer.FirstName + " " + f.Customer.LastName).Trim() : "",
                CIFNo = f.Customer != null ? f.Customer.CIFNo : "",
                MemberID = (int?)null,
                MemberName = f.Customer != null ? (f.Customer.FirstName + " " + f.Customer.LastName).Trim() : "",
                MemberCode = f.Customer?.CIFNo ?? "",
                f.FdSchemeID,
                SchemeName = f.FdScheme != null ? f.FdScheme.SchemeName : "",
                SchemeCode = f.FdScheme != null ? f.FdScheme.SchemeCode : "",
                InterestType = f.FdScheme != null ? f.FdScheme.InterestType : "Simple",
                InterestPostingMethod = f.FdScheme != null ? f.FdScheme.InterestPostingMethod : "On Principal",
                InterestCompoundingFrequency = f.FdScheme != null ? f.FdScheme.InterestCompoundingFrequency : "Quarterly",
                MonthlyInterestAmount = (f.FdScheme != null && (f.FdScheme.InterestType == "MIS" || f.FdScheme.InterestType == "Monthly Interest"))
                    ? Math.Round((f.DepositAmount * f.InterestRate) / 1200.0m, 0, MidpointRounding.AwayFromZero)
                    : 0m,
                f.AccountNo,
                ReceiptNo = Helpers.FdRenewalPolicyHelper.GetEffectiveReceiptNo(f),
                f.LegacyAccountNumber,
                f.ParentFdAccountID,
                f.RootFdAccountID,
                f.RenewalCycleNo,
                f.OpeningDate,
                f.DepositAmount,
                f.DurationType,
                f.DurationValue,
                f.DurationInDays,
                f.InterestRate,
                f.MaturityDate,
                f.MaturityAmount,
                f.IsLegacyAccount,
                f.LegacyAccruedInt,
                AlreadyPostedInterest = alreadyPosted,
                BackedLegacyProvision = backedLegacy,
                EffectiveProvisionInterest = alreadyPosted + backedLegacy,
                AlreadyCapitalizedInterest = alreadyCapitalized,
                TotalPostedInterest = alreadyPosted + alreadyCapitalized,
                f.LastInterestPostingDate,
                f.Status,
                f.IsLienMarked,
                f.LienLoanAccountNo,
                f.LienAmount,
                f.NomineeName,
                f.NomineeRelation,
                f.Remarks,
                BirthDate = f.Customer != null ? f.Customer.BirthDate : null,
                IsSeniorCitizen = f.Customer != null && f.Customer.BirthDate.HasValue && (f.Customer.BirthDate.Value.Date <= DateTime.Today.AddYears(-60))
            });
        }

        // POST: api/FdAccounts
        [HttpPost]
        public async Task<ActionResult<FdAccount>> PostFdAccount(FdAccount account)
        {
            // Multi-branch Security: Enforce branch lock for non-HO users
            int? userBranchId = User.GetOperatingBranchId();
            bool isHO = User.IsHeadOfficeAdmin();

            if (!isHO && userBranchId.HasValue && userBranchId.Value > 0)
            {
                account.BranchID = userBranchId.Value;
            }

            // 1. Load Scheme
            var scheme = await _context.FdSchemes
                .Include(s => s.Slabs)
                .FirstOrDefaultAsync(s => s.FdSchemeID == account.FdSchemeID);
            if (scheme == null)
            {
                return BadRequest("Invalid FD Scheme.");
            }

            // Core Banking Date Safeguards for fresh FD opening (excludes opening balance migrations)
            if (!account.IsLegacyAccount && !account.IsOpeningBalance)
            {
                if (account.OpeningDate.Date > DateTime.Today)
                {
                    return BadRequest("मुदत ठेव उघडण्याची दिनांक भविष्यातील (Future Date) असू शकत नाही.");
                }

                var closedFy = await _context.FinancialYears
                    .FirstOrDefaultAsync(fy => fy.IsClosed && account.OpeningDate.Date >= fy.StartDate.Date && account.OpeningDate.Date <= fy.EndDate.Date);
                if (closedFy != null)
                {
                    return BadRequest($"निवडलेली तारीख बंद झालेल्या आर्थिक वर्षात ({closedFy.YearCode}) मोडत असल्याने या तारखेवर नवीन ठेव उघडता येत नाही.");
                }
            }

            if (scheme.BranchID.HasValue && scheme.BranchID.Value != account.BranchID)
            {
                return BadRequest($"निवडलेली मुदत ठेव योजना फक्त विशिष्ट शाखेसाठी (शाखा क्र. {scheme.BranchID.Value}) मर्यादित आहे. चालू शाखेतून ({account.BranchID}) या योजनेखाली खाते उघडता येत नाही.");
            }

            // 1b. Validate Customer
            if (account.CustomerID <= 0)
            {
                return BadRequest("कृपया खातेदाराची (Customer) निवड करा.");
            }
            var customer = await _context.Customers.FindAsync(account.CustomerID);
            if (customer == null)
            {
                return BadRequest("निवडलेला ग्राहक (Customer) सिस्टीममध्ये अस्तित्वात नाही.");
            }
            if (customer.Status != "Active")
            {
                return BadRequest($"या ग्राहकाचे स्टेटस '{customer.Status}' असल्यामुळे नवीन मुदत ठेव खाते उघडता येत नाही. केवळ सक्रिय (Active) ग्राहकांचीच ठेव स्वीकारली जाऊ शकते.");
            }

            // 2. Validate Limits
            if (account.DepositAmount < scheme.MinimumAmount || account.DepositAmount > scheme.MaximumAmount)
            {
                return BadRequest($"Deposit amount must be between ₹{scheme.MinimumAmount} and ₹{scheme.MaximumAmount}.");
            }

            // [RULE-FD-LEGACY-DUP] Prevent duplicate Old Receipt No under the same Scheme & Branch
            if (!string.IsNullOrWhiteSpace(account.LegacyAccountNumber))
            {
                var trimmedLegacy = account.LegacyAccountNumber.Trim();
                var duplicate = await _context.FdAccounts
                    .Include(a => a.Customer)
                    .Include(a => a.FdScheme)
                    .FirstOrDefaultAsync(a => a.BranchID == account.BranchID 
                        && a.FdSchemeID == account.FdSchemeID 
                        && a.LegacyAccountNumber != null 
                        && a.LegacyAccountNumber.Trim() == trimmedLegacy);

                if (duplicate != null)
                {
                    var sName = duplicate.FdScheme?.SchemeName ?? scheme.SchemeName ?? "सदर योजना";
                    var cName = duplicate.Customer?.FullName ?? "खातेदार";
                    return BadRequest($"या योजनेअंतर्गत ({sName}) जुना पावती क्र. '{trimmedLegacy}' आधीच खाते क्र. '{duplicate.AccountNo}' ({cName}) साठी नोंदवला आहे. एकाच योजनेमध्ये एक जुना पावती क्र. दोनदा सेव्ह करता येत नाही.");
                }
            }

            // 3. Resolve 14-digit CBS Account No (Support custom/edited receipt number)
            var cleanDigits = !string.IsNullOrWhiteSpace(account.AccountNo)
                ? new string(account.AccountNo.Where(char.IsDigit).ToArray())
                : "";

            bool isManualNumber = !string.IsNullOrWhiteSpace(account.AccountNo) && account.AccountNo.Trim() != "AUTO";
            if (isManualNumber)
            {
                var existingAcc = await _context.FdAccounts
                    .Include(a => a.Customer)
                    .FirstOrDefaultAsync(a => a.BranchID == account.BranchID && (a.AccountNo == account.AccountNo.Trim() || (!string.IsNullOrEmpty(cleanDigits) && a.AccountNo == cleanDigits)));
                if (existingAcc != null)
                {
                    return BadRequest($"पावती / खाते क्रमांक '{account.AccountNo}' आधीच अस्तित्वात आहे (खातेदार: {existingAcc.Customer?.FullName ?? "इतर"}). कृपया वेगळा क्रमांक टाका किंवा सिस्टीमने सुचवलेला क्रमांक वापरा.");
                }
            }

            if (!string.IsNullOrWhiteSpace(account.ReceiptNo))
            {
                var receiptConflict = await Helpers.FdRenewalPolicyHelper.FindUnrelatedActiveReceiptConflictAsync(
                    _context, account.BranchID, chainRootId: 0, currentParentId: 0, account.ReceiptNo, schemeId: account.FdSchemeID);
                if (receiptConflict != null)
                {
                    return BadRequest($"पावती क्रमांक '{account.ReceiptNo.Trim()}' आधीच सक्रिय मुदत ठेव खाते क्र. '{receiptConflict.AccountNo}' साठी नोंदवला आहे. कृपया अद्वितीय पावती क्रमांक द्या.");
                }
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    if (!isManualNumber)
                    {
                        var (generatedAccountNo, formattedNo, nextSeq) = await GenerateNextFdAccountNoAsync(account.BranchID, account.FdSchemeID, incrementSequence: true);
                        account.AccountNo = generatedAccountNo;
                    }
                    else
                    {
                        if (cleanDigits.Length == 14)
                        {
                            account.AccountNo = cleanDigits;
                            string seqPart = cleanDigits.Substring(6, 7);
                            if (int.TryParse(seqPart, out int customSeq))
                            {
                                var seq = await _context.FdAccountSequences
                                    .FirstOrDefaultAsync(s => s.BranchID == account.BranchID && s.ProductType == "FD");
                                if (seq != null && customSeq > seq.CurrentValue)
                                {
                                    seq.CurrentValue = customSeq;
                                    await _context.SaveChangesAsync();
                                }
                            }
                        }
                        else if (int.TryParse(cleanDigits, out int simpleSeq) && simpleSeq > 0)
                        {
                            int schemeCodeNum = 401;
                            var sDigits = new string((scheme.SchemeCode ?? "").Where(char.IsDigit).ToArray());
                            if (!string.IsNullOrEmpty(sDigits) && int.TryParse(sDigits, out int parsed) && parsed > 0)
                                schemeCodeNum = parsed < 100 ? 400 + parsed : parsed;
                            else
                                schemeCodeNum = 400 + scheme.FdSchemeID;
                            account.AccountNo = Helpers.AccountNumberHelper.Generate14DigitAccountNo(account.BranchID, schemeCodeNum, simpleSeq);
                            var seq = await _context.FdAccountSequences
                                .FirstOrDefaultAsync(s => s.BranchID == account.BranchID && s.ProductType == "FD");
                            if (seq != null && simpleSeq > seq.CurrentValue)
                            {
                                seq.CurrentValue = simpleSeq;
                                await _context.SaveChangesAsync();
                            }
                        }
                        else
                        {
                            account.AccountNo = account.AccountNo.Trim();
                        }
                    }

                    // 4. Auto-Calculate Maturity Date & Amount with Slabs & Duration Support
                    string durType = !string.IsNullOrWhiteSpace(account.DurationType) ? account.DurationType : (scheme.DurationType ?? "Months");
                    int durVal = account.DurationValue.HasValue && account.DurationValue.Value > 0 ? account.DurationValue.Value : (scheme.DurationMonths > 0 ? scheme.DurationMonths : 12);
                    account.DurationType = durType;
                    account.DurationValue = durVal;

                    DateTime maturityDate;
                    int totalDays;
                    if (durType.Equals("Days", StringComparison.OrdinalIgnoreCase))
                    {
                        totalDays = durVal;
                        maturityDate = account.OpeningDate.AddDays(totalDays);
                    }
                    else if (durType.Equals("Years", StringComparison.OrdinalIgnoreCase))
                    {
                        maturityDate = account.OpeningDate.AddYears(durVal);
                        totalDays = (int)(maturityDate - account.OpeningDate).TotalDays;
                    }
                    else
                    {
                        maturityDate = account.OpeningDate.AddMonths(durVal);
                        totalDays = (int)(maturityDate - account.OpeningDate).TotalDays;
                    }
                    account.DurationInDays = totalDays;
                    account.MaturityDate = maturityDate;

                    bool isSenior = customer.BirthDate.HasValue && (customer.BirthDate.Value.Date <= account.OpeningDate.Date.AddYears(-60));

                    // Resolve Interest Rate based on Slabs or Scheme fixed rate
                    decimal appliedRate;
                    if (scheme.SchemeDurationModel == "Slab")
                    {
                        var matchedSlab = scheme.Slabs?.FirstOrDefault(s => totalDays >= s.FromDays && totalDays <= s.ToDays && s.IsActive);
                        if (matchedSlab == null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"निवडलेला कालावधी ({totalDays} दिवस) मुदत ठेव योजनेच्या कोणत्याही मंजूर स्लॅबमध्ये बसत नाही (योजना मर्यादा: {scheme.MinDurationDays ?? 1} ते {scheme.MaxDurationDays ?? 0} दिवस).");
                        }
                        appliedRate = isSenior ? matchedSlab.SeniorCitizenRate : matchedSlab.InterestRate;
                    }
                    else
                    {
                        appliedRate = isSenior ? scheme.SeniorCitizenInterestRate : scheme.InterestRate;
                    }
                    account.InterestRate = appliedRate;

                    decimal p = account.DepositAmount;
                    decimal r = appliedRate;

                    if (scheme.InterestType == "Cumulative")
                    {
                        int n = 4; // Default Quarterly
                        if (scheme.InterestCompoundingFrequency == "Half-Yearly") n = 2;
                        if (scheme.InterestCompoundingFrequency == "Yearly") n = 1;
                        if (scheme.InterestCompoundingFrequency == "Monthly") n = 12;

                        double baseVal = 1.0 + ((double)r / (n * 100.0));
                        double exponent = n * ((double)totalDays / 365.0);
                        account.MaturityAmount = Math.Round(p * (decimal)Math.Pow(baseVal, exponent), 0, MidpointRounding.AwayFromZero);
                    }
                    else if (scheme.InterestType == "MIS" || scheme.InterestType == "Monthly Interest")
                    {
                        account.MaturityAmount = p;
                    }
                    else
                    {
                        // Simple Interest: A = P * (1 + R*T/100)
                        account.MaturityAmount = Math.Round(p * (1.0m + ((r * (decimal)totalDays) / (365.0m * 100.0m))), 0, MidpointRounding.AwayFromZero);
                    }

                    // 5. Default attributes
                    account.Status = "Active";
                    account.RenewalCycleNo = 0;
                    if (string.IsNullOrWhiteSpace(account.ReceiptNo))
                    {
                        account.ReceiptNo = !string.IsNullOrWhiteSpace(account.LegacyAccountNumber)
                            ? account.LegacyAccountNumber.Trim()
                            : Helpers.AccountNumberHelper.Format14Digit(account.AccountNo);
                    }
                    else
                    {
                        account.ReceiptNo = account.ReceiptNo.Trim();
                    }
                    // Do not override IsLegacyAccount and LegacyAccruedInt sent from frontend
                    account.FinancialYearID = (await _context.FinancialYears.FirstOrDefaultAsync(fy => fy.IsActive))?.FinancialYearID ?? 1;

                    _context.FdAccounts.Add(account);
                    await _context.SaveChangesAsync();

                    if (!account.RootFdAccountID.HasValue || account.RootFdAccountID.Value <= 0)
                    {
                        account.RootFdAccountID = account.FdAccountID;
                        await _context.SaveChangesAsync();
                    }

                    // 6. Post Accounting Voucher (Only if it's a NEW account, not Legacy)
                    Ledger? fdLiabilityLedger = await ResolveFdLiabilityLedgerAsync(scheme);

                    Ledger? debitLedger = null;
                    if (!account.IsLegacyAccount && BankLedgerHelper.IsBankPaymentMode(account.PaymentMode))
                    {
                        var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(_context, account.BankAccountLedgerID);
                        if (!bankCheck.IsValid)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(bankCheck.ErrorMessage);
                        }
                        debitLedger = await _context.Ledgers.FindAsync(bankCheck.LedgerId);
                    }
                    else if (account.PaymentMode == "Transfer")
                    {
                        if (!account.SavingAccountID.HasValue || account.SavingAccountID.Value <= 0)
                        {
                            return BadRequest("कृपया वर्ग करण्यासाठी सभासदाचे बचत खाते निवडा.");
                        }

                        var sbAcc = await _context.SavingAccountMasters.FindAsync(account.SavingAccountID.Value);
                        if (sbAcc == null)
                        {
                            return BadRequest("निवडलेले बचत खाते आढळले नाही.");
                        }

                        var (availableSbBal, effectiveSbMinBal) = await Helpers.SavingLedgerHelper.ResolveAvailableBalanceAsync(_context, sbAcc);
                        if (availableSbBal < account.DepositAmount)
                        {
                            return BadRequest($"अपुऱ्या शिल्लकेमुळे बचत खात्यातून वर्ग करता येणार नाही! तारण रक्कम (₹{sbAcc.LienAmount:N2}) व किमान शिल्लक मर्यादा (₹{effectiveSbMinBal:N2}) वगळता फक्त ₹{availableSbBal:N2} वर्गपात्र शिल्लक आहेत (हवी असलेली रक्कम ₹{account.DepositAmount:N2}).");
                        }

                        int savingLedgerId = await Helpers.SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(_context, sbAcc);
                        if (savingLedgerId > 0)
                        {
                            debitLedger = await _context.Ledgers.FindAsync(savingLedgerId);
                        }

                        if (debitLedger == null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(Helpers.SavingLedgerHelper.GetMissingMappingErrorMessage(sbAcc.AccountNo));
                        }

                        // Deduct balance from Member Savings Account
                        sbAcc.CurrentBalance -= account.DepositAmount;
                    }

                    if (debitLedger == null)
                    {
                        int branchCashId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, account.BranchID, "FD");
                        debitLedger = await _context.Ledgers.FindAsync(branchCashId);
                    }

                    var (voucherStatus, approvedBy, approvedOn) = await Helpers.ApprovalPolicyHelper.DetermineVoucherStatusAsync(_context, account.DepositAmount, account.CreatedBy);

                    Voucher? voucher = null;
                    if (!account.IsLegacyAccount)
                    {
                        if (fdLiabilityLedger == null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest("मुदत ठेव दायित्व लेजर (FD Liability Ledger) सापडले नाही. कृपया योजनेमध्ये लेजर खाते मॅप केले असल्याची खात्री करा.");
                        }

                        if (debitLedger == null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest("डिपॉझिट जमा करण्यासाठी डेबिट लेजर (Cash/Bank/SB) सापडले नाही.");
                        }

                        string vType = account.PaymentMode == "Transfer" ? "Journal" : "Receipt";
                        string vNo = account.PaymentMode == "Transfer"
                            ? $"JV-FD-{account.AccountNo}"
                            : $"REC-FD-{account.AccountNo}";

                        voucher = new Voucher
                        {
                            BranchID = account.BranchID,
                            VoucherNo = vNo,
                            VoucherDate = account.OpeningDate,
                            VoucherType = vType,
                            Status = voucherStatus,
                            ApprovedBy = approvedBy,
                            ApprovedOn = approvedOn,
                            TotalAmount = account.DepositAmount,
                            Narration = $"मुदत ठेव खाते उघडले (FD Account Opened - {account.PaymentMode}): {account.AccountNo}",
                            CreatedBy = account.CreatedBy,
                            CreatedOn = DateTime.Now
                        };

                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();

                        // Link SavingTransaction to Voucher
                        if (account.PaymentMode == "Transfer" && account.SavingAccountID.HasValue && account.SavingAccountID.Value > 0)
                        {
                            var sbAcc = await _context.SavingAccountMasters.FindAsync(account.SavingAccountID.Value);
                            if (sbAcc != null)
                            {
                                _context.SavingTransactions.Add(new SavingTransaction
                                {
                                    SavingAccountID = sbAcc.SavingAccountID,
                                    CustomerID = sbAcc.CustomerID,
                                    BranchID = account.BranchID > 0 ? account.BranchID : sbAcc.BranchID,
                                    TransactionDate = account.OpeningDate,
                                    TransactionType = "Withdrawal",
                                    PaymentMode = "Transfer",
                                    Amount = account.DepositAmount,
                                    BalanceAfterTxn = sbAcc.CurrentBalance,
                                    Narration = $"मुदत ठेव खात्यासाठी वर्ग (FD Opening SB Debit): {account.AccountNo}",
                                    VoucherNo = voucher.VoucherNo,
                                    CreatedBy = account.CreatedBy,
                                    CreatedOn = DateTime.Now
                                });
                            }
                        }

                        var linkedMember = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == account.CustomerID);
                        int? linkedMemberId = linkedMember?.MemberID;

                        // Debit Cash / Bank / SB Savings
                        bool isDebitCustomerPersonal = (account.PaymentMode == "Transfer" || account.PaymentMode == "Savings") 
                            && debitLedger.AccountType != "Cash In Hand" 
                            && !debitLedger.LedgerName.Contains("रोख")
                            && !debitLedger.LedgerName.ToLower().Contains("cash");

                        var debitDetail = new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = debitLedger.LedgerID,
                            DrCr = "Dr",
                            Amount = account.DepositAmount,
                            CustomerID = isDebitCustomerPersonal ? account.CustomerID : null,
                            MemberID = isDebitCustomerPersonal ? linkedMemberId : null
                        };

                        // Credit FD Liability (Mapped Scheme Ledger)
                        var creditDetail = new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = fdLiabilityLedger.LedgerID,
                            DrCr = "Cr",
                            Amount = account.DepositAmount,
                            CustomerID = account.CustomerID,
                            MemberID = linkedMemberId
                        };

                        _context.VoucherDetails.Add(debitDetail);
                        _context.VoucherDetails.Add(creditDetail);

                        await _context.SaveChangesAsync();
                    }

                    // Log initial transaction entry
                    if (fdLiabilityLedger != null)
                    {
                        var tx = new FdTransaction
                        {
                            BranchID = account.BranchID,
                            FdAccountID = account.FdAccountID,
                            VoucherID = voucher?.VoucherID ?? (_context.Vouchers.Local.FirstOrDefault()?.VoucherID ?? 1),
                            TransactionDate = account.OpeningDate,
                            TransactionType = "Opening",
                            DebitCredit = "Cr",
                            Amount = account.DepositAmount,
                            CreatedBy = account.CreatedBy
                        };
                        _context.FdTransactions.Add(tx);
                        if (tx.TransactionType == "Premature_Close" && tx.VoucherID > 0)
                        {
                            await Helpers.VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, tx.VoucherID);
                        }
                        await _context.SaveChangesAsync();
                    }

                    await transaction.CommitAsync();
                    return CreatedAtAction("GetFdAccount", new { id = account.FdAccountID }, account);
                }
                catch (Exception)
                {
                    await transaction.RollbackAsync();
                    throw;
                }
            }
        }

        // DELETE: api/FdAccounts/5
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,SuperAdmin,Manager,HeadOffice")]
        public async Task<IActionResult> DeleteFdAccount(int id, [FromQuery] bool force = false)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var account = await _context.FdAccounts
                    .Include(a => a.Customer)
                    .FirstOrDefaultAsync(a => a.FdAccountID == id);

                if (account == null)
                {
                    return NotFound(new { message = "मुदत ठेव खाते सापडले नाही." });
                }

                // 1. Status Guard: Closed किंवा Renewed खाती ऑडिट रेकॉर्ड असल्याने नष्ट करता येत नाहीत (force=true असल्यास डेटा दुरुस्तीसाठी मुभा)
                if (!force && (string.Equals(account.Status, "Closed", StringComparison.OrdinalIgnoreCase) || 
                               string.Equals(account.Status, "Renewed", StringComparison.OrdinalIgnoreCase)))
                {
                    return BadRequest(new { message = $"सदर मुदत ठेव खाते आधीच '{account.Status}' झालेले आहे. बंद किंवा नूतनीकरण झालेली खाती वैधानिक ऑडिट रेकॉर्डचा भाग असल्याने नष्ट (Delete) करता येत नाहीत." });
                }

                // 2. Specific Lien / Loan Security Guard:
                // तपासा: ही विशिष्ट मुदत ठेव पावती एखाद्या सक्रिय कर्जासाठी थेट तारण (Lien/Security) म्हणून नोंदवलेली आहे का?
                bool isInheritedRenewalLien = account.ParentFdAccountID.HasValue &&
                    account.ParentFdAccountID.Value > 0 &&
                    await _context.FdAccounts.AnyAsync(p => p.FdAccountID == account.ParentFdAccountID.Value && p.IsLienMarked);

                if (account.CustomerID > 0 && !isInheritedRenewalLien)
                {
                    string accNo = account.AccountNo ?? "";
                    string legNo = account.LegacyAccountNumber ?? "";

                    var pledgedLoan = await _context.LoanAccounts
                        .FirstOrDefaultAsync(l => l.Status == "Active" && 
                            ((!string.IsNullOrEmpty(accNo) && l.SecurityDetails != null && l.SecurityDetails.Contains(accNo)) ||
                             (!string.IsNullOrEmpty(legNo) && l.SecurityDetails != null && l.SecurityDetails.Contains(legNo))));

                    bool hasActiveCollateralRow = await _context.LoanDepositCollaterals.AnyAsync(c =>
                        c.CollateralType == "FixedDeposit" &&
                        c.DepositAccountID == account.FdAccountID &&
                        c.LienStatus != "Released");

                    if (account.IsLienMarked || pledgedLoan != null || hasActiveCollateralRow)
                    {
                        string refLoanNo = pledgedLoan?.LoanAccountNo ?? account.LienLoanAccountNo ?? "सक्रिय कर्ज";
                        return BadRequest(new { 
                            message = $"सदर मुदत ठेव पावती '{account.AccountNo}' कर्ज खाते क्र. {refLoanNo} साठी तारण (Lien/Security) म्हणून नोंदवलेली आहे. त्यामुळे हे खाते नष्ट करता येणार नाही." 
                        });
                    }

                    // स्थलांतरित खात्यांसाठी (IsLegacyAccount = true):
                    // आरंभिक शिल्लक स्थलांतरणात डेटा दुरुस्ती/चूक सुधारण्यासाठी खाते डिलीट करण्याची पूर्ण मुभा असावी.
                    // केवळ चालू (Non-legacy) खात्यांसाठी आणि force = false असल्यास जनरल अलर्ट द्यावा
                    if (!account.IsLegacyAccount && !force)
                    {
                        int custId = account.CustomerID;
                        int? linkedMemId = null;
                        var mem = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == custId);
                        if (mem != null) linkedMemId = mem.MemberID;

                        var activeLoansQuery = _context.LoanAccounts
                            .Where(l => l.Status == "Active" && (l.PrincipalBalance > 0 || l.InterestBalance > 0 || l.OverdueInterestBalance > 0));

                        if (linkedMemId.HasValue && linkedMemId.Value > 0)
                        {
                            activeLoansQuery = activeLoansQuery.Where(l => l.CustomerID == custId || l.MemberID == linkedMemId.Value);
                        }
                        else
                        {
                            activeLoansQuery = activeLoansQuery.Where(l => l.CustomerID == custId);
                        }

                        var activeLoans = await activeLoansQuery.ToListAsync();

                        if (activeLoans.Any())
                        {
                            decimal totalLoanLiability = activeLoans.Sum(l => l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance);
                            return BadRequest(new { 
                                message = $"सदर खातेदाराकडे एकूण ₹{totalLoanLiability:N2} चे सक्रिय कर्ज थकीत आहे. पतसंस्थेच्या सुरक्षा नियमांनुसार (Right of Set-off) तपासणी आवश्यक आहे.",
                                canForce = true
                            });
                        }
                    }
                }

                string accountNo = account.AccountNo ?? "";
                int branchId = account.BranchID;
                decimal depositAmount = account.DepositAmount;
                string customerName = account.Customer != null ? $"{account.Customer.FirstName} {account.Customer.LastName}".Trim() : "";
                bool isLegacy = account.IsLegacyAccount;

                // 0. If this FD account was created via FD Renewal, atomically rollback parent renewal
                //    (removes parent's Renewal FdTransaction, JV-FD-REN-* & PAY/JV-FD-INT-* vouchers, and restores parent to Matured/Active)
                if (!isLegacy)
                {
                    var preCheckTxVIds = await _context.FdTransactions
                        .Where(t => t.FdAccountID == id && t.VoucherID > 0)
                        .Select(t => t.VoucherID)
                        .ToListAsync();
                    var preCheckAccVIds = await _context.FdInterestAccruals
                        .Where(a => a.FdAccountID == id && a.VoucherID > 0)
                        .Select(a => a.VoucherID)
                        .ToListAsync();
                    var preCheckMisVIds = await _context.FdMisPayouts
                        .Where(m => m.FdAccountID == id && m.VoucherID.HasValue && m.VoucherID.Value > 0)
                        .Select(m => m.VoucherID!.Value)
                        .ToListAsync();
                    var preCheckAutoVIds = await _context.FdAutoRenewalLogs
                        .Where(l => l.NewFdAccountID == id && l.VoucherID.HasValue && l.VoucherID.Value > 0)
                        .Select(l => l.VoucherID!.Value)
                        .ToListAsync();
                    var preCheckIds = preCheckTxVIds.Union(preCheckAccVIds).Union(preCheckMisVIds).Union(preCheckAutoVIds).Distinct().ToList();

                    bool hasApprovedLinkedVoucher = await _context.Vouchers.AnyAsync(v =>
                        v.Status == "Approved" &&
                        (preCheckIds.Contains(v.VoucherID) ||
                         v.VoucherNo == $"REC-FD-{accountNo}" ||
                         v.VoucherNo == $"JV-FD-{accountNo}" ||
                         v.VoucherNo == $"REC-FD-OP-{accountNo}" ||
                         v.VoucherNo == $"JV-FD-OP-{accountNo}" ||
                         v.VoucherNo == $"JV-FD-REN-{accountNo}" ||
                         v.VoucherNo == $"JV-FD-AUTOREN-{accountNo}" ||
                         v.VoucherNo == $"PAY-FD-INT-{accountNo}" ||
                         v.VoucherNo == $"JV-FD-INT-{accountNo}"));

                    if (hasApprovedLinkedVoucher)
                    {
                        return BadRequest(new { message = "या मुदत ठेव खात्याशी संबंधित व्हाउचर मंजूर (Approved) झालेले आहे. खाते डिलीट करण्यापूर्वी व्हाउचर पासिंगमधून संबंधित व्हाउचर अन-पास (Unpass) करा." });
                    }
                }

                var renewalRollback = await Helpers.FdRenewalRollbackHelper.RollbackParentRenewalOnChildAccountDeleteAsync(_context, account);

                // 1. Identify which vouchers were actually linked to THIS specific account
                // (Collect VoucherIDs from this account's transactions and accruals)
                var accountVoucherIds = await _context.FdTransactions
                    .Where(t => t.FdAccountID == id && t.VoucherID > 0)
                    .Select(t => t.VoucherID)
                    .Distinct()
                    .ToListAsync();

                var accrualVoucherIds = await _context.FdInterestAccruals
                    .Where(a => a.FdAccountID == id && a.VoucherID > 0)
                    .Select(a => a.VoucherID)
                    .Distinct()
                    .ToListAsync();

                var targetVoucherIdSet = new HashSet<int>(accountVoucherIds.Union(accrualVoucherIds));

                // Also check for the exact opening voucher created specifically for this account type
                var matchedOpVouchers = await _context.Vouchers
                    .Where(v => v.VoucherNo == $"REC-FD-{accountNo}" || 
                                v.VoucherNo == $"JV-FD-{accountNo}" || 
                                v.VoucherNo == $"REC-FD-OP-{accountNo}" || 
                                v.VoucherNo == $"JV-FD-OP-{accountNo}")
                    .ToListAsync();

                foreach (var mv in matchedOpVouchers)
                {
                    targetVoucherIdSet.Add(mv.VoucherID);
                }

                // 2. Remove all FdTransactions and FdInterestAccruals for THIS account FIRST
                // (Clears foreign key constraint FK_FdTransactions_Vouchers_VoucherID before deleting Vouchers!)
                var fdTxs = await _context.FdTransactions.Where(t => t.FdAccountID == id).ToListAsync();
                if (fdTxs.Any())
                {
                    _context.FdTransactions.RemoveRange(fdTxs);
                    await _context.SaveChangesAsync();
                }

                var fdAccruals = await _context.FdInterestAccruals.Where(a => a.FdAccountID == id).ToListAsync();
                if (fdAccruals.Any())
                {
                    _context.FdInterestAccruals.RemoveRange(fdAccruals);
                }

                var fdMisPayouts = await _context.FdMisPayouts.Where(m => m.FdAccountID == id).ToListAsync();
                if (fdMisPayouts.Any())
                {
                    foreach (var mis in fdMisPayouts.Where(m => m.VoucherID.HasValue && m.VoucherID.Value > 0))
                    {
                        targetVoucherIdSet.Add(mis.VoucherID!.Value);
                    }
                    _context.FdMisPayouts.RemoveRange(fdMisPayouts);
                }

                var fdAutoRenewalLogs = await _context.FdAutoRenewalLogs
                    .Where(l => l.OldFdAccountID == id || l.NewFdAccountID == id)
                    .ToListAsync();
                if (fdAutoRenewalLogs.Any())
                {
                    _context.FdAutoRenewalLogs.RemoveRange(fdAutoRenewalLogs);
                }
                if (fdAccruals.Any() || fdMisPayouts.Any() || fdAutoRenewalLogs.Any())
                {
                    await _context.SaveChangesAsync();
                }

                // 3. For any target vouchers, verify that NO OTHER table or transaction references them before deleting
                if (targetVoucherIdSet.Any())
                {
                    var vouchersToDelete = new List<Voucher>();
                    foreach (var vId in targetVoucherIdSet)
                    {
                        // Ensure no other FdTransaction references this voucher
                        bool usedByOtherFd = await _context.FdTransactions.AnyAsync(t => t.FdAccountID != id && t.VoucherID == vId);
                        if (usedByOtherFd) continue;

                        // Ensure no other FdInterestAccrual references this voucher
                        bool usedByOtherAccrual = await _context.FdInterestAccruals.AnyAsync(a => a.FdAccountID != id && a.VoucherID == vId);
                        if (usedByOtherAccrual) continue;

                        bool usedByOtherMis = await _context.FdMisPayouts.AnyAsync(m => m.FdAccountID != id && m.VoucherID == vId);
                        if (usedByOtherMis) continue;
                        if (usedByOtherAccrual) continue;

                        var vch = await _context.Vouchers.Include(v => v.VoucherDetails).FirstOrDefaultAsync(v => v.VoucherID == vId);
                        if (vch != null)
                        {
                            vouchersToDelete.Add(vch);
                        }
                    }

                    if (vouchersToDelete.Any())
                    {
                        var delVIds = vouchersToDelete.Select(v => v.VoucherID).ToList();
                        var revVouchers = await _context.Vouchers
                            .Where(v => v.RelatedVoucherID.HasValue && delVIds.Contains(v.RelatedVoucherID.Value))
                            .ToListAsync();
                        foreach (var rv in revVouchers) rv.RelatedVoucherID = null;
                        foreach (var dv in vouchersToDelete) dv.RelatedVoucherID = null;
                        await _context.SaveChangesAsync();
                    }

                    foreach (var vch in vouchersToDelete)
                    {
                        if (vch.VoucherDetails != null && vch.VoucherDetails.Any())
                        {
                            _context.VoucherDetails.RemoveRange(vch.VoucherDetails);
                        }
                        _context.Vouchers.Remove(vch);
                    }

                    if (vouchersToDelete.Any())
                    {
                        await _context.SaveChangesAsync();
                    }
                }

                // 4. Refund Savings Account Transfer debit (match both raw & formatted 14-digit variants + VoucherNo, even if PaymentMode/SavingAccountID wasn't preserved)
                var accVariants = Helpers.FdRenewalRollbackHelper.BuildAccountNumberVariants(accountNo);
                var expectedVoucherNos = accVariants.SelectMany(v => new[] { $"JV-FD-{v}", $"JV-FD-OP-{v}" }).ToHashSet(StringComparer.OrdinalIgnoreCase);

                var sbTxnQuery = _context.SavingTransactions
                    .Where(st => st.TransactionType == "Withdrawal" && st.PaymentMode == "Transfer");

                if (account.SavingAccountID.HasValue && account.SavingAccountID.Value > 0)
                {
                    int targetSbId = account.SavingAccountID.Value;
                    sbTxnQuery = sbTxnQuery.Where(st => st.SavingAccountID == targetSbId);
                }

                var sbCandidateTxns = await sbTxnQuery.ToListAsync();
                var matchedSbTxns = sbCandidateTxns.Where(st =>
                    (!string.IsNullOrWhiteSpace(st.VoucherNo) && expectedVoucherNos.Contains(st.VoucherNo.Trim())) ||
                    (!string.IsNullOrWhiteSpace(st.Narration) &&
                     Helpers.SavingLedgerHelper.IsFdOpeningSbDebitNarration(st.Narration) &&
                     accVariants.Any(av => st.Narration.Contains(av, StringComparison.OrdinalIgnoreCase)) &&
                     Math.Abs(st.Amount - depositAmount) < 0.01m))
                    .ToList();

                // Zero-Fallback safety: if SavingAccountID wasn't recorded on FD, only auto-clean when a single unambiguous SB transaction matches both FD AccountNo and Amount
                if ((!account.SavingAccountID.HasValue || account.SavingAccountID.Value <= 0) && matchedSbTxns.Count > 1)
                {
                    matchedSbTxns.Clear();
                }

                if (matchedSbTxns.Any())
                {
                    var affectedSbIds = new HashSet<int>();
                    foreach (var sbTx in matchedSbTxns)
                    {
                        var sbAcc = await _context.SavingAccountMasters.FindAsync(sbTx.SavingAccountID);
                        if (sbAcc != null)
                        {
                            sbAcc.CurrentBalance = Math.Round(sbAcc.CurrentBalance + sbTx.Amount, 2, MidpointRounding.AwayFromZero);
                            affectedSbIds.Add(sbAcc.SavingAccountID);
                        }

                        var sbPbs = await _context.SavingPassbooks
                            .Where(p => p.TransactionID == sbTx.TransactionID)
                            .ToListAsync();
                        if (sbPbs.Any())
                        {
                            _context.SavingPassbooks.RemoveRange(sbPbs);
                        }
                        _context.SavingTransactions.Remove(sbTx);
                    }

                    await _context.SaveChangesAsync();
                    if (affectedSbIds.Any())
                    {
                        await Helpers.SavingLedgerHelper.RecalculateSavingRunningBalancesAsync(_context, affectedSbIds);
                    }
                }

                // 5. Remove FdAccount itself
                _context.FdAccounts.Remove(account);
                await _context.SaveChangesAsync();

                // If the deleted record was the highest/only FdAccountID, automatically decrement/reseed identity counter
                try
                {
                    var maxRemainingId = await _context.FdAccounts.MaxAsync(f => (int?)f.FdAccountID) ?? 0;
                    if (id >= maxRemainingId)
                    {
                        int reseedVal = maxRemainingId;
                        await _context.Database.ExecuteSqlInterpolatedAsync($"DBCC CHECKIDENT ('FdAccounts', RESEED, {reseedVal});");
                    }
                }
                catch (Exception reseedEx)
                {
                    Console.WriteLine($"[WARNING] FdAccounts DBCC reseed error: {reseedEx.Message}");
                }

                if (isLegacy)
                {
                    try { await SyncFdOpeningBalancesInternalAsync(); } catch { }
                }

                // 6. Rollback FdAccountSequences (Sync to max remaining sequence in this branch)
                var branchSeq = await _context.FdAccountSequences
                    .FirstOrDefaultAsync(s => s.BranchID == branchId && s.ProductType == "FD");

                int remainingMaxSeq = 0;
                var remainingAccounts = await _context.FdAccounts
                    .Where(f => f.BranchID == branchId && f.AccountNo != null)
                    .Select(f => f.AccountNo!)
                    .ToListAsync();

                foreach (var accStr in remainingAccounts)
                {
                    var digitsOnly = new string(accStr.Where(char.IsDigit).ToArray());
                    if (digitsOnly.Length == 14)
                    {
                        string seqPart = digitsOnly.Substring(6, 7);
                        if (int.TryParse(seqPart, out int sVal) && sVal > remainingMaxSeq)
                        {
                            remainingMaxSeq = sVal;
                        }
                    }
                    else if (accStr.Contains("-FD-", StringComparison.OrdinalIgnoreCase))
                    {
                        // Pattern: {Prefix}-{BranchID:D3}-FD-{SeqNo:D6}
                        var lastDash = accStr.LastIndexOf('-');
                        if (lastDash >= 0 && lastDash < accStr.Length - 1)
                        {
                            if (int.TryParse(accStr.Substring(lastDash + 1), out int parsedSeq) && parsedSeq > remainingMaxSeq)
                            {
                                remainingMaxSeq = parsedSeq;
                            }
                        }
                    }
                }

                if (branchSeq != null)
                {
                    branchSeq.CurrentValue = remainingMaxSeq;
                    await _context.SaveChangesAsync();
                }

                // 7. Record Audit Log
                string deleteActionCode = renewalRollback.WasRenewal
                    ? "FD_RENEWAL_ACCOUNT_DELETED"
                    : (isLegacy ? "FD_MIGRATED_OPENING_DELETED" : "FD_OPENING_DIRECT_DELETED");
                string parentRestoreNote = renewalRollback.WasRenewal && !string.IsNullOrEmpty(renewalRollback.OldAccountNo)
                    ? $" मूळ मुदत ठेव खाते क्र. {renewalRollback.OldAccountNo} पुन्हा सक्रिय/मुदतपूर्ण (Restored) केले."
                    : "";

                _context.AuditLogs.Add(new AuditLog
                {
                    Action = deleteActionCode,
                    EntityName = "FdAccount",
                    EntityID = accountNo,
                    Details = $"मुदत ठेव खाते {accountNo} (रक्कम: ₹{depositAmount:N2}, खातेदार: {customerName}) डिलीट केले.{parentRestoreNote} व्हाउचर हटवले आणि पावती अनुक्रमांक सिंक करून {remainingMaxSeq} केला.",
                    Timestamp = DateTime.Now,
                    Status = "Success"
                });
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                return Ok(new
                {
                    message = $"मुदत ठेव खाते '{accountNo}' आणि त्याचे व्हाउचर यशस्वीरीत्या डिलीट झाले.",
                    accountNo = accountNo,
                    rolledBackSequence = remainingMaxSeq
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                var innerMsg = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return StatusCode(500, new { message = $"खाते डिलीट करताना त्रुटी आली: {innerMsg}" });
            }
        }


        // POST: api/FdAccounts/BulkCreate (Create multiple split FD receipts with dynamic grid support)
        [HttpPost("BulkCreate")]
        [Authorize(Roles = "Admin,SuperAdmin,Manager,Officer,Cashier")]
        public async Task<IActionResult> BulkCreateFdAccounts([FromBody] BulkFdAccountRequest req)
        {
            // Multi-branch Security: Enforce branch lock for non-HO users
            int userBranchId = User.GetOperatingBranchId();
            bool isHO = User.IsHeadOfficeAdmin();

            if (!isHO && userBranchId > 0)
            {
                req.BranchID = userBranchId;
            }

            // Resolve Customer & Member
            Customer? customer = null;
            Member? member = null;

            if (req.CustomerID.HasValue && req.CustomerID.Value > 0)
            {
                customer = await _context.Customers.FindAsync(req.CustomerID.Value);
                if (customer == null) return BadRequest(new { message = "निवडलेला ग्राहक सिस्टीममध्ये अस्तित्वात नाही." });
                if (customer.Status != "Active") return BadRequest(new { message = $"या ग्राहकाचे स्टेटस '{customer.Status}' असल्यामुळे नवीन मुदत ठेव खाते उघडता येत नाही. केवळ सक्रिय (Active) ग्राहकांचीच ठेव स्वीकारली जाऊ शकते." });

                member = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == customer.CustomerID);
            }
            else if (req.MemberID.HasValue && req.MemberID.Value > 0)
            {
                member = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == req.MemberID.Value);
                if (member == null) return BadRequest(new { message = "निवडलेला सभासद सिस्टीममध्ये अस्तित्वात नाही." });
                if (member.Status != "Active") return BadRequest(new { message = $"या सभासदाचे स्टेटस '{member.Status}' असल्यामुळे नवीन मुदत ठेव खाते उघडता येत नाही. केवळ सक्रिय (Active) सभासदांचीच ठेव स्वीकारली जाऊ शकते." });

                if (member.CustomerID > 0) customer = await _context.Customers.FindAsync(member.CustomerID);
            }
            else
            {
                return BadRequest(new { message = "कृपया खातेदाराची (Customer / Member) निवड करा." });
            }

            int? resolvedCustomerId = customer?.CustomerID ?? (member?.CustomerID > 0 ? member.CustomerID : null);
            int? resolvedMemberId = member?.MemberID;

            if (!resolvedCustomerId.HasValue || resolvedCustomerId.Value <= 0)
            {
                return BadRequest(new { message = "खातेदाराचा ग्राहक आयडी (Customer ID) उपलब्ध नाही." });
            }

            int finalCustomerId = resolvedCustomerId.Value;

            if (req.FdSchemeID <= 0) return BadRequest(new { message = "कृपया ठेव योजना निवडा." });

            var scheme = await _context.FdSchemes
                .Include(s => s.Slabs)
                .FirstOrDefaultAsync(s => s.FdSchemeID == req.FdSchemeID);
            if (scheme == null) return BadRequest(new { message = "निवडलेली ठेव योजना अमान्य आहे." });

            if (scheme.BranchID.HasValue && scheme.BranchID.Value != req.BranchID)
            {
                return BadRequest(new { message = $"निवडलेली मुदत ठेव योजना फक्त विशिष्ट शाखेसाठी (शाखा क्र. {scheme.BranchID.Value}) मर्यादित आहे. चालू शाखेतून ({req.BranchID}) या योजनेखाली खाते उघडता येत नाही." });
            }

            // Resolve receipt items from grid or generate fallback even split
            var receiptItems = req.Receipts ?? new List<BulkFdReceiptItemDto>();
            if (receiptItems.Count == 0)
            {
                int count = req.SplitCount > 0 ? req.SplitCount : 1;
                decimal perReceipt = req.AmountPerReceipt > 0 ? req.AmountPerReceipt : (req.TotalAmount / count);
                for (int i = 0; i < count; i++)
                {
                    receiptItems.Add(new BulkFdReceiptItemDto
                    {
                        DepositAmount = perReceipt,
                        DurationType = req.DurationType,
                        DurationValue = req.DurationValue
                    });
                }
            }

            if (receiptItems.Count == 0)
            {
                return BadRequest(new { message = "पावत्यांची यादी रिकामी असू शकत नाही." });
            }

            // Financial Reconciliation: Sum(receipts) must equal TotalAmount
            decimal allocatedTotal = receiptItems.Sum(r => r.DepositAmount);
            if (Math.Abs(allocatedTotal - req.TotalAmount) > 0.01m)
            {
                return BadRequest(new { message = $"एकूण ठेव रक्कम (₹{req.TotalAmount:N2}) आणि ग्रिडमधील पावत्यांची बेरीज (₹{allocatedTotal:N2}) जुळत नाही. तफावत: ₹{Math.Abs(allocatedTotal - req.TotalAmount):N2}." });
            }

            // Validate each individual receipt
            for (int i = 0; i < receiptItems.Count; i++)
            {
                var r = receiptItems[i];
                if (r.DepositAmount <= 0)
                {
                    return BadRequest(new { message = $"पावती क्र. {i + 1} ची ठेव रक्कम ० पेक्षा जास्त असावी." });
                }
                if (scheme.MinimumAmount > 0 && r.DepositAmount < scheme.MinimumAmount)
                {
                    return BadRequest(new { message = $"पावती क्र. {i + 1} ची रक्कम (₹{r.DepositAmount:N2}) योजनेच्या किमान रकमेपेक्षा (₹{scheme.MinimumAmount:N2}) कमी आहे." });
                }
                if (scheme.MaximumAmount > 0 && r.DepositAmount > scheme.MaximumAmount)
                {
                    return BadRequest(new { message = $"पावती क्र. {i + 1} ची रक्कम (₹{r.DepositAmount:N2}) योजनेच्या कमाल मर्यादेपेक्षा (₹{scheme.MaximumAmount:N2}) जास्त आहे." });
                }
            }

            // Resolve payment mode & debit ledger
            Ledger? debitLedger = null;
            SavingAccountMaster? sbAcc = null;

            if (BankLedgerHelper.IsBankPaymentMode(req.PaymentMode))
            {
                if (!req.BankAccountLedgerID.HasValue || req.BankAccountLedgerID.Value <= 0)
                {
                    return BadRequest(new { message = "बँक व्यवहारासाठी बँक जी.एल. खाते (Bank GL Account) निवडणे बंधनकारक आहे." });
                }
                var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(_context, req.BankAccountLedgerID);
                if (!bankCheck.IsValid)
                {
                    return BadRequest(new { message = bankCheck.ErrorMessage });
                }
                debitLedger = await _context.Ledgers.FindAsync(bankCheck.LedgerId);
                if (debitLedger == null)
                {
                    return BadRequest(new { message = "निवडलेले बँक खाते लेजर आढळले नाही." });
                }
            }
            else if (string.Equals(req.PaymentMode, "Transfer", StringComparison.OrdinalIgnoreCase) || string.Equals(req.PaymentMode, "Saving", StringComparison.OrdinalIgnoreCase) || string.Equals(req.PaymentMode, "Savings", StringComparison.OrdinalIgnoreCase) || string.Equals(req.PaymentMode, "Saving Transfer", StringComparison.OrdinalIgnoreCase))
            {
                if (!req.SavingAccountID.HasValue || req.SavingAccountID.Value <= 0)
                {
                    return BadRequest(new { message = "कृपया वर्ग करण्यासाठी सभासदाचे बचत खाते निवडा." });
                }

                sbAcc = await _context.SavingAccountMasters.FindAsync(req.SavingAccountID.Value);
                if (sbAcc == null)
                {
                    return BadRequest(new { message = "निवडलेले बचत खाते आढळले नाही." });
                }

                var (bulkAvailableSbBal, bulkEffectiveSbMinBal) = await Helpers.SavingLedgerHelper.ResolveAvailableBalanceAsync(_context, sbAcc);
                if (bulkAvailableSbBal < req.TotalAmount)
                {
                    return BadRequest(new { message = $"अपुऱ्या शिल्लकेमुळे बचत खात्यातून वर्ग करता येणार नाही! तारण रक्कम (₹{sbAcc.LienAmount:N2}) व किमान शिल्लक मर्यादा (₹{bulkEffectiveSbMinBal:N2}) वगळता फक्त ₹{bulkAvailableSbBal:N2} वर्गपात्र शिल्लक आहेत (हवी असलेली एकूण रक्कम ₹{req.TotalAmount:N2})." });
                }

                int savingLedgerId = await Helpers.SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(_context, sbAcc);
                if (savingLedgerId > 0)
                {
                    debitLedger = await _context.Ledgers.FindAsync(savingLedgerId);
                }

                if (debitLedger == null)
                {
                    return BadRequest(new { message = Helpers.SavingLedgerHelper.GetMissingMappingErrorMessage(sbAcc.AccountNo) });
                }
            }

            if (debitLedger == null)
            {
                int branchCashId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, req.BranchID, "FD");
                debitLedger = await _context.Ledgers.FindAsync(branchCashId);
            }

            Ledger? fdLiabilityLedger = await ResolveFdLiabilityLedgerAsync(scheme);
            if (fdLiabilityLedger == null)
            {
                return BadRequest(new { message = "मुदत ठेव दायित्व लेजर (FD Liability Ledger) सापडले नाही. कृपया योजनेमध्ये लेजर खाते मॅप केले असल्याची खात्री करा." });
            }

            if (debitLedger == null)
            {
                return BadRequest(new { message = "डिपॉझिट जमा करण्यासाठी डेबिट लेजर (Cash/Bank/SB) सापडले नाही." });
            }

            var activeFy = await _context.FinancialYears.FirstOrDefaultAsync(fy => fy.IsActive);
            int fyId = activeFy?.FinancialYearID ?? 1;
            bool isSenior = customer?.BirthDate.HasValue == true && (customer.BirthDate.Value.Date <= req.OpeningDate.Date.AddYears(-60));
            
            int currentOperatorId = 1;
            var userClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) ?? User.FindFirst("UserID") ?? User.FindFirst("sub");
            if (userClaim != null && int.TryParse(userClaim.Value, out int uid))
            {
                currentOperatorId = uid;
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // If SB transfer, deduct total from SB account
                SavingTransaction? bulkSbDebitTxn = null;
                if (sbAcc != null)
                {
                    sbAcc.CurrentBalance -= req.TotalAmount;
                    bulkSbDebitTxn = new SavingTransaction
                    {
                        SavingAccountID = sbAcc.SavingAccountID,
                        CustomerID = sbAcc.CustomerID,
                        BranchID = req.BranchID > 0 ? req.BranchID : sbAcc.BranchID,
                        TransactionDate = req.OpeningDate,
                        TransactionType = "Withdrawal",
                        PaymentMode = "Transfer",
                        Amount = req.TotalAmount,
                        BalanceAfterTxn = sbAcc.CurrentBalance,
                        Narration = $"बल्क मुदत ठेव खात्यांसाठी वर्ग ({receiptItems.Count} FD Receipts Total SB Debit)",
                        CreatedBy = currentOperatorId,
                        CreatedOn = DateTime.Now
                    };
                    _context.SavingTransactions.Add(bulkSbDebitTxn);
                }

                var createdAccounts = new List<FdAccount>();
                var createdAccountNos = new List<string>();

                foreach (var item in receiptItems)
                {
                    // 1. Account Number Resolution
                    string resolvedAccountNo = "";
                    bool isManual = !string.IsNullOrWhiteSpace(item.AccountNo) && item.AccountNo.Trim() != "AUTO" && item.AccountNo.Trim() != "---";
                    if (isManual)
                    {
                        string manualAccNo = item.AccountNo!.Trim();
                        var rawCleanDigits = new string(manualAccNo.Where(char.IsDigit).ToArray());
                        string searchCandidate = rawCleanDigits.Length == 14 ? rawCleanDigits : manualAccNo;

                        var dup = await _context.FdAccounts.FirstOrDefaultAsync(a => a.BranchID == req.BranchID && (a.AccountNo == searchCandidate || a.AccountNo == manualAccNo));
                        if (dup != null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(new { message = $"पावती / खाते क्रमांक '{manualAccNo}' आधीच अस्तित्वात आहे. कृपया वेगळा क्रमांक टाका." });
                        }
                        resolvedAccountNo = searchCandidate;

                        // Advance sequence tracker if 14-digit CBS sequence number is higher
                        if (rawCleanDigits.Length == 14)
                        {
                            string seqPart = rawCleanDigits.Substring(6, 7);
                            if (int.TryParse(seqPart, out int customSeq))
                            {
                                var seq = await _context.FdAccountSequences
                                    .FirstOrDefaultAsync(s => s.BranchID == req.BranchID && s.ProductType == "FD");
                                if (seq != null && customSeq > seq.CurrentValue)
                                {
                                    seq.CurrentValue = customSeq;
                                    await _context.SaveChangesAsync();
                                }
                            }
                        }
                    }
                    else
                    {
                        var (genNo, _, _) = await GenerateNextFdAccountNoAsync(req.BranchID, req.FdSchemeID, incrementSequence: true);
                        resolvedAccountNo = genNo;
                    }

                    // 2. Validate Legacy Account Number uniqueness
                    if (!string.IsNullOrWhiteSpace(item.LegacyAccountNumber))
                    {
                        var trimmedLegacy = item.LegacyAccountNumber.Trim();
                        var dupLegacy = await _context.FdAccounts.FirstOrDefaultAsync(a => 
                            a.BranchID == req.BranchID && 
                            a.FdSchemeID == req.FdSchemeID && 
                            a.LegacyAccountNumber != null && 
                            a.LegacyAccountNumber.Trim() == trimmedLegacy);
                        if (dupLegacy != null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(new { message = $"जुना पावती क्र. '{trimmedLegacy}' आधीच खाते क्र. '{dupLegacy.AccountNo}' साठी नोंदवला आहे." });
                        }
                    }

                    // 3. Duration & Maturity
                    string durType = !string.IsNullOrWhiteSpace(item.DurationType) ? item.DurationType : (!string.IsNullOrWhiteSpace(req.DurationType) ? req.DurationType : (scheme.DurationType ?? "Months"));
                    int durVal = item.DurationValue.HasValue && item.DurationValue.Value > 0 ? item.DurationValue.Value : (req.DurationValue.HasValue && req.DurationValue.Value > 0 ? req.DurationValue.Value : (scheme.DurationMonths > 0 ? scheme.DurationMonths : 12));

                    DateTime maturityDate;
                    int totalDays;
                    if (durType.Equals("Days", StringComparison.OrdinalIgnoreCase))
                    {
                        totalDays = durVal;
                        maturityDate = req.OpeningDate.AddDays(totalDays);
                    }
                    else if (durType.Equals("Years", StringComparison.OrdinalIgnoreCase))
                    {
                        totalDays = (int)(req.OpeningDate.AddYears(durVal) - req.OpeningDate).TotalDays;
                        maturityDate = req.OpeningDate.AddYears(durVal);
                    }
                    else
                    {
                        maturityDate = req.OpeningDate.AddMonths(durVal);
                        totalDays = (int)(maturityDate - req.OpeningDate).TotalDays;
                    }

                    // 4. Rate Calculation
                    decimal appliedRate;
                    if (scheme.SchemeDurationModel == "Slab")
                    {
                        var matchedSlab = scheme.Slabs?.FirstOrDefault(s => totalDays >= s.FromDays && totalDays <= s.ToDays && s.IsActive);
                        if (matchedSlab == null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(new { message = $"निवडलेला कालावधी ({totalDays} दिवस) मुदत ठेव योजनेच्या कोणत्याही मंजूर स्लॅबमध्ये बसत नाही." });
                        }
                        appliedRate = isSenior ? matchedSlab.SeniorCitizenRate : matchedSlab.InterestRate;
                    }
                    else
                    {
                        appliedRate = isSenior ? scheme.SeniorCitizenInterestRate : scheme.InterestRate;
                    }

                    decimal p = item.DepositAmount;
                    decimal r = appliedRate;
                    decimal matAmt;

                    if (scheme.InterestType == "Cumulative")
                    {
                        int n = 4;
                        if (scheme.InterestCompoundingFrequency == "Half-Yearly") n = 2;
                        if (scheme.InterestCompoundingFrequency == "Yearly") n = 1;
                        if (scheme.InterestCompoundingFrequency == "Monthly") n = 12;

                        double baseVal = 1.0 + ((double)r / (n * 100.0));
                        double exponent = n * ((double)totalDays / 365.0);
                        matAmt = Math.Round(p * (decimal)Math.Pow(baseVal, exponent), 0, MidpointRounding.AwayFromZero);
                    }
                    else if (scheme.InterestType == "MIS" || scheme.InterestType == "Monthly Interest")
                    {
                        matAmt = p;
                    }
                    else
                    {
                        matAmt = Math.Round(p * (1.0m + ((r * (decimal)totalDays) / (365.0m * 100.0m))), 0, MidpointRounding.AwayFromZero);
                    }

                    var acc = new FdAccount
                    {
                        BranchID = req.BranchID,
                        CustomerID = finalCustomerId,
                        FdSchemeID = req.FdSchemeID,
                        AccountNo = resolvedAccountNo,
                        ReceiptNo = !string.IsNullOrWhiteSpace(item.LegacyAccountNumber)
                            ? item.LegacyAccountNumber.Trim()
                            : Helpers.AccountNumberHelper.Format14Digit(resolvedAccountNo),
                        LegacyAccountNumber = item.LegacyAccountNumber?.Trim(),
                        RenewalCycleNo = 0,
                        OpeningDate = req.OpeningDate,
                        DepositAmount = p,
                        DurationType = durType,
                        DurationValue = durVal,
                        DurationInDays = totalDays,
                        InterestRate = appliedRate,
                        MaturityDate = maturityDate,
                        MaturityAmount = matAmt,
                        IsLegacyAccount = false,
                        LegacyAccruedInt = 0,
                        Status = "Active",
                        NomineeName = req.NomineeName ?? "",
                        NomineeRelation = req.NomineeRelation ?? "",
                        Remarks = string.IsNullOrWhiteSpace(req.Remarks) 
                            ? $"बल्क मुदत ठेव पावती ({createdAccounts.Count + 1}/{receiptItems.Count})"
                            : $"{req.Remarks} - पावती ({createdAccounts.Count + 1}/{receiptItems.Count})",
                        PaymentMode = req.PaymentMode ?? "Cash",
                        BankAccountLedgerID = req.BankAccountLedgerID,
                        ChequeNo = req.ChequeNo,
                        ChequeDate = req.ChequeDate,
                        SavingAccountID = req.SavingAccountID,
                        IsAutoRenewable = req.IsAutoRenewable,
                        AutoRenewalOption = string.IsNullOrWhiteSpace(req.AutoRenewalOption) ? "PrincipalPlusInterest" : req.AutoRenewalOption,
                        MaxAutoRenewalCycles = req.MaxAutoRenewalCycles > 0 ? req.MaxAutoRenewalCycles : 3,
                        AutoRenewalCount = 0,
                        FinancialYearID = fyId,
                        CreatedBy = currentOperatorId,
                        CreatedDate = DateTime.Now
                    };

                    _context.FdAccounts.Add(acc);
                    createdAccounts.Add(acc);
                    createdAccountNos.Add(resolvedAccountNo);
                }

                await _context.SaveChangesAsync();

                foreach (var createdAcc in createdAccounts)
                {
                    if (!createdAcc.RootFdAccountID.HasValue || createdAcc.RootFdAccountID.Value <= 0)
                    {
                        createdAcc.RootFdAccountID = createdAcc.FdAccountID;
                    }
                }
                if (createdAccounts.Any())
                {
                    await _context.SaveChangesAsync();
                }

                // 8. Create Consolidated Accounting Voucher
                var (voucherStatus, approvedBy, approvedOn) = await Helpers.ApprovalPolicyHelper.DetermineVoucherStatusAsync(_context, req.TotalAmount, currentOperatorId);

                string firstAcc = createdAccountNos.FirstOrDefault() ?? "FD";
                string lastAcc = createdAccountNos.LastOrDefault() ?? "FD";
                string firstAccFormatted = Helpers.AccountNumberHelper.Format14Digit(firstAcc);
                string lastAccFormatted = Helpers.AccountNumberHelper.Format14Digit(lastAcc);

                bool isBulkTransfer = string.Equals(req.PaymentMode, "Transfer", StringComparison.OrdinalIgnoreCase) || string.Equals(req.PaymentMode, "Saving", StringComparison.OrdinalIgnoreCase) || string.Equals(req.PaymentMode, "Savings", StringComparison.OrdinalIgnoreCase) || string.Equals(req.PaymentMode, "Saving Transfer", StringComparison.OrdinalIgnoreCase); string bulkPfx = isBulkTransfer ? "JV-FD-BLK" : "REC-FD-BLK"; string voucherNo = $"{bulkPfx}-{firstAcc}-TO-{lastAcc}";
                if (voucherNo.Length > 50)
                {
                    voucherNo = $"{bulkPfx}-{DateTime.Now:yyyyMMddHHmmss}";
                }

                var voucher = new Voucher
                {
                    BranchID = req.BranchID,
                    VoucherNo = voucherNo,
                    VoucherDate = req.OpeningDate,
                    VoucherType = "Receipt",
                    Status = voucherStatus,
                    ApprovedBy = approvedBy,
                    ApprovedOn = approvedOn,
                    TotalAmount = req.TotalAmount,
                    Narration = $"बल्क मुदत ठेव खाती उघडली ({createdAccounts.Count} पावत्या - {req.PaymentMode}): {string.Join(", ", createdAccountNos.Select(a => Helpers.AccountNumberHelper.Format14Digit(a)))}",
                    CreatedBy = currentOperatorId,
                    CreatedOn = DateTime.Now
                };

                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();

                voucher.VoucherType = isBulkTransfer ? "Journal" : "Receipt"; // Debit Leg: Cash / Bank / SB
                if (bulkSbDebitTxn != null)
                {
                    bulkSbDebitTxn.VoucherNo = voucher.VoucherNo;
                    _context.Entry(bulkSbDebitTxn).State = EntityState.Modified;
                }
                foreach (var st in _context.SavingTransactions.Local.Where(x => string.IsNullOrEmpty(x.VoucherNo)))
                {
                    st.VoucherNo = voucher.VoucherNo;
                    _context.Entry(st).State = EntityState.Modified;
                }
                bool isDebitCustomerPersonal = (req.PaymentMode == "Transfer" || req.PaymentMode == "Savings") 
                    && debitLedger.AccountType != "Cash In Hand" 
                    && !debitLedger.LedgerName.Contains("रोख")
                    && !debitLedger.LedgerName.ToLower().Contains("cash");

                var debitDetail = new VoucherDetail
                {
                    VoucherID = voucher.VoucherID,
                    LedgerID = debitLedger.LedgerID,
                    DrCr = "Dr",
                    Amount = req.TotalAmount,
                    CustomerID = isDebitCustomerPersonal ? finalCustomerId : null,
                    MemberID = isDebitCustomerPersonal ? resolvedMemberId : null
                };
                _context.VoucherDetails.Add(debitDetail);

                // Credit Legs: Individual FD Accounts under Liability Ledger
                foreach (var acc in createdAccounts)
                {
                    var creditDetail = new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = fdLiabilityLedger.LedgerID,
                        DrCr = "Cr",
                        Amount = acc.DepositAmount,
                        CustomerID = finalCustomerId,
                        MemberID = resolvedMemberId
                    };
                    _context.VoucherDetails.Add(creditDetail);

                    // Add FdTransaction for each account
                    var tx = new FdTransaction
                    {
                        BranchID = acc.BranchID,
                        FdAccountID = acc.FdAccountID,
                        VoucherID = voucher.VoucherID,
                        TransactionDate = acc.OpeningDate,
                        TransactionType = "Opening",
                        DebitCredit = "Cr",
                        Amount = acc.DepositAmount,
                        CreatedBy = acc.CreatedBy
                    };
                    _context.FdTransactions.Add(tx);
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    success = true,
                    message = $"एकूण {createdAccounts.Count} पावत्या यशस्वीरीत्या उघडल्या गेल्या! (पावती क्र. {firstAccFormatted} ते {lastAccFormatted})",
                    totalAmount = req.TotalAmount,
                    totalCount = createdAccounts.Count,
                    startAccountNo = firstAccFormatted,
                    endAccountNo = lastAccFormatted,
                    voucherNo = voucher.VoucherNo,
                    accountNos = createdAccountNos.Select(a => Helpers.AccountNumberHelper.Format14Digit(a)).ToList(),
                    accounts = createdAccounts.Select(a => new { a.FdAccountID, AccountNo = Helpers.AccountNumberHelper.Format14Digit(a.AccountNo), a.DepositAmount, a.MaturityAmount, a.MaturityDate })
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest("बल्क पावत्या उघडताना त्रुटी आली: " + ex.Message);
            }
        }

        // POST: api/FdAccounts/Migrate (Legacy Data Migration)
        [HttpPost("Migrate")]
        [MigrationLockFilter]
        public async Task<ActionResult<FdAccount>> MigrateFdAccount(FdAccount account)
        {
            // Simple validation
            if (account.DepositAmount <= 0)
            {
                return BadRequest("Invalid deposit amount.");
            }

            // [RULE-FD-LEGACY-DUP] Prevent duplicate Old Receipt No under the same Scheme & Branch
            if (!string.IsNullOrWhiteSpace(account.LegacyAccountNumber))
            {
                var trimmedLegacy = account.LegacyAccountNumber.Trim();
                var duplicate = await _context.FdAccounts
                    .Include(a => a.Customer)
                    .Include(a => a.FdScheme)
                    .FirstOrDefaultAsync(a => a.BranchID == account.BranchID 
                        && a.FdSchemeID == account.FdSchemeID 
                        && a.LegacyAccountNumber != null 
                        && a.LegacyAccountNumber.Trim() == trimmedLegacy);

                if (duplicate != null)
                {
                    var sName = duplicate.FdScheme?.SchemeName ?? "सदर योजना";
                    var cName = duplicate.Customer?.FullName ?? "खातेदार";
                    return BadRequest($"या योजनेअंतर्गत ({sName}) जुना पावती क्र. '{trimmedLegacy}' आधीच खाते क्र. '{duplicate.AccountNo}' ({cName}) साठी नोंदवला आहे. एकाच योजनेमध्ये एक जुना पावती क्र. दोनदा सेव्ह करता येत नाही.");
                }
            }

            account.IsLegacyAccount = true;
            account.Status = "Active";
            account.FinancialYearID = (await _context.FinancialYears.FirstOrDefaultAsync(fy => fy.IsActive))?.FinancialYearID ?? 1;

            // 1. Resolve Account Number (14-Digit CBS standard)
            var cleanDigits = !string.IsNullOrWhiteSpace(account.AccountNo)
                ? new string(account.AccountNo.Where(char.IsDigit).ToArray())
                : "";

            bool isDuplicate = !string.IsNullOrWhiteSpace(account.AccountNo) &&
                await _context.FdAccounts.AnyAsync(a => a.BranchID == account.BranchID && (a.AccountNo == account.AccountNo || (!string.IsNullOrEmpty(cleanDigits) && a.AccountNo == cleanDigits)));

            bool needsNewNumber = string.IsNullOrWhiteSpace(account.AccountNo) || 
                                  account.AccountNo == "AUTO" || 
                                  isDuplicate;

            if (needsNewNumber)
            {
                var (accNo, formattedNo, nextSeq) = await GenerateNextFdAccountNoAsync(account.BranchID, account.FdSchemeID, incrementSequence: true);
                account.AccountNo = accNo;
            }
            else
            {
                if (cleanDigits.Length == 14)
                {
                    account.AccountNo = cleanDigits;
                    string seqPart = cleanDigits.Substring(6, 7);
                    if (int.TryParse(seqPart, out int customSeq))
                    {
                        var seq = await _context.FdAccountSequences
                            .FirstOrDefaultAsync(s => s.BranchID == account.BranchID && s.ProductType == "FD");
                        if (seq != null && customSeq > seq.CurrentValue)
                        {
                            seq.CurrentValue = customSeq;
                            await _context.SaveChangesAsync();
                        }
                    }
                }
                else
                {
                    // Track custom legacy sequence if provided
                    var match = System.Text.RegularExpressions.Regex.Match(account.AccountNo, @"-FD-(\d+)$");
                    if (match.Success && int.TryParse(match.Groups[1].Value, out int customSeq))
                    {
                        var seq = await _context.FdAccountSequences
                            .FirstOrDefaultAsync(s => s.BranchID == account.BranchID && s.ProductType == "FD");
                        if (seq != null && customSeq > seq.CurrentValue)
                        {
                            seq.CurrentValue = customSeq;
                            await _context.SaveChangesAsync();
                        }
                    }
                }
            }

            var scheme = await _context.FdSchemes
                .Include(s => s.Slabs)
                .FirstOrDefaultAsync(s => s.FdSchemeID == account.FdSchemeID);
            if (scheme != null)
            {
                if (string.IsNullOrWhiteSpace(account.DurationType))
                {
                    account.DurationType = scheme.DurationType ?? (scheme.SchemeDurationModel == "Slab" ? "Days" : "Months");
                }
                if (!account.DurationValue.HasValue || account.DurationValue.Value <= 0)
                {
                    account.DurationValue = scheme.DurationMonths > 0 
                        ? scheme.DurationMonths 
                        : (scheme.SchemeDurationModel == "Slab" && scheme.Slabs != null && scheme.Slabs.Any() ? scheme.Slabs.First().ToDays : 12);
                }
            }
            if (!account.DurationInDays.HasValue || account.DurationInDays.Value <= 0)
            {
                if (account.MaturityDate > account.OpeningDate)
                {
                    account.DurationInDays = (int)(account.MaturityDate.Date - account.OpeningDate.Date).TotalDays;
                }
                else if (string.Equals(account.DurationType, "Days", StringComparison.OrdinalIgnoreCase) && account.DurationValue.HasValue)
                {
                    account.DurationInDays = account.DurationValue.Value;
                }
                else if (string.Equals(account.DurationType, "Years", StringComparison.OrdinalIgnoreCase) && account.DurationValue.HasValue)
                {
                    account.DurationInDays = account.DurationValue.Value * 365;
                }
                else if (account.DurationValue.HasValue)
                {
                    account.DurationInDays = (int)Math.Round(account.DurationValue.Value * 30.4167);
                }
            }

            // Fallback: If InterestRate is <= 0 or missing, resolve from scheme/slabs
            if (account.InterestRate <= 0 && scheme != null)
            {
                bool isSenior = false;
                if (account.CustomerID > 0)
                {
                    var cust = await _context.Customers.FindAsync(account.CustomerID);
                    if (cust?.BirthDate != null && cust.BirthDate.Value.Date <= account.OpeningDate.Date.AddYears(-60))
                    {
                        isSenior = true;
                    }
                }

                int days = account.DurationInDays.GetValueOrDefault(0);
                if (scheme.SchemeDurationModel == "Slab" && scheme.Slabs != null && scheme.Slabs.Any())
                {
                    var matchedSlab = scheme.Slabs.FirstOrDefault(s => days >= s.FromDays && days <= s.ToDays && s.IsActive);
                    if (matchedSlab != null)
                    {
                        account.InterestRate = isSenior 
                            ? (matchedSlab.SeniorCitizenRate > 0 ? matchedSlab.SeniorCitizenRate : matchedSlab.InterestRate) 
                            : matchedSlab.InterestRate;
                    }
                    else
                    {
                        account.InterestRate = isSenior 
                            ? (scheme.SeniorCitizenInterestRate > 0 ? scheme.SeniorCitizenInterestRate : scheme.InterestRate) 
                            : scheme.InterestRate;
                    }
                }
                else
                {
                    account.InterestRate = isSenior 
                        ? (scheme.SeniorCitizenInterestRate > 0 ? scheme.SeniorCitizenInterestRate : scheme.InterestRate) 
                        : scheme.InterestRate;
                }
            }

            account.RenewalCycleNo = 0;
            if (string.IsNullOrWhiteSpace(account.ReceiptNo))
            {
                account.ReceiptNo = !string.IsNullOrWhiteSpace(account.LegacyAccountNumber)
                    ? account.LegacyAccountNumber.Trim()
                    : Helpers.AccountNumberHelper.Format14Digit(account.AccountNo);
            }
            else
            {
                account.ReceiptNo = account.ReceiptNo.Trim();
            }

            _context.FdAccounts.Add(account);
            await _context.SaveChangesAsync();

            if (!account.RootFdAccountID.HasValue || account.RootFdAccountID.Value <= 0)
            {
                account.RootFdAccountID = account.FdAccountID;
                await _context.SaveChangesAsync();
            }

            bool isCompoundScheme = Helpers.FdOpeningBalanceSyncHelper.IsCompoundCapitalizedScheme(scheme);
            decimal openingVoucherLiabilityTotal = isCompoundScheme
                ? account.DepositAmount + Math.Max(0m, account.LegacyAccruedInt)
                : account.DepositAmount;

            // Create or fetch real opening voucher for data integrity
            var openingVoucherNo = $"JV-FD-OP-{account.AccountNo}";
            var dummyVoucher = await _context.Vouchers.FirstOrDefaultAsync(v => v.VoucherNo == openingVoucherNo);
            if (dummyVoucher == null)
            {
                dummyVoucher = new Voucher
                {
                    BranchID = account.BranchID,
                    VoucherNo = openingVoucherNo,
                    VoucherDate = account.OpeningDate,
                    VoucherType = "Journal",
                    TotalAmount = openingVoucherLiabilityTotal,
                    Narration = $"मुदत ठेव आरंभिक शिल्लक स्थलांतर (FD Opening Balance Migration): {account.AccountNo}",
                    Status = "Approved",
                    ApprovedBy = account.CreatedBy > 0 ? account.CreatedBy : 1,
                    ApprovedOn = DateTime.Now,
                    CreatedBy = account.CreatedBy > 0 ? account.CreatedBy : 1,
                    CreatedOn = DateTime.Now
                };
                _context.Vouchers.Add(dummyVoucher);
                await _context.SaveChangesAsync();

                // Populate balanced VoucherDetails (Dr Ledger 412 Opening Balance Migration, Cr FD Scheme Liability)
                var migrationLedger = await _context.Ledgers.FirstOrDefaultAsync(l => 
                    l.AccountType == "Migration" || 
                    (l.LedgerName != null && l.LedgerName.Contains("आरंभिक शिल्लक स्थलांतर")) || 
                    l.LedgerID == 412);
                int migrationLedgerId = migrationLedger?.LedgerID ?? 412;

                Ledger? fdLiabilityLedger = await ResolveFdLiabilityLedgerAsync(scheme);
                int liabilityLedgerId = fdLiabilityLedger?.LedgerID ?? (scheme?.FdLiabilityLedgerID ?? 48);

                var linkedMember = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == account.CustomerID);

                _context.VoucherDetails.Add(new VoucherDetail
                {
                    VoucherID = dummyVoucher.VoucherID,
                    LedgerID = migrationLedgerId,
                    DrCr = "Dr",
                    Amount = openingVoucherLiabilityTotal,
                    CustomerID = null,
                    MemberID = null
                });

                _context.VoucherDetails.Add(new VoucherDetail
                {
                    VoucherID = dummyVoucher.VoucherID,
                    LedgerID = liabilityLedgerId,
                    DrCr = "Cr",
                    Amount = openingVoucherLiabilityTotal,
                    CustomerID = account.CustomerID,
                    MemberID = linkedMember?.MemberID
                });
                await _context.SaveChangesAsync();
            }
            else if (dummyVoucher.Status == "Pending")
            {
                dummyVoucher.Status = "Approved";
                dummyVoucher.ApprovedBy = account.CreatedBy > 0 ? account.CreatedBy : 1;
                dummyVoucher.ApprovedOn = DateTime.Now;
                await _context.SaveChangesAsync();
            }

            var tx = new FdTransaction
            {
                BranchID = account.BranchID,
                FdAccountID = account.FdAccountID,
                VoucherID = dummyVoucher.VoucherID,
                TransactionDate = account.OpeningDate,
                TransactionType = "Opening",
                DebitCredit = "Cr",
                Amount = account.DepositAmount,
                CreatedBy = account.CreatedBy
            };
            _context.FdTransactions.Add(tx);

            if (account.LegacyAccruedInt > 0)
            {
                var intTx = new FdTransaction
                {
                    BranchID = account.BranchID,
                    FdAccountID = account.FdAccountID,
                    VoucherID = dummyVoucher.VoucherID,
                    TransactionDate = account.LastInterestPostingDate ?? account.OpeningDate,
                    TransactionType = isCompoundScheme ? "Interest_Capitalized" : "Accrual",
                    DebitCredit = "Cr",
                    Amount = account.LegacyAccruedInt,
                    CreatedBy = account.CreatedBy
                };
                _context.FdTransactions.Add(intTx);
            }

            await _context.SaveChangesAsync();

            // Automatically sync with CustomerOpeningBalances & Ledgers (Financial Statements)
            try
            {
                await SyncFdOpeningBalancesInternalAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error auto-syncing FD opening balances: {ex.Message}");
            }

            return Ok(account);
        }

        private static string ResolveEffectiveFdPostingTarget(string? requestedTarget, FdScheme? scheme, string? calculationMethod = null)
        {
            if (!string.IsNullOrWhiteSpace(requestedTarget))
            {
                if (string.Equals(requestedTarget.Trim(), "Principal", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(requestedTarget.Trim(), "Capitalize", StringComparison.OrdinalIgnoreCase))
                {
                    return "Principal";
                }
                if (string.Equals(requestedTarget.Trim(), "Provision", StringComparison.OrdinalIgnoreCase))
                {
                    return "Provision";
                }
            }

            // "Auto" or omitted: Capitalize into Deposit Liability (Principal) when compounding / OnInterest, else Provision
            if (string.Equals(calculationMethod, "OnInterest", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(scheme?.InterestType, "Cumulative", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(scheme?.InterestPostingMethod, "On Interest", StringComparison.OrdinalIgnoreCase))
            {
                return "Principal";
            }

            return "Provision";
        }

        // POST: api/FdAccounts/AccrueInterest
        [HttpPost("AccrueInterest")]
        [Authorize(Roles = "Admin,SuperAdmin,Manager")]
        public async Task<IActionResult> AccrueInterest([FromQuery] int branchId, [FromQuery] DateTime accrualDate, [FromQuery] string? postingTarget = null)
        {
            if (accrualDate.Date > DateTime.Today)
            {
                return BadRequest($"अवैध तारीख! भविष्यातील तारीख ({accrualDate:dd/MM/yyyy}) अनुज्ञेय नाही. व्याज तरतूद आजच्या किंवा मागील तारखेचीच असणे आवश्यक आहे.");
            }

            var closedFy = await _context.FinancialYears
                .FirstOrDefaultAsync(fy => fy.IsClosed && accrualDate.Date >= fy.StartDate.Date && accrualDate.Date <= fy.EndDate.Date);
            if (closedFy != null)
            {
                return BadRequest($"अवैध तारीख! निवडलेली व्याज तरतूद तारीख ({accrualDate:dd/MM/yyyy}) ही बंद/ऑडिट झालेल्या आर्थिक वर्षात ({closedFy.YearCode}) मोडते. बंद आर्थिक वर्षात थेट व्हाउचर पोस्ट करणे वैधानिक नियमांनुसार (MCS Act) प्रतिबंधित आहे.");
            }

            var activeAccounts = await _context.FdAccounts
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.FdLiabilityLedger)
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.InterestExpenseLedger)
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.InterestPayableLedger)
                .Where(a => a.BranchID == branchId && a.Status == "Active" && a.OpeningDate <= accrualDate)
                .ToListAsync();

            if (!activeAccounts.Any())
            {
                return Ok("No active accounts found for interest provision.");
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    decimal totalProvisionAmount = 0;
                    decimal totalCapitalizedAmount = 0;
                    var ledgerGroupSums = new Dictionary<(int ExpenseLedgerID, int CreditLedgerID), decimal>();

                    bool isExplicitCapitalize = string.Equals(postingTarget?.Trim(), "Principal", StringComparison.OrdinalIgnoreCase) ||
                                                string.Equals(postingTarget?.Trim(), "Capitalize", StringComparison.OrdinalIgnoreCase);

                    // Create provision / capitalization voucher
                    var voucher = new Voucher
                    {
                        BranchID = branchId,
                        VoucherNo = isExplicitCapitalize
                            ? $"JV-FD-CAP-BR{branchId}-{accrualDate:yyyyMMdd}"
                            : $"JV-FD-PROV-BR{branchId}-{accrualDate:yyyyMMdd}",
                        VoucherDate = accrualDate,
                        VoucherType = "Journal",
                        TotalAmount = 0,
                        Narration = isExplicitCapitalize
                            ? $"मुदत ठेव मुद्दलात व्याज जमा (FD Interest Capitalization Run): {accrualDate:dd/MM/yyyy}"
                            : $"मुदत ठेव व्याज तरतूद / पोस्टिंग (FD Interest Accrual Run): {accrualDate:dd/MM/yyyy}",
                        CreatedBy = 1,
                        CreatedOn = DateTime.Now
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    foreach (var acc in activeAccounts)
                    {
                        // Calculate accrued days since opening or last accrual
                        var lastAccrual = await _context.FdInterestAccruals
                            .Where(a => a.FdAccountID == acc.FdAccountID)
                            .OrderByDescending(a => a.AccrualDate)
                            .FirstOrDefaultAsync();

                        DateTime fromDate;
                        bool isFromOpening = false;
                        if (lastAccrual != null)
                        {
                            fromDate = lastAccrual.AccrualDate.Date;
                        }
                        else if (acc.LastInterestPostingDate.HasValue)
                        {
                            if (acc.LastInterestPostingDate.Value.Date == accrualDate.Date)
                            {
                                fromDate = acc.OpeningDate.Date;
                                isFromOpening = true;
                            }
                            else
                            {
                                fromDate = acc.LastInterestPostingDate.Value.Date;
                                if (fromDate <= acc.OpeningDate.Date)
                                {
                                    fromDate = acc.OpeningDate.Date;
                                    isFromOpening = true;
                                }
                            }
                        }
                        else
                        {
                            fromDate = acc.OpeningDate.Date;
                            isFromOpening = true;
                        }

                        DateTime matLastInterestDay = acc.MaturityDate.Date.AddDays(-1);
                        DateTime toDate = accrualDate.Date;
                        if (toDate > matLastInterestDay)
                        {
                            toDate = matLastInterestDay;
                        }

                        if (toDate < fromDate) continue;

                        int days = (toDate - fromDate).Days;
                        if (isFromOpening)
                        {
                            // In Indian banking, deposit day itself is inclusive (e.g. 01/05/2025 to 30/06/2025 = 61 days)
                            days += 1;
                        }

                        if (days <= 0) continue;

                        decimal effectivePrincipal = acc.DepositAmount;
                        
                        if (acc.FdScheme != null && acc.FdScheme.InterestPostingMethod == "On Interest")
                        {
                            int monthsPerPeriod = 12; // Default Yearly
                            if (acc.FdScheme.InterestCompoundingFrequency == "Quarterly") monthsPerPeriod = 3;
                            if (acc.FdScheme.InterestCompoundingFrequency == "Half-Yearly") monthsPerPeriod = 6;
                            if (acc.FdScheme.InterestCompoundingFrequency == "Monthly") monthsPerPeriod = 1;

                            int monthsSinceOpening = (accrualDate.Year - acc.OpeningDate.Year) * 12 + accrualDate.Month - acc.OpeningDate.Month;
                            if (accrualDate.Day < acc.OpeningDate.Day) monthsSinceOpening--;

                            int completedPeriods = monthsSinceOpening / monthsPerPeriod;
                            
                            if (completedPeriods > 0)
                            {
                                DateTime lastCompoundingDate = acc.OpeningDate.AddMonths(completedPeriods * monthsPerPeriod);
                                
                                // Sum accrued / capitalized interest up to the last compounding date
                                var capitalizedInterest = await _context.FdTransactions
                                    .Where(t => t.FdAccountID == acc.FdAccountID 
                                             && (t.TransactionType == "Accrual" || t.TransactionType == "Interest_Capitalized")
                                             && t.TransactionDate <= lastCompoundingDate)
                                    .SumAsync(t => (decimal?)t.Amount) ?? 0m;
                                    
                                effectivePrincipal += Math.Max(capitalizedInterest, acc.LegacyAccruedInt);
                            }
                        }

                        // Daily Interest Formula: Interest = (Principal * Rate * Days) / 36500 (Rounded to nearest whole rupee)
                        decimal dailyInterest = Math.Round((effectivePrincipal * acc.InterestRate * days) / 36500.0m, 0, MidpointRounding.AwayFromZero);

                        if (dailyInterest > 0)
                        {
                            string effectiveTarget = ResolveEffectiveFdPostingTarget(postingTarget, acc.FdScheme);
                            bool postToPrincipal = effectiveTarget == "Principal";

                            var expLedger = await ResolveInterestExpenseLedgerAsync(acc.FdScheme);
                            var creditLedger = postToPrincipal
                                ? await ResolveFdLiabilityLedgerAsync(acc.FdScheme)
                                : await ResolveInterestPayableLedgerAsync(acc.FdScheme);

                            if (expLedger == null || creditLedger == null)
                            {
                                string schemeInfo = acc.FdScheme != null ? $"योजना: {acc.FdScheme.SchemeName}" : "योजना सापडली नाही";
                                string missingTargetLabel = postToPrincipal
                                    ? "मुदत ठेव दायित्व (FD Liability)"
                                    : "देय व्याज (Interest Payable)";
                                await transaction.RollbackAsync();
                                return BadRequest($"खाते क्र. {acc.AccountNo} ({schemeInfo}) साठी व्याज खर्च (Interest Expense) किंवा {missingTargetLabel} लेजर कॉन्फिगर केलेले नाही.");
                            }

                            var pairKey = (expLedger.LedgerID, creditLedger.LedgerID);
                            if (!ledgerGroupSums.ContainsKey(pairKey))
                            {
                                ledgerGroupSums[pairKey] = 0;
                            }
                            ledgerGroupSums[pairKey] += dailyInterest;

                            totalProvisionAmount += dailyInterest;
                            if (postToPrincipal) totalCapitalizedAmount += dailyInterest;

                            var log = new FdInterestAccrual
                            {
                                BranchID = branchId,
                                FdAccountID = acc.FdAccountID,
                                VoucherID = voucher.VoucherID,
                                AccrualDate = accrualDate,
                                CalculatedDays = days,
                                InterestAmount = dailyInterest,
                                IsPosted = true,
                                PostingTarget = effectiveTarget
                            };
                            _context.FdInterestAccruals.Add(log);
                            acc.LastInterestPostingDate = accrualDate;

                            // Log Transaction Details
                            var tx = new FdTransaction
                            {
                                BranchID = branchId,
                                FdAccountID = acc.FdAccountID,
                                VoucherID = voucher.VoucherID,
                                TransactionDate = accrualDate,
                                TransactionType = postToPrincipal ? "Interest_Capitalized" : "Accrual",
                                DebitCredit = "Cr",
                                Amount = dailyInterest
                            };
                            _context.FdTransactions.Add(tx);
                        }
                    }

                    if (totalProvisionAmount > 0)
                    {
                        // Update voucher amount
                        voucher.TotalAmount = totalProvisionAmount;

                        foreach (var kvp in ledgerGroupSums)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = kvp.Key.ExpenseLedgerID, DrCr = "Dr", Amount = kvp.Value });
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = kvp.Key.CreditLedgerID, DrCr = "Cr", Amount = kvp.Value });
                        }

                        await _context.SaveChangesAsync();
                        await transaction.CommitAsync();
                        return Ok($"Successfully posted ₹{totalProvisionAmount:F2} interest (Deposits Capitalized: ₹{totalCapitalizedAmount:F2}, Provision: ₹{totalProvisionAmount - totalCapitalizedAmount:F2}).");
                    }
                    else
                    {
                        await transaction.RollbackAsync();
                        return Ok("No interest calculated for the given period.");
                    }
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("Failed to process provision: " + ex.Message);
                }
            }
        }

        private async Task<(decimal accruedInterest, int accruedDays, DateTime fromDate)> CalculatePendingLoanInterestAsync(
            LoanAccount loanAccount, 
            DateTime asOfDate)
        {
            if (loanAccount == null || loanAccount.PrincipalBalance <= 0)
            {
                return (0m, 0, asOfDate);
            }

            var loanRate = loanAccount.LoanRate ?? await _context.LoanRates.FindAsync(loanAccount.LoanRateID);
            bool isDailyReducing = loanRate != null && 
                ((loanRate.InterestCalculationMethod?.Contains("Daily Reducing") == true) || 
                 (loanRate.InterestCalculationMethod?.Contains("दैनिक घटती") == true));

            if (isDailyReducing)
            {
                var fromDate = loanAccount.LastInstallmentPaidDate ?? loanAccount.LoanDisbursementDate ?? loanAccount.OpeningDate;
                if (loanAccount.LastInterestPostingDate.HasValue && loanAccount.LastInterestPostingDate.Value > fromDate)
                {
                    fromDate = loanAccount.LastInterestPostingDate.Value;
                }

                var rate = loanRate?.InterestRate ?? loanAccount.InterestRate;
                var diffTime = asOfDate.Date - fromDate.Date;
                var diffDays = Math.Max(0, diffTime.Days);
                decimal newInterest = diffDays > 0 ? Math.Round((loanAccount.PrincipalBalance * rate * diffDays) / 36500m, 2) : 0;
                return (newInterest, diffDays, fromDate);
            }
            else
            {
                // Scheduled Loan Policy: Flat, Reducing (समान हप्ता / EMI), or Reducing (समान मुद्दल)
                var dbSchedules = await _context.LoanInstallmentSchedules
                    .Where(s => s.LoanAccountID == loanAccount.LoanAccountID)
                    .ToListAsync();
                
                var pastCollections = await _context.LoanCollections
                    .Where(c => c.LoanAccountID == loanAccount.LoanAccountID)
                    .ToListAsync();

                decimal unpaidScheduledInterest = Services.LoanScheduleGenerator.GetUnpaidScheduledInterest(
                    loanAccount,
                    dbSchedules,
                    pastCollections,
                    asOfDate.Date);

                decimal additionalInterest = Math.Max(0m, unpaidScheduledInterest - loanAccount.InterestBalance);
                var fromDate = loanAccount.LastInstallmentPaidDate ?? loanAccount.OpeningDate;
                var diffDays = Math.Max(0, (asOfDate.Date - fromDate.Date).Days);
                return (additionalInterest, diffDays, fromDate);
            }
        }

        private async Task<(bool HasDirectLien, string? DirectLienLoanNo, List<LoanAccount> ActiveLoans, decimal TotalActiveLoanDebt, int? LinkedMemberId)> GetFdActiveLoansAndLienContextAsync(
            FdAccount account,
            DateTime effectiveDate)
        {
            int custId = account.CustomerID;
            int? memberId = null;
            if (custId > 0)
            {
                var mem = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == custId);
                if (mem != null) memberId = mem.MemberID;
            }

            var activeCollaterals = await _context.LoanDepositCollaterals
                .Where(c => c.CollateralType == "FixedDeposit" &&
                            c.DepositAccountID == account.FdAccountID &&
                            c.LienStatus != "Released")
                .ToListAsync();

            var collateralLoanIds = activeCollaterals
                .Where(c => c.LoanAccountID.HasValue && c.LoanAccountID.Value > 0)
                .Select(c => c.LoanAccountID!.Value)
                .Distinct()
                .ToList();

            string accNo = account.AccountNo ?? string.Empty;
            string lienLoanNo = account.LienLoanAccountNo?.Trim() ?? string.Empty;

            var activeLoans = await _context.LoanAccounts
                .Include(l => l.LoanRate)
                .Where(l => l.Status == "Active" &&
                            (l.PrincipalBalance > 0 || l.InterestBalance > 0 || l.OverdueInterestBalance > 0) &&
                            ((custId > 0 && l.CustomerID == custId) ||
                             (memberId.HasValue && memberId.Value > 0 && l.MemberID == memberId.Value) ||
                             collateralLoanIds.Contains(l.LoanAccountID) ||
                             (!string.IsNullOrEmpty(lienLoanNo) && l.LoanAccountNo == lienLoanNo) ||
                             (!string.IsNullOrEmpty(accNo) && l.SecurityDetails != null && l.SecurityDetails.Contains(accNo))))
                .OrderBy(l => l.LoanAccountNo)
                .ToListAsync();

            decimal totalOutstanding = 0m;
            foreach (var l in activeLoans)
            {
                var (accruedInt, _, _) = await CalculatePendingLoanInterestAsync(l, effectiveDate);
                totalOutstanding += l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance + accruedInt;
            }

            bool hasActiveCollateralLoan = collateralLoanIds.Any() &&
                                           activeLoans.Any(l => collateralLoanIds.Contains(l.LoanAccountID));
            bool hasSecurityLoan = !string.IsNullOrEmpty(accNo) &&
                                   activeLoans.Any(l => l.SecurityDetails != null && l.SecurityDetails.Contains(accNo));
            bool hasLinkedLienLoan = !string.IsNullOrEmpty(lienLoanNo) &&
                                     activeLoans.Any(l => string.Equals(l.LoanAccountNo, lienLoanNo, StringComparison.OrdinalIgnoreCase));
            bool hasUnlinkedManualLienWithActiveLoan = account.IsLienMarked &&
                                                       string.IsNullOrEmpty(lienLoanNo) &&
                                                       !collateralLoanIds.Any() &&
                                                       activeLoans.Any();

            bool hasDirectLien = hasActiveCollateralLoan || hasSecurityLoan || hasLinkedLienLoan || hasUnlinkedManualLienWithActiveLoan;
            string? resolvedDirectLienLoanNo = hasLinkedLienLoan
                ? lienLoanNo
                : activeLoans.FirstOrDefault(l =>
                    collateralLoanIds.Contains(l.LoanAccountID) ||
                    (!string.IsNullOrEmpty(accNo) && l.SecurityDetails != null && l.SecurityDetails.Contains(accNo)))?.LoanAccountNo
                  ?? (hasUnlinkedManualLienWithActiveLoan ? activeLoans.FirstOrDefault()?.LoanAccountNo : null);

            return (hasDirectLien, resolvedDirectLienLoanNo, activeLoans, totalOutstanding, memberId);
        }

        // GET: api/FdAccounts/5/ActiveLoans
        [HttpGet("{id}/ActiveLoans")]
        public async Task<IActionResult> GetActiveLoansForFd(int id, [FromQuery] DateTime? asOfDate = null)
        {
            var account = await _context.FdAccounts
                .Include(a => a.Customer)
                .FirstOrDefaultAsync(a => a.FdAccountID == id);

            if (account == null)
            {
                return NotFound(new { message = "मुदत ठेव खाते सापडले नाही." });
            }

            DateTime effectiveDate = asOfDate?.Date ?? DateTime.Today;
            var (hasDirectLien, directLienLoanNo, activeLoans, _, _) = await GetFdActiveLoansAndLienContextAsync(account, effectiveDate);

            var loanList = new List<object>();
            decimal totalOutstanding = 0m;
            foreach (var l in activeLoans)
            {
                var (accruedInt, accruedDays, fromDate) = await CalculatePendingLoanInterestAsync(l, effectiveDate);
                decimal totalDue = l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance + accruedInt;
                totalOutstanding += totalDue;

                int overdueInstallmentsCount = await _context.LoanInstallmentSchedules
                    .Where(s => s.LoanAccountID == l.LoanAccountID && s.DueDate.Date < effectiveDate.Date && s.Status != "Paid")
                    .CountAsync();

                decimal overdueExpenses = await _context.OverdueRecoveryLedgers
                    .Where(o => o.LoanAccountID == l.LoanAccountID)
                    .SumAsync(o => (decimal?)(o.DebitAmount - o.CreditAmount)) ?? 0m;
                if (overdueExpenses < 0) overdueExpenses = 0m;

                loanList.Add(new
                {
                    loanAccountId = l.LoanAccountID,
                    loanAccountNo = l.LoanAccountNo,
                    loanType = l.LoanRate?.LoanType ?? "कर्ज खाते",
                    principalBalance = l.PrincipalBalance,
                    interestBalance = l.InterestBalance,
                    accruedInterest = accruedInt,
                    accruedDays = accruedDays,
                    interestCalculatedFrom = fromDate,
                    overdueInterestBalance = l.OverdueInterestBalance,
                    overdueExpenses = overdueExpenses,
                    overdueInstallmentsCount = overdueInstallmentsCount,
                    totalDue = totalDue,
                    openingDate = l.OpeningDate,
                    disbursementDate = l.LoanDisbursementDate ?? l.OpeningDate,
                    sanctionedAmount = l.SanctionedAmount,
                    installmentAmount = l.InstallmentAmount,
                    installmentFrequency = l.InstallmentFrequency ?? "मासिक",
                    lastInstallmentPaidDate = l.LastInstallmentPaidDate,
                    interestRate = l.LoanRate?.InterestRate ?? l.InterestRate,
                    interestCalculationMethod = l.LoanRate?.InterestCalculationMethod ?? "Daily Reducing"
                });
            }

            return Ok(new
            {
                hasActiveLoan = loanList.Count > 0,
                hasDirectLien = hasDirectLien,
                directLienLoanNo = directLienLoanNo,
                totalOutstandingLiability = totalOutstanding,
                asOfDate = effectiveDate,
                loans = loanList
            });
        }

        private async Task<(LoanAccount loan, LoanCollection collection, decimal principalPaid, decimal interestPaid, decimal penaltyPaid)> ProcessLoanSettlementAsync(
            int targetLoanId, 
            decimal adjustAmount, 
            DateTime txDate, 
            string accountNo, 
            int branchId)
        {
            var targetLoan = await _context.LoanAccounts
                .Include(l => l.LoanRate)
                .FirstOrDefaultAsync(l => l.LoanAccountID == targetLoanId);

            if (targetLoan == null)
            {
                throw new InvalidOperationException("निवडलेले कर्ज खाते सापडले नाही किंवा ते सक्रिय नाही.");
            }

            // 🌟 1. Accrue unposted interest up to settlement txDate (Daily Reducing / Scheduled)
            decimal prevIntBal = targetLoan.InterestBalance;
            DateTime? prevIntDt = targetLoan.LastInterestPostingDate;
            var (pendingInterest, pendingDays, fromDate) = await CalculatePendingLoanInterestAsync(targetLoan, txDate);
            if (pendingInterest > 0)
            {
                targetLoan.InterestBalance += pendingInterest;
                targetLoan.LastInterestPostingDate = txDate;
            }

            decimal penaltyPaid = Math.Min(adjustAmount, targetLoan.OverdueInterestBalance);
            decimal remainingAdj = adjustAmount - penaltyPaid;

            decimal interestPaid = Math.Min(remainingAdj, targetLoan.InterestBalance);
            remainingAdj -= interestPaid;

            decimal principalPaid = Math.Min(remainingAdj, targetLoan.PrincipalBalance);
            remainingAdj -= principalPaid;

            targetLoan.OverdueInterestBalance -= penaltyPaid;
            targetLoan.InterestBalance -= interestPaid;
            targetLoan.PrincipalBalance -= principalPaid;
            targetLoan.LastInstallmentPaidDate = txDate;
            if (!targetLoan.LastInterestPostingDate.HasValue || targetLoan.LastInterestPostingDate.Value < txDate)
            {
                targetLoan.LastInterestPostingDate = txDate;
            }

            if (targetLoan.PrincipalBalance <= 0.01m && targetLoan.InterestBalance <= 0.01m && targetLoan.OverdueInterestBalance <= 0.01m)
            {
                targetLoan.PrincipalBalance = 0;
                targetLoan.InterestBalance = 0;
                targetLoan.OverdueInterestBalance = 0;
                targetLoan.Status = "Closed";
            }
            _context.Entry(targetLoan).State = EntityState.Modified;

            var branch = await _context.Branches.FindAsync(branchId);
            string branchCode = !string.IsNullOrWhiteSpace(branch?.BranchCode) ? branch.BranchCode.Trim() : "HQ";
            string loanReceiptNo = $"{branchCode}-REC-LN-FDADJ-{accountNo}";

            var loanCollection = new LoanCollection
            {
                LoanAccountID = targetLoan.LoanAccountID,
                CollectionDate = txDate,
                ReceiptNo = loanReceiptNo,
                TotalAmountReceived = adjustAmount,
                PenaltyInterestCollected = penaltyPaid,
                BranchID = targetLoan.BranchID > 0 ? targetLoan.BranchID : branchId,
                ReceivableInterestCollected = Math.Min(interestPaid, prevIntBal),
                InterestCollected = Math.Max(0m, interestPaid - Math.Min(interestPaid, prevIntBal)),
                PrincipalCollected = principalPaid,
                PaymentMode = "FD Settlement",
                BankName = $"मुदत ठेव वर्ग: {accountNo}",
                Remarks = $"FD वजावट: {accountNo} [PreIntBal:{prevIntBal.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)}|PreIntDt:{(prevIntDt.HasValue ? prevIntDt.Value.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture) : "NULL")}]",
                ChequeNo = accountNo
            };
            _context.LoanCollections.Add(loanCollection);
            await _context.SaveChangesAsync();

            // Sync loan installment schedule
            var allSchedules = await _context.LoanInstallmentSchedules
                .Where(s => s.LoanAccountID == targetLoan.LoanAccountID)
                .OrderBy(s => s.InstallmentNo)
                .ToListAsync();

            if (allSchedules.Any())
            {
                var allCollections = await _context.LoanCollections
                    .Where(c => c.LoanAccountID == targetLoan.LoanAccountID)
                    .ToListAsync();

                Services.LoanScheduleGenerator.SynchronizeSchedules(targetLoan, allSchedules, allCollections);
                foreach (var sch in allSchedules)
                {
                    _context.Entry(sch).State = EntityState.Modified;
                }
                await _context.SaveChangesAsync();
            }

            return (targetLoan, loanCollection, principalPaid, interestPaid, penaltyPaid);
        }

        // POST: api/FdAccounts/5/MaturedClose (Standard Maturity Close)
        [HttpPost("{id}/MaturedClose")]
        public async Task<IActionResult> MaturedClose(int id, [FromBody] FdClosureRequest? req = null)
        {
            var account = await _context.FdAccounts
                .Include(a => a.FdScheme)
                .ThenInclude(s => s!.FdLiabilityLedger)
                .Include(a => a.FdScheme)
                .ThenInclude(s => s!.InterestPayableLedger)
                .Include(a => a.FdScheme)
                .ThenInclude(s => s!.InterestExpenseLedger)
                .FirstOrDefaultAsync(a => a.FdAccountID == id);

            if (account == null || (account.Status != "Active" && account.Status != "Matured"))
            {
                return BadRequest("मुदत ठेव खाते सक्रिय (Active) किंवा मुदतपूर्ण (Matured) नाही किंवा यापूर्वीच बंद/नूतनीकरण करण्यात आलेले आहे.");
            }

            // Multi-branch CBS: Support Cross-Branch Matured Closure with IBT Dual-Voucher
            int userBranchId = User.GetOperatingBranchId();
            bool isHO = User.IsHeadOfficeAdmin();
            int operatingBranchId = userBranchId > 0 ? userBranchId : (account.BranchID > 0 ? account.BranchID : 1);
            bool isCrossBranchTxn = (operatingBranchId != account.BranchID);

            // Fetch accrued interest
            var accruedFromTx = await _context.FdTransactions
                .Where(t => t.FdAccountID == id && t.TransactionType == "Accrual")
                .SumAsync(t => t.Amount);

            bool isPeriodicScheme = account.FdScheme != null && 
                (account.FdScheme.InterestType == "MIS" || account.FdScheme.InterestType == "Monthly Interest");

            decimal totalInterest = isPeriodicScheme 
                ? 0m 
                : ((account.MaturityAmount > account.DepositAmount)
                    ? (account.MaturityAmount - account.DepositAmount)
                    : Math.Max(accruedFromTx, account.LegacyAccruedInt));

            DateTime activeBusinessDate = await ResolveActiveBusinessDateAsync(operatingBranchId);
            DateTime closureDate = req?.ClosureDate ?? activeBusinessDate;
            if (closureDate.Date < account.OpeningDate.Date)
            {
                return BadRequest($"अवैध व्यवहाराची तारीख! व्यवहाराची तारीख ({closureDate:dd/MM/yyyy}) ही मुदत ठेव खाते उघडल्याच्या तारखेपेक्षा ({account.OpeningDate:dd/MM/yyyy}) आधीची असू शकत नाही.");
            }
            if (closureDate.Date > DateTime.Today)
            {
                return BadRequest($"अवैध व्यवहाराची तारीख! भविष्यातील तारीख ({closureDate:dd/MM/yyyy}) अनुज्ञेय नाही. व्यवहार आजच्या किंवा मागील तारखेचाच असणे आवश्यक आहे.");
            }

            // 🛡️ सर्व्हर-साइड मुदतपूर्ती तारीख गार्ड (Primary Server-Side Maturity Date Guard)
            if (closureDate.Date < account.MaturityDate.Date)
            {
                return BadRequest($"अवैध क्लोजर विनंती! सदर मुदत ठेव पावती अद्याप मुदतपूर्ण (Matured) झालेली नाही. या खात्याची मुदतपूर्ती तारीख {account.MaturityDate:dd/MM/yyyy} आहे (उर्वरित कालावधी: {(account.MaturityDate.Date - closureDate.Date).Days} दिवस). मुदतीआधी ठेव बंद करण्यासाठी कृपया 'मुदतपूर्व बंद (Premature Close)' पर्याय वापरा.");
            }

            var closedFy = await _context.FinancialYears
                .FirstOrDefaultAsync(fy => fy.IsClosed && closureDate.Date >= fy.StartDate.Date && closureDate.Date <= fy.EndDate.Date);
            if (closedFy != null)
            {
                return BadRequest($"अवैध व्यवहाराची तारीख! निवडलेली तारीख ({closureDate:dd/MM/yyyy}) ही बंद/ऑडिट झालेल्या आर्थिक वर्षात ({closedFy.YearCode}) मोडते. बंद आर्थिक वर्षात थेट व्हाउचर पोस्ट करणे वैधानिक लेखापरीक्षण नियमांनुसार (MCS Act) प्रतिबंधित आहे.");
            }

            DateTime? lastAccrualDate = account.LastInterestPostingDate;
            if (!lastAccrualDate.HasValue)
            {
                lastAccrualDate = await _context.FdInterestAccruals
                    .Where(a => a.FdAccountID == account.FdAccountID && a.IsPosted)
                    .OrderByDescending(a => a.AccrualDate)
                    .Select(a => (DateTime?)a.AccrualDate)
                    .FirstOrDefaultAsync();
            }
            if (!lastAccrualDate.HasValue)
            {
                lastAccrualDate = await _context.FdTransactions
                    .Where(t => t.FdAccountID == account.FdAccountID && t.TransactionType == "Accrual")
                    .OrderByDescending(t => t.TransactionDate)
                    .Select(t => (DateTime?)t.TransactionDate)
                    .FirstOrDefaultAsync();
            }

            if (lastAccrualDate.HasValue && closureDate.Date < lastAccrualDate.Value.Date)
            {
                return BadRequest($"अवैध व्यवहाराची तारीख! या खात्यावर {lastAccrualDate.Value:dd/MM/yyyy} रोजी व्याज तरतूद (Interest Accrual) झालेली आहे. व्यवहाराची तारीख शेवटच्या व्याज तरतुदीच्या तारखेपेक्षा ({lastAccrualDate.Value:dd/MM/yyyy}) आधीची असू शकत नाही, अन्यथा देणे व्याज खात्यात (Interest Payable) अनैसर्गिक निगेटिव्ह (Debit) शिल्लक निर्माण होईल.");
            }
            string paymentMode = string.IsNullOrWhiteSpace(req?.PaymentMode) ? "Cash" : req.PaymentMode;
            if (paymentMode == "Transfer" && req?.SavingAccountID > 0)
            {
                if (closureDate.Date < activeBusinessDate.Date)
                {
                    return BadRequest($"अवैध व्यवहाराची तारीख! बचत खात्यात (Saving Account Transfer) परतावा वर्ग करताना मागील तारीख ({closureDate:dd/MM/yyyy}) अनुज्ञेय नाही. ग्राहकाच्या पासबुकमधील रनिंग शिल्लक (Running Balance) विस्कळीत होणे टाळण्यासाठी आणि एसएमएस ताळमेळ राखण्यासाठी बचत खात्यातील हस्तांतरण चालू व्यवसाय तारखेने ({activeBusinessDate:dd/MM/yyyy}) होणे बंधनकारक आहे. जर व्यवहार मागील तारखेने झाला असेल, तर कृपया 'रोख' किंवा इतर माध्यम निवडा.");
                }
                var targetSav = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.SavingAccountID == req.SavingAccountID.Value);
                if (targetSav == null || targetSav.Status != "Active")
                {
                    return BadRequest($"निवडलेले बचत खाते ({targetSav?.AccountNo ?? "अज्ञात"}) सापडले नाही किंवा ते सक्रिय (Active) नाही. बंद किंवा निष्क्रिय बचत खात्यात रक्कम वर्ग करता येत नाही.");
                }
            }

            if (req?.AdjustInLoan == true && req.SurplusPaymentMode == "Transfer" && req.SurplusSavingAccountID > 0)
            {
                var surplusSav = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.SavingAccountID == req.SurplusSavingAccountID.Value);
                if (surplusSav == null || surplusSav.Status != "Active")
                {
                    return BadRequest($"शिल्लक परताव्यासाठी निवडलेले बचत खाते ({surplusSav?.AccountNo ?? "अज्ञात"}) सापडले नाही किंवा ते सक्रिय (Active) नाही. बंद किंवा निष्क्रिय बचत खात्यात रक्कम वर्ग करता येत नाही.");
                }
            }

            // 🛡️ Lien & Active Loan Check: खातेदाराचे थकीत/सक्रिय कर्ज व तारण बोजा तपासणी
            var (hasDirectLien, directLienLoanNo, activeLoans, totalActiveLoanDebt, linkedMemberId) =
                await GetFdActiveLoansAndLienContextAsync(account, closureDate);

            // नियम: सदर पावतीवर प्रत्यक्ष तारण बोजा (Direct Lien) असल्यास कर्जात समायोजित (AdjustInLoan) केल्याशिवाय ठेव मोडता येणार नाही (नूतनीकरण करता येईल).
            if (hasDirectLien && req?.AdjustInLoan != true)
            {
                return BadRequest(new
                {
                    errorCode = "FD_LIEN_BREAK_BLOCKED",
                    message = $"सदर मुदत ठेव पावतीवर कर्ज खाते क्र. '{directLienLoanNo ?? "अज्ञात"}' चा तारण बोजा (Lien: ₹{account.LienAmount ?? account.DepositAmount:N2}) नोंदवला आहे. कर्ज बाकी असताना ठेव मोडून परतावा घेता येत नाही; कृपया ठेव 'नूतनीकरण (FD Renewal)' करा किंवा 'सक्रिय कर्ज खात्यात समायोजित (Adjust in Loan)' निवडा."
                });
            }

            // Overdue post-maturity interest calculation (Strictly Governed by FdScheme Policy)
            decimal overdueInterest = 0m;
            int overdueDays = 0;
            bool isSchemeOverdueAllowed = account.FdScheme?.AllowOverdueInterest ?? false;

            if (isSchemeOverdueAllowed && closureDate.Date > account.MaturityDate.Date)
            {
                bool applyOverdue = req?.ApplyOverdueInterest ?? true;
                if (applyOverdue)
                {
                    overdueDays = (closureDate.Date - account.MaturityDate.Date).Days;
                    decimal overdueRate = account.FdScheme?.OverdueInterestRate ?? req?.OverdueInterestRate ?? 3.00m;
                    // CBS Banking Rule: Overdue interest is strictly calculated on Principal (DepositAmount)
                    overdueInterest = Math.Round((account.DepositAmount * overdueRate * overdueDays) / 36500.0m, 2);
                }
            }

            // ✍️ Manual Amount Override Support (Legacy Pre-Live Society Reconciliation)
            if (req?.IsManualAmountOverride == true || req?.CustomAccruedInterest.HasValue == true || req?.CustomOverdueInterest.HasValue == true)
            {
                if (string.IsNullOrWhiteSpace(req.ManualOverrideReason))
                {
                    req.ManualOverrideReason = "थेट सेटलमेंट संपादन";
                }
                req.IsManualAmountOverride = true;
                if (req.CustomAccruedInterest.HasValue)
                {
                    totalInterest = Math.Max(0m, req.CustomAccruedInterest.Value);
                }
                if (req.CustomOverdueInterest.HasValue)
                {
                    overdueInterest = Math.Max(0m, req.CustomOverdueInterest.Value);
                }
            }

            decimal totalMaturityPayout = account.DepositAmount + totalInterest + overdueInterest;

            // CBS Rule: Split contracted interest between Capitalized Deposit Liability (On Interest), verified Interest Payable (POSTING_INTR), and Interest Expense (NAFATOTA DEY VYAJ / P&L)
            var postingBreakdown = await Helpers.FdInterestSettlementHelper.ResolveVerifiedPostingBreakdownAsync(
                _context, id, account.FdScheme?.InterestPayableLedgerID ?? 0);
            bool isCompoundMatured = Helpers.FdOpeningBalanceSyncHelper.IsCompoundCapitalizedScheme(account.FdScheme);
            string effectiveMaturedMode = string.IsNullOrWhiteSpace(req?.InterestDebitMode) && postingBreakdown.BackedLegacyProvision > 0m
                ? "Auto"
                : req?.InterestDebitMode ?? string.Empty;
            var allocation = Helpers.FdInterestSettlementHelper.ResolveClosureInterestAllocation(new Helpers.FdInterestAllocationRequest
            {
                TargetInterest = totalInterest,
                OverdueInterest = overdueInterest,
                VerifiedProvision = string.IsNullOrWhiteSpace(req?.InterestDebitMode)
                    ? postingBreakdown.EffectiveProvision
                    : postingBreakdown.VerifiedProvision,
                VerifiedCapitalized = postingBreakdown.VerifiedCapitalized,
                LegacyAccruedInt = isCompoundMatured ? 0m : account.LegacyAccruedInt,
                IsPremature = false,
                IsPeriodicPayout = false,
                IsManualAmountOverride = req?.IsManualAmountOverride == true,
                InterestDebitMode = string.IsNullOrEmpty(effectiveMaturedMode) ? req?.InterestDebitMode : effectiveMaturedMode,
                PostedInterestDebitAmount = req?.PostedInterestDebitAmount,
                ExpenseInterestDebitAmount = req?.ExpenseInterestDebitAmount
            });
            if (!allocation.IsValid)
            {
                return BadRequest(new { message = allocation.ErrorMessage });
            }

            decimal clearedCapitalizedInterest = allocation.ClearedCapitalizedInterest;
            decimal fdLiabilityDebitAmount = account.DepositAmount + clearedCapitalizedInterest;
            decimal payableInterestAmount = allocation.PostedInterestDebitAmount;
            decimal expenseInterestAmount = allocation.ExpenseInterestDebitAmount;
            decimal totalExpenseInterest = allocation.TotalExpenseInterest;

            LoanAccount? targetLoan = null;
            decimal loanAdjustAmount = 0m;
            decimal surplusPayoutAmount = totalMaturityPayout;

            if (req?.AdjustInLoan == true)
            {
                LoanAccount? pledgedActiveLoan = !string.IsNullOrWhiteSpace(directLienLoanNo)
                    ? activeLoans.FirstOrDefault(l => string.Equals(l.LoanAccountNo, directLienLoanNo, StringComparison.OrdinalIgnoreCase))
                    : null;

                if (pledgedActiveLoan != null && req.TargetLoanAccountID.HasValue && req.TargetLoanAccountID.Value > 0 && req.TargetLoanAccountID.Value != pledgedActiveLoan.LoanAccountID)
                {
                    return BadRequest(new { message = $"सदर मुदत ठेव पावती कर्ज खाते क्र. '{directLienLoanNo}' साठी तारण असल्याने परतावा प्रथम त्याच कर्ज खात्यात समायोजित करणे बंधनकारक आहे." });
                }

                int targetLoanId = req.TargetLoanAccountID ?? (pledgedActiveLoan?.LoanAccountID ?? activeLoans.FirstOrDefault()?.LoanAccountID ?? 0);
                if (targetLoanId == 0)
                {
                    return BadRequest(new { message = "कृपया मुदत ठेवीची रक्कम वर्ग करण्यासाठी कर्ज खाते निवडा." });
                }

                targetLoan = activeLoans.FirstOrDefault(l => l.LoanAccountID == targetLoanId) 
                    ?? await _context.LoanAccounts.Include(l => l.LoanRate).FirstOrDefaultAsync(l => l.LoanAccountID == targetLoanId && l.Status == "Active");

                if (targetLoan == null)
                {
                    return BadRequest(new { message = "निवडलेले कर्ज खाते सापडले नाही किंवा ते सक्रिय नाही." });
                }

                var (pendingInterest, _, _) = await CalculatePendingLoanInterestAsync(targetLoan, closureDate);
                decimal targetLoanTotalDue = targetLoan.PrincipalBalance + targetLoan.InterestBalance + targetLoan.OverdueInterestBalance + pendingInterest;
                decimal maxAdjustable = Math.Min(totalMaturityPayout, targetLoanTotalDue);

                if (hasDirectLien &&
                    req.LoanAdjustmentAmount.HasValue &&
                    req.LoanAdjustmentAmount.Value + 0.01m < maxAdjustable)
                {
                    return BadRequest(new
                    {
                        errorCode = "PARTIAL_LOAN_ADJUST_NOT_ALLOWED",
                        message = $"सदर मुदत ठेव पावतीवर कर्जाचा तारण बोजा असल्यामुळे ठेव मोडताना किमान ₹{maxAdjustable:N2} रक्कम तारण कर्जात समायोजित करणे बंधनकारक आहे. कमी रक्कम कर्जात टाकून उर्वरित रक्कम रोख/बँकेत काढता येत नाही (ठेव कायम ठेवायची असल्यास 'नूतनीकरण' निवडा)."
                    });
                }

                loanAdjustAmount = req.LoanAdjustmentAmount.HasValue && req.LoanAdjustmentAmount.Value > 0
                    ? Math.Min(req.LoanAdjustmentAmount.Value, maxAdjustable)
                    : maxAdjustable;

                surplusPayoutAmount = totalMaturityPayout - loanAdjustAmount;
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    string manualAuditNote = req?.IsManualAmountOverride == true
                        ? $" [✍️ मॅन्युअल लेगसी जुळवणी: {req.ManualOverrideReason?.Trim()}]"
                        : "";

                    account.Status = "Closed";
                    account.Remarks = TruncateMax(CleanStaleClosureRemarks(account.Remarks) + 
                        (req?.AdjustInLoan == true 
                            ? $" | बंद दिनांक: {closureDate:dd/MM/yyyy} [कर्ज वजावट: ₹{loanAdjustAmount:N2} -> कर्ज क्र: {targetLoan?.LoanAccountNo}, शिल्लक परतावा: ₹{surplusPayoutAmount:N2} ({req.SurplusPaymentMode})]"
                            : $" | बंद दिनांक: {closureDate:dd/MM/yyyy} ({paymentMode})" + (overdueInterest > 0 ? $" [मुदत संपल्यानंतरचे (Overdue) व्याज: ₹{overdueInterest:F2} ({overdueDays} दिवस)]" : ""))
                        + manualAuditNote, 1000);
                    await _context.SaveChangesAsync();

                    var fdLiabilityLedger = await ResolveFdLiabilityLedgerAsync(account.FdScheme);
                    var (payableValid, payableLedger, payableErr) = await ResolveCustomOrDefaultLedgerAsync(
                        req?.PostedInterestDebitLedgerID,
                        () => ResolveInterestPayableLedgerAsync(account.FdScheme),
                        "POSTING_INTR / देणे व्याज");
                    if (!payableValid)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(payableErr);
                    }

                    var (expenseValid, expenseLedger, expenseErr) = await ResolveCustomOrDefaultLedgerAsync(
                        req?.ExpenseInterestDebitLedgerID,
                        () => ResolveInterestExpenseLedgerAsync(account.FdScheme),
                        "नफा-तोटा / व्याज खर्च");
                    if (!expenseValid)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(expenseErr);
                    }

                    if (fdLiabilityLedger == null)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest("मुदत ठेव दायित्व लेजर (FD Liability Ledger) सापडले नाही. कृपया योजनेत लेजर मॅपिंग तपासा.");
                    }

                    if (payableInterestAmount > 0 && payableLedger == null)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest("मुदत ठेवीच्या देणे व्याजासाठी लेजर (FD Interest Payable Ledger) उपलब्ध नाही. कृपया योजनेत लेजर मॅपिंग तपासा.");
                    }

                    if (totalExpenseInterest > 0 && expenseLedger == null)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest("मुदत ठेवीवरील व्याज खर्चासाठी लेजर (FD Interest Expense Ledger) उपलब्ध नाही. कृपया योजनेत लेजर मॅपिंग तपासा.");
                    }

                    if (req?.AdjustInLoan == true && targetLoan != null)
                    {
                        // 1. Process Loan Settlement via Waterfall
                        var (settledLoan, loanColl, prinPaid, intPaid, penPaid) = await ProcessLoanSettlementAsync(
                            targetLoan.LoanAccountID, 
                            loanAdjustAmount, 
                            closureDate, 
                            account.AccountNo, 
                            account.BranchID);

                        var linkedFdCollaterals = await _context.LoanDepositCollaterals
                            .Where(c => c.CollateralType == "FixedDeposit" &&
                                        c.DepositAccountID == account.FdAccountID &&
                                        c.LienStatus != "Released")
                            .ToListAsync();
                        foreach (var col in linkedFdCollaterals)
                        {
                            col.LienStatus = settledLoan.Status == "Closed" ? "Released" : "Invoked";
                            col.LienReleasedDate = closureDate;
                            col.CurrentDepositBalance = 0m;
                        }
                        if (account.IsLienMarked)
                        {
                            account.IsLienMarked = false;
                        }
                        if (linkedFdCollaterals.Any()) await _context.SaveChangesAsync();

                        // 2. Resolve Surplus Payout Ledger (if surplus > 0)
                        string surplusMode = !string.IsNullOrWhiteSpace(req.SurplusPaymentMode) ? req.SurplusPaymentMode : "Cash";
                        int surplusLedgerId = 0;
                        if (surplusPayoutAmount > 0)
                        {
                            if (BankLedgerHelper.IsBankPaymentMode(surplusMode))
                            {
                                var surplusBankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(_context, req.SurplusBankLedgerID);
                                if (!surplusBankCheck.IsValid)
                                {
                                    await transaction.RollbackAsync();
                                    return BadRequest(surplusBankCheck.ErrorMessage);
                                }
                                surplusLedgerId = surplusBankCheck.LedgerId;
                            }
                            else if ((string.Equals(surplusMode, "Transfer", StringComparison.OrdinalIgnoreCase) || string.Equals(surplusMode, "Saving", StringComparison.OrdinalIgnoreCase) || string.Equals(surplusMode, "Saving Transfer", StringComparison.OrdinalIgnoreCase)) && (!req.SurplusSavingAccountID.HasValue || req.SurplusSavingAccountID.Value <= 0 || !await _context.SavingAccountMasters.AnyAsync(s => s.SavingAccountID == req.SurplusSavingAccountID.Value && s.Status != "Closed")))
                            {
                                await transaction.RollbackAsync();
                                return BadRequest("शिल्लक परतावा बचत खात्यात वर्ग करण्यासाठी वैध सक्रिय बचत खाते निवडणे बंधनकारक आहे.");
                            }
                            else if (!string.Equals(surplusMode, "Cash", StringComparison.OrdinalIgnoreCase) && !string.Equals(surplusMode, "Transfer", StringComparison.OrdinalIgnoreCase) && !string.Equals(surplusMode, "Saving", StringComparison.OrdinalIgnoreCase) && !string.Equals(surplusMode, "Saving Transfer", StringComparison.OrdinalIgnoreCase))
                            {
                                await transaction.RollbackAsync();
                                return BadRequest($"शिल्लक परताव्यासाठी अवैध पेमेंट पद्धत '{surplusMode}'.");
                            }
                            else if ((string.Equals(surplusMode, "Transfer", StringComparison.OrdinalIgnoreCase) || string.Equals(surplusMode, "Saving", StringComparison.OrdinalIgnoreCase) || string.Equals(surplusMode, "Saving Transfer", StringComparison.OrdinalIgnoreCase)) && req.SurplusSavingAccountID > 0)
                            {
                                var savAccount = await _context.SavingAccountMasters
                                    .Include(s => s.Ledger)
                                    .FirstOrDefaultAsync(s => s.SavingAccountID == req.SurplusSavingAccountID.Value);

                                if (savAccount != null)
                                {
                                    savAccount.CurrentBalance += surplusPayoutAmount;
                                    surplusLedgerId = await Helpers.SavingLedgerHelper.ResolveSavingLiabilityLedgerIdAsync(_context, savAccount);

                                    var savTx = new SavingTransaction
                                    {
                                        SavingAccountID = savAccount.SavingAccountID,
                                        CustomerID = savAccount.CustomerID,
                                        BranchID = account.BranchID > 0 ? account.BranchID : savAccount.BranchID,
                                        TransactionDate = closureDate,
                                        TransactionType = "Deposit",
                                        PaymentMode = "Transfer",
                                        Amount = surplusPayoutAmount,
                                        BalanceAfterTxn = savAccount.CurrentBalance,
                                        Narration = $"मुदत ठेव शिल्लक परतावा जमा (FD Settlement Surplus): {account.AccountNo}",
                                        VoucherNo = $"JV-FD-CLOSE-{account.AccountNo}",
                                        CreatedBy = 1,
                                        CreatedOn = DateTime.Now
                                    };
                                    _context.SavingTransactions.Add(savTx);
                                }
                                else
                                {
                                    surplusLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, account.BranchID, "FD");
                                }
                            }
                            else
                            {
                                surplusLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, account.BranchID, "FD");
                            }
                        }

                        // 3. Create Compound Journal Voucher
                        var voucher = new Voucher
                        {
                            BranchID = account.BranchID,
                            VoucherNo = $"JV-FD-CLOSE-{account.AccountNo}",
                            VoucherDate = closureDate,
                            VoucherType = "Journal",
                            TotalAmount = totalMaturityPayout,
                            Narration = (string.IsNullOrWhiteSpace(req?.Narration)
                                ? $"मुदत ठेव परतावा व कर्ज वजावट (FD Maturity Payout & Loan Set-Off): {account.AccountNo} -> कर्ज: {settledLoan.LoanAccountNo} (कर्ज जमा: ₹{loanAdjustAmount:N2}, शिल्लक परतावा: ₹{surplusPayoutAmount:N2} {surplusMode}){(overdueInterest > 0 ? $" (समाविष्ट Overdue व्याज: ₹{overdueInterest:F2})" : "")}"
                                : req.Narration) + manualAuditNote,
                            CreatedBy = 1,
                            CreatedOn = DateTime.Now
                        };
                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();
                        loanColl.VoucherID = voucher.VoucherID;

                        // Dr FD Liability (Principal + any previously capitalized interest)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = fdLiabilityLedger.LedgerID, DrCr = "Dr", Amount = fdLiabilityDebitAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                        // Dr Interest Payable (Contracted Matured Interest - cleared only up to already provisioned)
                        if (payableLedger != null && payableInterestAmount > 0)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = payableInterestAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        }

                        // Dr Interest Expense (Unprovisioned current period interest + Overdue Post-Maturity Interest)
                        if (totalExpenseInterest > 0 && expenseLedger != null)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = expenseLedger.LedgerID, DrCr = "Dr", Amount = totalExpenseInterest, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        }

                        // Cr Loan Ledgers
                        var loanRate = settledLoan.LoanRate ?? await _context.LoanRates.FindAsync(settledLoan.LoanRateID);
                        int loanLedgerId = loanRate?.LoanLedgerID ?? 0;
                        int loanInterestLedgerId = loanRate?.InterestLedgerID ?? 0;
                        int loanOverdueLedgerId = (loanRate?.OverdueInterestLedgerID ?? 0) > 0 ? loanRate!.OverdueInterestLedgerID!.Value : loanInterestLedgerId;

                        if (prinPaid > 0)
                        {
                            if (loanLedgerId <= 0)
                            {
                                return BadRequest("कर्ज योजनेचे मुद्दल लेजर (Loan Principal Ledger) मॅप केलेले नाही.");
                            }
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = loanLedgerId, DrCr = "Cr", Amount = prinPaid, CustomerID = settledLoan.CustomerID, MemberID = settledLoan.MemberID });
                        }
                        if (intPaid > 0)
                        {
                            if (loanInterestLedgerId <= 0)
                            {
                                return BadRequest("कर्ज योजनेचे व्याज लेजर (Loan Interest Ledger) मॅप केलेले नाही.");
                            }
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = loanInterestLedgerId, DrCr = "Cr", Amount = intPaid, CustomerID = settledLoan.CustomerID, MemberID = settledLoan.MemberID });
                        }
                        if (penPaid > 0)
                        {
                            if (loanOverdueLedgerId <= 0)
                            {
                                return BadRequest("कर्ज योजनेचे दंड व्याज लेजर (Loan Overdue Interest Ledger) मॅप केलेले नाही.");
                            }
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = loanOverdueLedgerId, DrCr = "Cr", Amount = penPaid, CustomerID = settledLoan.CustomerID, MemberID = settledLoan.MemberID });
                        }

                        // Cr Surplus Payout Ledger (if surplus > 0)
                        if (surplusPayoutAmount > 0 && surplusLedgerId > 0)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = surplusLedgerId, DrCr = "Cr", Amount = surplusPayoutAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        }

                        // Log Close Transaction
                        var tx = new FdTransaction
                        {
                            BranchID = account.BranchID,
                            FdAccountID = account.FdAccountID,
                            VoucherID = voucher.VoucherID,
                            TransactionDate = closureDate,
                            TransactionType = "Payout",
                            DebitCredit = "Dr",
                            Amount = totalMaturityPayout
                        };
                        _context.FdTransactions.Add(tx);
                        if (tx.TransactionType == "Premature_Close" && tx.VoucherID > 0)
                        {
                            await Helpers.VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, tx.VoucherID);
                        }

                        if (overdueInterest > 0)
                        {
                            _context.FdTransactions.Add(new FdTransaction
                            {
                                BranchID = account.BranchID,
                                FdAccountID = account.FdAccountID,
                                VoucherID = voucher.VoucherID,
                                TransactionDate = closureDate,
                                TransactionType = "Closure_Interest",
                                DebitCredit = "Cr",
                                Amount = overdueInterest
                            });
                        }

                        await _context.SaveChangesAsync();
                        await transaction.CommitAsync();

                        return Ok(new
                        {
                            message = $"मुदत ठेव बंद करून कर्ज खात्यात ₹{loanAdjustAmount:N2} वर्ग करण्यात आले." + (surplusPayoutAmount > 0 ? $" शिल्लक रक्कम ₹{surplusPayoutAmount:N2} ({surplusMode}) अदा केली." : ""),
                            loanAdjusted = loanAdjustAmount,
                            surplusPaid = surplusPayoutAmount,
                            loanAccountNo = settledLoan.LoanAccountNo,
                            remainingLoanBalance = settledLoan.PrincipalBalance + settledLoan.InterestBalance + settledLoan.OverdueInterestBalance
                        });
                    }
                    else
                    {
                        // Standard Non-Loan Closure
                        int payoutLedgerId = 0;
                        if (BankLedgerHelper.IsBankPaymentMode(paymentMode))
                        {
                            var payoutBankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(_context, req?.BankAccountLedgerID);
                            if (!payoutBankCheck.IsValid)
                            {
                                await transaction.RollbackAsync();
                                return BadRequest(payoutBankCheck.ErrorMessage);
                            }
                            payoutLedgerId = payoutBankCheck.LedgerId;
                        }
                        else if ((string.Equals(paymentMode, "Transfer", StringComparison.OrdinalIgnoreCase) || string.Equals(paymentMode, "Saving", StringComparison.OrdinalIgnoreCase) || string.Equals(paymentMode, "Saving Transfer", StringComparison.OrdinalIgnoreCase)) && (req?.SavingAccountID == null || req.SavingAccountID <= 0 || !await _context.SavingAccountMasters.AnyAsync(s => s.SavingAccountID == req.SavingAccountID.Value && s.Status != "Closed")))
                        {
                            await transaction.RollbackAsync();
                            return BadRequest("मुदत ठेव परतावा बचत खात्यात वर्ग करण्यासाठी वैध सक्रिय बचत खाते निवडणे बंधनकारक आहे.");
                        }
                        else if (!string.Equals(paymentMode, "Cash", StringComparison.OrdinalIgnoreCase) && !string.Equals(paymentMode, "Transfer", StringComparison.OrdinalIgnoreCase) && !string.Equals(paymentMode, "Saving", StringComparison.OrdinalIgnoreCase) && !string.Equals(paymentMode, "Saving Transfer", StringComparison.OrdinalIgnoreCase))
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"परताव्यासाठी अवैध पेमेंट पद्धत '{paymentMode}'.");
                        }
                        else if ((string.Equals(paymentMode, "Transfer", StringComparison.OrdinalIgnoreCase) || string.Equals(paymentMode, "Saving", StringComparison.OrdinalIgnoreCase) || string.Equals(paymentMode, "Saving Transfer", StringComparison.OrdinalIgnoreCase)) && req?.SavingAccountID > 0)
                        {
                            var savAccount = await _context.SavingAccountMasters
                                .Include(s => s.Ledger)
                                .FirstOrDefaultAsync(s => s.SavingAccountID == req.SavingAccountID.Value);

                            if (savAccount != null)
                            {
                                savAccount.CurrentBalance += totalMaturityPayout;
                                payoutLedgerId = await Helpers.SavingLedgerHelper.ResolveSavingLiabilityLedgerIdAsync(_context, savAccount);

                                var savTx = new SavingTransaction
                                {
                                    SavingAccountID = savAccount.SavingAccountID,
                                    CustomerID = savAccount.CustomerID,
                                    BranchID = account.BranchID > 0 ? account.BranchID : savAccount.BranchID,
                                    TransactionDate = closureDate,
                                    TransactionType = "Deposit",
                                    PaymentMode = "Transfer",
                                    Amount = totalMaturityPayout,
                                    BalanceAfterTxn = savAccount.CurrentBalance,
                                    Narration = $"मुदत ठेव परतावा जमा (FD Maturity Payout): {account.AccountNo}{(overdueInterest > 0 ? $" (समाविष्ट Overdue व्याज: ₹{overdueInterest:F2})" : "")}",
                                    VoucherNo = $"JV-FD-CLOSE-{account.AccountNo}",
                                    CreatedBy = 1,
                                    CreatedOn = DateTime.Now
                                };
                                _context.SavingTransactions.Add(savTx);
                            }
                            else
                            {
                                payoutLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, operatingBranchId, "FD");
                            }
                        }
                        else
                        {
                            payoutLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, operatingBranchId, "FD");
                        }

                        var payoutLedger = await _context.Ledgers.FindAsync(payoutLedgerId);
                        if (payoutLedger == null)
                        {
                            return BadRequest("Required payout ledger not found.");
                        }

                        int finalVoucherId;

                        if (!isCrossBranchTxn)
                        {
                            // Standard Single-Branch Voucher
                            var voucher = new Voucher
                            {
                                BranchID = account.BranchID,
                                VoucherNo = $"JV-FD-CLOSE-{account.AccountNo}",
                                VoucherDate = closureDate,
                                VoucherType = (string.Equals(paymentMode, "Cash", StringComparison.OrdinalIgnoreCase) || Helpers.BankLedgerHelper.IsBankPaymentMode(paymentMode)) ? "Payment" : "Journal",
                                TotalAmount = totalMaturityPayout,
                                Narration = (string.IsNullOrWhiteSpace(req?.Narration) 
                                    ? $"मुदत ठेव पूर्ण क्लोजर (FD Maturity Payout - {paymentMode}): {account.AccountNo} [मुदतपूर्ती: {account.MaturityDate:dd/MM/yyyy}, प्रक्रिया: {DateTime.Now:dd/MM/yyyy}{(closureDate.Date < activeBusinessDate.Date ? $", As-on: {closureDate:dd/MM/yyyy}" : "")}]{(paymentMode == "Bank" && !string.IsNullOrEmpty(req?.ChequeNo) ? $" Cheque: {req.ChequeNo}" : "")}{(overdueInterest > 0 ? $" (समाविष्ट Overdue व्याज: ₹{overdueInterest:F2})" : "")}"
                                    : req.Narration) + manualAuditNote,
                                CreatedBy = 1,
                                CreatedOn = DateTime.Now
                            };
                            _context.Vouchers.Add(voucher);
                            await _context.SaveChangesAsync();

                            // Dr FD Liability (Principal + any previously capitalized interest)
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = fdLiabilityLedger.LedgerID, DrCr = "Dr", Amount = fdLiabilityDebitAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            
                            // Dr Interest Payable (Contracted Matured Interest - cleared only up to already provisioned)
                            if (payableLedger != null && payableInterestAmount > 0)
                            {
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = payableInterestAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            }

                            // Dr Interest Expense (Unprovisioned current period interest + Overdue Post-Maturity Interest)
                            if (totalExpenseInterest > 0 && expenseLedger != null)
                            {
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = expenseLedger.LedgerID, DrCr = "Dr", Amount = totalExpenseInterest, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            }

                            // Cr Payout Ledger (Cash, Bank, or Saving)
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payoutLedger.LedgerID, DrCr = "Cr", Amount = totalMaturityPayout, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                            finalVoucherId = voucher.VoucherID;
                        }
                        else
                        {
                            // CBS Dual-Voucher IBT Engine for Cross-Branch FD Maturity Payout
                            int counterBranchId = operatingBranchId;
                            int homeBranchId = account.BranchID;
                            var (counterIbtLedgerId, homeIbtLedgerId) = await Helpers.IbtLedgerHelper.GetDirectionalPairIbtLedgerIdsAsync(_context, counterBranchId, homeBranchId);

                            // 1. Counter Voucher (Branch A, Payment): Dr IBT, Cr Cash/Payout Ledger
                            var counterVoucher = new Voucher
                            {
                                BranchID = counterBranchId,
                                VoucherNo = $"PV-{counterBranchId}-{closureDate:yyyyMMdd}-FD-CLOSE-{account.AccountNo}",
                                VoucherDate = closureDate,
                                VoucherType = (string.Equals(paymentMode, "Cash", StringComparison.OrdinalIgnoreCase) || Helpers.BankLedgerHelper.IsBankPaymentMode(paymentMode)) ? "Payment" : "Journal",
                                TotalAmount = totalMaturityPayout,
                                Narration = (string.IsNullOrWhiteSpace(req?.Narration)
                                    ? $"[आंतर-शाखा मुदत ठेव परतावा] खाते: {account.AccountNo} (मूळ शाखा #{homeBranchId}) साठी काऊंटरवर रोख परतावा अदा"
                                    : $"[आंतर-शाखा मुदत ठेव परतावा] {req.Narration}") + manualAuditNote,
                                CreatedBy = 1,
                                CreatedOn = DateTime.Now,
                                IsIbtVoucher = true,
                                TargetBranchID = homeBranchId
                            };
                            _context.Vouchers.Add(counterVoucher);
                            await _context.SaveChangesAsync();

                            // Dr IBT
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = counterVoucher.VoucherID, LedgerID = counterIbtLedgerId, DrCr = "Dr", Amount = totalMaturityPayout, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            // Cr Cash
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = counterVoucher.VoucherID, LedgerID = payoutLedger.LedgerID, DrCr = "Cr", Amount = totalMaturityPayout, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                            // 2. Home Branch Voucher (Branch B, Journal): Dr FD Liability, Dr Payable, Dr Expense, Cr IBT
                            var homeVoucher = new Voucher
                            {
                                BranchID = homeBranchId,
                                VoucherNo = $"JV-FD-CLOSE-{account.AccountNo}",
                                VoucherDate = closureDate,
                                VoucherType = "Journal",
                                TotalAmount = totalMaturityPayout,
                                Narration = (string.IsNullOrWhiteSpace(req?.Narration)
                                    ? $"[आंतर-शाखा मुदत ठेव क्लोजर] काऊंटर शाखा #{counterBranchId} वरून परतावा अदा (खाते: {account.AccountNo})"
                                    : $"[आंतर-शाखा मुदत ठेव क्लोजर] {req.Narration}") + manualAuditNote,
                                CreatedBy = 1,
                                CreatedOn = DateTime.Now,
                                IsIbtVoucher = true,
                                TargetBranchID = counterBranchId,
                                RelatedVoucherID = counterVoucher.VoucherID
                            };
                            _context.Vouchers.Add(homeVoucher);
                            await _context.SaveChangesAsync();

                            counterVoucher.RelatedVoucherID = homeVoucher.VoucherID;

                            // Dr FD Liability (Principal + any previously capitalized interest)
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = fdLiabilityLedger.LedgerID, DrCr = "Dr", Amount = fdLiabilityDebitAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                            // Dr Interest Payable (Contracted Matured Interest - cleared only up to already provisioned)
                            if (payableLedger != null && payableInterestAmount > 0)
                            {
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = payableInterestAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            }

                            // Dr Interest Expense (Unprovisioned current period interest + Overdue Post-Maturity Interest)
                            if (totalExpenseInterest > 0 && expenseLedger != null)
                            {
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = expenseLedger.LedgerID, DrCr = "Dr", Amount = totalExpenseInterest, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            }

                            // Cr IBT Ledger
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = homeIbtLedgerId, DrCr = "Cr", Amount = totalMaturityPayout, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                            finalVoucherId = counterVoucher.VoucherID;
                        }

                        // Log Close Transaction
                        var tx = new FdTransaction
                        {
                            BranchID = isCrossBranchTxn ? operatingBranchId : account.BranchID,
                            FdAccountID = account.FdAccountID,
                            VoucherID = finalVoucherId,
                            TransactionDate = closureDate,
                            TransactionType = "Payout",
                            DebitCredit = "Dr",
                            Amount = totalMaturityPayout
                        };
                        _context.FdTransactions.Add(tx);
                        if (tx.TransactionType == "Premature_Close" && tx.VoucherID > 0)
                        {
                            await Helpers.VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, tx.VoucherID);
                        }

                        if (overdueInterest > 0)
                        {
                            _context.FdTransactions.Add(new FdTransaction
                            {
                                BranchID = isCrossBranchTxn ? operatingBranchId : account.BranchID,
                                FdAccountID = account.FdAccountID,
                                VoucherID = finalVoucherId,
                                TransactionDate = closureDate,
                                TransactionType = "Closure_Interest",
                                DebitCredit = "Cr",
                                Amount = overdueInterest
                            });
                        }

                        await _context.SaveChangesAsync();
                        await transaction.CommitAsync();
                        return Ok($"FD Account matured closed ({paymentMode}). Total payout: ₹{totalMaturityPayout:F2}" + (overdueInterest > 0 ? $" (समाविष्ट Overdue व्याज: ₹{overdueInterest:F2})" : ""));
                    }
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("Failed to mature close: " + GetDeepestErrorMessage(ex));
                }
            }
        }

        private (decimal PrematureRate, decimal SlabRate, decimal PenaltyDeduction, string MatchedSlabText, bool IsMinimumPeriodViolated, string RateResolutionNote) ResolvePrematureRate(
            FdAccount account,
            int actualDays,
            DateTime closureDate)
        {
            var scheme = account.FdScheme;
            if (scheme == null && account.FdSchemeID > 0)
            {
                scheme = _context.FdSchemes.Include(s => s.Slabs).FirstOrDefault(s => s.FdSchemeID == account.FdSchemeID);
            }

            if (account.Customer == null && account.CustomerID > 0)
            {
                account.Customer = _context.Customers.FirstOrDefault(c => c.CustomerID == account.CustomerID);
            }

            bool isSenior = account.Customer?.BirthDate.HasValue == true
                && (account.Customer.BirthDate.Value.Date <= closureDate.Date.AddYears(-60));

            // Default regulatory premature penalty across co-operative banking is 1.00%
            decimal standardPenalty = 1.0m;

            if (scheme?.Slabs != null && scheme.Slabs.Any(s => s.IsActive))
            {
                var activeSlabs = scheme.Slabs.Where(s => s.IsActive).OrderBy(s => s.FromDays).ToList();
                int minFromDays = activeSlabs.Min(s => s.FromDays);
                if (scheme.MinDurationDays.HasValue && scheme.MinDurationDays.Value > 0)
                {
                    minFromDays = Math.Min(minFromDays, scheme.MinDurationDays.Value);
                }

                // 1. Minimum Holding Period Rule: RBI & MCS Act mandates 0% interest if closed before minimum tenor
                if (actualDays < minFromDays)
                {
                    return (
                        0m,
                        0m,
                        0m,
                        $"किमान {minFromDays} दिवस आवश्यक (ठेव फक्त {actualDays} दिवस)",
                        true,
                        $"आरबीआय नियमानुसार किमान ठेव कालावधीपूर्वी ({actualDays} दिवस < {minFromDays} दिवस) बंद केल्याने ०.००% (शून्य) व्याज देय आहे."
                    );
                }

                // 2. Exact Run Period Slab Match
                var matchedSlab = activeSlabs.FirstOrDefault(s => actualDays >= s.FromDays && actualDays <= s.ToDays);
                if (matchedSlab != null)
                {
                    decimal sRate = (isSenior && matchedSlab.SeniorCitizenRate > 0) ? matchedSlab.SeniorCitizenRate : matchedSlab.InterestRate;

                    // Case A: Slab has explicit premature rate configured
                    if (matchedSlab.PrematureRate > 0)
                    {
                        decimal slabPrematureRate = Math.Min(account.InterestRate, matchedSlab.PrematureRate);
                        decimal effectivePenalty = Math.Max(0m, account.InterestRate - slabPrematureRate);
                        return (
                            slabPrematureRate,
                            sRate,
                            effectivePenalty,
                            $"{matchedSlab.FromDays} ते {matchedSlab.ToDays} दिवस (स्लॅब दर: {sRate}%)",
                            false,
                            $"कालावधी स्लॅब ({matchedSlab.FromDays}-{matchedSlab.ToDays} दिवस) पूर्वनिर्धारित मुदतपूर्व दर {slabPrematureRate}% थेट लागू."
                        );
                    }

                    // Case B: Standard Golden Rule: Base Rate = min(ContractedRate, RunPeriodSlabRate), Final = max(0, Base - Penalty)
                    decimal baseRate = Math.Min(account.InterestRate, sRate);
                    decimal finalPrematureRate = Math.Max(0m, baseRate - standardPenalty);
                    return (
                        finalPrematureRate,
                        sRate,
                        standardPenalty,
                        $"{matchedSlab.FromDays} ते {matchedSlab.ToDays} दिवस (स्लॅब दर: {sRate}%)",
                        false,
                        $"आरबीआय स्लॅब नियम: प्रत्यक्ष {actualDays} दिवस स्लॅब ({matchedSlab.FromDays}-{matchedSlab.ToDays} दिवस) दर {sRate}%, मूळ करार दर {account.InterestRate}%, दंड -{standardPenalty}% -> अंतिम लागू मुदतपूर्व दर: {finalPrematureRate}%"
                    );
                }

                // Held beyond highest configured slab (e.g. multi-year deposits held beyond highest slab but before maturity)
                var maxSlab = activeSlabs.OrderByDescending(s => s.ToDays).FirstOrDefault();
                if (maxSlab != null && actualDays > maxSlab.ToDays)
                {
                    decimal sRate = (isSenior && maxSlab.SeniorCitizenRate > 0) ? maxSlab.SeniorCitizenRate : maxSlab.InterestRate;
                    decimal baseRate = Math.Min(account.InterestRate, sRate);
                    decimal finalPrematureRate = Math.Max(0m, baseRate - standardPenalty);
                    return (
                        finalPrematureRate,
                        sRate,
                        standardPenalty,
                        $"{maxSlab.FromDays} ते {maxSlab.ToDays}+ दिवस (कमाल स्लॅब दर: {sRate}%)",
                        false,
                        $"आरबीआय स्लॅब नियम: प्रत्यक्ष {actualDays} दिवस कमाल स्लॅब ({maxSlab.FromDays}-{maxSlab.ToDays} दिवस) दर {sRate}%, करार दर {account.InterestRate}%, दंड -{standardPenalty}% -> अंतिम लागू मुदतपूर्व दर: {finalPrematureRate}%"
                    );
                }
            }

            // Case C: Fixed scheme fallback (no active slabs)
            int minHoldingDays = scheme?.MinDurationDays ?? 7;
            if (actualDays < minHoldingDays)
            {
                return (
                    0m,
                    0m,
                    0m,
                    $"किमान {minHoldingDays} दिवस आवश्यक (ठेव फक्त {actualDays} दिवस)",
                    true,
                    $"आरबीआय नियमानुसार किमान ठेव कालावधीपूर्वी ({actualDays} दिवस < {minHoldingDays} दिवस) बंद केल्याने ०.००% (शून्य) व्याज देय आहे."
                );
            }

            decimal fixedPenalty = 1.0m;
            decimal fixedPremature = (scheme?.PrematureInterestRate > 0)
                ? Math.Min(account.InterestRate, scheme.PrematureInterestRate)
                : Math.Max(0m, account.InterestRate - fixedPenalty);
            decimal effPenalty = (scheme?.PrematureInterestRate > 0)
                ? Math.Max(0m, account.InterestRate - fixedPremature)
                : fixedPenalty;

            return (
                fixedPremature,
                account.InterestRate,
                effPenalty,
                "फिक्स्ड योजना (विना-स्लॅब)",
                false,
                $"फिक्स्ड योजना करार दर: {account.InterestRate}%, दंड: -{effPenalty}% -> अंतिम मुदतपूर्व दर: {fixedPremature}%"
            );
        }

        private decimal ResolvePrematureRate(FdAccount account, int actualDays, FdScheme? scheme)
        {
            var res = ResolvePrematureRate(account, actualDays, DateTime.Today);
            return res.PrematureRate;
        }

        // GET: api/FdAccounts/5/PrematurePreview?closureDate=2026-03-31
        [HttpGet("{id}/PrematurePreview")]
        public async Task<IActionResult> GetPrematurePreview(int id, [FromQuery] DateTime? closureDate = null)
        {
            var account = await _context.FdAccounts
                .AsNoTracking()
                .AsSplitQuery()
                .Include(a => a.Customer)
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.Slabs)
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.FdLiabilityLedger)
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.InterestPayableLedger)
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.InterestExpenseLedger)
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.PrematurePenaltyLedger)
                .FirstOrDefaultAsync(a => a.FdAccountID == id);

            if (account == null)
            {
                return NotFound("मुदत ठेव खाते सापडले नाही.");
            }

            DateTime effectiveClosureDate = closureDate?.Date ?? DateTime.Today;
            int actualDays = Math.Max(1, (effectiveClosureDate - account.OpeningDate.Date).Days);

            var (prematureRate, slabRate, penaltyDeduction, matchedSlabText, isMinPeriodViolated, resolutionNote) =
                ResolvePrematureRate(account, actualDays, effectiveClosureDate);

            decimal recalculatedInterest = Math.Round((account.DepositAmount * prematureRate * actualDays) / 36500.0m, 2);

            bool isPeriodicPayout = account.FdScheme != null &&
                (account.FdScheme.InterestType == "MIS" || account.FdScheme.InterestType == "Monthly Interest");

            var postingBreakdown = await Helpers.FdInterestSettlementHelper.ResolveVerifiedPostingBreakdownAsync(
                _context, id, account.FdScheme?.InterestPayableLedgerID ?? 0);
            decimal verifiedProvision = postingBreakdown.VerifiedProvision;
            decimal capitalizedInterest = postingBreakdown.VerifiedCapitalized;

            decimal misPayoutSum = 0m;
            if (isPeriodicPayout)
            {
                try
                {
                    misPayoutSum = await _context.FdMisPayouts
                        .Where(p => p.FdAccountID == id && p.Status == "Success")
                        .SumAsync(p => (decimal?)p.GrossInterest) ?? 0m;
                }
                catch { /* table might be fresh */ }
                decimal misTxSum = await _context.FdTransactions
                    .Where(t => t.FdAccountID == id && t.TransactionType == "MIS_Payout")
                    .SumAsync(t => (decimal?)t.Amount) ?? 0m;
                misPayoutSum = Math.Max(misPayoutSum, misTxSum);
            }
            decimal verifiedProvEff = isPeriodicPayout ? 0m : verifiedProvision;
            decimal totalPostedInterest = verifiedProvEff + capitalizedInterest;
            decimal alreadyAccruedInt = isPeriodicPayout ? (misPayoutSum + capitalizedInterest) : totalPostedInterest;

            decimal penaltyClawback = 0m;
            decimal netPayoutAmount = account.DepositAmount + recalculatedInterest;

            if (isPeriodicPayout)
            {
                if (alreadyAccruedInt > recalculatedInterest)
                {
                    penaltyClawback = alreadyAccruedInt - recalculatedInterest;
                    netPayoutAmount = Math.Max(0m, account.DepositAmount - penaltyClawback);
                }
            }
            else
            {
                if (alreadyAccruedInt > recalculatedInterest)
                {
                    penaltyClawback = alreadyAccruedInt - recalculatedInterest;
                }
            }

            return Ok(new
            {
                fdAccountID = account.FdAccountID,
                accountNo = account.AccountNo,
                depositAmount = account.DepositAmount,
                contractedRate = account.InterestRate,
                openingDate = account.OpeningDate,
                maturityDate = account.MaturityDate,
                closureDate = effectiveClosureDate,
                actualDays = actualDays,
                isSeniorCitizen = account.Customer?.BirthDate.HasValue == true && (account.Customer.BirthDate.Value.Date <= effectiveClosureDate.AddYears(-60)),
                matchedSlabText = matchedSlabText,
                slabRate = slabRate,
                penaltyRate = penaltyDeduction,
                prematureRate = prematureRate,
                recalculatedInterest = recalculatedInterest,
                alreadyAccruedInterest = alreadyAccruedInt,
                verifiedProvisionInterest = verifiedProvision,
                backedLegacyProvision = postingBreakdown.BackedLegacyProvision,
                effectiveProvisionInterest = verifiedProvision + postingBreakdown.BackedLegacyProvision,
                alreadyCapitalizedInterest = capitalizedInterest,
                legacyAccruedInterest = account.LegacyAccruedInt,
                totalPostedInterest = totalPostedInterest,
                interestPostingMethod = account.FdScheme?.InterestPostingMethod ?? "On Principal",
                penaltyClawback = penaltyClawback,
                netPayoutAmount = netPayoutAmount,
                isPeriodicPayout = isPeriodicPayout,
                isMinimumPeriodViolated = isMinPeriodViolated,
                resolutionNote = resolutionNote
            });
        }

        // POST: api/FdAccounts/5/PrematureClose
        [HttpPost("{id}/PrematureClose")]
        public async Task<IActionResult> PrematureClose(int id, [FromQuery] DateTime? closureDate = null, [FromBody] FdClosureRequest? req = null)
        {
            var account = await _context.FdAccounts
                .AsSplitQuery()
                .Include(a => a.Customer)
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.Slabs)
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.FdLiabilityLedger)
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.InterestPayableLedger)
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.InterestExpenseLedger)
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.PrematurePenaltyLedger)
                .FirstOrDefaultAsync(a => a.FdAccountID == id);

            if (account == null || (account.Status != "Active" && account.Status != "Matured"))
            {
                return BadRequest("मुदत ठेव खाते सक्रिय (Active) नाही किंवा यापूर्वीच बंद/नूतनीकरण करण्यात आलेले आहे.");
            }

            // Multi-branch CBS: Support Cross-Branch Premature Closure with IBT Dual-Voucher
            int userBranchId = User.GetOperatingBranchId();
            bool isHO = User.IsHeadOfficeAdmin();
            int operatingBranchId = userBranchId > 0 ? userBranchId : (account.BranchID > 0 ? account.BranchID : 1);
            bool isCrossBranchTxn = (operatingBranchId != account.BranchID);

            DateTime activeBusinessDate = await ResolveActiveBusinessDateAsync(operatingBranchId);
            DateTime effectiveClosureDate = req?.ClosureDate ?? closureDate ?? activeBusinessDate;
            if (effectiveClosureDate.Date < account.OpeningDate.Date)
            {
                return BadRequest($"अवैध व्यवहाराची तारीख! व्यवहाराची तारीख ({effectiveClosureDate:dd/MM/yyyy}) ही मुदत ठेव खाते उघडल्याच्या तारखेपेक्षा ({account.OpeningDate:dd/MM/yyyy}) आधीची असू शकत नाही.");
            }
            if (effectiveClosureDate.Date > DateTime.Today)
            {
                return BadRequest($"अवैध व्यवहाराची तारीख! भविष्यातील तारीख ({effectiveClosureDate:dd/MM/yyyy}) अनुज्ञेय नाही. व्यवहार आजच्या किंवा मागील तारखेचाच असणे आवश्यक आहे.");
            }

            // 🛡️ मुदत संपलेल्या खात्यावर मुदतपूर्व दंड लागू होऊ नये यासाठी गार्ड
            if (effectiveClosureDate.Date >= account.MaturityDate.Date)
            {
                return BadRequest($"अवैध विनंती! सदर मुदत ठेव खात्याची मुदत दिनांक {account.MaturityDate:dd/MM/yyyy} रोजीच पूर्ण झालेली आहे. मुदत पूर्ण झालेल्या ठेवीवर मुदतपूर्व दंड (Penalty) आकारला जाऊ नये यासाठी कृपया 'मुदतपूर्ती बंद (Matured Close)' हा पर्याय वापरा.");
            }

            var closedFy = await _context.FinancialYears
                .FirstOrDefaultAsync(fy => fy.IsClosed && effectiveClosureDate.Date >= fy.StartDate.Date && effectiveClosureDate.Date <= fy.EndDate.Date);
            if (closedFy != null)
            {
                return BadRequest($"अवैध व्यवहाराची तारीख! निवडलेली तारीख ({effectiveClosureDate:dd/MM/yyyy}) ही बंद/ऑडिट झालेल्या आर्थिक वर्षात ({closedFy.YearCode}) मोडते. बंद आर्थिक वर्षात थेट व्हाउचर पोस्ट करणे वैधानिक लेखापरीक्षण नियमांनुसार (MCS Act) प्रतिबंधित आहे.");
            }

            DateTime? lastAccrualDate = account.LastInterestPostingDate;
            if (!lastAccrualDate.HasValue)
            {
                lastAccrualDate = await _context.FdInterestAccruals
                    .Where(a => a.FdAccountID == account.FdAccountID && a.IsPosted)
                    .OrderByDescending(a => a.AccrualDate)
                    .Select(a => (DateTime?)a.AccrualDate)
                    .FirstOrDefaultAsync();
            }
            if (!lastAccrualDate.HasValue)
            {
                lastAccrualDate = await _context.FdTransactions
                    .Where(t => t.FdAccountID == account.FdAccountID && t.TransactionType == "Accrual")
                    .OrderByDescending(t => t.TransactionDate)
                    .Select(t => (DateTime?)t.TransactionDate)
                    .FirstOrDefaultAsync();
            }

            if (lastAccrualDate.HasValue && effectiveClosureDate.Date < lastAccrualDate.Value.Date)
            {
                return BadRequest($"अवैध व्यवहाराची तारीख! या खात्यावर {lastAccrualDate.Value:dd/MM/yyyy} रोजी व्याज तरतूद (Interest Accrual) झालेली आहे. व्यवहाराची तारीख शेवटच्या व्याज तरतुदीच्या तारखेपेक्षा ({lastAccrualDate.Value:dd/MM/yyyy}) आधीची असू शकत नाही, अन्यथा देणे व्याज खात्यात (Interest Payable) अनैसर्गिक निगेटिव्ह (Debit) शिल्लक निर्माण होईल.");
            }
            string paymentMode = string.IsNullOrWhiteSpace(req?.PaymentMode) ? "Cash" : req.PaymentMode;
            if (paymentMode == "Transfer" && req?.SavingAccountID > 0)
            {
                if (effectiveClosureDate.Date < activeBusinessDate.Date)
                {
                    return BadRequest($"अवैध व्यवहाराची तारीख! बचत खात्यात (Saving Account Transfer) परतावा वर्ग करताना मागील तारीख ({effectiveClosureDate:dd/MM/yyyy}) अनुज्ञेय नाही. ग्राहकाच्या पासबुकमधील रनिंग शिल्लक (Running Balance) विस्कळीत होणे टाळण्यासाठी आणि एसएमएस ताळमेळ राखण्यासाठी बचत खात्यातील हस्तांतरण चालू व्यवसाय तारखेने ({activeBusinessDate:dd/MM/yyyy}) होणे बंधनकारक आहे. जर व्यवहार मागील तारखेने झाला असेल, तर कृपया 'रोख' किंवा इतर माध्यम निवडा.");
                }
                var targetSav = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.SavingAccountID == req.SavingAccountID.Value);
                if (targetSav == null || targetSav.Status != "Active")
                {
                    return BadRequest($"निवडलेले बचत खाते ({targetSav?.AccountNo ?? "अज्ञात"}) सापडले नाही किंवा ते सक्रिय (Active) नाही. बंद किंवा निष्क्रिय बचत खात्यात रक्कम वर्ग करता येत नाही.");
                }
            }

            if (req?.AdjustInLoan == true && req.SurplusPaymentMode == "Transfer" && req.SurplusSavingAccountID > 0)
            {
                var surplusSav = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.SavingAccountID == req.SurplusSavingAccountID.Value);
                if (surplusSav == null || surplusSav.Status != "Active")
                {
                    return BadRequest($"शिल्लक परताव्यासाठी निवडलेले बचत खाते ({surplusSav?.AccountNo ?? "अज्ञात"}) सापडले नाही किंवा ते सक्रिय (Active) नाही. बंद किंवा निष्क्रिय बचत खात्यात रक्कम वर्ग करता येत नाही.");
                }
            }

            // 🛡️ Lien & Active Loan Check: खातेदाराचे थकीत/सक्रिय कर्ज व तारण बोजा तपासणी
            var (hasDirectLien, directLienLoanNo, activeLoans, totalActiveLoanDebt, linkedMemberId) =
                await GetFdActiveLoansAndLienContextAsync(account, effectiveClosureDate);

            if (hasDirectLien && req?.AdjustInLoan != true)
            {
                return BadRequest(new
                {
                    errorCode = "FD_LIEN_BREAK_BLOCKED",
                    message = $"सदर मुदत ठेव पावतीवर कर्ज खाते क्र. '{directLienLoanNo ?? "अज्ञात"}' चा तारण बोजा (Lien: ₹{account.LienAmount ?? account.DepositAmount:N2}) नोंदवला आहे. कर्ज बाकी असताना मुदतपूर्व ठेव मोडून परतावा घेता येत नाही; कृपया मुदतीनंतर 'नूतनीकरण (FD Renewal)' करा किंवा 'सक्रिय कर्ज खात्यात समायोजित (Adjust in Loan)' निवडा."
                });
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    // 1. Calculate actual days held (Same-day close receives minimum 1 day)
                    int actualDays = Math.Max(1, (effectiveClosureDate.Date - account.OpeningDate.Date).Days);

                    // 2. Determine premature interest rate via Tenor Slabs Resolution (RBI / MCS Co-op Rule)
                    var (prematureRate, slabRate, penaltyDeduction, matchedSlabText, isMinPeriodViolated, rateResolutionNote) =
                        ResolvePrematureRate(account, actualDays, effectiveClosureDate);

                    // 3. Recalculate interest
                    decimal recalculatedInterest = Math.Round((account.DepositAmount * prematureRate * actualDays) / 36500.0m, 2);

                    // ✍️ Manual Amount Override Support (Legacy Pre-Live Society Reconciliation)
                    if (req?.IsManualAmountOverride == true || req?.CustomAccruedInterest.HasValue == true)
                    {
                        if (string.IsNullOrWhiteSpace(req.ManualOverrideReason))
                        {
                            req.ManualOverrideReason = "थेट सेटलमेंट संपादन";
                        }
                        req.IsManualAmountOverride = true;
                        if (req.CustomAccruedInterest.HasValue)
                        {
                            recalculatedInterest = Math.Max(0m, req.CustomAccruedInterest.Value);
                        }
                    }

                    // 4. Determine ONLY genuinely verified provisioned / capitalized / MIS-paid interest
                    bool isPeriodicPayout = account.FdScheme != null &&
                        (account.FdScheme.InterestType == "MIS" || account.FdScheme.InterestType == "Monthly Interest");

                    var postingBreakdown = await Helpers.FdInterestSettlementHelper.ResolveVerifiedPostingBreakdownAsync(
                        _context, id, account.FdScheme?.InterestPayableLedgerID ?? 0);
                    decimal dbCapitalizedInt = postingBreakdown.VerifiedCapitalized;
                    decimal misPayoutSum = 0m;
                    if (isPeriodicPayout)
                    {
                        try
                        {
                            misPayoutSum = await _context.FdMisPayouts
                                .Where(p => p.FdAccountID == id && p.Status == "Success")
                                .SumAsync(p => (decimal?)p.GrossInterest) ?? 0m;
                        }
                        catch { /* table might be fresh */ }
                        decimal misTxSum = await _context.FdTransactions
                            .Where(t => t.FdAccountID == id && t.TransactionType == "MIS_Payout")
                            .SumAsync(t => (decimal?)t.Amount) ?? 0m;
                        misPayoutSum = Math.Max(misPayoutSum, misTxSum);
                    }

                    decimal verifiedProvision = isPeriodicPayout ? 0m : postingBreakdown.VerifiedProvision;
                    bool isCompoundPremature = Helpers.FdOpeningBalanceSyncHelper.IsCompoundCapitalizedScheme(account.FdScheme);

                    var allocation = Helpers.FdInterestSettlementHelper.ResolveClosureInterestAllocation(new Helpers.FdInterestAllocationRequest
                    {
                        TargetInterest = recalculatedInterest,
                        OverdueInterest = 0m,
                        VerifiedProvision = verifiedProvision,
                        VerifiedCapitalized = dbCapitalizedInt,
                        LegacyAccruedInt = isCompoundPremature ? 0m : account.LegacyAccruedInt,
                        MisPayoutSum = misPayoutSum,
                        IsPremature = true,
                        IsPeriodicPayout = isPeriodicPayout,
                        IsManualAmountOverride = req?.IsManualAmountOverride == true,
                        InterestDebitMode = req?.InterestDebitMode,
                        PostedInterestDebitAmount = req?.PostedInterestDebitAmount,
                        ExpenseInterestDebitAmount = req?.ExpenseInterestDebitAmount,
                        ReversePostedInterestAmount = req?.ReversePostedInterestAmount
                    });
                    if (!allocation.IsValid)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = allocation.ErrorMessage });
                    }

                    decimal provisionedToClear = allocation.PostedInterestDebitAmount;
                    decimal expenseInterestToDebit = allocation.ExpenseInterestDebitAmount;
                    decimal unpaidMisInterest = allocation.UnpaidMisInterest;
                    decimal penaltyClawback = allocation.ReversePostedInterestAmount;
                    decimal alreadyAccruedInt = allocation.AlreadyAccruedEffective;
                    decimal fdLiabilityDebitAmtPremature = account.DepositAmount + allocation.ClearedCapitalizedInterest;

                    // 5. Final payable calculations
                    decimal misPrincipalClawback = isPeriodicPayout
                        ? Math.Max(0m, (misPayoutSum + allocation.ClearedCapitalizedInterest) - recalculatedInterest)
                        : 0m;
                    decimal netPayoutAmount = isPeriodicPayout
                        ? (misPrincipalClawback > 0m
                            ? Math.Max(0m, account.DepositAmount - misPrincipalClawback)
                            : account.DepositAmount + unpaidMisInterest)
                        : account.DepositAmount + recalculatedInterest;

                    LoanAccount? targetLoan = null;
                    decimal loanAdjustAmount = 0m;
                    decimal surplusPayoutAmount = netPayoutAmount;

                    if (req?.AdjustInLoan == true)
                    {
                        LoanAccount? pledgedActiveLoan = !string.IsNullOrWhiteSpace(directLienLoanNo)
                            ? activeLoans.FirstOrDefault(l => string.Equals(l.LoanAccountNo, directLienLoanNo, StringComparison.OrdinalIgnoreCase))
                            : null;

                        if (pledgedActiveLoan != null && req.TargetLoanAccountID.HasValue && req.TargetLoanAccountID.Value > 0 && req.TargetLoanAccountID.Value != pledgedActiveLoan.LoanAccountID)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(new { message = $"सदर मुदत ठेव पावती कर्ज खाते क्र. '{directLienLoanNo}' साठी तारण असल्याने परतावा प्रथम त्याच कर्ज खात्यात समायोजित करणे बंधनकारक आहे." });
                        }

                        int targetLoanId = req.TargetLoanAccountID ?? (pledgedActiveLoan?.LoanAccountID ?? activeLoans.FirstOrDefault()?.LoanAccountID ?? 0);
                        if (targetLoanId == 0)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(new { message = "कृपया मुदत ठेवीची रक्कम वर्ग करण्यासाठी कर्ज खाते निवडा." });
                        }

                        targetLoan = activeLoans.FirstOrDefault(l => l.LoanAccountID == targetLoanId) 
                            ?? await _context.LoanAccounts.Include(l => l.LoanRate).FirstOrDefaultAsync(l => l.LoanAccountID == targetLoanId && l.Status == "Active");

                        if (targetLoan == null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(new { message = "निवडलेले कर्ज खाते सापडले नाही किंवा ते सक्रिय नाही." });
                        }

                        var (pendingInterest, _, _) = await CalculatePendingLoanInterestAsync(targetLoan, effectiveClosureDate);
                        decimal targetLoanTotalDue = targetLoan.PrincipalBalance + targetLoan.InterestBalance + targetLoan.OverdueInterestBalance + pendingInterest;
                        decimal maxAdjustable = Math.Min(netPayoutAmount, targetLoanTotalDue);

                        if (hasDirectLien &&
                            req.LoanAdjustmentAmount.HasValue &&
                            req.LoanAdjustmentAmount.Value + 0.01m < maxAdjustable)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(new
                            {
                                errorCode = "PARTIAL_LOAN_ADJUST_NOT_ALLOWED",
                                message = $"सदर मुदत ठेव पावतीवर कर्जाचा तारण बोजा असल्यामुळे ठेव मोडताना किमान ₹{maxAdjustable:N2} रक्कम तारण कर्जात समायोजित करणे बंधनकारक आहे. कमी रक्कम कर्जात टाकून उर्वरित रक्कम रोख/बँकेत काढता येत नाही."
                            });
                        }

                        loanAdjustAmount = req.LoanAdjustmentAmount.HasValue && req.LoanAdjustmentAmount.Value > 0
                            ? Math.Min(req.LoanAdjustmentAmount.Value, maxAdjustable)
                            : maxAdjustable;

                        surplusPayoutAmount = netPayoutAmount - loanAdjustAmount;
                    }

                    string manualAuditNote = req?.IsManualAmountOverride == true
                        ? $" [✍️ मॅन्युअल लेगसी जुळवणी: {req.ManualOverrideReason?.Trim()}]"
                        : "";

                    account.Status = "Closed";
                    account.Remarks = TruncateMax(CleanStaleClosureRemarks(account.Remarks) + 
                        (req?.AdjustInLoan == true 
                            ? $" | मुदतपूर्व बंद: {effectiveClosureDate:dd/MM/yyyy} [{rateResolutionNote}] [कर्ज वजावट: ₹{loanAdjustAmount:N2} -> कर्ज क्र: {targetLoan?.LoanAccountNo}, शिल्लक परतावा: ₹{surplusPayoutAmount:N2} ({req.SurplusPaymentMode})]"
                            : $" | मुदतपूर्व बंद: {effectiveClosureDate:dd/MM/yyyy} [{rateResolutionNote}] ({paymentMode})")
                        + manualAuditNote, 1000);
                    await _context.SaveChangesAsync();

                    var fdLiabilityLedger = await ResolveFdLiabilityLedgerAsync(account.FdScheme);
                    var (payableValid, payableLedger, payableErr) = await ResolveCustomOrDefaultLedgerAsync(
                        req?.PostedInterestDebitLedgerID,
                        () => ResolveInterestPayableLedgerAsync(account.FdScheme),
                        "POSTING_INTR / देणे व्याज");
                    if (!payableValid)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(payableErr);
                    }

                    var (expenseValid, expenseLedger, expenseErr) = await ResolveCustomOrDefaultLedgerAsync(
                        req?.ExpenseInterestDebitLedgerID,
                        () => ResolveInterestExpenseLedgerAsync(account.FdScheme),
                        "नफा-तोटा / व्याज खर्च");
                    if (!expenseValid)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(expenseErr);
                    }

                    var (clawbackValid, clawbackLedger, clawbackErr) = await ResolveCustomOrDefaultLedgerAsync(
                        req?.ReversalCreditLedgerID,
                        () => ResolveClawbackLedgerAsync(account.FdScheme),
                        "रिव्हर्सल जमा / दंड");
                    if (!clawbackValid)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(clawbackErr);
                    }

                    if (provisionedToClear > 0 && payableLedger == null)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest("मुदत ठेव देय व्याज लेजर (FD Interest Payable Ledger) सापडले नाही. कृपया मुदत ठेव योजनेत लेजर मॅपिंग तपासा.");
                    }
                    if ((isPeriodicPayout ? unpaidMisInterest > 0 : expenseInterestToDebit > 0) && expenseLedger == null)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest("मुदत ठेव व्याज खर्च लेजर (FD Interest Expense Ledger) सापडले नाही. कृपया मुदत ठेव योजनेत लेजर मॅपिंग तपासा.");
                    }
                    if (penaltyClawback > 0 && clawbackLedger == null)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest("मुदतपूर्व दंड / व्याज कपात लेजर (Premature Penalty / Clawback Ledger) सापडले नाही. कृपया मुदत ठेव योजनेत लेजर मॅपिंग तपासा.");
                    }
                    
                    if (fdLiabilityLedger == null)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest("मुदत ठेव दायित्व लेजर (FD Liability Ledger) सापडले नाही. कृपया योजनेत लेजर मॅपिंग तपासा.");
                    }

                    if (req?.AdjustInLoan == true && targetLoan != null)
                    {
                        // 1. Process Loan Settlement via Waterfall
                        var (settledLoan, loanColl, prinPaid, intPaid, penPaid) = await ProcessLoanSettlementAsync(
                            targetLoan.LoanAccountID, 
                            loanAdjustAmount, 
                            effectiveClosureDate, 
                            account.AccountNo, 
                            account.BranchID);

                        var linkedFdCollaterals = await _context.LoanDepositCollaterals
                            .Where(c => c.CollateralType == "FixedDeposit" &&
                                        c.DepositAccountID == account.FdAccountID &&
                                        c.LienStatus != "Released")
                            .ToListAsync();
                        foreach (var col in linkedFdCollaterals)
                        {
                            col.LienStatus = settledLoan.Status == "Closed" ? "Released" : "Invoked";
                            col.LienReleasedDate = effectiveClosureDate;
                            col.CurrentDepositBalance = 0m;
                        }
                        if (account.IsLienMarked)
                        {
                            account.IsLienMarked = false;
                        }
                        if (linkedFdCollaterals.Any()) await _context.SaveChangesAsync();

                        // 2. Resolve Surplus Payout Ledger (if surplus > 0)
                        string surplusMode = !string.IsNullOrWhiteSpace(req.SurplusPaymentMode) ? req.SurplusPaymentMode : "Cash";
                        int surplusLedgerId = 0;
                        if (surplusPayoutAmount > 0)
                        {
                            if (BankLedgerHelper.IsBankPaymentMode(surplusMode))
                            {
                                var surplusBankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(_context, req.SurplusBankLedgerID);
                                if (!surplusBankCheck.IsValid)
                                {
                                    await transaction.RollbackAsync();
                                    return BadRequest(surplusBankCheck.ErrorMessage);
                                }
                                surplusLedgerId = surplusBankCheck.LedgerId;
                            }
                            else if ((string.Equals(surplusMode, "Transfer", StringComparison.OrdinalIgnoreCase) || string.Equals(surplusMode, "Saving", StringComparison.OrdinalIgnoreCase) || string.Equals(surplusMode, "Saving Transfer", StringComparison.OrdinalIgnoreCase)) && (!req.SurplusSavingAccountID.HasValue || req.SurplusSavingAccountID.Value <= 0 || !await _context.SavingAccountMasters.AnyAsync(s => s.SavingAccountID == req.SurplusSavingAccountID.Value && s.Status != "Closed")))
                            {
                                await transaction.RollbackAsync();
                                return BadRequest("शिल्लक परतावा बचत खात्यात वर्ग करण्यासाठी वैध सक्रिय बचत खाते निवडणे बंधनकारक आहे.");
                            }
                            else if (!string.Equals(surplusMode, "Cash", StringComparison.OrdinalIgnoreCase) && !string.Equals(surplusMode, "Transfer", StringComparison.OrdinalIgnoreCase) && !string.Equals(surplusMode, "Saving", StringComparison.OrdinalIgnoreCase) && !string.Equals(surplusMode, "Saving Transfer", StringComparison.OrdinalIgnoreCase))
                            {
                                await transaction.RollbackAsync();
                                return BadRequest($"शिल्लक परताव्यासाठी अवैध पेमेंट पद्धत '{surplusMode}'.");
                            }
                            else if ((string.Equals(surplusMode, "Transfer", StringComparison.OrdinalIgnoreCase) || string.Equals(surplusMode, "Saving", StringComparison.OrdinalIgnoreCase) || string.Equals(surplusMode, "Saving Transfer", StringComparison.OrdinalIgnoreCase)) && req.SurplusSavingAccountID > 0)
                            {
                                var savAccount = await _context.SavingAccountMasters
                                    .Include(s => s.Ledger)
                                    .FirstOrDefaultAsync(s => s.SavingAccountID == req.SurplusSavingAccountID.Value);

                                if (savAccount != null)
                                {
                                    savAccount.CurrentBalance += surplusPayoutAmount;
                                    surplusLedgerId = await Helpers.SavingLedgerHelper.ResolveSavingLiabilityLedgerIdAsync(_context, savAccount);

                                    var savTx = new SavingTransaction
                                    {
                                        SavingAccountID = savAccount.SavingAccountID,
                                        CustomerID = savAccount.CustomerID,
                                        BranchID = account.BranchID > 0 ? account.BranchID : savAccount.BranchID,
                                        TransactionDate = effectiveClosureDate,
                                        TransactionType = "Deposit",
                                        PaymentMode = "Transfer",
                                        Amount = surplusPayoutAmount,
                                        BalanceAfterTxn = savAccount.CurrentBalance,
                                        Narration = $"मुदत ठेव मुदतपूर्व परतावा जमा (FD Premature Surplus): {account.AccountNo}",
                                        VoucherNo = $"JV-FD-PRECLOSE-{account.AccountNo}",
                                        CreatedBy = 1,
                                        CreatedOn = DateTime.Now
                                    };
                                    _context.SavingTransactions.Add(savTx);
                                }
                                else
                                {
                                    surplusLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, account.BranchID, "FD");
                                }
                            }
                            else
                            {
                                surplusLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, account.BranchID, "FD");
                            }
                        }

                        // 3. Create Compound Journal Voucher
                        var voucher = new Voucher
                        {
                            BranchID = account.BranchID,
                            VoucherNo = $"JV-FD-PRECLOSE-{account.AccountNo}",
                            VoucherDate = effectiveClosureDate,
                            VoucherType = "Journal",
                            TotalAmount = netPayoutAmount,
                            Narration = (string.IsNullOrWhiteSpace(req?.Narration)
                                ? $"मुदतपूर्व बंद व कर्ज वजावट (FD Premature & Loan Set-Off): {account.AccountNo} -> कर्ज: {settledLoan.LoanAccountNo} (कर्ज जमा: ₹{loanAdjustAmount:N2}, शिल्लक परतावा: ₹{surplusPayoutAmount:N2} {surplusMode})"
                                : req.Narration) + manualAuditNote,
                            CreatedBy = 1,
                            CreatedOn = DateTime.Now
                        };
                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();
                        loanColl.VoucherID = voucher.VoucherID;

                        // Dr FD Liability (Principal + any capitalized interest)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = fdLiabilityLedger.LedgerID, DrCr = "Dr", Amount = fdLiabilityDebitAmtPremature, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                        if (isPeriodicPayout)
                        {
                            // In MIS:
                            if (provisionedToClear > 0 && payableLedger != null)
                            {
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = provisionedToClear, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            }
                            if (unpaidMisInterest > 0 && expenseLedger != null)
                            {
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = expenseLedger.LedgerID, DrCr = "Dr", Amount = unpaidMisInterest, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            }
                            // Cr Clawback Income / Recovery
                            if (penaltyClawback > 0 && clawbackLedger != null)
                            {
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = clawbackLedger.LedgerID, DrCr = "Cr", Amount = penaltyClawback, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            }
                        }
                        else
                        {
                            // In Cumulative / Simple / On Interest FD:
                            Helpers.FdInterestSettlementHelper.AppendInterestAllocationVoucherDetails(
                                _context,
                                voucher.VoucherID,
                                account.CustomerID,
                                linkedMemberId,
                                allocation,
                                payableLedger,
                                expenseLedger,
                                clawbackLedger);
                        }

                        // Cr Loan Ledgers
                        var loanRate = settledLoan.LoanRate ?? await _context.LoanRates.FindAsync(settledLoan.LoanRateID);
                        int loanLedgerId = loanRate?.LoanLedgerID ?? 0;
                        int loanInterestLedgerId = loanRate?.InterestLedgerID ?? 0;
                        int loanOverdueLedgerId = (loanRate?.OverdueInterestLedgerID ?? 0) > 0 ? loanRate!.OverdueInterestLedgerID!.Value : loanInterestLedgerId;

                        if (prinPaid > 0)
                        {
                            if (loanLedgerId <= 0)
                            {
                                return BadRequest("कर्ज योजनेचे मुद्दल लेजर (Loan Principal Ledger) मॅप केलेले नाही.");
                            }
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = loanLedgerId, DrCr = "Cr", Amount = prinPaid, CustomerID = settledLoan.CustomerID, MemberID = settledLoan.MemberID });
                        }
                        if (intPaid > 0)
                        {
                            if (loanInterestLedgerId <= 0)
                            {
                                return BadRequest("कर्ज योजनेचे व्याज लेजर (Loan Interest Ledger) मॅप केलेले नाही.");
                            }
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = loanInterestLedgerId, DrCr = "Cr", Amount = intPaid, CustomerID = settledLoan.CustomerID, MemberID = settledLoan.MemberID });
                        }
                        if (penPaid > 0)
                        {
                            if (loanOverdueLedgerId <= 0)
                            {
                                return BadRequest("कर्ज योजनेचे दंड व्याज लेजर (Loan Overdue Interest Ledger) मॅप केलेले नाही.");
                            }
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = loanOverdueLedgerId, DrCr = "Cr", Amount = penPaid, CustomerID = settledLoan.CustomerID, MemberID = settledLoan.MemberID });
                        }

                        // Cr Surplus Payout Ledger (if surplus > 0)
                        if (surplusPayoutAmount > 0 && surplusLedgerId > 0)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = surplusLedgerId, DrCr = "Cr", Amount = surplusPayoutAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        }

                        // Log Close Transaction
                        var tx = new FdTransaction
                        {
                            BranchID = account.BranchID,
                            FdAccountID = account.FdAccountID,
                            VoucherID = voucher.VoucherID,
                            TransactionDate = effectiveClosureDate,
                            TransactionType = "Premature_Close",
                            DebitCredit = "Dr",
                            Amount = netPayoutAmount
                        };
                        _context.FdTransactions.Add(tx);
                        if (tx.TransactionType == "Premature_Close" && tx.VoucherID > 0)
                        {
                            await Helpers.VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, tx.VoucherID);
                        }

                        await _context.SaveChangesAsync();
                        await transaction.CommitAsync();

                        return Ok(new
                        {
                            Message = $"मुदतपूर्व बंद करून कर्ज खात्यात ₹{loanAdjustAmount:N2} वर्ग करण्यात आले." + (surplusPayoutAmount > 0 ? $" शिल्लक रक्कम ₹{surplusPayoutAmount:N2} ({surplusMode}) अदा केली." : ""),
                            ActualDays = actualDays,
                            ContractedRate = account.InterestRate,
                            MatchedSlab = matchedSlabText,
                            SlabRate = slabRate,
                            PenaltyRate = penaltyDeduction,
                            PrematureRate = prematureRate,
                            RecalcInt = recalculatedInterest,
                            Clawback = penaltyClawback,
                            NetPayout = netPayoutAmount,
                            LoanAdjusted = loanAdjustAmount,
                            SurplusPaid = surplusPayoutAmount,
                            LoanAccountNo = settledLoan.LoanAccountNo,
                            RemainingLoanBalance = settledLoan.PrincipalBalance + settledLoan.InterestBalance + settledLoan.OverdueInterestBalance,
                            ResolutionNote = rateResolutionNote
                        });
                    }
                    else
                    {
                        // Standard Non-Loan Closure
                        int payoutLedgerId = 0;
                        if (BankLedgerHelper.IsBankPaymentMode(paymentMode))
                        {
                            var payoutBankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(_context, req?.BankAccountLedgerID);
                            if (!payoutBankCheck.IsValid)
                            {
                                await transaction.RollbackAsync();
                                return BadRequest(payoutBankCheck.ErrorMessage);
                            }
                            payoutLedgerId = payoutBankCheck.LedgerId;
                        }
                        else if ((string.Equals(paymentMode, "Transfer", StringComparison.OrdinalIgnoreCase) || string.Equals(paymentMode, "Saving", StringComparison.OrdinalIgnoreCase) || string.Equals(paymentMode, "Saving Transfer", StringComparison.OrdinalIgnoreCase)) && (req?.SavingAccountID == null || req.SavingAccountID <= 0 || !await _context.SavingAccountMasters.AnyAsync(s => s.SavingAccountID == req.SavingAccountID.Value && s.Status != "Closed")))
                        {
                            await transaction.RollbackAsync();
                            return BadRequest("मुदत ठेव परतावा बचत खात्यात वर्ग करण्यासाठी वैध सक्रिय बचत खाते निवडणे बंधनकारक आहे.");
                        }
                        else if (!string.Equals(paymentMode, "Cash", StringComparison.OrdinalIgnoreCase) && !string.Equals(paymentMode, "Transfer", StringComparison.OrdinalIgnoreCase) && !string.Equals(paymentMode, "Saving", StringComparison.OrdinalIgnoreCase) && !string.Equals(paymentMode, "Saving Transfer", StringComparison.OrdinalIgnoreCase))
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"परताव्यासाठी अवैध पेमेंट पद्धत '{paymentMode}'.");
                        }
                        else if ((string.Equals(paymentMode, "Transfer", StringComparison.OrdinalIgnoreCase) || string.Equals(paymentMode, "Saving", StringComparison.OrdinalIgnoreCase) || string.Equals(paymentMode, "Saving Transfer", StringComparison.OrdinalIgnoreCase)) && req?.SavingAccountID > 0)
                        {
                            var savAccount = await _context.SavingAccountMasters
                                .Include(s => s.Ledger)
                                .FirstOrDefaultAsync(s => s.SavingAccountID == req.SavingAccountID.Value);

                            if (savAccount != null)
                            {
                                savAccount.CurrentBalance += netPayoutAmount;
                                payoutLedgerId = await Helpers.SavingLedgerHelper.ResolveSavingLiabilityLedgerIdAsync(_context, savAccount);

                                var savTx = new SavingTransaction
                                {
                                    SavingAccountID = savAccount.SavingAccountID,
                                    CustomerID = savAccount.CustomerID,
                                    BranchID = account.BranchID > 0 ? account.BranchID : savAccount.BranchID,
                                    TransactionDate = effectiveClosureDate,
                                    TransactionType = "Deposit",
                                    PaymentMode = "Transfer",
                                    Amount = netPayoutAmount,
                                    BalanceAfterTxn = savAccount.CurrentBalance,
                                    Narration = $"मुदत ठेव मुदतपूर्व परतावा जमा (FD Premature Payout): {account.AccountNo}",
                                    VoucherNo = $"JV-FD-PRECLOSE-{account.AccountNo}",
                                    CreatedBy = 1,
                                    CreatedOn = DateTime.Now
                                };
                                _context.SavingTransactions.Add(savTx);
                            }
                            else
                            {
                                payoutLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, operatingBranchId, "FD");
                            }
                        }
                        else
                        {
                            payoutLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, operatingBranchId, "FD");
                        }

                        var payoutLedger = await _context.Ledgers.FindAsync(payoutLedgerId);
                        if (payoutLedger == null)
                        {
                            return BadRequest("Required payout ledger not found.");
                        }

                        int finalVoucherId;

                        if (!isCrossBranchTxn)
                        {
                            // Standard Single-Branch Voucher
                            var voucher = new Voucher
                            {
                                BranchID = account.BranchID,
                                VoucherNo = $"JV-FD-PRECLOSE-{account.AccountNo}",
                                VoucherDate = effectiveClosureDate,
                                VoucherType = (string.Equals(paymentMode, "Cash", StringComparison.OrdinalIgnoreCase) || Helpers.BankLedgerHelper.IsBankPaymentMode(paymentMode)) ? "Payment" : "Journal",
                                TotalAmount = netPayoutAmount,
                                Narration = (string.IsNullOrWhiteSpace(req?.Narration)
                                    ? $"मुदतपूर्व बंद (Premature Close - {paymentMode}) - कालावधी: {actualDays} दिवस{(effectiveClosureDate.Date < activeBusinessDate.Date ? $" ({effectiveClosureDate:dd/MM/yyyy} As-on)" : "")}, पुनर्हिशोब व्याज: ₹{recalculatedInterest}, दंड कपात: ₹{penaltyClawback}{(paymentMode == "Bank" && !string.IsNullOrEmpty(req?.ChequeNo) ? $" Cheque: {req.ChequeNo}" : "")}"
                                    : req.Narration) + manualAuditNote,
                                CreatedBy = 1,
                                CreatedOn = DateTime.Now
                            };
                            _context.Vouchers.Add(voucher);
                            await _context.SaveChangesAsync();

                            // Dr FD Liability (Principal + any capitalized interest)
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = fdLiabilityLedger.LedgerID, DrCr = "Dr", Amount = fdLiabilityDebitAmtPremature, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                            if (isPeriodicPayout)
                            {
                                // In MIS: Periodic cash payouts already took place, unless manual POSTING_INTR reversal is added.
                                if (provisionedToClear > 0 && payableLedger != null)
                                {
                                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = provisionedToClear, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                                }
                                // Cr Payout Ledger (Net payout)
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payoutLedger.LedgerID, DrCr = "Cr", Amount = netPayoutAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                                // Cr Clawback Income / Recovery
                                if (penaltyClawback > 0 && clawbackLedger != null)
                                {
                                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = clawbackLedger.LedgerID, DrCr = "Cr", Amount = penaltyClawback, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                                }
                            }
                            else
                            {
                                // In Cumulative / Simple / On Interest FD:
                                Helpers.FdInterestSettlementHelper.AppendInterestAllocationVoucherDetails(
                                    _context,
                                    voucher.VoucherID,
                                    account.CustomerID,
                                    linkedMemberId,
                                    allocation,
                                    payableLedger,
                                    expenseLedger,
                                    clawbackLedger);

                                // Cr Payout Ledger (Net payout = Principal + recalculatedInterest)
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payoutLedger.LedgerID, DrCr = "Cr", Amount = netPayoutAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            }

                            finalVoucherId = voucher.VoucherID;
                        }
                        else
                        {
                            // CBS Dual-Voucher IBT Engine for Cross-Branch FD Premature Close
                            int counterBranchId = operatingBranchId;
                            int homeBranchId = account.BranchID;
                            var (counterIbtLedgerId, homeIbtLedgerId) = await Helpers.IbtLedgerHelper.GetDirectionalPairIbtLedgerIdsAsync(_context, counterBranchId, homeBranchId);

                            // 1. Counter Voucher (Branch A, Payment): Dr IBT, Cr Cash/Payout Ledger
                            var counterVoucher = new Voucher
                            {
                                BranchID = counterBranchId,
                                VoucherNo = $"PV-{counterBranchId}-{effectiveClosureDate:yyyyMMdd}-FD-PRECLOSE-{account.AccountNo}",
                                VoucherDate = effectiveClosureDate,
                                VoucherType = (string.Equals(paymentMode, "Cash", StringComparison.OrdinalIgnoreCase) || Helpers.BankLedgerHelper.IsBankPaymentMode(paymentMode)) ? "Payment" : "Journal",
                                TotalAmount = netPayoutAmount,
                                Narration = (string.IsNullOrWhiteSpace(req?.Narration)
                                    ? $"[आंतर-शाखा मुदत ठेव मुदतपूर्व परतावा] खाते: {account.AccountNo} (मूळ शाखा #{homeBranchId}) साठी काऊंटरवर रोख परतावा अदा"
                                    : $"[आंतर-शाखा मुदत ठेव मुदतपूर्व परतावा] {req.Narration}") + manualAuditNote,
                                CreatedBy = 1,
                                CreatedOn = DateTime.Now,
                                IsIbtVoucher = true,
                                TargetBranchID = homeBranchId
                            };
                            _context.Vouchers.Add(counterVoucher);
                            await _context.SaveChangesAsync();

                            // Dr IBT
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = counterVoucher.VoucherID, LedgerID = counterIbtLedgerId, DrCr = "Dr", Amount = netPayoutAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            // Cr Cash
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = counterVoucher.VoucherID, LedgerID = payoutLedger.LedgerID, DrCr = "Cr", Amount = netPayoutAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                            // 2. Home Branch Voucher (Branch B, Journal): Dr FD Liability, Dr Payable, Dr Expense, Cr Clawback, Cr IBT
                            var homeVoucher = new Voucher
                            {
                                BranchID = homeBranchId,
                                VoucherNo = $"JV-FD-PRECLOSE-{account.AccountNo}",
                                VoucherDate = effectiveClosureDate,
                                VoucherType = "Journal",
                                TotalAmount = netPayoutAmount,
                                Narration = (string.IsNullOrWhiteSpace(req?.Narration)
                                    ? $"[आंतर-शाखा मुदत ठेव मुदतपूर्व बंद] काऊंटर शाखा #{counterBranchId} वरून परतावा अदा (खाते: {account.AccountNo})"
                                    : $"[आंतर-शाखा मुदत ठेव मुदतपूर्व बंद] {req.Narration}") + manualAuditNote,
                                CreatedBy = 1,
                                CreatedOn = DateTime.Now,
                                IsIbtVoucher = true,
                                TargetBranchID = counterBranchId,
                                RelatedVoucherID = counterVoucher.VoucherID
                            };
                            _context.Vouchers.Add(homeVoucher);
                            await _context.SaveChangesAsync();

                            counterVoucher.RelatedVoucherID = homeVoucher.VoucherID;

                            // Dr FD Liability (Principal + any capitalized interest)
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = fdLiabilityLedger.LedgerID, DrCr = "Dr", Amount = fdLiabilityDebitAmtPremature, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                            if (isPeriodicPayout)
                            {
                                if (provisionedToClear > 0 && payableLedger != null)
                                {
                                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = provisionedToClear, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                                }
                                // Cr IBT Ledger
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = homeIbtLedgerId, DrCr = "Cr", Amount = netPayoutAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });

                                // Cr Clawback Income / Recovery
                                if (penaltyClawback > 0 && clawbackLedger != null)
                                {
                                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = clawbackLedger.LedgerID, DrCr = "Cr", Amount = penaltyClawback, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                                }
                            }
                            else
                            {
                                Helpers.FdInterestSettlementHelper.AppendInterestAllocationVoucherDetails(
                                    _context,
                                    homeVoucher.VoucherID,
                                    account.CustomerID,
                                    linkedMemberId,
                                    allocation,
                                    payableLedger,
                                    expenseLedger,
                                    clawbackLedger);

                                // Cr IBT Ledger
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = homeVoucher.VoucherID, LedgerID = homeIbtLedgerId, DrCr = "Cr", Amount = netPayoutAmount, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                            }

                            finalVoucherId = counterVoucher.VoucherID;
                        }

                        int targetMisExpenseVoucherId = isCrossBranchTxn
                            ? (_context.Vouchers.Local.FirstOrDefault(v => v.VoucherID == finalVoucherId)?.RelatedVoucherID ?? finalVoucherId)
                            : finalVoucherId;
                        if (isPeriodicPayout && unpaidMisInterest > 0 && expenseLedger != null)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = targetMisExpenseVoucherId, LedgerID = expenseLedger.LedgerID, DrCr = "Dr", Amount = unpaidMisInterest, CustomerID = account.CustomerID, MemberID = linkedMemberId });
                        }
                        await Helpers.VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, finalVoucherId);
                        if (isCrossBranchTxn && targetMisExpenseVoucherId != finalVoucherId)
                        {
                            await Helpers.VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, targetMisExpenseVoucherId);
                        }
                        // Log Closure Interest (Cr) with distinct TransactionType = "Closure_Interest" (never "Accrual" provision)
                        if (recalculatedInterest > 0)
                        {
                            var intTx = new FdTransaction
                            {
                                BranchID = isCrossBranchTxn ? operatingBranchId : account.BranchID,
                                FdAccountID = account.FdAccountID,
                                VoucherID = finalVoucherId,
                                TransactionDate = effectiveClosureDate,
                                TransactionType = "Closure_Interest",
                                DebitCredit = "Cr",
                                Amount = recalculatedInterest
                            };
                            _context.FdTransactions.Add(intTx);
                        }

                        // Log Close Transaction
                        var tx = new FdTransaction
                        {
                            BranchID = isCrossBranchTxn ? operatingBranchId : account.BranchID,
                            FdAccountID = account.FdAccountID,
                            VoucherID = finalVoucherId,
                            TransactionDate = effectiveClosureDate,
                            TransactionType = "Premature_Close",
                            DebitCredit = "Dr",
                            Amount = netPayoutAmount
                        };
                        _context.FdTransactions.Add(tx);
                        if (tx.TransactionType == "Premature_Close" && tx.VoucherID > 0)
                        {
                            await Helpers.VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, tx.VoucherID);
                        }

                        await _context.SaveChangesAsync();
                        await transaction.CommitAsync();
                        return Ok(new
                        {
                            Message = $"FD Prematurely Closed ({paymentMode})",
                            ActualDays = actualDays,
                            ContractedRate = account.InterestRate,
                            MatchedSlab = matchedSlabText,
                            SlabRate = slabRate,
                            PenaltyRate = penaltyDeduction,
                            PrematureRate = prematureRate,
                            RecalcInt = recalculatedInterest,
                            Clawback = penaltyClawback,
                            NetPayout = netPayoutAmount,
                            ResolutionNote = rateResolutionNote
                        });
                    }
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("Failed to premature close: " + GetDeepestErrorMessage(ex));
                }
            }
        }

        // POST: api/FdAccounts/5/Renew
        [HttpPost("{id}/Renew")]
        public async Task<IActionResult> Renew(int id, [FromBody] FdRenewalRequest request)
        {
            // Self-heal any orphaned renewal state on this account before validation (e.g. half-deleted prior renewal)
            await HealOrphanedRenewalsInternalAsync(id);

            var oldAccount = await _context.FdAccounts
                .Include(a => a.FdScheme)
                .ThenInclude(s => s!.FdLiabilityLedger)
                .Include(a => a.FdScheme)
                .ThenInclude(s => s!.InterestPayableLedger)
                .Include(a => a.FdScheme)
                .ThenInclude(s => s!.InterestExpenseLedger)
                .FirstOrDefaultAsync(a => a.FdAccountID == id);

            if (oldAccount == null || (oldAccount.Status != "Active" && oldAccount.Status != "Matured"))
            {
                return BadRequest("जुने मुदत ठेव खाते सक्रिय (Active) किंवा मुदतपूर्ण (Matured) नाही किंवा यापूर्वीच बंद/नूतनीकरण करण्यात आलेले आहे.");
            }

            // Multi-branch Security: Restrict renewal to Account's Home Branch or Head Office
            int userBranchId = User.GetOperatingBranchId();
            bool isHO = User.IsHeadOfficeAdmin();

            if (!isHO && userBranchId > 0 && oldAccount.BranchID != userBranchId)
            {
                return BadRequest($"मुदत ठेव खाते नूतनीकरण करण्याची प्रक्रिया फक्त खात्याच्या मूळ शाखेत (Home Branch #{oldAccount.BranchID}) किंवा मुख्य कार्यालयातूनच (HO) करता येते.");
            }

            var scheme = await _context.FdSchemes
                .Include(s => s.FdLiabilityLedger)
                .Include(s => s.Slabs)
                .FirstOrDefaultAsync(s => s.FdSchemeID == request.TargetSchemeID);

            if (scheme == null)
            {
                return BadRequest("Target Scheme not found.");
            }

            if (request.CustomInterestRate.HasValue)
            {
                decimal preCheckRate = Math.Round(request.CustomInterestRate.Value, 2, MidpointRounding.AwayFromZero);
                if (preCheckRate <= 0m || preCheckRate > 30m)
                {
                    return BadRequest("नवीन मुदत ठेवीचा व्याजदर ०.०१% ते ३०% दरम्यान असणे आवश्यक आहे.");
                }
            }

            int operatingBranchId = userBranchId > 0 ? userBranchId : (oldAccount.BranchID > 0 ? oldAccount.BranchID : 1);
            DateTime activeBusinessDate = await ResolveActiveBusinessDateAsync(operatingBranchId);
            DateTime closureDate = request.ClosureDate ?? activeBusinessDate;
            if (closureDate.Date < oldAccount.OpeningDate.Date)
            {
                return BadRequest($"अवैध नूतनीकरण तारीख! नूतनीकरणाची तारीख ({closureDate:dd/MM/yyyy}) ही जुने मुदत ठेव खाते उघडल्याच्या तारखेपेक्षा ({oldAccount.OpeningDate:dd/MM/yyyy}) आधीची असू शकत नाही.");
            }
            if (closureDate.Date > DateTime.Today)
            {
                return BadRequest($"अवैध नूतनीकरण तारीख! भविष्यातील तारीख ({closureDate:dd/MM/yyyy}) अनुज्ञेय नाही. नूतनीकरण आजच्या किंवा मागील तारखेलाच केले जाऊ शकते.");
            }

            // 🛡️ मुदतपूर्व नूतनीकरण गार्ड (Premature Renewal Guard)
            if (closureDate.Date < oldAccount.MaturityDate.Date)
            {
                return BadRequest($"अवैध नूतनीकरण विनंती! सदर मुदत ठेव पावती अद्याप मुदतपूर्ण (Matured) झालेली नाही. या खात्याची मुदतपूर्ती तारीख {oldAccount.MaturityDate:dd/MM/yyyy} आहे (उर्वरित कालावधी: {(oldAccount.MaturityDate.Date - closureDate.Date).Days} दिवस). मुदतीआधी नूतनीकरण अनुज्ञेय नाही. ठेव बंद करायची असल्यास 'मुदतपूर्व बंद' पर्याय वापरा.");
            }

            var closedFy = await _context.FinancialYears
                .FirstOrDefaultAsync(fy => fy.IsClosed && closureDate.Date >= fy.StartDate.Date && closureDate.Date <= fy.EndDate.Date);
            if (closedFy != null)
            {
                return BadRequest($"अवैध नूतनीकरण तारीख! निवडलेली तारीख ({closureDate:dd/MM/yyyy}) ही बंद/ऑडिट झालेल्या आर्थिक वर्षात ({closedFy.YearCode}) मोडते. बंद आर्थिक वर्षात थेट व्हाउचर पोस्ट करणे वैधानिक लेखापरीक्षण नियमांनुसार (MCS Act) प्रतिबंधित आहे.");
            }

            DateTime? lastAccrualDate = oldAccount.LastInterestPostingDate;
            if (!lastAccrualDate.HasValue)
            {
                lastAccrualDate = await _context.FdInterestAccruals
                    .Where(a => a.FdAccountID == oldAccount.FdAccountID && a.IsPosted)
                    .OrderByDescending(a => a.AccrualDate)
                    .Select(a => (DateTime?)a.AccrualDate)
                    .FirstOrDefaultAsync();
            }
            if (!lastAccrualDate.HasValue)
            {
                lastAccrualDate = await _context.FdTransactions
                    .Where(t => t.FdAccountID == oldAccount.FdAccountID && t.TransactionType == "Accrual")
                    .OrderByDescending(t => t.TransactionDate)
                    .Select(t => (DateTime?)t.TransactionDate)
                    .FirstOrDefaultAsync();
            }

            if (lastAccrualDate.HasValue && closureDate.Date < lastAccrualDate.Value.Date)
            {
                return BadRequest($"अवैध नूतनीकरण तारीख! या जुन्या मुदत ठेव खात्यावर {lastAccrualDate.Value:dd/MM/yyyy} रोजी व्याज तरतूद (Interest Accrual) झालेली आहे. नूतनीकरणाची तारीख शेवटच्या व्याज तरतुदीच्या तारखेपेक्षा ({lastAccrualDate.Value:dd/MM/yyyy}) आधीची असू शकत नाही, अन्यथा देणे व्याज खात्यात (Interest Payable) अनैसर्गिक निगेटिव्ह (Debit) शिल्लक निर्माण होईल.");
            }

            if (request.RenewalType == "PrincipalOnly" && request.PaymentMode == "Transfer" && request.SavingAccountID.HasValue && request.SavingAccountID.Value > 0)
            {
                if (closureDate.Date < activeBusinessDate.Date)
                {
                    return BadRequest($"अवैध नूतनीकरण तारीख! मुदत ठेवीचे व्याज बचत खात्यात (Saving Account Transfer) वर्ग करताना मागील तारीख ({closureDate:dd/MM/yyyy}) अनुज्ञेय नाही. पासबुकमधील रनिंग शिल्लक विस्कळीत होणे टाळण्यासाठी आणि एसएमएस ताळमेळ राखण्यासाठी बचत खात्यातील हस्तांतरण चालू व्यवसाय तारखेने ({activeBusinessDate:dd/MM/yyyy}) होणे आवश्यक आहे.");
                }
                var targetSav = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.SavingAccountID == request.SavingAccountID.Value);
                if (targetSav == null || targetSav.Status != "Active")
                {
                    return BadRequest($"निवडलेले बचत खाते ({targetSav?.AccountNo ?? "अज्ञात"}) सापडले नाही किंवा ते सक्रिय (Active) नाही. बंद किंवा निष्क्रिय बचत खात्यात रक्कम वर्ग करता येत नाही.");
                }
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    // 1. Calculate Old Interest
                    var accruedFromTx = await _context.FdTransactions
                        .Where(t => t.FdAccountID == id && t.TransactionType == "Accrual")
                        .SumAsync(t => t.Amount);

                    bool isOldPeriodicScheme = oldAccount.FdScheme != null && 
                        (oldAccount.FdScheme.InterestType == "MIS" || oldAccount.FdScheme.InterestType == "Monthly Interest");

                    decimal accruedInt = isOldPeriodicScheme
                        ? 0m
                        : ((oldAccount.MaturityAmount > oldAccount.DepositAmount)
                            ? (oldAccount.MaturityAmount - oldAccount.DepositAmount)
                            : Math.Max(accruedFromTx, oldAccount.LegacyAccruedInt));

                    DateTime newOpeningDate = closureDate;
                    decimal overdueInterest = 0m;
                    int overdueDays = 0;

                    bool isOverdue = closureDate.Date > oldAccount.MaturityDate.Date;
                    bool isSchemeOverdueAllowed = oldAccount.FdScheme?.AllowOverdueInterest ?? false;

                    if (isOverdue && request.RenewalEffectiveFrom == "MaturityDate")
                    {
                        // Retroactive renewal: new deposit starts from original maturity date
                        newOpeningDate = oldAccount.MaturityDate.Date;
                        overdueInterest = 0m;
                    }
                    else if (isOverdue && isSchemeOverdueAllowed && request.ApplyOverdueInterest)
                    {
                        // Renewing from closure date with overdue interest for the gap
                        overdueDays = (closureDate.Date - oldAccount.MaturityDate.Date).Days;
                        decimal overdueRate = oldAccount.FdScheme?.OverdueInterestRate ?? request.OverdueInterestRate ?? 3.00m;
                        // CBS Banking Rule: Overdue interest is strictly calculated on Principal (DepositAmount)
                        overdueInterest = Math.Round((oldAccount.DepositAmount * overdueRate * overdueDays) / 36500.0m, 2);
                    }

                    // ✍️ Manual Amount Override Support (Legacy Pre-Live Society Reconciliation)
                    if (request.IsManualAmountOverride || request.CustomAccruedInterest.HasValue || request.CustomOverdueInterest.HasValue)
                    {
                        if (string.IsNullOrWhiteSpace(request.ManualOverrideReason))
                        {
                            request.ManualOverrideReason = "थेट सेटलमेंट संपादन";
                        }
                        request.IsManualAmountOverride = true;
                        if (request.CustomAccruedInterest.HasValue)
                        {
                            accruedInt = Math.Max(0m, request.CustomAccruedInterest.Value);
                        }
                        if (request.CustomOverdueInterest.HasValue)
                        {
                            overdueInterest = Math.Max(0m, request.CustomOverdueInterest.Value);
                        }
                    }

                    string manualAuditNote = request.IsManualAmountOverride
                        ? $" [✍️ मॅन्युअल लेगसी जुळवणी: {request.ManualOverrideReason?.Trim()}]"
                        : "";

                    decimal totalMaturityAmount = oldAccount.DepositAmount + accruedInt + overdueInterest;
                    decimal newDepositAmount = request.RenewalType == "PrincipalOnly" ? oldAccount.DepositAmount : totalMaturityAmount;
                    decimal interestPayoutAmount = request.RenewalType == "PrincipalOnly" ? (accruedInt + overdueInterest) : 0m;
                    string paymentMode = string.IsNullOrWhiteSpace(request.PaymentMode) ? "Cash" : request.PaymentMode;

                    // नियम: खातेदाराकडे सक्रिय/थकीत कर्ज किंवा पावतीवर तारण बोजा असला तरी नूतनीकरण (मुद्दल + व्याज किंवा फक्त मुद्दल) नेहमी अनुज्ञेय राहील.
                    // पावतीवर तारण बोजा (Lien / Collateral) असल्यास तो नवीन पावतीवर स्वयंचलित पुढे नेला जाईल (Lien Carry-Forward).
                    var activeCollateralsToCarry = await _context.LoanDepositCollaterals
                        .Where(c => c.CollateralType == "FixedDeposit" &&
                                    c.DepositAccountID == oldAccount.FdAccountID &&
                                    c.LienStatus != "Released")
                        .ToListAsync();

                    string oldAccNoForLien = oldAccount.AccountNo ?? string.Empty;
                    var securityLoansToCarry = !string.IsNullOrWhiteSpace(oldAccNoForLien)
                        ? await _context.LoanAccounts
                            .Where(l => l.Status == "Active" && l.SecurityDetails != null && l.SecurityDetails.Contains(oldAccNoForLien))
                            .ToListAsync()
                        : new List<LoanAccount>();

                    bool carryForwardLien = oldAccount.IsLienMarked || activeCollateralsToCarry.Any() || securityLoansToCarry.Any();
                    string? resolvedCarryLoanNo = oldAccount.LienLoanAccountNo;
                    if (string.IsNullOrWhiteSpace(resolvedCarryLoanNo))
                    {
                        resolvedCarryLoanNo = securityLoansToCarry.FirstOrDefault()?.LoanAccountNo;
                    }
                    if (string.IsNullOrWhiteSpace(resolvedCarryLoanNo) && activeCollateralsToCarry.Any(c => c.LoanAccountID.HasValue && c.LoanAccountID.Value > 0))
                    {
                        int firstColLoanId = activeCollateralsToCarry.First(c => c.LoanAccountID.HasValue && c.LoanAccountID.Value > 0).LoanAccountID!.Value;
                        resolvedCarryLoanNo = await _context.LoanAccounts
                            .Where(l => l.LoanAccountID == firstColLoanId)
                            .Select(l => l.LoanAccountNo)
                            .FirstOrDefaultAsync();
                    }

                    decimal? resolvedCarryLienAmt = oldAccount.LienAmount;
                    if ((!resolvedCarryLienAmt.HasValue || resolvedCarryLienAmt.Value <= 0m) && carryForwardLien)
                    {
                        decimal colMax = activeCollateralsToCarry.Any() ? activeCollateralsToCarry.Max(c => c.LienAmount) : 0m;
                        resolvedCarryLienAmt = colMax > 0m ? colMax : oldAccount.DepositAmount;
                    }

                    // Mark Old Account as Renewed (retains distinct audit status vs cash/maturity Closed)
                    string oldEffectiveReceipt = Helpers.FdRenewalPolicyHelper.GetEffectiveReceiptNo(oldAccount);
                    var (parentFdId, rootFdId, nextCycleNo) = Helpers.FdRenewalPolicyHelper.ComputeRenewalChainMetadata(oldAccount);
                    if (!oldAccount.RootFdAccountID.HasValue || oldAccount.RootFdAccountID.Value <= 0)
                    {
                        oldAccount.RootFdAccountID = rootFdId;
                    }
                    if (string.IsNullOrWhiteSpace(oldAccount.ReceiptNo))
                    {
                        oldAccount.ReceiptNo = oldEffectiveReceipt;
                    }

                    // 2. Generate Standardized 14-Digit CBS Account Number (sequence-synced & duplicate-safe)
                    var (rawNewAccountNo, formattedNewAccountNo, _) = await GenerateNextFdAccountNoAsync(
                        oldAccount.BranchID,
                        request.TargetSchemeID,
                        incrementSequence: true);

                    var resolvedReceipt = await Helpers.FdRenewalPolicyHelper.ResolveRenewalReceiptNumbersAsync(
                        _context,
                        oldAccount,
                        request.TargetSchemeID,
                        rawNewAccountNo,
                        formattedNewAccountNo,
                        request.ReceiptNoMode,
                        request.CustomReceiptNo);

                    if (!string.IsNullOrEmpty(resolvedReceipt.ValidationError))
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(resolvedReceipt.ValidationError);
                    }

                    // Determine correct Financial Year corresponding to new deposit opening date (strict zero-fallback)
                    int targetFinancialYearId = await ResolveMatchingFinancialYearIdAsync(newOpeningDate);

                    // 🛡️ कालावधी प्रकार व मूल्य निश्चिती (Days, Months, Years Support)
                    string durType = !string.IsNullOrWhiteSpace(request.DurationType)
                        ? request.DurationType
                        : (!string.IsNullOrWhiteSpace(scheme.DurationType) ? scheme.DurationType : "Months");

                    int durVal = request.DurationValue.HasValue && request.DurationValue.Value > 0
                        ? request.DurationValue.Value
                        : (scheme.DurationMonths > 0 ? scheme.DurationMonths : 12);

                    DateTime maturityDate;
                    int totalDays;
                    if (durType.Equals("Days", StringComparison.OrdinalIgnoreCase))
                    {
                        totalDays = durVal;
                        maturityDate = newOpeningDate.AddDays(totalDays);
                    }
                    else if (durType.Equals("Years", StringComparison.OrdinalIgnoreCase))
                    {
                        maturityDate = newOpeningDate.AddYears(durVal);
                        totalDays = (int)(maturityDate - newOpeningDate).TotalDays;
                    }
                    else
                    {
                        maturityDate = newOpeningDate.AddMonths(durVal);
                        totalDays = (int)(maturityDate - newOpeningDate).TotalDays;
                    }

                    // Determine customer senior citizen status (exact 60th birthday check)
                    var customer = await _context.Customers.FindAsync(oldAccount.CustomerID);
                    bool isSenior = customer?.BirthDate.HasValue == true && (customer.BirthDate.Value.Date <= newOpeningDate.Date.AddYears(-60));

                    // Resolve Interest Rate based on Slabs or Scheme fixed rate, with optional direct manual edit
                    decimal schemeDefaultRate;
                    if (scheme.SchemeDurationModel == "Slab")
                    {
                        var matchedSlab = scheme.Slabs?.FirstOrDefault(s => totalDays >= s.FromDays && totalDays <= s.ToDays && s.IsActive);
                        if (matchedSlab == null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"निवडलेला नूतनीकरण कालावधी ({totalDays} दिवस) मुदत ठेव योजनेच्या कोणत्याही मंजूर स्लॅबमध्ये बसत नाही (योजना मर्यादा: {scheme.MinDurationDays ?? 1} ते {scheme.MaxDurationDays ?? 0} दिवस).");
                        }
                        schemeDefaultRate = isSenior ? matchedSlab.SeniorCitizenRate : matchedSlab.InterestRate;
                    }
                    else
                    {
                        schemeDefaultRate = isSenior ? scheme.SeniorCitizenInterestRate : scheme.InterestRate;
                    }

                    decimal appliedRate = schemeDefaultRate;
                    bool isCustomInterestRate = false;
                    if (request.CustomInterestRate.HasValue)
                    {
                        decimal requestedRate = Math.Round(request.CustomInterestRate.Value, 2, MidpointRounding.AwayFromZero);
                        if (requestedRate <= 0m || requestedRate > 30m)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest("नवीन मुदत ठेवीचा व्याजदर ०.०१% ते ३०% दरम्यान असणे आवश्यक आहे.");
                        }
                        appliedRate = requestedRate;
                        isCustomInterestRate = Math.Abs(appliedRate - schemeDefaultRate) >= 0.01m;
                    }

                    if (carryForwardLien)
                    {
                        oldAccount.IsLienMarked = true;
                        oldAccount.LienLoanAccountNo ??= resolvedCarryLoanNo;
                        oldAccount.LienAmount ??= resolvedCarryLienAmt;
                    }

                    oldAccount.Status = "Renewed";
                    oldAccount.Remarks = TruncateMax(CleanStaleClosureRemarks(oldAccount.Remarks)
                        + $" | नूतनीकरण दिनांक: {closureDate:dd/MM/yyyy} ({request.RenewalType}, नवीन CBS: {formattedNewAccountNo}, पावती क्र.: {resolvedReceipt.ReceiptNo}, सायकल #{nextCycleNo})"
                        + (carryForwardLien ? $" [तारण बोजा पुढे नेला: कर्ज क्र. {resolvedCarryLoanNo ?? "सक्रिय कर्ज"}]" : "")
                        + (overdueInterest > 0 ? $" [मुदत उलटून गेलेले (Overdue) व्याज: ₹{overdueInterest:F2} ({overdueDays} दिवस)]" : "")
                        + manualAuditNote, 1000);
                    await _context.SaveChangesAsync();

                    string customRateNote = isCustomInterestRate
                        ? $" [✍️ मॅन्युअल व्याजदर: {appliedRate:F2}% (योजना दर: {schemeDefaultRate:F2}%){(!string.IsNullOrWhiteSpace(request.InterestRateOverrideReason) ? $" — {request.InterestRateOverrideReason.Trim()}" : "")}]"
                        : "";

                    // Create New FD Account
                    var newAccount = new FdAccount
                    {
                        InstitutionID = oldAccount.InstitutionID,
                        BranchID = oldAccount.BranchID,
                        FinancialYearID = targetFinancialYearId,
                        CustomerID = oldAccount.CustomerID,
                        FdSchemeID = request.TargetSchemeID,
                        AccountNo = formattedNewAccountNo,
                        ReceiptNo = resolvedReceipt.ReceiptNo,
                        LegacyAccountNumber = resolvedReceipt.LegacyAccountNumber,
                        ParentFdAccountID = parentFdId,
                        RootFdAccountID = rootFdId,
                        RenewalCycleNo = nextCycleNo,
                        OpeningDate = newOpeningDate,
                        DepositAmount = newDepositAmount,
                        InterestRate = appliedRate,
                        DurationType = durType,
                        DurationValue = durVal,
                        DurationInDays = totalDays,
                        MaturityDate = maturityDate,
                        Status = "Active",
                        IsLienMarked = carryForwardLien,
                        LienLoanAccountNo = carryForwardLien ? resolvedCarryLoanNo : null,
                        LienAmount = carryForwardLien ? resolvedCarryLienAmt : null,
                        NomineeName = oldAccount.NomineeName,
                        NomineeRelation = oldAccount.NomineeRelation,
                        Remarks = TruncateMax($"नूतनीकरण खाते (Renewed from): {oldAccount.AccountNo} | पावती क्र.: {resolvedReceipt.ReceiptNo} (मूळ पावती: {oldEffectiveReceipt}, सायकल #{nextCycleNo})"
                            + (carryForwardLien ? $" [तारण बोजा कायम: कर्ज क्र. {resolvedCarryLoanNo ?? "सक्रिय कर्ज"}]" : "")
                            + (isSenior ? $" [ज्येष्ठ नागरिक सवलत दर: {appliedRate}%]" : "")
                            + customRateNote
                            + (newOpeningDate != closureDate ? $" [सुरुवात दिनांक: {newOpeningDate:dd/MM/yyyy}]" : "")
                            + (overdueInterest > 0 ? $" [समाविष्ट Overdue व्याज: ₹{overdueInterest:F2}]" : "")
                            + manualAuditNote, 1000)
                    };

                    // Maturity Calculations (Exact 365-Day Banking Basis)
                    decimal p = newDepositAmount;
                    decimal r = appliedRate;

                    if (scheme.InterestType == "Cumulative")
                    {
                        int n = 4; // Default Quarterly
                        if (scheme.InterestCompoundingFrequency == "Half-Yearly") n = 2;
                        if (scheme.InterestCompoundingFrequency == "Yearly") n = 1;
                        if (scheme.InterestCompoundingFrequency == "Monthly") n = 12;

                        double baseVal = 1.0 + ((double)r / (n * 100.0));
                        double exponent = n * ((double)totalDays / 365.0);
                        newAccount.MaturityAmount = Math.Round(p * (decimal)Math.Pow(baseVal, exponent), 0, MidpointRounding.AwayFromZero);
                    }
                    else if (scheme.InterestType == "MIS" || scheme.InterestType == "Monthly Interest")
                    {
                        newAccount.MaturityAmount = p;
                    }
                    else
                    {
                        // Simple Interest: A = P * (1 + (R * totalDays) / (365 * 100))
                        newAccount.MaturityAmount = Math.Round(p * (1.0m + ((r * (decimal)totalDays) / (365.0m * 100.0m))), 0, MidpointRounding.AwayFromZero);
                    }

                    _context.FdAccounts.Add(newAccount);
                    await _context.SaveChangesAsync();

                    if (activeCollateralsToCarry.Any() || securityLoansToCarry.Any())
                    {
                        foreach (var col in activeCollateralsToCarry)
                        {
                            col.DepositAccountID = newAccount.FdAccountID;
                            col.DepositAccountNo = newAccount.AccountNo;
                            col.DepositAmount = newAccount.DepositAmount;
                            col.CurrentDepositBalance = newAccount.DepositAmount;
                            col.MaturityDate = newAccount.MaturityDate;
                            col.Remarks = TruncateMax(
                                $"{(string.IsNullOrWhiteSpace(col.Remarks) ? "" : col.Remarks.Trim() + " | ")}FD नूतनीकरण तारण वर्ग: {oldAccount.AccountNo} -> {newAccount.AccountNo}",
                                250);
                        }

                        foreach (var ln in securityLoansToCarry)
                        {
                            if (!string.IsNullOrEmpty(ln.SecurityDetails) && !string.IsNullOrEmpty(oldAccNoForLien))
                            {
                                ln.SecurityDetails = ln.SecurityDetails.Replace(oldAccNoForLien, newAccount.AccountNo);
                            }
                        }

                        await _context.SaveChangesAsync();
                    }

                    // 3. Post Renewal Vouchers (Strict Scheme Ledger Mapping + Optional Custom Debit Ledgers)
                    var ledgerSourceScheme = oldAccount.FdScheme;
                    var targetLedgerScheme = scheme ?? oldAccount.FdScheme;
                    var fallbackSchemeForInterest = ledgerSourceScheme ?? targetLedgerScheme;
                    var oldLiabilityLedger = await ResolveStrictSchemeLedgerByIdAsync(ledgerSourceScheme?.FdLiabilityLedgerID);
                    var targetLiabilityLedger = await ResolveStrictSchemeLedgerByIdAsync(targetLedgerScheme?.FdLiabilityLedgerID);

                    var (payableValid, payableLedger, payableErr) = await ResolveCustomOrDefaultLedgerAsync(
                        request.PostedInterestDebitLedgerID,
                        () => ResolveStrictSchemeLedgerByIdAsync(fallbackSchemeForInterest?.InterestPayableLedgerID),
                        "POSTING_INTR / देणे व्याज");
                    if (!payableValid)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(payableErr);
                    }

                    var (expenseValid, expenseLedger, expenseErr) = await ResolveCustomOrDefaultLedgerAsync(
                        request.ExpenseInterestDebitLedgerID,
                        () => ResolveStrictSchemeLedgerByIdAsync(fallbackSchemeForInterest?.InterestExpenseLedgerID),
                        "नफा-तोटा / व्याज खर्च");
                    if (!expenseValid)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(expenseErr);
                    }

                    if (oldLiabilityLedger == null || targetLiabilityLedger == null)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest("मुदत ठेव दायित्व लेजर (FD Liability Ledger) सापडले नाही. कृपया योजनेत लेजर मॅपिंग तपासा.");
                    }

                    // CBS Rule: Split contracted interest between Capitalized Deposit Liability (On Interest), verified Interest Payable (POSTING_INTR), and Interest Expense (NAFATOTA DEY VYAJ / P&L)
                    var postingBreakdown = await Helpers.FdInterestSettlementHelper.ResolveVerifiedPostingBreakdownAsync(
                        _context, id, fallbackSchemeForInterest?.InterestPayableLedgerID ?? 0);
                    bool isCompoundRenew = Helpers.FdOpeningBalanceSyncHelper.IsCompoundCapitalizedScheme(fallbackSchemeForInterest);
                    var allocation = Helpers.FdInterestSettlementHelper.ResolveClosureInterestAllocation(new Helpers.FdInterestAllocationRequest
                    {
                        TargetInterest = accruedInt,
                        OverdueInterest = overdueInterest,
                        VerifiedProvision = postingBreakdown.VerifiedProvision,
                        VerifiedCapitalized = postingBreakdown.VerifiedCapitalized,
                        LegacyAccruedInt = isCompoundRenew ? 0m : oldAccount.LegacyAccruedInt,
                        IsPremature = false,
                        IsPeriodicPayout = false,
                        IsManualAmountOverride = request.IsManualAmountOverride,
                        InterestDebitMode = request.InterestDebitMode,
                        PostedInterestDebitAmount = request.PostedInterestDebitAmount,
                        ExpenseInterestDebitAmount = request.ExpenseInterestDebitAmount
                    });
                    if (!allocation.IsValid)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = allocation.ErrorMessage });
                    }

                    decimal clearedCapitalizedInterest = allocation.ClearedCapitalizedInterest;
                    decimal payableInterestAmount = allocation.PostedInterestDebitAmount;
                    decimal totalExpenseInterest = allocation.TotalExpenseInterest;

                    if (payableInterestAmount > 0 && payableLedger == null)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest("मुदत ठेवीच्या देणे व्याजासाठी लेजर (FD Interest Payable Ledger) उपलब्ध नाही. कृपया योजनेत लेजर मॅपिंग तपासा.");
                    }

                    if (totalExpenseInterest > 0 && expenseLedger == null)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest("मुदत ठेवीवरील व्याज खर्चासाठी लेजर (FD Interest Expense Ledger) उपलब्ध नाही. कृपया योजनेत लेजर मॅपिंग तपासा.");
                    }

                    int interestPayoutLedgerId = 0;
                    SavingTransaction? savTx = null;
                    if (request.RenewalType == "PrincipalOnly" && interestPayoutAmount > 0)
                    {
                        if (BankLedgerHelper.IsBankPaymentMode(paymentMode))
                        {
                            var intBankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(_context, request.BankAccountLedgerID);
                            if (!intBankCheck.IsValid)
                            {
                                await transaction.RollbackAsync();
                                return BadRequest(intBankCheck.ErrorMessage);
                            }
                            interestPayoutLedgerId = intBankCheck.LedgerId;
                        }
                        else if ((string.Equals(paymentMode, "Transfer", StringComparison.OrdinalIgnoreCase) || string.Equals(paymentMode, "Saving", StringComparison.OrdinalIgnoreCase) || string.Equals(paymentMode, "Saving Transfer", StringComparison.OrdinalIgnoreCase)) && (!request.SavingAccountID.HasValue || request.SavingAccountID.Value <= 0 || !await _context.SavingAccountMasters.AnyAsync(s => s.SavingAccountID == request.SavingAccountID.Value && s.Status != "Closed")))
                        {
                            await transaction.RollbackAsync();
                            return BadRequest("नूतनीकरणाचे व्याज बचत खात्यात वर्ग करण्यासाठी वैध सक्रिय बचत खाते निवडणे बंधनकारक आहे.");
                        }
                        else if (!string.Equals(paymentMode, "Cash", StringComparison.OrdinalIgnoreCase) && !string.Equals(paymentMode, "Transfer", StringComparison.OrdinalIgnoreCase) && !string.Equals(paymentMode, "Saving", StringComparison.OrdinalIgnoreCase) && !string.Equals(paymentMode, "Saving Transfer", StringComparison.OrdinalIgnoreCase))
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"व्याज परताव्यासाठी अवैध पेमेंट पद्धत '{paymentMode}'.");
                        }
                        else if ((string.Equals(paymentMode, "Transfer", StringComparison.OrdinalIgnoreCase) || string.Equals(paymentMode, "Saving", StringComparison.OrdinalIgnoreCase) || string.Equals(paymentMode, "Saving Transfer", StringComparison.OrdinalIgnoreCase)) && request.SavingAccountID > 0)
                        {
                            var savAccount = await _context.SavingAccountMasters
                                .Include(s => s.Ledger)
                                .FirstOrDefaultAsync(s => s.SavingAccountID == request.SavingAccountID.Value);

                            if (savAccount != null)
                            {
                                savAccount.CurrentBalance += interestPayoutAmount;
                                interestPayoutLedgerId = await Helpers.SavingLedgerHelper.ResolveSavingLiabilityLedgerIdAsync(_context, savAccount);

                                savTx = new SavingTransaction
                                {
                                    SavingAccountID = savAccount.SavingAccountID,
                                    CustomerID = savAccount.CustomerID,
                                    BranchID = oldAccount.BranchID > 0 ? oldAccount.BranchID : savAccount.BranchID,
                                    TransactionDate = closureDate,
                                    TransactionType = "Deposit",
                                    PaymentMode = "Transfer",
                                    Amount = interestPayoutAmount,
                                    BalanceAfterTxn = savAccount.CurrentBalance,
                                    Narration = $"मुदत ठेव नूतनीकरण व्याज जमा (FD Renewal Interest): {oldAccount.AccountNo}{(overdueInterest > 0 ? $" (समाविष्ट Overdue व्याज: ₹{overdueInterest:F2})" : "")}",
                                    VoucherNo = $"JV-FD-INT-{newAccount.AccountNo}",
                                    CreatedBy = 1,
                                    CreatedOn = DateTime.Now
                                };
                                _context.SavingTransactions.Add(savTx);
                            }
                            else
                            {
                                interestPayoutLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, oldAccount.BranchID, "FD");
                            }
                        }
                        else
                        {
                            interestPayoutLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, oldAccount.BranchID, "FD");
                        }
                    }

                    var linkedMember = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == oldAccount.CustomerID);
                    int? linkedMemberId = linkedMember?.MemberID;
                    int currentUserId = int.TryParse(
                        User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("UserID")?.Value,
                        out int parsedUid) && parsedUid > 0 ? parsedUid : 1;

                    if (savTx != null)
                    {
                        savTx.CreatedBy = currentUserId;
                    }

                    Voucher? voucher1 = null;
                    Voucher? voucher2 = null;
                    Voucher? singleVoucher = null;

                    if (request.RenewalType == "PrincipalOnly")
                    {
                        string renVoucherNo1 = await Helpers.FdRenewalRollbackHelper.BuildCollisionSafeVoucherNoAsync(
                            _context, $"JV-FD-REN-{newAccount.AccountNo}");

                        // 1. Voucher 1: Pure Journal Voucher for Principal Renewal (100% Transfer, no cash)
                        voucher1 = new Voucher
                        {
                            BranchID = oldAccount.BranchID,
                            VoucherNo = renVoucherNo1,
                            VoucherDate = closureDate,
                            VoucherType = "Journal",
                            TotalAmount = oldAccount.DepositAmount,
                            Narration = TruncateMax((string.IsNullOrWhiteSpace(request.Narration)
                                ? $"मुदत ठेव मुद्दल नूतनीकरण (FD Principal Renewal): {oldAccount.AccountNo} -> {newAccount.AccountNo}"
                                : request.Narration) + manualAuditNote, 500),
                            Status = "Pending",
                            CreatedBy = currentUserId,
                            CreatedOn = DateTime.Now
                        };
                        _context.Vouchers.Add(voucher1);
                        await _context.SaveChangesAsync();

                        // Dr Old FD Liability (Principal)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher1.VoucherID, LedgerID = oldLiabilityLedger.LedgerID, DrCr = "Dr", Amount = oldAccount.DepositAmount, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });

                        // Cr New FD Liability (Principal)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher1.VoucherID, LedgerID = targetLiabilityLedger.LedgerID, DrCr = "Cr", Amount = newDepositAmount, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });

                        // 2. Voucher 2: Decoupled Interest Payout Voucher (Payment or Journal)
                        if (interestPayoutAmount > 0 && interestPayoutLedgerId > 0)
                        {
                            string intVoucherType = (paymentMode == "Transfer") ? "Journal" : "Payment";
                            string intVoucherPrefix = (paymentMode == "Transfer") ? "JV-FD-INT" : "PAY-FD-INT";
                            string intVoucherNo = await Helpers.FdRenewalRollbackHelper.BuildCollisionSafeVoucherNoAsync(
                                _context, $"{intVoucherPrefix}-{newAccount.AccountNo}");

                            voucher2 = new Voucher
                            {
                                BranchID = oldAccount.BranchID,
                                VoucherNo = intVoucherNo,
                                VoucherDate = closureDate,
                                VoucherType = intVoucherType,
                                TotalAmount = interestPayoutAmount,
                                Narration = TruncateMax($"मुदत ठेव व्याज परतावा ({paymentMode}): खा. क्र. {oldAccount.AccountNo} (नवीन खा. क्र. {newAccount.AccountNo}){(overdueInterest > 0 ? $" (समाविष्ट Overdue व्याज: ₹{overdueInterest:F2})" : "")}" + manualAuditNote, 500),
                                Status = "Pending",
                                CreatedBy = currentUserId,
                                CreatedOn = DateTime.Now
                            };
                            _context.Vouchers.Add(voucher2);
                            await _context.SaveChangesAsync();

                            voucher1.RelatedVoucherID = voucher2.VoucherID;
                            voucher2.RelatedVoucherID = voucher1.VoucherID;

                            if (savTx != null)
                            {
                                savTx.VoucherNo = intVoucherNo;
                            }

                            // Dr Old FD Liability (Previously capitalized interest portion)
                            if (clearedCapitalizedInterest > 0)
                            {
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher2.VoucherID, LedgerID = oldLiabilityLedger.LedgerID, DrCr = "Dr", Amount = clearedCapitalizedInterest, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });
                            }

                            // Dr Interest Payable (Accumulated Contract Interest - cleared only up to already provisioned)
                            if (payableLedger != null && payableInterestAmount > 0)
                            {
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher2.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = payableInterestAmount, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });
                            }

                            // Dr Interest Expense (Unprovisioned current period interest + Overdue Interest)
                            if (totalExpenseInterest > 0 && expenseLedger != null)
                            {
                                _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher2.VoucherID, LedgerID = expenseLedger.LedgerID, DrCr = "Dr", Amount = totalExpenseInterest, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });
                            }

                            // Cr Interest Payout (Cash / Bank / Saving)
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher2.VoucherID, LedgerID = interestPayoutLedgerId, DrCr = "Cr", Amount = interestPayoutAmount, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });
                        }

                        // Log FdTransactions
                        _context.FdTransactions.Add(new FdTransaction
                        {
                            BranchID = oldAccount.BranchID,
                            FdAccountID = oldAccount.FdAccountID,
                            VoucherID = voucher1.VoucherID,
                            TransactionDate = closureDate,
                            TransactionType = "Renewal",
                            DebitCredit = "Dr",
                            Amount = oldAccount.DepositAmount
                        });

                        if (interestPayoutAmount > 0 && voucher2 != null)
                        {
                            _context.FdTransactions.Add(new FdTransaction
                            {
                                BranchID = oldAccount.BranchID,
                                FdAccountID = oldAccount.FdAccountID,
                                VoucherID = voucher2.VoucherID,
                                TransactionDate = closureDate,
                                TransactionType = "Interest Payout",
                                DebitCredit = "Dr",
                                Amount = interestPayoutAmount
                            });
                        }

                        if (overdueInterest > 0)
                        {
                            _context.FdTransactions.Add(new FdTransaction
                            {
                                BranchID = oldAccount.BranchID,
                                FdAccountID = oldAccount.FdAccountID,
                                VoucherID = voucher2 != null ? voucher2.VoucherID : voucher1.VoucherID,
                                TransactionDate = closureDate,
                                TransactionType = "Closure_Interest",
                                DebitCredit = "Cr",
                                Amount = overdueInterest
                            });
                        }

                        _context.FdTransactions.Add(new FdTransaction
                        {
                            BranchID = newAccount.BranchID,
                            FdAccountID = newAccount.FdAccountID,
                            VoucherID = voucher1.VoucherID,
                            TransactionDate = closureDate,
                            TransactionType = "Opening",
                            DebitCredit = "Cr",
                            Amount = newDepositAmount
                        });
                    }
                    else
                    {
                        string renSingleVoucherNo = await Helpers.FdRenewalRollbackHelper.BuildCollisionSafeVoucherNoAsync(
                            _context, $"JV-FD-REN-{newAccount.AccountNo}");

                        // PrincipalPlusInterest: Single compound Journal Voucher (100% Transfer, no cash payout)
                        singleVoucher = new Voucher
                        {
                            BranchID = oldAccount.BranchID,
                            VoucherNo = renSingleVoucherNo,
                            VoucherDate = closureDate,
                            VoucherType = "Journal",
                            TotalAmount = totalMaturityAmount,
                            Narration = TruncateMax((string.IsNullOrWhiteSpace(request.Narration)
                                ? $"मुदत ठेव नूतनीकरण (FD Renewal): {oldAccount.AccountNo} -> {newAccount.AccountNo}{(overdueInterest > 0 ? $" (समाविष्ट Overdue व्याज: ₹{overdueInterest:F2})" : "")}"
                                : request.Narration) + manualAuditNote, 500),
                            Status = "Pending",
                            CreatedBy = currentUserId,
                            CreatedOn = DateTime.Now
                        };
                        _context.Vouchers.Add(singleVoucher);
                        await _context.SaveChangesAsync();

                        // Dr Old FD Liability (Principal + any previously capitalized interest)
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = singleVoucher.VoucherID, LedgerID = oldLiabilityLedger.LedgerID, DrCr = "Dr", Amount = oldAccount.DepositAmount + clearedCapitalizedInterest, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });
                        
                        // Dr Interest Payable (Accumulated Contract Interest - cleared only up to already provisioned)
                        if (payableLedger != null && payableInterestAmount > 0)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = singleVoucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = payableInterestAmount, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });
                        }

                        // Dr Interest Expense (Unprovisioned current period interest + Overdue Interest)
                        if (totalExpenseInterest > 0 && expenseLedger != null)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail { VoucherID = singleVoucher.VoucherID, LedgerID = expenseLedger.LedgerID, DrCr = "Dr", Amount = totalExpenseInterest, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });
                        }

                        // Cr New FD Liability
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = singleVoucher.VoucherID, LedgerID = targetLiabilityLedger.LedgerID, DrCr = "Cr", Amount = newDepositAmount, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });

                        // Log Transactions
                        _context.FdTransactions.Add(new FdTransaction
                        {
                            BranchID = oldAccount.BranchID,
                            FdAccountID = oldAccount.FdAccountID,
                            VoucherID = singleVoucher.VoucherID,
                            TransactionDate = closureDate,
                            TransactionType = "Renewal",
                            DebitCredit = "Dr",
                            Amount = totalMaturityAmount
                        });

                        if (overdueInterest > 0)
                        {
                            _context.FdTransactions.Add(new FdTransaction
                            {
                                BranchID = oldAccount.BranchID,
                                FdAccountID = oldAccount.FdAccountID,
                                VoucherID = singleVoucher.VoucherID,
                                TransactionDate = closureDate,
                                TransactionType = "Closure_Interest",
                                DebitCredit = "Cr",
                                Amount = overdueInterest
                            });
                        }

                        _context.FdTransactions.Add(new FdTransaction
                        {
                            BranchID = newAccount.BranchID,
                            FdAccountID = newAccount.FdAccountID,
                            VoucherID = singleVoucher.VoucherID,
                            TransactionDate = closureDate,
                            TransactionType = "Opening",
                            DebitCredit = "Cr",
                            Amount = newDepositAmount
                        });
                    }

                    if (isCustomInterestRate)
                    {
                        _context.AuditLogs.Add(new AuditLog
                        {
                            UserID = currentUserId,
                            Action = "FD_RENEWAL_CUSTOM_INTEREST_RATE",
                            EntityName = "FdAccount",
                            EntityID = newAccount.AccountNo,
                            Details = $"FD Renewal {oldAccount.AccountNo} -> {newAccount.AccountNo}: Rate changed manually from {schemeDefaultRate:F2}% to {appliedRate:F2}%{(string.IsNullOrWhiteSpace(request.InterestRateOverrideReason) ? "" : $" | Reason: {request.InterestRateOverrideReason.Trim()}")}",
                            Status = "Success",
                            Timestamp = DateTime.Now
                        });
                    }

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok(new { 
                        Message = "FD Renewed successfully", 
                        NewAccountNo = newAccount.AccountNo,
                        NewReceiptNo = Helpers.FdRenewalPolicyHelper.GetEffectiveReceiptNo(newAccount),
                        OldReceiptNo = oldEffectiveReceipt,
                        RenewalCycleNo = newAccount.RenewalCycleNo,
                        RootFdAccountId = newAccount.RootFdAccountID,
                        EffectivePolicy = resolvedReceipt.EffectiveMode,
                        NewDeposit = newDepositAmount, 
                        OverdueInterest = overdueInterest,
                        NewFdAccountId = newAccount.FdAccountID,
                        MaturityAmount = newAccount.MaturityAmount,
                        MaturityDate = newAccount.MaturityDate,
                        OpeningDate = newAccount.OpeningDate,
                        InterestRate = newAccount.InterestRate,
                        DefaultSchemeRate = schemeDefaultRate,
                        IsCustomInterestRate = isCustomInterestRate,
                        DurationInDays = newAccount.DurationInDays,
                        DurationValue = newAccount.DurationValue,
                        DurationType = newAccount.DurationType,
                        SchemeName = scheme?.SchemeName ?? "",
                        SchemeCode = scheme?.SchemeCode ?? "",
                        CustomerName = customer != null ? $"{customer.FirstName} {customer.LastName}".Trim() : "",
                        CifNo = customer?.CIFNo ?? "",
                        VoucherNo = request.RenewalType == "PrincipalOnly" ? voucher1?.VoucherNo : singleVoucher?.VoucherNo,
                        VoucherStatus = "Pending",
                        VoucherDate = closureDate,
                        InterestVoucherNo = (request.RenewalType == "PrincipalOnly" && voucher2 != null) ? voucher2.VoucherNo : null
                    });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("Failed to process renewal: " + GetDeepestErrorMessage(ex));
                }
            }
        }

        // PUT: api/FdAccounts/5
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,SuperAdmin,Manager")]
        public async Task<IActionResult> PutFdAccount(int id, FdAccount account)
        {
            if (id != account.FdAccountID)
            {
                return BadRequest("ID mismatch.");
            }

            var existing = await _context.FdAccounts.FindAsync(id);
            if (existing == null)
            {
                return NotFound("मुदत ठेव खाते सापडले नाही.");
            }

            if (string.Equals(existing.Status, "Closed", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(existing.Status, "Renewed", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest($"सदर मुदत ठेव खाते आधीच '{existing.Status}' झालेले असल्याने संपादित करता येत नाही.");
            }

            // [RULE-FD-LEGACY-DUP] Prevent duplicate Old Receipt No under the same Scheme & Branch
            if (!string.IsNullOrWhiteSpace(account.LegacyAccountNumber))
            {
                var trimmedLegacy = account.LegacyAccountNumber.Trim();
                var duplicate = await _context.FdAccounts
                    .Include(a => a.Customer)
                    .Include(a => a.FdScheme)
                    .FirstOrDefaultAsync(a => a.FdAccountID != id
                        && a.BranchID == account.BranchID 
                        && a.FdSchemeID == account.FdSchemeID 
                        && a.LegacyAccountNumber != null 
                        && a.LegacyAccountNumber.Trim() == trimmedLegacy
                        && !(existing.RootFdAccountID.HasValue && existing.RootFdAccountID.Value > 0
                             && a.RootFdAccountID == existing.RootFdAccountID
                             && (a.Status == "Closed" || a.Status == "Renewed")));

                if (duplicate != null)
                {
                    var sName = duplicate.FdScheme?.SchemeName ?? "सदर योजना";
                    var cName = duplicate.Customer?.FullName ?? "खातेदार";
                    return BadRequest($"या योजनेअंतर्गत ({sName}) जुना पावती क्र. '{trimmedLegacy}' आधीच खाते क्र. '{duplicate.AccountNo}' ({cName}) साठी नोंदवला आहे. एकाच योजनेमध्ये एक जुना पावती क्र. दोनदा सेव्ह करता येत नाही.");
                }
            }

            existing.BranchID = account.BranchID;
            existing.CustomerID = account.CustomerID;
            existing.FdSchemeID = account.FdSchemeID;
            if (!string.IsNullOrWhiteSpace(account.AccountNo)) existing.AccountNo = account.AccountNo;
            existing.LegacyAccountNumber = !string.IsNullOrWhiteSpace(account.LegacyAccountNumber) ? account.LegacyAccountNumber.Trim() : null;
            existing.OpeningDate = account.OpeningDate;
            existing.DepositAmount = account.DepositAmount;
            if (!string.IsNullOrWhiteSpace(account.DurationType)) existing.DurationType = account.DurationType;
            if (account.DurationValue.HasValue) existing.DurationValue = account.DurationValue;
            if (account.DurationInDays.HasValue) existing.DurationInDays = account.DurationInDays;
            existing.InterestRate = account.InterestRate;
            existing.MaturityDate = account.MaturityDate;
            existing.MaturityAmount = account.MaturityAmount;
            existing.LegacyAccruedInt = account.LegacyAccruedInt;
            existing.LastInterestPostingDate = account.LastInterestPostingDate;
            if (account.NomineeName != null) existing.NomineeName = account.NomineeName;
            if (account.NomineeRelation != null) existing.NomineeRelation = account.NomineeRelation;
            if (account.Remarks != null) existing.Remarks = account.Remarks;

            // CBS Auto-Renewal Settings
            existing.IsAutoRenewable = account.IsAutoRenewable;
            if (!string.IsNullOrWhiteSpace(account.AutoRenewalOption)) existing.AutoRenewalOption = account.AutoRenewalOption;
            if (account.MaxAutoRenewalCycles > 0) existing.MaxAutoRenewalCycles = account.MaxAutoRenewalCycles;

            try
            {
                await _context.SaveChangesAsync();
                if (existing.IsLegacyAccount)
                {
                    try
                    {
                        var editScheme = await _context.FdSchemes.AsNoTracking().FirstOrDefaultAsync(s => s.FdSchemeID == existing.FdSchemeID);
                        bool isCompoundEdit = Helpers.FdOpeningBalanceSyncHelper.IsCompoundCapitalizedScheme(editScheme);
                        string expectedIntTxType = isCompoundEdit ? "Interest_Capitalized" : "Accrual";
                        decimal expectedOpVoucherTotal = isCompoundEdit
                            ? existing.DepositAmount + Math.Max(0m, existing.LegacyAccruedInt)
                            : existing.DepositAmount;

                        var opVoucher = await _context.Vouchers
                            .Include(v => v.VoucherDetails)
                            .FirstOrDefaultAsync(v => v.VoucherNo == $"JV-FD-OP-{existing.AccountNo}");
                        if (opVoucher != null)
                        {
                            opVoucher.TotalAmount = expectedOpVoucherTotal;
                            opVoucher.VoucherDate = existing.OpeningDate;
                            if (opVoucher.VoucherDetails != null)
                            {
                                foreach (var vd in opVoucher.VoucherDetails)
                                {
                                    vd.Amount = expectedOpVoucherTotal;
                                }
                            }
                        }
                        var opTx = await _context.FdTransactions.FirstOrDefaultAsync(t => t.FdAccountID == existing.FdAccountID && t.TransactionType == "Opening");
                        if (opTx != null)
                        {
                            opTx.Amount = existing.DepositAmount;
                            opTx.TransactionDate = existing.OpeningDate;
                        }
                        if (opVoucher != null)
                        {
                            var opAccrualTx = await _context.FdTransactions.FirstOrDefaultAsync(t =>
                                t.FdAccountID == existing.FdAccountID &&
                                t.VoucherID == opVoucher.VoucherID &&
                                (t.TransactionType == "Accrual" || t.TransactionType == "Interest_Capitalized"));
                            if (opAccrualTx != null)
                            {
                                if (existing.LegacyAccruedInt > 0)
                                {
                                    opAccrualTx.TransactionType = expectedIntTxType;
                                    opAccrualTx.Amount = existing.LegacyAccruedInt;
                                    opAccrualTx.TransactionDate = existing.LastInterestPostingDate ?? existing.OpeningDate;
                                }
                                else
                                {
                                    _context.FdTransactions.Remove(opAccrualTx);
                                }
                            }
                            else if (existing.LegacyAccruedInt > 0)
                            {
                                _context.FdTransactions.Add(new FdTransaction
                                {
                                    BranchID = existing.BranchID,
                                    FdAccountID = existing.FdAccountID,
                                    VoucherID = opVoucher.VoucherID,
                                    TransactionDate = existing.LastInterestPostingDate ?? existing.OpeningDate,
                                    TransactionType = expectedIntTxType,
                                    DebitCredit = "Cr",
                                    Amount = existing.LegacyAccruedInt,
                                    CreatedBy = existing.CreatedBy > 0 ? existing.CreatedBy : 1
                                });
                            }
                        }
                        await _context.SaveChangesAsync();

                        await SyncFdOpeningBalancesInternalAsync();
                    }
                    catch (Exception syncEx)
                    {
                        Console.WriteLine($"[ERROR] PutFdAccount SyncFdOpeningBalances: {syncEx.Message}");
                    }
                }
                return Ok(existing);
            }
            catch (Exception ex)
            {
                return BadRequest("Update करताना त्रुटी आली: " + ex.Message);
            }
        }




        // DELETE: api/FdAccounts/ClearData (Clear all test FD records & reset sequences - STRICTLY DEVELOPMENT ONLY)
        [HttpDelete("ClearData")]
        [Authorize(Roles = "Admin,SuperAdmin")]
        public async Task<IActionResult> ClearData()
        {
            var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
            if (!string.Equals(env, "Development", StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(403, new { message = "सुरक्षा निर्बंध: संपूर्ण मुदत ठेव डेटा पुसण्याची कृती थेट उत्पादन (Production) प्रणालीमध्ये पूर्णपणे प्रतिबंधित आहे. केवळ Development मोडमध्येच ही कृती करता येऊ शकते." });
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    // 1. Delete FD Transactions
                    var txs = await _context.FdTransactions.ToListAsync();
                    if (txs.Any()) _context.FdTransactions.RemoveRange(txs);

                    // 2. Delete FD Interest Accruals
                    var accruals = await _context.FdInterestAccruals.ToListAsync();
                    if (accruals.Any()) _context.FdInterestAccruals.RemoveRange(accruals);

                    // 3. Delete FD Vouchers
                    var fdVouchers = await _context.Vouchers
                        .Include(v => v.VoucherDetails)
                        .Where(v => v.VoucherNo.StartsWith("JV-FD-"))
                        .ToListAsync();
                    foreach (var v in fdVouchers)
                    {
                        if (v.VoucherDetails != null && v.VoucherDetails.Any())
                        {
                            _context.VoucherDetails.RemoveRange(v.VoucherDetails);
                        }
                    }
                    if (fdVouchers.Any()) _context.Vouchers.RemoveRange(fdVouchers);

                    // 4. Delete FD Accounts
                    var accounts = await _context.FdAccounts.ToListAsync();
                    if (accounts.Any()) _context.FdAccounts.RemoveRange(accounts);

                    // 5. Reset FD Sequences
                    var seqs = await _context.FdAccountSequences.Where(s => s.ProductType == "FD").ToListAsync();
                    foreach (var s in seqs)
                    {
                        s.CurrentValue = 0;
                    }

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok(new { Message = "मुदत ठेव मॉडेलमधील सर्व डेटा यशस्वीरीत्या साफ (Cleared) करण्यात आला आहे." });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("डेटा साफ करताना त्रुटी आली: " + ex.Message);
                }
            }
        }

        // POST: api/FdAccounts/CalculateInterestPreview
        [HttpPost("CalculateInterestPreview")]
        [Authorize]
        public async Task<IActionResult> CalculateInterestPreview([FromBody] FdInterestPreviewRequestDto req)
        {
            var (isHO, userBranchId) = GetUserBranchInfo();
            if (!isHO && userBranchId.HasValue && userBranchId.Value > 0)
            {
                req.BranchID = userBranchId.Value;
            }

            var activeAccounts = await _context.FdAccounts
                .Include(a => a.Customer)
                .Include(a => a.FdScheme)
                .Where(a => a.BranchID == req.BranchID && a.Status == "Active")
                .ToListAsync();

            var previewItems = new List<FdInterestPreviewItemDto>();

            foreach (var acc in activeAccounts)
            {
                var lastAccrual = await _context.FdInterestAccruals
                    .Where(a => a.FdAccountID == acc.FdAccountID)
                    .OrderByDescending(a => a.AccrualDate)
                    .FirstOrDefaultAsync();

                DateTime fromDate;
                bool isFromOpening = false;
                if (lastAccrual != null)
                {
                    fromDate = lastAccrual.AccrualDate.Date;
                }
                else if (acc.LastInterestPostingDate.HasValue)
                {
                    if (acc.LastInterestPostingDate.Value.Date == req.AccrualDate.Date)
                    {
                        fromDate = acc.OpeningDate.Date;
                        isFromOpening = true;
                    }
                    else
                    {
                        fromDate = acc.LastInterestPostingDate.Value.Date;
                        if (fromDate <= acc.OpeningDate.Date)
                        {
                            fromDate = acc.OpeningDate.Date;
                            isFromOpening = true;
                        }
                    }
                }
                else
                {
                    fromDate = acc.OpeningDate.Date;
                    isFromOpening = true;
                }

                DateTime matLastInterestDay = acc.MaturityDate.Date.AddDays(-1);
                DateTime toDate = req.AccrualDate.Date;
                if (toDate > matLastInterestDay)
                {
                    toDate = matLastInterestDay;
                }

                int days = 0;
                if (toDate >= fromDate)
                {
                    days = (toDate - fromDate).Days;
                    if (isFromOpening)
                    {
                        // In Indian banking, deposit day itself is inclusive (e.g. 01/05/2025 to 30/06/2025 = 61 days)
                        days += 1;
                    }
                }
                if (days <= 0) days = 0;

                decimal txProvisionSum = await _context.FdTransactions
                    .Where(t => t.FdAccountID == acc.FdAccountID && t.TransactionType == "Accrual")
                    .SumAsync(t => (decimal?)t.Amount) ?? 0m;
                decimal txCapitalizedSum = await _context.FdTransactions
                    .Where(t => t.FdAccountID == acc.FdAccountID && t.TransactionType == "Interest_Capitalized")
                    .SumAsync(t => (decimal?)t.Amount) ?? 0m;
                decimal alreadyAccrued = Math.Max(txProvisionSum, acc.LegacyAccruedInt) + txCapitalizedSum;

                decimal effectivePrincipal = acc.DepositAmount;
                if (req.CalculationMethod == "OnInterest")
                {
                    effectivePrincipal += alreadyAccrued;
                }

                decimal calculatedInterest = 0;
                if (days > 0)
                {
                    calculatedInterest = Math.Round((effectivePrincipal * acc.InterestRate * days) / 36500.0m, 0, MidpointRounding.AwayFromZero);
                }

                string memberNameStr = acc.Customer != null 
                    ? $"{acc.Customer.FirstName} {acc.Customer.MiddleName} {acc.Customer.LastName}".Replace("  ", " ").Trim()
                    : "Unknown";

                previewItems.Add(new FdInterestPreviewItemDto
                {
                    FdAccountID = acc.FdAccountID,
                    AccountNo = acc.AccountNo,
                    CustomerID = acc.CustomerID,
                    CustomerName = memberNameStr,
                    CIFNo = acc.Customer?.CIFNo ?? "",
                    MemberID = acc.CustomerID,
                    MemberName = memberNameStr,
                    MemberCode = acc.Customer?.CIFNo ?? "",
                    SchemeName = acc.FdScheme?.SchemeName ?? "Standard Scheme",
                    OpeningDate = acc.OpeningDate,
                    FromDate = fromDate,
                    LastInterestPostingDate = acc.LastInterestPostingDate,
                    DepositAmount = acc.DepositAmount,
                    EffectivePrincipal = effectivePrincipal,
                    AlreadyAccruedInterest = alreadyAccrued,
                    ElapsedDays = days,
                    InterestRate = acc.InterestRate,
                    CalculatedInterest = calculatedInterest,
                    CalculationMethod = req.CalculationMethod,
                    IsSelected = calculatedInterest > 0
                });
            }

            return Ok(previewItems);
        }

        // POST: api/FdAccounts/PostSelectedInterest
        [HttpPost("PostSelectedInterest")]
        [Authorize(Roles = "Admin,SuperAdmin,Manager")]
        public async Task<IActionResult> PostSelectedInterest([FromBody] FdInterestPostRequestDto req)
        {
            var (isHO, userBranchId) = GetUserBranchInfo();
            if (!isHO && userBranchId.HasValue && userBranchId.Value > 0)
            {
                req.BranchID = userBranchId.Value;
            }

            if (req.SelectedItems == null || !req.SelectedItems.Any())
            {
                return BadRequest("कृपया व्याज पोस्ट करण्यासाठी किमान एक खाते निवडा (Select at least one account).");
            }

            if (req.AccrualDate.Date > DateTime.Today)
            {
                return BadRequest($"अवैध तारीख! भविष्यातील तारीख ({req.AccrualDate:dd/MM/yyyy}) अनुज्ञेय नाही. व्याज तरतूद आजच्या किंवा मागील तारखेचीच असणे आवश्यक आहे.");
            }

            var closedFy = await _context.FinancialYears
                .FirstOrDefaultAsync(fy => fy.IsClosed && req.AccrualDate.Date >= fy.StartDate.Date && req.AccrualDate.Date <= fy.EndDate.Date);
            if (closedFy != null)
            {
                return BadRequest($"अवैध तारीख! निवडलेली व्याज तरतूद तारीख ({req.AccrualDate:dd/MM/yyyy}) ही बंद/ऑडिट झालेल्या आर्थिक वर्षात ({closedFy.YearCode}) मोडते. बंद आर्थिक वर्षात थेट व्हाउचर पोस्ट करणे वैधानिक नियमांनुसार (MCS Act) प्रतिबंधित आहे.");
            }

            var validItems = req.SelectedItems
                .Where(x => Math.Round(x.CalculatedInterest, 0, MidpointRounding.AwayFromZero) > 0)
                .ToList();

            if (!validItems.Any())
            {
                return BadRequest("निवडलेल्या खात्यांची एकूण व्याज रक्कम ० आहे.");
            }

            var selectedAccountIds = validItems.Select(x => x.FdAccountID).Distinct().ToList();
            var accounts = await _context.FdAccounts
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.FdLiabilityLedger)
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.InterestExpenseLedger)
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.InterestPayableLedger)
                .Where(a => selectedAccountIds.Contains(a.FdAccountID))
                .ToDictionaryAsync(a => a.FdAccountID);

            if (accounts.Values.Any(a => a.BranchID != req.BranchID))
            {
                return BadRequest("केवळ निवडलेल्या शाखेतील खात्यांचीच व्याज तरतूद पोस्ट करता येईल.");
            }

            // Pre-resolve and validate ledgers for all selected accounts
            // Rule: Post to Principal ("Principal") -> Cr FdLiabilityLedger (Deposits on Balance Sheet);
            //       Provision Only ("Provision")    -> Cr InterestPayableLedger (Provision on Balance Sheet).
            var accountLedgerPairs = new Dictionary<int, (Ledger ExpenseLedger, Ledger CreditLedger, string PostingTarget)>();
            var ledgerGroupSums = new Dictionary<(int ExpenseLedgerID, int CreditLedgerID), decimal>();

            foreach (var item in validItems)
            {
                decimal itemInterest = Math.Round(item.CalculatedInterest, 0, MidpointRounding.AwayFromZero);

                if (!accounts.TryGetValue(item.FdAccountID, out var acc))
                {
                    return BadRequest($"खाते आयडी {item.FdAccountID} सापडले नाही.");
                }

                if (!accountLedgerPairs.TryGetValue(acc.FdAccountID, out var pair))
                {
                    string effectiveTarget = ResolveEffectiveFdPostingTarget(req.PostingTarget, acc.FdScheme, req.CalculationMethod);
                    bool postToPrincipal = effectiveTarget == "Principal";

                    var expLedger = await ResolveInterestExpenseLedgerAsync(acc.FdScheme);
                    var creditLedger = postToPrincipal
                        ? await ResolveFdLiabilityLedgerAsync(acc.FdScheme)
                        : await ResolveInterestPayableLedgerAsync(acc.FdScheme);

                    if (expLedger == null || creditLedger == null)
                    {
                        string schemeInfo = acc.FdScheme != null ? $"योजना: {acc.FdScheme.SchemeName}" : "योजना सापडली नाही";
                        string missingTargetLabel = postToPrincipal
                            ? "मुदत ठेव दायित्व (FD Liability)"
                            : "देय व्याज (Interest Payable)";
                        return BadRequest($"खाते क्र. {acc.AccountNo} ({schemeInfo}) साठी व्याज खर्च (Interest Expense) किंवा {missingTargetLabel} लेजर कॉन्फिगर केलेले नाही.");
                    }

                    pair = (expLedger, creditLedger, effectiveTarget);
                    accountLedgerPairs[acc.FdAccountID] = pair;
                }

                var key = (pair.ExpenseLedger.LedgerID, pair.CreditLedger.LedgerID);
                if (!ledgerGroupSums.ContainsKey(key))
                {
                    ledgerGroupSums[key] = 0;
                }
                ledgerGroupSums[key] += itemInterest;
            }

            decimal totalProvisionAmount = validItems.Sum(x => Math.Round(x.CalculatedInterest, 0, MidpointRounding.AwayFromZero));
            bool allPostedToPrincipal = accountLedgerPairs.Values.All(p => p.PostingTarget == "Principal");
            bool anyPostedToPrincipal = accountLedgerPairs.Values.Any(p => p.PostingTarget == "Principal");

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    var voucher = new Voucher
                    {
                        BranchID = req.BranchID,
                        VoucherNo = allPostedToPrincipal
                            ? $"JV-FD-CAP-BR{req.BranchID}-{req.AccrualDate:yyyyMMdd}-{DateTime.Now:HHmmss}"
                            : $"JV-FD-PROV-BR{req.BranchID}-{req.AccrualDate:yyyyMMdd}-{DateTime.Now:HHmmss}",
                        VoucherDate = req.AccrualDate,
                        VoucherType = "Journal",
                        TotalAmount = totalProvisionAmount,
                        Narration = allPostedToPrincipal
                            ? $"ग्राहक-निहाय मुदत ठेव मुद्दलात व्याज जमा (FD Interest Capitalized to Deposits [{req.CalculationMethod}]): {req.AccrualDate:dd/MM/yyyy}"
                            : (anyPostedToPrincipal
                                ? $"ग्राहक-निहाय मुदत ठेव व्याज पोस्टिंग व तरतूद (FD Interest Capitalization/Provision [{req.CalculationMethod}]): {req.AccrualDate:dd/MM/yyyy}"
                                : $"ग्राहक-निहाय मुदत ठेव व्याज तरतूद (Customer-wise FD Interest Provision [{req.CalculationMethod}]): {req.AccrualDate:dd/MM/yyyy}"),
                        CreatedBy = 1,
                        CreatedOn = DateTime.Now
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    int postedCount = 0;
                    foreach (var item in validItems)
                    {
                        decimal itemInterest = Math.Round(item.CalculatedInterest, 0, MidpointRounding.AwayFromZero);
                        var acc = accounts[item.FdAccountID];
                        string effTarget = accountLedgerPairs[acc.FdAccountID].PostingTarget;
                        bool postToPrincipal = effTarget == "Principal";

                        var log = new FdInterestAccrual
                        {
                            BranchID = req.BranchID,
                            FdAccountID = acc.FdAccountID,
                            VoucherID = voucher.VoucherID,
                            AccrualDate = req.AccrualDate,
                            CalculatedDays = item.ElapsedDays,
                            InterestAmount = itemInterest,
                            IsPosted = true,
                            PostingTarget = effTarget
                        };
                        _context.FdInterestAccruals.Add(log);

                        var tx = new FdTransaction
                        {
                            BranchID = req.BranchID,
                            FdAccountID = acc.FdAccountID,
                            VoucherID = voucher.VoucherID,
                            TransactionDate = req.AccrualDate,
                            TransactionType = postToPrincipal ? "Interest_Capitalized" : "Accrual",
                            DebitCredit = "Cr",
                            Amount = itemInterest
                        };
                        _context.FdTransactions.Add(tx);
                        acc.LastInterestPostingDate = req.AccrualDate;
                        postedCount++;
                    }

                    // Post scheme-wise / ledger-wise balanced Dr and Cr entries
                    foreach (var kvp in ledgerGroupSums)
                    {
                        int expLedgerId = kvp.Key.ExpenseLedgerID;
                        int creditLedgerId = kvp.Key.CreditLedgerID;
                        decimal grpAmount = kvp.Value;

                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = expLedgerId,
                            DrCr = "Dr",
                            Amount = grpAmount
                        });

                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = creditLedgerId,
                            DrCr = "Cr",
                            Amount = grpAmount
                        });
                    }

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok(new {
                        Message = allPostedToPrincipal
                            ? $"✅ एकूण {postedCount} ग्राहकांच्या मुदत ठेव खात्यांत (ठेवी दायित्व) ₹ {totalProvisionAmount:N0} व्याज मुद्दलात जमा झाले!"
                            : $"✅ एकूण {postedCount} ग्राहकांच्या खात्यांवर ₹ {totalProvisionAmount:N0} व्याज यशस्वीरित्या पोस्ट झाले!",
                        VoucherNo = voucher.VoucherNo,
                        TotalAmount = totalProvisionAmount,
                        PostedCount = postedCount,
                        PostingTarget = allPostedToPrincipal ? "Principal" : (anyPostedToPrincipal ? "Mixed" : "Provision")
                    });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("व्याज पोस्ट करताना त्रुटी आली: " + ex.Message);
                }
            }
        }

        // GET: api/FdAccounts/MemberLedger/5 or api/FdAccounts/CustomerLedger/5
        [HttpGet("MemberLedger/{memberId}")]
        [HttpGet("CustomerLedger/{customerId}")]
        public async Task<IActionResult> GetMemberFdLedger(
            int? memberId, 
            int? customerId, 
            [FromQuery] DateTime? fromDate = null, 
            [FromQuery] DateTime? toDate = null, 
            [FromQuery] int? fdAccountId = null)
        {
            Customer? customer = null;
            Member? member = null;

            if (customerId.HasValue && customerId.Value > 0)
            {
                customer = await _context.Customers.Include(c => c.Branch).FirstOrDefaultAsync(c => c.CustomerID == customerId.Value);
                if (customer != null)
                {
                    member = await _context.Members.Include(m => m.Customer).Include(m => m.Branch).FirstOrDefaultAsync(m => m.CustomerID == customer.CustomerID);
                }
            }
            else
            {
                int lookupId = memberId ?? customerId ?? 0;
                if (lookupId <= 0) return BadRequest("वैध सभासद किंवा ग्राहक आयडी आवश्यक आहे.");

                customer = await _context.Customers.Include(c => c.Branch).FirstOrDefaultAsync(c => c.CustomerID == lookupId);
                if (customer != null)
                {
                    member = await _context.Members.Include(m => m.Customer).Include(m => m.Branch).FirstOrDefaultAsync(m => m.CustomerID == customer.CustomerID);
                }
                else
                {
                    member = await _context.Members.Include(m => m.Customer).Include(m => m.Branch).FirstOrDefaultAsync(m => m.MemberID == lookupId);
                    if (member?.CustomerID != null)
                    {
                        customer = await _context.Customers.Include(c => c.Branch).FirstOrDefaultAsync(c => c.CustomerID == member.CustomerID.Value);
                    }
                }
            }

            if (member == null && customer == null) return NotFound("सभासद किंवा ग्राहक सापडला नाही.");

            int ownerBranchId = customer?.BranchID ?? member?.BranchID ?? 0;
            if (ownerBranchId > 0 && !User.CanAccessBranch(ownerBranchId))
            {
                return StatusCode(403, new { message = "आपल्याला इतर शाखेतील खातेदाराची माहिती पाहण्याची परवानगी नाही." });
            }

            int? targetCustId = customer?.CustomerID ?? member?.CustomerID;
            int? targetMemId = member?.MemberID;

            var accountsQuery = _context.FdAccounts
                .Include(a => a.FdScheme)
                .Where(a => targetCustId != null && a.CustomerID == targetCustId)
                .AsQueryable();

            if (fdAccountId.HasValue && fdAccountId.Value > 0)
            {
                accountsQuery = accountsQuery.Where(a => a.FdAccountID == fdAccountId.Value);
            }

            var accounts = await accountsQuery
                .OrderBy(a => a.AccountNo)
                .ThenBy(a => a.FdAccountID)
                .ToListAsync();

            var accountIds = accounts.Select(a => a.FdAccountID).ToList();
            var accrualDateRows = await _context.FdInterestAccruals
                .AsNoTracking()
                .Where(a => accountIds.Contains(a.FdAccountID))
                .Select(a => new { a.FdAccountID, a.AccrualDate })
                .ToListAsync();
            var accrualDatesLookup = accrualDateRows.ToLookup(x => x.FdAccountID, x => x.AccrualDate);

            var misDateRows = await _context.FdMisPayouts
                .AsNoTracking()
                .Where(m => accountIds.Contains(m.FdAccountID) && m.Status == "Success")
                .Select(m => new { m.FdAccountID, m.PayoutDate })
                .ToListAsync();
            var misDatesLookup = misDateRows.ToLookup(x => x.FdAccountID, x => x.PayoutDate);

            var accountLedgerList = new List<object>();

            foreach (var acc in accounts)
            {
                var rawTransactions = await _context.FdTransactions
                    .Include(t => t.Voucher)
                    .Where(t => t.FdAccountID == acc.FdAccountID)
                    .ToListAsync();

                // Calculate pre-closure recorded accruals in FdTransactions (excluding Closure_Interest)
                decimal preClosureAccrualSum = rawTransactions
                    .Where(t => string.Equals(t.TransactionType, "Accrual", StringComparison.OrdinalIgnoreCase)
                             || string.Equals(t.TransactionType, "Interest_Capitalized", StringComparison.OrdinalIgnoreCase))
                    .Sum(t => t.Amount);

                DateTime resolvedLegacyIntDate = Helpers.FdLedgerHelper.ResolveLegacyOpeningInterestDate(
                    acc,
                    rawTransactions,
                    accrualDatesLookup[acc.FdAccountID],
                    misDatesLookup[acc.FdAccountID]);
                string openingVoucherNo = $"JV-FD-OP-{acc.AccountNo}";

                // Structured transaction list with unified typing
                var fullTxList = rawTransactions.Select(t =>
                {
                    string drcr = t.DebitCredit?.Trim() ?? "";
                    if (string.IsNullOrEmpty(drcr))
                    {
                        string tt = (t.TransactionType ?? "").ToLowerInvariant();
                        if (tt.Contains("opening") || tt.Contains("deposit") || tt.Contains("accrual") || tt.Contains("interest"))
                            drcr = "Cr";
                        else
                            drcr = "Dr";
                    }

                    string rawNarration = t.Voucher?.Narration ?? "";
                    string rawVoucherNo = t.Voucher != null ? t.Voucher.VoucherNo : "";
                    string vnUpper = rawVoucherNo.ToUpper();
                    string ttLower = (t.TransactionType ?? "").ToLower();
                    string legPart = !string.IsNullOrWhiteSpace(acc.LegacyAccountNumber) ? $" (जुनी पावती: {acc.LegacyAccountNumber.Trim()})" : "";
                    bool isOpeningVoucherAccrual = ttLower == "accrual"
                        && string.Equals(rawVoucherNo, openingVoucherNo, StringComparison.OrdinalIgnoreCase);

                    DateTime effectiveTxDate = (isOpeningVoucherAccrual && t.TransactionDate.Date == acc.OpeningDate.Date && resolvedLegacyIntDate > acc.OpeningDate.Date)
                        ? resolvedLegacyIntDate
                        : t.TransactionDate;

                    string narration = "";

                    if (ttLower == "closure_interest" || ttLower == "interest_capitalized")
                    {
                        narration = rawNarration.Contains("मुदतपूर्व") || vnUpper.Contains("PRECLOSE")
                            ? "मुदतपूर्व व्याज जमा"
                            : (rawNarration.Contains("मुदतपूर्ती") || vnUpper.Contains("MAT") || vnUpper.Contains("CLOSE")
                                ? "मुदतपूर्ती व्याज जमा"
                                : "मुदत ठेव व्याज जमा");
                    }
                    else if (ttLower == "accrual")
                    {
                        narration = isOpeningVoucherAccrual || vnUpper.Contains("LEG-INT")
                            ? $"साचलेले जुने व्याज जमा{legPart}"
                            : (rawNarration.Contains("मुदतपूर्व") || vnUpper.Contains("PRECLOSE")
                                ? "मुदतपूर्व व्याज जमा"
                                : (rawNarration.Contains("मुदतपूर्ती") || vnUpper.Contains("MAT") || vnUpper.Contains("CLOSE")
                                    ? "मुदतपूर्ती व्याज जमा"
                                    : "मुदत ठेव व्याज जमा"));
                    }
                    else if (ttLower.Contains("premature") || vnUpper.Contains("PRECLOSE") || rawNarration.Contains("मुदतपूर्व बंद") || rawNarration.Contains("Premature Close"))
                    {
                        narration = "मुदतपूर्व बंद परतावा";
                    }
                    else if (ttLower.Contains("matur") || vnUpper.Contains("MAT") || vnUpper.Contains("CLOSE") || rawNarration.Contains("मुदतपूर्ती") || rawNarration.Contains("Maturity"))
                    {
                        narration = "मुदतपूर्ती परतावा";
                    }
                    else if (ttLower == "opening" || vnUpper.Contains("FD-OP") || rawNarration.Contains("खाते उघडले") || rawNarration.Contains("Account Opened") || rawNarration.Contains("आरंभिक") || rawNarration.Contains("Migration"))
                    {
                        narration = Helpers.FdLedgerHelper.BuildOpeningDepositNarration(acc);
                    }
                    else if (ttLower.Contains("renew") || vnUpper.Contains("REN") || rawNarration.Contains("नूतनीकरण") || rawNarration.Contains("Renewal"))
                    {
                        narration = "मुदत ठेव नूतनीकरण";
                    }
                    else if (vnUpper.Contains("INT") || vnUpper.Contains("PROV") || rawNarration.Contains("व्याज जमा") || rawNarration.Contains("व्याज तरतूद") || rawNarration.Contains("Accrued Interest"))
                    {
                        narration = rawNarration.Contains("मुदतपूर्व") || vnUpper.Contains("PRECLOSE")
                            ? "मुदतपूर्व व्याज जमा"
                            : (rawNarration.Contains("मुदतपूर्ती") || vnUpper.Contains("MAT") ? "मुदतपूर्ती व्याज जमा" : "मुदत ठेव व्याज जमा");
                    }
                    else if (string.IsNullOrWhiteSpace(rawNarration) || rawNarration.Contains("???") || rawNarration.Contains("????"))
                    {
                        narration = "मुदत ठेव व्यवहार";
                    }
                    else
                    {
                        // Clean verbose narration into concise Marathi
                        narration = rawNarration
                            .Replace(" (FD Account Opened - Cash)", "")
                            .Replace(" (Premature Close - Cash)", "")
                            .Replace(" (Maturity Payout - Cash)", "")
                            .Trim();
                        if (string.IsNullOrWhiteSpace(narration)) narration = "मुदत ठेव व्यवहार";
                    }

                    return new
                    {
                        t.FdTransactionID,
                        TransactionDate = effectiveTxDate,
                        t.TransactionType,
                        DebitCredit = drcr,
                        t.Amount,
                        VoucherNo = rawVoucherNo,
                        Narration = narration
                    };
                }).ToList();

                // Ensure Opening deposit entry is always present at OpeningDate even if missing in FdTransactions
                if (acc.DepositAmount > 0 && !rawTransactions.Any(t => string.Equals(t.TransactionType, "Opening", StringComparison.OrdinalIgnoreCase)))
                {
                    fullTxList.Add(new
                    {
                        FdTransactionID = -3,
                        TransactionDate = acc.OpeningDate,
                        TransactionType = "Opening",
                        DebitCredit = "Cr",
                        Amount = acc.DepositAmount,
                        VoucherNo = openingVoucherNo,
                        Narration = Helpers.FdLedgerHelper.BuildOpeningDepositNarration(acc)
                    });
                }

                // If legacy accrued interest exists but was missing from FdTransactions, synthesize virtual opening accrual entry
                if (acc.IsLegacyAccount && acc.LegacyAccruedInt > 0 && preClosureAccrualSum < acc.LegacyAccruedInt)
                {
                    decimal missingLegacyInt = acc.LegacyAccruedInt - preClosureAccrualSum;
                    string legPart = !string.IsNullOrWhiteSpace(acc.LegacyAccountNumber) ? $" (जुनी पावती: {acc.LegacyAccountNumber.Trim()})" : "";
                    fullTxList.Add(new
                    {
                        FdTransactionID = -1,
                        TransactionDate = resolvedLegacyIntDate,
                        TransactionType = "Accrual",
                        DebitCredit = "Cr",
                        Amount = missingLegacyInt,
                        VoucherNo = "LEG-INT-MIG",
                        Narration = $"साचलेले जुने व्याज जमा{legPart}"
                    });
                }

                // If FD was closed or renewed with total payout/transfer > principal/net liability, synthesize uncredited closure/renewal interest entry
                var closeTx = fullTxList.FirstOrDefault(t => t.DebitCredit == "Dr" && (
                    t.TransactionType == "Premature_Close" ||
                    t.TransactionType == "PrematureClose" ||
                    t.TransactionType == "Maturity" ||
                    t.TransactionType == "Closure" ||
                    t.TransactionType == "Payout" ||
                    t.TransactionType == "Renewal" ||
                    (!string.IsNullOrEmpty(t.VoucherNo) && (t.VoucherNo.Contains("PRECLOSE") || t.VoucherNo.Contains("CLOSE") || t.VoucherNo.Contains("REN")))));
                if (closeTx != null)
                {
                    decimal totalCrBeforeClosure = fullTxList.Where(t => t != closeTx && t.DebitCredit == "Cr").Sum(t => t.Amount);
                    decimal otherDr = fullTxList.Where(t => t != closeTx && t.DebitCredit == "Dr").Sum(t => t.Amount);
                    decimal netLiabilityBeforeClosure = totalCrBeforeClosure - otherDr;

                    if (closeTx.Amount > netLiabilityBeforeClosure && (closeTx.Amount - netLiabilityBeforeClosure) >= 0.01m)
                    {
                        decimal closureInterest = Math.Round(closeTx.Amount - netLiabilityBeforeClosure, 2);
                        bool alreadySynthesized = fullTxList.Any(t => t.FdTransactionID == -2);
                        if (!alreadySynthesized)
                        {
                            bool isPremature = (closeTx.TransactionType ?? "").Contains("Premature") || (!string.IsNullOrEmpty(closeTx.VoucherNo) && closeTx.VoucherNo.Contains("PRECLOSE"));
                            bool isRenewal = closeTx.TransactionType == "Renewal" || (!string.IsNullOrEmpty(closeTx.VoucherNo) && closeTx.VoucherNo.Contains("REN"));
                            fullTxList.Add(new
                            {
                                FdTransactionID = -2,
                                TransactionDate = closeTx.TransactionDate,
                                TransactionType = "Closure_Interest",
                                DebitCredit = "Cr",
                                Amount = closureInterest,
                                VoucherNo = closeTx.VoucherNo,
                                Narration = isPremature ? "मुदतपूर्व व्याज जमा" : (isRenewal ? "नूतनीकरण मुदतपूर्ती व्याज जमा" : "मुदतपूर्ती व्याज जमा")
                            });
                        }
                    }
                }

                decimal totalAccruedInt = fullTxList
                    .Where(t => t.DebitCredit == "Cr" && Helpers.FdLedgerHelper.IsInterestTransaction(t.TransactionType, t.VoucherNo))
                    .Sum(t => t.Amount);

                // Sort chronologically: Opening deposit Cr (0) -> Pre-closure interest Cr (1) -> Closure interest Cr (2) -> Payout Dr (4)
                var sortedTxList = fullTxList
                    .OrderBy(t => t.TransactionDate.Date)
                    .ThenBy(t => Helpers.FdLedgerHelper.ResolveTransactionSortRank(t.TransactionType, t.DebitCredit, t.VoucherNo))
                    .ThenBy(t => t.FdTransactionID)
                    .ToList();

                // Compute opening balance before fromDate (if filtered)
                decimal openingBal = 0m;
                decimal openingPrincipalBal = 0m;
                decimal openingInterestBal = 0m;
                DateTime? filterFrom = fromDate?.Date;
                DateTime? filterTo = toDate?.Date;

                if (filterFrom.HasValue)
                {
                    var prePeriodTxs = sortedTxList
                        .Where(t => t.TransactionDate.Date < filterFrom.Value)
                        .Select(t => ((string?)t.TransactionType, t.DebitCredit, t.Amount, (string?)t.VoucherNo));
                    (openingBal, openingPrincipalBal, openingInterestBal) = Helpers.FdLedgerHelper.SplitOpeningBalances(prePeriodTxs);
                }

                // Filter transactions within selected period
                var periodTxs = sortedTxList.Where(t =>
                {
                    if (filterFrom.HasValue && t.TransactionDate.Date < filterFrom.Value) return false;
                    if (filterTo.HasValue && t.TransactionDate.Date > filterTo.Value) return false;
                    return true;
                }).ToList();

                decimal runningBal = openingBal;
                decimal periodTotalDebit = 0m;
                decimal periodTotalCredit = 0m;

                var finalLedgerRows = new List<object>();

                foreach (var tx in periodTxs)
                {
                    decimal drAmt = tx.DebitCredit == "Dr" ? tx.Amount : 0m;
                    decimal crAmt = tx.DebitCredit == "Cr" ? tx.Amount : 0m;

                    runningBal += (crAmt - drAmt);
                    if (Math.Abs(runningBal) < 0.0001m) runningBal = 0m;
                    periodTotalDebit += drAmt;
                    periodTotalCredit += crAmt;

                    finalLedgerRows.Add(new
                    {
                        tx.FdTransactionID,
                        TransactionDate = tx.TransactionDate.ToString("yyyy-MM-dd"),
                        tx.TransactionType,
                        tx.DebitCredit,
                        Debit = drAmt,
                        Credit = crAmt,
                        Balance = runningBal,
                        tx.Amount,
                        tx.VoucherNo,
                        tx.Narration
                    });
                }

                // Check if FD has an active loan lien
                bool isLien = acc.IsLienMarked;
                string lienLoanNo = acc.LienLoanAccountNo ?? "";
                if (!isLien && !string.IsNullOrWhiteSpace(acc.LienLoanAccountNo))
                {
                    isLien = true;
                }

                accountLedgerList.Add(new
                {
                    acc.FdAccountID,
                    acc.AccountNo,
                    acc.LegacyAccountNumber,
                    OpeningDate = acc.OpeningDate.ToString("yyyy-MM-dd"),
                    MaturityDate = acc.MaturityDate.ToString("yyyy-MM-dd"),
                    acc.DepositAmount,
                    acc.InterestRate,
                    acc.MaturityAmount,
                    acc.Status,
                    acc.PaymentMode,
                    acc.NomineeName,
                    acc.NomineeRelation,
                    DurationType = acc.DurationType ?? "Months",
                    DurationValue = acc.DurationValue ?? (acc.FdScheme != null ? acc.FdScheme.DurationMonths : 12),
                    DurationInDays = acc.DurationInDays ?? 0,
                    IsLienMarked = isLien,
                    LienLoanAccountNo = lienLoanNo,
                    LienAmount = acc.LienAmount ?? 0m,
                    acc.Remarks,
                    SchemeName = acc.FdScheme != null ? acc.FdScheme.SchemeName : "Standard Scheme",
                    DurationMonths = acc.FdScheme != null ? acc.FdScheme.DurationMonths : 12,
                    TotalAccruedInterest = totalAccruedInt,
                    OpeningBalance = openingBal,
                    OpeningPrincipalBalance = openingPrincipalBal,
                    OpeningInterestBalance = openingInterestBal,
                    PeriodTotalDebit = periodTotalDebit,
                    PeriodTotalCredit = periodTotalCredit,
                    ClosingBalance = ((acc.Status == "Closed" || acc.Status == "Closed-Premature") && Math.Abs(runningBal) < 0.01m) ? 0m : runningBal,
                    Transactions = finalLedgerRows
                });
            }

            string fullName = customer != null
                ? $"{customer.FirstName} {customer.MiddleName} {customer.LastName}".Replace("  ", " ").Trim()
                : (member?.Customer != null ? $"{member.Customer.FirstName} {member.Customer.MiddleName} {member.Customer.LastName}".Replace("  ", " ").Trim() : "");

            if (string.IsNullOrWhiteSpace(fullName))
            {
                fullName = customer != null 
                    ? $"{customer.FirstNameEng} {customer.MiddleNameEng} {customer.LastNameEng}".Replace("  ", " ").Trim()
                    : (member?.Customer != null ? $"{member.Customer.FirstNameEng} {member.Customer.MiddleNameEng} {member.Customer.LastNameEng}".Replace("  ", " ").Trim() : "");
            }

            return Ok(new
            {
                CustomerID = targetCustId ?? 0,
                CustomerName = fullName,
                MemberID = targetMemId ?? (customer?.CustomerID ?? 0),
                MemberCode = member?.MemberCode ?? (customer?.CIFNo ?? ""),
                CIFNo = customer?.CIFNo ?? member?.Customer?.CIFNo ?? "",
                MemberName = fullName,
                MobileNo = customer?.MobileNo ?? member?.Customer?.MobileNo ?? "",
                Address = customer?.Address ?? member?.Customer?.Address ?? "",
                BranchName = customer?.Branch?.BranchName ?? member?.Branch?.BranchName ?? "मुख्य शाखा",
                TotalFDAccountsCount = accounts.Count,
                TotalPrincipalInvested = accounts.Sum(a => a.DepositAmount),
                TotalMaturityValue = accounts.Sum(a => a.MaturityAmount),
                FromDate = fromDate?.ToString("yyyy-MM-dd"),
                ToDate = toDate?.ToString("yyyy-MM-dd"),
                Accounts = accountLedgerList
            });
        }

        // POST: api/FdAccounts/SyncOpeningBalances
        [HttpPost("SyncOpeningBalances")]
        public async Task<IActionResult> SyncOpeningBalances()
        {
            try
            {
                var result = await SyncFdOpeningBalancesInternalAsync();
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "आर्थिक पत्रक सिंक करताना त्रुटी आली: " + ex.Message });
            }
        }

        private async Task<object> SyncFdOpeningBalancesInternalAsync()
        {
            return await Helpers.FdOpeningBalanceSyncHelper.SyncAllFdOpeningBalancesAsync(_context);
        }

        private async Task<Ledger?> ResolveFdLiabilityLedgerAsync(FdScheme? scheme)
        {
            if (scheme?.FdLiabilityLedger != null && scheme.FdLiabilityLedger.IsActive)
                return scheme.FdLiabilityLedger;

            if (scheme?.FdLiabilityLedgerID.HasValue == true && scheme.FdLiabilityLedgerID.Value > 0)
            {
                var ledger = await _context.Ledgers.FindAsync(scheme.FdLiabilityLedgerID.Value);
                if (ledger != null && ledger.IsActive) return ledger;
            }

            return await _context.Ledgers.FirstOrDefaultAsync(l => l.IsActive && (
                (l.GroupID == 4 && (l.LedgerName.Contains("मुदतबंद") || l.LedgerName.Contains("मुदत") || l.AccountType == "FD")) ||
                l.LedgerName.Contains("मेंबर मुदतबंद ठेव") ||
                l.LedgerName.Contains("मुदतबंद ठेव") ||
                l.LedgerName.Contains("मुदत ठेव") ||
                l.LedgerName.ToLower().Contains("fixed deposit")
            ));
        }

        private async Task<Ledger?> ResolveInterestPayableLedgerAsync(FdScheme? scheme)
        {
            if (scheme?.InterestPayableLedger != null && scheme.InterestPayableLedger.IsActive)
                return scheme.InterestPayableLedger;

            if (scheme?.InterestPayableLedgerID.HasValue == true && scheme.InterestPayableLedgerID.Value > 0)
            {
                var ledger = await _context.Ledgers.FindAsync(scheme.InterestPayableLedgerID.Value);
                if (ledger != null && ledger.IsActive) return ledger;
            }

            var anySchemePayableId = await _context.FdSchemes
                .Where(s => s.IsActive && s.InterestPayableLedgerID.HasValue && s.InterestPayableLedgerID.Value > 0)
                .Select(s => s.InterestPayableLedgerID!.Value)
                .FirstOrDefaultAsync();

            if (anySchemePayableId > 0)
            {
                var ledger = await _context.Ledgers.FindAsync(anySchemePayableId);
                if (ledger != null && ledger.IsActive) return ledger;
            }

            return await _context.Ledgers.FirstOrDefaultAsync(l => l.IsActive && (
                ((l.GroupID == 6 || l.GroupID == 24 || l.AccountType == "Personal Account" || l.AccountType == "Liability") && 
                 l.LedgerName.Contains("देणे") && l.LedgerName.Contains("व्याज")) ||
                l.LedgerName.Contains("देणे मुदत ठेवीवरील व्याज") ||
                l.LedgerName.Contains("देणे मुदत ठेव व्याज") ||
                l.LedgerName.Contains("देणे सभासद ठेव व्याज") ||
                l.LedgerName.ToLower().Contains("interest payable")
            ));
        }

        private async Task<Ledger?> ResolveInterestExpenseLedgerAsync(FdScheme? scheme)
        {
            if (scheme?.InterestExpenseLedger != null && scheme.InterestExpenseLedger.IsActive)
                return scheme.InterestExpenseLedger;

            if (scheme?.InterestExpenseLedgerID.HasValue == true && scheme.InterestExpenseLedgerID.Value > 0)
            {
                var ledger = await _context.Ledgers.FindAsync(scheme.InterestExpenseLedgerID.Value);
                if (ledger != null && ledger.IsActive) return ledger;
            }

            var anySchemeExpenseId = await _context.FdSchemes
                .Where(s => s.IsActive && s.InterestExpenseLedgerID.HasValue && s.InterestExpenseLedgerID.Value > 0)
                .Select(s => s.InterestExpenseLedgerID!.Value)
                .FirstOrDefaultAsync();

            if (anySchemeExpenseId > 0)
            {
                var ledger = await _context.Ledgers.FindAsync(anySchemeExpenseId);
                if (ledger != null && ledger.IsActive) return ledger;
            }

            return await _context.Ledgers.FirstOrDefaultAsync(l => l.IsActive && (
                ((l.GroupID == 17 || l.GroupID == 67 || l.AccountType == "Expenses" || l.AccountType == "Indirect Expenses") && 
                 !l.LedgerName.Contains("देणे") && (l.LedgerName.Contains("मुदत") || l.LedgerName.Contains("व्याज"))) ||
                l.LedgerName.Contains("मुदत ठेवीवरील व्याज") ||
                l.LedgerName.ToLower().Contains("interest expense")
            ));
        }

        private async Task<Ledger?> ResolveClawbackLedgerAsync(FdScheme? scheme)
        {
            if (scheme?.PrematurePenaltyLedger != null && scheme.PrematurePenaltyLedger.IsActive)
                return scheme.PrematurePenaltyLedger;

            if (scheme?.PrematurePenaltyLedgerID.HasValue == true && scheme.PrematurePenaltyLedgerID.Value > 0)
            {
                var ledger = await _context.Ledgers.FindAsync(scheme.PrematurePenaltyLedgerID.Value);
                if (ledger != null && ledger.IsActive) return ledger;
            }

            return await ResolveInterestExpenseLedgerAsync(scheme);
        }

        // =========================================================================
        // CBS AUTO-RENEWAL WORKFLOW SUITE (आरबीआय व सीबीएस मानकांनुसार स्वयंचलित नूतनीकरण)
        // =========================================================================

        // GET: api/FdAccounts/AutoRenewalCandidates
        [HttpGet("AutoRenewalCandidates")]
        public async Task<IActionResult> GetAutoRenewalCandidates([FromQuery] int? branchId = null, [FromQuery] DateTime? asOfDate = null)
        {
            DateTime targetDate = asOfDate?.Date ?? DateTime.Today;

            var query = _context.FdAccounts
                .AsNoTracking()
                .AsSplitQuery()
                .Include(a => a.Customer)
                .Include(a => a.Branch)
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.Slabs)
                .Include(a => a.SavingAccount)
                .Where(a => (a.Status == "Active" || a.Status == "Matured") && a.IsAutoRenewable && a.MaturityDate.Date <= targetDate && a.AutoRenewalCount < a.MaxAutoRenewalCycles);

            var (isHO, userBranchId) = GetUserBranchInfo();
            if (!isHO && userBranchId.HasValue && userBranchId.Value > 0)
            {
                query = query.Where(a => a.BranchID == userBranchId.Value);
            }
            else if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(a => a.BranchID == branchId.Value);
            }

            // 🛡️ Security: Exclude lien-marked accounts from auto-renewal
            query = query.Where(a => !a.IsLienMarked);

            var accounts = await query.OrderBy(a => a.MaturityDate).ToListAsync();
            var candidateDtos = new List<AutoRenewalCandidateDto>();

            foreach (var acc in accounts)
            {
                bool isSenior = acc.Customer?.BirthDate.HasValue == true && (acc.Customer.BirthDate.Value.Date <= acc.MaturityDate.Date.AddYears(-60));

                var accruedFromTx = await _context.FdTransactions
                    .Where(t => t.FdAccountID == acc.FdAccountID && t.TransactionType == "Accrual")
                    .SumAsync(t => (decimal?)t.Amount) ?? 0m;

                bool isOldPeriodicScheme = acc.FdScheme != null && (acc.FdScheme.InterestType == "MIS" || acc.FdScheme.InterestType == "Monthly Interest");
                decimal accruedInt = isOldPeriodicScheme
                    ? 0m
                    : ((acc.MaturityAmount > acc.DepositAmount)
                        ? (acc.MaturityAmount - acc.DepositAmount)
                        : Math.Max(accruedFromTx, acc.LegacyAccruedInt));

                decimal totalMaturity = acc.DepositAmount + accruedInt;
                decimal projectedRenewed = (acc.AutoRenewalOption == "PrincipalOnly") ? acc.DepositAmount : totalMaturity;
                decimal projectedPayout = (acc.AutoRenewalOption == "PrincipalOnly") ? accruedInt : 0m;

                string durType = !string.IsNullOrWhiteSpace(acc.DurationType) ? acc.DurationType : (acc.FdScheme?.DurationType ?? "Months");
                int durVal = acc.DurationValue.HasValue && acc.DurationValue.Value > 0 ? acc.DurationValue.Value : (acc.FdScheme?.DurationMonths > 0 ? acc.FdScheme.DurationMonths : 12);
                DateTime projectedMatDate = durType.Equals("Days", StringComparison.OrdinalIgnoreCase)
                    ? acc.MaturityDate.AddDays(durVal)
                    : (durType.Equals("Years", StringComparison.OrdinalIgnoreCase) ? acc.MaturityDate.AddYears(durVal) : acc.MaturityDate.AddMonths(durVal));
                int totalDays = (int)(projectedMatDate - acc.MaturityDate).TotalDays;

                decimal prevailingRate = acc.InterestRate;
                if (acc.FdScheme != null)
                {
                    if (acc.FdScheme.SchemeDurationModel == "Slab")
                    {
                        var slab = acc.FdScheme.Slabs?.FirstOrDefault(s => totalDays >= s.FromDays && totalDays <= s.ToDays && s.IsActive);
                        if (slab != null)
                        {
                            prevailingRate = isSenior ? slab.SeniorCitizenRate : slab.InterestRate;
                        }
                        else
                        {
                            prevailingRate = isSenior ? acc.FdScheme.SeniorCitizenInterestRate : acc.FdScheme.InterestRate;
                        }
                    }
                    else
                    {
                        prevailingRate = isSenior ? acc.FdScheme.SeniorCitizenInterestRate : acc.FdScheme.InterestRate;
                    }
                }

                var activeLoans = await _context.LoanAccounts
                    .Where(l => l.CustomerID == acc.CustomerID && l.Status == "Active" && (l.PrincipalBalance > 0 || l.InterestBalance > 0 || l.OverdueInterestBalance > 0))
                    .ToListAsync();
                bool hasLoan = activeLoans.Any();
                decimal loanBal = activeLoans.Sum(l => l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance);

                candidateDtos.Add(new AutoRenewalCandidateDto
                {
                    FdAccountID = acc.FdAccountID,
                    AccountNo = acc.AccountNo,
                    ReceiptNo = Helpers.FdRenewalPolicyHelper.GetEffectiveReceiptNo(acc),
                    RenewalCycleNo = acc.RenewalCycleNo,
                    CustomerID = acc.CustomerID,
                    CustomerName = acc.Customer?.CustomerName ?? "सभासद",
                    ContactNo = acc.Customer?.MobileNo,
                    BranchID = acc.BranchID,
                    BranchName = acc.Branch?.BranchName ?? $"Branch {acc.BranchID}",
                    FdSchemeID = acc.FdSchemeID,
                    SchemeName = acc.FdScheme?.SchemeName ?? "मुदत ठेव",
                    OpeningDate = acc.OpeningDate,
                    MaturityDate = acc.MaturityDate,
                    DepositAmount = acc.DepositAmount,
                    MaturityAmount = acc.MaturityAmount,
                    InterestRate = acc.InterestRate,
                    DurationType = durType,
                    DurationValue = durVal,
                    DurationInDays = totalDays,
                    IsAutoRenewable = acc.IsAutoRenewable,
                    AutoRenewalOption = acc.AutoRenewalOption ?? "PrincipalPlusInterest",
                    AutoRenewalCount = acc.AutoRenewalCount,
                    MaxAutoRenewalCycles = acc.MaxAutoRenewalCycles,
                    SavingAccountID = acc.SavingAccountID,
                    SavingAccountNo = acc.SavingAccount?.AccountNo,
                    SavingBalance = acc.SavingAccount?.CurrentBalance,
                    HasActiveLoan = hasLoan,
                    ActiveLoanBalance = loanBal,
                    ProjectedRenewedAmount = projectedRenewed,
                    ProjectedInterestPayout = projectedPayout,
                    PrevailingRate = prevailingRate
                });
            }

            return Ok(candidateDtos);
        }

        // POST: api/FdAccounts/RunAutoRenewalBatch
        [HttpPost("RunAutoRenewalBatch")]
        [Authorize(Roles = "Admin,SuperAdmin,Manager")]
        public async Task<IActionResult> RunAutoRenewalBatch([FromBody] AutoRenewalBatchRequest? request)
        {
            DateTime processDate = request?.ProcessDate?.Date ?? DateTime.Today;

            var query = _context.FdAccounts
                .Include(a => a.Customer)
                .Include(a => a.Branch)
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.Slabs)
                .Include(a => a.SavingAccount)
                .Where(a => (a.Status == "Active" || a.Status == "Matured") && a.IsAutoRenewable && a.MaturityDate.Date <= processDate && a.AutoRenewalCount < a.MaxAutoRenewalCycles);

            var (isHO, userBranchId) = GetUserBranchInfo();
            if (!isHO && userBranchId.HasValue && userBranchId.Value > 0)
            {
                query = query.Where(a => a.BranchID == userBranchId.Value);
            }
            else if (request?.BranchID.HasValue == true && request.BranchID.Value > 0)
            {
                query = query.Where(a => a.BranchID == request.BranchID.Value);
            }

            if (request?.SpecificAccountIDs != null && request.SpecificAccountIDs.Any())
            {
                query = query.Where(a => request.SpecificAccountIDs.Contains(a.FdAccountID));
            }

            var candidates = await query
                .OrderBy(a => a.MaturityDate)
                .ThenBy(a => a.FdAccountID)
                .ToListAsync();

            var result = new AutoRenewalBatchResultDto
            {
                TotalCandidates = candidates.Count,
                SuccessCount = 0,
                FailedCount = 0,
                TotalRenewedAmount = 0,
                TotalInterestPaidOut = 0,
                Items = new List<AutoRenewalItemResultDto>()
            };

            foreach (var oldAccount in candidates)
            {
                using var itemTx = await _context.Database.BeginTransactionAsync();
                try
                {
                    bool hasCollateral = oldAccount.IsLienMarked ||
                                         await _context.LoanDepositCollaterals.AnyAsync(c =>
                                             c.CollateralType == "FixedDeposit" && c.DepositAccountID == oldAccount.FdAccountID) ||
                                         (!string.IsNullOrEmpty(oldAccount.AccountNo) && await _context.LoanAccounts.AnyAsync(l =>
                                             l.Status == "Active" && l.SecurityDetails != null && l.SecurityDetails.Contains(oldAccount.AccountNo)));

                    if (hasCollateral)
                    {
                        throw new InvalidOperationException("सदर खाते कर्जासाठी तारण (Lien/Collateral) असल्यामुळे स्वयंचलित नूतनीकरण प्रतिबंधित आहे. कृपया कर्ज खाते व तारण बोजा तपासा.");
                    }

                    bool hasPendingSettlementOrRenewal = await _context.FdTransactions.AnyAsync(t =>
                        t.FdAccountID == oldAccount.FdAccountID &&
                        t.VoucherID > 0 &&
                        (t.TransactionType == "Payout" ||
                         t.TransactionType == "Premature_Close" ||
                         t.TransactionType == "Close" ||
                         t.TransactionType == "Renewal") &&
                        _context.Vouchers.Any(v => v.VoucherID == t.VoucherID && v.Status == "Pending"));

                    if (hasPendingSettlementOrRenewal)
                    {
                        throw new InvalidOperationException("सदर खात्यावर क्लोजर किंवा नूतनीकरणाचे प्रलंबित (Pending) व्हाउचर आधीच अस्तित्वात असल्याने स्वयंचलित नूतनीकरण करता येत नाही.");
                    }

                    var scheme = oldAccount.FdScheme;
                    if (scheme == null)
                    {
                        throw new InvalidOperationException($"खात्याशी संबंधित ठेव योजना (Scheme ID: {oldAccount.FdSchemeID}) सापडली नाही.");
                    }

                    // Verified Interest Payable Provision on old account
                    var accruedFromTx = await ResolveVerifiedProvisionedInterestAsync(oldAccount.FdAccountID, scheme.InterestPayableLedgerID);

                    bool isOldPeriodicScheme = scheme.InterestType == "MIS" || scheme.InterestType == "Monthly Interest";
                    decimal accruedInt = isOldPeriodicScheme
                        ? 0m
                        : ((oldAccount.MaturityAmount > oldAccount.DepositAmount)
                            ? (oldAccount.MaturityAmount - oldAccount.DepositAmount)
                            : Math.Max(accruedFromTx, oldAccount.LegacyAccruedInt));

                    decimal totalMaturityAmount = oldAccount.DepositAmount + accruedInt;
                    decimal newDepositAmount = (oldAccount.AutoRenewalOption == "PrincipalOnly") ? oldAccount.DepositAmount : totalMaturityAmount;
                    decimal interestPayoutAmount = (oldAccount.AutoRenewalOption == "PrincipalOnly") ? accruedInt : 0m;

                    // Strict Saving account requirement for PrincipalOnly interest payout (zero Cash / random-account fallback)
                    SavingAccountMaster? targetSaving = null;
                    if (oldAccount.AutoRenewalOption == "PrincipalOnly" && interestPayoutAmount > 0)
                    {
                        if (!oldAccount.SavingAccountID.HasValue || oldAccount.SavingAccountID.Value <= 0)
                        {
                            throw new InvalidOperationException("केवळ मुद्दल (PrincipalOnly) ऑटो-नूतनीकरणासाठी खात्याला सक्रिय बचत खाते (Saving Account) संलग्न असणे अनिवार्य आहे.");
                        }

                        targetSaving = await _context.SavingAccountMasters.FindAsync(oldAccount.SavingAccountID.Value);
                        if (targetSaving == null || !string.Equals(targetSaving.Status, "Active", StringComparison.OrdinalIgnoreCase))
                        {
                            throw new InvalidOperationException($"संलग्न बचत खाते (ID: {oldAccount.SavingAccountID.Value}) सक्रिय (Active) नसल्याने केवळ मुद्दल (PrincipalOnly) ऑटो-नूतनीकरण करता येत नाही.");
                        }
                    }

                    DateTime newOpeningDate = oldAccount.MaturityDate.Date;
                    string durType = !string.IsNullOrWhiteSpace(oldAccount.DurationType) ? oldAccount.DurationType : (scheme.DurationType ?? "Months");
                    int durVal = oldAccount.DurationValue.HasValue && oldAccount.DurationValue.Value > 0 ? oldAccount.DurationValue.Value : (scheme.DurationMonths > 0 ? scheme.DurationMonths : 12);

                    DateTime newMaturityDate;
                    int newTotalDays;
                    if (durType.Equals("Days", StringComparison.OrdinalIgnoreCase))
                    {
                        newTotalDays = durVal;
                        newMaturityDate = newOpeningDate.AddDays(newTotalDays);
                    }
                    else if (durType.Equals("Years", StringComparison.OrdinalIgnoreCase))
                    {
                        newMaturityDate = newOpeningDate.AddYears(durVal);
                        newTotalDays = (int)(newMaturityDate - newOpeningDate).TotalDays;
                    }
                    else
                    {
                        newMaturityDate = newOpeningDate.AddMonths(durVal);
                        newTotalDays = (int)(newMaturityDate - newOpeningDate).TotalDays;
                    }

                    var customer = await _context.Customers.FindAsync(oldAccount.CustomerID);
                    bool isSenior = customer?.BirthDate.HasValue == true && (customer.BirthDate.Value.Date <= newOpeningDate.Date.AddYears(-60));

                    decimal prevailingRate;
                    if (scheme.SchemeDurationModel == "Slab")
                    {
                        var matchedSlab = scheme.Slabs?.FirstOrDefault(s => newTotalDays >= s.FromDays && newTotalDays <= s.ToDays && s.IsActive);
                        if (matchedSlab == null)
                        {
                            throw new InvalidOperationException($"नूतनीकरण कालावधी ({newTotalDays} दिवस) योजनेच्या कोणत्याही मंजूर स्लॅबमध्ये बसत नाही.");
                        }
                        prevailingRate = isSenior ? matchedSlab.SeniorCitizenRate : matchedSlab.InterestRate;
                    }
                    else
                    {
                        prevailingRate = isSenior ? scheme.SeniorCitizenInterestRate : scheme.InterestRate;
                    }

                    // Resolve active open business date for voucher posting so overdue auto-renewals appear in Pass Voucher Queue
                    DateTime voucherPostingDate = await ResolveActiveBusinessDateAsync(oldAccount.BranchID);
                    var closedFyVoucher = await _context.FinancialYears
                        .AsNoTracking()
                        .FirstOrDefaultAsync(fy => fy.IsClosed && voucherPostingDate.Date >= fy.StartDate.Date && voucherPostingDate.Date <= fy.EndDate.Date);
                    if (closedFyVoucher != null)
                    {
                        throw new InvalidOperationException($"सध्याची व्यवसाय तारीख ({voucherPostingDate:dd/MM/yyyy}) बंद आर्थिक वर्षात ({closedFyVoucher.YearCode}) मोडत असल्याने स्वयंचलित नूतनीकरण व्हाउचर पोस्ट करता येत नाही.");
                    }

                    // Standardized 14-Digit CBS Account Number (identical to Manual Renew)
                    var (rawNewAccNo, formattedNewAccountNo, _) = await GenerateNextFdAccountNoAsync(
                        oldAccount.BranchID,
                        oldAccount.FdSchemeID,
                        incrementSequence: true);

                    string oldEffectiveReceipt = Helpers.FdRenewalPolicyHelper.GetEffectiveReceiptNo(oldAccount);
                    var (parentFdId, rootFdId, chainCycleNo) = Helpers.FdRenewalPolicyHelper.ComputeRenewalChainMetadata(oldAccount);
                    if (!oldAccount.RootFdAccountID.HasValue || oldAccount.RootFdAccountID.Value <= 0)
                    {
                        oldAccount.RootFdAccountID = rootFdId;
                    }
                    if (string.IsNullOrWhiteSpace(oldAccount.ReceiptNo))
                    {
                        oldAccount.ReceiptNo = oldEffectiveReceipt;
                    }

                    var resolvedReceipt = await Helpers.FdRenewalPolicyHelper.ResolveRenewalReceiptNumbersAsync(
                        _context,
                        oldAccount,
                        oldAccount.FdSchemeID,
                        rawNewAccNo,
                        formattedNewAccountNo);

                    if (!string.IsNullOrEmpty(resolvedReceipt.ValidationError))
                    {
                        throw new InvalidOperationException(resolvedReceipt.ValidationError);
                    }

                    int targetFinancialYearId = await ResolveMatchingFinancialYearIdAsync(newOpeningDate);

                    int nextCycleCount = oldAccount.AutoRenewalCount + 1;
                    bool willStillAutoRenew = nextCycleCount < oldAccount.MaxAutoRenewalCycles;

                    var newAccount = new FdAccount
                    {
                        InstitutionID = oldAccount.InstitutionID,
                        BranchID = oldAccount.BranchID,
                        FinancialYearID = targetFinancialYearId,
                        CustomerID = oldAccount.CustomerID,
                        FdSchemeID = oldAccount.FdSchemeID,
                        AccountNo = formattedNewAccountNo,
                        ReceiptNo = resolvedReceipt.ReceiptNo,
                        LegacyAccountNumber = resolvedReceipt.LegacyAccountNumber,
                        OpeningDate = newOpeningDate,
                        DepositAmount = newDepositAmount,
                        InterestRate = prevailingRate,
                        DurationType = durType,
                        DurationValue = durVal,
                        DurationInDays = newTotalDays,
                        MaturityDate = newMaturityDate,
                        Status = "Active",
                        NomineeName = oldAccount.NomineeName,
                        NomineeRelation = oldAccount.NomineeRelation,
                        PaymentMode = "Transfer",
                        SavingAccountID = targetSaving?.SavingAccountID ?? oldAccount.SavingAccountID,
                        IsAutoRenewable = willStillAutoRenew,
                        AutoRenewalOption = oldAccount.AutoRenewalOption ?? "PrincipalPlusInterest",
                        MaxAutoRenewalCycles = oldAccount.MaxAutoRenewalCycles,
                        AutoRenewalCount = nextCycleCount,
                        ParentFdAccountID = parentFdId,
                        RootFdAccountID = rootFdId,
                        RenewalCycleNo = chainCycleNo,
                        Remarks = TruncateMax($"स्वयंचलित नूतनीकरण (Auto-Renewed): मूळ खाते {oldAccount.AccountNo} | पावती क्र.: {resolvedReceipt.ReceiptNo} (मूळ पावती: {oldEffectiveReceipt}, सायकल {nextCycleCount}/{oldAccount.MaxAutoRenewalCycles})"
                            + (isSenior ? $" [ज्येष्ठ नागरिक सवलत दर: {prevailingRate}%]" : ""), 1000)
                    };

                    decimal p = newDepositAmount;
                    decimal r = prevailingRate;

                    if (scheme.InterestType == "Cumulative")
                    {
                        int n = 4;
                        if (scheme.InterestCompoundingFrequency == "Half-Yearly") n = 2;
                        if (scheme.InterestCompoundingFrequency == "Yearly") n = 1;
                        if (scheme.InterestCompoundingFrequency == "Monthly") n = 12;

                        double baseVal = 1.0 + ((double)r / (n * 100.0));
                        double exponent = n * ((double)newTotalDays / 365.0);
                        newAccount.MaturityAmount = Math.Round(p * (decimal)Math.Pow(baseVal, exponent), 0, MidpointRounding.AwayFromZero);
                    }
                    else if (scheme.InterestType == "MIS" || scheme.InterestType == "Monthly Interest")
                    {
                        newAccount.MaturityAmount = p;
                    }
                    else
                    {
                        newAccount.MaturityAmount = Math.Round(p * (1.0m + ((r * (decimal)newTotalDays) / (365.0m * 100.0m))), 0, MidpointRounding.AwayFromZero);
                    }

                    _context.FdAccounts.Add(newAccount);
                    await _context.SaveChangesAsync();

                    oldAccount.Status = "Renewed";
                    oldAccount.Remarks = TruncateMax((oldAccount.Remarks ?? "") + $" | स्वयंचलित नूतनीकरण: {newAccount.AccountNo} (पावती क्र.: {resolvedReceipt.ReceiptNo}, दि. {voucherPostingDate:dd/MM/yyyy})", 1000);
                    await _context.SaveChangesAsync();

                    var fdLiabilityLedger = await ResolveStrictSchemeLedgerByIdAsync(scheme.FdLiabilityLedgerID);
                    var payableLedger = await ResolveStrictSchemeLedgerByIdAsync(scheme.InterestPayableLedgerID);
                    var expenseLedger = await ResolveStrictSchemeLedgerByIdAsync(scheme.InterestExpenseLedgerID);

                    decimal dbAutoCapitalized = await _context.FdTransactions
                        .Where(t => t.FdAccountID == oldAccount.FdAccountID && t.TransactionType == "Interest_Capitalized")
                        .SumAsync(t => (decimal?)t.Amount) ?? 0m;
                    decimal clearedAutoCapitalized = Math.Min(accruedInt, dbAutoCapitalized);
                    decimal alreadyPosted = accruedFromTx;
                    decimal payableInterestAmount = Math.Min(Math.Max(0m, accruedInt - clearedAutoCapitalized), alreadyPosted);
                    decimal expenseInterestAmount = Math.Max(0m, accruedInt - clearedAutoCapitalized - payableInterestAmount);

                    if (fdLiabilityLedger == null)
                    {
                        throw new InvalidOperationException("मुदत ठेव योजनेत दायित्व लेजर (FD Liability Ledger) मॅप केलेले नाही किंवा ते निष्क्रिय आहे.");
                    }

                    if (payableInterestAmount > 0 && payableLedger == null)
                    {
                        throw new InvalidOperationException("मुदत ठेव योजनेत देणे व्याज लेजर (Interest Payable Ledger) मॅप केलेले नाही.");
                    }

                    if (expenseInterestAmount > 0 && expenseLedger == null)
                    {
                        throw new InvalidOperationException("मुदत ठेव योजनेत व्याज खर्च लेजर (Interest Expense Ledger) मॅप केलेले नाही.");
                    }

                    int currentOperatorId = int.TryParse(
                        User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? User?.FindFirst("UserID")?.Value,
                        out int parsedOpId) && parsedOpId > 0 ? parsedOpId : 1;

                    string autoVoucherNo = await Helpers.FdRenewalRollbackHelper.BuildCollisionSafeVoucherNoAsync(
                        _context, $"JV-FD-AUTOREN-{newAccount.AccountNo}");

                    int payoutLedgerId = 0;
                    if (oldAccount.AutoRenewalOption == "PrincipalOnly" && interestPayoutAmount > 0)
                    {
                        if (targetSaving == null)
                        {
                            throw new InvalidOperationException("केवळ मुद्दल (PrincipalOnly) ऑटो-नूतनीकरणासाठी संलग्न सक्रिय बचत खाते अनिवार्य आहे.");
                        }

                        targetSaving.CurrentBalance += interestPayoutAmount;
                        payoutLedgerId = await Helpers.SavingLedgerHelper.ResolveSavingLiabilityLedgerIdAsync(_context, targetSaving);
                        if (payoutLedgerId <= 0)
                        {
                            throw new InvalidOperationException($"बचत खाते क्र. {targetSaving.AccountNo} साठी दायित्व लेजर (Saving Liability Ledger) सापडले नाही.");
                        }

                        _context.SavingTransactions.Add(new SavingTransaction
                        {
                            SavingAccountID = targetSaving.SavingAccountID,
                            CustomerID = targetSaving.CustomerID,
                            BranchID = oldAccount.BranchID > 0 ? oldAccount.BranchID : targetSaving.BranchID,
                            TransactionDate = voucherPostingDate,
                            TransactionType = "Deposit",
                            PaymentMode = "Transfer",
                            Amount = interestPayoutAmount,
                            BalanceAfterTxn = targetSaving.CurrentBalance,
                            Narration = $"मुदत ठेव ऑटो-नूतनीकरण व्याज जमा: पावती क्र. {oldEffectiveReceipt} ({oldAccount.AccountNo})",
                            VoucherNo = autoVoucherNo,
                            CreatedBy = currentOperatorId,
                            CreatedOn = DateTime.Now
                        });
                    }

                    var voucher = new Voucher
                    {
                        BranchID = oldAccount.BranchID,
                        VoucherNo = autoVoucherNo,
                        VoucherDate = voucherPostingDate,
                        VoucherType = "Journal",
                        TotalAmount = totalMaturityAmount,
                        Status = "Pending",
                        Narration = $"मुदत ठेव स्वयंचलित नूतनीकरण (FD Auto-Renewal Batch): पावती क्र. {oldEffectiveReceipt} -> {resolvedReceipt.ReceiptNo} [{oldAccount.AccountNo} -> {newAccount.AccountNo}] (सायकल {nextCycleCount}/{oldAccount.MaxAutoRenewalCycles})",
                        CreatedBy = currentOperatorId,
                        CreatedOn = DateTime.Now
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    var linkedMember = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == oldAccount.CustomerID);
                    int? linkedMemberId = linkedMember?.MemberID;

                    // Dr Old Liability (Principal + any previously capitalized interest)
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = fdLiabilityLedger.LedgerID, DrCr = "Dr", Amount = oldAccount.DepositAmount + clearedAutoCapitalized, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });

                    // Dr Interest Payable (Accumulated Contract Interest - only if provisioned)
                    if (payableLedger != null && payableInterestAmount > 0)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payableLedger.LedgerID, DrCr = "Dr", Amount = payableInterestAmount, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });
                    }

                    // Dr Interest Expense (Unprovisioned current period interest)
                    if (expenseLedger != null && expenseInterestAmount > 0)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = expenseLedger.LedgerID, DrCr = "Dr", Amount = expenseInterestAmount, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });
                    }

                    // Cr New Liability
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = fdLiabilityLedger.LedgerID, DrCr = "Cr", Amount = newDepositAmount, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });

                    // Cr Interest Payout (if PrincipalOnly)
                    if (oldAccount.AutoRenewalOption == "PrincipalOnly" && interestPayoutAmount > 0 && payoutLedgerId > 0)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = payoutLedgerId, DrCr = "Cr", Amount = interestPayoutAmount, CustomerID = oldAccount.CustomerID, MemberID = linkedMemberId });
                    }

                    // FdTransactions
                    _context.FdTransactions.Add(new FdTransaction
                    {
                        BranchID = oldAccount.BranchID,
                        FdAccountID = oldAccount.FdAccountID,
                        VoucherID = voucher.VoucherID,
                        TransactionDate = voucherPostingDate,
                        TransactionType = "Renewal",
                        DebitCredit = "Dr",
                        Amount = totalMaturityAmount
                    });

                    _context.FdTransactions.Add(new FdTransaction
                    {
                        BranchID = newAccount.BranchID,
                        FdAccountID = newAccount.FdAccountID,
                        VoucherID = voucher.VoucherID,
                        TransactionDate = voucherPostingDate,
                        TransactionType = "Opening",
                        DebitCredit = "Cr",
                        Amount = newDepositAmount
                    });

                    // Audit Log
                    var autoLog = new FdAutoRenewalLog
                    {
                        InstitutionID = oldAccount.InstitutionID,
                        BranchID = oldAccount.BranchID,
                        BatchDate = voucherPostingDate,
                        OldFdAccountID = oldAccount.FdAccountID,
                        NewFdAccountID = newAccount.FdAccountID,
                        OldAccountNo = oldAccount.AccountNo,
                        NewAccountNo = newAccount.AccountNo,
                        OldReceiptNo = oldEffectiveReceipt,
                        NewReceiptNo = resolvedReceipt.ReceiptNo,
                        CustomerID = oldAccount.CustomerID,
                        CustomerName = customer?.CustomerName ?? "सभासद",
                        RenewalOption = oldAccount.AutoRenewalOption ?? "PrincipalPlusInterest",
                        RenewedAmount = newDepositAmount,
                        InterestPaidOut = interestPayoutAmount,
                        AppliedRate = prevailingRate,
                        VoucherID = voucher.VoucherID,
                        Status = "Success",
                        ExecutedBy = request?.ExecutedBy ?? "System-EOD",
                        ExecutionTime = DateTime.UtcNow
                    };
                    _context.FdAutoRenewalLogs.Add(autoLog);

                    await _context.SaveChangesAsync();
                    await itemTx.CommitAsync();

                    result.SuccessCount++;
                    result.TotalRenewedAmount += newDepositAmount;
                    result.TotalInterestPaidOut += interestPayoutAmount;
                    result.Items.Add(new AutoRenewalItemResultDto
                    {
                        OldFdAccountID = oldAccount.FdAccountID,
                        OldAccountNo = oldAccount.AccountNo,
                        OldReceiptNo = oldEffectiveReceipt,
                        NewFdAccountID = newAccount.FdAccountID,
                        NewAccountNo = newAccount.AccountNo,
                        NewReceiptNo = resolvedReceipt.ReceiptNo,
                        EffectivePolicy = resolvedReceipt.EffectiveMode,
                        RenewalCycleNo = newAccount.RenewalCycleNo,
                        VoucherID = voucher.VoucherID,
                        VoucherNo = voucher.VoucherNo,
                        VoucherDate = voucher.VoucherDate,
                        VoucherStatus = voucher.Status,
                        CustomerName = customer?.CustomerName ?? "सभासद",
                        RenewedAmount = newDepositAmount,
                        InterestPaidOut = interestPayoutAmount,
                        AppliedRate = prevailingRate,
                        RenewalOption = oldAccount.AutoRenewalOption ?? "PrincipalPlusInterest",
                        Status = "Success"
                    });
                }
                catch (Exception ex)
                {
                    await itemTx.RollbackAsync();
                    result.FailedCount++;
                    string errMsg = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                    result.Items.Add(new AutoRenewalItemResultDto
                    {
                        OldFdAccountID = oldAccount.FdAccountID,
                        OldAccountNo = oldAccount.AccountNo,
                        CustomerName = oldAccount.Customer?.CustomerName ?? "सभासद",
                        RenewedAmount = oldAccount.DepositAmount,
                        InterestPaidOut = 0,
                        AppliedRate = oldAccount.InterestRate,
                        RenewalOption = oldAccount.AutoRenewalOption ?? "PrincipalPlusInterest",
                        Status = "Failed",
                        ErrorMessage = errMsg
                    });
                }
            }

            return Ok(result);
        }

        // POST: api/FdAccounts/{id}/RevertAutoRenewal (14-Day Statutory Grace Window Reversal)
        [HttpPost("{id}/RevertAutoRenewal")]
        [Authorize(Roles = "Admin,SuperAdmin,Manager")]
        public async Task<IActionResult> RevertAutoRenewal(int id, [FromBody] RevertAutoRenewalRequest request)
        {
            if (string.IsNullOrWhiteSpace(request?.RevertReason))
            {
                return BadRequest("नूतनीकरण रद्द करण्याचे वैधानिक कारण (Revert Reason) देणे बंधनकारक आहे.");
            }

            var newAccount = await _context.FdAccounts
                .Include(a => a.FdScheme)
                .FirstOrDefaultAsync(a => a.FdAccountID == id);

            if (newAccount == null)
            {
                return NotFound("मुदत ठेव खाते सापडले नाही.");
            }

            if (!newAccount.ParentFdAccountID.HasValue || newAccount.ParentFdAccountID.Value <= 0)
            {
                return BadRequest("सदर खाते स्वयंचलित नूतनीकरणातून (Auto-Renewal) तयार झालेले नाही. केवळ ऑटो-नूतनीकरण खातीच या पर्यायाने रिव्हर्ट केली जाऊ शकतात.");
            }

            if (newAccount.Status != "Active")
            {
                return BadRequest($"सदर खाते '{newAccount.Status}' स्थितीत असल्याने रिव्हर्ट करता येणार नाही.");
            }

            // 🛡️ RBI 14-Day Statutory Grace Window Check
            var daysSinceRenewal = (DateTime.Today - newAccount.OpeningDate.Date).TotalDays;
            if (daysSinceRenewal > 14)
            {
                return BadRequest($"आरबीआय व बँकिंग नियमांनुसार (RBI 14-Day Grace Rule) स्वयंचलित नूतनीकरण केवळ १४ दिवसांच्या आतच पूर्ववत (Revert) करता येते. या नूतनीकरणास {daysSinceRenewal} दिवस झालेले असल्याने आता हे खाते पूर्ववत करता येणार नाही. मुदतपूर्व बंद (Premature Close) पर्याय वापरा.");
            }

            var oldAccount = await _context.FdAccounts
                .Include(a => a.FdScheme)
                .FirstOrDefaultAsync(a => a.FdAccountID == newAccount.ParentFdAccountID.Value);

            if (oldAccount == null)
            {
                return BadRequest("जुने मूळ मुदत ठेव खाते डेटाबेसमध्ये सापडले नाही.");
            }

            // Check if newAccount is pledged in any active loan
            var pledgedLoan = await _context.LoanAccounts
                .FirstOrDefaultAsync(l => l.Status == "Active" && l.SecurityDetails != null && l.SecurityDetails.Contains(newAccount.AccountNo));
            if (pledgedLoan != null)
            {
                return BadRequest($"सदर नवीन पावती क्र. {newAccount.AccountNo} कर्ज खाते क्र. {pledgedLoan.LoanAccountNo} साठी तारण (Lien) म्हणून नोंदवलेली असल्याने नूतनीकरण रद्द करता येणार नाही.");
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    // 1. Invert Journal Voucher
                    string originalVoucherNo = $"JV-FD-AUTOREN-{newAccount.AccountNo}";
                    var originalVoucher = await _context.Vouchers
                        .Include(v => v.VoucherDetails)
                        .FirstOrDefaultAsync(v => v.VoucherNo == originalVoucherNo || v.VoucherNo.EndsWith(newAccount.AccountNo));

                    if (originalVoucher != null)
                    {
                        var revVoucher = new Voucher
                        {
                            BranchID = newAccount.BranchID,
                            VoucherNo = $"RV-FD-AUTOREN-{newAccount.AccountNo}",
                            VoucherDate = DateTime.Today,
                            VoucherType = "Journal",
                            TotalAmount = originalVoucher.TotalAmount,
                            Narration = $"स्वयंचलित नूतनीकरण रद्द (Reversal of Auto-Renewal within 14-day grace): {newAccount.AccountNo} -> {oldAccount.AccountNo}. कारण: {request.RevertReason}",
                            CreatedBy = 1,
                            CreatedOn = DateTime.Now
                        };
                        _context.Vouchers.Add(revVoucher);
                        await _context.SaveChangesAsync();

                        foreach (var vd in originalVoucher.VoucherDetails)
                        {
                            string invDrCr = (vd.DrCr == "Dr") ? "Cr" : "Dr";
                            _context.VoucherDetails.Add(new VoucherDetail
                            {
                                VoucherID = revVoucher.VoucherID,
                                LedgerID = vd.LedgerID,
                                DrCr = invDrCr,
                                Amount = vd.Amount,
                                CustomerID = vd.CustomerID,
                                MemberID = vd.MemberID
                            });
                        }

                        // If PrincipalOnly and interest was credited to saving account, claw it back
                        if (newAccount.AutoRenewalOption == "PrincipalOnly" && newAccount.SavingAccountID.HasValue && newAccount.SavingAccountID.Value > 0)
                        {
                            var savAcc = await _context.SavingAccountMasters.FindAsync(newAccount.SavingAccountID.Value);
                            decimal interestPaid = (oldAccount.MaturityAmount > oldAccount.DepositAmount) ? (oldAccount.MaturityAmount - oldAccount.DepositAmount) : 0m;
                            if (savAcc != null && interestPaid > 0)
                            {
                                if (savAcc.CurrentBalance < interestPaid)
                                {
                                    return BadRequest($"बचत खात्यात (SB #{savAcc.AccountNo}) पुरेसा निधी नाही! ऑटो-नूतनीकरणाचे जमा झालेले ₹{interestPaid:N2} व्याज परत घेण्यासाठी खात्यात किमान शिल्लक असणे आवश्यक आहे (सध्याची शिल्लक: ₹{savAcc.CurrentBalance:N2}).");
                                }

                                savAcc.CurrentBalance -= interestPaid;
                                _context.SavingTransactions.Add(new SavingTransaction
                                {
                                    SavingAccountID = savAcc.SavingAccountID,
                                    CustomerID = savAcc.CustomerID,
                                    BranchID = newAccount.BranchID > 0 ? newAccount.BranchID : savAcc.BranchID,
                                    TransactionDate = DateTime.Today,
                                    TransactionType = "Withdrawal",
                                    PaymentMode = "Transfer",
                                    Amount = interestPaid,
                                    BalanceAfterTxn = savAcc.CurrentBalance,
                                    Narration = $"ऑटो-नूतनीकरण रद्द झाल्याने जमा झालेले व्याज परत (Clawback): FD #{newAccount.AccountNo}",
                                    VoucherNo = revVoucher.VoucherNo,
                                    CreatedBy = 1,
                                    CreatedOn = DateTime.Now
                                });
                            }
                        }
                    }

                    // 2. Mark new account as Closed / Cancelled
                    newAccount.Status = "Closed";
                    newAccount.Remarks = (newAccount.Remarks ?? "") + $" | 14-दिवसीय सवलतीत नूतनीकरण रद्द ({DateTime.Now:dd/MM/yyyy}): {request.RevertReason}";

                    // 3. Restore old account to "Matured" status
                    oldAccount.Status = "Matured";
                    oldAccount.Remarks = (oldAccount.Remarks ?? "") + $" | नूतनीकरण रद्द करून खाते मुदतपूर्ण (Matured) पूर्ववत केले ({DateTime.Now:dd/MM/yyyy})";

                    // 4. Update Audit Log
                    var log = await _context.FdAutoRenewalLogs
                        .FirstOrDefaultAsync(l => l.NewFdAccountID == newAccount.FdAccountID && !l.IsReverted);
                    if (log != null)
                    {
                        log.IsReverted = true;
                        log.RevertedDate = DateTime.Now;
                        log.RevertedBy = request.RevertedBy ?? "Manager";
                        log.RevertReason = request.RevertReason;
                        log.Status = "Reverted";
                    }

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok(new
                    {
                        Message = $"नवीन खाते क्र. {newAccount.AccountNo} चे नूतनीकरण यशस्वीरीत्या रद्द केले असून मूळ खाते क्र. {oldAccount.AccountNo} मुदतपूर्ण (Matured) म्हणून पूर्ववत केले आहे. ग्राहक आता संपूर्ण मुदतपूर्ती रक्कम विनादंड काढू शकतात.",
                        OldAccountNo = oldAccount.AccountNo,
                        OldAccountID = oldAccount.FdAccountID,
                        Status = oldAccount.Status
                    });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return StatusCode(500, "रिव्हर्ट प्रक्रियेदरम्यान त्रुटी आली: " + ex.Message);
                }
            }
        }

        // GET: api/FdAccounts/AutoRenewalLogs
        [HttpGet("AutoRenewalLogs")]
        public async Task<IActionResult> GetAutoRenewalLogs([FromQuery] int? branchId = null, [FromQuery] DateTime? fromDate = null, [FromQuery] DateTime? toDate = null)
        {
            var query = _context.FdAutoRenewalLogs
                .Include(l => l.Branch)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(l => l.BranchID == branchId.Value);
            }
            if (fromDate.HasValue)
            {
                query = query.Where(l => l.BatchDate >= fromDate.Value.Date);
            }
            if (toDate.HasValue)
            {
                query = query.Where(l => l.BatchDate <= toDate.Value.Date);
            }

            var logs = await query
                .OrderByDescending(l => l.ExecutionTime)
                .Take(200)
                .ToListAsync();

            return Ok(logs);
        }

        // GET: api/FdAccounts/by-voucher/{voucherId}
        [HttpGet("by-voucher/{voucherId}")]
        public async Task<IActionResult> GetFdAccountByVoucher(int voucherId)
        {
            var voucher = await _context.Vouchers
                .AsNoTracking()
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Ledger)
                .FirstOrDefaultAsync(v => v.VoucherID == voucherId);

            if (voucher == null)
            {
                return NotFound(new { message = $"व्हाउचर क्र. {voucherId} सिस्टीममध्ये सापडले नाही." });
            }

            // 1. Try to find FdTransaction linked to this Voucher
            var fdTx = await _context.FdTransactions
                .AsNoTracking()
                .AsSplitQuery()
                .Include(t => t.FdAccount)
                    .ThenInclude(a => a!.Customer)
                .Include(t => t.FdAccount)
                    .ThenInclude(a => a!.FdScheme)
                .Include(t => t.FdAccount)
                    .ThenInclude(a => a!.Branch)
                .FirstOrDefaultAsync(t => t.VoucherID == voucherId && (t.TransactionType == "Opening" || t.TransactionType == "Renewal"));

            FdAccount? account = fdTx?.FdAccount;

            // 2. If not found via FdTransaction, try parsing from VoucherNo (e.g. REC-FD-OP-00140100000001) or Narration
            if (account == null)
            {
                string vNo = voucher.VoucherNo ?? "";
                string accNoCandidate = "";
                if (vNo.StartsWith("REC-FD-OP-"))
                {
                    accNoCandidate = vNo.Substring("REC-FD-OP-".Length).Trim();
                }

                if (!string.IsNullOrEmpty(accNoCandidate))
                {
                    account = await _context.FdAccounts
                        .AsNoTracking()
                        .AsSplitQuery()
                        .Include(a => a.Customer)
                        .Include(a => a.FdScheme)
                        .Include(a => a.Branch)
                        .FirstOrDefaultAsync(a => a.AccountNo == accNoCandidate);
                }
            }

            // 3. Fallback: Search by Customer linked in VoucherDetails
            if (account == null)
            {
                var custId = voucher.VoucherDetails.FirstOrDefault(vd => vd.CustomerID.HasValue && vd.CustomerID.Value > 0)?.CustomerID;
                if (custId.HasValue)
                {
                    account = await _context.FdAccounts
                        .AsNoTracking()
                        .AsSplitQuery()
                        .Include(a => a.Customer)
                        .Include(a => a.FdScheme)
                        .Include(a => a.Branch)
                        .Where(a => a.CustomerID == custId.Value)
                        .OrderByDescending(a => a.FdAccountID)
                        .FirstOrDefaultAsync();
                }
            }

            if (account == null)
            {
                return NotFound(new { message = $"सदर व्हाउचरशी (ID: {voucherId}) संबंधित मुदत ठेव खाते (FD Account) सापडले नाही." });
            }

            // Determine payment mode and debit ledger from voucher details
            string paymentMode = "Cash";
            int? bankLedgerId = null;
            int? savingAccountId = null;

            var debitDetail = voucher.VoucherDetails.FirstOrDefault(vd => vd.DrCr == "Dr");
            if (debitDetail?.Ledger != null)
            {
                if (debitDetail.Ledger.AccountType == "Bank" || debitDetail.Ledger.LedgerName.Contains("Bank") || debitDetail.Ledger.LedgerName.Contains("बँक"))
                {
                    paymentMode = "Bank";
                    bankLedgerId = debitDetail.LedgerID;
                }
                else if (await Helpers.SavingLedgerHelper.IsConfiguredSavingLiabilityLedgerAsync(_context, debitDetail.LedgerID))
                {
                    paymentMode = "Transfer";
                    var sb = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.CustomerID == account.CustomerID);
                    savingAccountId = sb?.SavingAccountID;
                }
            }

            var seniorCutoffDate = DateTime.Today.AddYears(-60);
            var isSenior = account.Customer != null && account.Customer.BirthDate.HasValue && (account.Customer.BirthDate.Value.Date <= seniorCutoffDate);

            return Ok(new
            {
                fdAccount = new
                {
                    account.FdAccountID,
                    account.BranchID,
                    BranchName = account.Branch?.BranchName ?? "",
                    account.CustomerID,
                    CustomerName = account.Customer != null ? (account.Customer.FirstName + " " + account.Customer.LastName).Trim() : "",
                    CIFNo = account.Customer?.CIFNo ?? "",
                    account.FdSchemeID,
                    SchemeName = account.FdScheme?.SchemeName ?? "",
                    SchemeCode = account.FdScheme?.SchemeCode ?? "",
                    account.AccountNo,
                    account.LegacyAccountNumber,
                    account.OpeningDate,
                    account.DepositAmount,
                    account.DurationType,
                    account.DurationValue,
                    account.DurationInDays,
                    account.InterestRate,
                    account.MaturityDate,
                    account.MaturityAmount,
                    account.Status,
                    account.NomineeName,
                    account.NomineeRelation,
                    account.Remarks,
                    PaymentMode = paymentMode,
                    BankAccountLedgerID = bankLedgerId,
                    SavingAccountID = savingAccountId,
                    IsSeniorCitizen = isSenior
                },
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

        // GET: api/FdAccounts/closure-by-voucher/{voucherId}
        [HttpGet("closure-by-voucher/{voucherId}")]
        public async Task<IActionResult> GetFdClosureByVoucher(int voucherId)
        {
            var voucher = await _context.Vouchers
                .AsNoTracking()
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Ledger)
                .FirstOrDefaultAsync(v => v.VoucherID == voucherId);

            if (voucher == null)
            {
                return NotFound(new { message = $"व्हाउचर क्र. {voucherId} सिस्टीममध्ये सापडले नाही." });
            }

            // 1. Try to find FdTransaction linked to this closure or renewal voucher (parent account)
            var fdTx = await _context.FdTransactions
                .AsNoTracking()
                .AsSplitQuery()
                .Include(t => t.FdAccount)
                    .ThenInclude(a => a!.Customer)
                .Include(t => t.FdAccount)
                    .ThenInclude(a => a!.FdScheme)
                .Include(t => t.FdAccount)
                    .ThenInclude(a => a!.Branch)
                .FirstOrDefaultAsync(t => t.VoucherID == voucherId &&
                    (t.TransactionType == "Payout" ||
                     t.TransactionType == "Premature_Close" ||
                     t.TransactionType == "Renewal" ||
                     t.TransactionType == "Interest Payout"));

            FdAccount? account = fdTx?.FdAccount;
            FdAccount? renewedToAccount = null;

            bool isRenewalVoucher = Helpers.FdRenewalRollbackHelper.IsFdRenewalVoucher(voucher) ||
                                    fdTx?.TransactionType == "Renewal" ||
                                    fdTx?.TransactionType == "Interest Payout";

            if (isRenewalVoucher)
            {
                var openingTx = await _context.FdTransactions
                    .Include(t => t.FdAccount)
                        .ThenInclude(a => a!.Customer)
                    .Include(t => t.FdAccount)
                        .ThenInclude(a => a!.FdScheme)
                    .Include(t => t.FdAccount)
                        .ThenInclude(a => a!.Branch)
                    .FirstOrDefaultAsync(t => t.VoucherID == voucherId && t.TransactionType == "Opening");
                renewedToAccount = openingTx?.FdAccount;

                var autoLog = await _context.FdAutoRenewalLogs
                    .AsNoTracking()
                    .FirstOrDefaultAsync(l => l.VoucherID == voucherId);

                if (renewedToAccount == null && autoLog?.NewFdAccountID != null && autoLog.NewFdAccountID.Value > 0)
                {
                    renewedToAccount = await _context.FdAccounts
                        .Include(a => a.Customer)
                        .Include(a => a.FdScheme)
                        .Include(a => a.Branch)
                        .FirstOrDefaultAsync(a => a.FdAccountID == autoLog.NewFdAccountID.Value);
                }

                if (account == null && autoLog != null && autoLog.OldFdAccountID > 0)
                {
                    account = await _context.FdAccounts
                        .Include(a => a.Customer)
                        .Include(a => a.FdScheme)
                        .Include(a => a.Branch)
                        .FirstOrDefaultAsync(a => a.FdAccountID == autoLog.OldFdAccountID);
                }

                if (account == null && renewedToAccount?.ParentFdAccountID != null && renewedToAccount.ParentFdAccountID.Value > 0)
                {
                    account = await _context.FdAccounts
                        .Include(a => a.Customer)
                        .Include(a => a.FdScheme)
                        .Include(a => a.Branch)
                        .FirstOrDefaultAsync(a => a.FdAccountID == renewedToAccount.ParentFdAccountID.Value);
                }
            }

            // 2. Closure VoucherNo lookup when FdTransaction is absent (non-renewal closures only)
            if (account == null && !isRenewalVoucher)
            {
                string vNo = voucher.VoucherNo ?? "";
                string accNoCandidate = "";
                if (vNo.StartsWith("JV-FD-CLOSE-")) accNoCandidate = vNo.Substring("JV-FD-CLOSE-".Length).Trim();
                else if (vNo.StartsWith("JV-FD-PRECLOSE-")) accNoCandidate = vNo.Substring("JV-FD-PRECLOSE-".Length).Trim();
                else if (vNo.StartsWith("PMT-FD-CLOSE-")) accNoCandidate = vNo.Substring("PMT-FD-CLOSE-".Length).Trim();
                else if (vNo.StartsWith("PAY-FD-CLOSE-")) accNoCandidate = vNo.Substring("PAY-FD-CLOSE-".Length).Trim();

                if (!string.IsNullOrEmpty(accNoCandidate))
                {
                    var variants = Helpers.FdRenewalRollbackHelper.BuildAccountNumberVariants(accNoCandidate);
                    account = await _context.FdAccounts
                        .Include(a => a.Customer)
                        .Include(a => a.FdScheme)
                        .Include(a => a.Branch)
                        .FirstOrDefaultAsync(a => a.AccountNo != null && variants.Contains(a.AccountNo));
                }
            }

            if (account == null)
            {
                return NotFound(new { message = $"सदर मुदत ठेव व्यवहाराशी (ID: {voucherId}) संबंधित खाते सापडले नाही." });
            }

            string closureType = isRenewalVoucher
                ? "Renewal"
                : ((fdTx?.TransactionType == "Premature_Close" || voucher.VoucherNo?.Contains("PRECLOSE") == true)
                    ? "PrematureClose"
                    : "MaturityClose");

            return Ok(new
            {
                fdAccount = new
                {
                    account.FdAccountID,
                    account.BranchID,
                    BranchName = account.Branch?.BranchName ?? "",
                    account.CustomerID,
                    CustomerName = account.Customer != null ? (account.Customer.FirstName + " " + account.Customer.LastName).Trim() : "",
                    CIFNo = account.Customer?.CIFNo ?? "",
                    account.FdSchemeID,
                    SchemeName = account.FdScheme?.SchemeName ?? "",
                    account.AccountNo,
                    ReceiptNo = Helpers.FdRenewalPolicyHelper.GetEffectiveReceiptNo(account),
                    account.LegacyAccountNumber,
                    account.ParentFdAccountID,
                    account.RootFdAccountID,
                    account.RenewalCycleNo,
                    account.DepositAmount,
                    account.InterestRate,
                    account.OpeningDate,
                    account.MaturityDate,
                    account.MaturityAmount,
                    account.Status
                },
                closureDetails = new
                {
                    ClosureDate = fdTx?.TransactionDate ?? voucher.VoucherDate,
                    ClosureType = closureType,
                    TotalPayoutAmount = voucher.TotalAmount,
                    NewAccountNo = renewedToAccount?.AccountNo,
                    NewFdAccountID = renewedToAccount?.FdAccountID,
                    Narration = voucher.Narration
                },
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

        // POST: api/FdAccounts/5/Reopen (Explicitly Reopen an unintentionally closed or deleted-voucher FD account)
        [HttpPost("{id}/Reopen")]
        [Authorize(Roles = "Admin,SuperAdmin,Manager,HeadOffice,HO_Manager,BranchManager,Cashier,Operator")]
        public async Task<IActionResult> ReopenFdAccount(int id, [FromBody] FdReopenRequest? request = null)
        {
            var preCheck = await _context.FdAccounts.AsNoTracking().FirstOrDefaultAsync(a => a.FdAccountID == id);
            if (preCheck == null)
            {
                return NotFound(new { message = $"मुदत ठेव खाते ID #{id} सापडले नाही." });
            }

            bool wasClosedBeforeHeal = string.Equals(preCheck.Status, "Closed", StringComparison.OrdinalIgnoreCase) ||
                                       string.Equals(preCheck.Status, "Renewed", StringComparison.OrdinalIgnoreCase);

            // Clean up any orphaned renewal vouchers / orphaned Renewal FdTransactions on this account first
            await HealOrphanedRenewalsInternalAsync(id);

            var account = await _context.FdAccounts
                .Include(a => a.Customer)
                .Include(a => a.FdScheme)
                .FirstOrDefaultAsync(a => a.FdAccountID == id);

            if (account == null)
            {
                return NotFound(new { message = $"मुदत ठेव खाते ID #{id} सापडले नाही." });
            }

            if (account.Status != "Closed" && account.Status != "Renewed" && !wasClosedBeforeHeal)
            {
                return BadRequest(new { message = $"हे खाते आधीच '{account.Status}' स्थितीत आहे. केवळ बंद (Closed) किंवा नूतनीकरण (Renewed) झालेली खातीच पूर्ववत (Reopen) करता येतात." });
            }

            // Check if there is an active un-deleted Payout / Premature_Close / Renewal transaction
            var activeCloseTx = await _context.FdTransactions
                .Include(t => t.Voucher)
                .FirstOrDefaultAsync(t => t.FdAccountID == id &&
                    (t.TransactionType == "Payout" ||
                     t.TransactionType == "Premature_Close" ||
                     t.TransactionType == "Renewal"));

            if (activeCloseTx != null && activeCloseTx.Voucher != null)
            {
                string txLabel = activeCloseTx.TransactionType == "Renewal" ? "नूतनीकरण" : "क्लोजर";
                return BadRequest(new { 
                    message = $"सदर खात्याचा {txLabel} व्यवहार (व्हाउचर क्र. '{activeCloseTx.Voucher.VoucherNo}') अद्याप सिस्टीममध्ये अस्तित्वात आहे. खाते पूर्ववत करण्यापूर्वी संबंधित व्हाउचर किंवा नवीन पावती रद्द/डिलीट करणे आवश्यक आहे." 
                });
            }

            // Revert status using active CBS Business Date & clean closure/renewal remarks
            DateTime activeBusinessDate = await ResolveActiveBusinessDateAsync(account.BranchID);
            string newStatus = (account.MaturityDate.Date <= activeBusinessDate.Date) ? "Matured" : "Active";
            account.Status = newStatus;

            var lingeringClosureIntTxs = await _context.FdTransactions
                .Where(t => t.FdAccountID == id && t.TransactionType == "Closure_Interest")
                .ToListAsync();
            if (lingeringClosureIntTxs.Any())
            {
                _context.FdTransactions.RemoveRange(lingeringClosureIntTxs);
            }

            string reason = !string.IsNullOrWhiteSpace(request?.Reason) ? request.Reason.Trim() : "क्लोजर व्हाउचर डिलीट झाल्याने खाते पूर्ववत केले";
            account.Remarks = TruncateMax(CleanStaleClosureRemarks(account.Remarks) + $" | खाते पूर्ववत ({DateTime.Now:dd/MM/yyyy}): {reason}", 1000);

            _context.AuditLogs.Add(new AuditLog
            {
                Action = "FD_ACCOUNT_REOPENED",
                EntityName = "FdAccount",
                EntityID = account.AccountNo,
                Details = $"मुदत ठेव खाते क्र. {account.AccountNo} (जुना क्र. {account.LegacyAccountNumber}) यशस्वीरीत्या पूर्ववत ({account.Status}) केले. कारण: {reason}",
                Timestamp = DateTime.Now,
                Status = "Success"
            });

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"मुदत ठेव खाते क्र. {account.AccountNo} यशस्वीरीत्या पूर्ववत करण्यात आले आहे (सध्याची स्थिती: {account.Status}). आता हे खाते क्लोजर व नूतनीकरण स्क्रीनवर उपलब्ध असेल.",
                account = new
                {
                    account.FdAccountID,
                    account.AccountNo,
                    ReceiptNo = Helpers.FdRenewalPolicyHelper.GetEffectiveReceiptNo(account),
                    account.LegacyAccountNumber,
                    account.ParentFdAccountID,
                    account.RootFdAccountID,
                    account.RenewalCycleNo,
                    account.DepositAmount,
                    account.MaturityDate,
                    account.Status,
                    CustomerName = account.Customer != null ? (account.Customer.FirstName + " " + account.Customer.LastName).Trim() : "",
                    CIFNo = account.Customer != null ? account.Customer.CIFNo : "",
                    SchemeName = account.FdScheme != null ? account.FdScheme.SchemeName : ""
                }
            });
        }

        // POST: api/FdAccounts/reopen-by-number
        [HttpPost("reopen-by-number")]
        [Authorize(Roles = "Admin,SuperAdmin,Manager,HeadOffice,HO_Manager,BranchManager,Cashier,Operator")]
        public async Task<IActionResult> ReopenFdAccountByNumber([FromBody] FdReopenByNumberRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.AccountNumber))
            {
                return BadRequest(new { message = "कृपया खाते क्रमांक किंवा जुना खाते क्रमांक नमूद करा." });
            }

            string term = request.AccountNumber.Trim();
            var account = await _context.FdAccounts
                .Include(a => a.Customer)
                .Include(a => a.FdScheme)
                .FirstOrDefaultAsync(a => a.AccountNo == term || 
                                          (a.ReceiptNo != null && a.ReceiptNo.Trim() == term) ||
                                          a.LegacyAccountNumber == term || 
                                          (a.LegacyAccountNumber != null && a.LegacyAccountNumber.Trim() == term) ||
                                          a.AccountNo.EndsWith(term));

            if (account == null)
            {
                return NotFound(new { message = $"मुदत ठेव खाते क्र. '{term}' सापडले नाही." });
            }

            return await ReopenFdAccount(account.FdAccountID, new FdReopenRequest { Reason = request.Reason });
        }
    }

    public class FdInterestPreviewRequestDto
    {
        public int BranchID { get; set; } = 1;
        public DateTime AccrualDate { get; set; } = DateTime.Today;
        public string CalculationMethod { get; set; } = "OnPrincipal"; // "OnPrincipal" or "OnInterest"
    }

    public class FdInterestPreviewItemDto
    {
        public int FdAccountID { get; set; }
        public string AccountNo { get; set; } = string.Empty;
        public int CustomerID { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string CIFNo { get; set; } = string.Empty;
        public int MemberID { get; set; }
        public string MemberName { get; set; } = string.Empty;
        public string MemberCode { get; set; } = string.Empty;
        public string SchemeName { get; set; } = string.Empty;
        public DateTime OpeningDate { get; set; }
        public DateTime FromDate { get; set; }
        public DateTime? LastInterestPostingDate { get; set; }
        public decimal DepositAmount { get; set; }
        public decimal EffectivePrincipal { get; set; }
        public decimal AlreadyAccruedInterest { get; set; }
        public int ElapsedDays { get; set; }
        public decimal InterestRate { get; set; }
        public decimal CalculatedInterest { get; set; }
        public string CalculationMethod { get; set; } = "OnPrincipal";
        public bool IsSelected { get; set; } = true;
    }

    public class FdInterestPostRequestDto
    {
        public int BranchID { get; set; } = 1;
        public DateTime AccrualDate { get; set; } = DateTime.Today;
        public string CalculationMethod { get; set; } = "OnPrincipal";
        public string? PostingTarget { get; set; } = null; // "Principal" (Deposits Liability) | "Provision" (Interest Payable) | "Auto"
        public List<FdInterestPostItemDto> SelectedItems { get; set; } = new List<FdInterestPostItemDto>();
    }

    public class FdInterestPostItemDto
    {
        public int FdAccountID { get; set; }
        public decimal CalculatedInterest { get; set; }
        public int ElapsedDays { get; set; }
    }

    public class FdClosureRequest
    {
        public DateTime? ClosureDate { get; set; }
        public string PaymentMode { get; set; } = "Cash"; // "Cash", "Bank", "Transfer"
        public int? BankAccountLedgerID { get; set; }
        public string? ChequeNo { get; set; }
        public DateTime? ChequeDate { get; set; }
        public int? SavingAccountID { get; set; }
        public string? Narration { get; set; }

        // Overdue FD Support
        public bool ApplyOverdueInterest { get; set; } = false;
        public decimal? OverdueInterestRate { get; set; }
        public decimal? OverdueInterestAmount { get; set; }

        // 🛡️ Lien & Loan Recovery Support
        public bool AdjustInLoan { get; set; } = false;
        public int? TargetLoanAccountID { get; set; }
        public decimal? LoanAdjustmentAmount { get; set; }
        public string SurplusPaymentMode { get; set; } = "Cash"; // "Cash", "Bank", "Transfer"
        public int? SurplusSavingAccountID { get; set; }
        public int? SurplusBankLedgerID { get; set; }
        public string? SurplusChequeNo { get; set; }
        public DateTime? SurplusChequeDate { get; set; }

        // ✍️ Manual Amount Override Support (Legacy Reconciliation)
        public bool IsManualAmountOverride { get; set; } = false;
        public decimal? CustomAccruedInterest { get; set; }
        public decimal? CustomOverdueInterest { get; set; }
        public decimal? CustomTotalPayout { get; set; }
        public string? ManualOverrideReason { get; set; }

        // 🧾 Interest Debit Head Control: "Expense" (Direct मुदतठेवीवरील व्याज) | "Provision" (Clear देणे व्याज) | "Auto" | "Split"
        public string? InterestDebitMode { get; set; } = "Expense";

        // Dual-Head Split & Custom GL Debit / Reversal Controls (POSTING_INTR vs NAFATOTA DEY VYAJ)
        public decimal? PostedInterestDebitAmount { get; set; }
        public int? PostedInterestDebitLedgerID { get; set; }
        public decimal? ExpenseInterestDebitAmount { get; set; }
        public int? ExpenseInterestDebitLedgerID { get; set; }
        public decimal? ReversePostedInterestAmount { get; set; }
        public int? ReversalCreditLedgerID { get; set; }
    }

    public class FdRenewalRequest
    {
        public int TargetSchemeID { get; set; }
        public string RenewalType { get; set; } = "PrincipalPlusInterest"; // "PrincipalPlusInterest", "PrincipalOnly"
        public DateTime? ClosureDate { get; set; }
        public string PaymentMode { get; set; } = "Cash"; // For PrincipalOnly interest payout: "Cash", "Bank", "Transfer"
        public int? BankAccountLedgerID { get; set; }
        public string? ChequeNo { get; set; }
        public DateTime? ChequeDate { get; set; }
        public int? SavingAccountID { get; set; }
        public string? Narration { get; set; }

        // Flexible Duration Support
        public string? DurationType { get; set; } // "Days", "Months", "Years"
        public int? DurationValue { get; set; }

        // Overdue Renewal Support
        public string RenewalEffectiveFrom { get; set; } = "ClosureDate"; // "ClosureDate" or "MaturityDate"
        public bool ApplyOverdueInterest { get; set; } = false;
        public decimal? OverdueInterestRate { get; set; }

        // ✍️ Manual Amount Override Support (Legacy Reconciliation)
        public bool IsManualAmountOverride { get; set; } = false;
        public decimal? CustomAccruedInterest { get; set; }
        public decimal? CustomOverdueInterest { get; set; }
        public decimal? CustomTotalPayout { get; set; }
        public string? ManualOverrideReason { get; set; }

        // पावती क्रमांक धोरण (Receipt Numbering Option)
        public string? ReceiptNoMode { get; set; } // "NEW_RECEIPT", "RETAIN_ORIGINAL", "CUSTOM"
        public string? CustomReceiptNo { get; set; }

        // मॅन्युअल नूतनीकरण व्याजदर बदल (Auto-filled default, optional direct override)
        public decimal? CustomInterestRate { get; set; }
        public string? InterestRateOverrideReason { get; set; }

        // 🧾 Interest Debit Head Control: "Expense" (Direct मुदतठेवीवरील व्याज) | "Provision" (Clear देणे व्याज) | "Auto" | "Split"
        public string? InterestDebitMode { get; set; } = "Expense";

        // Dual-Head Split & Custom GL Debit Controls (POSTING_INTR vs NAFATOTA DEY VYAJ)
        public decimal? PostedInterestDebitAmount { get; set; }
        public int? PostedInterestDebitLedgerID { get; set; }
        public decimal? ExpenseInterestDebitAmount { get; set; }
        public int? ExpenseInterestDebitLedgerID { get; set; }
    }

    public class AutoRenewalCandidateDto
    {
        public int FdAccountID { get; set; }
        public string AccountNo { get; set; } = string.Empty;
        public string ReceiptNo { get; set; } = string.Empty;
        public int RenewalCycleNo { get; set; }
        public int CustomerID { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string? ContactNo { get; set; }
        public int BranchID { get; set; }
        public string BranchName { get; set; } = string.Empty;
        public int FdSchemeID { get; set; }
        public string SchemeName { get; set; } = string.Empty;
        public DateTime OpeningDate { get; set; }
        public DateTime MaturityDate { get; set; }
        public decimal DepositAmount { get; set; }
        public decimal MaturityAmount { get; set; }
        public decimal InterestRate { get; set; }
        public string DurationType { get; set; } = "Months";
        public int DurationValue { get; set; }
        public int DurationInDays { get; set; }
        public bool IsAutoRenewable { get; set; }
        public string AutoRenewalOption { get; set; } = "PrincipalPlusInterest";
        public int AutoRenewalCount { get; set; }
        public int MaxAutoRenewalCycles { get; set; }
        public int? SavingAccountID { get; set; }
        public string? SavingAccountNo { get; set; }
        public decimal? SavingBalance { get; set; }
        public bool HasActiveLoan { get; set; }
        public decimal ActiveLoanBalance { get; set; }
        public decimal ProjectedRenewedAmount { get; set; }
        public decimal ProjectedInterestPayout { get; set; }
        public decimal PrevailingRate { get; set; }
    }

    public class AutoRenewalBatchRequest
    {
        public int? BranchID { get; set; }
        public DateTime? ProcessDate { get; set; }
        public List<int>? SpecificAccountIDs { get; set; }
        public string? ExecutedBy { get; set; }
    }

    public class AutoRenewalBatchResultDto
    {
        public int TotalCandidates { get; set; }
        public int SuccessCount { get; set; }
        public int FailedCount { get; set; }
        public decimal TotalRenewedAmount { get; set; }
        public decimal TotalInterestPaidOut { get; set; }
        public List<AutoRenewalItemResultDto> Items { get; set; } = new List<AutoRenewalItemResultDto>();
    }

    public class AutoRenewalItemResultDto
    {
        public int OldFdAccountID { get; set; }
        public string OldAccountNo { get; set; } = string.Empty;
        public string OldReceiptNo { get; set; } = string.Empty;
        public int? NewFdAccountID { get; set; }
        public string? NewAccountNo { get; set; }
        public string? NewReceiptNo { get; set; }
        public string? EffectivePolicy { get; set; }
        public int RenewalCycleNo { get; set; }
        public int? VoucherID { get; set; }
        public string? VoucherNo { get; set; }
        public DateTime? VoucherDate { get; set; }
        public string VoucherStatus { get; set; } = "Pending";
        public string CustomerName { get; set; } = string.Empty;
        public decimal RenewedAmount { get; set; }
        public decimal InterestPaidOut { get; set; }
        public decimal AppliedRate { get; set; }
        public string RenewalOption { get; set; } = string.Empty;
        public string Status { get; set; } = "Success"; // Success / Failed
        public string? ErrorMessage { get; set; }
    }

    public class RevertAutoRenewalRequest
    {
        [Required]
        public string RevertReason { get; set; } = string.Empty;
        public string? RevertedBy { get; set; }
    }

    public class FdReopenRequest
    {
        public string? Reason { get; set; }
    }

    public class FdReopenByNumberRequest
    {
        [Required]
        public string AccountNumber { get; set; } = string.Empty;
        public string? Reason { get; set; }
    }
}
