using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Helpers;
using Microsoft.AspNetCore.Authorization;

namespace Bhisi.Api.Controllers
{
    public class PayoutLedgerOptionDto
    {
        public int LedgerID { get; set; }
        public string LedgerName { get; set; } = string.Empty;
        public string LedgerCode { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty; // "SavingTransfer", "Cash", "Bank", "Suspense"
        public bool IsDefault { get; set; }
    }

    public class CustomerSavingAccountOptionDto
    {
        public int SavingAccountID { get; set; }
        public string AccountNo { get; set; } = string.Empty;
        public string OldAccountNo { get; set; } = string.Empty;
        public string CifNo { get; set; } = string.Empty;
        public decimal CurrentBalance { get; set; }
        public int BranchID { get; set; }
        public string BranchName { get; set; } = string.Empty;
        public int LedgerID { get; set; }
        public string LedgerName { get; set; } = string.Empty;
    }

    public class FdMisPreviewRequestDto
    {
        public int BranchID { get; set; } = 1;
        public int? FdSchemeID { get; set; }
        public int PayoutYear { get; set; } = DateTime.Today.Year;
        public int PayoutMonth { get; set; } = DateTime.Today.Month;
        public DateTime PayoutDate { get; set; } = DateTime.Today;
        public string AccountingMode { get; set; } = "DirectExpense"; // DirectExpense or ClearPayable
        public string CalculationMethod { get; set; } = "SchemeDefault"; // "SchemeDefault", "Monthly" ((P*R)/1200), or "Daily" ((P*R*Days)/36500)
    }

    public class FdMisPreviewItemDto
    {
        public int FdAccountID { get; set; }
        public int FdSchemeID { get; set; }
        public string AccountNo { get; set; } = string.Empty;
        public int CustomerID { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string CifNo { get; set; } = string.Empty;
        public int? MemberID { get; set; }
        public string MemberNo { get; set; } = string.Empty;
        public string SchemeName { get; set; } = string.Empty;
        public string SchemeCalculationMethod { get; set; } = "Monthly";
        public DateTime OpeningDate { get; set; }
        public DateTime MaturityDate { get; set; }
        public decimal DepositPrincipal { get; set; }
        public decimal InterestRate { get; set; }
        public int ElapsedDays { get; set; }
        public int AutoElapsedDays { get; set; }
        public DateTime PeriodFromDate { get; set; }
        public DateTime PeriodToDate { get; set; }
        public bool IsBrokenPeriod { get; set; }
        public decimal GrossInterest { get; set; }
        public decimal AutoGrossInterest { get; set; }
        public decimal TdsAmount { get; set; }
        public decimal LoanAdjustedAmount { get; set; }
        public decimal NetDisbursedAmount { get; set; }
        public string DisbursementMode { get; set; } = "SavingTransfer"; // SavingTransfer, LoanRecovery, Suspense, Cash, Bank
        public int? TargetSavingAccountID { get; set; }
        public string? TargetSavingAccountNo { get; set; }
        public string? TargetSavingOldAccountNo { get; set; }
        public string? TargetSavingCifNo { get; set; }
        public decimal? TargetSavingAccountBalance { get; set; }
        public int? TargetCreditLedgerID { get; set; }
        public string? TargetCreditLedgerName { get; set; }
        public List<CustomerSavingAccountOptionDto> CustomerSavingAccounts { get; set; } = new();
        public int? TargetLoanAccountID { get; set; }
        public string? TargetLoanAccountNo { get; set; }
        public decimal? TargetLoanBalance { get; set; }
        public bool IsAlreadyPaid { get; set; }
        public bool IsLienMarked { get; set; }
        public string? WarningNote { get; set; }
        public bool IsSelected { get; set; }
    }

    public class FdMisBatchExecuteItemDto
    {
        public int FdAccountID { get; set; }
        public int ElapsedDays { get; set; }
        public decimal GrossInterest { get; set; }
        public decimal TdsAmount { get; set; }
        public decimal LoanAdjustedAmount { get; set; }
        public decimal NetDisbursedAmount { get; set; }
        public string DisbursementMode { get; set; } = "SavingTransfer";
        public int? TargetSavingAccountID { get; set; }
        public int? TargetLoanAccountID { get; set; }
        public int? BankLedgerID { get; set; }
        public int? CreditLedgerID { get; set; }
        public string? Remarks { get; set; }
    }

    public class FdMisBatchExecuteRequestDto
    {
        public int BranchID { get; set; } = 1;
        public int PayoutYear { get; set; } = DateTime.Today.Year;
        public int PayoutMonth { get; set; } = DateTime.Today.Month;
        public DateTime PayoutDate { get; set; } = DateTime.Today;
        public string AccountingMode { get; set; } = "DirectExpense"; // DirectExpense or ClearPayable
        public int? BankLedgerID { get; set; }
        public List<FdMisBatchExecuteItemDto> SelectedItems { get; set; } = new();
    }

    [Route("api/[controller]")]
    [ApiController]
    public class FdMisPayoutController : ControllerBase
    {
        private readonly AppDbContext _context;
        private static bool _tableVerified = false;

        public FdMisPayoutController(AppDbContext context)
        {
            _context = context;
        }

        private async Task EnsureTableExistsAsync()
        {
            if (_tableVerified) return;

            string sql = @"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FdMisPayouts')
                BEGIN
                    CREATE TABLE [FdMisPayouts] (
                        [PayoutID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                        [InstitutionID] int NOT NULL DEFAULT 1,
                        [BranchID] int NOT NULL DEFAULT 1,
                        [FinancialYearID] int NOT NULL DEFAULT 1,
                        [FdAccountID] int NOT NULL,
                        [PayoutYear] int NOT NULL,
                        [PayoutMonth] int NOT NULL,
                        [PayoutDate] datetime2 NOT NULL,
                        [PeriodFromDate] datetime2 NULL,
                        [PeriodToDate] datetime2 NULL,
                        [ElapsedDays] int NOT NULL DEFAULT 0,
                        [DepositPrincipal] decimal(18,2) NOT NULL DEFAULT 0,
                        [InterestRate] decimal(5,2) NOT NULL DEFAULT 0,
                        [GrossInterest] decimal(18,2) NOT NULL DEFAULT 0,
                        [TdsAmount] decimal(18,2) NOT NULL DEFAULT 0,
                        [LoanAdjustedAmount] decimal(18,2) NOT NULL DEFAULT 0,
                        [NetDisbursedAmount] decimal(18,2) NOT NULL DEFAULT 0,
                        [DisbursementMode] nvarchar(30) NOT NULL DEFAULT 'SavingTransfer',
                        [TargetSavingAccountID] int NULL,
                        [TargetLoanAccountID] int NULL,
                        [VoucherID] int NULL,
                        [Status] nvarchar(20) NOT NULL DEFAULT 'Success',
                        [CreatedBy] int NOT NULL DEFAULT 1,
                        [CreatedDate] datetime2 NOT NULL DEFAULT GETDATE(),
                        [Remarks] nvarchar(250) NULL
                    );
                END

                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_FdMisPayouts_Account_Year_Month')
                BEGIN
                    CREATE UNIQUE INDEX [IX_FdMisPayouts_Account_Year_Month] 
                    ON [FdMisPayouts] ([FdAccountID], [PayoutYear], [PayoutMonth])
                    WHERE [Status] = 'Success';
                END

                IF EXISTS (SELECT * FROM sys.tables WHERE name = 'FdSchemes')
                BEGIN
                    IF COL_LENGTH('FdSchemes', 'InterestCalculationMethod') IS NULL
                    BEGIN
                        ALTER TABLE [FdSchemes] ADD [InterestCalculationMethod] nvarchar(20) NOT NULL CONSTRAINT [DF_FdSchemes_InterestCalcMethod_Auto] DEFAULT 'Monthly';
                        EXEC(N'UPDATE [FdSchemes] SET [InterestCalculationMethod] = ''Daily'' WHERE [DurationType] = ''Days'' OR [SchemeDurationModel] = ''Slab'';');
                    END
                END";

            try
            {
                await _context.Database.ExecuteSqlRawAsync(sql);
                _tableVerified = true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Ensure FdMisPayouts Table: {ex.Message}");
            }
        }

        private (bool isHO, int? userBranchId) GetUserBranchInfo()
        {
            int? userBranchId = User.GetOperatingBranchId();
            bool isHO = User.IsHeadOfficeAdmin();
            return (isHO, userBranchId);
        }

        private async Task<List<PayoutLedgerOptionDto>> GetCategorizedPayoutLedgersAsync(int branchId)
        {
            var allLedgers = await _context.Ledgers
                .AsNoTracking()
                .Include(l => l.AccountGroup)
                .Where(l => l.IsActive)
                .OrderBy(l => l.LedgerID)
                .ToListAsync();

            var ledgerDict = allLedgers.ToDictionary(l => l.LedgerID);
            var result = new List<PayoutLedgerOptionDto>();
            var addedIds = new HashSet<int>();

            void TryAddOption(Ledger? ledger, string category, bool isDefault = false)
            {
                if (ledger == null || ledger.LedgerID <= 0 || addedIds.Contains(ledger.LedgerID))
                    return;
                addedIds.Add(ledger.LedgerID);
                result.Add(new PayoutLedgerOptionDto
                {
                    LedgerID = ledger.LedgerID,
                    LedgerName = ledger.LedgerName ?? string.Empty,
                    LedgerCode = ledger.LedgerCode ?? string.Empty,
                    Category = category,
                    IsDefault = isDefault
                });
            }

            // 1. Saving Deposit Liability Ledgers (SavingTransfer)
            var today = DateTime.Today;
            var savingSchemes = await _context.SavingInterestSettings
                .AsNoTracking()
                .OrderByDescending(s => s.EffectiveDate <= today)
                .ThenByDescending(s => s.EffectiveDate)
                .ThenByDescending(s => s.SettingID)
                .ToListAsync();

            var interestPayableIds = savingSchemes
                .Where(s => s.InterestPayableLedgerID.HasValue && s.InterestPayableLedgerID.Value > 0)
                .Select(s => s.InterestPayableLedgerID!.Value)
                .ToHashSet();

            bool defaultSavingAssigned = false;
            foreach (var scheme in savingSchemes)
            {
                int? candidateId = (scheme.SavingLiabilityLedgerID.HasValue && scheme.SavingLiabilityLedgerID.Value > 0)
                    ? scheme.SavingLiabilityLedgerID
                    : scheme.LedgerID;
                if (candidateId.HasValue && ledgerDict.TryGetValue(candidateId.Value, out var savLedger) &&
                    SavingLedgerHelper.IsValidSavingLiabilityLedger(savLedger) &&
                    !BankLedgerHelper.IsBankLedger(savLedger) &&
                    !BankLedgerHelper.IsCashLedger(savLedger))
                {
                    TryAddOption(savLedger, "SavingTransfer", !defaultSavingAssigned);
                    defaultSavingAssigned = true;
                }
            }

            var savingMappings = await _context.SavingVoucherMappings
                .AsNoTracking()
                .Where(m => m.OperationType == "SavingControl" || m.OperationType == "SavingLiability" || m.OperationType == "Deposit")
                .Select(m => m.LedgerID)
                .Distinct()
                .ToListAsync();

            foreach (var mapId in savingMappings)
            {
                if (ledgerDict.TryGetValue(mapId, out var savLedger) &&
                    SavingLedgerHelper.IsValidSavingLiabilityLedger(savLedger) &&
                    !BankLedgerHelper.IsBankLedger(savLedger) &&
                    !BankLedgerHelper.IsCashLedger(savLedger))
                {
                    TryAddOption(savLedger, "SavingTransfer", !defaultSavingAssigned);
                    defaultSavingAssigned = true;
                }
            }

            var distinctAccountLedgerIds = await _context.SavingAccountMasters
                .AsNoTracking()
                .Where(s => s.LedgerID > 0 && s.Status != "Closed" && s.Status != "बंद")
                .Select(s => s.LedgerID)
                .Distinct()
                .ToListAsync();

            foreach (var accLedgerId in distinctAccountLedgerIds)
            {
                if (ledgerDict.TryGetValue(accLedgerId, out var savLedger) &&
                    SavingLedgerHelper.IsValidSavingLiabilityLedger(savLedger) &&
                    !BankLedgerHelper.IsBankLedger(savLedger) &&
                    !BankLedgerHelper.IsCashLedger(savLedger))
                {
                    TryAddOption(savLedger, "SavingTransfer", !defaultSavingAssigned);
                    defaultSavingAssigned = true;
                }
            }

            foreach (var l in allLedgers)
            {
                if (addedIds.Contains(l.LedgerID) || interestPayableIds.Contains(l.LedgerID))
                    continue;

                string accType = (l.AccountType ?? string.Empty).Trim();
                string grpText = $"{l.AccountGroup?.GroupName} {l.AccountGroup?.GroupNameEnglish}".ToLowerInvariant();
                string lName = (l.LedgerName ?? string.Empty);
                bool looksLikeSavingGroup = string.Equals(accType, "Savings", StringComparison.OrdinalIgnoreCase)
                    || grpText.Contains("बचत")
                    || grpText.Contains("saving")
                    || (lName.Contains("बचत") && !lName.Contains("व्याज") && !lName.Contains("देणे"));

                if (looksLikeSavingGroup &&
                    SavingLedgerHelper.IsValidSavingLiabilityLedger(l) &&
                    !BankLedgerHelper.IsBankLedger(l) &&
                    !BankLedgerHelper.IsCashLedger(l))
                {
                    TryAddOption(l, "SavingTransfer", !defaultSavingAssigned);
                    defaultSavingAssigned = true;
                }
            }

            // 2. Cash Ledgers (Cash)
            int defaultCashId = 0;
            try
            {
                defaultCashId = await CashLedgerHelper.GetCashLedgerIdAsync(_context, branchId, "FD");
            }
            catch
            {
                defaultCashId = 0;
            }

            if (defaultCashId > 0 && ledgerDict.TryGetValue(defaultCashId, out var defCashLedger))
            {
                TryAddOption(defCashLedger, "Cash", true);
            }

            foreach (var l in allLedgers.Where(BankLedgerHelper.IsCashLedger))
            {
                TryAddOption(l, "Cash", defaultCashId <= 0 && !result.Any(x => x.Category == "Cash"));
            }

            // 3. Bank Account GL Ledgers (Bank)
            bool defaultBankAssigned = false;
            foreach (var l in allLedgers.Where(BankLedgerHelper.IsBankLedger))
            {
                TryAddOption(l, "Bank", !defaultBankAssigned);
                defaultBankAssigned = true;
            }

            // 4. Suspense Ledgers (Suspense)
            bool defaultSuspAssigned = false;
            foreach (var l in allLedgers)
            {
                if (addedIds.Contains(l.LedgerID) || BankLedgerHelper.IsBankLedger(l) || BankLedgerHelper.IsCashLedger(l))
                    continue;
                string lName = l.LedgerName ?? string.Empty;
                if (lName.Contains("उचंत") || lName.Contains("न मागितलेले") || lName.Contains("Suspense", StringComparison.OrdinalIgnoreCase))
                {
                    TryAddOption(l, "Suspense", !defaultSuspAssigned);
                    defaultSuspAssigned = true;
                }
            }

            return result;
        }

        // GET: api/FdMisPayout/PayoutLedgers
        [HttpGet("PayoutLedgers")]
        [Authorize]
        public async Task<IActionResult> GetPayoutLedgers([FromQuery] int? branchId)
        {
            await EnsureTableExistsAsync();
            var (isHO, userBranchId) = GetUserBranchInfo();
            int effectiveBranchId = (!isHO && userBranchId.HasValue && userBranchId.Value > 0)
                ? userBranchId.Value
                : (branchId.HasValue && branchId.Value > 0 ? branchId.Value : 1);

            var ledgers = await GetCategorizedPayoutLedgersAsync(effectiveBranchId);
            return Ok(ledgers);
        }

        // POST: api/FdMisPayout/Preview
        [HttpPost("Preview")]
        [Authorize]
        public async Task<IActionResult> Preview([FromBody] FdMisPreviewRequestDto req)
        {
            await EnsureTableExistsAsync();

            var (isHO, userBranchId) = GetUserBranchInfo();
            if (!isHO && userBranchId.HasValue && userBranchId.Value > 0)
            {
                req.BranchID = userBranchId.Value;
            }

            if (req.PayoutMonth < 1 || req.PayoutMonth > 12)
            {
                return BadRequest("अवैध महिना निवडला आहे (१ ते १२ दरम्यान असावा).");
            }

            int daysInMonth = DateTime.DaysInMonth(req.PayoutYear, req.PayoutMonth);
            var monthStart = new DateTime(req.PayoutYear, req.PayoutMonth, 1);
            var monthEnd = new DateTime(req.PayoutYear, req.PayoutMonth, daysInMonth);

            // Fetch all active FD accounts in this branch
            var misQuery = _context.FdAccounts
                .Include(a => a.Customer)
                .Include(a => a.SavingAccount)
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.InterestExpenseLedger)
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.InterestPayableLedger)
                .Where(a => a.BranchID == req.BranchID && a.Status == "Active");

            if (req.FdSchemeID.HasValue && req.FdSchemeID.Value > 0)
            {
                misQuery = misQuery.Where(a => a.FdSchemeID == req.FdSchemeID.Value);
            }
            else
            {
                // Match MIS, Monthly Interest, or any common FD scheme (including मुदतबंद ठेव, मुदत ठेव, etc.)
                misQuery = misQuery.Where(a => a.FdScheme != null && (
                    a.FdScheme.InterestType == "MIS" || 
                    a.FdScheme.InterestType == "Monthly Interest" || 
                    a.FdScheme.InterestPayoutFrequency == "Monthly" ||
                    (a.FdScheme.InterestPayoutFrequency != null && a.FdScheme.InterestPayoutFrequency.ToLower().Contains("monthly")) ||
                    a.FdScheme.SchemeName.Contains("मासिक") ||
                    a.FdScheme.SchemeName.Contains("MIS") ||
                    a.FdScheme.SchemeName.Contains("मुदतबंद") ||
                    a.FdScheme.SchemeName.Contains("मुदत ठेव") ||
                    a.FdScheme.SchemeName.Contains("Thev")
                ));
            }

            var activeMisAccounts = await misQuery.ToListAsync();

            // Preload categorized payout ledgers & active ledger dictionary for zero-hardcoding resolution
            var payoutLedgers = await GetCategorizedPayoutLedgersAsync(req.BranchID);
            var allLedgersList = await _context.Ledgers
                .AsNoTracking()
                .Include(l => l.AccountGroup)
                .ToListAsync();
            var allLedgersDict = allLedgersList.ToDictionary(l => l.LedgerID);

            int defaultSavingLedgerId = payoutLedgers.FirstOrDefault(x => x.Category == "SavingTransfer" && x.IsDefault)?.LedgerID
                ?? payoutLedgers.FirstOrDefault(x => x.Category == "SavingTransfer")?.LedgerID
                ?? 0;
            int defaultCashLedgerId = payoutLedgers.FirstOrDefault(x => x.Category == "Cash" && x.IsDefault)?.LedgerID
                ?? payoutLedgers.FirstOrDefault(x => x.Category == "Cash")?.LedgerID
                ?? 0;
            int defaultSuspenseLedgerId = payoutLedgers.FirstOrDefault(x => x.Category == "Suspense" && x.IsDefault)?.LedgerID
                ?? payoutLedgers.FirstOrDefault(x => x.Category == "Suspense")?.LedgerID
                ?? 0;

            // Load existing successful payouts for this month/year to prevent duplicate payout attempts
            var existingPayouts = await _context.FdMisPayouts
                .Where(p => p.PayoutYear == req.PayoutYear && p.PayoutMonth == req.PayoutMonth && p.Status == "Success")
                .ToListAsync();

            var previewList = new List<FdMisPreviewItemDto>();

            foreach (var acc in activeMisAccounts)
            {
                // Skip accounts opened after this month or matured before this month
                if (acc.OpeningDate.Date > monthEnd) continue;
                if (acc.MaturityDate.Date < monthStart) continue;

                bool isAlreadyPaid = existingPayouts.Any(p => p.FdAccountID == acc.FdAccountID);

                DateTime fromDate;
                bool isBrokenPeriod = false;

                // Broken Period check on opening: strictly after 1st of month
                if (acc.OpeningDate.Date > monthStart)
                {
                    fromDate = acc.OpeningDate.Date;
                    isBrokenPeriod = true;
                }
                else
                {
                    fromDate = monthStart;
                }

                // Broken Period check on maturity: strictly before end of month
                DateTime toDate;
                if (acc.MaturityDate.Date < monthEnd)
                {
                    toDate = acc.MaturityDate.Date;
                    isBrokenPeriod = true;
                }
                else
                {
                    toDate = monthEnd;
                }

                if (toDate < fromDate) continue;

                int elapsedDays;
                if (isBrokenPeriod)
                {
                    elapsedDays = (toDate - fromDate).Days + 1;
                }
                else
                {
                    // Full month: Exact calendar days in this month (e.g. May = 31, April = 30, Feb = 28/29)
                    elapsedDays = daysInMonth;
                }

                string rawSchemeMethod = (acc.FdScheme?.InterestCalculationMethod ?? string.Empty).Trim();
                string schemeCalcMethod = string.Equals(rawSchemeMethod, "Daily", StringComparison.OrdinalIgnoreCase)
                    || (!string.Equals(rawSchemeMethod, "Monthly", StringComparison.OrdinalIgnoreCase) &&
                        (acc.FdScheme?.DurationType == "Days" || acc.FdScheme?.SchemeDurationModel == "Slab"))
                    ? "Daily"
                    : "Monthly";

                string effectiveMethod = (string.IsNullOrWhiteSpace(req.CalculationMethod) ||
                                          string.Equals(req.CalculationMethod, "SchemeDefault", StringComparison.OrdinalIgnoreCase))
                    ? schemeCalcMethod
                    : req.CalculationMethod;

                decimal grossInterest;
                if (string.Equals(effectiveMethod, "Daily", StringComparison.OrdinalIgnoreCase))
                {
                    // Exact daily formula: (P * R * elapsedDays) / 36500
                    grossInterest = Math.Round((acc.DepositAmount * acc.InterestRate * elapsedDays) / 36500.0m, 0, MidpointRounding.AwayFromZero);
                }
                else
                {
                    // Standard CBS Monthly: if broken period, calculate pro-rata; if full month, calculate standard (P * R) / 1200
                    if (isBrokenPeriod)
                    {
                        grossInterest = Math.Round((acc.DepositAmount * acc.InterestRate * elapsedDays) / 36500.0m, 0, MidpointRounding.AwayFromZero);
                    }
                    else
                    {
                        grossInterest = Math.Round((acc.DepositAmount * acc.InterestRate) / 1200.0m, 0, MidpointRounding.AwayFromZero);
                    }
                }

                // Member lookup
                int? memberId = null;
                string memberNo = string.Empty;
                if (acc.CustomerID > 0)
                {
                    var mem = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == acc.CustomerID);
                    if (mem != null)
                    {
                        memberId = mem.MemberID;
                        memberNo = mem.MemberCode ?? string.Empty;
                    }
                }

                // Saving Account Resolution
                var sb = acc.SavingAccount;
                if (sb == null && acc.SavingAccountID.HasValue && acc.SavingAccountID.Value > 0)
                {
                    sb = await _context.SavingAccountMasters
                        .Include(s => s.Branch)
                        .Include(s => s.Customer)
                        .Include(s => s.Ledger)
                        .Include(s => s.SavingScheme)
                        .FirstOrDefaultAsync(s => s.SavingAccountID == acc.SavingAccountID.Value);
                }

                // Fetch all unclosed saving accounts for this customer (including joint accounts) to enable selection in UI
                var customerSavingAccounts = new List<CustomerSavingAccountOptionDto>();
                string customerCif = acc.Customer?.CIFNo ?? string.Empty;

                var sbsQuery = _context.SavingAccountMasters
                    .Include(s => s.Branch)
                    .Include(s => s.Customer)
                    .Include(s => s.Ledger)
                    .Include(s => s.SavingScheme)
                    .Include(s => s.JointHolders)
                    .Where(s => s.Status != "Closed" && s.Status != "बंद");

                if (acc.CustomerID > 0 && !string.IsNullOrEmpty(customerCif))
                {
                    sbsQuery = sbsQuery.Where(s =>
                        s.CustomerID == acc.CustomerID ||
                        (s.Customer != null && s.Customer.CIFNo == customerCif) ||
                        s.JointHolders.Any(jh => jh.CustomerID == acc.CustomerID));
                }
                else if (acc.CustomerID > 0)
                {
                    sbsQuery = sbsQuery.Where(s =>
                        s.CustomerID == acc.CustomerID ||
                        s.JointHolders.Any(jh => jh.CustomerID == acc.CustomerID));
                }
                else if (!string.IsNullOrEmpty(customerCif))
                {
                    sbsQuery = sbsQuery.Where(s => s.Customer != null && s.Customer.CIFNo == customerCif);
                }

                var activeSbs = await sbsQuery
                    .OrderByDescending(s => s.SavingAccountID == acc.SavingAccountID)
                    .ThenByDescending(s => s.BranchID == acc.BranchID)
                    .ThenBy(s => s.SavingAccountID)
                    .ToListAsync();

                // If explicitly linked sb exists and is unclosed, ensure it is in the options list
                if (sb != null && sb.Status != "Closed" && sb.Status != "बंद" && !activeSbs.Any(s => s.SavingAccountID == sb.SavingAccountID))
                {
                    activeSbs.Insert(0, sb);
                }

                foreach (var s in activeSbs)
                {
                    int resolvedSbLedgerId = await SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(
                        _context,
                        s,
                        preloadedLedgers: allLedgersDict);
                    if (resolvedSbLedgerId <= 0)
                    {
                        resolvedSbLedgerId = s.LedgerID > 0 ? s.LedgerID : defaultSavingLedgerId;
                    }
                    string resolvedSbLedgerName = (resolvedSbLedgerId > 0 && allLedgersDict.TryGetValue(resolvedSbLedgerId, out var sbLed))
                        ? (sbLed.LedgerName ?? "बचत ठेव")
                        : (s.Ledger?.LedgerName ?? "बचत ठेव");

                    string oldNo = !string.IsNullOrWhiteSpace(s.OldAccountNo)
                        ? s.OldAccountNo.Trim()
                        : (s.LegacyAccountNumber?.Trim() ?? string.Empty);
                    string sbCif = !string.IsNullOrWhiteSpace(s.Customer?.CIFNo)
                        ? s.Customer!.CIFNo!
                        : customerCif;

                    customerSavingAccounts.Add(new CustomerSavingAccountOptionDto
                    {
                        SavingAccountID = s.SavingAccountID,
                        AccountNo = s.AccountNo,
                        OldAccountNo = oldNo,
                        CifNo = sbCif,
                        CurrentBalance = s.CurrentBalance,
                        BranchID = s.BranchID,
                        BranchName = s.Branch?.BranchName ?? $"शाखा {s.BranchID}",
                        LedgerID = resolvedSbLedgerId,
                        LedgerName = resolvedSbLedgerName
                    });
                }

                // If original account is null or closed, default to the customer's first unclosed saving account
                if ((sb == null || sb.Status == "Closed" || sb.Status == "बंद") && activeSbs.Any())
                {
                    sb = activeSbs.First();
                }

                bool isSbActive = sb != null && sb.Status != "Closed" && sb.Status != "बंद";
                var selectedSbOption = sb != null
                    ? customerSavingAccounts.FirstOrDefault(x => x.SavingAccountID == sb.SavingAccountID)
                    : customerSavingAccounts.FirstOrDefault();

                // Lien & Active Loan Check
                bool isLienMarked = acc.IsLienMarked;
                LoanAccount? targetLoan = null;

                if (isLienMarked && !string.IsNullOrWhiteSpace(acc.LienLoanAccountNo))
                {
                    targetLoan = await _context.LoanAccounts
                        .FirstOrDefaultAsync(l => l.LoanAccountNo == acc.LienLoanAccountNo && l.Status == "Active");
                }

                // If not lien marked, check if customer has delinquent or active loans
                if (targetLoan == null && acc.CustomerID > 0)
                {
                    targetLoan = await _context.LoanAccounts
                        .Where(l => l.CustomerID == acc.CustomerID && l.Status == "Active" && (l.PrincipalBalance > 0 || l.InterestBalance > 0))
                        .OrderByDescending(l => l.OverdueInterestBalance > 0)
                        .FirstOrDefaultAsync();
                }

                // Distribution Mode & Default Target Credit Ledger Resolution
                string disbMode = "SavingTransfer";
                string? warningNote = null;
                decimal loanAdjAmount = 0m;
                decimal netDisbursed = grossInterest;
                int? targetCreditLedgerId = null;
                string? targetCreditLedgerName = null;

                if (isLienMarked && targetLoan != null)
                {
                    disbMode = "LoanRecovery";
                    loanAdjAmount = grossInterest;
                    netDisbursed = 0m;
                    warningNote = $"ठेव तारण कर्ज क्र. {targetLoan.LoanAccountNo} असल्याने मासिक व्याज कर्जात वळती होईल.";
                }
                else if (isSbActive)
                {
                    disbMode = "SavingTransfer";
                    netDisbursed = grossInterest;
                    targetCreditLedgerId = selectedSbOption?.LedgerID > 0 ? selectedSbOption.LedgerID : (defaultSavingLedgerId > 0 ? defaultSavingLedgerId : null);
                    if (targetCreditLedgerId.HasValue && allLedgersDict.TryGetValue(targetCreditLedgerId.Value, out var crLed))
                    {
                        targetCreditLedgerName = crLed.LedgerName;
                    }
                    else
                    {
                        targetCreditLedgerName = selectedSbOption?.LedgerName;
                    }
                }
                else
                {
                    disbMode = "Suspense";
                    netDisbursed = grossInterest;
                    targetCreditLedgerId = defaultSuspenseLedgerId > 0 ? defaultSuspenseLedgerId : null;
                    if (targetCreditLedgerId.HasValue && allLedgersDict.TryGetValue(targetCreditLedgerId.Value, out var suspLed))
                    {
                        targetCreditLedgerName = suspLed.LedgerName;
                    }
                    warningNote = "संलग्न बचत खाते बंद/निष्क्रिय आहे. आपण रोख, बँक किंवा बचत लेजर निवडू शकता.";
                }

                previewList.Add(new FdMisPreviewItemDto
                {
                    FdAccountID = acc.FdAccountID,
                    FdSchemeID = acc.FdSchemeID,
                    AccountNo = acc.AccountNo,
                    CustomerID = acc.CustomerID,
                    CustomerName = acc.Customer?.FullName ?? "अज्ञात ग्राहक",
                    CifNo = acc.Customer?.CIFNo ?? "",
                    MemberID = memberId,
                    MemberNo = memberNo,
                    SchemeName = acc.FdScheme?.SchemeName ?? "मुदत ठेव योजना",
                    SchemeCalculationMethod = schemeCalcMethod,
                    OpeningDate = acc.OpeningDate,
                    MaturityDate = acc.MaturityDate,
                    DepositPrincipal = acc.DepositAmount,
                    InterestRate = acc.InterestRate,
                    ElapsedDays = elapsedDays,
                    PeriodFromDate = fromDate,
                    PeriodToDate = toDate,
                    IsBrokenPeriod = isBrokenPeriod,
                    GrossInterest = grossInterest,
                    AutoGrossInterest = grossInterest,
                    AutoElapsedDays = elapsedDays,
                    TdsAmount = 0m, // Standard threshold evaluation can be expanded
                    LoanAdjustedAmount = loanAdjAmount,
                    NetDisbursedAmount = netDisbursed,
                    DisbursementMode = disbMode,
                    TargetSavingAccountID = sb?.SavingAccountID,
                    TargetSavingAccountNo = sb?.AccountNo,
                    TargetSavingOldAccountNo = selectedSbOption?.OldAccountNo ?? (!string.IsNullOrWhiteSpace(sb?.OldAccountNo) ? sb.OldAccountNo.Trim() : (sb?.LegacyAccountNumber?.Trim() ?? "")),
                    TargetSavingCifNo = !string.IsNullOrWhiteSpace(selectedSbOption?.CifNo) ? selectedSbOption!.CifNo : (acc.Customer?.CIFNo ?? ""),
                    TargetSavingAccountBalance = sb?.CurrentBalance,
                    TargetCreditLedgerID = targetCreditLedgerId,
                    TargetCreditLedgerName = targetCreditLedgerName,
                    CustomerSavingAccounts = customerSavingAccounts,
                    TargetLoanAccountID = targetLoan?.LoanAccountID,
                    TargetLoanAccountNo = targetLoan?.LoanAccountNo,
                    TargetLoanBalance = targetLoan != null ? (targetLoan.PrincipalBalance + targetLoan.InterestBalance) : null,
                    IsAlreadyPaid = isAlreadyPaid,
                    IsLienMarked = isLienMarked,
                    WarningNote = warningNote,
                    IsSelected = !isAlreadyPaid && grossInterest > 0
                });
            }

            return Ok(new
            {
                BranchID = req.BranchID,
                PayoutYear = req.PayoutYear,
                PayoutMonth = req.PayoutMonth,
                PayoutDate = req.PayoutDate,
                MonthName = new DateTime(req.PayoutYear, req.PayoutMonth, 1).ToString("MMMM yyyy"),
                TotalAccounts = previewList.Count,
                PendingAccounts = previewList.Count(x => !x.IsAlreadyPaid),
                TotalGrossInterest = previewList.Where(x => !x.IsAlreadyPaid).Sum(x => x.GrossInterest),
                TotalLoanAdjustment = previewList.Where(x => !x.IsAlreadyPaid).Sum(x => x.LoanAdjustedAmount),
                TotalSavingDisbursed = previewList.Where(x => !x.IsAlreadyPaid && x.DisbursementMode == "SavingTransfer").Sum(x => x.NetDisbursedAmount),
                TotalSuspenseAmount = previewList.Where(x => !x.IsAlreadyPaid && x.DisbursementMode == "Suspense").Sum(x => x.NetDisbursedAmount),
                PayoutLedgers = payoutLedgers,
                Items = previewList
            });
        }

        // POST: api/FdMisPayout/ExecuteBatch
        [HttpPost("ExecuteBatch")]
        [Authorize]
        public async Task<IActionResult> ExecuteBatch([FromBody] FdMisBatchExecuteRequestDto req)
        {
            await EnsureTableExistsAsync();

            var (isHO, userBranchId) = GetUserBranchInfo();
            if (!isHO && userBranchId.HasValue && userBranchId.Value > 0)
            {
                req.BranchID = userBranchId.Value;
            }

            if (req.SelectedItems == null || !req.SelectedItems.Any())
            {
                return BadRequest("कृपया व्याज ट्रान्सफर करण्यासाठी किमान एक खाते निवडा (Select at least one account).");
            }

            if (req.PayoutDate.Date > DateTime.Today)
            {
                return BadRequest($"अवैध तारीख! भविष्यातील तारीख ({req.PayoutDate:dd/MM/yyyy}) अनुज्ञेय नाही.");
            }

            var closedFy = await _context.FinancialYears
                .FirstOrDefaultAsync(fy => fy.IsClosed && req.PayoutDate.Date >= fy.StartDate.Date && req.PayoutDate.Date <= fy.EndDate.Date);
            if (closedFy != null)
            {
                return BadRequest($"अवैध तारीख! निवडलेली तारीख ({req.PayoutDate:dd/MM/yyyy}) बंद आर्थिक वर्षात ({closedFy.YearCode}) मोडते.");
            }

            var accountIds = req.SelectedItems.Select(x => x.FdAccountID).Distinct().ToList();

            // Load all accounts with scheme and ledgers
            var accounts = await _context.FdAccounts
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.InterestExpenseLedger)
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.InterestPayableLedger)
                .Where(a => accountIds.Contains(a.FdAccountID))
                .ToDictionaryAsync(a => a.FdAccountID);

            // Double check existing payouts for idempotency
            var alreadyPaidIds = await _context.FdMisPayouts
                .Where(p => accountIds.Contains(p.FdAccountID) && p.PayoutYear == req.PayoutYear && p.PayoutMonth == req.PayoutMonth && p.Status == "Success")
                .Select(p => p.FdAccountID)
                .ToListAsync();

            var validItems = req.SelectedItems
                .Where(x => !alreadyPaidIds.Contains(x.FdAccountID) && x.GrossInterest > 0)
                .ToList();

            if (!validItems.Any())
            {
                return BadRequest("निवडलेल्या सर्व खात्यांचे या महिन्याचे व्याज आधीच जमा झाले आहे किंवा रक्कम ० आहे.");
            }

            // Upfront Bank & Saving GL validation
            foreach (var bItem in validItems.Where(x => x.NetDisbursedAmount > 0 && BankLedgerHelper.IsBankPaymentMode(x.DisbursementMode)))
            {
                int? candidateBankLedgerId = (bItem.CreditLedgerID.HasValue && bItem.CreditLedgerID.Value > 0)
                    ? bItem.CreditLedgerID
                    : ((bItem.BankLedgerID.HasValue && bItem.BankLedgerID.Value > 0) ? bItem.BankLedgerID : req.BankLedgerID);
                var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(_context, candidateBankLedgerId);
                if (!bankCheck.IsValid)
                {
                    return BadRequest(bankCheck.ErrorMessage);
                }
            }

            foreach (var sItem in validItems.Where(x => x.NetDisbursedAmount > 0 && string.Equals(x.DisbursementMode, "SavingTransfer", StringComparison.OrdinalIgnoreCase)))
            {
                if (!sItem.TargetSavingAccountID.HasValue || sItem.TargetSavingAccountID.Value <= 0)
                {
                    string fdAccNo = accounts.TryGetValue(sItem.FdAccountID, out var fdAccObj) ? fdAccObj.AccountNo : sItem.FdAccountID.ToString();
                    return BadRequest($"FD खाते क्र. {fdAccNo} साठी बचत लेजर निवडले आहे, परंतु ग्राहकाचे बचत खाते निवडलेले नाही. कृपया बचत खाते निवडा किंवा रोख / बँक / उचंत लेजर निवडा.");
                }
            }

            decimal totalBatchGross = validItems.Sum(x => x.GrossInterest);
            bool hasCashOrBankPayout = validItems.Any(x =>
                x.NetDisbursedAmount > 0 &&
                (BankLedgerHelper.IsBankPaymentMode(x.DisbursementMode) ||
                 string.Equals(x.DisbursementMode, "Cash", StringComparison.OrdinalIgnoreCase)));

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    // 1. Create Combined Master Voucher (Payment when Cash/Bank disbursement is present, else Journal)
                    string vPrefix = hasCashOrBankPayout ? "PV" : "JV";
                    int currentUserId = User.GetUserId();
                    var voucher = new Voucher
                    {
                        BranchID = req.BranchID,
                        VoucherNo = $"{vPrefix}-MIS-BR{req.BranchID}-{req.PayoutYear}{req.PayoutMonth:D2}-{DateTime.Now:HHmmss}",
                        VoucherDate = req.PayoutDate,
                        VoucherType = hasCashOrBankPayout ? "Payment" : "Journal",
                        TotalAmount = totalBatchGross,
                        Narration = $"मुदत ठेव मासिक व्याज ट्रान्सफर (FD MIS Interest Payout [{req.AccountingMode}]): {req.PayoutMonth:D2}/{req.PayoutYear}",
                        CreatedBy = currentUserId,
                        CreatedOn = DateTime.Now
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    int processedCount = 0;
                    var voucherDebitGroups = new Dictionary<int, decimal>();
                    var voucherCreditGroups = new Dictionary<int, decimal>();

                    foreach (var item in validItems)
                    {
                        if (!accounts.TryGetValue(item.FdAccountID, out var acc)) continue;

                        // A. Determine Debit Ledger (Expense vs Payable)
                        Ledger? debitLedger = null;
                        if (req.AccountingMode == "ClearPayable")
                        {
                            debitLedger = acc.FdScheme?.InterestPayableLedger;
                            if (debitLedger == null && acc.FdScheme?.InterestPayableLedgerID > 0)
                            {
                                debitLedger = await _context.Ledgers.FindAsync(acc.FdScheme.InterestPayableLedgerID.Value);
                            }
                        }

                        if (debitLedger == null)
                        {
                            debitLedger = acc.FdScheme?.InterestExpenseLedger;
                            if (debitLedger == null && acc.FdScheme?.InterestExpenseLedgerID > 0)
                            {
                                debitLedger = await _context.Ledgers.FindAsync(acc.FdScheme.InterestExpenseLedgerID.Value);
                            }
                        }

                        if (debitLedger == null)
                        {
                            // Global fallback search
                            debitLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.IsActive && 
                                (l.LedgerName.Contains("मुदत ठेवीवरील व्याज") || l.LedgerName.Contains("देणे मुदत ठेव व्याज")));
                        }

                        int debitLedgerId = debitLedger?.LedgerID ?? 0;
                        if (debitLedgerId == 0)
                        {
                            var genExp = await _context.Ledgers.FirstOrDefaultAsync(l => l.IsActive &&
                                (l.LedgerName.Contains("मुदत ठेव") || l.LedgerName.Contains("ठेव व्याज") || l.LedgerName.Contains("Interest on FD")));
                            if (genExp != null)
                            {
                                debitLedgerId = genExp.LedgerID;
                            }
                            else
                            {
                                await transaction.RollbackAsync();
                                return BadRequest($"योजना '{acc.FdScheme?.SchemeName}' साठी व्याज खर्च लेजर (Debit Expense Ledger) सेट केलेले नाही.");
                            }
                        }
                        voucherDebitGroups[debitLedgerId] = voucherDebitGroups.GetValueOrDefault(debitLedgerId) + item.GrossInterest;

                        // B. Handle Loan Recovery Set-off
                        if (item.LoanAdjustedAmount > 0 && item.TargetLoanAccountID.HasValue && item.TargetLoanAccountID.Value > 0)
                        {
                            var loanAcc = await _context.LoanAccounts
                                .Include(l => l.LoanRate)
                                .FirstOrDefaultAsync(l => l.LoanAccountID == item.TargetLoanAccountID.Value);

                            if (loanAcc != null)
                            {
                                decimal loanDeduct = item.LoanAdjustedAmount;
                                decimal intPaid = Math.Min(loanDeduct, loanAcc.InterestBalance + loanAcc.OverdueInterestBalance);
                                decimal prinPaid = Math.Max(0, loanDeduct - intPaid);

                                loanAcc.InterestBalance = Math.Max(0, loanAcc.InterestBalance - intPaid);
                                loanAcc.PrincipalBalance = Math.Max(0, loanAcc.PrincipalBalance - prinPaid);

                                var loanColl = new LoanCollection
                                {
                                    LoanAccountID = loanAcc.LoanAccountID,
                                    BranchID = acc.BranchID,
                                    CollectionDate = req.PayoutDate,
                                    PaymentMode = "Transfer",
                                    TotalAmountReceived = loanDeduct,
                                    PrincipalCollected = prinPaid,
                                    InterestCollected = intPaid,
                                    Remarks = $"FD MIS व्याज वळती: खाते {acc.AccountNo}",
                                    CreatedByUserID = currentUserId
                                };
                                _context.LoanCollections.Add(loanColl);

                                int loanCreditLedgerId = loanAcc.LoanRate?.LoanLedgerID ?? 0;
                                if (loanCreditLedgerId == 0 && loanAcc.LoanRate?.InterestLedgerID > 0)
                                {
                                    loanCreditLedgerId = loanAcc.LoanRate.InterestLedgerID.Value;
                                }
                                if (loanCreditLedgerId == 0)
                                {
                                    var genLoanLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.IsActive &&
                                        (l.LedgerName.Contains("कर्ज") || l.LedgerName.Contains("Loan")));
                                    if (genLoanLedger != null)
                                    {
                                        loanCreditLedgerId = genLoanLedger.LedgerID;
                                    }
                                    else
                                    {
                                        await transaction.RollbackAsync();
                                        return BadRequest($"तारण कर्ज क्र. {loanAcc.LoanAccountNo} साठी क्रेडिट लेजर सापडले नाही.");
                                    }
                                }
                                voucherCreditGroups[loanCreditLedgerId] = voucherCreditGroups.GetValueOrDefault(loanCreditLedgerId) + loanDeduct;
                            }
                        }

                        // C. Handle Net Disbursement (Bank, Cash, Saving Account Transfer, or Suspense)
                        if (item.NetDisbursedAmount > 0)
                        {
                            if (BankLedgerHelper.IsBankPaymentMode(item.DisbursementMode))
                            {
                                int? effBankLedgerId = (item.CreditLedgerID.HasValue && item.CreditLedgerID.Value > 0)
                                    ? item.CreditLedgerID
                                    : ((item.BankLedgerID.HasValue && item.BankLedgerID.Value > 0) ? item.BankLedgerID : req.BankLedgerID);
                                var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(_context, effBankLedgerId);
                                if (!bankCheck.IsValid)
                                {
                                    await transaction.RollbackAsync();
                                    return BadRequest(bankCheck.ErrorMessage);
                                }
                                item.DisbursementMode = "Bank";
                                voucherCreditGroups[bankCheck.LedgerId] = voucherCreditGroups.GetValueOrDefault(bankCheck.LedgerId) + item.NetDisbursedAmount;
                            }
                            else if (string.Equals(item.DisbursementMode, "Cash", StringComparison.OrdinalIgnoreCase))
                            {
                                item.DisbursementMode = "Cash";
                                int cashLedgerId = 0;
                                if (item.CreditLedgerID.HasValue && item.CreditLedgerID.Value > 0)
                                {
                                    var candidateCash = await _context.Ledgers
                                        .AsNoTracking()
                                        .Include(l => l.AccountGroup)
                                        .FirstOrDefaultAsync(l => l.LedgerID == item.CreditLedgerID.Value && l.IsActive);
                                    if (candidateCash != null && BankLedgerHelper.IsCashLedger(candidateCash) && !BankLedgerHelper.IsBankLedger(candidateCash))
                                    {
                                        cashLedgerId = candidateCash.LedgerID;
                                    }
                                }
                                if (cashLedgerId <= 0)
                                {
                                    cashLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, req.BranchID, "FD");
                                }
                                voucherCreditGroups[cashLedgerId] = voucherCreditGroups.GetValueOrDefault(cashLedgerId) + item.NetDisbursedAmount;
                            }
                            else if (item.DisbursementMode == "SavingTransfer" && item.TargetSavingAccountID.HasValue && item.TargetSavingAccountID.Value > 0)
                            {
                                var sbAcc = await _context.SavingAccountMasters
                                    .Include(s => s.Ledger)
                                    .Include(s => s.SavingScheme)
                                    .FirstOrDefaultAsync(s => s.SavingAccountID == item.TargetSavingAccountID.Value);

                                if (sbAcc != null && sbAcc.Status != "Closed" && sbAcc.Status != "बंद")
                                {
                                    sbAcc.CurrentBalance += item.NetDisbursedAmount;

                                    var savTx = new SavingTransaction
                                    {
                                        SavingAccountID = sbAcc.SavingAccountID,
                                        CustomerID = sbAcc.CustomerID,
                                        BranchID = acc.BranchID > 0 ? acc.BranchID : sbAcc.BranchID,
                                        TransactionDate = req.PayoutDate,
                                        TransactionType = "Deposit",
                                        PaymentMode = "Transfer",
                                        Amount = item.NetDisbursedAmount,
                                        BalanceAfterTxn = sbAcc.CurrentBalance,
                                        Narration = $"मुदत ठेव मासिक व्याज जमा (FD MIS): {acc.AccountNo} ({req.PayoutMonth:D2}/{req.PayoutYear})",
                                        VoucherNo = voucher.VoucherNo,
                                        CreatedBy = currentUserId,
                                        CreatedOn = DateTime.Now
                                    };
                                    _context.SavingTransactions.Add(savTx);

                                    int sbLedgerId = await Helpers.SavingLedgerHelper.ResolveSavingLiabilityLedgerIdAsync(
                                        _context,
                                        sbAcc,
                                        explicitLedgerId: item.CreditLedgerID);
                                    voucherCreditGroups[sbLedgerId] = voucherCreditGroups.GetValueOrDefault(sbLedgerId) + item.NetDisbursedAmount;
                                }
                                else
                                {
                                    // Fallback to Suspense if account closed
                                    item.DisbursementMode = "Suspense";
                                }
                            }

                            if (item.DisbursementMode == "Suspense")
                            {
                                int suspLedgerId = 0;
                                if (item.CreditLedgerID.HasValue && item.CreditLedgerID.Value > 0)
                                {
                                    var candidateSusp = await _context.Ledgers
                                        .AsNoTracking()
                                        .Include(l => l.AccountGroup)
                                        .FirstOrDefaultAsync(l => l.LedgerID == item.CreditLedgerID.Value && l.IsActive);
                                    if (candidateSusp != null && !BankLedgerHelper.IsBankLedger(candidateSusp) && !BankLedgerHelper.IsCashLedger(candidateSusp))
                                    {
                                        suspLedgerId = candidateSusp.LedgerID;
                                    }
                                }
                                if (suspLedgerId <= 0)
                                {
                                    var suspLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.IsActive && 
                                        (l.LedgerName.Contains("उचंत") || l.LedgerName.Contains("न मागितलेले") || l.LedgerName.Contains("Suspense")));
                                    suspLedgerId = suspLedger?.LedgerID ?? debitLedgerId;
                                }
                                voucherCreditGroups[suspLedgerId] = voucherCreditGroups.GetValueOrDefault(suspLedgerId) + item.NetDisbursedAmount;
                            }
                        }

                        // D. Create Payout Log in FdMisPayouts
                        var payoutLog = new FdMisPayout
                        {
                            InstitutionID = acc.InstitutionID > 0 ? acc.InstitutionID : 1,
                            BranchID = req.BranchID,
                            FinancialYearID = acc.FinancialYearID > 0 ? acc.FinancialYearID : 1,
                            FdAccountID = acc.FdAccountID,
                            PayoutYear = req.PayoutYear,
                            PayoutMonth = req.PayoutMonth,
                            PayoutDate = req.PayoutDate,
                            ElapsedDays = item.ElapsedDays > 0 ? item.ElapsedDays : DateTime.DaysInMonth(req.PayoutYear, req.PayoutMonth),
                            DepositPrincipal = acc.DepositAmount,
                            InterestRate = acc.InterestRate,
                            GrossInterest = item.GrossInterest,
                            TdsAmount = item.TdsAmount,
                            LoanAdjustedAmount = item.LoanAdjustedAmount,
                            NetDisbursedAmount = item.NetDisbursedAmount,
                            DisbursementMode = item.DisbursementMode,
                            TargetSavingAccountID = item.TargetSavingAccountID,
                            TargetLoanAccountID = item.TargetLoanAccountID,
                            VoucherID = voucher.VoucherID,
                            Status = "Success",
                            CreatedBy = currentUserId,
                            CreatedDate = DateTime.Now,
                            Remarks = item.Remarks ?? $"MIS Payout {req.PayoutMonth:D2}/{req.PayoutYear}"
                        };
                        _context.FdMisPayouts.Add(payoutLog);

                        // E. Add FdTransaction Log
                        var fdTx = new FdTransaction
                        {
                            BranchID = req.BranchID,
                            FdAccountID = acc.FdAccountID,
                            VoucherID = voucher.VoucherID,
                            TransactionDate = req.PayoutDate,
                            TransactionType = "MIS_Payout",
                            DebitCredit = "Dr",
                            Amount = item.GrossInterest
                        };
                        _context.FdTransactions.Add(fdTx);

                        acc.LastInterestPostingDate = req.PayoutDate;
                        processedCount++;
                    }

                    // 2. Insert Balanced Multi-Line Voucher Details
                    foreach (var kvp in voucherDebitGroups)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = kvp.Key,
                            DrCr = "Dr",
                            Amount = kvp.Value
                        });
                    }

                    foreach (var kvp in voucherCreditGroups)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = kvp.Key,
                            DrCr = "Cr",
                            Amount = kvp.Value
                        });
                    }

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok(new
                    {
                        Message = $"✅ एकूण {processedCount} ठेवीदारांचे ₹ {totalBatchGross:N0} मासिक व्याज यशस्वीरीत्या वर्ग झाले!",
                        VoucherNo = voucher.VoucherNo,
                        TotalAmount = totalBatchGross,
                        ProcessedCount = processedCount
                    });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("मासिक व्याज ट्रान्सफर करताना त्रुटी आली: " + ex.Message);
                }
            }
        }

        // GET: api/FdMisPayout/Register
        [HttpGet("Register")]
        [Authorize]
        public async Task<IActionResult> GetRegister(
            [FromQuery] int? branchId,
            [FromQuery] int? payoutYear,
            [FromQuery] int? payoutMonth)
        {
            await EnsureTableExistsAsync();

            var (isHO, userBranchId) = GetUserBranchInfo();
            int effectiveBranchId = (!isHO && userBranchId.HasValue && userBranchId.Value > 0)
                ? userBranchId.Value
                : (branchId ?? 1);

            var query = _context.FdMisPayouts
                .Include(p => p.FdAccount)
                    .ThenInclude(a => a!.Customer)
                .Include(p => p.TargetSavingAccount)
                .Include(p => p.TargetLoanAccount)
                .Include(p => p.Voucher)
                .Where(p => p.BranchID == effectiveBranchId);

            if (payoutYear.HasValue && payoutYear.Value > 0)
            {
                query = query.Where(p => p.PayoutYear == payoutYear.Value);
            }

            if (payoutMonth.HasValue && payoutMonth.Value > 0)
            {
                query = query.Where(p => p.PayoutMonth == payoutMonth.Value);
            }

            var list = await query
                .OrderByDescending(p => p.PayoutDate)
                .ThenByDescending(p => p.PayoutID)
                .Select(p => new
                {
                    p.PayoutID,
                    p.BranchID,
                    p.PayoutYear,
                    p.PayoutMonth,
                    p.PayoutDate,
                    p.ElapsedDays,
                    p.DepositPrincipal,
                    p.InterestRate,
                    p.GrossInterest,
                    p.TdsAmount,
                    p.LoanAdjustedAmount,
                    p.NetDisbursedAmount,
                    p.DisbursementMode,
                    p.Status,
                    p.Remarks,
                    VoucherNo = p.Voucher != null ? p.Voucher.VoucherNo : "",
                    AccountNo = p.FdAccount != null ? p.FdAccount.AccountNo : "",
                    CustomerName = p.FdAccount != null && p.FdAccount.Customer != null ? p.FdAccount.Customer.FullName : "",
                    TargetSavingAccountNo = p.TargetSavingAccount != null ? p.TargetSavingAccount.AccountNo : "",
                    TargetSavingOldAccountNo = p.TargetSavingAccount != null ? (p.TargetSavingAccount.OldAccountNo ?? p.TargetSavingAccount.LegacyAccountNumber ?? "") : "",
                    TargetLoanAccountNo = p.TargetLoanAccount != null ? p.TargetLoanAccount.LoanAccountNo : ""
                })
                .ToListAsync();

            return Ok(list);
        }
    }
}
