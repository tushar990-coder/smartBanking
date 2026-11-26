using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bhisi.Api.Helpers
{
    /// <summary>
    /// Validates and applies Loan Recovery Expense & Postage Charges (e.g. वसूली खर्च, पोसटेज खर्च)
    /// added directly into LoanAccount.PrincipalBalance via Dr Loan GL / Cr Other Income GL
    /// upon Voucher Approval (Zero Auto-Post Maker-Checker), with idempotency and lossless Unpass/Rollback.
    /// </summary>
    public static class VoucherLoanChargeHelper
    {
        public static readonly HashSet<string> SupportedChargeTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "RECOVERY_EXPENSE",
            "POSTAGE_EXPENSE",
            "NOTICE_FEE",
            "COURT_FEE",
            "ADVOCATE_FEE",
            "NEWSPAPER_AD",
            "SRO_COMMISSION",
            "OTHER_LEGAL",
            "OTHER_RECOVERY"
        };

        public static string GetExpenseTypeMarathiLabel(string? expenseType)
        {
            return (expenseType ?? string.Empty).Trim().ToUpperInvariant() switch
            {
                "RECOVERY_EXPENSE" => "वसूली खर्च",
                "POSTAGE_EXPENSE" => "पोसटेज / टपाल खर्च",
                "NOTICE_FEE" => "नोटीस व टपाल फी",
                "COURT_FEE" => "कोर्ट फी",
                "ADVOCATE_FEE" => "वकिली फी",
                "NEWSPAPER_AD" => "जाहीरनामा खर्च",
                "SRO_COMMISSION" => "SRO कमिशन",
                "OTHER_LEGAL" => "इतर कायदेशीर खर्च",
                _ => "वसूली व इतर खर्च"
            };
        }

        public static async Task<HashSet<int>> GetConfiguredLoanPrincipalLedgerIdsAsync(AppDbContext context)
        {
            var rawIds = await context.LoanRates
                .AsNoTracking()
                .Where(r => r.IsActive && r.LoanLedgerID.HasValue && r.LoanLedgerID.Value > 0)
                .Select(r => r.LoanLedgerID!.Value)
                .Distinct()
                .ToListAsync();

            if (!rawIds.Any()) return new HashSet<int>();

            var validLedgers = await context.Ledgers
                .AsNoTracking()
                .Where(l => l.IsActive && rawIds.Contains(l.LedgerID))
                .ToListAsync();

            var result = new HashSet<int>();
            foreach (var l in validLedgers)
            {
                if (!BankLedgerHelper.IsCashLedger(l) &&
                    !BankLedgerHelper.IsBankLedger(l) &&
                    !BankLedgerHelper.IsBankAccountType(l.AccountType))
                {
                    result.Add(l.LedgerID);
                }
            }
            return result;
        }

        public static async Task<HashSet<int>> GetPersonalOrControlLedgerIdsAsync(AppDbContext context)
        {
            var blocked = new HashSet<int>();

            void AddIds(IEnumerable<int?> ids)
            {
                foreach (var id in ids)
                {
                    if (id.HasValue && id.Value > 0) blocked.Add(id.Value);
                }
            }

            AddIds(await context.LoanRates.AsNoTracking().Select(r => r.LoanLedgerID).ToListAsync());
            AddIds(await context.LoanRates.AsNoTracking().Select(r => r.ReceivableInterestLedgerID).ToListAsync());
            AddIds(await context.FdSchemes.AsNoTracking().Select(f => f.FdLiabilityLedgerID).ToListAsync());
            AddIds(await context.FdSchemes.AsNoTracking().Select(f => f.InterestPayableLedgerID).ToListAsync());
            AddIds(await context.RdSchemes.AsNoTracking().Select(r => r.RdLiabilityLedgerID).ToListAsync());
            AddIds(await context.RdSchemes.AsNoTracking().Select(r => r.InterestPayableLedgerID).ToListAsync());
            AddIds(await context.PigmySchemes.AsNoTracking().Select(p => p.PigmyLiabilityLedgerID).ToListAsync());
            AddIds(await context.PigmySchemes.AsNoTracking().Select(p => p.InterestPayableLedgerID).ToListAsync());
            AddIds(await context.SavingInterestSettings.AsNoTracking().Select(s => s.LedgerID).ToListAsync());
            AddIds(await context.SavingInterestSettings.AsNoTracking().Select(s => s.SavingLiabilityLedgerID).ToListAsync());
            AddIds(await context.SavingInterestSettings.AsNoTracking().Select(s => s.InterestPayableLedgerID).ToListAsync());
            AddIds(await context.ShareSchemes.AsNoTracking().Select(s => s.ShareCapitalLedgerID).ToListAsync());
            AddIds(await context.ShareSchemes.AsNoTracking().Select(s => s.DividendPayableLedgerID).ToListAsync());
            AddIds(await context.LockerTypes.AsNoTracking().Select(l => l.DepositLiabilityLedgerID).ToListAsync());
            AddIds(await context.InvestmentSchemes.AsNoTracking().Select(i => i.InvestmentAssetLedgerID).ToListAsync());
            AddIds(await context.InvestmentSchemes.AsNoTracking().Select(i => i.InterestReceivableLedgerID).ToListAsync());

            foreach (var id in await context.SavingAccountMasters.AsNoTracking().Select(s => s.LedgerID).Distinct().ToListAsync())
                if (id > 0) blocked.Add(id);

            foreach (var id in await context.SansthaBorrowings.AsNoTracking().Select(b => b.BorrowingLiabilityLedgerID).Distinct().ToListAsync())
                if (id > 0) blocked.Add(id);

            foreach (var id in await context.CustomerOpeningBalances.AsNoTracking().Select(o => o.LedgerID).Distinct().ToListAsync())
                if (id > 0) blocked.Add(id);

            foreach (var id in await context.MemberOpeningBalances.AsNoTracking().Select(o => o.LedgerID).Distinct().ToListAsync())
                if (id > 0) blocked.Add(id);

            return blocked;
        }

        public static bool IsStrictIncomeLedger(Ledger? ledger, HashSet<int> personalControlIds, out string errorMessage)
        {
            errorMessage = string.Empty;
            if (ledger == null || !ledger.IsActive)
            {
                errorMessage = "निवडलेले उत्पन्न खाते डेटाबेसमध्ये सक्रिय आढळले नाही.";
                return false;
            }

            if (BankLedgerHelper.IsCashLedger(ledger) ||
                BankLedgerHelper.IsBankLedger(ledger) ||
                BankLedgerHelper.IsBankAccountType(ledger.AccountType))
            {
                errorMessage = $"'{ledger.LedgerName}' हे रोख/बँक खाते आहे. कृपया फक्त उत्पन्नाचे (Income) खाते निवडा.";
                return false;
            }

            if (personalControlIds.Contains(ledger.LedgerID))
            {
                errorMessage = $"'{ledger.LedgerName}' ({ledger.LedgerID}) हे वैयक्तिक / ठेव / कर्ज / भाग नियंत्रण खाते आहे. कृपया उत्पन्नाचे खाते निवडा.";
                return false;
            }

            var reportType = (ledger.ReportType ?? string.Empty).Trim();
            if (reportType.Contains("ताळेबंद") || reportType.Contains("Balance Sheet", StringComparison.OrdinalIgnoreCase))
            {
                errorMessage = $"'{ledger.LedgerName}' ({ledger.LedgerID}) हे ताळेबंद खाते आहे. कृपया नफातोटा पत्रकातील उत्पन्नाचे खाते निवडा.";
                return false;
            }

            var groupNature = (ledger.AccountGroup?.NatureOfGroup ?? string.Empty).Trim();
            var accType = (ledger.AccountType ?? string.Empty).Trim();
            bool isIncomeGroup =
                string.Equals(groupNature, "Income", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(groupNature, "Revenue", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(groupNature, "उत्पन्न", StringComparison.OrdinalIgnoreCase) ||
                (string.IsNullOrEmpty(groupNature) && (
                    string.Equals(accType, "Income", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(accType, "Revenue", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(accType, "Direct Income", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(accType, "Indirect Income", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(accType, "उत्पन्न", StringComparison.OrdinalIgnoreCase)));

            if (!isIncomeGroup)
            {
                string groupLabel = ledger.AccountGroup?.GroupName ?? ledger.AccountType ?? "अज्ञात";
                errorMessage = $"'{ledger.LedgerName}' ({ledger.LedgerID}) हे '{groupLabel}' गटातील आहे. कृपया फक्त उत्पन्नाचे (Income) खाते निवडा.";
                return false;
            }

            return true;
        }

        public static async Task<List<Ledger>> GetDynamicIncomeLedgersAsync(AppDbContext context)
        {
            var blockedControlIds = await GetPersonalOrControlLedgerIdsAsync(context);
            var allLedgers = await context.Ledgers
                .AsNoTracking()
                .Include(l => l.AccountGroup)
                .Where(l => l.IsActive)
                .OrderBy(l => l.LedgerID)
                .ToListAsync();

            return allLedgers
                .Where(l => IsStrictIncomeLedger(l, blockedControlIds, out _))
                .ToList();
        }

        public static async Task<string?> ValidateAndNormalizeVoucherLoanChargeLinksAsync(
            AppDbContext context,
            Voucher voucher,
            int effectiveBranchId)
        {
            if (voucher.VoucherDetails == null || voucher.VoucherDetails.Count == 0)
            {
                return null;
            }

            var chargeRows = voucher.VoucherDetails
                .Where(d => d.ChargeLoanAccountID.HasValue && d.ChargeLoanAccountID.Value > 0)
                .ToList();

            if (!chargeRows.Any())
            {
                foreach (var d in voucher.VoucherDetails)
                {
                    d.ChargeLoanAccountID = null;
                    d.ChargeExpenseType = null;
                }
                return null;
            }

            var loanControlLedgerIds = await GetConfiguredLoanPrincipalLedgerIdsAsync(context);

            foreach (var d in chargeRows)
            {
                if (!string.Equals(d.DrCr, "Dr", StringComparison.OrdinalIgnoreCase))
                {
                    return "कर्जाच्या मुद्दलात वसूली किंवा पोसटेज खर्च जोडताना कर्ज खात्याची ओळ 'Dr' (नावे) असणे आवश्यक आहे. जमा (Cr) करण्यासाठी कृपया कर्ज वसुली (Loan Collection) वापरा.";
                }

                var loan = await context.LoanAccounts
                    .Include(l => l.LoanRate)
                    .Include(l => l.Member)
                    .FirstOrDefaultAsync(l => l.LoanAccountID == d.ChargeLoanAccountID!.Value);

                if (loan == null)
                {
                    return $"निवडलेले कर्ज खाते (ID: #{d.ChargeLoanAccountID!.Value}) सिस्टीममध्ये सापडले नाही.";
                }

                if (effectiveBranchId > 0 && loan.BranchID > 0 && loan.BranchID != effectiveBranchId)
                {
                    return $"आंतर-शाखा कर्ज खर्च बंदी! व्हाउचर शाखा #{effectiveBranchId} असून निवडलेले कर्ज खाते (#{loan.LoanAccountNo}) शाखा #{loan.BranchID} मधील आहे.";
                }

                if (string.Equals(loan.Status, "Closed", StringComparison.OrdinalIgnoreCase) && loan.PrincipalBalance <= 0m)
                {
                    return $"बंद झालेल्या कर्ज खात्यावर (#{loan.LoanAccountNo}) नवीन खर्च नावे टाकता येत नाही.";
                }

                int expectedLoanLedgerId = loan.LoanRate?.LoanLedgerID ?? 0;
                if (expectedLoanLedgerId <= 0)
                {
                    return $"कर्ज योजना '{loan.LoanRate?.LoanType ?? "अज्ञात"}' ला कर्ज मुद्दल लेजर (Loan Ledger) जोडलेले नाही.";
                }

                if (!loanControlLedgerIds.Contains(d.LedgerID) || d.LedgerID != expectedLoanLedgerId)
                {
                    return $"निवडलेले कर्ज खाते (#{loan.LoanAccountNo}) हे संबंधित कर्ज मुद्दल लेजरशी (LedgerID #{expectedLoanLedgerId}) जुळत नाही.";
                }

                int? custId = LegalRecoveryTrackerHelper.ResolveLoanCustomerId(loan);
                if (custId.HasValue && custId.Value > 0)
                {
                    d.CustomerID = custId.Value;
                }
                if (loan.MemberID.HasValue && loan.MemberID.Value > 0)
                {
                    d.MemberID = loan.MemberID.Value;
                }

                d.ChargeExpenseType = string.IsNullOrWhiteSpace(d.ChargeExpenseType)
                    ? "RECOVERY_EXPENSE"
                    : d.ChargeExpenseType.Trim().ToUpperInvariant();
            }

            return null;
        }

        public static async Task SyncManualVoucherLoanChargeExpensesAsync(
            AppDbContext context,
            Voucher voucher,
            int userId)
        {
            // Remove existing unapplied manual charge expense records linked to this voucher before rebuilding
            var existingPending = await context.Sec101LegalExpenses
                .Where(e => e.VoucherId == voucher.VoucherID && e.CapitalizeToLoanPrincipal && !e.IsPrincipalApplied)
                .ToListAsync();
            if (existingPending.Any())
            {
                context.Sec101LegalExpenses.RemoveRange(existingPending);
            }

            var chargeRows = voucher.VoucherDetails?
                .Where(d => d.ChargeLoanAccountID.HasValue && d.ChargeLoanAccountID.Value > 0 && d.Amount > 0 && string.Equals(d.DrCr, "Dr", StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (chargeRows == null || !chargeRows.Any())
            {
                await context.SaveChangesAsync();
                return;
            }

            int? crLedgerId = voucher.VoucherDetails?
                .Where(d => string.Equals(d.DrCr, "Cr", StringComparison.OrdinalIgnoreCase) && d.LedgerID > 0)
                .Select(d => (int?)d.LedgerID)
                .FirstOrDefault();

            var loanIds = chargeRows.Select(c => c.ChargeLoanAccountID!.Value).Distinct().ToList();
            var loansById = await context.LoanAccounts
                .AsNoTracking()
                .Where(l => loanIds.Contains(l.LoanAccountID))
                .ToDictionaryAsync(l => l.LoanAccountID);

            var activeCasesByLoan = await context.Sec101CaseMasters
                .AsNoTracking()
                .Where(c => loanIds.Contains(c.LoanAccountId) && c.Status != "DISMISSED" && c.Status != "WITHDRAWN" && c.Status != "CLOSED_RECOVERED")
                .GroupBy(c => c.LoanAccountId)
                .Select(g => new { LoanAccountId = g.Key, CaseId = g.OrderByDescending(x => x.FilingDate).Select(x => (int?)x.CaseId).FirstOrDefault() })
                .ToDictionaryAsync(x => x.LoanAccountId, x => x.CaseId);

            foreach (var d in chargeRows)
            {
                loansById.TryGetValue(d.ChargeLoanAccountID!.Value, out var loan);
                activeCasesByLoan.TryGetValue(d.ChargeLoanAccountID!.Value, out var activeCaseId);
                string expType = string.IsNullOrWhiteSpace(d.ChargeExpenseType) ? "RECOVERY_EXPENSE" : d.ChargeExpenseType.Trim().ToUpperInvariant();
                string label = GetExpenseTypeMarathiLabel(expType);

                context.Sec101LegalExpenses.Add(new Sec101LegalExpense
                {
                    BranchId = loan?.BranchID > 0 ? loan.BranchID : voucher.BranchID,
                    CaseId = activeCaseId,
                    LoanAccountId = d.ChargeLoanAccountID!.Value,
                    CustomerId = d.CustomerID ?? loan?.CustomerID,
                    ExpenseType = expType,
                    Amount = d.Amount,
                    ExpenseDate = voucher.VoucherDate.Date,
                    PaidTo = label,
                    VoucherId = voucher.VoucherID,
                    IsDebitedToLoan = true,
                    CapitalizeToLoanPrincipal = true,
                    IsPrincipalApplied = false,
                    DebitLedgerId = d.LedgerID,
                    CreditLedgerId = crLedgerId,
                    Remarks = !string.IsNullOrWhiteSpace(voucher.Narration)
                        ? voucher.Narration!.Trim()
                        : $"{label} (व्हाउचर क्र.: {voucher.VoucherNo})",
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = userId > 0 ? userId : 1
                });
            }

            await context.SaveChangesAsync();
        }

        public static async Task ApplyApprovedVoucherLoanChargesAsync(
            AppDbContext context,
            Voucher voucher)
        {
            if (voucher == null || !string.Equals(voucher.Status, "Approved", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            var expenses = await context.Sec101LegalExpenses
                .Where(e => e.VoucherId == voucher.VoucherID && e.IsDebitedToLoan && e.LoanAccountId > 0)
                .ToListAsync();

            if (!expenses.Any())
            {
                return;
            }

            // 1. Apply Principal-capitalized charges (Dr Loan GL / Cr Other Income GL)
            var principalExpenses = expenses.Where(e => e.CapitalizeToLoanPrincipal && !e.IsPrincipalApplied).ToList();
            var affectedLoanIds = new HashSet<int>();

            foreach (var exp in principalExpenses)
            {
                var loan = await context.LoanAccounts.FirstOrDefaultAsync(l => l.LoanAccountID == exp.LoanAccountId);
                if (loan == null)
                {
                    throw new InvalidOperationException($"व्हाउचर क्र. {voucher.VoucherNo} मधील कर्ज खाते (#{exp.LoanAccountId}) सापडले नाही.");
                }

                if (voucher.BranchID > 0 && loan.BranchID > 0 && loan.BranchID != voucher.BranchID)
                {
                    throw new InvalidOperationException($"आंतर-शाखा कर्ज खर्च मंजुरी अनुमत नाही: व्हाउचर शाखा #{voucher.BranchID}, कर्ज शाखा #{loan.BranchID}.");
                }

                // Preserve existing PurePrincipalBalance before adding charges into PrincipalBalance
                if (loan.PurePrincipalBalance <= 0m && loan.PrincipalBalance > 0m)
                {
                    loan.PurePrincipalBalance = Math.Max(0m, loan.PrincipalBalance - loan.CapitalizedInterestAmount - loan.CapitalizedRecoveryCharges);
                }

                loan.PrincipalBalance = Math.Round(loan.PrincipalBalance + exp.Amount, 2, MidpointRounding.AwayFromZero);
                loan.CapitalizedRecoveryCharges = Math.Round(loan.CapitalizedRecoveryCharges + exp.Amount, 2, MidpointRounding.AwayFromZero);

                if (string.Equals(loan.Status, "Closed", StringComparison.OrdinalIgnoreCase) && loan.PrincipalBalance > 0m)
                {
                    loan.Status = "Active";
                }

                exp.IsPrincipalApplied = true;
                context.Entry(loan).State = EntityState.Modified;
                context.Entry(exp).State = EntityState.Modified;
                affectedLoanIds.Add(loan.LoanAccountID);
            }

            // 2. Apply non-principal separate OverdueRecoveryLedgers charges (legacy Sec 101 cash/bank expenses)
            var ledgerExpenses = expenses.Where(e => !e.CapitalizeToLoanPrincipal).ToList();
            if (ledgerExpenses.Any())
            {
                bool alreadyHasDebits = await context.OverdueRecoveryLedgers
                    .AnyAsync(o => o.VoucherID == voucher.VoucherID && o.DebitAmount > 0);
                if (!alreadyHasDebits)
                {
                    foreach (var exp in ledgerExpenses)
                    {
                        string part = string.IsNullOrWhiteSpace(exp.Remarks)
                            ? $"{GetExpenseTypeMarathiLabel(exp.ExpenseType)}"
                            : exp.Remarks!;
                        context.OverdueRecoveryLedgers.Add(new OverdueRecoveryLedger
                        {
                            LoanAccountID = exp.LoanAccountId,
                            TransactionDate = exp.ExpenseDate,
                            DebitAmount = exp.Amount,
                            CreditAmount = 0m,
                            VoucherID = voucher.VoucherID,
                            Particulars = part.Length > 250 ? part.Substring(0, 250) : part
                        });
                    }
                }
            }

            if (affectedLoanIds.Any())
            {
                await context.SaveChangesAsync();
                foreach (int lid in affectedLoanIds)
                {
                    var loanAcc = await context.LoanAccounts.FirstOrDefaultAsync(l => l.LoanAccountID == lid);
                    if (loanAcc == null) continue;
                    var schedules = await context.LoanInstallmentSchedules
                        .Where(s => s.LoanAccountID == lid)
                        .OrderBy(s => s.InstallmentNo)
                        .ToListAsync();
                    if (schedules.Any())
                    {
                        var collections = await context.LoanCollections
                            .Where(c => c.LoanAccountID == lid)
                            .ToListAsync();
                        Services.LoanScheduleGenerator.SynchronizeSchedules(loanAcc, schedules, collections);
                        foreach (var s in schedules) context.Entry(s).State = EntityState.Modified;
                    }
                }
            }
        }

        public sealed class BulkLoanChargeItemInput
        {
            public int LoanAccountId { get; set; }
            public decimal Amount { get; set; }
        }

        public sealed class BulkLoanChargeResult
        {
            public Voucher Voucher { get; set; } = null!;
            public int ProcessedCount { get; set; }
            public decimal TotalAmount { get; set; }
            public string IncomeLedgerName { get; set; } = string.Empty;
        }

        public static (bool IsOverdue, DateTime? OverdueDate, decimal OverdueAmount) ComputeOverdueCandidateSnapshot(
            LoanAccount? la,
            IEnumerable<LoanInstallmentSchedule>? accountSchedules,
            DateTime asOnDate,
            decimal unpaidRecoveryLedgerDue = 0m)
        {
            DateTime target = asOnDate.Date;
            if (la == null ||
                !string.Equals(la.Status, "Active", StringComparison.OrdinalIgnoreCase) ||
                la.OpeningDate.Date > target ||
                la.PrincipalBalance <= 0m)
            {
                return (false, null, 0m);
            }

            var overdueSchedules = (accountSchedules ?? Enumerable.Empty<LoanInstallmentSchedule>())
                .Where(s => s.DueDate.Date <= target && !string.Equals(s.Status, "Paid", StringComparison.OrdinalIgnoreCase))
                .ToList();

            decimal overduePrincipal = overdueSchedules.Sum(s => s.PrincipalAmount);
            if (la.MaturityDate.HasValue && la.MaturityDate.Value.Date <= target && la.PrincipalBalance > overduePrincipal)
            {
                overduePrincipal = la.PrincipalBalance;
            }

            if (overduePrincipal > la.PrincipalBalance)
            {
                overduePrincipal = la.PrincipalBalance;
            }

            bool isOverdue =
                overduePrincipal > 0m ||
                la.OverdueInterestBalance > 0m ||
                unpaidRecoveryLedgerDue > 0m ||
                (la.MaturityDate.HasValue && la.MaturityDate.Value.Date <= target && la.PrincipalBalance > 0m);

            if (!isOverdue)
            {
                return (false, null, 0m);
            }

            DateTime? overdueDate = overdueSchedules.Any()
                ? overdueSchedules.Min(s => s.DueDate.Date)
                : (la.MaturityDate.HasValue && la.MaturityDate.Value.Date <= target
                    ? la.MaturityDate.Value.Date
                    : (la.MaturityDate?.Date ?? la.OpeningDate.Date));

            decimal effectiveOverdueAmt = overduePrincipal > 0m ? overduePrincipal : la.PrincipalBalance;
            return (true, overdueDate, Math.Round(effectiveOverdueAmt, 2, MidpointRounding.AwayFromZero));
        }

        public static async Task<BulkLoanChargeResult> ExecuteBulkLoanChargesAtomicAsync(
            AppDbContext context,
            int effectiveBranchId,
            DateTime expenseDate,
            int creditLedgerId,
            IReadOnlyList<BulkLoanChargeItemInput> items,
            int createdByUserId,
            string? expenseType = null,
            string? remarks = null)
        {
            int branchId = effectiveBranchId > 0 ? effectiveBranchId : 1;
            int actorUserId = createdByUserId > 0 ? createdByUserId : 1;
            DateTime effDate = expenseDate == default ? DateTime.Today : expenseDate.Date;

            if (items == null || items.Count == 0)
            {
                throw new InvalidOperationException("कृपया खर्च नावे टाकण्यासाठी किमान एक थकबाकीदार कर्ज खाते निवडा.");
            }

            var normalizedItems = new List<(int LoanAccountId, decimal Amount)>();
            var seenLoanIds = new HashSet<int>();
            foreach (var raw in items)
            {
                if (raw == null || raw.LoanAccountId <= 0)
                {
                    throw new InvalidOperationException("निवडलेल्या यादीत अवैध कर्ज खाते आढळले.");
                }
                if (!seenLoanIds.Add(raw.LoanAccountId))
                {
                    throw new InvalidOperationException($"निवडलेल्या यादीत कर्ज खाते ID #{raw.LoanAccountId} ची दुहेरी नोंद आढळली आहे.");
                }
                decimal amt = Math.Round(raw.Amount, 2, MidpointRounding.AwayFromZero);
                if (amt <= 0m)
                {
                    throw new InvalidOperationException("प्रत्येक निवडलेल्या खात्यासाठी खर्च रक्कम शून्यापेक्षा जास्त असणे आवश्यक आहे.");
                }
                normalizedItems.Add((raw.LoanAccountId, amt));
            }

            if (creditLedgerId <= 0)
            {
                throw new InvalidOperationException("कृपया जमेसाठी उत्पन्नाचे (Income) खाते निवडा.");
            }

            var blockedControlIds = await GetPersonalOrControlLedgerIdsAsync(context);
            var creditLedger = await context.Ledgers
                .AsNoTracking()
                .Include(l => l.AccountGroup)
                .FirstOrDefaultAsync(l => l.LedgerID == creditLedgerId);

            if (!IsStrictIncomeLedger(creditLedger, blockedControlIds, out var crErr))
            {
                throw new InvalidOperationException(crErr);
            }

            var loanControlLedgerIds = await GetConfiguredLoanPrincipalLedgerIdsAsync(context);
            var requestedLoanIds = normalizedItems.Select(x => x.LoanAccountId).ToList();

            var loans = await context.LoanAccounts
                .AsNoTracking()
                .AsSplitQuery()
                .Include(l => l.Customer)
                .Include(l => l.Member).ThenInclude(m => m!.Customer)
                .Include(l => l.LoanRate)
                .Where(l => requestedLoanIds.Contains(l.LoanAccountID))
                .ToDictionaryAsync(l => l.LoanAccountID);

            var schedulesByLoan = (await context.LoanInstallmentSchedules
                .AsNoTracking()
                .Where(s => requestedLoanIds.Contains(s.LoanAccountID))
                .ToListAsync())
                .GroupBy(s => s.LoanAccountID)
                .ToDictionary(g => g.Key, g => g.ToList());

            var recoveryDueByLoan = await context.OverdueRecoveryLedgers
                .AsNoTracking()
                .Where(o => requestedLoanIds.Contains(o.LoanAccountID) && o.TransactionDate <= effDate)
                .GroupBy(o => o.LoanAccountID)
                .Select(g => new { LoanAccountID = g.Key, NetDue = g.Sum(x => x.DebitAmount - x.CreditAmount) })
                .ToDictionaryAsync(x => x.LoanAccountID, x => Math.Max(0m, x.NetDue));

            var validatedEntries = new List<(LoanAccount Loan, int DebitLedgerId, int? CustomerId, int? MemberId, decimal Amount)>();
            foreach (var (loanId, amt) in normalizedItems)
            {
                if (!loans.TryGetValue(loanId, out var loan))
                {
                    throw new InvalidOperationException($"निवडलेले कर्ज खाते (ID: #{loanId}) डेटाबेसमध्ये सापडले नाही.");
                }

                if (loan.BranchID > 0 && loan.BranchID != branchId)
                {
                    throw new InvalidOperationException($"आंतर-शाखा कर्ज खर्च बंदी! कर्ज खाते क्र. '{loan.LegacyAccountNumber ?? loan.LoanAccountNo}' हे शाखा #{loan.BranchID} मधील आहे.");
                }

                if (string.Equals(loan.Status, "Closed", StringComparison.OrdinalIgnoreCase) || loan.PrincipalBalance <= 0m)
                {
                    throw new InvalidOperationException($"कर्ज खाते क्र. '{loan.LegacyAccountNumber ?? loan.LoanAccountNo}' बंद आहे किंवा मुद्दल बाकी शून्य आहे.");
                }

                schedulesByLoan.TryGetValue(loanId, out var accSchedules);
                recoveryDueByLoan.TryGetValue(loanId, out var unpaidRec);
                var overdueSnap = ComputeOverdueCandidateSnapshot(loan, accSchedules, effDate, unpaidRec);
                if (!overdueSnap.IsOverdue)
                {
                    throw new InvalidOperationException($"कर्ज खाते क्र. '{loan.LegacyAccountNumber ?? loan.LoanAccountNo}' हे दिनांक {effDate:dd/MM/yyyy} रोजी थकबाकीदार नाही. या फॉर्ममधून फक्त थकबाकीदार कर्ज खात्यांवरच खर्च नावे टाकता येतो.");
                }

                int debitLedgerId = loan.LoanRate?.LoanLedgerID ?? 0;
                if (debitLedgerId <= 0 || !loanControlLedgerIds.Contains(debitLedgerId))
                {
                    throw new InvalidOperationException($"कर्ज योजना '{loan.LoanRate?.LoanType ?? "अज्ञात"}' ला वैध कर्ज मुद्दल लेजर (Loan Ledger) जोडलेले नाही.");
                }

                // CustomerID-First resolution: never fall back to MemberID ?? 1 or mix CustomerID into MemberID
                int? resolvedCustomerId = LegalRecoveryTrackerHelper.ResolveLoanCustomerId(loan);
                int? nullableMemberId = loan.MemberID.HasValue && loan.MemberID.Value > 0 ? loan.MemberID.Value : null;

                validatedEntries.Add((loan, debitLedgerId, resolvedCustomerId, nullableMemberId, amt));
            }

            var activeCasesByLoan = await context.Sec101CaseMasters
                .AsNoTracking()
                .Where(c => requestedLoanIds.Contains(c.LoanAccountId) && c.Status != "DISMISSED" && c.Status != "WITHDRAWN" && c.Status != "CLOSED_RECOVERED")
                .GroupBy(c => c.LoanAccountId)
                .Select(g => new { LoanAccountId = g.Key, CaseId = g.OrderByDescending(x => x.FilingDate).Select(x => (int?)x.CaseId).FirstOrDefault() })
                .ToDictionaryAsync(x => x.LoanAccountId, x => x.CaseId);

            string normExpenseType = string.IsNullOrWhiteSpace(expenseType)
                ? "RECOVERY_EXPENSE"
                : expenseType.Trim().ToUpperInvariant();
            if (!SupportedChargeTypes.Contains(normExpenseType))
            {
                normExpenseType = "RECOVERY_EXPENSE";
            }

            decimal totalAmount = Math.Round(validatedEntries.Sum(e => e.Amount), 2, MidpointRounding.AwayFromZero);
            string cleanRemark = (remarks ?? string.Empty).Trim();
            string voucherNarration = $"बल्क वसुली खर्च नावे ({creditLedger!.LedgerName}) - एकूण {validatedEntries.Count} थकबाकीदार खाती" +
                                      (!string.IsNullOrEmpty(cleanRemark) ? $" | {cleanRemark}" : string.Empty);

            var ownTx = context.Database.CurrentTransaction == null
                ? await context.Database.BeginTransactionAsync()
                : null;

            try
            {
                string prefix = $"JV-BCHG-{branchId}-{effDate:yyyyMMdd}-";
                string voucherNo = await VoucherNumberHelper.NextVoucherNoAsync(context, prefix, 4);

                var voucherDetails = new List<VoucherDetail>(validatedEntries.Count + 1);
                foreach (var entry in validatedEntries)
                {
                    voucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = entry.DebitLedgerId,
                        CustomerID = entry.CustomerId,
                        MemberID = entry.MemberId,
                        ChargeLoanAccountID = entry.Loan.LoanAccountID,
                        ChargeExpenseType = normExpenseType,
                        DrCr = "Dr",
                        Amount = entry.Amount
                    });
                }

                voucherDetails.Add(new VoucherDetail
                {
                    LedgerID = creditLedger.LedgerID,
                    CustomerID = null,
                    MemberID = null,
                    DrCr = "Cr",
                    Amount = totalAmount
                });

                var voucher = new Voucher
                {
                    BranchID = branchId,
                    VoucherNo = voucherNo,
                    VoucherDate = effDate,
                    VoucherType = "Journal",
                    Status = "Pending",
                    Narration = voucherNarration,
                    TotalAmount = totalAmount,
                    CreatedBy = actorUserId,
                    CreatedOn = DateTime.UtcNow,
                    VoucherDetails = voucherDetails
                };

                VoucherBalanceHelper.EnsureBalanced(voucher);
                context.Vouchers.Add(voucher);
                await context.SaveChangesAsync();

                string perAccountRemark = !string.IsNullOrEmpty(cleanRemark)
                    ? $"{creditLedger.LedgerName} - {cleanRemark}"
                    : creditLedger.LedgerName;

                foreach (var entry in validatedEntries)
                {
                    activeCasesByLoan.TryGetValue(entry.Loan.LoanAccountID, out var activeCaseId);
                    context.Sec101LegalExpenses.Add(new Sec101LegalExpense
                    {
                        BranchId = branchId,
                        CaseId = activeCaseId,
                        LoanAccountId = entry.Loan.LoanAccountID,
                        CustomerId = entry.CustomerId,
                        ExpenseType = normExpenseType,
                        Amount = entry.Amount,
                        ExpenseDate = effDate,
                        PaidTo = creditLedger.LedgerName,
                        VoucherId = voucher.VoucherID,
                        IsDebitedToLoan = true,
                        CapitalizeToLoanPrincipal = true,
                        IsPrincipalApplied = false,
                        DebitLedgerId = entry.DebitLedgerId,
                        CreditLedgerId = creditLedger.LedgerID,
                        Remarks = perAccountRemark,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = actorUserId
                    });
                }

                await context.SaveChangesAsync();
                if (ownTx != null)
                {
                    await ownTx.CommitAsync();
                }

                return new BulkLoanChargeResult
                {
                    Voucher = voucher,
                    ProcessedCount = validatedEntries.Count,
                    TotalAmount = totalAmount,
                    IncomeLedgerName = creditLedger.LedgerName
                };
            }
            catch
            {
                if (ownTx != null)
                {
                    await ownTx.RollbackAsync();
                }
                throw;
            }
        }

        public static async Task ReverseApprovedVoucherLoanChargesOnUnpassAsync(
            AppDbContext context,
            Voucher voucher)
        {
            if (voucher == null)
            {
                return;
            }

            var expenses = await context.Sec101LegalExpenses
                .Where(e => e.VoucherId == voucher.VoucherID && e.IsDebitedToLoan && e.LoanAccountId > 0)
                .ToListAsync();

            if (!expenses.Any())
            {
                return;
            }

            var principalExpenses = expenses.Where(e => e.CapitalizeToLoanPrincipal && e.IsPrincipalApplied).ToList();
            if (principalExpenses.Any())
            {
                var plannedByLoan = new Dictionary<int, (LoanAccount Loan, decimal TotalToReverse)>();
                foreach (var exp in principalExpenses)
                {
                    if (!plannedByLoan.TryGetValue(exp.LoanAccountId, out var entry))
                    {
                        var loan = await context.LoanAccounts.FindAsync(exp.LoanAccountId);
                        if (loan == null)
                        {
                            throw new InvalidOperationException($"कर्ज खाते (#{exp.LoanAccountId}) न सापडल्याने खर्च रिव्हर्स करता येत नाही.");
                        }
                        entry = (loan, 0m);
                    }
                    entry.TotalToReverse += exp.Amount;
                    plannedByLoan[exp.LoanAccountId] = entry;
                }

                foreach (var kv in plannedByLoan)
                {
                    var loan = kv.Value.Loan;
                    decimal toReverse = kv.Value.TotalToReverse;
                    if (loan.CapitalizedRecoveryCharges < toReverse - 0.01m || loan.PrincipalBalance < toReverse - 0.01m)
                    {
                        throw new InvalidOperationException(
                            $"व्हाउचर क्र. {voucher.VoucherNo} मधील कर्जाच्या मुद्दलात जोडलेला वसूली/पोसटेज खर्च (₹{toReverse:N2}) आधीच कर्ज वसुलीतून भरला गेलेला असल्याने हे व्हाउचर अन-पास करता येत नाही.");
                    }
                }

                foreach (var kv in plannedByLoan)
                {
                    var loan = kv.Value.Loan;
                    decimal toReverse = kv.Value.TotalToReverse;
                    loan.PrincipalBalance = Math.Max(0m, Math.Round(loan.PrincipalBalance - toReverse, 2, MidpointRounding.AwayFromZero));
                    loan.CapitalizedRecoveryCharges = Math.Max(0m, Math.Round(loan.CapitalizedRecoveryCharges - toReverse, 2, MidpointRounding.AwayFromZero));
                    context.Entry(loan).State = EntityState.Modified;
                }

                foreach (var exp in principalExpenses)
                {
                    exp.IsPrincipalApplied = false;
                    context.Entry(exp).State = EntityState.Modified;
                }

                await context.SaveChangesAsync();

                foreach (int lid in plannedByLoan.Keys)
                {
                    var loanAcc = await context.LoanAccounts.FirstOrDefaultAsync(l => l.LoanAccountID == lid);
                    if (loanAcc == null) continue;
                    var schedules = await context.LoanInstallmentSchedules
                        .Where(s => s.LoanAccountID == lid)
                        .OrderBy(s => s.InstallmentNo)
                        .ToListAsync();
                    if (schedules.Any())
                    {
                        var collections = await context.LoanCollections
                            .Where(c => c.LoanAccountID == lid)
                            .ToListAsync();
                        Services.LoanScheduleGenerator.SynchronizeSchedules(loanAcc, schedules, collections);
                        foreach (var s in schedules) context.Entry(s).State = EntityState.Modified;
                    }
                }
            }

            // Legacy non-principal OverdueRecoveryLedgers check & removal
            var nonPrincipalIds = expenses.Where(e => !e.CapitalizeToLoanPrincipal).Select(e => e.LoanAccountId).Distinct().ToList();
            if (nonPrincipalIds.Any())
            {
                var ledgerRows = await context.OverdueRecoveryLedgers
                    .Where(o => o.VoucherID == voucher.VoucherID && o.DebitAmount > 0)
                    .ToListAsync();
                if (ledgerRows.Any())
                {
                    foreach (int lid in ledgerRows.Select(r => r.LoanAccountID).Distinct())
                    {
                        decimal totalDebits = await context.OverdueRecoveryLedgers
                            .Where(o => o.LoanAccountID == lid)
                            .SumAsync(o => (decimal?)o.DebitAmount) ?? 0m;
                        decimal totalCredits = await context.OverdueRecoveryLedgers
                            .Where(o => o.LoanAccountID == lid)
                            .SumAsync(o => (decimal?)o.CreditAmount) ?? 0m;
                        decimal thisVoucherDebit = ledgerRows.Where(r => r.LoanAccountID == lid).Sum(r => r.DebitAmount);
                        if (totalCredits > (totalDebits - thisVoucherDebit + 0.01m))
                        {
                            throw new InvalidOperationException(
                                $"व्हाउचर क्र. {voucher.VoucherNo} मधील कायदेशीर खर्च कर्ज खात्यावरून आधीच वसूल झालेला असल्याने हे व्हाउचर अन-पास करता येत नाही.");
                        }
                    }
                    context.OverdueRecoveryLedgers.RemoveRange(ledgerRows);
                }
            }
        }
    }
}
