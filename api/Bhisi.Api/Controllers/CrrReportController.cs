using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [AllowAnonymous]
    public class CrrReportController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CrrReportController(AppDbContext context)
        {
            _context = context;
        }

        // Helper: Get Sanstha Name & Info
        private async Task<SansthaDetail?> GetSansthaAsync()
        {
            return await _context.SansthaDetails.AsNoTracking().FirstOrDefaultAsync();
        }

        // Helper: Calculate Ledger Balance up to a specific date
        // For Debit-normal assets (Cash, Bank): OpeningBalance (Dr positive, Cr negative) + Sum(Dr) - Sum(Cr)
        private async Task<Dictionary<int, decimal>> GetAssetLedgerBalancesAsync(List<int> ledgerIds, DateTime targetDate)
        {
            if (ledgerIds == null || !ledgerIds.Any())
                return new Dictionary<int, decimal>();

            var ledgers = await _context.Ledgers.AsNoTracking()
                .Where(l => ledgerIds.Contains(l.LedgerID))
                .ToListAsync();

            var voucherTransactions = await _context.VoucherDetails
                .AsNoTracking()
                .Where(vd => ledgerIds.Contains(vd.LedgerID) &&
                             vd.Voucher != null &&
                             vd.Voucher.Status == "Approved" &&
                             vd.Voucher.VoucherDate.Date <= targetDate.Date)
                .GroupBy(vd => new { vd.LedgerID, vd.DrCr })
                .Select(g => new
                {
                    g.Key.LedgerID,
                    g.Key.DrCr,
                    Total = g.Sum(x => x.Amount)
                })
                .ToListAsync();

            var balanceMap = new Dictionary<int, decimal>();

            foreach (var l in ledgers)
            {
                decimal opening = l.OpeningBalance;
                if (l.OpeningBalanceType == "Cr") opening = -opening;

                decimal dr = voucherTransactions
                    .Where(x => x.LedgerID == l.LedgerID && x.DrCr == "Dr")
                    .Sum(x => x.Total);

                decimal cr = voucherTransactions
                    .Where(x => x.LedgerID == l.LedgerID && x.DrCr == "Cr")
                    .Sum(x => x.Total);

                decimal closing = opening + dr - cr;
                balanceMap[l.LedgerID] = Math.Max(0, closing);
            }

            return balanceMap;
        }

        // GET: api/CrrReport/Summary?asOnDate=2026-03-31&branchId=0&targetCrrPercent=3.0
        [HttpGet("Summary")]
        public async Task<IActionResult> GetSummary([FromQuery] string? asOnDate, [FromQuery] int branchId = 0, [FromQuery] decimal targetCrrPercent = 3.0m)
        {
            DateTime targetDate = DateTime.Today;
            if (!string.IsNullOrWhiteSpace(asOnDate) && DateTime.TryParse(asOnDate, out var dt))
            {
                targetDate = dt;
            }

            try
            {
                var sanstha = await GetSansthaAsync();

                // 1. Deposits Calculation
                var savingDeposits = await _context.SavingAccountMasters.AsNoTracking()
                    .Where(s => s.Status == "Active" || string.IsNullOrEmpty(s.Status))
                    .SumAsync(s => (decimal?)s.CurrentBalance) ?? 0m;

                var fdDeposits = await _context.FdAccounts.AsNoTracking()
                    .Where(f => f.Status == "Active" || string.IsNullOrEmpty(f.Status))
                    .SumAsync(f => (decimal?)f.DepositAmount) ?? 0m;

                var rdDeposits = await _context.RdAccounts.AsNoTracking()
                    .Where(r => r.Status == "Active" || string.IsNullOrEmpty(r.Status))
                    .SumAsync(r => (decimal?)r.TotalDepositedAmount) ?? 0m;

                var pigmyDeposits = await _context.PigmyAccounts.AsNoTracking()
                    .Where(p => p.Status == "Active" || string.IsNullOrEmpty(p.Status))
                    .SumAsync(p => (decimal?)p.TotalDepositedAmount) ?? 0m;

                decimal totalDeposits = savingDeposits + fdDeposits + rdDeposits + pigmyDeposits;

                // 2. Identify Cash Ledgers
                var cashLedgers = await _context.Ledgers.AsNoTracking()
                    .Where(l => l.IsActive && 
                                (l.AccountType != null && l.AccountType.ToLower() == "cash" ||
                                 l.LedgerName.Contains("रोख") || 
                                 l.LedgerName.ToLower().Contains("cash in hand")))
                    .ToListAsync();

                var cashLedgerIds = cashLedgers.Select(l => l.LedgerID).ToList();
                var cashBalances = await GetAssetLedgerBalancesAsync(cashLedgerIds, targetDate);

                decimal totalCashInHand = 0m;
                var cashDetails = new List<object>();

                foreach (var cl in cashLedgers)
                {
                    decimal bal = cashBalances.ContainsKey(cl.LedgerID) ? cashBalances[cl.LedgerID] : cl.OpeningBalance;
                    totalCashInHand += bal;
                    cashDetails.Add(new
                    {
                        ledgerId = cl.LedgerID,
                        ledgerName = cl.LedgerName,
                        balance = Math.Round(bal, 2)
                    });
                }

                // Fallback if cash ledgers had 0
                if (totalCashInHand == 0 && cashLedgers.Any())
                {
                    totalCashInHand = cashLedgers.Sum(c => c.OpeningBalance);
                }

                // 3. Identify Bank Current Account Ledgers
                var bankCurrentLedgers = await _context.Ledgers.AsNoTracking()
                    .Where(l => l.IsActive && 
                                (l.AccountType != null && l.AccountType.ToLower() == "bank") &&
                                (l.LedgerName.Contains("चालू") || l.LedgerName.ToLower().Contains("current")))
                    .ToListAsync();

                // Also check savings accounts with banks if current is empty
                var allBankLedgers = await _context.Ledgers.AsNoTracking()
                    .Where(l => l.IsActive && l.AccountType != null && l.AccountType.ToLower() == "bank")
                    .ToListAsync();

                var bankLedgerIds = allBankLedgers.Select(l => l.LedgerID).ToList();
                var bankBalances = await GetAssetLedgerBalancesAsync(bankLedgerIds, targetDate);

                decimal totalBankCurrent = 0m;
                var bankCurrentDetails = new List<object>();

                var targetBankLedgers = bankCurrentLedgers.Any() ? bankCurrentLedgers : allBankLedgers;

                foreach (var bl in targetBankLedgers)
                {
                    decimal bal = bankBalances.ContainsKey(bl.LedgerID) ? bankBalances[bl.LedgerID] : bl.OpeningBalance;
                    totalBankCurrent += bal;
                    bankCurrentDetails.Add(new
                    {
                        ledgerId = bl.LedgerID,
                        ledgerName = bl.LedgerName,
                        accountType = bl.AccountType ?? "Bank",
                        balance = Math.Round(bal, 2)
                    });
                }

                // 4. CRR Calculations
                decimal totalLiquidCash = totalCashInHand + totalBankCurrent;
                decimal actualCrrPercent = totalDeposits > 0 
                    ? Math.Round((totalLiquidCash * 100m) / totalDeposits, 2) 
                    : 0m;

                decimal requiredCrrPercent = targetCrrPercent > 0 ? targetCrrPercent : 3.0m;
                decimal requiredCrrAmount = Math.Round(totalDeposits * (requiredCrrPercent / 100m), 2);
                decimal surplusDeficitAmount = Math.Round(totalLiquidCash - requiredCrrAmount, 2);

                // Status Logic:
                // Deficit: < 1.0%
                // Complied / Optimal: 1.0% to 5.0%
                // Excess: > 5.0%
                string complianceStatus = "Complied";
                string statusTextMarathi = "🟢 आदर्श विहित प्रमाणात (Complied)";
                string statusColor = "green";

                if (actualCrrPercent < 1.0m)
                {
                    complianceStatus = "Deficit";
                    statusTextMarathi = "🔴 रोख तरलता तुटवडा (Deficit Alert)";
                    statusColor = "red";
                }
                else if (actualCrrPercent > 5.0m)
                {
                    complianceStatus = "Excess";
                    statusTextMarathi = "🟡 अतिरिक्त पडून रोकड (Excess Cash)";
                    statusColor = "yellow";
                }

                var response = new
                {
                    asOnDate = targetDate.ToString("yyyy-MM-dd"),
                    targetCrrPercent = requiredCrrPercent,
                    statutoryMinPercent = 1.0m,
                    statutoryMaxPercent = 5.0m,
                    totalDeposits = totalDeposits,
                    depositBreakup = new
                    {
                        fixedDeposits = fdDeposits,
                        savingDeposits = savingDeposits,
                        recurringDeposits = rdDeposits,
                        pigmyDeposits = pigmyDeposits
                    },
                    cashInHand = totalCashInHand,
                    cashDetails = cashDetails,
                    bankCurrentBalances = totalBankCurrent,
                    bankCurrentDetails = bankCurrentDetails,
                    totalLiquidCash = totalLiquidCash,
                    actualCrrPercent = actualCrrPercent,
                    requiredCrrAmount = requiredCrrAmount,
                    surplusDeficitAmount = surplusDeficitAmount,
                    complianceStatus = complianceStatus,
                    statusTextMarathi = statusTextMarathi,
                    statusColor = statusColor,
                    isEligibleForContribution = (actualCrrPercent >= 1.0m && actualCrrPercent <= 5.0m),
                    sanstha = new
                    {
                        name = sanstha?.SansthaName ?? "नागरी सहकारी पतसंस्था मर्यादित",
                        registrationNo = sanstha?.RegistrationNo ?? "",
                        address = sanstha?.Address ?? "",
                        contactNo = sanstha?.ContactNo ?? ""
                    }
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Error generating CRR summary: {ex.Message}" });
            }
        }

        // GET: api/CrrReport/DailyStatement?fromDate=2026-03-01&toDate=2026-03-31&branchId=0&targetCrrPercent=3.0
        [HttpGet("DailyStatement")]
        public async Task<IActionResult> GetDailyStatement(
            [FromQuery] string? fromDate, 
            [FromQuery] string? toDate, 
            [FromQuery] int branchId = 0, 
            [FromQuery] decimal targetCrrPercent = 3.0m)
        {
            DateTime start = DateTime.Today.AddDays(-30);
            DateTime end = DateTime.Today;

            if (!string.IsNullOrWhiteSpace(fromDate) && DateTime.TryParse(fromDate, out var s)) start = s;
            if (!string.IsNullOrWhiteSpace(toDate) && DateTime.TryParse(toDate, out var e)) end = e;

            if (start > end)
            {
                var temp = start; start = end; end = temp;
            }

            // Cap at 60 days for performance
            if ((end - start).TotalDays > 60)
            {
                start = end.AddDays(-60);
            }

            try
            {
                // Current deposits as baseline
                var savingDeposits = await _context.SavingAccountMasters.AsNoTracking()
                    .Where(s => s.Status == "Active" || string.IsNullOrEmpty(s.Status))
                    .SumAsync(s => (decimal?)s.CurrentBalance) ?? 0m;
                var fdDeposits = await _context.FdAccounts.AsNoTracking()
                    .Where(f => f.Status == "Active" || string.IsNullOrEmpty(f.Status))
                    .SumAsync(f => (decimal?)f.DepositAmount) ?? 0m;
                var rdDeposits = await _context.RdAccounts.AsNoTracking()
                    .Where(r => r.Status == "Active" || string.IsNullOrEmpty(r.Status))
                    .SumAsync(r => (decimal?)r.TotalDepositedAmount) ?? 0m;
                var pigmyDeposits = await _context.PigmyAccounts.AsNoTracking()
                    .Where(p => p.Status == "Active" || string.IsNullOrEmpty(p.Status))
                    .SumAsync(p => (decimal?)p.TotalDepositedAmount) ?? 0m;

                decimal baselineDeposits = savingDeposits + fdDeposits + rdDeposits + pigmyDeposits;

                // Cash & Bank Ledgers
                var liquidLedgers = await _context.Ledgers.AsNoTracking()
                    .Where(l => l.IsActive && 
                                (l.AccountType != null && (l.AccountType.ToLower() == "cash" || l.AccountType.ToLower() == "bank") ||
                                 l.LedgerName.Contains("रोख") || l.LedgerName.Contains("बँक")))
                    .ToListAsync();

                var ledgerIds = liquidLedgers.Select(l => l.LedgerID).ToList();

                var allApprovedVouchers = await _context.VoucherDetails.AsNoTracking()
                    .Where(vd => ledgerIds.Contains(vd.LedgerID) &&
                                 vd.Voucher != null &&
                                 vd.Voucher.Status == "Approved" &&
                                 vd.Voucher.VoucherDate.Date <= end.Date)
                    .Select(vd => new
                    {
                        vd.LedgerID,
                        vd.DrCr,
                        vd.Amount,
                        VoucherDate = vd.Voucher!.VoucherDate.Date
                    })
                    .ToListAsync();

                decimal targetPercent = targetCrrPercent > 0 ? targetCrrPercent : 3.0m;
                var rows = new List<object>();

                decimal sumCrr = 0m;
                decimal maxCrr = 0m;
                decimal minCrr = 999m;
                int deficitDays = 0;
                int totalDays = 0;

                for (DateTime d = start.Date; d <= end.Date; d = d.AddDays(1))
                {
                    totalDays++;

                    // Calculate liquid cash up to day 'd'
                    decimal dayCash = 0m;
                    decimal dayBank = 0m;

                    foreach (var l in liquidLedgers)
                    {
                        bool isCash = l.AccountType?.ToLower() == "cash" || l.LedgerName.Contains("रोख");
                        decimal opening = l.OpeningBalanceType == "Cr" ? -l.OpeningBalance : l.OpeningBalance;

                        decimal dr = allApprovedVouchers
                            .Where(x => x.LedgerID == l.LedgerID && x.DrCr == "Dr" && x.VoucherDate <= d)
                            .Sum(x => x.Amount);

                        decimal cr = allApprovedVouchers
                            .Where(x => x.LedgerID == l.LedgerID && x.DrCr == "Cr" && x.VoucherDate <= d)
                            .Sum(x => x.Amount);

                        decimal bal = Math.Max(0, opening + dr - cr);
                        if (isCash) dayCash += bal;
                        else dayBank += bal;
                    }

                    if (dayCash == 0 && liquidLedgers.Any(l => l.AccountType?.ToLower() == "cash"))
                    {
                        dayCash = liquidLedgers.Where(l => l.AccountType?.ToLower() == "cash").Sum(l => l.OpeningBalance);
                    }

                    decimal dayLiquidTotal = dayCash + dayBank;
                    decimal dayCrrPercent = baselineDeposits > 0 
                        ? Math.Round((dayLiquidTotal * 100m) / baselineDeposits, 2) 
                        : 0m;

                    decimal dayRequired = Math.Round(baselineDeposits * (targetPercent / 100m), 2);
                    decimal daySurplusDeficit = Math.Round(dayLiquidTotal - dayRequired, 2);

                    string status = "Complied";
                    string statusBadge = "🟢 योग्य";
                    if (dayCrrPercent < 1.0m)
                    {
                        status = "Deficit";
                        statusBadge = "🔴 तुटवडा";
                        deficitDays++;
                    }
                    else if (dayCrrPercent > 5.0m)
                    {
                        status = "Excess";
                        statusBadge = "🟡 अतिरिक्त";
                    }

                    sumCrr += dayCrrPercent;
                    if (dayCrrPercent > maxCrr) maxCrr = dayCrrPercent;
                    if (dayCrrPercent < minCrr) minCrr = dayCrrPercent;

                    rows.Add(new
                    {
                        date = d.ToString("yyyy-MM-dd"),
                        displayDate = d.ToString("dd/MM/yyyy"),
                        dayOfWeek = d.ToString("ddd"),
                        totalDeposits = baselineDeposits,
                        cashInHand = Math.Round(dayCash, 2),
                        bankCurrent = Math.Round(dayBank, 2),
                        totalLiquidCash = Math.Round(dayLiquidTotal, 2),
                        crrPercent = dayCrrPercent,
                        requiredAmount = dayRequired,
                        surplusDeficit = daySurplusDeficit,
                        status = status,
                        statusBadge = statusBadge
                    });
                }

                if (minCrr == 999m) minCrr = 0m;
                decimal avgCrr = totalDays > 0 ? Math.Round(sumCrr / totalDays, 2) : 0m;

                return Ok(new
                {
                    fromDate = start.ToString("yyyy-MM-dd"),
                    toDate = end.ToString("yyyy-MM-dd"),
                    targetCrrPercent = targetPercent,
                    totalDays = totalDays,
                    averageCrrPercent = avgCrr,
                    maxCrrPercent = maxCrr,
                    minCrrPercent = minCrr,
                    deficitDaysCount = deficitDays,
                    isOverallCompliant = avgCrr >= 1.0m && avgCrr <= 5.0m,
                    rows = rows
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Error generating daily statement: {ex.Message}" });
            }
        }

        // GET: api/CrrReport/BranchRetention?asOnDate=2026-03-31
        [HttpGet("BranchRetention")]
        public async Task<IActionResult> GetBranchRetention([FromQuery] string? asOnDate)
        {
            DateTime targetDate = DateTime.Today;
            if (!string.IsNullOrWhiteSpace(asOnDate) && DateTime.TryParse(asOnDate, out var dt))
            {
                targetDate = dt;
            }

            try
            {
                var branches = await _context.Branches.AsNoTracking()
                    .Where(b => b.IsActive)
                    .Include(b => b.DefaultCashLedger)
                    .ToListAsync();

                var branchRows = new List<object>();

                foreach (var b in branches)
                {
                    // Approved Cash Retention Limit (Standard defaults: Main Branch: 10 Lakh, Sub-branches: 5 Lakh)
                    bool isHeadOffice = b.BranchType?.Equals("HeadOffice", StringComparison.OrdinalIgnoreCase) == true ||
                                       b.BranchName.Contains("मुख्य") || b.BranchID == 1;

                    decimal approvedLimit = isHeadOffice ? 1000000m : 500000m;
                    decimal insuranceLimit = isHeadOffice ? 1500000m : 750000m;

                    decimal actualCash = 0m;

                    if (b.DefaultCashLedger != null)
                    {
                        var singleLedgerList = new List<int> { b.DefaultCashLedgerID!.Value };
                        var balMap = await GetAssetLedgerBalancesAsync(singleLedgerList, targetDate);
                        actualCash = balMap.ContainsKey(b.DefaultCashLedgerID.Value) ? balMap[b.DefaultCashLedgerID.Value] : b.DefaultCashLedger.OpeningBalance;
                    }
                    else
                    {
                        // Check if ledger name matches branch name
                        var matchingLedger = await _context.Ledgers.AsNoTracking()
                            .FirstOrDefaultAsync(l => l.IsActive && l.LedgerName.Contains("रोख") && l.LedgerName.Contains(b.BranchName));
                        if (matchingLedger != null)
                        {
                            var balMap = await GetAssetLedgerBalancesAsync(new List<int> { matchingLedger.LedgerID }, targetDate);
                            actualCash = balMap.ContainsKey(matchingLedger.LedgerID) ? balMap[matchingLedger.LedgerID] : matchingLedger.OpeningBalance;
                        }
                    }

                    decimal variance = actualCash - approvedLimit;
                    bool isBreached = variance > 0;
                    bool isInsuranceAdequate = actualCash <= insuranceLimit;

                    branchRows.Add(new
                    {
                        branchId = b.BranchID,
                        branchCode = b.BranchCode,
                        branchName = b.BranchName,
                        branchType = isHeadOffice ? "मुख्य शाखा (Head Office)" : "उप-शाखा (Branch)",
                        approvedCashLimit = approvedLimit,
                        actualCashBalance = Math.Round(actualCash, 2),
                        variance = Math.Round(variance, 2),
                        isBreached = isBreached,
                        insuranceLimit = insuranceLimit,
                        isInsuranceAdequate = isInsuranceAdequate,
                        statusBadge = isBreached ? "🔴 मर्यादा ओलांडली" : "🟢 मर्यादेत"
                    });
                }

                return Ok(new
                {
                    asOnDate = targetDate.ToString("yyyy-MM-dd"),
                    branches = branchRows
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Error generating branch retention statement: {ex.Message}" });
            }
        }
    }
}
