using System;
using System.Collections.Generic;
using System.Linq;
using Bhisi.Api.Models;

namespace Bhisi.Api.Helpers
{
    public sealed class LoanPenalSnapshot
    {
        public decimal OverduePrincipal { get; set; }
        public decimal OverdueEmiAmount { get; set; }
        public int OverdueInstallmentsCount { get; set; }
        public int TotalInstallments { get; set; }
        public DateTime? OverdueSinceDate { get; set; }
        public int OverdueDays { get; set; }
        public int GraceDays { get; set; }
        public int EffectivePenalDays { get; set; }
        public decimal PenalRate { get; set; }
        public string PenalBasis { get; set; } = LoanPenalInterestHelper.BasisOverduePrincipal;
        public decimal PenalBaseAmount { get; set; }
        public decimal PostedPenalInterestBalance { get; set; }
        public decimal EstimatedAccruedPenalInterest { get; set; }
        public decimal TotalPenalInterestDue { get; set; }
    }

    public static class LoanPenalInterestHelper
    {
        public const string BasisOverduePrincipal = "OverduePrincipal";
        public const string BasisTotalPrincipal = "TotalPrincipal";
        public const string BasisOverdueEmi = "OverdueEmi";

        public static string NormalizePenalInterestBasis(string? basis)
        {
            if (string.IsNullOrWhiteSpace(basis)) return BasisOverduePrincipal;
            string trimmed = basis.Trim();
            if (string.Equals(trimmed, BasisTotalPrincipal, StringComparison.OrdinalIgnoreCase))
                return BasisTotalPrincipal;
            if (string.Equals(trimmed, BasisOverdueEmi, StringComparison.OrdinalIgnoreCase))
                return BasisOverdueEmi;
            return BasisOverduePrincipal;
        }

        /// <summary>
        /// Computes canonical overdue balances and accrued penal interest using the scheme's OverdueInterestRate,
        /// PenalInterestGraceDays, PenalInterestBasis, installment schedule / maturity date, and LastPenalPostingDate.
        /// </summary>
        public static LoanPenalSnapshot ComputePenalSnapshot(
            LoanAccount loan,
            LoanRate? loanRate,
            IEnumerable<LoanInstallmentSchedule> schedules,
            DateTime targetDate,
            DateTime? effectiveMaturityOverride = null,
            bool skipIfPreBookedExists = false)
        {
            DateTime target = targetDate.Date;
            var scheduleList = schedules as IList<LoanInstallmentSchedule> ?? schedules.ToList();

            DateTime? disbursementDate = loan.LoanDisbursementDate?.Date ?? (loan.IsOpeningBalance ? loan.OpeningDate.Date : (DateTime?)null);
            int durationMonths = loan.DurationMonths > 0 ? loan.DurationMonths : (loanRate?.DurationMonths ?? 0);
            DateTime? effectiveMaturity = effectiveMaturityOverride?.Date
                ?? loan.MaturityDate?.Date
                ?? ((durationMonths > 0 && (loan.LoanDisbursementDate ?? loan.OpeningDate) != default)
                    ? (loan.LoanDisbursementDate ?? loan.OpeningDate).Date.AddMonths(durationMonths)
                    : null);

            var validUnpaid = scheduleList
                .Where(s => !string.Equals(s.Status, "Paid", StringComparison.OrdinalIgnoreCase)
                            && !(loan.IsOpeningBalance && s.DueDate.Date <= loan.OpeningDate.Date))
                .OrderBy(s => s.DueDate)
                .ToList();

            var overdueScheds = validUnpaid.Where(s => s.DueDate.Date <= target).ToList();
            decimal overduePrincipal = overdueScheds.Sum(s => s.PrincipalAmount);
            decimal overdueEmiAmount = overdueScheds.Sum(s => s.PrincipalAmount + s.InterestAmount);

            if (effectiveMaturity.HasValue && effectiveMaturity.Value <= target && loan.PrincipalBalance > overduePrincipal)
            {
                overduePrincipal = loan.PrincipalBalance;
            }
            if (overduePrincipal > loan.PrincipalBalance)
            {
                overduePrincipal = loan.PrincipalBalance;
            }
            if (overduePrincipal <= 0m && !validUnpaid.Any() && effectiveMaturity.HasValue && effectiveMaturity.Value <= target)
            {
                overduePrincipal = loan.PrincipalBalance;
            }

            if (effectiveMaturity.HasValue && effectiveMaturity.Value <= target && loan.PrincipalBalance > overdueEmiAmount)
            {
                overdueEmiAmount = loan.PrincipalBalance + Math.Max(0m, loan.InterestBalance);
            }

            int totalInstallments = Math.Max(loan.NoOfInstallments, scheduleList.Count);
            int overdueInstallments = overdueScheds.Count > 0
                ? overdueScheds.Count
                : (effectiveMaturity.HasValue && effectiveMaturity.Value <= target && loan.PrincipalBalance > 0m
                    ? Math.Max(1, totalInstallments)
                    : 0);

            DateTime? overdueSinceDate = overdueScheds.Any()
                ? overdueScheds.Min(s => s.DueDate.Date)
                : (effectiveMaturity.HasValue && effectiveMaturity.Value <= target && loan.PrincipalBalance > 0m
                    ? effectiveMaturity.Value
                    : null);

            int overdueDays = overdueSinceDate.HasValue ? Math.Max(0, (target - overdueSinceDate.Value).Days) : 0;

            decimal penalRate = Math.Max(0m, loanRate?.OverdueInterestRate ?? 0m);
            int graceDays = Math.Max(0, loanRate?.PenalInterestGraceDays ?? 0);
            string penalBasis = NormalizePenalInterestBasis(loanRate?.PenalInterestBasis);
            decimal postedPenal = Math.Max(0m, loan.OverdueInterestBalance);

            int effectivePenalDays = 0;
            if (overdueSinceDate.HasValue && loan.PrincipalBalance > 0m &&
                (!disbursementDate.HasValue || target >= disbursementDate.Value))
            {
                DateTime penalStart = overdueSinceDate.Value.AddDays(graceDays);
                if (loan.IsOpeningBalance && loan.OpeningDate.Date > penalStart)
                {
                    penalStart = loan.OpeningDate.Date;
                }
                if (loan.LastPenalPostingDate.HasValue && loan.LastPenalPostingDate.Value.Date > penalStart)
                {
                    penalStart = loan.LastPenalPostingDate.Value.Date;
                }
                effectivePenalDays = Math.Max(0, (target - penalStart).Days);
            }

            decimal penalBase = penalBasis switch
            {
                BasisTotalPrincipal => overdueDays > 0 ? Math.Max(0m, loan.PrincipalBalance) : 0m,
                BasisOverdueEmi => overdueEmiAmount > 0m ? overdueEmiAmount : (overdueDays > 0 ? Math.Max(0m, loan.PrincipalBalance) : 0m),
                _ => overduePrincipal > 0m ? overduePrincipal : (overdueDays > 0 ? Math.Max(0m, loan.PrincipalBalance) : 0m)
            };

            bool suppressEstimate = skipIfPreBookedExists && postedPenal > 0m;
            decimal estPenal = (!suppressEstimate && penalRate > 0m && effectivePenalDays > 0 && penalBase > 0m)
                ? Math.Round((penalBase * penalRate * effectivePenalDays) / 36500m, 0, MidpointRounding.AwayFromZero)
                : 0m;

            decimal totalPenal = skipIfPreBookedExists
                ? (postedPenal > 0m ? postedPenal : estPenal)
                : Math.Round(postedPenal + estPenal, 2, MidpointRounding.AwayFromZero);

            return new LoanPenalSnapshot
            {
                OverduePrincipal = Math.Round(Math.Max(0m, overduePrincipal), 2, MidpointRounding.AwayFromZero),
                OverdueEmiAmount = Math.Round(Math.Max(0m, overdueEmiAmount), 2, MidpointRounding.AwayFromZero),
                OverdueInstallmentsCount = overdueInstallments,
                TotalInstallments = totalInstallments,
                OverdueSinceDate = overdueSinceDate,
                OverdueDays = overdueDays,
                GraceDays = graceDays,
                EffectivePenalDays = effectivePenalDays,
                PenalRate = penalRate,
                PenalBasis = penalBasis,
                PenalBaseAmount = Math.Round(Math.Max(0m, penalBase), 2, MidpointRounding.AwayFromZero),
                PostedPenalInterestBalance = Math.Round(postedPenal, 2, MidpointRounding.AwayFromZero),
                EstimatedAccruedPenalInterest = estPenal,
                TotalPenalInterestDue = totalPenal
            };
        }
    }
}
