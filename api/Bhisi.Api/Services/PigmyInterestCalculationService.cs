using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bhisi.Api.Services
{
    public sealed class PigmySlabResolution
    {
        public PigmySchemeInterestSlab? MatchedSlab { get; init; }
        public decimal PenaltyRate { get; init; }
        public decimal InterestRate { get; init; }
        public string PolicyNote { get; init; } = string.Empty;
        public string NormalizedMethod { get; init; } = "FLAT";
        public string MethodDisplayLabel { get; init; } = "Flat (फ्लॅट)";
        public int InterestDaysInYear { get; init; } = 365;
        public int SchemeTenureDays { get; init; } = 365;
    }

    public static class PigmyInterestCalculationService
    {
        public static int ResolveSchemeTenureDays(PigmyScheme? scheme)
        {
            if (scheme == null) return 365;

            var activeSlabs = scheme.Slabs?.Where(s => s.IsActive).ToList();
            if (activeSlabs != null && activeSlabs.Count > 0)
            {
                int maxSlabDays = activeSlabs.Max(s => s.ToDays);
                if (maxSlabDays > 0) return maxSlabDays;
            }

            if (scheme.DurationMonths > 60)
            {
                // Legacy auto-heal where days (e.g. 365) were stored inside DurationMonths
                return scheme.DurationMonths;
            }

            if (scheme.TenureDays > 0 && (scheme.TenureDays != 365 || scheme.DurationMonths == 12 || scheme.DurationMonths == 0))
            {
                return scheme.TenureDays;
            }

            if (scheme.DurationMonths > 0)
            {
                return scheme.DurationMonths == 12 ? 365 : scheme.DurationMonths * 30;
            }

            return 365;
        }

        public static int ResolveInterestDaysInYear(PigmyScheme? scheme)
        {
            if (scheme != null && scheme.InterestDaysInYear >= 360 && scheme.InterestDaysInYear <= 366)
            {
                return scheme.InterestDaysInYear;
            }
            return 365;
        }

        public static DateTime ResolveEffectiveMaturityDate(PigmyAccount account)
        {
            int tenureDays = ResolveSchemeTenureDays(account.PigmyScheme);
            DateTime expectedMaturity = account.OpeningDate.Date.AddDays(tenureDays);

            // Auto-heal in memory if legacy AddMonths(365) pushed MaturityDate > 10 years ahead
            if ((account.MaturityDate.Date - account.OpeningDate.Date).TotalDays > Math.Max(tenureDays * 3, 3650))
            {
                return expectedMaturity;
            }

            return account.MaturityDate.Date;
        }

        public static (string Code, string Label) NormalizeCalculationMethod(string? rawMethod)
        {
            if (string.IsNullOrWhiteSpace(rawMethod))
            {
                return ("FLAT", "Flat (फ्लॅट स्लॅब दर)");
            }

            string m = rawMethod.Trim();
            if (m.Contains("Monthly", StringComparison.OrdinalIgnoreCase) ||
                m.Contains("मासिक", StringComparison.OrdinalIgnoreCase) ||
                m.Contains("Minimum", StringComparison.OrdinalIgnoreCase) ||
                m.Contains("किमान", StringComparison.OrdinalIgnoreCase))
            {
                return ("MONTHLY_MIN_BALANCE", "मासिक किमान शिल्लक पद्धत (Monthly Minimum Balance)");
            }

            if (m.Contains("Pro-Rata", StringComparison.OrdinalIgnoreCase) ||
                m.Contains("ProRata", StringComparison.OrdinalIgnoreCase) ||
                m.Contains("सरळव्याज", StringComparison.OrdinalIgnoreCase) ||
                m.Contains("Simple", StringComparison.OrdinalIgnoreCase))
            {
                return ("SIMPLE_PRO_RATA", "प्रत्यक्ष दिवसांनुसार सरळव्याज (Pro-Rata Days)");
            }

            if (m.Contains("Daily", StringComparison.OrdinalIgnoreCase) ||
                m.Contains("दैनिक", StringComparison.OrdinalIgnoreCase) ||
                m.Contains("Product", StringComparison.OrdinalIgnoreCase) ||
                m.Contains("प्रॉडक्ट", StringComparison.OrdinalIgnoreCase) ||
                m.Contains("Reducing", StringComparison.OrdinalIgnoreCase) ||
                m.Contains("घटती", StringComparison.OrdinalIgnoreCase))
            {
                return ("DAILY_PRODUCT", "दैनिक शिल्लक प्रॉडक्ट पद्धत (Daily Balance Product)");
            }

            return ("FLAT", "Flat (फ्लॅट स्लॅब दर)");
        }

        public static PigmySlabResolution ResolveApplicableSlab(
            PigmyScheme? scheme,
            int elapsedDays,
            bool isPremature)
        {
            int tenureDays = ResolveSchemeTenureDays(scheme);
            int daysInYear = ResolveInterestDaysInYear(scheme);
            var (methodCode, methodLabel) = NormalizeCalculationMethod(scheme?.InterestCalculationMethod);

            var activeSlabs = scheme?.Slabs?
                .Where(s => s.IsActive)
                .OrderBy(s => s.FromDays)
                .ToList();

            if (activeSlabs != null && activeSlabs.Count > 0)
            {
                var match = activeSlabs.FirstOrDefault(s => elapsedDays >= s.FromDays && elapsedDays <= s.ToDays);
                if (match == null)
                {
                    if (elapsedDays >= activeSlabs.Last().FromDays)
                    {
                        match = activeSlabs.Last();
                    }
                    else if (elapsedDays <= activeSlabs.First().ToDays)
                    {
                        match = activeSlabs.First();
                    }
                }

                if (match != null)
                {
                    string baseDesc = !string.IsNullOrWhiteSpace(match.SlabDescription)
                        ? match.SlabDescription!
                        : $"{match.FromDays} ते {match.ToDays} दिवस";
                    string note = match.InterestRate > 0m
                        ? $"{baseDesc} • {methodLabel}"
                        : baseDesc;

                    return new PigmySlabResolution
                    {
                        MatchedSlab = match,
                        PenaltyRate = match.PenaltyRate,
                        InterestRate = match.InterestRate,
                        PolicyNote = note,
                        NormalizedMethod = methodCode,
                        MethodDisplayLabel = methodLabel,
                        InterestDaysInYear = daysInYear,
                        SchemeTenureDays = tenureDays
                    };
                }
            }

            // Dynamic scheme-parameter fallback when no active Slabs rows exist in DB
            decimal penRate = scheme?.PenaltyInterestRate ?? 0m;
            decimal premRate = scheme?.PrematureInterestRate ?? 0m;
            decimal fullRate = scheme?.InterestRate ?? 0m;

            int rawMin = scheme?.MinDurationMonths ?? 0;
            int minDaysForInterest = rawMin > 60 ? rawMin : (rawMin > 0 ? rawMin * 30 : Math.Max(90, tenureDays / 2));
            int penaltyCutoffDays = Math.Min(90, Math.Max(30, tenureDays / 4));

            if (!isPremature || elapsedDays >= tenureDays)
            {
                return new PigmySlabResolution
                {
                    MatchedSlab = null,
                    PenaltyRate = 0m,
                    InterestRate = fullRate,
                    PolicyNote = $"मुदतपूर्ती पूर्ण व्याज ({fullRate}% द.सा.द.शे. • {methodLabel})",
                    NormalizedMethod = methodCode,
                    MethodDisplayLabel = methodLabel,
                    InterestDaysInYear = daysInYear,
                    SchemeTenureDays = tenureDays
                };
            }

            if (elapsedDays <= penaltyCutoffDays && penRate > 0m)
            {
                return new PigmySlabResolution
                {
                    MatchedSlab = null,
                    PenaltyRate = penRate,
                    InterestRate = 0m,
                    PolicyNote = $"० ते {penaltyCutoffDays} दिवस ({penRate}% कमिशन/दंड कपात)",
                    NormalizedMethod = methodCode,
                    MethodDisplayLabel = methodLabel,
                    InterestDaysInYear = daysInYear,
                    SchemeTenureDays = tenureDays
                };
            }

            if (elapsedDays >= minDaysForInterest && premRate > 0m)
            {
                return new PigmySlabResolution
                {
                    MatchedSlab = null,
                    PenaltyRate = 0m,
                    InterestRate = premRate,
                    PolicyNote = $"मुदतपूर्व व्याज ({premRate}% द.सा.द.शे. • {methodLabel})",
                    NormalizedMethod = methodCode,
                    MethodDisplayLabel = methodLabel,
                    InterestDaysInYear = daysInYear,
                    SchemeTenureDays = tenureDays
                };
            }

            return new PigmySlabResolution
            {
                MatchedSlab = null,
                PenaltyRate = 0m,
                InterestRate = 0m,
                PolicyNote = "मुदतपूर्व परतावा (मुद्दल परत, ०% व्याज)",
                NormalizedMethod = methodCode,
                MethodDisplayLabel = methodLabel,
                InterestDaysInYear = daysInYear,
                SchemeTenureDays = tenureDays
            };
        }

        public static decimal CalculateWithdrawalInterest(
            decimal requestedAmount,
            PigmySlabResolution slabRes,
            int elapsedDays)
        {
            if (requestedAmount <= 0m || slabRes.InterestRate <= 0m) return 0m;

            if (slabRes.NormalizedMethod == "FLAT")
            {
                return Math.Round(requestedAmount * (slabRes.InterestRate / 100m), 2, MidpointRounding.AwayFromZero);
            }

            int effDays = Math.Max(0, elapsedDays);
            if (effDays <= 0) return 0m;

            if (slabRes.NormalizedMethod == "MONTHLY_MIN_BALANCE")
            {
                int completedMonths = effDays / 30;
                if (completedMonths <= 0) return 0m;
                return Math.Round((requestedAmount * slabRes.InterestRate * completedMonths) / (12m * 100m), 2, MidpointRounding.AwayFromZero);
            }

            // DAILY_PRODUCT or SIMPLE_PRO_RATA on withdrawn slice held in current cycle
            return Math.Round(
                (requestedAmount * slabRes.InterestRate * effDays) / (slabRes.InterestDaysInYear * 100m),
                2,
                MidpointRounding.AwayFromZero);
        }

        public static async Task<decimal> CalculateClosureOrPeriodInterestAsync(
            AppDbContext context,
            PigmyAccount account,
            decimal principalBaseForInterest,
            PigmySlabResolution slabRes,
            DateTime periodStartDate,
            DateTime periodEndDate)
        {
            if (principalBaseForInterest <= 0m || slabRes.InterestRate <= 0m) return 0m;

            DateTime start = periodStartDate.Date;
            DateTime end = periodEndDate.Date;
            int elapsedDays = Math.Max(0, (int)(end - start).TotalDays);

            if (slabRes.NormalizedMethod == "FLAT")
            {
                return Math.Round(principalBaseForInterest * (slabRes.InterestRate / 100m), 2, MidpointRounding.AwayFromZero);
            }

            if (elapsedDays <= 0) return 0m;

            if (slabRes.NormalizedMethod == "SIMPLE_PRO_RATA")
            {
                return Math.Round(
                    (principalBaseForInterest * slabRes.InterestRate * elapsedDays) / (slabRes.InterestDaysInYear * 100m),
                    2,
                    MidpointRounding.AwayFromZero);
            }

            var dailyDeltas = await BuildDailyPrincipalDeltasAsync(context, account.PigmyAccountID, end);

            if (dailyDeltas.Count == 0)
            {
                // Fallback when account has OpeningDate + TotalDepositedAmount without granular transaction rows
                if (slabRes.NormalizedMethod == "MONTHLY_MIN_BALANCE")
                {
                    int fullMonths = Math.Max(0, elapsedDays / 30);
                    return Math.Round(
                        (principalBaseForInterest * slabRes.InterestRate * fullMonths) / (12m * 100m),
                        2,
                        MidpointRounding.AwayFromZero);
                }

                return Math.Round(
                    (principalBaseForInterest * slabRes.InterestRate * elapsedDays) / (slabRes.InterestDaysInYear * 100m),
                    2,
                    MidpointRounding.AwayFromZero);
            }

            if (slabRes.NormalizedMethod == "MONTHLY_MIN_BALANCE")
            {
                decimal totalMonthlyInt = 0m;
                DateTime curMonth = new DateTime(start.Year, start.Month, 1);
                DateTime lastMonth = new DateTime(end.Year, end.Month, 1);

                while (curMonth <= lastMonth)
                {
                    DateTime tenth = new DateTime(curMonth.Year, curMonth.Month, 10);
                    int dim = DateTime.DaysInMonth(curMonth.Year, curMonth.Month);
                    DateTime monthEnd = new DateTime(curMonth.Year, curMonth.Month, dim);

                    if (monthEnd <= end && tenth >= start.AddDays(-10))
                    {
                        decimal minBal = GetMinimumBalanceInWindow(dailyDeltas, tenth, monthEnd);
                        if (minBal > 0m)
                        {
                            totalMonthlyInt += (minBal * slabRes.InterestRate) / (12m * 100m);
                        }
                    }
                    curMonth = curMonth.AddMonths(1);
                }

                return Math.Round(totalMonthlyInt, 2, MidpointRounding.AwayFromZero);
            }

            // DAILY_PRODUCT: exact day-by-day running principal balance product from periodStartDate to periodEndDate
            decimal runningBal = dailyDeltas
                .Where(kv => kv.Key < start)
                .Sum(kv => kv.Value);
            if (runningBal < 0m) runningBal = 0m;

            decimal dailyInterestSum = 0m;
            DateTime cursor = start;

            var inRangeDates = dailyDeltas
                .Where(kv => kv.Key >= start && kv.Key < end)
                .OrderBy(kv => kv.Key)
                .ToList();

            foreach (var evt in inRangeDates)
            {
                int spanDays = (int)(evt.Key - cursor).TotalDays;
                if (spanDays > 0 && runningBal > 0m)
                {
                    dailyInterestSum += (runningBal * slabRes.InterestRate * spanDays) / (slabRes.InterestDaysInYear * 100m);
                }
                runningBal = Math.Max(0m, runningBal + evt.Value);
                cursor = evt.Key;
            }

            int tailDays = (int)(end - cursor).TotalDays;
            if (tailDays > 0 && runningBal > 0m)
            {
                dailyInterestSum += (runningBal * slabRes.InterestRate * tailDays) / (slabRes.InterestDaysInYear * 100m);
            }

            return Math.Round(dailyInterestSum, 2, MidpointRounding.AwayFromZero);
        }

        private static async Task<Dictionary<DateTime, decimal>> BuildDailyPrincipalDeltasAsync(
            AppDbContext context,
            int pigmyAccountId,
            DateTime upToDate)
        {
            var deltas = new Dictionary<DateTime, decimal>();

            var txRows = await context.PigmyTransactions
                .AsNoTracking()
                .Where(t => t.PigmyAccountID == pigmyAccountId &&
                            t.TransactionDate.Date <= upToDate &&
                            t.TransactionType != "INTEREST")
                .Select(t => new { Date = t.TransactionDate.Date, t.TransactionType, t.CrAmount, t.DrAmount })
                .ToListAsync();

            bool hasCreditTx = txRows.Any(t => t.CrAmount > 0m);
            if (hasCreditTx)
            {
                foreach (var tx in txRows)
                {
                    decimal net = tx.CrAmount - tx.DrAmount;
                    if (deltas.TryGetValue(tx.Date, out decimal cur))
                        deltas[tx.Date] = cur + net;
                    else
                        deltas[tx.Date] = net;
                }
                return deltas;
            }

            // Fallback when collections / opening balances were inserted without PigmyTransactions credit rows
            var obRows = await context.PigmyOpeningBalances
                .AsNoTracking()
                .Where(o => o.PigmyAccountID == pigmyAccountId && o.AsOfDate.Date <= upToDate)
                .Select(o => new { Date = o.AsOfDate.Date, o.MigratedBalanceAmount })
                .ToListAsync();

            var colRows = await context.PigmyCollections
                .AsNoTracking()
                .Where(c => c.PigmyAccountId == pigmyAccountId && c.CollectionDate.Date <= upToDate)
                .Select(c => new { Date = c.CollectionDate.Date, c.CollectionAmount })
                .ToListAsync();

            if (obRows.Count == 0 && colRows.Count == 0)
            {
                return deltas;
            }

            foreach (var ob in obRows)
            {
                deltas[ob.Date] = (deltas.TryGetValue(ob.Date, out decimal c) ? c : 0m) + ob.MigratedBalanceAmount;
            }
            foreach (var col in colRows)
            {
                deltas[col.Date] = (deltas.TryGetValue(col.Date, out decimal c) ? c : 0m) + col.CollectionAmount;
            }
            foreach (var wdr in txRows.Where(t => t.DrAmount > 0m))
            {
                deltas[wdr.Date] = (deltas.TryGetValue(wdr.Date, out decimal c) ? c : 0m) - wdr.DrAmount;
            }

            return deltas;
        }

        private static decimal GetMinimumBalanceInWindow(
            Dictionary<DateTime, decimal> dailyDeltas,
            DateTime windowStart,
            DateTime windowEnd)
        {
            decimal running = dailyDeltas
                .Where(kv => kv.Key <= windowStart)
                .Sum(kv => kv.Value);
            if (running < 0m) running = 0m;

            decimal minBal = running;
            foreach (var evt in dailyDeltas.Where(kv => kv.Key > windowStart && kv.Key <= windowEnd).OrderBy(kv => kv.Key))
            {
                running = Math.Max(0m, running + evt.Value);
                if (running < minBal)
                {
                    minBal = running;
                }
            }

            return Math.Max(0m, minBal);
        }
    }
}
