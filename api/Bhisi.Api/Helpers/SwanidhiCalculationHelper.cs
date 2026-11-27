using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bhisi.Api.Helpers
{
    public record SwanidhiCategoryMeta(
        string CategoryCode,
        string CategoryName,
        string CategoryType,
        string Description);

    public record SwanidhiLedgerBalanceItem(
        int LedgerID,
        string LedgerName,
        decimal Balance);

    public class SwanidhiCalculationResult
    {
        public DateTime TargetDate { get; set; }
        public int? ScopedBranchId { get; set; }
        public string BranchName { get; set; } = "सर्व शाखा एकत्रित (All Branches - Consolidated)";

        public decimal PaidUpCapital { get; set; }
        public List<SwanidhiLedgerBalanceItem> PaidUpCapitalItems { get; set; } = new();

        public decimal StatutoryReserve { get; set; }
        public List<SwanidhiLedgerBalanceItem> StatutoryReserveItems { get; set; } = new();

        public decimal BuildingFund { get; set; }
        public List<SwanidhiLedgerBalanceItem> BuildingFundItems { get; set; } = new();

        public decimal FreeReserves { get; set; }
        public List<SwanidhiLedgerBalanceItem> FreeReservesItems { get; set; } = new();

        public decimal StandardAssetProvision { get; set; }
        public List<SwanidhiLedgerBalanceItem> StandardAssetProvisionItems { get; set; } = new();
        public decimal EstimatedStandardAssetProvisionRef { get; set; }
        public decimal StandardLoansReferenceBase { get; set; }

        public bool UsedManualCertifiedNetProfit { get; set; }
        public decimal CertifiedNetProfit { get; set; }
        public decimal CurrentYearNetLoss { get; set; }
        public decimal Year1DividendRate { get; set; }
        public decimal Year2DividendRate { get; set; }
        public decimal Year3DividendRate { get; set; }
        public decimal AverageDividendRate { get; set; }
        public decimal ProposedDividendAmount { get; set; }
        public decimal UndistributedNetProfit { get; set; }

        public decimal GrossOwnedFunds { get; set; }

        public decimal AccumulatedLoss { get; set; }
        public List<SwanidhiLedgerBalanceItem> AccumulatedLossItems { get; set; } = new();
        public decimal TotalDeductions { get; set; }

        public decimal NetOwnedFunds { get; set; }

        public decimal Multiplier { get; set; }
        public decimal ConfiguredMultiplier { get; set; }
        public bool IsMultiplierSimulated { get; set; }
        public decimal MaxBorrowingLimit { get; set; }

        // Outside Liabilities (As-Of TargetDate)
        public decimal SavingBalance { get; set; }
        public decimal SavingGlBalance { get; set; }
        public decimal FdBalance { get; set; }
        public decimal RdBalance { get; set; }
        public decimal PigmyBalance { get; set; }
        public decimal PigmyGlBalance { get; set; }
        public decimal OutsideBankLoans { get; set; }
        public List<SwanidhiLedgerBalanceItem> OutsideBankLoanItems { get; set; } = new();
        public decimal ActualOutsideLiabilities { get; set; }

        public decimal SurplusHeadroom { get; set; }
        public bool IsComplied { get; set; }

        public List<SwanidhiLedgerBalanceItem> ExcludedReserves { get; set; } = new();
        public bool UsedInMemoryAutoSuggestions { get; set; }
    }

    /// <summary>
    /// Single Source of Truth for Maharashtra Co-operative Societies Rules, 1961 (Rule 35)
    /// Owned Funds (Swanidhi) and Maximum Borrowing Limit calculation.
    /// Shared across SwanidhiController and AuditComplianceController.
    /// </summary>
    public static class SwanidhiCalculationHelper
    {
        public static readonly List<SwanidhiCategoryMeta> StandardCategories = new()
        {
            new("PAID_UP_CAPITAL", "१. वसूल भाग भांडवल (Paid-up Share Capital)", "Addition", "नियमित सभासदांचे वसूल शेअर्स भाग भांडवल"),
            new("STATUTORY_RESERVE", "२. राखीव निधी (Statutory Reserve Fund)", "Addition", "कलम ६६ अन्वये दरवर्षी नफ्यातून २५% काढलेला वैधानिक राखीव निधी"),
            new("BUILDING_FUND", "३. इमारत निधी (Building Fund)", "Addition", "संस्थेच्या नफ्यातून निर्माण झालेला इमारत निधी"),
            new("FREE_AND_DEVELOPMENT_RESERVE", "४. मुक्त व विकास निधी (Free & Development Reserves)", "Addition", "नफ्यातून तयार झालेले व ज्यावर कोणतीही बाह्य देयता नाही असे निधी (उदा. लाभांश समानीकरण, तंत्रज्ञान निधी) - स्पष्टीकरण-१"),
            new("STANDARD_ASSET_PROVISION", "५. उत्तम जिंदगी तरतूद (General Provision on Standard Assets)", "Addition", "ताळेबंदात प्रत्यक्षात केलेली नियमित/स्टँडर्ड कर्जांवरील सामान्य जोखीम तरतूद (०.४०%)"),
            new("ACCUMULATED_LOSS", "ब. संचित तोटा (Accumulated Losses - Deduction)", "Deduction", "मागील व चालू वर्षाचा ताळेबंदातील संचित तोटा"),
            new("OUTSIDE_BORROWINGS", "बाह्य बँक / वित्तीय संस्था कर्जे (Outside Borrowings - Rule 35 Liability)", "Liability", "बँक कर्ज, सोने पुनर्गहाण कर्ज, कॅश क्रेडिट, ओव्हरड्राफ्ट व इतर बाह्य उचल कर्जे"),
            new("EXCLUDED_RESERVES", "वगळलेले बाह्य देयता निधी (Excluded / Non-Free Reserves)", "Excluded", "ज्या निधींवर बाह्य देयता आहे (उदा. सभासद/सेवक कल्याण, धर्मादाय, घसारा, संशयित बुडीत निधी - स्वनिधीत समाविष्ट होत नाहीत)")
        };

        private static readonly string[] ExcludedKeywords =
        {
            "कल्याण", "धर्मादाय", "घसारा", "संशयित बुडीत", "बुडीत कर्ज", "बुडित कर्ज",
            "चढ उतार", "चढ-उतार", "प्रशिक्षण", "निवडणूक", "शिक्षण निधी",
            "welfare", "charity", "depreciation", "bad debt", "bddr", "doubtful",
            "npa provision", "npa reserve", "overdue interest reserve", "oir",
            "fluctuation", "election", "training"
        };

        private static readonly string[] OutsideBorrowingKeywords =
        {
            "बँक कर्ज", "शिखर", "मध्यवर्ती", "कर्ज उचल", "उचल कर्ज",
            "पुनर्गहाण", "कॅश क्रेडिट", "ओव्हरड्राफ्ट", "बाह्य कर्ज",
            "bank loan", "bank borrowing", "cash credit", "overdraft",
            "gold repledge", "re-pledge", "repledge", "term loan payable"
        };

        /// <summary>
        /// Builds deterministic, nature-validated auto-mappings where ExcludeFromRule35Swanidhi
        /// and non-free reserve keywords ALWAYS take highest precedence.
        /// </summary>
        public static async Task<List<SwanidhiLedgerMapping>> BuildSuggestedMappingsAsync(AppDbContext context)
        {
            var allGroups = await context.AccountGroups.AsNoTracking().ToListAsync();
            var ledgers = await context.Ledgers.AsNoTracking()
                .Where(l => l.IsActive)
                .OrderBy(l => l.LedgerID)
                .ToListAsync();

            var borrowingLedgerIds = await context.SansthaBorrowings.AsNoTracking()
                .Where(b => b.BorrowingLiabilityLedgerID > 0)
                .Select(b => b.BorrowingLiabilityLedgerID)
                .Distinct()
                .ToHashSetAsync();

            var mappings = new List<SwanidhiLedgerMapping>();

            foreach (var l in ledgers)
            {
                string name = (l.LedgerName ?? string.Empty).Trim();
                string lower = name.ToLowerInvariant();
                string accType = (l.AccountType ?? string.Empty).Trim();
                string rootNature = BranchLedgerBalanceHelper.ResolveGroupRootNature(l.GroupID, allGroups);

                string code = string.Empty;

                // PRIORITY 1: Explicit Rule 35 exclusion flag or non-free/risk-provision keywords ALWAYS win
                if (l.ExcludeFromRule35Swanidhi ||
                    ExcludedKeywords.Any(kw => lower.Contains(kw, StringComparison.OrdinalIgnoreCase)))
                {
                    if (rootNature == "Liabilities")
                    {
                        code = "EXCLUDED_RESERVES";
                    }
                }
                // PRIORITY 2: Outside Institutional Borrowings (SansthaBorrowings SSOT or Liability borrowing keywords)
                else if (rootNature == "Liabilities" &&
                         (borrowingLedgerIds.Contains(l.LedgerID) ||
                          OutsideBorrowingKeywords.Any(kw => lower.Contains(kw, StringComparison.OrdinalIgnoreCase))))
                {
                    code = "OUTSIDE_BORROWINGS";
                }
                // PRIORITY 3: Paid-up Share Capital (strictly Liabilities — never Investment Shares Asset or Entrance Fee Income)
                else if (rootNature == "Liabilities" &&
                         (string.Equals(accType, "Share Capital", StringComparison.OrdinalIgnoreCase) ||
                          name.Contains("भाग भांडवल") ||
                          name.Contains("भागभांडवल") ||
                          name.Contains("सभासद भाग") ||
                          name.Contains("वसूल भाग") ||
                          name.Contains("वसुल भाग") ||
                          lower.Contains("share capital") ||
                          (name.Contains("शेअर्स") && !name.Contains("फी") && !name.Contains("लाभांश") && !name.Contains("गुंतवणूक"))))
                {
                    code = "PAID_UP_CAPITAL";
                }
                // PRIORITY 4: Statutory Reserve Fund (strictly Liabilities)
                else if (rootNature == "Liabilities" &&
                         (name.Contains("वैधानिक राखीव") ||
                          name.Contains("राखीव निधी") ||
                          lower.Contains("statutory reserve") ||
                          lower.Contains("reserve fund")))
                {
                    code = "STATUTORY_RESERVE";
                }
                // PRIORITY 5: Building Fund (strictly Liabilities)
                else if (rootNature == "Liabilities" &&
                         (name.Contains("इमारत निधी") ||
                          lower.Contains("building fund")))
                {
                    code = "BUILDING_FUND";
                }
                // PRIORITY 6: Free & Development Reserves (strictly Liabilities)
                else if (rootNature == "Liabilities" &&
                         (name.Contains("लाभांश सम") ||
                          name.Contains("तंत्रज्ञान") ||
                          name.Contains("विकास निधी") ||
                          name.Contains("सामान्य निधी") ||
                          lower.Contains("dividend equal") ||
                          lower.Contains("development fund") ||
                          lower.Contains("general reserve")))
                {
                    code = "FREE_AND_DEVELOPMENT_RESERVE";
                }
                // PRIORITY 7: Standard Asset General Provision (strictly Liabilities)
                else if (rootNature == "Liabilities" &&
                         (name.Contains("उत्तम जिंदगी") ||
                          name.Contains("प्रमाणित कर्ज तरतूद") ||
                          lower.Contains("standard asset provision")))
                {
                    code = "STANDARD_ASSET_PROVISION";
                }
                // PRIORITY 8: Accumulated Loss (Balance Sheet Assets/Liabilities — NEVER P&L operating Expense)
                else if ((rootNature == "Assets" || rootNature == "Liabilities") &&
                         (name.Contains("संचित तोटा") ||
                          name.Contains("चालू तोटा") ||
                          lower.Contains("accumulated loss")))
                {
                    code = "ACCUMULATED_LOSS";
                }

                if (!string.IsNullOrEmpty(code))
                {
                    var cat = StandardCategories.FirstOrDefault(c => c.CategoryCode == code);
                    mappings.Add(new SwanidhiLedgerMapping
                    {
                        CategoryCode = code,
                        CategoryName = cat?.CategoryName ?? code,
                        LedgerID = l.LedgerID,
                        Ledger = l,
                        CreatedOn = DateTime.UtcNow,
                        UpdatedOn = DateTime.UtcNow
                    });
                }
            }

            return mappings;
        }

        /// <summary>
        /// Computes historical As-Of-Date Saving Deposits from SavingAccountMasters + SavingTransactions.
        /// Reverses transactions strictly after targetDate so historical balances (e.g. 31/03) are accurate
        /// and accounts closed after targetDate are properly included.
        /// </summary>
        public static async Task<decimal> GetSavingTotalAsOfAsync(
            AppDbContext context,
            DateTime asOnDate,
            int? branchId = null)
        {
            DateTime targetDate = asOnDate.Date;

            var accQ = context.SavingAccountMasters.AsNoTracking()
                .Where(s => s.OpeningDate.Date <= targetDate);
            if (branchId.HasValue && branchId.Value > 0)
            {
                int bId = branchId.Value;
                accQ = accQ.Where(s => s.BranchID == bId);
            }

            if (targetDate >= DateTime.Today)
            {
                return await accQ
                    .Where(s => s.Status == "Active" || s.Status == "Dormant" || string.IsNullOrEmpty(s.Status))
                    .SumAsync(s => (decimal?)s.CurrentBalance) ?? 0m;
            }

            var accounts = await accQ
                .Select(s => new { s.SavingAccountID, s.CurrentBalance })
                .ToListAsync();

            if (accounts.Count == 0) return 0m;

            var accountIds = accounts.Select(a => a.SavingAccountID).ToList();
            var postTxs = await context.SavingTransactions.AsNoTracking()
                .Where(t => accountIds.Contains(t.SavingAccountID) && t.TransactionDate.Date > targetDate)
                .Select(t => new { t.SavingAccountID, t.TransactionType, t.Amount })
                .ToListAsync();

            var postDeltaByAcc = new Dictionary<int, decimal>();
            foreach (var tx in postTxs)
            {
                string type = (tx.TransactionType ?? string.Empty).Trim();
                bool isDebit = type.Contains("Withdraw", StringComparison.OrdinalIgnoreCase)
                            || type.Contains("Charge", StringComparison.OrdinalIgnoreCase)
                            || type.Contains("Clos", StringComparison.OrdinalIgnoreCase)
                            || type.Contains("Debit", StringComparison.OrdinalIgnoreCase)
                            || type.Equals("Dr", StringComparison.OrdinalIgnoreCase)
                            || type.Contains("TransferOut", StringComparison.OrdinalIgnoreCase);

                // To roll back from CurrentBalance to targetDate:
                // - Post-date Credit increased CurrentBalance => subtract it
                // - Post-date Debit decreased CurrentBalance => add it back
                decimal rollbackDelta = isDebit ? tx.Amount : -tx.Amount;
                postDeltaByAcc[tx.SavingAccountID] = postDeltaByAcc.GetValueOrDefault(tx.SavingAccountID) + rollbackDelta;
            }

            decimal total = 0m;
            foreach (var acc in accounts)
            {
                decimal asOfBal = acc.CurrentBalance + postDeltaByAcc.GetValueOrDefault(acc.SavingAccountID);
                if (asOfBal > 0m)
                {
                    total += asOfBal;
                }
            }
            return Math.Round(total, 2, MidpointRounding.AwayFromZero);
        }

        /// <summary>
        /// Computes historical As-Of-Date Pigmy Deposits from PigmyAccounts + PigmyTransactions.
        /// Reverses transactions strictly after targetDate so historical balances (e.g. 31/03) are accurate.
        /// </summary>
        public static async Task<decimal> GetPigmyTotalAsOfAsync(
            AppDbContext context,
            DateTime asOnDate,
            int? branchId = null)
        {
            DateTime targetDate = asOnDate.Date;

            var accQ = context.PigmyAccounts.AsNoTracking()
                .Where(p => p.OpeningDate.Date <= targetDate);
            if (branchId.HasValue && branchId.Value > 0)
            {
                int bId = branchId.Value;
                accQ = accQ.Where(p => p.BranchID == bId);
            }

            if (targetDate >= DateTime.Today)
            {
                return await accQ
                    .Where(FdDepositQueryHelper.LivePigmyPredicate)
                    .SumAsync(p => (decimal?)(p.TotalDepositedAmount - p.TotalWithdrawnAmount)) ?? 0m;
            }

            var accounts = await accQ
                .Select(p => new
                {
                    p.PigmyAccountID,
                    NetLive = p.TotalDepositedAmount - p.TotalWithdrawnAmount
                })
                .ToListAsync();

            if (accounts.Count == 0) return 0m;

            var accountIds = accounts.Select(a => a.PigmyAccountID).ToList();
            var postTxs = await context.PigmyTransactions.AsNoTracking()
                .Where(t => accountIds.Contains(t.PigmyAccountID) && t.TransactionDate.Date > targetDate)
                .Select(t => new { t.PigmyAccountID, t.CrAmount, t.DrAmount })
                .ToListAsync();

            var postDeltaByAcc = new Dictionary<int, decimal>();
            foreach (var tx in postTxs)
            {
                // Rollback: subtract post-date Cr, add back post-date Dr
                decimal rollbackDelta = tx.DrAmount - tx.CrAmount;
                postDeltaByAcc[tx.PigmyAccountID] = postDeltaByAcc.GetValueOrDefault(tx.PigmyAccountID) + rollbackDelta;
            }

            decimal total = 0m;
            foreach (var acc in accounts)
            {
                decimal asOfBal = acc.NetLive + postDeltaByAcc.GetValueOrDefault(acc.PigmyAccountID);
                if (asOfBal > 0m)
                {
                    total += asOfBal;
                }
            }
            return Math.Round(total, 2, MidpointRounding.AwayFromZero);
        }

        /// <summary>
        /// Full Rule 35 Owned Funds & Borrowing Capacity calculation (Strictly Read-Only — zero DB writes).
        /// </summary>
        public static async Task<SwanidhiCalculationResult> CalculateAsync(
            AppDbContext context,
            DateTime targetDate,
            int? scopedBranch = null,
            decimal? customMultiplier = null)
        {
            DateTime asOf = targetDate.Date;
            int settingBranchId = scopedBranch.HasValue && scopedBranch.Value > 0 ? scopedBranch.Value : 1;

            var setting = await context.SwanidhiSettings.AsNoTracking()
                .FirstOrDefaultAsync(s => s.BranchID == settingBranchId)
                ?? await context.SwanidhiSettings.AsNoTracking()
                    .OrderBy(s => s.BranchID)
                    .FirstOrDefaultAsync();

            decimal configuredMultiplier = setting?.BorrowingLimitMultiplier > 0m ? setting.BorrowingLimitMultiplier : 10.0m;
            decimal multiplier = customMultiplier.HasValue && customMultiplier.Value > 0m
                ? customMultiplier.Value
                : configuredMultiplier;
            bool isSimulated = customMultiplier.HasValue && customMultiplier.Value > 0m && customMultiplier.Value != configuredMultiplier;

            decimal y1 = setting?.Year1DividendRate ?? 9.0m;
            decimal y2 = setting?.Year2DividendRate ?? 9.0m;
            decimal y3 = setting?.Year3DividendRate ?? 9.0m;
            decimal avgDivRate = setting != null
                ? setting.AverageDividendRate
                : Math.Round((y1 + y2 + y3) / 3m, 2, MidpointRounding.AwayFromZero);

            // Load mappings strictly read-only; if empty, compute in-memory suggestions without mutating DB
            var savedMappings = await context.SwanidhiLedgerMappings.AsNoTracking()
                .Include(m => m.Ledger)
                .ToListAsync();

            bool usedAutoSuggestions = false;
            List<SwanidhiLedgerMapping> effectiveMappings;
            if (savedMappings.Count > 0)
            {
                // Deduplicate in memory by LedgerID just in case legacy DB has duplicate rows
                effectiveMappings = savedMappings
                    .GroupBy(m => m.LedgerID)
                    .Select(g => g.OrderByDescending(x => x.UpdatedOn).First())
                    .ToList();
            }
            else
            {
                effectiveMappings = await BuildSuggestedMappingsAsync(context);
                usedAutoSuggestions = true;
            }

            var allGroups = await context.AccountGroups.AsNoTracking().ToListAsync();
            var allActiveLedgers = await context.Ledgers.AsNoTracking()
                .Where(l => l.IsActive)
                .ToListAsync();

            // Outside Borrowing Ledgers: Explicit OUTSIDE_BORROWINGS mapping + SansthaBorrowings.BorrowingLiabilityLedgerID + fallback liability keywords
            var mappedBorrowingIds = effectiveMappings
                .Where(m => m.CategoryCode == "OUTSIDE_BORROWINGS")
                .Select(m => m.LedgerID)
                .ToHashSet();

            var sansthaBorrowingLedgerIds = await context.SansthaBorrowings.AsNoTracking()
                .Where(b => b.BorrowingLiabilityLedgerID > 0 && (!scopedBranch.HasValue || scopedBranch.Value <= 0 || b.BranchID == scopedBranch.Value))
                .Select(b => b.BorrowingLiabilityLedgerID)
                .Distinct()
                .ToListAsync();

            var borrowingLedgerIds = new HashSet<int>(mappedBorrowingIds);
            foreach (var blId in sansthaBorrowingLedgerIds)
            {
                borrowingLedgerIds.Add(blId);
            }

            // Fallback keyword discovery only when neither explicit mapping nor SansthaBorrowings ledgers exist
            if (borrowingLedgerIds.Count == 0)
            {
                foreach (var l in allActiveLedgers)
                {
                    if (BranchLedgerBalanceHelper.ResolveGroupRootNature(l.GroupID, allGroups) == "Liabilities" &&
                        OutsideBorrowingKeywords.Any(kw => (l.LedgerName ?? string.Empty).Contains(kw, StringComparison.OrdinalIgnoreCase)))
                    {
                        borrowingLedgerIds.Add(l.LedgerID);
                    }
                }
            }

            // Saving & Pigmy Control GL Ledgers for Reconciliation transparency
            var savingGlLedgerIds = await context.SavingAccountMasters.AsNoTracking()
                .Where(s => s.LedgerID > 0)
                .Select(s => s.LedgerID)
                .Distinct()
                .ToListAsync();

            var pigmyGlLedgerIds = await context.PigmySchemes.AsNoTracking()
                .Where(ps => ps.PigmyLiabilityLedgerID.HasValue && ps.PigmyLiabilityLedgerID.Value > 0)
                .Select(ps => ps.PigmyLiabilityLedgerID!.Value)
                .Distinct()
                .ToListAsync();

            var allTargetLedgerIds = effectiveMappings.Select(m => m.LedgerID)
                .Concat(borrowingLedgerIds)
                .Concat(savingGlLedgerIds)
                .Concat(pigmyGlLedgerIds)
                .Where(id => id > 0)
                .Distinct()
                .ToList();

            var asOfNetDrBalances = await BranchLedgerBalanceHelper.GetAsOfLedgerBalancesAsync(
                context,
                allTargetLedgerIds,
                asOf,
                scopedBranch,
                approvedOnly: true);

            decimal GetCreditBalance(int ledgerId) =>
                asOfNetDrBalances.TryGetValue(ledgerId, out var netDr) ? -netDr : 0m;

            decimal GetDebitBalance(int ledgerId) =>
                asOfNetDrBalances.TryGetValue(ledgerId, out var netDr) ? netDr : 0m;

            List<SwanidhiLedgerBalanceItem> BuildCreditItems(string categoryCode) =>
                effectiveMappings
                    .Where(m => m.CategoryCode == categoryCode)
                    .Select(m => new SwanidhiLedgerBalanceItem(
                        m.LedgerID,
                        m.Ledger?.LedgerName ?? $"Ledger #{m.LedgerID}",
                        GetCreditBalance(m.LedgerID)))
                    .ToList();

            var capItems = BuildCreditItems("PAID_UP_CAPITAL");
            decimal paidUpCapital = capItems.Sum(i => Math.Max(0m, i.Balance));

            var resItems = BuildCreditItems("STATUTORY_RESERVE");
            decimal statutoryReserve = resItems.Sum(i => Math.Max(0m, i.Balance));

            var bldItems = BuildCreditItems("BUILDING_FUND");
            decimal buildingFund = bldItems.Sum(i => Math.Max(0m, i.Balance));

            var freeItems = BuildCreditItems("FREE_AND_DEVELOPMENT_RESERVE");
            decimal freeReserves = freeItems.Sum(i => Math.Max(0m, i.Balance));

            // P0-3 FIX: Only ACTUAL booked GL Standard Asset Provision is included in Owned Funds (never auto-inflate!)
            var stdItems = BuildCreditItems("STANDARD_ASSET_PROVISION");
            decimal standardAssetProvision = stdItems.Sum(i => Math.Max(0m, i.Balance));

            // Informational Reference ONLY: 0.40% of Standard-only Active Loans (excluding NPA loans)
            var stdLoanQ = context.LoanAccounts.AsNoTracking()
                .Where(l => l.Status == "Active" &&
                            (string.IsNullOrEmpty(l.InitialNpaClassification) ||
                             l.InitialNpaClassification == "Standard") &&
                            l.OpeningDate.Date <= asOf);
            if (scopedBranch.HasValue && scopedBranch.Value > 0)
            {
                int sbId = scopedBranch.Value;
                stdLoanQ = stdLoanQ.Where(l => l.BranchID == sbId);
            }
            decimal standardLoansRefBase = await stdLoanQ.SumAsync(l => (decimal?)l.PrincipalBalance) ?? 0m;
            decimal estimatedStdProvisionRef = Math.Round(standardLoansRefBase * 0.0040m, 2, MidpointRounding.AwayFromZero);

            // P0-3 + P2-2 FIX: Net Profit / Current-Year Net Loss using full nested Root Nature + honoring ManualCertifiedNetProfit == 0
            decimal certifiedNetProfit = 0m;
            decimal currentYearNetLoss = 0m;
            bool usedManualProfit = false;

            if (setting?.ManualCertifiedNetProfit.HasValue == true)
            {
                usedManualProfit = true;
                decimal manualVal = setting.ManualCertifiedNetProfit.Value;
                if (manualVal >= 0m)
                {
                    certifiedNetProfit = manualVal;
                }
                else
                {
                    currentYearNetLoss = Math.Abs(manualVal);
                }
            }
            else
            {
                var fyBaseline = await FinancialYearBaselineHelper.ResolveBaselineAsync(context, asOf, branchId: scopedBranch);
                DateTime? pnlStart = (fyBaseline.TargetFyStartDate ?? fyBaseline.BaselineStartDate)?.Date;

                var incomeLedgerIds = allActiveLedgers
                    .Where(l => BranchLedgerBalanceHelper.ResolveGroupRootNature(l.GroupID, allGroups) == "Income")
                    .Select(l => l.LedgerID)
                    .ToList();

                var expenseLedgerIds = allActiveLedgers
                    .Where(l => BranchLedgerBalanceHelper.ResolveGroupRootNature(l.GroupID, allGroups) == "Expenses")
                    .Select(l => l.LedgerID)
                    .ToList();

                var incQ = context.VoucherDetails.AsNoTracking()
                    .Where(vd => incomeLedgerIds.Contains(vd.LedgerID) &&
                                 vd.Voucher != null &&
                                 (vd.Voucher.Status == "Approved" || vd.Voucher.Status == "Posted") &&
                                 vd.Voucher.VoucherDate.Date <= asOf);

                var expQ = context.VoucherDetails.AsNoTracking()
                    .Where(vd => expenseLedgerIds.Contains(vd.LedgerID) &&
                                 vd.Voucher != null &&
                                 (vd.Voucher.Status == "Approved" || vd.Voucher.Status == "Posted") &&
                                 vd.Voucher.VoucherDate.Date <= asOf);

                if (pnlStart.HasValue)
                {
                    DateTime pStart = pnlStart.Value;
                    incQ = incQ.Where(vd => vd.Voucher!.VoucherDate.Date >= pStart);
                    expQ = expQ.Where(vd => vd.Voucher!.VoucherDate.Date >= pStart);
                }
                if (scopedBranch.HasValue && scopedBranch.Value > 0)
                {
                    int sbId = scopedBranch.Value;
                    incQ = incQ.Where(vd => vd.Voucher!.BranchID == sbId);
                    expQ = expQ.Where(vd => vd.Voucher!.BranchID == sbId);
                }

                decimal totalIncome = await incQ.SumAsync(vd => (decimal?)(vd.DrCr == "Cr" ? vd.Amount : -vd.Amount)) ?? 0m;
                decimal totalExpense = await expQ.SumAsync(vd => (decimal?)(vd.DrCr == "Dr" ? vd.Amount : -vd.Amount)) ?? 0m;
                decimal rawPnlNet = totalIncome - totalExpense;

                if (rawPnlNet >= 0m)
                {
                    certifiedNetProfit = Math.Round(rawPnlNet, 2, MidpointRounding.AwayFromZero);
                }
                else
                {
                    currentYearNetLoss = Math.Round(Math.Abs(rawPnlNet), 2, MidpointRounding.AwayFromZero);
                }
            }

            decimal proposedDividendAmount = Math.Round(paidUpCapital * (avgDivRate / 100.0m), 2, MidpointRounding.AwayFromZero);
            decimal undistributedNetProfit = Math.Max(0m, certifiedNetProfit - proposedDividendAmount);

            decimal grossOwnedFunds = paidUpCapital + statutoryReserve + buildingFund + freeReserves + standardAssetProvision + undistributedNetProfit;

            // Section B: Deductions (Mapped Accumulated Losses + Current Year Net Loss if any)
            var lossItems = effectiveMappings
                .Where(m => m.CategoryCode == "ACCUMULATED_LOSS")
                .Select(m => new SwanidhiLedgerBalanceItem(
                    m.LedgerID,
                    m.Ledger?.LedgerName ?? $"Ledger #{m.LedgerID}",
                    GetDebitBalance(m.LedgerID)))
                .ToList();

            decimal accumulatedLoss = lossItems.Sum(i => Math.Max(0m, i.Balance));
            decimal totalDeductions = accumulatedLoss + currentYearNetLoss;
            decimal netOwnedFunds = grossOwnedFunds - totalDeductions;

            // P2-1 FIX: Negative Owned Funds => Permissible Borrowing Limit is strictly ₹0.00
            decimal maxBorrowingLimit = netOwnedFunds > 0m
                ? Math.Round(netOwnedFunds * multiplier, 2, MidpointRounding.AwayFromZero)
                : 0m;

            // Part 2: Actual Outside Liabilities (ALL As-Of TargetDate!)
            decimal savingBalance = await GetSavingTotalAsOfAsync(context, asOf, scopedBranch);
            decimal savingGlBalance = savingGlLedgerIds.Sum(id => Math.Max(0m, GetCreditBalance(id)));
            decimal fdBalance = await FdDepositQueryHelper.GetLiveFdTotalAsOfAsync(context, asOf, scopedBranch);
            decimal rdBalance = await RdDepositQueryHelper.GetLiveRdTotalAsOfAsync(context, asOf, scopedBranch);
            decimal pigmyBalance = await GetPigmyTotalAsOfAsync(context, asOf, scopedBranch);
            decimal pigmyGlBalance = pigmyGlLedgerIds.Sum(id => Math.Max(0m, GetCreditBalance(id)));

            var ledgerLookup = allActiveLedgers.ToDictionary(l => l.LedgerID, l => l.LedgerName ?? $"Ledger #{l.LedgerID}");
            var borrowingItems = borrowingLedgerIds
                .Select(id => new SwanidhiLedgerBalanceItem(
                    id,
                    ledgerLookup.TryGetValue(id, out var nm) ? nm : $"Ledger #{id}",
                    Math.Max(0m, GetCreditBalance(id))))
                .Where(item => item.Balance > 0m)
                .OrderByDescending(item => item.Balance)
                .ToList();

            decimal outsideBankLoans = borrowingItems.Sum(i => i.Balance);

            // Fallback: if SansthaBorrowings has active outstanding principals not yet booked to GL
            if (outsideBankLoans == 0m)
            {
                var sbQ = context.SansthaBorrowings.AsNoTracking()
                    .Where(b => (b.Status == "Active" || b.Status == "Disbursed") && b.DisbursementDate.Date <= asOf);
                if (scopedBranch.HasValue && scopedBranch.Value > 0)
                {
                    int sbId = scopedBranch.Value;
                    sbQ = sbQ.Where(b => b.BranchID == sbId);
                }
                var activeBorrowings = await sbQ
                    .Select(b => new { b.BorrowingLiabilityLedgerID, b.LenderName, b.BorrowingNo, b.OutstandingPrincipal })
                    .ToListAsync();
                if (activeBorrowings.Count > 0)
                {
                    outsideBankLoans = activeBorrowings.Sum(b => Math.Max(0m, b.OutstandingPrincipal));
                    foreach (var b in activeBorrowings.Where(x => x.OutstandingPrincipal > 0m))
                    {
                        borrowingItems.Add(new SwanidhiLedgerBalanceItem(
                            b.BorrowingLiabilityLedgerID,
                            $"{b.LenderName} ({b.BorrowingNo})",
                            b.OutstandingPrincipal));
                    }
                }
            }

            decimal actualOutsideLiabilities = savingBalance + fdBalance + rdBalance + pigmyBalance + outsideBankLoans;
            decimal surplusHeadroom = maxBorrowingLimit - actualOutsideLiabilities;
            bool isComplied = netOwnedFunds > 0m && surplusHeadroom >= 0m;

            var excludedItems = BuildCreditItems("EXCLUDED_RESERVES");

            string branchName = "सर्व शाखा एकत्रित (All Branches - Consolidated)";
            if (scopedBranch.HasValue && scopedBranch.Value > 0)
            {
                var br = await context.Branches.AsNoTracking()
                    .FirstOrDefaultAsync(b => b.BranchID == scopedBranch.Value);
                branchName = br?.BranchName ?? $"शाखा #{scopedBranch.Value}";
            }

            return new SwanidhiCalculationResult
            {
                TargetDate = asOf,
                ScopedBranchId = scopedBranch,
                BranchName = branchName,
                PaidUpCapital = paidUpCapital,
                PaidUpCapitalItems = capItems,
                StatutoryReserve = statutoryReserve,
                StatutoryReserveItems = resItems,
                BuildingFund = buildingFund,
                BuildingFundItems = bldItems,
                FreeReserves = freeReserves,
                FreeReservesItems = freeItems,
                StandardAssetProvision = standardAssetProvision,
                StandardAssetProvisionItems = stdItems,
                EstimatedStandardAssetProvisionRef = estimatedStdProvisionRef,
                StandardLoansReferenceBase = standardLoansRefBase,
                UsedManualCertifiedNetProfit = usedManualProfit,
                CertifiedNetProfit = certifiedNetProfit,
                CurrentYearNetLoss = currentYearNetLoss,
                Year1DividendRate = y1,
                Year2DividendRate = y2,
                Year3DividendRate = y3,
                AverageDividendRate = avgDivRate,
                ProposedDividendAmount = proposedDividendAmount,
                UndistributedNetProfit = undistributedNetProfit,
                GrossOwnedFunds = grossOwnedFunds,
                AccumulatedLoss = accumulatedLoss,
                AccumulatedLossItems = lossItems,
                TotalDeductions = totalDeductions,
                NetOwnedFunds = netOwnedFunds,
                Multiplier = multiplier,
                ConfiguredMultiplier = configuredMultiplier,
                IsMultiplierSimulated = isSimulated,
                MaxBorrowingLimit = maxBorrowingLimit,
                SavingBalance = savingBalance,
                SavingGlBalance = savingGlBalance,
                FdBalance = fdBalance,
                RdBalance = rdBalance,
                PigmyBalance = pigmyBalance,
                PigmyGlBalance = pigmyGlBalance,
                OutsideBankLoans = outsideBankLoans,
                OutsideBankLoanItems = borrowingItems,
                ActualOutsideLiabilities = actualOutsideLiabilities,
                SurplusHeadroom = surplusHeadroom,
                IsComplied = isComplied,
                ExcludedReserves = excludedItems,
                UsedInMemoryAutoSuggestions = usedAutoSuggestions
            };
        }
    }
}
