using System;
using System.Collections.Generic;
using System.Linq;
using Bhisi.Api.Models;

namespace Bhisi.Api.Services
{
    public static class LoanScheduleGenerator
    {
        /// <summary>
        /// Single source of truth for generating loan installment preview schedules across the entire application.
        /// Used by Loan Opening Balance, Loan Application, Loan Disbursement, and Loan Ledger Reports.
        /// </summary>
        public static List<OpeningBalanceScheduleDto> GeneratePreviewSchedule(LoanSchedulePreviewRequest request, LoanRate loanRate)
        {
            var scheduleList = new List<OpeningBalanceScheduleDto>();
            if (request == null || loanRate == null) return scheduleList;

            decimal P = request.LoanAmount;
            if (P <= 0) return scheduleList;

            decimal ratePerYear = request.InterestRate;
            string calcMethod = loanRate.InterestCalculationMethod ?? "Reducing (घटती शिल्लक)";
            string installmentType = loanRate.LoanInstallmentType ?? "समान हप्ता";
            string frequency = request.InstallmentFrequency ?? "मासिक";

            bool isWeekly = frequency.Contains("साप्ताहिक") || frequency.ToLower().Contains("weekly");
            int stepMonths = 1;
            if (isWeekly) stepMonths = 0;
            else if (frequency.Contains("त्रैमासिक") || frequency.ToLower().Contains("quarterly")) stepMonths = 3;
            else if (frequency.Contains("सहामाही") || frequency.ToLower().Contains("half")) stepMonths = 6;
            else if (frequency.Contains("वार्षिक") || frequency.ToLower().Contains("yearly")) stepMonths = 12;

            int n = request.NoOfInstallments;
            if (n <= 0)
            {
                int duration = request.DurationMonths > 0 ? request.DurationMonths : 12;
                n = isWeekly ? Math.Max(1, (int)Math.Round(duration * 4.33)) : Math.Max(1, duration / (stepMonths > 0 ? stepMonths : 1));
            }

            decimal bal = P;
            DateTime disbursementDate = request.LoanDisbursementDate != default ? request.LoanDisbursementDate : DateTime.Today;
            DateTime currentDueDate = request.FirstInstallmentDate.HasValue && request.FirstInstallmentDate.Value != default
                ? request.FirstInstallmentDate.Value
                : (isWeekly ? disbursementDate.AddDays(7) : disbursementDate.AddMonths(stepMonths));

            if (calcMethod.Contains("Flat") || calcMethod.Contains("फ्लॅट"))
            {
                int totalMonths = request.DurationMonths > 0 ? request.DurationMonths : (isWeekly ? (int)Math.Max(1, Math.Ceiling(n / 4.33)) : n * stepMonths);
                decimal totalInterest = (P * ratePerYear * ((decimal)totalMonths / 12m)) / 100m;
                decimal totalAmount = P + totalInterest;
                decimal interestPerInstallment = n > 0 ? totalInterest / (decimal)n : 0;
                decimal emi = request.CustomInstallmentAmount.HasValue && request.CustomInstallmentAmount.Value > 0
                    ? request.CustomInstallmentAmount.Value
                    : (n > 0 ? Math.Round(totalAmount / (decimal)n) : 0);
                decimal totalPaid = 0;
                DateTime prevDueDate = disbursementDate;

                for (int i = 1; i <= n; i++)
                {
                    decimal interest = interestPerInstallment;
                    decimal totalEmi = 0;
                    decimal principalPart = 0;

                    if (i == n || bal <= 0)
                    {
                        totalEmi = Math.Round(totalAmount - totalPaid);
                        principalPart = totalEmi - Math.Round(interest);
                        if (principalPart < 0) principalPart = 0;
                        bal = 0;
                    }
                    else
                    {
                        totalEmi = emi;
                        principalPart = totalEmi - Math.Round(interest);
                        if (principalPart > bal) principalPart = bal;
                        totalPaid += totalEmi;
                        bal -= principalPart;
                    }
                    if (bal < 0) bal = 0;

                    int days = Math.Max(0, (currentDueDate - prevDueDate).Days);

                    scheduleList.Add(new OpeningBalanceScheduleDto
                    {
                        No = i,
                        Date = currentDueDate,
                        Principal = Math.Round(principalPart),
                        Interest = Math.Round(interest),
                        Total = Math.Round(totalEmi),
                        Balance = Math.Max(0, Math.Round(bal)),
                        OpeningBalance = Math.Max(0, Math.Round(bal + principalPart)),
                        ClosingBalance = Math.Max(0, Math.Round(bal)),
                        Days = days,
                        InterestRate = ratePerYear
                    });

                    prevDueDate = currentDueDate;
                    currentDueDate = isWeekly ? currentDueDate.AddDays(7) : currentDueDate.AddMonths(stepMonths);
                }
            }
            else if (calcMethod.Contains("Reducing") && (installmentType == "समान मुद्दल" || installmentType == "कर्जावरती" || installmentType.Contains("मुद्दल") || installmentType.Contains("कर्जावर")))
            {
                decimal principalPart = request.CustomInstallmentAmount.HasValue && request.CustomInstallmentAmount.Value > 0
                    ? request.CustomInstallmentAmount.Value
                    : (n > 0 ? Math.Round(P / (decimal)n) : P);
                DateTime prevDueDate = disbursementDate;

                for (int i = 1; i <= n; i++)
                {
                    int days = Math.Max(0, (currentDueDate - prevDueDate).Days);
                    decimal interest = Math.Round((bal * (decimal)days * ratePerYear) / 36500m);
                    decimal currentPrincipal = principalPart;
                    if (i == n || bal <= currentPrincipal)
                    {
                        currentPrincipal = bal;
                    }
                    decimal totalEmi = currentPrincipal + interest;
                    decimal opBal = bal;
                    bal -= currentPrincipal;
                    if (bal < 0) bal = 0;

                    scheduleList.Add(new OpeningBalanceScheduleDto
                    {
                        No = i,
                        Date = currentDueDate,
                        Principal = currentPrincipal,
                        Interest = interest,
                        Total = totalEmi,
                        Balance = bal,
                        OpeningBalance = opBal,
                        ClosingBalance = bal,
                        Days = days,
                        InterestRate = ratePerYear
                    });

                    prevDueDate = currentDueDate;
                    currentDueDate = isWeekly ? currentDueDate.AddDays(7) : currentDueDate.AddMonths(stepMonths);
                }
            }
            else
            {
                // Standard Reducing Balance: Equal Installment (EMI) / Daily Reducing
                decimal r = 0;
                if (isWeekly) r = (ratePerYear / 100m) / 52m;
                else if (stepMonths > 0) r = (ratePerYear / 100m) * ((decimal)stepMonths / 12m);

                decimal emi = 0;
                if (request.CustomInstallmentAmount.HasValue && request.CustomInstallmentAmount.Value > 0)
                {
                    emi = request.CustomInstallmentAmount.Value;
                }
                else if (n <= 0) emi = 0;
                else if (r == 0) emi = P / (decimal)n;
                else emi = (P * r * (decimal)Math.Pow((double)(1 + r), n)) / (decimal)(Math.Pow((double)(1 + r), n) - 1);

                DateTime prevDueDate = disbursementDate;
                for (int i = 1; i <= n; i++)
                {
                    decimal interest = bal * r;
                    decimal principalPart = 0;
                    decimal totalEmi = 0;

                    if (i == n || bal <= 0)
                    {
                        principalPart = bal;
                        totalEmi = Math.Round(principalPart + interest);
                        bal = 0;
                    }
                    else
                    {
                        totalEmi = Math.Round(emi);
                        principalPart = totalEmi - Math.Round(interest);
                        if (principalPart > bal) principalPart = bal;
                        bal -= principalPart;
                    }
                    if (bal < 0) bal = 0;

                    int days = Math.Max(0, (currentDueDate - prevDueDate).Days);

                    scheduleList.Add(new OpeningBalanceScheduleDto
                    {
                        No = i,
                        Date = currentDueDate,
                        Principal = Math.Round(principalPart),
                        Interest = Math.Round(interest),
                        Total = Math.Round(totalEmi),
                        Balance = Math.Max(0, Math.Round(bal)),
                        OpeningBalance = Math.Max(0, Math.Round(bal + principalPart)),
                        ClosingBalance = Math.Max(0, Math.Round(bal)),
                        Days = days,
                        InterestRate = ratePerYear
                    });

                    prevDueDate = currentDueDate;
                    currentDueDate = isWeekly ? currentDueDate.AddDays(7) : currentDueDate.AddMonths(stepMonths);
                }
            }

            return scheduleList;
        }

        /// <summary>
        /// Generates entity schedule records for loan accounts upon disbursement or opening balance migration.
        /// Utilizes the exact same calculation engine as GeneratePreviewSchedule to guarantee 100% consistency.
        /// </summary>
        public static List<LoanInstallmentSchedule> GenerateSchedules(LoanAccount account, LoanRate? loanRate = null)
        {
            var schedules = new List<LoanInstallmentSchedule>();
            if (account == null) return schedules;

            var rate = loanRate ?? account.LoanRate;
            if (rate == null) return schedules;

            decimal P = account.SanctionedAmount > 0 ? account.SanctionedAmount : (account.PrincipalBalance > 0 ? account.PrincipalBalance : 0);
            int n = account.NoOfInstallments;
            if (n <= 0 && account.DurationMonths > 0)
            {
                bool isWeekly = (account.InstallmentFrequency ?? "").Contains("साप्ताहिक") || (account.InstallmentFrequency ?? "").ToLower().Contains("weekly");
                int step = 1;
                if (isWeekly) step = 0;
                else if ((account.InstallmentFrequency ?? "").Contains("त्रैमासिक")) step = 3;
                else if ((account.InstallmentFrequency ?? "").Contains("सहामाही")) step = 6;
                else if ((account.InstallmentFrequency ?? "").Contains("वार्षिक")) step = 12;

                n = isWeekly ? Math.Max(1, (int)Math.Round(account.DurationMonths * 4.33)) : Math.Max(1, account.DurationMonths / step);
            }

            var request = new LoanSchedulePreviewRequest
            {
                LoanRateID = rate.LoanRateID,
                LoanAmount = P,
                InterestRate = account.InterestRate,
                NoOfInstallments = n,
                DurationMonths = account.DurationMonths > 0 ? account.DurationMonths : 12,
                InstallmentFrequency = account.InstallmentFrequency ?? "मासिक",
                LoanDisbursementDate = account.LoanDisbursementDate ?? account.OpeningDate,
                FirstInstallmentDate = account.FirstInstallmentDate,
                CustomInstallmentAmount = account.InstallmentAmount > 0 ? account.InstallmentAmount : null
            };

            var previewList = GeneratePreviewSchedule(request, rate);

            decimal totalPrincipalPaid = (account.SanctionedAmount > account.PrincipalBalance && account.PrincipalBalance > 0)
                ? (account.SanctionedAmount - account.PrincipalBalance)
                : 0;

            foreach (var p in previewList)
            {
                string status = "Pending";
                DateTime? paidDate = null;

                if (totalPrincipalPaid >= p.Principal && p.Principal > 0)
                {
                    status = "Paid";
                    paidDate = account.OpeningDate;
                    totalPrincipalPaid -= p.Principal;
                }
                else
                {
                    totalPrincipalPaid = 0;
                    status = p.Date < DateTime.Today ? "Overdue" : "Pending";
                }

                schedules.Add(new LoanInstallmentSchedule
                {
                    LoanAccountID = account.LoanAccountID,
                    InstallmentNo = p.No,
                    DueDate = p.Date,
                    PrincipalAmount = p.Principal,
                    InterestAmount = p.Interest,
                    TotalAmount = p.Total,
                    BalanceAmount = p.Balance,
                    OpeningBalance = p.OpeningBalance,
                    ClosingBalance = p.ClosingBalance,
                    Days = p.Days,
                    InterestRate = p.InterestRate,
                    Status = status,
                    PaidDate = paidDate
                });
            }

            return schedules;
        }

        public static decimal GetUnpaidScheduledInterest(
            LoanAccount account,
            List<LoanInstallmentSchedule> schedules,
            List<LoanCollection> collections,
            DateTime targetDate)
        {
            decimal totalInterestPaid = collections.Sum(c => c.InterestCollected);
            decimal totalUnpaidInterest = 0;
            
            var sortedSchedules = schedules
                .Where(s => s.DueDate <= targetDate)
                .OrderBy(s => s.InstallmentNo)
                .ToList();
                
            foreach (var s in sortedSchedules)
            {
                if (account.IsOpeningBalance && s.DueDate <= account.OpeningDate)
                {
                    continue; // Skip interest from schedules that were due before software entry
                }

                decimal interestPaidForThis = Math.Min(totalInterestPaid, s.InterestAmount);
                totalInterestPaid -= interestPaidForThis;
                totalUnpaidInterest += s.InterestAmount - interestPaidForThis;
            }
            
            return totalUnpaidInterest;
        }
    }
}
