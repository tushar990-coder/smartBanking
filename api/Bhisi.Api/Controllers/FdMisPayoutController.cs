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
    public class FdMisPreviewRequestDto
    {
        public int BranchID { get; set; } = 1;
        public int PayoutYear { get; set; } = DateTime.Today.Year;
        public int PayoutMonth { get; set; } = DateTime.Today.Month;
        public DateTime PayoutDate { get; set; } = DateTime.Today;
        public string AccountingMode { get; set; } = "DirectExpense"; // DirectExpense or ClearPayable
    }

    public class FdMisPreviewItemDto
    {
        public int FdAccountID { get; set; }
        public string AccountNo { get; set; } = string.Empty;
        public int CustomerID { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string CifNo { get; set; } = string.Empty;
        public int? MemberID { get; set; }
        public string MemberNo { get; set; } = string.Empty;
        public string SchemeName { get; set; } = string.Empty;
        public DateTime OpeningDate { get; set; }
        public DateTime MaturityDate { get; set; }
        public decimal DepositPrincipal { get; set; }
        public decimal InterestRate { get; set; }
        public int ElapsedDays { get; set; }
        public DateTime PeriodFromDate { get; set; }
        public DateTime PeriodToDate { get; set; }
        public bool IsBrokenPeriod { get; set; }
        public decimal GrossInterest { get; set; }
        public decimal TdsAmount { get; set; }
        public decimal LoanAdjustedAmount { get; set; }
        public decimal NetDisbursedAmount { get; set; }
        public string DisbursementMode { get; set; } = "SavingTransfer"; // SavingTransfer, LoanRecovery, Suspense
        public int? TargetSavingAccountID { get; set; }
        public string? TargetSavingAccountNo { get; set; }
        public decimal? TargetSavingAccountBalance { get; set; }
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
        public decimal GrossInterest { get; set; }
        public decimal TdsAmount { get; set; }
        public decimal LoanAdjustedAmount { get; set; }
        public decimal NetDisbursedAmount { get; set; }
        public string DisbursementMode { get; set; } = "SavingTransfer";
        public int? TargetSavingAccountID { get; set; }
        public int? TargetLoanAccountID { get; set; }
        public string? Remarks { get; set; }
    }

    public class FdMisBatchExecuteRequestDto
    {
        public int BranchID { get; set; } = 1;
        public int PayoutYear { get; set; } = DateTime.Today.Year;
        public int PayoutMonth { get; set; } = DateTime.Today.Month;
        public DateTime PayoutDate { get; set; } = DateTime.Today;
        public string AccountingMode { get; set; } = "DirectExpense"; // DirectExpense or ClearPayable
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

            var monthStart = new DateTime(req.PayoutYear, req.PayoutMonth, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);

            // Fetch all active FD accounts in this branch where scheme is MIS or Monthly Payout
            var activeMisAccounts = await _context.FdAccounts
                .Include(a => a.Customer)
                .Include(a => a.SavingAccount)
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.InterestExpenseLedger)
                .Include(a => a.FdScheme)
                    .ThenInclude(s => s!.InterestPayableLedger)
                .Where(a => a.BranchID == req.BranchID && a.Status == "Active")
                .Where(a => a.FdScheme != null && (
                    a.FdScheme.InterestType == "MIS" || 
                    a.FdScheme.InterestType == "Monthly Interest" || 
                    a.FdScheme.InterestPayoutFrequency == "Monthly" ||
                    (a.FdScheme.InterestPayoutFrequency != null && a.FdScheme.InterestPayoutFrequency.ToLower().Contains("monthly"))
                ))
                .ToListAsync();

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

                // Broken Period check on opening
                if (acc.OpeningDate.Date >= monthStart)
                {
                    fromDate = acc.OpeningDate.Date;
                    isBrokenPeriod = true;
                }
                else
                {
                    fromDate = monthStart;
                }

                // Broken Period check on maturity
                DateTime toDate;
                if (acc.MaturityDate.Date <= monthEnd)
                {
                    toDate = acc.MaturityDate.Date;
                    isBrokenPeriod = true;
                }
                else
                {
                    toDate = monthEnd;
                }

                if (toDate < fromDate) continue;

                int elapsedDays = (toDate - fromDate).Days + 1;
                decimal grossInterest;

                if (isBrokenPeriod)
                {
                    // Broken period pro-rata daily formula
                    grossInterest = Math.Round((acc.DepositAmount * acc.InterestRate * elapsedDays) / 36500.0m, 0, MidpointRounding.AwayFromZero);
                }
                else
                {
                    // Standard banking monthly formula: (P * R) / 1200
                    grossInterest = Math.Round((acc.DepositAmount * acc.InterestRate) / 1200.0m, 0, MidpointRounding.AwayFromZero);
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

                // Saving Account Health Check
                var sb = acc.SavingAccount;
                if (sb == null && acc.SavingAccountID.HasValue && acc.SavingAccountID.Value > 0)
                {
                    sb = await _context.SavingAccountMasters.FindAsync(acc.SavingAccountID.Value);
                }
                bool isSbActive = sb != null && sb.Status == "Active";

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

                // Distribution Mode Resolution
                string disbMode = "SavingTransfer";
                string? warningNote = null;
                decimal loanAdjAmount = 0m;
                decimal netDisbursed = grossInterest;

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
                }
                else
                {
                    disbMode = "Suspense";
                    netDisbursed = grossInterest;
                    warningNote = "संलग्न बचत खाते बंद/निष्क्रिय आहे. व्याज 'न मागितलेले उचंत खात्यात' वर्ग होईल.";
                }

                previewList.Add(new FdMisPreviewItemDto
                {
                    FdAccountID = acc.FdAccountID,
                    AccountNo = acc.AccountNo,
                    CustomerID = acc.CustomerID,
                    CustomerName = acc.Customer?.FullName ?? "अज्ञात ग्राहक",
                    CifNo = acc.Customer?.CIFNo ?? "",
                    MemberID = memberId,
                    MemberNo = memberNo,
                    SchemeName = acc.FdScheme?.SchemeName ?? "मुदत ठेव योजना",
                    OpeningDate = acc.OpeningDate,
                    MaturityDate = acc.MaturityDate,
                    DepositPrincipal = acc.DepositAmount,
                    InterestRate = acc.InterestRate,
                    ElapsedDays = elapsedDays,
                    PeriodFromDate = fromDate,
                    PeriodToDate = toDate,
                    IsBrokenPeriod = isBrokenPeriod,
                    GrossInterest = grossInterest,
                    TdsAmount = 0m, // Standard threshold evaluation can be expanded
                    LoanAdjustedAmount = loanAdjAmount,
                    NetDisbursedAmount = netDisbursed,
                    DisbursementMode = disbMode,
                    TargetSavingAccountID = sb?.SavingAccountID,
                    TargetSavingAccountNo = sb?.AccountNo,
                    TargetSavingAccountBalance = sb?.CurrentBalance,
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

            decimal totalBatchGross = validItems.Sum(x => x.GrossInterest);

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    // 1. Create Combined Master Journal Voucher
                    var voucher = new Voucher
                    {
                        BranchID = req.BranchID,
                        VoucherNo = $"JV-MIS-BR{req.BranchID}-{req.PayoutYear}{req.PayoutMonth:D2}-{DateTime.Now:HHmmss}",
                        VoucherDate = req.PayoutDate,
                        VoucherType = "Journal",
                        TotalAmount = totalBatchGross,
                        Narration = $"मुदत ठेव मासिक व्याज ट्रान्सफर (FD MIS Interest Payout [{req.AccountingMode}]): {req.PayoutMonth:D2}/{req.PayoutYear}",
                        CreatedBy = 1,
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

                        int debitLedgerId = debitLedger?.LedgerID ?? 17;
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
                                    CreatedByUserID = 1
                                };
                                _context.LoanCollections.Add(loanColl);

                                int loanCreditLedgerId = loanAcc.LoanRate?.LoanLedgerID ?? (loanAcc.LoanRate?.InterestLedgerID ?? 1);
                                voucherCreditGroups[loanCreditLedgerId] = voucherCreditGroups.GetValueOrDefault(loanCreditLedgerId) + loanDeduct;
                            }
                        }

                        // C. Handle Saving Account Transfer
                        if (item.NetDisbursedAmount > 0)
                        {
                            if (item.DisbursementMode == "SavingTransfer" && item.TargetSavingAccountID.HasValue && item.TargetSavingAccountID.Value > 0)
                            {
                                var sbAcc = await _context.SavingAccountMasters
                                    .Include(s => s.Ledger)
                                    .FirstOrDefaultAsync(s => s.SavingAccountID == item.TargetSavingAccountID.Value);

                                if (sbAcc != null && sbAcc.Status == "Active")
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
                                        CreatedBy = 1,
                                        CreatedOn = DateTime.Now
                                    };
                                    _context.SavingTransactions.Add(savTx);

                                    int sbLedgerId = sbAcc.LedgerID > 0 ? sbAcc.LedgerID : (sbAcc.Ledger?.LedgerID ?? 7);
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
                                var suspLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.IsActive && 
                                    (l.LedgerName.Contains("उचंत") || l.LedgerName.Contains("न मागितलेले") || l.LedgerName.Contains("Suspense")));
                                int suspLedgerId = suspLedger?.LedgerID ?? debitLedgerId;
                                voucherCreditGroups[suspLedgerId] = voucherCreditGroups.GetValueOrDefault(suspLedgerId) + item.NetDisbursedAmount;
                            }
                        }

                        // D. Create Payout Log in FdMisPayouts
                        var payoutLog = new FdMisPayout
                        {
                            InstitutionID = 1,
                            BranchID = req.BranchID,
                            FinancialYearID = acc.FinancialYearID > 0 ? acc.FinancialYearID : 1,
                            FdAccountID = acc.FdAccountID,
                            PayoutYear = req.PayoutYear,
                            PayoutMonth = req.PayoutMonth,
                            PayoutDate = req.PayoutDate,
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
                            CreatedBy = 1,
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
                    TargetLoanAccountNo = p.TargetLoanAccount != null ? p.TargetLoanAccount.LoanAccountNo : ""
                })
                .ToListAsync();

            return Ok(list);
        }
    }
}
