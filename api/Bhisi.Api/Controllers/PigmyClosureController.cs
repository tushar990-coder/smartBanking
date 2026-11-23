using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;
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
    public class PigmyClosureController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PigmyClosureController(AppDbContext context)
        {
            _context = context;
        }

        private async Task<PigmyAccount?> FindPigmyAccountForBranchAsync(string accountNo, int? branchId, bool includeDetails)
        {
            string key = (accountNo ?? string.Empty).Trim();
            if (string.IsNullOrEmpty(key)) return null;
            int? scopedBranch = User.ResolveOptionalBranchId(branchId > 0 ? branchId : null);

            IQueryable<PigmyAccount> query = _context.PigmyAccounts;
            if (includeDetails)
            {
                query = query
                    .Include(a => a.Customer)
                    .Include(a => a.PigmyAgent)
                    .Include(a => a.PigmyScheme)
                        .ThenInclude(s => s!.Slabs)
                    .Include(a => a.PigmyScheme)
                        .ThenInclude(s => s!.PigmyLiabilityLedger)
                    .Include(a => a.PigmyScheme)
                        .ThenInclude(s => s!.InterestExpenseLedger)
                    .Include(a => a.PigmyScheme)
                        .ThenInclude(s => s!.InterestPayableLedger)
                    .Include(a => a.PigmyScheme)
                        .ThenInclude(s => s!.CommissionExpenseLedger)
                    .Include(a => a.PigmyScheme)
                        .ThenInclude(s => s!.PrematureDeductionLedger);
            }

            if (scopedBranch.HasValue && scopedBranch.Value > 0)
            {
                return await query.FirstOrDefaultAsync(a =>
                    a.BranchID == scopedBranch.Value &&
                    (a.AccountNo == key || a.LegacyAccountNumber == key || a.OldAccountNo == key));
            }

            return await query.FirstOrDefaultAsync(a =>
                a.AccountNo == key || a.LegacyAccountNumber == key || a.OldAccountNo == key);
        }

        private static string FormatCustomerFullName(Customer? c)
        {
            if (c == null) return string.Empty;
            return string.Join(" ", new[] { c.FirstName, c.MiddleName, c.LastName }
                .Where(s => !string.IsNullOrWhiteSpace(s))).Trim();
        }

        private int ResolveCurrentUserId()
        {
            int uid = User.GetUserId();
            return uid > 0 ? uid : 1;
        }

        private bool CanPerformManagerOverride()
        {
            if (User.IsHeadOfficeAdmin()) return true;
            string role = (User.GetUserRole() ?? string.Empty).Trim();
            string[] allowedRoles =
            {
                "Admin", "SuperAdmin", "HeadOffice", "HO_Manager",
                "Manager", "BranchManager", "Branch_Manager",
                "CEO", "Chairman", "GeneralManager", "Officer"
            };
            return allowedRoles.Any(r => string.Equals(r, role, StringComparison.OrdinalIgnoreCase));
        }

        private async Task<DateTime> ResolveBranchBusinessDateAsync(int branchId, DateTime? requestedDate = null)
        {
            if (requestedDate.HasValue)
            {
                return requestedDate.Value.Date;
            }

            if (Request?.Headers != null && Request.Headers.TryGetValue("X-Business-Date", out var headerVals))
            {
                string? raw = headerVals.FirstOrDefault();
                if (!string.IsNullOrWhiteSpace(raw) && DateTime.TryParse(raw, out var parsedHeader))
                {
                    return parsedHeader.Date;
                }
            }

            int targetBranchId = branchId > 0 ? branchId : 1;
            var openDay = await _context.BranchDayEndStatuses
                .AsNoTracking()
                .Where(b => b.BranchID == targetBranchId && !b.IsDayClosed)
                .OrderByDescending(b => b.BusinessDate)
                .FirstOrDefaultAsync();
            if (openDay != null)
            {
                return openDay.BusinessDate.Date;
            }

            var latestDay = await _context.BranchDayEndStatuses
                .AsNoTracking()
                .Where(b => b.BranchID == targetBranchId)
                .OrderByDescending(b => b.BusinessDate)
                .FirstOrDefaultAsync();
            if (latestDay != null)
            {
                return latestDay.BusinessDate.Date;
            }

            return DateTime.Today;
        }

        private async Task<string?> ValidateTransactionDateGuardsAsync(int branchId, DateTime txDate)
        {
            DateTime dateOnly = txDate.Date;

            var closedFy = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(fy => fy.IsClosed &&
                                           dateOnly >= fy.StartDate.Date &&
                                           dateOnly <= fy.EndDate.Date);
            if (closedFy != null)
            {
                return $"दिनांक {dateOnly:dd/MM/yyyy} ही तारीख बंद केलेल्या आर्थिक वर्षात ({closedFy.YearCode}) येते. बंद आर्थिक वर्षात व्यवहार करता येत नाही.";
            }

            int targetBranchId = branchId > 0 ? branchId : 1;
            var dayStatus = await _context.BranchDayEndStatuses
                .AsNoTracking()
                .FirstOrDefaultAsync(b => b.BranchID == targetBranchId && b.BusinessDate.Date == dateOnly);
            if (dayStatus != null && dayStatus.IsDayClosed)
            {
                return $"शाखा #{targetBranchId} साठी दिनांक {dateOnly:dd/MM/yyyy} ची दिवसअखेर (Day-End) पूर्ण झाली आहे. बंद तारखेला पिग्मी विड्रॉल/क्लोजर करता येत नाही.";
            }

            return null;
        }

        private async Task<string?> CheckPendingSettlementVoucherAsync(int pigmyAccountId)
        {
            var pendingWithdrawalVoucher = await (
                from w in _context.PigmyWithdrawals.AsNoTracking()
                join v in _context.Vouchers.AsNoTracking()
                    on w.VoucherNo equals v.VoucherNo into vj
                from vMatch in vj.DefaultIfEmpty()
                where w.PigmyAccountID == pigmyAccountId
                select new
                {
                    w.VoucherID,
                    w.VoucherNo,
                    VoucherStatus = vMatch != null ? vMatch.Status : null
                })
                .ToListAsync();

            foreach (var item in pendingWithdrawalVoucher)
            {
                string? status = item.VoucherStatus;
                if (status == null && item.VoucherID.HasValue && item.VoucherID.Value > 0)
                {
                    status = await _context.Vouchers
                        .AsNoTracking()
                        .Where(v => v.VoucherID == item.VoucherID.Value)
                        .Select(v => v.Status)
                        .FirstOrDefaultAsync();
                }

                if (string.Equals(status, "Pending", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(status, "Unapproved", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(status, "Draft", StringComparison.OrdinalIgnoreCase))
                {
                    return $"या पिग्मी खात्याचा आधीचा विड्रॉल व्हाउचर ({item.VoucherNo}) अद्याप चेकर पासिंगसाठी प्रलंबित आहे. कृपया आधी ते व्हाउचर मंजूर किंवा रद्द करा.";
                }
            }

            var pendingClosures = await _context.PigmyAccountClosures
                .AsNoTracking()
                .Include(c => c.Voucher)
                .Where(c => c.PigmyAccountID == pigmyAccountId)
                .ToListAsync();

            foreach (var clo in pendingClosures)
            {
                string? status = clo.Voucher?.Status;
                if (status == null && !string.IsNullOrWhiteSpace(clo.VoucherNo))
                {
                    status = await _context.Vouchers
                        .AsNoTracking()
                        .Where(v => v.VoucherNo == clo.VoucherNo)
                        .Select(v => v.Status)
                        .FirstOrDefaultAsync();
                }

                if (string.Equals(status, "Pending", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(status, "Unapproved", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(status, "Draft", StringComparison.OrdinalIgnoreCase))
                {
                    return $"या पिग्मी खात्याचे क्लोजर व्हाउचर ({clo.VoucherNo}) चेकर पासिंगसाठी प्रलंबित आहे.";
                }
            }

            return null;
        }

        private async Task<(bool IsValid, string? ErrorMessage, Ledger? Ledger)> ValidateDynamicPigmyLiabilityLedgerAsync(PigmyScheme? scheme)
        {
            if (scheme == null || !scheme.PigmyLiabilityLedgerID.HasValue || scheme.PigmyLiabilityLedgerID.Value <= 0)
            {
                return (false,
                    "पिग्मी ठेव योजनेसाठी 'पिग्मी ठेव देयता जी.एल. खाते (Pigmy Liability Ledger)' मॅप केलेले नाही. कृपया पिग्मी योजना मास्टरमध्ये लेजर मॅपिंग पूर्ण करा.",
                    null);
            }

            var ledger = await _context.Ledgers
                .Include(l => l.AccountGroup)
                .FirstOrDefaultAsync(l => l.LedgerID == scheme.PigmyLiabilityLedgerID.Value);

            if (ledger == null || !ledger.IsActive)
            {
                return (false,
                    "पिग्मी योजनेत मॅप केलेले 'पिग्मी ठेव देयता लेजर' सापडले नाही किंवा निष्क्रिय आहे.",
                    null);
            }

            if (PigmySettlementHelper.IsCashOrBankLedger(ledger))
            {
                return (false,
                    $"पिग्मी ठेव देयता लेजर म्हणून रोख/बँक लेजर ('{ledger.LedgerName}') वापरता येत नाही. कृपया पिग्मी योजना मास्टर तपासा.",
                    null);
            }

            return (true, null, ledger);
        }

        private async Task<(bool IsValid, string? ErrorMessage, Ledger? Ledger)> ValidateBranchCashLedgerAsync(int branchId)
        {
            int cashId = await CashLedgerHelper.GetCashLedgerIdAsync(_context, branchId, "PIGMY");
            if (cashId <= 0)
            {
                return (false,
                    $"शाखा #{branchId} साठी वैध रोख (Cash-in-Hand) जी.एल. लेजर मॅप केलेले नाही. कृपया व्हाउचर मॅपिंग / शाखा कॅश लेजर तपासा.",
                    null);
            }

            var cashLedger = await _context.Ledgers
                .Include(l => l.AccountGroup)
                .FirstOrDefaultAsync(l => l.LedgerID == cashId && l.IsActive);

            if (cashLedger == null)
            {
                return (false,
                    $"शाखा #{branchId} साठी मॅप केलेले रोख जी.एल. लेजर (ID: {cashId}) सापडले नाही किंवा निष्क्रिय आहे.",
                    null);
            }

            return (true, null, cashLedger);
        }

        private async Task<(decimal CapitalizedInterest, decimal ProvisionedInterest)> GetPigmyPostedInterestContextAsync(PigmyAccount account)
        {
            decimal capitalized = await _context.PigmyInterestLogs
                .AsNoTracking()
                .Where(l => l.PigmyAccountId == account.PigmyAccountID && l.Status != "CANCELLED")
                .SumAsync(l => (decimal?)l.InterestAmount) ?? 0m;

            decimal provisioned = 0m;
            if (account.PigmyScheme?.InterestPayableLedgerID.HasValue == true &&
                account.PigmyScheme.InterestPayableLedgerID.Value > 0 &&
                account.CustomerID > 0)
            {
                int payableLedgerId = account.PigmyScheme.InterestPayableLedgerID.Value;
                var lines = await _context.VoucherDetails
                    .AsNoTracking()
                    .Include(vd => vd.Voucher)
                    .Where(vd => vd.LedgerID == payableLedgerId &&
                                 vd.CustomerID == account.CustomerID &&
                                 vd.Voucher != null &&
                                 vd.Voucher.Status == "Approved")
                    .Select(vd => new { vd.DrCr, vd.Amount })
                    .ToListAsync();

                decimal cr = lines.Where(x => string.Equals(x.DrCr, "Cr", StringComparison.OrdinalIgnoreCase)).Sum(x => x.Amount);
                decimal dr = lines.Where(x => string.Equals(x.DrCr, "Dr", StringComparison.OrdinalIgnoreCase)).Sum(x => x.Amount);
                provisioned = Math.Max(0m, Math.Round(cr - dr, 2, MidpointRounding.AwayFromZero));
            }

            return (Math.Round(capitalized, 2, MidpointRounding.AwayFromZero), provisioned);
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
                var diffDays = Math.Max(0, (asOfDate.Date - fromDate.Date).Days);
                decimal newInterest = diffDays > 0
                    ? Math.Round((loanAccount.PrincipalBalance * rate * diffDays) / 36500m, 2, MidpointRounding.AwayFromZero)
                    : 0m;
                return (newInterest, diffDays, fromDate);
            }
            else
            {
                var dbSchedules = await _context.LoanInstallmentSchedules
                    .Where(s => s.LoanAccountID == loanAccount.LoanAccountID)
                    .ToListAsync();

                var pastCollections = await _context.LoanCollections
                    .Where(c => c.LoanAccountID == loanAccount.LoanAccountID)
                    .ToListAsync();

                decimal unpaidScheduledInterest = LoanScheduleGenerator.GetUnpaidScheduledInterest(
                    loanAccount,
                    dbSchedules,
                    pastCollections,
                    asOfDate.Date);

                decimal additionalInterest = Math.Max(0m, unpaidScheduledInterest - loanAccount.InterestBalance);
                var fromDate = loanAccount.LastInstallmentPaidDate ?? loanAccount.OpeningDate;
                var diffDays = Math.Max(0, (asOfDate.Date - fromDate.Date).Days);
                return (Math.Round(additionalInterest, 2, MidpointRounding.AwayFromZero), diffDays, fromDate);
            }
        }

        private async Task<(
            bool HasDirectLien,
            int? DirectLienLoanAccountId,
            string? DirectLienLoanNo,
            decimal DirectLienAmount,
            List<LoanAccount> ActiveLoanEntities,
            List<ActiveLoanDto> ActiveLoanDtos,
            decimal TotalOutstanding,
            int? MemberId)> GetPigmyLoanAndLienContextAsync(PigmyAccount account, DateTime asOfDate)
        {
            int custId = account.CustomerID;
            int? memberId = await _context.Members
                .Where(m => m.CustomerID == custId)
                .Select(m => (int?)m.MemberID)
                .FirstOrDefaultAsync();

            var activeCollaterals = await _context.LoanDepositCollaterals
                .Where(c => (c.CollateralType == "Pigmy" || c.CollateralType == "PigmyDeposit") &&
                            c.DepositAccountID == account.PigmyAccountID &&
                            c.LienStatus != "Released")
                .ToListAsync();

            var collateralLoanIds = activeCollaterals
                .Where(c => c.LoanAccountID.HasValue && c.LoanAccountID.Value > 0)
                .Select(c => c.LoanAccountID!.Value)
                .Distinct()
                .ToList();

            string accNo = (account.AccountNo ?? string.Empty).Trim();
            string lienLoanNo = (account.LienLoanAccountNo ?? string.Empty).Trim();

            var activeLoanEntities = await _context.LoanAccounts
                .Include(l => l.LoanRate)
                .Where(l => l.Status != "Closed" &&
                            (l.PrincipalBalance > 0 || l.InterestBalance > 0 || l.OverdueInterestBalance > 0) &&
                            ((custId > 0 && l.CustomerID == custId) ||
                             (memberId.HasValue && memberId.Value > 0 && l.MemberID == memberId.Value) ||
                             collateralLoanIds.Contains(l.LoanAccountID) ||
                             (!string.IsNullOrEmpty(lienLoanNo) && l.LoanAccountNo == lienLoanNo) ||
                             (!string.IsNullOrEmpty(accNo) && l.SecurityDetails != null && l.SecurityDetails.Contains(accNo))))
                .OrderBy(l => l.LoanAccountNo)
                .ToListAsync();

            var activeLoanDtos = new List<ActiveLoanDto>();
            decimal totalOutstanding = 0m;
            foreach (var l in activeLoanEntities)
            {
                var (accruedInt, _, _) = await CalculatePendingLoanInterestAsync(l, asOfDate);
                decimal totalDue = Math.Round(l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance + accruedInt, 2, MidpointRounding.AwayFromZero);
                totalOutstanding += totalDue;

                activeLoanDtos.Add(new ActiveLoanDto
                {
                    LoanAccountId = l.LoanAccountID,
                    LoanAccountNo = l.LoanAccountNo ?? string.Empty,
                    LoanType = l.LoanRate?.LoanType ?? "कर्ज खाते",
                    PrincipalBalance = l.PrincipalBalance,
                    InterestBalance = l.InterestBalance,
                    AccruedInterest = accruedInt,
                    OverdueInterest = l.OverdueInterestBalance + l.InterestBalance + accruedInt,
                    OverduePenaltyBalance = l.OverdueInterestBalance,
                    TotalOutstanding = totalDue,
                    IsDirectLienLoan = collateralLoanIds.Contains(l.LoanAccountID) ||
                                       (!string.IsNullOrEmpty(lienLoanNo) && string.Equals(l.LoanAccountNo, lienLoanNo, StringComparison.OrdinalIgnoreCase)) ||
                                       (!string.IsNullOrEmpty(accNo) && l.SecurityDetails != null && l.SecurityDetails.Contains(accNo))
                });
            }

            bool hasActiveCollateralLoan = collateralLoanIds.Any() &&
                                           activeLoanEntities.Any(l => collateralLoanIds.Contains(l.LoanAccountID));
            bool hasSecurityLoan = !string.IsNullOrEmpty(accNo) &&
                                   activeLoanEntities.Any(l => l.SecurityDetails != null && l.SecurityDetails.Contains(accNo));
            bool hasLinkedLienLoan = !string.IsNullOrEmpty(lienLoanNo) &&
                                     activeLoanEntities.Any(l => string.Equals(l.LoanAccountNo, lienLoanNo, StringComparison.OrdinalIgnoreCase));
            bool hasUnlinkedManualLien = account.IsLienMarked && (activeLoanEntities.Any() || !string.IsNullOrEmpty(lienLoanNo));

            bool hasDirectLien = account.IsLienMarked || hasActiveCollateralLoan || hasSecurityLoan || hasLinkedLienLoan || hasUnlinkedManualLien;

            var directLoanEntity = !string.IsNullOrEmpty(lienLoanNo)
                ? activeLoanEntities.FirstOrDefault(l => string.Equals(l.LoanAccountNo, lienLoanNo, StringComparison.OrdinalIgnoreCase))
                : activeLoanEntities.FirstOrDefault(l =>
                    collateralLoanIds.Contains(l.LoanAccountID) ||
                    (!string.IsNullOrEmpty(accNo) && l.SecurityDetails != null && l.SecurityDetails.Contains(accNo)))
                  ?? (account.IsLienMarked ? activeLoanEntities.FirstOrDefault() : null);

            string? resolvedLienNo = directLoanEntity?.LoanAccountNo ?? (!string.IsNullOrEmpty(lienLoanNo) ? lienLoanNo : null);
            decimal directLienAmt = account.LienAmount
                ?? (activeCollaterals.Any() ? activeCollaterals.Sum(c => c.LienAmount > 0 ? c.LienAmount : c.DepositAmount) : account.TotalDepositedAmount);

            return (
                hasDirectLien,
                directLoanEntity?.LoanAccountID,
                resolvedLienNo,
                directLienAmt,
                activeLoanEntities,
                activeLoanDtos,
                Math.Round(totalOutstanding, 2, MidpointRounding.AwayFromZero),
                memberId);
        }

        private async Task<(LoanAccount loan, LoanCollection collection, decimal principalPaid, decimal interestPaid, decimal penaltyPaid)> ProcessPigmyLoanSettlementAsync(
            int targetLoanId,
            decimal adjustAmount,
            DateTime txDate,
            PigmyAccount pigmyAccount,
            string transferType,
            decimal balanceBefore,
            decimal balanceAfter,
            int branchId,
            int userId)
        {
            var targetLoan = await _context.LoanAccounts
                .Include(l => l.LoanRate)
                .FirstOrDefaultAsync(l => l.LoanAccountID == targetLoanId);

            if (targetLoan == null || targetLoan.Status == "Closed")
            {
                throw new InvalidOperationException("निवडलेले कर्ज खाते सापडले नाही किंवा ते आधीच बंद (Closed) आहे.");
            }

            decimal prevIntBal = targetLoan.InterestBalance;
            DateTime? prevIntDt = targetLoan.LastInterestPostingDate;
            var (pendingInterest, _, _) = await CalculatePendingLoanInterestAsync(targetLoan, txDate);
            if (pendingInterest > 0m)
            {
                targetLoan.InterestBalance = Math.Round(targetLoan.InterestBalance + pendingInterest, 2, MidpointRounding.AwayFromZero);
                targetLoan.LastInterestPostingDate = txDate;
            }

            decimal penaltyPaid = Math.Min(adjustAmount, targetLoan.OverdueInterestBalance);
            decimal remainingAdj = adjustAmount - penaltyPaid;

            decimal interestPaid = Math.Min(remainingAdj, targetLoan.InterestBalance);
            remainingAdj -= interestPaid;

            decimal principalPaid = Math.Min(remainingAdj, targetLoan.PrincipalBalance);
            remainingAdj -= principalPaid;

            targetLoan.OverdueInterestBalance = Math.Max(0m, Math.Round(targetLoan.OverdueInterestBalance - penaltyPaid, 2, MidpointRounding.AwayFromZero));
            targetLoan.InterestBalance = Math.Max(0m, Math.Round(targetLoan.InterestBalance - interestPaid, 2, MidpointRounding.AwayFromZero));
            targetLoan.PrincipalBalance = Math.Max(0m, Math.Round(targetLoan.PrincipalBalance - principalPaid, 2, MidpointRounding.AwayFromZero));
            targetLoan.LastInstallmentPaidDate = txDate;
            if (!targetLoan.LastInterestPostingDate.HasValue || targetLoan.LastInterestPostingDate.Value < txDate)
            {
                targetLoan.LastInterestPostingDate = txDate;
            }

            if (targetLoan.PrincipalBalance <= 0.01m && targetLoan.InterestBalance <= 0.01m && targetLoan.OverdueInterestBalance <= 0.01m)
            {
                targetLoan.PrincipalBalance = 0m;
                targetLoan.InterestBalance = 0m;
                targetLoan.OverdueInterestBalance = 0m;
                targetLoan.Status = "Closed";
            }
            _context.Entry(targetLoan).State = EntityState.Modified;

            var branch = await _context.Branches.FindAsync(branchId);
            string branchCode = !string.IsNullOrWhiteSpace(branch?.BranchCode) ? branch.BranchCode.Trim() : "HQ";
            string suffix = Guid.NewGuid().ToString("N").Substring(0, 4).ToUpperInvariant();
            string loanReceiptNo = $"{branchCode}-REC-LN-PGADJ-{pigmyAccount.AccountNo}-{suffix}";
            if (loanReceiptNo.Length > 50)
            {
                loanReceiptNo = loanReceiptNo.Substring(0, 50);
            }

            string remarksText = $"पिग्मी वजावट: {pigmyAccount.AccountNo} [PreIntBal:{prevIntBal.ToString("F2", CultureInfo.InvariantCulture)}|PreIntDt:{(prevIntDt.HasValue ? prevIntDt.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) : "NULL")}]";
            if (remarksText.Length > 200)
            {
                remarksText = remarksText.Substring(0, 200);
            }

            var loanCollection = new LoanCollection
            {
                LoanAccountID = targetLoan.LoanAccountID,
                BranchID = targetLoan.BranchID > 0 ? targetLoan.BranchID : branchId,
                CreatedByUserID = userId,
                CollectingCashierID = userId,
                CollectionDate = txDate,
                ReceiptNo = loanReceiptNo,
                TotalAmountReceived = adjustAmount,
                PenaltyInterestCollected = penaltyPaid,
                ReceivableInterestCollected = Math.Min(interestPaid, prevIntBal),
                InterestCollected = Math.Max(0m, interestPaid - Math.Min(interestPaid, prevIntBal)),
                PrincipalCollected = principalPaid,
                PaymentMode = "Pigmy Settlement",
                BankName = $"पिग्मी ठेव समायोजन: {pigmyAccount.AccountNo}",
                ChequeNo = pigmyAccount.AccountNo,
                SourcePigmyAccountID = pigmyAccount.PigmyAccountID,
                TransferFromPigmyAccountNo = pigmyAccount.AccountNo,
                PigmyTransferType = transferType,
                PigmyBalanceBefore = balanceBefore,
                PigmyBalanceAfter = balanceAfter,
                Remarks = remarksText
            };

            _context.LoanCollections.Add(loanCollection);
            await _context.SaveChangesAsync();

            var allSchedules = await _context.LoanInstallmentSchedules
                .Where(s => s.LoanAccountID == targetLoan.LoanAccountID)
                .OrderBy(s => s.InstallmentNo)
                .ToListAsync();

            if (allSchedules.Any())
            {
                var allCollections = await _context.LoanCollections
                    .Where(c => c.LoanAccountID == targetLoan.LoanAccountID)
                    .ToListAsync();

                LoanScheduleGenerator.SynchronizeSchedules(targetLoan, allSchedules, allCollections);
                foreach (var sch in allSchedules)
                {
                    _context.Entry(sch).State = EntityState.Modified;
                }
                await _context.SaveChangesAsync();
            }

            return (targetLoan, loanCollection, principalPaid, interestPaid, penaltyPaid);
        }

        public class ActiveLoanDto
        {
            public int LoanAccountId { get; set; }
            public string LoanAccountNo { get; set; } = string.Empty;
            public string LoanType { get; set; } = string.Empty;
            public decimal PrincipalBalance { get; set; }
            public decimal InterestBalance { get; set; }
            public decimal AccruedInterest { get; set; }
            public decimal OverduePenaltyBalance { get; set; }
            public decimal OverdueInterest { get; set; }
            public decimal TotalOutstanding { get; set; }
            public bool IsDirectLienLoan { get; set; }
        }

        public class ClosurePreviewResult
        {
            public int PigmyAccountId { get; set; }
            public int CustomerId { get; set; }
            public int BranchId { get; set; }
            public string AccountNo { get; set; } = string.Empty;
            public string? LegacyAccountNumber { get; set; }
            public string CustomerName { get; set; } = string.Empty;
            public string MemberName { get; set; } = string.Empty;
            public string CIFNo { get; set; } = string.Empty;
            public string SchemeName { get; set; } = string.Empty;
            public string AgentName { get; set; } = string.Empty;
            public DateTime BusinessDate { get; set; }
            public DateTime OpeningDate { get; set; }
            public DateTime MaturityDate { get; set; }
            public DateTime CycleStartDate { get; set; }
            public int CurrentCycleNumber { get; set; } = 1;
            public int TenureDaysInCycle { get; set; }
            public decimal TenureMonthsInCycle { get; set; }
            public decimal TotalDepositedAmount { get; set; }
            public decimal TotalWithdrawnAmount { get; set; }
            public decimal AlreadyCapitalizedInterest { get; set; }
            public decimal VerifiedProvisionedInterest { get; set; }
            public bool IsPremature { get; set; }
            public decimal PrematurePenaltyRate { get; set; }
            public decimal PrematurePenaltyAmount { get; set; }
            public decimal PrematureInterestRate { get; set; }
            public decimal GrossSlabInterestAmount { get; set; }
            public decimal PrematureInterestAmount { get; set; }
            public decimal NetPayable { get; set; }
            public string PolicyNote { get; set; } = string.Empty;
            public string CalculationMethodLabel { get; set; } = string.Empty;
            public bool HasDirectLien { get; set; }
            public int? DirectLienLoanAccountId { get; set; }
            public string? DirectLienLoanNo { get; set; }
            public decimal DirectLienAmount { get; set; }
            public bool HasActiveLoanLien { get; set; }
            public decimal TotalLoanLiability { get; set; }
            public List<ActiveLoanDto> ActiveLoans { get; set; } = new List<ActiveLoanDto>();

            // Dynamic Scheme Ledger Mappings for UI pre-selection
            public int? SchemeLiabilityLedgerId { get; set; }
            public string? SchemeLiabilityLedgerName { get; set; }
            public int? SchemePrematureDeductionLedgerId { get; set; }
            public string? SchemePrematureDeductionLedgerName { get; set; }
            public int? SchemeInterestExpenseLedgerId { get; set; }
            public string? SchemeInterestExpenseLedgerName { get; set; }
            public int? SchemeInterestPayableLedgerId { get; set; }
            public string? SchemeInterestPayableLedgerName { get; set; }
            public int? SchemeCommissionExpenseLedgerId { get; set; }
            public string? SchemeCommissionExpenseLedgerName { get; set; }
        }

        public class ClosureRequest
        {
            public string AccountNo { get; set; } = string.Empty;
            public int BranchId { get; set; } = 1;
            public DateTime? ClosureDate { get; set; }
            public string PaymentMode { get; set; } = "Cash"; // Cash | Bank | Saving Transfer | Adjust in Loan
            public int? BankLedgerId { get; set; }
            public int? SavingAccountId { get; set; }
            public string? ReferenceNo { get; set; }
            public string Narration { get; set; } = string.Empty;
            public bool ManagerOverrideConfirmed { get; set; } = false;

            // Dynamic Commission / Penalty & Interest Controls
            public decimal? CustomPenaltyAmount { get; set; }
            public int? DeductionLedgerId { get; set; }
            public decimal? CustomInterestAmount { get; set; }
            public string InterestDebitMode { get; set; } = "Expense"; // Expense | Provision
            public int? InterestDebitLedgerId { get; set; }
            public string? OverrideReason { get; set; }

            // Loan Adjustment & Surplus Payout Controls
            public bool AdjustInLoan { get; set; } = false;
            public int? TargetLoanAccountId { get; set; }
            public decimal? LoanAdjustmentAmount { get; set; }
            public string? SurplusPaymentMode { get; set; } = "Cash";
            public int? SurplusBankLedgerId { get; set; }
            public int? SurplusSavingAccountId { get; set; }
        }

        public class WithdrawalPreviewResult
        {
            public int PigmyAccountId { get; set; }
            public int CustomerId { get; set; }
            public int BranchId { get; set; }
            public string AccountNo { get; set; } = string.Empty;
            public string? LegacyAccountNumber { get; set; }
            public string CustomerName { get; set; } = string.Empty;
            public string MemberName { get; set; } = string.Empty;
            public string CIFNo { get; set; } = string.Empty;
            public string SchemeName { get; set; } = string.Empty;
            public decimal CurrentBalance { get; set; }
            public decimal RequestedAmount { get; set; }
            public int CurrentCycleNumber { get; set; }
            public DateTime CycleStartDate { get; set; }
            public int ElapsedDays { get; set; }
            public decimal ElapsedMonths { get; set; }
            public decimal AppliedPenaltyRate { get; set; }
            public decimal AppliedPenaltyAmount { get; set; }
            public decimal AppliedInterestRate { get; set; }
            public decimal AppliedInterestAmount { get; set; }
            public decimal NetPaidAmount { get; set; }
            public decimal RemainingBalance { get; set; }
            public string PolicyNote { get; set; } = string.Empty;
            public string CalculationMethodLabel { get; set; } = string.Empty;
            public DateTime NextCycleStartDate { get; set; }
            public DateTime FixedMaturityDate { get; set; }
            public bool HasDirectLien { get; set; }
            public int? DirectLienLoanAccountId { get; set; }
            public string? DirectLienLoanNo { get; set; }
            public decimal DirectLienAmount { get; set; }
            public decimal FreeWithdrawableBalance { get; set; }
            public bool HasActiveLoanLien { get; set; }
            public decimal TotalLoanLiability { get; set; }
            public List<ActiveLoanDto> ActiveLoans { get; set; } = new List<ActiveLoanDto>();

            public int? SchemeLiabilityLedgerId { get; set; }
            public string? SchemeLiabilityLedgerName { get; set; }
            public int? SchemePrematureDeductionLedgerId { get; set; }
            public string? SchemePrematureDeductionLedgerName { get; set; }
            public int? SchemeInterestExpenseLedgerId { get; set; }
            public string? SchemeInterestExpenseLedgerName { get; set; }
            public int? SchemeInterestPayableLedgerId { get; set; }
            public string? SchemeInterestPayableLedgerName { get; set; }
            public int? SchemeCommissionExpenseLedgerId { get; set; }
            public string? SchemeCommissionExpenseLedgerName { get; set; }
        }

        public class WithdrawalRequest
        {
            public string AccountNo { get; set; } = string.Empty;
            public decimal Amount { get; set; }
            public int BranchId { get; set; } = 1;
            public DateTime? WithdrawalDate { get; set; }
            public string PaymentMode { get; set; } = "Cash"; // Cash | Bank | Saving Transfer | Adjust in Loan
            public int? BankLedgerId { get; set; }
            public int? SavingAccountId { get; set; }
            public string? ReferenceNo { get; set; }
            public string Narration { get; set; } = string.Empty;
            public bool ManagerOverrideConfirmed { get; set; } = false;

            // Dynamic Commission / Penalty & Interest Controls
            public decimal? CustomPenaltyAmount { get; set; }
            public int? DeductionLedgerId { get; set; }
            public decimal? CustomInterestAmount { get; set; }
            public string InterestDebitMode { get; set; } = "Expense";
            public int? InterestDebitLedgerId { get; set; }
            public string? OverrideReason { get; set; }

            // Loan Adjustment & Surplus Payout Controls
            public bool AdjustInLoan { get; set; } = false;
            public int? TargetLoanAccountId { get; set; }
            public decimal? LoanAdjustmentAmount { get; set; }
            public string? SurplusPaymentMode { get; set; } = "Cash";
            public int? SurplusBankLedgerId { get; set; }
            public int? SurplusSavingAccountId { get; set; }
        }

        // GET: api/PigmyClosure/Preview/{accountNo}
        [HttpGet("Preview/{accountNo}")]
        public async Task<ActionResult<ClosurePreviewResult>> PreviewClosure(
            string accountNo,
            [FromQuery] int? branchId = null,
            [FromQuery] DateTime? asOfDate = null)
        {
            var account = await FindPigmyAccountForBranchAsync(accountNo, branchId, includeDetails: true);

            if (account == null) return NotFound(new { message = "पिग्मी खाते सापडले नाही (Account not found)." });
            if (!User.CanAccessBranch(account.BranchID)) return Forbid();
            if (account.Status == "Closed") return BadRequest(new { message = "सदर पिग्मी खाते आधीच बंद (Closed) करण्यात आले आहे." });

            DateTime effectiveDate = await ResolveBranchBusinessDateAsync(account.BranchID, asOfDate);
            DateTime effectiveMaturity = PigmyInterestCalculationService.ResolveEffectiveMaturityDate(account);
            bool isPremature = effectiveDate < effectiveMaturity;
            DateTime cycleStart = (account.EffectiveStartDate ?? account.OpeningDate).Date;
            int tenureDaysInCycle = Math.Max(0, (int)(effectiveDate - cycleStart).TotalDays);
            decimal tenureMonthsInCycle = Math.Round((decimal)tenureDaysInCycle / 30.416m, 2);

            var slabRes = PigmyInterestCalculationService.ResolveApplicableSlab(account.PigmyScheme, tenureDaysInCycle, isPremature);
            decimal penaltyRate = slabRes.PenaltyRate;
            decimal interestRate = slabRes.InterestRate;
            string policyNote = slabRes.PolicyNote;

            var (alreadyCapitalized, verifiedProvisioned) = await GetPigmyPostedInterestContextAsync(account);

            decimal principalBaseForInterest = Math.Max(0m, account.TotalDepositedAmount - alreadyCapitalized);
            decimal penaltyAmount = Math.Round(account.TotalDepositedAmount * (penaltyRate / 100m), 2, MidpointRounding.AwayFromZero);
            decimal grossSlabInterest = await PigmyInterestCalculationService.CalculateClosureOrPeriodInterestAsync(
                _context,
                account,
                principalBaseForInterest,
                slabRes,
                cycleStart,
                effectiveDate);
            decimal recommendedAdditionalInterest = Math.Max(0m, Math.Round(grossSlabInterest - alreadyCapitalized, 2, MidpointRounding.AwayFromZero));
            decimal netPayable = Math.Max(0m, Math.Round(account.TotalDepositedAmount - penaltyAmount + recommendedAdditionalInterest, 2, MidpointRounding.AwayFromZero));

            var (hasDirectLien, directLoanId, directLoanNo, directLienAmt, _, activeLoans, totalLoanLiability, _) =
                await GetPigmyLoanAndLienContextAsync(account, effectiveDate);

            bool hasActiveLoanLien = hasDirectLien || activeLoans.Any(l => l.TotalOutstanding > 0);
            string fullCustomerName = FormatCustomerFullName(account.Customer);

            return Ok(new ClosurePreviewResult
            {
                PigmyAccountId = account.PigmyAccountID,
                CustomerId = account.CustomerID,
                BranchId = account.BranchID,
                AccountNo = account.AccountNo,
                LegacyAccountNumber = account.LegacyAccountNumber ?? account.OldAccountNo,
                CustomerName = fullCustomerName,
                MemberName = fullCustomerName,
                CIFNo = account.Customer?.CIFNo ?? string.Empty,
                SchemeName = account.PigmyScheme?.SchemeName ?? string.Empty,
                AgentName = account.PigmyAgent?.AgentName ?? string.Empty,
                BusinessDate = effectiveDate,
                OpeningDate = account.OpeningDate,
                MaturityDate = effectiveMaturity,
                CycleStartDate = cycleStart,
                CurrentCycleNumber = account.CurrentCycleNumber,
                TenureDaysInCycle = tenureDaysInCycle,
                TenureMonthsInCycle = tenureMonthsInCycle,
                TotalDepositedAmount = account.TotalDepositedAmount,
                TotalWithdrawnAmount = account.TotalWithdrawnAmount,
                AlreadyCapitalizedInterest = alreadyCapitalized,
                VerifiedProvisionedInterest = verifiedProvisioned,
                IsPremature = isPremature,
                PrematurePenaltyRate = penaltyRate,
                PrematurePenaltyAmount = penaltyAmount,
                PrematureInterestRate = interestRate,
                GrossSlabInterestAmount = grossSlabInterest,
                PrematureInterestAmount = recommendedAdditionalInterest,
                NetPayable = netPayable,
                PolicyNote = policyNote,
                CalculationMethodLabel = slabRes.MethodDisplayLabel,
                HasDirectLien = hasDirectLien,
                DirectLienLoanAccountId = directLoanId,
                DirectLienLoanNo = directLoanNo,
                DirectLienAmount = directLienAmt,
                HasActiveLoanLien = hasActiveLoanLien,
                TotalLoanLiability = totalLoanLiability,
                ActiveLoans = activeLoans,
                SchemeLiabilityLedgerId = account.PigmyScheme?.PigmyLiabilityLedgerID,
                SchemeLiabilityLedgerName = account.PigmyScheme?.PigmyLiabilityLedger?.LedgerName,
                SchemePrematureDeductionLedgerId = account.PigmyScheme?.PrematureDeductionLedgerID,
                SchemePrematureDeductionLedgerName = account.PigmyScheme?.PrematureDeductionLedger?.LedgerName,
                SchemeInterestExpenseLedgerId = account.PigmyScheme?.InterestExpenseLedgerID,
                SchemeInterestExpenseLedgerName = account.PigmyScheme?.InterestExpenseLedger?.LedgerName,
                SchemeInterestPayableLedgerId = account.PigmyScheme?.InterestPayableLedgerID,
                SchemeInterestPayableLedgerName = account.PigmyScheme?.InterestPayableLedger?.LedgerName,
                SchemeCommissionExpenseLedgerId = account.PigmyScheme?.CommissionExpenseLedgerID,
                SchemeCommissionExpenseLedgerName = account.PigmyScheme?.CommissionExpenseLedger?.LedgerName
            });
        }

        // GET: api/PigmyClosure/PreviewWithdrawal/{accountNo}?amount=5000
        [HttpGet("PreviewWithdrawal/{accountNo}")]
        public async Task<ActionResult<WithdrawalPreviewResult>> PreviewWithdrawal(
            string accountNo,
            [FromQuery] decimal amount,
            [FromQuery] int? branchId = null,
            [FromQuery] DateTime? asOfDate = null)
        {
            if (amount <= 0)
            {
                return BadRequest(new { message = "कृपया वैध विड्रॉल रक्कम प्रविष्ट करा (Amount must be > 0)." });
            }

            var account = await FindPigmyAccountForBranchAsync(accountNo, branchId, includeDetails: true);

            if (account == null) return NotFound(new { message = "पिग्मी खाते सापडले नाही (Account not found)." });
            if (!User.CanAccessBranch(account.BranchID)) return Forbid();
            if (account.Status == "Closed") return BadRequest(new { message = "सदर पिग्मी खाते आधीच बंद (Closed) आहे." });
            if (amount > account.TotalDepositedAmount)
            {
                return BadRequest(new { message = $"खात्यातील जमा शिल्लक ₹{account.TotalDepositedAmount:N2} पेक्षा जास्त रक्कम काढता येणार नाही." });
            }

            DateTime effectiveDate = await ResolveBranchBusinessDateAsync(account.BranchID, asOfDate);
            DateTime effectiveMaturity = PigmyInterestCalculationService.ResolveEffectiveMaturityDate(account);
            DateTime cycleStart = (account.EffectiveStartDate ?? account.OpeningDate).Date;
            int elapsedDays = Math.Max(0, (int)(effectiveDate - cycleStart).TotalDays);
            decimal elapsedMonths = Math.Round((decimal)elapsedDays / 30.416m, 2);

            bool isPremature = effectiveDate < effectiveMaturity;
            var slabRes = PigmyInterestCalculationService.ResolveApplicableSlab(account.PigmyScheme, elapsedDays, isPremature);
            decimal penaltyRate = slabRes.PenaltyRate;
            decimal interestRate = slabRes.InterestRate;
            string policyNote = slabRes.PolicyNote;

            decimal penaltyAmount = Math.Round(amount * (penaltyRate / 100m), 2, MidpointRounding.AwayFromZero);
            decimal interestAmount = PigmyInterestCalculationService.CalculateWithdrawalInterest(amount, slabRes, elapsedDays);
            decimal netPaid = Math.Max(0m, Math.Round(amount - penaltyAmount + interestAmount, 2, MidpointRounding.AwayFromZero));
            decimal remainingBalance = Math.Max(0m, Math.Round(account.TotalDepositedAmount - amount, 2, MidpointRounding.AwayFromZero));

            var (hasDirectLien, directLoanId, directLoanNo, directLienAmt, _, activeLoans, totalLoanLiability, _) =
                await GetPigmyLoanAndLienContextAsync(account, effectiveDate);

            decimal freeWithdrawable = hasDirectLien
                ? Math.Max(0m, account.TotalDepositedAmount - directLienAmt)
                : account.TotalDepositedAmount;

            bool hasActiveLoanLien = hasActiveLoanLienFrom(hasDirectLien, activeLoans);
            string fullCustomerName = FormatCustomerFullName(account.Customer);

            return Ok(new WithdrawalPreviewResult
            {
                PigmyAccountId = account.PigmyAccountID,
                CustomerId = account.CustomerID,
                BranchId = account.BranchID,
                AccountNo = account.AccountNo,
                LegacyAccountNumber = account.LegacyAccountNumber ?? account.OldAccountNo,
                CustomerName = fullCustomerName,
                MemberName = fullCustomerName,
                CIFNo = account.Customer?.CIFNo ?? string.Empty,
                SchemeName = account.PigmyScheme?.SchemeName ?? string.Empty,
                CurrentBalance = account.TotalDepositedAmount,
                RequestedAmount = amount,
                CurrentCycleNumber = account.CurrentCycleNumber,
                CycleStartDate = cycleStart,
                ElapsedDays = elapsedDays,
                ElapsedMonths = elapsedMonths,
                AppliedPenaltyRate = penaltyRate,
                AppliedPenaltyAmount = penaltyAmount,
                AppliedInterestRate = interestRate,
                AppliedInterestAmount = interestAmount,
                NetPaidAmount = netPaid,
                RemainingBalance = remainingBalance,
                PolicyNote = policyNote,
                CalculationMethodLabel = slabRes.MethodDisplayLabel,
                NextCycleStartDate = effectiveDate,
                FixedMaturityDate = effectiveMaturity,
                HasDirectLien = hasDirectLien,
                DirectLienLoanAccountId = directLoanId,
                DirectLienLoanNo = directLoanNo,
                DirectLienAmount = directLienAmt,
                FreeWithdrawableBalance = freeWithdrawable,
                HasActiveLoanLien = hasActiveLoanLien,
                TotalLoanLiability = totalLoanLiability,
                ActiveLoans = activeLoans,
                SchemeLiabilityLedgerId = account.PigmyScheme?.PigmyLiabilityLedgerID,
                SchemeLiabilityLedgerName = account.PigmyScheme?.PigmyLiabilityLedger?.LedgerName,
                SchemePrematureDeductionLedgerId = account.PigmyScheme?.PrematureDeductionLedgerID,
                SchemePrematureDeductionLedgerName = account.PigmyScheme?.PrematureDeductionLedger?.LedgerName,
                SchemeInterestExpenseLedgerId = account.PigmyScheme?.InterestExpenseLedgerID,
                SchemeInterestExpenseLedgerName = account.PigmyScheme?.InterestExpenseLedger?.LedgerName,
                SchemeInterestPayableLedgerId = account.PigmyScheme?.InterestPayableLedgerID,
                SchemeInterestPayableLedgerName = account.PigmyScheme?.InterestPayableLedger?.LedgerName,
                SchemeCommissionExpenseLedgerId = account.PigmyScheme?.CommissionExpenseLedgerID,
                SchemeCommissionExpenseLedgerName = account.PigmyScheme?.CommissionExpenseLedger?.LedgerName
            });
        }

        private static bool hasActiveLoanLienFrom(bool hasDirectLien, List<ActiveLoanDto> activeLoans)
            => hasDirectLien || activeLoans.Any(l => l.TotalOutstanding > 0);

        // POST: api/PigmyClosure/Withdraw
        [HttpPost("Withdraw")]
        public async Task<IActionResult> WithdrawAmount([FromBody] WithdrawalRequest request)
        {
            if (request == null || request.Amount <= 0)
            {
                return BadRequest(new { message = "कृपया वैध विड्रॉल रक्कम प्रविष्ट करा (Amount must be > 0)." });
            }

            var account = await FindPigmyAccountForBranchAsync(request.AccountNo, request.BranchId > 0 ? request.BranchId : null, includeDetails: true);

            if (account == null) return NotFound(new { message = "पिग्मी खाते सापडले नाही (Account not found)." });
            if (!User.CanAccessBranch(account.BranchID)) return Forbid();
            if (account.Status == "Closed") return BadRequest(new { message = "सदर पिग्मी खाते आधीच बंद (Closed) आहे." });
            if (request.Amount > account.TotalDepositedAmount)
            {
                return BadRequest(new { message = $"खात्यातील जमा शिल्लक ₹{account.TotalDepositedAmount:N2} पेक्षा जास्त रक्कम काढता येणार नाही." });
            }

            string? pendingErr = await CheckPendingSettlementVoucherAsync(account.PigmyAccountID);
            if (pendingErr != null)
            {
                return BadRequest(new { message = pendingErr });
            }

            int userId = ResolveCurrentUserId();
            int userBranchId = User.GetOperatingBranchId();
            int counterBranchId = userBranchId > 0 ? userBranchId : (request.BranchId > 0 ? request.BranchId : (account.BranchID > 0 ? account.BranchID : 1));
            int homeBranchId = account.BranchID > 0 ? account.BranchID : 1;

            DateTime effDate = await ResolveBranchBusinessDateAsync(counterBranchId, request.WithdrawalDate);
            string? dateGuardErr = await ValidateTransactionDateGuardsAsync(counterBranchId, effDate);
            if (dateGuardErr != null)
            {
                return BadRequest(new { message = dateGuardErr });
            }
            if (homeBranchId != counterBranchId)
            {
                string? homeDateErr = await ValidateTransactionDateGuardsAsync(homeBranchId, effDate);
                if (homeDateErr != null)
                {
                    return BadRequest(new { message = homeDateErr });
                }
            }

            // 1. Verify Active Loan & Direct Lien Context
            var (hasDirectLien, directLoanId, directLoanNo, directLienAmt, activeLoanEntities, activeLoanDtos, totalLoanLiability, linkedMemberId) =
                await GetPigmyLoanAndLienContextAsync(account, effDate);

            string wdrModeNorm = (request.PaymentMode ?? "Cash").Trim();
            bool isLoanAdjust = request.AdjustInLoan || PigmySettlementHelper.IsLoanAdjustmentMode(wdrModeNorm);
            bool isWdrSavingTransfer = !isLoanAdjust && PigmySettlementHelper.IsSavingTransferMode(wdrModeNorm);
            bool isBankMode = !isLoanAdjust && BankLedgerHelper.IsBankPaymentMode(wdrModeNorm);
            bool isWdrCashMode = !isLoanAdjust && !isWdrSavingTransfer && !isBankMode &&
                                 (string.Equals(wdrModeNorm, "Cash", StringComparison.OrdinalIgnoreCase) || string.IsNullOrWhiteSpace(wdrModeNorm));

            if (!isLoanAdjust && !isWdrCashMode && !isWdrSavingTransfer && !isBankMode)
            {
                return BadRequest(new { message = $"अवैध पेमेंट पद्धत '{request.PaymentMode}'. कृपया रोख, बँक, बचत खाते वर्ग किंवा कर्ज समायोजन निवडा." });
            }

            if (hasDirectLien && !isLoanAdjust)
            {
                decimal freeBalance = Math.Max(0m, account.TotalDepositedAmount - directLienAmt);
                if (request.Amount > freeBalance + 0.001m)
                {
                    return BadRequest(new
                    {
                        error = "ACCOUNT_LIEN_MARKED",
                        message = $"सदर पिग्मी खात्यावर कर्ज खाते क्र. '{directLoanNo ?? "अज्ञात"}' चा तारण बोजा (Lien: ₹{directLienAmt:N2}) नोंदवला आहे. तारण मुक्त शिल्लक ₹{freeBalance:N2} आहे; त्यापेक्षा जास्त रक्कम काढण्यासाठी कृपया 'कर्ज खात्यात समायोजन (Adjust in Loan)' निवडा."
                    });
                }
            }

            bool hasActiveLoan = activeLoanDtos.Any(l => l.TotalOutstanding > 0);
            if (hasActiveLoan && !isLoanAdjust)
            {
                if (!request.ManagerOverrideConfirmed)
                {
                    return BadRequest(new
                    {
                        error = "ACTIVE_LOAN_LIEN",
                        message = $"सदर खातेदाराकडे एकूण ₹{totalLoanLiability:N2} चे सक्रिय कर्ज थकीत आहे. कृपया 'कर्ज खात्यात समायोजन' निवडा किंवा व्यवस्थापक विशेष संमती (Manager Override) द्या.",
                        activeLoans = activeLoanDtos
                    });
                }
                if (!CanPerformManagerOverride())
                {
                    return StatusCode(403, new
                    {
                        error = "MANAGER_OVERRIDE_FORBIDDEN",
                        message = "सक्रिय कर्ज थकीत असताना ओव्हरराईड करण्याची परवानगी फक्त शाखा व्यवस्थापक किंवा मुख्य कार्यालय अधिकाऱ्यांनाच आहे."
                    });
                }
            }

            // 2. Calculate Slab & Scheme-Method Interest
            DateTime effectiveMaturity = PigmyInterestCalculationService.ResolveEffectiveMaturityDate(account);
            DateTime cycleStart = (account.EffectiveStartDate ?? account.OpeningDate).Date;
            int elapsedDays = Math.Max(0, (int)(effDate - cycleStart).TotalDays);
            decimal elapsedMonths = Math.Round((decimal)elapsedDays / 30.416m, 2);
            bool isPremature = effDate < effectiveMaturity;

            var slabRes = PigmyInterestCalculationService.ResolveApplicableSlab(account.PigmyScheme, elapsedDays, isPremature);
            var appliedSlab = slabRes.MatchedSlab;
            decimal penaltyRate = slabRes.PenaltyRate;
            decimal interestRate = slabRes.InterestRate;

            decimal defaultPenalty = Math.Round(request.Amount * (penaltyRate / 100m), 2, MidpointRounding.AwayFromZero);
            decimal defaultInterest = PigmyInterestCalculationService.CalculateWithdrawalInterest(request.Amount, slabRes, elapsedDays);

            decimal penaltyAmount = request.CustomPenaltyAmount.HasValue
                ? Math.Round(request.CustomPenaltyAmount.Value, 2, MidpointRounding.AwayFromZero)
                : defaultPenalty;
            decimal interestAmount = request.CustomInterestAmount.HasValue
                ? Math.Round(request.CustomInterestAmount.Value, 2, MidpointRounding.AwayFromZero)
                : defaultInterest;

            if (penaltyAmount < 0m || interestAmount < 0m)
            {
                return BadRequest(new { message = "कपात / दंड किंवा व्याज रक्कम नकारात्मक (Negative) ठेवता येत नाही." });
            }

            if (penaltyAmount > request.Amount + interestAmount)
            {
                return BadRequest(new { message = $"कपात रक्कम (₹{penaltyAmount:N2}) काढायच्या मुद्दल + व्याज रकमेपेक्षा (₹{request.Amount + interestAmount:N2}) जास्त असू शकत नाही." });
            }

            bool isManualOverride = Math.Abs(penaltyAmount - defaultPenalty) > 0.009m ||
                                    Math.Abs(interestAmount - defaultInterest) > 0.009m;
            decimal netPaid = Math.Round(request.Amount - penaltyAmount + interestAmount, 2, MidpointRounding.AwayFromZero);
            decimal newBalance = Math.Max(0m, Math.Round(account.TotalDepositedAmount - request.Amount, 2, MidpointRounding.AwayFromZero));

            // 3. Validate ALL Dynamic GL Ledgers Upfront (ZERO Hardcoded Ledger Lookups!)
            var liabCheck = await ValidateDynamicPigmyLiabilityLedgerAsync(account.PigmyScheme);
            if (!liabCheck.IsValid || liabCheck.Ledger == null)
            {
                return BadRequest(new { message = liabCheck.ErrorMessage });
            }
            Ledger liabilityLedger = liabCheck.Ledger;

            Ledger? deductionLedger = null;
            if (penaltyAmount > 0m)
            {
                var dedCheck = await PigmySettlementHelper.ValidateDynamicDeductionLedgerAsync(
                    _context,
                    request.DeductionLedgerId,
                    account.PigmyScheme?.PrematureDeductionLedgerID);
                if (!dedCheck.IsValid || dedCheck.Ledger == null)
                {
                    return BadRequest(new { message = dedCheck.ErrorMessage });
                }
                deductionLedger = dedCheck.Ledger;
            }

            Ledger? interestDebitLedger = null;
            if (interestAmount > 0m)
            {
                string resolvedWdrIntMode = request.InterestDebitMode ?? "Auto";
                if (string.Equals(resolvedWdrIntMode, "Auto", StringComparison.OrdinalIgnoreCase))
                {
                    var (_, wdrProvisioned) = await GetPigmyPostedInterestContextAsync(account);
                    resolvedWdrIntMode = (wdrProvisioned >= interestAmount && (account.PigmyScheme?.InterestPayableLedgerID ?? 0) > 0)
                        ? "Provision"
                        : "Expense";
                }

                var intCheck = await PigmySettlementHelper.ValidateDynamicInterestDebitLedgerAsync(
                    _context,
                    request.InterestDebitLedgerId,
                    resolvedWdrIntMode,
                    account.PigmyScheme);
                if (!intCheck.IsValid || intCheck.Ledger == null)
                {
                    return BadRequest(new { message = intCheck.ErrorMessage });
                }
                interestDebitLedger = intCheck.Ledger;
            }

            // Validate Payment Mode Target Ledgers
            SavingAccountMaster? targetWdrSavingAcc = null;
            int targetWdrSavingLedgerId = 0;
            if (isWdrSavingTransfer && netPaid > 0m)
            {
                if (!request.SavingAccountId.HasValue || request.SavingAccountId.Value <= 0)
                {
                    return BadRequest(new { message = "पिग्मी विड्रॉल रक्कम वर्ग करण्यासाठी कृपया वैध सक्रिय बचत खाते निवडा." });
                }
                targetWdrSavingAcc = await _context.SavingAccountMasters.FindAsync(request.SavingAccountId.Value);
                if (targetWdrSavingAcc == null || targetWdrSavingAcc.Status == "Closed" || targetWdrSavingAcc.Status == "Frozen")
                {
                    return BadRequest(new { message = "निवडलेले बचत खाते सापडले नाही किंवा बंद/गोठवलेले आहे." });
                }
                targetWdrSavingLedgerId = await SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(_context, targetWdrSavingAcc);
                if (targetWdrSavingLedgerId <= 0)
                {
                    return BadRequest(new { message = SavingLedgerHelper.GetMissingMappingErrorMessage(targetWdrSavingAcc.AccountNo) });
                }
            }

            int resolvedBankLedgerId = 0;
            if (isBankMode && netPaid > 0m)
            {
                var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(_context, request.BankLedgerId);
                if (!bankCheck.IsValid)
                {
                    return BadRequest(new { message = bankCheck.ErrorMessage });
                }
                resolvedBankLedgerId = bankCheck.LedgerId;
            }

            LoanAccount? targetLoan = null;
            decimal loanAdjustAmount = 0m;
            decimal surplusPayoutAmount = 0m;
            string surplusMode = !string.IsNullOrWhiteSpace(request.SurplusPaymentMode) ? request.SurplusPaymentMode!.Trim() : "Cash";
            int surplusLedgerId = 0;

            if (isLoanAdjust)
            {
                LoanAccount? pledgedLoan = directLoanId.HasValue
                    ? activeLoanEntities.FirstOrDefault(l => l.LoanAccountID == directLoanId.Value)
                    : null;

                if (pledgedLoan != null && request.TargetLoanAccountId.HasValue && request.TargetLoanAccountId.Value > 0 &&
                    request.TargetLoanAccountId.Value != pledgedLoan.LoanAccountID)
                {
                    return BadRequest(new { message = $"सदर पिग्मी खाते कर्ज क्र. '{directLoanNo}' साठी तारण असल्याने प्रथम त्याच कर्ज खात्यात समायोजन करावे." });
                }

                int targetLoanId = request.TargetLoanAccountId ?? (pledgedLoan?.LoanAccountID ?? activeLoanEntities.FirstOrDefault()?.LoanAccountID ?? 0);
                if (targetLoanId <= 0)
                {
                    return BadRequest(new { message = "कृपया पिग्मी विड्रॉल रक्कम समायोजित करण्यासाठी सक्रिय कर्ज खाते निवडा." });
                }

                targetLoan = activeLoanEntities.FirstOrDefault(l => l.LoanAccountID == targetLoanId)
                    ?? await _context.LoanAccounts.Include(l => l.LoanRate).FirstOrDefaultAsync(l => l.LoanAccountID == targetLoanId && l.Status != "Closed");

                if (targetLoan == null)
                {
                    return BadRequest(new { message = "निवडलेले कर्ज खाते सापडले नाही किंवा ते बंद आहे." });
                }

                var (pendingLoanInt, _, _) = await CalculatePendingLoanInterestAsync(targetLoan, effDate);
                decimal targetLoanTotalDue = Math.Round(targetLoan.PrincipalBalance + targetLoan.InterestBalance + targetLoan.OverdueInterestBalance + pendingLoanInt, 2, MidpointRounding.AwayFromZero);
                decimal maxAdjustable = Math.Min(netPaid, targetLoanTotalDue);

                loanAdjustAmount = request.LoanAdjustmentAmount.HasValue && request.LoanAdjustmentAmount.Value > 0m
                    ? Math.Min(Math.Round(request.LoanAdjustmentAmount.Value, 2, MidpointRounding.AwayFromZero), maxAdjustable)
                    : maxAdjustable;

                if (loanAdjustAmount <= 0m)
                {
                    return BadRequest(new { message = "कर्ज समायोजन रक्कम ₹० पेक्षा जास्त असणे आवश्यक आहे." });
                }

                surplusPayoutAmount = Math.Max(0m, Math.Round(netPaid - loanAdjustAmount, 2, MidpointRounding.AwayFromZero));
                if (surplusPayoutAmount > 0m)
                {
                    if (BankLedgerHelper.IsBankPaymentMode(surplusMode))
                    {
                        var sBank = await BankLedgerHelper.ValidateBankLedgerAsync(_context, request.SurplusBankLedgerId);
                        if (!sBank.IsValid) return BadRequest(new { message = sBank.ErrorMessage });
                        surplusLedgerId = sBank.LedgerId;
                    }
                    else if (PigmySettlementHelper.IsSavingTransferMode(surplusMode))
                    {
                        if (!request.SurplusSavingAccountId.HasValue || request.SurplusSavingAccountId.Value <= 0)
                        {
                            return BadRequest(new { message = "उर्वरित शिल्लक बचत खात्यात वर्ग करण्यासाठी सक्रिय बचत खाते निवडा." });
                        }
                        var sSav = await _context.SavingAccountMasters.FindAsync(request.SurplusSavingAccountId.Value);
                        if (sSav == null || sSav.Status == "Closed" || sSav.Status == "Frozen")
                        {
                            return BadRequest(new { message = "शिल्लक परताव्यासाठी निवडलेले बचत खाते सापडले नाही किंवा बंद आहे." });
                        }
                        surplusLedgerId = await SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(_context, sSav);
                        if (surplusLedgerId <= 0)
                        {
                            return BadRequest(new { message = SavingLedgerHelper.GetMissingMappingErrorMessage(sSav.AccountNo) });
                        }
                    }
                    else if (string.Equals(surplusMode, "Cash", StringComparison.OrdinalIgnoreCase))
                    {
                        var cashCheck = await ValidateBranchCashLedgerAsync(homeBranchId);
                        if (!cashCheck.IsValid || cashCheck.Ledger == null)
                        {
                            return BadRequest(new { message = cashCheck.ErrorMessage });
                        }
                        surplusLedgerId = cashCheck.Ledger.LedgerID;
                    }
                    else
                    {
                        return BadRequest(new { message = $"शिल्लक परताव्यासाठी अवैध पेमेंट माध्यम '{surplusMode}'." });
                    }
                }
            }

            string refNote = !string.IsNullOrWhiteSpace(request.ReferenceNo) ? $" [Ref/UTR: {request.ReferenceNo.Trim()}]" : "";
            string penaltyNotice = penaltyAmount > 0 ? $" (कपात: ₹{penaltyAmount:N2})" : "";
            string manualNotice = isManualOverride && !string.IsNullOrWhiteSpace(request.OverrideReason)
                ? $" [बदल कारण: {request.OverrideReason.Trim()}]"
                : "";

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var todayStr = effDate.ToString("yyyyMMdd");
                var lastVoucher = await _context.Vouchers.OrderByDescending(v => v.VoucherID).FirstOrDefaultAsync();
                int nextSeq = (lastVoucher?.VoucherID ?? 0) + 1;

                int primaryVoucherId;
                string finalVoucherNo;
                int? linkedLoanCollectionId = null;

                if (isLoanAdjust && targetLoan != null)
                {
                    var (settledLoan, loanColl, prinPaid, intPaid, penPaid) = await ProcessPigmyLoanSettlementAsync(
                        targetLoan.LoanAccountID,
                        loanAdjustAmount,
                        effDate,
                        account,
                        "PARTIAL",
                        account.TotalDepositedAmount,
                        newBalance,
                        homeBranchId,
                        userId);

                    var loanRate = settledLoan.LoanRate ?? await _context.LoanRates.FindAsync(settledLoan.LoanRateID);
                    int loanLedgerId = loanRate?.LoanLedgerID ?? 0;
                    int loanInterestLedgerId = loanRate?.InterestLedgerID ?? 0;
                    int loanOverdueLedgerId = (loanRate?.OverdueInterestLedgerID ?? 0) > 0 ? loanRate!.OverdueInterestLedgerID!.Value : loanInterestLedgerId;

                    if (prinPaid > 0 && loanLedgerId <= 0)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = "कर्ज योजनेचे मुद्दल जी.एल. लेजर (Loan Principal Ledger) मॅप केलेले नाही." });
                    }
                    if (intPaid > 0 && loanInterestLedgerId <= 0)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = "कर्ज योजनेचे व्याज जी.एल. लेजर (Loan Interest Ledger) मॅप केलेले नाही." });
                    }
                    if (penPaid > 0 && loanOverdueLedgerId <= 0)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = "कर्ज योजनेचे दंड व्याज जी.एल. लेजर (Loan Overdue Ledger) मॅप केलेले नाही." });
                    }

                    if (settledLoan.Status == "Closed" && hasDirectLien && directLoanId == settledLoan.LoanAccountID)
                    {
                        var collaterals = await _context.LoanDepositCollaterals
                            .Where(c => (c.CollateralType == "Pigmy" || c.CollateralType == "PigmyDeposit") &&
                                        c.DepositAccountID == account.PigmyAccountID &&
                                        c.LienStatus != "Released")
                            .ToListAsync();
                        foreach (var col in collaterals)
                        {
                            col.LienStatus = "Released";
                            col.LienReleasedDate = effDate;
                            col.CurrentDepositBalance = newBalance;
                        }
                        account.IsLienMarked = false;
                    }

                    var jvDetails = new List<VoucherDetail>
                    {
                        new VoucherDetail
                        {
                            LedgerID = liabilityLedger.LedgerID,
                            CustomerID = account.CustomerID,
                            MemberID = linkedMemberId,
                            DrCr = "Dr",
                            Amount = request.Amount
                        }
                    };

                    if (interestAmount > 0 && interestDebitLedger != null)
                    {
                        jvDetails.Add(new VoucherDetail
                        {
                            LedgerID = interestDebitLedger.LedgerID,
                            CustomerID = account.CustomerID,
                            MemberID = linkedMemberId,
                            DrCr = "Dr",
                            Amount = interestAmount
                        });
                    }

                    if (penaltyAmount > 0 && deductionLedger != null)
                    {
                        jvDetails.Add(new VoucherDetail
                        {
                            LedgerID = deductionLedger.LedgerID,
                            CustomerID = account.CustomerID,
                            MemberID = linkedMemberId,
                            DrCr = "Cr",
                            Amount = penaltyAmount
                        });
                    }

                    if (prinPaid > 0)
                    {
                        jvDetails.Add(new VoucherDetail
                        {
                            LedgerID = loanLedgerId,
                            CustomerID = settledLoan.CustomerID,
                            MemberID = settledLoan.MemberID,
                            DrCr = "Cr",
                            Amount = prinPaid
                        });
                    }
                    if (intPaid > 0)
                    {
                        jvDetails.Add(new VoucherDetail
                        {
                            LedgerID = loanInterestLedgerId,
                            CustomerID = settledLoan.CustomerID,
                            MemberID = settledLoan.MemberID,
                            DrCr = "Cr",
                            Amount = intPaid
                        });
                    }
                    if (penPaid > 0)
                    {
                        jvDetails.Add(new VoucherDetail
                        {
                            LedgerID = loanOverdueLedgerId,
                            CustomerID = settledLoan.CustomerID,
                            MemberID = settledLoan.MemberID,
                            DrCr = "Cr",
                            Amount = penPaid
                        });
                    }
                    if (surplusPayoutAmount > 0 && surplusLedgerId > 0)
                    {
                        jvDetails.Add(new VoucherDetail
                        {
                            LedgerID = surplusLedgerId,
                            CustomerID = account.CustomerID,
                            MemberID = linkedMemberId,
                            DrCr = "Cr",
                            Amount = surplusPayoutAmount
                        });
                    }

                    var jv = new Voucher
                    {
                        BranchID = homeBranchId,
                        VoucherNo = $"JV-WDR-LN-{todayStr}-{nextSeq:D4}",
                        VoucherDate = effDate,
                        VoucherType = "Journal",
                        Status = "Pending",
                        TotalAmount = request.Amount + interestAmount,
                        Narration = $"पिग्मी अंशतः विड्रॉल व कर्ज समायोजन खाते {account.AccountNo} -> कर्ज {settledLoan.LoanAccountNo} (कर्ज जमा: ₹{loanAdjustAmount:N2}, शिल्लक: ₹{surplusPayoutAmount:N2}){penaltyNotice}{manualNotice}{refNote} {request.Narration}".Trim(),
                        CreatedBy = userId,
                        CreatedOn = DateTime.Now,
                        VoucherDetails = jvDetails
                    };
                    _context.Vouchers.Add(jv);
                    await _context.SaveChangesAsync();
                    await VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, jv.VoucherID, jv.VoucherNo);

                    loanColl.VoucherID = jv.VoucherID;
                    linkedLoanCollectionId = loanColl.LoanCollectionID;
                    primaryVoucherId = jv.VoucherID;
                    finalVoucherNo = jv.VoucherNo;
                }
                else
                {
                    Ledger payoutCreditLedger;
                    if (isWdrSavingTransfer && targetWdrSavingAcc != null && targetWdrSavingLedgerId > 0)
                    {
                        payoutCreditLedger = (await _context.Ledgers.FindAsync(targetWdrSavingLedgerId))!;
                        counterBranchId = targetWdrSavingAcc.BranchID > 0 ? targetWdrSavingAcc.BranchID : homeBranchId;
                    }
                    else if (isBankMode && resolvedBankLedgerId > 0)
                    {
                        payoutCreditLedger = (await _context.Ledgers.FindAsync(resolvedBankLedgerId))!;
                    }
                    else
                    {
                        var cashCheck = await ValidateBranchCashLedgerAsync(counterBranchId);
                        if (!cashCheck.IsValid || cashCheck.Ledger == null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(new { message = cashCheck.ErrorMessage });
                        }
                        payoutCreditLedger = cashCheck.Ledger;
                    }

                    bool isCrossBranchTxn = (counterBranchId != homeBranchId);
                    if (!isCrossBranchTxn)
                    {
                        var voucherDetails = new List<VoucherDetail>
                        {
                            new VoucherDetail
                            {
                                LedgerID = liabilityLedger.LedgerID,
                                CustomerID = account.CustomerID,
                                MemberID = linkedMemberId,
                                DrCr = "Dr",
                                Amount = request.Amount
                            }
                        };

                        if (netPaid > 0m)
                        {
                            voucherDetails.Add(new VoucherDetail
                            {
                                LedgerID = payoutCreditLedger.LedgerID,
                                CustomerID = account.CustomerID,
                                MemberID = linkedMemberId,
                                DrCr = "Cr",
                                Amount = netPaid
                            });
                        }

                        if (penaltyAmount > 0m && deductionLedger != null)
                        {
                            voucherDetails.Add(new VoucherDetail
                            {
                                LedgerID = deductionLedger.LedgerID,
                                CustomerID = account.CustomerID,
                                MemberID = linkedMemberId,
                                DrCr = "Cr",
                                Amount = penaltyAmount
                            });
                        }

                        if (interestAmount > 0m && interestDebitLedger != null)
                        {
                            voucherDetails.Add(new VoucherDetail
                            {
                                LedgerID = interestDebitLedger.LedgerID,
                                CustomerID = account.CustomerID,
                                MemberID = linkedMemberId,
                                DrCr = "Dr",
                                Amount = interestAmount
                            });
                        }

                        var voucher = new Voucher
                        {
                            BranchID = homeBranchId,
                            VoucherNo = $"VCH-WDR-{todayStr}-{nextSeq:D4}",
                            VoucherDate = effDate,
                            VoucherType = (isWdrSavingTransfer || netPaid <= 0m) ? "Journal" : "Payment",
                            Status = "Pending",
                            TotalAmount = request.Amount + interestAmount,
                            Narration = $"पिग्मी अंशतः विड्रॉल (सायकल #{account.CurrentCycleNumber}) खाते {account.AccountNo} - {account.Customer?.FirstName}.{penaltyNotice}{manualNotice}{refNote} {request.Narration}".Trim(),
                            CreatedBy = userId,
                            CreatedOn = DateTime.Now,
                            VoucherDetails = voucherDetails
                        };
                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();
                        await VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, voucher.VoucherID, voucher.VoucherNo);

                        primaryVoucherId = voucher.VoucherID;
                        finalVoucherNo = voucher.VoucherNo;
                    }
                    else
                    {
                        var (counterIbtLedgerId, homeIbtLedgerId) = await IbtLedgerHelper.GetDirectionalPairIbtLedgerIdsAsync(_context, counterBranchId, homeBranchId);

                        var counterVoucher = new Voucher
                        {
                            BranchID = counterBranchId,
                            VoucherNo = $"PV-{counterBranchId}-{todayStr}-PIGMY-WDR-{nextSeq:D4}",
                            VoucherDate = effDate,
                            VoucherType = isWdrSavingTransfer ? "Journal" : "Payment",
                            Status = "Pending",
                            TotalAmount = netPaid,
                            Narration = $"[आंतर-शाखा पिग्मी विड्रॉल] खाते: {account.AccountNo} (मूळ शाखा #{homeBranchId}) परतावा.{penaltyNotice}{manualNotice} {request.Narration}".Trim(),
                            CreatedBy = userId,
                            CreatedOn = DateTime.Now,
                            IsIbtVoucher = true,
                            TargetBranchID = homeBranchId
                        };
                        _context.Vouchers.Add(counterVoucher);
                        await _context.SaveChangesAsync();

                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = counterVoucher.VoucherID,
                            LedgerID = counterIbtLedgerId,
                            CustomerID = account.CustomerID,
                            DrCr = "Dr",
                            Amount = netPaid
                        });
                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = counterVoucher.VoucherID,
                            LedgerID = payoutCreditLedger.LedgerID,
                            CustomerID = account.CustomerID,
                            DrCr = "Cr",
                            Amount = netPaid
                        });

                        var homeVoucher = new Voucher
                        {
                            BranchID = homeBranchId,
                            VoucherNo = $"JV-PIGMY-WDR-{todayStr}-{nextSeq:D4}",
                            VoucherDate = effDate,
                            VoucherType = "Journal",
                            Status = "Pending",
                            TotalAmount = request.Amount + interestAmount,
                            Narration = $"[आंतर-शाखा पिग्मी विड्रॉल] काऊंटर शाखा #{counterBranchId} वरून विड्रॉल (सायकल #{account.CurrentCycleNumber}, खाते: {account.AccountNo}).{penaltyNotice}{manualNotice} {request.Narration}".Trim(),
                            CreatedBy = userId,
                            CreatedOn = DateTime.Now,
                            IsIbtVoucher = true,
                            TargetBranchID = counterBranchId,
                            RelatedVoucherID = counterVoucher.VoucherID
                        };
                        _context.Vouchers.Add(homeVoucher);
                        await _context.SaveChangesAsync();

                        counterVoucher.RelatedVoucherID = homeVoucher.VoucherID;

                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = homeVoucher.VoucherID,
                            LedgerID = liabilityLedger.LedgerID,
                            CustomerID = account.CustomerID,
                            DrCr = "Dr",
                            Amount = request.Amount
                        });

                        if (interestAmount > 0m && interestDebitLedger != null)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail
                            {
                                VoucherID = homeVoucher.VoucherID,
                                LedgerID = interestDebitLedger.LedgerID,
                                CustomerID = account.CustomerID,
                                DrCr = "Dr",
                                Amount = interestAmount
                            });
                        }

                        if (penaltyAmount > 0m && deductionLedger != null)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail
                            {
                                VoucherID = homeVoucher.VoucherID,
                                LedgerID = deductionLedger.LedgerID,
                                CustomerID = account.CustomerID,
                                DrCr = "Cr",
                                Amount = penaltyAmount
                            });
                        }

                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = homeVoucher.VoucherID,
                            LedgerID = homeIbtLedgerId,
                            CustomerID = account.CustomerID,
                            DrCr = "Cr",
                            Amount = netPaid
                        });

                        await _context.SaveChangesAsync();
                        await VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, counterVoucher.VoucherID, counterVoucher.VoucherNo);
                        await VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, homeVoucher.VoucherID, homeVoucher.VoucherNo);

                        primaryVoucherId = counterVoucher.VoucherID;
                        finalVoucherNo = counterVoucher.VoucherNo;
                    }
                }

                // NOTE: Saving Account balance credit is DEFERRED until Checker Approval in VoucherPostingController!
                var withdrawalRecord = new PigmyWithdrawal
                {
                    PigmyAccountID = account.PigmyAccountID,
                    WithdrawalDate = effDate,
                    CycleNumber = account.CurrentCycleNumber,
                    CycleStartSnapshot = cycleStart,
                    ElapsedDays = elapsedDays,
                    ElapsedMonths = elapsedMonths,
                    RequestedAmount = request.Amount,
                    AppliedSlabID = appliedSlab?.SlabID,
                    PenaltyRate = penaltyRate,
                    PenaltyAmount = penaltyAmount,
                    InterestRate = interestRate,
                    InterestAmount = interestAmount,
                    NetPaidAmount = netPaid,
                    RemainingBalance = newBalance,
                    VoucherID = primaryVoucherId,
                    VoucherNo = finalVoucherNo,
                    PaymentMode = isLoanAdjust ? "Adjust in Loan" : (isWdrSavingTransfer ? "Saving Transfer" : (isBankMode ? "Bank" : "Cash")),
                    BankLedgerID = isBankMode ? resolvedBankLedgerId : null,
                    SavingAccountID = isWdrSavingTransfer ? request.SavingAccountId : null,
                    ReferenceNo = !string.IsNullOrWhiteSpace(request.ReferenceNo) ? request.ReferenceNo.Trim() : null,
                    AdjustInLoan = isLoanAdjust,
                    TargetLoanAccountID = isLoanAdjust ? targetLoan?.LoanAccountID : null,
                    LoanAdjustedAmount = isLoanAdjust ? loanAdjustAmount : 0m,
                    LinkedLoanCollectionID = linkedLoanCollectionId,
                    SurplusPayoutAmount = isLoanAdjust ? surplusPayoutAmount : 0m,
                    SurplusPaymentMode = isLoanAdjust && surplusPayoutAmount > 0m ? surplusMode : null,
                    SurplusBankLedgerID = isLoanAdjust && surplusPayoutAmount > 0m && BankLedgerHelper.IsBankPaymentMode(surplusMode) ? request.SurplusBankLedgerId : null,
                    SurplusSavingAccountID = isLoanAdjust && surplusPayoutAmount > 0m && PigmySettlementHelper.IsSavingTransferMode(surplusMode) ? request.SurplusSavingAccountId : null,
                    DeductionLedgerID = deductionLedger?.LedgerID,
                    InterestDebitLedgerID = interestDebitLedger?.LedgerID,
                    IsManualOverride = isManualOverride,
                    OverrideReason = !string.IsNullOrWhiteSpace(request.OverrideReason) ? request.OverrideReason.Trim() : null,
                    Narration = request.Narration,
                    CreatedBy = userId,
                    CreatedDate = DateTime.UtcNow
                };
                _context.PigmyWithdrawals.Add(withdrawalRecord);

                int oldCycle = account.CurrentCycleNumber;
                int newCycle = oldCycle + 1;
                string txNarration = $"अंशतः विड्रॉल ₹{request.Amount:N2} (सायकल #{oldCycle} पूर्ण) | उर्वरित ₹{newBalance:N2} (सायकल #{newCycle} सुरू: {effDate:dd/MM/yyyy})";
                if (txNarration.Length > 250) txNarration = txNarration.Substring(0, 250);

                _context.PigmyTransactions.Add(new PigmyTransaction
                {
                    PigmyAccountID = account.PigmyAccountID,
                    TransactionDate = effDate,
                    ValueDate = effDate,
                    TransactionType = "WITHDRAWAL",
                    DrAmount = request.Amount,
                    CrAmount = 0,
                    BalanceAmount = newBalance,
                    Narration = txNarration,
                    ReferenceId = finalVoucherNo,
                    MakerId = userId,
                    PostedOn = DateTime.Now
                });

                account.TotalDepositedAmount = newBalance;
                account.TotalWithdrawnAmount = Math.Round(account.TotalWithdrawnAmount + request.Amount, 2, MidpointRounding.AwayFromZero);
                account.LastWithdrawalDate = effDate;
                account.EffectiveStartDate = effDate;
                account.CurrentCycleNumber = newCycle;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    message = $"विड्रॉल नोंद यशस्वी! व्हाउचर चेकर मंजुरीसाठी पाठवले असून उर्वरित ₹{newBalance:N2} साठी सायकल #{newCycle} सुरू झाली आहे.",
                    voucherId = primaryVoucherId,
                    voucherNo = finalVoucherNo,
                    withdrawnAmount = request.Amount,
                    penaltyAmount = penaltyAmount,
                    interestAmount = interestAmount,
                    loanAdjustedAmount = loanAdjustAmount,
                    surplusPayoutAmount = surplusPayoutAmount,
                    netPaid = netPaid,
                    remainingBalance = newBalance,
                    newCycleNumber = newCycle,
                    effectiveStartDate = account.EffectiveStartDate?.ToString("yyyy-MM-dd"),
                    fixedMaturityDate = account.MaturityDate.ToString("yyyy-MM-dd")
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { message = "विड्रॉल प्रक्रिया पूर्ण करताना त्रुटी आली: " + ex.Message });
            }
        }

        // GET: api/PigmyClosure/WithdrawalsHistory/{accountNo}
        [HttpGet("WithdrawalsHistory/{accountNo}")]
        public async Task<ActionResult<IEnumerable<object>>> GetWithdrawalsHistory(string accountNo, [FromQuery] int? branchId = null)
        {
            var account = await FindPigmyAccountForBranchAsync(accountNo, branchId, includeDetails: false);
            if (account == null) return NotFound(new { message = "खाते सापडले नाही." });
            if (!User.CanAccessBranch(account.BranchID)) return Forbid();

            var history = await _context.PigmyWithdrawals
                .Include(w => w.AppliedSlab)
                .Include(w => w.DeductionLedger)
                .Where(w => w.PigmyAccountID == account.PigmyAccountID)
                .OrderByDescending(w => w.WithdrawalDate)
                .ThenByDescending(w => w.WithdrawalID)
                .Select(w => new
                {
                    w.WithdrawalID,
                    w.WithdrawalDate,
                    w.CycleNumber,
                    w.CycleStartSnapshot,
                    w.ElapsedDays,
                    w.ElapsedMonths,
                    w.RequestedAmount,
                    w.PenaltyRate,
                    w.PenaltyAmount,
                    w.InterestRate,
                    w.InterestAmount,
                    w.NetPaidAmount,
                    w.RemainingBalance,
                    w.PaymentMode,
                    w.AdjustInLoan,
                    w.LoanAdjustedAmount,
                    w.SurplusPayoutAmount,
                    w.VoucherID,
                    w.VoucherNo,
                    w.Narration,
                    DeductionLedgerName = w.DeductionLedger != null ? w.DeductionLedger.LedgerName : "",
                    SlabDescription = w.AppliedSlab != null ? w.AppliedSlab.SlabDescription : ""
                })
                .ToListAsync();

            return Ok(history);
        }

        // POST: api/PigmyClosure/Close
        [HttpPost("Close")]
        public async Task<IActionResult> CloseAccount([FromBody] ClosureRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.AccountNo))
            {
                return BadRequest(new { message = "कृपया वैध पिग्मी खाते क्रमांक निवडा." });
            }

            var account = await FindPigmyAccountForBranchAsync(request.AccountNo, request.BranchId > 0 ? request.BranchId : null, includeDetails: true);

            if (account == null) return NotFound(new { message = "पिग्मी खाते सापडले नाही (Account not found)." });
            if (!User.CanAccessBranch(account.BranchID)) return Forbid();
            if (account.Status == "Closed") return BadRequest(new { message = "सदर पिग्मी खाते आधीच बंद (Closed) करण्यात आले आहे." });

            string? pendingErr = await CheckPendingSettlementVoucherAsync(account.PigmyAccountID);
            if (pendingErr != null)
            {
                return BadRequest(new { message = pendingErr });
            }

            int userId = ResolveCurrentUserId();
            int userBranchId = User.GetOperatingBranchId();
            int counterBranchId = userBranchId > 0 ? userBranchId : (request.BranchId > 0 ? request.BranchId : (account.BranchID > 0 ? account.BranchID : 1));
            int homeBranchId = account.BranchID > 0 ? account.BranchID : 1;

            DateTime effClosureDate = await ResolveBranchBusinessDateAsync(counterBranchId, request.ClosureDate);
            string? dateGuardErr = await ValidateTransactionDateGuardsAsync(counterBranchId, effClosureDate);
            if (dateGuardErr != null)
            {
                return BadRequest(new { message = dateGuardErr });
            }
            if (homeBranchId != counterBranchId)
            {
                string? homeDateErr = await ValidateTransactionDateGuardsAsync(homeBranchId, effClosureDate);
                if (homeDateErr != null)
                {
                    return BadRequest(new { message = homeDateErr });
                }
            }

            // 1. Verify Active Loan & Direct Lien Context
            var (hasDirectLien, directLoanId, directLoanNo, directLienAmt, activeLoanEntities, activeLoanDtos, totalLoanLiability, linkedMemberId) =
                await GetPigmyLoanAndLienContextAsync(account, effClosureDate);

            string cloModeNorm = (request.PaymentMode ?? "Cash").Trim();
            bool isLoanAdjust = request.AdjustInLoan || PigmySettlementHelper.IsLoanAdjustmentMode(cloModeNorm);
            bool isCloSavingTransfer = !isLoanAdjust && PigmySettlementHelper.IsSavingTransferMode(cloModeNorm);
            bool isBankMode = !isLoanAdjust && BankLedgerHelper.IsBankPaymentMode(cloModeNorm);
            bool isCloCashMode = !isLoanAdjust && !isCloSavingTransfer && !isBankMode &&
                                 (string.Equals(cloModeNorm, "Cash", StringComparison.OrdinalIgnoreCase) || string.IsNullOrWhiteSpace(cloModeNorm));

            if (!isLoanAdjust && !isCloCashMode && !isCloSavingTransfer && !isBankMode)
            {
                return BadRequest(new { message = $"अवैध पेमेंट पद्धत '{request.PaymentMode}'. कृपया रोख, बँक, बचत खाते वर्ग किंवा कर्ज समायोजन निवडा." });
            }

            if (hasDirectLien && !isLoanAdjust)
            {
                return BadRequest(new
                {
                    error = "ACCOUNT_LIEN_MARKED",
                    message = $"सदर पिग्मी खात्यावर कर्ज खाते क्र. '{directLoanNo ?? "अज्ञात"}' चा तारण बोजा (Lien: ₹{directLienAmt:N2}) नोंदवला आहे. खाते बंद करताना कृपया पेमेंट माध्यमामधून 'कर्ज खात्यात समायोजन (Adjust in Loan)' निवडा."
                });
            }

            bool hasActiveLoan = activeLoanDtos.Any(l => l.TotalOutstanding > 0);
            if (hasActiveLoan && !isLoanAdjust)
            {
                if (!request.ManagerOverrideConfirmed)
                {
                    return BadRequest(new
                    {
                        error = "ACTIVE_LOAN_LIEN",
                        message = $"सदर खातेदाराकडे एकूण ₹{totalLoanLiability:N2} चे सक्रिय कर्ज थकीत आहे. कृपया 'कर्ज खात्यात समायोजन' निवडा किंवा व्यवस्थापक विशेष संमती (Manager Override) द्या.",
                        activeLoans = activeLoanDtos
                    });
                }
                if (!CanPerformManagerOverride())
                {
                    return StatusCode(403, new
                    {
                        error = "MANAGER_OVERRIDE_FORBIDDEN",
                        message = "सक्रिय कर्ज थकीत असताना ओव्हरराईड करण्याची परवानगी फक्त शाखा व्यवस्थापक किंवा मुख्य कार्यालय अधिकाऱ्यांनाच आहे."
                    });
                }
            }

            // 2. Compute Final Cycle Tenure, Scheme-Method Interest, Double-Interest Guard & Dynamic Overrides
            DateTime effectiveMaturity = PigmyInterestCalculationService.ResolveEffectiveMaturityDate(account);
            bool isPremature = effClosureDate < effectiveMaturity;
            DateTime cycleStart = (account.EffectiveStartDate ?? account.OpeningDate).Date;
            int tenureDaysInCycle = Math.Max(0, (int)(effClosureDate - cycleStart).TotalDays);
            decimal tenureMonthsInCycle = Math.Round((decimal)tenureDaysInCycle / 30.416m, 2);

            var slabRes = PigmyInterestCalculationService.ResolveApplicableSlab(account.PigmyScheme, tenureDaysInCycle, isPremature);
            var appliedSlab = slabRes.MatchedSlab;
            decimal penaltyRate = slabRes.PenaltyRate;
            decimal interestRate = slabRes.InterestRate;
            string policyNote = slabRes.PolicyNote;

            var (alreadyCapitalized, verifiedProvisioned) = await GetPigmyPostedInterestContextAsync(account);

            decimal grossBalance = account.TotalDepositedAmount;
            decimal principalBaseForInterest = Math.Max(0m, grossBalance - alreadyCapitalized);
            decimal defaultPenalty = Math.Round(grossBalance * (penaltyRate / 100m), 2, MidpointRounding.AwayFromZero);
            decimal grossSlabInterest = await PigmyInterestCalculationService.CalculateClosureOrPeriodInterestAsync(
                _context,
                account,
                principalBaseForInterest,
                slabRes,
                cycleStart,
                effClosureDate);
            decimal defaultAdditionalInterest = Math.Max(0m, Math.Round(grossSlabInterest - alreadyCapitalized, 2, MidpointRounding.AwayFromZero));

            decimal penaltyAmount = request.CustomPenaltyAmount.HasValue
                ? Math.Round(request.CustomPenaltyAmount.Value, 2, MidpointRounding.AwayFromZero)
                : defaultPenalty;
            decimal interestAmount = request.CustomInterestAmount.HasValue
                ? Math.Round(request.CustomInterestAmount.Value, 2, MidpointRounding.AwayFromZero)
                : defaultAdditionalInterest;

            if (penaltyAmount < 0m || interestAmount < 0m)
            {
                return BadRequest(new { message = "कपात / दंड किंवा व्याज रक्कम नकारात्मक (Negative) ठेवता येत नाही." });
            }

            if (penaltyAmount > grossBalance + interestAmount)
            {
                return BadRequest(new { message = $"कपात रक्कम (₹{penaltyAmount:N2}) एकूण जमा + व्याज रकमेपेक्षा (₹{grossBalance + interestAmount:N2}) जास्त असू शकत नाही." });
            }

            bool isManualOverride = Math.Abs(penaltyAmount - defaultPenalty) > 0.009m ||
                                    Math.Abs(interestAmount - defaultAdditionalInterest) > 0.009m;
            decimal netPayable = Math.Round(grossBalance - penaltyAmount + interestAmount, 2, MidpointRounding.AwayFromZero);

            if (grossBalance <= 0m && interestAmount <= 0m)
            {
                string prevZeroStatus = account.Status;
                account.Status = "Closed";
                _context.PigmyAccountClosures.Add(new PigmyAccountClosure
                {
                    PigmyAccountID = account.PigmyAccountID,
                    BranchID = homeBranchId,
                    ClosureDate = effClosureDate,
                    IsPremature = isPremature,
                    CycleNumber = account.CurrentCycleNumber,
                    CycleStartSnapshot = cycleStart,
                    ElapsedDays = tenureDaysInCycle,
                    GrossDepositBalance = 0m,
                    NetPayableAmount = 0m,
                    PaymentMode = "Cash",
                    PreviousAccountStatus = prevZeroStatus,
                    Narration = request.Narration,
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();
                return Ok(new { message = "शून्य शिल्लक असलेले पिग्मी खाते यशस्वीरीत्या बंद करण्यात आले.", netPayable = 0m });
            }

            // 3. Validate ALL Dynamic GL Ledgers Upfront (ZERO Hardcoded Ledger Lookups!)
            var liabCheck = await ValidateDynamicPigmyLiabilityLedgerAsync(account.PigmyScheme);
            if (!liabCheck.IsValid || liabCheck.Ledger == null)
            {
                return BadRequest(new { message = liabCheck.ErrorMessage });
            }
            Ledger liabilityLedger = liabCheck.Ledger;

            Ledger? deductionLedger = null;
            if (penaltyAmount > 0m)
            {
                var dedCheck = await PigmySettlementHelper.ValidateDynamicDeductionLedgerAsync(
                    _context,
                    request.DeductionLedgerId,
                    account.PigmyScheme?.PrematureDeductionLedgerID);
                if (!dedCheck.IsValid || dedCheck.Ledger == null)
                {
                    return BadRequest(new { message = dedCheck.ErrorMessage });
                }
                deductionLedger = dedCheck.Ledger;
            }

            string resolvedCloIntMode = request.InterestDebitMode ?? "Auto";
            if (string.Equals(resolvedCloIntMode, "Auto", StringComparison.OrdinalIgnoreCase))
            {
                resolvedCloIntMode = (verifiedProvisioned >= interestAmount && (account.PigmyScheme?.InterestPayableLedgerID ?? 0) > 0)
                    ? "Provision"
                    : "Expense";
            }

            Ledger? interestDebitLedger = null;
            if (interestAmount > 0m)
            {
                var intCheck = await PigmySettlementHelper.ValidateDynamicInterestDebitLedgerAsync(
                    _context,
                    request.InterestDebitLedgerId,
                    resolvedCloIntMode,
                    account.PigmyScheme);
                if (!intCheck.IsValid || intCheck.Ledger == null)
                {
                    return BadRequest(new { message = intCheck.ErrorMessage });
                }
                interestDebitLedger = intCheck.Ledger;
            }

            SavingAccountMaster? targetCloSavingAcc = null;
            int targetCloSavingLedgerId = 0;
            if (isCloSavingTransfer && netPayable > 0m)
            {
                if (!request.SavingAccountId.HasValue || request.SavingAccountId.Value <= 0)
                {
                    return BadRequest(new { message = "पिग्मी परतावा रक्कम वर्ग करण्यासाठी कृपया वैध सक्रिय बचत खाते निवडा." });
                }
                targetCloSavingAcc = await _context.SavingAccountMasters.FindAsync(request.SavingAccountId.Value);
                if (targetCloSavingAcc == null || targetCloSavingAcc.Status == "Closed" || targetCloSavingAcc.Status == "Frozen")
                {
                    return BadRequest(new { message = "निवडलेले बचत खाते सापडले नाही किंवा बंद/गोठवलेले आहे." });
                }
                targetCloSavingLedgerId = await SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(_context, targetCloSavingAcc);
                if (targetCloSavingLedgerId <= 0)
                {
                    return BadRequest(new { message = SavingLedgerHelper.GetMissingMappingErrorMessage(targetCloSavingAcc.AccountNo) });
                }
            }

            int resolvedBankLedgerId = 0;
            if (isBankMode && netPayable > 0m)
            {
                var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(_context, request.BankLedgerId);
                if (!bankCheck.IsValid)
                {
                    return BadRequest(new { message = bankCheck.ErrorMessage });
                }
                resolvedBankLedgerId = bankCheck.LedgerId;
            }

            LoanAccount? targetLoan = null;
            decimal loanAdjustAmount = 0m;
            decimal surplusPayoutAmount = 0m;
            string surplusMode = !string.IsNullOrWhiteSpace(request.SurplusPaymentMode) ? request.SurplusPaymentMode!.Trim() : "Cash";
            int surplusLedgerId = 0;

            if (isLoanAdjust)
            {
                LoanAccount? pledgedActiveLoan = directLoanId.HasValue
                    ? activeLoanEntities.FirstOrDefault(l => l.LoanAccountID == directLoanId.Value)
                    : null;

                if (pledgedActiveLoan != null && request.TargetLoanAccountId.HasValue && request.TargetLoanAccountId.Value > 0 &&
                    request.TargetLoanAccountId.Value != pledgedActiveLoan.LoanAccountID)
                {
                    return BadRequest(new { message = $"सदर पिग्मी खाते कर्ज क्र. '{directLoanNo}' साठी तारण असल्याने प्रथम त्याच कर्ज खात्यात समायोजन करणे बंधनकारक आहे." });
                }

                int targetLoanId = request.TargetLoanAccountId ?? (pledgedActiveLoan?.LoanAccountID ?? activeLoanEntities.FirstOrDefault()?.LoanAccountID ?? 0);
                if (targetLoanId <= 0)
                {
                    return BadRequest(new { message = "कृपया पिग्मी क्लोजर परतावा वर्ग करण्यासाठी सक्रिय कर्ज खाते निवडा." });
                }

                targetLoan = activeLoanEntities.FirstOrDefault(l => l.LoanAccountID == targetLoanId)
                    ?? await _context.LoanAccounts.Include(l => l.LoanRate).FirstOrDefaultAsync(l => l.LoanAccountID == targetLoanId && l.Status != "Closed");

                if (targetLoan == null)
                {
                    return BadRequest(new { message = "निवडलेले कर्ज खाते सापडले नाही किंवा ते बंद आहे." });
                }

                var (pendingLoanInt, _, _) = await CalculatePendingLoanInterestAsync(targetLoan, effClosureDate);
                decimal targetLoanTotalDue = Math.Round(targetLoan.PrincipalBalance + targetLoan.InterestBalance + targetLoan.OverdueInterestBalance + pendingLoanInt, 2, MidpointRounding.AwayFromZero);
                decimal maxAdjustable = Math.Min(netPayable, targetLoanTotalDue);

                if (hasDirectLien &&
                    request.LoanAdjustmentAmount.HasValue &&
                    request.LoanAdjustmentAmount.Value + 0.01m < maxAdjustable)
                {
                    return BadRequest(new
                    {
                        errorCode = "PARTIAL_LOAN_ADJUST_NOT_ALLOWED",
                        message = $"सदर पिग्मी खात्यावर तारण बोजा असल्यामुळे खाते बंद करताना किमान ₹{maxAdjustable:N2} रक्कम तारण कर्जात समायोजित करणे बंधनकारक आहे."
                    });
                }

                loanAdjustAmount = request.LoanAdjustmentAmount.HasValue && request.LoanAdjustmentAmount.Value > 0m
                    ? Math.Min(Math.Round(request.LoanAdjustmentAmount.Value, 2, MidpointRounding.AwayFromZero), maxAdjustable)
                    : maxAdjustable;

                if (loanAdjustAmount <= 0m)
                {
                    return BadRequest(new { message = "कर्ज समायोजन रक्कम ₹० पेक्षा जास्त असणे आवश्यक आहे." });
                }

                surplusPayoutAmount = Math.Max(0m, Math.Round(netPayable - loanAdjustAmount, 2, MidpointRounding.AwayFromZero));
                if (surplusPayoutAmount > 0m)
                {
                    if (BankLedgerHelper.IsBankPaymentMode(surplusMode))
                    {
                        var sBank = await BankLedgerHelper.ValidateBankLedgerAsync(_context, request.SurplusBankLedgerId);
                        if (!sBank.IsValid) return BadRequest(new { message = sBank.ErrorMessage });
                        surplusLedgerId = sBank.LedgerId;
                    }
                    else if (PigmySettlementHelper.IsSavingTransferMode(surplusMode))
                    {
                        if (!request.SurplusSavingAccountId.HasValue || request.SurplusSavingAccountId.Value <= 0)
                        {
                            return BadRequest(new { message = "कर्ज वजावटीनंतर शिल्लक परतावा वर्ग करण्यासाठी सक्रिय बचत खाते निवडा." });
                        }
                        var sSav = await _context.SavingAccountMasters.FindAsync(request.SurplusSavingAccountId.Value);
                        if (sSav == null || sSav.Status == "Closed" || sSav.Status == "Frozen")
                        {
                            return BadRequest(new { message = "शिल्लक परताव्यासाठी निवडलेले बचत खाते सापडले नाही किंवा बंद आहे." });
                        }
                        surplusLedgerId = await SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(_context, sSav);
                        if (surplusLedgerId <= 0)
                        {
                            return BadRequest(new { message = SavingLedgerHelper.GetMissingMappingErrorMessage(sSav.AccountNo) });
                        }
                    }
                    else if (string.Equals(surplusMode, "Cash", StringComparison.OrdinalIgnoreCase))
                    {
                        var cashCheck = await ValidateBranchCashLedgerAsync(homeBranchId);
                        if (!cashCheck.IsValid || cashCheck.Ledger == null)
                        {
                            return BadRequest(new { message = cashCheck.ErrorMessage });
                        }
                        surplusLedgerId = cashCheck.Ledger.LedgerID;
                    }
                    else
                    {
                        return BadRequest(new { message = $"शिल्लक परताव्यासाठी अवैध पेमेंट माध्यम '{surplusMode}'." });
                    }
                }
            }

            // Capture Pre-Closure Snapshot for Lossless Rollback
            string previousAccountStatus = account.Status;
            bool wasLienMarked = account.IsLienMarked;
            string? previousLienLoanAccountNo = account.LienLoanAccountNo;
            decimal? previousLienAmount = account.LienAmount;

            string refNote = !string.IsNullOrWhiteSpace(request.ReferenceNo) ? $" [Ref/UTR: {request.ReferenceNo.Trim()}]" : "";
            string typeLabel = isPremature ? "Premature " : "Maturity ";
            string overrideNotice = request.ManagerOverrideConfirmed ? " [Manager Override]" : "";
            string penaltyNotice = penaltyAmount > 0 ? $" (कपात: ₹{penaltyAmount:N2})" : "";
            string interestNotice = interestAmount > 0 ? $" (व्याज: ₹{interestAmount:N2})" : "";
            string manualNotice = isManualOverride && !string.IsNullOrWhiteSpace(request.OverrideReason)
                ? $" [बदल कारण: {request.OverrideReason.Trim()}]"
                : "";

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var todayStr = effClosureDate.ToString("yyyyMMdd");
                var lastVoucher = await _context.Vouchers.OrderByDescending(v => v.VoucherID).FirstOrDefaultAsync();
                int nextSeq = (lastVoucher?.VoucherID ?? 0) + 1;

                int primaryVoucherId;
                string finalVoucherNo;
                int? linkedLoanCollectionId = null;

                if (isLoanAdjust && targetLoan != null)
                {
                    var (settledLoan, loanColl, prinPaid, intPaid, penPaid) = await ProcessPigmyLoanSettlementAsync(
                        targetLoan.LoanAccountID,
                        loanAdjustAmount,
                        effClosureDate,
                        account,
                        "CLOSURE",
                        grossBalance,
                        0m,
                        homeBranchId,
                        userId);

                    var loanRate = settledLoan.LoanRate ?? await _context.LoanRates.FindAsync(settledLoan.LoanRateID);
                    int loanLedgerId = loanRate?.LoanLedgerID ?? 0;
                    int loanInterestLedgerId = loanRate?.InterestLedgerID ?? 0;
                    int loanOverdueLedgerId = (loanRate?.OverdueInterestLedgerID ?? 0) > 0 ? loanRate!.OverdueInterestLedgerID!.Value : loanInterestLedgerId;

                    if (prinPaid > 0 && loanLedgerId <= 0)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = "कर्ज योजनेचे मुद्दल जी.एल. लेजर (Loan Principal Ledger) मॅप केलेले नाही." });
                    }
                    if (intPaid > 0 && loanInterestLedgerId <= 0)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = "कर्ज योजनेचे व्याज जी.एल. लेजर (Loan Interest Ledger) मॅप केलेले नाही." });
                    }
                    if (penPaid > 0 && loanOverdueLedgerId <= 0)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = "कर्ज योजनेचे दंड व्याज जी.एल. लेजर (Loan Overdue Ledger) मॅप केलेले नाही." });
                    }

                    // Release Pigmy Collateral Lien
                    var linkedPigmyCollaterals = await _context.LoanDepositCollaterals
                        .Where(c => (c.CollateralType == "Pigmy" || c.CollateralType == "PigmyDeposit") &&
                                    c.DepositAccountID == account.PigmyAccountID &&
                                    c.LienStatus != "Released")
                        .ToListAsync();
                    foreach (var col in linkedPigmyCollaterals)
                    {
                        col.LienStatus = settledLoan.Status == "Closed" ? "Released" : "Invoked";
                        col.LienReleasedDate = effClosureDate;
                        col.CurrentDepositBalance = 0m;
                    }
                    if (account.IsLienMarked)
                    {
                        account.IsLienMarked = false;
                    }

                    var jvDetails = new List<VoucherDetail>();
                    if (grossBalance > 0m)
                    {
                        jvDetails.Add(new VoucherDetail
                        {
                            LedgerID = liabilityLedger.LedgerID,
                            CustomerID = account.CustomerID,
                            MemberID = linkedMemberId,
                            DrCr = "Dr",
                            Amount = grossBalance
                        });
                    }

                    if (interestAmount > 0m && interestDebitLedger != null)
                    {
                        jvDetails.Add(new VoucherDetail
                        {
                            LedgerID = interestDebitLedger.LedgerID,
                            CustomerID = account.CustomerID,
                            MemberID = linkedMemberId,
                            DrCr = "Dr",
                            Amount = interestAmount
                        });
                    }

                    if (penaltyAmount > 0m && deductionLedger != null)
                    {
                        jvDetails.Add(new VoucherDetail
                        {
                            LedgerID = deductionLedger.LedgerID,
                            CustomerID = account.CustomerID,
                            MemberID = linkedMemberId,
                            DrCr = "Cr",
                            Amount = penaltyAmount
                        });
                    }

                    if (prinPaid > 0m)
                    {
                        jvDetails.Add(new VoucherDetail
                        {
                            LedgerID = loanLedgerId,
                            CustomerID = settledLoan.CustomerID,
                            MemberID = settledLoan.MemberID,
                            DrCr = "Cr",
                            Amount = prinPaid
                        });
                    }
                    if (intPaid > 0m)
                    {
                        jvDetails.Add(new VoucherDetail
                        {
                            LedgerID = loanInterestLedgerId,
                            CustomerID = settledLoan.CustomerID,
                            MemberID = settledLoan.MemberID,
                            DrCr = "Cr",
                            Amount = intPaid
                        });
                    }
                    if (penPaid > 0m)
                    {
                        jvDetails.Add(new VoucherDetail
                        {
                            LedgerID = loanOverdueLedgerId,
                            CustomerID = settledLoan.CustomerID,
                            MemberID = settledLoan.MemberID,
                            DrCr = "Cr",
                            Amount = penPaid
                        });
                    }
                    if (surplusPayoutAmount > 0m && surplusLedgerId > 0)
                    {
                        jvDetails.Add(new VoucherDetail
                        {
                            LedgerID = surplusLedgerId,
                            CustomerID = account.CustomerID,
                            MemberID = linkedMemberId,
                            DrCr = "Cr",
                            Amount = surplusPayoutAmount
                        });
                    }

                    var jv = new Voucher
                    {
                        BranchID = homeBranchId,
                        VoucherNo = $"JV-CLO-LN-{todayStr}-{nextSeq:D4}",
                        VoucherDate = effClosureDate,
                        VoucherType = "Journal",
                        Status = "Pending",
                        TotalAmount = grossBalance + interestAmount,
                        Narration = $"{typeLabel}Pigmy Closure & Loan Set-Off A/c {account.AccountNo} -> कर्ज {settledLoan.LoanAccountNo} (कर्ज जमा: ₹{loanAdjustAmount:N2}, शिल्लक: ₹{surplusPayoutAmount:N2}){penaltyNotice}{interestNotice}{manualNotice}{refNote} {request.Narration}".Trim(),
                        CreatedBy = userId,
                        CreatedOn = DateTime.Now,
                        VoucherDetails = jvDetails
                    };
                    _context.Vouchers.Add(jv);
                    await _context.SaveChangesAsync();
                    await VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, jv.VoucherID, jv.VoucherNo);

                    loanColl.VoucherID = jv.VoucherID;
                    linkedLoanCollectionId = loanColl.LoanCollectionID;
                    primaryVoucherId = jv.VoucherID;
                    finalVoucherNo = jv.VoucherNo;
                }
                else
                {
                    Ledger payoutCreditLedger;
                    if (isCloSavingTransfer && targetCloSavingAcc != null && targetCloSavingLedgerId > 0)
                    {
                        payoutCreditLedger = (await _context.Ledgers.FindAsync(targetCloSavingLedgerId))!;
                        counterBranchId = targetCloSavingAcc.BranchID > 0 ? targetCloSavingAcc.BranchID : homeBranchId;
                    }
                    else if (isBankMode && resolvedBankLedgerId > 0)
                    {
                        payoutCreditLedger = (await _context.Ledgers.FindAsync(resolvedBankLedgerId))!;
                    }
                    else
                    {
                        var cashCheck = await ValidateBranchCashLedgerAsync(counterBranchId);
                        if (!cashCheck.IsValid || cashCheck.Ledger == null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(new { message = cashCheck.ErrorMessage });
                        }
                        payoutCreditLedger = cashCheck.Ledger;
                    }

                    bool isCrossBranchTxn = (counterBranchId != homeBranchId);
                    if (!isCrossBranchTxn)
                    {
                        var voucherDetails = new List<VoucherDetail>();
                        if (grossBalance > 0m)
                        {
                            voucherDetails.Add(new VoucherDetail
                            {
                                LedgerID = liabilityLedger.LedgerID,
                                CustomerID = account.CustomerID,
                                MemberID = linkedMemberId,
                                DrCr = "Dr",
                                Amount = grossBalance
                            });
                        }

                        if (netPayable > 0m)
                        {
                            voucherDetails.Add(new VoucherDetail
                            {
                                LedgerID = payoutCreditLedger.LedgerID,
                                CustomerID = account.CustomerID,
                                MemberID = linkedMemberId,
                                DrCr = "Cr",
                                Amount = netPayable
                            });
                        }

                        if (penaltyAmount > 0m && deductionLedger != null)
                        {
                            voucherDetails.Add(new VoucherDetail
                            {
                                LedgerID = deductionLedger.LedgerID,
                                CustomerID = account.CustomerID,
                                MemberID = linkedMemberId,
                                DrCr = "Cr",
                                Amount = penaltyAmount
                            });
                        }

                        if (interestAmount > 0m && interestDebitLedger != null)
                        {
                            voucherDetails.Add(new VoucherDetail
                            {
                                LedgerID = interestDebitLedger.LedgerID,
                                CustomerID = account.CustomerID,
                                MemberID = linkedMemberId,
                                DrCr = "Dr",
                                Amount = interestAmount
                            });
                        }

                        var voucher = new Voucher
                        {
                            BranchID = homeBranchId,
                            VoucherNo = $"VCH-CLO-{todayStr}-{nextSeq:D4}",
                            VoucherDate = effClosureDate,
                            VoucherType = (isCloSavingTransfer || netPayable <= 0m) ? "Journal" : "Payment",
                            Status = "Pending",
                            TotalAmount = grossBalance + interestAmount,
                            Narration = $"{typeLabel}Pigmy Closure for A/c {account.AccountNo} - {account.Customer?.FirstName}. (सायकल #{account.CurrentCycleNumber}, {tenureMonthsInCycle:N1}M){penaltyNotice}{interestNotice}{overrideNotice}{manualNotice}{refNote} {request.Narration}".Trim(),
                            CreatedBy = userId,
                            CreatedOn = DateTime.Now,
                            VoucherDetails = voucherDetails
                        };

                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();
                        await VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, voucher.VoucherID, voucher.VoucherNo);

                        primaryVoucherId = voucher.VoucherID;
                        finalVoucherNo = voucher.VoucherNo;
                    }
                    else
                    {
                        var (counterIbtLedgerId, homeIbtLedgerId) = await IbtLedgerHelper.GetDirectionalPairIbtLedgerIdsAsync(_context, counterBranchId, homeBranchId);

                        var counterVoucher = new Voucher
                        {
                            BranchID = counterBranchId,
                            VoucherNo = $"PV-{counterBranchId}-{todayStr}-PIGMY-CLO-{nextSeq:D4}",
                            VoucherDate = effClosureDate,
                            VoucherType = isCloSavingTransfer ? "Journal" : "Payment",
                            Status = "Pending",
                            TotalAmount = netPayable,
                            Narration = $"[आंतर-शाखा पिग्मी क्लोजर] खाते: {account.AccountNo} (मूळ शाखा #{homeBranchId}) परतावा.{penaltyNotice}{interestNotice}{overrideNotice} {request.Narration}".Trim(),
                            CreatedBy = userId,
                            CreatedOn = DateTime.Now,
                            IsIbtVoucher = true,
                            TargetBranchID = homeBranchId
                        };
                        _context.Vouchers.Add(counterVoucher);
                        await _context.SaveChangesAsync();

                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = counterVoucher.VoucherID,
                            LedgerID = counterIbtLedgerId,
                            CustomerID = account.CustomerID,
                            DrCr = "Dr",
                            Amount = netPayable
                        });
                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = counterVoucher.VoucherID,
                            LedgerID = payoutCreditLedger.LedgerID,
                            CustomerID = account.CustomerID,
                            DrCr = "Cr",
                            Amount = netPayable
                        });

                        var homeVoucher = new Voucher
                        {
                            BranchID = homeBranchId,
                            VoucherNo = $"JV-PIGMY-CLO-{todayStr}-{nextSeq:D4}",
                            VoucherDate = effClosureDate,
                            VoucherType = "Journal",
                            Status = "Pending",
                            TotalAmount = grossBalance + interestAmount,
                            Narration = $"[आंतर-शाखा पिग्मी क्लोजर] काऊंटर शाखा #{counterBranchId} वरून परतावा ({typeLabel}खाते: {account.AccountNo}).{penaltyNotice}{interestNotice}{overrideNotice} {request.Narration}".Trim(),
                            CreatedBy = userId,
                            CreatedOn = DateTime.Now,
                            IsIbtVoucher = true,
                            TargetBranchID = counterBranchId,
                            RelatedVoucherID = counterVoucher.VoucherID
                        };
                        _context.Vouchers.Add(homeVoucher);
                        await _context.SaveChangesAsync();

                        counterVoucher.RelatedVoucherID = homeVoucher.VoucherID;

                        if (grossBalance > 0m)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail
                            {
                                VoucherID = homeVoucher.VoucherID,
                                LedgerID = liabilityLedger.LedgerID,
                                CustomerID = account.CustomerID,
                                DrCr = "Dr",
                                Amount = grossBalance
                            });
                        }

                        if (interestAmount > 0m && interestDebitLedger != null)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail
                            {
                                VoucherID = homeVoucher.VoucherID,
                                LedgerID = interestDebitLedger.LedgerID,
                                CustomerID = account.CustomerID,
                                DrCr = "Dr",
                                Amount = interestAmount
                            });
                        }

                        if (penaltyAmount > 0m && deductionLedger != null)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail
                            {
                                VoucherID = homeVoucher.VoucherID,
                                LedgerID = deductionLedger.LedgerID,
                                CustomerID = account.CustomerID,
                                DrCr = "Cr",
                                Amount = penaltyAmount
                            });
                        }

                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = homeVoucher.VoucherID,
                            LedgerID = homeIbtLedgerId,
                            CustomerID = account.CustomerID,
                            DrCr = "Cr",
                            Amount = netPayable
                        });

                        await _context.SaveChangesAsync();
                        await VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, counterVoucher.VoucherID, counterVoucher.VoucherNo);
                        await VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, homeVoucher.VoucherID, homeVoucher.VoucherNo);

                        primaryVoucherId = counterVoucher.VoucherID;
                        finalVoucherNo = counterVoucher.VoucherNo;
                    }
                }

                // NOTE: Saving Account balance credit is DEFERRED until Checker Approval in VoucherPostingController!
                string cloTxNarr = $"{typeLabel}Pigmy Account Closure Payout - Vch: {finalVoucherNo}{penaltyNotice}{interestNotice}";
                if (cloTxNarr.Length > 250) cloTxNarr = cloTxNarr.Substring(0, 250);

                _context.PigmyTransactions.Add(new PigmyTransaction
                {
                    PigmyAccountID = account.PigmyAccountID,
                    TransactionDate = effClosureDate,
                    ValueDate = effClosureDate,
                    TransactionType = "WITHDRAWAL",
                    DrAmount = grossBalance,
                    CrAmount = 0,
                    BalanceAmount = 0,
                    Narration = cloTxNarr,
                    ReferenceId = finalVoucherNo,
                    MakerId = userId,
                    PostedOn = DateTime.Now
                });

                var closureRecord = new PigmyAccountClosure
                {
                    PigmyAccountID = account.PigmyAccountID,
                    BranchID = homeBranchId,
                    ClosureDate = effClosureDate,
                    IsPremature = isPremature,
                    CycleNumber = account.CurrentCycleNumber,
                    CycleStartSnapshot = cycleStart,
                    ElapsedDays = tenureDaysInCycle,
                    GrossDepositBalance = grossBalance,
                    AlreadyCapitalizedInterest = alreadyCapitalized,
                    VerifiedProvisionedInterest = verifiedProvisioned,
                    AppliedSlabID = appliedSlab?.SlabID,
                    CalculatedPenaltyRate = penaltyRate,
                    CommissionOrPenaltyAmount = penaltyAmount,
                    DeductionLedgerID = deductionLedger?.LedgerID,
                    CalculatedInterestRate = interestRate,
                    FinalInterestAmount = interestAmount,
                    InterestDebitMode = resolvedCloIntMode,
                    InterestDebitLedgerID = interestDebitLedger?.LedgerID,
                    NetPayableAmount = netPayable,
                    PaymentMode = isLoanAdjust ? "Adjust in Loan" : (isCloSavingTransfer ? "Saving Transfer" : (isBankMode ? "Bank" : "Cash")),
                    BankLedgerID = isBankMode ? resolvedBankLedgerId : null,
                    SavingAccountID = isCloSavingTransfer ? request.SavingAccountId : null,
                    ReferenceNo = !string.IsNullOrWhiteSpace(request.ReferenceNo) ? request.ReferenceNo.Trim() : null,
                    AdjustInLoan = isLoanAdjust,
                    TargetLoanAccountID = isLoanAdjust ? targetLoan?.LoanAccountID : null,
                    LoanAdjustedAmount = isLoanAdjust ? loanAdjustAmount : 0m,
                    LinkedLoanCollectionID = linkedLoanCollectionId,
                    SurplusPayoutAmount = isLoanAdjust ? surplusPayoutAmount : 0m,
                    SurplusPaymentMode = isLoanAdjust && surplusPayoutAmount > 0m ? surplusMode : null,
                    SurplusBankLedgerID = isLoanAdjust && surplusPayoutAmount > 0m && BankLedgerHelper.IsBankPaymentMode(surplusMode) ? request.SurplusBankLedgerId : null,
                    SurplusSavingAccountID = isLoanAdjust && surplusPayoutAmount > 0m && PigmySettlementHelper.IsSavingTransferMode(surplusMode) ? request.SurplusSavingAccountId : null,
                    PreviousAccountStatus = previousAccountStatus,
                    WasLienMarked = wasLienMarked,
                    PreviousLienLoanAccountNo = previousLienLoanAccountNo,
                    PreviousLienAmount = previousLienAmount,
                    IsManualOverride = isManualOverride,
                    OverrideReason = !string.IsNullOrWhiteSpace(request.OverrideReason) ? request.OverrideReason.Trim() : null,
                    VoucherID = primaryVoucherId,
                    VoucherNo = finalVoucherNo,
                    Narration = request.Narration,
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow
                };
                _context.PigmyAccountClosures.Add(closureRecord);

                account.Status = "Closed";
                account.TotalDepositedAmount = 0m;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    message = "पिग्मी खाते यशस्वीरीत्या बंद करण्यात आले आणि परतावा व्हाउचर चेकर मंजुरीसाठी जनरेट झाले.",
                    voucherId = primaryVoucherId,
                    voucherNo = finalVoucherNo,
                    totalDeposited = grossBalance,
                    alreadyCapitalizedInterest = alreadyCapitalized,
                    penaltyAmount = penaltyAmount,
                    interestAmount = interestAmount,
                    loanAdjustedAmount = loanAdjustAmount,
                    surplusPayoutAmount = surplusPayoutAmount,
                    netPayable = netPayable,
                    policyNote = policyNote
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { message = "खाते बंद करताना त्रुटी आली: " + ex.Message });
            }
        }

        // GET: api/PigmyClosure/by-voucher/{voucherId}
        [HttpGet("by-voucher/{voucherId}")]
        public async Task<IActionResult> GetClosureByVoucher(int voucherId)
        {
            var voucher = await _context.Vouchers
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Ledger)
                .FirstOrDefaultAsync(v => v.VoucherID == voucherId);

            if (voucher == null)
            {
                return NotFound(new { message = $"व्हाउचर क्र. {voucherId} सिस्टीममध्ये सापडले नाही." });
            }

            if (!User.CanAccessBranch(voucher.BranchID) && !User.IsHeadOfficeAdmin())
            {
                return Forbid();
            }

            var matchVoucherIds = new List<int> { voucher.VoucherID };
            if (voucher.RelatedVoucherID.HasValue && voucher.RelatedVoucherID.Value > 0)
            {
                matchVoucherIds.Add(voucher.RelatedVoucherID.Value);
            }

            var matchVoucherNos = new List<string>();
            if (!string.IsNullOrWhiteSpace(voucher.VoucherNo)) matchVoucherNos.Add(voucher.VoucherNo);
            if (voucher.RelatedVoucherID.HasValue && voucher.RelatedVoucherID.Value > 0)
            {
                string? relNo = await _context.Vouchers
                    .AsNoTracking()
                    .Where(v => v.VoucherID == voucher.RelatedVoucherID.Value)
                    .Select(v => v.VoucherNo)
                    .FirstOrDefaultAsync();
                if (!string.IsNullOrWhiteSpace(relNo)) matchVoucherNos.Add(relNo);
            }

            // 1. Check PigmyAccountClosures first
            var closure = await _context.PigmyAccountClosures
                .Include(c => c.DeductionLedger)
                .Include(c => c.InterestDebitLedger)
                .Include(c => c.PigmyAccount)
                    .ThenInclude(a => a!.Customer)
                .Include(c => c.PigmyAccount)
                    .ThenInclude(a => a!.PigmyScheme)
                .FirstOrDefaultAsync(c =>
                    (c.VoucherID.HasValue && matchVoucherIds.Contains(c.VoucherID.Value)) ||
                    (c.VoucherNo != null && matchVoucherNos.Contains(c.VoucherNo)));

            if (closure != null && closure.PigmyAccount != null)
            {
                var acc = closure.PigmyAccount;
                string custName = FormatCustomerFullName(acc.Customer);
                return Ok(new
                {
                    pigmyAccount = new
                    {
                        acc.PigmyAccountID,
                        acc.AccountNo,
                        LegacyAccountNumber = acc.LegacyAccountNumber ?? acc.OldAccountNo,
                        acc.CustomerID,
                        CustomerName = custName,
                        CIFNo = acc.Customer?.CIFNo ?? "",
                        acc.CurrentCycleNumber,
                        acc.OpeningDate,
                        acc.MaturityDate,
                        TotalDepositedAmount = closure.GrossDepositBalance,
                        acc.Status,
                        SchemeName = acc.PigmyScheme?.SchemeName ?? ""
                    },
                    closureDetails = new
                    {
                        ClosureDate = closure.ClosureDate,
                        ClosureType = "Closure",
                        IsPremature = closure.IsPremature,
                        CycleNumber = closure.CycleNumber,
                        CycleStartDate = closure.CycleStartSnapshot,
                        ElapsedDays = closure.ElapsedDays,
                        GrossDepositBalance = closure.GrossDepositBalance,
                        AlreadyCapitalizedInterest = closure.AlreadyCapitalizedInterest,
                        RequestedAmount = closure.GrossDepositBalance,
                        PenaltyRate = closure.CalculatedPenaltyRate,
                        PenaltyAmount = closure.CommissionOrPenaltyAmount,
                        DeductionLedgerId = closure.DeductionLedgerID,
                        DeductionLedgerName = closure.DeductionLedger?.LedgerName ?? "",
                        InterestRate = closure.CalculatedInterestRate,
                        InterestAmount = closure.FinalInterestAmount,
                        InterestDebitMode = closure.InterestDebitMode,
                        InterestDebitLedgerId = closure.InterestDebitLedgerID,
                        InterestDebitLedgerName = closure.InterestDebitLedger?.LedgerName ?? "",
                        NetPayable = closure.NetPayableAmount,
                        RemainingBalance = 0m,
                        PaymentMode = closure.PaymentMode,
                        AdjustInLoan = closure.AdjustInLoan,
                        TargetLoanAccountId = closure.TargetLoanAccountID,
                        LoanAdjustedAmount = closure.LoanAdjustedAmount,
                        SurplusPayoutAmount = closure.SurplusPayoutAmount,
                        SurplusPaymentMode = closure.SurplusPaymentMode,
                        IsManualOverride = closure.IsManualOverride,
                        OverrideReason = closure.OverrideReason,
                        Narration = closure.Narration ?? voucher.Narration
                    },
                    voucher = MapVoucherForPassing(voucher)
                });
            }

            // 2. Check PigmyWithdrawals
            var withdrawal = await _context.PigmyWithdrawals
                .Include(w => w.DeductionLedger)
                .Include(w => w.InterestDebitLedger)
                .Include(w => w.PigmyAccount)
                    .ThenInclude(a => a!.Customer)
                .Include(w => w.PigmyAccount)
                    .ThenInclude(a => a!.PigmyScheme)
                .FirstOrDefaultAsync(w =>
                    (w.VoucherID.HasValue && matchVoucherIds.Contains(w.VoucherID.Value)) ||
                    (w.VoucherNo != null && matchVoucherNos.Contains(w.VoucherNo)));

            if (withdrawal != null && withdrawal.PigmyAccount != null)
            {
                var acc = withdrawal.PigmyAccount;
                string custName = FormatCustomerFullName(acc.Customer);
                return Ok(new
                {
                    pigmyAccount = new
                    {
                        acc.PigmyAccountID,
                        acc.AccountNo,
                        LegacyAccountNumber = acc.LegacyAccountNumber ?? acc.OldAccountNo,
                        acc.CustomerID,
                        CustomerName = custName,
                        CIFNo = acc.Customer?.CIFNo ?? "",
                        CurrentCycleNumber = withdrawal.CycleNumber,
                        acc.OpeningDate,
                        acc.MaturityDate,
                        TotalDepositedAmount = withdrawal.RequestedAmount + withdrawal.RemainingBalance,
                        acc.Status,
                        SchemeName = acc.PigmyScheme?.SchemeName ?? ""
                    },
                    closureDetails = new
                    {
                        ClosureDate = withdrawal.WithdrawalDate,
                        ClosureType = "Withdrawal",
                        IsPremature = withdrawal.WithdrawalDate < acc.MaturityDate,
                        CycleNumber = withdrawal.CycleNumber,
                        CycleStartDate = withdrawal.CycleStartSnapshot,
                        ElapsedDays = withdrawal.ElapsedDays,
                        GrossDepositBalance = withdrawal.RequestedAmount + withdrawal.RemainingBalance,
                        AlreadyCapitalizedInterest = 0m,
                        RequestedAmount = withdrawal.RequestedAmount,
                        PenaltyRate = withdrawal.PenaltyRate,
                        PenaltyAmount = withdrawal.PenaltyAmount,
                        DeductionLedgerId = withdrawal.DeductionLedgerID,
                        DeductionLedgerName = withdrawal.DeductionLedger?.LedgerName ?? "",
                        InterestRate = withdrawal.InterestRate,
                        InterestAmount = withdrawal.InterestAmount,
                        InterestDebitMode = "Expense",
                        InterestDebitLedgerId = withdrawal.InterestDebitLedgerID,
                        InterestDebitLedgerName = withdrawal.InterestDebitLedger?.LedgerName ?? "",
                        NetPayable = withdrawal.NetPaidAmount,
                        RemainingBalance = withdrawal.RemainingBalance,
                        PaymentMode = withdrawal.PaymentMode,
                        AdjustInLoan = withdrawal.AdjustInLoan,
                        TargetLoanAccountId = withdrawal.TargetLoanAccountID,
                        LoanAdjustedAmount = withdrawal.LoanAdjustedAmount,
                        SurplusPayoutAmount = withdrawal.SurplusPayoutAmount,
                        SurplusPaymentMode = withdrawal.SurplusPaymentMode,
                        IsManualOverride = withdrawal.IsManualOverride,
                        OverrideReason = withdrawal.OverrideReason,
                        Narration = withdrawal.Narration ?? voucher.Narration
                    },
                    voucher = MapVoucherForPassing(voucher)
                });
            }

            // 3. Legacy Fallback for Historical Vouchers
            PigmyAccount? legacyAccount = null;
            if (!string.IsNullOrEmpty(voucher.Narration))
            {
                var match = Regex.Match(
                    voucher.Narration,
                    @"(?:A\/c|खाते|Account)\s*:?\s*([A-Za-z0-9\-]+)",
                    RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    string accCandidate = match.Groups[1].Value.Trim();
                    legacyAccount = await _context.PigmyAccounts
                        .Include(a => a.Customer)
                        .Include(a => a.PigmyScheme)
                        .FirstOrDefaultAsync(a => a.AccountNo == accCandidate);
                }
            }

            if (legacyAccount == null)
            {
                var custId = voucher.VoucherDetails.FirstOrDefault(vd => vd.CustomerID.HasValue && vd.CustomerID.Value > 0)?.CustomerID;
                if (custId.HasValue)
                {
                    legacyAccount = await _context.PigmyAccounts
                        .Include(a => a.Customer)
                        .Include(a => a.PigmyScheme)
                        .Where(a => a.CustomerID == custId.Value)
                        .OrderByDescending(a => a.PigmyAccountID)
                        .FirstOrDefaultAsync();
                }
            }

            if (legacyAccount == null)
            {
                return NotFound(new { message = $"सदर पिग्मी व्हाउचरशी (ID: {voucherId}) संबंधित खाते सापडले नाही." });
            }

            string closureType = (voucher.VoucherNo?.Contains("WDR", StringComparison.OrdinalIgnoreCase) == true ||
                                  voucher.Narration?.Contains("विड्रॉल") == true)
                ? "Withdrawal"
                : "Closure";

            return Ok(new
            {
                pigmyAccount = new
                {
                    legacyAccount.PigmyAccountID,
                    legacyAccount.AccountNo,
                    LegacyAccountNumber = legacyAccount.LegacyAccountNumber ?? legacyAccount.OldAccountNo,
                    legacyAccount.CustomerID,
                    CustomerName = FormatCustomerFullName(legacyAccount.Customer),
                    CIFNo = legacyAccount.Customer?.CIFNo ?? "",
                    legacyAccount.CurrentCycleNumber,
                    legacyAccount.OpeningDate,
                    legacyAccount.MaturityDate,
                    legacyAccount.TotalDepositedAmount,
                    legacyAccount.Status,
                    SchemeName = legacyAccount.PigmyScheme?.SchemeName ?? ""
                },
                closureDetails = new
                {
                    ClosureDate = voucher.VoucherDate,
                    ClosureType = closureType,
                    IsPremature = voucher.VoucherDate < legacyAccount.MaturityDate,
                    CycleNumber = legacyAccount.CurrentCycleNumber,
                    CycleStartDate = legacyAccount.EffectiveStartDate ?? legacyAccount.OpeningDate,
                    ElapsedDays = 0,
                    GrossDepositBalance = voucher.TotalAmount,
                    AlreadyCapitalizedInterest = 0m,
                    RequestedAmount = voucher.TotalAmount,
                    PenaltyRate = 0m,
                    PenaltyAmount = 0m,
                    DeductionLedgerId = (int?)null,
                    DeductionLedgerName = "",
                    InterestRate = 0m,
                    InterestAmount = 0m,
                    InterestDebitMode = "Expense",
                    InterestDebitLedgerId = (int?)null,
                    InterestDebitLedgerName = "",
                    NetPayable = voucher.TotalAmount,
                    RemainingBalance = legacyAccount.TotalDepositedAmount,
                    PaymentMode = "Cash",
                    AdjustInLoan = false,
                    TargetLoanAccountId = (int?)null,
                    LoanAdjustedAmount = 0m,
                    SurplusPayoutAmount = 0m,
                    SurplusPaymentMode = (string?)null,
                    IsManualOverride = false,
                    OverrideReason = (string?)null,
                    Narration = voucher.Narration
                },
                voucher = MapVoucherForPassing(voucher)
            });
        }

        private static object MapVoucherForPassing(Voucher voucher)
        {
            return new
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
                CanPass = voucher.Status == "Unapproved" || voucher.Status == "Draft" || voucher.Status == "Pending",
                VoucherDetails = (voucher.VoucherDetails ?? new List<VoucherDetail>())
                    .Select(vd => new
                    {
                        vd.VoucherDetailID,
                        vd.LedgerID,
                        LedgerName = vd.Ledger?.LedgerName ?? $"Ledger #{vd.LedgerID}",
                        vd.DrCr,
                        vd.Amount
                    })
                    .ToList()
            };
        }
    }
}
