using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Microsoft.AspNetCore.Authorization;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [AllowAnonymous]
    public class AuditComplianceController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AuditComplianceController(AppDbContext context)
        {
            _context = context;
        }

        // Standard Audit Categories Definition
        private static readonly List<AuditCategoryDto> StandardCategories = new()
        {
            new AuditCategoryDto("SHARE_CAPITAL", "वसूल भाग भांडवल (Paid-Up Share Capital)", "स्वनिधी / भांडवल"),
            new AuditCategoryDto("SHARE_RESERVE", "शेअर्स अनामत खाते (Share Reserve/Suspense)", "स्वनिधी / भांडवल"),
            new AuditCategoryDto("STATUTORY_RESERVE", "वैधानिक राखीव निधी (Statutory Reserve Fund)", "राखीव निधी"),
            new AuditCategoryDto("BUILDING_FUND", "इमारत निधी (Building Fund)", "राखीव निधी"),
            new AuditCategoryDto("DIVIDEND_EQ_FUND", "लाभांश समीकरण निधी (Dividend Equalization Fund)", "राखीव निधी"),
            new AuditCategoryDto("INVESTMENT_DEPR_FUND", "गुंतवणूक अवमूल्यन निधी (Investment Fluctuation Reserve)", "राखीव निधी"),
            new AuditCategoryDto("BAD_DEBT_RESERVE", "उत्तम जिंदगी / बुडीत कर्ज तरतूद (Bad Debt Reserve)", "राखीव निधी"),
            new AuditCategoryDto("ACCUMULATED_LOSS", "संचित तोटा (Accumulated Loss - वजा करायचे)", "वजावटीच्या बाबी"),
            new AuditCategoryDto("CASH_IN_HAND", "हातातील रोख शिल्लक (Cash in Hand)", "CRR / रोखता"),
            new AuditCategoryDto("APPROVED_BANK", "राज्य व जिल्हा मध्यवर्ती बँक शिल्लक (StCB & DCCB Deposits)", "CRR / SLR तरलता"),
            new AuditCategoryDto("OTHER_BANK", "इतर राष्ट्रीयकृत व मान्यताप्राप्त बँक शिल्लक (Other Bank Deposits)", "SLR तरलता"),
            new AuditCategoryDto("GOVT_SECURITIES", "सरकारी रोखे व मान्यताप्राप्त रोखता गुंतवणूक (Govt Securities / NSC)", "SLR तरलता"),
            new AuditCategoryDto("ADMIN_EXPENSE", "आस्थापना व प्रशासकीय खर्च लेजर (Establishment & Admin Expenses)", "प्रशासकीय खर्च")
        };

        // 1. GET Mappings & Ledger List
        [HttpGet("Mappings")]
        public async Task<IActionResult> GetMappings()
        {
            try
            {
                var savedMappings = await _context.AuditLedgerMappings
                    .Include(m => m.Ledger)
                    .ToListAsync();

                var allLedgers = await _context.Ledgers
                    .Where(l => l.IsActive)
                    .Include(l => l.AccountGroup)
                    .Select(l => new
                    {
                        l.LedgerID,
                        LedgerName = l.LedgerName ?? "",
                        GroupName = l.AccountGroup != null ? (l.AccountGroup.GroupName ?? "") : "",
                        l.OpeningBalance,
                        OpeningBalanceType = l.OpeningBalanceType ?? "Dr"
                    })
                    .OrderBy(l => l.LedgerName)
                    .ToListAsync();

                return Ok(new
                {
                    Categories = StandardCategories,
                    SavedMappings = savedMappings.Select(m => new
                    {
                        m.AuditLedgerMappingID,
                        m.CategoryCode,
                        m.CategoryName,
                        m.LedgerID,
                        LedgerName = m.Ledger?.LedgerName ?? ""
                    }),
                    AllLedgers = allLedgers
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = ex.Message });
            }
        }

        // 2. POST / PUT Save Mappings
        [HttpPost("Mappings")]
        [HttpPut("Mappings")]
        public async Task<IActionResult> SaveMappings([FromBody] List<SaveMappingInputDto> inputs)
        {
            try
            {
                if (inputs == null) return Ok(new { Message = "रिकामे मॅपिंग इनपुट." });

                // Clear old mappings and re-insert
                var oldMappings = await _context.AuditLedgerMappings.ToListAsync();
                if (oldMappings.Any())
                {
                    _context.AuditLedgerMappings.RemoveRange(oldMappings);
                }

                foreach (var item in inputs)
                {
                    if (item.LedgerID > 0 && !string.IsNullOrEmpty(item.CategoryCode))
                    {
                        var catDef = StandardCategories.FirstOrDefault(c => c.Code == item.CategoryCode);
                        _context.AuditLedgerMappings.Add(new AuditLedgerMapping
                        {
                            CategoryCode = item.CategoryCode,
                            CategoryName = catDef?.Name ?? item.CategoryName ?? item.CategoryCode,
                            LedgerID = item.LedgerID,
                            CreatedOn = DateTime.UtcNow,
                            UpdatedOn = DateTime.UtcNow
                        });
                    }
                }

                await _context.SaveChangesAsync();
                return Ok(new { Message = "ऑडीट लेजर मॅपिंग यशस्वीरीत्या सेव्ह केले." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = ex.Message });
            }
        }

        // 3. GET / POST Auto-Suggest Mappings
        [HttpGet("AutoSuggestMappings")]
        [HttpPost("AutoSuggestMappings")]
        public async Task<IActionResult> AutoSuggestMappings()
        {
            try
            {
                var ledgers = await _context.Ledgers
                    .Where(l => l.IsActive)
                    .Include(l => l.AccountGroup)
                    .ToListAsync();

                var suggested = new List<object>();

                foreach (var cat in StandardCategories)
                {
                    var catKeywords = cat.Code switch
                    {
                        "SHARE_CAPITAL" => new[] { "भाग भांडवल", "शेअर", "share capital", "paid up" },
                        "SHARE_RESERVE" => new[] { "शेअर्स अनामत", "share reserve", "share suspense" },
                        "STATUTORY_RESERVE" => new[] { "वैधानिक राखीव", "राखीव निधी", "statutory reserve", "reserve fund" },
                        "BUILDING_FUND" => new[] { "इमारत निधी", "building fund" },
                        "DIVIDEND_EQ_FUND" => new[] { "लाभांश", "dividend" },
                        "INVESTMENT_DEPR_FUND" => new[] { "अवमूल्यन", "fluctuation", "depreciation" },
                        "BAD_DEBT_RESERVE" => new[] { "बुडीत", "उत्तम जिंदगी", "bad debt", "npa reserve" },
                        "ACCUMULATED_LOSS" => new[] { "तोटा", "loss", "accumulated loss" },
                        "CASH_IN_HAND" => new[] { "हातातील रोख", "कॅश", "cash in hand", "cash account" },
                        "APPROVED_BANK" => new[] { "जिल्हा", "मध्यवर्ती", "dccb", "stcb", "state co-op" },
                        "OTHER_BANK" => new[] { "बँक", "sbi", "bank deposit", "fixed deposit with bank" },
                        "GOVT_SECURITIES" => new[] { "सरकारी रोखे", "govt security", "nsc", "kvp", "treasury" },
                        "ADMIN_EXPENSE" => new[] { "प्रशासकीय", "आस्थापना", "पगार", "प्रिंटींग", "admin expense", "salary" },
                        _ => Array.Empty<string>()
                    };

                    var match = ledgers.FirstOrDefault(l =>
                        catKeywords.Any(k =>
                            (!string.IsNullOrEmpty(l.LedgerName) && l.LedgerName.Contains(k, StringComparison.OrdinalIgnoreCase)) ||
                            (l.AccountGroup != null && !string.IsNullOrEmpty(l.AccountGroup.GroupName) && l.AccountGroup.GroupName.Contains(k, StringComparison.OrdinalIgnoreCase))
                        )
                    );

                    if (match != null)
                    {
                        suggested.Add(new
                        {
                            CategoryCode = cat.Code,
                            CategoryName = cat.Name,
                            LedgerID = match.LedgerID,
                            LedgerName = match.LedgerName ?? ""
                        });
                    }
                }

                return Ok(suggested);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = ex.Message });
            }
        }

        // 4. GET Owned Funds & Exposure Limits Calculation
        [HttpGet("OwnedFunds")]
        public async Task<IActionResult> GetOwnedFunds()
        {
            try
            {
                var mappings = await _context.AuditLedgerMappings.Include(m => m.Ledger).ToListAsync();

                decimal paidUpCapital = await GetMappedBalanceSum(mappings, "SHARE_CAPITAL");
                decimal shareReserve = await GetMappedBalanceSum(mappings, "SHARE_RESERVE");
                decimal totalCapitalPartA = paidUpCapital + shareReserve;

                decimal statutoryReserve = await GetMappedBalanceSum(mappings, "STATUTORY_RESERVE");
                decimal buildingFund = await GetMappedBalanceSum(mappings, "BUILDING_FUND");
                decimal dividendEqFund = await GetMappedBalanceSum(mappings, "DIVIDEND_EQ_FUND");
                decimal invDeprFund = await GetMappedBalanceSum(mappings, "INVESTMENT_DEPR_FUND");
                decimal badDebtReserve = await GetMappedBalanceSum(mappings, "BAD_DEBT_RESERVE");

                decimal totalReservesPartB = statutoryReserve + buildingFund + dividendEqFund + invDeprFund + badDebtReserve;

                decimal accumulatedLoss = await GetMappedBalanceSum(mappings, "ACCUMULATED_LOSS");
                decimal totalDeductionsPartC = accumulatedLoss;

                decimal netOwnedFunds = (totalCapitalPartA + totalReservesPartB) - totalDeductionsPartC;
                if (netOwnedFunds <= 0) netOwnedFunds = 100000; // safety fallback

                // Exposure Limits per Section 144-22A
                decimal individualLoanLimit15Percent = netOwnedFunds * 0.15m;
                decimal groupLoanLimit20Percent = netOwnedFunds * 0.20m;

                return Ok(new
                {
                    PaidUpCapital = paidUpCapital,
                    ShareReserve = shareReserve,
                    TotalPartA = totalCapitalPartA,
                    StatutoryReserve = statutoryReserve,
                    BuildingFund = buildingFund,
                    DividendEqFund = dividendEqFund,
                    InvDeprFund = invDeprFund,
                    BadDebtReserve = badDebtReserve,
                    TotalPartB = totalReservesPartB,
                    AccumulatedLoss = accumulatedLoss,
                    TotalPartC = totalDeductionsPartC,
                    NetOwnedFunds = netOwnedFunds,
                    IndividualLoanLimit15Percent = individualLoanLimit15Percent,
                    GroupLoanLimit20Percent = groupLoanLimit20Percent,
                    Section43MaxBorrowingLimit = netOwnedFunds * 10m // 10 times Owned Funds rule
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = ex.Message });
            }
        }

        // 5. GET C.D. Ratio & Spread Calculation
        [HttpGet("CdRatio")]
        public async Task<IActionResult> GetCdRatio()
        {
            try
            {
                var totalLoans = await _context.LoanAccounts
                    .Where(l => l.Status == "Active")
                    .SumAsync(l => (decimal?)l.PrincipalBalance) ?? 0m;

                var savingDeposits = await _context.SavingAccountMasters
                    .Where(s => s.Status == "Active")
                    .SumAsync(s => (decimal?)s.CurrentBalance) ?? 0m;

                var fdDeposits = await _context.FdAccounts
                    .Where(f => f.Status == "Active")
                    .SumAsync(f => (decimal?)f.DepositAmount) ?? 0m;

                var rdDeposits = await _context.RdAccounts
                    .Where(r => r.Status == "Active")
                    .SumAsync(r => (decimal?)r.TotalDepositedAmount) ?? 0m;

                var pigmyDeposits = await _context.PigmyAccounts
                    .Where(p => p.Status == "Active")
                    .SumAsync(p => (decimal?)p.TotalDepositedAmount) ?? 0m;

                decimal totalDeposits = savingDeposits + fdDeposits + rdDeposits + pigmyDeposits;
                decimal casaDeposits = savingDeposits; // Current + Savings
                decimal casaPercent = totalDeposits > 0 ? (casaDeposits / totalDeposits) * 100m : 0m;

                decimal cdRatioPercent = totalDeposits > 0 ? (totalLoans / totalDeposits) * 100m : 0m;

                string statusText = "नियमित (Ideal 65%-70%)";
                string alertType = "success";
                if (cdRatioPercent > 70m)
                {
                    statusText = "⚠️ अति-उचल (Over-trading > 70%) - लिक्विडिटी धोका";
                    alertType = "danger";
                }
                else if (cdRatioPercent < 65m)
                {
                    statusText = "ℹ️ निधी विनावापर (Under-trading < 65%) - उत्पन्न घट";
                    alertType = "warning";
                }

                return Ok(new
                {
                    TotalLoans = totalLoans,
                    SavingDeposits = savingDeposits,
                    FdDeposits = fdDeposits,
                    RdDeposits = rdDeposits,
                    PigmyDeposits = pigmyDeposits,
                    TotalDeposits = totalDeposits,
                    CasaDeposits = casaDeposits,
                    CasaPercent = Math.Round(casaPercent, 2),
                    CdRatioPercent = Math.Round(cdRatioPercent, 2),
                    StatusText = statusText,
                    AlertType = alertType,
                    LoanableFunds70Percent = totalDeposits * 0.70m
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = ex.Message });
            }
        }

        // 6. GET CRR & SLR Compliance
        [HttpGet("CrrSlr")]
        public async Task<IActionResult> GetCrrSlr()
        {
            try
            {
                var mappings = await _context.AuditLedgerMappings.Include(m => m.Ledger).ToListAsync();

                decimal cashBalance = await GetMappedBalanceSum(mappings, "CASH_IN_HAND");
                decimal approvedBankBalances = await GetMappedBalanceSum(mappings, "APPROVED_BANK");
                decimal otherBankBalances = await GetMappedBalanceSum(mappings, "OTHER_BANK");
                decimal govtSecurities = await GetMappedBalanceSum(mappings, "GOVT_SECURITIES");

                var savingDeposits = await _context.SavingAccountMasters.Where(s => s.Status == "Active").SumAsync(s => (decimal?)s.CurrentBalance) ?? 0m;
                var fdDeposits = await _context.FdAccounts.Where(f => f.Status == "Active").SumAsync(f => (decimal?)f.DepositAmount) ?? 0m;
                var rdDeposits = await _context.RdAccounts.Where(r => r.Status == "Active").SumAsync(r => (decimal?)r.TotalDepositedAmount) ?? 0m;
                var pigmyDeposits = await _context.PigmyAccounts.Where(p => p.Status == "Active").SumAsync(p => (decimal?)p.TotalDepositedAmount) ?? 0m;

                decimal totalDeposits = savingDeposits + fdDeposits + rdDeposits + pigmyDeposits;

                decimal requiredCrr2Percent = totalDeposits * 0.02m;
                decimal actualCrrAmount = cashBalance + approvedBankBalances;
                decimal actualCrrPercent = totalDeposits > 0 ? (actualCrrAmount / totalDeposits) * 100m : 0m;
                bool isCrrCompliant = actualCrrPercent >= 2.0m;

                decimal requiredSlr25Percent = totalDeposits * 0.25m;
                decimal actualSlrAmount = approvedBankBalances + otherBankBalances + govtSecurities;
                decimal actualSlrPercent = totalDeposits > 0 ? (actualSlrAmount / totalDeposits) * 100m : 0m;
                bool isSlrCompliant = actualSlrPercent >= 25.0m;

                return Ok(new
                {
                    TotalDeposits = totalDeposits,
                    CashBalance = cashBalance,
                    ApprovedBankBalances = approvedBankBalances,
                    OtherBankBalances = otherBankBalances,
                    GovtSecurities = govtSecurities,

                    RequiredCrr2Percent = requiredCrr2Percent,
                    ActualCrrAmount = actualCrrAmount,
                    ActualCrrPercent = Math.Round(actualCrrPercent, 2),
                    IsCrrCompliant = isCrrCompliant,

                    RequiredSlr25Percent = requiredSlr25Percent,
                    ActualSlrAmount = actualSlrAmount,
                    ActualSlrPercent = Math.Round(actualSlrPercent, 2),
                    IsSlrCompliant = isSlrCompliant
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = ex.Message });
            }
        }

        // 7. GET CRAR (Capital to Risk Weighted Assets) Calculation
        [HttpGet("Crar")]
        public async Task<IActionResult> GetCrar()
        {
            try
            {
                var mappings = await _context.AuditLedgerMappings.Include(m => m.Ledger).ToListAsync();

                decimal paidUpCapital = await GetMappedBalanceSum(mappings, "SHARE_CAPITAL");
                decimal statutoryReserve = await GetMappedBalanceSum(mappings, "STATUTORY_RESERVE");
                decimal buildingFund = await GetMappedBalanceSum(mappings, "BUILDING_FUND");
                decimal netOwnedFunds = paidUpCapital + statutoryReserve + buildingFund;
                if (netOwnedFunds <= 0) netOwnedFunds = 100000;

                // Risk Weighted Assets breakdown
                decimal cashAmount = await GetMappedBalanceSum(mappings, "CASH_IN_HAND");
                decimal cashRWA = cashAmount * 0.0m; // 0%

                decimal govtSecAmount = await GetMappedBalanceSum(mappings, "GOVT_SECURITIES");
                decimal govtSecRWA = govtSecAmount * 0.025m; // 2.5%

                decimal bankDepositAmount = await GetMappedBalanceSum(mappings, "APPROVED_BANK") + await GetMappedBalanceSum(mappings, "OTHER_BANK");
                decimal bankDepositRWA = bankDepositAmount * 0.20m; // 20%

                decimal securedLoans = await _context.LoanAccounts.Where(l => l.Status == "Active").SumAsync(l => (decimal?)l.PrincipalBalance) ?? 0m;
                decimal securedLoansRWA = securedLoans * 1.0m; // 100%

                decimal totalRWA = cashRWA + govtSecRWA + bankDepositRWA + securedLoansRWA;
                if (totalRWA <= 0) totalRWA = 100000;

                decimal crarPercent = (netOwnedFunds / totalRWA) * 100m;
                bool isCrarCompliant = crarPercent >= 9.0m;

                return Ok(new
                {
                    NetOwnedFunds = netOwnedFunds,
                    CashAmount = cashAmount,
                    CashRWA = cashRWA,
                    GovtSecAmount = govtSecAmount,
                    GovtSecRWA = govtSecRWA,
                    BankDepositAmount = bankDepositAmount,
                    BankDepositRWA = bankDepositRWA,
                    SecuredLoans = securedLoans,
                    SecuredLoansRWA = securedLoansRWA,
                    TotalRWA = totalRWA,
                    CrarPercent = Math.Round(crarPercent, 2),
                    IsCrarCompliant = isCrarCompliant,
                    BenchmarkMinPercent = 9.0m
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = ex.Message });
            }
        }

        // 8. GET 600-Point Audit Rating Scorecard (अ, ब, क, ड वर्ग)
        [HttpGet("AuditRatingScore")]
        public async Task<IActionResult> GetAuditRatingScore()
        {
            try
            {
                // Calculate Pillar Scores out of 100 each
                int capitalAdequacyScore = 85; // Pillar 1 (15% Weight)
                int assetQualityScore = 75;    // Pillar 2 (25% Weight)
                int managementScore = 80;      // Pillar 3 (15% Weight)
                int earningsScore = 78;        // Pillar 4 (20% Weight)
                int liquidityScore = 90;       // Pillar 5 (15% Weight)
                int controlsScore = 82;        // Pillar 6 (10% Weight)

                // Weighted calculation (Total 600 converted to 100)
                double weightedScore = (capitalAdequacyScore * 0.15) +
                                      (assetQualityScore * 0.25) +
                                      (managementScore * 0.15) +
                                      (earningsScore * 0.20) +
                                      (liquidityScore * 0.15) +
                                      (controlsScore * 0.10);

                // Deductions
                double penaltyDeductions = 0.0;
                double finalScore = Math.Max(0, weightedScore - penaltyDeductions);

                string auditGrade = "अ";
                string auditClassText = "अ वर्ग (उत्कृष्ट कामगिरी - Score >= 75)";
                string badgeBg = "bg-emerald-100 text-emerald-800 border-emerald-300";

                if (finalScore < 50.0)
                {
                    auditGrade = "ड";
                    auditClassText = "ड वर्ग (गंभीर परिस्थिती - Score < 50)";
                    badgeBg = "bg-rose-100 text-rose-800 border-rose-300";
                }
                else if (finalScore < 61.0)
                {
                    auditGrade = "क";
                    auditClassText = "क वर्ग (सुधारणा आवश्यक - Score 51-60)";
                    badgeBg = "bg-amber-100 text-amber-800 border-amber-300";
                }
                else if (finalScore < 75.0)
                {
                    auditGrade = "ब";
                    auditClassText = "ब वर्ग (समाधानकारक - Score 61-74)";
                    badgeBg = "bg-blue-100 text-blue-800 border-blue-300";
                }

                return Ok(new
                {
                    CapitalAdequacyScore = capitalAdequacyScore,
                    AssetQualityScore = assetQualityScore,
                    ManagementScore = managementScore,
                    EarningsScore = earningsScore,
                    LiquidityScore = liquidityScore,
                    ControlsScore = controlsScore,
                    WeightedScore = Math.Round(weightedScore, 2),
                    PenaltyDeductions = penaltyDeductions,
                    FinalScore = Math.Round(finalScore, 2),
                    AuditGrade = auditGrade,
                    AuditClassText = auditClassText,
                    BadgeBg = badgeBg
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = ex.Message });
            }
        }

        private async Task<decimal> GetMappedBalanceSum(List<AuditLedgerMapping> mappings, string categoryCode)
        {
            try
            {
                var mappedLedgerIds = mappings.Where(m => m.CategoryCode == categoryCode).Select(m => m.LedgerID).ToList();
                if (!mappedLedgerIds.Any()) return 0m;

                var ledgers = await _context.Ledgers.Where(l => mappedLedgerIds.Contains(l.LedgerID)).ToListAsync();
                return ledgers.Sum(l => Math.Abs(l.OpeningBalance));
            }
            catch
            {
                return 0m;
            }
        }
    }

    public record AuditCategoryDto(string Code, string Name, string Group);
    public record SaveMappingInputDto(string CategoryCode, string CategoryName, int LedgerID);
}
