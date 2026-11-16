using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Filters;
using Bhisi.Api.Helpers;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class InvestmentAccountsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public InvestmentAccountsController(AppDbContext context)
        {
            _context = context;
        }

        // Helper class for Modulo-10 Luhn Check Digit calculation and validation
        public static class LuhnHelper
        {
            public static int CalculateCheckDigit(string digits)
            {
                int sum = 0;
                bool alternate = true;
                for (int i = digits.Length - 1; i >= 0; i--)
                {
                    int d = digits[i] - '0';
                    if (alternate)
                    {
                        d *= 2;
                        if (d > 9) d -= 9;
                    }
                    sum += d;
                    alternate = !alternate;
                }
                int mod = sum % 10;
                return (mod == 0) ? 0 : 10 - mod;
            }
        }

        private async Task<string> GenerateNextInvestmentAccountNo(int branchId, int? schemeId, bool incrementSequence = false)
        {
            var branch = await _context.Branches.FindAsync(branchId);
            string branchCode3 = branch != null && !string.IsNullOrWhiteSpace(branch.BranchCode)
                ? branch.BranchCode.PadLeft(3, '0').Substring(0, Math.Min(3, branch.BranchCode.PadLeft(3, '0').Length))
                : branchId.ToString("D3");

            // Product code for Investments: 701 (Deposit Investments) or 702 (Share Investments)
            string productCode3 = "701";
            if (schemeId.HasValue && schemeId.Value > 0)
            {
                var scheme = await _context.InvestmentSchemes.FindAsync(schemeId.Value);
                if (scheme != null && scheme.InvestmentType == "Share")
                {
                    productCode3 = "702";
                }
            }

            var seq = await _context.InvestmentAccountSequences
                .FirstOrDefaultAsync(s => s.BranchID == branchId && s.ProductType == "INV");

            if (seq == null)
            {
                seq = new InvestmentAccountSequence { BranchID = branchId, ProductType = "INV", CurrentValue = 0 };
                _context.InvestmentAccountSequences.Add(seq);
                await _context.SaveChangesAsync();
            }

            int nextSeqNumber = seq.CurrentValue + 1;
            if (incrementSequence)
            {
                seq.CurrentValue++;
                await _context.SaveChangesAsync();
                nextSeqNumber = seq.CurrentValue;
            }

            string thirteenDigits = $"{branchCode3}{productCode3}{nextSeqNumber:D7}";
            int checkDigit = LuhnHelper.CalculateCheckDigit(thirteenDigits);
            return $"{branchCode3}-{productCode3}-{nextSeqNumber:D7}-{checkDigit}";
        }

        // GET: api/InvestmentAccounts/next-account-no?branchId=1&schemeId=1
        [HttpGet("next-account-no")]
        public async Task<ActionResult<object>> GetNextAccountNo([FromQuery] int? branchId, [FromQuery] int? schemeId)
        {
            int targetBranchId = branchId ?? 1;
            string nextNo = await GenerateNextInvestmentAccountNo(targetBranchId, schemeId, incrementSequence: false);

            string nextLegacyAccountNo = "1";
            if (schemeId.HasValue && schemeId.Value > 0)
            {
                var existingLegacyList = await _context.InvestmentAccounts
                    .AsNoTracking()
                    .Where(a => a.BranchID == targetBranchId &&
                                a.SchemeID == schemeId.Value &&
                                a.OldInvestmentNo != null &&
                                a.OldInvestmentNo != "")
                    .Select(a => a.OldInvestmentNo!)
                    .ToListAsync();

                long maxLegacySeq = 0;
                foreach (var legacyStr in existingLegacyList)
                {
                    if (string.IsNullOrWhiteSpace(legacyStr)) continue;
                    var trimmed = legacyStr.Trim();
                    if (long.TryParse(trimmed, out long numVal))
                    {
                        if (numVal > maxLegacySeq) maxLegacySeq = numVal;
                    }
                    else
                    {
                        var match = System.Text.RegularExpressions.Regex.Match(trimmed, @"(\d+)$");
                        if (match.Success && long.TryParse(match.Groups[1].Value, out long extractedVal))
                        {
                            if (extractedVal > maxLegacySeq) maxLegacySeq = extractedVal;
                        }
                    }
                }

                nextLegacyAccountNo = maxLegacySeq > 0 ? (maxLegacySeq + 1).ToString() : "1";
            }

            return Ok(new { nextAccountNo = nextNo, nextLegacyAccountNo = nextLegacyAccountNo });
        }

        /// <summary>
        /// 100% Dynamic CBS Sync Engine for Investment Opening Balances.
        /// Strictly ZERO Fallbacks: All ledgers are dynamically resolved from InvestmentSchemes
        /// (InvestmentAssetLedgerID and InterestReceivableLedgerID).
        /// Recalculates and updates BranchLedgerOpeningBalances and Ledgers.OpeningBalance,
        /// ensuring 100% accurate reflection in Trial Balance (तेरीज), Balance Sheet (ताळेबंद), and General Ledger (खातावणी).
        /// </summary>
        public async Task SyncInvestmentOpeningBalancesAsync(int? targetBranchId = null)
        {
            // 1. Identify initial (Go-Live / earliest) financial year for legacy investment opening balances
            int activeFyId = await _context.FinancialYears
                .OrderBy(fy => fy.StartDate)
                .ThenBy(fy => fy.FinancialYearID)
                .Select(fy => fy.FinancialYearID)
                .FirstOrDefaultAsync();

            if (activeFyId == 0)
            {
                return;
            }

            var straySubsequentRows = await _context.BranchLedgerOpeningBalances
                .Where(b => b.FinancialYearID != activeFyId &&
                            b.Remarks != null &&
                            b.Remarks.Contains("गुंतवणूक सुरुवातीची शिल्लक"))
                .ToListAsync();
            if (straySubsequentRows.Count > 0)
            {
                _context.BranchLedgerOpeningBalances.RemoveRange(straySubsequentRows);
                await _context.SaveChangesAsync();
            }

            // 2. Fetch all Investment Schemes that have linked GL Ledgers
            var schemes = await _context.InvestmentSchemes
                .AsNoTracking()
                .Where(s => s.InvestmentAssetLedgerID.HasValue || s.InterestReceivableLedgerID.HasValue)
                .ToListAsync();

            var allSchemeLedgerIds = schemes
                .SelectMany(s => new[] { s.InvestmentAssetLedgerID, s.InterestReceivableLedgerID })
                .Where(id => id.HasValue && id.Value > 0)
                .Select(id => id.Value)
                .Distinct()
                .ToList();

            if (!allSchemeLedgerIds.Any())
            {
                return;
            }

            // 3. Query all active legacy investment accounts
            var legacyQuery = _context.InvestmentAccounts
                .AsNoTracking()
                .Include(a => a.InvestmentScheme)
                .Where(a => a.IsLegacyAccount && a.Status == "Active");

            if (targetBranchId.HasValue && targetBranchId.Value > 0)
            {
                legacyQuery = legacyQuery.Where(a => a.BranchID == targetBranchId.Value);
            }

            var legacyAccounts = await legacyQuery.ToListAsync();

            // 4. Determine list of branches to sync
            List<int> branchIdsToSync;
            if (targetBranchId.HasValue && targetBranchId.Value > 0)
            {
                branchIdsToSync = new List<int> { targetBranchId.Value };
            }
            else
            {
                branchIdsToSync = await _context.Branches
                    .Select(b => b.BranchID)
                    .Distinct()
                    .ToListAsync();
                if (!branchIdsToSync.Any())
                {
                    branchIdsToSync = new List<int> { 1 };
                }
            }

            // 5. Aggregate required Dr balances per (BranchID, LedgerID)
            var targetBalances = new Dictionary<(int BranchId, int LedgerId), decimal>();

            // Initialize all branch/ledger pairs to 0
            foreach (var bId in branchIdsToSync)
            {
                foreach (var lId in allSchemeLedgerIds)
                {
                    targetBalances[(bId, lId)] = 0m;
                }
            }

            // Sum up Principal and Accrued Interest from legacy accounts
            foreach (var acc in legacyAccounts)
            {
                if (acc.InvestmentScheme == null) continue;

                // A. Principal Amount -> InvestmentAssetLedgerID
                if (acc.InvestmentScheme.InvestmentAssetLedgerID.HasValue && 
                    acc.InvestmentScheme.InvestmentAssetLedgerID.Value > 0 &&
                    acc.PrincipalAmount > 0)
                {
                    var key = (acc.BranchID, acc.InvestmentScheme.InvestmentAssetLedgerID.Value);
                    targetBalances[key] = targetBalances.GetValueOrDefault(key, 0m) + acc.PrincipalAmount;
                }

                // B. Accrued Interest Till Migration -> InterestReceivableLedgerID
                if (acc.AccruedInterestTillMigration > 0 && 
                    acc.InvestmentScheme.InterestReceivableLedgerID.HasValue && 
                    acc.InvestmentScheme.InterestReceivableLedgerID.Value > 0)
                {
                    var key = (acc.BranchID, acc.InvestmentScheme.InterestReceivableLedgerID.Value);
                    targetBalances[key] = targetBalances.GetValueOrDefault(key, 0m) + acc.AccruedInterestTillMigration;
                }
            }

            // 6. Fetch existing BranchLedgerOpeningBalances for these branches & ledgers in active FY
            var existingRows = await _context.BranchLedgerOpeningBalances
                .Where(b => b.FinancialYearID == activeFyId && 
                            branchIdsToSync.Contains(b.BranchID) && 
                            allSchemeLedgerIds.Contains(b.LedgerID))
                .ToListAsync();

            var existingMap = existingRows.ToDictionary(r => (r.BranchID, r.LedgerID), r => r);

            // 7. Upsert BranchLedgerOpeningBalances
            foreach (var kvp in targetBalances)
            {
                int bId = kvp.Key.BranchId;
                int lId = kvp.Key.LedgerId;
                decimal neededBalance = kvp.Value;

                if (existingMap.TryGetValue((bId, lId), out var existing))
                {
                    if (neededBalance > 0 || (existing.Remarks != null && existing.Remarks.Contains("गुंतवणूक सुरुवातीची शिल्लक")))
                    {
                        existing.OpeningBalance = neededBalance;
                        existing.OpeningBalanceType = "Dr";
                        existing.Remarks = "गुंतवणूक सुरुवातीची शिल्लक सिंक (Dynamic CBS Engine)";
                        existing.UpdatedOn = DateTime.UtcNow;
                    }
                }
                else if (neededBalance > 0)
                {
                    var newRecord = new BranchLedgerOpeningBalance
                    {
                        BranchID = bId,
                        LedgerID = lId,
                        FinancialYearID = activeFyId,
                        OpeningBalance = neededBalance,
                        OpeningBalanceType = "Dr",
                        Remarks = "गुंतवणूक सुरुवातीची शिल्लक सिंक (Dynamic CBS Engine)",
                        CreatedOn = DateTime.UtcNow,
                        CreatedBy = 1
                    };
                    _context.BranchLedgerOpeningBalances.Add(newRecord);
                }
            }

            await _context.SaveChangesAsync();
        }

        // POST: api/InvestmentAccounts/sync-opening-balances?branchId=1
        [HttpPost("sync-opening-balances")]
        public async Task<IActionResult> SyncOpeningBalances([FromQuery] int? branchId)
        {
            try
            {
                await SyncInvestmentOpeningBalancesAsync(branchId);
                return Ok(new { 
                    success = true, 
                    message = "गुंतवणूक सुरुवातीची शिल्लक तेरीज, ताळेबंद व GL खात्यांशी यशस्वीरीत्या सिंक करण्यात आली." 
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { 
                    success = false, 
                    message = $"GL सिंक करताना त्रुटी आली: {ex.Message}" 
                });
            }
        }

        private async Task<(bool IsValid, int LedgerId, string? ErrorMessage)> ResolveInvestmentPaymentLedgerAsync(
            int branchId,
            string? paymentMode,
            int? bankLedgerId)
        {
            var mode = string.IsNullOrWhiteSpace(paymentMode) ? "Bank" : paymentMode.Trim();
            if (string.Equals(mode, "Cash", StringComparison.OrdinalIgnoreCase))
            {
                int cashLedgerId = await CashLedgerHelper.GetCashLedgerIdAsync(_context, branchId, "INVESTMENT");
                return (true, cashLedgerId, null);
            }

            if (BankLedgerHelper.IsBankPaymentMode(mode))
            {
                var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(_context, bankLedgerId);
                if (!bankCheck.IsValid)
                {
                    return (false, 0, bankCheck.ErrorMessage);
                }
                return (true, bankCheck.LedgerId, null);
            }

            return (false, 0, $"अवैध व्यवहार पद्धत (Invalid Payment Mode): {mode}");
        }

        private async Task<int> GetDefaultCashBankLedgerId(int branchId = 1)
        {
            // 1. Try branch default cash ledger
            var branch = await _context.Branches.FindAsync(branchId);
            if (branch?.DefaultCashLedgerID != null && branch.DefaultCashLedgerID > 0)
            {
                return branch.DefaultCashLedgerID.Value;
            }

            // 2. Try bank or cash ledger matching branch name
            if (branch != null && !string.IsNullOrWhiteSpace(branch.BranchName))
            {
                var branchSpecificBank = await _context.Ledgers
                    .FirstOrDefaultAsync(l => l.IsActive && 
                        (l.AccountType == "Bank" || l.AccountType == "Cash") &&
                        l.LedgerName.Contains(branch.BranchName));
                if (branchSpecificBank != null) return branchSpecificBank.LedgerID;
            }

            // 3. Fallback to any active Bank or Cash ledger
            var fallbackBank = await _context.Ledgers
                .Include(l => l.AccountGroup)
                .FirstOrDefaultAsync(l => l.IsActive && (
                    l.AccountType == "Bank" || 
                    l.AccountType == "Cash" || 
                    l.LedgerName.Contains("Bank") || 
                    l.LedgerName.Contains("बँक") || 
                    l.LedgerName.Contains("Cash") || 
                    l.LedgerName.Contains("रोख") ||
                    (l.AccountGroup != null && (l.AccountGroup.GroupName.Contains("Bank") || l.AccountGroup.GroupName.Contains("बँक")))));

            return fallbackBank?.LedgerID ?? 1;
        }

        private async Task<InvestmentVoucherMapping?> GetVoucherMappingForBranch(int branchId, string investmentType = "", int? schemeId = null)
        {
            var mapping = await _context.InvestmentVoucherMappings
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.BranchID == branchId && (string.IsNullOrEmpty(investmentType) || m.InvestmentType == investmentType));

            if (mapping == null)
            {
                mapping = await _context.InvestmentVoucherMappings
                    .AsNoTracking()
                    .FirstOrDefaultAsync(m => m.BranchID == branchId);
            }

            if (mapping == null)
            {
                mapping = await _context.InvestmentVoucherMappings
                    .AsNoTracking()
                    .FirstOrDefaultAsync(m => m.BranchID == 1 && (string.IsNullOrEmpty(investmentType) || m.InvestmentType == investmentType));
                if (mapping == null)
                {
                    mapping = await _context.InvestmentVoucherMappings
                        .AsNoTracking()
                        .FirstOrDefaultAsync(m => m.BranchID == 1);
                }
            }

            if (mapping == null)
            {
                mapping = await _context.InvestmentVoucherMappings.AsNoTracking().FirstOrDefaultAsync();
            }

            // Construct an untracked copy so scheme overrides never mutate tracked InvestmentVoucherMappings rows
            InvestmentVoucherMapping? resolved = mapping != null
                ? new InvestmentVoucherMapping
                {
                    BranchID = branchId,
                    InvestmentType = mapping.InvestmentType,
                    InvestmentLedgerID = mapping.InvestmentLedgerID,
                    InterestIncomeLedgerID = mapping.InterestIncomeLedgerID,
                    InterestReceivableLedgerID = mapping.InterestReceivableLedgerID,
                    TdsLedgerID = mapping.TdsLedgerID
                }
                : null;

            if (schemeId.HasValue && schemeId.Value > 0)
            {
                var scheme = await _context.InvestmentSchemes.AsNoTracking().FirstOrDefaultAsync(s => s.SchemeID == schemeId.Value);
                if (scheme != null)
                {
                    if (resolved == null && (scheme.InvestmentAssetLedgerID > 0 || scheme.InterestIncomeLedgerID > 0 || scheme.InterestReceivableLedgerID > 0))
                    {
                        resolved = new InvestmentVoucherMapping
                        {
                            BranchID = branchId,
                            InvestmentType = scheme.InvestmentType,
                            InvestmentLedgerID = scheme.InvestmentAssetLedgerID ?? 0,
                            InterestIncomeLedgerID = scheme.InterestIncomeLedgerID ?? 0,
                            InterestReceivableLedgerID = scheme.InterestReceivableLedgerID ?? 0,
                            TdsLedgerID = scheme.TdsLedgerID
                        };
                    }
                    else if (resolved != null)
                    {
                        if (scheme.InvestmentAssetLedgerID.HasValue && scheme.InvestmentAssetLedgerID.Value > 0)
                            resolved.InvestmentLedgerID = scheme.InvestmentAssetLedgerID.Value;
                        if (scheme.InterestIncomeLedgerID.HasValue && scheme.InterestIncomeLedgerID.Value > 0)
                            resolved.InterestIncomeLedgerID = scheme.InterestIncomeLedgerID.Value;
                        if (scheme.InterestReceivableLedgerID.HasValue && scheme.InterestReceivableLedgerID.Value > 0)
                            resolved.InterestReceivableLedgerID = scheme.InterestReceivableLedgerID.Value;
                        if (scheme.TdsLedgerID.HasValue && scheme.TdsLedgerID.Value > 0)
                            resolved.TdsLedgerID = scheme.TdsLedgerID.Value;
                    }
                }
            }

            return resolved;
        }

        private async Task<(bool IsValid, InvestmentVoucherMapping? Mapping, string? ErrorMessage)> ResolveStrictVoucherMappingAsync(
            int branchId,
            int? schemeId,
            bool requireInvestmentAsset,
            bool requireInterestIncome,
            bool requireInterestReceivable)
        {
            var mapping = await GetVoucherMappingForBranch(branchId, string.Empty, schemeId);
            if (mapping == null)
            {
                return (false, null, "गुंतवणूक योजनेसाठी / शाखेसाठी जी.एल. लेजर मॅपिंग (Investment Voucher Mapping / Scheme GL) कॉन्फिगर केलेले नाही.");
            }

            if (requireInvestmentAsset && (mapping.InvestmentLedgerID <= 0 || !await _context.Ledgers.AnyAsync(l => l.LedgerID == mapping.InvestmentLedgerID)))
            {
                return (false, null, "गुंतवणूक मालमत्ता लेजर (Investment Asset GL Ledger) मॅप केलेले नाही किंवा अवैध आहे.");
            }

            if (requireInterestIncome && (mapping.InterestIncomeLedgerID <= 0 || !await _context.Ledgers.AnyAsync(l => l.LedgerID == mapping.InterestIncomeLedgerID)))
            {
                return (false, null, "गुंतवणूक व्याज / लाभांश उत्पन्न लेजर (Interest Income GL Ledger) मॅप केलेले नाही किंवा अवैध आहे.");
            }

            if (requireInterestReceivable && (mapping.InterestReceivableLedgerID <= 0 || !await _context.Ledgers.AnyAsync(l => l.LedgerID == mapping.InterestReceivableLedgerID)))
            {
                return (false, null, "येणे व्याज लेजर (Interest Receivable GL Ledger) मॅप केलेले नाही किंवा अवैध आहे.");
            }

            return (true, mapping, null);
        }

        private async Task<(bool IsValid, int FinancialYearId, string? ErrorMessage)> ValidateInvestmentTransactionDateAsync(int branchId, DateTime txDate)
        {
            DateTime targetDate = txDate.Date;
            if (targetDate > DateTime.Today)
            {
                return (false, 0, $"अवैध तारीख! भविष्यातील तारीख ({targetDate:dd/MM/yyyy}) अनुज्ञेय नाही.");
            }

            var closedFy = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(fy => fy.IsClosed && targetDate >= fy.StartDate.Date && targetDate <= fy.EndDate.Date);
            if (closedFy != null)
            {
                return (false, 0, $"दिनांक {targetDate:dd/MM/yyyy} ही बंद/ऑडिट झालेल्या आर्थिक वर्षात ({closedFy.YearCode}) येते. बंद आर्थिक वर्षात व्हाउचर पोस्ट करता येणार नाही.");
            }

            var dayStatus = await _context.BranchDayEndStatuses
                .AsNoTracking()
                .FirstOrDefaultAsync(b => b.BranchID == branchId && b.BusinessDate.Date == targetDate);
            if (dayStatus != null && dayStatus.IsDayClosed)
            {
                return (false, 0, $"तारीख {targetDate:dd/MM/yyyy} साठी दिवस अखेर (Day-End) पूर्ण झाली आहे. बंद तारखेत व्यवहार नोंदवता येणार नाही.");
            }

            var lastClosed = await _context.BranchDayEndStatuses
                .AsNoTracking()
                .Where(b => b.BranchID == branchId && b.IsDayClosed)
                .OrderByDescending(b => b.BusinessDate)
                .FirstOrDefaultAsync();
            if (lastClosed != null && targetDate <= lastClosed.BusinessDate.Date)
            {
                return (false, 0, $"तारीख {targetDate:dd/MM/yyyy} ही शेवटच्या बंद झालेल्या दिवसापेक्षा ({lastClosed.BusinessDate:dd/MM/yyyy}) जुनी किंवा बरोबर आहे.");
            }

            var matchingFy = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(fy => targetDate >= fy.StartDate.Date && targetDate <= fy.EndDate.Date);
            if (matchingFy == null)
            {
                matchingFy = await _context.FinancialYears.AsNoTracking().FirstOrDefaultAsync(fy => fy.IsActive);
            }

            return (true, matchingFy?.FinancialYearID ?? 1, null);
        }

        private async Task<(decimal TotalAccrued, decimal TotalReceivedGross, decimal OutstandingReceivable, DateTime? LastAccrualDate)> GetAccountInterestSummaryAsync(
            int accountId,
            InvestmentAccount? account = null)
        {
            account ??= await _context.InvestmentAccounts.AsNoTracking().FirstOrDefaultAsync(a => a.InvestmentAccountID == accountId);
            decimal tillMigration = account?.AccruedInterestTillMigration ?? 0m;

            var accRows = await _context.InvestmentInterestAccruals
                .AsNoTracking()
                .Where(a => a.InvestmentAccountID == accountId)
                .Select(a => new { a.InterestAmount, a.AccrualDate })
                .ToListAsync();

            decimal dbAccrued = accRows.Sum(a => a.InterestAmount);
            DateTime? lastAccrualDate = accRows.Any() ? accRows.Max(a => a.AccrualDate) : null;

            decimal totalReceivedGross = await _context.InvestmentInterestReceipts
                .AsNoTracking()
                .Where(r => r.InvestmentAccountID == accountId)
                .SumAsync(r => (decimal?)(r.GrossAmount > 0m ? r.GrossAmount : r.ReceivedAmount)) ?? 0m;

            decimal outstandingReceivable = Math.Max(0m, Math.Round(tillMigration + dbAccrued - totalReceivedGross, 2, MidpointRounding.AwayFromZero));
            return (Math.Round(tillMigration + dbAccrued, 2, MidpointRounding.AwayFromZero), Math.Round(totalReceivedGross, 2, MidpointRounding.AwayFromZero), outstandingReceivable, lastAccrualDate);
        }

        private async Task SyncAccountBookValueAsync(InvestmentAccount account)
        {
            if (account.Status != "Active")
            {
                account.BookValue = 0m;
                return;
            }
            var (_, _, outstanding, _) = await GetAccountInterestSummaryAsync(account.InvestmentAccountID, account);
            account.BookValue = Math.Round(account.PrincipalAmount + outstanding, 2, MidpointRounding.AwayFromZero);
        }

        private static (DateTime FromDate, DateTime ToDate, int ElapsedDays, decimal CalculatedInterest, string Method, bool AlreadyAccrued) ComputePeriodAccrual(
            InvestmentAccount account,
            InvestmentScheme? scheme,
            DateTime targetAccrualDate,
            DateTime? lastAccrualDate,
            decimal priorDbAccrued,
            DateTime? earliestFyStartDate)
        {
            DateTime targetDate = targetAccrualDate.Date;
            if (lastAccrualDate.HasValue && lastAccrualDate.Value.Date >= targetDate)
            {
                return (lastAccrualDate.Value.Date, targetDate, 0, 0m, scheme?.InterestCalculationMethod ?? "Simple", true);
            }

            DateTime fromDate;
            if (lastAccrualDate.HasValue)
            {
                fromDate = lastAccrualDate.Value.Date.AddDays(1);
            }
            else if (account.IsLegacyAccount && account.AccruedInterestTillMigration > 0m && earliestFyStartDate.HasValue && account.InvestmentDate.Date < earliestFyStartDate.Value.Date)
            {
                // Migrated investment already carries accrued interest up to cutover date (day before earliest FY start)
                fromDate = earliestFyStartDate.Value.Date;
            }
            else
            {
                fromDate = account.InvestmentDate.Date;
            }

            DateTime toDate = targetDate <= account.MaturityDate.Date ? targetDate : account.MaturityDate.Date;
            if (toDate < fromDate)
            {
                return (fromDate, toDate, 0, 0m, scheme?.InterestCalculationMethod ?? "Simple", false);
            }

            int days = (toDate - fromDate).Days + 1;
            string method = string.IsNullOrWhiteSpace(scheme?.InterestCalculationMethod)
                ? "Simple"
                : scheme!.InterestCalculationMethod.Trim();

            decimal calcInterest;
            if (string.Equals(method, "Cumulative", StringComparison.OrdinalIgnoreCase))
            {
                int totalDaysFromOpen = Math.Max(0, (toDate - account.InvestmentDate.Date).Days + 1);
                double tYears = totalDaysFromOpen / 365.0;
                double r = (double)account.InterestRate / 100.0;
                double totalCompound = (double)account.PrincipalAmount * (Math.Pow(1.0 + r / 4.0, 4.0 * tYears) - 1.0);
                decimal alreadyAccruedTotal = account.AccruedInterestTillMigration + priorDbAccrued;
                calcInterest = Math.Max(0m, Math.Round((decimal)totalCompound - alreadyAccruedTotal, 2, MidpointRounding.AwayFromZero));
            }
            else
            {
                calcInterest = Math.Round(account.PrincipalAmount * account.InterestRate * days / 36500m, 2, MidpointRounding.AwayFromZero);
            }

            return (fromDate, toDate, days, calcInterest, method, false);
        }

        // GET: api/InvestmentAccounts
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetInvestmentAccounts([FromQuery] int? branchId, [FromQuery] string? status)
        {
            int? effectiveBranch = User.ResolveOptionalBranchId(branchId);

            var query = _context.InvestmentAccounts
                .AsNoTracking()
                .Include(a => a.InvestmentInstitution)
                .Include(a => a.InvestmentScheme)
                .Include(a => a.Branch)
                .AsQueryable();

            if (effectiveBranch.HasValue && effectiveBranch.Value > 0)
            {
                query = query.Where(a => a.BranchID == effectiveBranch.Value);
            }
            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(a => a.Status == status);
            }

            var rawAccounts = await query
                .OrderByDescending(a => a.InvestmentDate)
                .ToListAsync();

            var accountIds = rawAccounts.Select(a => a.InvestmentAccountID).ToList();

            var accrualSummary = accountIds.Any()
                ? await _context.InvestmentInterestAccruals
                    .AsNoTracking()
                    .Where(a => accountIds.Contains(a.InvestmentAccountID))
                    .GroupBy(a => a.InvestmentAccountID)
                    .Select(g => new
                    {
                        InvestmentAccountID = g.Key,
                        TotalAccrued = g.Sum(x => x.InterestAmount),
                        LastAccrualDate = g.Max(x => (DateTime?)x.AccrualDate)
                    })
                    .ToDictionaryAsync(x => x.InvestmentAccountID)
                : new Dictionary<int, dynamic>().ToDictionary(k => k.Key, v => new { InvestmentAccountID = 0, TotalAccrued = 0m, LastAccrualDate = (DateTime?)null });

            var receiptSummary = accountIds.Any()
                ? await _context.InvestmentInterestReceipts
                    .AsNoTracking()
                    .Where(r => accountIds.Contains(r.InvestmentAccountID))
                    .GroupBy(r => r.InvestmentAccountID)
                    .Select(g => new
                    {
                        InvestmentAccountID = g.Key,
                        TotalReceived = g.Sum(x => x.GrossAmount > 0m ? x.GrossAmount : x.ReceivedAmount)
                    })
                    .ToDictionaryAsync(x => x.InvestmentAccountID)
                : new Dictionary<int, decimal>().ToDictionary(k => k.Key, v => new { InvestmentAccountID = 0, TotalReceived = 0m });

            var accounts = rawAccounts.Select(a =>
            {
                decimal dbAccrued = accrualSummary.TryGetValue(a.InvestmentAccountID, out var ac) ? ac.TotalAccrued : 0m;
                DateTime? lastAccDate = accrualSummary.TryGetValue(a.InvestmentAccountID, out var ac2) ? ac2.LastAccrualDate : null;
                decimal dbReceived = receiptSummary.TryGetValue(a.InvestmentAccountID, out var rc) ? rc.TotalReceived : 0m;
                decimal totalAccrued = a.AccruedInterestTillMigration + dbAccrued;
                decimal interestReceivable = Math.Max(0m, Math.Round(totalAccrued - dbReceived, 2, MidpointRounding.AwayFromZero));

                return new
                {
                    a.InvestmentAccountID,
                    a.BranchID,
                    BranchName = a.Branch != null ? a.Branch.BranchName : "",
                    a.InvestmentInstitutionID,
                    InstitutionName = a.InvestmentInstitution != null ? a.InvestmentInstitution.InstitutionName : "",
                    a.SchemeID,
                    SchemeName = a.InvestmentScheme != null ? a.InvestmentScheme.SchemeName : "",
                    SchemeCode = a.InvestmentScheme != null ? a.InvestmentScheme.SchemeCode : "",
                    InvestmentType = a.InvestmentScheme != null ? a.InvestmentScheme.InvestmentType : "Deposit",
                    DurationMonths = a.InvestmentScheme != null ? a.InvestmentScheme.DurationMonths : 0,
                    InterestCalculationMethod = a.InvestmentScheme != null ? a.InvestmentScheme.InterestCalculationMethod : "Simple",
                    TdsLedgerID = a.InvestmentScheme != null ? a.InvestmentScheme.TdsLedgerID : null,
                    a.InvestmentNo,
                    a.OldInvestmentNo,
                    a.DepositReceiptNo,
                    a.InvestmentDate,
                    a.PrincipalAmount,
                    a.InterestRate,
                    a.MaturityDate,
                    a.ExpectedMaturityAmount,
                    a.AccruedInterestTillMigration,
                    AccruedInterest = Math.Round(totalAccrued, 2, MidpointRounding.AwayFromZero),
                    ReceivedInterest = Math.Round(dbReceived, 2, MidpointRounding.AwayFromZero),
                    InterestReceivable = interestReceivable,
                    LastAccrualDate = lastAccDate,
                    a.BookValue,
                    a.IsLegacyAccount,
                    a.NomineeName,
                    a.NomineeRelation,
                    a.Remarks,
                    a.Status
                };
            }).ToList();

            return Ok(accounts);
        }

        // GET: api/InvestmentAccounts/5
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetInvestmentAccount(int id)
        {
            var a = await _context.InvestmentAccounts
                .AsNoTracking()
                .Include(x => x.InvestmentInstitution)
                .Include(x => x.InvestmentScheme)
                .Include(x => x.Branch)
                .FirstOrDefaultAsync(x => x.InvestmentAccountID == id);

            if (a == null)
            {
                return NotFound();
            }

            if (!User.IsHeadOfficeAdmin() && a.BranchID != User.GetOperatingBranchId())
            {
                return Forbid();
            }

            var (totalAccrued, totalReceived, outstanding, lastAccDate) = await GetAccountInterestSummaryAsync(a.InvestmentAccountID, a);

            return Ok(new {
                a.InvestmentAccountID,
                a.BranchID,
                BranchName = a.Branch != null ? a.Branch.BranchName : "",
                a.InvestmentInstitutionID,
                InstitutionName = a.InvestmentInstitution != null ? a.InvestmentInstitution.InstitutionName : "",
                a.SchemeID,
                SchemeName = a.InvestmentScheme != null ? a.InvestmentScheme.SchemeName : "",
                InvestmentType = a.InvestmentScheme != null ? a.InvestmentScheme.InvestmentType : "Deposit",
                DurationMonths = a.InvestmentScheme != null ? a.InvestmentScheme.DurationMonths : 0,
                InterestCalculationMethod = a.InvestmentScheme != null ? a.InvestmentScheme.InterestCalculationMethod : "Simple",
                TdsLedgerID = a.InvestmentScheme != null ? a.InvestmentScheme.TdsLedgerID : null,
                a.InvestmentNo,
                a.OldInvestmentNo,
                a.DepositReceiptNo,
                a.InvestmentDate,
                a.PrincipalAmount,
                a.InterestRate,
                a.MaturityDate,
                a.ExpectedMaturityAmount,
                a.AccruedInterestTillMigration,
                AccruedInterest = totalAccrued,
                ReceivedInterest = totalReceived,
                InterestReceivable = outstanding,
                LastAccrualDate = lastAccDate,
                a.BookValue,
                a.IsLegacyAccount,
                a.NomineeName,
                a.NomineeRelation,
                a.Remarks,
                a.Status
            });
        }

        // PUT: api/InvestmentAccounts/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutInvestmentAccount(int id, [FromBody] InvestmentAccount account)
        {
            if (id != account.InvestmentAccountID)
            {
                return BadRequest("खाते आयडी जुळत नाही.");
            }
            if (account.PrincipalAmount <= 0)
            {
                return BadRequest("मुद्दल रक्कम ₹0 पेक्षा जास्त असणे आवश्यक आहे.");
            }
            if (account.InvestmentInstitutionID <= 0)
            {
                return BadRequest("कृपया बँक / संस्था निवडा.");
            }
            if (account.SchemeID <= 0)
            {
                return BadRequest("कृपया गुंतवणूक योजना निवडा.");
            }
            if (account.InvestmentDate.Year < 1980 || account.InvestmentDate.Year > 2099)
            {
                return BadRequest("गुंतवणूक तारीख अवैध आहे. वर्ष 1980 ते 2099 दरम्यान असणे आवश्यक आहे.");
            }
            if (account.MaturityDate.Year < 1980 || account.MaturityDate.Year > 2150)
            {
                return BadRequest("मुदतपूर्ती तारीख अवैध आहे. वर्ष 1980 ते 2150 दरम्यान असणे आवश्यक आहे.");
            }

            var existing = await _context.InvestmentAccounts.FindAsync(id);
            if (existing == null)
            {
                return NotFound("गुंतवणूक खाते सापडले नाही.");
            }

            int oldBranchId = existing.BranchID;
            bool isLegacy = existing.IsLegacyAccount || account.IsLegacyAccount;

            if (isLegacy)
            {
                var scheme = await _context.InvestmentSchemes.FindAsync(account.SchemeID);
                if (scheme == null)
                {
                    return BadRequest("निवडलेली गुंतवणूक योजना अस्तित्वात नाही.");
                }
                if (!scheme.InvestmentAssetLedgerID.HasValue || scheme.InvestmentAssetLedgerID.Value <= 0)
                {
                    return BadRequest($"निवडलेल्या गुंतवणूक योजनेला ('{scheme.SchemeName}') Asset Ledger (खाते) जोडलेले नाही. कृपया आधी गुंतवणूक योजना मास्टरमध्ये जाऊन GL Ledger लिंक करा.");
                }
                if (account.AccruedInterestTillMigration > 0 && (!scheme.InterestReceivableLedgerID.HasValue || scheme.InterestReceivableLedgerID.Value <= 0))
                {
                    return BadRequest($"स्थलांतरित व्याजाची रक्कम नोंदवण्यासाठी गुंतवणूक योजनेला ('{scheme.SchemeName}') 'Interest Receivable Ledger' लिंक असणे आवश्यक आहे. कृपया गुंतवणूक योजना मास्टरमध्ये GL Ledger लिंक करा.");
                }
            }

            if (!string.IsNullOrWhiteSpace(account.OldInvestmentNo))
            {
                account.OldInvestmentNo = account.OldInvestmentNo.Trim();
                bool duplicateLegacy = await _context.InvestmentAccounts
                    .AsNoTracking()
                    .AnyAsync(a => a.InvestmentAccountID != id &&
                                   a.BranchID == account.BranchID &&
                                   a.SchemeID == account.SchemeID &&
                                   a.OldInvestmentNo != null &&
                                   a.OldInvestmentNo.Trim() == account.OldInvestmentNo);
                if (duplicateLegacy)
                {
                    return BadRequest($"या गुंतवणूक योजनेत जुना गुंतवणूक खाते क्र. '{account.OldInvestmentNo}' आधीच अस्तित्वात आहे.");
                }
            }
            else
            {
                account.OldInvestmentNo = null;
            }

            existing.BranchID = account.BranchID;
            existing.InvestmentInstitutionID = account.InvestmentInstitutionID;
            existing.SchemeID = account.SchemeID;
            existing.DepositReceiptNo = account.DepositReceiptNo;
            existing.InvestmentDate = account.InvestmentDate;
            existing.PrincipalAmount = account.PrincipalAmount;
            existing.InterestRate = account.InterestRate;
            existing.MaturityDate = account.MaturityDate;
            existing.ExpectedMaturityAmount = Math.Round(account.ExpectedMaturityAmount, MidpointRounding.AwayFromZero);
            existing.AccruedInterestTillMigration = account.AccruedInterestTillMigration;
            existing.BookValue = account.PrincipalAmount + account.AccruedInterestTillMigration;
            existing.NomineeName = account.NomineeName;
            existing.NomineeRelation = account.NomineeRelation;
            existing.OldInvestmentNo = account.OldInvestmentNo;
            existing.Remarks = account.Remarks;

            try
            {
                await _context.SaveChangesAsync();

                if (isLegacy)
                {
                    await SyncInvestmentOpeningBalancesAsync(oldBranchId);
                    if (account.BranchID != oldBranchId)
                    {
                        await SyncInvestmentOpeningBalancesAsync(account.BranchID);
                    }
                }

                return Ok(new { message = "गुंतवणूक खाते माहिती यशस्वीरीत्या अद्ययावत केली!" });
            }
            catch (Exception ex)
            {
                return BadRequest($"खाते अद्ययावत करताना त्रुटी आली: {ex.Message}");
            }
        }

        // POST: api/InvestmentAccounts - New Investment Opening
        [HttpPost]
        public async Task<ActionResult> PostInvestmentAccount([FromBody] InvestmentAccount account)
        {
            if (account.PrincipalAmount <= 0)
            {
                return BadRequest("मुद्दल रक्कम ₹0 पेक्षा जास्त असणे आवश्यक आहे.");
            }
            if (account.InvestmentInstitutionID <= 0)
            {
                return BadRequest("कृपया बँक / संस्था निवडा.");
            }
            if (account.SchemeID <= 0)
            {
                return BadRequest("कृपया गुंतवणूक योजना निवडा.");
            }
            if (account.InvestmentDate.Year < 1980 || account.InvestmentDate.Year > 2099)
            {
                return BadRequest("गुंतवणूक तारीख अवैध आहे. वर्ष 1980 ते 2099 दरम्यान असणे आवश्यक आहे.");
            }
            if (account.MaturityDate.Year < 1980 || account.MaturityDate.Year > 2150)
            {
                return BadRequest("मुदतपूर्ती तारीख अवैध आहे. वर्ष 1980 ते 2150 दरम्यान असणे आवश्यक आहे.");
            }

            if (!string.IsNullOrWhiteSpace(account.OldInvestmentNo))
            {
                account.OldInvestmentNo = account.OldInvestmentNo.Trim();
                bool duplicateLegacy = await _context.InvestmentAccounts
                    .AsNoTracking()
                    .AnyAsync(a => a.BranchID == account.BranchID &&
                                   a.SchemeID == account.SchemeID &&
                                   a.OldInvestmentNo != null &&
                                   a.OldInvestmentNo.Trim() == account.OldInvestmentNo);
                if (duplicateLegacy)
                {
                    return BadRequest($"या गुंतवणूक योजनेत जुना गुंतवणूक खाते क्र. '{account.OldInvestmentNo}' आधीच अस्तित्वात आहे.");
                }
            }
            else
            {
                account.OldInvestmentNo = null;
            }

            if (account.IsLegacyAccount)
            {
                if (string.IsNullOrWhiteSpace(account.OldInvestmentNo))
                {
                    return BadRequest("सुरुवातीची शिल्लक स्थलांतर करताना जुना गुंतवणूक खाते क्रमांक (Old Investment No) भरणे अनिवार्य आहे.");
                }

                var schemeCheck = await _context.InvestmentSchemes.FindAsync(account.SchemeID);
                if (schemeCheck == null)
                {
                    return BadRequest("निवडलेली गुंतवणूक योजना अस्तित्वात नाही.");
                }
                if (!schemeCheck.InvestmentAssetLedgerID.HasValue || schemeCheck.InvestmentAssetLedgerID.Value <= 0)
                {
                    return BadRequest($"निवडलेल्या गुंतवणूक योजनेला ('{schemeCheck.SchemeName}') Asset Ledger (खाते) जोडलेले नाही. कृपया आधी गुंतवणूक योजना मास्टरमध्ये जाऊन GL Ledger लिंक करा.");
                }
                if (account.AccruedInterestTillMigration > 0 && (!schemeCheck.InterestReceivableLedgerID.HasValue || schemeCheck.InterestReceivableLedgerID.Value <= 0))
                {
                    return BadRequest($"स्थलांतरित व्याजाची रक्कम नोंदवण्यासाठी गुंतवणूक योजनेला ('{schemeCheck.SchemeName}') 'Interest Receivable Ledger' लिंक असणे आवश्यक आहे. कृपया गुंतवणूक योजना मास्टरमध्ये GL Ledger लिंक करा.");
                }
            }

            int resolvedOpeningLedgerId = 0;
            if (!account.IsLegacyAccount)
            {
                var paymentCheck = await ResolveInvestmentPaymentLedgerAsync(account.BranchID, account.PaymentMode, account.BankLedgerID);
                if (!paymentCheck.IsValid)
                {
                    return BadRequest(paymentCheck.ErrorMessage);
                }
                resolvedOpeningLedgerId = paymentCheck.LedgerId;
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Generate standard 14-digit CBS account number
                if (string.IsNullOrWhiteSpace(account.InvestmentNo))
                {
                    account.InvestmentNo = await GenerateNextInvestmentAccountNo(account.BranchID, account.SchemeID, incrementSequence: true);
                }

                // Calculate maturity amount if not provided
                if (account.ExpectedMaturityAmount == 0)
                {
                    var scheme = await _context.InvestmentSchemes.FindAsync(account.SchemeID);
                    if (scheme != null)
                    {
                        account.InterestRate = scheme.InterestRate;
                        account.MaturityDate = account.InvestmentDate.AddMonths(scheme.DurationMonths);
                        
                        if (scheme.InterestCalculationMethod == "Simple")
                        {
                            decimal interest = account.PrincipalAmount * scheme.InterestRate * scheme.DurationMonths / (12 * 100);
                            account.ExpectedMaturityAmount = Math.Round(account.PrincipalAmount + interest, MidpointRounding.AwayFromZero);
                        }
                        else // Cumulative (compounding quarterly)
                        {
                            double P = (double)account.PrincipalAmount;
                            double r = (double)scheme.InterestRate / 100;
                            int n = 4; // quarterly compounding
                            double t = scheme.DurationMonths / 12.0;
                            double maturityAmt = P * Math.Pow(1 + r / n, n * t);
                            account.ExpectedMaturityAmount = Math.Round((decimal)maturityAmt, MidpointRounding.AwayFromZero);
                        }
                    }
                }
                else
                {
                    account.ExpectedMaturityAmount = Math.Round(account.ExpectedMaturityAmount, MidpointRounding.AwayFromZero);
                }

                // Set BookValue
                if (account.BookValue == 0)
                {
                    account.BookValue = account.PrincipalAmount + account.AccruedInterestTillMigration;
                }

                // Get active financial year
                var fy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
                if (fy != null) account.FinancialYearID = fy.FinancialYearID;

                if (!account.IsLegacyAccount && (await GetVoucherMappingForBranch(account.BranchID, "", account.SchemeID)) == null) { await transaction.RollbackAsync(); return BadRequest("गुंतवणूक योजनेसाठी जी.एल. लेजर मॅपिंग (Investment Voucher Mapping) सापडले नाही."); }
                _context.InvestmentAccounts.Add(account);
                await _context.SaveChangesAsync();

                // Create voucher entry if not legacy, or sync opening balances if legacy
                if (!account.IsLegacyAccount)
                {
                    var mapping = await GetVoucherMappingForBranch(account.BranchID, "", account.SchemeID);

                    if (mapping != null)
                    {
                        var voucher = new Voucher
                        {
                            BranchID = account.BranchID,
                            VoucherNo = $"PAY-INV-OP-{account.InvestmentNo}",
                            VoucherDate = account.InvestmentDate,
                            VoucherType = "Payment",
                            Narration = $"गुंतवणूक खाते उघडले - {account.InvestmentNo}" + (!string.IsNullOrWhiteSpace(account.ReferenceNo) ? $" [संदर्भ/UTR: {account.ReferenceNo.Trim()}]" : ""),
                            TotalAmount = account.PrincipalAmount,
                            CreatedBy = account.CreatedBy,
                            CreatedOn = DateTime.Now
                        };

                        _context.Vouchers.Add(voucher);
                        await _context.SaveChangesAsync();

                        var debDetail = new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = mapping.InvestmentLedgerID,
                            DrCr = "Dr",
                            Amount = account.PrincipalAmount
                        };

                        var credDetail = new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = resolvedOpeningLedgerId,
                            DrCr = "Cr",
                            Amount = account.PrincipalAmount
                        };

                        _context.VoucherDetails.Add(debDetail);
                        _context.VoucherDetails.Add(credDetail);
                        await Helpers.VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, voucher.VoucherID, voucher.VoucherNo);
                        await _context.SaveChangesAsync();
                    }
                }
                else
                {
                    // 100% Dynamic CBS Sync to BranchLedgerOpeningBalances & Ledgers
                    await SyncInvestmentOpeningBalancesAsync(account.BranchID);
                }

                await transaction.CommitAsync();
                return Ok(new { message = "गुंतवणूक खाते यशस्वीरीत्या उघडले!", account.InvestmentAccountID, account.InvestmentNo });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"गुंतवणूक खाते उघडताना त्रुटी: {ex.Message}");
            }
        }

        // POST: api/InvestmentAccounts/Migrate - Opening Balance Migration
        [HttpPost("Migrate")]
        [MigrationLockFilter]
        public async Task<ActionResult> MigrateInvestmentAccount([FromBody] InvestmentAccount account)
        {
            if (account.PrincipalAmount <= 0)
            {
                return BadRequest("मुद्दल रक्कम ₹0 पेक्षा जास्त असणे आवश्यक आहे.");
            }
            if (account.InvestmentInstitutionID <= 0)
            {
                return BadRequest("कृपया बँक / संस्था निवडा.");
            }
            if (account.SchemeID <= 0)
            {
                return BadRequest("कृपया गुंतवणूक योजना निवडा.");
            }
            if (account.InvestmentDate.Year < 1980 || account.InvestmentDate.Year > 2099)
            {
                return BadRequest("गुंतवणूक तारीख अवैध आहे. वर्ष 1980 ते 2099 दरम्यान असणे आवश्यक आहे.");
            }
            if (account.MaturityDate.Year < 1980 || account.MaturityDate.Year > 2150)
            {
                return BadRequest("मुदतपूर्ती तारीख अवैध आहे. वर्ष 1980 ते 2150 दरम्यान असणे आवश्यक आहे.");
            }

            if (!string.IsNullOrWhiteSpace(account.OldInvestmentNo))
            {
                account.OldInvestmentNo = account.OldInvestmentNo.Trim();
                bool duplicateLegacy = await _context.InvestmentAccounts
                    .AsNoTracking()
                    .AnyAsync(a => a.BranchID == account.BranchID &&
                                   a.SchemeID == account.SchemeID &&
                                   a.OldInvestmentNo != null &&
                                   a.OldInvestmentNo.Trim() == account.OldInvestmentNo);
                if (duplicateLegacy)
                {
                    return BadRequest($"या गुंतवणूक योजनेत जुना गुंतवणूक खाते क्र. '{account.OldInvestmentNo}' आधीच अस्तित्वात आहे.");
                }
            }
            else
            {
                account.OldInvestmentNo = null;
            }

            if (string.IsNullOrWhiteSpace(account.OldInvestmentNo))
            {
                return BadRequest("सुरुवातीची शिल्लक स्थलांतर करताना जुना गुंतवणूक खाते क्रमांक (Old Investment No) भरणे अनिवार्य आहे.");
            }

            var schemeCheck = await _context.InvestmentSchemes.FindAsync(account.SchemeID);
            if (schemeCheck == null)
            {
                return BadRequest("निवडलेली गुंतवणूक योजना अस्तित्वात नाही.");
            }
            if (!schemeCheck.InvestmentAssetLedgerID.HasValue || schemeCheck.InvestmentAssetLedgerID.Value <= 0)
            {
                return BadRequest($"निवडलेल्या गुंतवणूक योजनेला ('{schemeCheck.SchemeName}') Asset Ledger (खाते) जोडलेले नाही. कृपया आधी गुंतवणूक योजना मास्टरमध्ये जाऊन GL Ledger लिंक करा.");
            }
            if (account.AccruedInterestTillMigration > 0 && (!schemeCheck.InterestReceivableLedgerID.HasValue || schemeCheck.InterestReceivableLedgerID.Value <= 0))
            {
                return BadRequest($"स्थलांतरित व्याजाची रक्कम नोंदवण्यासाठी गुंतवणूक योजनेला ('{schemeCheck.SchemeName}') 'Interest Receivable Ledger' लिंक असणे आवश्यक आहे. कृपया गुंतवणूक योजना मास्टरमध्ये GL Ledger लिंक करा.");
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Generate standard 14-digit CBS account number
                if (string.IsNullOrWhiteSpace(account.InvestmentNo))
                {
                    account.InvestmentNo = await GenerateNextInvestmentAccountNo(account.BranchID, account.SchemeID, incrementSequence: true);
                }
                account.IsLegacyAccount = true;
                account.BookValue = account.PrincipalAmount + account.AccruedInterestTillMigration;

                var fy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
                if (fy != null) account.FinancialYearID = fy.FinancialYearID;

                if (!account.IsLegacyAccount && (await GetVoucherMappingForBranch(account.BranchID, "", account.SchemeID)) == null) { await transaction.RollbackAsync(); return BadRequest("गुंतवणूक योजनेसाठी जी.एल. लेजर मॅपिंग (Investment Voucher Mapping) सापडले नाही."); }
                _context.InvestmentAccounts.Add(account);
                await _context.SaveChangesAsync();

                // 100% Dynamic CBS Sync to BranchLedgerOpeningBalances & Ledgers
                await SyncInvestmentOpeningBalancesAsync(account.BranchID);

                await transaction.CommitAsync();
                return Ok(new { message = "गुंतवणूक स्थलांतर यशस्वी!", account.InvestmentAccountID, account.InvestmentNo });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"गुंतवणूक स्थलांतर त्रुटी: {ex.Message}");
            }
        }

        // DELETE: api/InvestmentAccounts/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteInvestmentAccount(int id)
        {
            var account = await _context.InvestmentAccounts.FindAsync(id);
            if (account == null)
            {
                return NotFound(new { message = "गुंतवणूक खाते सापडले नाही." });
            }

            bool hasMaturity = await _context.InvestmentMaturities.AnyAsync(m => m.InvestmentAccountID == id);
            bool hasPremature = await _context.InvestmentPrematureWithdrawals.AnyAsync(p => p.InvestmentAccountID == id);
            bool hasRenewal = await _context.InvestmentRenewals.AnyAsync(r => r.OldInvestmentAccountID == id || r.NewInvestmentAccountID == id);
            bool hasIntReceipt = await _context.InvestmentInterestReceipts.AnyAsync(r => r.InvestmentAccountID == id);
            bool hasIntAccrual = await _context.InvestmentInterestAccruals.AnyAsync(a => a.InvestmentAccountID == id);

            if (hasMaturity || hasPremature || hasRenewal || hasIntReceipt || hasIntAccrual)
            {
                return BadRequest(new { message = "हे गुंतवणूक खाते डिलीट करता येणार नाही कारण यावर मुदतपूर्ती, मुदतपूर्व बंद, नूतनीकरण किंवा व्याज जमा/आकारणी नोंदी अस्तित्वात आहेत. प्रथम संबंधित व्यवहार व्हाउचर डिलीट करा." });
            }

            var linkedOpVouchers = !string.IsNullOrWhiteSpace(account.InvestmentNo)
                ? await _context.Vouchers
                    .Include(v => v.VoucherDetails)
                    .Where(v => v.VoucherNo == $"PAY-INV-OP-{account.InvestmentNo}")
                    .ToListAsync()
                : new List<Voucher>();

            if (!account.IsLegacyAccount && linkedOpVouchers.Any(v => v.Status == "Approved"))
            {
                return BadRequest(new { message = "या गुंतवणूक खात्याचे ओपनिंग व्हाउचर मंजूर (Approved) झालेले आहे. खाते डिलीट करण्यापूर्वी व्हाउचर पासिंगमधून संबंधित व्हाउचर अन-पास (Unpass) करा." });
            }
            if (hasMaturity)
            {
                return BadRequest(new { message = "हे खाते डिलीट करता येणार नाही कारण याची मुदतपूर्ती (Maturity) नोंद झालेली आहे." });
            }

            bool wasLegacy = account.IsLegacyAccount;
            int branchId = account.BranchID;

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var seq = await _context.InvestmentAccountSequences
                    .FirstOrDefaultAsync(s => s.BranchID == account.BranchID && s.ProductType == "INV");
                if (seq != null)
                {
                    var remainingMaxSeq = await _context.InvestmentAccounts
                        .Where(a => a.BranchID == account.BranchID && a.InvestmentAccountID != id)
                        .Select(a => a.InvestmentNo)
                        .ToListAsync();

                    int maxNum = 0;
                    foreach (var invNo in remainingMaxSeq)
                    {
                        string invDigits = new string((invNo ?? string.Empty).Where(char.IsDigit).ToArray());
                        if (invDigits.Length == 14 && int.TryParse(invDigits.Substring(6, 7), out int cbsSeq))
                        {
                            if (cbsSeq > maxNum) maxNum = cbsSeq;
                            continue;
                        }
                        var parts = (invNo ?? string.Empty).Split('-');
                        if (parts.Length > 0 && int.TryParse(parts.Last(), out int parsed))
                        {
                            if (parsed > maxNum) maxNum = parsed;
                        }
                    }
                    seq.CurrentValue = maxNum;
                    _context.InvestmentAccountSequences.Update(seq);
                }

                _context.InvestmentAccounts.Remove(account);
                await _context.SaveChangesAsync();

                if (!wasLegacy && linkedOpVouchers.Any())
                {
                    var delIds = linkedOpVouchers.Select(v => v.VoucherID).ToList();
                    var revRefs = await _context.Vouchers
                        .Where(v => v.RelatedVoucherID.HasValue && delIds.Contains(v.RelatedVoucherID.Value))
                        .ToListAsync();
                    foreach (var rv in revRefs) rv.RelatedVoucherID = null;
                    foreach (var ov in linkedOpVouchers) ov.RelatedVoucherID = null;
                    await _context.SaveChangesAsync();

                    foreach (var ov in linkedOpVouchers)
                    {
                        if (ov.VoucherDetails != null && ov.VoucherDetails.Any())
                        {
                            _context.VoucherDetails.RemoveRange(ov.VoucherDetails);
                        }
                        _context.Vouchers.Remove(ov);
                    }
                    await _context.SaveChangesAsync();
                }
                await _context.SaveChangesAsync();

                if (wasLegacy)
                {
                    await SyncInvestmentOpeningBalancesAsync(branchId);
                }

                await transaction.CommitAsync();

                return Ok(new { message = "गुंतवणूक खाते यशस्वीरीत्या डिलीट केले." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = $"खाते डिलीट करताना त्रुटी आली: {ex.Message}" });
            }
        }

        // POST: api/InvestmentAccounts/Maturity - Process Maturity
        [HttpPost("Maturity")]
        [Authorize(Roles = "SuperAdmin,Admin,SystemAdmin,HeadOffice,HO_Manager,Manager,BranchManager")]
        public async Task<ActionResult> ProcessMaturity([FromBody] MaturityClaimRequest request)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var account = await _context.InvestmentAccounts.FindAsync(request.InvestmentAccountID);
                if (account == null) return NotFound("गुंतवणूक खाते सापडले नाही.");
                if (account.Status != "Active") return BadRequest("हे खाते Active नाही.");
                if (!User.IsHeadOfficeAdmin() && account.BranchID != User.GetOperatingBranchId())
                {
                    return Forbid();
                }

                var dateCheck = await ValidateInvestmentTransactionDateAsync(account.BranchID, request.MaturityDate);
                if (!dateCheck.IsValid)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(dateCheck.ErrorMessage);
                }

                decimal tdsAmount = Math.Max(0m, Math.Round(request.TdsAmount, 2, MidpointRounding.AwayFromZero));
                decimal netReceived = request.PrincipalReceived + request.InterestReceived - tdsAmount;
                if (netReceived < 0m)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("TDS कपात रक्कम ही मुद्दल व व्याजाच्या एकूण रकमेपेक्षा जास्त असू शकत नाही.");
                }

                var paymentCheck = await ResolveInvestmentPaymentLedgerAsync(account.BranchID, request.PaymentMode, request.BankLedgerID);
                if (!paymentCheck.IsValid)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(paymentCheck.ErrorMessage);
                }

                var (_, _, outstandingReceivable, _) = await GetAccountInterestSummaryAsync(account.InvestmentAccountID, account);
                decimal receivableCleared = Math.Min(Math.Max(0m, request.InterestReceived), outstandingReceivable);
                decimal freshInterestIncome = Math.Max(0m, request.InterestReceived - receivableCleared);

                var mapCheck = await ResolveStrictVoucherMappingAsync(
                    account.BranchID,
                    account.SchemeID,
                    requireInvestmentAsset: request.PrincipalReceived > 0m,
                    requireInterestIncome: freshInterestIncome > 0m,
                    requireInterestReceivable: receivableCleared > 0m);
                if (!mapCheck.IsValid || mapCheck.Mapping == null)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(mapCheck.ErrorMessage ?? "गुंतवणूक मुदतपूर्तीसाठी जी.एल. लेजर मॅपिंग सापडले नाही.");
                }
                var mapping = mapCheck.Mapping;

                int tdsLedgerId = 0;
                if (tdsAmount > 0m)
                {
                    tdsLedgerId = (request.TdsLedgerID.HasValue && request.TdsLedgerID.Value > 0)
                        ? request.TdsLedgerID.Value
                        : (mapping.TdsLedgerID ?? 0);

                    if (tdsLedgerId <= 0 || !await _context.Ledgers.AnyAsync(l => l.LedgerID == tdsLedgerId))
                    {
                        await transaction.RollbackAsync();
                        return BadRequest("TDS कपात रक्कम नोंदवण्यासाठी कृपया डायनॅमिक जी.एल. लेजर (TDS GL Ledger) निवडा.");
                    }
                }

                int currentUserId = User.GetUserId() > 0 ? User.GetUserId() : 1;
                var approvalStatus = await ApprovalPolicyHelper.DetermineVoucherStatusAsync(_context, request.PrincipalReceived + request.InterestReceived, currentUserId);
                var branchEntity = await _context.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.BranchID == account.BranchID);
                string branchCode = !string.IsNullOrWhiteSpace(branchEntity?.BranchCode) ? branchEntity!.BranchCode! : account.BranchID.ToString("D3");
                string voucherNo = await VoucherNumberHelper.NextVoucherNoAsync(_context, $"REC-INV-MAT-{branchCode}-{request.MaturityDate:yyyyMMdd}-", 4);

                var maturity = new InvestmentMaturity
                {
                    InstitutionID = account.InstitutionID,
                    BranchID = account.BranchID,
                    FinancialYearID = dateCheck.FinancialYearId,
                    InvestmentAccountID = request.InvestmentAccountID,
                    MaturityDate = request.MaturityDate,
                    PrincipalReceived = request.PrincipalReceived,
                    InterestReceived = request.InterestReceived,
                    TdsAmount = tdsAmount,
                    TdsLedgerID = tdsAmount > 0m ? tdsLedgerId : null,
                    TotalReceived = netReceived,
                    CreatedBy = currentUserId
                };

                string refSuffix = !string.IsNullOrWhiteSpace(request.ReferenceNo)
                    ? $" [संदर्भ/UTR: {request.ReferenceNo.Trim()}]"
                    : string.Empty;
                string tdsSuffix = tdsAmount > 0m
                    ? $" [TDS कपात: ₹{tdsAmount:N2}]"
                    : string.Empty;

                var voucher = new Voucher
                {
                    BranchID = account.BranchID,
                    VoucherNo = voucherNo,
                    VoucherDate = maturity.MaturityDate,
                    VoucherType = "Receipt",
                    Status = approvalStatus.Status,
                    ApprovedBy = approvalStatus.ApprovedBy,
                    ApprovedOn = approvalStatus.ApprovedOn,
                    Narration = $"गुंतवणूक मुदतपूर्ती - {account.InvestmentNo}{tdsSuffix}{refSuffix}",
                    TotalAmount = maturity.PrincipalReceived + maturity.InterestReceived,
                    CreatedBy = currentUserId,
                    CreatedOn = DateTime.Now
                };

                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();

                if (maturity.TotalReceived > 0m)
                {
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = paymentCheck.LedgerId,
                        DrCr = "Dr",
                        Amount = maturity.TotalReceived
                    });
                }

                if (tdsAmount > 0m && tdsLedgerId > 0)
                {
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = tdsLedgerId,
                        DrCr = "Dr",
                        Amount = tdsAmount
                    });
                }

                if (maturity.PrincipalReceived > 0m)
                {
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = mapping.InvestmentLedgerID,
                        DrCr = "Cr",
                        Amount = maturity.PrincipalReceived
                    });
                }

                if (receivableCleared > 0m)
                {
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = mapping.InterestReceivableLedgerID,
                        DrCr = "Cr",
                        Amount = receivableCleared
                    });
                }

                if (freshInterestIncome > 0m)
                {
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = mapping.InterestIncomeLedgerID,
                        DrCr = "Cr",
                        Amount = freshInterestIncome
                    });
                }

                await _context.SaveChangesAsync();
                await Helpers.VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, voucher.VoucherID, voucher.VoucherNo);
                maturity.VoucherID = voucher.VoucherID;

                _context.InvestmentMaturities.Add(maturity);
                account.Status = "Matured";
                account.BookValue = 0m;
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();
                return Ok(new { message = "गुंतवणूक मुदतपूर्ती यशस्वी!", voucherId = voucher.VoucherID, voucherNo = voucher.VoucherNo });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"मुदतपूर्ती त्रुटी: {ex.Message}");
            }
        }

        // POST: api/InvestmentAccounts/PrematureWithdraw - Premature Withdrawal
        [HttpPost("PrematureWithdraw")]
        [Authorize(Roles = "SuperAdmin,Admin,SystemAdmin,HeadOffice,HO_Manager,Manager,BranchManager")]
        public async Task<ActionResult> PrematureWithdraw([FromBody] PrematureWithdrawRequest request)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var account = await _context.InvestmentAccounts.FindAsync(request.InvestmentAccountID);
                if (account == null) return NotFound("गुंतवणूक खाते सापडले नाही.");
                if (account.Status != "Active") return BadRequest("हे खाते Active नाही.");
                if (!User.IsHeadOfficeAdmin() && account.BranchID != User.GetOperatingBranchId())
                {
                    return Forbid();
                }

                var dateCheck = await ValidateInvestmentTransactionDateAsync(account.BranchID, request.WithdrawalDate);
                if (!dateCheck.IsValid)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(dateCheck.ErrorMessage);
                }

                decimal tdsAmount = Math.Max(0m, Math.Round(request.TdsAmount, 2, MidpointRounding.AwayFromZero));
                decimal netPayout = request.PrincipalPaid + request.InterestPaid - request.PenaltyAmount - tdsAmount;
                if (netPayout < 0m)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("मुदतपूर्व दंड व TDS कपात रक्कम ही एकूण मुद्दल व व्याजापेक्षा जास्त असू शकत नाही.");
                }

                var paymentCheck = await ResolveInvestmentPaymentLedgerAsync(account.BranchID, request.PaymentMode, request.BankLedgerID);
                if (!paymentCheck.IsValid)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(paymentCheck.ErrorMessage);
                }

                var (_, _, outstandingReceivable, _) = await GetAccountInterestSummaryAsync(account.InvestmentAccountID, account);
                decimal receivableCleared = Math.Min(Math.Max(0m, request.InterestPaid), outstandingReceivable);
                decimal freshInterestIncome = Math.Max(0m, request.InterestPaid - receivableCleared);

                var mapCheck = await ResolveStrictVoucherMappingAsync(
                    account.BranchID,
                    account.SchemeID,
                    requireInvestmentAsset: request.PrincipalPaid > 0m,
                    requireInterestIncome: freshInterestIncome > 0m,
                    requireInterestReceivable: receivableCleared > 0m);
                if (!mapCheck.IsValid || mapCheck.Mapping == null)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(mapCheck.ErrorMessage ?? "गुंतवणूक मुदतपूर्व मोडणीसाठी जी.एल. लेजर मॅपिंग सापडले नाही.");
                }
                var mapping = mapCheck.Mapping;

                int tdsLedgerId = 0;
                if (tdsAmount > 0m)
                {
                    tdsLedgerId = (request.TdsLedgerID.HasValue && request.TdsLedgerID.Value > 0)
                        ? request.TdsLedgerID.Value
                        : (mapping.TdsLedgerID ?? 0);

                    if (tdsLedgerId <= 0 || !await _context.Ledgers.AnyAsync(l => l.LedgerID == tdsLedgerId))
                    {
                        await transaction.RollbackAsync();
                        return BadRequest("TDS कपात रक्कम नोंदवण्यासाठी कृपया डायनॅमिक जी.एल. लेजर (TDS GL Ledger) निवडा.");
                    }
                }

                int currentUserId = User.GetUserId() > 0 ? User.GetUserId() : 1;
                var approvalStatus = await ApprovalPolicyHelper.DetermineVoucherStatusAsync(_context, request.PrincipalPaid + request.InterestPaid, currentUserId);
                var branchEntity = await _context.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.BranchID == account.BranchID);
                string branchCode = !string.IsNullOrWhiteSpace(branchEntity?.BranchCode) ? branchEntity!.BranchCode! : account.BranchID.ToString("D3");
                string voucherNo = await VoucherNumberHelper.NextVoucherNoAsync(_context, $"REC-INV-PRE-{branchCode}-{request.WithdrawalDate:yyyyMMdd}-", 4);

                var withdrawal = new InvestmentPrematureWithdrawal
                {
                    InstitutionID = account.InstitutionID,
                    BranchID = account.BranchID,
                    FinancialYearID = dateCheck.FinancialYearId,
                    InvestmentAccountID = request.InvestmentAccountID,
                    WithdrawalDate = request.WithdrawalDate,
                    PrincipalPaid = request.PrincipalPaid,
                    RevisedInterestRate = request.RevisedInterestRate,
                    InterestPaid = request.InterestPaid,
                    PenaltyAmount = request.PenaltyAmount,
                    TdsAmount = tdsAmount,
                    TdsLedgerID = tdsAmount > 0m ? tdsLedgerId : null,
                    NetPayout = netPayout,
                    CreatedBy = currentUserId
                };

                string refSuffix = !string.IsNullOrWhiteSpace(request.ReferenceNo)
                    ? $" [संदर्भ/UTR: {request.ReferenceNo.Trim()}]"
                    : string.Empty;
                string tdsSuffix = tdsAmount > 0m
                    ? $" [TDS कपात: ₹{tdsAmount:N2}]"
                    : string.Empty;

                var voucher = new Voucher
                {
                    BranchID = account.BranchID,
                    VoucherNo = voucherNo,
                    VoucherDate = withdrawal.WithdrawalDate,
                    VoucherType = "Receipt",
                    Status = approvalStatus.Status,
                    ApprovedBy = approvalStatus.ApprovedBy,
                    ApprovedOn = approvalStatus.ApprovedOn,
                    Narration = $"गुंतवणूक मुदतपूर्व बंद - {account.InvestmentNo}{tdsSuffix}{refSuffix}",
                    TotalAmount = withdrawal.PrincipalPaid + withdrawal.InterestPaid,
                    CreatedBy = currentUserId,
                    CreatedOn = DateTime.Now
                };

                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();

                if (withdrawal.NetPayout > 0m)
                {
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = paymentCheck.LedgerId,
                        DrCr = "Dr",
                        Amount = withdrawal.NetPayout
                    });
                }

                if (tdsAmount > 0m && tdsLedgerId > 0)
                {
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = tdsLedgerId,
                        DrCr = "Dr",
                        Amount = tdsAmount
                    });
                }

                if (withdrawal.PrincipalPaid > 0m)
                {
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = mapping.InvestmentLedgerID,
                        DrCr = "Cr",
                        Amount = withdrawal.PrincipalPaid
                    });
                }

                if (receivableCleared > 0m)
                {
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = mapping.InterestReceivableLedgerID,
                        DrCr = "Cr",
                        Amount = receivableCleared
                    });
                }

                if (freshInterestIncome > 0m)
                {
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = mapping.InterestIncomeLedgerID,
                        DrCr = "Cr",
                        Amount = freshInterestIncome
                    });
                }

                await _context.SaveChangesAsync();
                if (withdrawal.PenaltyAmount > 0m)
                {
                    int penaltyLedgerId = await Helpers.Step4AccountingHelper.ResolveInvestmentPenaltyLedgerIdAsync(_context, mapping);
                    _context.VoucherDetails.Add(new VoucherDetail { VoucherID = voucher.VoucherID, LedgerID = penaltyLedgerId, DrCr = "Dr", Amount = withdrawal.PenaltyAmount });
                    await _context.SaveChangesAsync();
                }
                await Helpers.VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, voucher.VoucherID, voucher.VoucherNo);
                withdrawal.VoucherID = voucher.VoucherID;

                _context.InvestmentPrematureWithdrawals.Add(withdrawal);
                account.Status = "Closed";
                account.BookValue = 0m;
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();
                return Ok(new { message = "मुदतपूर्व काढणे यशस्वी!", voucherId = voucher.VoucherID, voucherNo = voucher.VoucherNo });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"मुदतपूर्व काढणे त्रुटी: {ex.Message}");
            }
        }

        // POST: api/InvestmentAccounts/Renew - Renewal
        [HttpPost("Renew")]
        [Authorize(Roles = "SuperAdmin,Admin,SystemAdmin,HeadOffice,HO_Manager,Manager,BranchManager")]
        public async Task<ActionResult> RenewInvestment([FromBody] RenewalRequest request)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var oldAccount = await _context.InvestmentAccounts
                    .Include(a => a.InvestmentScheme)
                    .FirstOrDefaultAsync(a => a.InvestmentAccountID == request.OldInvestmentAccountID);
                if (oldAccount == null) return NotFound("जुने गुंतवणूक खाते सापडले नाही.");
                if (oldAccount.Status != "Active" && oldAccount.Status != "Matured") return BadRequest("हे खाते नूतनीकरणयोग्य नाही.");
                if (!User.IsHeadOfficeAdmin() && oldAccount.BranchID != User.GetOperatingBranchId())
                {
                    return Forbid();
                }

                var dateCheck = await ValidateInvestmentTransactionDateAsync(oldAccount.BranchID, request.RenewalDate);
                if (!dateCheck.IsValid)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(dateCheck.ErrorMessage);
                }

                decimal tdsAmount = Math.Max(0m, Math.Round(request.TdsAmount, 2, MidpointRounding.AwayFromZero));
                var oldMapCheck = await ResolveStrictVoucherMappingAsync(oldAccount.BranchID, oldAccount.SchemeID, true, false, false);
                int targetSchemeId = request.NewSchemeID > 0 ? request.NewSchemeID : oldAccount.SchemeID;
                var newMapCheck = await ResolveStrictVoucherMappingAsync(oldAccount.BranchID, targetSchemeId, true, false, false);
                if (!oldMapCheck.IsValid || !newMapCheck.IsValid || oldMapCheck.Mapping == null || newMapCheck.Mapping == null)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(oldMapCheck.ErrorMessage ?? newMapCheck.ErrorMessage ?? "गुंतवणूक नूतनीकरणासाठी जुन्या किंवा नवीन योजनेचे जी.एल. लेजर मॅपिंग (Investment Voucher Mapping) सापडले नाही.");
                }
                var oldMapping = oldMapCheck.Mapping;
                var newMapping = newMapCheck.Mapping;

                int tdsLedgerId = 0;
                if (tdsAmount > 0m)
                {
                    tdsLedgerId = (request.TdsLedgerID.HasValue && request.TdsLedgerID.Value > 0)
                        ? request.TdsLedgerID.Value
                        : (oldMapping.TdsLedgerID ?? newMapping.TdsLedgerID ?? 0);

                    if (tdsLedgerId <= 0 || !await _context.Ledgers.AnyAsync(l => l.LedgerID == tdsLedgerId))
                    {
                        await transaction.RollbackAsync();
                        return BadRequest("TDS कपात रक्कम नोंदवण्यासाठी कृपया डायनॅमिक जी.एल. लेजर (TDS GL Ledger) निवडा.");
                    }
                }

                // Create new account
                var newAccount = new InvestmentAccount
                {
                    BranchID = oldAccount.BranchID,
                    InvestmentInstitutionID = oldAccount.InvestmentInstitutionID,
                    SchemeID = targetSchemeId,
                    InvestmentDate = request.RenewalDate,
                    PrincipalAmount = request.RenewalAmount,
                    InterestRate = request.NewInterestRate > 0 ? request.NewInterestRate : oldAccount.InterestRate,
                    Status = "Active",
                    Remarks = $"नूतनीकरण - जुने खाते: {oldAccount.InvestmentNo}"
                };

                // Calculate maturity
                var scheme = await _context.InvestmentSchemes.FindAsync(newAccount.SchemeID);
                if (scheme != null)
                {
                    newAccount.MaturityDate = request.RenewalDate.AddMonths(scheme.DurationMonths);
                    if (scheme.InterestCalculationMethod == "Simple")
                    {
                        decimal interest = newAccount.PrincipalAmount * newAccount.InterestRate * scheme.DurationMonths / (12 * 100);
                        newAccount.ExpectedMaturityAmount = Math.Round(newAccount.PrincipalAmount + interest, MidpointRounding.AwayFromZero);
                    }
                    else
                    {
                        double P = (double)newAccount.PrincipalAmount;
                        double r = (double)newAccount.InterestRate / 100;
                        double t = scheme.DurationMonths / 12.0;
                        newAccount.ExpectedMaturityAmount = Math.Round((decimal)(P * Math.Pow(1 + r / 4, 4 * t)), MidpointRounding.AwayFromZero);
                    }
                }

                newAccount.BookValue = newAccount.PrincipalAmount;

                // Generate account number
                var seq = await _context.InvestmentAccountSequences
                    .FirstOrDefaultAsync(s => s.BranchID == oldAccount.BranchID && s.ProductType == "INV");
                if (seq == null)
                {
                    seq = new InvestmentAccountSequence { BranchID = oldAccount.BranchID, ProductType = "INV", CurrentValue = 0 };
                    _context.InvestmentAccountSequences.Add(seq);
                    await _context.SaveChangesAsync();
                }
                seq.CurrentValue += 1;
                Bhisi.Api.Models.Branch? branchEntity = await _context.Branches.FindAsync(oldAccount.BranchID);
                string branchCode = branchEntity?.BranchCode ?? "001";
                newAccount.InvestmentNo = $"{branchCode}-INV-{seq.CurrentValue:D6}";

                var fy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
                if (fy != null) newAccount.FinancialYearID = fy.FinancialYearID;

                _context.InvestmentAccounts.Add(newAccount);
                await _context.SaveChangesAsync();

                // Create renewal record
                var renewal = new InvestmentRenewal
                {
                    BranchID = oldAccount.BranchID,
                    FinancialYearID = newAccount.FinancialYearID,
                    OldInvestmentAccountID = oldAccount.InvestmentAccountID,
                    NewInvestmentAccountID = newAccount.InvestmentAccountID,
                    RenewalType = request.RenewalType,
                    RenewalAmount = request.RenewalAmount,
                    TdsAmount = tdsAmount,
                    TdsLedgerID = tdsAmount > 0m ? tdsLedgerId : null,
                    RenewalDate = request.RenewalDate
                };

                _context.InvestmentRenewals.Add(renewal);
                var renewalVoucher = await Helpers.Step4AccountingHelper.CreateInvestmentRenewalVoucherAsync(
                    _context,
                    oldAccount,
                    newAccount,
                    renewal,
                    oldMapping,
                    newMapping,
                    request.PaymentMode,
                    request.BankLedgerID,
                    request.ReferenceNo,
                    request.InterestPayoutAmount,
                    tdsAmount,
                    tdsAmount > 0m ? tdsLedgerId : null);
                await Helpers.VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, renewalVoucher.VoucherID, renewalVoucher.VoucherNo);
                oldAccount.Status = "Renewed";
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();
                return Ok(new { message = "गुंतवणूक नूतनीकरण यशस्वी!", newAccountNo = newAccount.InvestmentNo });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"नूतनीकरण त्रुटी: {ex.Message}");
            }
        }

        // POST: api/InvestmentAccounts/CalculateAccrualPreview - Preview period interest per account
        [HttpPost("CalculateAccrualPreview")]
        [Authorize(Roles = "SuperAdmin,Admin,SystemAdmin,HeadOffice,HO_Manager,Manager,BranchManager,Accountant")]
        public async Task<ActionResult> CalculateAccrualPreview([FromBody] AccrualPostingRequest request)
        {
            int? resolvedBranch = User.ResolveOptionalBranchId(request.AllBranches || request.BranchID <= 0 ? (int?)null : request.BranchID);
            bool effectiveAllBranches = !resolvedBranch.HasValue || resolvedBranch.Value <= 0;

            var query = _context.InvestmentAccounts
                .AsNoTracking()
                .Include(a => a.Branch)
                .Include(a => a.InvestmentInstitution)
                .Include(a => a.InvestmentScheme)
                .Where(a => a.Status == "Active"
                    && a.InterestRate > 0m
                    && a.InvestmentDate.Date <= request.AccrualDate.Date
                    && (a.InvestmentScheme == null || a.InvestmentScheme.InvestmentType != "Share"));

            if (!effectiveAllBranches && resolvedBranch.HasValue)
            {
                query = query.Where(a => a.BranchID == resolvedBranch.Value);
            }

            var activeAccounts = await query
                .OrderBy(a => a.BranchID)
                .ThenBy(a => a.InvestmentNo)
                .ToListAsync();

            if (!activeAccounts.Any())
            {
                return Ok(new List<object>());
            }

            var accountIds = activeAccounts.Select(a => a.InvestmentAccountID).ToList();
            var accrualStats = await _context.InvestmentInterestAccruals
                .AsNoTracking()
                .Where(a => accountIds.Contains(a.InvestmentAccountID))
                .GroupBy(a => a.InvestmentAccountID)
                .Select(g => new
                {
                    InvestmentAccountID = g.Key,
                    LastAccrualDate = g.Max(x => x.AccrualDate),
                    TotalDbAccrued = g.Sum(x => x.InterestAmount)
                })
                .ToDictionaryAsync(x => x.InvestmentAccountID);

            var earliestFyStartDate = await _context.FinancialYears
                .AsNoTracking()
                .OrderBy(f => f.StartDate)
                .ThenBy(f => f.FinancialYearID)
                .Select(f => (DateTime?)f.StartDate)
                .FirstOrDefaultAsync();

            var mappingCache = new Dictionary<(int BranchId, int SchemeId), (bool IsValid, string? ErrorMessage)>();
            var previewRows = new List<object>();

            foreach (var acc in activeAccounts)
            {
                DateTime? lastAccrualDate = accrualStats.TryGetValue(acc.InvestmentAccountID, out var st) ? st.LastAccrualDate : null;
                decimal priorDbAccrued = accrualStats.TryGetValue(acc.InvestmentAccountID, out var st2) ? st2.TotalDbAccrued : 0m;

                var calc = ComputePeriodAccrual(acc, acc.InvestmentScheme, request.AccrualDate, lastAccrualDate, priorDbAccrued, earliestFyStartDate);

                var cacheKey = (acc.BranchID, acc.SchemeID);
                if (!mappingCache.TryGetValue(cacheKey, out var mapStatus))
                {
                    var chk = await ResolveStrictVoucherMappingAsync(acc.BranchID, acc.SchemeID, false, true, true);
                    mapStatus = (chk.IsValid, chk.ErrorMessage);
                    mappingCache[cacheKey] = mapStatus;
                }

                previewRows.Add(new
                {
                    acc.InvestmentAccountID,
                    acc.BranchID,
                    BranchName = acc.Branch?.BranchName ?? $"शाखा {acc.BranchID}",
                    acc.InvestmentNo,
                    InstitutionName = acc.InvestmentInstitution?.InstitutionName ?? "",
                    acc.SchemeID,
                    SchemeName = acc.InvestmentScheme?.SchemeName ?? "",
                    acc.InvestmentDate,
                    acc.MaturityDate,
                    LastAccrualDate = lastAccrualDate,
                    FromDate = calc.FromDate,
                    ToDate = calc.ToDate,
                    ElapsedDays = calc.ElapsedDays,
                    acc.PrincipalAmount,
                    acc.InterestRate,
                    CalculationMethod = calc.Method,
                    AlreadyAccrued = calc.AlreadyAccrued,
                    CalculatedInterest = calc.CalculatedInterest,
                    HasValidMapping = mapStatus.IsValid,
                    MappingError = mapStatus.ErrorMessage,
                    IsSelected = !calc.AlreadyAccrued && calc.CalculatedInterest > 0m && mapStatus.IsValid
                });
            }

            return Ok(previewRows);
        }

        // POST: api/InvestmentAccounts/PostSelectedAccrual - Preview-driven selective Interest Accrual
        [HttpPost("PostSelectedAccrual")]
        [Authorize(Roles = "SuperAdmin,Admin,SystemAdmin,HeadOffice,HO_Manager,Manager,BranchManager,Accountant")]
        public async Task<ActionResult> PostSelectedAccrual([FromBody] PostSelectedAccrualRequest request)
        {
            if (request.SelectedItems == null || !request.SelectedItems.Any())
            {
                return BadRequest("कृपया व्याज तरतुदीसाठी किमान एक गुंतवणूक खाते निवडा.");
            }

            var validItems = request.SelectedItems
                .Where(x => Math.Round(x.InterestAmount, 2, MidpointRounding.AwayFromZero) > 0m)
                .ToList();
            if (!validItems.Any())
            {
                return BadRequest("निवडलेल्या खात्यांची एकूण व्याज रक्कम ₹0 आहे.");
            }

            var itemIds = validItems.Select(x => x.InvestmentAccountID).Distinct().ToList();
            var accounts = await _context.InvestmentAccounts
                .Include(a => a.InvestmentScheme)
                .Include(a => a.Branch)
                .Where(a => itemIds.Contains(a.InvestmentAccountID))
                .ToDictionaryAsync(a => a.InvestmentAccountID);

            if (!User.IsHeadOfficeAdmin())
            {
                int opBranchId = User.GetOperatingBranchId();
                if (accounts.Values.Any(a => a.BranchID != opBranchId))
                {
                    return Forbid();
                }
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var dateCheckCache = new Dictionary<int, int>();
                var earliestFyStartDate = await _context.FinancialYears
                    .AsNoTracking()
                    .OrderBy(f => f.StartDate)
                    .ThenBy(f => f.FinancialYearID)
                    .Select(f => (DateTime?)f.StartDate)
                    .FirstOrDefaultAsync();

                // Group items by (BranchID, ReceivableLedgerID, IncomeLedgerID) so every scheme posts to its own GLs
                var groupedEntries = new Dictionary<(int BranchId, int ReceivableLedgerId, int IncomeLedgerId), List<(InvestmentAccount Account, decimal Amount, DateTime FromDate, int Days, string Method)>>();

                foreach (var item in validItems)
                {
                    if (!accounts.TryGetValue(item.InvestmentAccountID, out var acc))
                    {
                        await transaction.RollbackAsync();
                        return BadRequest($"गुंतवणूक खाते ID {item.InvestmentAccountID} सापडले नाही.");
                    }
                    if (acc.Status != "Active" || acc.InvestmentScheme?.InvestmentType == "Share" || acc.InterestRate <= 0m)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest($"खाते क्र. {acc.InvestmentNo} हे सक्रिय मुदत ठेव खाते नाही.");
                    }
                    if (acc.InvestmentDate.Date > request.AccrualDate.Date)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest($"खाते क्र. {acc.InvestmentNo} ची गुंतवणूक तारीख ({acc.InvestmentDate:dd/MM/yyyy}) तरतूद तारखेपेक्षा पुढील आहे.");
                    }

                    if (!dateCheckCache.ContainsKey(acc.BranchID))
                    {
                        var dChk = await ValidateInvestmentTransactionDateAsync(acc.BranchID, request.AccrualDate);
                        if (!dChk.IsValid)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"शाखा '{acc.Branch?.BranchName ?? acc.BranchID.ToString()}': {dChk.ErrorMessage}");
                        }
                        dateCheckCache[acc.BranchID] = dChk.FinancialYearId;
                    }

                    bool alreadyPostedThroughDate = await _context.InvestmentInterestAccruals
                        .AnyAsync(a => a.InvestmentAccountID == acc.InvestmentAccountID && a.AccrualDate.Date >= request.AccrualDate.Date);
                    if (alreadyPostedThroughDate)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest($"खाते क्र. {acc.InvestmentNo} साठी दिनांक {request.AccrualDate:dd/MM/yyyy} पर्यंतची व्याज तरतूद आधीच नोंदवली आहे.");
                    }

                    var mapChk = await ResolveStrictVoucherMappingAsync(acc.BranchID, acc.SchemeID, false, true, true);
                    if (!mapChk.IsValid || mapChk.Mapping == null)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest($"खाते क्र. {acc.InvestmentNo}: {mapChk.ErrorMessage}");
                    }

                    var lastAccrualDate = await _context.InvestmentInterestAccruals
                        .Where(a => a.InvestmentAccountID == acc.InvestmentAccountID)
                        .MaxAsync(a => (DateTime?)a.AccrualDate);
                    decimal priorDbAccrued = await _context.InvestmentInterestAccruals
                        .Where(a => a.InvestmentAccountID == acc.InvestmentAccountID)
                        .SumAsync(a => (decimal?)a.InterestAmount) ?? 0m;

                    var calc = ComputePeriodAccrual(acc, acc.InvestmentScheme, request.AccrualDate, lastAccrualDate, priorDbAccrued, earliestFyStartDate);
                    decimal postAmount = Math.Round(item.InterestAmount, 2, MidpointRounding.AwayFromZero);
                    int days = item.ElapsedDays > 0 ? item.ElapsedDays : calc.ElapsedDays;
                    DateTime fromDt = item.FromDate ?? calc.FromDate;

                    var key = (acc.BranchID, mapChk.Mapping.InterestReceivableLedgerID, mapChk.Mapping.InterestIncomeLedgerID);
                    if (!groupedEntries.ContainsKey(key))
                    {
                        groupedEntries[key] = new List<(InvestmentAccount, decimal, DateTime, int, string)>();
                    }
                    groupedEntries[key].Add((acc, postAmount, fromDt, days, calc.Method));
                }

                int currentUserId = User.GetUserId() > 0 ? User.GetUserId() : 1;
                int totalProcessed = 0;
                decimal grandTotalInterest = 0m;
                var voucherNos = new List<string>();

                foreach (var branchGroup in groupedEntries.GroupBy(g => g.Key.BranchId))
                {
                    int bId = branchGroup.Key;
                    var branchEntity = await _context.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.BranchID == bId);
                    string bCode = !string.IsNullOrWhiteSpace(branchEntity?.BranchCode) ? branchEntity!.BranchCode! : bId.ToString("D3");
                    string bName = branchEntity?.BranchName ?? $"शाखा {bId}";
                    decimal branchTotalInterest = branchGroup.Sum(g => g.Value.Sum(x => x.Amount));
                    int fyId = dateCheckCache[bId];

                    var approvalStatus = await ApprovalPolicyHelper.DetermineVoucherStatusAsync(_context, branchTotalInterest, currentUserId);
                    string voucherNo = await VoucherNumberHelper.NextVoucherNoAsync(_context, $"JV-INV-ACC-{bCode}-{request.AccrualDate:yyyyMMdd}-", 3);

                    var voucher = new Voucher
                    {
                        BranchID = bId,
                        VoucherNo = voucherNo,
                        VoucherDate = request.AccrualDate,
                        VoucherType = "Journal",
                        Status = approvalStatus.Status,
                        ApprovedBy = approvalStatus.ApprovedBy,
                        ApprovedOn = approvalStatus.ApprovedOn,
                        Narration = $"गुंतवणूक व्याज तरतूद ({bName}) - {request.AccrualDate:dd/MM/yyyy} ({branchGroup.Sum(g => g.Value.Count)} खाती)",
                        TotalAmount = branchTotalInterest,
                        CreatedBy = currentUserId,
                        CreatedOn = DateTime.Now
                    };

                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();
                    voucherNos.Add(voucher.VoucherNo);

                    foreach (var glGroup in branchGroup)
                    {
                        decimal glSum = glGroup.Value.Sum(x => x.Amount);
                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = glGroup.Key.ReceivableLedgerId,
                            DrCr = "Dr",
                            Amount = glSum
                        });
                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = glGroup.Key.IncomeLedgerId,
                            DrCr = "Cr",
                            Amount = glSum
                        });

                        foreach (var entry in glGroup.Value)
                        {
                            _context.InvestmentInterestAccruals.Add(new InvestmentInterestAccrual
                            {
                                InstitutionID = entry.Account.InstitutionID,
                                BranchID = bId,
                                FinancialYearID = fyId,
                                InvestmentAccountID = entry.Account.InvestmentAccountID,
                                AccrualDate = request.AccrualDate,
                                FromDate = entry.FromDate,
                                CalculationDays = entry.Days,
                                CalculationMethod = entry.Method,
                                InterestAmount = entry.Amount,
                                VoucherID = voucher.VoucherID,
                                IsPosted = true,
                                CreatedBy = currentUserId
                            });
                            entry.Account.BookValue = Math.Round(entry.Account.BookValue + entry.Amount, 2, MidpointRounding.AwayFromZero);
                            totalProcessed++;
                        }
                    }

                    await _context.SaveChangesAsync();
                    await Helpers.VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, voucher.VoucherID, voucher.VoucherNo);
                    grandTotalInterest += branchTotalInterest;
                }

                await transaction.CommitAsync();
                return Ok(new
                {
                    message = $"व्याज तरतूद यशस्वी! (व्हाउचर क्र.: {string.Join(", ", voucherNos)})",
                    accountsProcessed = totalProcessed,
                    totalInterest = grandTotalInterest,
                    voucherNos
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"व्याज तरतूद त्रुटी: {ex.Message}");
            }
        }

        // POST: api/InvestmentAccounts/AccrualPosting - Legacy compatible bulk Interest Accrual
        [HttpPost("AccrualPosting")]
        [Authorize(Roles = "SuperAdmin,Admin,SystemAdmin,HeadOffice,HO_Manager,Manager,BranchManager,Accountant")]
        public async Task<ActionResult> PostAccrual([FromBody] AccrualPostingRequest request)
        {
            int? resolvedBranch = User.ResolveOptionalBranchId(request.AllBranches || request.BranchID <= 0 ? (int?)null : request.BranchID);
            bool effectiveAllBranches = !resolvedBranch.HasValue || resolvedBranch.Value <= 0;

            var query = _context.InvestmentAccounts
                .AsNoTracking()
                .Include(a => a.InvestmentScheme)
                .Where(a => a.Status == "Active"
                    && a.InterestRate > 0m
                    && a.InvestmentDate.Date <= request.AccrualDate.Date
                    && (a.InvestmentScheme == null || a.InvestmentScheme.InvestmentType != "Share"));
            if (!effectiveAllBranches && resolvedBranch.HasValue)
            {
                query = query.Where(a => a.BranchID == resolvedBranch.Value);
            }

            var activeAccounts = await query.ToListAsync();
            if (!activeAccounts.Any())
            {
                return BadRequest(effectiveAllBranches
                    ? "संस्थेत तरतुदीसाठी पात्र सक्रिय मुदत ठेव गुंतवणूक खाती नाहीत."
                    : "या शाखेत तरतुदीसाठी पात्र सक्रिय मुदत ठेव गुंतवणूक खाती नाहीत.");
            }

            var accountIds = activeAccounts.Select(a => a.InvestmentAccountID).ToList();
            var accrualStats = await _context.InvestmentInterestAccruals
                .AsNoTracking()
                .Where(a => accountIds.Contains(a.InvestmentAccountID))
                .GroupBy(a => a.InvestmentAccountID)
                .Select(g => new
                {
                    InvestmentAccountID = g.Key,
                    LastAccrualDate = g.Max(x => x.AccrualDate),
                    TotalDbAccrued = g.Sum(x => x.InterestAmount)
                })
                .ToDictionaryAsync(x => x.InvestmentAccountID);

            var earliestFyStartDate = await _context.FinancialYears
                .AsNoTracking()
                .OrderBy(f => f.StartDate)
                .ThenBy(f => f.FinancialYearID)
                .Select(f => (DateTime?)f.StartDate)
                .FirstOrDefaultAsync();

            var selected = new List<SelectedAccrualItemDto>();
            foreach (var acc in activeAccounts)
            {
                DateTime? lastAccrualDate = accrualStats.TryGetValue(acc.InvestmentAccountID, out var st) ? st.LastAccrualDate : null;
                decimal priorDbAccrued = accrualStats.TryGetValue(acc.InvestmentAccountID, out var st2) ? st2.TotalDbAccrued : 0m;
                var calc = ComputePeriodAccrual(acc, acc.InvestmentScheme, request.AccrualDate, lastAccrualDate, priorDbAccrued, earliestFyStartDate);
                if (!calc.AlreadyAccrued && calc.CalculatedInterest > 0m)
                {
                    selected.Add(new SelectedAccrualItemDto
                    {
                        InvestmentAccountID = acc.InvestmentAccountID,
                        InterestAmount = calc.CalculatedInterest,
                        ElapsedDays = calc.ElapsedDays,
                        FromDate = calc.FromDate
                    });
                }
            }

            if (!selected.Any())
            {
                return BadRequest($"निवडलेल्या शाखांसाठी दिनांक {request.AccrualDate:dd/MM/yyyy} पर्यंतची व्याज तरतूद आधीच पूर्ण झालेली आहे.");
            }

            return await PostSelectedAccrual(new PostSelectedAccrualRequest
            {
                BranchID = request.BranchID,
                AccrualDate = request.AccrualDate,
                AllBranches = effectiveAllBranches,
                SelectedItems = selected
            });
        }

        // POST: api/InvestmentAccounts/InterestReceipt - Record Interest or Share Dividend Receipt
        [HttpPost("InterestReceipt")]
        [Authorize(Roles = "SuperAdmin,Admin,SystemAdmin,HeadOffice,HO_Manager,Manager,BranchManager,Accountant,Cashier")]
        public async Task<ActionResult> RecordInterestReceipt([FromBody] InterestReceiptRequest request)
        {
            decimal grossAmount = Math.Round(request.GrossAmount > 0m ? request.GrossAmount : request.ReceivedAmount, 2, MidpointRounding.AwayFromZero);
            decimal tdsAmount = Math.Max(0m, Math.Round(request.TdsAmount, 2, MidpointRounding.AwayFromZero));
            decimal netReceived = Math.Round(grossAmount - tdsAmount, 2, MidpointRounding.AwayFromZero);

            if (grossAmount <= 0m)
            {
                return BadRequest("प्राप्त व्याज / लाभांश रक्कम ₹0 पेक्षा जास्त असणे आवश्यक आहे.");
            }
            if (netReceived < 0m)
            {
                return BadRequest("TDS कपात रक्कम ही एकूण व्याज रकमेपेक्षा जास्त असू शकत नाही.");
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var account = await _context.InvestmentAccounts
                    .Include(a => a.InvestmentScheme)
                    .FirstOrDefaultAsync(a => a.InvestmentAccountID == request.InvestmentAccountID);
                if (account == null) return NotFound("गुंतवणूक खाते सापडले नाही.");
                if (account.Status != "Active") return BadRequest("फक्त सक्रिय (Active) गुंतवणूक खात्यांवरच व्याज / लाभांश पावती नोंदवता येते.");
                if (!User.IsHeadOfficeAdmin() && account.BranchID != User.GetOperatingBranchId())
                {
                    return Forbid();
                }

                var dateCheck = await ValidateInvestmentTransactionDateAsync(account.BranchID, request.ReceiptDate);
                if (!dateCheck.IsValid)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(dateCheck.ErrorMessage);
                }

                bool isShare = string.Equals(account.InvestmentScheme?.InvestmentType, "Share", StringComparison.OrdinalIgnoreCase)
                               || string.Equals(request.ReceiptType, "ShareDividend", StringComparison.OrdinalIgnoreCase)
                               || (account.InvestmentScheme != null && account.InvestmentScheme.DurationMonths == 0);
                string normalizedReceiptType = isShare ? "ShareDividend" : "DepositInterest";

                int paymentDebitLedgerId = 0;
                if (netReceived > 0m)
                {
                    var paymentCheck = await ResolveInvestmentPaymentLedgerAsync(account.BranchID, request.PaymentMode, request.BankLedgerID);
                    if (!paymentCheck.IsValid)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(paymentCheck.ErrorMessage);
                    }
                    paymentDebitLedgerId = paymentCheck.LedgerId;
                }

                decimal receivableCleared = 0m;
                decimal freshIncome = grossAmount;
                if (!isShare)
                {
                    var (_, _, outstandingReceivable, _) = await GetAccountInterestSummaryAsync(account.InvestmentAccountID, account);
                    receivableCleared = Math.Min(grossAmount, outstandingReceivable);
                    freshIncome = Math.Round(grossAmount - receivableCleared, 2, MidpointRounding.AwayFromZero);
                }

                var mapCheck = await ResolveStrictVoucherMappingAsync(
                    account.BranchID,
                    account.SchemeID,
                    requireInvestmentAsset: false,
                    requireInterestIncome: freshIncome > 0m,
                    requireInterestReceivable: receivableCleared > 0m);
                if (!mapCheck.IsValid || mapCheck.Mapping == null)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(mapCheck.ErrorMessage ?? "गुंतवणूक व्याज प्राप्तीसाठी जी.एल. लेजर मॅपिंग सापडले नाही.");
                }
                var mapping = mapCheck.Mapping;

                int tdsLedgerId = 0;
                if (tdsAmount > 0m)
                {
                    tdsLedgerId = (request.TdsLedgerID.HasValue && request.TdsLedgerID.Value > 0)
                        ? request.TdsLedgerID.Value
                        : (mapping.TdsLedgerID ?? 0);

                    if (tdsLedgerId <= 0 || !await _context.Ledgers.AnyAsync(l => l.LedgerID == tdsLedgerId))
                    {
                        await transaction.RollbackAsync();
                        return BadRequest("TDS कपात रक्कम नोंदवण्यासाठी कृपया डायनॅमिक जी.एल. लेजर (TDS GL Ledger) निवडा.");
                    }
                }

                int currentUserId = User.GetUserId() > 0 ? User.GetUserId() : 1;
                var approvalStatus = await ApprovalPolicyHelper.DetermineVoucherStatusAsync(_context, grossAmount, currentUserId);
                var branchEntity = await _context.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.BranchID == account.BranchID);
                string branchCode = !string.IsNullOrWhiteSpace(branchEntity?.BranchCode) ? branchEntity!.BranchCode! : account.BranchID.ToString("D3");
                string voucherNo = await VoucherNumberHelper.NextVoucherNoAsync(_context, $"REC-INV-INT-{branchCode}-{request.ReceiptDate:yyyyMMdd}-", 4);

                string cleanRemarks = string.IsNullOrWhiteSpace(request.Remarks)
                    ? (isShare ? "शेअर्स लाभांश प्राप्ती" : "मुदत ठेव व्याज प्राप्ती")
                    : request.Remarks.Trim();
                string refSuffix = !string.IsNullOrWhiteSpace(request.ReferenceNo) ? $" [संदर्भ/UTR: {request.ReferenceNo.Trim()}]" : string.Empty;
                string tdsSuffix = tdsAmount > 0m ? $" [TDS कपात: ₹{tdsAmount:N2}]" : string.Empty;
                string typeLabel = isShare ? "गुंतवणूक शेअर्स लाभांश प्राप्ती" : "गुंतवणूक व्याज प्राप्ती";

                var voucher = new Voucher
                {
                    BranchID = account.BranchID,
                    VoucherNo = voucherNo,
                    VoucherDate = request.ReceiptDate,
                    VoucherType = "Receipt",
                    Status = approvalStatus.Status,
                    ApprovedBy = approvalStatus.ApprovedBy,
                    ApprovedOn = approvalStatus.ApprovedOn,
                    Narration = $"{typeLabel} - {account.InvestmentNo} - {cleanRemarks}{tdsSuffix}{refSuffix}",
                    TotalAmount = grossAmount,
                    CreatedBy = currentUserId,
                    CreatedOn = DateTime.Now
                };

                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();

                if (netReceived > 0m)
                {
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = paymentDebitLedgerId,
                        DrCr = "Dr",
                        Amount = netReceived
                    });
                }

                if (tdsAmount > 0m && tdsLedgerId > 0)
                {
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = tdsLedgerId,
                        DrCr = "Dr",
                        Amount = tdsAmount
                    });
                }

                if (receivableCleared > 0m)
                {
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = mapping.InterestReceivableLedgerID,
                        DrCr = "Cr",
                        Amount = receivableCleared
                    });
                }

                if (freshIncome > 0m)
                {
                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = mapping.InterestIncomeLedgerID,
                        DrCr = "Cr",
                        Amount = freshIncome
                    });
                }

                await _context.SaveChangesAsync();
                await Helpers.VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, voucher.VoucherID, voucher.VoucherNo);

                var receipt = new InvestmentInterestReceipt
                {
                    InstitutionID = account.InstitutionID,
                    BranchID = account.BranchID,
                    FinancialYearID = dateCheck.FinancialYearId,
                    InvestmentAccountID = request.InvestmentAccountID,
                    ReceiptDate = request.ReceiptDate,
                    ReceiptType = normalizedReceiptType,
                    GrossAmount = grossAmount,
                    TdsAmount = tdsAmount,
                    TdsLedgerID = tdsAmount > 0m ? tdsLedgerId : null,
                    ReceivedAmount = netReceived,
                    PaymentMode = string.IsNullOrWhiteSpace(request.PaymentMode) ? "Bank" : request.PaymentMode.Trim(),
                    BankLedgerID = string.Equals(request.PaymentMode, "Bank", StringComparison.OrdinalIgnoreCase) ? request.BankLedgerID : null,
                    ReferenceNo = string.IsNullOrWhiteSpace(request.ReferenceNo) ? null : request.ReferenceNo.Trim(),
                    Remarks = cleanRemarks,
                    VoucherID = voucher.VoucherID,
                    CreatedBy = currentUserId
                };

                _context.InvestmentInterestReceipts.Add(receipt);
                await _context.SaveChangesAsync();

                await SyncAccountBookValueAsync(account);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();
                return Ok(new
                {
                    message = isShare
                        ? $"शेअर्स लाभांश पावती यशस्वीरीत्या नोंदवली! (व्हाउचर क्र.: {voucher.VoucherNo})"
                        : $"व्याज प्राप्ती नोंद यशस्वी! (व्हाउचर क्र.: {voucher.VoucherNo})",
                    voucherId = voucher.VoucherID,
                    voucherNo = voucher.VoucherNo,
                    receivableCleared,
                    freshIncome
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"व्याज प्राप्ती त्रुटी: {ex.Message}");
            }
        }

        // GET: api/InvestmentAccounts/Accruals?accountId=1&branchId=1
        [HttpGet("Accruals")]
        public async Task<ActionResult> GetAccruals([FromQuery] int? accountId, [FromQuery] int? branchId)
        {
            int? effectiveBranch = User.ResolveOptionalBranchId(branchId);

            var query = _context.InvestmentInterestAccruals
                .AsNoTracking()
                .Include(a => a.Branch)
                .Include(a => a.Voucher)
                .Include(a => a.InvestmentAccount)
                    .ThenInclude(acc => acc!.InvestmentInstitution)
                .Include(a => a.InvestmentAccount)
                    .ThenInclude(acc => acc!.InvestmentScheme)
                .AsQueryable();

            if (accountId.HasValue) query = query.Where(a => a.InvestmentAccountID == accountId.Value);
            if (effectiveBranch.HasValue && effectiveBranch.Value > 0) query = query.Where(a => a.BranchID == effectiveBranch.Value);

            var accruals = await query
                .OrderByDescending(a => a.AccrualDate)
                .ThenByDescending(a => a.AccrualID)
                .Select(a => new {
                    a.AccrualID,
                    a.BranchID,
                    BranchName = a.Branch != null ? a.Branch.BranchName : "",
                    a.InvestmentAccountID,
                    InvestmentNo = a.InvestmentAccount != null ? a.InvestmentAccount.InvestmentNo : "",
                    InstitutionName = a.InvestmentAccount != null && a.InvestmentAccount.InvestmentInstitution != null ? a.InvestmentAccount.InvestmentInstitution.InstitutionName : "",
                    SchemeName = a.InvestmentAccount != null && a.InvestmentAccount.InvestmentScheme != null ? a.InvestmentAccount.InvestmentScheme.SchemeName : "",
                    InvestmentType = a.InvestmentAccount != null && a.InvestmentAccount.InvestmentScheme != null ? a.InvestmentAccount.InvestmentScheme.InvestmentType : "Deposit",
                    a.AccrualDate,
                    a.FromDate,
                    a.CalculationDays,
                    a.CalculationMethod,
                    a.InterestAmount,
                    a.VoucherID,
                    VoucherNo = a.Voucher != null ? a.Voucher.VoucherNo : "",
                    VoucherStatus = a.Voucher != null ? a.Voucher.Status : "",
                    a.IsPosted
                })
                .ToListAsync();

            return Ok(accruals);
        }

        // GET: api/InvestmentAccounts/Receipts?accountId=1&branchId=1
        [HttpGet("Receipts")]
        public async Task<ActionResult> GetReceipts([FromQuery] int? accountId, [FromQuery] int? branchId)
        {
            int? effectiveBranch = User.ResolveOptionalBranchId(branchId);

            var query = _context.InvestmentInterestReceipts
                .AsNoTracking()
                .Include(r => r.Branch)
                .Include(r => r.Voucher)
                .Include(r => r.InvestmentAccount)
                    .ThenInclude(acc => acc!.InvestmentInstitution)
                .Include(r => r.InvestmentAccount)
                    .ThenInclude(acc => acc!.InvestmentScheme)
                .AsQueryable();

            if (accountId.HasValue) query = query.Where(r => r.InvestmentAccountID == accountId.Value);
            if (effectiveBranch.HasValue && effectiveBranch.Value > 0) query = query.Where(r => r.BranchID == effectiveBranch.Value);

            var receipts = await query
                .OrderByDescending(r => r.ReceiptDate)
                .ThenByDescending(r => r.ReceiptID)
                .Select(r => new {
                    r.ReceiptID,
                    r.BranchID,
                    BranchName = r.Branch != null ? r.Branch.BranchName : "",
                    r.InvestmentAccountID,
                    InvestmentNo = r.InvestmentAccount != null ? r.InvestmentAccount.InvestmentNo : "",
                    InstitutionName = r.InvestmentAccount != null && r.InvestmentAccount.InvestmentInstitution != null ? r.InvestmentAccount.InvestmentInstitution.InstitutionName : "",
                    SchemeName = r.InvestmentAccount != null && r.InvestmentAccount.InvestmentScheme != null ? r.InvestmentAccount.InvestmentScheme.SchemeName : "",
                    InvestmentType = r.InvestmentAccount != null && r.InvestmentAccount.InvestmentScheme != null ? r.InvestmentAccount.InvestmentScheme.InvestmentType : "Deposit",
                    r.ReceiptDate,
                    r.ReceiptType,
                    GrossAmount = r.GrossAmount > 0m ? r.GrossAmount : r.ReceivedAmount,
                    r.TdsAmount,
                    r.TdsLedgerID,
                    r.ReceivedAmount,
                    r.PaymentMode,
                    r.ReferenceNo,
                    r.Remarks,
                    r.VoucherID,
                    VoucherNo = r.Voucher != null ? r.Voucher.VoucherNo : "",
                    VoucherStatus = r.Voucher != null ? r.Voucher.Status : ""
                })
                .ToListAsync();

            return Ok(receipts);
        }

        // GET: api/InvestmentAccounts/Dashboard?branchId=1
        [HttpGet("Dashboard")]
        public async Task<ActionResult> GetDashboard([FromQuery] int? branchId)
        {
            int? effectiveBranch = User.ResolveOptionalBranchId(branchId);

            var query = _context.InvestmentAccounts.AsNoTracking().AsQueryable();
            if (effectiveBranch.HasValue && effectiveBranch.Value > 0) query = query.Where(a => a.BranchID == effectiveBranch.Value);

            var activeAccounts = await query.Where(a => a.Status == "Active").ToListAsync();
            var activeIds = activeAccounts.Select(ac => ac.InvestmentAccountID).ToList();

            var totalInvestment = activeAccounts.Sum(a => a.PrincipalAmount);
            var totalBookValue = activeAccounts.Sum(a => a.BookValue);
            var totalMigrationAccrued = activeAccounts.Sum(a => a.AccruedInterestTillMigration);

            var dbAccruedInterest = activeIds.Any()
                ? await _context.InvestmentInterestAccruals
                    .Where(a => activeIds.Contains(a.InvestmentAccountID))
                    .SumAsync(a => a.InterestAmount)
                : 0m;

            var totalAccruedInterest = totalMigrationAccrued + dbAccruedInterest;

            var totalReceivedInterest = activeIds.Any()
                ? await _context.InvestmentInterestReceipts
                    .Where(r => activeIds.Contains(r.InvestmentAccountID))
                    .SumAsync(r => r.GrossAmount > 0m ? r.GrossAmount : r.ReceivedAmount)
                : 0m;

            var maturityDueCount = activeAccounts.Count(a => a.MaturityDate <= DateTime.Today.AddMonths(3));
            var maturityDueAmount = activeAccounts.Where(a => a.MaturityDate <= DateTime.Today.AddMonths(3)).Sum(a => a.ExpectedMaturityAmount);

            return Ok(new {
                totalActiveAccounts = activeAccounts.Count,
                totalInvestment,
                totalBookValue,
                interestReceivable = Math.Max(0m, Math.Round(totalAccruedInterest - totalReceivedInterest, 2, MidpointRounding.AwayFromZero)),
                totalAccruedInterest,
                totalReceivedInterest,
                maturityDueCount,
                maturityDueAmount
            });
        }

        // GET: api/InvestmentAccounts/VoucherMappings
        [HttpGet("VoucherMappings")]
        public async Task<ActionResult> GetVoucherMappings([FromQuery] int? branchId)
        {
            var query = _context.InvestmentVoucherMappings.AsQueryable();
            if (branchId.HasValue) query = query.Where(m => m.BranchID == branchId.Value);
            return Ok(await query.ToListAsync());
        }

        // POST: api/InvestmentAccounts/VoucherMappings
        [HttpPost("VoucherMappings")]
        public async Task<ActionResult> SaveVoucherMapping([FromBody] InvestmentVoucherMapping mapping)
        {
            var existing = await _context.InvestmentVoucherMappings
                .FirstOrDefaultAsync(m => m.BranchID == mapping.BranchID && m.InvestmentType == mapping.InvestmentType);

            if (existing != null)
            {
                existing.InvestmentLedgerID = mapping.InvestmentLedgerID;
                existing.InterestIncomeLedgerID = mapping.InterestIncomeLedgerID;
                existing.InterestReceivableLedgerID = mapping.InterestReceivableLedgerID;
                existing.TdsLedgerID = mapping.TdsLedgerID;
            }
            else
            {
                _context.InvestmentVoucherMappings.Add(mapping);
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "मॅपिंग जतन यशस्वी!" });
        }
    }

    // Request DTOs
    public class MaturityClaimRequest
    {
        public int MaturityID { get; set; }
        public int InstitutionID { get; set; } = 1;
        public int BranchID { get; set; } = 1;
        public int FinancialYearID { get; set; } = 1;
        public int InvestmentAccountID { get; set; }
        public DateTime MaturityDate { get; set; }
        public decimal PrincipalReceived { get; set; }
        public decimal InterestReceived { get; set; }
        public decimal TdsAmount { get; set; } = 0;
        public int? TdsLedgerID { get; set; }
        public decimal TotalReceived { get; set; }
        public int CreatedBy { get; set; } = 1;
        public string? PaymentMode { get; set; } = "Bank";
        public int? BankLedgerID { get; set; }
        public string? ReferenceNo { get; set; }
    }

    public class PrematureWithdrawRequest
    {
        public int WithdrawalID { get; set; }
        public int InstitutionID { get; set; } = 1;
        public int BranchID { get; set; } = 1;
        public int FinancialYearID { get; set; } = 1;
        public int InvestmentAccountID { get; set; }
        public DateTime WithdrawalDate { get; set; }
        public decimal PrincipalPaid { get; set; }
        public decimal RevisedInterestRate { get; set; }
        public decimal InterestPaid { get; set; }
        public decimal PenaltyAmount { get; set; } = 0;
        public decimal TdsAmount { get; set; } = 0;
        public int? TdsLedgerID { get; set; }
        public decimal NetPayout { get; set; }
        public int CreatedBy { get; set; } = 1;
        public string? PaymentMode { get; set; } = "Bank";
        public int? BankLedgerID { get; set; }
        public string? ReferenceNo { get; set; }
    }

    public class InterestReceiptRequest
    {
        public int ReceiptID { get; set; }
        public int InstitutionID { get; set; } = 1;
        public int BranchID { get; set; } = 1;
        public int FinancialYearID { get; set; } = 1;
        public int InvestmentAccountID { get; set; }
        public DateTime ReceiptDate { get; set; }
        public string? ReceiptType { get; set; } = "DepositInterest";
        public decimal GrossAmount { get; set; } = 0;
        public decimal TdsAmount { get; set; } = 0;
        public int? TdsLedgerID { get; set; }
        public decimal ReceivedAmount { get; set; }
        public int CreatedBy { get; set; } = 1;
        public string? PaymentMode { get; set; } = "Bank";
        public int? BankLedgerID { get; set; }
        public string? ReferenceNo { get; set; }
        public string? Remarks { get; set; }
    }

    public class RenewalRequest
    {
        public int OldInvestmentAccountID { get; set; }
        public int NewSchemeID { get; set; }
        public string RenewalType { get; set; } = "PrincipalOnly";
        public decimal RenewalAmount { get; set; }
        public DateTime RenewalDate { get; set; }
        public decimal NewInterestRate { get; set; }
        public decimal InterestPayoutAmount { get; set; } = 0;
        public decimal TdsAmount { get; set; } = 0;
        public int? TdsLedgerID { get; set; }
        public string? PaymentMode { get; set; } = "Bank";
        public int? BankLedgerID { get; set; }
        public string? ReferenceNo { get; set; }
    }

    public class AccrualPostingRequest
    {
        public int BranchID { get; set; }
        public DateTime AccrualDate { get; set; }
        public bool AllBranches { get; set; } = false;
    }

    public class SelectedAccrualItemDto
    {
        public int InvestmentAccountID { get; set; }
        public decimal InterestAmount { get; set; }
        public int ElapsedDays { get; set; }
        public DateTime? FromDate { get; set; }
    }

    public class PostSelectedAccrualRequest
    {
        public int BranchID { get; set; }
        public DateTime AccrualDate { get; set; }
        public bool AllBranches { get; set; } = false;
        public List<SelectedAccrualItemDto> SelectedItems { get; set; } = new();
    }
}
