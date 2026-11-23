using System;
using System.Collections.Generic;
using System.Linq;
using Bhisi.Api.Models;

namespace Bhisi.Api.Services
{
    public class BorrowingScheduleInput
    {
        public decimal PrincipalAmount { get; set; }
        public decimal AnnualInterestRate { get; set; }
        public string InstallmentType { get; set; } = "EMI"; // EMI | EqualPrincipal | Flat | Bullet
        public string InstallmentFrequency { get; set; } = "Monthly"; // Monthly | Quarterly | HalfYearly | Yearly | Bullet
        public int TenureMonths { get; set; } = 12;
        public int TotalInstallments { get; set; } = 0;
        public int MoratoriumMonths { get; set; } = 0;
        public DateTime DisbursementDate { get; set; } = DateTime.Today;
        public DateTime? FirstInstallmentDueDate { get; set; }
        public decimal? CustomInstallmentAmount { get; set; }
    }

    public static class BorrowingScheduleService
    {
        public static int ResolveStepMonths(string? frequency, int tenureMonths)
        {
            string f = (frequency ?? "Monthly").Trim();
            if (f.Equals("Quarterly", StringComparison.OrdinalIgnoreCase) || f.Contains("त्रैमासिक")) return 3;
            if (f.Equals("HalfYearly", StringComparison.OrdinalIgnoreCase) || f.Contains("सहामाही")) return 6;
            if (f.Equals("Yearly", StringComparison.OrdinalIgnoreCase) || f.Contains("वार्षिक")) return 12;
            if (f.Equals("Bullet", StringComparison.OrdinalIgnoreCase) || f.Contains("एकगठ्ठा"))
                return Math.Max(1, tenureMonths > 0 ? tenureMonths : 12);
            return 1;
        }

        public static List<SansthaBorrowingInstallmentSchedule> GenerateSchedule(BorrowingScheduleInput input)
        {
            var list = new List<SansthaBorrowingInstallmentSchedule>();
            if (input == null || input.PrincipalAmount <= 0m)
                return list;

            decimal P = Math.Round(input.PrincipalAmount, 2, MidpointRounding.AwayFromZero);
            decimal annualRate = Math.Max(0m, input.AnnualInterestRate);
            int tenureMonths = input.TenureMonths > 0 ? input.TenureMonths : 12;
            int moratorium = Math.Max(0, input.MoratoriumMonths);
            string instType = string.IsNullOrWhiteSpace(input.InstallmentType) ? "EMI" : input.InstallmentType.Trim();
            string freq = string.IsNullOrWhiteSpace(input.InstallmentFrequency) ? "Monthly" : input.InstallmentFrequency.Trim();
            bool isSingleBullet = freq.Equals("Bullet", StringComparison.OrdinalIgnoreCase) || freq.Contains("एकगठ्ठा");

            int stepMonths = ResolveStepMonths(freq, tenureMonths);
            int n = input.TotalInstallments > 0
                ? input.TotalInstallments
                : (isSingleBullet ? 1 : Math.Max(1, (tenureMonths - moratorium) / Math.Max(1, stepMonths)));

            DateTime disbDate = input.DisbursementDate.Date;
            DateTime currentDueDate = input.FirstInstallmentDueDate.HasValue && input.FirstInstallmentDueDate.Value != default
                ? input.FirstInstallmentDueDate.Value.Date
                : disbDate.AddMonths(moratorium + stepMonths);

            // 1. Single Maturity Bullet (Principal + Full Tenure Interest at Maturity)
            if (isSingleBullet && n == 1)
            {
                int days = Math.Max(1, (currentDueDate - disbDate).Days);
                decimal totalInt = Math.Round((P * annualRate * days) / 36500m, 2, MidpointRounding.AwayFromZero);
                list.Add(new SansthaBorrowingInstallmentSchedule
                {
                    InstallmentNo = 1,
                    DueDate = currentDueDate,
                    OpeningPrincipal = P,
                    PrincipalDue = P,
                    InterestDue = totalInt,
                    TotalInstallmentAmount = Math.Round(P + totalInt, 2, MidpointRounding.AwayFromZero),
                    ClosingPrincipal = 0m,
                    Status = "Pending"
                });
                return list;
            }

            // 2. Periodic Interest-Only + Bullet Principal on Last Installment
            if (instType.Equals("Bullet", StringComparison.OrdinalIgnoreCase) || instType.Contains("Bullet"))
            {
                DateTime prevDate = disbDate;
                for (int i = 1; i <= n; i++)
                {
                    int days = Math.Max(1, (currentDueDate - prevDate).Days);
                    decimal interest = Math.Round((P * annualRate * days) / 36500m, 2, MidpointRounding.AwayFromZero);
                    decimal prin = (i == n) ? P : 0m;
                    decimal closeBal = Math.Max(0m, P - prin);

                    list.Add(new SansthaBorrowingInstallmentSchedule
                    {
                        InstallmentNo = i,
                        DueDate = currentDueDate,
                        OpeningPrincipal = P,
                        PrincipalDue = prin,
                        InterestDue = interest,
                        TotalInstallmentAmount = Math.Round(prin + interest, 2, MidpointRounding.AwayFromZero),
                        ClosingPrincipal = closeBal,
                        Status = "Pending"
                    });

                    prevDate = currentDueDate;
                    currentDueDate = currentDueDate.AddMonths(stepMonths);
                }
                return list;
            }

            // 3. Flat Rate Schedule
            if (instType.Equals("Flat", StringComparison.OrdinalIgnoreCase) || instType.Contains("फ्लॅट"))
            {
                decimal totalInterest = Math.Round((P * annualRate * (tenureMonths / 12m)) / 100m, 2, MidpointRounding.AwayFromZero);
                decimal prinPerInst = Math.Round(P / n, 2, MidpointRounding.AwayFromZero);
                decimal intPerInst = Math.Round(totalInterest / n, 2, MidpointRounding.AwayFromZero);
                decimal remPrin = P;
                decimal remInt = totalInterest;

                for (int i = 1; i <= n; i++)
                {
                    decimal curPrin = (i == n) ? remPrin : Math.Min(remPrin, prinPerInst);
                    decimal curInt = (i == n) ? remInt : Math.Min(remInt, intPerInst);
                    decimal openBal = remPrin;
                    remPrin = Math.Max(0m, Math.Round(remPrin - curPrin, 2, MidpointRounding.AwayFromZero));
                    remInt = Math.Max(0m, Math.Round(remInt - curInt, 2, MidpointRounding.AwayFromZero));

                    list.Add(new SansthaBorrowingInstallmentSchedule
                    {
                        InstallmentNo = i,
                        DueDate = currentDueDate,
                        OpeningPrincipal = openBal,
                        PrincipalDue = curPrin,
                        InterestDue = curInt,
                        TotalInstallmentAmount = Math.Round(curPrin + curInt, 2, MidpointRounding.AwayFromZero),
                        ClosingPrincipal = remPrin,
                        Status = "Pending"
                    });

                    currentDueDate = currentDueDate.AddMonths(stepMonths);
                }
                return list;
            }

            // 4. Equal Principal + Reducing Balance Interest (समान मुद्दल + घटते व्याज)
            if (instType.Equals("EqualPrincipal", StringComparison.OrdinalIgnoreCase) || instType.Contains("मुद्दल"))
            {
                decimal fixedPrin = input.CustomInstallmentAmount.HasValue && input.CustomInstallmentAmount.Value > 0m && input.CustomInstallmentAmount.Value < P
                    ? Math.Round(input.CustomInstallmentAmount.Value, 2, MidpointRounding.AwayFromZero)
                    : Math.Round(P / n, 2, MidpointRounding.AwayFromZero);

                decimal bal = P;
                DateTime prevDate = disbDate;

                for (int i = 1; i <= n; i++)
                {
                    int days = Math.Max(1, (currentDueDate - prevDate).Days);
                    decimal interest = Math.Round((bal * annualRate * days) / 36500m, 2, MidpointRounding.AwayFromZero);
                    decimal curPrin = (i == n || bal <= fixedPrin) ? bal : fixedPrin;
                    decimal openBal = bal;
                    bal = Math.Max(0m, Math.Round(bal - curPrin, 2, MidpointRounding.AwayFromZero));

                    list.Add(new SansthaBorrowingInstallmentSchedule
                    {
                        InstallmentNo = i,
                        DueDate = currentDueDate,
                        OpeningPrincipal = openBal,
                        PrincipalDue = curPrin,
                        InterestDue = interest,
                        TotalInstallmentAmount = Math.Round(curPrin + interest, 2, MidpointRounding.AwayFromZero),
                        ClosingPrincipal = bal,
                        Status = "Pending"
                    });

                    if (bal <= 0m) break;
                    prevDate = currentDueDate;
                    currentDueDate = currentDueDate.AddMonths(stepMonths);
                }
                return list;
            }

            // 5. Default: Standard Reducing Balance EMI (समान हप्ता)
            decimal periodicRate = (annualRate / 100m) * (stepMonths / 12m);
            decimal emi;
            if (input.CustomInstallmentAmount.HasValue && input.CustomInstallmentAmount.Value > 0m)
            {
                emi = Math.Round(input.CustomInstallmentAmount.Value, 2, MidpointRounding.AwayFromZero);
            }
            else if (periodicRate <= 0m)
            {
                emi = Math.Round(P / n, 2, MidpointRounding.AwayFromZero);
            }
            else
            {
                double factor = Math.Pow((double)(1m + periodicRate), n);
                emi = Math.Round(P * periodicRate * (decimal)factor / (decimal)(factor - 1.0), 2, MidpointRounding.AwayFromZero);
            }

            decimal remBalance = P;
            for (int i = 1; i <= n; i++)
            {
                decimal interest = Math.Round(remBalance * periodicRate, 2, MidpointRounding.AwayFromZero);
                decimal curPrin;
                decimal curTotal;

                if (i == n || remBalance + interest <= emi)
                {
                    curPrin = remBalance;
                    curTotal = Math.Round(curPrin + interest, 2, MidpointRounding.AwayFromZero);
                }
                else
                {
                    curPrin = Math.Max(0m, Math.Round(emi - interest, 2, MidpointRounding.AwayFromZero));
                    if (curPrin > remBalance) curPrin = remBalance;
                    curTotal = Math.Round(curPrin + interest, 2, MidpointRounding.AwayFromZero);
                }

                decimal openBal = remBalance;
                remBalance = Math.Max(0m, Math.Round(remBalance - curPrin, 2, MidpointRounding.AwayFromZero));

                list.Add(new SansthaBorrowingInstallmentSchedule
                {
                    InstallmentNo = i,
                    DueDate = currentDueDate,
                    OpeningPrincipal = openBal,
                    PrincipalDue = curPrin,
                    InterestDue = interest,
                    TotalInstallmentAmount = curTotal,
                    ClosingPrincipal = remBalance,
                    Status = "Pending"
                });

                if (remBalance <= 0m) break;
                currentDueDate = currentDueDate.AddMonths(stepMonths);
            }

            return list;
        }

        public static (decimal AccruedInterest, int Days, DateTime FromDate) CalculateAccruedInterest(
            SansthaBorrowing borrowing,
            DateTime asOfDate)
        {
            DateTime fromDate = (borrowing.LastInterestPaidDate ?? borrowing.DisbursementDate).Date;
            if (borrowing.OutstandingPrincipal <= 0m || borrowing.BorrowingInterestRate <= 0m)
            {
                return (0m, 0, fromDate);
            }

            int days = Math.Max(0, (asOfDate.Date - fromDate).Days);
            decimal accrued = days > 0
                ? Math.Round((borrowing.OutstandingPrincipal * borrowing.BorrowingInterestRate * days) / 36500m, 2, MidpointRounding.AwayFromZero)
                : 0m;

            return (accrued, days, fromDate);
        }

        /// <summary>
        /// Replays all active repayments across the borrowing installment schedule to deterministically
        /// compute Paid / Partial / Overdue / Pending status for every installment (forward & rollback safe).
        /// </summary>
        public static void SynchronizeSchedules(
            SansthaBorrowing borrowing,
            List<SansthaBorrowingInstallmentSchedule> schedules,
            IEnumerable<SansthaBorrowingRepayment> repayments,
            DateTime businessDate)
        {
            if (schedules == null || schedules.Count == 0) return;

            var orderedSchedules = schedules.OrderBy(s => s.InstallmentNo).ToList();
            foreach (var s in orderedSchedules)
            {
                s.PrincipalPaid = 0m;
                s.InterestPaid = 0m;
                s.PenaltyPaid = 0m;
                s.PaidDate = null;
                s.Status = "Pending";
            }

            var orderedRepayments = (repayments ?? Enumerable.Empty<SansthaBorrowingRepayment>())
                .OrderBy(r => r.RepaymentDate)
                .ThenBy(r => r.BorrowingRepaymentID)
                .ToList();

            foreach (var rep in orderedRepayments)
            {
                decimal remPrin = rep.PrincipalPaid;
                decimal remInt = rep.InterestPaid;
                decimal remPen = rep.PenalOrChargesPaid;

                // Allocate Interest first across unpaid interest dues
                foreach (var sch in orderedSchedules)
                {
                    if (remInt <= 0.009m) break;
                    decimal intGap = Math.Max(0m, sch.InterestDue - sch.InterestPaid);
                    if (intGap <= 0.009m) continue;

                    decimal takeInt = Math.Min(remInt, intGap);
                    sch.InterestPaid = Math.Round(sch.InterestPaid + takeInt, 2, MidpointRounding.AwayFromZero);
                    remInt = Math.Round(remInt - takeInt, 2, MidpointRounding.AwayFromZero);
                    sch.PaidDate = rep.RepaymentDate;
                }

                // Allocate Principal across unpaid principal dues
                foreach (var sch in orderedSchedules)
                {
                    if (remPrin <= 0.009m) break;
                    decimal prinGap = Math.Max(0m, sch.PrincipalDue - sch.PrincipalPaid);
                    if (prinGap <= 0.009m) continue;

                    decimal takePrin = Math.Min(remPrin, prinGap);
                    sch.PrincipalPaid = Math.Round(sch.PrincipalPaid + takePrin, 2, MidpointRounding.AwayFromZero);
                    remPrin = Math.Round(remPrin - takePrin, 2, MidpointRounding.AwayFromZero);
                    sch.PaidDate = rep.RepaymentDate;

                    if (remPen > 0m)
                    {
                        sch.PenaltyPaid = Math.Round(sch.PenaltyPaid + remPen, 2, MidpointRounding.AwayFromZero);
                        remPen = 0m;
                    }
                }

                // If leftover interest was paid (e.g. overdue / extra days), attach to latest touched or first pending schedule
                if (remInt > 0.009m)
                {
                    var targetSch = orderedSchedules.FirstOrDefault(s => s.PrincipalPaid < s.PrincipalDue - 0.01m)
                                 ?? orderedSchedules.Last();
                    targetSch.InterestPaid = Math.Round(targetSch.InterestPaid + remInt, 2, MidpointRounding.AwayFromZero);
                    targetSch.PaidDate ??= rep.RepaymentDate;
                }
            }

            bool isLoanClosed = string.Equals(borrowing.Status, "Closed", StringComparison.OrdinalIgnoreCase)
                                || borrowing.OutstandingPrincipal <= 0.009m;
            DateTime? closedDate = borrowing.ClosedDate ?? orderedRepayments.LastOrDefault()?.RepaymentDate;

            foreach (var sch in orderedSchedules)
            {
                if (isLoanClosed && orderedRepayments.Any())
                {
                    sch.Status = "Paid";
                    sch.PaidDate ??= closedDate;
                    continue;
                }

                bool prinSatisfied = sch.PrincipalDue <= 0.009m || sch.PrincipalPaid + 0.01m >= sch.PrincipalDue;
                bool intSatisfied = sch.InterestDue <= 0.009m || sch.InterestPaid + 0.01m >= sch.InterestDue;

                // In reducing balance loans, early principal repayment satisfies principal obligation for the EMI
                if (sch.PrincipalDue > 0m && prinSatisfied && (intSatisfied || sch.InterestPaid > 0m))
                {
                    sch.Status = "Paid";
                }
                else if (sch.PrincipalDue <= 0.009m && sch.InterestDue > 0m && intSatisfied)
                {
                    sch.Status = "Paid";
                }
                else if (sch.PrincipalPaid > 0.009m || sch.InterestPaid > 0.009m)
                {
                    sch.Status = sch.DueDate.Date < businessDate.Date ? "Overdue" : "Partial";
                }
                else
                {
                    sch.Status = sch.DueDate.Date < businessDate.Date ? "Overdue" : "Pending";
                }
            }
        }
    }
}
