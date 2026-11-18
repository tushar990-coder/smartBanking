using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bhisi.Api.Helpers
{
    public sealed class LoanMetadataSnapshot
    {
        public decimal SanctionedAmount { get; set; }
        public int DurationMonths { get; set; }
        public decimal InstallmentAmount { get; set; }
        public decimal EffectiveInterestRate { get; set; }
        public decimal PenalRate { get; set; }
        public DateTime DisbursementDate { get; set; }
        public DateTime? MaturityDate { get; set; }
        public string InterestCalculationMethod { get; set; } = string.Empty;
        public bool IsFlatMethod { get; set; }
    }

    public sealed class LoanDuesSnapshot
    {
        public decimal PrincipalBalance { get; set; }
        public decimal PurePrincipalBalance { get; set; }
        public decimal CapitalizedInterestAmount { get; set; }
        public decimal OverduePrincipal { get; set; }
        public decimal PostedInterestBalance { get; set; }
        public decimal AccruedRegularInterest { get; set; }
        public decimal TotalRegularInterestDue { get; set; }
        public DateTime InterestStartDate { get; set; }
        public int InterestDays { get; set; }
        public decimal EffectiveRate { get; set; }
        public decimal PenalRate { get; set; }
        public bool IsFlatMethod { get; set; }
        public decimal PostedPenalInterestBalance { get; set; }
        public decimal EstimatedAccruedPenalInterest { get; set; }
        public decimal TotalPenalInterestDue { get; set; }
        public int OverdueInstallmentsCount { get; set; }
        public int TotalInstallments { get; set; }
        public DateTime? OverdueSinceDate { get; set; }
        public int OverdueDays { get; set; }
    }

    public static class LegalRecoveryTrackerHelper
    {
        public static LoanMetadataSnapshot ResolveLoanMetadata(
            LoanAccount loan,
            List<LoanInstallmentSchedule>? schedules = null)
        {
            string method = loan.LoanRate?.InterestCalculationMethod ?? string.Empty;
            bool isFlatMethod = method.Contains("Flat", StringComparison.OrdinalIgnoreCase) || method.Contains("फ्लॅट");

            var disbs = loan.LoanDisbursements ?? Array.Empty<LoanDisbursement>();
            decimal totalDisbursed = disbs.Sum(d => d.DisbursementAmount);
            DateTime? minDisbDate = disbs.Any() ? disbs.Min(d => d.DisbursementDate).Date : (DateTime?)null;

            DateTime disbursementDate = (loan.LoanDisbursementDate ?? minDisbDate ?? loan.OpeningDate).Date;

            decimal sanctioned = loan.SanctionedAmount > 0m
                ? loan.SanctionedAmount
                : (totalDisbursed > 0m
                    ? totalDisbursed
                    : (loan.LoanApplication != null && loan.LoanApplication.RequestedAmount > 0m
                        ? loan.LoanApplication.RequestedAmount
                        : loan.PrincipalBalance));

            int durationMonths = loan.DurationMonths > 0
                ? loan.DurationMonths
                : (loan.LoanApplication != null && loan.LoanApplication.DurationMonths > 0
                    ? loan.LoanApplication.DurationMonths
                    : (loan.LoanRate?.DurationMonths ?? 0));

            DateTime? maturityDate = loan.MaturityDate?.Date
                ?? (durationMonths > 0 ? disbursementDate.AddMonths(durationMonths) : (DateTime?)null);

            decimal firstSchedAmount = schedules != null
                ? (schedules.FirstOrDefault(s => s.TotalAmount > 0m)?.TotalAmount ?? 0m)
                : 0m;
            decimal installmentAmount = loan.InstallmentAmount > 0m
                ? loan.InstallmentAmount
                : (firstSchedAmount > 0m
                    ? firstSchedAmount
                    : (loan.LoanApplication != null && loan.LoanApplication.InstallmentAmount > 0m
                        ? loan.LoanApplication.InstallmentAmount
                        : 0m));

            decimal effectiveRate = loan.InterestRate > 0m
                ? loan.InterestRate
                : (loan.LoanApplication != null && loan.LoanApplication.InterestRate > 0m
                    ? loan.LoanApplication.InterestRate
                    : (loan.LoanRate?.InterestRate ?? 0m));

            decimal penalRate = loan.LoanRate?.OverdueInterestRate ?? 0m;

            return new LoanMetadataSnapshot
            {
                SanctionedAmount = Math.Round(Math.Max(0m, sanctioned), 2, MidpointRounding.AwayFromZero),
                DurationMonths = Math.Max(0, durationMonths),
                InstallmentAmount = Math.Round(Math.Max(0m, installmentAmount), 2, MidpointRounding.AwayFromZero),
                EffectiveInterestRate = effectiveRate,
                PenalRate = penalRate,
                DisbursementDate = disbursementDate,
                MaturityDate = maturityDate,
                InterestCalculationMethod = method,
                IsFlatMethod = isFlatMethod
            };
        }

        public static LoanDuesSnapshot ComputeLoanDuesSnapshot(
            LoanAccount loan,
            List<LoanInstallmentSchedule> schedules,
            List<LoanCollection> collections,
            DateTime targetDate)
        {
            DateTime target = targetDate.Date;
            var meta = ResolveLoanMetadata(loan, schedules);
            bool isFlatMethod = meta.IsFlatMethod;
            decimal rate = meta.EffectiveInterestRate;
            decimal penalRate = meta.PenalRate;
            DateTime? effectiveMaturity = meta.MaturityDate;

            DateTime? explicitLatest = null;
            if (loan.LastInterestPostingDate.HasValue && loan.LastInstallmentPaidDate.HasValue)
            {
                explicitLatest = loan.LastInterestPostingDate.Value.Date >= loan.LastInstallmentPaidDate.Value.Date
                    ? loan.LastInterestPostingDate.Value.Date
                    : loan.LastInstallmentPaidDate.Value.Date;
            }
            else
            {
                explicitLatest = loan.LastInterestPostingDate?.Date ?? loan.LastInstallmentPaidDate?.Date;
            }

            bool hasOpeningBookedInterest = loan.IsOpeningBalance && (loan.InterestBalance > 0 || loan.CapitalizedInterestAmount > 0);
            DateTime startDate;
            if (explicitLatest.HasValue)
            {
                startDate = explicitLatest.Value;
            }
            else if (hasOpeningBookedInterest)
            {
                startDate = loan.OpeningDate.Date;
            }
            else if (isFlatMethod && schedules.Any(s => string.Equals(s.Status, "Paid", StringComparison.OrdinalIgnoreCase)))
            {
                startDate = schedules
                    .Where(s => string.Equals(s.Status, "Paid", StringComparison.OrdinalIgnoreCase))
                    .Max(s => s.DueDate.Date);
            }
            else
            {
                startDate = meta.DisbursementDate;
            }

            int interestDays = Math.Max(0, (target - startDate).Days);
            decimal effectivePrincipal = (!loan.ChargeInterestOnCapitalizedAmount && loan.PurePrincipalBalance > 0)
                ? Math.Max(0m, Math.Min(loan.PurePrincipalBalance, loan.PrincipalBalance))
                : Math.Max(0m, loan.PrincipalBalance);

            decimal accruedRegular = 0m;
            if (!isFlatMethod || !schedules.Any())
            {
                accruedRegular = (interestDays > 0 && rate > 0 && effectivePrincipal > 0)
                    ? Math.Round((effectivePrincipal * rate * interestDays) / 36500m, 0, MidpointRounding.AwayFromZero)
                    : 0m;
            }
            else
            {
                accruedRegular = Services.LoanScheduleGenerator.GetUnpaidScheduledInterest(loan, schedules, collections, target);
                if (accruedRegular <= 0m && effectiveMaturity.HasValue && effectiveMaturity.Value.Date < target && effectivePrincipal > 0 && rate > 0 && interestDays > 0)
                {
                    accruedRegular = Math.Round((effectivePrincipal * rate * interestDays) / 36500m, 0, MidpointRounding.AwayFromZero);
                }
            }

            decimal totalRegular = Math.Round(Math.Max(0m, loan.InterestBalance) + Math.Max(0m, accruedRegular), 2, MidpointRounding.AwayFromZero);

            var validUnpaid = schedules
                .Where(s => !string.Equals(s.Status, "Paid", StringComparison.OrdinalIgnoreCase)
                            && !(loan.IsOpeningBalance && s.DueDate.Date <= loan.OpeningDate.Date))
                .OrderBy(s => s.DueDate)
                .ToList();

            var overdueScheds = validUnpaid.Where(s => s.DueDate.Date <= target).ToList();
            decimal overduePrincipal = overdueScheds.Sum(s => s.PrincipalAmount);
            if (effectiveMaturity.HasValue && effectiveMaturity.Value.Date <= target && loan.PrincipalBalance > overduePrincipal)
            {
                overduePrincipal = loan.PrincipalBalance;
            }
            if (overduePrincipal > loan.PrincipalBalance)
            {
                overduePrincipal = loan.PrincipalBalance;
            }
            if (overduePrincipal <= 0m && !validUnpaid.Any() && effectiveMaturity.HasValue && effectiveMaturity.Value.Date <= target)
            {
                overduePrincipal = loan.PrincipalBalance;
            }

            int totalInstallments = Math.Max(loan.NoOfInstallments, schedules.Count);
            int overdueInstallments = overdueScheds.Count > 0
                ? overdueScheds.Count
                : (effectiveMaturity.HasValue && effectiveMaturity.Value.Date <= target && loan.PrincipalBalance > 0
                    ? Math.Max(1, totalInstallments)
                    : 0);

            DateTime? overdueSinceDate = overdueScheds.Any()
                ? overdueScheds.Min(s => s.DueDate.Date)
                : (effectiveMaturity.HasValue && effectiveMaturity.Value.Date <= target && loan.PrincipalBalance > 0
                    ? effectiveMaturity.Value.Date
                    : null);
            int overdueDays = overdueSinceDate.HasValue ? Math.Max(0, (target - overdueSinceDate.Value).Days) : 0;

            decimal postedPenal = Math.Max(0m, loan.OverdueInterestBalance);
            decimal penalBase = overduePrincipal > 0 ? overduePrincipal : (overdueDays > 0 ? loan.PrincipalBalance : 0m);
            decimal estPenal = (postedPenal <= 0m && penalRate > 0 && overdueDays > 0 && penalBase > 0)
                ? Math.Round((penalBase * penalRate * overdueDays) / 36500m, 0, MidpointRounding.AwayFromZero)
                : 0m;
            decimal totalPenal = postedPenal > 0m ? postedPenal : estPenal;

            return new LoanDuesSnapshot
            {
                PrincipalBalance = loan.PrincipalBalance,
                PurePrincipalBalance = loan.PurePrincipalBalance,
                CapitalizedInterestAmount = loan.CapitalizedInterestAmount,
                OverduePrincipal = Math.Round(Math.Max(0m, overduePrincipal), 2, MidpointRounding.AwayFromZero),
                PostedInterestBalance = Math.Round(Math.Max(0m, loan.InterestBalance), 2, MidpointRounding.AwayFromZero),
                AccruedRegularInterest = Math.Round(Math.Max(0m, accruedRegular), 2, MidpointRounding.AwayFromZero),
                TotalRegularInterestDue = totalRegular,
                InterestStartDate = startDate,
                InterestDays = interestDays,
                EffectiveRate = rate,
                PenalRate = penalRate,
                IsFlatMethod = isFlatMethod,
                PostedPenalInterestBalance = postedPenal,
                EstimatedAccruedPenalInterest = estPenal,
                TotalPenalInterestDue = totalPenal,
                OverdueInstallmentsCount = overdueInstallments,
                TotalInstallments = totalInstallments,
                OverdueSinceDate = overdueSinceDate,
                OverdueDays = overdueDays
            };
        }
        public static int? ResolveLoanCustomerId(LoanAccount? loan)
        {
            if (loan == null) return null;
            if (loan.CustomerID.HasValue && loan.CustomerID.Value > 0) return loan.CustomerID.Value;
            if (loan.Member != null && loan.Member.CustomerID > 0) return loan.Member.CustomerID;
            return null;
        }

        public static string FormatCustomerName(Customer? customer)
        {
            if (customer == null) return string.Empty;
            return string.Join(" ", new[]
            {
                customer.FirstName,
                customer.MiddleName,
                customer.LastName
            }.Where(p => !string.IsNullOrWhiteSpace(p))).Trim();
        }

        public static string FormatCustomerAddress(Customer? customer)
        {
            if (customer == null) return string.Empty;
            return string.Join(", ", new[]
            {
                customer.Address,
                customer.Village,
                customer.Taluka,
                customer.District
            }.Where(p => !string.IsNullOrWhiteSpace(p))).Trim();
        }

        public static string NormalizeCaseType(string? caseType)
        {
            return string.Equals((caseType ?? "").Trim(), "SEC_91", StringComparison.OrdinalIgnoreCase)
                ? "SEC_91"
                : "SEC_101";
        }

        public static string ResolveHearingStageLabel(string? stage)
        {
            return (stage ?? string.Empty).Trim() switch
            {
                "SUMMONS" => "समन्स / नोटीस पूर्तता",
                "WRITTEN_STATEMENT" => "लेखी जबाब (WS)",
                "EVIDENCE" => "कागदपत्रे व साक्षीदार तपासणी",
                "ARGUMENTS" => "अंतिम युक्तिवाद (Arguments)",
                "ADJOURNED" => "पुढील तारखेस तहकूब (Adjourned)",
                "RESERVED_FOR_ORDER" => "आदेशासाठी राखीव (Reserved for Order)",
                "STAYED" => "स्थगिती आदेश (Stay Sec 154)",
                _ => string.IsNullOrWhiteSpace(stage) ? "सुनावणी" : stage!
            };
        }

        public static async Task<DateTime> ResolveActiveBusinessDateAsync(AppDbContext context, int branchId)
        {
            int effectiveBranch = branchId > 0 ? branchId : 1;
            var latestOpen = await context.BranchDayEndStatuses
                .AsNoTracking()
                .Where(b => b.BranchID == effectiveBranch && !b.IsDayClosed)
                .OrderByDescending(b => b.BusinessDate)
                .Select(b => (DateTime?)b.BusinessDate)
                .FirstOrDefaultAsync();
            if (latestOpen.HasValue) return latestOpen.Value.Date;

            var lastClosed = await context.BranchDayEndStatuses
                .AsNoTracking()
                .Where(b => b.BranchID == effectiveBranch && b.IsDayClosed)
                .OrderByDescending(b => b.BusinessDate)
                .Select(b => (DateTime?)b.BusinessDate)
                .FirstOrDefaultAsync();
            if (lastClosed.HasValue) return lastClosed.Value.Date.AddDays(1);

            return DateTime.Today;
        }

        public static async Task<string?> ValidateOperationalDateAsync(AppDbContext context, int branchId, DateTime txnDate)
        {
            DateTime d = txnDate.Date;
            if (d > DateTime.Today)
            {
                return $"अवैध दिनांक! भविष्यातील तारीख ({d:dd/MM/yyyy}) अनुज्ञेय नाही.";
            }

            var closedFy = await context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(fy => fy.IsClosed && d >= fy.StartDate.Date && d <= fy.EndDate.Date);
            if (closedFy != null)
            {
                return $"अवैध दिनांक! तारीख {d:dd/MM/yyyy} ही बंद केलेल्या आर्थिक वर्षात ({closedFy.YearCode}) येत असल्याने नोंद करता येत नाही.";
            }

            int effectiveBranch = branchId > 0 ? branchId : 1;
            bool isEodClosed = await context.BranchDayEndStatuses
                .AsNoTracking()
                .AnyAsync(b => b.BranchID == effectiveBranch && b.BusinessDate.Date == d && b.IsDayClosed);
            if (isEodClosed)
            {
                return $"अवैध दिनांक! शाखा क्र. #{effectiveBranch} चा दिनांक {d:dd/MM/yyyy} चा दिवस समाप्ती (EOD) आधीच बंद झाला आहे.";
            }

            return null;
        }

        public static async Task<string> BuildNextNoticeNoAsync(AppDbContext context, int branchId, string prefix, DateTime noticeDate)
        {
            string basePrefix = $"{prefix}/{branchId}/{noticeDate:yyyy}/";
            var existingNos = await context.Sec101NoticeHistories
                .AsNoTracking()
                .Where(n => n.BranchId == branchId && n.NoticeNumber.StartsWith(basePrefix))
                .Select(n => n.NoticeNumber)
                .ToListAsync();

            int maxSeq = 0;
            foreach (var nNo in existingNos)
            {
                string tail = nNo.Substring(basePrefix.Length);
                int dashIdx = tail.IndexOf('-');
                string numericPart = dashIdx >= 0 ? tail.Substring(0, dashIdx) : tail;
                if (int.TryParse(numericPart, out int parsed) && parsed > maxSeq)
                {
                    maxSeq = parsed;
                }
            }

            int candidate = maxSeq + 1;
            while (await context.Sec101NoticeHistories.AnyAsync(n => n.BranchId == branchId && n.NoticeNumber == $"{basePrefix}{candidate:D4}"))
            {
                candidate++;
            }
            return $"{basePrefix}{candidate:D4}";
        }

        public static async Task<(Voucher Voucher, LoanCollection? Collection, decimal LoanAppliedAmount, decimal SurplusAmount)> SettleExecutionRule107Async(
            AppDbContext context,
            Sec101AttachmentAuction exec,
            Sec101CaseMaster legalCase,
            LoanAccount loan,
            decimal recoveredAmount,
            string? paymentMode,
            int? bankLedgerId,
            string? referenceNo,
            DateTime settlementDate,
            int userId,
            string? remarks)
        {
            if (recoveredAmount <= 0)
            {
                throw new InvalidOperationException("लिलाव / जप्ती वसुली रक्कम शून्यापेक्षा जास्त असणे आवश्यक आहे.");
            }

            string mode = string.IsNullOrWhiteSpace(paymentMode) ? "CASH" : paymentMode.Trim();
            bool isBank = BankLedgerHelper.IsBankPaymentMode(mode);
            int branchId = legalCase.BranchId > 0 ? legalCase.BranchId : loan.BranchID;

            int debitCashOrBankLedgerId;
            if (isBank)
            {
                var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(context, bankLedgerId);
                if (!bankCheck.IsValid) throw new InvalidOperationException(bankCheck.ErrorMessage);
                debitCashOrBankLedgerId = bankCheck.LedgerId;
            }
            else
            {
                debitCashOrBankLedgerId = await CashLedgerHelper.GetCashLedgerIdAsync(context, branchId, "LEGAL");
                if (debitCashOrBankLedgerId <= 0)
                {
                    throw new InvalidOperationException("या शाखेसाठी रोख खाते सापडले नाही. कृपया शाखा मास्टरमध्ये रोख खाते तपासा.");
                }
            }

            var loanRate = await context.LoanRates.AsNoTracking().FirstOrDefaultAsync(r => r.LoanRateID == loan.LoanRateID);
            if (loanRate == null || !loanRate.LoanLedgerID.HasValue || loanRate.LoanLedgerID.Value <= 0)
            {
                throw new InvalidOperationException("कर्ज योजनेचे मुद्दल लेजर (Loan Ledger) मॅप केलेले नाही.");
            }

            decimal unpaidExpenses = await context.OverdueRecoveryLedgers
                .Where(o => o.LoanAccountID == loan.LoanAccountID)
                .SumAsync(o => (decimal?)(o.DebitAmount - o.CreditAmount)) ?? 0m;
            if (unpaidExpenses < 0) unpaidExpenses = 0m;

            decimal remaining = recoveredAmount;
            decimal expensesPaid = Math.Min(remaining, unpaidExpenses);
            remaining -= expensesPaid;

            decimal penaltyPaid = Math.Min(remaining, Math.Max(0m, loan.OverdueInterestBalance));
            remaining -= penaltyPaid;

            decimal interestPaid = Math.Min(remaining, Math.Max(0m, loan.InterestBalance));
            remaining -= interestPaid;

            decimal principalPaid = Math.Min(remaining, Math.Max(0m, loan.PrincipalBalance));
            remaining -= principalPaid;

            decimal surplusAmount = Math.Round(remaining, 2, MidpointRounding.AwayFromZero);
            decimal loanAppliedAmount = recoveredAmount - surplusAmount;

            int? recoveryExpenseLedgerId = null;
            if (expensesPaid > 0)
            {
                var expMap = await context.LegalRecoveryLedgerMappings
                    .AsNoTracking()
                    .Where(m => (m.BranchId == branchId || m.BranchId == null || m.BranchId == 0) &&
                                (m.TransactionType == "COURT_FEE" || m.TransactionType == "NOTICE_FEE" || m.TransactionType == "OTHER_LEGAL") &&
                                m.IsActive)
                    .OrderByDescending(m => m.BranchId.HasValue && m.BranchId.Value > 0 ? 1 : 0)
                    .FirstOrDefaultAsync();
                recoveryExpenseLedgerId = loanRate.RecoveryFeeLedgerID ?? expMap?.DebitLedgerId;
                if (!recoveryExpenseLedgerId.HasValue || recoveryExpenseLedgerId.Value <= 0)
                {
                    throw new InvalidOperationException("वसूल होणाऱ्या कायदेशीर खर्चासाठी लेजर (RecoveryFeeLedgerID / Legal Mapping) कॉन्फिगर केलेले नाही.");
                }
            }

            int? penaltyLedgerId = penaltyPaid > 0 ? (loanRate.OverdueInterestLedgerID ?? loanRate.InterestLedgerID) : null;
            if (penaltyPaid > 0 && (!penaltyLedgerId.HasValue || penaltyLedgerId.Value <= 0))
            {
                throw new InvalidOperationException("कर्ज योजनेचे दंड/थकीत व्याज लेजर मॅप केलेले नाही.");
            }

            int? interestLedgerId = interestPaid > 0 ? (loanRate.ReceivableInterestLedgerID ?? loanRate.InterestLedgerID) : null;
            if (interestPaid > 0 && (!interestLedgerId.HasValue || interestLedgerId.Value <= 0))
            {
                throw new InvalidOperationException("कर्ज योजनेचे येणे/व्याज उत्पन्न लेजर मॅप केलेले नाही.");
            }

            int? surplusLedgerId = null;
            if (surplusAmount > 0)
            {
                var surplusMap = await context.LegalRecoveryLedgerMappings
                    .AsNoTracking()
                    .Where(m => (m.BranchId == branchId || m.BranchId == null || m.BranchId == 0) &&
                                (m.TransactionType == "BORROWER_SURPLUS_PAYABLE" || m.TransactionType == "AUCTION_SUSPENSE") &&
                                m.IsActive)
                    .OrderByDescending(m => m.BranchId.HasValue && m.BranchId.Value > 0 ? 1 : 0)
                    .FirstOrDefaultAsync();
                surplusLedgerId = surplusMap?.CreditLedgerId ?? surplusMap?.DebitLedgerId;
                if (!surplusLedgerId.HasValue || surplusLedgerId.Value <= 0)
                {
                    throw new InvalidOperationException("लिलाव अतिरिक्त रक्कम (Surplus ₹" + surplusAmount.ToString("N2") + ") ठेवण्यासाठी BORROWER_SURPLUS_PAYABLE किंवा AUCTION_SUSPENSE लेजर मॅपिंग आवश्यक आहे.");
                }
            }

            int? customerId = ResolveLoanCustomerId(loan);
            int? memberId = loan.MemberID.HasValue && loan.MemberID.Value > 0 ? loan.MemberID.Value : null;

            string voucherNo = await VoucherNumberHelper.NextVoucherNoAsync(context, $"REC-107-{branchId}-{settlementDate:yyyyMMdd}-", 4);
            string narration = string.IsNullOrWhiteSpace(remarks)
                ? $"नियम १०७ लिलाव/जप्ती वसुली - केस {legalCase.CaseNumber} ({loan.LoanAccountNo}){(string.IsNullOrWhiteSpace(referenceNo) ? "" : $" Ref:{referenceNo.Trim()}")}"
                : remarks.Trim();

            var voucher = new Voucher
            {
                BranchID = branchId,
                VoucherNo = voucherNo,
                VoucherDate = settlementDate.Date,
                VoucherType = "Receipt",
                Status = "Pending",
                TotalAmount = recoveredAmount,
                Narration = narration.Length > 500 ? narration.Substring(0, 500) : narration,
                CreatedBy = userId > 0 ? userId : 1,
                CreatedOn = DateTime.UtcNow,
                VoucherDetails = new List<VoucherDetail>()
            };

            voucher.VoucherDetails.Add(new VoucherDetail
            {
                LedgerID = debitCashOrBankLedgerId,
                CustomerID = customerId,
                MemberID = memberId,
                DrCr = "Dr",
                Amount = recoveredAmount
            });

            if (expensesPaid > 0 && recoveryExpenseLedgerId.HasValue)
            {
                voucher.VoucherDetails.Add(new VoucherDetail
                {
                    LedgerID = recoveryExpenseLedgerId.Value,
                    CustomerID = customerId,
                    MemberID = memberId,
                    DrCr = "Cr",
                    Amount = expensesPaid
                });
            }
            if (penaltyPaid > 0 && penaltyLedgerId.HasValue)
            {
                voucher.VoucherDetails.Add(new VoucherDetail
                {
                    LedgerID = penaltyLedgerId.Value,
                    CustomerID = customerId,
                    MemberID = memberId,
                    DrCr = "Cr",
                    Amount = penaltyPaid
                });
            }
            if (interestPaid > 0 && interestLedgerId.HasValue)
            {
                voucher.VoucherDetails.Add(new VoucherDetail
                {
                    LedgerID = interestLedgerId.Value,
                    CustomerID = customerId,
                    MemberID = memberId,
                    DrCr = "Cr",
                    Amount = interestPaid
                });
            }
            if (principalPaid > 0)
            {
                voucher.VoucherDetails.Add(new VoucherDetail
                {
                    LedgerID = loanRate.LoanLedgerID.Value,
                    CustomerID = customerId,
                    MemberID = memberId,
                    DrCr = "Cr",
                    Amount = principalPaid
                });
            }
            if (surplusAmount > 0 && surplusLedgerId.HasValue)
            {
                voucher.VoucherDetails.Add(new VoucherDetail
                {
                    LedgerID = surplusLedgerId.Value,
                    CustomerID = customerId,
                    MemberID = memberId,
                    DrCr = "Cr",
                    Amount = surplusAmount
                });
            }

            VoucherBalanceHelper.EnsureBalanced(voucher);
            context.Vouchers.Add(voucher);
            await context.SaveChangesAsync();

            LoanCollection? collection = null;
            if (loanAppliedAmount > 0)
            {
                collection = new LoanCollection
                {
                    LoanAccountID = loan.LoanAccountID,
                    BranchID = branchId,
                    HomeBranchID = loan.BranchID,
                    CreatedByUserID = userId > 0 ? userId : 1,
                    CollectionDate = settlementDate.Date,
                    ReceiptNo = voucherNo,
                    TotalAmountReceived = loanAppliedAmount,
                    PenaltyInterestCollected = penaltyPaid,
                    ReceivableInterestCollected = loanRate.ReceivableInterestLedgerID.HasValue ? interestPaid : 0m,
                    InterestCollected = loanRate.ReceivableInterestLedgerID.HasValue ? 0m : interestPaid,
                    PrincipalCollected = principalPaid,
                    PaymentMode = isBank ? "Bank" : "Cash",
                    BankAccountLedgerID = isBank ? debitCashOrBankLedgerId : null,
                    ChequeNo = referenceNo,
                    VoucherID = voucher.VoucherID,
                    CollectionSource = "RULE107",
                    Remarks = narration.Length > 200 ? narration.Substring(0, 200) : narration
                };
                context.LoanCollections.Add(collection);
            }

            if (expensesPaid > 0)
            {
                context.OverdueRecoveryLedgers.Add(new OverdueRecoveryLedger
                {
                    LoanAccountID = loan.LoanAccountID,
                    TransactionDate = settlementDate.Date,
                    DebitAmount = 0m,
                    CreditAmount = expensesPaid,
                    VoucherID = voucher.VoucherID,
                    Particulars = $"नियम १०७ लिलाव वसुली ({voucherNo})"
                });
            }

            loan.OverdueInterestBalance = Math.Max(0m, loan.OverdueInterestBalance - penaltyPaid);
            loan.InterestBalance = Math.Max(0m, loan.InterestBalance - interestPaid);
            loan.PrincipalBalance = Math.Max(0m, loan.PrincipalBalance - principalPaid);
            if (loan.PrincipalBalance <= 0 && loan.InterestBalance <= 0 && loan.OverdueInterestBalance <= 0)
            {
                loan.Status = "Closed";
                legalCase.Status = "CLOSED_RECOVERED";
                legalCase.ClosedDate = settlementDate.Date;
                legalCase.ClosedReason = $"नियम १०७ लिलाव/जप्ती वसुलीद्वारे पूर्ण रक्कम वसूल (व्हाउचर: {voucherNo})";
            }

            exec.HighestBidAmount = exec.HighestBidAmount > 0 ? exec.HighestBidAmount : recoveredAmount;
            exec.SurplusAmount = surplusAmount;
            exec.SettlementVoucherId = voucher.VoucherID;
            exec.Status = "SETTLED";
            if (!string.IsNullOrWhiteSpace(remarks))
            {
                exec.Remarks = string.IsNullOrWhiteSpace(exec.Remarks) ? remarks.Trim() : $"{exec.Remarks} | {remarks.Trim()}";
            }

            await context.SaveChangesAsync();
            return (voucher, collection, loanAppliedAmount, surplusAmount);
        }

        public static async Task<object?> BuildCustomerLegalTrackerAsync(
            AppDbContext context,
            int? customerId,
            int? branchId,
            int? loanAccountId,
            DateTime referenceDate)
        {
            int effectiveCustomerId = customerId ?? 0;
            if (effectiveCustomerId <= 0 && loanAccountId.HasValue && loanAccountId.Value > 0)
            {
                var targetLoan = await context.LoanAccounts
                    .Include(l => l.Member)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(l => l.LoanAccountID == loanAccountId.Value);
                if (targetLoan != null)
                {
                    effectiveCustomerId = ResolveLoanCustomerId(targetLoan) ?? 0;
                }
            }

            if (effectiveCustomerId <= 0) return null;

            var customer = await context.Customers
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.CustomerID == effectiveCustomerId);
            if (customer == null) return null;

            var loansQuery = context.LoanAccounts
                .AsNoTracking()
                .AsSplitQuery()
                .Include(l => l.Customer)
                .Include(l => l.Member)
                .Include(l => l.LoanRate)
                .Include(l => l.Branch)
                .Include(l => l.Guarantor1Customer)
                .Include(l => l.Guarantor2Customer)
                .Include(l => l.CoCustomer)
                .Include(l => l.CoCustomer2)
                .Where(l => l.CustomerID == effectiveCustomerId || (l.Member != null && l.Member.CustomerID == effectiveCustomerId));

            if (branchId.HasValue && branchId.Value > 0)
            {
                loansQuery = loansQuery.Where(l => l.BranchID == branchId.Value);
            }
            if (loanAccountId.HasValue && loanAccountId.Value > 0)
            {
                loansQuery = loansQuery.Where(l => l.LoanAccountID == loanAccountId.Value);
            }

            var loans = await loansQuery.OrderByDescending(l => l.OpeningDate).ToListAsync();
            var loanIds = loans.Select(l => l.LoanAccountID).ToList();

            var notices = loanIds.Any()
                ? await context.Sec101NoticeHistories.AsNoTracking()
                    .Where(n => loanIds.Contains(n.LoanAccountId) || n.CustomerId == effectiveCustomerId)
                    .OrderBy(n => n.NoticeDate).ThenBy(n => n.NoticeId)
                    .ToListAsync()
                : new List<Sec101NoticeHistory>();

            var cases = loanIds.Any()
                ? await context.Sec101CaseMasters.AsNoTracking()
                    .AsSplitQuery()
                    .Include(c => c.HearingLogs)
                    .Include(c => c.Executions)
                    .Include(c => c.LegalExpenses)
                    .Where(c => loanIds.Contains(c.LoanAccountId) || c.CustomerId == effectiveCustomerId)
                    .OrderByDescending(c => c.FilingDate)
                    .ToListAsync()
                : new List<Sec101CaseMaster>();

            var allExpenses = loanIds.Any()
                ? await context.Sec101LegalExpenses.AsNoTracking()
                    .Include(e => e.Voucher)
                    .Where(e => loanIds.Contains(e.LoanAccountId) || e.CustomerId == effectiveCustomerId)
                    .OrderBy(e => e.ExpenseDate)
                    .ToListAsync()
                : new List<Sec101LegalExpense>();

            var settlementVIds = cases.SelectMany(c => c.Executions)
                .Where(e => e.SettlementVoucherId.HasValue && e.SettlementVoucherId.Value > 0)
                .Select(e => e.SettlementVoucherId!.Value)
                .Distinct()
                .ToList();
            var settlementVouchers = settlementVIds.Any()
                ? await context.Vouchers.AsNoTracking()
                    .Where(v => settlementVIds.Contains(v.VoucherID))
                    .ToDictionaryAsync(v => v.VoucherID)
                : new Dictionary<int, Voucher>();

            var overdueRows = loanIds.Any()
                ? await context.OverdueRecoveryLedgers.AsNoTracking()
                    .Where(o => loanIds.Contains(o.LoanAccountID))
                    .ToListAsync()
                : new List<OverdueRecoveryLedger>();

            var loanCollections = loanIds.Any()
                ? await context.LoanCollections.AsNoTracking()
                    .Where(c => loanIds.Contains(c.LoanAccountID))
                    .OrderBy(c => c.CollectionDate)
                    .ToListAsync()
                : new List<LoanCollection>();

            var npaRows = loanIds.Any()
                ? await context.LoanAccountNpaStatuses.AsNoTracking()
                    .Where(n => loanIds.Contains(n.LoanAccountID))
                    .ToListAsync()
                : new List<LoanAccountNpaStatus>();
            var npaStatuses = npaRows
                .GroupBy(n => n.LoanAccountID)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.AsOfDate).ThenByDescending(x => x.LoanAccountNpaStatusID).First());

            var trackedLoans = new List<object>();

            foreach (var l in loans)
            {
                var lNotices = notices.Where(n => n.LoanAccountId == l.LoanAccountID).ToList();
                var lCases = cases.Where(c => c.LoanAccountId == l.LoanAccountID).ToList();
                var lExpenses = allExpenses.Where(e => e.LoanAccountId == l.LoanAccountID).ToList();
                var lOverdue = overdueRows.Where(o => o.LoanAccountID == l.LoanAccountID).ToList();
                var lCollections = loanCollections.Where(c => c.LoanAccountID == l.LoanAccountID).ToList();
                npaStatuses.TryGetValue(l.LoanAccountID, out var npaInfo);

                decimal approvedExpenseDebits = lOverdue.Sum(o => o.DebitAmount);
                decimal recoveredExpenses = lOverdue.Sum(o => o.CreditAmount);
                decimal netUnpaidExpenses = Math.Max(0m, approvedExpenseDebits - recoveredExpenses);
                decimal pendingExpensesTotal = lExpenses.Where(e => e.IsDebitedToLoan && (e.Voucher == null || e.Voucher.Status != "Approved")).Sum(e => e.Amount);
                decimal bankBorneExpenses = lExpenses.Where(e => !e.IsDebitedToLoan).Sum(e => e.Amount);

                var activeCase = lCases.FirstOrDefault(c => c.Status != "DISMISSED" && c.Status != "WITHDRAWN") ?? lCases.FirstOrDefault();
                var finalNotice = lNotices.Where(n => n.NoticeType == "FINAL_NOTICE" || n.NoticeType == "SRO_DEMAND").OrderByDescending(n => n.NoticeDate).FirstOrDefault()
                                  ?? lNotices.OrderByDescending(n => n.NoticeDate).FirstOrDefault();
                int daysSinceLastNotice = finalNotice != null ? Math.Max(0, (referenceDate.Date - finalNotice.NoticeDate.Date).Days) : 0;

                var allHearings = activeCase?.HearingLogs.OrderBy(h => h.HearingDate).ToList() ?? new List<Sec101HearingLog>();
                var latestHearing = allHearings.OrderByDescending(h => h.HearingDate).ThenByDescending(h => h.HearingId).FirstOrDefault();
                var allExecutions = activeCase?.Executions.OrderBy(e => e.CreatedAt).ToList() ?? new List<Sec101AttachmentAuction>();
                var latestExec = allExecutions.OrderByDescending(e => e.CreatedAt).FirstOrDefault();

                bool isMatured = l.MaturityDate.HasValue && l.MaturityDate.Value.Date < referenceDate.Date;
                bool isNpaAccount = npaInfo != null && !string.Equals(npaInfo.Category, "Standard", StringComparison.OrdinalIgnoreCase);
                bool isOverdueOrNpa = l.OverdueInterestBalance > 0 || isNpaAccount || isMatured || lNotices.Any() || lCases.Any();

                // Build 8-Stage Lifecycle Progress Stepper
                var stages = new List<object>
                {
                    new
                    {
                        StageNo = 1,
                        StageKey = "OVERDUE_NPA",
                        Title = "थकबाकी / NPA पात्रता",
                        Status = (l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance) <= 0 ? "COMPLETED" : (isOverdueOrNpa ? "COMPLETED" : "PENDING"),
                        CompletedDate = l.MaturityDate?.ToString("yyyy-MM-dd"),
                        Details = $"मुद्दल: ₹{l.PrincipalBalance:N0} | व्याज: ₹{l.InterestBalance:N0} | दंड: ₹{l.OverdueInterestBalance:N0}" + (isNpaAccount ? $" | NPA: {npaInfo!.Category}" : ""),
                        ActionTab = "notices"
                    },
                    new
                    {
                        StageNo = 2,
                        StageKey = "NOTICES",
                        Title = "कायदेशीर नोटीस टप्पा",
                        Status = lNotices.Any()
                            ? (activeCase != null || (finalNotice != null && daysSinceLastNotice >= 15) ? "COMPLETED" : "IN_PROGRESS")
                            : "PENDING",
                        CompletedDate = finalNotice?.NoticeDate.ToString("yyyy-MM-dd"),
                        Details = lNotices.Any()
                            ? $"{lNotices.Count} नोटीस (शेवटची: {finalNotice!.NoticeType} - {finalNotice.PostalStatus}, {daysSinceLastNotice} दिवस पूर्ण)"
                            : "अद्याप कोणतीही नोटीस जारी केलेली नाही.",
                        ActionTab = "notices"
                    },
                    new
                    {
                        StageNo = 3,
                        StageKey = "CASE_FILED",
                        Title = activeCase?.CaseType == "SEC_91" ? "कलम ९१ सहकार न्यायालय दावा" : "कलम १०१ दावा दाखल",
                        Status = activeCase != null ? "COMPLETED" : (finalNotice != null && daysSinceLastNotice < 15 ? "WARNING" : "PENDING"),
                        CompletedDate = activeCase?.FilingDate.ToString("yyyy-MM-dd"),
                        Details = activeCase != null
                            ? $"दावा क्र. {activeCase.CaseNumber} ({(activeCase.CaseType == "SEC_91" ? "कलम ९१" : "कलम १०१")}) | मागणी: ₹{activeCase.TotalClaimAmount:N0}"
                            : (finalNotice != null && daysSinceLastNotice < 15 ? $"अंतिम नोटीसला अद्याप {daysSinceLastNotice}/१५ दिवस झाले आहेत." : "दावा दाखल करणे बाकी."),
                        ActionTab = "filing"
                    },
                    new
                    {
                        StageNo = 4,
                        StageKey = "HEARINGS",
                        Title = "सुनावणी टप्पे (Hearings)",
                        Status = activeCase == null
                            ? "PENDING"
                            : (activeCase.CertificateDate.HasValue || activeCase.AwardDate.HasValue || activeCase.Status == "CERTIFICATE_ISSUED" || activeCase.Status == "EXECUTION_RULE107" || activeCase.Status == "CLOSED_RECOVERED"
                                ? "COMPLETED"
                                : (allHearings.Any() ? "IN_PROGRESS" : "PENDING")),
                        CompletedDate = latestHearing?.HearingDate.ToString("yyyy-MM-dd"),
                        Details = allHearings.Any()
                            ? $"एकूण {allHearings.Count} सुनावण्या | टप्पा: {ResolveHearingStageLabel(latestHearing?.Stage)}" + (latestHearing?.NextHearingDate != null ? $" | पुढील: {latestHearing.NextHearingDate:dd/MM/yyyy}" : "")
                            : "सुनावणी नोंद अद्याप नाही.",
                        ActionTab = "hearings"
                    },
                    new
                    {
                        StageNo = 5,
                        StageKey = "CERTIFICATE_AWARD",
                        Title = activeCase?.CaseType == "SEC_91" ? "निवाडा व कलम ९८ दाखला" : "कलम १०१ वसुली दाखला",
                        Status = activeCase != null && (!string.IsNullOrWhiteSpace(activeCase.CertificateNo) || !string.IsNullOrWhiteSpace(activeCase.AwardNumber) || activeCase.Status == "CERTIFICATE_ISSUED" || activeCase.Status == "EXECUTION_RULE107" || activeCase.Status == "CLOSED_RECOVERED")
                            ? "COMPLETED"
                            : "PENDING",
                        CompletedDate = (activeCase?.CertificateDate ?? activeCase?.AwardDate)?.ToString("yyyy-MM-dd"),
                        Details = activeCase != null && (!string.IsNullOrWhiteSpace(activeCase.CertificateNo) || !string.IsNullOrWhiteSpace(activeCase.AwardNumber))
                            ? $"क्र. {(activeCase.CertificateNo ?? activeCase.AwardNumber)} | मंजूर: ₹{(activeCase.SanctionedAmount ?? 0m):N0} ({(activeCase.FutureInterestRate ?? 0m)}%)"
                            : "वसुली दाखला / निवाडा नोंद बाकी.",
                        ActionTab = "hearings"
                    },
                    new
                    {
                        StageNo = 6,
                        StageKey = "EXECUTION_RULE107",
                        Title = "नियम १०७ जप्ती व लिलाव",
                        Status = !allExecutions.Any()
                            ? "PENDING"
                            : (allExecutions.Any(e => e.Status == "SETTLED") ? "COMPLETED" : "IN_PROGRESS"),
                        CompletedDate = latestExec?.SaleCertificateDate?.ToString("yyyy-MM-dd") ?? latestExec?.WarrantIssueDate?.ToString("yyyy-MM-dd"),
                        Details = latestExec != null
                            ? $"{latestExec.ExecutionType} ({latestExec.Status})" + (latestExec.HighestBidAmount > 0 ? $" | बोली: ₹{latestExec.HighestBidAmount:N0}" : "")
                            : "जप्ती / पगार कपात कारवाई नाही.",
                        ActionTab = "executions"
                    },
                    new
                    {
                        StageNo = 7,
                        StageKey = "EXPENSES_RECOVERY",
                        Title = "कायदेशीर खर्च व वसुली ताळमेळ",
                        Status = pendingExpensesTotal > 0 ? "WARNING" : (lExpenses.Any() && netUnpaidExpenses <= 0 ? "COMPLETED" : (lExpenses.Any() ? "IN_PROGRESS" : "PENDING")),
                        CompletedDate = lCollections.LastOrDefault()?.CollectionDate.ToString("yyyy-MM-dd"),
                        Details = $"मंजूर देय खर्च: ₹{approvedExpenseDebits:N0} | वसूल: ₹{recoveredExpenses:N0} | बाकी: ₹{netUnpaidExpenses:N0}" + (pendingExpensesTotal > 0 ? $" | प्रलंबित पासिंग: ₹{pendingExpensesTotal:N0}" : ""),
                        ActionTab = "reports"
                    },
                    new
                    {
                        StageNo = 8,
                        StageKey = "CLOSURE",
                        Title = "अंतिम निष्कर्ष / प्रकरण बंद",
                        Status = activeCase != null && (activeCase.Status == "CLOSED_RECOVERED" || activeCase.Status == "DISMISSED" || activeCase.Status == "WITHDRAWN")
                            ? "COMPLETED"
                            : (activeCase?.Status == "STAYED" ? "WARNING" : (l.Status == "Closed" ? "COMPLETED" : "PENDING")),
                        CompletedDate = activeCase?.ClosedDate?.ToString("yyyy-MM-dd"),
                        Details = activeCase?.Status switch
                        {
                            "CLOSED_RECOVERED" => $"प्रकरण पूर्ण वसुलीने बंद ({activeCase.ClosedReason ?? "Settled"})",
                            "STAYED" => $"अपील स्थगिती (Stay क्र. {activeCase.StayOrderNo ?? "-"})",
                            "DISMISSED" => "प्रकरण फेटाळले / निकाली",
                            "WITHDRAWN" => "प्रकरण मागे घेतले (OTS / तडजोड)",
                            _ => l.Status == "Closed" ? "कर्ज खाते बंद" : "वसुली प्रक्रिया सुरू आहे"
                        },
                        ActionTab = "overview"
                    }
                };

                string nextActionText;
                string nextActionTab;
                if (activeCase == null && !lNotices.Any())
                {
                    nextActionText = "कलम १०१ / डिमांड नोटीस क्र. १ जारी करा";
                    nextActionTab = "notices";
                }
                else if (activeCase == null && finalNotice != null && daysSinceLastNotice < 15)
                {
                    nextActionText = $"नोटीस मुदत ({daysSinceLastNotice}/१५ दिवस) पूर्ण झाल्यावर दावा दाखल करा";
                    nextActionTab = "notices";
                }
                else if (activeCase == null)
                {
                    nextActionText = "कलम १०१ / ९१ दावा अर्ज दाखल करा";
                    nextActionTab = "filing";
                }
                else if (pendingExpensesTotal > 0)
                {
                    nextActionText = $"₹{pendingExpensesTotal:N0} चे कायदेशीर खर्च व्हाउचर पासिंगमधून मंजूर करा";
                    nextActionTab = "voucher-posting";
                }
                else if (activeCase.Status == "FILED" || activeCase.Status == "HEARING")
                {
                    nextActionText = "सुनावणी नोंदवा किंवा वसुली दाखला / निवाडा नोंदवा";
                    nextActionTab = "hearings";
                }
                else if (activeCase.Status == "CERTIFICATE_ISSUED")
                {
                    nextActionText = "नियम १०७ अंतर्गत पगार कपात किंवा जप्ती/लिलाव सुरू करा";
                    nextActionTab = "executions";
                }
                else if (activeCase.Status == "EXECUTION_RULE107")
                {
                    nextActionText = "पंचनामा / लिलाव पूर्ण करून वसुली सेटलमेंट व्हाउचर नोंदवा";
                    nextActionTab = "executions";
                }
                else
                {
                    nextActionText = "प्रकरण निकाली / पूर्ण";
                    nextActionTab = "reports";
                }

                // Chronological Timeline Events
                var timeline = new List<(DateTime Date, int SortOrder, string Category, string Title, string Description, decimal? Amount, string? VoucherNo, string? VoucherStatus)>();
                foreach (var n in lNotices)
                {
                    timeline.Add((n.NoticeDate, 1, "NOTICE", $"नोटीस ({n.NoticeType} - {n.RecipientType}): {n.NoticeNumber}", $"टपाल स्थिती: {n.PostalStatus}" + (string.IsNullOrWhiteSpace(n.PostalTrackingNo) ? "" : $" | RPAD: {n.PostalTrackingNo}"), n.TotalDemandAmount, null, null));
                    if (n.DeliveredDate.HasValue)
                    {
                        timeline.Add((n.DeliveredDate.Value, 2, "DELIVERY", $"नोटीस पोहोच ({n.NoticeNumber})", $"स्थिती: {n.PostalStatus}", null, null, null));
                    }
                }
                foreach (var c in lCases)
                {
                    timeline.Add((c.FilingDate, 3, "CASE", $"{(c.CaseType == "SEC_91" ? "कलम ९१" : "कलम १०१")} दावा दाखल: {c.CaseNumber}", $"{c.CourtName} | वकील: {c.AdvocateName ?? "-"}", c.TotalClaimAmount, null, null));
                    foreach (var h in c.HearingLogs.OrderBy(h => h.HearingDate))
                    {
                        timeline.Add((h.HearingDate, 4, "HEARING", $"सुनावणी ({ResolveHearingStageLabel(h.Stage)})", (h.CourtOrderSummary ?? h.AdvocateNotes ?? "-") + (h.NextHearingDate.HasValue ? $" | पुढील: {h.NextHearingDate:dd/MM/yyyy} ({h.NextHearingPurpose ?? ""})" : ""), null, null, null));
                    }
                    if (c.CertificateDate.HasValue || c.AwardDate.HasValue)
                    {
                        DateTime certDt = c.CertificateDate ?? c.AwardDate ?? c.FilingDate;
                        timeline.Add((certDt, 5, "CERTIFICATE", $"{(c.CaseType == "SEC_91" ? "निवाडा" : "वसुली दाखला")}: {c.CertificateNo ?? c.AwardNumber}", $"पुढील व्याजदर: {c.FutureInterestRate ?? 0}%", c.SanctionedAmount, null, null));
                    }
                    foreach (var ex in c.Executions.OrderBy(e => e.CreatedAt))
                    {
                        DateTime exDt = ex.WarrantIssueDate ?? ex.CreatedAt;
                        settlementVouchers.TryGetValue(ex.SettlementVoucherId ?? 0, out var sv);
                        timeline.Add((exDt, 6, "EXECUTION", $"नियम १०७ ({ex.ExecutionType}): {ex.Status}", ex.EmployerName ?? ex.PropertyDetails ?? "-", ex.HighestBidAmount > 0 ? ex.HighestBidAmount : ex.MonthlyDeductionAmount, sv?.VoucherNo, sv?.Status));
                    }
                    if (c.ClosedDate.HasValue)
                    {
                        timeline.Add((c.ClosedDate.Value, 8, "CLOSURE", $"प्रकरण स्थिती: {c.Status}", c.ClosedReason ?? "-", null, null, null));
                    }
                }
                foreach (var exp in lExpenses)
                {
                    timeline.Add((exp.ExpenseDate, 4, "EXPENSE", $"कायदेशीर खर्च ({exp.ExpenseType})", $"{exp.PaidTo ?? "-"} | {(exp.IsDebitedToLoan ? "कर्जदार नावे" : "संस्था खर्च")}", exp.Amount, exp.Voucher?.VoucherNo, exp.Voucher?.Status));
                }
                foreach (var col in lCollections)
                {
                    timeline.Add((col.CollectionDate, 7, "COLLECTION", $"कर्ज वसुली पावती: {col.ReceiptNo ?? $"COL-{col.LoanCollectionID}"}", $"मुद्दल: ₹{col.PrincipalCollected:N0} | व्याज: ₹{(col.InterestCollected + col.ReceivableInterestCollected):N0} | दंड: ₹{col.PenaltyInterestCollected:N0}", col.TotalAmountReceived, col.ReceiptNo, "Approved"));
                }

                var g1 = l.Guarantor1Customer ?? l.CoCustomer;
                var g2 = l.Guarantor2Customer ?? l.CoCustomer2;

                trackedLoans.Add(new
                {
                    l.LoanAccountID,
                    l.LoanAccountNo,
                    LegacyLoanNo = l.LegacyAccountNumber,
                    l.BranchID,
                    BranchName = l.Branch?.BranchName ?? "",
                    LoanScheme = l.LoanRate?.LoanType ?? "",
                    l.Status,
                    OpeningDate = l.OpeningDate.ToString("yyyy-MM-dd"),
                    MaturityDate = l.MaturityDate?.ToString("yyyy-MM-dd"),
                    l.PrincipalBalance,
                    l.InterestBalance,
                    l.OverdueInterestBalance,
                    NetUnpaidLegalExpenses = netUnpaidExpenses,
                    PendingLegalExpenses = pendingExpensesTotal,
                    BankBorneLegalExpenses = bankBorneExpenses,
                    TotalRecoverableDues = l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance + netUnpaidExpenses,
                    Guarantor1 = g1 != null ? new { g1.CustomerID, g1.CIFNo, FullName = FormatCustomerName(g1), g1.MobileNo } : null,
                    Guarantor2 = g2 != null ? new { g2.CustomerID, g2.CIFNo, FullName = FormatCustomerName(g2), g2.MobileNo } : null,
                    ActiveCase = activeCase != null ? new
                    {
                        activeCase.CaseId,
                        activeCase.CaseType,
                        activeCase.CaseNumber,
                        activeCase.CourtName,
                        activeCase.AdvocateName,
                        FilingDate = activeCase.FilingDate.ToString("yyyy-MM-dd"),
                        activeCase.TotalClaimAmount,
                        activeCase.CourtFeeAmount,
                        activeCase.Status,
                        activeCase.CertificateNo,
                        CertificateDate = activeCase.CertificateDate?.ToString("yyyy-MM-dd"),
                        activeCase.SanctionedAmount,
                        activeCase.FutureInterestRate,
                        activeCase.AwardNumber,
                        AwardDate = activeCase.AwardDate?.ToString("yyyy-MM-dd"),
                        activeCase.StayOrderNo,
                        activeCase.ClosedReason
                    } : null,
                    NoticesCount = lNotices.Count,
                    HearingsCount = allHearings.Count,
                    ExecutionsCount = allExecutions.Count,
                    Stages = stages,
                    NextRecommendedAction = nextActionText,
                    NextActionTab = nextActionTab,
                    Timeline = timeline
                        .OrderByDescending(t => t.Date)
                        .ThenByDescending(t => t.SortOrder)
                        .Select(t => new
                        {
                            Date = t.Date.ToString("yyyy-MM-dd"),
                            t.Category,
                            t.Title,
                            t.Description,
                            t.Amount,
                            t.VoucherNo,
                            t.VoucherStatus
                        })
                        .ToList()
                });
            }

            return new
            {
                Customer = new
                {
                    customer.CustomerID,
                    customer.CIFNo,
                    customer.LegacyCustomerNo,
                    FullName = FormatCustomerName(customer),
                    customer.MobileNo,
                    Address = FormatCustomerAddress(customer),
                    customer.BranchID
                },
                Summary = new
                {
                    TotalLoans = loans.Count,
                    TotalCases = cases.Count,
                    ActiveCases = cases.Count(c => c.Status != "CLOSED_RECOVERED" && c.Status != "DISMISSED" && c.Status != "WITHDRAWN"),
                    TotalNotices = notices.Count,
                    PendingVoucherExpenses = allExpenses.Count(e => e.Voucher != null && e.Voucher.Status != "Approved"),
                    TotalApprovedLegalExpenses = overdueRows.Sum(o => o.DebitAmount),
                    TotalRecoveredLegalExpenses = overdueRows.Sum(o => o.CreditAmount),
                    TotalUnpaidLegalExpenses = Math.Max(0m, overdueRows.Sum(o => o.DebitAmount - o.CreditAmount)),
                    TotalLoanOutstanding = loans.Sum(l => l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance)
                },
                Loans = trackedLoans
            };
        }
    }
}
