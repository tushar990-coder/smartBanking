using System;
using System.Collections.Generic;
using System.Linq;
using Bhisi.Api.Models;

namespace Bhisi.Api.Services
{
    public static class LoanScheduleGenerator
    {
        public static List<LoanInstallmentSchedule> GenerateSchedules(LoanAccount account, LoanRate? loanRate = null)
        {
            var schedules = new List<LoanInstallmentSchedule>();
            if (account == null) return schedules;

            var rate = loanRate ?? account.LoanRate;
            if (rate == null) return schedules;

            decimal P = account.PrincipalBalance > 0 ? account.PrincipalBalance : account.SanctionedAmount;
            int n = account.NoOfInstallments;
            decimal ratePerYear = account.InterestRate;
            string calcMethod = rate.InterestCalculationMethod ?? "Reducing (घटती शिल्लक)";
            string installmentType = rate.LoanInstallmentType ?? "समान हप्ता";

            bool isWeekly = (account.InstallmentFrequency ?? "").Contains("साप्ताहिक") || (account.InstallmentFrequency ?? "").ToLower().Contains("weekly");
            int stepMonths = 1;
            if (isWeekly) stepMonths = 0;
            else if (account.InstallmentFrequency == "त्रैमासिक" || account.InstallmentFrequency == "त्रैमासिक (Quarterly)") stepMonths = 3;
            else if (account.InstallmentFrequency == "सहामाही" || account.InstallmentFrequency == "सहामाही (Half-Yearly)") stepMonths = 6;
            else if (account.InstallmentFrequency == "वार्षिक" || account.InstallmentFrequency == "वार्षिक (Yearly)") stepMonths = 12;

            decimal bal = P;
            DateTime disbursementDate = account.LoanDisbursementDate ?? account.OpeningDate;
            DateTime currentDueDate = account.FirstInstallmentDate ?? (isWeekly ? disbursementDate.AddDays(7) : disbursementDate.AddMonths(stepMonths));

            decimal totalPrincipalPaid = (account.SanctionedAmount > account.PrincipalBalance && account.PrincipalBalance > 0)
                ? (account.SanctionedAmount - account.PrincipalBalance)
                : 0;

            if (calcMethod.Contains("Flat") || calcMethod.Contains("फ्लॅट"))
            {
                int totalMonths = account.DurationMonths > 0 ? account.DurationMonths : (isWeekly ? (int)Math.Max(1, Math.Ceiling(n / 4.33)) : n * stepMonths);
                decimal totalInterest = (P * ratePerYear * ((decimal)totalMonths / 12m)) / 100m;
                decimal totalAmount = P + totalInterest;
                decimal interestPerInstallment = n > 0 ? totalInterest / n : 0;
                decimal emi = n > 0 ? Math.Round(totalAmount / n) : 0;
                decimal totalPaid = 0;

                for (int i = 1; i <= n; i++)
                {
                    decimal interest = interestPerInstallment;
                    decimal totalEmi = 0;
                    decimal principalPart = 0;

                    if (i == n)
                    {
                        totalEmi = Math.Round(totalAmount - totalPaid);
                        principalPart = totalEmi - Math.Round(interest);
                        bal = 0;
                    }
                    else
                    {
                        totalEmi = emi;
                        principalPart = totalEmi - Math.Round(interest);
                        totalPaid += totalEmi;
                        bal -= principalPart;
                    }

                    string status = "Pending";
                    if (totalPrincipalPaid >= principalPart)
                    {
                        status = "Paid";
                        totalPrincipalPaid -= principalPart;
                    }
                    else
                    {
                        totalPrincipalPaid = 0;
                        status = currentDueDate < DateTime.Today ? "Overdue" : "Pending";
                    }

                    schedules.Add(new LoanInstallmentSchedule
                    {
                        LoanAccountID = account.LoanAccountID,
                        InstallmentNo = i,
                        DueDate = currentDueDate,
                        PrincipalAmount = Math.Round(principalPart),
                        InterestAmount = Math.Round(interest),
                        TotalAmount = Math.Round(totalEmi),
                        BalanceAmount = Math.Max(0, Math.Round(bal)),
                        OpeningBalance = Math.Max(0, Math.Round(bal + principalPart)),
                        ClosingBalance = Math.Max(0, Math.Round(bal)),
                        Days = 0,
                        InterestRate = ratePerYear,
                        Status = status,
                        PaidDate = status == "Paid" ? currentDueDate : null
                    });

                    currentDueDate = isWeekly ? currentDueDate.AddDays(7) : currentDueDate.AddMonths(stepMonths);
                }
            }
            else if (calcMethod.Contains("Reducing") && (installmentType == "समान मुद्दल" || installmentType == "कर्जावरती" || installmentType.Contains("मुद्दल") || installmentType.Contains("कर्जावर")))
            {
                decimal principalPart = n > 0 ? Math.Round(P / n) : P;
                DateTime prevDueDate = disbursementDate;

                for (int i = 1; i <= n; i++)
                {
                    int days = Math.Max(0, (currentDueDate - prevDueDate).Days);
                    decimal interest = Math.Round((bal * days * ratePerYear) / 36500m);
                    decimal currentPrincipal = principalPart;
                    if (i == n)
                    {
                        currentPrincipal = bal;
                    }
                    decimal totalEmi = currentPrincipal + interest;
                    decimal opBal = bal;
                    bal -= currentPrincipal;
                    if (bal < 0) bal = 0;

                    string status = "Pending";
                    if (totalPrincipalPaid >= currentPrincipal)
                    {
                        status = "Paid";
                        totalPrincipalPaid -= currentPrincipal;
                    }
                    else
                    {
                        totalPrincipalPaid = 0;
                        status = currentDueDate < DateTime.Today ? "Overdue" : "Pending";
                    }

                    schedules.Add(new LoanInstallmentSchedule
                    {
                        LoanAccountID = account.LoanAccountID,
                        InstallmentNo = i,
                        DueDate = currentDueDate,
                        PrincipalAmount = currentPrincipal,
                        InterestAmount = interest,
                        TotalAmount = totalEmi,
                        BalanceAmount = bal,
                        OpeningBalance = opBal,
                        ClosingBalance = bal,
                        Days = days,
                        InterestRate = ratePerYear,
                        Status = status,
                        PaidDate = status == "Paid" ? currentDueDate : null
                    });

                    prevDueDate = currentDueDate;
                    currentDueDate = isWeekly ? currentDueDate.AddDays(7) : currentDueDate.AddMonths(stepMonths);
                }
            }
            else
            {
                // Standard Reducing Balance: EMI = P * r * (1+r)^n / ((1+r)^n - 1)
                decimal r = 0;
                if (isWeekly) r = (ratePerYear / 100m) / 52m;
                else if (stepMonths > 0) r = (ratePerYear / 100m) * ((decimal)stepMonths / 12m);

                decimal emi = 0;
                if (n <= 0) emi = 0;
                else if (r == 0) emi = P / (decimal)n;
                else emi = (P * r * (decimal)Math.Pow((double)(1 + r), n)) / (decimal)(Math.Pow((double)(1 + r), n) - 1);

                DateTime prevDueDate = disbursementDate;
                for (int i = 1; i <= n; i++)
                {
                    decimal interest = bal * r;
                    decimal principalPart = 0;
                    decimal totalEmi = 0;

                    if (i == n)
                    {
                        principalPart = bal;
                        totalEmi = Math.Round(principalPart + interest);
                        bal = 0;
                    }
                    else
                    {
                        totalEmi = Math.Round(emi);
                        principalPart = totalEmi - Math.Round(interest);
                        bal -= principalPart;
                    }
                    if (bal < 0) bal = 0;

                    int days = Math.Max(0, (currentDueDate - prevDueDate).Days);

                    string status = "Pending";
                    if (totalPrincipalPaid >= principalPart)
                    {
                        status = "Paid";
                        totalPrincipalPaid -= principalPart;
                    }
                    else
                    {
                        totalPrincipalPaid = 0;
                        status = currentDueDate < DateTime.Today ? "Overdue" : "Pending";
                    }

                    schedules.Add(new LoanInstallmentSchedule
                    {
                        LoanAccountID = account.LoanAccountID,
                        InstallmentNo = i,
                        DueDate = currentDueDate,
                        PrincipalAmount = Math.Round(principalPart),
                        InterestAmount = Math.Round(interest),
                        TotalAmount = Math.Round(totalEmi),
                        BalanceAmount = Math.Max(0, Math.Round(bal)),
                        OpeningBalance = Math.Max(0, Math.Round(bal + principalPart)),
                        ClosingBalance = Math.Max(0, Math.Round(bal)),
                        Days = days,
                        InterestRate = ratePerYear,
                        Status = status,
                        PaidDate = status == "Paid" ? currentDueDate : null
                    });

                    prevDueDate = currentDueDate;
                    currentDueDate = isWeekly ? currentDueDate.AddDays(7) : currentDueDate.AddMonths(stepMonths);
                }
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
