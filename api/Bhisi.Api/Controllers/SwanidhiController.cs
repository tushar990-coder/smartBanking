using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Helpers;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [EnforceBranchScope]
    public class SwanidhiController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SwanidhiController(AppDbContext context)
        {
            _context = context;
        }

        private bool IsHeadOfficeConfigRole()
        {
            return User.IsHeadOfficeAdmin() ||
                   User?.IsInRole("SuperAdmin") == true ||
                   User?.IsInRole("Super Admin") == true ||
                   User?.IsInRole("Admin") == true ||
                   User?.IsInRole("SystemAdmin") == true ||
                   User?.IsInRole("HeadOffice") == true ||
                   User?.IsInRole("HO_Manager") == true ||
                   User?.IsInRole("HO Manager") == true;
        }

        private (int UserId, string Username) ResolveActor()
        {
            int userId = 1;
            var idClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(idClaim, out int parsed) && parsed > 0)
            {
                userId = parsed;
            }
            string username = User?.Identity?.Name ?? $"User_{userId}";
            return (userId, username);
        }

        // 1. GET: api/Swanidhi/Config (Strictly Read-Only — Zero DB Mutations)
        [HttpGet("Config")]
        public async Task<IActionResult> GetConfig([FromQuery] int? branchId, [FromQuery] DateTime? asOnDate = null)
        {
            try
            {
                int? scopedBranch = User.ResolveOptionalBranchId(branchId > 0 ? branchId : null);
                int settingBranchId = scopedBranch ?? 1;
                DateTime targetDate = asOnDate?.Date ?? DateTime.Today;

                var savedMappings = await _context.SwanidhiLedgerMappings.AsNoTracking()
                    .Include(m => m.Ledger).ThenInclude(l => l!.AccountGroup)
                    .ToListAsync();

                bool isAutoSuggestedPreview = false;
                List<SwanidhiLedgerMapping> effectiveMappings;
                if (savedMappings.Count > 0)
                {
                    effectiveMappings = savedMappings
                        .GroupBy(m => m.LedgerID)
                        .Select(g => g.OrderByDescending(x => x.UpdatedOn).First())
                        .ToList();
                }
                else
                {
                    effectiveMappings = await SwanidhiCalculationHelper.BuildSuggestedMappingsAsync(_context);
                    isAutoSuggestedPreview = true;
                }

                var setting = await _context.SwanidhiSettings.AsNoTracking()
                    .FirstOrDefaultAsync(s => s.BranchID == settingBranchId)
                    ?? await _context.SwanidhiSettings.AsNoTracking()
                        .OrderBy(s => s.BranchID)
                        .FirstOrDefaultAsync()
                    ?? new SwanidhiSetting
                    {
                        BranchID = settingBranchId,
                        BorrowingLimitMultiplier = 10.0m,
                        Year1DividendRate = 9.0m,
                        Year2DividendRate = 9.0m,
                        Year3DividendRate = 9.0m,
                        UpdatedOn = DateTime.UtcNow
                    };

                var allGroups = await _context.AccountGroups.AsNoTracking().ToListAsync();
                var activeLedgers = await _context.Ledgers.AsNoTracking()
                    .Where(l => l.IsActive)
                    .Include(l => l.AccountGroup)
                    .OrderBy(l => l.AccountGroup != null ? l.AccountGroup.GroupName : "")
                    .ThenBy(l => l.LedgerName)
                    .ToListAsync();

                var allLedgerIds = activeLedgers.Select(l => l.LedgerID).ToList();
                var asOfNetDr = await BranchLedgerBalanceHelper.GetAsOfLedgerBalancesAsync(
                    _context,
                    allLedgerIds,
                    targetDate,
                    scopedBranch,
                    approvedOnly: true);

                var allLedgers = activeLedgers.Select(l =>
                {
                    decimal netDr = asOfNetDr.TryGetValue(l.LedgerID, out var v) ? v : 0m;
                    string rootNature = BranchLedgerBalanceHelper.ResolveGroupRootNature(l.GroupID, allGroups);
                    return new
                    {
                        l.LedgerID,
                        LedgerName = l.LedgerName ?? "",
                        LedgerCode = l.LedgerCode ?? "",
                        GroupName = l.AccountGroup != null ? (l.AccountGroup.GroupName ?? "") : "",
                        Nature = rootNature,
                        l.ExcludeFromRule35Swanidhi,
                        AsOfBalance = Math.Abs(netDr),
                        AsOfBalanceType = netDr >= 0m ? "Dr" : "Cr",
                        OpeningBalance = Math.Abs(netDr),
                        OpeningBalanceType = netDr >= 0m ? "Dr" : "Cr"
                    };
                }).ToList();

                return Ok(new
                {
                    CanEditConfig = IsHeadOfficeConfigRole(),
                    IsAutoSuggestedPreview = isAutoSuggestedPreview,
                    Categories = SwanidhiCalculationHelper.StandardCategories.Select(c => new
                    {
                        c.CategoryCode,
                        c.CategoryName,
                        Type = c.CategoryType,
                        c.CategoryType,
                        c.Description
                    }),
                    SavedMappings = effectiveMappings.Select(m => new
                    {
                        m.MappingID,
                        m.CategoryCode,
                        m.CategoryName,
                        m.LedgerID,
                        LedgerName = m.Ledger?.LedgerName ?? "",
                        LedgerCode = m.Ledger?.LedgerCode ?? "",
                        GroupName = m.Ledger?.AccountGroup?.GroupName ?? ""
                    }),
                    AllLedgers = allLedgers,
                    Setting = new
                    {
                        setting.SettingID,
                        setting.BranchID,
                        setting.BorrowingLimitMultiplier,
                        setting.Year1DividendRate,
                        setting.Year2DividendRate,
                        setting.Year3DividendRate,
                        setting.AverageDividendRate,
                        setting.ManualCertifiedNetProfit
                    }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "कॉन्फिगरेशन लोड करताना त्रुटी: " + ex.Message });
            }
        }

        // 2. POST: api/Swanidhi/Config (HO/Admin Restricted + Validation + AuditLog)
        [HttpPost("Config")]
        [Authorize(Roles = "SuperAdmin,Admin,SystemAdmin,HeadOffice,HO_Manager")]
        public async Task<IActionResult> SaveConfig([FromBody] SaveSwanidhiConfigDto dto)
        {
            if (dto == null) return BadRequest("माहिती उपलब्ध नाही.");

            if (dto.BorrowingLimitMultiplier <= 0m || dto.BorrowingLimitMultiplier > 25m)
            {
                return BadRequest("कमाल उचल मर्यादा गुणक ० पेक्षा जास्त व २५ पेक्षा कमी असणे आवश्यक आहे.");
            }
            if (dto.Year1DividendRate < 0m || dto.Year1DividendRate > 100m ||
                dto.Year2DividendRate < 0m || dto.Year2DividendRate > 100m ||
                dto.Year3DividendRate < 0m || dto.Year3DividendRate > 100m)
            {
                return BadRequest("लाभांश दर ०% ते १००% दरम्यान असणे आवश्यक आहे.");
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                int? scopedBranch = User.ResolveOptionalBranchId(dto.BranchID > 0 ? dto.BranchID : null);
                int bId = scopedBranch ?? (dto.BranchID > 0 ? dto.BranchID : 1);

                var setting = await _context.SwanidhiSettings.FirstOrDefaultAsync(s => s.BranchID == bId);
                if (setting == null)
                {
                    setting = new SwanidhiSetting { BranchID = bId };
                    _context.SwanidhiSettings.Add(setting);
                }

                setting.BorrowingLimitMultiplier = dto.BorrowingLimitMultiplier;
                setting.Year1DividendRate = dto.Year1DividendRate;
                setting.Year2DividendRate = dto.Year2DividendRate;
                setting.Year3DividendRate = dto.Year3DividendRate;
                setting.ManualCertifiedNetProfit = dto.ManualCertifiedNetProfit;
                setting.UpdatedOn = DateTime.UtcNow;

                var oldMappings = await _context.SwanidhiLedgerMappings.ToListAsync();
                if (oldMappings.Count > 0)
                {
                    _context.SwanidhiLedgerMappings.RemoveRange(oldMappings);
                }

                var validCategoryCodes = SwanidhiCalculationHelper.StandardCategories
                    .Select(c => c.CategoryCode)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                var seenLedgerIds = new HashSet<int>();
                int addedCount = 0;

                if (dto.Mappings != null && dto.Mappings.Count > 0)
                {
                    foreach (var m in dto.Mappings)
                    {
                        if (m.LedgerID <= 0 || string.IsNullOrWhiteSpace(m.CategoryCode)) continue;
                        if (!validCategoryCodes.Contains(m.CategoryCode)) continue;
                        if (!seenLedgerIds.Add(m.LedgerID)) continue; // Strictly 1 mapping per LedgerID

                        var cat = SwanidhiCalculationHelper.StandardCategories
                            .First(c => string.Equals(c.CategoryCode, m.CategoryCode, StringComparison.OrdinalIgnoreCase));

                        _context.SwanidhiLedgerMappings.Add(new SwanidhiLedgerMapping
                        {
                            CategoryCode = cat.CategoryCode,
                            CategoryName = cat.CategoryName,
                            LedgerID = m.LedgerID,
                            CreatedOn = DateTime.UtcNow,
                            UpdatedOn = DateTime.UtcNow
                        });
                        addedCount++;
                    }
                }

                var (actorId, actorName) = ResolveActor();
                _context.AuditLogs.Add(new AuditLog
                {
                    UserID = actorId,
                    Username = actorName,
                    Action = "SWANIDHI_CONFIG_UPDATE",
                    EntityName = "SwanidhiSettings",
                    EntityID = bId.ToString(),
                    Timestamp = DateTime.Now,
                    Details = $"Rule 35 Config Updated | Branch={bId} | Multiplier={setting.BorrowingLimitMultiplier}x | DivRates=({setting.Year1DividendRate}%, {setting.Year2DividendRate}%, {setting.Year3DividendRate}%) Avg={setting.AverageDividendRate}% | ManualProfit={(setting.ManualCertifiedNetProfit.HasValue ? setting.ManualCertifiedNetProfit.Value.ToString("N2") : "Auto")} | MappedLedgers={addedCount}"
                });

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { message = "स्वनिधी डायनॅमिक लेजर मॅपिंग व नियम यशस्वीरीत्या सेव्ह झाले!", mappedCount = addedCount });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "मॅपिंग सेव्ह करताना त्रुटी आली: " + ex.Message });
            }
        }

        // 3. POST: api/Swanidhi/AutoMap (HO/Admin Restricted + Safe Precedence + AuditLog)
        [HttpPost("AutoMap")]
        [Authorize(Roles = "SuperAdmin,Admin,SystemAdmin,HeadOffice,HO_Manager")]
        public async Task<IActionResult> RunAutoMap()
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var suggested = await SwanidhiCalculationHelper.BuildSuggestedMappingsAsync(_context);

                var old = await _context.SwanidhiLedgerMappings.ToListAsync();
                if (old.Count > 0)
                {
                    _context.SwanidhiLedgerMappings.RemoveRange(old);
                }

                foreach (var m in suggested)
                {
                    _context.SwanidhiLedgerMappings.Add(new SwanidhiLedgerMapping
                    {
                        CategoryCode = m.CategoryCode,
                        CategoryName = m.CategoryName,
                        LedgerID = m.LedgerID,
                        CreatedOn = DateTime.UtcNow,
                        UpdatedOn = DateTime.UtcNow
                    });
                }

                var (actorId, actorName) = ResolveActor();
                _context.AuditLogs.Add(new AuditLog
                {
                    UserID = actorId,
                    Username = actorName,
                    Action = "SWANIDHI_AUTOMAP",
                    EntityName = "SwanidhiLedgerMappings",
                    EntityID = "ALL",
                    Timestamp = DateTime.Now,
                    Details = $"Smart Auto-Map executed with ExcludeFromRule35Swanidhi precedence. Mapped {suggested.Count} ledgers."
                });

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    message = $"यशस्वी! {suggested.Count} लेजर्स स्वनिधीच्या शासकीय हेड्सशी आपोआप मॅप करण्यात आले आहेत.",
                    mappedCount = suggested.Count
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "ऑटो-मॅपिंग अयशस्वी: " + ex.Message });
            }
        }

        // 4. GET: api/Swanidhi/Report (Official Maharashtra Circular Swanidhi Report — Strictly Read-Only)
        [HttpGet("Report")]
        public async Task<IActionResult> GetReport(
            [FromQuery] DateTime? asOnDate,
            [FromQuery] int? branchId,
            [FromQuery] decimal? customMultiplier)
        {
            try
            {
                DateTime targetDate = asOnDate?.Date ?? DateTime.Today;
                int? scopedBranch = User.ResolveOptionalBranchId(branchId > 0 ? branchId : null);

                var calc = await SwanidhiCalculationHelper.CalculateAsync(_context, targetDate, scopedBranch, customMultiplier);
                var sanstha = await _context.SansthaDetails.AsNoTracking().FirstOrDefaultAsync();

                static decimal ToLakh(decimal amt) => Math.Round(amt / 100000.0m, 2, MidpointRounding.AwayFromZero);

                string complianceStatusText = calc.NetOwnedFunds <= 0m
                    ? "⚠️ निव्वळ स्वनिधी शून्य/ऋण (उचल मर्यादा नाही)"
                    : (calc.IsComplied ? "✅ नियम ३५ चे तंतोतंत पालन (मर्यादा सुरक्षित)" : "⚠️ मर्यादा ओलांडली (तूट)");

                string complianceText = calc.IsComplied
                    ? "✅ नियम ३५ नुसार संस्था सुरक्षित असून कमाल उचल मर्यादेचे तंतोतंत पालन झालेले आहे."
                    : "⚠️ सावधान: बाह्य देणी कमाल उचल मर्यादेपेक्षा जास्त आहेत (किंवा स्वनिधी अपुरा आहे). स्वनिधी वाढवणे आवश्यक आहे.";

                string detailedComplianceNote = calc.IsComplied
                    ? $"संस्थेची प्रत्यक्ष बाह्य देणी ₹ {calc.ActualOutsideLiabilities:N2} ({ToLakh(calc.ActualOutsideLiabilities):F2} लाख) ही नियम ३५ अन्वये अनुज्ञेय कमाल मर्यादा ₹ {calc.MaxBorrowingLimit:N2} ({ToLakh(calc.MaxBorrowingLimit):F2} लाख) च्या आत मर्यादित असून, संस्थेकडे अजून ₹ {calc.SurplusHeadroom:N2} ({ToLakh(calc.SurplusHeadroom):F2} लाख) इतकी उचल मर्यादा शिल्लक आहे. सबब संस्थेने महाराष्ट्र सहकारी संस्था नियम, १९६१ मधील नियम ३५ चे तंतोतंत पालन केले असून संस्था सुरक्षित आहे."
                    : $"सावधान: संस्थेची प्रत्यक्ष बाह्य देणी ₹ {calc.ActualOutsideLiabilities:N2} ({ToLakh(calc.ActualOutsideLiabilities):F2} लाख) ही नियम ३५ अन्वये अनुज्ञेय कमाल मर्यादा ₹ {calc.MaxBorrowingLimit:N2} ({ToLakh(calc.MaxBorrowingLimit):F2} लाख) पेक्षा जास्त आहेत. संस्थेकडे ₹ {Math.Abs(calc.SurplusHeadroom):N2} ({ToLakh(Math.Abs(calc.SurplusHeadroom)):F2} लाख) इतकी मर्यादा तूट आहे. नियम ३५ चे पालन करण्यासाठी स्वनिधी वाढवणे आवश्यक आहे.";

                var borrowingCapacityObj = new
                {
                    GrossOwnedFunds = calc.GrossOwnedFunds,
                    GrossOwnedFundsInLakhs = ToLakh(calc.GrossOwnedFunds),
                    TotalDeductions = calc.TotalDeductions,
                    TotalDeductionsInLakhs = ToLakh(calc.TotalDeductions),
                    NetOwnedFunds = calc.NetOwnedFunds,
                    NetOwnedFundsInLakhs = ToLakh(calc.NetOwnedFunds),
                    Multiplier = calc.Multiplier,
                    ConfiguredMultiplier = calc.ConfiguredMultiplier,
                    IsMultiplierSimulated = calc.IsMultiplierSimulated,
                    MaxBorrowingLimit = calc.MaxBorrowingLimit,
                    MaxBorrowingLimitInLakhs = ToLakh(calc.MaxBorrowingLimit),
                    SavingBalance = calc.SavingBalance,
                    SavingBalanceInLakhs = ToLakh(calc.SavingBalance),
                    SavingGlBalance = calc.SavingGlBalance,
                    SavingGlVariance = Math.Round(calc.SavingBalance - calc.SavingGlBalance, 2),
                    FdBalance = calc.FdBalance,
                    FdBalanceInLakhs = ToLakh(calc.FdBalance),
                    RdBalance = calc.RdBalance,
                    RdBalanceInLakhs = ToLakh(calc.RdBalance),
                    PigmyBalance = calc.PigmyBalance,
                    PigmyBalanceInLakhs = ToLakh(calc.PigmyBalance),
                    PigmyGlBalance = calc.PigmyGlBalance,
                    PigmyGlVariance = Math.Round(calc.PigmyBalance - calc.PigmyGlBalance, 2),
                    OutsideBankLoans = calc.OutsideBankLoans,
                    OutsideBankLoansInLakhs = ToLakh(calc.OutsideBankLoans),
                    OutsideBankLoanItems = calc.OutsideBankLoanItems,
                    ActualOutsideLiabilities = calc.ActualOutsideLiabilities,
                    ActualOutsideLiabilitiesInLakhs = ToLakh(calc.ActualOutsideLiabilities),
                    SurplusHeadroom = calc.SurplusHeadroom,
                    SurplusHeadroomInLakhs = ToLakh(calc.SurplusHeadroom),
                    IsComplied = calc.IsComplied,
                    ComplianceStatusText = complianceStatusText,
                    ComplianceText = complianceText,
                    DetailedComplianceNote = detailedComplianceNote
                };

                var divCalcObj = new
                {
                    Year1DividendRate = calc.Year1DividendRate,
                    Year2DividendRate = calc.Year2DividendRate,
                    Year3DividendRate = calc.Year3DividendRate,
                    AverageDividendRate = calc.AverageDividendRate,
                    UsedManualCertifiedNetProfit = calc.UsedManualCertifiedNetProfit,
                    CertifiedNetProfit = calc.CertifiedNetProfit,
                    CurrentYearNetLoss = calc.CurrentYearNetLoss,
                    EstimatedDividendAmount = calc.ProposedDividendAmount,
                    SurplusProfitInOwnedFunds = calc.UndistributedNetProfit,
                    Year1Rate = calc.Year1DividendRate,
                    Year2Rate = calc.Year2DividendRate,
                    Year3Rate = calc.Year3DividendRate,
                    AverageRate = calc.AverageDividendRate,
                    ProposedDividendAmount = calc.ProposedDividendAmount,
                    SurplusNetProfit = calc.UndistributedNetProfit
                };

                var deductionsList = new List<object>
                {
                    new
                    {
                        SrNo = "१.",
                        Particular = "संचित तोटा (Accumulated Losses)",
                        Reference = "ताळेबंद तोटा",
                        AmountInRupees = calc.AccumulatedLoss,
                        AmountInLakhs = ToLakh(calc.AccumulatedLoss),
                        Items = calc.AccumulatedLossItems
                    }
                };

                if (calc.CurrentYearNetLoss > 0m)
                {
                    deductionsList.Add(new
                    {
                        SrNo = "२.",
                        Particular = "चालू वर्षाचा निव्वळ तोटा (Current Year Net Loss)",
                        Reference = calc.UsedManualCertifiedNetProfit ? "प्रमाणित तोटा" : "नफा-तोटा पत्रकानुसार",
                        AmountInRupees = calc.CurrentYearNetLoss,
                        AmountInLakhs = ToLakh(calc.CurrentYearNetLoss),
                        Items = new List<SwanidhiLedgerBalanceItem>()
                    });
                }

                var rowsList = new List<object>
                {
                    new
                    {
                        SrNo = "१.",
                        Particular = "वसूल भाग भांडवल",
                        Reference = "नियमित सभासद भाग भांडवल",
                        AmountInRupees = calc.PaidUpCapital,
                        AmountInLakhs = ToLakh(calc.PaidUpCapital),
                        Items = calc.PaidUpCapitalItems
                    },
                    new
                    {
                        SrNo = "२.",
                        Particular = "राखीव निधी",
                        Reference = "कलम ६६ प्रमाणे २५%",
                        AmountInRupees = calc.StatutoryReserve,
                        AmountInLakhs = ToLakh(calc.StatutoryReserve),
                        Items = calc.StatutoryReserveItems
                    },
                    new
                    {
                        SrNo = "३.",
                        Particular = "इमारत निधी",
                        Reference = "नफ्यातून निर्मित",
                        AmountInRupees = calc.BuildingFund,
                        AmountInLakhs = ToLakh(calc.BuildingFund),
                        Items = calc.BuildingFundItems
                    },
                    new
                    {
                        SrNo = "४.",
                        Particular = "मुक्त व विकास निधी",
                        Reference = "(स्पष्टीकरण-१ पाहणे)",
                        AmountInRupees = calc.FreeReserves,
                        AmountInLakhs = ToLakh(calc.FreeReserves),
                        Items = calc.FreeReservesItems
                    },
                    new
                    {
                        SrNo = "५.",
                        Particular = "उत्तम जिंदगी तरतूद (ताळेबंदातील प्रत्यक्ष तरतूद)",
                        Reference = calc.StandardAssetProvision > 0m
                            ? "प्रत्यक्ष ०.४०% सामान्य तरतूद"
                            : $"प्रत्यक्ष तरतूद नाही (संदर्भ ०.४०%: ₹ {calc.EstimatedStandardAssetProvisionRef:N2})",
                        AmountInRupees = calc.StandardAssetProvision,
                        AmountInLakhs = ToLakh(calc.StandardAssetProvision),
                        Items = calc.StandardAssetProvisionItems
                    },
                    new
                    {
                        SrNo = "६.",
                        Particular = "शिल्लक निव्वळ नफा",
                        Reference = "(स्पष्टीकरण-२ पाहणे)",
                        AmountInRupees = calc.UndistributedNetProfit,
                        AmountInLakhs = ToLakh(calc.UndistributedNetProfit),
                        Items = new List<object>
                        {
                            new { Label = calc.UsedManualCertifiedNetProfit ? "प्रमाणित निव्वळ नफा (Manual)" : "नफा-तोटा पत्रकावरील निव्वळ नफा", Amount = calc.CertifiedNetProfit },
                            new { Label = $"मागील ३ वर्षांची लाभांश सरासरी ({calc.AverageDividendRate}%)", Amount = calc.ProposedDividendAmount },
                            new { Label = "शिल्लक उर्वरित नफा (स्वनिधीत ग्राह्य)", Amount = calc.UndistributedNetProfit }
                        }
                    },
                    new
                    {
                        SrNo = "",
                        Particular = "एकूण - (अ) सकल स्वनिधी (Gross Owned Funds)",
                        Reference = "",
                        AmountInRupees = calc.GrossOwnedFunds,
                        AmountInLakhs = ToLakh(calc.GrossOwnedFunds),
                        IsTotal = true,
                        Items = (object)null!
                    },
                    new
                    {
                        SrNo = "ब)",
                        Particular = "वजा: संचित तोटा व चालू वर्षाचा तोटा (Accumulated & Current Losses)",
                        Reference = "ताळेबंद / नफा-तोटा",
                        AmountInRupees = calc.TotalDeductions,
                        AmountInLakhs = ToLakh(calc.TotalDeductions),
                        IsDeduction = true,
                        Items = calc.AccumulatedLossItems
                    },
                    new
                    {
                        SrNo = "",
                        Particular = "एकूण - (ब) एकूण वजावटी (Total Deductions)",
                        Reference = "",
                        AmountInRupees = calc.TotalDeductions,
                        AmountInLakhs = ToLakh(calc.TotalDeductions),
                        IsTotal = true,
                        Items = (object)null!
                    },
                    new
                    {
                        SrNo = "क)",
                        Particular = "एकूण - निव्वळ स्वनिधी (Net Owned Funds / Swanidhi) [अ - ब]",
                        Reference = "",
                        AmountInRupees = calc.NetOwnedFunds,
                        AmountInLakhs = ToLakh(calc.NetOwnedFunds),
                        IsGrandTotal = true,
                        Items = (object)null!
                    }
                };

                var response = new
                {
                    Sanstha = new
                    {
                        SansthaName = sanstha?.SansthaName ?? "सहकारी पतसंस्था मर्यादित",
                        RegistrationNo = sanstha?.RegistrationNo ?? "",
                        RegistrationDate = sanstha?.RegistrationDate != null ? sanstha.RegistrationDate.Value.ToString("dd/MM/yyyy") : "",
                        Address = sanstha?.Address ?? "",
                        Village = sanstha?.Village ?? "",
                        Taluka = sanstha?.Taluka ?? "",
                        District = sanstha?.District ?? "",
                        Pincode = sanstha?.PinCode ?? "",
                        PhoneNo = sanstha?.ContactNo ?? ""
                    },
                    BranchID = calc.ScopedBranchId ?? 0,
                    BranchName = calc.BranchName,
                    IsConsolidated = !calc.ScopedBranchId.HasValue || calc.ScopedBranchId.Value <= 0,
                    UsedInMemoryAutoSuggestions = calc.UsedInMemoryAutoSuggestions,
                    TargetDate = calc.TargetDate.ToString("yyyy-MM-dd"),
                    TargetDateDisplay = calc.TargetDate.ToString("dd/MM/yyyy"),
                    BorrowingLimitMultiplier = calc.Multiplier,
                    ConfiguredMultiplier = calc.ConfiguredMultiplier,
                    IsMultiplierSimulated = calc.IsMultiplierSimulated,
                    StandardAssetProvisionInfo = new
                    {
                        BookedProvision = calc.StandardAssetProvision,
                        StandardLoansBase = calc.StandardLoansReferenceBase,
                        EstimatedAt040Percent = calc.EstimatedStandardAssetProvisionRef,
                        ShortfallNote = calc.StandardAssetProvision < calc.EstimatedStandardAssetProvisionRef
                            ? $"माहितीपर टीप: स्टँडर्ड कर्जांवर (₹ {calc.StandardLoansReferenceBase:N2}) ०.४०% प्रमाणे अपेक्षित सामान्य तरतूद ₹ {calc.EstimatedStandardAssetProvisionRef:N2} असून ताळेबंदात प्रत्यक्ष तरतूद ₹ {calc.StandardAssetProvision:N2} आहे. नियम ३५ नुसार फक्त ताळेबंदात प्रत्यक्ष केलेलीच तरतूद स्वनिधीत धरली आहे."
                            : null
                    },
                    Rows = rowsList,
                    TotalA = new
                    {
                        Title = "एकूण - (अ)",
                        AmountInRupees = calc.GrossOwnedFunds,
                        AmountInLakhs = ToLakh(calc.GrossOwnedFunds)
                    },
                    Deductions = deductionsList,
                    TotalB = new
                    {
                        Title = "एकूण - (ब)",
                        AmountInRupees = calc.TotalDeductions,
                        AmountInLakhs = ToLakh(calc.TotalDeductions)
                    },
                    NetSwanidhi = new
                    {
                        Title = "निव्वळ स्वनिधी (अ - ब)",
                        AmountInRupees = calc.NetOwnedFunds,
                        AmountInLakhs = ToLakh(calc.NetOwnedFunds)
                    },
                    Part2 = new
                    {
                        Title = "भाग - २ : नियम ३५ अन्वये कमाल उचल मर्यादा व प्रत्यक्ष देयता ताळमेळ विवरणपत्र",
                        NetOwnedFunds = calc.NetOwnedFunds,
                        NetOwnedFundsInLakhs = ToLakh(calc.NetOwnedFunds),
                        Multiplier = calc.Multiplier,
                        MaxBorrowingLimit = calc.MaxBorrowingLimit,
                        MaxBorrowingLimitInLakhs = ToLakh(calc.MaxBorrowingLimit),
                        LiabilitiesBreakdown = new List<object>
                        {
                            new { SrNo = "(अ)", Particular = "बचत ठेवी (Savings Bank Deposits)", Basis = $"दिनांक {calc.TargetDate:dd/MM/yyyy} अखेर शिल्लक", AmountInRupees = calc.SavingBalance, AmountInLakhs = ToLakh(calc.SavingBalance) },
                            new { SrNo = "(ब)", Particular = "मुदत ठेवी (Fixed Deposits)", Basis = $"दिनांक {calc.TargetDate:dd/MM/yyyy} अखेर शिल्लक", AmountInRupees = calc.FdBalance, AmountInLakhs = ToLakh(calc.FdBalance) },
                            new { SrNo = "(क)", Particular = "आवर्ती ठेवी (Recurring Deposits - RD)", Basis = $"दिनांक {calc.TargetDate:dd/MM/yyyy} अखेर शिल्लक", AmountInRupees = calc.RdBalance, AmountInLakhs = ToLakh(calc.RdBalance) },
                            new { SrNo = "(ड)", Particular = "दैनिक / पिग्मी ठेवी (Daily / Pigmy Deposits)", Basis = $"दिनांक {calc.TargetDate:dd/MM/yyyy} अखेर शिल्लक", AmountInRupees = calc.PigmyBalance, AmountInLakhs = ToLakh(calc.PigmyBalance) },
                            new { SrNo = "(इ)", Particular = "इतर बाह्य वित्तीय संस्थांची कर्जे / पुनर्गहाण उचल (Outside Borrowings)", Basis = "GL / SansthaBorrowings", AmountInRupees = calc.OutsideBankLoans, AmountInLakhs = ToLakh(calc.OutsideBankLoans) }
                        },
                        TotalActualLiabilities = calc.ActualOutsideLiabilities,
                        TotalActualLiabilitiesInLakhs = ToLakh(calc.ActualOutsideLiabilities),
                        SurplusHeadroom = calc.SurplusHeadroom,
                        SurplusHeadroomInLakhs = ToLakh(calc.SurplusHeadroom),
                        IsComplied = calc.IsComplied,
                        ComplianceStatusText = complianceStatusText,
                        DetailedComplianceNote = detailedComplianceNote
                    },
                    BorrowingCapacity = borrowingCapacityObj,
                    Compliance = borrowingCapacityObj,
                    Explanation2Breakdown = divCalcObj,
                    DividendCalc = divCalcObj,
                    ExcludedReserves = calc.ExcludedReserves,
                    RoundingFootnote = "टीप: लाखांतील आकडे प्रत्येक ओळीसाठी स्वतंत्रपणे २ दशांशापर्यंत पूर्णांकित (Rounded) केल्यामुळे उप-घटकांच्या लाखांतील बेरजेत व एकूण लाखांत ±0.01 ते ±0.03 लाखाचा किरकोळ पूर्णांकन फरक येऊ शकतो; रुपयातील (₹) आकडे १००% अचूक आहेत.",
                    Explanation1Text = "मुक्त व विकास निधीमध्ये जे निधी निव्वळ नफा वितरणामधून वार्षिक सभेचे मान्यतेने निर्माण झाले असून, जे निधी कोणत्याही अन्य कारणासाठी देय नाहीत किंवा ज्यामधून प्रतिवर्षी रक्कम अदा केली जात नाही अशा निधींचा समावेश होणे आवश्यक आहे. (उदा. तंत्रज्ञान विकास निधी, लाभांश समिकरण निधी इत्यादी)\n\nजे निधी उदा. सभासद कल्याण निधी, सेवक कल्याण निधी, धर्मादाय निधी, संशयित बुडीत कर्ज निधी, गुंतवणूक चढ उतार / घसारा निधी इत्यादी बाह्य देयता देण्यासाठी असल्याने सदर निधींचा मुक्त व विकास निधीमध्ये समावेश होणार नाही.\n\nनिव्वळ नफा निश्चित करण्यापूर्वी, महाराष्ट्र सहकारी संस्था नियम, १९६१ चे नियम ४९(अ) मधील तरतुदी या विशिष्ट बाबींकरिता किंवा जोखीम कमी करण्यासाठी केलेल्या असल्याने, अशा सर्व तरतुदींचा समावेश (उदा. संशयित बुडीत कर्ज तरतूद, गुंतवणूक घसारा तरतूद, कायम मालमत्ता घसारा तरतूद, प्रशिक्षण तरतूद, निवडणूक तरतूद इत्यादी) मुक्त व विकास निधीमध्ये समाविष्ट होणार नाही.",
                    Explanation2Text = "वैधानिक लेखापरिक्षकाने प्रमाणित केलेल्या निव्वळ नफा रकमेमधून नजिकचे वार्षिक सर्वसाधारण सभेचे मान्यतेनंतर जी रक्कम पुन्हा मुक्त व विकास निधीच्या स्वरुपात, स्वनिधीमध्ये घेण्यात येणार आहे, तेवढीच रक्कम शिल्लक निव्वळ नफा म्हणून गृहीत धरावी.\n\nशिल्लक निव्वळ नफा रकमेमधून नियोजित लाभांश रक्कम, अन्य तरतूदी, तसेच बाह्य देयता असलेले निधी इत्यादी रकमांचा स्वनिधीमध्ये समावेश होणार नसल्याने, सदर रकमांचा समावेश वरील शिल्लक निव्वळ नफ्यामध्ये होणार नाही.\n\nनियोजित लाभांश देय रक्कम गृहीत धरताना, मागील सलग तीन वर्षांच्या लाभांश दराची सरासरी विचारात घेऊन, देय लाभांशापोटीची नियोजित रक्कम वजावटीसाठी गृहीत धरावी."
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "स्वनिधी अहवाल जनरेट करताना त्रुटी: " + ex.Message });
            }
        }
    }

    public class SaveSwanidhiConfigDto
    {
        public int BranchID { get; set; } = 1;
        public decimal BorrowingLimitMultiplier { get; set; } = 10.0m;
        public decimal Year1DividendRate { get; set; }
        public decimal Year2DividendRate { get; set; }
        public decimal Year3DividendRate { get; set; }
        public decimal? ManualCertifiedNetProfit { get; set; }
        public List<SaveSwanidhiMappingItemDto> Mappings { get; set; } = new();
    }

    public class SaveSwanidhiMappingItemDto
    {
        public string CategoryCode { get; set; } = string.Empty;
        public string? CategoryName { get; set; }
        public int LedgerID { get; set; }
    }
}
